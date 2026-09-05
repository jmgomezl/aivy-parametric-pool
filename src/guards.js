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
  /** And a hard ceiling on the cover committed, in USD — the unit the policy is
   *  modelled in, so the cap means the same thing whatever the ledger settles. */
  usdPerDay: Number(process.env.LIMIT_USD_DAY ?? 20_000),
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
    usd: spend.reduce((s, e) => s + e.usd, 0),
    limits: { policies: LIMITS.policiesPerDay, usd: LIMITS.usdPerDay },
  };
}

/** Decide whether a write may proceed. Returns null when it may. */
export function checkWrite({ network, ip, usd }) {
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
  if (today.usd + usd > LIMITS.usdPerDay) {
    return {
      status: 429, reason: 'daily_cover_cap',
      message: `Issuing this would commit $${(today.usd + usd).toLocaleString()} of cover today, above ` +
               `the $${LIMITS.usdPerDay.toLocaleString()} the demo is allowed to put at risk.`,
    };
  }
  return null;
}

/** Record a write that actually happened. */
export function recordWrite({ ip, usd }) {
  const now = Date.now();
  hits.set(ip, [...(hits.get(ip) ?? []), now]);
  spend.push({ at: now, usd });
}
