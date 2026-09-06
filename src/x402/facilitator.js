import { proto } from '@hiero-ledger/proto';
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
  const feePayer = requirements.extra?.feePayer;
  if (!feePayer || required <= 0n) return fail('invalid_requirements');
  let credited = 0n;
  try {
    const bodies = tx.signableNodeBodyBytesList;
    if (!bodies.length) return fail('missing_transaction_body');
    for (const entry of bodies) {
      const bytes = entry.signableTransactionBodyBytes;
      const body = proto.TransactionBody.decode(bytes);
      // Reject unknown fields too: the verifier must understand every byte it signs.
      if (!Buffer.from(proto.TransactionBody.encode(body).finish()).equals(Buffer.from(bytes))) return fail('unsupported_transaction_fields');
      if (!body.cryptoTransfer || body.data !== 'cryptoTransfer') return fail('unexpected_operation');
      if (!sameAccount(entry.transactionId.accountId, feePayer)) return fail('wrong_fee_payer');
      if (BigInt(body.transactionFee.toString()) > BigInt(requirements.extra?.maxFeeTinybar ?? 100000000)) return fail('excessive_transaction_fee');
      const transfer = body.cryptoTransfer;
      let legs;
      if (isHbar(requirements.asset)) {
        if (transfer.tokenTransfers?.length) return fail('unexpected_asset');
        legs = transfer.transfers?.accountAmounts ?? [];
      } else {
        if (transfer.transfers?.accountAmounts?.length || transfer.tokenTransfers?.length !== 1) return fail('unexpected_transfer');
        const token = transfer.tokenTransfers[0];
        const id = `${token.token.shardNum ?? 0}.${token.token.realmNum ?? 0}.${token.token.tokenNum}`;
        if (id !== requirements.asset || token.nftTransfers?.length) return fail('unexpected_asset');
        legs = token.transfers ?? [];
      }
      const account = leg => {
        const id = leg.accountID;
        if (!id || id.alias?.length || id.accountNum == null) throw new Error('Numeric accounts required');
        return `${id.shardNum ?? 0}.${id.realmNum ?? 0}.${id.accountNum}`;
      };
      if (legs.length !== 2 || legs.some(leg => leg.isApproval)) return fail('unexpected_transfer');
      const credit = legs.find(leg => BigInt(leg.amount.toString()) === required && sameAccount(account(leg), requirements.payTo));
      const debit = legs.find(leg => BigInt(leg.amount.toString()) === -required);
      if (!credit || !debit || sameAccount(account(debit), requirements.payTo)) return fail('incorrect_payment');
      if (sameAccount(account(debit), feePayer)) return fail('facilitator_debit');
      credited = required;
    }
  } catch (err) { return fail('malformed_payment', err.message); }

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
  const check = verify(paymentPayload, requirements);
  if (!check.isValid) return { success: false, errorReason: check.invalidReason };
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
