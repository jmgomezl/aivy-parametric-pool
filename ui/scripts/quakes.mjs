// Freezes the global catalogue the atlas is drawn from: every shallow M6+ event
// since 1970, from the same USGS ComCat endpoint the underwriting agent queries.
// Output is compact rows [lon, lat, mag, depthKm, epochDays] so the page can
// price any point on Earth instantly with the agent's own model.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(here, '../src/data/quakes.json');
const SINCE = '1970-01-01';
const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=6&maxdepth=70&starttime=${SINCE}&orderby=time-asc&limit=20000`;

const res = await fetch(url);
if (!res.ok) throw new Error(`USGS ${res.status}`);
const j = await res.json();
const rows = j.features.map((f) => {
  const [lon, lat, depth] = f.geometry.coordinates;
  return [
    Number(lon.toFixed(3)), Number(lat.toFixed(3)), Number(f.properties.mag.toFixed(1)),
    Number((depth ?? 0).toFixed(1)), Math.floor(f.properties.time / 86400000),
  ];
});
const out = { source: url, since: SINCE, minMagnitude: 6, maxDepthKm: 70, fetchedAt: new Date().toISOString(), count: rows.length, rows };
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(`wrote ${path.relative(process.cwd(), outPath)} · ${rows.length} events · ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`);
