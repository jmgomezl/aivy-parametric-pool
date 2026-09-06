// Give each oracle an account of its own.
//
// Until now the oracles were three keys inside the pool's key structure. For an
// oracle to be paid it needs an identity on the ledger — and the account is
// keyed by the SAME key that signs the payout, deliberately: the party that
// takes the fee is the party that puts its name on the attestation.
import { AccountCreateTransaction, Hbar, PrivateKey, TokenId, AccountId, TransferTransaction, AccountBalanceQuery } from '@hiero-ledger/sdk';
import { client, operator, assertOperatorKey, HASHSCAN, NETWORK } from '../src/config.js';
import { load, save, exists } from '../src/registry.js';
import { associate } from '../src/pool/shares.js';
import { settlementAsset, toUnits, format } from '../src/asset.js';
import { SOURCE_KEYS, SOURCES } from '../src/oracle/sources.js';

const FUND_USD = Number(process.env.ORACLE_FUND_USD ?? 5);

async function main() {
  await assertOperatorKey();
  const c = client();
  const agent = operator();
  const reg = load(NETWORK);
  const asset = settlementAsset(NETWORK);
  if (!reg.oraclePrivateKeys) throw new Error('Not provisioned. Run: npm run provision');

  const keys = reg.oraclePrivateKeys.map((k) => PrivateKey.fromStringDer(k));
  const accounts = reg.oracleAccountIds ?? [];

  for (let i = 0; i < keys.length; i++) {
    const sourceKey = SOURCE_KEYS[i] ?? `oracle-${i}`;
    const name = SOURCES[sourceKey]?.name ?? sourceKey;

    if (accounts[i] && (await exists(NETWORK, 'account', accounts[i]))) {
      console.log(`${name.padEnd(13)} ${accounts[i]}  reused`);
    } else {
      const res = await new AccountCreateTransaction()
        .setKeyWithoutAlias(keys[i].publicKey)
        .setInitialBalance(new Hbar(2))
        .setAccountMemo(`aivy oracle · ${name}`)
        .execute(c);
      accounts[i] = (await res.getReceipt(c)).accountId.toString();
      console.log(`${name.padEnd(13)} ${accounts[i]}  CREATED  ${HASHSCAN('account', accounts[i])}`);
    }

    // It has to hold the asset it is paid in.
    if (asset.kind === 'token') {
      const holds = await fetch(`https://${NETWORK}.mirrornode.hedera.com/api/v1/accounts/${accounts[i]}/tokens?token.id=${asset.tokenId}`)
        .then((r) => r.json()).then((b) => (b.tokens ?? []).length > 0).catch(() => false);
      if (!holds) await associate(c, AccountId.fromString(accounts[i]), keys[i], TokenId.fromString(asset.tokenId));
    }
  }

  save(NETWORK, { oracleAccountIds: accounts, oracleSources: SOURCE_KEYS.slice(0, keys.length) });

  // A payer with something to spend, so an attestation can actually be bought.
  if (asset.kind === 'token') {
    const units = toUnits(FUND_USD, asset, null);
    let payer = reg.x402PayerId;
    let payerKey = reg.x402PayerKey;
    if (!payer || !(await exists(NETWORK, 'account', payer))) {
      const k = PrivateKey.generateECDSA();
      const res = await new AccountCreateTransaction()
        .setKeyWithoutAlias(k.publicKey).setInitialBalance(new Hbar(5))
        .setAccountMemo('aivy x402 payer').execute(c);
      payer = (await res.getReceipt(c)).accountId.toString();
      payerKey = k.toStringDer();
      await associate(c, AccountId.fromString(payer), k, TokenId.fromString(asset.tokenId));
      save(NETWORK, { x402PayerId: payer, x402PayerKey: payerKey });
      console.log(`\nx402 payer   ${payer}  CREATED`);
    } else {
      console.log(`\nx402 payer   ${payer}  reused`);
    }
    const t = TokenId.fromString(asset.tokenId);
    await (await new TransferTransaction()
      .addTokenTransfer(t, agent.id, -units).addTokenTransfer(t, AccountId.fromString(payer), units)
      .execute(c)).getReceipt(c);
    const bal = await new AccountBalanceQuery().setAccountId(AccountId.fromString(payer)).execute(c);
    console.log(`             funded with ${format(Number(bal.tokens?.get(t) ?? 0), asset)}`);
  }

  console.log(`\nOracles provisioned on ${NETWORK}. Start one:`);
  console.log(`  SOURCE=usgs PORT=8801 ORACLE_ACCOUNT_ID=${accounts[0]} npm run oracle`);
  c.close();
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
