// "Can the oracles steal this?" — answered with the two real mainnet schedules:
// one the agent pre-signed (executed on the second oracle key) and one it never
// touched (all three oracles signed; it lapsed). Same keys, one minute apart.
import { data, type ScheduleRecord } from '../data';
import { C, Lock } from '../components/viz';
import { Id } from '../components/ui';
import { clock, hbar } from '../lib/format';

const names = data.oracles.map((o) => o.name);
const amountOf = (r: ScheduleRecord) => Math.abs(Math.min(...r.inner.map((l) => l.tinybar ?? 0)));

export function OracleProof() {
  const ctl = data.control, adv = data.adversarial;
  return (
    <div className="flex flex-col gap-[16px]">
      <svg viewBox="0 0 760 320" width="100%" style={{ maxWidth: 760 }}>
        <text x={190} y={22} textAnchor="middle" className="label" fill={C.fg2} fontSize={14}>with the agent's signature</text>
        <Lock cx={190} cy={160} r={88} agent oracles={[true, true, false]} names={names} state="ok" centre={<>
          <text x={190} y={156} textAnchor="middle" className="num" fill={C.ok} fontSize={26}>{hbar(amountOf(ctl), 0)} ℏ</text>
          <text x={190} y={178} textAnchor="middle" className="label" fill={C.fg2} fontSize={12}>moved</text>
        </>} />
        <line x1={380} y1={30} x2={380} y2={300} stroke={C.line} strokeDasharray="4 8" />
        <text x={570} y={22} textAnchor="middle" className="label" fill={C.fg2} fontSize={14}>without it · all three oracles</text>
        <Lock cx={570} cy={160} r={88} agent={false} oracles={[true, true, true]} names={names} state="lapsed" centre={<>
          <text x={570} y={156} textAnchor="middle" className="num" fill={C.refused} fontSize={26}>{hbar(amountOf(adv), 0)} ℏ</text>
          <text x={570} y={178} textAnchor="middle" className="label" fill={C.fg2} fontSize={12}>never left</text>
        </>} />
      </svg>
      <p className="text-[16px] leading-[1.5] text-fg-1 max-w-[70ch]">
        The pool's key is <span className="num">and(agent, 2 of 3 oracles)</span>. On mainnet, an outsider scheduled a {hbar(amountOf(adv), 0)} ℏ drain and collected every oracle signature there is; without the agent's branch the network never executed it and the window closed at {clock(adv.expiresAt, false)} UTC. One minute earlier the same three keys, with the agent's signature already on the schedule, moved {hbar(amountOf(ctl), 0)} ℏ on the second oracle. The oracles can release only what the agent already committed to. They cannot take.
      </p>
      <div className="flex flex-wrap gap-x-[20px] gap-y-[6px] text-[14px]">
        <span className="flex items-baseline gap-[6px]"><span className="label">the drain</span><Id kind="schedule" id={adv.scheduleId} size="sm" /></span>
        <span className="flex items-baseline gap-[6px]"><span className="label">the control</span><Id kind="schedule" id={ctl.scheduleId} size="sm" /></span>
        <span className="flex items-baseline gap-[6px]"><span className="label">pool</span><Id kind="account" id={data.accounts.pool.id} size="sm" /></span>
        <span className="label">Hedera mainnet</span>
      </div>
    </div>
  );
}
