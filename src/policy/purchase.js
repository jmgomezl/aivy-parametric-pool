// Premium settlement: buyer, pool and broker in ONE atomic transaction.
//
// The broker commission is deliberately NOT an HTS custom fee. Custom fees are
// defined on the token, so the collector account is fixed in the token's fee
// schedule — every sale would pay the same broker. Varying it per sale would mean
// a TokenFeeScheduleUpdate before each purchase: an extra transaction, a race
// between concurrent sales, and something that has to be awake to do it.
//
// A multi-party TransferTransaction has none of those problems. The broker can be
// any account, different on every sale, and the three legs settle or fail
// together — the pool never custodies the commission and the broker cannot be
// stiffed. This is what makes "anyone can be a broker" actually work.
import { TransferTransaction, Hbar, AccountId } from '@hiero-ledger/sdk';

export const DEFAULT_COMMISSION_BPS = 1500; // 15%

export async function purchasePolicy(client, {
  buyerId, buyerKey, poolId, brokerId, premiumHbar, commissionBps = DEFAULT_COMMISSION_BPS,
}) {
  const premium = Math.round(premiumHbar * 1e8);          // tinybar
  // A sale with no broker keeps the whole premium in the pool. The commission has
  // to be zero in that case, not merely undelivered: a transfer list that does not
  // sum to zero is rejected outright, so an unpaid commission would break the sale.
  const hasBroker = Boolean(brokerId);
  const commission = hasBroker ? Math.round((premium * commissionBps) / 10000) : 0;
  const toPool = premium - commission;

  const tx = new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(buyerId.toString()), Hbar.fromTinybars(-premium))
    .addHbarTransfer(AccountId.fromString(poolId.toString()), Hbar.fromTinybars(toPool));

  if (hasBroker && commission > 0) {
    tx.addHbarTransfer(AccountId.fromString(brokerId.toString()), Hbar.fromTinybars(commission));
  }

  const signed = await (await tx.freezeWith(client)).sign(buyerKey);
  const res = await signed.execute(client);
  await res.getReceipt(client);

  return {
    txId: res.transactionId.toString(),
    premiumTinybar: premium,
    toPoolTinybar: toPool,
    commissionTinybar: commission,
    commissionBps: hasBroker ? commissionBps : 0,
  };
}
