// A policy is a destination. Its live state is the same ring as beat 05,
// holding this visitor's payout, and under it the proof that nobody else can.
import { useEffect, useState } from 'react';
import * as agent from '../lib/agent';
import { Big, C, Lock } from '../components/viz';
import { Id, Pill } from '../components/ui';
import { placeName } from '../lib/hazard';
import { hsPointer } from '../lib/hashscan';
import { fetchSchedule, useLive } from '../lib/mirror';
import { onLink } from '../lib/router';
import { mine, useAgent } from '../lib/store';
import { OracleProof } from './OracleProof';

const usd = (n: number, d = 2) => `$${n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

export function PolicyPage({ serial }: { serial: string }) {
  const a = useAgent();
  const [state, setState] = useState<{ at: 'loading' } | { at: 'ok'; p: agent.Policy } | { at: 'missing'; message: string }>({ at: 'loading' });
  const [proof, setProof] = useState(false);

  useEffect(() => {
    if (!a.checked) return;
    if (!a.online) { setState({ at: 'missing', message: 'The agent is offline, and policies live in its book.' }); return; }
    let live = true;
    agent.policy(serial).then((r) => {
      if (!live) return;
      if ('ok' in r && r.ok === false) setState({ at: 'missing', message: r.message });
      else setState({ at: 'ok', p: r as agent.Policy });
    }).catch(() => live && setState({ at: 'missing', message: 'The agent did not answer.' }));
    return () => { live = false; };
  }, [serial, a.checked, a.online]);

  const p = state.at === 'ok' ? state.p : null;
  const net = a.network;
  const sched = useLive(() => (p ? fetchSchedule(p.scheduleId, net) : Promise.reject(new Error('no policy'))), [p?.scheduleId, net]);

  if (state.at === 'loading') return <Frame><div className="label">loading policy #{serial}…</div></Frame>;
  if (state.at === 'missing') return (
    <Frame>
      <div className="flex flex-col gap-[14px]">
        <Pill state="refused">not found</Pill>
        <div className="text-[22px] text-fg-0">No policy #{serial}.</div>
        <p className="text-fg-1 max-w-[52ch]">{state.message}</p>
        <a href="/policies" onClick={onLink} className="hs label self-start">all policies<span className="arrow">→</span></a>
      </div>
    </Frame>
  );

  const pol = p!;
  const executed = sched.status === 'ok' ? sched.data.executedAt : pol.settled ? pol.executedAt ?? 'yes' : null;
  const lapsed = !executed && new Date(pol.lapsesAt).getTime() < Date.now();
  const oracleSigs = sched.status === 'ok' ? Math.max(0, Math.min(3, sched.data.signatures - 1)) : 0;
  const stateName = executed ? 'paid' : lapsed ? 'lapsed' : 'awaiting quorum';
  const tone = executed ? 'ok' : lapsed ? 'refused' : 'pending';
  const yours = mine().includes(String(pol.serial));

  return (
    <Frame>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[56px] items-start">
        <div className="flex flex-col gap-[26px]">
          <div className="flex flex-col gap-[10px]">
            <div className="kicker">policy #{pol.serial}{yours ? ' · yours' : ''}</div>
            <h1 className="title" style={{ fontSize: 44 }}>{placeName(pol)}</h1>
            <div className="flex items-center gap-[12px]">
              <Pill state={tone as 'ok' | 'refused' | 'pending'} lg>{stateName}</Pill>
              <span className="label">{executed ? `executed ${typeof executed === 'string' && executed !== 'yes' ? executed.slice(0, 19).replace('T', ' ') + ' UTC' : ''}` : lapsed ? `window closed ${pol.lapsesAt.slice(0, 10)}` : `${daysLeft(pol.lapsesAt)} days left · lapses ${pol.lapsesAt.slice(0, 10)}`}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-[24px] gap-y-[18px]">
            <Big label="premium paid" value={usd(pol.premiumUsd)} size={30} />
            <Big label="cover" value={usd(pol.payoutUsd, 0)} size={30} tone="ok" />
            <Big label="settles as" value={agent.payoutLabel(pol)} size={22} tone="dim" />
            <Big label="trigger" value="M6+ · 100 km" size={22} tone="dim" />
          </div>

          <div className="flex flex-col">
            <Row k="beneficiary"><Id kind="account" id={pol.buyerId} size="sm" network={net} /></Row>
            <Row k="payout · pre-signed schedule"><Id kind="schedule" id={pol.scheduleId} size="sm" network={net} /></Row>
            <Row k="premium · atomic transfer"><Id kind="transaction" id={pol.saleTxId} size="sm" network={net} /></Row>
            <Row k="terms · on HCS"><Id kind="topic" id={pol.termsPointer} href={hsPointer(pol.termsPointer, net)} size="sm" network={net} /></Row>
            <Row k="mirror node">
              <span className="label num">{sched.status === 'ok' ? `${sched.data.signatures} signatures · executed ${sched.data.executedAt ? 'yes' : 'no'}` : sched.status === 'loading' ? 'checking…' : 'unavailable'}</span>
            </Row>
          </div>
        </div>

        <div className="flex flex-col items-center gap-[10px]">
          <svg viewBox="0 0 520 400" width="100%" style={{ maxWidth: 520 }}>
            <Lock
              cx={260} cy={190} r={120}
              agent oracles={[oracleSigs >= 1, oracleSigs >= 2, oracleSigs >= 3]} threshold={2}
              names={['SGC', 'USGS ComCat', 'EMSC']}
              state={executed ? 'ok' : lapsed ? 'lapsed' : 'pending'}
              centre={
                <g>
                  <text x={260} y={184} textAnchor="middle" className="num" fill={executed ? C.ok : C.fg0} fontSize={30}>{agent.payoutLabel(pol)}</text>
                  <text x={260} y={210} textAnchor="middle" className="label" fill={C.fg2} fontSize={13}>{executed ? 'paid' : lapsed ? 'never claimed' : 'held for you'}</text>
                </g>
              }
            />
          </svg>
          <div className="label num">watchers: none · no contract · no keeper</div>
        </div>
      </div>

      <div className="mt-[40px] border-t border-line pt-[22px]">
        <button type="button" className="flex items-center gap-[14px] text-left" onClick={() => setProof((v) => !v)}>
          <span className="num text-fg-2">{proof ? '−' : '+'}</span>
          <span className="text-[19px] text-fg-0">Can the oracles steal this?</span>
          <span className="label">two real schedules, Hedera mainnet</span>
        </button>
        {proof ? <div className="mt-[22px]"><OracleProof /></div> : null}
      </div>
    </Frame>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-[16px] py-[8px] border-b border-line last:border-b-0">
      <span className="label">{k}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="page"><div className="page-inner">{children}</div></div>;
}
