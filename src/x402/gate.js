// The 402 half: what a resource server does to charge for a request.
//
// No payment header -> 402 with the terms, stated well enough that a machine can
// satisfy them without a human reading a page. A header -> verify it really pays,
// settle it on-chain, then serve. The resource is never served before settlement
// resolves, so a client cannot get the answer and skip the payment.
import { verify, settle } from './facilitator.js';

export const X402_VERSION = 2;

/**
 * The terms for one paid resource.
 * `amount` is in the asset's smallest unit — for USDC, millionths of a dollar.
 */
export function requirements({ amount, payTo, asset, resource, description, network, feePayer, timeoutSeconds = 60 }) {
  return {
    x402Version: X402_VERSION,
    scheme: 'exact',
    network,
    amount: String(amount),
    maxAmountRequired: String(amount),
    asset: asset ?? 'HBAR',
    payTo: String(payTo),
    resource,
    description,
    mimeType: 'application/json',
    maxTimeoutSeconds: timeoutSeconds,
    extra: { feePayer: String(feePayer) },
  };
}

const decodeHeader = (raw) => {
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); }
  catch { try { return JSON.parse(raw); } catch { return null; } }
};

/**
 * Gate a handler behind a payment.
 *
 * Returns `{ paid: false, status: 402, body }` to answer with, or
 * `{ paid: true, settlement }` once the payment is on-chain.
 */
export async function charge({ header, terms, feePayerId, feePayerKey, network }) {
  if (!header) {
    return {
      paid: false, status: 402,
      body: { x402Version: X402_VERSION, error: 'payment_required', accepts: [terms] },
    };
  }

  const payload = decodeHeader(header);
  if (!payload) {
    return { paid: false, status: 400, body: { error: 'malformed_payment_header' } };
  }

  const check = verify(payload, terms);
  if (!check.isValid) {
    return {
      paid: false, status: 402,
      body: { x402Version: X402_VERSION, error: check.invalidReason, detail: check.detail, accepts: [terms] },
    };
  }

  // Settle before serving. Verifying only proves the transaction would pay;
  // until it reaches consensus, nothing has actually been paid.
  const settlement = await settle(payload, terms, { feePayerId, feePayerKey, network });
  if (!settlement.success) {
    return {
      paid: false, status: 402,
      body: { x402Version: X402_VERSION, error: settlement.errorReason, detail: settlement.detail, accepts: [terms] },
    };
  }

  return { paid: true, settlement };
}
