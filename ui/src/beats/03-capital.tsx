import { data } from '../data';
import { Scene } from '../components/Scene';
import { Big, C, Flow, Node, Tank } from '../components/viz';
import { Pill } from '../components/ui';
import { hbar, clock } from '../lib/format';
import type { Beat } from './types';

const d = data.deposits.d3;
const before = data.guard.before;
const after = data.guard.after;
const MAX = 6.6e8;

function View({ step }: { step: number }) {
  const g = step >= 1 ? after : before;
  return (
    <Scene
      n={3}
      kicker="Capital"
      title={step === 0 ? 'Capital arrives.' : 'Now it can.'}
      caption={<>One transaction: {hbar(d.hbarTinybar, 0)} ℏ into the pool, {hbar(d.shareUnits, 0)} shares back to the LP. Both legs, or neither.</>}
      hud={
        <>
          <Pill state={g.ok ? 'ok' : 'refused'} lg>{g.ok ? 'allowed' : 'refused'}</Pill>
          <Big label="pool capital" value={hbar(g.capitalTinybar, 2)} unit="ℏ" />
          <Big label="promise requested" value={hbar(g.requestedTinybar, 2)} unit="ℏ" />
          <Big label={g.ok ? 'headroom' : 'short by'} value={hbar(Math.abs(g.headroomTinybar), 2)} unit="ℏ" tone={g.ok ? 'ok' : 'refused'} />
        </>
      }
      links={[
        { kind: 'transaction', id: d.txId, label: 'deposit' },
        { kind: 'token', id: data.shareToken.id, label: `${data.shareToken.symbol} shares` },
        { kind: 'account', id: d.lpAccount, label: 'LP' },
      ]}
      note={step === 0 ? <>press <kbd>→</kbd> to let the guard look again</> : <>{clock(d.at)} UTC · the same request, re-evaluated</>}
    >
      <svg viewBox="0 0 1380 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* the atomic deposit */}
        <Node x={180} y={300} label="LP" value={`−${hbar(d.hbarTinybar, 2)} ℏ`} sub={d.lpAccount} />
        <Node x={640} y={200} label="pool" value={`+${hbar(d.hbarTinybar, 2)} ℏ`} sub={data.accounts.pool.id} tone="ok" />
        <Node x={640} y={420} label="share treasury" value={`−${hbar(d.shareUnits, 2)} ${data.shareToken.symbol}`} sub={data.shareToken.treasury} r={56} />
        <Flow x1={234} y1={284} x2={586} y2={214} label={`${hbar(d.hbarTinybar, 2)} ℏ`} />
        <Flow x1={588} y1={410} x2={234} y2={318} label={`${hbar(d.shareUnits, 2)} ${data.shareToken.symbol}`} delay={120} labelOffset={20} />
        <rect x={100} y={120} width={620} height={380} rx={16} fill="none" stroke={C.line} strokeDasharray="4 8" />
        <text x={410} y={540} textAnchor="middle" className="label" fill={C.fg2} fontSize={16}>one transaction · one consensus event · {clock(d.at)} UTC</text>
        {/* the guard looks again */}
        <Tank x={960} y={60} w={200} h={430} capital={g.capitalTinybar} promise={g.requestedTinybar} max={MAX} ok={g.ok} />
      </svg>
    </Scene>
  );
}

export const capital: Beat = { label: 'Capital arrives', steps: 2, View };
