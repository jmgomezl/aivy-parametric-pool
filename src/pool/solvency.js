// The solvency guard.
//
// Not an exception rule but a permanent invariant: committed exposure must never
// exceed pool capital. If it ever did, a pre-signed payout would execute against
// an insufficient balance and simply FAIL — and because each scheduled payout is
// independent there is no queue, no ordering and no pro-rata. Whoever's oracles
// signed first would be paid in full and the last claimant would get nothing.
//
// So insolvency is not something to handle gracefully. It is something to make
// impossible by refusing to underwrite past capital.
import { AccountBalanceQuery, TokenId } from '@hiero-ledger/sdk';
import { settlementAsset } from '../asset.js';

/** Pool capital in the settlement asset's smallest unit. */
export async function poolCapital(client, poolId, network) {
  const asset = settlementAsset(network);
  const bal = await new AccountBalanceQuery().setAccountId(poolId).execute(client);
  if (asset.kind === 'hbar') return bal.hbars.toTinybars().toNumber();
  return Number(bal.tokens?.get(TokenId.fromString(asset.tokenId)) ?? 0);
}

/** @deprecated use poolCapital — kept so HBAR-era callers still read correctly */
export const poolCapitalTinybar = (client, poolId) => poolCapital(client, poolId, 'hbar-legacy');

/**
 * @param committedTinybar sum of payouts on policies already live
 * @param requestedTinybar payout of the policy being considered
 */
export async function canUnderwrite(client, poolId, committedTinybar, requestedTinybar, network) {
  const capital = await poolCapital(client, poolId, network);
  const asset = settlementAsset(network);
  const format = units => `${(units / 10 ** asset.decimals).toFixed(2)} ${asset.symbol}`;
  const exposureAfter = committedTinybar + requestedTinybar;
  const ok = exposureAfter <= capital;
  return {
    ok, capital, committed: committedTinybar, requested: requestedTinybar, exposureAfter,
    headroom: capital - exposureAfter,
    reason: ok ? null : `This cover exceeds available capacity by ${format(exposureAfter-capital)}. Try a smaller budget.`,
  };
}
