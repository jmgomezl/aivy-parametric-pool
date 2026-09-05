import { data } from '../data';
import { Scene } from '../components/Scene';
import { Big, C, Flow, Node, arc } from '../components/viz';
import { clock, hbar } from '../lib/format';
import { fetchAccount, useLive } from '../lib/mirror';
import type { Beat } from './types';

const rec = data.payout;
const ex = rec.executedTx!;
const buyer = data.ledgers.buyer;
const paidRow = buyer.find((t) => t.scheduled)!;
const beforeRow = buyer[buyer.indexOf(paidRow) - 1];
const poolRow = data.ledgers.pool.find((t) => t.consensus === ex.consensus)!;

const story = [
  { at: data.terms.consensusAt, what: 'terms', id: data.terms.submitTxId },
  { at: data.sale.at, what: 'premium', id: data.sale.txId },
  { at: data.deposits.d3.at, what: 'capital', id: data.deposits.d3.txId },
  { at: rec.createdAt, what: 'scheduled', id: rec.createTxId },
  { at: rec.signatures[1].at, what: 'oracle 1', id: rec.signatures[1].txId },
  { at: rec.signatures[2].at, what: 'oracle 2', id: rec.signatures[2].txId },
  { at: ex.at, what: 'paid', id: ex.consensus, ok: true },
];
const t0 = new Date(story[0].at).getTime();
const t1 = new Date(story.at(-1)!.at).getTime();

function View() {
  const live = useLive(() => fetchAccount(data.accounts.buyer.id), []);
  const share = paidRow.delta / paidRow.balanceAfter;
  return (
    <Scene
      n={7}
      kicker="Settlement"
      title="Paid. Nobody sent it."
      caption={<>The transfer that moved {hbar(paidRow.delta, 0)} ℏ has no submitter. It was signed and waiting; the second oracle key was its trigger.</>}
      hud={
        <>
          <Big label="beneficiary before" value={hbar(beforeRow.balanceAfter)} unit="ℏ" tone="dim" size={34} />
          <Big label="beneficiary after" value={hbar(paidRow.balanceAfter)} unit="ℏ" tone="ok" />
          <Big label="moved by the network" value={`+${hbar(paidRow.delta)}`} unit="ℏ" tone="ok" size={34} />
          <div className="label">
            {live.status === 'ok' ? <span className={live.data.balanceTinybar === data.accounts.buyer.balanceAtSnapshot ? 'text-ok' : 'text-pending'}>mirror node now: {hbar(live.data.balanceTinybar)} ℏ</span> : live.status === 'loading' ? 'checking mirror node…' : <span className="text-pending">mirror node unavailable</span>}
          </div>
        </>
      }
      links={[
        { kind: 'transaction', id: ex.consensus, label: 'the payout' },
        { kind: 'account', id: data.accounts.buyer.id, label: 'beneficiary' },
        { kind: 'schedule', id: rec.scheduleId, label: 'schedule' },
      ]}
      note={<>{clock(ex.at)} UTC · fee at execution {hbar(ex.chargedFee, 0)} ℏ · scheduled = true</>}
    >
      <svg viewBox="0 0 1380 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <Node x={220} y={250} label="pool" value={`${hbar(poolRow.balanceAfter, 2)} ℏ`} sub={`was ${hbar(poolRow.balanceAfter - poolRow.delta, 2)}`} />
        <Flow x1={274} y1={250} x2={556} y2={250} label={`+${hbar(paidRow.delta, 0)} ℏ`} />
        <circle cx={720} cy={250} r={150} fill={C.bg1} stroke={C.line} strokeWidth={1.5} />
        <circle cx={720} cy={250} r={150} fill="none" stroke={C.bg3} strokeWidth={10} />
        <path d={arc(720, 250, 150, -90, -90 + 359.9 * share)} fill="none" stroke={C.ok} strokeWidth={10} pathLength={1} strokeDasharray={1} strokeDashoffset={0} />
        <text x={720} y={232} textAnchor="middle" className="label" fill={C.fg2} fontSize={16}>buyer · {data.accounts.buyer.id}</text>
        <text x={720} y={280} textAnchor="middle" className="num" fill={C.fg0} fontSize={40}>{hbar(paidRow.balanceAfter)}</text>
        <text x={720} y={312} textAnchor="middle" className="num" fill={C.ok} fontSize={15}>+{hbar(paidRow.delta, 0)} ℏ · {Math.round(share * 100)} % of the balance</text>
        <g transform="translate(980 170)">
          <rect x={0} y={0} width={300} height={160} rx={14} fill="none" stroke={C.fg3} strokeDasharray="6 8" />
          <text x={150} y={62} textAnchor="middle" className="label" fill={C.fg2} fontSize={16}>submitted by</text>
          <text x={150} y={106} textAnchor="middle" className="num" fill={C.fg0} fontSize={34}>nobody</text>
        </g>
        <g transform="translate(120 500)">
          <line x1={0} y1={0} x2={1140} y2={0} stroke={C.line} strokeWidth={1.5} />
          {story.map((s, i) => {
            const x = ((new Date(s.at).getTime() - t0) / (t1 - t0)) * 1140;
            const tier = [[-18, -38], [30, 50], [-62, -82]][i % 3];
            return (
              <g key={i}>
                <circle cx={x} cy={0} r={s.ok ? 7 : 5} fill={s.ok ? C.ok : C.fg1} />
                {i % 3 === 2 ? <line x1={x} y1={-8} x2={x} y2={-48} stroke={C.line} /> : null}
                <text x={x} y={tier[0]} textAnchor="middle" className="label" fill={s.ok ? C.ok : C.fg1} fontSize={15}>{s.what}</text>
                <text x={x} y={tier[1]} textAnchor="middle" className="num" fill={C.fg3} fontSize={13}>{clock(s.at, false)}</text>
              </g>
            );
          })}
          <text x={1140} y={78} textAnchor="end" className="label" fill={C.fg3} fontSize={14}>quote to payout · {Math.round((t1 - t0) / 1000)} s of ledger time · {data.terms.consensusAt.slice(0, 10)} UTC</text>
        </g>
      </svg>
    </Scene>
  );
}

export const paid: Beat = { label: 'Paid', steps: 1, View };
