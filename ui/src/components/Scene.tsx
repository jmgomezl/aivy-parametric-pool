import type { ReactNode } from 'react';
import { Id } from './ui';
import type { Kind } from '../lib/hashscan';

export interface Link { kind: Kind; id: string; label: string; href?: string }

/**
 * The frame every beat uses: a short title and one line of caption on top,
 * the visual in the middle, a few big numbers on the right, and the ledger
 * ids that verify it in a slim strip at the bottom.
 */
export function Scene({ n, kicker, title, caption, hud, links, children, note, verifyLabel = 'verify on HashScan' }: { n: number; kicker: string; title: ReactNode; caption?: ReactNode; hud?: ReactNode; links?: Link[]; children: ReactNode; note?: ReactNode; verifyLabel?: string }) {
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-[24px]">
      <header className="flex items-end justify-between gap-[48px]">
        <div className="flex flex-col gap-[14px]">
          <div className="kicker"><span className="text-fg-1">{String(n).padStart(2, '0')}</span><span className="mx-3 text-fg-3">/</span>{kicker}</div>
          <h1 className="title enter" style={{ fontSize: 60 }}>{title}</h1>
          {caption ? <p className="lede enter enter-d1 max-w-[72ch]">{caption}</p> : null}
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_340px] gap-[48px] items-stretch enter enter-d1">
        <div className="relative min-h-0 rounded-[14px] border border-line bg-bg-1/40 overflow-hidden">{children}</div>
        <aside className="flex flex-col justify-center gap-[34px]">{hud}</aside>
      </div>

      <footer className="flex items-center justify-between gap-[40px] text-[15px] enter enter-d2">
        <div className="flex min-w-0 items-center gap-[26px] whitespace-nowrap overflow-hidden">
          <span className="label">{verifyLabel}</span>
          {links?.map((l) => (
            <span key={l.label + l.id} className="flex items-baseline gap-[8px]">
              <span className="label">{l.label}</span>
              <Id kind={l.kind} id={l.id} href={l.href} size="sm" />
            </span>
          ))}
        </div>
        {note ? <div className="label whitespace-nowrap">{note}</div> : null}
      </footer>
    </div>
  );
}
