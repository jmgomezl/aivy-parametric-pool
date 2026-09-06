// The payout leg.
//
// The key structure and the ledger's 62-day ceiling come from the
// hak-scheduled-settlement plugin, which is where the reusable part of this
// project lives. The schedule itself is built with the SDK here because this
// script is not yet a Hedera Agent Kit agent — wiring the plugin's tools into
// the Aivy canvas agent is the remaining step.
//
// At purchase the pool agent pre-signs the scheduled transfer, so from then on
// the only signatures the payout still needs are the oracles'.
import {
  ScheduleCreateTransaction, ScheduleSignTransaction, ScheduleInfoQuery,
  TransferTransaction, Hbar, Timestamp, ScheduleId, PrivateKey, TokenId,
} from '@hiero-ledger/sdk';
import { MAX_EXPIRY_SECONDS } from 'hak-scheduled-settlement';
import { settlementAsset } from '../asset.js';

export async function schedulePayout(client, { poolId, beneficiaryId, payoutUnits, network, days, memo, expiresAt }) {
  const expirySeconds = Math.min(days * 24 * 3600, MAX_EXPIRY_SECONDS);
  const asset = settlementAsset(network);
  const amount = Math.round(payoutUnits);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Payout units must be a positive integer');
  const expiry = expiresAt ? new Date(expiresAt) : new Date(Date.now() + expirySeconds * 1000);

  const inner = new TransferTransaction();
  if (asset.kind === 'hbar') {
    inner.addHbarTransfer(poolId, Hbar.fromTinybars(-amount)).addHbarTransfer(beneficiaryId, Hbar.fromTinybars(amount));
  } else {
    const t = TokenId.fromString(asset.tokenId);
    inner.addTokenTransfer(t, poolId, -amount).addTokenTransfer(t, beneficiaryId, amount);
  }

  const res = await new ScheduleCreateTransaction()
    .setScheduledTransaction(inner)
    .setScheduleMemo(memo ?? 'parametric payout')
    .setExpirationTime(Timestamp.fromDate(expiry))
    .setWaitForExpiry(false) // fire the instant the quorum completes
    .execute(client);

  const receipt = await res.getReceipt(client);
  return {
    status: 'success',
    scheduleId: receipt.scheduleId.toString(),
    transactionId: res.transactionId.toString(),
    expiresAt: expiry.toISOString(),
  };
}

export async function attest(client, scheduleId, oraclePrivateKey) {
  const id = ScheduleId.fromString(scheduleId);
  const tx = await (await new ScheduleSignTransaction().setScheduleId(id).freezeWith(client))
    .sign(PrivateKey.fromStringDer(oraclePrivateKey));
  const res = await tx.execute(client);
  await res.getReceipt(client);

  const info = await new ScheduleInfoQuery().setScheduleId(id).execute(client);
  const executed = info.executed !== null;
  return { executed, executedAt: executed ? info.executed.toDate().toISOString() : null };
}

export async function payoutStatus(client, scheduleId) {
  const info = await new ScheduleInfoQuery()
    .setScheduleId(ScheduleId.fromString(scheduleId)).execute(client);
  return { executed: info.executed !== null };
}
