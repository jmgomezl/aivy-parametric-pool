import { useId, useMemo } from 'react';
import { feature } from 'topojson-client';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import countries from 'world-atlas/countries-110m.json';
import capitals from '../data/capitals.json';

const topology = countries as unknown as Topology<{ countries: GeometryCollection }>;
const geography = feature(topology, topology.objects.countries) as unknown as FeatureCollection<Polygon | MultiPolygon>;
const polygons = geography.features.flatMap(f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map(rings=>({rings,name:String(f.properties?.name??'')})));
const rad = Math.PI / 180;

/** Local azimuthal equidistant projection: distance from the policy pin is preserved. */
export function CoverageMap({ lat, lon, radiusKm, name, lp }: { lat: number; lon: number; radiusKm: number; name: string; lp: boolean }) {
  const id = useId().replace(/:/g, '');
  const scale = 360 / Math.max(1400, radiusKm * 8);
  const geometry = useMemo(() => {
    const phi0 = lat * rad;
    const project = (lng: number, latitude: number) => {
      const phi = latitude * rad, delta = (lng - lon) * rad;
      const cos = Math.max(-1, Math.min(1, Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(delta)));
      const c = Math.acos(cos), k = c < 1e-8 ? 1 : c / Math.max(1e-8, Math.sin(c));
      return { distance: c * 6371.0088, x: 180 + 6371.0088 * k * Math.cos(phi) * Math.sin(delta) * scale, y: 116 - 6371.0088 * k * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(delta)) * scale };
    };
    let country = '';
    const paths = polygons.flatMap(polygon => {
      const rings = polygon.rings.map(ring => ring.map(([lng, latitude]) => project(lng, latitude)));
      const outer = rings[0];
      // Exclude the opposite side of the globe before clipping local outlines.
      if (outer.every(p=>p.distance>Math.max(5000, 720/scale))) return [];
      const contains = (ring: typeof outer) => {
        let inside = false;
        for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
          const a=ring[i],b=ring[j];
          if ((a.y>116)!==(b.y>116) && 180<(b.x-a.x)*(116-a.y)/(b.y-a.y)+a.x) inside=!inside;
        }
        return inside;
      };
      if (contains(outer) && !rings.slice(1).some(contains)) country=polygon.name;
      if (Math.max(...outer.map(p=>p.x)) < 0 || Math.min(...outer.map(p=>p.x)) > 360 || Math.max(...outer.map(p=>p.y)) < 0 || Math.min(...outer.map(p=>p.y)) > 244) return [];
      return [rings.map(ring=>ring.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')+'Z').join('')];
    });
    const cities = capitals.rows.map(([city,,lng,latitude])=>({name:String(city),...project(Number(lng),Number(latitude))})).filter(p=>p.x>36&&p.x<290&&p.y>42&&p.y<188&&Math.hypot(p.x-180,p.y-116)>radiusKm*scale+22).sort((a,b)=>Math.hypot(a.x-180,a.y-116)-Math.hypot(b.x-180,b.y-116)).slice(0,2);
    return { paths, cities, country };
  }, [lat, lon, radiusKm, scale]);
  const accent = lp ? '#d7df89' : '#65dfad';
  const radius = radiusKm * scale;
  return <svg className="nft-art nft-map" viewBox="0 0 360 244" role="img" aria-label={`${name}: protected area within ${radiusKm} kilometers of ${lat.toFixed(2)}, ${lon.toFixed(2)}. Geographic overview.`}>
    <defs>
      <clipPath id={`${id}-clip`}><rect x="8" y="10" width="344" height="224" rx="5"/></clipPath>
      <pattern id={`${id}-grid`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" stroke="#c4efdd" strokeOpacity=".07" fill="none"/></pattern>
    </defs>
    <g clipPath={`url(#${id}-clip)`}>
      <rect width="360" height="244" fill="#061710" fillOpacity=".35"/>
      <rect width="360" height="244" fill={`url(#${id}-grid)`}/>
      {geometry.paths.map((d,i)=><path key={i} d={d} fill={lp?'#394431':'#244b3b'} fillOpacity=".8" stroke="#a2c8b4" strokeOpacity=".42" strokeWidth=".8" fillRule="evenodd"/>)}
      {geometry.cities.map(city=><g key={city.name} fill="#aac7b6"><circle cx={city.x} cy={city.y} r="1.8"/><text x={city.x+5} y={city.y+3} fontSize="9">{city.name}</text></g>)}
      <circle cx="180" cy="116" r={radius} fill={accent} fillOpacity=".16" stroke={accent} strokeWidth="1.5"/>
      <path d={`M180 116h${radius}`} stroke={accent} strokeWidth="1" strokeDasharray="2 3"/>
      <circle cx="180" cy="116" r="4" fill="#e6ffef" stroke="#183e2c" strokeWidth="1.5"/>
      <rect x="137" y={116+radius+8} width="86" height="20" rx="10" fill="#0b2017" fillOpacity=".94"/>
      <text x="180" y={116+radius+21} textAnchor="middle" fontSize="10" fill={accent}>{radiusKm} km cover</text>
      <path d={`M24 202v5h${100*scale}v-5`} stroke="#b1cdbf" fill="none" strokeWidth="1"/>
      <text x="24" y="220" fill="#b1cdbf" fontSize="9">100 km</text>
      <text x="24" y="30" fill="#c5dfd0" fontSize="10">{geometry.country}</text>
      <text x="330" y="30" fill="#b1cdbf" fontSize="9" textAnchor="middle">N</text><path d="M330 35v12m-3-9 3-3 3 3" stroke="#b1cdbf" fill="none"/>
      <text x="336" y="220" textAnchor="end" fill="#b1cdbf" fontSize="9" className="num">{Math.abs(lat).toFixed(2)}°{lat>=0?'N':'S'} · {Math.abs(lon).toFixed(2)}°{lon>=0?'E':'W'}</text>
    </g>
  </svg>;
}
