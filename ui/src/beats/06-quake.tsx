import { data } from '../data';
import { Scene } from '../components/Scene';
import { Big, Waves } from '../components/viz';
import { Pill } from '../components/ui';
import { clock, between } from '../lib/format';
import { fetchSchedule, useLive } from '../lib/mirror';
import { PayoutScene } from './05-waiting';
import type { Beat } from './types';

const rec = data.payout;
const sigs = rec.signatures.filter((s) => s.role === 'oracle');

function View({ step }: { step: number }) {
  const live = useLive(() => fetchSchedule(rec.scheduleId), []);
  const oracles = data.oracles.map((_, i) => sigs.slice(0, step).some((s) => s.index === i));
  const executed = step >= 2;
  return (
    <Scene
      n={6}
      kicker="Trigger"
      title={step === 0 ? 'A quake. The oracles look.' : step === 1 ? 'One key turned. Still locked.' : 'Two keys. It executes itself.'}
      caption={<>Each oracle signs the same waiting transaction from its own key. They never speak to each other. The network counts to two.</>}
      hud={
        <>
          <Pill state={executed ? 'ok' : 'pending'} lg>{executed ? 'executed' : 'pending'}</Pill>
          <Big label={`${sigs[0].name} · oracle 1`} value={step >= 1 ? clock(sigs[0].at) : '—'} tone={step >= 1 ? 'ok' : 'dim'} size={34} />
          <Big label={`${sigs[1].name} · oracle 2 · ${between(sigs[0].at, sigs[1].at)} later`} value={step >= 2 ? clock(sigs[1].at) : '—'} tone={step >= 2 ? 'ok' : 'dim'} size={34} />
          <Big label="executed by the network" value={executed && rec.executedAt ? clock(rec.executedAt) : '—'} tone={executed ? 'ok' : 'dim'} size={34} />
        </>
      }
      links={[
        { kind: 'schedule', id: rec.scheduleId, label: 'schedule' },
        ...(step >= 1 ? [{ kind: 'transaction' as const, id: sigs[0].txId, label: 'sign 1' }] : []),
        ...(step >= 2 ? [{ kind: 'transaction' as const, id: sigs[1].txId, label: 'sign 2' }, { kind: 'transaction' as const, id: rec.executedConsensus!, label: 'payout' }] : []),
      ]}
      note={
        step < 2
          ? <>press <kbd>→</kbd> for the {step === 0 ? 'first' : 'second'} oracle</>
          : live.status === 'ok'
            ? <span className={live.data.executedAt === rec.executedAt ? 'text-ok' : 'text-pending'}>mirror node: executed_timestamp {live.data.executedAt ? clock(live.data.executedAt) : 'null'}</span>
            : live.status === 'loading' ? 'checking mirror node…' : <span className="text-pending">mirror node unavailable</span>
      }
    >
      <PayoutScene oracles={oracles} executed={executed} waves={<Waves cx={690} cy={72} on={step === 0} />} />
    </Scene>
  );
}

export const quake: Beat = { label: 'The quake', steps: 3, View };
