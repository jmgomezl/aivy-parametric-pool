import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scene } from '../components/Scene';
import { Big, C } from '../components/viz';
import { CATALOGUE, FIRST_YEAR, LAST_YEAR, MAX_DAYS, MODEL, PLACES, around, dayOf, nearest, placeName, price, priceHistory, sourceUrl, type Place, type PriceOpts, type Priced } from '../lib/hazard';
import { useLive } from '../lib/mirror';
import { Heat } from './atlas/Heat';
import { landPath } from './atlas/land';
import { H, HOME, W, kmToPxX, kmToPxY, pan, project, unproject, zoomAt, type View } from './atlas/projection';
import type { Beat } from './types';

const MAGS = [6, 6.5, 7];
const isoDay = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);

/* --------------------------------------------------------- price history */
function History({ nearby, opts, markYear }: { nearby: Priced['nearby']; opts: PriceOpts; markYear: number }) {
  const series = useMemo(() => priceHistory(nearby, opts), [nearby, opts]);
  const w = 340, h = 104, pad = 4;
  const max = Math.max(1e-9, ...series.map((s) => s.premiumHbar));
  const y0 = series[0].year, yN = series.at(-1)!.year;
  const x = (yr: number) => pad + ((yr - y0) / (yN - y0)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2 - 14);
  const d = series.map((s, i) => `${i ? 'L' : 'M'}${x(s.year).toFixed(1)} ${y(s.premiumHbar).toFixed(1)}`).join('');
  const at = series.find((s) => s.year === Math.max(y0, Math.min(yN, markYear))) ?? series.at(-1)!;
  const minMag = opts.minMag ?? MODEL.minMagnitude;
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex items-baseline justify-between">
        <div className="label whitespace-nowrap">cost by year · {opts.days} d of {opts.payoutHbar} ℏ</div>
        <div className="label num whitespace-nowrap">{at.year} · {at.premiumHbar.toFixed(4)} ℏ</div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
        <path d={`${d}L${x(yN)} ${h - pad}L${x(y0)} ${h - pad}Z`} fill="rgba(242,243,245,0.05)" />
        <path d={d} fill="none" stroke={C.fg0} strokeWidth={1.5} />
        {nearby.map((q, i) => {
          const dt = new Date(q.day * 86400000);
          const yr = dt.getUTCFullYear() + dt.getUTCMonth() / 12;
          if (yr < y0 || q.mag < minMag) return null;
          return <line key={i} x1={x(yr)} x2={x(yr)} y1={h - pad} y2={h - pad - 5 - (q.mag - 6) * 6} stroke={C.pending} strokeWidth={1.5} />;
        })}
        <line x1={x(at.year)} x2={x(at.year)} y1={2} y2={h - pad} stroke={C.fg2} strokeDasharray="2 3" />
        <circle cx={x(at.year)} cy={y(at.premiumHbar)} r={3.5} fill={C.ok} />
        <text x={pad} y={11} className="num" fill={C.fg3} fontSize={11}>{y0}</text>
        <text x={w - pad} y={11} textAnchor="end" className="num" fill={C.fg3} fontSize={11}>{yN}</text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------- controls */
function Slider({ label, value, min, max, step = 1, unit, onChange, accent = false }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="num text-[16px] text-fg-0">{value} <span className="text-fg-2">{unit}</span></span>
      </div>
      <input type="range" className={`slider ${accent ? 'slider-accent' : ''}`} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} onKeyDown={(e) => e.stopPropagation()} />
    </div>
  );
}

/* ------------------------------------------------------------------ view */
type Pin = { lat: number; lon: number; name?: string };
function readPinFromHash(): Pin | null {
  const m = /^#0@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(window.location.hash);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  return (PLACES.find((p) => p.lat === lat && p.lon === lon) as Place | undefined) ?? { lat, lon };
}

