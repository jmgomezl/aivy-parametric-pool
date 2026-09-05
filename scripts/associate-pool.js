// Associate the pool with the settlement asset.
//
// The pool's key is and(agent, 2-of-3 oracles), so even this housekeeping needs
// the quorum — which is the point. The same structure that lets two oracles
// release a payout and nothing else also means the agent alone cannot quietly
// change what the pool holds.
import { TokenAssociateTransaction, TokenId, AccountId, PrivateKey } from '@hiero-ledger/sdk';
import { client, operator, assertOperatorKey, HASHSCAN, NETWORK } from '../src/config.js';
import { load } from '../src/registry.js';
import { settlementAsset } from '../src/asset.js';

async function main() {
  await assertOperatorKey();
  const c = client();
  const agent = operator();
  const reg = load(NETWORK);
  const asset = settlementAsset(NETWORK);

  if (asset.kind === 'hbar') { console.log('Settling in HBAR — nothing to associate.'); return c.close(); }
  if (!reg.poolAccountId) throw new Error(`${NETWORK} is not provisioned. Run: npm run provision`);

  const poolId = AccountId.fromString(reg.poolAccountId);
  const token = TokenId.fromString(asset.tokenId);

  const already = await fetch(`https://${NETWORK}.mirrornode.hedera.com/api/v1/accounts/${poolId}/tokens?token.id=${token}`)
    .then((r) => r.json()).then((b) => (b.tokens ?? []).length > 0).catch(() => false);
  if (already) {
    console.log(`pool ${poolId} already holds ${asset.symbol} (${token})`);
    return c.close();
  }

  const oracles = reg.oraclePrivateKeys.map((k) => PrivateKey.fromStringDer(k));
  console.log(`associating pool ${poolId} with ${asset.symbol} ${token}`);
  console.log(`  needs the agent and 2 of ${oracles.length} oracles`);

  let tx = await new TokenAssociateTransaction()
    .setAccountId(poolId)
    .setTokenIds([token])
    .freezeWith(c)
    .sign(agent.key);
  console.log('  agent signed');
  tx = await tx.sign(oracles[0]); console.log('  oracle 1 signed');
  tx = await tx.sign(oracles[1]); console.log('  oracle 2 signed — quorum met');

  const res = await tx.execute(c);
  await res.getReceipt(c);
  console.log(`\nassociated. ${HASHSCAN('transaction', res.transactionId.toString())}`);
  console.log(`Fund the pool: send ${asset.symbol} to ${poolId}`);
  if (asset.isUsdc && NETWORK === 'testnet') {
    console.log('  Circle testnet faucet: https://faucet.circle.com  (Hedera Testnet, 20 USDC / 2h)');
  }
  c.close();
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
