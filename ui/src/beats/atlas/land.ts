import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import land110 from 'world-atlas/land-110m.json';
import { LAT_MAX, LAT_MIN, project, type View } from './projection';

const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
const fc = feature(topo, topo.objects.land) as unknown as FeatureCollection<Polygon | MultiPolygon>;
const RINGS: number[][][] = [];
for (const f of fc.features) {
  const g = f.geometry;
  if (g.type === 'Polygon') RINGS.push(...g.coordinates);
  else for (const poly of g.coordinates) RINGS.push(...poly);
}
// Rings entirely outside the drawn latitudes (Antarctica) are dropped once.
const VISIBLE = RINGS.filter((ring) => ring.some(([, lat]) => lat > LAT_MIN && lat < LAT_MAX));

/** Land outlines for a view. Rings crossing the antimeridian are split there. */
export function landPath(v: View): string {
  const parts: string[] = [];
  for (const ring of VISIBLE) {
    let d = '';
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      const p = project(lon, lat, v);
      const jump = i > 0 && Math.abs(lon - ring[i - 1][0]) > 180;
      d += `${i === 0 || jump ? (d ? 'Z' : '') + 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }
    parts.push(d + 'Z');
  }
  return parts.join('');
}
