// Environment + client wiring. The operator is the POOL AGENT: it pays network
// fees, holds the share-token supply key, and is one half of the pool account's
// key. It can never move pool capital on its own — see src/pool/keys.js.
import 'dotenv/config';
import { Client, PrivateKey, AccountId } from '@hashgraph/sdk';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}

export const NETWORK = process.env.HEDERA_NETWORK ?? 'testnet';

export function operator() {
  const id = AccountId.fromString(required('HEDERA_OPERATOR_ID'));
  const key = PrivateKey.fromStringDer(required('HEDERA_OPERATOR_KEY'));
  return { id, key };
}

export function client() {
  const { id, key } = operator();
  const c = NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  c.setOperator(id, key);
  return c;
}

export const HASHSCAN = (kind, id) => `https://hashscan.io/${NETWORK}/${kind}/${id}`;
