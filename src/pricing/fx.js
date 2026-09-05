// The economics are modelled in USD; the ledger settles in HBAR.
//
// These are not the same scale and pretending otherwise breaks the model. A
// policy that makes sense in the world — $4 of premium for $800 of cover — is
// roughly 50 ℏ and 10,000 ℏ, which no hackathon treasury can fund. So the model
// prices the REAL policy in USD, and a demo scale factor shrinks only the
// amounts that actually move on-chain.
//
// Both figures go into the terms published to HCS, along with the rate used, so
// the record shows exactly what was modelled and what was settled. Quietly
// pricing a $3 policy as if it were an $800 one would make every number on
// screen a lie.
const SOURCES = [
  { name: 'coingecko', url: 'https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd', pick: (j) => j['hedera-hashgraph']?.usd },
  { name: 'coinbase', url: 'https://api.coinbase.com/v2/exchange-rates?currency=HBAR', pick: (j) => Number(j?.data?.rates?.USD) },
];

/** Live HBAR price in USD, with a fallback source. */
export async function hbarUsd() {
  const errors = [];
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`${res.status}`);
      const price = s.pick(await res.json());
      if (Number.isFinite(price) && price > 0) return { price, source: s.name, at: new Date().toISOString() };
      throw new Error('no price in response');
    } catch (err) { errors.push(`${s.name}: ${err.message}`); }
  }
  throw new Error(`No HBAR price available (${errors.join('; ')})`);
}

export const usdToHbar = (usd, rate) => usd / rate;
export const hbarToUsd = (hbar, rate) => hbar * rate;

/**
 * How much smaller the on-chain policy is than the modelled one.
 * `DEMO_SCALE=1` settles at real size; the default keeps a full run affordable.
 */
export const demoScale = () => Number(process.env.DEMO_SCALE ?? 0.005);
