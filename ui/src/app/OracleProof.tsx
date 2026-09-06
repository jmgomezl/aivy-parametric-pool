// Two recorded mainnet schedules isolate the committer-signature requirement.
import { data, type ScheduleRecord } from '../data';
import { C, Lock } from '../components/viz';
import { Id } from '../components/ui';
import { hbar } from '../lib/format';
const amountOf=(r:ScheduleRecord)=>Math.abs(Math.min(...r.inner.map(l=>l.tinybar??0)));
export function OracleProof(){
 const examples=[{record:data.control,agent:true,signers:[true,true,false],title:'Agent + two oracle keys',result:'Transferred',tone:C.ok},{record:data.adversarial,agent:false,signers:[true,true,true],title:'Three oracle keys alone',result:'Blocked',tone:C.refused}];
 return <div className="oracle-proof">
   <div className="proof-comparison">{examples.map(e=><section key={e.record.scheduleId}>
     <h3>{e.title}</h3>
     <svg viewBox="0 0 360 300" role="img" aria-label={`${e.title}: ${hbar(amountOf(e.record),0)} HBAR ${e.result.toLowerCase()}`}>
       <Lock cx={180} cy={140} r={86} agent={e.agent} oracles={e.signers} names={[]} state={e.agent?'ok':'lapsed'} centre={<><text x={180} y={137} textAnchor="middle" className="num" fill={e.tone} fontSize={34}>{hbar(amountOf(e.record),0)}</text><text x={180} y={163} textAnchor="middle" fill={C.fg1} fontSize={16}>HBAR</text></>}/>
     </svg>
     <strong style={{color:e.tone}}>{e.result}</strong>
     <Id kind="schedule" id={e.record.scheduleId} label="View receipt" network="mainnet"/>
   </section>)}</div>
   <p>The oracle keys alone could not release the transfer. This recording demonstrates that key restriction; it does not establish independent oracle operators.</p>
 </div>;
}
