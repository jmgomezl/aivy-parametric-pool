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
export const MIRROR = `https://${NETWORK}.mirrornode.hedera.com/api/v1`;

// A bare 32-byte hex string is valid input to BOTH fromStringECDSA and
// fromStringED25519, and fromStringDer accepts it too without throwing — it just
// returns the wrong key. Guessing therefore fails silently and surfaces much
// later as INVALID_SIGNATURE, so the type is explicit and shape-derived, and
// assertOperatorKey() below checks it against the ledger before anything runs.
function parseKey(raw, hint) {
  const hex = raw.replace(/^0x/, '');
  const type = hint ?? (hex.startsWith('302e') || hex.startsWith('3030') ? 'DER' : 'ECDSA');
  const parsers = { DER: PrivateKey.fromStringDer, ECDSA: PrivateKey.fromStringECDSA, ED25519: PrivateKey.fromStringED25519 };
  const parse = parsers[type.toUpperCase()];
  if (!parse) throw new Error(`Unknown HEDERA_OPERATOR_KEY_TYPE "${type}" (use DER, ECDSA or ED25519)`);
  return parse(raw);
}

export function operator() {
  const id = AccountId.fromString(required('HEDERA_OPERATOR_ID'));
  const key = parseKey(required('HEDERA_OPERATOR_KEY'), process.env.HEDERA_OPERATOR_KEY_TYPE);
  return { id, key };
}

/** Fail loudly at startup if the configured key is not the account's key. */
export async function assertOperatorKey() {
  const { id, key } = operator();
  const res = await fetch(`${MIRROR}/accounts/${id.toString()}`);
  if (!res.ok) throw new Error(`Mirror node ${res.status} for ${id.toString()}`);
  const onLedger = (await res.json()).key?.key?.toLowerCase();
  const local = key.publicKey.toStringRaw().toLowerCase();
  if (onLedger !== local) {
    throw new Error(
      `HEDERA_OPERATOR_KEY does not match ${id.toString()}.\n` +
      `  on ledger: ${onLedger}\n  from .env: ${local}\n` +
      `  Set HEDERA_OPERATOR_KEY_TYPE to DER, ECDSA or ED25519.`
    );
  }
  return true;
}

export function client() {
  const { id, key } = operator();
  const c = NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  c.setOperator(id, key);
  return c;
}

export const HASHSCAN = (kind, id) => `https://hashscan.io/${NETWORK}/${kind}/${id}`;
