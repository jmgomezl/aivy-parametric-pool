import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateKey} from '@hiero-ledger/sdk';
import {proto} from '@hiero-ledger/proto';
import {verifyAuthorization,settle} from '../src/x402/facilitator.js';
import {charge} from '../src/x402/gate.js';
import {PAYER,TOKEN,payerKey,terms,payment,header,payerFetcher} from './fixtures/x402-payment.js';
const verify=(p,t=terms('HBAR'),fetcher=payerFetcher())=>verifyAuthorization(p,t,{network:'testnet',fetcher});

test('payer authorization verifies ED25519 and ECDSA signatures on every node body, with actual HBAR or token funds',async()=>{
 for(const type of ['ED25519','ECDSA_SECP256K1'])for(const asset of ['HBAR',TOKEN]){
  const key=type==='ED25519'?payerKey:PrivateKey.generateECDSA();
  const result=await verify(await payment({key,asset}),terms(asset),payerFetcher({key,type}));
  assert.equal(result.isValid,true);assert.equal(result.payer,PAYER);
 }
});
test('unsigned and expired payments do not even read the payer account',async()=>{
 const events=[],fetcher=payerFetcher({events});
 for(const options of [{signed:false},{start:Date.now()-240000},{start:Date.now()+60000}]){
  assert.equal((await verify(await payment(options),terms('HBAR'),fetcher)).isValid,false);
 }
 assert.deepEqual(events,[]);
});
test('an unrelated signer or a damaged signature cannot authorize the debit account',async()=>{
 assert.equal((await verify(await payment({key:PrivateKey.generateED25519()}))).invalidReason,'invalid_payer_signature');
 const payload=await payment(),list=proto.TransactionList.decode(Buffer.from(payload.payload.transaction,'base64'));
 const second=proto.SignedTransaction.decode(list.transactionList[1].signedTransactionBytes);
 second.sigMap.sigPair[0].ed25519[0]^=1;
 list.transactionList[1].signedTransactionBytes=proto.SignedTransaction.encode(second).finish();
 payload.payload.transaction=Buffer.from(proto.TransactionList.encode(list).finish()).toString('base64');
 assert.equal((await verify(payload)).invalidReason,'invalid_payer_signature');
});
test('wrong/deleted accounts, unsupported keys, insufficient funds and restricted tokens fail closed',async()=>{
 const payload=await payment();
 for(const options of [{account:'0.0.9999'},{deleted:true},{type:'ProtobufEncoded'},{balance:999999}])assert.equal((await verify(payload,terms('HBAR'),payerFetcher(options))).isValid,false);
 const tokenPayment=await payment({asset:TOKEN});
 for(const options of [{balance:999999},{freeze_status:'FROZEN'},{kyc_status:'REVOKED'},{token:'0.0.9999'}])assert.equal((await verify(tokenPayment,terms(TOKEN),payerFetcher(options))).isValid,false);
 const unavailable=await verify(payload,terms('HBAR'),async()=>{throw Error('offline');});assert.equal(unavailable.invalidReason,'payer_verification_unavailable');
 assert.equal((await verifyAuthorization(payload,terms('HBAR'),{network:'mainnet',fetcher:payerFetcher()})).invalidReason,'network_mismatch');
});
test('payer lookup concurrency is bounded and released after failure',async()=>{
 let release,started=0;const blocked=new Promise(resolve=>release=resolve);
 const fetcher=async()=>{started++;await blocked;throw Error('offline');};
 const payload=await payment();const pending=Array.from({length:8},()=>verify(payload,terms('HBAR'),fetcher));
 assert.equal((await verify(payload,terms('HBAR'),fetcher)).invalidReason,'payer_verification_unavailable');assert.equal(started,8);
 release();await Promise.all(pending);assert.equal((await verify(payload)).isValid,true);
});
test('invalid authorization cannot query, publish a receipt or reach the fee signer',async()=>{
 for(const options of [{signed:false},{key:PrivateKey.generateED25519()}]){
  const payload=await payment(options),events=[];
  const result=await charge({header:header(payload),terms:terms('HBAR'),network:'testnet',beforeSettle:async()=>events.push('catalogue')},{verifyPayment:(p,t)=>verify(p,t),settlePayment:async()=>{events.push('settle');},publishReceipt:()=>events.push('receipt')});
  assert.equal(result.paid,false);assert.equal(result.status,402);assert.deepEqual(events,[]);
 }
 // No valid facilitator key is passed: rejection must happen before signer construction.
 assert.equal((await settle(await payment({signed:false}),terms('HBAR'),{network:'testnet'})).errorReason,'missing_payer_signature');
});
