import { data } from '../data';
import { Scene } from '../components/Scene';
import { Big, C, Flow, Node } from '../components/viz';
import { hbar, clock } from '../lib/format';
import { hsNft, hsTopicMessage } from '../lib/hashscan';
import type { Beat } from './types';

const s = data.sale;
const p = data.policy;
const buyerLeg = s.legs.find((l) => l.account === data.accounts.buyer.id)!;
const poolLeg = s.legs.find((l) => l.account === data.accounts.pool.id)!;
const brokerLeg = s.legs.find((l) => l.account === data.accounts.broker.id)!;

function View() {
  return (
    <Scene
      n={4}
      kicker="Policy"
      title="One payment. Three parties. One policy."
      caption={<>The premium splits {100 - s.commissionBps / 100} / {s.commissionBps / 100} between pool and broker in a single transfer. The policy is a token that points at its own terms.</>}
      hud={
        <>
          <Big label="premium paid" value={hbar(-buyerLeg.tinybar, 8)} unit="ℏ" />
          <Big label="cover promised" value={hbar(data.quote.payoutHbar * 1e8, 2)} unit="ℏ" />
          <Big label="cover per ℏ of premium" value={`${Math.round((data.quote.payoutHbar * 1e8) / -buyerLeg.tinybar)} ×`} />
        </>
      }
      links={[
        { kind: 'transaction', id: s.txId, label: 'premium' },
        { kind: 'token', id: `${p.tokenId}/${p.serial}`, label: `${p.symbol} #${p.serial}`, href: hsNft(p.tokenId, p.serial) },
        { kind: 'topic', id: data.terms.topicId, label: 'terms', href: hsTopicMessage(data.terms.topicId, 1) },
        ...(p.freezeTxId ? [{ kind: 'transaction' as const, id: p.freezeTxId, label: 'frozen' }] : []),
      ]}
      note={<>{clock(s.at)} UTC · legs balance to zero</>}
    >
      <svg viewBox="0 0 1380 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <Node x={200} y={300} label="buyer" value={`${hbar(buyerLeg.tinybar, 4)} ℏ`} sub={data.accounts.buyer.id} />
        <Node x={720} y={170} label="pool" value={`+${hbar(poolLeg.tinybar, 4)} ℏ`} sub={data.accounts.pool.id} tone="ok" />
        <Node x={720} y={430} label="broker" value={`+${hbar(brokerLeg.tinybar, 4)} ℏ`} sub={data.accounts.broker.id} tone="ok" r={50} />
        <Flow x1={252} y1={282} x2={666} y2={186} label={`${100 - s.commissionBps / 100} %`} />
        <Flow x1={252} y1={318} x2={672} y2={416} label={`${s.commissionBps / 100} %`} delay={120} labelOffset={18} />
        <rect x={110} y={90} width={720} height={430} rx={16} fill="none" stroke={C.line} strokeDasharray="4 8" />
        <text x={470} y={555} textAnchor="middle" className="label" fill={C.fg2} fontSize={16}>one transaction · the broker can be anyone, chosen per sale</text>

        {/* the policy, as a ticket */}
        <g transform="translate(960 110)">
          <rect x={0} y={0} width={340} height={380} rx={18} fill={C.bg1} stroke={C.line} strokeWidth={1.5} />
          <line x1={0} y1={250} x2={340} y2={250} stroke={C.line} strokeDasharray="6 6" />
          <circle cx={0} cy={250} r={14} fill="var(--bg-0)" />
          <circle cx={340} cy={250} r={14} fill="var(--bg-0)" />
          <text x={28} y={44} className="label" fill={C.fg2} fontSize={15}>{p.name}</text>
          <text x={28} y={98} className="num" fill={C.fg0} fontSize={44}>{p.symbol} #{p.serial}</text>
          <text x={28} y={140} className="label" fill={C.fg2} fontSize={15}>M ≥ {data.terms.body.trigger.minMagnitude} · depth &lt; {data.terms.body.trigger.maxDepthKm} km · {data.terms.body.trigger.radiusKm} km · {data.terms.body.trigger.windowDays} days</text>
          <text x={28} y={166} className="label" fill={C.fg2} fontSize={15}>pays {hbar(data.quote.payoutHbar * 1e8, 0)} ℏ to {data.accounts.buyer.id}</text>
          <text x={28} y={218} className="num" fill={C.fg1} fontSize={16}>{p.metadata}</text>
          <text x={28} y={288} className="label" fill={C.fg2} fontSize={15}>held by</text>
          <text x={28} y={314} className="num" fill={C.fg0} fontSize={18}>{p.owner}</text>
          <text x={28} y={352} className="label" fill={C.fg1} fontSize={15}>non-transferable · frozen on delivery</text>
        </g>
      </svg>
    </Scene>
  );
}

export const issued: Beat = { label: 'Policy issued', steps: 1, View };
