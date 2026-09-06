import { useId, useMemo, type PointerEvent } from 'react';
import { C } from '../components/viz';
import { around, FIRST_YEAR, LAST_YEAR, placeName, priceHistory } from '../lib/hazard';
import type { Pin } from './AtlasMap';

const HISTORY_PAYOUT_USD = 800;

/** A fixed modeled USD payout isolates historical premium changes from budget changes. */
export function History({ pin, days, minMag, markYear, onYear }: { pin: Pin; days: number; minMag: number; markYear: number; onYear: (year: number) => void }) {
  const id = useId();
  const series = useMemo(() => priceHistory(around(pin.lat, pin.lon, minMag), { payoutHbar: HISTORY_PAYOUT_USD, days, minMag }, FIRST_YEAR, LAST_YEAR, 'end'), [pin.lat, pin.lon, days, minMag]);
  const valid = series.filter(s => s.count > 0);
  const at = series.find(s => s.year === markYear)!;
  const previous = series.find(s => s.year === markYear - 1);
  const change = at.count && previous?.count && previous.premiumHbar > 0 ? (at.premiumHbar / previous.premiumHbar - 1) * 100 : null;
  const money = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const w = 560, h = 174, left = 48, right = 12, top = 12, bottom = 28;
  const max = Math.max(1, ...valid.map(s => s.premiumHbar)) * 1.08;
  const x = (year: number) => left + (year - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR) * (w - left - right);
  const y = (v: number) => h - bottom - v / max * (h - top - bottom);
  const d = valid.map((s, i) => `${i ? 'L' : 'M'}${x(s.year)} ${y(s.premiumHbar)}`).join(' ');
  const selectYear = (year: number) => onYear(Math.max(FIRST_YEAR, Math.min(LAST_YEAR, Math.round(year))));
  const selectAtPointer = (event: PointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget, matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    selectYear(FIRST_YEAR + (local.x - left) / (w - left - right) * (LAST_YEAR - FIRST_YEAR));
  };
  return <figure className="premium-history">
    <figcaption><div><strong>Premium for an ${HISTORY_PAYOUT_USD} payout</strong><span>{placeName(pin)} · {days} days · USD model</span></div><div className="premium-history-value"><strong className="num">{at.count ? money(at.premiumHbar) : '—'}</strong><span>{markYear}{!at.count ? ' · insufficient data' : ''}</span><YearlyChange change={change} year={markYear} lowerIsBetter /></div></figcaption>
    {valid.length ? <svg viewBox={`0 0 ${w} ${h}`} className="premium-history-interactive" role="slider" tabIndex={0} aria-label="Premium history year" aria-describedby={id} aria-valuemin={FIRST_YEAR} aria-valuemax={LAST_YEAR} aria-valuenow={markYear} aria-valuetext={`${markYear}: ${at.count ? money(at.premiumHbar) + ' modeled premium' : 'insufficient historical data'}`} aria-orientation="horizontal"
      onPointerDown={event=>{if(!event.isPrimary||event.button!==0)return;event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);selectAtPointer(event);}}
      onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))selectAtPointer(event);}}
      onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
      onKeyDown={event=>{const year=event.key==='Home'?FIRST_YEAR:event.key==='End'?LAST_YEAR:['ArrowRight','ArrowUp'].includes(event.key)?markYear+1:['ArrowLeft','ArrowDown'].includes(event.key)?markYear-1:event.key==='PageUp'?markYear+10:event.key==='PageDown'?markYear-10:null;if(year!==null){event.preventDefault();event.stopPropagation();selectYear(year);}}}>
      <title id={id}>Modeled premium history for {placeName(pin)}. {markYear}: {at.count ? money(at.premiumHbar) : 'insufficient historical data'}, for a fixed ${HISTORY_PAYOUT_USD} modeled USD payout over {days} days at M{minMag}+.</title>
      {[0, .5, 1].map(f => <g key={f}><line x1={left} x2={w-right} y1={y(max*f)} y2={y(max*f)} stroke={C.fg3} strokeOpacity=".2"/><text x={left-8} y={y(max*f)+4} textAnchor="end" fill={C.fg2} fontSize="11">${(max*f).toFixed(max < 10 ? 1 : 0)}</text></g>)}
      <path d={`${d} L${x(valid.at(-1)!.year)} ${y(0)} L${x(valid[0].year)} ${y(0)} Z`} fill={C.ok} fillOpacity=".07"/>
      <path d={d} fill="none" stroke={C.ok} strokeWidth="2" strokeLinejoin="round"/>
      <line x1={x(markYear)} x2={x(markYear)} y1={top} y2={h-bottom} stroke={C.fg2} strokeDasharray="3 4"/>
      {at.count ? <circle cx={x(markYear)} cy={y(at.premiumHbar)} r="4" fill={C.ok} stroke={C.fg0} strokeWidth="1.5"/> : null}
      {[FIRST_YEAR, 1990, 2010, LAST_YEAR].map(year => <text key={year} x={x(year)} y={h-6} textAnchor={year===FIRST_YEAR?'start':year===LAST_YEAR?'end':'middle'} fill={C.fg2} fontSize="11">{year}</text>)}
    </svg> : <p className="premium-history-empty">Not enough recorded events to estimate a premium here.</p>}
    <small>Tap or drag the chart to choose a year.</small>
    <small>Fixed payout · year-end premium estimates · {LAST_YEAR} through the snapshot date</small>
  </figure>;
}

export function YearlyChange({ change, year, lowerIsBetter = false }: { change: number | null; year: number; lowerIsBetter?: boolean }) {
  const rounded = change === null ? null : Math.round(change * 10) / 10;
  const direction = rounded === null || rounded === 0 ? 'flat' : rounded > 0 ? 'up' : 'down';
  const good = lowerIsBetter ? direction === 'down' : direction === 'up';
  const label = rounded === null ? `No comparison for ${year - 1}` : `${direction === 'up' ? 'Increase' : direction === 'down' ? 'Decrease' : 'Unchanged'} ${Math.abs(rounded).toFixed(1)}% versus ${year - 1}${year === LAST_YEAR ? ', through snapshot date' : ''}`;
  return <span className={`yearly-change num ${direction === 'flat' ? '' : good ? 'change-good' : 'change-bad'}`} aria-label={label} title={label}>
    <span aria-hidden="true">{rounded === null ? '—' : `${direction === 'up' ? '↗ +' : direction === 'down' ? '↘ −' : '→ '}${Math.abs(rounded).toFixed(1)}%`}</span><span aria-hidden="true"> vs {year - 1}{year === LAST_YEAR ? ' · YTD' : ''}</span>
  </span>;
}

export function Slider({ label, value, min, max, step = 1, unit, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void; format?: (v: number) => string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="label">{label}</label>
        <span className="num text-[16px] text-fg-0">{format ? format(value) : value} <span className="text-fg-2">{unit}</span></span>
      </div>
      <input id={id} type="range" className="slider" min={min} max={max} step={step} value={value} aria-valuetext={`${format?format(value):value}${unit?' '+unit:''}`} onChange={(e) => onChange(Number(e.target.value))} onKeyDown={(e) => e.stopPropagation()} />
    </div>
  );
}
