// Cross-asset settlement, quoted honestly.
//
// A payout lands in the pool's settlement asset on Hedera. A beneficiary may
// want something else — the local stablecoin, ETH, whatever they actually spend.
// Uniswap has the liquidity for that, through its Trading API.
//
// THE BOUNDARY, STATED PLAINLY: Uniswap's liquidity lives on EVM chains and this
// payout lives on Hedera. Moving between them needs a bridge, and this project
// does not have one. So the agent goes exactly as far as it honestly can — it
// prices the conversion against real Uniswap liquidity and returns the unsigned
// transaction that would execute it — and then it stops.
//
// Building a "simple trustless bridge" to close that gap would mean a handful of
// signers attesting that something happened on another chain. That is a
// custodian, which is the thing this entire protocol exists to remove. Hashgraph's
// Cross-Ledger Protocol is the right answer to this seam — state proofs and
// threshold signatures, the same family of idea as this pool's key — and it is
// not open to developers yet.
const TRADE_API = process.env.UNISWAP_TRADE_API || 'https://trade-api.gateway.uniswap.org/v1';

/** USD-denominated tokens the payout is notionally equivalent to, per chain. */
export const STABLES = {
  130: { symbol: 'USDC', address: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', decimals: 6, chain: 'unichain' },
  8453: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, chain: 'base' },
  1: { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, chain: 'ethereum' },
};

const NATIVE = '0x0000000000000000000000000000000000000000';

// The router times out under load and says so — those are worth retrying, and a
// validation error is not.
const TRANSIENT = /UpstreamTimeout|may succeed on retry|502|503|504/i;

async function tradeApi(path, body, attempt = 0) {
  const key = process.env.UNISWAP_API_KEY;
  if (!key) throw new Error('UNISWAP_API_KEY is not set; the Trading API rejects unauthenticated calls.');
  const res = await fetch(`${TRADE_API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.ok) return res.json();

  const text = (await res.text()).slice(0, 300);
  if (attempt < 2 && TRANSIENT.test(text)) {
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    return tradeApi(path, body, attempt + 1);
  }
  throw new Error(`Uniswap ${path} → ${res.status}: ${text}`);
}

/**
 * What a payout would convert into, and the transaction that would do it.
 *
 * `payoutUsd` is the policy's cover. It is treated as that much of a
 * USD-denominated token on the target chain — which is exactly the equivalence
 * a bridge would have to establish, and the reason this stops at a quote.
 */
export async function quoteCrossAsset({
  payoutUsd,
  chainId = Number(process.env.EVM_CHAIN_ID ?? 8453),
  tokenOut = NATIVE,
  beneficiaryEvmAddress = process.env.EVM_BENEFICIARY ?? '0x0000000000000000000000000000000000000001',
  slippageBps = 50,
}) {
  const stable = STABLES[chainId];
  if (!stable) throw new Error(`No USD-denominated token registered for chain ${chainId}.`);

  const amountIn = BigInt(Math.round(payoutUsd * 10 ** stable.decimals)).toString();
  const { quote } = await tradeApi('/quote', {
    type: 'EXACT_INPUT',
    tokenInChainId: chainId, tokenOutChainId: chainId,
    tokenIn: stable.address, tokenOut,
    amount: amountIn,
    swapper: beneficiaryEvmAddress,
    slippageTolerance: slippageBps / 100,
  });

  const { swap } = await tradeApi('/swap', { quote });

  const outDecimals = quote?.output?.decimals ?? 18;
  const outAmount = quote?.output?.amount ?? quote?.quote ?? null;

  return {
    ok: true,
    from: { symbol: stable.symbol, address: stable.address, amount: amountIn, usd: payoutUsd },
    to: { address: tokenOut, amount: outAmount, decimals: outDecimals },
    chain: { id: chainId, name: stable.chain },
    unsignedTx: swap,
    quote,
    // Said in the response, not only in a comment, so a caller cannot use this
    // and quietly present it as a completed settlement.
    boundary:
      'Quote only. This payout is on Hedera and this liquidity is on ' +
      `${stable.chain}; crossing between them needs a bridge, which this protocol ` +
      'deliberately does not have. The transaction above is ready to sign by ' +
      'whoever holds the funds on that chain.',
  };
}
