// What the pool holds, what a premium is paid in, and what a payout delivers.
//
// Denominating in HBAR made the cover itself float: a policy promising a fixed
// number of tinybars promises less protection when HBAR falls, which is a real
// defect in a product whose whole premise is that the payout is known in
// advance. Settling in a dollar-denominated token removes that, and it also
// removes the demo-scale fiction — $4 of premium is 4 tokens, $804 of cover is
// 804 tokens, and the numbers on screen are the numbers on the ledger.
//
// Circle issues native USDC on both networks, so the default is the real thing
// rather than a token we minted and called a dollar.
export const USDC = {
  mainnet: '0.0.456858',
  testnet: '0.0.429274',
};

// Real USDC is the honest asset, but Circle's testnet faucet gives 20 USDC every
// two hours, and a pool that backs a single $804 policy would need about $4,000 —
// two weeks of asking. So the public demo settles in a unit we mint ourselves,
// and the code stays asset-agnostic so pointing it at real USDC is one variable.
//
// The demo unit is named so nobody can mistake it for a dollar they can redeem.
import { load } from './registry.js';

export const DEMO_UNIT = { name: 'Aivy Demo Dollar (unbacked)', symbol: 'aUSDd', decimals: 6 };

/** The settlement asset for this network. */
export function settlementAsset(network = 'testnet') {
  const override = process.env.SETTLEMENT_TOKEN_ID;
  if (override === 'HBAR') return { kind: 'hbar', symbol: 'ℏ', decimals: 8, tokenId: null };
  if (override === 'USDC') {
    const id = USDC[network];
    return { kind: 'token', tokenId: id, symbol: 'USDC', decimals: 6, isUsdc: true, backed: true };
  }
  // The demo unit is a provisioned asset, so it is resolved from the registry
  // rather than an environment variable that only exists inside one process.
  const tokenId = override ?? process.env.DEMO_TOKEN_ID ?? load(network).demoTokenId;
  if (!tokenId) return { kind: 'hbar', symbol: 'ℏ', decimals: 8, tokenId: null };
  const isUsdc = tokenId === USDC[network];
  return {
    kind: 'token', tokenId, decimals: 6,
    symbol: isUsdc ? 'USDC' : DEMO_UNIT.symbol,
    isUsdc, backed: isUsdc,
  };
}

/** USD -> the asset's smallest unit. A dollar-denominated token needs no rate. */
export function toUnits(usd, asset, hbarUsdRate) {
  if (asset.kind === 'hbar') {
    if (!hbarUsdRate) throw new Error('Settling in HBAR needs an HBAR/USD rate.');
    return Math.round((usd / hbarUsdRate) * 10 ** asset.decimals);
  }
  return Math.round(usd * 10 ** asset.decimals);
}

export const fromUnits = (units, asset) => units / 10 ** asset.decimals;

/** How the amount should read on screen. */
export const format = (units, asset, dp = 2) =>
  `${fromUnits(units, asset).toFixed(dp)} ${asset.symbol}`;
