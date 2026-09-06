// Permanent assets, created once.
//
// The pool account, the share token, the policy collection and the terms topic
// are not per-run artifacts — they are the protocol's identity. Re-creating them
// on every run costs about a dollar a token on mainnet and throws away the
// history that makes the ledger record worth reading.
//
// So each is resolved through here: look it up in the registry, confirm it still
// exists on the network it claims to, and only create one if there is none. Set
// RECREATE=1 to force a fresh set.
import fs from 'node:fs';
import path from 'node:path';

const file = (network) => path.join(process.cwd(), '.artifacts', `registry-${network}.json`);

export function load(network) {
  try { return JSON.parse(fs.readFileSync(file(network), 'utf8')); }
  catch { return {}; }
}

export function save(network, patch) {
  const next = { ...load(network), ...patch, network, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(file(network)), { recursive: true });
  fs.writeFileSync(file(network), JSON.stringify(next, null, 2), {mode:0o600});
  fs.chmodSync(file(network),0o600);
  return next;
}

const MIRROR = (network) => `https://${network}.mirrornode.hedera.com/api/v1`;

/** Confirm an id is really on this network before trusting the registry. */
export async function exists(network, kind, id) {
  if (!id) return false;
  const pathFor = { account: 'accounts', token: 'tokens', topic: 'topics' }[kind];
  try {
    const res = await fetch(`${MIRROR(network)}/${pathFor}/${id}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const body = await res.json();
    return !body._status && !body.deleted;
  } catch { return false; }
}

/**
 * Return the registered asset, or create one and register it.
 * `create` is only called when there is nothing usable to reuse.
 */
export async function ensure(network, kind, key, create, { recreate = process.env.RECREATE === '1' } = {}) {
  const registry = load(network);
  const known = registry[key];
  if (!recreate && (await exists(network, kind, known))) {
    return { id: known, reused: true };
  }
  const made = await create();
  save(network, { [key]: made.id.toString(), [`${key}Tx`]: made.txId ?? null });
  return { id: made.id.toString(), reused: false, txId: made.txId };
}
