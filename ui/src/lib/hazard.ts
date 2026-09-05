// The underwriting agent's hazard model (src/pricing/hazard.js), run in the
// browser over the frozen global catalogue. Same inputs, same arithmetic:
// count shallow M6+ events within a 300 km reference region since 1970, turn
// that into a rate density, scale it to the 100 km trigger circle.
//
// The atlas lets the viewer vary what the agent holds fixed — the cover, the
// window, the trigger magnitude, and the date the record is read at — so every
// knob here is an explicit option with the agent's value as the default.
import catalogue from '../data/quakes.json';

export interface Quake { lon: number; lat: number; mag: number; depthKm: number; day: number }
export const QUAKES: Quake[] = (catalogue.rows as number[][]).map(([lon, lat, mag, depthKm, day]) => ({ lon, lat, mag, depthKm, day }));
export const CATALOGUE = { source: catalogue.source, since: catalogue.since, fetchedAt: catalogue.fetchedAt, count: catalogue.count };

export const MODEL = { referenceRadiusKm: 300, triggerRadiusKm: 100, days: 30, lossRatio: 0.5, payoutHbar: 4, minMagnitude: 6, since: '1970-01-01' };
export const MAX_DAYS = 62; // Scheduled Transactions lapse at 62 days; cover cannot outlive its payout

export const SINCE_MS = new Date(MODEL.since).getTime();
export const dayOf = (d: Date) => Math.floor(d.getTime() / 86400000);
export const FIRST_YEAR = 1970;
export const LAST_YEAR = new Date(CATALOGUE.fetchedAt).getUTCFullYear();

const R = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface PriceOpts {
  /** the moment the record is read; defaults to when the catalogue was frozen */
  now?: Date;
  payoutHbar?: number;
  days?: number;
  minMag?: number;
}

export interface Priced {
  count: number; years: number; density: number; lambda: number; probability: number; premiumHbar: number; expectedLossHbar: number;
  nearby: (Quake & { km: number })[];
  opts: Required<PriceOpts>;
}

export const defaults = (o: PriceOpts = {}): Required<PriceOpts> => ({
  now: o.now ?? new Date(CATALOGUE.fetchedAt),
  payoutHbar: o.payoutHbar ?? MODEL.payoutHbar,
  days: o.days ?? MODEL.days,
  minMag: o.minMag ?? MODEL.minMagnitude,
});

/** Events within the reference region of a point, oldest first. */
export function around(lat: number, lon: number, minMag = MODEL.minMagnitude): (Quake & { km: number })[] {
  const out: (Quake & { km: number })[] = [];
  for (const q of QUAKES) {
    if (q.mag < minMag) continue;
    if (Math.abs(q.lat - lat) > 2.8) continue; // cheap latitude reject before the trig
    const km = haversineKm(lat, lon, q.lat, q.lon);
    if (km <= MODEL.referenceRadiusKm) out.push({ ...q, km });
  }
  return out;
}

function rate(count: number, years: number) {
  const refArea = Math.PI * MODEL.referenceRadiusKm ** 2;
  const trigArea = Math.PI * MODEL.triggerRadiusKm ** 2;
  const density = count / years / refArea;
  return { density, lambda: density * trigArea };
}

/** Price cover at a point, exactly as the agent does, with the record as it stood at `now`. */
export function price(lat: number, lon: number, o: PriceOpts = {}): Priced {
  const opts = defaults(o);
  const cutoff = dayOf(opts.now);
  const nearby = around(lat, lon, opts.minMag).filter((q) => q.day <= cutoff);
  const years = Math.max(1 / 365.25, (opts.now.getTime() - SINCE_MS) / (365.25 * 86400000));
  const { density, lambda } = rate(nearby.length, years);
  const probability = 1 - Math.exp(-lambda * (opts.days / 365.25));
  const expectedLossHbar = opts.payoutHbar * probability;
  return { count: nearby.length, years, density, lambda, probability, expectedLossHbar, premiumHbar: expectedLossHbar / MODEL.lossRatio, nearby, opts };
}

/** What the same cover would have cost at the start of each year: the model re-run with only the record available then. */
export function priceHistory(nearby: (Quake & { km: number })[], o: PriceOpts = {}, fromYear = 1985, toYear = LAST_YEAR): { year: number; count: number; premiumHbar: number }[] {
  const opts = defaults(o);
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    const atMs = Date.UTC(y, 0, 1);
    const at = atMs / 86400000;
    const count = nearby.filter((q) => q.day < at && q.mag >= opts.minMag).length;
    const years = (atMs - SINCE_MS) / (365.25 * 86400000);
    const { lambda } = rate(count, years);
    const p = 1 - Math.exp(-lambda * (opts.days / 365.25));
    out.push({ year: y, count, premiumHbar: (opts.payoutHbar * p) / MODEL.lossRatio });
  }
  return out;
}

/** The closest recorded event to a point, anywhere on Earth. */
export function nearest(lat: number, lon: number, minMag = MODEL.minMagnitude, cutoffDay = Infinity): (Quake & { km: number }) | null {
  let best: (Quake & { km: number }) | null = null;
  for (const q of QUAKES) {
    if (q.mag < minMag || q.day > cutoffDay) continue;
    const km = haversineKm(lat, lon, q.lat, q.lon);
    if (!best || km < best.km) best = { ...q, km };
  }
  return best;
}

/** The USGS query the agent would publish for this point, so anyone can recount. */
export const sourceUrl = (lat: number, lon: number, minMag = MODEL.minMagnitude) =>
  `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${minMag}&latitude=${lat}&longitude=${lon}&maxradiuskm=${MODEL.referenceRadiusKm}&maxdepth=70&starttime=${MODEL.since}`;

export interface Place { name: string; lat: number; lon: number }
export const PLACES: Place[] = [
  { name: 'Armenia, Quindío', lat: 4.53, lon: -75.68 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Istanbul', lat: 41.01, lon: 28.98 },
  { name: 'Santiago', lat: -33.45, lon: -70.67 },
  { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'Kathmandu', lat: 27.72, lon: 85.32 },
  { name: 'Lisbon', lat: 38.72, lon: -9.14 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { name: 'Berlin', lat: 52.52, lon: 13.4 },
];

export const placeName = (p: { lat: number; lon: number; name?: string }) =>
  p.name ?? `${Math.abs(p.lat).toFixed(2)}° ${p.lat >= 0 ? 'N' : 'S'} · ${Math.abs(p.lon).toFixed(2)}° ${p.lon >= 0 ? 'E' : 'W'}`;
