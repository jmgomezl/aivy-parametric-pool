import { useMemo } from 'react';
import { C } from '../components/viz';
import { MODEL, priceHistory, type PriceOpts, type Priced } from '../lib/hazard';

/** What the same cover would have cost at the start of each year, on the frozen record. */
export function History({ nearby, opts, markYear, width = 380, normalize = false }: { nearby: Priced['nearby']; opts: PriceOpts; markYear: number; width?: number; normalize?: boolean }) {
  const raw = useMemo(() => priceHistory(nearby, opts), [nearby, opts]);
  const series = useMemo(() => {
    if (!normalize) return raw;
    const last = raw.at(-1)?.premiumHbar || 1;
    return raw.map((s) => ({ ...s, premiumHbar: (s.premiumHbar / last) * 100 }));
  }, [raw, normalize]);
  const w = width, h = 96, pad = 4;
  const max = Math.max(1e-9, ...series.map((s) => s.premiumHbar));
  const y0 = series[0].year, yN = series.at(-1)!.year;
  const x = (yr: number) => pad + ((yr - y0) / (yN - y0)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2 - 14);
  const d = series.map((s, i) => `${i ? 'L' : 'M'}${x(s.year).toFixed(1)} ${y(s.premiumHbar).toFixed(1)}`).join('');
  const at = series.find((s) => s.year === Math.max(y0, Math.min(yN, markYear))) ?? series.at(-1)!;
  const minMag = opts.minMag ?? MODEL.minMagnitude;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ aspectRatio: `${w} / ${h}` }}>
      <path d={`${d}L${x(yN)} ${h - pad}L${x(y0)} ${h - pad}Z`} fill="rgba(242,243,245,0.05)" />
      <path d={d} fill="none" stroke={C.fg0} strokeWidth={1.5} />
      {nearby.map((q, i) => {
        const dt = new Date(q.day * 86400000);
        const yr = dt.getUTCFullYear() + dt.getUTCMonth() / 12;
        if (yr < y0 || q.mag < minMag) return null;
        return <line key={i} x1={x(yr)} x2={x(yr)} y1={h - pad} y2={h - pad - 5 - (q.mag - 6) * 6} stroke={C.pending} strokeWidth={1.5} />;
      })}
      {markYear < yN ? <line x1={x(at.year)} x2={x(at.year)} y1={2} y2={h - pad} stroke={C.fg2} strokeDasharray="2 3" /> : null}
      <circle cx={x(at.year)} cy={y(at.premiumHbar)} r={3.5} fill={C.ok} />
      <text x={pad} y={11} className="num" fill={C.fg3} fontSize={11}>{y0}</text>
      <text x={w - pad} y={11} textAnchor="end" className="num" fill={C.fg3} fontSize={11}>{yN}</text>
    </svg>
  );
}

export function Slider({ label, value, min, max, step = 1, unit, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="num text-[16px] text-fg-0">{format ? format(value) : value} <span className="text-fg-2">{unit}</span></span>
      </div>
      <input type="range" className="slider" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} onKeyDown={(e) => e.stopPropagation()} />
    </div>
  );
}
