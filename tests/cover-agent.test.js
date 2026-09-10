import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {coverAgentStore} from '../src/cover-agent/store.js';
import {coverAgentService} from '../src/cover-agent/service.js';
import {mandateInput,monthAt,quoteDenial} from '../src/cover-agent/rules.js';
import {createDemoPurchase} from '../src/demo/purchase.js';
const owner='a'.repeat(64),other='b'.repeat(64),rules={requestId:'approved-mandate-123456',placeId:'medellin',monthlyBudget:4,minimumPayout:400,acceptTerms:true};
const q=()=>({ok:true,asset:{kind:'token',symbol:'aUSDd',tokenId:'0.0.300'},settled:{premium:4,payout:550,premiumUnits:4000000,payoutUnits:550000000},hazard:{triggerRadiusKm:100}});
async function fixture(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'quorum-renew-')),store=coverAgentStore(directory),book=new Map(),calls=[];
 let time=Date.parse('2026-01-31T12:00:00Z'),nextQuote=q(),failure=false,wait=null,accountId='0.0.200';
 const options={store,account:id=>{if(![owner,other].includes(id))throw Object.assign(Error('Unauthorized'),{status:401});return {accountId:id===owner?accountId:'0.0.201'};},network:'testnet',tokenId:'0.0.300',now:()=>time,logger:{error(){}},quote:async()=>nextQuote,lookup:id=>book.get(id),purchase:async({sessionId,input,validateQuote})=>{
  calls.push({sessionId,input});if(wait)await wait;
  const denial=validateQuote(nextQuote);if(denial)return {ok:false,...denial};
  if(failure)throw Error('Interrupted after submission');
  assert(!book.has(input.requestId),'The issuer must not be invoked twice for a successful period');
  const policy={serial:calls.length,premiumHbar:4,payoutHbar:550,buyerId:'0.0.210',lapsesAt:new Date(time+input.days*86400000).toISOString(),saleTxId:`0.0.1@${calls.length}.0`,scheduleId:'0.0.400',termsPointer:'hcs://0.0.500/1',quote:nextQuote};
  book.set(input.requestId,policy);return {ok:true,policy};
 }};
 let service=coverAgentService(options);await service.initialize();
 return {store,book,calls,options,get service(){return service;},setTime:x=>{time=Date.parse(x);},setQuote:x=>{nextQuote=x;},fail:()=>{failure=true;},hold:()=>{let release;wait=new Promise(r=>{release=r;});return release;},setAccount:x=>{accountId=x;},restart:async()=>{await service.close();service=coverAgentService(options);await service.initialize();},clean:async()=>{await service.close();fs.rmSync(directory,{recursive:true,force:true});}};
}

