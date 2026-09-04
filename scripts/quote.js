// Prices a real 30-day policy from the live USGS catalogue.
import { annualRate, quote } from '../src/pricing/hazard.js';

const LOCATIONS = [
  { name: 'Armenia, Quindio, Colombia', lat: 4.53, lon: -75.68 },
  { name: 'Pasto, Narino, Colombia', lat: 1.21, lon: -77.28 },
  { name: 'Bucaramanga, Santander, Colombia', lat: 7.12, lon: -73.13 },
  { name: 'Tokyo, Japan', lat: 35.68, lon: 139.69 },
];
const PAYOUT = 800;

for (const loc of LOCATIONS) {
  const r = await annualRate({ lat: loc.lat, lon: loc.lon });
  const q = quote({ lambda: r.lambda, payout: PAYOUT });
  console.log(
    `${loc.name.padEnd(36)} n=${String(r.count).padStart(3)} over ${r.years.toFixed(1)}y  ` +
    `lambda=${r.lambda.toFixed(4)}/yr  P30d=${(q.probability * 100).toFixed(3)}%  ` +
    `premium=$${q.premium.toFixed(2)} for $${PAYOUT} cover`
  );
}
