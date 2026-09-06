import {useState} from 'react';
import {usePractice,updatePractice} from '../lib/practice-store';
import {onLink} from '../lib/router';
const n=(v:number)=>v.toLocaleString(undefined,{maximumFractionDigits:2});
export function PracticeWallet(){
 const {state,error}=usePractice(),[message,setMessage]=useState('');
 return <details className="practice-wallet"><summary>Practice balance <strong className="num">{n(state.available)}</strong><span>credits</span></summary><div className="practice-popover">
 <div className="eyebrow">Your browser · simulation</div><h3>{n(state.available)} credits available</h3><p>Start with 1,000 practice credits. They are not a wallet, tokens or money. One credit models one USD of contribution or premium.</p>
 <dl className="facts"><div><dt>Simulated funding</dt><dd>{n(state.positions.reduce((n,p)=>n+p.amount,0))}</dd></div><div><dt>Cover premiums modeled</dt><dd>{n(state.purchases.reduce((n,p)=>n+p.amount,0))}</dd></div></dl>
 {state.positions.map(p=><div className="practice-position" key={p.id}><a href={`/policy/${p.id.split(':')[1]}?position=lp`} onClick={onLink}>{p.name} ↗</a><strong>{n(p.amount)} credits</strong></div>)}
 <p>Real testnet cover is sponsored by the service. Practice funding never changes the shared pool or earns tokens.</p>
 <button className="chip" onClick={()=>{try{updatePractice({type:'reset'});setMessage('Practice balance reset. Real policies are unchanged.');}catch(e){setMessage((e as Error).message);}}}>Reset practice balance</button><small role="status">{error??message}</small>
 </div></details>;
}
