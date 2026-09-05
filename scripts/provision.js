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
import { AccountBalanceQuery, PrivateKey, TokenId, AccountId, TransferTransaction, TokenAssociateTransaction } from '@hiero-ledger/sdk';
import { poolCapital } from '../src/pool/solvency.js';
import { client, operator, assertOperatorKey, HASHSCAN, NETWORK } from '../src/config.js';
import { createPoolAccount, generateOracleKeys } from '../src/pool/createPool.js';
import { createShareToken, createDemoUnit, associate } from '../src/pool/shares.js';
import { createPolicyCollection } from '../src/policy/collection.js';
import { createPolicyTopic } from '../src/policy/terms.js';
import { deposit } from '../src/pool/deposit.js';
import { ensure, load, save } from '../src/registry.js';
import { settlementAsset, toUnits, fromUnits, format } from '../src/asset.js';
import { createFundedAccount } from '../src/accounts.js';

const DEPOSIT_USD = Number(process.env.DEPOSIT_USD ?? 100);
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

  // The settlement unit, when we are not pointed at real USDC.
  if (!process.env.SETTLEMENT_TOKEN_ID && !process.env.DEMO_TOKEN_ID) {
    const unit = await ensure(NETWORK, 'token', 'demoTokenId', async () => {
      const made = await createDemoUnit(c, agent.id, agent.key);
      return { id: made.tokenId, txId: made.txId };
    });
    process.env.DEMO_TOKEN_ID = unit.id;
    log(`settlement unit  ${unit.id}  ${mark(unit)}  (aUSDd — unbacked demo unit)`);
  }

  const topic = await ensure(NETWORK, 'topic', 'termsTopicId', async () => {
    const made = await createPolicyTopic(c, agent.key);
    return { id: made.topicId, txId: made.txId };
  });
  log(`terms topic       ${topic.id}  ${mark(topic)}`);

  const created = [pool, share, policy, topic].filter((a) => !a.reused).length;
  log(created === 0
    ? `\nnothing to create — every permanent asset already existed on ${NETWORK}`
    : `\ncreated ${created} permanent asset(s); subsequent runs will reuse them`);

  // Per-run: an LP deposit, to prove the 1:1 path still works. When the pool
  // settles in a token the LP must hold and be associated with it, so the agent
  // seeds the LP from its own balance — it is the one holding the faucet USDC.
  const asset = settlementAsset(NETWORK);
  const amountUnits = toUnits(DEPOSIT_USD, asset, null);

  // The pool cannot hold what it is not associated with, and its key is
  // and(agent, 2-of-3 oracles) — so even this needs the quorum. Which is the
  // point: the agent alone cannot change what the pool holds.
  if (asset.kind === 'token') {
    const holds = await fetch(`https://${NETWORK}.mirrornode.hedera.com/api/v1/accounts/${pool.id}/tokens?token.id=${asset.tokenId}`)
      .then((r) => r.json()).then((b) => (b.tokens ?? []).length > 0).catch(() => false);
    if (!holds) {
      let assoc = await (await new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(pool.id))
        .setTokenIds([TokenId.fromString(asset.tokenId)])
        .freezeWith(c)).sign(agent.key);
      assoc = await assoc.sign(oracleKeys[0]);
      assoc = await assoc.sign(oracleKeys[1]);
      await (await assoc.execute(c)).getReceipt(c);
      log(`pool associated with ${asset.symbol} — signed by the agent and 2 of 3 oracles`);
    }
  }
  const { id: lpId, key: lpKey } = await createFundedAccount(c, NETWORK, 1, 'lp');
  await associate(c, lpId, lpKey, TokenId.fromString(share.id));

  if (asset.kind === 'token') {
    await associate(c, lpId, lpKey, TokenId.fromString(asset.tokenId));
    const held = Number((await new AccountBalanceQuery().setAccountId(agent.id).execute(c))
      .tokens?.get(TokenId.fromString(asset.tokenId)) ?? 0);
    if (held < amountUnits) {
      log(`\nthe agent holds ${format(held, asset)} but needs ${format(amountUnits, asset)} to seed the pool.`);
      if (asset.isUsdc && NETWORK === 'testnet') {
        log(`Get some: https://faucet.circle.com — Hedera Testnet, 20 USDC every 2 hours, to ${agent.id}`);
      }
      c.close(); process.exit(1);
    }
    const t = TokenId.fromString(asset.tokenId);
    await (await new TransferTransaction()
      .addTokenTransfer(t, agent.id, -amountUnits).addTokenTransfer(t, lpId, amountUnits)
      .execute(c)).getReceipt(c);
  }

  const dep = await deposit(c, {
    tokenId: TokenId.fromString(share.id), treasuryId: agent.id,
    poolId: AccountId.fromString(pool.id), lpId, lpKey, amountUnits, network: NETWORK,
  });
  const lpBal = await new AccountBalanceQuery().setAccountId(lpId).execute(c);
  const shares = Number(lpBal.tokens.get(TokenId.fromString(share.id)) ?? 0) / 1e8;
  const capital = await poolCapital(c, AccountId.fromString(pool.id), NETWORK);

  log(`\nlp ${lpId} deposited ${format(amountUnits, asset)} -> ${shares} shares`);
  log(`   ${HASHSCAN('transaction', dep.depositTxId)}`);
  log(`   pool capital now ${format(capital, asset)}`);

  const ok = Math.abs(shares - fromUnits(amountUnits, asset)) < 1e-6;
  log(ok ? `\nPROVISIONED: ${NETWORK} ready to underwrite` : '\nFAILED');

  // Keep the run artifact in the shape the rest of the scripts expect.
  const artifacts = {
    network: NETWORK, createdAt: new Date().toISOString(), agentId: agent.id.toString(),
    poolAccountId: pool.id, shareTokenId: share.id, policyTokenId: policy.id, termsTopicId: topic.id,
    lpAccountId: lpId.toString(), depositTx: dep.depositTxId, depositUsd: DEPOSIT_USD, sharesIssued: shares,
    settlementAsset: { symbol: asset.symbol, tokenId: asset.tokenId },
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
