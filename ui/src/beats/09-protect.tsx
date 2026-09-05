// Buy one, live.
//
// Everything before this beat is a record of a run that already happened. Here
// the agent is asked, now, for a place the viewer chose — and if it says yes, a
// policy is actually written to the ledger while they watch.
//
// The last state is deliberately not a receipt. It is the same ring as beat 05:
// a payout that exists, is signed by the agent, and is waiting for two oracle
// keys. The proof stops being a slide about the mechanism and becomes the state
// of the viewer's own contract.
import { useCallback, useEffect, useState } from 'react';
import { Scene } from '../components/Scene';
import { Big, C, Lock } from '../components/viz';
import { Pill } from '../components/ui';
import { hbar } from '../lib/format';
import { PLACES, placeName } from '../lib/hazard';
import * as agent from '../lib/agent';
import type { Beat } from './types';

type Phase =
  | { at: 'offline' }
  | { at: 'quoting' }
  | { at: 'quoted'; quote: agent.Quote }
  | { at: 'declined'; refusal: agent.Refusal }
  | { at: 'issuing'; quote: agent.Quote; step: number }
  | { at: 'held'; issued: agent.Issued };

const STEPS = ['terms to HCS', 'policy minted', 'premium settled', 'payout scheduled'];

/** Name a pin by the nearest place we know, so the title reads like somewhere real. */
function readPin(): { lat: number; lon: number; name?: string } {
  const m = /@(-?[\d.]+),(-?[\d.]+)/.exec(window.location.hash);
  if (!m) return PLACES[0]!;
  const lat = Number(m[1]), lon = Number(m[2]);
  const near = PLACES.map((p) => ({ p, d: Math.hypot(p.lat - lat, p.lon - lon) })).sort((a, b) => a.d - b.d)[0];
  return near && near.d < 0.75 ? { lat, lon, name: near.p.name } : { lat, lon };
}

