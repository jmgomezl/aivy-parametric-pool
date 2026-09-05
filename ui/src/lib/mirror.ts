// Live reads from the public Hedera mirror node. The frozen snapshot renders the
// page; these calls confirm the parts that can still change (balances, schedule
// state, supply, ownership) and report plainly when they cannot be reached.
import { useEffect, useState } from 'react';

export const MIRROR = 'https://mainnet.mirrornode.hedera.com/api/v1';

export type Live<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T; at: string }
  | { status: 'unavailable'; reason: string };

async function get<T>(path: string, timeoutMs = 8000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${MIRROR}${path}`, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`mirror node ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export interface AccountLive { balanceTinybar: number; tokens: { token_id: string; balance: number }[] }
export interface ScheduleLive { executedAt: string | null; signatures: number; deleted: boolean; expiresAt: string }
export interface TokenLive { totalSupply: string; symbol: string }
export interface NftLive { owner: string; metadata: string }

export const fetchAccount = async (id: string): Promise<AccountLive> => {
  const j = await get<{ balance: { balance: number; tokens: { token_id: string; balance: number }[] } }>(`/accounts/${id}?transactions=false`);
  return { balanceTinybar: j.balance.balance, tokens: j.balance.tokens ?? [] };
};

export const fetchSchedule = async (id: string): Promise<ScheduleLive> => {
  const j = await get<{ executed_timestamp: string | null; signatures: unknown[]; deleted: boolean; expiration_time: string }>(`/schedules/${id}`);
  return {
    executedAt: j.executed_timestamp ? new Date(Number(j.executed_timestamp) * 1000).toISOString() : null,
    signatures: j.signatures.length,
    deleted: j.deleted,
    expiresAt: new Date(Number(j.expiration_time) * 1000).toISOString(),
  };
};

export const fetchToken = async (id: string): Promise<TokenLive> => {
  const j = await get<{ total_supply: string; symbol: string }>(`/tokens/${id}`);
  return { totalSupply: j.total_supply, symbol: j.symbol };
};

export const fetchNft = async (tokenId: string, serial: number): Promise<NftLive> => {
  const j = await get<{ account_id: string; metadata: string }>(`/tokens/${tokenId}/nfts/${serial}`);
  return { owner: j.account_id, metadata: atob(j.metadata) };
};

/** Run a fetcher once on mount; expose loading / ok / unavailable. */
export function useLive<T>(fetcher: () => Promise<T>, deps: unknown[] = []): Live<T> {
  const [state, setState] = useState<Live<T>>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    fetcher()
      .then((data) => alive && setState({ status: 'ok', data, at: new Date().toISOString() }))
      .catch((e: unknown) => alive && setState({ status: 'unavailable', reason: e instanceof Error ? e.message : 'request failed' }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
