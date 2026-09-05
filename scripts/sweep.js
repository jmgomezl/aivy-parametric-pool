// Return stranded HBAR to the operator.
//
// Demo runs leave funded accounts behind — buyers, brokers, LPs, the outsider
// that plays the attacker. Each is real money on mainnet. This sweeps back every
// account whose key was actually kept, and names the ones whose key was not, so
// the loss is visible rather than quietly absorbed.
//
// The pool is deliberately never swept: it is the protocol's working capital and
// its key needs the oracle quorum, which is a different operation entirely.
import fs from 'node:fs';
import path from 'node:path';
import { AccountBalanceQuery, AccountId, Hbar, PrivateKey, TransferTransaction } from '@hiero-ledger/sdk';
import { client, operator, assertOperatorKey, HASHSCAN, NETWORK, MIRROR } from '../src/config.js';
import { known } from '../src/accounts.js';

const log = (s) => console.log(s);
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };

/** Every (accountId, key) pair the artifacts kept for this network. */
function keyed(network) {
  const art = read(path.join('.artifacts', `${network}.json`));
  const out = [];
  const add = (id, key, label) => { if (id && key) out.push({ id: String(id), key: String(key), label }); };
  add(art.d2?.buyerId, art.d2?.buyerPrivateKey, 'buyer');
  add(art.d2?.brokerId, art.d2?.brokerPrivateKey, 'broker');
  add(art.lpAccountId, art.lpPrivateKey, 'lp');
  add(art.d3?.lpId, art.d3?.lpPrivateKey, 'lp (spine)');
  add(art.outsiderId, art.outsiderPrivateKey, 'outsider');
  // everything created through src/accounts.js since
  for (const k of known(network)) out.push(k);
  return out.filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
}

/**
 * Accounts THIS operator actually created and can no longer open.
 *
 * Listing every account with a higher id would sweep in every stranger created
 * after us, so the set comes from the operator's own CRYPTOCREATEACCOUNT
 * transactions — the only accounts it is responsible for.
 */
async function stranded(agentId, known) {
  const created = [];
  let url = `${MIRROR}/transactions?account.id=${agentId}&transactiontype=cryptocreateaccount&limit=100&order=asc`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) break;
    const body = await res.json();
    for (const tx of body.transactions ?? []) {
      if (tx.entity_id && tx.result === 'SUCCESS') created.push(tx.entity_id);
    }
    url = body.links?.next ? `https://${NETWORK}.mirrornode.hedera.com${body.links.next}` : null;
  }

  const knownIds = new Set(known.map((k) => k.id));
  const out = [];
  for (const id of [...new Set(created)].filter((i) => !knownIds.has(i))) {
    const res = await fetch(`${MIRROR}/accounts/${id}`);
    if (!res.ok) continue;
    const a = await res.json();
    if (!a._status && a.balance?.balance > 0) out.push({ id, hbar: a.balance.balance / 1e8 });
  }
  return out;
}

async function main() {
  await assertOperatorKey();
  const c = client();
  const agent = operator();
  const pool = read(path.join('.artifacts', `registry-${NETWORK}.json`)).poolAccountId;
  log(`network: ${NETWORK}   sweeping into ${agent.id}\n`);

  let recovered = 0;
  for (const { id, key, label } of keyed(NETWORK)) {
    if (id === pool) continue;
    try {
      const bal = await new AccountBalanceQuery().setAccountId(AccountId.fromString(id)).execute(c);
      const tinybar = bal.hbars.toTinybars().toNumber();
      if (tinybar <= 0) { log(`  ${id.padEnd(15)} ${label.padEnd(12)} empty`); continue; }

      // The operator pays the fee, so the account can send its whole balance.
      const tx = await (await new TransferTransaction()
        .addHbarTransfer(AccountId.fromString(id), Hbar.fromTinybars(-tinybar))
        .addHbarTransfer(agent.id, Hbar.fromTinybars(tinybar))
        .freezeWith(c)).sign(PrivateKey.fromStringDer(key));
      const res = await tx.execute(c);
      await res.getReceipt(c);
      recovered += tinybar;
      log(`  ${id.padEnd(15)} ${label.padEnd(12)} +${(tinybar / 1e8).toFixed(4)} HBAR  ${HASHSCAN('transaction', res.transactionId.toString())}`);
    } catch (err) {
      log(`  ${id.padEnd(15)} ${label.padEnd(12)} failed: ${err.message?.slice(0, 60)}`);
    }
  }

  log(`\nrecovered ${(recovered / 1e8).toFixed(4)} HBAR`);

  const lost = await stranded(agent.id.toString(), keyed(NETWORK));
  const strandedTotal = lost.filter((a) => a.id !== pool).reduce((s, a) => s + a.hbar, 0);
  if (strandedTotal > 0) {
    log(`\nunreachable — these accounts were funded but their keys were never saved:`);
    for (const a of lost.filter((x) => x.id !== pool)) log(`  ${a.id.padEnd(15)} ${a.hbar.toFixed(4)} HBAR`);
    log(`  ${''.padEnd(15)} ${strandedTotal.toFixed(4)} HBAR lost for good`);
  }
  c.close();
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