function View() {
  const [pin, setPin] = useState(readPin);
  const [phase, setPhase] = useState<Phase>({ at: 'quoting' });
  const [pool, setPool] = useState<agent.Pool | null>(null);

  useEffect(() => {
    const onHash = () => setPin(readPin());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Quote whenever the pin moves. Free, so it can run on every change.
  useEffect(() => {
    let live = true;
    setPhase({ at: 'quoting' });
    (async () => {
      if (!(await agent.reachable())) { if (live) setPhase({ at: 'offline' }); return; }
      const [q, p] = await Promise.all([agent.quote(pin.lat, pin.lon), agent.pool().catch(() => null)]);
      if (!live) return;
      setPool(p);
      setPhase(q.ok ? { at: 'quoted', quote: q as agent.Quote } : { at: 'declined', refusal: q as agent.Refusal });
    })();
    return () => { live = false; };
  }, [pin.lat, pin.lon]);

  const buy = useCallback(async () => {
    if (phase.at !== 'quoted') return;
    const quote = phase.quote;
    setPhase({ at: 'issuing', quote, step: 0 });
    // The agent does these four in order; walking the labels keeps the wait honest
    // about what is happening rather than showing an indeterminate spinner.
    const tick = setInterval(() => setPhase((p) => (p.at === 'issuing' ? { ...p, step: Math.min(p.step + 1, STEPS.length - 1) } : p)), 1400);
    const result = await agent.buy({ lat: pin.lat, lon: pin.lon, place: pin.name ?? null });
    clearInterval(tick);
    setPhase(result.ok ? { at: 'held', issued: result as agent.Issued } : { at: 'declined', refusal: result as agent.Refusal });
    agent.pool().then(setPool).catch(() => {});
  }, [phase, pin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'b' && phase.at === 'quoted') { e.preventDefault(); void buy(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [buy, phase.at]);

  const where = pin.name ?? placeName(pin);
  const q = phase.at === 'quoted' ? phase.quote : phase.at === 'issuing' ? phase.quote : phase.at === 'held' ? phase.issued.quote : null;

  return (
    <Scene
      n={9}
      kicker="Live"
      title={
        phase.at === 'held' ? 'Your payout is on the ledger, waiting.'
        : phase.at === 'declined' ? 'The agent declined.'
        : phase.at === 'offline' ? 'The agent is not answering.'
        : `Protect ${where}.`
      }
      caption={
        phase.at === 'held'
          ? <>Nothing is running. It needs two of three oracle keys, and until they arrive it simply sits there.</>
        : phase.at === 'declined'
          ? <>{phase.refusal.message}</>
        : phase.at === 'offline'
          ? <>Start it with <span className="num">npm run serve</span>. Every other beat reads a record and still works.</>
          : <>The agent prices this point from the live record and, if it will underwrite it, writes the policy now.</>
      }
      hud={
        <>
          <Pill state={phase.at === 'held' ? 'pending' : phase.at === 'declined' ? 'refused' : 'ok'} lg>
            {phase.at === 'held' ? 'awaiting quorum' : phase.at === 'declined' ? phase.refusal.reason.replace(/_/g, ' ') : phase.at === 'issuing' ? 'writing' : 'quoted'}
          </Pill>
          {q ? (
            <>
              <Big label="premium" value={`$${q.premium.toFixed(2)}`} tone="ok" />
              <Big label="buys cover of" value={`$${Math.round(q.payout).toLocaleString()}`} />
              <Big label="settles on-chain" value={hbar(q.settled.payoutHbar * 1e8, 2)} unit="ℏ" size={30} tone="dim" />
            </>
          ) : null}
          {pool && phase.at !== 'held' ? (
            <Big label="pool headroom" value={pool.headroomHbar.toFixed(1)} unit="ℏ" size={26} tone="dim" />
          ) : null}
        </>
      }
      links={
        phase.at === 'held'
          ? [
              { kind: 'schedule' as const, id: phase.issued.policy.scheduleId, label: 'the payout' },
              { kind: 'transaction' as const, id: phase.issued.policy.saleTxId, label: 'the premium' },
            ]
          : []
      }
      note={phase.at === 'held' ? 'watchers: none' : phase.at === 'quoted' ? 'press B to buy' : undefined}
      verifyLabel={phase.at === 'held' ? 'verify on HashScan' : ''}
    >
      <div className="grid h-full place-items-center">
        {phase.at === 'held' ? (
          <svg viewBox="0 0 520 380" className="h-full w-full">
            <Lock
              cx={260} cy={190} r={110}
              agent oracles={[false, false, false]} threshold={2}
              names={['SGC', 'USGS ComCat', 'EMSC']}
              state="pending"
              centre={
                <g>
                  <text x={260} y={186} textAnchor="middle" className="num" fill={C.fg0} fontSize={34}>
                    {hbar(phase.issued.policy.payoutHbar * 1e8, 2)} ℏ
                  </text>
                  <text x={260} y={212} textAnchor="middle" className="label" fill={C.fg2} fontSize={13}>held for you</text>
                </g>
              }
            />
          </svg>
        ) : phase.at === 'issuing' ? (
          <div className="flex flex-col gap-[18px]">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-[16px] text-[19px]">
                <span className={i <= phase.step ? 'text-ok' : 'text-fg-3'}>{i < phase.step ? '✓' : i === phase.step ? '•' : '·'}</span>
                <span className={i <= phase.step ? 'text-fg-0' : 'text-fg-3'}>{s}</span>
              </div>
            ))}
          </div>
        ) : phase.at === 'quoted' ? (
          <button
            type="button"
            onClick={buy}
            className="group flex flex-col items-center gap-[18px] rounded-[14px] px-[64px] py-[46px] transition-colors"
            style={{ border: `1px solid ${C.ok}`, background: 'transparent', cursor: 'pointer' }}
          >
            <span className="num" style={{ fontSize: 46, color: C.ok, letterSpacing: '-0.02em' }}>
              ${phase.quote.premium.toFixed(2)}
            </span>
            <span className="label" style={{ fontSize: 15 }}>
              protect this place for {phase.quote.days} days
            </span>
          </button>
        ) : (
          <div className="label">{phase.at === 'quoting' ? 'asking the agent…' : ''}</div>
        )}
      </div>
    </Scene>
  );
}

export const protect: Beat = { label: 'Buy one, live', steps: 1, View };
