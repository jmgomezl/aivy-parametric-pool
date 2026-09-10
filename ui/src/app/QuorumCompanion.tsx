import {useEffect,useRef,useState} from 'react';
import {demoToken} from '../lib/demo';
import {onLink,type Route} from '../lib/router';
import './QuorumCompanion.css';
type Answer={message:string;facts:{label:string;value:string;tone:string}[];links:{label:string;url:string;network?:string}[];flow:{label:string;detail:string}[];scope:string;source:'ai'|'quick'|'fallback';checkedAt:string;ledgerCheckedAt:string|null;recordedAt:string|null;mode:'read_only'};
type Turn={question:string;answer?:Answer;error?:string};
const base=import.meta.env.VITE_AGENT_URL??'';
const questions:Record<string,[string,string][]>={home:[['Which network?','network'],['How it works','overview'],['What is x402?','x402']],policy:[['Policy status','status'],['Payout rules','payout'],['NFT & receipts','evidence']],policies:[['Pool & ARPS','pool'],['My balance','account'],['Agent safety','safety']],swap:[['Why Uniswap?','swap'],['My balance','account'],['Which network?','network']],story:[['This payout','status'],['Why Hedera?','network'],['Agent safety','safety']]};
export function QuorumCompanion({route}:{route:Route}){
 const page=route.name==='notfound'?'home':route.name,serial=route.name==='policy'?route.serial:undefined,key=page+':'+(serial??'');
 const [open,setOpen]=useState(false),[question,setQuestion]=useState(''),[turns,setTurns]=useState<Turn[]>([]),[busy,setBusy]=useState(false);
 const root=useRef<HTMLDivElement>(null),launcher=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null),input=useRef<HTMLTextAreaElement>(null),log=useRef<HTMLDivElement>(null),pending=useRef(false),generation=useRef(0),controller=useRef<AbortController|null>(null);
 const context=serial?`Policy #${serial} · public record`:page==='story'?'Mainnet · recorded':page==='swap'?'Hedera → Sepolia':'Cover · testnet';
 function hide(restore=true){setOpen(false);if(restore)launcher.current?.focus({preventScroll:true});}
 useEffect(()=>{generation.current++;controller.current?.abort();pending.current=false;setBusy(false);setQuestion('');setTurns([]);},[key]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{document.documentElement.classList.toggle('qm-open',open);return()=>document.documentElement.classList.remove('qm-open');},[open]);
 useEffect(()=>{
  if(!open)return;
  (matchMedia('(min-width:761px)').matches?input.current:close.current)?.focus({preventScroll:true});
  const outside=(e:MouseEvent)=>{if(root.current&&!root.current.contains(e.target as Node))hide(false);};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();hide();}};
  document.addEventListener('click',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('click',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[turns,busy,open]);
 async function ask(text:string,topic?:string){
  if(pending.current||!text.trim())return;
  const version=generation.current;pending.current=true;setBusy(true);setQuestion('');setTurns(old=>[...old.slice(-7),{question:text.trim()}]);
  const abort=new AbortController();controller.current=abort;
  try{
   const token=demoToken(),res=await fetch(base+'/api/companion/chat',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({question:text.trim(),page,...(serial?{serial}:{}),...(topic?{topic}:{})}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(25000)])});
   const data=await res.json().catch(()=>null);
   if(!res.ok)throw Error(data?.message??'The companion is temporarily unavailable. No state was changed.');
   if(data?.mode!=='read_only'||typeof data.message!=='string'||!Array.isArray(data.facts)||!Array.isArray(data.links)||!Array.isArray(data.flow))throw Error('This answer could not be read. Please try again.');
   if(version===generation.current)setTurns(old=>old.map((t,i)=>i===old.length-1?{...t,answer:data}:t));
  }catch(e){if(version===generation.current&&!abort.signal.aborted)setTurns(old=>old.map((t,i)=>i===old.length-1?{...t,error:e instanceof Error&&e.name!=='TimeoutError'?e.message:'The read timed out. Your policy and funds were not changed.'}:t));}
  finally{if(version===generation.current){pending.current=false;setBusy(false);}}
 }
 return <div className={`qm-companion ${page==='story'?'qm-story':''}`} ref={root} data-open={open}>
  {open&&<section className="qm-panel" role="dialog" aria-modal="false" aria-label="Quorum companion">
   <header className="qm-header"><div className={`qm-bot-stage ${busy?'is-thinking':''}`} aria-hidden="true"><span className="qm-pixel-bot"/><i/></div><div><span className="qm-eyebrow">READ ONLY · REAL RECORDS</span><h2>Ask Quorum.</h2><p>{context}</p></div><button ref={close} className="qm-close" aria-label="Close Quorum companion" onClick={()=>hide()}>×</button></header>
   <div ref={log} className="qm-log" role="log" aria-label="Quorum conversation" aria-live="polite" aria-relevant="additions text">
    <div className="qm-intro"><span className="qm-who">QUORUM</span><p>{serial?'Let’s read this policy. Ask about its signatures, payout or NFT.':page==='story'?'This page replays a mainnet experiment. Ask what happened and how to verify it.':'Ask what is happening onchain, how cover works, or why these networks are here.'}</p></div>
    {turns.map((t,i)=><div key={i} className="qm-turn"><p className="qm-question">{t.question}</p>{t.answer&&<div className="qm-answer"><span className="qm-who">{t.answer.scope}</span><p>{t.answer.message}</p>{t.answer.flow.length>0&&<ol className="qm-flow" aria-label="How this works">{t.answer.flow.map((s,j)=><li key={s.label}><span>{String(j+1).padStart(2,'0')}</span><strong>{s.label}</strong><small>{s.detail}</small></li>)}</ol>}{t.answer.facts.length>0&&<dl>{t.answer.facts.map(f=><div key={f.label}><dt>{f.label}</dt><dd className={f.tone==='mint'?'qm-mint':''}>{f.value}</dd></div>)}</dl>}{t.answer.links.length>0&&<div className="qm-links">{t.answer.links.filter(l=>/^https:\/\//.test(l.url)||/^\/(?!\/)/.test(l.url)).map(l=><a key={l.label+l.url} href={l.url} onClick={onLink} {...(l.url.startsWith('https:')?{target:'_blank',rel:'noreferrer'}:{})}><span>{l.label} ↗</span>{l.network&&<small className={l.network==='mainnet'?'qm-mainnet':''}>{l.network}</small>}</a>)}</div>}<small className="qm-source">{t.answer.source==='ai'?'AI interpreted':t.answer.source==='fallback'?'Direct answer · AI unavailable':'Direct answer'} · {t.answer.recordedAt?`recorded ${new Date(t.answer.recordedAt).toLocaleDateString()}`:t.answer.ledgerCheckedAt?`ledger read ${new Date(t.answer.ledgerCheckedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:'Quorum implementation'}</small></div>}{t.error&&<p className="qm-error" role="alert">{t.error}</p>}</div>)}
    {busy&&<div className="qm-thinking" role="status"><i/><i/><i/><span>Reading your question…</span></div>}
   </div>
   <div className="qm-bottom"><div className="qm-prompts">{questions[page].map(([label,topic])=><button disabled={busy} key={topic} onClick={()=>void ask(label,topic)}>{label}</button>)}</div><form onSubmit={e=>{e.preventDefault();void ask(question);}}><label className="sr-only" htmlFor="qm-question">Ask Quorum a question</label><textarea id="qm-question" ref={input} rows={1} maxLength={400} placeholder={serial?'What is this policy’s status?':'What is happening onchain?'} value={question} disabled={busy} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void ask(question);}}}/><button type="submit" disabled={busy||!question.trim()} aria-label="Send question to Quorum">↑</button></form><details className="qm-about"><summary>How answers work <span>↗</span></summary><p>AI interprets your typed question. Quorum supplies the facts and links. Only the question goes to OpenAI—not your account capability, policy data or chat history. Quick questions skip AI. Chat cannot sign, buy or move funds. Conversation stays in this tab’s memory.</p></details></div>
  </section>}
  <button className="qm-launcher" ref={launcher} aria-label={open?'Hide Quorum companion':'Ask Quorum'} aria-expanded={open} onClick={()=>open?hide():setOpen(true)}><span className="qm-bot-stage" aria-hidden="true"><span className="qm-pixel-bot"/><i/></span><span><strong>Ask Quorum</strong><small>Read the network</small></span><b aria-hidden="true">{open?'−':'↗'}</b></button>
 </div>;
}
