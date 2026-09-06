// Issuing a policy, end to end. One path, shared by the CLI and the agent API,
// so what a judge triggers from the browser is the same code the demo ran.
//
//   underwrite -> solvency guard -> premium (atomic, 3 parties) -> terms to HCS
//   -> policy NFT, frozen -> payout scheduled and pre-signed -> booked
//
// Everything before the guard is free. Nothing touches the ledger until the
// policy is actually accepted.
import { randomUUID } from 'node:crypto';
import { withIssuanceLock } from '../issuance-lock.js';
import { termsMemo } from './binding.js';
import { AccountId, TokenId } from '@hiero-ledger/sdk';
import { annualRate } from '../pricing/hazard.js';
import { underwrite } from '../pricing/underwrite.js';
import { hbarUsd } from '../pricing/fx.js';
import { settlementAsset, toUnits, fromUnits } from '../asset.js';
import { canUnderwrite } from '../pool/solvency.js';
import { committedTinybar, record, reserve, request, updateReservation } from '../book.js';
import { publishTerms, triggerSpec } from './terms.js';
import { mintPolicy, deliverAndFreeze } from './collection.js';
import { purchasePolicy } from './purchase.js';
import { schedulePayout } from './payout.js';



/** Price a policy without touching the ledger. Safe to call from anywhere. */
export async function quotePolicy({ lat, lon, budgetUsd = 4, days = 30, network = 'testnet' }) {
  if (!Number.isFinite(lat) || Math.abs(lat)>90 || !Number.isFinite(lon) || Math.abs(lon)>180 || !Number.isFinite(budgetUsd) || budgetUsd<1 || budgetUsd>50 || !Number.isInteger(days) || days<7 || days>62) return {ok:false,reason:'invalid_input',message:'Choose a valid location, a budget from $1 to $50, and 7 to 62 days.'};
  const hazard = await annualRate({ lat, lon });
  const decision = underwrite({ hazard, budget: budgetUsd, days });
  if (!decision.ok) return decision;

  // A dollar-denominated asset needs no rate and no scale: $4 of premium is
  // 4 tokens. Only an HBAR-settled policy has to be converted, and only then
  // does the cover float with the price of the asset backing it.
  const asset = settlementAsset(network);
  const fx = asset.kind === 'hbar' ? await hbarUsd() : null;
  const premiumUnits = toUnits(decision.premium, asset, fx?.price);
  const payoutUnits = toUnits(decision.payout, asset, fx?.price);

  return {
    ...decision,
    asset: { kind: asset.kind, symbol: asset.symbol, tokenId: asset.tokenId, decimals: asset.decimals, isUsdc: Boolean(asset.isUsdc) },
    fx: fx ? { hbarUsd: fx.price, source: fx.source, at: fx.at } : null,
    settled: {
      premiumUnits, payoutUnits,
      premium: fromUnits(premiumUnits, asset), payout: fromUnits(payoutUnits, asset),
      symbol: asset.symbol,
    },
  };
}

const activeRequests=new Set();
export const isIssuing=(network,id)=>activeRequests.has(`${network}:${id}`);

/**
 * Underwrite and issue. `deps` carries the ledger handles the caller already has
 * (client, agent, pool, token ids) so this function owns the flow, not the setup.
 */
export async function issuePolicy(deps, input) {
  const requestId=input.requestId??randomUUID();
  return withIssuanceLock(deps.network, async () => {
    activeRequests.add(`${deps.network}:${requestId}`);
    try { return await issueLocked(deps, {...input,requestId}); }
    catch(error) { updateReservation(deps.network,requestId,{status:'needs_review',message:'Ledger confirmation was interrupted. This request is reserved and must be reconciled before retrying.'}); throw error; }
    finally {activeRequests.delete(`${deps.network}:${requestId}`);}
  });
}

