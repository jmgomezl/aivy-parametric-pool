import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AccountId, PrivateKey } from '@hiero-ledger/sdk';
import { proto } from '@hiero-ledger/proto';
import { verifyScheduledTransfer, verifiedPolicy, readTermsMessage } from '../src/oracle/verify-policy.js';
import { termsMemo } from '../src/policy/binding.js';
import { scheduleState, readPolicies } from '../src/ledger.js';
import { issuePolicy } from '../src/policy/issue.js';
import { committedUnits, reservations, record } from '../src/book.js';
import { withIssuanceLock } from '../src/issuance-lock.js';

const key=()=>PrivateKey.generateED25519().publicKey.toStringRaw();
const agent=key(), oracleKeys=[key(),key(),key()];
const sig=key=>({public_key_prefix:Buffer.from(key,'hex').toString('base64')});
const now=Date.now();
const terms={version:1,network:'testnet',poolId:'0.0.100',beneficiaryId:'0.0.200',issuedAt:new Date(now-1000).toISOString(),lapsesAt:new Date(now+3600000).toISOString(),trigger:{location:{lat:4.53,lon:-75.68},minMagnitude:6,radiusKm:100,maxDepthKm:70},asset:{kind:'token',tokenId:'0.0.300'},settled:{payoutUnits:800000000}};
const transfer=(amount='800000000',beneficiary='200')=>proto.SchedulableTransactionBody.encode(proto.SchedulableTransactionBody.create({cryptoTransfer:{tokenTransfers:[{token:{tokenNum:'300'},transfers:[{accountID:{accountNum:'100'},amount:`-${amount}`},{accountID:{accountNum:beneficiary},amount}]}]}})).finish();
const schedule=()=>({memo:termsMemo(terms),expiration_time:String(Date.parse(terms.lapsesAt)/1000),signatures:[sig(agent)],wait_for_expiry:false,transaction_body:Buffer.from(transfer()).toString('base64')});
const identities={agentPublicKey:agent,oraclePublicKeys:oracleKeys,oracleSources:['usgs','emsc','geofon']};

test('oracle verifies a recorded policy and the exact transfer before signing',()=>{
  const spec=verifyScheduledTransfer(schedule(),terms,{poolId:terms.poolId,agentPublicKey:agent},now);
  assert.equal(spec.windowStart,terms.issuedAt);assert.equal(spec.minMagnitude,6);assert.equal(spec.windowEnd,new Date(now).toISOString());
});
test('oracle refuses a different beneficiary, amount, trigger, expiry, issuer, or completed schedule',()=>{
  for(const raw of [{...schedule(),transaction_body:Buffer.from(transfer('800000000','201')).toString('base64')},{...schedule(),transaction_body:Buffer.from(transfer('900000000')).toString('base64')},{...schedule(),memo:termsMemo({...terms,trigger:{...terms.trigger,minMagnitude:5}})},{...schedule(),expiration_time:String((now+60000)/1000)},{...schedule(),signatures:[sig(oracleKeys[0])]},{...schedule(),executed_timestamp:String(now/1000)}])assert.throws(()=>verifyScheduledTransfer(raw,terms,{poolId:terms.poolId,agentPublicKey:agent},now));
  assert.throws(()=>verifyScheduledTransfer(schedule(),{...terms,version:undefined},{poolId:terms.poolId,agentPublicKey:agent},now),/Legacy/);
});
test('terms pointer cannot select an untrusted topic',async()=>{
  let calls=0;await assert.rejects(verifiedPolicy({network:'testnet',scheduleId:'0.0.123',termsPointer:'hcs://0.0.999/1',termsTopicId:'0.0.777',poolId:terms.poolId,fetcher:()=>{calls++;}}),/configured policy topic/);assert.equal(calls,0);
});
test('signatures identify actual keys, not list position or duplicate count',()=>{
  const state=scheduleState({...schedule(),signatures:[sig(agent),sig(oracleKeys[2]),sig(oracleKeys[2]),sig(key())]},identities,now);
  assert.deepEqual(state.ledger.oracles.map(o=>[o.name,o.signed]),[['USGS ComCat',false],['EMSC',false],['GEOFON',true]]);assert.equal(state.state,'confirming');
  assert.equal(scheduleState({...schedule(),executed_timestamp:String(now/1000)},identities,now).state,'paid');
});
test('unavailable ledger is not reported as unsigned, active, or paid',async()=>{
  const rows=await readPolicies('testnet',[{serial:'1',scheduleId:'0.0.999',lapsesAt:terms.lapsesAt}],identities,{fetcher:async()=>{throw new Error('offline');},cacheMs:0});assert.equal(rows[0].state,'unavailable');assert.equal(rows[0].ledger.available,false);
});

