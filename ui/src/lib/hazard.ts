// The underwriting agent's hazard model (src/pricing/hazard.js), run in the
// browser over the frozen global catalogue. Same inputs, same arithmetic:
// count shallow M6+ events within a 300 km reference region since 1970, turn
// that into a rate density, scale it to the 100 km trigger circle.
import catalogue from '../data/quakes.json';

export interface Quake { lon: number; lat: number; mag: number; depthKm: number; day: number }
export const QUAKES: Quake[] = (catalogue.rows as number[][]).map(([lon, lat, mag, depthKm, day]) => ({ lon, lat, mag, depthKm, day }));
export const CATALOGUE = { source: catalogue.source, since: catalogue.since, fetchedAt: catalogue.fetchedAt, count: catalogue.count };

export const MODEL = { referenceRadiusKm: 300, triggerRadiusKm: 100, days: 30, lossRatio: 0.5, payoutHbar: 4, since: '1970-01-01' };

const R = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface Priced {
  count: number; years: number; density: number; lambda: number; probability: number; premiumHbar: number; expectedLossHbar: number;
  nearby: (Quake & { km: number })[];
}

/** Price cover at a point, exactly as the agent does. `now` defaults to the catalogue's fetch time. */
export function price(lat: number, lon: number, now = new Date(CATALOGUE.fetchedAt), payoutHbar = MODEL.payoutHbar): Priced {
  const nearby: (Quake & { km: number })[] = [];
  for (const q of QUAKES) {
    // cheap latitude reject before the trig
    if (Math.abs(q.lat - lat) > 2.8) continue;
    const km = haversineKm(lat, lon, q.lat, q.lon);
    if (km <= MODEL.referenceRadiusKm) nearby.push({ ...q, km });
  }
  const years = (now.getTime() - new Date(MODEL.since).getTime()) / (365.25 * 86400000);
  const refArea = Math.PI * MODEL.referenceRadiusKm ** 2;
  const trigArea = Math.PI * MODEL.triggerRadiusKm ** 2;
  const density = nearby.length / years / refArea;
  const lambda = density * trigArea;
  const probability = 1 - Math.exp(-lambda * (MODEL.days / 365.25));
  const expectedLossHbar = payoutHbar * probability;
  return { count: nearby.length, years, density, lambda, probability, expectedLossHbar, premiumHbar: expectedLossHbar / MODEL.lossRatio, nearby };
}

/** What the same policy would have cost at the start of each year: the model re-run with only the record available then. */
export function priceHistory(nearby: (Quake & { km: number })[], fromYear = 1985, toYear = new Date().getUTCFullYear()): { year: number; count: number; premiumHbar: number }[] {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    const at = Date.UTC(y, 0, 1) / 86400000;
    const count = nearby.filter((q) => q.day < at).length;
    const years = (at * 86400000 - new Date(MODEL.since).getTime()) / (365.25 * 86400000);
    const lambda = (count / years / (Math.PI * MODEL.referenceRadiusKm ** 2)) * Math.PI * MODEL.triggerRadiusKm ** 2;
    const p = 1 - Math.exp(-lambda * (MODEL.days / 365.25));
    out.push({ year: y, count, premiumHbar: (MODEL.payoutHbar * p) / MODEL.lossRatio });
  }
  return out;
}

/** The USGS query the agent would publish for this point, so anyone can recount. */
export const sourceUrl = (lat: number, lon: number) =>
  `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=6&latitude=${lat}&longitude=${lon}&maxradiuskm=${MODEL.referenceRadiusKm}&maxdepth=70&starttime=${MODEL.since}`;

export const PLACES = [
  { name: 'Armenia, Quindío', lat: 4.53, lon: -75.68 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Istanbul', lat: 41.01, lon: 28.98 },
  { name: 'Santiago', lat: -33.45, lon: -70.67 },
  { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'Kathmandu', lat: 27.72, lon: 85.32 },
  { name: 'Lisbon', lat: 38.72, lon: -9.14 },
  { name: 'Jakarta', lat: -6.21, lon: 106.85 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { name: 'Berlin', lat: 52.52, lon: 13.4 },
];
