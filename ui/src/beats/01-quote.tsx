import { data } from '../data';
import { Scene } from '../components/Scene';
import { Big, C } from '../components/viz';
import { useLive } from '../lib/mirror';
import { recount, type UsgsEvent } from '../lib/usgs';
import { hsTopicMessage } from '../lib/hashscan';
import type { Beat } from './types';

const q = data.quote;
const h = q.hazard;
const P = 1 - Math.exp(-h.lambda * (q.days / 365.25));
const premiumTinybar = Math.round(q.premiumHbar * 1e8);

// The hazard field: a polar plot centred on the insured point. Outer ring is the
// reference region the rate is estimated over, inner ring the trigger circle.
const CX = 470, CY = 300, KM = 250 / h.referenceRadiusKm; // px per km
function project(e: UsgsEvent) {
  const dx = (e.lon - q.location.lon) * Math.cos((q.location.lat * Math.PI) / 180) * 111.32;
  const dy = (e.lat - q.location.lat) * 111.32;
  return { x: CX + dx * KM, y: CY - dy * KM, km: Math.hypot(dx, dy) };
}

function View() {
  const live = useLive(() => recount(h.source), []);
  const events = live.status === 'ok' ? live.data.events : [];
  return (
    <Scene
      n={1}
      kicker="Quote"
      title="Priced from 56 years of earthquakes."
      caption={<>{h.count} shallow M{q.trigger.minMagnitude}+ events within {h.referenceRadiusKm} km of Armenia, Quindío since {h.since.slice(0, 4)}. One of them was inside the trigger circle.</>}
      hud={
        <>
          <Big label={`events · ${h.years.toFixed(1)} years of record`} value={String(h.count)} />
          <Big label="annual rate λ · inside 100 km" value={h.lambda.toFixed(4)} unit="/ yr" />
          <Big label={`chance of one in ${q.days} days`} value={(P * 100).toFixed(2)} unit="%" />
          <Big label={`premium · for ${q.payoutHbar} ℏ of cover`} value={(premiumTinybar / 1e8).toFixed(4)} unit="ℏ" tone="ok" />
        </>
      }
      links={[
        { kind: 'topic', id: data.terms.topicId, label: 'terms on HCS', href: hsTopicMessage(data.terms.topicId, 1) },
        { kind: 'token', id: data.policy.tokenId, label: 'policy' },
      ]}
      note={live.status === 'ok' ? <span className={live.data.count === h.count ? 'text-ok' : 'text-pending'}>USGS live recount: {live.data.count} events{live.data.count === h.count ? ' · matches the issued terms' : ` · issued terms counted ${h.count}`}</span> : live.status === 'loading' ? 'counting the USGS catalogue…' : <span className="text-pending">USGS catalogue unavailable · showing the count recorded on HCS</span>}
    >
      <svg viewBox="0 0 1380 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {[100, 200, 300].map((km) => (
          <circle key={km} cx={CX} cy={CY} r={km * KM} fill="none" stroke={km === 300 ? C.line : 'rgba(255,255,255,0.05)'} strokeWidth={km === 300 ? 1.5 : 1} />
        ))}
        <circle cx={CX} cy={CY} r={h.triggerRadiusKm * KM} fill="rgba(227,179,65,0.06)" stroke={C.pending} strokeWidth={1.5} />
        <text x={CX} y={CY - h.triggerRadiusKm * KM - 12} textAnchor="middle" className="label" fill={C.pending} fontSize={15}>trigger · {h.triggerRadiusKm} km</text>
        <text x={CX} y={CY - h.referenceRadiusKm * KM - 12} textAnchor="middle" className="label" fill={C.fg2} fontSize={15}>reference region · {h.referenceRadiusKm} km</text>
        <circle cx={CX} cy={CY} r={5} fill={C.fg0} />
        <text x={CX} y={CY + 26} textAnchor="middle" className="label" fill={C.fg1} fontSize={15}>Armenia, Quindío</text>
        {events.map((e, i) => {
          const p = project(e);
          const inside = p.km <= h.triggerRadiusKm;
          const r = 4 + Math.max(0, e.mag - 6) * 7;
          return (
            <g key={e.id} className="count" style={{ animationDelay: `${i * 35}ms` }}>
              <circle cx={p.x} cy={p.y} r={r} fill={inside ? 'rgba(227,179,65,0.35)' : 'rgba(242,243,245,0.14)'} stroke={inside ? C.pending : C.fg1} strokeWidth={1.5} />
              {inside ? <text x={p.x} y={p.y - r - 8} textAnchor="middle" className="num" fill={C.pending} fontSize={15}>{e.time.slice(0, 4)} · M {e.mag.toFixed(1)}</text> : null}
            </g>
          );
        })}
        {live.status === 'unavailable' ? <text x={CX} y={CY + 300 * KM + 40} textAnchor="middle" className="label" fill={C.fg3} fontSize={15}>event positions unavailable</text> : null}
        <g transform="translate(860 150)">
          <text x={0} y={0} className="label" fill={C.fg2} fontSize={15}>how the price is built</text>
          {[
            [`${h.count} events ÷ ${h.years.toFixed(1)} yr ÷ area of ${h.referenceRadiusKm} km`, `${h.density.toExponential(2).replace('e-', ' × 10⁻')} / yr / km²`],
            [`× area of ${h.triggerRadiusKm} km`, `λ = ${h.lambda.toFixed(4)} / yr`],
            [`1 − e^(−λ · ${q.days} / 365.25)`, `P = ${(P * 100).toFixed(3)} %`],
            [`${q.payoutHbar} ℏ × P ÷ ${q.lossRatio} loss ratio`, `${(premiumTinybar / 1e8).toFixed(8)} ℏ`],
          ].map(([l, v], i) => (
            <g key={i} transform={`translate(0 ${40 + i * 92})`}>
              <circle cx={0} cy={0} r={4} fill={i === 3 ? C.ok : C.fg2} />
              {i < 3 ? <line x1={0} y1={6} x2={0} y2={86} stroke={C.line} strokeWidth={1.5} /> : null}
              <text x={20} y={-4} className="label" fill={C.fg2} fontSize={15}>{l}</text>
              <text x={20} y={26} className="num" fill={i === 3 ? C.ok : C.fg0} fontSize={22}>{v}</text>
            </g>
          ))}
        </g>
      </svg>
    </Scene>
  );
}

export const quote: Beat = { label: 'Quote', steps: 1, View };