test('concurrent issuance cannot promise the same capital; replay is idempotent; failures retain reservations',async()=>{
  const cwd=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'aivy-issuance-'));process.chdir(dir);
  try{
    let created=0,minted=0;
    record('testnet',{serial:'legacy',payoutHbar:1000,lapsesAt:terms.lapsesAt,settled:false});
    const quote={ok:true,premium:4,payout:80,hazard:{triggerRadiusKm:100},settled:{payoutUnits:80,premiumUnits:4,premium:4,payout:80,symbol:'aUSDd'},asset:{kind:'token',tokenId:'0.0.300',decimals:6,symbol:'aUSDd'}};
    const deps={network:'testnet',client:{},agent:{id:AccountId.fromString('0.0.1')},poolId:AccountId.fromString('0.0.100'),policyTokenId:'0.0.2',termsTopicId:'0.0.3',createBuyer:async()=>{created++;return{id:AccountId.fromString('0.0.200')};},operations:{
      price:async()=>quote,check:async(c,p,committed,requested)=>{await new Promise(r=>setTimeout(r,20));return {ok:committed+requested<=100,reason:'capacity'};},publish:async()=>({pointer:'hcs://0.0.3/1'}),mint:async()=>({serial:String(++minted),txId:'mint-receipt'}),purchase:async()=>({txId:'sale'}),deliver:async()=>({transferTxId:'delivery-receipt',freezeTxId:'freeze-receipt'}),schedule:async()=>({scheduleId:'0.0.4'})}};
    const input={lat:4,lon:-75,requestId:'first-request-12345'};
    const refused=await issuePolicy({...deps,beforeLedgerWrite:()=>({reason:'daily_cover_cap'})},{...input,requestId:'budget-denied-12345'});
    assert.equal(refused.reason,'daily_cover_cap');assert.equal(created,0);assert.equal(reservations('testnet').length,0);
    const results=await Promise.all([issuePolicy(deps,input),issuePolicy(deps,{...input,requestId:'second-request-12345'})]);
    assert.equal(results.filter(r=>r.ok).length,1);assert.equal(created,1);assert.equal(committedUnits('testnet',quote.asset),80);
    const winner=results[0].ok?input:{...input,requestId:'second-request-12345'};
    const duplicate=await issuePolicy(deps,winner);assert.equal(duplicate.reused,true);assert.equal(created,1);assert.deepEqual(duplicate.policy.receipts,{mint:'mint-receipt',delivery:'delivery-receipt',freeze:'freeze-receipt'});
    const failing={...deps,network:'failure',operations:{...deps.operations,purchase:async()=>{throw new Error('receipt interrupted');}}};
    await assert.rejects(issuePolicy(failing,input),/receipt interrupted/);assert.equal(reservations('failure').length,1);assert.equal(committedUnits('failure',quote.asset),80);
    const retry=await issuePolicy(failing,input);assert.equal(retry.reason,'pending_recovery');assert.equal(created,2);
  }finally{process.chdir(cwd);fs.rmSync(dir,{recursive:true,force:true});}
});
test('an abandoned issuance lock fails closed',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aivy-lock-'));fs.writeFileSync(path.join(directory,'issuance-testnet.lock'),'interrupted');
  try{await assert.rejects(withIssuanceLock('testnet',()=>assert.fail('must not issue'),{directory,timeoutMs:0}),/recovery/);}finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('an issuance lock left by a dead process is reclaimed, an unreadable one is not',async()=>{
  // pm2's memory ceiling, a crash or a deploy restart can kill the agent while
  // it holds the lock. Before this, every later issuance failed until someone
  // deleted the file by hand.
  const {spawnSync}=await import('node:child_process');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aivy-stale-'));
  const lock=path.join(directory,'issuance-testnet.lock');
  try{
    const dead=spawnSync(process.execPath,['-e','']).pid;   // exited: this pid is gone
    fs.writeFileSync(lock,JSON.stringify({pid:dead,startedAt:new Date().toISOString()}));
    assert.equal(await withIssuanceLock('testnet',async()=>'issued',{directory,timeoutMs:0}),'issued');
    assert.equal(fs.existsSync(lock),false,'the reclaimed lock is released again on completion');

    // A live owner still blocks, even with no time to wait.
    fs.writeFileSync(lock,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
    await assert.rejects(withIssuanceLock('testnet',()=>assert.fail('must not issue'),{directory,timeoutMs:0}),/recovery/);
    fs.unlinkSync(lock);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('chunked HCS terms are reassembled without mixing another transaction',async()=>{
  const raw=JSON.stringify(terms),encode=s=>Buffer.from(s).toString('base64');
  const chunk_info={number:1,total:2,initial_transaction_id:{account_id:'0.0.1',transaction_valid_start:'123.4'}};
  const first={sequence_number:10,chunk_info,message:encode(raw.slice(0,100))};
  const last={sequence_number:11,chunk_info:{...chunk_info,number:2},message:encode(raw.slice(100))};
  const unrelated={...last,chunk_info:{...last.chunk_info,initial_transaction_id:{account_id:'0.0.2',transaction_valid_start:'123.4'}},message:encode('untrusted')};
  const fetcher=async url=>({ok:true,json:async()=>({messages:String(url).includes('order=asc')?[unrelated,last]:[],links:{next:null}})});
  assert.deepEqual(await readTermsMessage('testnet','0.0.3',first,fetcher),terms);
  await assert.rejects(readTermsMessage('testnet','0.0.3',first,async()=>({ok:true,json:async()=>({messages:[unrelated]})})),/incomplete/);
});

test('terms whose chunks reached consensus out of order are still readable',async()=>{
  // Observed on testnet: chunk 2 of policy 26 reached consensus 156ms before
  // chunk 1, so a forward-only scan could never reassemble it.
  const raw=JSON.stringify(terms),encode=s=>Buffer.from(s).toString('base64');
  const chunk_info={number:1,total:2,initial_transaction_id:{account_id:'0.0.1',transaction_valid_start:'123.4'}};
  const first={sequence_number:48,chunk_info,message:encode(raw.slice(0,100))};
  const earlier={sequence_number:47,chunk_info:{...chunk_info,number:2},message:encode(raw.slice(100))};
  const queried=[];
  const fetcher=async(url)=>{queried.push(String(url));return{ok:true,json:async()=>({messages:String(url).includes('order=desc')?[earlier]:[],links:{next:null}})};};
  assert.deepEqual(await readTermsMessage('testnet','0.0.3',first,fetcher),terms);
  assert.ok(queried.some(url=>url.includes('sequencenumber=lt:48')&&url.includes('order=desc')),'search before the pointer without assuming contiguous chunks');
});

test('concurrent policy and pool refreshes share one ledger request per schedule',async()=>{
 let calls=0;const fetcher=async()=>{calls++;await new Promise(r=>setTimeout(r,20));return{ok:true,json:async()=>schedule()};};
 const book=[{serial:'qa',scheduleId:'0.0.999991',lapsesAt:terms.lapsesAt}];
 const [a,b]=await Promise.all([readPolicies('testnet',book,identities,{fetcher,cacheMs:0}),readPolicies('testnet',book,identities,{fetcher,cacheMs:0})]);assert.equal(calls,1);assert.equal(a[0].ledger.available,true);assert.equal(b[0].state,'active');
});
