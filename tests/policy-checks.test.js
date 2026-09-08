import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {demoStore} from '../src/demo/store.js';import{checkPolicy,latestPolicyCheck}from'../src/demo/policyChecks.js';
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quorum-checks-')),store=demoStore(dir);store.start('session','ip');store.patch('session',{status:'ready',accountId:'0.0.5'});let calls=0;const config={demo:{store,enabled:()=>{},balance:async()=>({tokens:1}),signer:()=>({id:'0.0.5',key:'test-double'})},network:'testnet',reg:{oracleSources:['usgs','emsc','geofon'],oracleAccountIds:['0.0.6','0.0.7','0.0.8'],demoTokenId:'0.0.9'},agent:{id:'0.0.1'},sessionId:'session',policy:{serial:'42',state:'active',ledger:{available:true,agentSigned:true},scheduleId:'0.0.10',termsPointer:'hcs://0.0.11/1'},input:{requestId:'check-request-000001'},pay:async(url,options)=>{calls++;assert.equal(options.network,'testnet');assert.equal(options.policy.maxAmount,'1000');assert.equal(options.policy.feePayer,'0.0.1');assert.deepEqual(JSON.parse(options.init.body),{scheduleId:'0.0.10',termsPointer:'hcs://0.0.11/1'});const tx='0.0.1@123.'+String(calls).padStart(9,'0');await options.checkpoint({transactionId:tx});assert.equal(store.account('session').actions[0].checks.at(-1).paymentTxId,tx);return{paid:true,response:{ok:true,json:async()=>({sourceKey:new URL(url).hostname.split('.')[0],triggered:false,verdict:'No matching event.',payment:{transaction:tx}})}};}};return{config,getCalls:()=>calls,done:()=>fs.rmSync(dir,{recursive:true,force:true})};}
test('manual check pays pinned sources only, journals first and never repays a repeated request',async()=>{const f=fixture();try{const r=await checkPolicy(f.config);assert.equal(r.checks.length,3);assert.equal(r.cost,.003);assert.ok(r.checks.every(r=>r.status==='no-match'));assert.equal((await checkPolicy(f.config)).cost,.003);assert.equal(f.getCalls(),3);assert.equal(latestPolicyCheck(f.config.demo.store,'42').status,'complete');const cached=await checkPolicy({...f.config,input:{requestId:'check-request-000002'}});assert.equal(cached.cached,true);assert.equal(f.getCalls(),3);}finally{f.done();}});
test('rejects caller-controlled conditions, mainnet and unverified policies without spending',async()=>{const f=fixture();try{for(const patch of[{network:'mainnet'},{input:{requestId:'check-request-000001',spec:{minMagnitude:0}}},{policy:{...f.config.policy,state:'paid'}},{policy:{...f.config.policy,ledger:{available:false}}}])await assert.rejects(checkPolicy({...f.config,...patch}));assert.equal(f.getCalls(),0);}finally{f.done();}});
test('lost paid responses remain reviewable and block fresh payments for that policy',async()=>{const f=fixture();try{let calls=0;const pay=async(_url,o)=>{calls++;await o.checkpoint({transactionId:'0.0.1@123.000000001'});throw Error('connection lost');};const r=await checkPolicy({...f.config,pay});assert.equal(r.needsReview,true);assert.ok(r.checks.every(r=>r.status==='needs-review'));await assert.rejects(checkPolicy({...f.config,pay,input:{requestId:'check-request-000002'}}),/payment review/);assert.equal(calls,3);}finally{f.done();}});
test('unreachable catalogues cast no vote and never imply a payment',async()=>{const f=fixture();try{const r=await checkPolicy({...f.config,pay:async()=>{throw Error('offline before payment');}});assert.equal(r.cost,0);assert.equal(r.needsReview,false);assert.ok(r.checks.every(r=>r.status==='unavailable'&&!r.paid));}finally{f.done();}});
test('a confirmed payment survives catalogue failure without claiming a negative vote or signature',async()=>{
 const f=fixture();try{
  const pay=async(url,o)=>{const tx='0.0.1@123.000000001';await o.checkpoint({transactionId:tx});return {paid:true,response:{ok:true,json:async()=>({sourceKey:new URL(url).hostname.split('.')[0],triggered:false,unavailable:true,verdict:'Catalogue unavailable.',payment:{transaction:tx},signature:{signed:true,transactionId:'untrusted'}})}};};
  const r=await checkPolicy({...f.config,pay});assert.equal(r.cost,.003);assert.equal(r.needsReview,false);
  assert.ok(r.checks.every(c=>c.status==='unavailable'&&c.paid&&!c.signatureTxId));
 }finally{f.done();}
});

test('a source that declines before settling is not paid and does not need review',async()=>{
 const f=fixture();try{
  // The oracle asks its catalogue before charging, so a source that cannot
  // answer returns 503 with the payment still unsubmitted.
  const pay=async(url,o)=>{await o.checkpoint({transactionId:'0.0.1@123.000000001'});
   return {paid:false,response:{ok:false,status:503,json:async()=>({error:'source_unavailable',sourceKey:new URL(url).hostname.split('.')[0],message:'Catalogue unavailable.'})}};};
  const r=await checkPolicy({...f.config,pay});
  assert.equal(r.cost,0,'nothing is charged for silence');
  assert.equal(r.needsReview,false,'an unsubmitted payment is not a receipt to reconcile');
  assert.ok(r.checks.every(c=>c.status==='unavailable'&&!c.paid&&!c.paymentTxId));
 }finally{f.done();}
});

test('a contradictory paid/unavailable response retains the original payment for review',async()=>{
 const f=fixture();try{
  const pay=async(url,o)=>{await o.checkpoint({transactionId:'0.0.1@123.000000001'});return {paid:true,response:{ok:false,status:503,json:async()=>({error:'source_unavailable',sourceKey:new URL(url).hostname.split('.')[0]})}};};
  const r=await checkPolicy({...f.config,pay});
  assert.equal(r.needsReview,true);assert.ok(r.checks.every(c=>c.status==='needs-review'&&c.paymentTxId));
 }finally{f.done();}
});
