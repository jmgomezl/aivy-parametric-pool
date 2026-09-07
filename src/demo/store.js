// Capability-authorized custodial TESTNET accounts. Call mutations under issuance lock.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
export const digest=x=>createHash('sha256').update(x).digest('hex');
export function capability(req){const token=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)throw Object.assign(Error('Start your demo account first.'),{status:401});return digest(token);}
export function demoStore(directory=path.join(process.cwd(),'.artifacts')){
 const file=path.join(directory,'demo-accounts-testnet.json');
 const read=()=>{try{const s=JSON.parse(fs.readFileSync(file,'utf8'));if(s.version!==1||!s.accounts||!Array.isArray(s.admissions))throw Error();return s;}catch(e){if(e.code==='ENOENT')return {version:1,accounts:{},admissions:[]};throw Error('Demo account journal invalid; writes paused.');}};
 const save=s=>{fs.mkdirSync(directory,{recursive:true});const temp=file+'.'+randomUUID();fs.writeFileSync(temp,JSON.stringify(s),{mode:0o600});fs.renameSync(temp,file);};
 return {read,save,
  start(id,ip,now=Date.now()){const s=read();if(s.accounts[id])return s.accounts[id];const recent=s.admissions.filter(e=>now-e.at<86400000);if(recent.length>=100||recent.filter(e=>e.ip===digest(ip)).length>=3)throw Object.assign(Error('Demo account starter limit reached. Reuse your existing browser account.'),{status:429});const a={status:'creating',code:randomBytes(6).toString('hex'),at:now,actions:[]};s.accounts[id]=a;s.admissions=[...recent,{at:now,ip:digest(ip)}];save(s);return a;},
  patch(id,patch){const s=read();if(!s.accounts[id])throw Error('Demo account unavailable.');Object.assign(s.accounts[id],patch);save(s);return s.accounts[id];},
  account(id){const a=read().accounts[id];if(!a||a.status!=='ready')throw Object.assign(Error(a?'Demo account needs reconciliation. Do not request another starter allocation.':'Start your demo account first.'),{status:a?409:401});return a;},
  broker(code,id){if(!code)return null;if(!/^[a-f0-9]{12}$/.test(code))throw Object.assign(Error('Invalid referral code.'),{status:400});const s=read();const row=Object.entries(s.accounts).find(([,a])=>a.code===code&&a.status==='ready');if(!row||row[0]===id)throw Object.assign(Error('Use another registered broker’s referral code.'),{status:400});return row[1].accountId;},
  begin(id,requestId,kind,amount,now=Date.now()){
   if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)||!['deposit','cover','bridge'].includes(kind)||!Number.isFinite(amount)||amount<=0||amount>100)throw Object.assign(Error('Invalid demo action.'),{status:400});
   const a=this.account(id),old=a.actions.find(x=>x.requestId===requestId);if(old){if(old.kind!==kind||old.amount!==amount)throw Object.assign(Error('Request identifier already used for different terms.'),{status:409});return old;}
   if(a.actions.some(x=>x.status==='pending'))throw Object.assign(Error('A previous transaction needs confirmation or operator review.'),{status:409});
   const s=read(),recent=Object.values(s.accounts).flatMap(x=>x.actions).filter(x=>now-x.at<86400000);
   if(recent.length>=200||a.actions.filter(x=>now-x.at<86400000).length>=12)throw Object.assign(Error('Daily demo action limit reached.'),{status:429});
   const action={requestId,kind,amount,at:now,status:'pending'};a.actions.push(action);this.patch(id,{actions:a.actions});return action;
  },
  finish(id,requestId,result){const a=this.account(id);const action=a.actions.find(x=>x.requestId===requestId);if(!action)throw Error('Missing action journal.');Object.assign(action,{status:'complete',result});this.patch(id,{actions:a.actions});},
 };
}
