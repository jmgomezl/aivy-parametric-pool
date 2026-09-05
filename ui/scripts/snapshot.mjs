// Freezes the public facts of the mainnet run into src/data/mainnet.json.
//
// Input:  ../.artifacts/mainnet.json (written by the D1/D2/D3 scripts; it holds
//         private keys and is gitignored — NOTHING secret is copied out of it)
//         plus the public Hedera mirror node.
// Output: src/data/mainnet.json — ids, amounts, timestamps and signatures only.
//
// The UI reads the frozen file so it renders instantly and identically every
// time, then re-verifies the live-changing parts (balances, schedule state)
// against the mirror node while it is open.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const artifactPath = path.resolve(here, '../../.artifacts/mainnet.json');
const outPath = path.resolve(here, '../src/data/mainnet.json');
const MIRROR = 'https://mainnet.mirrornode.hedera.com/api/v1';

// The two quorum proofs come from scripts/verify-quorum.js, which prints but does
// not persist its schedule ids. They are pinned here from the mainnet run.
const PROOFS = {
  controlScheduleId: '0.0.10843723', // agent pre-signed + 2 oracles -> executed
  adversarialScheduleId: '0.0.10843725', // 3 oracles, agent absent -> never executed
};

// Oracle roles, in the order the keys were generated (see scripts/d3-spine.js and
// the `sources` array in the policy terms on HCS).
const ORACLE_ROLES = ['USGS ComCat', 'EMSC', 'SGC'];

const get = async (p) => {
  const res = await fetch(`${MIRROR}${p}`);
  if (!res.ok) throw new Error(`mirror ${res.status} ${p}`);
  return res.json();
};
const iso = (ts) => new Date(Number(ts) * 1000).toISOString();
const txIdAt = (mirrorId) => mirrorId.replace(/^(\d+\.\d+\.\d+)-(\d+)-(\d+)$/, '$1@$2.$3');
const toMirrorId = (atId) => atId.replace(/^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/, '$1-$2-$3');
const txAtTimestamp = async (ts) => (await get(`/transactions?timestamp=${ts}`)).transactions[0];
const rawKeyToB64 = (hex) => Buffer.from(hex, 'hex').toString('base64');
const isUser = (account) => Number(account.split('.')[2]) > 1000;

// Signature entries on a schedule carry only a key prefix (base64 of the raw key).
function labelSignatures(sigs, oracles, agentRawKey, extra = {}) {
  const table = new Map();
  oracles.forEach((o, i) => table.set(rawKeyToB64(o.rawKey), { role: 'oracle', index: i, name: o.name }));
  if (agentRawKey) table.set(rawKeyToB64(agentRawKey), { role: 'agent', name: 'pool agent' });
  for (const [k, v] of Object.entries(extra)) table.set(k, v);
  // The schedule payer's signature is recorded alongside each ScheduleSign it pays
  // for; collapse to one entry per distinct key, keeping the first appearance.
  const seen = new Map();
  for (const s of sigs) {
    if (seen.has(s.public_key_prefix)) continue;
    const who = table.get(s.public_key_prefix) ?? { role: 'unknown', name: 'unknown key' };
    seen.set(s.public_key_prefix, { ...who, keyType: s.type, at: iso(s.consensus_timestamp), consensus: s.consensus_timestamp });
  }
  return [...seen.values()];
}

