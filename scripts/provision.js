// Provision the protocol's permanent assets, then prove the deposit path.
//
// The pool account, share token, policy collection and terms topic are created
// ONCE per network and reused forever after. Re-creating them costs about a
// dollar per token on mainnet and discards the history that makes the ledger
// record worth reading. Everything here is idempotent: run it as often as you
// like and it will only create what is genuinely missing. RECREATE=1 forces a
// fresh set.
import fs from 'node:fs';
import path from 'node:path';
import { AccountCreateTransaction, Hbar, PrivateKey, AccountBalanceQuery, TokenId, AccountId } from '@hiero-ledger/sdk';
import { client, operator, assertOperatorKey, HASHSCAN, NETWORK } from '../src/config.js';
import { createPoolAccount, generateOracleKeys } from '../src/pool/createPool.js';
import { createShareToken, associate } from '../src/pool/shares.js';
import { createPolicyCollection } from '../src/policy/collection.js';
import { createPolicyTopic } from '../src/policy/terms.js';
import { deposit } from '../src/pool/deposit.js';
import { ensure, load, save } from '../src/registry.js';

const DEPOSIT_HBAR = Number(process.env.DEPOSIT_HBAR ?? (process.env.HEDERA_NETWORK === 'mainnet' ? 2 : 20));
const log = (s) => console.log(s);
const mark = (r) => (r.reused ? 'reused' : 'CREATED');

async function main() {
  await assertOperatorKey();
  const c = client();
  const agent = operator();
  log(`network: ${NETWORK}   agent: ${agent.id}\n`);

  // Oracle keys belong to the pool's key structure, so they are as permanent as
  // the pool itself. Reusing the pool means reusing the keys that can open it.
  let reg = load(NETWORK);
  if (!reg.oraclePrivateKeys || process.env.RECREATE === '1') {
    const keys = generateOracleKeys(3);
    reg = save(NETWORK, {
      oraclePrivateKeys: keys.map((k) => k.toString()),
      oraclePublicKeys: keys.map((k) => k.publicKey.toString()),
    });
  }
  const oracleKeys = reg.oraclePrivateKeys.map((k) => PrivateKey.fromStringDer(k));

  const pool = await ensure(NETWORK, 'account', 'poolAccountId', async () => {
    const made = await createPoolAccount(c, agent.key.publicKey, oracleKeys.map((k) => k.publicKey), 0);
    return { id: made.accountId, txId: made.txId };
  });
  log(`pool account      ${pool.id}  ${mark(pool)}  ${HASHSCAN('account', pool.id)}`);

  const share = await ensure(NETWORK, 'token', 'shareTokenId', async () => {
    const made = await createShareToken(c, agent.id, agent.key);
    return { id: made.tokenId, txId: made.txId };
  });
  log(`share token       ${share.id}  ${mark(share)}`);

  const policy = await ensure(NETWORK, 'token', 'policyTokenId', async () => {
    const made = await createPolicyCollection(c, agent.id, agent.key);
    return { id: made.tokenId, txId: made.txId };
  });
  log(`policy collection ${policy.id}  ${mark(policy)}`);

  const topic = await ensure(NETWORK, 'topic', 'termsTopicId', async () => {
    const made = await createPolicyTopic(c, agent.key);
    return { id: made.topicId, txId: made.txId };
  });
  log(`terms topic       ${topic.id}  ${mark(topic)}`);

  const created = [pool, share, policy, topic].filter((a) => !a.reused).length;
  log(created === 0
    ? `\nnothing to create — every permanent asset already existed on ${NETWORK}`
    : `\ncreated ${created} permanent asset(s); subsequent runs will reuse them`);

  // Per-run: an LP deposit, to prove the 1:1 path still works.
  const lpKey = PrivateKey.generateECDSA();
  const lpId = (await (await new AccountCreateTransaction()
    .setKeyWithoutAlias(lpKey.publicKey).setInitialBalance(new Hbar(DEPOSIT_HBAR + 1)).execute(c)
  ).getReceipt(c)).accountId;
  await associate(c, lpId, lpKey, TokenId.fromString(share.id));

  const dep = await deposit(c, {
    tokenId: TokenId.fromString(share.id), treasuryId: agent.id,
    poolId: AccountId.fromString(pool.id), lpId, lpKey, hbarAmount: DEPOSIT_HBAR,
  });
  const poolBal = await new AccountBalanceQuery().setAccountId(AccountId.fromString(pool.id)).execute(c);
  const lpBal = await new AccountBalanceQuery().setAccountId(lpId).execute(c);
  const shares = Number(lpBal.tokens.get(TokenId.fromString(share.id)) ?? 0) / 1e8;

  log(`\nlp ${lpId} deposited ${DEPOSIT_HBAR} HBAR -> ${shares} shares`);
  log(`   ${HASHSCAN('transaction', dep.depositTxId)}`);
  log(`   pool capital now ${poolBal.hbars.toString()}`);

  const ok = shares === DEPOSIT_HBAR;
  log(ok ? `\nPROVISIONED: ${NETWORK} ready to underwrite` : '\nFAILED');

  // Keep the run artifact in the shape the rest of the scripts expect.
  const artifacts = {
    network: NETWORK, createdAt: new Date().toISOString(), agentId: agent.id.toString(),
    poolAccountId: pool.id, shareTokenId: share.id, policyTokenId: policy.id, termsTopicId: topic.id,
    lpAccountId: lpId.toString(), depositTx: dep.depositTxId, depositHbar: DEPOSIT_HBAR, sharesIssued: shares,
    oraclePublicKeys: reg.oraclePublicKeys, oraclePrivateKeys: reg.oraclePrivateKeys, gatePassed: ok,
  };
  const dir = path.join(process.cwd(), '.artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const prev = fs.existsSync(path.join(dir, `${NETWORK}.json`))
    ? JSON.parse(fs.readFileSync(path.join(dir, `${NETWORK}.json`), 'utf8')) : {};
  fs.writeFileSync(path.join(dir, `${NETWORK}.json`), JSON.stringify({ ...prev, ...artifacts }, null, 2));

  c.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
