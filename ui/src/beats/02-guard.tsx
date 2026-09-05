import { data } from '../data';
import { Scene } from '../components/Scene';
import { Big, C, Tank } from '../components/viz';
import { Pill } from '../components/ui';
import { hbar } from '../lib/format';
import type { Beat } from './types';

const g = data.guard.before;
const MAX = 4.4e8;

function View() {
  return (
    <Scene
      n={2}
      kicker="Solvency guard"
      title="The agent says no."
      caption={<>A {hbar(g.requestedTinybar, 0)} ℏ promise on {hbar(g.capitalTinybar, 2)} ℏ of capital is a promise the pool could not keep. So it is not made.</>}
      hud={
        <>
          <Pill state="refused" lg>refused</Pill>
          <Big label="pool capital" value={hbar(g.capitalTinybar, 2)} unit="ℏ" />
          <Big label="promise requested" value={hbar(g.requestedTinybar, 2)} unit="ℏ" />
          <Big label="short by" value={hbar(g.exposureAfterTinybar - g.capitalTinybar, 2)} unit="ℏ" tone="refused" />
        </>
      }
      links={[
        { kind: 'account', id: data.accounts.pool.id, label: 'pool' },
        { kind: 'transaction', id: data.deposits.d1.txId, label: 'first deposit' },
      ]}
      note={<span className="mono"><span className="text-refused">refused:</span> exposure {hbar(g.exposureAfterTinybar, 4)} HBAR would exceed capital {hbar(g.capitalTinybar, 4)} HBAR by {hbar(g.exposureAfterTinybar - g.capitalTinybar, 4)}</span>}
    >
      <svg viewBox="0 0 1380 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <Tank x={590} y={70} w={220} h={440} capital={g.capitalTinybar} promise={g.requestedTinybar} max={MAX} ok={false} />
        <text x={480} y={200} textAnchor="end" className="label" fill={C.fg2} fontSize={16}>what the policy would promise</text>
        <text x={480} y={410} textAnchor="end" className="label" fill={C.fg2} fontSize={16}>what the pool actually holds</text>
        <line x1={492} y1={196} x2={556} y2={196} stroke={C.line} />
        <line x1={492} y1={406} x2={556} y2={406} stroke={C.line} />
        <g transform="translate(900 150)">
          <text x={0} y={0} className="label" fill={C.fg2} fontSize={16}>the rule, always</text>
          <text x={0} y={44} className="num" fill={C.fg0} fontSize={34}>exposure ≤ capital</text>
          <text x={0} y={100} className="label" fill={C.fg2} fontSize={16}>if it were ever broken</text>
          <text x={0} y={132} className="label" fill={C.fg1} fontSize={17}>a signed payout would simply fail —</text>
          <text x={0} y={160} className="label" fill={C.fg1} fontSize={17}>first oracles paid in full, last paid nothing.</text>
        </g>
      </svg>
    </Scene>
  );
}

export const guard: Beat = { label: 'Guard refuses', steps: 1, View };
