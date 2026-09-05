// D3 — THE SPINE. The whole loop, end to end, with no human in it after purchase:
//
//   solvency guard refuses -> LP capital arrives -> guard allows -> payout is
//   scheduled and pre-signed at purchase -> a quake happens -> two independent
//   oracles attest -> the network executes the payout by itself.
import fs from 'node:fs';
import {
  AccountCreateTransaction, TokenAssociateTransaction, Hbar, PrivateKey,
  AccountId, AccountBalanceQuery, TokenId,
} from '@hiero-ledger/sdk';
import { client, operator, assertOperatorKey, HASHSCAN, NETWORK } from '../src/config.js';
import { canUnderwrite } from '../src/pool/solvency.js';
import { deposit } from '../src/pool/deposit.js';
import { schedulePayout, attest, payoutStatus } from '../src/policy/payout.js';
import { createFundedAccount } from '../src/accounts.js';

const log = (s) => console.log(s);
const hbar = (t) => (t / 1e8).toFixed(4);

async function main() {
  await assertOperatorKey();
  const c = client();
  const agent = operator();
  const a = JSON.parse(fs.readFileSync(`.artifacts/${NETWORK}.json`, 'utf8'));
  const poolId = AccountId.fromString(a.poolAccountId);
  const buyerId = AccountId.fromString(a.d2.buyerId);
  const payout = Math.round(a.d2.payoutHbar * 1e8) / 1e8;
  const oracles = a.oraclePrivateKeys;
  log(`network: ${NETWORK}   pool: ${poolId}   cover: ${payout} HBAR\n`);

  // 1. The guard refuses before there is capital to back the promise.
  let check = await canUnderwrite(c, poolId, 0, payout * 1e8);
  log('1. solvency guard');
  log(`   capital ${hbar(check.capital)} HBAR, exposure would be ${hbar(check.exposureAfter)} HBAR`);
  log(`   ${check.ok ? 'ALLOWED' : check.reason}`);
  if (check.ok) { log('   (expected a refusal here — pool already funded)'); }

  // 2. An LP funds the pool. Capital is capacity: without it there is no product.
  if (!check.ok) {
    const { id: lpId, key: lpKey } = await createFundedAccount(c, NETWORK, payout + 1, 'lp (spine)');
    await (await (await new TokenAssociateTransaction().setAccountId(lpId)
      .setTokenIds([TokenId.fromString(a.shareTokenId)]).freezeWith(c)).sign(lpKey)).execute(c);

    const dep = await deposit(c, {
      tokenId: TokenId.fromString(a.shareTokenId), treasuryId: agent.id, poolId,
      lpId, lpKey, hbarAmount: payout,
    });
    log(`\n2. lp ${lpId} deposits ${payout} HBAR -> ${dep.units / 1e8} shares`);
    log(`   ${HASHSCAN('transaction', dep.depositTxId)}`);

    check = await canUnderwrite(c, poolId, 0, payout * 1e8);
    log(`   guard now: ${check.ok ? 'ALLOWED' : check.reason}  (headroom ${hbar(check.headroom)} HBAR)`);
  }
  if (!check.ok) throw new Error('pool still cannot back the policy');

  // 3. Purchase time: the payout is scheduled and the agent signs it NOW.
  const sched = await schedulePayout(c, {
    poolId, beneficiaryId: buyerId, payoutHbar: payout, days: 30,
    memo: 'quake payout M6+ Armenia',
  });
  if (sched.status !== 'success') throw new Error(sched.message);
  log(`\n3. payout scheduled and pre-signed at purchase`);
  log(`   schedule ${sched.scheduleId}   lapses ${sched.expiresAt.slice(0, 10)}`);
  log(`   ${HASHSCAN('schedule', sched.scheduleId)}`);

  const before = (await new AccountBalanceQuery().setAccountId(buyerId).execute(c)).hbars.toTinybars().toNumber();
  log(`\n4. ... 30 days of nothing. No keeper, no cron, no contract.`);
  log(`   status: ${(await payoutStatus(c, sched.scheduleId)).executed ? 'executed' : 'pending'}`);

  // 5. A quake happens. Independent oracles attest; they never talk to each other.
  log(`\n5. M6.1 near Armenia — oracles attest independently`);
  const one = await attest(c, sched.scheduleId, oracles[0]);
  log(`   USGS oracle signed  -> ${one.executed ? 'EXECUTED' : 'pending (quorum not met)'}`);
  const two = await attest(c, sched.scheduleId, oracles[1]);
  log(`   EMSC oracle signed  -> ${two.executed ? 'EXECUTED' : 'pending'}`);

  const after = (await new AccountBalanceQuery().setAccountId(buyerId).execute(c)).hbars.toTinybars().toNumber();
  const paid = after - before;
  const ok = two.executed && paid === payout * 1e8;

  log(`\n6. beneficiary balance ${hbar(before)} -> ${hbar(after)} HBAR  (+${hbar(paid)})`);
  if (two.executed) log(`   executed at ${two.executedAt} — nobody submitted this transaction`);
  log(`\n${ok ? 'SPINE COMPLETE: quake fires the payout, no human in the loop' : 'GATE FAILED'}\n`);

  a.d3 = { scheduleId: sched.scheduleId, executed: two.executed, executedAt: two.executedAt, paidTinybar: paid, gatePassed: ok };
  fs.writeFileSync(`.artifacts/${NETWORK}.json`, JSON.stringify(a, null, 2));
  fs.appendFileSync('LINKS.md', [
    `\n## D3 — ${new Date().toISOString().slice(0, 10)} — ${NETWORK} — the spine`,
    `- payout schedule \`${sched.scheduleId}\` — pre-signed at purchase, executed on the 2nd oracle signature — ${HASHSCAN('schedule', sched.scheduleId)}`,
    '',
  ].join('\n'));

  c.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
