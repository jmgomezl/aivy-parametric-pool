// The load-bearing experiment. Everything else depends on the answer.
//
// Claim: a Scheduled Transaction that spends from an account keyed
// and(agent, 2-of-3 oracles) executes ITSELF the moment the second oracle signs,
// with no keeper — and cannot be executed by the oracles alone.
//
// This verifies BOTH halves against live testnet:
//   A. after agent + 1 oracle  -> still pending  (quorum not met)
//   B. after agent + 2 oracles -> executed       (network runs it, nobody submitted it)
//   C. a schedule the agent never signed         -> never executes on oracle signatures alone
import fs from 'node:fs';
import {
  ScheduleCreateTransaction, ScheduleSignTransaction, ScheduleInfoQuery,
  TransferTransaction, AccountCreateTransaction, Hbar, PrivateKey, AccountId,
  Timestamp, Client,
} from '@hiero-ledger/sdk';
import { client, operator, assertOperatorKey, HASHSCAN, NETWORK } from '../src/config.js';

const a = JSON.parse(fs.readFileSync('.artifacts/d1.json', 'utf8'));
const POOL = AccountId.fromString(a.poolAccountId);
const ORACLES = a.oraclePrivateKeys.map((k) => PrivateKey.fromStringDer(k));

const pending = async (c, id) => {
  const info = await new ScheduleInfoQuery().setScheduleId(id).execute(c);
  return { executed: info.executed !== null, executedAt: info.executed };
};

async function makeSchedule(c, agent, { signWithAgent }) {
  const inner = new TransferTransaction()
    .addHbarTransfer(POOL, new Hbar(-1))
    .addHbarTransfer(agent.id, new Hbar(1));

  let tx = new ScheduleCreateTransaction()
    .setScheduledTransaction(inner)
    .setScheduleMemo('parametric payout')
    .setExpirationTime(Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)))
    .setWaitForExpiry(false); // execute as soon as signatures suffice

  // The agent branch is satisfied at CREATION time — this is the "pre-sign at
  // policy purchase" step. Without it the oracle quorum can never be enough.
  if (!signWithAgent) tx = tx.setAdminKey(agent.key.publicKey);

  const res = await tx.execute(c);
  const receipt = await res.getReceipt(c);
  return { scheduleId: receipt.scheduleId, txId: res.transactionId.toString() };
}

async function sign(c, scheduleId, key) {
  const tx = await (await new ScheduleSignTransaction()
    .setScheduleId(scheduleId).freezeWith(c)).sign(key);
  const res = await tx.execute(c);
  await res.getReceipt(c);
  return res.transactionId.toString();
}

async function main() {
  await assertOperatorKey();
  const c = client();
  const agent = operator();

  console.log('=== A/B: agent pre-signs at creation, oracles complete it later ===');
  const s = await makeSchedule(c, agent, { signWithAgent: true });
  console.log(`schedule ${s.scheduleId}  ${HASHSCAN('schedule', s.scheduleId)}`);
  console.log(`  after agent only          : ${(await pending(c, s.scheduleId)).executed ? 'EXECUTED' : 'pending'}`);

  await sign(c, s.scheduleId, ORACLES[0]);
  const one = await pending(c, s.scheduleId);
  console.log(`  after agent + 1 oracle    : ${one.executed ? 'EXECUTED' : 'pending'}   <- must be pending`);

  await sign(c, s.scheduleId, ORACLES[1]);
  const two = await pending(c, s.scheduleId);
  console.log(`  after agent + 2 oracles   : ${two.executed ? 'EXECUTED' : 'pending'}   <- must be EXECUTED`);
  if (two.executed) console.log(`  executed at ${two.executedAt.toDate().toISOString()} — nobody submitted it`);

  // ---- C: the security half. A schedule the AGENT never signed must never
  // execute on oracle signatures alone, however many arrive. Created and paid by
  // an unrelated account so the agent's key is nowhere near it.
  console.log('\n=== C: oracles alone, agent branch never satisfied ===');
  const outsiderKey = PrivateKey.generateECDSA();
  const outsiderId = (await (await new AccountCreateTransaction()
    .setKeyWithoutAlias(outsiderKey.publicKey).setInitialBalance(new Hbar(12))
    .execute(c)).getReceipt(c)).accountId;

  const oc = (NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet())
    .setOperator(outsiderId, outsiderKey);

  const drain = new TransferTransaction()
    .addHbarTransfer(POOL, new Hbar(-5))
    .addHbarTransfer(outsiderId, new Hbar(5));
  const attack = await (await new ScheduleCreateTransaction()
    .setScheduledTransaction(drain)
    .setScheduleMemo('attack: oracle quorum tries to drain the pool')
    .setExpirationTime(Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)))
    .setWaitForExpiry(false)
    .execute(oc)).getReceipt(oc);

  console.log(`schedule ${attack.scheduleId}  ${HASHSCAN('schedule', attack.scheduleId)}`);
  for (let i = 0; i < 3; i++) {
    await sign(oc, attack.scheduleId, ORACLES[i]);
    const st = await pending(oc, attack.scheduleId);
    console.log(`  after ${i + 1} oracle signature(s)  : ${st.executed ? 'EXECUTED' : 'pending'}`);
  }
  const attackBlocked = !(await pending(oc, attack.scheduleId)).executed;
  console.log(`  all 3 oracles signed and the transfer ${attackBlocked ? 'never executed' : 'EXECUTED'}   <- must never execute`);
  oc.close();

  const passed = !one.executed && two.executed && attackBlocked;
  console.log(`\n${passed ? 'PASS' : 'FAIL'}: self-executing payout ${two.executed ? 'works' : 'broken'}; oracle-only drain ${attackBlocked ? 'blocked' : 'SUCCEEDED — DESIGN IS BROKEN'}\n`);
  c.close();
  process.exit(passed ? 0 : 1);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
