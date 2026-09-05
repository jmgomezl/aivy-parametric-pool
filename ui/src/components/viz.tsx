// SVG building blocks for the beats. One visual language throughout:
// accounts are nodes, transfers are flows, the scheduled payout is a lock with
// two rings (the agent's, and the 2-of-3 oracle ring). State is the only colour.
import type { ReactNode } from 'react';
import { hbar } from '../lib/format';

export const C = {
  fg0: 'var(--fg-0)', fg1: 'var(--fg-1)', fg2: 'var(--fg-2)', fg3: 'var(--fg-3)',
  line: 'var(--line-strong)', bg1: 'var(--bg-1)', bg2: 'var(--bg-2)', bg3: 'var(--bg-3)',
  ok: 'var(--ok)', pending: 'var(--pending)', refused: 'var(--refused)',
};

const rad = (deg: number) => (deg * Math.PI) / 180;
export const polar = (cx: number, cy: number, r: number, deg: number) => ({ x: cx + r * Math.cos(rad(deg)), y: cy + r * Math.sin(rad(deg)) });

/** Arc path from angle a0 to a1 (degrees, clockwise, 0 = 3 o'clock). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

/* ------------------------------------------------------------------ Node */
export function Node({ x, y, r = 56, label, value, sub, tone = 'neutral', dim = false }: { x: number; y: number; r?: number; label: string; value?: string; sub?: string; tone?: 'neutral' | 'ok' | 'pending' | 'refused'; dim?: boolean }) {
  const stroke = tone === 'neutral' ? C.line : C[tone];
  return (
    <g className="land" style={{ opacity: dim ? 0.35 : 1 }}>
      <circle cx={x} cy={y} r={r} fill={C.bg1} stroke={stroke} strokeWidth={1.5} />
      <text x={x} y={y - (value ? 6 : -6)} textAnchor="middle" className="label" fill={C.fg1} fontSize={16}>{label}</text>
      {value ? <text x={x} y={y + 18} textAnchor="middle" className="num" fill={C.fg0} fontSize={value.length > 9 ? 16 : 20}>{value}</text> : null}
      {sub ? <text x={x} y={y + r + 24} textAnchor="middle" className="num" fill={C.fg2} fontSize={14}>{sub}</text> : null}
    </g>
  );
}

/* ------------------------------------------------------------------ Flow */
/** A transfer between two points. When `on`, the line draws itself in and the amount lands. */
export function Flow({ x1, y1, x2, y2, label, on = true, tone = 'ok', bend = 0, delay = 0, labelOffset = -14, width = 2 }: { x1: number; y1: number; x2: number; y2: number; label?: ReactNode; on?: boolean; tone?: 'ok' | 'neutral' | 'refused' | 'pending'; bend?: number; delay?: number; labelOffset?: number; width?: number }) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len; // normal
  const cx = mx + nx * bend, cy = my + ny * bend;
  const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  const color = tone === 'neutral' ? C.fg2 : C[tone];
  // label sits at the curve's midpoint, offset along the normal
  const lx = 0.25 * x1 + 0.5 * cx + 0.25 * x2 + nx * labelOffset;
  const ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2 + ny * labelOffset;
  const id = `arrow-${tone}`;
  return (
    <g>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <path d={d} fill="none" stroke={C.bg3} strokeWidth={width} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        markerEnd={on ? `url(#${id})` : undefined}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={on ? 0 : 1}
        style={{ transition: `stroke-dashoffset 420ms var(--ease) ${delay}ms` }}
      />
      {label ? (
        <text x={lx} y={ly} textAnchor="middle" className="num land" fill={color} fontSize={17} style={{ opacity: on ? 1 : 0, transitionDelay: `${delay + 200}ms` }}>{label}</text>
      ) : null}
    </g>
  );
}

