// Durable admission budget, consumed before the first ledger write, including
// uncertain/failed attempts. All check/admit calls run under the issuance lock.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
const DAY=86_400_000, HOUR=3_600_000;
export function readLimits(env=process.env) {
  const read=(name,fallback)=>{const raw=env[name]??String(fallback);const n=Number(raw);if(!String(raw).trim()||!Number.isSafeInteger(n)||n<0)throw new Error(`Invalid ${name}; expected a nonnegative integer`);return n;};
  return {perIpPerHour:read('LIMIT_PER_IP_HOUR',3),policiesPerDay:read('LIMIT_POLICIES_DAY',100),usdPerDay:read('LIMIT_USD_DAY',20000)};
}
export const LIMITS=readLimits();
export function createWriteGuard({network,directory=path.join(process.cwd(),'.artifacts'),limits=LIMITS,now=Date.now,seed=()=>[]}={}) {
  if(!['testnet','mainnet'].includes(network))throw new Error('Invalid guard network');
  const file=path.join(directory,`write-budget-${network}.json`);
  const persist=state=>{fs.mkdirSync(directory,{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(state),{mode:0o600});fs.renameSync(temp,file);};
  const load=()=>{
    let state;
    try {state=JSON.parse(fs.readFileSync(file,'utf8'));}
    catch(error){if(error.code!=='ENOENT')throw new Error('Write budget cannot be read; issuance is paused.');state={version:1,salt:randomBytes(32).toString('hex'),events:seed().map(e=>({at:Date.parse(e.recordedAt),usd:e.payoutUsd??limits.usdPerDay,actor:null}))};}
    if(state.version!==1||typeof state.salt!=='string'||!/^\w{64}$/.test(state.salt)||!Array.isArray(state.events)||state.events.some(e=>!Number.isFinite(e.at)||!Number.isFinite(e.usd)||e.usd<0||!(e.actor===null||typeof e.actor==='string')))throw new Error('Write budget is invalid; issuance is paused.');
    state.events=state.events.filter(e=>now()-e.at<DAY);
    return state;
  };
  const actor=(state,ip)=>createHmac('sha256',state.salt).update(ip).digest('hex');
  const denial=(state,{ip,usd})=>{
    if(network!=='testnet')return {status:403,reason:'mainnet_writes_disabled',message:'The public demo creates policies on testnet only.'};
    if(!Number.isFinite(usd)||usd<=0||typeof ip!=='string'||!ip)return {status:400,reason:'invalid_input',message:'Invalid write budget request.'};
    const mine=state.events.filter(e=>e.actor===actor(state,ip)&&now()-e.at<HOUR);
    if(mine.length>=limits.perIpPerHour)return {status:429,reason:'rate_limited',message:'Demo attempt limit reached. Existing policies and quotes remain available.',retryAfter:mine.length?Math.max(1,Math.ceil((HOUR-(now()-mine[0].at))/1000)):3600};
    if(state.events.length>=limits.policiesPerDay)return {status:429,reason:'daily_policy_cap',message:'The demo has reached its rolling 24-hour issuance-attempt limit.'};
    const used=state.events.reduce((n,e)=>n+e.usd,0);
    if(used+usd>limits.usdPerDay)return {status:429,reason:'daily_cover_cap',message:`The rolling 24-hour demo budget has $${Math.max(0,limits.usdPerDay-used).toFixed(2)} of cover remaining. Choose a smaller payout or view an existing policy.`};
    return null;
  };
  return {
    initialize(){const state=load();persist(state);},
    check(input){return denial(load(),input);},
    admit(input){const state=load(),blocked=denial(state,input);if(blocked)return blocked;state.events.push({at:now(),usd:input.usd,actor:actor(state,input.ip)});persist(state);return null;},
    budget(){const state=load();return {policies:state.events.length,usd:state.events.reduce((n,e)=>n+e.usd,0),limits:{policies:limits.policiesPerDay,usd:limits.usdPerDay}};},
  };
}
