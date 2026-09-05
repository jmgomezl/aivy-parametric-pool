// The frozen public record of the mainnet run (see scripts/snapshot.mjs).
import snapshot from './data/mainnet.json';

export type Snapshot = typeof snapshot;

export interface Signature {
  role: string;
  name: string;
  index?: number;
  keyType: string;
  at: string;
  consensus: string;
  txId: string;
  viaCreate?: boolean;
}

export interface ScheduleRecord {
  scheduleId: string;
  memo: string;
  creator: string;
  payer: string;
  createTxId: string;
  createdAt: string;
  createdConsensus: string;
  expiresAt: string;
  waitForExpiry: boolean;
  adminKey: unknown;
  executedAt: string | null;
  executedConsensus: string | null;
  inner: { account: string | null; tinybar: number | null }[];
  signatures: Signature[];
  executedTx: { consensus: string; at: string; txId: string; transfers: { account: string; tinybar: number }[]; chargedFee: number } | null;
}

export const data: Snapshot = snapshot;

/** Human names for the accounts that appear in the story. */
export const who: Record<string, string> = {
  [data.accounts.agent.id]: 'pool agent',
  [data.accounts.pool.id]: 'pool',
  [data.accounts.lp1.id]: 'LP · first deposit',
  [data.accounts.lp2.id]: 'LP',
  [data.accounts.buyer.id]: 'buyer',
  [data.accounts.broker.id]: 'broker',
  [data.accounts.outsider.id]: 'outsider',
};

export const nameOf = (account: string) => who[account] ?? 'account';
