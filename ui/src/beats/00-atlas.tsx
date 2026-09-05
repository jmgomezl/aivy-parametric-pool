import { useEffect, useMemo, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import land110 from 'world-atlas/land-110m.json';
import { Scene } from '../components/Scene';
import { Big, C } from '../components/viz';
import { CATALOGUE, MODEL, PLACES, QUAKES, price, priceHistory, sourceUrl, type Priced } from '../lib/hazard';
import { useLive } from '../lib/mirror';
import type { Beat } from './types';

/* ------------------------------------------------------------ projection */
// Equirectangular, clipped to the latitudes where people live. 1380 wide so it
// fills the stage; height follows from the latitude span.
const W = 1380, LAT_MAX = 78, LAT_MIN = -60, H = Math.round((W * (LAT_MAX - LAT_MIN)) / 360);
const px = (lon: number, lat: number) => ({ x: ((lon + 180) / 360) * W, y: ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H });
const inv = (x: number, y: number) => ({ lon: (x / W) * 360 - 180, lat: LAT_MAX - (y / H) * (LAT_MAX - LAT_MIN) });
const PX_PER_DEG = H / (LAT_MAX - LAT_MIN);
const kmToPxY = (km: number) => (km / 111.32) * PX_PER_DEG;
const kmToPxX = (km: number, lat: number) => kmToPxY(km) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));

