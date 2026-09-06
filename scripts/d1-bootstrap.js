// D1 gate: pool account with and(agent, 2-of-3 oracles), HTS share token, and a
// real 1:1 deposit/mint on Hedera testnet. Writes every id and transaction to
// .artifacts/d1.json and appends them to LINKS.md.
import fs from 'node:fs';
import path from 'node:path';
import { AccountCreateTransaction, Hbar, PrivateKey, AccountBalanceQuery } from '@hiero-ledger/sdk';
import { client, operator, assertOperatorKey, HASHSCAN, NETWORK } from '../src/config.js';
import { createPoolAccount, generateOracleKeys } from '../src/pool/createPool.js';
import { createShareToken, associate } from '../src/pool/shares.js';
import { deposit } from '../src/pool/deposit.js';

// Historical controlled HBAR demonstration, independent of the app's demo token.
process.env.SETTLEMENT_TOKEN_ID = 'HBAR';

const DEPOSIT_HBAR = Number(process.env.DEPOSIT_HBAR ?? (process.env.HEDERA_NETWORK === 'mainnet' ? 2 : 20));

const log = (s) => console.log(s);

async function main() {
  await assertOperatorKey();
  const c = client();
  const agent = operator();
  log(`network: ${NETWORK}   agent: ${agent.id.toString()}\n`);

  // 1. Oracle keypairs (in production each oracle generates and holds its own).
  const oracleKeys = generateOracleKeys(3);
  log('1. oracle keys generated (2-of-3)');

  // 2. Pool account: and(agent, 2-of-3 oracles).
  const pool = await createPoolAccount(c, agent.key.publicKey, oracleKeys.map((k) => k.publicKey), 0);
  log(`2. pool account ${pool.accountId}  ${HASHSCAN('account', pool.accountId)}`);

  // 3. Share token, treasury = agent (see src/pool/shares.js for why).
  const share = await createShareToken(c, agent.id, agent.key);
  log(`3. share token  ${share.tokenId}  ${HASHSCAN('token', share.tokenId)}`);

  // 4. An LP account to make the deposit real.
  const lpKey = PrivateKey.generateED25519();
  const lpTx = await new AccountCreateTransaction()
    .setKeyWithoutAlias(lpKey.publicKey).setInitialBalance(new Hbar(DEPOSIT_HBAR + 1)).execute(c);
  const lpId = (await lpTx.getReceipt(c)).accountId;
  log(`4. lp account   ${lpId}`);

  const assocTx = await associate(c, lpId, lpKey, share.tokenId);
  log(`   associated   ${assocTx}`);

  // 5. Atomic deposit: HBAR in, shares out, one transaction.
  const dep = await deposit(c, {
    tokenId: share.tokenId, treasuryId: agent.id, poolId: pool.accountId,
    lpId, lpKey, amountUnits: Math.round(DEPOSIT_HBAR * 1e8), network: NETWORK,
  });
  log(`5. deposit ${DEPOSIT_HBAR} HBAR -> ${dep.units / 1e8} shares`);
  log(`   ${HASHSCAN('transaction', dep.depositTxId)}`);

  // 6. Verify on-ledger.
  const poolBal = await new AccountBalanceQuery().setAccountId(pool.accountId).execute(c);
  const lpBal = await new AccountBalanceQuery().setAccountId(lpId).execute(c);
  const lpShares = Number(lpBal.tokens.get(share.tokenId) ?? 0) / 1e8;
  log(`\n6. pool balance: ${poolBal.hbars.toString()}   lp shares: ${lpShares}`);

  const ok = poolBal.hbars.toTinybars().toNumber() === DEPOSIT_HBAR * 1e8 && lpShares === DEPOSIT_HBAR;
  log(ok ? `   GATE PASSED: 1:1 deposit/mint verified on ${NETWORK}` : '   GATE FAILED');

  const artifacts = {
    network: NETWORK, createdAt: new Date().toISOString(), agentId: agent.id.toString(),
    poolAccountId: pool.accountId.toString(), poolCreateTx: pool.txId,
    shareTokenId: share.tokenId.toString(), shareCreateTx: share.txId,
    lpAccountId: lpId.toString(), depositTx: dep.depositTxId, mintTx: dep.mintTxId,
    depositHbar: DEPOSIT_HBAR, sharesIssued: lpShares,
    oraclePublicKeys: oracleKeys.map((k) => k.publicKey.toString()),
    oraclePrivateKeys: oracleKeys.map((k) => k.toString()), // demo keys; gitignored
    gatePassed: ok,
  };
  const dir = path.join(process.cwd(), '.artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const artifactPath = path.join(dir, `${NETWORK}.json`);
  fs.writeFileSync(artifactPath, JSON.stringify(artifacts, null, 2));
  log(`\nartifacts -> ${artifactPath} (gitignored: holds oracle keys)`);

  const links = [
    `\n## D1 — ${new Date().toISOString().slice(0, 10)} — ${NETWORK} — pool, share token, 1:1 deposit`,
    `- pool account \`${pool.accountId}\` (key = and(agent, 2-of-3 oracles)) — ${HASHSCAN('account', pool.accountId)}`,
    `- share token \`${share.tokenId}\` (ARPS) — ${HASHSCAN('token', share.tokenId)}`,
    `- lp account \`${lpId}\` — ${HASHSCAN('account', lpId)}`,
    `- atomic deposit ${DEPOSIT_HBAR} HBAR -> ${lpShares} ARPS — ${HASHSCAN('transaction', dep.depositTxId)}`,
    '',
  ].join('\n');
  fs.appendFileSync(path.join(process.cwd(), 'LINKS.md'), links);
  log('appended to LINKS.md');

  c.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
