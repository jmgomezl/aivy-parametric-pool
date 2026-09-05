import { data, type ScheduleRecord } from '../data';
import { Scene } from '../components/Scene';
import { Big, C, Flow, Lock, Node } from '../components/viz';
import { Pill } from '../components/ui';
import { clock, hbar } from '../lib/format';
import { fetchSchedule, useLive } from '../lib/mirror';
import type { Beat } from './types';

const adv = data.adversarial;
const ctl = data.control;
const advSigs = adv.signatures.filter((s) => s.role === 'oracle');
const names = data.oracles.map((o) => o.name);
const amountOf = (r: ScheduleRecord) => Math.abs(Math.min(...r.inner.map((l) => l.tinybar ?? 0)));

function View({ step }: { step: number }) {
  const shown = Math.min(step, 3);
  const lapsed = shown >= 3;
  const live = useLive(() => fetchSchedule(adv.scheduleId), []);
  const advOracles = data.oracles.map((_, i) => advSigs.slice(0, shown).some((s) => s.index === i));
  return (
    <Scene
      n={8}
      kicker="Proof"
      title={lapsed ? 'Three keys. No agent. Nothing moved.' : 'The oracles are not custodians.'}
      caption={<>An outsider scheduled a {hbar(amountOf(adv), 0)} ℏ drain from the pool and collected every oracle signature there is. Without the agent's ring, the lock never opens.</>}
      hud={
        <>
          <Pill state={lapsed ? 'refused' : 'pending'} lg>{lapsed ? 'lapsed · never executed' : 'pending'}</Pill>
          <Big label="oracle keys on the drain" value={`${shown} of 3`} tone={shown === 3 ? 'refused' : 'neutral'} />
          <Big label="moved out of the pool" value="0" unit="ℏ" />
          <Big label={`control · agent + 2 oracles · executed ${ctl.executedAt ? clock(ctl.executedAt, false) : ''}`} value={`${hbar(amountOf(ctl), 0)} ℏ`} tone="ok" size={34} />
        </>
      }
      links={[
        { kind: 'schedule', id: adv.scheduleId, label: 'the drain' },
        { kind: 'schedule', id: ctl.scheduleId, label: 'control' },
        ...advSigs.slice(0, shown).map((s, i) => ({ kind: 'transaction' as const, id: s.txId, label: `key ${i + 1}` })),
      ]}
      note={
        step < 3
          ? <>press <kbd>→</kbd> to turn oracle key {shown + 1} of 3</>
          : live.status === 'ok'
            ? <span className={live.data.executedAt === null ? 'text-ok' : 'text-pending'}>mirror node: executed_timestamp {live.data.executedAt ?? 'null'} · {live.data.signatures} signatures on record</span>
            : live.status === 'loading' ? 'checking mirror node…' : <span className="text-pending">mirror node unavailable</span>
      }
    >
      <svg viewBox="0 0 1380 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <text x={360} y={40} textAnchor="middle" className="label" fill={C.fg2} fontSize={16}>with the agent's signature</text>
        <Lock cx={360} cy={270} r={110} agent oracles={[true, true, false]} names={names} state="ok" centre={<>
          <text x={360} y={264} textAnchor="middle" className="num" fill={C.ok} fontSize={34}>{hbar(amountOf(ctl), 0)} ℏ</text>
          <text x={360} y={292} textAnchor="middle" className="label" fill={C.fg2} fontSize={14}>moved</text>
        </>} />
        <Node x={620} y={270} r={40} label="agent" tone="ok" />
        <Flow x1={472} y1={270} x2={578} y2={270} />

        <line x1={690} y1={60} x2={690} y2={540} stroke={C.line} strokeDasharray="4 8" />

        <text x={1020} y={40} textAnchor="middle" className="label" fill={C.fg2} fontSize={16}>without it · all three oracles</text>
        <Lock cx={1020} cy={270} r={110} agent={false} oracles={advOracles} names={names} state={lapsed ? 'lapsed' : 'pending'} centre={<>
          <text x={1020} y={264} textAnchor="middle" className="num" fill={lapsed ? C.refused : C.fg0} fontSize={34}>{hbar(amountOf(adv), 0)} ℏ</text>
          <text x={1020} y={292} textAnchor="middle" className="label" fill={C.fg2} fontSize={14}>{lapsed ? 'never left' : 'held'}</text>
        </>} />
        <Node x={1280} y={270} r={40} label="outsider" dim />
        <Flow x1={1132} y1={270} x2={1238} y2={270} on={false} />
        <line x1={1132} y1={270} x2={1238} y2={270} stroke={lapsed ? C.refused : C.fg3} strokeWidth={2} strokeDasharray="4 10" className="land" />
        {shown > 0 ? (
          <text x={1020} y={520} textAnchor="middle" className="num land" fill={C.fg2} fontSize={15}>
            {advSigs.slice(0, shown).map((s) => `${s.name} ${clock(s.at, false)}`).join('   ·   ')}
          </text>
        ) : null}
      </svg>
    </Scene>
  );
}

export const coda: Beat = { label: 'Not custodians', steps: 4, View };
