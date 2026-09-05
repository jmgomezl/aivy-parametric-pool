// The agent signs with a key that holds real money, so the write endpoint is a
// loaded weapon pointed at the treasury. Three locks, each answering a different
// way it can go wrong.
const DAY = 86_400_000;
const HOUR = 3_600_000;

export const LIMITS = {
  /** Writes are refused on mainnet unless someone deliberately opts in. */
  allowMainnetWrites: process.env.ALLOW_MAINNET_WRITES === '1',
  /** One visitor cannot monopolise the faucet. */
  perIpPerHour: Number(process.env.LIMIT_PER_IP_HOUR ?? 3),
  /** Nor can the whole internet, collectively, in a day. */
  policiesPerDay: Number(process.env.LIMIT_POLICIES_DAY ?? 100),
  /** And a hard ceiling on what may be committed, whatever the count. */
  hbarPerDay: Number(process.env.LIMIT_HBAR_DAY ?? 400),
};

const hits = new Map();   // ip -> timestamps
const spend = [];         // { at, hbar }

const prune = (now) => {
  for (const [ip, times] of hits) {
    const kept = times.filter((t) => now - t < HOUR);
    if (kept.length) hits.set(ip, kept); else hits.delete(ip);
  }
  while (spend.length && now - spend[0].at > DAY) spend.shift();
};

export function budgetToday() {
  prune(Date.now());
  return {
    policies: spend.length,
    hbar: spend.reduce((s, e) => s + e.hbar, 0),
    limits: { policies: LIMITS.policiesPerDay, hbar: LIMITS.hbarPerDay },
  };
}

/** Decide whether a write may proceed. Returns null when it may. */
export function checkWrite({ network, ip, hbar }) {
  const now = Date.now();
  prune(now);

  if (network === 'mainnet' && !LIMITS.allowMainnetWrites) {
    return {
      status: 403, reason: 'mainnet_writes_disabled',
      message: 'This agent will not spend real HBAR on request. Issue policies on testnet; ' +
               'the mainnet run linked from the timeline was made deliberately, from a terminal.',
    };
  }

  const mine = hits.get(ip) ?? [];
  if (mine.length >= LIMITS.perIpPerHour) {
    return {
      status: 429, reason: 'rate_limited',
      message: `You have issued ${mine.length} policies in the last hour, which is the limit. ` +
               'Quoting stays free and unlimited.',
      retryAfter: Math.ceil((HOUR - (now - mine[0])) / 1000),
    };
  }

  const today = budgetToday();
  if (today.policies >= LIMITS.policiesPerDay) {
    return { status: 429, reason: 'daily_policy_cap', message: 'The demo has issued its policies for today.' };
  }
  if (today.hbar + hbar > LIMITS.hbarPerDay) {
    return {
      status: 429, reason: 'daily_hbar_cap',
      message: `Issuing this would commit ${(today.hbar + hbar).toFixed(2)} HBAR today, above the ` +
               `${LIMITS.hbarPerDay} HBAR the demo is allowed to put at risk.`,
    };
  }
  return null;
}

/** Record a write that actually happened. */
export function recordWrite({ ip, hbar }) {
  const now = Date.now();
  hits.set(ip, [...(hits.get(ip) ?? []), now]);
  spend.push({ at: now, hbar });
}