async function issueLocked(deps, { lat, lon, place, budgetUsd = 4, days = 30, brokerId = null, buyer, requestId = randomUUID() }) {
  const { client, agent, network, poolId, policyTokenId, termsTopicId } = deps;
  const { price=quotePolicy, check=canUnderwrite, publish=publishTerms, mint=mintPolicy, purchase=purchasePolicy, deliver=deliverAndFreeze, schedule=schedulePayout } = deps.operations ?? {};

  const previous = request(network, requestId);
  if (previous) return previous.scheduleId && previous.quote
    ? {ok:true,policy:previous,quote:previous.quote,reused:true}
    : {ok:false,reason:'pending_recovery',message:'This request is already reserved. Check Policies; an interrupted issuance must be reconciled before it can be repeated.'};
  const quote = await price({ lat, lon, budgetUsd, days, network });
  if (!quote.ok) return quote;

  // The guard is an invariant, not an exception: a promise the pool cannot keep
  // must never be made, because pre-signed payouts have no queue between them.
  const denied = deps.beforeWrite?.(quote);
  if (denied) return {ok:false,...denied};
  await deps.reconcile?.();
  const committed = committedTinybar(network);
  const guard = await check(client, poolId, committed, quote.settled.payoutUnits, network);
  if (!guard.ok) return { ok: false, reason: 'exceeds_capital', message: guard.reason, guard };

  const lapsesAt = new Date(Date.now() + days * 86400_000).toISOString();
  reserve(network, {requestId, payoutUnits:quote.settled.payoutUnits, lapsesAt,place:place??null,lat,lon,status:'creating'});
  buyer = buyer ?? await deps.createBuyer(quote);
  const terms = {
    version: 1, network, poolId: poolId.toString(), beneficiaryId: buyer.id.toString(),
    trigger: triggerSpec({ lat, lon, radiusKm: quote.hazard.triggerRadiusKm, minMagnitude: 6, maxDepthKm: 70, days }),
    place: place ?? null,
    modelled: { premiumUsd: quote.premium, payoutUsd: quote.payout, currency: 'USD' },
    settled: quote.settled,
    asset: quote.asset,
    fx: quote.fx,
    hazard: quote.hazard,
    lossRatio: quote.lossRatio,
    viabilityFloor: quote.floor,
    lapsesAt,
    issuedAt: new Date().toISOString(),
  };
  updateReservation(network,requestId,{buyerId:buyer.id.toString(),stage:'terms'});
  const published = await publish(client, termsTopicId, terms);

  updateReservation(network,requestId,{termsPointer:published.pointer,stage:'policy'});
  const token = TokenId.fromString(policyTokenId.toString());
  const minted = await mint(client, token, published.pointer);

  updateReservation(network,requestId,{serial:minted.serial,stage:'premium'});
  const sale = await purchase(client, {
    buyerId: buyer.id, buyerKey: buyer.key, poolId, brokerId,
    premiumUnits: quote.settled.premiumUnits, network,
  });

  updateReservation(network,requestId,{saleTxId:sale.txId,stage:'delivery'});
  await deliver(client, token, minted.serial, agent.id, buyer.id);

  updateReservation(network,requestId,{stage:'schedule'});
  const payout = await schedule(client, {
    poolId, beneficiaryId: AccountId.fromString(buyer.id.toString()),
    payoutUnits: quote.settled.payoutUnits, network, days,
    memo: termsMemo(terms), expiresAt: lapsesAt,
  });

  updateReservation(network,requestId,{scheduleId:payout.scheduleId,stage:'record'});
  const policy = {
    requestId, quote, serial: minted.serial, lat, lon, place: place ?? null,
    trigger: {...terms.trigger, windowStart:terms.issuedAt,windowEnd:lapsesAt},
    monitoring: {mode:'manual',message:'Oracle services must be asked to verify an event. This demo does not run background event checks.'},
    premiumUsd: quote.premium, payoutUsd: quote.payout,
    premiumUnits: quote.settled.premiumUnits, payoutUnits: quote.settled.payoutUnits,
    premiumHbar: quote.settled.premium, payoutHbar: quote.settled.payout,
    asset: quote.asset.symbol,
    buyerId: buyer.id.toString(), brokerId: brokerId ? brokerId.toString() : null,
    termsPointer: published.pointer, saleTxId: sale.txId,
    scheduleId: payout.scheduleId, lapsesAt, settled: false,
  };
  record(network, policy);
  deps.afterWrite?.(quote);

  return { ok: true, policy, quote, guard, terms };
}