function View() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(HOME);
  const [pin, setPin] = useState<Pin>(() => readPinFromHash() ?? PLACES[0]);
  const [hover, setHover] = useState<{ lat: number; lon: number } | null>(null);
  const [year, setYear] = useState(LAST_YEAR);
  const [playing, setPlaying] = useState(false);
  const [payout, setPayout] = useState(MODEL.payoutHbar);
  const [days, setDays] = useState(MODEL.days);
  const [minMag, setMinMag] = useState(MODEL.minMagnitude);
  const [compare, setCompare] = useState<Pin[]>([]);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);

  // the record as it stood at the chosen year
  const live = year >= LAST_YEAR;
  const now = useMemo(() => (live ? new Date(CATALOGUE.fetchedAt) : new Date(Date.UTC(year, 11, 31, 23, 59, 59))), [year, live]);
  const toDay = dayOf(now);
  const opts = useMemo<PriceOpts>(() => ({ now, payoutHbar: payout, days, minMag }), [now, payout, days, minMag]);

  const focus = hover ?? pin;
  const priced = useMemo(() => price(focus.lat, focus.lon, opts), [focus.lat, focus.lon, opts]);
  const fullNearby = useMemo(() => around(focus.lat, focus.lon, minMag), [focus.lat, focus.lon, minMag]);
  const near = useMemo(() => nearest(focus.lat, focus.lon, minMag, toDay), [focus.lat, focus.lon, minMag, toDay]);
  const pinned = useMemo(() => price(pin.lat, pin.lon, opts), [pin.lat, pin.lon, opts]);

  // playback
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setYear((y) => { if (y >= LAST_YEAR) { setPlaying(false); return y; } return y + 1; }), 300);
    return () => clearInterval(t);
  }, [playing]);
  const play = () => { if (!playing && year >= LAST_YEAR) setYear(FIRST_YEAR); setPlaying((p) => !p); };

  // shareable pin
  useEffect(() => { history.replaceState(null, '', `#0@${pin.lat},${pin.lon}`); }, [pin.lat, pin.lon]);

  // live rate and live recount
  const rate = useLive(async () => {
    const r = await fetch('https://mainnet.mirrornode.hedera.com/api/v1/network/exchangerate');
    const j = (await r.json()) as { current_rate: { cent_equivalent: number; hbar_equivalent: number } };
    return j.current_rate.cent_equivalent / j.current_rate.hbar_equivalent / 100;
  }, []);
  const [liveCount, setLiveCount] = useState<{ key: string; count: number | null } | null>(null);
  const liveKey = `${pin.lat},${pin.lon},${minMag}`;
  useEffect(() => {
    setLiveCount(null);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(sourceUrl(pin.lat, pin.lon, minMag).replace('/query?', '/count?'), { signal: ctl.signal })
        .then((r) => r.json())
        .then((j: { count: number }) => setLiveCount({ key: liveKey, count: j.count }))
        .catch(() => setLiveCount({ key: liveKey, count: null }));
    }, 500);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [liveKey, pin.lat, pin.lon, minMag]);

  // pointer → viewport px (the SVG's viewBox is the viewport)
  const toXY = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };
  const toLatLon = (x: number, y: number) => {
    if (x < 0 || x > W || y < 0 || y > H) return null;
    const { lat, lon } = unproject(x, y, view);
    if (lon < -180 || lon > 180) return null;
    return { lat: Number(lat.toFixed(2)), lon: Number(lon.toFixed(2)) };
  };

  // wheel must be non-passive to stop the page from scrolling
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const { x, y } = toXY(e);
    const factor = Math.exp(-e.deltaY * 0.0016);
    setView((v) => zoomAt(v, x, y, factor));
  }, []);
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const usd = rate.status === 'ok' ? priced.premiumHbar * rate.data : null;
  const f = project(focus.lon, focus.lat, view);
  const p = project(pin.lon, pin.lat, view);
  const land = useMemo(() => landPath(view), [view]);

  const addCompare = () => setCompare((c) => (c.some((x) => x.lat === pin.lat && x.lon === pin.lon) || c.length >= 4 ? c : [...c, { ...pin }]));
  const compareRows = useMemo(() => compare.map((c) => ({ ...c, premium: price(c.lat, c.lon, opts).premiumHbar })), [compare, opts]);
  const compareMax = Math.max(1e-9, ...compareRows.map((r) => r.premium), pinned.premiumHbar);

  return (
    <Scene
      n={0}
      kicker="Atlas"
      title="Anywhere on Earth, priced."
      caption={<>Every shallow M{minMag}+ earthquake since 1970 lights the field. Point, zoom, scrub the years: the agent's model prices {days} days of {payout} ℏ cover there, from the record alone.</>}
      hud={
        <div className="flex flex-col gap-[14px]">
          <div className="flex items-end justify-between gap-[12px]">
            <div className="min-w-0">
              <div className="label">{hover ? 'under the cursor' : 'pinned'}{!live ? ` · record as of ${year}` : ''}</div>
              <div className="truncate text-[22px] leading-tight text-fg-0" style={{ letterSpacing: '-0.01em' }}>{placeName(focus)}</div>
            </div>
            {!hover ? <button type="button" className="chip" onClick={(e) => { addCompare(); e.currentTarget.blur(); }} title="add to the comparison">+ compare</button> : null}
          </div>
          <div className="grid grid-cols-2 gap-x-[20px] gap-y-[14px]">
            <Big label={`M${minMag}+ within 300 km`} value={String(priced.count)} size={32} />
            <Big label="rate λ · / yr" value={priced.lambda.toFixed(4)} size={32} />
            <Big label={`chance in ${days} days`} value={(priced.probability * 100).toFixed(2)} unit="%" size={32} />
            <Big label={usd !== null && live ? `premium · ≈ $${usd.toFixed(4)}` : 'premium'} value={priced.premiumHbar.toFixed(4)} unit="ℏ" tone={priced.count ? 'ok' : 'dim'} size={32} />
          </div>
          <div className="label num">
            {near ? <>nearest recorded · M {near.mag.toFixed(1)} · {isoDay(near.day)} · {Math.round(near.km)} km away · {Math.round(near.depthKm)} km deep</> : 'no recorded event yet'}
          </div>
          <div className="grid grid-cols-2 gap-x-[20px]">
            <Slider label="cover" value={payout} min={1} max={50} unit="ℏ" onChange={setPayout} />
            <Slider label="window" value={days} min={7} max={MAX_DAYS} unit="days" onChange={setDays} />
          </div>
          <History nearby={fullNearby} opts={opts} markYear={year} />
          {compareRows.length ? (
            <div className="flex flex-col gap-[6px]">
              <div className="label">compared · same cover, same window</div>
              {[...compareRows.map((r) => ({ ...r, current: false })), { ...pin, premium: pinned.premiumHbar, current: true }].map((r, i) => (
                <div key={`${r.lat},${r.lon},${i}`} className="grid grid-cols-[110px_1fr_74px_16px] items-center gap-[8px]">
                  <span className={`truncate text-[14px] ${r.current ? 'text-fg-0' : 'text-fg-1'}`}>{placeName(r)}</span>
                  <div className="bar" style={{ height: 6 }}><span style={{ width: `${(r.premium / compareMax) * 100}%`, background: r.current ? 'var(--ok)' : 'var(--fg-2)' }} /></div>
                  <span className="num text-right text-[14px]">{r.premium.toFixed(4)} ℏ</span>
                  {r.current ? <span /> : <button type="button" className="text-fg-3 hover:text-fg-0 text-[14px]" onClick={() => setCompare((c) => c.filter((x) => !(x.lat === r.lat && x.lon === r.lon)))} title="remove">×</button>}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      }
      verifyLabel="verify"
      links={[{ kind: 'topic', id: 'query', label: 'recount the pinned point at USGS', href: sourceUrl(pin.lat, pin.lon, minMag) }]}
      note={
        !live
          ? <span className="text-pending">record as of {year} · {pinned.count} events counted by then · scrub to {LAST_YEAR} for today's price</span>
          : liveCount && liveCount.key === liveKey
            ? liveCount.count === null
              ? <span className="text-pending">USGS unavailable · {pinned.count} events from the frozen catalogue</span>
              : <span className={liveCount.count === pinned.count ? 'text-ok' : 'text-pending'}>USGS live: {liveCount.count} events · {liveCount.count === pinned.count ? 'matches' : `catalogue has ${pinned.count}`} · {CATALOGUE.count.toLocaleString()} events frozen {CATALOGUE.fetchedAt.slice(0, 10)}</span>
            : <span className="text-fg-3">asking USGS to recount {placeName(pin)}…</span>
      }
    >
      {/* time */}
      <div className="absolute left-[16px] right-[16px] top-[10px] flex items-center gap-[14px]">
        <button type="button" className="icon-btn" onClick={(e) => { play(); e.currentTarget.blur(); }} title={playing ? 'pause' : 'play the record'}>
          <span className="mono text-[12px]">{playing ? '❚❚' : '▶'}</span>
        </button>
        <span className="num text-[28px] leading-none text-fg-0 w-[80px]">{year}</span>
        <input type="range" className="slider slider-accent flex-1" min={FIRST_YEAR} max={LAST_YEAR} step={1} value={year} onChange={(e) => { setPlaying(false); setYear(Number(e.target.value)); }} onKeyDown={(e) => e.stopPropagation()} />
        <span className="label w-[250px] text-right">{live ? 'the record today' : `the record as of ${year}`}{view.k > 1.02 ? ` · zoom ×${view.k.toFixed(1)}` : ''}</span>
        {view.k > 1.02 ? <button type="button" className="chip" onClick={(e) => { setView(HOME); e.currentTarget.blur(); }}>reset view</button> : null}
      </div>

      {/* map */}
      <div className="absolute inset-x-0 top-[52px] bottom-[52px] grid place-items-center">
        <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}`, maxHeight: '100%' }}>
          <Heat view={view} toDay={toDay} minMag={minMag} />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 h-full w-full"
            style={{ cursor: 'crosshair' }}
            onMouseDown={(e) => { const { x, y } = toXY(e); drag.current = { x, y, view, moved: false }; }}
            onMouseMove={(e) => {
              const { x, y } = toXY(e);
              const d = drag.current;
              if (d) {
                if (Math.hypot(x - d.x, y - d.y) > 3) d.moved = true;
                if (d.moved) { setView(pan(d.view, x - d.x, y - d.y)); return; }
              }
              setHover(toLatLon(x, y));
            }}
            onMouseUp={(e) => { const d = drag.current; drag.current = null; if (d && !d.moved) { const { x, y } = toXY(e); const ll = toLatLon(x, y); if (ll) setPin(ll); } }}
            onMouseLeave={() => { drag.current = null; setHover(null); }}
            onDoubleClick={() => setView(HOME)}
          >
            <path d={land} fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.10)" strokeWidth={0.6} />
            {priced.nearby.map((q, i) => { const e = project(q.lon, q.lat, view); return <circle key={i} cx={e.x} cy={e.y} r={(1.5 + (q.mag - 6) * 2) * Math.sqrt(view.k)} fill="none" stroke={C.pending} strokeWidth={1} />; })}
            <ellipse cx={f.x} cy={f.y} rx={kmToPxX(MODEL.referenceRadiusKm, focus.lat, view)} ry={kmToPxY(MODEL.referenceRadiusKm, view)} fill="rgba(242,243,245,0.04)" stroke={C.fg1} strokeWidth={1} strokeDasharray="3 4" />
            <ellipse cx={f.x} cy={f.y} rx={kmToPxX(MODEL.triggerRadiusKm, focus.lat, view)} ry={kmToPxY(MODEL.triggerRadiusKm, view)} fill="none" stroke={C.fg0} strokeWidth={1.2} />
            <line x1={f.x - 14} x2={f.x + 14} y1={f.y} y2={f.y} stroke={C.fg0} strokeWidth={1} />
            <line x1={f.x} x2={f.x} y1={f.y - 14} y2={f.y + 14} stroke={C.fg0} strokeWidth={1} />
            {hover ? <circle cx={p.x} cy={p.y} r={4} fill={C.ok} /> : null}
            {compare.map((c, i) => { const e = project(c.lon, c.lat, view); return <g key={i}><circle cx={e.x} cy={e.y} r={3.5} fill={C.fg1} /><text x={e.x + 8} y={e.y - 6} className="label" fill={C.fg1} fontSize={12}>{placeName(c)}</text></g>; })}
            <text x={f.x + 18} y={f.y - 10} className="num" fill={C.fg0} fontSize={14}>{priced.premiumHbar.toFixed(4)} ℏ</text>
            <text x={f.x + 18} y={f.y + 8} className="label" fill={C.fg2} fontSize={12}>{priced.count} events · P {(priced.probability * 100).toFixed(2)} %</text>
          </svg>
        </div>
      </div>

      {/* places and trigger */}
      <div className="absolute bottom-[12px] left-[16px] right-[16px] flex items-center gap-[8px]">
        {PLACES.map((pl) => (
          <button key={pl.name} type="button" onClick={(e) => { setPin(pl); e.currentTarget.blur(); }} className={`chip ${pin.name === pl.name ? 'chip-on' : ''}`}>{pl.name}</button>
        ))}
        <span className="ml-auto label">trigger</span>
        {MAGS.map((m) => (
          <button key={m} type="button" onClick={(e) => { setMinMag(m); e.currentTarget.blur(); }} className={`chip ${minMag === m ? 'chip-on' : ''}`}>M{m}+</button>
        ))}
        <span className="label ml-[10px] whitespace-nowrap">scroll · drag · click to pin</span>
      </div>
    </Scene>
  );
}

export const atlas: Beat = { label: 'Atlas', steps: 1, View };
