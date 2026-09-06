// The atlas as a component: the hazard field, zoom and pan, the year scrubber,
// capitals, place chips and the trigger floor. It owns its own view state and
// tells the page two things: where the focus is, and what record it is showing.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../components/viz';
import capitalsData from '../data/capitals.json';
import { CATALOGUE, FIRST_YEAR, LAST_YEAR, MODEL, PLACES, around, dayOf, type Place } from '../lib/hazard';
import { Heat } from '../beats/atlas/Heat';
import { landPath } from '../beats/atlas/land';
import { H, HOME, W, kmToPxX, kmToPxY, pan, project, unproject, zoomAt, type View } from '../beats/atlas/projection';

export interface Pin { lat: number; lon: number; name?: string }
export interface MapState { hover: { lat: number; lon: number } | null; year: number; live: boolean; now: Date; minMag: number }
export interface Marker { lat: number; lon: number; label: string; id: string; tone?: 'ok' | 'pending' | 'neutral' }

const MAGS = [6, 6.5, 7];

/* --------------------------------------------------------------- capitals */
interface Capital { name: string; country: string; lon: number; lat: number; pop: number; rank: number }
const CAPITALS: Capital[] = (capitalsData.rows as [string, string, number, number, number, number][]).map(([name, country, lon, lat, pop, rank]) => ({ name, country, lon, lat, pop, rank }));
const LABEL_PX = 11;

function placeCapitals(view: View): (Capital & { x: number; y: number })[] {
  const maxRank = view.k < 1.6 ? 1 : view.k < 2.6 ? 2 : view.k < 4 ? 3 : view.k < 6 ? 4 : 9;
  const placed: (Capital & { x: number; y: number })[] = [];
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const c of CAPITALS) {
    if (c.rank > maxRank) continue;
    const p = project(c.lon, c.lat, view);
    if (p.x < -20 || p.x > W + 20 || p.y < -10 || p.y > H + 10) continue;
    const box = { x0: p.x - 4, y0: p.y - LABEL_PX - 2, x1: p.x + 8 + c.name.length * LABEL_PX * 0.56, y1: p.y + 6 };
    if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
    boxes.push(box);
    placed.push({ ...c, x: p.x, y: p.y });
  }
  return placed;
}

