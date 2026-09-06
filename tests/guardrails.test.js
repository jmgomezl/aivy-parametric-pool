import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PassThrough} from 'node:stream';
import {createWriteGuard,readLimits} from '../src/guards.js';
import {clientIp,readJsonBody,policyInput,requestPath} from '../src/http-safety.js';
import {validatePaymentTerms} from '../src/x402/payment-policy.js';
import {buildPayment,fetchPaid} from '../src/x402/client.js';
import {validateAttestationSpec,quorumReached} from '../src/oracle/attest.js';
const limits={perIpPerHour:1,policiesPerDay:2,usdPerDay:100};
test('write attempts persist across restarts, preserve seeded exposure, and roll off after 24 hours',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aivy-guard-'));let now=1788676000000;
 const options={directory,network:'testnet',limits,now:()=>now,seed:()=>[{recordedAt:new Date(now-1000).toISOString(),payoutUsd:20}]};
 try{let guard=createWriteGuard(options);guard.initialize();assert.equal(guard.budget().usd,20);assert.equal(guard.admit({ip:'1.2.3.4',usd:30}),null);
 guard=createWriteGuard(options);assert.equal(guard.budget().usd,50);assert.equal(guard.check({ip:'1.2.3.4',usd:1}).reason,'rate_limited');assert.equal(guard.check({ip:'4.3.2.1',usd:1}).reason,'daily_policy_cap');
 const raw=fs.readFileSync(path.join(directory,'write-budget-testnet.json'),'utf8');assert.ok(!raw.includes('1.2.3.4'));
 now+=86400001;assert.equal(guard.budget().policies,0);assert.equal(guard.admit({ip:'1.2.3.4',usd:101}).reason,'daily_cover_cap');
 fs.writeFileSync(path.join(directory,'write-budget-testnet.json'),'corrupt');assert.throws(()=>guard.admit({ip:'x',usd:1}),/paused/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('invalid limits fail at startup and mainnet remains disabled',()=>{
 for(const value of ['NaN','Infinity','-1','','1.2'])assert.throws(()=>readLimits({LIMIT_USD_DAY:value}),/Invalid/);
 assert.equal(readLimits({LIMIT_POLICIES_DAY:'0'}).policiesPerDay,0);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aivy-main-'));
 try{const g=createWriteGuard({directory,network:'mainnet',limits});assert.equal(g.admit({ip:'x',usd:1}).reason,'mainnet_writes_disabled');}finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('IP limits ignore forged client prefixes and untrusted peers',()=>{
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'1.1.1.1, 2.2.2.2'}};
 assert.equal(clientIp(req,true),'2.2.2.2');assert.equal(clientIp(req,false),'127.0.0.1');
 assert.equal(clientIp({...req,socket:{remoteAddress:'3.3.3.3'}},true),'3.3.3.3');
 assert.equal(requestPath({url:'/api/health',headers:{host:'invalid%host'}}),'/api/health');
});
test('JSON body bounds bytes and refuses malformed shapes',async()=>{
 for(const [raw,status]of [['null',400],['[]',400],['bad',400],['{"x":"'+ 'é'.repeat(5000)+'"}',413]]){const req=new PassThrough();const p=readJsonBody(req);req.end(raw);await assert.rejects(p,e=>e.status===status);}
 const req=new PassThrough();const p=readJsonBody(req);req.end('{"lat":4,"lon":-75}');assert.deepEqual(await p,{lat:4,lon:-75});
});
test('public issuance accepts only typed bounded inputs, not signing authority',()=>{
 const good={lat:4,lon:-75,requestId:'some-request-123456'};assert.equal(policyInput(good).budgetUsd,4);
 for(const extra of [{budgetUsd:'4'},{lat:true},{days:Infinity},{requestId:['some-request-123456']},{beneficiaryId:'0.0.999'},{scheduleId:'0.0.999'},{place:{text:'x'}}])assert.throws(()=>policyInput({...good,...extra}));
});
const policy={payTo:'0.0.1',feePayer:'0.0.2',asset:'0.0.3',maxAmount:'1000',resource:'https://oracle.example/attest'};
const terms={x402Version:2,scheme:'exact',network:'hedera:testnet',amount:'1000',payTo:policy.payTo,asset:policy.asset,resource:policy.resource,extra:{feePayer:policy.feePayer}};
test('untrusted 402 responses cannot change amount, recipient, asset, resource, or network',async()=>{
 assert.equal(validatePaymentTerms(terms,{network:'testnet',policy}),terms);
 for(const patch of [{amount:'1001'},{amount:'-1'},{payTo:'0.0.9'},{asset:'HBAR'},{resource:'https://evil.example'},{network:'hedera:mainnet'},{extra:{feePayer:'0.0.9'}}])await assert.rejects(buildPayment({requirements:{...terms,...patch},network:'testnet',policy}),/policy|budget/);
 await assert.rejects(buildPayment({requirements:terms,network:'testnet'}),/explicit payment policy/);
});
test('paid client refuses unknown resources before any network access',async()=>{
 await assert.rejects(fetchPaid('https://evil.example',{policy,network:'testnet'}),/not authorized/);
});
test('oracle query bounds reject invalid conditions and duplicate catalogue votes do not form quorum',()=>{
 const spec={lat:4,lon:-75,radiusKm:100,minMagnitude:6,maxDepthKm:70,windowStart:'2025-01-01',windowEnd:'2025-02-01'};
 assert.equal(validateAttestationSpec(spec).radiusKm,100);
 for(const patch of [{lat:'4&limit=9999'},{radiusKm:100000},{minMagnitude:NaN},{windowEnd:'2020-01-01'},{windowStart:'1970-01-01'}])assert.throws(()=>validateAttestationSpec({...spec,...patch}));
 assert.equal(quorumReached([{sourceKey:'usgs',triggered:true},{sourceKey:'usgs',triggered:true}]).reached,false);
 assert.equal(quorumReached([{sourceKey:'usgs',triggered:true},{sourceKey:'emsc',triggered:true}]).reached,true);
});
test('an ambiguous paid HTTP response never triggers a second payment',async()=>{
 const {PrivateKey}=await import('@hiero-ledger/sdk');const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;if(calls===1)return new Response(JSON.stringify({accepts:[terms]}),{status:402});throw new Error('lost after payment');};
 try{await assert.rejects(fetchPaid(policy.resource,{policy,network:'testnet',payerId:'0.0.9',payerKey:PrivateKey.generateED25519()}),/uncertain/);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
