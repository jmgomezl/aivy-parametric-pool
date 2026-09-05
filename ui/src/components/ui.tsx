import type { ReactNode } from 'react';
import { hashscan, type Kind } from '../lib/hashscan';

/** A ledger id that opens on HashScan. Monospace, because it is data. */
export function Id({ kind, id, label, href, size = 'md' }: { kind: Kind; id: string; label?: string; href?: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-[22px]' : size === 'sm' ? 'text-[15px]' : 'text-[17px]';
  return (
    <a className={`hs mono ${cls}`} href={href ?? hashscan(kind, id)} target="_blank" rel="noreferrer" title={`Open ${kind} ${id} on HashScan`}>
      <span>{label ?? id}</span>
      <span className="arrow">↗</span>
    </a>
  );
}

/** State is the only thing that earns colour. */
export type State = 'ok' | 'pending' | 'refused' | 'neutral';
export function Pill({ state, children, lg = false }: { state: State; children: ReactNode; lg?: boolean }) {
  return <span className={`pill pill-${state} ${lg ? 'pill-lg' : ''}`}>{children}</span>;
}
