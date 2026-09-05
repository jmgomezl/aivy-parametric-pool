import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from './data';
import { Id } from './components/ui';
import { fetchAccount, useLive } from './lib/mirror';
import { clock } from './lib/format';
import type { Beat } from './beats/types';
import { atlas } from './beats/00-atlas';
import { quote } from './beats/01-quote';
import { guard } from './beats/02-guard';
import { capital } from './beats/03-capital';
import { issued } from './beats/04-issued';
import { waiting } from './beats/05-waiting';
import { quake } from './beats/06-quake';
import { paid } from './beats/07-paid';
import { coda } from './beats/08-coda';
import { protect } from './beats/09-protect';

// index 0 is the atlas; the eight story beats keep their numbers 1–8.
const BEATS: Beat[] = [atlas, quote, guard, capital, issued, waiting, quake, paid, coda, protect];

/* ---------------------------------------------------------------- routing */
// The position lives in the URL hash (#3.1 = beat 3, sub-step 1; #0 = atlas) so a reload
// mid-recording lands on the same frame.
function readHash(): { b: number; s: number } {
  const m = /^#(\d+)(?:\.(\d+))?(?:@.*)?$/.exec(window.location.hash); // #0@lat,lon carries an atlas pin
  const b = m ? Math.min(Math.max(Number(m[1]), 0), BEATS.length - 1) : 0;
  const s = m && m[2] ? Math.min(Math.max(Number(m[2]), 0), BEATS[b].steps - 1) : 0;
  return { b, s };
}

function usePosition() {
  const [pos, setPos] = useState(readHash);
  useEffect(() => {
    const onHash = () => setPos(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((b: number, s = 0) => {
    const bb = Math.min(Math.max(b, 0), BEATS.length - 1);
    const ss = Math.min(Math.max(s, 0), BEATS[bb].steps - 1);
    window.location.hash = ss === 0 ? `#${bb}` : `#${bb}.${ss}`;
    setPos({ b: bb, s: ss });
  }, []);
  const next = useCallback(() => {
    const { b, s } = pos;
    if (s < BEATS[b].steps - 1) go(b, s + 1);
    else if (b < BEATS.length - 1) go(b + 1, 0);
  }, [pos, go]);
  const prev = useCallback(() => {
    const { b, s } = pos;
    if (s > 0) go(b, s - 1);
    else if (b > 0) go(b - 1, BEATS[b - 1].steps - 1);
  }, [pos, go]);
  return { pos, go, next, prev };
}

/* ------------------------------------------------------------- scaling */
// Authored at 1920 × 1080; scaled uniformly to whatever window is filming it.
function useScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

/* ------------------------------------------------------------------- app */
export default function App() {
  const { pos, go, next, prev } = usePosition();
  const scale = useScale();
  const beat = BEATS[pos.b];
  const pool = useLive(() => fetchAccount(data.accounts.pool.id), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'Enter': case 'j': case 'l': case 'PageDown': e.preventDefault(); next(); break;
        case 'ArrowLeft': case 'Backspace': case 'k': case 'h': case 'PageUp': e.preventDefault(); prev(); break;
        case 'Home': e.preventDefault(); go(0); break;
        case 'End': e.preventDefault(); go(BEATS.length - 1, BEATS[BEATS.length - 1].steps - 1); break;
        default:
          if (/^[0-9]$/.test(e.key)) { const n = Number(e.key); if (n < BEATS.length) { e.preventDefault(); go(n); } }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, go]);

  const ViewEl = beat.View;
  const frame = useMemo(() => ({ transform: `scale(${scale})` }), [scale]);

  return (
    <div className="h-full w-full flex items-center justify-center overflow-hidden bg-bg-0">
      <div style={{ width: 1920 * scale, height: 1080 * scale, position: 'relative' }}>
      <div className="stage" style={frame}>
        {/* top bar */}
        <header className="flex items-center justify-between border-b border-line px-[72px]">
          <div className="flex items-baseline gap-[18px]">
            <span className="text-[17px] font-medium tracking-[-0.01em] text-fg-0">Aivy Parametric Pool</span>
            <span className="text-[15px] text-fg-2">settlement timeline · one real policy, quote to payout</span>
          </div>
          <div className="flex items-center gap-[28px] text-[15px]">
            <span className="flex items-center gap-[8px] text-fg-1">
              <span className="inline-block h-[7px] w-[7px] rounded-full bg-fg-1" />
              Hedera mainnet
            </span>
            <span className="text-fg-2">pool <Id kind="account" id={data.accounts.pool.id} size="sm" /></span>
            <span className="flex items-center gap-[8px]">
              {pool.status === 'ok' ? (
                <><span className="inline-block h-[7px] w-[7px] rounded-full bg-ok" /><span className="text-fg-2">mirror node · <span className="num">{clock(pool.at, false)}</span> UTC</span></>
              ) : pool.status === 'loading' ? (
                <><span className="inline-block h-[7px] w-[7px] rounded-full bg-fg-3" /><span className="text-fg-3">mirror node</span></>
              ) : (
                <><span className="inline-block h-[7px] w-[7px] rounded-full bg-pending" /><span className="text-pending">mirror node unavailable · recorded values</span></>
              )}
            </span>
          </div>
        </header>

        {/* frame */}
        <main className="px-[72px] pt-[36px] pb-[28px] min-h-0" key={pos.b}>
          <ViewEl step={pos.s} />
        </main>

        {/* bottom bar: stepper + keys */}
        <footer className="flex items-center justify-between border-t border-line px-[72px]">
          <nav className="flex items-center gap-[30px]">
            {BEATS.map((b, i) => (
              <button key={b.label} type="button" onClick={() => go(i)} className={`step ${i === pos.b ? 'step-current' : i < pos.b ? 'step-done' : ''}`}>
                <span className="n">{String(i).padStart(2, '0')}</span>
                <span>{b.label}</span>
                {b.steps > 1 && i === pos.b ? <span className="num text-[13px] text-fg-3">{pos.s + 1}/{b.steps}</span> : null}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-[14px] text-[14px] text-fg-3">
            <span><kbd>←</kbd> <kbd>→</kbd> step</span>
            <span><kbd>0</kbd>–<kbd>8</kbd> jump</span>
          </div>
        </footer>
      </div>
      </div>
    </div>
  );
}
