// Read-only public evidence check. No environment file, wallet, signer or write API.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mirrorGet, readTokenBalance} from '../src/ledger.js';
import {readTermsMessage, verifyScheduledTransfer} from '../src/oracle/verify-policy.js';

const serial = process.argv[2] ?? '34';
assert.match(serial, /^\d{1,10}$/);
const network = 'testnet', api = 'https://quorum.aivylabs.xyz/api';
const observations = [];
async function publicGet(path) {
  const r = await fetch(api + path, {signal:AbortSignal.timeout(10000)});
  assert.ok(r.ok, `Public API ${r.status}`);
  return r.json();
}
const [policy, pool] = await Promise.all([publicGet(`/policies/${serial}`), publicGet('/pool')]);
assert.equal(policy.network, network); assert.equal(pool.network, network);
assert.equal(policy.settlementAsset.tokenId, pool.asset.tokenId);
const [,topicId,sequence] = /^hcs:\/\/(\d+\.\d+\.\d+)\/(\d+)$/.exec(policy.termsPointer) ?? [];
assert.ok(topicId, 'Policy must point to HCS terms');
const transactionId = policy.saleTxId.replace('@','-').replace(/\.(\d+)$/,'-$1');
const [schedule, first, topic, nft, transfer, capital] = await Promise.all([
  mirrorGet(network, `/schedules/${policy.scheduleId}`),
  mirrorGet(network, `/topics/${topicId}/messages/${sequence}`),
  mirrorGet(network, `/topics/${topicId}`),
  mirrorGet(network, `/tokens/${pool.policyTokenId}/nfts/${serial}`),
  mirrorGet(network, `/transactions/${transactionId}`),
  readTokenBalance(network, pool.poolAccountId, pool.asset.tokenId),
]);
const terms = await readTermsMessage(network, topicId, first);
assert.equal(terms.network, network); assert.equal(topic.deleted, false);
// Verify the originally committed transfer at issuance; report today's execution separately.
// This keeps the receipt check useful after a policy's cover window has ended.
assert.equal(schedule.schedule_id, policy.scheduleId);
verifyScheduledTransfer({...schedule, deleted:false, executed_timestamp:null}, terms,
  {poolId:pool.poolAccountId, agentPublicKey:topic.submit_key.key}, Date.parse(policy.recordedAt));
observations.push({check:'HCS terms match the pre-signed transfer', network, scheduleId:policy.scheduleId,
  termsPointer:policy.termsPointer, executedTimestamp:schedule.executed_timestamp, deleted:schedule.deleted,
  signatures:schedule.signatures.length, payoutUnits:terms.settled.payoutUnits});
assert.equal(nft.account_id, policy.buyerId);
assert.equal(Buffer.from(nft.metadata,'base64').toString('utf8'), policy.termsPointer);
observations.push({check:'Cover NFT owner and HCS pointer',network,tokenId:pool.policyTokenId,serial,owner:nft.account_id});
const paid = transfer.transactions.find(t => t.transaction_id===transactionId && t.result==='SUCCESS' &&
  t.name==='CRYPTOTRANSFER' && !t.scheduled && (t.nonce??0)===0);
assert.ok(paid, 'Premium receipt must be an actual successful transfer');
assert.ok(paid.token_transfers.some(t => t.token_id===pool.asset.tokenId && t.account===pool.poolAccountId &&
  BigInt(t.amount)===BigInt(policy.premiumUnits) - (policy.brokerId?BigInt(Math.round(policy.premiumUnits*.15)):0n)));
observations.push({check:'Premium arrived in the pool',network,transactionId,consensusTimestamp:paid.consensus_timestamp});
observations.push({check:'Filtered pool token balance',network,accountId:pool.poolAccountId,tokenId:pool.asset.tokenId,units:String(capital)});

const record = JSON.parse(fs.readFileSync(new URL('../ui/src/data/mainnet.json',import.meta.url),'utf8'));
const historical = await mirrorGet('mainnet', `/schedules/${record.payout.scheduleId}`);
assert.equal(historical.executed_timestamp,record.payout.executedConsensus);
const originalId=record.payout.createTxId.replace('@','-').replace(/\.(\d+)$/,'-$1');
const result=await mirrorGet('mainnet',`/transactions/${originalId}`);
const executed=result.transactions.find(t=>t.scheduled && t.consensus_timestamp===historical.executed_timestamp && t.result==='SUCCESS');
assert.ok(executed);
for(const [account,amount] of [[record.accounts.pool.id,-400000000n],[record.accounts.buyer.id,400000000n]]) {
  assert.ok(executed.transfers.some(t=>t.account===account && BigInt(t.amount)===amount));
}
observations.push({check:'Recorded 4 HBAR payout still verifiable',network:'mainnet',scheduleId:record.payout.scheduleId,
  executedTimestamp:historical.executed_timestamp,recordedDemonstration:true});
console.log(JSON.stringify({checkedAt:new Date().toISOString(),mode:'read-only',policySerial:serial,observations},null,2));
