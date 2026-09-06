// The underwriting agent, over HTTP.
//
// Quoting is free and open. Issuing writes to the ledger and spends the agent's
// own HBAR, so it is rate-limited and refused outright on mainnet — a refusal is
// a normal answer here, not an error, and the UI shows the agent's own words.
const BASE = import.meta.env.VITE_AGENT_URL ?? '';

export type Network = 'testnet' | 'mainnet';

export interface Hazard {
  lambda: number; lambdaPriced: number; count: number; years: number;
  relativeError: number; z: number; triggerRadiusKm: number; referenceRadiusKm: number;
  since: string; source: string;
}

export interface Quote {
  ok: true;
  premium: number; payout: number; probability: number; expectedLoss: number;
  days: number; lossRatio: number; floor: number;
  hazard: Hazard;
  asset: { kind: 'hbar' | 'token'; symbol: string; tokenId: string | null; decimals: number; isUsdc: boolean };
  fx: { hbarUsd: number; source: string; at: string } | null;
  settled: { premiumUnits: number; payoutUnits: number; premium: number; payout: number; symbol: string };
}

export interface Refusal {
  ok: false;
  reason: 'no_record' | 'below_viability' | 'window_too_long' | 'exceeds_capital' |
          'rate_limited' | 'mainnet_writes_disabled' | 'daily_policy_cap' | 'daily_cover_cap' | string;
  message: string;
  retryAfter?: number;
  [k: string]: unknown;
}

export interface Policy {
  serial: string; lat: number; lon: number; place: string | null;
  premiumUsd: number; payoutUsd: number; premiumHbar: number; payoutHbar: number;
  premiumUnits?: number; payoutUnits?: number; asset?: string;
  buyerId: string; brokerId: string | null; termsPointer: string;
  receipts?: { mint?: string; delivery?: string; freeze?: string };
  saleTxId: string; scheduleId: string; lapsesAt: string; settled: boolean;
  recordedAt?: string; executedAt?: string;
  state?: 'active' | 'confirming' | 'paid' | 'expired' | 'unavailable';
  ledger?: { checkedAt: string; available: boolean; agentSigned: boolean; oracles: { name: string; signed: boolean }[]; executedAt: string | null; error?: string };
  monitoring?: { mode: 'manual' | 'automatic'; lastCheckedAt?: string; message?: string };
  trigger?: { minMagnitude: number; radiusKm: number; maxDepthKm: number; windowStart?: string; windowEnd?: string };
  network?: Network;

}

export interface Issued { ok: true; policy: Policy; quote: Quote; hashscan: Record<string, string> }

export interface Pool {
  network: Network; poolAccountId: string; policyTokenId?: string;
  asset: { symbol: string; tokenId: string | null; isUsdc: boolean };
  capital: number; committed: number; headroom: number;
  capitalHbar: number; committedHbar: number; headroomHbar: number;
  livePolicies: number;
  budgetToday: { policies: number; usd: number; limits: { policies: number; usd: number } };
  hashscan: string;
}

export interface Health { ok: boolean; network: Network; writesAllowed: boolean }

async function call<T>(path: string, init?: RequestInit, timeoutMs = 120_000): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => ({ ok: false, reason: 'unreadable', message: `Agent returned ${res.status}` }));
  if (!res.ok && !body.reason) throw new Error(body.message ?? `Service returned ${res.status}`);
  return body as T;
}

export const health = () => call<Health>('/api/health', undefined, 5_000);
export const pool = () => call<Pool>('/api/pool', undefined, 20_000);

export const quote = (lat: number, lon: number, budgetUsd = 4, days = 30) =>
  call<Quote | Refusal>(`/api/quote?lat=${lat}&lon=${lon}&budget=${budgetUsd}&days=${days}`, undefined, 30_000);

export const buy = (input: { lat: number; lon: number; place?: string | null; budgetUsd?: number; days?: number; requestId?: string }) =>
  call<Issued | Refusal>('/api/policies', { method: 'POST', body: JSON.stringify(input) });

export const policies = () => call<{ network: Network; policies: Policy[] }>('/api/policies', undefined, 20_000);
export const policy = (serial: string) => call<(Policy & { hashscan: { schedule: string; sale: string } }) | Refusal>(`/api/policies/${serial}`, undefined, 20_000);

/** Whether the agent is reachable at all — the UI degrades to the frozen model if not. */
export async function reachable(): Promise<boolean> {
  try { return (await health()).ok; } catch { return false; }
}

/** A policy's payout, in the unit it settles in. */
export const payoutLabel = (p: Policy) => p.asset && p.asset !== 'HBAR' ? `${p.payoutHbar.toFixed(2)} ${p.asset}` : `${p.payoutHbar.toFixed(2)} ℏ`;

export type RequestStatus = {ok:true;status:'creating'|'needs_review'|'complete';policy?:Policy;message?:string;place?:string} | Refusal;
export const requestStatus=(id:string)=>call<RequestStatus>(`/api/requests/${encodeURIComponent(id)}`,undefined,10000);

export interface PaymentReceipt { kind: 'x402-payment'; network: Network; transaction: string; amount: string; asset: string; resource: string; at: string }
export const activity = () => call<{ network: Network; payments: PaymentReceipt[]; checkedAt: string }>('/api/activity', undefined, 10000);

export async function findPlaces(query: string, signal: AbortSignal): Promise<{name:string;lat:number;lon:number}[]> {
  const res=await fetch(`${BASE}/api/places?q=${encodeURIComponent(query)}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
  const data=await res.json();
  if(!res.ok||!Array.isArray(data.places))throw new Error('Place search unavailable');
  return data.places;
}
