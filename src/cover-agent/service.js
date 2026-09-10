import {randomUUID} from 'node:crypto';
import {HttpError} from '../http-safety.js';
import {MAX_CYCLES,PLACES,TRIGGER,mandateInput,monthAt,periodAt,daysFor,quoteDenial} from './rules.js';

const iso=n=>new Date(n).toISOString();
const receipt=p=>({serial:String(p.serial),premium:p.premiumHbar,payout:p.payoutHbar,beneficiaryId:p.buyerId,lapsesAt:p.lapsesAt,saleTxId:p.saleTxId,scheduleId:p.scheduleId,termsPointer:p.termsPointer,receipts:p.receipts});

/** A bounded deterministic agent. The UI chooses rules; only the existing guarded
 * purchase adapter spends. No prompt, arbitrary tool, URL or raw signer enters here. */
export function coverAgentService({store,account,purchase,quote,lookup,reconcile=async()=>{},network,tokenId,now=Date.now,logger=console}){
 let queue=Promise.resolve(),timer=null,closed=false,stopping=false,lastTick=null;
 const assertEnabled=()=>{if(network!=='testnet')throw new HttpError(403,'Cover agents are testnet only.');if(closed)throw new HttpError(503,'Cover agents are draining.');};
 const rows=()=>store.read().mandates;
 const get=owner=>{assertEnabled();account(owner);return rows()[owner]??null;};
 function status(m){
  if(m.attempts.some(a=>['queued','running'].includes(a.status)))return 'running';
  if(m.attempts.some(a=>a.status==='needs_review'))return 'needs_review';
  if(m.attempts.filter(a=>a.status==='complete').length===MAX_CYCLES)return 'completed';
  if(now()>=monthAt(m.anchor,MAX_CYCLES))return 'expired';
  if(m.reason&&!m.enabled)return 'needs_attention';
  return m.enabled?'scheduled':'paused';
 }
 function nextDue(m){
  const done=m.attempts.filter(a=>a.status==='complete'),cycle=done.length?Math.max(...done.map(a=>a.cycle))+1:0;
  if(cycle>=MAX_CYCLES)return null;
  return Math.max(monthAt(m.anchor,Math.max(cycle,periodAt(m.anchor,now()))),...done.map(a=>Date.parse(a.policy.lapsesAt)));
 }
 function view(owner){
  const m=get(owner);
  return {ok:true,network,execution:'deterministic',scheduler:{intervalSeconds:30,lastCheckedAt:lastTick},places:PLACES,mandate:m?{
   id:m.id,place:PLACES[m.rules.placeId],rules:m.rules,accountId:m.accountId,asset:'aUSDd',status:status(m),enabled:m.enabled,
   createdAt:iso(m.anchor),expiresAt:iso(monthAt(m.anchor,MAX_CYCLES)),nextDueAt:nextDue(m)===null?null:iso(nextDue(m)),
   maxPurchases:MAX_CYCLES,maxTotalPremium:m.rules.monthlyBudget*MAX_CYCLES,trigger:TRIGGER,
   reason:m.reason??null,message:m.message??null,
   attempts:m.attempts.map(a=>({cycle:a.cycle,requestId:a.requestId,status:a.status,startedAt:a.startedAt,finishedAt:a.finishedAt,policy:a.policy??null,reason:a.reason??null})),
  }:null};
 }
 async function preview(input){
  assertEnabled();const rules=mandateInput(input),anchor=now(),days=daysFor(anchor,0),p=PLACES[rules.placeId];
  const q=await quote({lat:p.lat,lon:p.lon,budgetUsd:rules.monthlyBudget,days,network});
  const denied=quoteDenial({...rules,tokenId},q);
  return {ok:!denied,quote:q,reason:denied?.reason,message:denied?.message,days,nextDueAt:iso(monthAt(anchor,1)),trigger:TRIGGER};
 }
 async function activate(owner,input,ip){
  assertEnabled();const rules=mandateInput(input),a=account(owner);
  await store.change(s=>{
   const existing=s.mandates[owner];
   if(existing){if(JSON.stringify(existing.rules)!==JSON.stringify(rules))throw new HttpError(409,'This demo account already has a saved mandate. Its approved rules cannot be replaced.');return;}
   if(Object.keys(s.mandates).length>=100)throw new HttpError(429,'The cover-agent demo is full. Existing agents can still be viewed.');
   s.mandates[owner]={id:randomUUID(),owner,rules,accountId:a.accountId,tokenId,ip,anchor:now(),enabled:true,attempts:[]};
  });
  await enqueue(owner);return view(owner);
 }
 function guard(owner,cycle,q){
  const m=get(owner);
  if(!m?.enabled||periodAt(m.anchor,now())!==cycle||now()>=monthAt(m.anchor,MAX_CYCLES))return {status:409,reason:'mandate_paused',message:'The approved mandate is paused, expired, or outside this monthly period.'};
  if(account(owner).accountId!==m.accountId)return {status:403,reason:'account_changed',message:'The approved funding account changed.'};
  return quoteDenial({...m.rules,tokenId:m.tokenId},q);
 }
 async function complete(owner,cycle,result){
  await store.change(s=>{
   const m=s.mandates[owner],a=m.attempts.find(a=>a.cycle===cycle);
   a.finishedAt=iso(now());
   if(result.ok){a.status='complete';a.policy=receipt(result.policy);delete m.reason;delete m.message;}
   else{a.status=result.reason==='pending_recovery'?'needs_review':'declined';a.reason=result.reason;m.enabled=false;m.reason=result.reason;m.message=result.message;}
  });
 }
 async function work(owner,cycle){
  try{
   await store.change(s=>{s.mandates[owner].attempts.find(a=>a.cycle===cycle).status='running';});
   const m=get(owner),p=PLACES[m.rules.placeId];
   if(!m.enabled||periodAt(m.anchor,now())!==cycle){await complete(owner,cycle,{ok:false,reason:'mandate_paused',message:'No purchase: the mandate was paused or this period ended.'});return;}
   const result=await purchase({sessionId:owner,ip:m.ip,input:{requestId:`cover-agent-${m.id}-${cycle}`,lat:p.lat,lon:p.lon,place:p.name,budgetUsd:m.rules.monthlyBudget,days:daysFor(m.anchor,cycle)},validateQuote:q=>guard(owner,cycle,q)});
   await complete(owner,cycle,result);
  }catch(error){
   logger.error('Cover-agent purchase interrupted; original request retained for review.',error);
   await complete(owner,cycle,{ok:false,reason:'pending_recovery',message:'Confirmation needs operator review. The original request is saved; no replacement purchase will be sent.'});
  }
 }
 async function enqueue(owner){
  assertEnabled();account(owner);let cycle=null;
  await store.change(s=>{
   if(stopping)return;
   const m=s.mandates[owner];if(!m)throw new HttpError(404,'No cover agent has been activated.');
   if(!m.enabled||['needs_review','expired','completed','running'].includes(status(m)))return;
   const index=periodAt(m.anchor,now());if(index>=MAX_CYCLES||nextDue(m)>now())return;
   const previous=m.attempts.find(a=>a.cycle===index);if(previous?.status==='complete')return;
   if(previous){if(previous.status!=='declined')return;Object.assign(previous,{status:'queued',startedAt:iso(now())});}
   else m.attempts.push({cycle:index,requestId:`cover-agent-${m.id}-${index}`,status:'queued',startedAt:iso(now())});
   cycle=index;
  });
  if(cycle!==null)queue=queue.catch(()=>{}).then(()=>work(owner,cycle));
  return view(owner);
 }
 async function pause(owner){get(owner);await store.change(s=>{const m=s.mandates[owner];if(!m)throw new HttpError(404,'No saved cover agent.');m.enabled=false;if(!m.attempts.some(a=>a.status==='needs_review')){delete m.reason;delete m.message;}});return view(owner);}
 async function resume(owner){
  const m=get(owner);if(!m)throw new HttpError(404,'No saved cover agent.');
  if(['needs_review','expired','completed'].includes(status(m)))throw new HttpError(409,'This mandate requires review or has reached its end. It cannot resume.');
  await store.change(s=>{s.mandates[owner].enabled=true;delete s.mandates[owner].reason;delete s.mandates[owner].message;});
  return enqueue(owner);
 }
 async function initialize(){
  assertEnabled();await store.initialize();
  for(const m of Object.values(rows()))for(const a of m.attempts){
   if(!['queued','running'].includes(a.status))continue;
   const p=lookup(a.requestId);if(p?.scheduleId&&p?.quote)await reconcile(m.owner,a.requestId,p);
  }
  // A single worker owns this journal. On restart, reconcile known completions
  // from the authoritative policy book; ambiguous attempts never auto-resubmit.
  await store.change(s=>{for(const m of Object.values(s.mandates))for(const a of m.attempts){
   if(!['queued','running'].includes(a.status))continue;
   const p=lookup(a.requestId);
   if(p?.scheduleId&&p?.quote){a.status='complete';a.policy=receipt(p);a.finishedAt=iso(now());}
   else{a.status='needs_review';m.enabled=false;m.reason='pending_recovery';m.message='An interrupted purchase needs operator review. Its original request is retained.';}
  }});
 }
 async function tick(){
  if(closed||stopping)return;lastTick=iso(now());
  try{for(const owner of Object.keys(rows())){
   if(closed||stopping)break;
   try{await enqueue(owner);}catch(error){logger.error('Cover-agent check skipped an unavailable account; no purchase admitted.',error);}
  }}
  catch(error){logger.error('Cover-agent scheduler paused this check; journal and permissions are retained.',error);}
 }
 return {initialize,view,preview,activate,pause,resume,run:enqueue,tick,
  start(){if(timer)return;timer=setInterval(()=>void tick(),30000);timer.unref();void tick();},
  async idle(){await queue;},
  async close(){stopping=true;if(timer)clearInterval(timer);await store.idle();await queue;closed=true;},
 };
}
