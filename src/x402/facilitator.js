// An x402 facilitator for Hedera, on the network we can actually run on.
//
// The public facilitator at api.blocky402.com advertises hedera:mainnet only and
// settles in USDC, so using it would mean buying mainnet USDC to pay fractions
// of a cent. We run our own on testnet instead — and hosting the facilitator as
// well as the gated service is the stronger position anyway, since neither side
// then depends on somebody else's opaque endpoint.
//
// The facilitator's job is narrow and it never holds funds:
//
//   verify  — inspect the client's partially signed transfer and confirm it
//             really does pay what the resource asked for
//   settle  — add the fee-payer signature and submit it
//
// Built to the reference scheme (x402-foundation/x402, mechanisms/hedera).
import { Client, Hbar, PrivateKey, AccountId, Transaction, TransferTransaction } from '@hiero-ledger/sdk';
import { parseKey } from '../config.js';

const isHbar = (asset) => !asset || String(asset).toUpperCase() === 'HBAR';
const sameAccount = (a, b) => AccountId.fromString(String(a)).toString() === AccountId.fromString(String(b)).toString();

const fail = (reason, detail) => ({ isValid: false, invalidReason: reason, detail });

/** Decode the base64 transaction a client sent as its payment. */
export function decodePayment(paymentPayload) {
  const b64 = paymentPayload?.payload?.transaction;
  if (!b64) throw new Error('Payment payload carries no transaction.');
  const tx = Transaction.fromBytes(Buffer.from(b64, 'base64'));
  if (!(tx instanceof TransferTransaction)) throw new Error('Payment is not a transfer.');
  return tx;
}

/**
 * Does this transaction actually pay what was asked?
 *
 * Verification is about the transfer, not about trust: we read the amounts out
 * of the signed bytes and compare them to the requirements. A client cannot
 * present a transaction that says one thing and pays another.
 */
export function verify(paymentPayload, requirements) {
  let tx;
  try { tx = decodePayment(paymentPayload); }
  catch (err) { return fail('malformed_payment', err.message); }

  if (paymentPayload.scheme && paymentPayload.scheme !== requirements.scheme) return fail('scheme_mismatch');
  if (paymentPayload.network && paymentPayload.network !== requirements.network) return fail('network_mismatch');

  const required = BigInt(requirements.amount ?? requirements.maxAmountRequired);
  let credited = 0n;

  if (isHbar(requirements.asset)) {
    for (const [account, amount] of tx.hbarTransfers ?? []) {
      if (sameAccount(account, requirements.payTo)) credited += BigInt(amount.toTinybars().toString());
    }
  } else {
    const perToken = tx.tokenTransfers ?? new Map();
    for (const [tokenId, transfers] of perToken) {
      if (tokenId.toString() !== requirements.asset) continue;
      for (const [account, amount] of transfers) {
        if (sameAccount(account, requirements.payTo)) credited += BigInt(amount.toString());
      }
    }
  }

  if (credited < required) {
    return fail('insufficient_amount', `pays ${credited} to ${requirements.payTo}, needs ${required}`);
  }

  const feePayer = requirements.extra?.feePayer;
  const txPayer = tx.transactionId?.accountId?.toString();
  if (feePayer && txPayer && !sameAccount(txPayer, feePayer)) {
    return fail('wrong_fee_payer', `transaction id belongs to ${txPayer}, expected ${feePayer}`);
  }

  return { isValid: true, credited: credited.toString(), asset: requirements.asset ?? 'HBAR' };
}

/**
 * Add the fee-payer signature and submit.
 *
 * The SDK's execute() only pre-checks, so success is only knowable from the
 * receipt — a transfer can pass pre-check and still fail at consensus for an
 * unassociated token or an empty balance.
 */
export async function settle(paymentPayload, requirements, { feePayerId, feePayerKey, network = 'testnet' }) {
  const client = (network === 'mainnet' ? Client.forMainnet() : Client.forTestnet())
    .setOperator(feePayerId, typeof feePayerKey === 'string' ? parseKey(feePayerKey) : feePayerKey);
  try {
    const tx = decodePayment(paymentPayload);
    const signed = await tx.sign(typeof feePayerKey === 'string' ? parseKey(feePayerKey) : feePayerKey);
    const res = await signed.execute(client);
    await res.getReceipt(client);
    return { success: true, transaction: res.transactionId.toString(), network: requirements.network };
  } catch (err) {
    return { success: false, errorReason: 'transaction_failed', detail: String(err.message ?? err).slice(0, 200) };
  } finally {
    client.close();
  }
}
