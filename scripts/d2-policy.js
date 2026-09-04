// D2 gate: price a real policy from the USGS catalogue, publish its terms to HCS,
// mint a non-transferable policy NFT pointing at them, and settle the premium
// atomically across buyer, pool and an arbitrary broker.
import fs from 'node:fs';
import {
  AccountCreateTransaction, TokenAssociateTransaction, Hbar, PrivateKey,
  AccountId, AccountBalanceQuery, TokenId,
} from '@hiero-ledger/sdk';
import { client, operator, assertOperatorKey, HASHSCAN, NETWORK } from '../src/config.js';
import { annualRate, quote } from '../src/pricing/hazard.js';
import { createPolicyTopic, publishTerms, triggerSpec } from '../src/policy/terms.js';
import { createPolicyCollection, mintPolicy, deliverAndFreeze } from '../src/policy/collection.js';
import { purchasePolicy } from '../src/policy/purchase.js';

const LOCATION = { name: 'Armenia, Quindio, Colombia', lat: 4.53, lon: -75.68 };
const PAYOUT_HBAR = 40;   // small-scale stand-in for the $800 cover
const DAYS = 30;
const log = (s) => console.log(s);

async function newAccount(c, hbar) {
  const key = PrivateKey.generateECDSA();
  const res = await new AccountCreateTransaction()
    .setKeyWithoutAlias(key.publicKey).setInitialBalance(new Hbar(hbar)).execute(c);
  return { id: (await res.getReceipt(c)).accountId, key };
}

async function main() {
  await assertOperatorKey();
  const c = client();
  const agent = operator();
  const d1 = JSON.parse(fs.readFileSync('.artifacts/d1.json', 'utf8'));
  const poolId = AccountId.fromString(d1.poolAccountId);
  log(`network: ${NETWORK}   pool: ${poolId}\n`);

  // 1. Underwrite: the premium comes from the live catalogue, not a constant.
  const hazard = await annualRate({ lat: LOCATION.lat, lon: LOCATION.lon });
  const q = quote({ lambda: hazard.lambda, payout: PAYOUT_HBAR, days: DAYS });
  log(`1. underwriting ${LOCATION.name}`);
  log(`   n=${hazard.count} over ${hazard.years.toFixed(1)}y  lambda=${hazard.lambda.toFixed(4)}/yr`);
  log(`   P(${DAYS}d)=${(q.probability * 100).toFixed(3)}%  premium=${q.premium.toFixed(4)} HBAR for ${PAYOUT_HBAR} HBAR cover`);

  // 2. Terms to HCS, so the premium is reproducible from the record.
  const topic = await createPolicyTopic(c, agent.key);
  const terms = {
    trigger: triggerSpec({ ...LOCATION, radiusKm: hazard.triggerRadiusKm, minMagnitude: 6, maxDepthKm: 70, days: DAYS }),
    premiumHbar: Number(q.premium.toFixed(8)), payoutHbar: PAYOUT_HBAR,
    hazard, lossRatio: q.lossRatio, issuedAt: new Date().toISOString(),
  };
  const published = await publishTerms(c, topic.topicId, terms);
  log(`\n2. terms on HCS ${topic.topicId} seq ${published.sequenceNumber}`);
  log(`   ${HASHSCAN('topic', topic.topicId)}`);

  // 3. Policy NFT carrying the pointer.
  const col = await createPolicyCollection(c, agent.id, agent.key);
  const minted = await mintPolicy(c, col.tokenId, published.pointer);
  log(`\n3. policy collection ${col.tokenId}  serial ${minted.serial}  metadata ${minted.metadataBytes}B`);
  log(`   ${HASHSCAN('token', col.tokenId)}`);

  // 4. Buyer and an arbitrary broker.
  const buyer = await newAccount(c, 5);
  const broker = await newAccount(c, 1);
  log(`\n4. buyer ${buyer.id}   broker ${broker.id}`);

  await (await (await new TokenAssociateTransaction()
    .setAccountId(buyer.id).setTokenIds([col.tokenId]).freezeWith(c)).sign(buyer.key)).execute(c);

  // 5. Atomic premium: buyer -> pool + broker, one transaction.
  const poolBefore = await new AccountBalanceQuery().setAccountId(poolId).execute(c);
  const sale = await purchasePolicy(c, {
    buyerId: buyer.id, buyerKey: buyer.key, poolId, brokerId: broker.id,
    premiumHbar: q.premium,
  });
  log(`\n5. premium settled atomically`);
  log(`   buyer -${(sale.premiumTinybar / 1e8).toFixed(8)}  pool +${(sale.toPoolTinybar / 1e8).toFixed(8)}  broker +${(sale.commissionTinybar / 1e8).toFixed(8)} (${sale.commissionBps / 100}%)`);
  log(`   ${HASHSCAN('transaction', sale.txId)}`);

  // 6. Deliver the policy and freeze it in place.
  const delivered = await deliverAndFreeze(c, col.tokenId, minted.serial, agent.id, buyer.id);
  log(`\n6. policy delivered and frozen (non-transferable)`);

  const poolAfter = await new AccountBalanceQuery().setAccountId(poolId).execute(c);
  const brokerBal = await new AccountBalanceQuery().setAccountId(broker.id).execute(c);
  const gained = poolAfter.hbars.toTinybars().toNumber() - poolBefore.hbars.toTinybars().toNumber();
  const ok = gained === sale.toPoolTinybar && brokerBal.hbars.toTinybars().toNumber() > 1e8;
  log(`\n7. pool gained ${(gained / 1e8).toFixed(8)} HBAR   broker holds ${brokerBal.hbars.toString()}`);
  log(ok ? '   GATE PASSED: policy issued, premium split atomically' : '   GATE FAILED');

  const art = {
    ...d1, d2: {
      topicId: topic.topicId.toString(), termsPointer: published.pointer,
      policyTokenId: col.tokenId.toString(), policySerial: minted.serial,
      buyerId: buyer.id.toString(), brokerId: broker.id.toString(),
      premiumHbar: q.premium, payoutHbar: PAYOUT_HBAR, saleTxId: sale.txId,
      buyerPrivateKey: buyer.key.toString(), gatePassed: ok,
    },
  };
  fs.writeFileSync('.artifacts/d1.json', JSON.stringify(art, null, 2));

  fs.appendFileSync('LINKS.md', [
    `\n## D2 — ${new Date().toISOString().slice(0, 10)} — policy NFT, terms on HCS, atomic premium`,
    `- policy terms topic \`${topic.topicId}\` seq ${published.sequenceNumber} — ${HASHSCAN('topic', topic.topicId)}`,
    `- policy collection \`${col.tokenId}\` serial ${minted.serial} (non-transferable) — ${HASHSCAN('token', col.tokenId)}`,
    `- atomic premium split buyer/pool/broker — ${HASHSCAN('transaction', sale.txId)}`,
    '',
  ].join('\n'));

  c.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
