import { PublicKey } from '@hiero-ledger/sdk';
import { SOURCES } from './oracle/sources.js';
const iso = value => value ? new Date(Number(value) * 1000).toISOString() : null;
/** Preserve large Mirror integers before JSON parsing can round them (Node 22+). */
export function parseMirrorJson(text) {
  return JSON.parse(text, (_key, value, context) => {
    if (typeof value !== 'number' || Number.isSafeInteger(value)) return value;
    if (Number.isInteger(value) || !Number.isFinite(value)) {
      if (!/^-?\d+$/.test(context?.source ?? '')) throw new Error('Unsupported ledger number');
      return context.source;
    }
    return value;
  });
}
/** Number-based demo displays must refuse amounts they cannot represent exactly. */
export function mirrorUnits(value) {
  if (!(typeof value === 'number' && Number.isSafeInteger(value)) &&
      !(typeof value === 'string' && /^\d+$/.test(value))) throw new Error('Invalid ledger balance');
  const units = BigInt(value);
  if (units < 0n || units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Ledger balance exceeds the demo display range');
  return Number(units);
}
export async function mirrorGet(network, path, fetcher = fetch) {
  if (!['mainnet','testnet'].includes(network)) throw new Error('Unsupported network');
  const r = await fetcher(`https://${network}.mirrornode.hedera.com/api/v1${path}`, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
  if (!r.ok) throw Object.assign(new Error(r.status === 404 ? 'Ledger record not found or not yet indexed (404)' : `Ledger temporarily unavailable (${r.status})`), { mirrorStatus: r.status });
  return parseMirrorJson(await r.text());
}
/** Query a known token directly: unrelated holdings cannot push it off page one. */
export async function readTokenBalance(network, accountId, tokenId, fetcher = fetch) {
  if (![accountId, tokenId].every(id => typeof id === 'string' && /^\d+\.\d+\.\d+$/.test(id))) throw new Error('Invalid ledger entity');
  const page = await mirrorGet(network, `/accounts/${accountId}/tokens?token.id=${tokenId}`, fetcher);
  if (!Array.isArray(page.tokens) || page.tokens.length !== 1 || page.tokens[0].token_id !== tokenId || page.links?.next) {
    throw new Error('Token balance not verified; the association may still be indexing');
  }
  return mirrorUnits(page.tokens[0].balance);
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
const cache = new Map(), inflight = new Map();
export async function readPolicies(network, book, identities, { fetcher = fetch, cacheMs = 8000 } = {}) {
  return Promise.all(book.map(async p => {
    const key=`${network}:${p.scheduleId}`, cached=cache.get(key);
    if(cached && Date.now()-cached.at<cacheMs)return {...p,network,...cached.status,settled:cached.status.state==='paid'};
    if(!inflight.has(key))inflight.set(key,(async()=>{
    try {
      const raw=await mirrorGet(network,`/schedules/${encodeURIComponent(p.scheduleId)}`,fetcher);
      const status=scheduleState(raw,identities);
      cache.set(key,{at:Date.now(),status});
      return {...status,settled:status.state==='paid'};
    } catch(error) {
      // Never manufacture an unsigned or expired state when the ledger cannot be reached.
      return {state:'unavailable',ledger:{checkedAt:new Date().toISOString(),available:false,agentSigned:false,oracles:[],executedAt:p.executedAt??null,error:error.message}};
    }
    })().finally(()=>inflight.delete(key)));
    return {...p,network,...await inflight.get(key)};
  }));
}
