// Read-only verification of the monthly-canvas capture; never starts a purchase.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const kit=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source=process.env.QUORUM_COVER_AGENT_EVIDENCE||path.join(kit,'cover-agent-evidence.json');
const recorded=JSON.parse(await fs.readFile(source,'utf8'));
const m=recorded.mandate,p=m.attempts.find(a=>a.status==='complete').policy;
const base='https://testnet.mirrornode.hedera.com/api/v1';
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});assert(r.ok,`HTTP ${r.status}: ${url}`);return r.json();}
const slug=id=>id.replace('@','-').replace(/\.(\d+)$/,'-$1');
const transactions=await Promise.all(Object.entries({premium:p.saleTxId,...p.receipts}).map(async([role,id])=>{
 const url=`${base}/transactions/${slug(id)}`,data=await get(url),tx=data.transactions.find(t=>t.result==='SUCCESS');assert(tx,`${role} must have a successful receipt`);
 return {role,id,status:tx.result,type:tx.name,consensusTimestamp:tx.consensus_timestamp,tokenTransfers:tx.token_transfers,nftTransfers:tx.nft_transfers,source:url,explorer:`https://hashscan.io/testnet/transaction/${slug(id)}`};
}));
const premium=transactions.find(t=>t.role==='premium');assert(premium.tokenTransfers.some(t=>t.account===p.beneficiaryId&&t.token_id==='0.0.10374011'&&t.amount===-10000000));
assert(transactions.find(t=>t.role==='delivery').nftTransfers.some(t=>String(t.serial_number)===p.serial&&t.receiver_account_id===p.beneficiaryId));
const schedule=await get(`${base}/schedules/${p.scheduleId}`);assert.equal(schedule.executed_timestamp,null);assert(schedule.signatures.length>=1);
const policy=await get(`https://quorum.aivylabs.xyz/api/policies/${p.serial}`);assert.equal(policy.premiumUnits,10000000);assert(policy.payoutUnits>=800000000);assert.equal(policy.trigger.minMagnitude,6);assert.equal(policy.trigger.radiusKm,100);assert.equal(policy.trigger.maxDepthKm,70);assert.equal(policy.ledger.agentSigned,true);
const topic=p.termsPointer.match(/^hcs:\/\/([^/]+)\/(\d+)$/);assert(topic);const terms=await get(`${base}/topics/${topic[1]}/messages/${topic[2]}`);assert.equal(String(terms.sequence_number),topic[2]);
const result={...recorded,verifiedAt:new Date().toISOString(),transactions,schedule:{id:p.scheduleId,executedAt:schedule.executed_timestamp,signatures:schedule.signatures.length,expirationTime:schedule.expiration_time,source:`${base}/schedules/${p.scheduleId}`},policy,terms:{pointer:p.termsPointer,consensusTimestamp:terms.consensus_timestamp,source:`${base}/topics/${topic[1]}/messages/${topic[2]}`}};
await fs.writeFile(path.join(kit,'cover-agent-evidence.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({policy:p.serial,confirmedReceipts:transactions.length,conditionalPayout:p.payout,agentSigned:policy.ledger.agentSigned,executedAt:schedule.executed_timestamp,nextPlanned:m.nextDueAt}));
