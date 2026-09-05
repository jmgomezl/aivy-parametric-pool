import { data } from '../data';
import { Scene } from '../components/Scene';
import { Big, C, Flow, Lock, Node } from '../components/viz';
import { Pill } from '../components/ui';
import { hbar, clock, day } from '../lib/format';
import type { Beat } from './types';

const rec = data.payout;
const agentSig = rec.signatures.find((s) => s.role === 'agent')!;
const poolBefore = data.ledgers.pool.find((t) => t.consensus === rec.executedConsensus)!;
const buyerBefore = data.ledgers.buyer.find((t) => t.scheduled)!;

/** Shared by beats 5 and 6: pool — lock — buyer. */
export function PayoutScene({ oracles, executed, waves }: { oracles: boolean[]; executed: boolean; waves?: React.ReactNode }) {
  const poolBal = executed ? poolBefore.balanceAfter : poolBefore.balanceAfter - poolBefore.delta;
  const buyerBal = executed ? buyerBefore.balanceAfter : buyerBefore.balanceAfter - buyerBefore.delta;
  return (
    <svg viewBox="0 0 1380 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {waves}
      <Node x={200} y={300} label="pool" value={`${hbar(poolBal, 2)} ℏ`} sub={data.accounts.pool.id} />
      <Node x={1180} y={300} label="buyer" value={`${hbar(buyerBal, 2)} ℏ`} sub={data.accounts.buyer.id} tone={executed ? 'ok' : 'neutral'} />
      {/* the scheduled path: drawn, not travelled, until quorum */}
      <Flow x1={254} y1={300} x2={556} y2={300} on={executed} tone="ok" />
      <Flow x1={824} y1={300} x2={1126} y2={300} on={executed} tone="ok" delay={200} />
      {!executed ? (
        <>
          <line x1={254} y1={300} x2={556} y2={300} stroke={C.fg3} strokeWidth={2} strokeDasharray="4 10" />
          <line x1={824} y1={300} x2={1126} y2={300} stroke={C.fg3} strokeWidth={2} strokeDasharray="4 10" />
          <text x={690} y={60} textAnchor="middle" className="label" fill={C.fg2} fontSize={16}>already signed by the agent · waiting for two oracle keys</text>
        </>
      ) : null}
      <Lock
        cx={690} cy={300} r={128}
        agent oracles={oracles} names={data.oracles.map((o) => o.name)}
        state={executed ? 'ok' : 'pending'}
        centre={
          <g style={{ transform: executed ? 'translate(490px, 0)' : 'none', opacity: executed ? 0 : 1, transition: 'transform 600ms var(--ease) 300ms, opacity 200ms var(--ease) 900ms' }}>
            <text x={690} y={292} textAnchor="middle" className="num" fill={executed ? C.ok : C.fg0} fontSize={40}>{hbar(-rec.inner[0].tinybar!, 0)} ℏ</text>
            <text x={690} y={322} textAnchor="middle" className="label" fill={C.fg2} fontSize={15}>{executed ? 'paid' : 'held'}</text>
          </g>
        }
      />
    </svg>
  );
}

function View() {
  return (
    <Scene
      n={5}
      kicker="Stillness"
      title="Nothing is running."
      caption={<>The payout already exists on the ledger, signed by the agent. No contract, no keeper, no cron. It waits for two of three oracle keys.</>}
      hud={
        <>
          <Pill state="pending" lg>pending</Pill>
          <Big label={`agent signed · ${clock(agentSig.at, false)} UTC`} value="✓" tone="ok" />
          <Big label="oracle keys" value={`0 of ${data.quorum.threshold}`} tone="dim" />
          <Big label={`lapses ${day(rec.expiresAt)} if untouched`} value="30" unit="days" />
        </>
      }
      links={[
        { kind: 'schedule', id: rec.scheduleId, label: 'schedule' },
        { kind: 'transaction', id: rec.createTxId, label: 'pre-signed at' },
      ]}
      note={<>memo “{rec.memo}” · watchers: none</>}
    >
      <PayoutScene oracles={[false, false, false]} executed={false} />
    </Scene>
  );
}

export const waiting: Beat = { label: 'The obligation waits', steps: 1, View };
