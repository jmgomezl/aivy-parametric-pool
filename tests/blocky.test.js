import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createBlockyFacilitator,blockyEnvelope,BLOCKY_URL,BLOCKY_FEE_PAYER} from '../src/x402/blocky.js';
import {verifyAuthorization,decodePayment} from '../src/x402/facilitator.js';
import {charge} from '../src/x402/gate.js';
import {payment,terms as makeTerms,TOKEN,PAYER,payerFetcher,header} from './fixtures/x402-payment.js';
const terms={...makeTerms(TOKEN),extra:{feePayer:BLOCKY_FEE_PAYER}};
const supported={kinds:[{x402Version:2,scheme:'exact',network:'hedera:testnet',extra:{feePayer:BLOCKY_FEE_PAYER}}],signers:{'hedera:*':[BLOCKY_FEE_PAYER]}};
async function fixture(override={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'quorum-blocky-')),events=[];
 const payload=await payment({asset:TOKEN,feePayer:BLOCKY_FEE_PAYER}),tx=decodePayment(payload).transactionId.toString();
 const fetcher=async(url,options)=>{
  assert(url.startsWith(BLOCKY_URL+'/'));assert.equal(options.redirect,'error');assert(options.signal);events.push(url.slice(BLOCKY_URL.length));
  if(options.body){const body=JSON.parse(options.body);assert.equal(body.x402Version,2);assert.deepEqual(body.paymentPayload.accepted,body.paymentRequirements);assert.equal(body.paymentRequirements.extra.feePayer,BLOCKY_FEE_PAYER);}
  const route=url.slice(BLOCKY_URL.length);if(override[route])return override[route](url,options);
  return {ok:true,json:async()=>route==='/supported'?supported:route==='/verify'?{isValid:true,payer:PAYER}:{success:true,transaction:tx,network:'hedera:testnet',payer:PAYER}};
 };
 const options={directory,fetcher,verifyLocal:(p,t,o)=>verifyAuthorization(p,t,{...o,fetcher:payerFetcher()})};
 return {payload,tx,events,options,blocky:createBlockyFacilitator(options),done:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
test('Blocky verification, catalogue and settlement precede publication; no local fee signer is supplied',async()=>{
 const f=await fixture();try{assert.deepEqual(Object.keys(blockyEnvelope({...f.payload,payload:{...f.payload.payload,privateKey:'never-forward'}},terms).paymentPayload.payload),['transaction']);const r=await charge({header:header(f.payload),terms,network:'testnet',beforeSettle:()=>{f.events.push('catalogue');}},{verifyPayment:f.blocky.verify,settlePayment:f.blocky.settle,publishReceipt:r=>{assert.equal(r.facilitator.name,'Blocky402');f.events.push('receipt');}});assert(r.paid);assert.equal(r.settlement.transaction,f.tx);assert.deepEqual(f.events,['/supported','/verify','catalogue','/settle','receipt']);
 const entries=fs.readdirSync(path.join(f.options.directory,'blocky-payments-testnet'));const journal=JSON.parse(fs.readFileSync(path.join(f.options.directory,'blocky-payments-testnet',entries[0])));assert.equal(journal.status,'confirmed');assert(!JSON.stringify(journal).includes(f.payload.payload.transaction));
 }finally{f.done();}
});
test('wrong network/fee payer, unsigned payload or changed advertised signer never reach settlement',async()=>{
 const f=await fixture({'/supported':async()=>({ok:true,json:async()=>({...supported,signers:{'hedera:*':['0.0.9999']}})})});try{
 assert.throws(()=>createBlockyFacilitator({network:'mainnet'}));assert.throws(()=>blockyEnvelope(f.payload,{...terms,extra:{feePayer:'0.0.9'}}));
 const unsigned=await payment({asset:TOKEN,feePayer:BLOCKY_FEE_PAYER,signed:false});assert.equal((await f.blocky.verify(unsigned,terms)).invalidReason,'missing_payer_signature');assert.deepEqual(f.events,[]);
 assert.equal((await f.blocky.verify(f.payload,terms)).invalidReason,'blocky_unavailable');assert.deepEqual(f.events,['/supported']);
 }finally{f.done();}
});
test('Blocky verification refusal never queries a catalogue or publishes a receipt',async()=>{
 const f=await fixture({'/verify':async()=>({ok:true,json:async()=>({isValid:false})})});try{
 const r=await charge({header:header(f.payload),terms,network:'testnet',beforeSettle:()=>assert.fail('catalogue')},{verifyPayment:f.blocky.verify,settlePayment:f.blocky.settle,publishReceipt:()=>assert.fail('receipt')});assert(!r.paid);assert.deepEqual(f.events,['/supported','/verify']);
 }finally{f.done();}
});
test('settlement timeout and mismatched receipts retain the attempt and never fall back or resend after restart',async()=>{
 for(const response of [async()=>{throw Error('timeout after broadcast');},async()=>({ok:true,json:async()=>({success:true,transaction:'0.0.9999@123.1',network:'hedera:testnet'})})]){
  const f=await fixture({'/settle':response});try{
   assert.equal((await f.blocky.settle(f.payload,terms)).errorReason,'payment_outcome_uncertain');
   const restarted=createBlockyFacilitator(f.options);assert.equal((await restarted.settle(f.payload,terms)).errorReason,'payment_already_attempted');assert.equal(f.events.filter(x=>x==='/settle').length,1);
  }finally{f.done();}
 }
});
test('independent concurrent adapters can send a transaction to Blocky at most once',async()=>{
 const f=await fixture();try{const other=createBlockyFacilitator(f.options);const results=await Promise.all([f.blocky.settle(f.payload,terms),other.settle(f.payload,terms)]);assert.equal(results.filter(r=>r.success).length,1);assert.equal(f.events.filter(x=>x==='/settle').length,1);}finally{f.done();}
});
