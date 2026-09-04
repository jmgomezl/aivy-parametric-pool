// Poisson hazard model over the USGS ComCat catalogue.
//
// Verified against the live API on 2026-09-04. Counting events inside the trigger
// radius alone is unstable — Armenia, Quindio has exactly ONE M6+ shallow event
// since 1970 (the 1999 M6.1), and a rate estimated from n=1 is meaningless. So we
// estimate a RATE DENSITY over a wide region and scale it to the trigger circle.
// Every input is published so anyone can recompute the premium.
const USGS = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

export async function catalogueCount({ lat, lon, radiusKm, minMagnitude = 6, maxDepthKm = 70, since = '1970-01-01' }) {
  const url = `${USGS}?format=geojson&minmagnitude=${minMagnitude}&latitude=${lat}` +
    `&longitude=${lon}&maxradiuskm=${radiusKm}&maxdepth=${maxDepthKm}&starttime=${since}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const data = await res.json();
  return { count: data.features.length, url, events: data.features.map((f) => f.properties) };
}

/**
 * Annual rate for the trigger circle, estimated from a wider reference region.
 * Returns every input so the result is reproducible from the HCS record alone.
 */
export async function annualRate({ lat, lon, triggerRadiusKm = 100, referenceRadiusKm = 300, since = '1970-01-01', now = new Date() }) {
  const { count, url } = await catalogueCount({ lat, lon, radiusKm: referenceRadiusKm, since });
  const years = (now - new Date(since)) / (365.25 * 24 * 3600 * 1000);
  const refArea = Math.PI * referenceRadiusKm ** 2;
  const triggerArea = Math.PI * triggerRadiusKm ** 2;
  const density = count / years / refArea;          // events / year / km^2
  const lambda = density * triggerArea;             // events / year in the trigger circle
  return { lambda, count, years, referenceRadiusKm, triggerRadiusKm, density, since, source: url };
}

/** P(at least one qualifying event within `days`). */
export const probability = (lambda, days) => 1 - Math.exp(-lambda * (days / 365.25));

/** premium = expected loss / target loss ratio. */
export function quote({ lambda, payout, days = 30, lossRatio = 0.5 }) {
  const p = probability(lambda, days);
  const expectedLoss = payout * p;
  return { probability: p, expectedLoss, premium: expectedLoss / lossRatio, lossRatio, days, payout };
}