/* ------------------------------------------------------------------ Lock */
export interface LockProps {
  cx: number; cy: number; r?: number;
  agent: boolean;               // outer ring: the committer's signature
  oracles: boolean[];           // inner ring: k-of-n attesters
  threshold?: number;
  names?: string[];
  state: 'pending' | 'ok' | 'lapsed';
  centre?: ReactNode;           // what is held inside (e.g. the amount)
  agentLabel?: string;
}

/** The pool's key drawn as a lock: outer ring = agent, inner ring = 2 of 3 oracles. */
export function Lock({ cx, cy, r = 128, agent, oracles, threshold = 2, names = [], state, centre, agentLabel = 'agent' }: LockProps) {
  const n = oracles.length;
  const gap = 8; // degrees between oracle segments
  const seg = (360 - n * gap) / n;
  const signed = oracles.filter(Boolean).length;
  const quorum = signed >= threshold;
  const outerR = r, innerR = r - 30;
  const color = state === 'ok' ? C.ok : state === 'lapsed' ? C.refused : C.pending;
  return (
    <g>
      {/* outer: agent (AND branch) */}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={C.bg3} strokeWidth={12} />
      <circle
        cx={cx} cy={cy} r={outerR} fill="none" stroke={agent ? C.ok : 'transparent'} strokeWidth={12}
        pathLength={1} strokeDasharray={1} strokeDashoffset={agent ? 0 : 1} transform={`rotate(-90 ${cx} ${cy})`}
        className="land" style={{ transition: 'stroke-dashoffset 500ms var(--ease)' }}
      />
      {/* inner: oracle segments */}
      {oracles.map((on, i) => {
        const a0 = -90 + i * (seg + gap) + gap / 2;
        const a1 = a0 + seg;
        return (
          <g key={i}>
            <path d={arc(cx, cy, innerR, a0, a1)} fill="none" stroke={C.bg3} strokeWidth={12} />
            <path d={arc(cx, cy, innerR, a0, a1)} fill="none" stroke={C.ok} strokeWidth={12} pathLength={1} strokeDasharray={1} strokeDashoffset={on ? 0 : 1} style={{ transition: `stroke-dashoffset 420ms var(--ease) ${i * 40}ms` }} />
            {names[i] ? (() => {
              const mid = a0 + seg / 2;
              const p = polar(cx, cy, outerR + 40, mid);
              const c = Math.cos(rad(mid));
              const anchor = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
              return <text x={p.x} y={p.y + 5} textAnchor={anchor} className="label land" fill={on ? C.fg0 : C.fg3} fontSize={15}>{names[i]}</text>;
            })() : null}
          </g>
        );
      })}
      {/* centre */}
      <circle cx={cx} cy={cy} r={innerR - 22} fill={C.bg1} stroke={C.line} strokeWidth={1} />
      <g className="land">
        {centre}
      </g>
      {/* legend: outer / inner */}
      <text x={cx} y={cy + outerR + 66} textAnchor="middle" className="label" fill={C.fg2} fontSize={15}>
        <tspan fill={agent ? C.ok : C.fg2}>{agentLabel} {agent ? '✓' : '—'}</tspan>
        <tspan fill={C.fg3}>   ·   </tspan>
        <tspan fill={quorum ? C.ok : C.fg2}>oracles {signed} of {threshold}</tspan>
        <tspan fill={C.fg3}>   ·   </tspan>
        <tspan fill={color}>{state === 'ok' ? 'executed' : state === 'lapsed' ? 'lapsed' : 'pending'}</tspan>
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ Tank */
/** Pool capital as a vessel; the promise drawn as a level line it must reach. */
export function Tank({ x, y, w = 200, h = 380, capital, promise, max, ok, label = 'pool capital' }: { x: number; y: number; w?: number; h?: number; capital: number; promise: number; max: number; ok: boolean; label?: string }) {
  const capH = (capital / max) * h;
  const promH = (promise / max) * h;
  const shortH = Math.max(0, promH - capH);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={C.bg1} stroke={C.line} strokeWidth={1.5} />
      {/* capital fill */}
      <rect x={x + 1} y={y + h - capH} width={w - 2} height={capH} rx={10} fill={ok ? 'rgba(63,207,142,0.22)' : 'rgba(174,179,188,0.16)'} className="land" style={{ transition: 'all 500ms var(--ease)' }} />
      <rect x={x + 1} y={y + h - capH} width={w - 2} height={2} fill={ok ? C.ok : C.fg1} style={{ transition: 'all 500ms var(--ease)' }} />
      {/* shortfall */}
      {!ok && shortH > 0 ? (
        <rect x={x + 1} y={y + h - promH} width={w - 2} height={shortH} fill="url(#hatch)" className="land" />
      ) : null}
      {/* promise line */}
      <line x1={x - 24} x2={x + w + 24} y1={y + h - promH} y2={y + h - promH} stroke={ok ? C.ok : C.refused} strokeWidth={2} strokeDasharray="6 6" />
      <text x={x + w + 32} y={y + h - promH + 5} className="num" fill={ok ? C.ok : C.refused} fontSize={17}>promise {hbar(promise, 2)} ℏ</text>
      <text x={x - 32} y={y + h - capH + 5} textAnchor="end" className="num" fill={C.fg0} fontSize={17} style={{ transition: 'all 500ms var(--ease)' }}>{hbar(capital, 2)} ℏ</text>
      <text x={x + w / 2} y={y + h + 34} textAnchor="middle" className="label" fill={C.fg2} fontSize={16}>{label}</text>
      <defs>
        <pattern id="hatch" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(240,85,91,0.55)" strokeWidth="3" />
        </pattern>
      </defs>
    </g>
  );
}

/* ----------------------------------------------------------------- Waves */
/** Seismic rings expanding once from a point. */
export function Waves({ cx, cy, on }: { cx: number; cy: number; on: boolean }) {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={cx} cy={cy} r={18} fill="none" stroke={C.pending} strokeWidth={2} className={on ? 'wave' : ''} style={{ animationDelay: `${i * 220}ms`, opacity: on ? undefined : 0, transformOrigin: `${cx}px ${cy}px` }} />
      ))}
      <circle cx={cx} cy={cy} r={6} fill={on ? C.pending : C.fg3} className="land" />
      <text x={cx} y={cy + 26} textAnchor="middle" className="label" fill={on ? C.pending : C.fg3} fontSize={14}>M6+ event observed</text>
    </g>
  );
}

