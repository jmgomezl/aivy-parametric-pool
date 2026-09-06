// Shared, live state for the app: whether the agent is up, what network it is
// on, the pool's vital signs, and the serials this browser has bought. Polled
// gently; refreshed on demand after a write.
import { useEffect, useState } from 'react';
import * as agent from './agent';

export interface AgentState {
  checked: boolean;
  online: boolean;
  network: agent.Network;
  writesAllowed: boolean;
  pool: agent.Pool | null;
  poolAt: string | null;
}

let state: AgentState = { checked: false, online: false, network: 'testnet', writesAllowed: false, pool: null, poolAt: null };
const subs = new Set<(s: AgentState) => void>();
const emit = () => subs.forEach((f) => f(state));

export async function refresh() {
  try {
    const h = await agent.health();
    let pool: agent.Pool | null = state.pool;
    let poolAt = state.poolAt;
    try { pool = await agent.pool(); poolAt = new Date().toISOString(); } catch { /* keep the last reading */ }
    state = { checked: true, online: Boolean(h.ok), network: h.network, writesAllowed: h.writesAllowed, pool, poolAt };
  } catch {
    state = { ...state, checked: true, online: false };
  }
  emit();
}

let timer: number | null = null;
export function useAgent(): AgentState {
  const [s, setS] = useState(state);
  useEffect(() => {
    subs.add(setS);
    if (!state.checked) void refresh();
    if (timer === null) timer = window.setInterval(refresh, 30_000);
    return () => { subs.delete(setS); };
  }, []);
  return s;
}

/* ------------------------------------------------ policies bought here */
const KEY = 'aivy.mine';
export function mine(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]; } catch { return []; }
}
export function remember(serial: string) {
  try {
    const cur = mine();
    if (!cur.includes(serial)) localStorage.setItem(KEY, JSON.stringify([...cur, serial]));
  } catch { /* private mode: the list simply does not persist */ }
}