export function AtlasMap({ pin, onPin, onState, markers = [], onMarker, places = PLACES, hint, preview }: {
  pin: Pin | null;
  onPin: (p: Pin) => void;
  onState?: (s: MapState) => void;
  markers?: Marker[];
  onMarker?: (id: string) => void;
  places?: Place[];
  hint?: string;
  /** what the cursor would buy, shown beside it */
  preview?: (lat: number, lon: number) => { text: string; tone: 'ok' | 'dim' } | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(HOME);
  const [hover, setHover] = useState<{ lat: number; lon: number } | null>(null);
  const [year, setYear] = useState(LAST_YEAR);
  const [playing, setPlaying] = useState(false);
  const [minMag, setMinMag] = useState(MODEL.minMagnitude);
  const [showCapitals, setShowCapitals] = useState(true);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);

  const live = year >= LAST_YEAR;
  const now = useMemo(() => (live ? new Date(CATALOGUE.fetchedAt) : new Date(Date.UTC(year, 11, 31, 23, 59, 59))), [year, live]);
  const toDay = dayOf(now);

  useEffect(() => { onState?.({ hover, year, live, now, minMag }); }, [hover, year, live, now, minMag, onState]);

  // playback
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setYear((y) => { if (y >= LAST_YEAR) { setPlaying(false); return y; } return y + 1; }), 300);
    return () => clearInterval(t);
  }, [playing]);
  const play = () => { if (!playing && year >= LAST_YEAR) setYear(FIRST_YEAR); setPlaying((p) => !p); };

  const focus = hover ?? pin;
  const nearby = useMemo(() => (focus ? around(focus.lat, focus.lon, minMag).filter((q) => q.day <= toDay) : []), [focus, minMag, toDay]);

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

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const { x, y } = toXY(e);
    setView((v) => zoomAt(v, x, y, Math.exp(-e.deltaY * 0.0016)));
  }, []);
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const land = useMemo(() => landPath(view), [view]);
  const capitals = useMemo(() => (showCapitals ? placeCapitals(view) : []), [view, showCapitals]);
  const f = focus ? project(focus.lon, focus.lat, view) : null;
  const p = pin ? project(pin.lon, pin.lat, view) : null;

  return (
    <div className="absolute inset-0 select-none">
      {/* time */}
      <div className="absolute left-[16px] right-[16px] top-[10px] flex items-center gap-[14px]">
        <button type="button" className="icon-btn" onClick={(e) => { play(); e.currentTarget.blur(); }} title={playing ? 'pause' : 'play the record'}>
          <span className="mono text-[12px]">{playing ? '❚❚' : '▶'}</span>
        </button>
        <span className="num text-[26px] leading-none text-fg-0 w-[76px]">{year}</span>
        <input type="range" className="slider slider-accent flex-1 max-w-[520px]" min={FIRST_YEAR} max={LAST_YEAR} step={1} value={year} onChange={(e) => { setPlaying(false); setYear(Number(e.target.value)); }} onKeyDown={(e) => e.stopPropagation()} />
        <span className="label">{!live ? `the record as of ${year}` : ''}{view.k > 1.02 ? `${!live ? ' · ' : ''}zoom ×${view.k.toFixed(1)}` : ''}</span>
        {view.k > 1.02 ? <button type="button" className="chip" onClick={(e) => { setView(HOME); e.currentTarget.blur(); }}>reset</button> : null}
      </div>
      {hint ? <div className="absolute left-1/2 top-[64px] -translate-x-1/2 label pointer-events-none">{hint}</div> : null}

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
            onMouseUp={(e) => { const d = drag.current; drag.current = null; if (d && !d.moved) { const { x, y } = toXY(e); const ll = toLatLon(x, y); if (ll) onPin(ll); } }}
            onMouseLeave={() => { drag.current = null; setHover(null); }}
            onDoubleClick={() => setView(HOME)}
          >
            <path d={land} fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.10)" strokeWidth={0.6} />
            {nearby.map((q, i) => { const e = project(q.lon, q.lat, view); return <circle key={i} cx={e.x} cy={e.y} r={(1.5 + (q.mag - 6) * 2) * Math.sqrt(view.k)} fill="none" stroke={C.pending} strokeWidth={1} />; })}
            {capitals.map((c) => (
              <g key={`${c.name}-${c.country}`} style={{ cursor: 'pointer' }} onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => { e.stopPropagation(); drag.current = null; onPin({ name: c.name, lat: c.lat, lon: c.lon }); }}>
                <circle cx={c.x} cy={c.y} r={1.8} fill={C.fg2} />
                <text x={c.x + 6} y={c.y + 4} className="label" fill={C.fg2} fontSize={LABEL_PX} style={{ paintOrder: 'stroke', stroke: 'rgba(10,11,13,0.8)', strokeWidth: 3, strokeLinejoin: 'round' }}>{c.name}</text>
              </g>
            ))}
            {/* live policies on the network */}
            {markers.map((m) => {
              const e = project(m.lon, m.lat, view);
              const col = m.tone === 'pending' ? C.pending : m.tone === 'neutral' ? C.fg2 : C.ok;
              return (
                <g key={m.id} style={{ cursor: 'pointer' }} onMouseDown={(ev) => ev.stopPropagation()} onMouseUp={(ev) => { ev.stopPropagation(); drag.current = null; onMarker?.(m.id); }}>
                  <circle cx={e.x} cy={e.y} r={9} fill="transparent" />
                  <circle cx={e.x} cy={e.y} r={3.2} fill={col} />
                  <circle cx={e.x} cy={e.y} r={6.5} fill="none" stroke={col} strokeWidth={1} opacity={0.6} />
                </g>
              );
            })}
            {focus && f ? (
              <>
                <ellipse cx={f.x} cy={f.y} rx={kmToPxX(MODEL.referenceRadiusKm, focus.lat, view)} ry={kmToPxY(MODEL.referenceRadiusKm, view)} fill="rgba(242,243,245,0.04)" stroke={C.fg1} strokeWidth={1} strokeDasharray="3 4" />
                <ellipse cx={f.x} cy={f.y} rx={kmToPxX(MODEL.triggerRadiusKm, focus.lat, view)} ry={kmToPxY(MODEL.triggerRadiusKm, view)} fill="none" stroke={C.fg0} strokeWidth={1.2} />
                <line x1={f.x - 14} x2={f.x + 14} y1={f.y} y2={f.y} stroke={C.fg0} strokeWidth={1} />
                <line x1={f.x} x2={f.x} y1={f.y - 14} y2={f.y + 14} stroke={C.fg0} strokeWidth={1} />
                {hover ? (() => {
                  const pv = preview?.(hover.lat, hover.lon);
                  return (
                    <g>
                      {pv ? <text x={f.x + 18} y={f.y + 24} className="num" fill={pv.tone === 'ok' ? C.ok : C.fg2} fontSize={14} style={{ paintOrder: 'stroke', stroke: 'rgba(10,11,13,0.9)', strokeWidth: 4 }}>{pv.text}</text> : null}
                      <text x={f.x + 18} y={f.y + (pv ? 42 : 24)} className="label" fill={C.fg2} fontSize={12} style={{ paintOrder: 'stroke', stroke: 'rgba(10,11,13,0.9)', strokeWidth: 3 }}>{nearby.length} M{minMag}+ within 300 km · click to quote</text>
                    </g>
                  );
                })() : null}
              </>
            ) : null}
            {hover && p ? <circle cx={p.x} cy={p.y} r={4} fill={C.ok} /> : null}
          </svg>
        </div>
      </div>

      {/* places and trigger */}
      <div className="absolute bottom-[12px] left-[16px] right-[16px] flex items-center gap-[8px]">
        {places.map((pl) => (
          <button key={pl.name} type="button" onClick={(e) => { onPin(pl); e.currentTarget.blur(); }} className={`chip ${pin?.name === pl.name ? 'chip-on' : ''}`}>{pl.name}</button>
        ))}
        <span className="ml-auto" />
        <button type="button" className={`chip ${showCapitals ? 'chip-on' : ''}`} onClick={(e) => { setShowCapitals((v) => !v); e.currentTarget.blur(); }} title="show or hide the world's capitals">capitals</button>
        <span className="label ml-[10px]">trigger</span>
        {MAGS.map((m) => (
          <button key={m} type="button" onClick={(e) => { setMinMag(m); e.currentTarget.blur(); }} className={`chip ${minMag === m ? 'chip-on' : ''}`}>M{m}+</button>
        ))}
      </div>
    </div>
  );
}
