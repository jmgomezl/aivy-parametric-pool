// Freezes the world's national capitals for the atlas overlay, from Natural
// Earth's populated-places layer (public domain). Compact rows:
// [name, country, lon, lat, population, scalerank] — scalerank is Natural
// Earth's own label priority (0 = always show), used to declutter by zoom.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(here, '../src/data/capitals.json');
const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_populated_places_simple.geojson';

const res = await fetch(url);
if (!res.ok) throw new Error(`Natural Earth ${res.status}`);
const j = await res.json();
const rows = j.features
  .filter((f) => f.properties.featurecla === 'Admin-0 capital')
  .map((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    return [p.name, p.adm0name, Number(lon.toFixed(3)), Number(lat.toFixed(3)), p.pop_max ?? 0, p.scalerank ?? 9];
  })
  .sort((a, b) => a[5] - b[5] || b[4] - a[4]);
fs.writeFileSync(outPath, JSON.stringify({ source: url, licence: 'Natural Earth, public domain', fetchedAt: new Date().toISOString(), count: rows.length, rows }));
console.log(`wrote ${path.relative(process.cwd(), outPath)} · ${rows.length} capitals`);
