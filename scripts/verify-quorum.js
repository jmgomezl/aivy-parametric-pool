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
  TransferTransaction, Hbar, PrivateKey, AccountId, Timestamp,
} from '@hashgraph/sdk';
import { client, operator, assertOperatorKey, HASHSCAN } from '../src/config.js';

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

  const passed = !one.executed && two.executed;
  console.log(`\n${passed ? 'PASS' : 'FAIL'}: signature-gated self-execution ${passed ? 'works' : 'DOES NOT work'} with a nested KeyList\n`);
  c.close();
  process.exit(passed ? 0 : 1);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
