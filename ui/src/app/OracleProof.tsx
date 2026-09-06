// Two recorded mainnet schedules isolate the committer-signature requirement.
import { data, type ScheduleRecord } from '../data';
import { SignatureGate } from '../components/SignatureGate';
import { Id } from '../components/ui';
import { hbar } from '../lib/format';
const amountOf=(r:ScheduleRecord)=>Math.abs(Math.min(...r.inner.map(l=>l.tinybar??0)));
export function OracleProof(){
 const examples=[{record:data.control,agent:true,signers:[true,true,false],title:'Agent + two oracle keys',result:'Transferred'},{record:data.adversarial,agent:false,signers:[true,true,true],title:'Three oracle keys alone',result:'Blocked'}];
 return <div className="oracle-proof">
   <div className="proof-comparison">{examples.map(e=><section key={e.record.scheduleId}>
     <h3>{e.title}</h3>
     <span className="proof-network">Recorded · Mainnet</span>
     <SignatureGate agent={e.agent} oracles={e.signers.map((signed,i)=>({name:`Key ${i+1}`,signed}))}
       outcome={e.agent?'Transferred':'Blocked'} amount={hbar(amountOf(e.record),0)} asset="HBAR"
       reason={e.agent?'Both signature requirements met.':'Agent signature missing. Transfer never executed.'}/>
     <Id kind="schedule" id={e.record.scheduleId} label="View receipt" network="mainnet"/>
   </section>)}</div>
   <p>The oracle keys alone could not release the transfer. This recording demonstrates that key restriction; it does not establish independent oracle operators.</p>
 </div>;
}