/* ------------------------------------------------------------------ land */
const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
const landPath = (() => {
  const fc = feature(topo, topo.objects.land) as unknown as FeatureCollection<Polygon | MultiPolygon>;
  const geoms = fc.features.map((f) => f.geometry);
  const rings: number[][][] = [];
  for (const g of geoms) {
    if (g.type === 'Polygon') rings.push(...g.coordinates);
    else for (const poly of g.coordinates) rings.push(...poly);
  }
  // Rings that cross the antimeridian (Chukotka, Fiji) are split there, or they
  // would draw a line across the whole map.
  const parts: string[] = [];
  for (const ring of rings) {
    if (!ring.some(([, lat]) => lat > LAT_MIN && lat < LAT_MAX)) continue;
    let d = '';
    ring.forEach(([lon, lat], i) => {
      const p = px(lon, lat);
      const jump = i > 0 && Math.abs(lon - ring[i - 1][0]) > 180;
      d += `${i === 0 || jump ? (d ? 'Z' : '') + 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    });
    parts.push(d + 'Z');
  }
  return parts.join('');
})();

/* -------------------------------------------------------------- heat map */
// The model, drawn: every event lights the 300 km reference disc it would be
// counted in. Where discs overlap the field brightens. Rendered once to a canvas.
function useHeat(): string {
  return useMemo(() => {
    const S = 2;
    const c = document.createElement('canvas');
    c.width = W * S; c.height = H * S;
    const ctx = c.getContext('2d')!;
    ctx.scale(S, S);
    ctx.globalCompositeOperation = 'lighter';
    for (const q of QUAKES) {
      if (q.lat > LAT_MAX || q.lat < LAT_MIN) continue;
      const p = px(q.lon, q.lat);
      const ry = kmToPxY(MODEL.referenceRadiusKm);
      const rx = kmToPxX(MODEL.referenceRadiusKm, q.lat);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(rx / ry, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
      g.addColorStop(0, 'rgba(227,179,65,0.16)');
      g.addColorStop(0.6, 'rgba(227,179,65,0.06)');
      g.addColorStop(1, 'rgba(227,179,65,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, ry, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // epicentres
    ctx.globalCompositeOperation = 'source-over';
    for (const q of QUAKES) {
      if (q.lat > LAT_MAX || q.lat < LAT_MIN) continue;
      const p = px(q.lon, q.lat);
      ctx.fillStyle = q.mag >= 7.5 ? 'rgba(255,240,200,0.9)' : 'rgba(255,225,150,0.55)';
      ctx.beginPath(); ctx.arc(p.x, p.y, q.mag >= 7.5 ? 1.6 : 0.9, 0, Math.PI * 2); ctx.fill();
    }
    return c.toDataURL('image/png');
  }, []);
}

/* ------------------------------------------------------- price history */
function History({ priced }: { priced: Priced }) {
  const series = useMemo(() => priceHistory(priced.nearby), [priced]);
  const w = 340, h = 120, pad = 4;
  const max = Math.max(1e-9, ...series.map((s) => s.premiumHbar));
  const x = (i: number) => pad + (i / (series.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2 - 16);
  const d = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.premiumHbar).toFixed(1)}`).join('');
  const last = series.at(-1)!;
  const y0 = series[0].year;
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="label">cost of 30 days' cover, by year</div>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
        <path d={`${d}L${x(series.length - 1)} ${h - pad}L${x(0)} ${h - pad}Z`} fill="rgba(242,243,245,0.05)" />
        <path d={d} fill="none" stroke={C.fg0} strokeWidth={1.5} />
        {priced.nearby.map((q, i) => {
          const yr = new Date(q.day * 86400000).getUTCFullYear();
          if (yr < y0) return null;
          const xx = x(yr - y0 + (new Date(q.day * 86400000).getUTCMonth() / 12));
          return <line key={i} x1={xx} x2={xx} y1={h - pad} y2={h - pad - 6 - (q.mag - 6) * 6} stroke={C.pending} strokeWidth={1.5} />;
        })}
        <circle cx={x(series.length - 1)} cy={y(last.premiumHbar)} r={3.5} fill={C.ok} />
        <text x={pad} y={12} className="num" fill={C.fg3} fontSize={11}>{y0}</text>
        <text x={w - pad} y={12} textAnchor="end" className="num" fill={C.fg3} fontSize={11}>{last.year}</text>
      </svg>
      <div className="label">ticks: M6+ events within 300 km</div>
    </div>
  );
}

/* ------------------------------------------------------------------ view */
function View() {
  const heat = useHeat();
  const svgRef = useRef<SVGSVGElement>(null);
  const [pin, setPin] = useState<{ lat: number; lon: number; name?: string }>(PLACES[0]);
  const [hover, setHover] = useState<{ lat: number; lon: number } | null>(null);
  const focus = hover ?? pin;
  const priced = useMemo(() => price(focus.lat, focus.lon), [focus.lat, focus.lon]);
  const rate = useLive(async () => {
    const r = await fetch('https://mainnet.mirrornode.hedera.com/api/v1/network/exchangerate');
    const j = (await r.json()) as { current_rate: { cent_equivalent: number; hbar_equivalent: number } };
    return j.current_rate.cent_equivalent / j.current_rate.hbar_equivalent / 100;
  }, []);
  // a live recount at USGS for the pinned point, so the number on screen is checkable
  const [liveCount, setLiveCount] = useState<{ key: string; count: number | null } | null>(null);
  useEffect(() => {
    const key = `${pin.lat},${pin.lon}`;
    setLiveCount(null);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(sourceUrl(pin.lat, pin.lon).replace('/query?', '/count?'), { signal: ctl.signal })
        .then((r) => r.json())
        .then((j: { count: number }) => setLiveCount({ key, count: j.count }))
        .catch(() => setLiveCount({ key, count: null }));
    }, 500);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [pin.lat, pin.lon]);

  const toLonLat = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) return null;
    const { lon, lat } = inv(p.x, p.y);
    return { lat: Number(lat.toFixed(2)), lon: Number(lon.toFixed(2)) };
  };

  const f = px(focus.lon, focus.lat);
  const pinned = price(pin.lat, pin.lon);
  const usd = rate.status === 'ok' ? priced.premiumHbar * rate.data : null;
  const focusName = hover ? `${Math.abs(focus.lat).toFixed(2)}° ${focus.lat >= 0 ? 'N' : 'S'} · ${Math.abs(focus.lon).toFixed(2)}° ${focus.lon >= 0 ? 'E' : 'W'}` : (pin.name ?? `${pin.lat}, ${pin.lon}`);

  return (
    <Scene
      n={0}
      kicker="Atlas"
      title="Anywhere on Earth, priced."
      caption={<>Every shallow M6+ earthquake since 1970 lights the field. Point at a place: the agent's model prices 30 days of {MODEL.payoutHbar} ℏ cover there, from the record alone.</>}
      hud={
        <>
          <div className="flex flex-col gap-[4px]">
            <div className="label">{hover ? 'under the cursor' : 'pinned'}</div>
            <div className="text-[24px] leading-tight text-fg-0" style={{ letterSpacing: '-0.01em' }}>{focusName}</div>
          </div>
          <div className="grid grid-cols-2 gap-x-[20px] gap-y-[22px]">
            <Big label="M6+ within 300 km" value={String(priced.count)} size={36} />
            <Big label="rate λ · / yr" value={priced.lambda.toFixed(4)} size={36} />
            <Big label="chance in 30 days" value={`${(priced.probability * 100).toFixed(2)}`} unit="%" size={36} />
            <Big label={usd !== null ? `premium · ≈ $${usd.toFixed(4)}` : 'premium'} value={priced.premiumHbar.toFixed(4)} unit="ℏ" tone={priced.count ? 'ok' : 'dim'} size={36} />
          </div>
          <History priced={priced} />
        </>
      }
      verifyLabel="verify"
      links={[{ kind: 'topic', id: 'query', label: 'recount this point at USGS', href: sourceUrl(pin.lat, pin.lon) }]}
      note={
        liveCount && liveCount.key === `${pin.lat},${pin.lon}`
          ? liveCount.count === null
            ? <span className="text-pending">USGS unavailable · {pinned.count} events from the frozen catalogue</span>
            : <span className={liveCount.count === pinned.count ? 'text-ok' : 'text-pending'}>USGS live: {liveCount.count} events · {liveCount.count === pinned.count ? 'matches' : `catalogue has ${pinned.count}`} · {CATALOGUE.count.toLocaleString()} events frozen {CATALOGUE.fetchedAt.slice(0, 10)}</span>
          : <span className="text-fg-3">asking USGS to recount {pin.name ?? 'this point'}…</span>
      }
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
        style={{ cursor: 'crosshair' }}
        onMouseMove={(e) => setHover(toLonLat(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => { const p = toLonLat(e); if (p) setPin(p); }}
      >
        <path d={landPath} fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.10)" strokeWidth={0.6} />
        <image href={heat} x={0} y={0} width={W} height={H} style={{ mixBlendMode: 'screen' }} />
        {/* the events the model counts for the focused point */}
        {priced.nearby.map((q, i) => { const p = px(q.lon, q.lat); return <circle key={i} cx={p.x} cy={p.y} r={1.5 + (q.mag - 6) * 2} fill="none" stroke={C.pending} strokeWidth={1} />; })}
        {/* reference region and trigger circle at the focus */}
        <ellipse cx={f.x} cy={f.y} rx={kmToPxX(MODEL.referenceRadiusKm, focus.lat)} ry={kmToPxY(MODEL.referenceRadiusKm)} fill="rgba(242,243,245,0.04)" stroke={C.fg1} strokeWidth={1} strokeDasharray="3 4" />
        <ellipse cx={f.x} cy={f.y} rx={kmToPxX(MODEL.triggerRadiusKm, focus.lat)} ry={kmToPxY(MODEL.triggerRadiusKm)} fill="none" stroke={C.fg0} strokeWidth={1.2} />
        <line x1={f.x - 14} x2={f.x + 14} y1={f.y} y2={f.y} stroke={C.fg0} strokeWidth={1} />
        <line x1={f.x} x2={f.x} y1={f.y - 14} y2={f.y + 14} stroke={C.fg0} strokeWidth={1} />
        {/* pinned marker, when hovering elsewhere */}
        {hover ? (() => { const p = px(pin.lon, pin.lat); return <circle cx={p.x} cy={p.y} r={4} fill={C.ok} />; })() : null}
        <text x={f.x + 18} y={f.y - 10} className="num" fill={C.fg0} fontSize={14}>{priced.premiumHbar.toFixed(4)} ℏ</text>
        <text x={f.x + 18} y={f.y + 8} className="label" fill={C.fg2} fontSize={12}>{priced.count} events · P {(priced.probability * 100).toFixed(2)} %</text>
      </svg>
      {/* places */}
      <div className="absolute bottom-[14px] left-[16px] right-[16px] flex flex-wrap items-center gap-[8px]">
        {PLACES.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={(e) => { setPin(p); e.currentTarget.blur(); }}
            className={`rounded-full border px-[12px] py-[4px] text-[14px] transition-colors ${pin.name === p.name ? 'border-fg-1 text-fg-0 bg-bg-3' : 'border-line text-fg-2 hover:text-fg-0 hover:border-line-strong'}`}
          >
            {p.name}
          </button>
        ))}
        <span className="label ml-auto">click anywhere to pin</span>
      </div>
    </Scene>
  );
}

export const atlas: Beat = { label: 'Atlas', steps: 1, View };
