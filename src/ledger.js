import { PublicKey } from '@hiero-ledger/sdk';
import { SOURCES } from './oracle/sources.js';
const iso = value => value ? new Date(Number(value) * 1000).toISOString() : null;
export async function mirrorGet(network, path, fetcher = fetch) {
  if (!['mainnet','testnet'].includes(network)) throw new Error('Unsupported network');
  const r = await fetcher(`https://${network}.mirrornode.hedera.com/api/v1${path}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Ledger temporarily unavailable (${r.status})`);
  return r.json();
}
const keyHex = key => PublicKey.fromString(key).toStringRaw().toLowerCase();
export function scheduleState(raw, { agentPublicKey, oraclePublicKeys = [], oracleSources = [] }, now = Date.now()) {
  const keys = new Set((raw.signatures ?? []).map(s => Buffer.from(s.public_key_prefix, 'base64').toString('hex').toLowerCase()));
  const agentSigned = keys.has(keyHex(agentPublicKey));
  const oracles = oraclePublicKeys.map((key,i) => ({ name: SOURCES[oracleSources[i]]?.name ?? `Oracle ${i+1}`, signed: keys.has(keyHex(key)) }));
  const executedAt = iso(raw.executed_timestamp), expiresAt = iso(raw.expiration_time);
  return { state: executedAt ? 'paid' : raw.deleted || expiresAt && Date.parse(expiresAt) <= now ? 'expired' : !agentSigned ? 'unavailable' : oracles.some(o=>o.signed) ? 'confirming' : 'active', executedAt,
    ledger: { checkedAt: new Date(now).toISOString(), available: true, agentSigned, oracles, executedAt } };
}
const cache = new Map();
export async function readPolicies(network, book, identities, { fetcher = fetch, cacheMs = 8000 } = {}) {
  return Promise.all(book.map(async p => {
    const key=`${network}:${p.scheduleId}`, cached=cache.get(key);
    if(cached && Date.now()-cached.at<cacheMs)return {...p,network,...cached.status,settled:cached.status.state==='paid'};
    try {
      const raw=await mirrorGet(network,`/schedules/${encodeURIComponent(p.scheduleId)}`,fetcher);
      const status=scheduleState(raw,identities);
      cache.set(key,{at:Date.now(),status});
      return {...p,network,...status,settled:status.state==='paid'};
    } catch(error) {
      // Never manufacture an unsigned or expired state when the ledger cannot be reached.
      return {...p,network,state:'unavailable',ledger:{checkedAt:new Date().toISOString(),available:false,agentSigned:false,oracles:[],executedAt:p.executedAt??null,error:error.message}};
    }
  }));
}
