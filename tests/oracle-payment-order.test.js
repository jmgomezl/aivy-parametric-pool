import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountId,Hbar,TransferTransaction,TransactionId} from '@hiero-ledger/sdk';
import {charge,requirements} from '../src/x402/gate.js';
const terms=requirements({amount:'1000000',asset:'HBAR',payTo:'0.0.1003',feePayer:'0.0.1001',network:'hedera:testnet',resource:'https://usgs.example/attest'});
function header(patch={}){
 const tx=new TransferTransaction().setMaxTransactionFee(new Hbar(1)).setTransactionId(TransactionId.generate('0.0.1001')).setNodeAccountIds([AccountId.fromString('0.0.3')]).addHbarTransfer('0.0.1002',Hbar.fromTinybars(-1000000)).addHbarTransfer('0.0.1003',Hbar.fromTinybars(1000000)).freeze();
 return Buffer.from(JSON.stringify({x402Version:2,scheme:'exact',network:'hedera:testnet',payload:{transaction:Buffer.from(tx.toBytes()).toString('base64')},...patch})).toString('base64');
}
function fixture(extra={}){
 const events=[];
 return {events,input:{header:header(),terms,network:'testnet',beforeSettle:async()=>{events.push('catalogue');},...extra},deps:{settlePayment:async()=>{events.push('settle');return {success:true,transaction:'0.0.1001@123.4'};},publishReceipt:()=>events.push('receipt')}};
}
test('missing, malformed and mismatched payment headers never query or settle',async()=>{
 for(const raw of [undefined,'not-json',Buffer.from('{}').toString('base64'),header({network:'hedera:mainnet'}),header({scheme:'other'}),header({x402Version:1}),header({network:undefined}),header({scheme:undefined})]){
  const f=fixture({header:raw}),r=await charge(f.input,f.deps);
  assert.equal(r.paid,false);assert([400,402].includes(r.status));assert.deepEqual(f.events,[]);
 }
 const f=fixture({terms:{...terms,amount:'2000000'}});assert.equal((await charge(f.input,f.deps)).paid,false);assert.deepEqual(f.events,[]);
});
test('an unavailable catalogue declines without settlement or a payment receipt',async()=>{
 const f=fixture();f.input.beforeSettle=async()=>{f.events.push('catalogue');return {status:503,body:{error:'source_unavailable',sourceKey:'usgs'}};};
 const r=await charge(f.input,f.deps);assert.equal(r.status,503);assert.equal(r.paid,false);assert.deepEqual(f.events,['catalogue']);assert.equal(r.settlement,undefined);
});
test('a successful query is paid before the gate permits its result to be served',async()=>{
 const f=fixture(),r=await charge(f.input,f.deps);assert.equal(r.paid,true);assert.equal(r.settlement.transaction,'0.0.1001@123.4');assert.deepEqual(f.events,['catalogue','settle','receipt']);
});
test('query errors or failed settlement never open the gate',async()=>{
 const f=fixture();f.input.beforeSettle=async()=>{f.events.push('catalogue');throw Error('read failed');};
 await assert.rejects(charge(f.input,f.deps),/read failed/);assert.deepEqual(f.events,['catalogue']);
 const g=fixture();g.deps.settlePayment=async()=>{g.events.push('settle');return {success:false,errorReason:'declined'};};
 const r=await charge(g.input,g.deps);assert.equal(r.paid,false);assert.equal(r.status,402);assert.deepEqual(g.events,['catalogue','settle']);assert.equal(r.attestation,undefined);
});
