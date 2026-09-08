import test from 'node:test';
import assert from 'node:assert/strict';
import {charge} from '../src/x402/gate.js';
import {verifyAuthorization} from '../src/x402/facilitator.js';
import {terms as makeTerms,payment,header,payerFetcher} from './fixtures/x402-payment.js';
const terms=makeTerms('HBAR');
async function fixture(extra={}){
 const events=[];
 return {events,input:{header:header(await payment()),terms,network:'testnet',beforeSettle:async()=>{events.push('catalogue');},...extra},deps:{verifyPayment:(p,t,options)=>verifyAuthorization(p,t,{...options,fetcher:payerFetcher()}),settlePayment:async()=>{events.push('settle');return {success:true,transaction:'0.0.1001@123.4'};},publishReceipt:()=>events.push('receipt')}};
}
test('missing, malformed and mismatched payment headers never query or settle',async()=>{
 const signed=await payment();
 const invalid=[undefined,'not-json',Buffer.from('{}').toString('base64'),...([{network:'hedera:mainnet'},{scheme:'other'},{x402Version:1},{network:undefined},{scheme:undefined}].map(patch=>header({...signed,...patch})))];
 for(const raw of invalid){const f=await fixture({header:raw}),r=await charge(f.input,f.deps);assert.equal(r.paid,false);assert([400,402].includes(r.status));assert.deepEqual(f.events,[]);}
 const f=await fixture({terms:{...terms,amount:'2000000'}});assert.equal((await charge(f.input,f.deps)).paid,false);assert.deepEqual(f.events,[]);
});
test('an unavailable catalogue declines without settlement or a payment receipt',async()=>{
 const f=await fixture();f.input.beforeSettle=async()=>{f.events.push('catalogue');return {status:503,body:{error:'source_unavailable',sourceKey:'usgs'}};};
 const r=await charge(f.input,f.deps);assert.equal(r.status,503);assert.equal(r.paid,false);assert.deepEqual(f.events,['catalogue']);assert.equal(r.settlement,undefined);
});
test('a successful query is paid before the gate permits its result to be served',async()=>{
 const f=await fixture(),r=await charge(f.input,f.deps);assert.equal(r.paid,true);assert.equal(r.settlement.transaction,'0.0.1001@123.4');assert.deepEqual(f.events,['catalogue','settle','receipt']);
});
test('query errors or failed settlement never open the gate',async()=>{
 const f=await fixture();f.input.beforeSettle=async()=>{f.events.push('catalogue');throw Error('read failed');};
 await assert.rejects(charge(f.input,f.deps),/read failed/);assert.deepEqual(f.events,['catalogue']);
 const g=await fixture();g.deps.settlePayment=async()=>{g.events.push('settle');return {success:false,errorReason:'declined'};};
 const r=await charge(g.input,g.deps);assert.equal(r.paid,false);assert.equal(r.status,402);assert.deepEqual(g.events,['catalogue','settle']);assert.equal(r.attestation,undefined);
});