// Minimal protobuf walk: SchedulableTransactionBody.cryptoTransfer(9).transfers(1).accountAmounts(1)
function decodeInner(b64) {
  const b = Buffer.from(b64, 'base64');
  const parse = (buf) => {
    const out = [];
    let i = 0;
    const vi = (j) => { let r = 0n, s = 0n; for (;;) { const c = buf[j++]; r |= BigInt(c & 0x7f) << s; s += 7n; if (!(c & 0x80)) return [r, j]; } };
    while (i < buf.length) {
      let k; [k, i] = vi(i);
      const f = Number(k >> 3n), w = Number(k & 7n);
      if (w === 0) { let v; [v, i] = vi(i); out.push([f, v]); }
      else if (w === 2) { let l; [l, i] = vi(i); out.push([f, buf.subarray(i, i + Number(l))]); i += Number(l); }
      else throw new Error(`wire type ${w}`);
    }
    return out;
  };
  const zig = (v) => ((v & 1n) ? -((v + 1n) >> 1n) : v >> 1n);
  const legs = [];
  for (const [f, v] of parse(b)) {
    if (f !== 9) continue;
    for (const [f2, v2] of parse(v)) {
      if (f2 !== 1) continue;
      for (const [, aa] of parse(v2)) {
        let account = null, tinybar = null;
        for (const [f4, v4] of parse(aa)) {
          if (f4 === 1) { const p = Object.fromEntries(parse(v4).map(([k, x]) => [k, Number(x)])); account = `${p[1] ?? 0}.${p[2] ?? 0}.${p[3]}`; }
          if (f4 === 2) tinybar = Number(zig(v4));
        }
        legs.push({ account, tinybar });
      }
    }
  }
  return legs;
}

async function scheduleRecord(id, oracles, agentRawKey, extra) {
  const s = await get(`/schedules/${id}`);
  const create = await txAtTimestamp(s.consensus_timestamp);
  const signatures = labelSignatures(s.signatures, oracles, agentRawKey, extra);
  for (const sig of signatures) {
    if (sig.consensus === s.consensus_timestamp) { sig.txId = txIdAt(create.transaction_id); sig.viaCreate = true; continue; }
    const t = await txAtTimestamp(sig.consensus);
    sig.txId = txIdAt(t.transaction_id);
  }
  let executedTx = null;
  if (s.executed_timestamp) {
    const t = await txAtTimestamp(s.executed_timestamp);
    executedTx = {
      consensus: s.executed_timestamp, at: iso(s.executed_timestamp), txId: txIdAt(t.transaction_id),
      transfers: t.transfers.filter((x) => isUser(x.account)).map((x) => ({ account: x.account, tinybar: x.amount })),
      chargedFee: t.charged_tx_fee,
    };
  }
  return {
    scheduleId: id, memo: s.memo, creator: s.creator_account_id, payer: s.payer_account_id,
    createTxId: txIdAt(create.transaction_id), createdAt: iso(s.consensus_timestamp), createdConsensus: s.consensus_timestamp,
    expiresAt: iso(s.expiration_time), waitForExpiry: s.wait_for_expiry, adminKey: s.admin_key,
    executedAt: s.executed_timestamp ? iso(s.executed_timestamp) : null, executedConsensus: s.executed_timestamp,
    inner: decodeInner(s.transaction_body),
    signatures, executedTx,
  };
}