/* ------------------------------------------------------------- BigNumber */
export function Big({ label, value, unit, tone = 'neutral', size = 44, after }: { label: string; value: string; unit?: string; tone?: 'neutral' | 'ok' | 'pending' | 'refused' | 'dim'; size?: number; after?: ReactNode }) {
  const color = tone === 'neutral' ? 'text-fg-0' : tone === 'dim' ? 'text-fg-2' : `text-${tone}`;
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="label">{label}</div>
      <div className={`num leading-none ${color} whitespace-nowrap`} style={{ fontSize: size, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum"' }}>
        {value}{unit ? <span className="text-fg-2 ml-[0.25em]" style={{ fontSize: size * 0.6 }}>{unit}</span> : null}
      </div>
      {after ? <div className="leading-none">{after}</div> : null}
    </div>
  );
}

/** A modest year-over-year arrow: up is red (dearer), down is green (cheaper). */
export function Delta({ now, before, size = 14 }: { now: number; before: number; size?: number }) {
  if (before === 0 && now === 0) return null;
  if (before === 0) return <span className="num text-refused" style={{ fontSize: size, letterSpacing: 0 }} title="first event in range">▲ new · first event nearby</span>;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.05) return <span className="num text-fg-3" style={{ fontSize: size, letterSpacing: 0 }} title="no change on a year ago">— unchanged in a year</span>;
  const up = pct > 0;
  return (
    <span className={`num ${up ? 'text-refused' : 'text-ok'}`} style={{ fontSize: size, letterSpacing: 0 }} title={`${up ? 'up' : 'down'} on a year ago`}>
      {up ? '▲' : '▼'} {Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)} % <span className="text-fg-3">in a year</span>
    </span>
  );
}