test('month boundaries retain UTC day across short months and leap years',()=>{
 assert.equal(new Date(monthAt(Date.parse('2026-01-31T12:00:00Z'),1)).toISOString(),'2026-02-28T12:00:00.000Z');
 assert.equal(new Date(monthAt(Date.parse('2026-01-31T12:00:00Z'),2)).toISOString(),'2026-03-31T12:00:00.000Z');
 assert.equal(new Date(monthAt(Date.parse('2028-01-31T12:00:00Z'),1)).toISOString(),'2028-02-29T12:00:00.000Z');
});
test('mandates require explicit bounded consent and cannot select an arbitrary signer, URL, network or cadence',()=>{
 assert.deepEqual(mandateInput(rules),rules);
 for(const patch of [{acceptTerms:false},{monthlyBudget:11},{monthlyBudget:'4'},{minimumPayout:0},{minimumPayout:Infinity},{placeId:'__proto__'},{beneficiaryId:'0.0.9'},{network:'mainnet'},{cron:'* * * * *'},{url:'https://evil.example'},{requestId:'short'}])assert.throws(()=>mandateInput({...rules,...patch}));
 const approved={...rules,tokenId:'0.0.300'};
 for(const quote of [{...q(),asset:{...q().asset,tokenId:'0.0.301'}},{...q(),settled:{...q().settled,premiumUnits:4000001}},{...q(),settled:{...q().settled,payoutUnits:399999999}},{...q(),hazard:{triggerRadiusKm:99}}])assert(quoteDenial(approved,quote));
});
test('concurrent activation/run/tick purchase once per month and stop after three periods',async()=>{
 const f=await fixture();try{
  await Promise.all([f.service.activate(owner,rules,'127.0.0.1'),f.service.activate(owner,rules,'127.0.0.1')]);
  await Promise.all([f.service.run(owner),f.service.tick(),f.service.run(owner)]);await f.service.idle();assert.equal(f.calls.length,1);
  assert.equal(f.service.view(owner).mandate.attempts[0].policy.serial,'1');
  f.setTime('2026-02-28T12:00:00Z');await f.service.tick();await f.service.idle();assert.equal(f.calls.length,2);assert.equal(f.calls[1].input.days,31);
  f.setTime('2026-03-31T12:00:00Z');await f.service.tick();await f.service.idle();assert.equal(f.calls.length,3);
  f.setTime('2026-04-30T12:00:00Z');await f.service.tick();await f.service.idle();assert.equal(f.calls.length,3);assert.equal(f.service.view(owner).mandate.status,'completed');
 }finally{await f.clean();}
});
test('pause cancels a not-yet-admitted purchase, another owner cannot control it, and changed consent cannot replace it',async()=>{
 const f=await fixture();try{
  const release=f.hold();await f.service.activate(owner,rules,'127.0.0.1');await f.service.pause(owner);release();await f.service.idle();assert.equal(f.book.size,0);
  assert.equal(f.service.view(other).mandate,null);await assert.rejects(f.service.pause(other),e=>e.status===404);
  await assert.rejects(f.service.activate(owner,{...rules,monthlyBudget:5},'127.0.0.1'),e=>e.status===409);
  await f.service.resume(owner);await f.service.idle();assert.equal(f.book.size,1);
  const publicData=JSON.stringify(f.service.view(owner));assert(!publicData.includes(owner));assert(!publicData.includes('127.0.0.1'));
 }finally{await f.clean();}
});
test('fresh quote falling below the minimum pauses before spending and never silently buys less cover',async()=>{
 const f=await fixture();try{
  const preview=await f.service.preview(rules);assert(preview.ok);
  f.setQuote({...q(),settled:{...q().settled,payoutUnits:399000000,payout:399}});
  await f.service.activate(owner,rules,'127.0.0.1');await f.service.idle();assert.equal(f.book.size,0);assert.equal(f.service.view(owner).mandate.status,'needs_attention');
  await f.service.tick();await f.service.idle();assert.equal(f.calls.length,1);
 }finally{await f.clean();}
});
test('a changed payer cannot use an existing mandate',async()=>{
 const f=await fixture();try{
  const release=f.hold();await f.service.activate(owner,rules,'127.0.0.1');f.setAccount('0.0.999');release();await f.service.idle();assert.equal(f.book.size,0);assert.equal(f.service.view(owner).mandate.reason,'account_changed');
 }finally{await f.clean();}
});
test('a crash/ambiguous result retains its request and prevents retry spending, including after restart',async()=>{
 const f=await fixture();try{
  f.fail();await f.service.activate(owner,rules,'127.0.0.1');await f.service.idle();const id=f.calls[0].input.requestId;
  await f.restart();await f.service.run(owner);await f.service.tick();await f.service.idle();assert.equal(f.calls.length,1);assert.equal(f.service.view(owner).mandate.attempts[0].requestId,id);assert.equal(f.service.view(owner).mandate.status,'needs_review');
  await assert.rejects(f.service.resume(owner),e=>e.status===409);
 }finally{await f.clean();}
});
test('restart reconciles only an authoritative completed policy and never sends a new purchase',async()=>{
 const f=await fixture();try{
  await f.service.activate(owner,rules,'127.0.0.1');await f.service.idle();
  await f.store.change(s=>{const a=s.mandates[owner].attempts[0];a.status='running';delete a.policy;});
  let reconciled=0;f.options.reconcile=async()=>{reconciled++;};await f.restart();assert.equal(reconciled,1);assert.equal(f.service.view(owner).mandate.attempts[0].status,'complete');
  await f.service.tick();await f.service.idle();assert.equal(f.calls.length,1);
 }finally{await f.clean();}
});
test('missed months are not backfilled and an existing unexpired policy prevents overlapping purchases',async()=>{
 const f=await fixture();try{
  await f.service.activate(owner,rules,'127.0.0.1');await f.service.idle();
  f.setTime('2026-03-20T12:00:00Z');await f.service.tick();await f.service.idle();assert.equal(f.calls.length,2);
  f.setTime('2026-03-31T12:00:00Z');await f.service.tick();await f.service.idle();assert.equal(f.calls.length,2);
  f.setTime('2026-04-30T12:00:00Z');await f.service.tick();await f.service.idle();assert.equal(f.calls.length,2);assert.equal(f.service.view(owner).mandate.status,'expired');
 }finally{await f.clean();}
});
test('removed or corrupt mandate journal fails closed instead of resetting purchase authority',async()=>{
 const f=await fixture();try{
  await f.service.activate(owner,rules,'127.0.0.1');await f.service.idle();fs.writeFileSync(f.store.file,'{}');assert.throws(()=>f.store.read(),/invalid/);
  fs.unlinkSync(f.store.file);await assert.rejects(f.store.initialize(),/Missing cover-agent journal/);
 }finally{await f.clean();}
});
test('mainnet refuses even initialization without ledger calls',async()=>{
 const s=coverAgentService({network:'mainnet'});await assert.rejects(s.initialize(),e=>e.status===403);await assert.rejects(s.preview(rules),e=>e.status===403);
});
test('the ordinary public purchase path cannot preempt future renewal IDs',async()=>{
 let touched=false;
 const purchase=createDemoPurchase({deps:{client:null},demo:{enabled:()=>{touched=true;}},network:'testnet'});
 await assert.rejects(purchase({sessionId:owner,ip:'127.0.0.1',input:{lat:6.2,lon:-75.5,budgetUsd:4,days:30,requestId:'cover-agent-future-mandate-0'}}),e=>e.status===400);
 assert.equal(touched,false);
});
