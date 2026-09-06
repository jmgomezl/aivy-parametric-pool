// The underwriting decision: a quote, or a refusal with a reason.
//
// The pricing model will happily quote seven cents of premium for cover in a
// place that has never had an earthquake. That is not a cheap product — it is a
// product that will never pay, and selling it is how parametric cover earns its
// bad reputation. So there is a floor, and below it the agent declines.
//
// The floor is derived, not invented. Issuing a policy costs something real:
// three x402 oracle queries, the agent's own inference, and the network fees for
// an NFT mint, an HCS message and a scheduled transaction. Only the part of the
// premium that is not reserved for claims can pay for that, so:
//
//     premium >= issueCost / (1 - lossRatio)
//
// At a 50% loss ratio and roughly ten cents to issue, that puts the floor near
// twenty cents. Below it we say so plainly rather than rounding the price up.
import { MAX_DAYS, MODEL, coverForBudget, probability, quote } from './hazard.js';

/** What it costs to put one policy on the ledger, in the same unit as the premium. */
export const ISSUE_COST = 0.10;

export const minimumPremium = (lossRatio = MODEL.lossRatio, issueCost = ISSUE_COST) =>
  issueCost / (1 - lossRatio);

const refuse = (reason, message, detail = {}) => ({ ok: false, reason, message, ...detail });

/**
 * Price cover at a point, or decline.
 *
 * Give either `payout` (fixed cover, floating premium) or `budget` (fixed
 * premium, floating cover). Budget is the one people actually ask for, and it
 * keeps the premium sellable in high-hazard places by shrinking the cover
 * instead of the price becoming absurd.
 */
export function underwrite({
  hazard, payout, budget,
  days = MODEL.days, lossRatio = MODEL.lossRatio, issueCost = ISSUE_COST,
}) {
  if (payout == null && budget == null) throw new Error('Give either payout or budget.');
  if (payout != null && budget != null) throw new Error('Give payout or budget, not both.');

  if (days > MAX_DAYS) {
    return refuse('window_too_long',
      `Cover cannot run for ${days} days: a scheduled payout lapses after ${MAX_DAYS}.`,
      { days, maxDays: MAX_DAYS });
  }

  const lambda = hazard.lambdaPriced;
  const floor = minimumPremium(lossRatio, issueCost);

  if (hazard.count === 0) {
    return refuse('no_record',
      'The historical catalogue has no qualifying events near this location. There is not enough evidence to quote cover.',
      { count: 0, source: hazard.source, floor });
  }

  const priced = payout != null
    ? quote({ lambda, payout, days, lossRatio })
    : (() => {
        const c = coverForBudget({ lambda, budget, days, lossRatio });
        return { ...quote({ lambda, payout: c.cover, days, lossRatio }), premium: budget, payout: c.cover };
      })();

  if (priced.premium < floor) {
    return refuse('below_viability',
      `The risk here is too small to insure: 30-day cover prices at ${priced.premium.toFixed(4)}, ` +
      `below the ${floor.toFixed(2)} it costs to write and settle a policy.`,
      { premium: priced.premium, floor, probability: priced.probability, count: hazard.count });
  }

  return {
    ok: true,
    premium: priced.premium,
    payout: priced.payout,
    probability: priced.probability,
    expectedLoss: priced.expectedLoss,
    days, lossRatio, floor,
    // everything needed to recompute this quote from the HCS record alone
    hazard: {
      lambda: hazard.lambda, lambdaPriced: hazard.lambdaPriced, count: hazard.count,
      years: hazard.years, relativeError: hazard.relativeError, z: hazard.z,
      triggerRadiusKm: hazard.triggerRadiusKm, referenceRadiusKm: hazard.referenceRadiusKm,
      since: hazard.since, source: hazard.source,
    },
  };
}
