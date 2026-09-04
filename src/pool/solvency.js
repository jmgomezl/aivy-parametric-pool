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
import { AccountBalanceQuery } from '@hiero-ledger/sdk';

export async function poolCapitalTinybar(client, poolId) {
  const bal = await new AccountBalanceQuery().setAccountId(poolId).execute(client);
  return bal.hbars.toTinybars().toNumber();
}

/**
 * @param committedTinybar sum of payouts on policies already live
 * @param requestedTinybar payout of the policy being considered
 */
export async function canUnderwrite(client, poolId, committedTinybar, requestedTinybar) {
  const capital = await poolCapitalTinybar(client, poolId);
  const exposureAfter = committedTinybar + requestedTinybar;
  const ok = exposureAfter <= capital;
  return {
    ok, capital, committed: committedTinybar, requested: requestedTinybar, exposureAfter,
    headroom: capital - exposureAfter,
    reason: ok ? null
      : `refused: exposure ${(exposureAfter / 1e8).toFixed(4)} HBAR would exceed capital ` +
        `${(capital / 1e8).toFixed(4)} HBAR by ${((exposureAfter - capital) / 1e8).toFixed(4)}`,
  };
}
