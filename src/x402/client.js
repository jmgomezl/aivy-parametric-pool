// Paying for an HTTP request, the x402 way.
//
// Hedera's "exact" scheme is unusual and rather elegant: the payer builds the
// transfer and signs it, but leaves the fee payer to the facilitator. So the
// client never needs gas, never broadcasts anything, and the facilitator never
// holds funds — it adds one signature and submits. The payment is a transaction
// that only becomes valid when both parties have signed it, which is the same
// idea as this project's payout, at a much smaller scale.
import { Client, Hbar, PrivateKey, AccountId, TokenId, TransferTransaction, TransactionId } from '@hiero-ledger/sdk';
import { parseKey } from '../config.js';

export const X402_VERSION = 2;

const isHbar = (asset) => !asset || String(asset).toUpperCase() === 'HBAR';

/** Build and partially sign the payment. Returns the header value to retry with. */
export async function buildPayment({ requirements, payerId, payerKey, network = 'mainnet' }) {
  const feePayer = requirements.extra?.feePayer;
  if (!feePayer) throw new Error('Payment requirements carry no facilitator feePayer.');

  const from = AccountId.fromString(payerId.toString());
  const to = AccountId.fromString(requirements.payTo);
  const amount = BigInt(requirements.amount ?? requirements.maxAmountRequired);
  const asset = requirements.asset;

  // Built to match the reference implementation exactly
  // (x402-foundation/x402, mechanisms/hedera/src/signer.ts): no node pinning and
  // no memo. Pinning a node would stop the facilitator submitting to another,
  // and anything the reference omits is something verification may reject.
  const tx = new TransferTransaction();

  if (!asset || isHbar(asset)) {
    tx.addHbarTransfer(from, Hbar.fromTinybars((-amount).toString())).addHbarTransfer(to, Hbar.fromTinybars(amount.toString()));
  } else {
    const token = TokenId.fromString(asset);
    tx.addTokenTransfer(token, from, -amount).addTokenTransfer(token, to, amount);
  }

  // The transaction id belongs to the facilitator because the facilitator pays
  // the fee. That is what lets a client with no HBAR for gas still pay.
  tx.setTransactionId(TransactionId.generate(AccountId.fromString(feePayer)));

  const client = (network === 'mainnet' ? Client.forMainnet() : Client.forTestnet());
  const frozen = tx.freezeWith(client);
  const signed = await frozen.sign(typeof payerKey === 'string' ? parseKey(payerKey) : payerKey);
  client.close();

  const payload = {
    x402Version: X402_VERSION,
    scheme: requirements.scheme,
    network: requirements.network,
    payload: { transaction: Buffer.from(signed.toBytes()).toString('base64') },
  };
  return { payload, header: Buffer.from(JSON.stringify(payload)).toString('base64') };
}

/**
 * Fetch a resource, paying if it asks. The whole point of x402: the caller writes
 * one line and the payment happens inside it.
 */
export async function fetchPaid(url, { payerId, payerKey, network = 'mainnet', init = {} } = {}) {
  const first = await fetch(url, init);
  if (first.status !== 402) return { response: first, paid: false };

  const body = await first.json();
  const requirements = (body.accepts ?? [])[0];
  if (!requirements) throw new Error('402 with no payment requirements to satisfy.');

  const { header } = await buildPayment({ requirements, payerId, payerKey, network });
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), 'X-PAYMENT': header },
  });
  return { response, paid: true, requirements };
}
