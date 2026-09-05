// Cross-asset settlement, quoted honestly.
//
// A payout lands in the pool's settlement asset on Hedera. A beneficiary may
// want something else — the stablecoin they actually spend, or the native asset
// of a chain they already use. Uniswap has that liquidity, and hak-uniswap-plugin
// already knows how to reach it, so this asks the plugin rather than
// reimplementing the Trading API.
//
// THE BOUNDARY, STATED PLAINLY: that liquidity lives on an EVM chain and this
// payout lives on Hedera. Crossing between them needs a bridge, and this protocol
// deliberately does not have one. So the agent goes exactly as far as it honestly
// can — it prices the conversion against real liquidity and returns the unsigned
// transaction that would execute it — and then it stops.
//
// A "simple trustless bridge" to close the gap would be a handful of signers
// attesting that something happened on another chain: a custodian, which is the
// thing this whole design exists to remove. Hashgraph's Cross-Ledger Protocol is
// the right answer to the seam — bridgeless, over state proofs and threshold
// signatures, the same family of idea as this pool's key — and it is not open to
// developers yet.
import { uniswapPlugin } from 'hak-uniswap-plugin';

/** USD-denominated tokens a payout is notionally equivalent to, per chain. */
export const STABLES = {
  8453: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, chain: 'base' },
  130: { symbol: 'USDC', address: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', decimals: 6, chain: 'unichain' },
};

const quoteTool = () => {
  const tool = uniswapPlugin.tools({}).find((t) => t.method === 'uniswap_quote');
  if (!tool) throw new Error('hak-uniswap-plugin is too old: it has no uniswap_quote tool (need >= 0.2.0).');
  return tool;
};

/**
 * What a payout would convert into, and the transaction that would do it.
 *
 * `payoutUsd` is the policy's cover, treated as that much of a USD-denominated
 * token on the target chain — which is exactly the equivalence a bridge would
 * have to establish, and the reason this stops at a quote.
 */
export async function quoteCrossAsset({
  payoutUsd,
  chainId = Number(process.env.EVM_CHAIN_ID ?? 8453),
  tokenOut = 'native',
  beneficiaryEvmAddress = process.env.EVM_BENEFICIARY,
  slippageBps = 50,
}) {
  const stable = STABLES[chainId];
  if (!stable) throw new Error(`No USD-denominated token registered for chain ${chainId}.`);

  const amountIn = BigInt(Math.round(payoutUsd * 10 ** stable.decimals)).toString();
  const result = await quoteTool().execute(null, {}, {
    tokenIn: stable.address,
    tokenOut,
    amountIn,
    chainId,
    slippageBps,
    ...(beneficiaryEvmAddress ? { swapper: beneficiaryEvmAddress } : {}),
  });

  return {
    ok: true,
    via: 'hak-uniswap-plugin',
    from: { symbol: stable.symbol, address: stable.address, amount: amountIn, usd: payoutUsd },
    to: { address: tokenOut, amount: result.amountOut, decimals: result.outputDecimals },
    chain: { id: chainId, name: result.chain ?? stable.chain },
    route: result.route,
    unsignedTx: result.unsignedTx,
    // Returned, not merely commented, so a caller cannot use this and quietly
    // present it as a completed settlement.
    boundary:
      'Quote only. This payout is on Hedera and this liquidity is on ' +
      `${result.chain ?? stable.chain}; crossing between them needs a bridge, which this ` +
      'protocol deliberately does not have. Nothing was approved or broadcast.',
  };
}
