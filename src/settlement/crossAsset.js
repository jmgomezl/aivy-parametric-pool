// Live Uniswap liquidity quotes for a hypothetical USDC equivalent of cover.
// Hedera payout funds are not bridged, approved, or swapped by this service.
import { uniswapPlugin } from 'hak-uniswap-plugin';

export const STABLES = {
  8453: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, chain: 'base' },
  130: { symbol: 'USDC', address: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', decimals: 6, chain: 'unichain' },
};
const TTL = 30_000;
export class QuoteError extends Error {
  constructor(reason, message) { super(message); this.reason = reason; }
}

// Bounded cache and in-flight coalescing protect the shared API quota.
export function createQuoteService({ executeQuote, now = Date.now }) {
  const cache = new Map(), pending = new Map();
  let windowStart = now(), requests = 0;
  return async function quoteCrossAsset({ payoutUsd, chainId = 8453, tokenOut = 'native' }) {
    if (!Number.isFinite(payoutUsd) || payoutUsd < .01 || payoutUsd > 1_000_000)
      throw new QuoteError('invalid_input', 'Choose an amount between 0.01 and 1,000,000 USDC.');
    const stable = STABLES[chainId];
    if (!stable || tokenOut !== 'native') throw new QuoteError('invalid_input', 'Choose USDC to ETH on Base or Unichain.');
    const amountIn = BigInt(Math.round(payoutUsd * 1e6)).toString();
    const key = `${chainId}:${amountIn}`;
    const saved = cache.get(key);
    if (saved && Date.parse(saved.expiresAt) > now()) return saved;
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 16) throw new QuoteError('rate_limited', 'Quotes are busy. Try again shortly.');
    if (now() - windowStart >= 60_000) { windowStart = now(); requests = 0; }
    if (requests >= 60) throw new QuoteError('rate_limited', 'Quote limit reached. Try again in a minute.');
    requests++;
    const task = (async () => {
      let timer;
      try {
        const result = await Promise.race([
          executeQuote({ tokenIn: stable.address, tokenOut, amountIn, chainId, slippageBps: 50 }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 20_000); }),
        ]);
        if (!/^\d+$/.test(String(result.amountOut)) || BigInt(result.amountOut) <= 0n || result.outputDecimals !== 18)
          throw new Error('Invalid quote output');
        const at = now();
        const q = {
          ok: true, via: 'hak-uniswap-plugin', provider: 'Uniswap Trading API', network: 'mainnet',
          from: { symbol: stable.symbol, address: stable.address, amount: amountIn, decimals: 6, usd: Number(amountIn) / 1e6 },
          to: { symbol: 'ETH', address: 'native', amount: result.amountOut, decimals: 18 },
          chain: { id: chainId, name: stable.chain }, route: result.route,
          quoteId: result.quote?.quoteId ?? null,
          gasFeeUsd: result.quote?.gasFeeUSD ?? null,
          quotedAt: new Date(at).toISOString(), expiresAt: new Date(at + TTL).toISOString(),
          unsignedTx: result.unsignedTx, approved: false, broadcast: false,
          boundary: 'Live mainnet quote for a hypothetical USDC equivalent. Demo aUSDd has no cash value. Hedera funds are not bridged. Nothing was approved or broadcast.',
        };
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, q);
        return q;
      } catch {
        throw new QuoteError('quote_unavailable', 'Uniswap could not return a quote. Try again shortly.');
      } finally { clearTimeout(timer); }
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  };
}

export const quoteCrossAsset = createQuoteService({ executeQuote: params => {
  const tool = uniswapPlugin.tools({}).find(t => t.method === 'uniswap_quote');
  if (!tool) throw new Error('Uniswap quote tool unavailable');
  return tool.execute(null, {}, params);
} });