async function main() {
  if (!fs.existsSync(artifactPath)) throw new Error(`missing ${artifactPath} — run the D1/D2/D3 scripts first`);
  const a = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  if (a.network !== 'mainnet') throw new Error(`artifact is for ${a.network}`);

  const agent = await get(`/accounts/${a.agentId}`);
  const agentRawKey = agent.key.key;
  const oracles = a.oraclePublicKeys.map((der, i) => ({ name: ORACLE_ROLES[i], index: i, derPublicKey: der, rawKey: der.slice(-64) }));

  const pool = await get(`/accounts/${a.poolAccountId}`);
  const share = await get(`/tokens/${a.shareTokenId}`);
  const policyToken = await get(`/tokens/${a.d2.policyTokenId}`);
  const nft = await get(`/tokens/${a.d2.policyTokenId}/nfts/${a.d2.policySerial}`);
  const nftHistory = (await get(`/tokens/${a.d2.policyTokenId}/nfts/${a.d2.policySerial}/transactions`)).transactions;
  const topicMsg = await get(`/topics/${a.d2.topicId}/messages/1`);
  const terms = JSON.parse(Buffer.from(topicMsg.message, 'base64').toString('utf8'));

  // Pool ledger: every transfer touching the pool, oldest first, with a running balance.
  const poolTxs = (await get(`/transactions?account.id=${a.poolAccountId}&limit=100`)).transactions.reverse();
  let running = 0;
  const poolLedger = poolTxs.map((t) => {
    const leg = t.transfers.find((x) => x.account === a.poolAccountId);
    const delta = leg ? leg.amount : 0;
    running += delta;
    return {
      consensus: t.consensus_timestamp, at: iso(t.consensus_timestamp), name: t.name, txId: txIdAt(t.transaction_id),
      scheduled: t.scheduled, delta, balanceAfter: running,
      counterparties: t.transfers.filter((x) => x.account !== a.poolAccountId && isUser(x.account)).map((x) => ({ account: x.account, tinybar: x.amount })),
      tokens: (t.token_transfers ?? []).map((x) => ({ token: x.token_id, account: x.account, amount: x.amount })),
    };
  });

  // Deposits are the pool transfers that also move share tokens.
  const deposits = poolLedger
    .filter((t) => t.tokens.some((x) => x.token === a.shareTokenId && x.amount > 0))
    .map((t) => {
      const lpLeg = t.tokens.find((x) => x.token === a.shareTokenId && x.amount > 0);
      return { txId: t.txId, at: t.at, consensus: t.consensus, lpAccount: lpLeg.account, hbarTinybar: t.delta, shareUnits: lpLeg.amount, capitalAfter: t.balanceAfter, capitalBefore: t.balanceAfter - t.delta };
    });
  const d1Deposit = deposits.find((d) => d.txId === a.depositTx);
  const d3Deposit = deposits.filter((d) => d.txId !== a.depositTx).at(-1);
  if (!d1Deposit || !d3Deposit) throw new Error('could not locate both deposits in the pool ledger');

  const saleT = (await get(`/transactions/${toMirrorId(a.d2.saleTxId)}`)).transactions[0];
  const sale = {
    txId: txIdAt(saleT.transaction_id), consensus: saleT.consensus_timestamp, at: iso(saleT.consensus_timestamp), result: saleT.result,
    chargedFee: saleT.charged_tx_fee, commissionBps: 1500,
    legs: saleT.transfers.filter((x) => [a.d2.buyerId, a.poolAccountId, a.d2.brokerId].includes(x.account)).map((x) => ({ account: x.account, tinybar: x.amount })),
  };

  const payout = await scheduleRecord(a.d3.scheduleId, oracles, agentRawKey);
  const control = await scheduleRecord(PROOFS.controlScheduleId, oracles, agentRawKey);
  const adversarialRaw = await get(`/schedules/${PROOFS.adversarialScheduleId}`);
  const outsider = await get(`/accounts/${adversarialRaw.creator_account_id}`);
  const adversarial = await scheduleRecord(PROOFS.adversarialScheduleId, oracles, agentRawKey, {
    [rawKeyToB64(outsider.key.key)]: { role: 'outsider', name: 'outsider (schedule payer)' },
  });

  const [buyer, broker, lp1, lp2] = await Promise.all(
    [a.d2.buyerId, a.d2.brokerId, d1Deposit.lpAccount, d3Deposit.lpAccount].map((id) => get(`/accounts/${id}`)),
  );
  const buyerTxs = (await get(`/transactions?account.id=${a.d2.buyerId}&limit=50`)).transactions.reverse();
  let bal = 0;
  const buyerLedger = buyerTxs.map((t) => {
    const leg = t.transfers.find((x) => x.account === a.d2.buyerId);
    const delta = leg ? leg.amount : 0;
    bal += delta;
    return { consensus: t.consensus_timestamp, at: iso(t.consensus_timestamp), name: t.name, txId: txIdAt(t.transaction_id), scheduled: t.scheduled, delta, balanceAfter: bal };
  });

  const deliverTx = nftHistory.find((t) => t.type === 'CRYPTOTRANSFER');
  const mintTx = nftHistory.find((t) => t.type === 'TOKENMINT');
  const freezeTx = (await get(`/transactions?account.id=${a.agentId}&transactiontype=TOKENFREEZE&limit=10`)).transactions.find((t) => t.entity_id === a.d2.buyerId);

  // Pool capital the guard saw when it refused: the balance just before the D3 deposit.
  const before = { capitalTinybar: d3Deposit.capitalBefore, committedTinybar: 0, requestedTinybar: a.d2.payoutHbar * 1e8 };
  before.exposureAfterTinybar = before.committedTinybar + before.requestedTinybar;
  before.headroomTinybar = before.capitalTinybar - before.exposureAfterTinybar;
  before.ok = before.exposureAfterTinybar <= before.capitalTinybar;
  const after = { ...before, capitalTinybar: d3Deposit.capitalAfter };
  after.headroomTinybar = after.capitalTinybar - after.exposureAfterTinybar;
  after.ok = after.exposureAfterTinybar <= after.capitalTinybar;

  const submitId = topicMsg.chunk_info.initial_transaction_id;
  const out = {
    network: 'mainnet',
    snapshotAt: new Date().toISOString(),
    runCreatedAt: a.createdAt,
    mirror: MIRROR,
    accounts: {
      agent: { id: a.agentId, publicKey: agentRawKey, keyType: agent.key._type },
      pool: { id: a.poolAccountId, memo: pool.memo, createTxId: a.poolCreateTx, createdAt: iso(pool.created_timestamp), keyProtobuf: pool.key.key, balanceAtSnapshot: pool.balance.balance },
      lp1: { id: d1Deposit.lpAccount, balanceAtSnapshot: lp1.balance.balance },
      lp2: { id: d3Deposit.lpAccount, balanceAtSnapshot: lp2.balance.balance },
      buyer: { id: a.d2.buyerId, createdAt: iso(buyer.created_timestamp), balanceAtSnapshot: buyer.balance.balance },
      broker: { id: a.d2.brokerId, createdAt: iso(broker.created_timestamp), balanceAtSnapshot: broker.balance.balance },
      outsider: { id: adversarialRaw.creator_account_id, publicKey: outsider.key.key },
    },
    oracles: oracles.map(({ name, index, derPublicKey, rawKey }) => ({ name, index, derPublicKey, rawKey })),
    quorum: { threshold: 2, count: 3 },
    shareToken: { id: a.shareTokenId, symbol: share.symbol, name: share.name, decimals: Number(share.decimals), totalSupplyAtSnapshot: share.total_supply, treasury: share.treasury_account_id, createTxId: a.shareCreateTx },
    policy: {
      tokenId: a.d2.policyTokenId, symbol: policyToken.symbol, name: policyToken.name, serial: Number(a.d2.policySerial),
      metadata: Buffer.from(nft.metadata, 'base64').toString('utf8'), owner: nft.account_id,
      mintTxId: txIdAt(mintTx.transaction_id), mintedAt: iso(mintTx.consensus_timestamp),
      deliverTxId: txIdAt(deliverTx.transaction_id), deliveredAt: iso(deliverTx.consensus_timestamp),
      freezeTxId: freezeTx ? txIdAt(freezeTx.transaction_id) : null, frozenAt: freezeTx ? iso(freezeTx.consensus_timestamp) : null,
      freezeKey: policyToken.freeze_key?.key ?? null,
    },
    terms: {
      topicId: a.d2.topicId, sequence: 1, pointer: a.d2.termsPointer,
      submitTxId: `${submitId.account_id}@${submitId.transaction_valid_start}`,
      consensusAt: iso(topicMsg.consensus_timestamp), runningHash: topicMsg.running_hash, body: terms,
    },
    quote: {
      location: { name: 'Armenia, Quindío, Colombia', lat: terms.trigger.location.lat, lon: terms.trigger.location.lon },
      hazard: terms.hazard, trigger: terms.trigger, premiumHbar: a.d2.premiumHbar, payoutHbar: a.d2.payoutHbar,
      lossRatio: terms.lossRatio, days: terms.trigger.windowDays, issuedAt: terms.issuedAt,
    },
    guard: { before, after },
    deposits: { d1: d1Deposit, d3: d3Deposit },
    sale,
    payout, control, adversarial,
    ledgers: { pool: poolLedger, buyer: buyerLedger },
  };
  const s = JSON.stringify(out);
  for (const k of [...a.oraclePrivateKeys, a.d2.buyerPrivateKey]) if (k && s.includes(k)) throw new Error('PRIVATE KEY LEAKED INTO SNAPSHOT');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`wrote ${path.relative(process.cwd(), outPath)} (${(s.length / 1024).toFixed(1)} KB, no key material)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
