import {useEffect,useState} from 'react';
import {demoCall,useDemo,refreshDemo,receipt} from '../lib/demo';
import {refresh} from '../lib/store';
const BASE=import.meta.env.VITE_AGENT_URL??'';
type Check={status?:string;checkedAt?:string;needsReview?:boolean;checks:{source:string;status:string;verdict?:string;paid?:boolean;paymentTxId?:string;signatureTxId?:string}[]};
export function PolicyChecks({serial,enabled}:{serial:string;enabled:boolean}){
 const {account}=useDemo(),[check,setCheck]=useState<Check|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const storage='quorum.check.'+serial,[pending,setPending]=useState(()=>localStorage.getItem(storage));
 const read=async()=>{const r=await fetch(`${BASE}/api/policies/${encodeURIComponent(serial)}/check`);if(!r.ok)throw Error('Check status unavailable.');const j=await r.json();setCheck(j.check);};
 useEffect(()=>{void read().catch(()=>{});const timer=setInterval(()=>void read().catch(()=>{}),15000);return()=>clearInterval(timer);},[serial]);
 useEffect(()=>{if(pending&&account?.actions.some(a=>a.requestId===pending&&a.status==='complete')){localStorage.removeItem(storage);setPending(null);void read();}},[account,pending]);
 const run=async()=>{
  if(!account){window.dispatchEvent(new Event('quorum:account'));return;}
  const requestId=pending??crypto.randomUUID();setPending(requestId);localStorage.setItem(storage,requestId);setBusy(true);setMessage('');
  try{setCheck(await demoCall(`/api/policies/${encodeURIComponent(serial)}/check`,{requestId}));localStorage.removeItem(storage);setPending(null);await Promise.all([refreshDemo(),refresh()]);}
  catch(e){setMessage((e as Error).message);if((e as Error & {status?:number}).status){try{const view=await demoCall('/api/demo');if(!view.actions.some((a:{requestId:string})=>a.requestId===requestId)){localStorage.removeItem(storage);setPending(null);}}catch{}}void read().catch(()=>{});}
  finally{setBusy(false);}
 };
 return <section className="policy-checks" aria-label="Earthquake event checks"><div className="capital-heading"><strong>Check for earthquakes</strong><span>Testnet</span></div><p>Three catalogues check the recorded terms. Matching events can trigger the payout.</p><button className="chip" disabled={busy||!enabled||check?.status==='pending'||check?.needsReview} onClick={()=>void run()}>{busy?'Checking sources…':pending?'Check original request ↻':account?'Check now · up to 0.003 aUSDd →':'Start demo account to check →'}</button><small>x402 · 0.001 per source · five-minute shared cooldown</small>
 {check?<div className="policy-check-results"><div className="oracle-result-strip" aria-label="Latest catalogue results">{check.checks.map(c=><div key={c.source} className={c.status==='qualifying-event'?'result-match':c.status==='no-match'?'result-clear':'result-pending'}><strong>{c.source.replace(' ComCat','')}</strong><span>{c.status==='no-match'?'No match':c.status==='qualifying-event'?'Match found':c.status==='checking'?'Checking…':c.status==='unavailable'?'Unavailable':'Review needed'}</span></div>)}</div><details className="oracle-result-details"><summary>Source evidence & x402 receipts <span>+</span></summary>{check.checks.map(c=><div className="oracle-result-evidence" key={c.source}><div><strong>{c.source}</strong><span className={c.status==='no-match'?'text-fg-2':c.status==='qualifying-event'?'text-ok':'text-pending'}>{c.status==='no-match'?'No qualifying event':c.status==='qualifying-event'?'Qualifying event':c.status==='checking'?'Checking…':c.status==='unavailable'?'Unavailable':'Receipt needs review'}</span></div><p>{c.verdict}</p>{c.paymentTxId?<a href={receipt(c.paymentTxId)} target="_blank" rel="noreferrer">x402 payment {c.paid?'confirmed':'submitted'} ↗</a>:null}{c.signatureTxId?<a href={receipt(c.signatureTxId)} target="_blank" rel="noreferrer">Oracle signature ↗</a>:null}</div>)}</details>{check.checkedAt?<small>Last check · {new Date(check.checkedAt).toLocaleString()}</small>:null}</div>:null}{message?<p role="status">{message}</p>:null}
 </section>;
}
