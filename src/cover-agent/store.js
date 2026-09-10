import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {withIssuanceLock} from '../issuance-lock.js';
import {mandateInput} from './rules.js';

// Separate short state transactions; never hold this lock while doing ledger I/O.
export function coverAgentStore(directory=path.join(process.cwd(),'.artifacts')){
 const file=path.join(directory,'cover-agents-testnet.json'),marker=file+'.initialized';
 const lock=fn=>withIssuanceLock('cover-agents-testnet',fn,{directory});
 const save=value=>{const temp=file+'.'+randomUUID();fs.writeFileSync(temp,JSON.stringify(value),{mode:0o600});fs.renameSync(temp,file);};
 const read=()=>{
  try{
   const s=JSON.parse(fs.readFileSync(file,'utf8'));
   if(s.version!==1||!s.mandates||Array.isArray(s.mandates))throw Error();
   for(const [owner,m] of Object.entries(s.mandates)){
    if(!/^[a-f0-9]{64}$/.test(owner)||m.owner!==owner||!/^[a-f0-9-]{36}$/.test(m.id)||!Number.isFinite(m.anchor)||m.anchor<=0||!/^0\.0\.\d+$/.test(m.accountId)||!/^0\.0\.\d+$/.test(m.tokenId)||!Array.isArray(m.attempts)||m.attempts.length>3||typeof m.enabled!=='boolean')throw Error();
    mandateInput(m.rules);
    if(m.attempts.some(a=>!Number.isInteger(a.cycle)||a.cycle<0||a.cycle>2||a.requestId!==`cover-agent-${m.id}-${a.cycle}`||!['queued','running','complete','declined','needs_review'].includes(a.status)))throw Error();
    if(new Set(m.attempts.map(a=>a.cycle)).size!==m.attempts.length)throw Error();
    if(m.attempts.some(a=>a.status==='complete'&&(!a.policy?.scheduleId||!a.policy.serial||!Number.isFinite(Date.parse(a.policy.lapsesAt)))))throw Error();
   }
   return s;
  }catch{throw Error('Cover-agent journal unavailable or invalid. Automatic purchases are paused.');}
 };
 return {file,read,idle:()=>lock(()=>{}),
  async initialize(){await lock(()=>{fs.mkdirSync(directory,{recursive:true});if(!fs.existsSync(file)){if(fs.existsSync(marker))throw Error('Missing cover-agent journal; restore it before renewing.');save({version:1,mandates:{}});}read();fs.writeFileSync(marker,'Do not delete: prevents an empty renewal ledger after data loss.\n',{mode:0o600});});},
  async change(fn){return lock(async()=>{const s=read(),result=await fn(s);save(s);return result;});},
 };
}
