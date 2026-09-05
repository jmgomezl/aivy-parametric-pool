// Issuing a policy, end to end. One path, shared by the CLI and the agent API,
// so what a judge triggers from the browser is the same code the demo ran.
//
//   underwrite -> solvency guard -> premium (atomic, 3 parties) -> terms to HCS
//   -> policy NFT, frozen -> payout scheduled and pre-signed -> booked
//
// Everything before the guard is free. Nothing touches the ledger until the
// policy is actually accepted.
import { AccountId, TokenId } from '@hiero-ledger/sdk';
import { annualRate } from '../pricing/hazard.js';
import { underwrite } from '../pricing/underwrite.js';
import { hbarUsd, usdToHbar, demoScale } from '../pricing/fx.js';
import { canUnderwrite } from '../pool/solvency.js';
import { committedTinybar, record } from '../book.js';
import { publishTerms, triggerSpec } from './terms.js';
import { mintPolicy, deliverAndFreeze } from './collection.js';
import { purchasePolicy } from './purchase.js';
import { schedulePayout } from './payout.js';

const toTinybar = (hbar) => Math.round(hbar * 1e8) / 1e8;

/** Price a policy without touching the ledger. Safe to call from anywhere. */
export async function quotePolicy({ lat, lon, budgetUsd = 4, days = 30 }) {
  const hazard = await annualRate({ lat, lon });
  const decision = underwrite({ hazard, budget: budgetUsd, days });
  if (!decision.ok) return decision;

  const fx = await hbarUsd();
  const scale = demoScale();
  return {
    ...decision,
    fx: { hbarUsd: fx.price, source: fx.source, at: fx.at, demoScale: scale },
    settled: {
      premiumHbar: toTinybar(usdToHbar(decision.premium, fx.price) * scale),
      payoutHbar: toTinybar(usdToHbar(decision.payout, fx.price) * scale),
    },
  };
}

/**
 * Underwrite and issue. `deps` carries the ledger handles the caller already has
 * (client, agent, pool, token ids) so this function owns the flow, not the setup.
 */
export async function issuePolicy(deps, { lat, lon, place, budgetUsd = 4, days = 30, brokerId = null, buyer }) {
  const { client, agent, network, poolId, policyTokenId, termsTopicId } = deps;

  const quote = await quotePolicy({ lat, lon, budgetUsd, days });
  if (!quote.ok) return quote;

  // The guard is an invariant, not an exception: a promise the pool cannot keep
  // must never be made, because pre-signed payouts have no queue between them.
  const committed = committedTinybar(network);
  const guard = await canUnderwrite(client, poolId, committed, Math.round(quote.settled.payoutHbar * 1e8));
  if (!guard.ok) return { ok: false, reason: 'exceeds_capital', message: guard.reason, guard };

  const lapsesAt = new Date(Date.now() + days * 86400_000).toISOString();
  const terms = {
    trigger: triggerSpec({ lat, lon, radiusKm: quote.hazard.triggerRadiusKm, minMagnitude: 6, maxDepthKm: 70, days }),
    place: place ?? null,
    modelled: { premiumUsd: quote.premium, payoutUsd: quote.payout, currency: 'USD' },
    settled: quote.settled,
    fx: quote.fx,
    hazard: quote.hazard,
    lossRatio: quote.lossRatio,
    viabilityFloor: quote.floor,
    lapsesAt,
    issuedAt: new Date().toISOString(),
  };
  const published = await publishTerms(client, termsTopicId, terms);

  const token = TokenId.fromString(policyTokenId.toString());
  const minted = await mintPolicy(client, token, published.pointer);

  const sale = await purchasePolicy(client, {
    buyerId: buyer.id, buyerKey: buyer.key, poolId, brokerId,
    premiumHbar: quote.settled.premiumHbar,
  });

  await deliverAndFreeze(client, token, minted.serial, agent.id, buyer.id);

  const payout = await schedulePayout(client, {
    poolId, beneficiaryId: AccountId.fromString(buyer.id.toString()),
    payoutHbar: quote.settled.payoutHbar, days,
    memo: `quake payout M6+ ${place ?? `${lat},${lon}`}`.slice(0, 100),
  });

  const policy = {
    serial: minted.serial, lat, lon, place: place ?? null,
    premiumUsd: quote.premium, payoutUsd: quote.payout,
    premiumHbar: quote.settled.premiumHbar, payoutHbar: quote.settled.payoutHbar,
    buyerId: buyer.id.toString(), brokerId: brokerId ? brokerId.toString() : null,
    termsPointer: published.pointer, saleTxId: sale.txId,
    scheduleId: payout.scheduleId, lapsesAt, settled: false,
  };
  record(network, policy);

  return { ok: true, policy, quote, guard, terms };
}
