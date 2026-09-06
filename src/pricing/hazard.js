// Poisson hazard model over the USGS ComCat catalogue.
//
// Three layers, in order:
//
//   1. RATE DENSITY. Counting events inside the trigger circle alone is
//      unstable — Armenia, Quindío has exactly one M6+ shallow event since 1970,
//      and a rate from n=1 is meaningless. So the rate is estimated over a wide
//      reference region, where n is large enough to mean something, and scaled
//      down to the trigger circle by area. This already borrows strength from
//      the surrounding seismicity.
//
//   2. UNCERTAINTY LOADING. What is still unknown after that gets charged for.
//      The relative standard error of a Poisson count is 1/sqrt(n), so a place
//      with 4 recorded events is priced 50% above its raw rate and one with 103
//      only 10% above. The loading extinguishes itself as the catalogue grows —
//      the price falls because the model learned, not because anyone lowered it.
//
//   3. VIABILITY FLOOR. Where the risk-priced premium falls below what it costs
//      to issue a policy, there is no product. We refuse rather than round up:
//      charging a real price for a risk that will never materialise is the thing
//      that gives parametric cover a bad name.
//
// Every input is returned with the quote so anyone can recompute it from the
// HCS record alone.
const USGS = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

export const MODEL = {
  referenceRadiusKm: 300,
  triggerRadiusKm: 100,
  minMagnitude: 6,
  maxDepthKm: 70,
  since: '1970-01-01',
  days: 30,
  lossRatio: 0.5,
  /** standard errors of uncertainty loading; published so the charge is auditable */
  z: 1,
};

/** Scheduled Transactions lapse at 62 days, so cover can never outlive its payout. */
export const MAX_DAYS = 62;

export async function catalogueCount({ lat, lon, radiusKm, minMagnitude = MODEL.minMagnitude, maxDepthKm = MODEL.maxDepthKm, since = MODEL.since }) {
  const url = `${USGS}?format=geojson&minmagnitude=${minMagnitude}&latitude=${lat}` +
    `&longitude=${lon}&maxradiuskm=${radiusKm}&maxdepth=${maxDepthKm}&starttime=${since}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const data = await res.json();
  return { count: data.features.length, url, events: data.features.map((f) => f.properties) };
}

/**
 * Annual rate for the trigger circle, with the uncertainty loading applied.
 * `lambda` is what the record says; `lambdaPriced` is what we underwrite at.
 */
export async function annualRate({
  lat, lon,
  triggerRadiusKm = MODEL.triggerRadiusKm,
  referenceRadiusKm = MODEL.referenceRadiusKm,
  since = MODEL.since, z = MODEL.z, now = new Date(),
}) {
  const { count, url } = await catalogueCount({ lat, lon, radiusKm: referenceRadiusKm, since });
  const years = (now - new Date(since)) / (365.25 * 24 * 3600 * 1000);
  const density = count / years / (Math.PI * referenceRadiusKm ** 2);
  const lambda = density * (Math.PI * triggerRadiusKm ** 2);

  // Relative standard error of a Poisson count. With no events at all the rate
  // is not merely uncertain, it is unmeasured — the viability floor handles that.
  const relativeError = count > 0 ? 1 / Math.sqrt(count) : Infinity;
  const lambdaPriced = count > 0 ? lambda * (1 + z * relativeError) : 0;

  return {
    lambda, lambdaPriced, count, years, relativeError, z,
    density, triggerRadiusKm, referenceRadiusKm, since, source: url,
  };
}

/** P(at least one qualifying event within `days`). */
export const probability = (lambda, days) => 1 - Math.exp(-lambda * (days / 365.25));

/** Premium for a fixed amount of cover. */
export function quote({ lambda, payout, days = MODEL.days, lossRatio = MODEL.lossRatio }) {
  const p = probability(lambda, days);
  const expectedLoss = payout * p;
  return { probability: p, expectedLoss, premium: expectedLoss / lossRatio, lossRatio, days, payout };
}

/**
 * Cover a given budget buys — the inverse, and the one people actually ask for.
 * Nobody arrives wanting exactly $800 of cover; they arrive with $4 a month.
 * Quoting this way also solves the ceiling: in a high-hazard place the cover
 * shrinks instead of the premium becoming unsellable.
 */
export function coverForBudget({ lambda, budget, days = MODEL.days, lossRatio = MODEL.lossRatio }) {
  const p = probability(lambda, days);
  if (p <= 0) return { probability: 0, cover: Infinity, budget, days, lossRatio };
  return { probability: p, cover: (budget * lossRatio) / p, budget, days, lossRatio };
}
