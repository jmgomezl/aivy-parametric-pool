// Creates the risk-pool account whose key is and(agent, 2-of-3 oracles).
import { AccountCreateTransaction, Hbar, PrivateKey } from '@hiero-ledger/sdk';
import { poolAccountKey, ORACLE_THRESHOLD } from './keys.js';

/** Generate the three oracle keypairs. In production each oracle generates its own. */
export function generateOracleKeys(n = 3) {
  return Array.from({ length: n }, () => PrivateKey.generateED25519());
}

export async function createPoolAccount(client, agentPublicKey, oraclePublicKeys, initialHbar = 0) {
  const key = poolAccountKey(agentPublicKey, oraclePublicKeys, ORACLE_THRESHOLD);

  const tx = await new AccountCreateTransaction()
    .setKeyWithoutAlias(key)
    .setInitialBalance(new Hbar(initialHbar))
    // The pool receives premiums and deposits from many accounts; requiring a
    // signature to receive would mean the quorum has to sign every inbound
    // transfer, which defeats the whole design.
    .setReceiverSignatureRequired(false)
    .setAccountMemo('aivy parametric risk pool')
    .execute(client);

  const receipt = await tx.getReceipt(client);
  return { accountId: receipt.accountId, txId: tx.transactionId.toString(), key };
}
