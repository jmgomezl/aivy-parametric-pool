// Creating an account without keeping its key strands whatever is in it.
//
// The demo scripts lost 16.8 HBAR on mainnet exactly this way: buyers, brokers,
// LPs and the outsider were funded and their keys thrown away when the process
// exited. Every account this project creates goes through here, and the key is
// written to the run artifact before the account is used for anything.
import fs from 'node:fs';
import path from 'node:path';
import { AccountCreateTransaction, Hbar, PrivateKey } from '@hiero-ledger/sdk';

const file = (network) => path.join(process.cwd(), '.artifacts', `keys-${network}.json`);

const read = (network) => {
  try { return JSON.parse(fs.readFileSync(file(network), 'utf8')); } catch { return {}; }
};

/** Remember a key we already hold, so a sweep can reach the account later. */
export function remember(network, id, key, label = '') {
  const all = read(network);
  all[String(id)] = { key: String(key), label, at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(file(network)), { recursive: true });
  fs.writeFileSync(file(network), JSON.stringify(all, null, 2), { mode: 0o600 });
}

/** Every account on this network whose key we still have. */
export const known = (network) =>
  Object.entries(read(network)).map(([id, v]) => ({ id, key: v.key, label: v.label }));

/** Create a funded account and keep its key. Use this instead of the raw transaction. */
export async function createFundedAccount(client, network, hbar, label = '') {
  const key = PrivateKey.generateECDSA();
  const res = await new AccountCreateTransaction()
    .setKeyWithoutAlias(key.publicKey)
    .setInitialBalance(new Hbar(hbar))
    .execute(client);
  const id = (await res.getReceipt(client)).accountId;
  remember(network, id, key.toStringDer(), label);
  return { id, key, txId: res.transactionId.toString() };
}
