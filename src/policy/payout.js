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
  TransferTransaction, Hbar, Timestamp, ScheduleId, PrivateKey,
} from '@hiero-ledger/sdk';
import { MAX_EXPIRY_SECONDS } from 'hak-scheduled-settlement';

export async function schedulePayout(client, { poolId, beneficiaryId, payoutHbar, days, memo }) {
  const expirySeconds = Math.min(days * 24 * 3600, MAX_EXPIRY_SECONDS);

  const inner = new TransferTransaction()
    .addHbarTransfer(poolId, new Hbar(-payoutHbar))
    .addHbarTransfer(beneficiaryId, new Hbar(payoutHbar));

  const res = await new ScheduleCreateTransaction()
    .setScheduledTransaction(inner)
    .setScheduleMemo(memo ?? 'parametric payout')
    .setExpirationTime(Timestamp.fromDate(new Date(Date.now() + expirySeconds * 1000)))
    .setWaitForExpiry(false) // fire the instant the quorum completes
    .execute(client);

  const receipt = await res.getReceipt(client);
  return {
    status: 'success',
    scheduleId: receipt.scheduleId.toString(),
    transactionId: res.transactionId.toString(),
    expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString(),
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
