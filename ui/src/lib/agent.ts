// The underwriting agent, over HTTP.
//
// Quoting is free and open. Issuing writes to the ledger and spends the agent's
// own HBAR, so it is rate-limited and refused outright on mainnet — a refusal is
// a normal answer here, not an error, and the UI shows the agent's own words.
const BASE = import.meta.env.VITE_AGENT_URL ?? 'http://localhost:8791';

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
  fx: { hbarUsd: number; source: string; at: string; demoScale: number };
  settled: { premiumHbar: number; payoutHbar: number };
}

export interface Refusal {
  ok: false;
  reason: 'no_record' | 'below_viability' | 'window_too_long' | 'exceeds_capital' |
          'rate_limited' | 'mainnet_writes_disabled' | 'daily_policy_cap' | 'daily_hbar_cap' | string;
  message: string;
  retryAfter?: number;
  [k: string]: unknown;
}

export interface Policy {
  serial: string; lat: number; lon: number; place: string | null;
  premiumUsd: number; payoutUsd: number; premiumHbar: number; payoutHbar: number;
  buyerId: string; brokerId: string | null; termsPointer: string;
  saleTxId: string; scheduleId: string; lapsesAt: string; settled: boolean;
}

export interface Issued { ok: true; policy: Policy; quote: Quote; hashscan: Record<string, string> }

export interface Pool {
  network: string; poolAccountId: string;
  capitalHbar: number; committedHbar: number; headroomHbar: number;
  livePolicies: number;
  budgetToday: { policies: number; hbar: number; limits: { policies: number; hbar: number } };
  hashscan: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.json().catch(() => ({ ok: false, reason: 'unreadable', message: `Agent returned ${res.status}` }));
  return body as T;
}

export const health = () => call<{ ok: boolean; network: string; writesAllowed: boolean }>('/api/health');
export const pool = () => call<Pool>('/api/pool');

export const quote = (lat: number, lon: number, budgetUsd = 4, days = 30) =>
  call<Quote | Refusal>(`/api/quote?lat=${lat}&lon=${lon}&budget=${budgetUsd}&days=${days}`);

export const buy = (input: { lat: number; lon: number; place?: string | null; budgetUsd?: number; days?: number }) =>
  call<Issued | Refusal>('/api/policies', { method: 'POST', body: JSON.stringify(input) });

export const policy = (serial: string) => call<Policy | Refusal>(`/api/policies/${serial}`);

/** Whether the agent is reachable at all — the UI degrades to the frozen model if not. */
export async function reachable(): Promise<boolean> {
  try { return (await health()).ok; } catch { return false; }
}
