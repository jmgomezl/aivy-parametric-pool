// Pin a place, get an answer. Three steps, always visible: place → price → protect.
// The agent is asked on every change (free); it writes only on the button.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C, Lock } from '../components/viz';
import { Id, Pill } from '../components/ui';
import * as agent from '../lib/agent';
import { MAX_DAYS, MODEL, around, coverForBudget, placeName, price, sourceUrl, type PriceOpts } from '../lib/hazard';
import { navigate, policyPath } from '../lib/router';
import { refresh, remember, useAgent } from '../lib/store';
import { History, Slider } from './History';
import type { MapState, Pin } from './AtlasMap';

type Phase =
  | { at: 'quoting' }
  | { at: 'quoted'; quote: agent.Quote }
  | { at: 'declined'; refusal: agent.Refusal }
  | { at: 'issuing'; quote: agent.Quote; step: number }
  | { at: 'held'; issued: agent.Issued };

const STEPS = ['terms written to the ledger', 'policy minted', 'premium paid', 'payout scheduled and signed'];
const usd = (n: number | undefined, digits = 2) => (typeof n === 'number' && Number.isFinite(n) ? `$${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}` : '—');
const dateIn = (days: number) => new Date(Date.now() + days * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** The refusal reasons, in plain language for the pill. */
const REASON: Record<string, string> = {
  no_record: 'nothing to insure here',
  below_viability: 'too small to write',
  window_too_long: 'window too long',
  exceeds_capital: 'pool has no headroom',
  rate_limited: 'rate limited',
  mainnet_writes_disabled: 'read only on mainnet',
  daily_policy_cap: 'closed for today',
  daily_cover_cap: 'closed for today',
  unreachable: 'agent not answering',
};

/* ------------------------------------------------------------------ steps */
function Steps({ stage, refused = false }: { stage: 1 | 2 | 3; refused?: boolean }) {
  const items = ['place', 'price', 'protect'];
  return (
    <ol className="steps">
      {items.map((s, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const state = n < stage ? 'done' : n === stage ? (refused ? 'refused' : 'now') : 'todo';
        return (
          <li key={s} className={`step-dot step-${state}`}>
            <span className="dot" />
            <span>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function QuotePanel({ pin, map, budget, days, onBudget, onDays, onClose, onIssued }: {
  pin: Pin; map: MapState; budget: number; days: number;
  onBudget: (v: number) => void; onDays: (v: number) => void;
  onClose: () => void; onIssued?: (p: agent.Policy) => void;
}) {
  const a = useAgent();
  const [phase, setPhase] = useState<Phase>({ at: 'quoting' });
  const [why, setWhy] = useState(false);
  const req = useRef(0);

  // Ask the agent whenever the question changes. Debounced so slider drags do not flood it.
  useEffect(() => {
    if (!a.checked || !a.online) return;
    if (phase.at === 'issuing' || phase.at === 'held') return;
    const id = ++req.current;
    setPhase({ at: 'quoting' });
    const t = setTimeout(async () => {
      try {
        const q = await agent.quote(pin.lat, pin.lon, budget, days);
        if (req.current !== id) return;
        setPhase(q.ok ? { at: 'quoted', quote: q as agent.Quote } : { at: 'declined', refusal: q as agent.Refusal });
      } catch {
        if (req.current === id) setPhase({ at: 'declined', refusal: { ok: false, reason: 'unreachable', message: 'The agent stopped answering. The frozen catalogue below still prices the record.' } });
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin.lat, pin.lon, budget, days, a.checked, a.online]);

  useEffect(() => { setPhase({ at: 'quoting' }); }, [pin.lat, pin.lon]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const buy = useCallback(async () => {
    if (phase.at !== 'quoted') return;
    const quote = phase.quote;
    setPhase({ at: 'issuing', quote, step: 0 });
    const tick = setInterval(() => setPhase((p) => (p.at === 'issuing' ? { ...p, step: Math.min(p.step + 1, STEPS.length - 1) } : p)), 1400);
    let result: agent.Issued | agent.Refusal;
    try { result = await agent.buy({ lat: pin.lat, lon: pin.lon, place: pin.name ?? null, budgetUsd: budget, days }); }
    catch (e) { result = { ok: false, reason: 'unreachable', message: e instanceof Error ? e.message : 'The agent stopped answering.' }; }
    clearInterval(tick);
    if (result.ok) { remember(String(result.policy.serial)); setPhase({ at: 'held', issued: result }); onIssued?.(result.policy); }
    else setPhase({ at: 'declined', refusal: result });
    void refresh();
  }, [phase, pin, budget, days, onIssued]);

  // the frozen catalogue: always available, the only source while scrubbing or offline
  const localOpts = useMemo<PriceOpts>(() => ({ now: map.now, minMag: map.minMag, days }), [map.now, map.minMag, days]);
  const local = useMemo(() => coverForBudget(pin.lat, pin.lon, budget, localOpts), [pin.lat, pin.lon, budget, localOpts]);
  const fullNearby = useMemo(() => around(pin.lat, pin.lon, map.minMag), [pin.lat, pin.lon, map.minMag]);
  const yearAgo = useMemo(() => price(pin.lat, pin.lon, { ...localOpts, now: new Date(map.now.getTime() - 365.25 * 86400000) }), [pin.lat, pin.lon, localOpts, map.now]);
  void yearAgo;

  const net = a.network;
  const historical = !map.live;
  const q = phase.at === 'quoted' || phase.at === 'issuing' ? phase.quote : phase.at === 'held' ? phase.issued.quote : null;
  const canBuy = phase.at === 'quoted' && a.online && a.writesAllowed && !historical;
  const stage: 1 | 2 | 3 = phase.at === 'held' || phase.at === 'issuing' ? 3 : 2;

  return (
    <aside className="panel">
      <div className="flex items-center justify-between">
        <Steps stage={phase.at === 'held' ? 3 : stage} refused={phase.at === 'declined'} />
        <button type="button" className="icon-btn" onClick={onClose} title="close · Esc">×</button>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[26px] leading-tight text-fg-0" style={{ letterSpacing: '-0.012em' }}>{placeName(pin)}</div>
        <div className="label num mt-[2px]">{pin.lat.toFixed(2)}, {pin.lon.toFixed(2)}</div>
      </div>

      {/* ------------------------------------------------------- the answer */}
      {historical ? (
        <section className="gap-[12px]">
          <Pill state="pending">the record as of {map.year}</Pill>
          <Answer premium={budget} cover={local.priced.count ? local.coverHbar : null} days={days} model />
          <div className="label">Live quotes price today's record. Move the year back to {new Date().getUTCFullYear()} to buy.</div>
        </section>
      ) : !a.checked ? (
        <div className="label">reaching the agent…</div>
      ) : !a.online ? (
        <section className="gap-[12px]">
          <Pill state="pending">agent offline · estimate only</Pill>
          <Answer premium={budget} cover={local.priced.count ? local.coverHbar : null} days={days} model />
          <div className="label">Nothing can be bought until the agent is back (<span className="num">npm run serve</span>).</div>
        </section>
      ) : phase.at === 'held' ? (
        <Held issued={phase.issued} net={net} onAnother={onClose} />
      ) : phase.at === 'issuing' ? (
        <section className="gap-[14px]">
          <Answer premium={phase.quote.premium} cover={phase.quote.payout} days={days} />
          <div className="flex flex-col gap-[10px]">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-[12px] text-[16px]">
                <span className={`num w-[14px] ${i <= phase.step ? 'text-ok' : 'text-fg-3'}`}>{i < phase.step ? '✓' : i === phase.step ? '•' : '·'}</span>
                <span className={i <= phase.step ? 'text-fg-0' : 'text-fg-3'}>{s}</span>
              </div>
            ))}
          </div>
          <div className="label">Writing to Hedera {net}. A few seconds.</div>
        </section>
      ) : phase.at === 'declined' ? (
        <section className="gap-[12px]">
          <Pill state="refused">{REASON[phase.refusal.reason] ?? phase.refusal.reason.replace(/_/g, ' ')}</Pill>
          <p className="text-[17px] leading-[1.45] text-fg-0" style={{ textWrap: 'pretty' }}>{phase.refusal.message}</p>
          {typeof phase.refusal.retryAfter === 'number' ? <div className="label num">try again in {Math.ceil(phase.refusal.retryAfter / 60)} min</div> : null}
          <div className="label">That is the agent's answer, not an error. {phase.refusal.reason === 'no_record' ? 'Try somewhere the ground has moved: the bright bands on the map.' : phase.refusal.reason === 'below_viability' ? 'A larger budget makes it worth writing.' : ''}</div>
        </section>
      ) : (
        <section className="gap-[14px]">
          <Answer premium={q?.premium ?? budget} cover={q ? q.payout : null} days={days} pending={!q} />
          <button type="button" disabled={!canBuy} onClick={buy} className="buy" title={!a.writesAllowed ? 'this agent does not write on mainnet' : undefined}>
            <span>{a.writesAllowed ? 'Protect this place' : 'Read only on mainnet'}</span>
            <span className="num">{q ? usd(q.premium) : ''}</span>
          </button>
          {q ? <div className="label num">settles as {q.settled.payout.toFixed(2)} {q.settled.symbol} · Hedera {net}</div> : null}
        </section>
      )}

      {/* ------------------------------------------------------- the knobs */}
      {phase.at !== 'held' && phase.at !== 'issuing' ? (
        <section className="grid grid-cols-2 gap-x-[16px]" style={{ display: 'grid' }}>
          <Slider label="your budget" value={budget} min={1} max={50} unit="USD" onChange={onBudget} format={(v) => `$${v}`} />
          <Slider label="days of cover" value={days} min={7} max={MAX_DAYS} unit="days" onChange={onDays} />
        </section>
      ) : null}

      {/* ------------------------------------------------------- why */}
      {phase.at !== 'held' && phase.at !== 'issuing' ? (
        <section className="gap-[10px]">
          <button type="button" className="flex items-center gap-[10px] text-left" onClick={() => setWhy((v) => !v)}>
            <span className="num text-fg-2">{why ? '−' : '+'}</span>
            <span className="text-[15px] text-fg-1">Why this price</span>
          </button>
          {why ? (
            <div className="flex flex-col gap-[14px]">
              <Row k={`M${map.minMag}+ earthquakes within 300 km since 1970`} v={String(q ? q.hazard.count : local.priced.count)} />
              <Row k={`chance of one within 100 km in ${days} days`} v={`${((q ? q.probability : local.priced.probability) * 100).toFixed(2)} %`} />
              <Row k="margin for a thin record" v={q ? `+${Math.round(q.hazard.relativeError * 100)} %` : Number.isFinite(local.priced.relativeError) ? `+${Math.round(local.priced.relativeError * 100)} %` : '—'} />
              <Row k="of every dollar, reserved for payouts" v={`${Math.round((q ? q.lossRatio : MODEL.lossRatio) * 100)} ¢`} />
              {fullNearby.length ? (
                <div className="flex flex-col gap-[6px]">
                  <div className="label">how this price has moved since 1985 · today = 100</div>
                  <History nearby={fullNearby} opts={localOpts} markYear={map.year} normalize />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-x-[16px] text-[14px]">
                <a className="hs label" href={q?.hazard.source ?? sourceUrl(pin.lat, pin.lon, map.minMag)} target="_blank" rel="noreferrer">recount at USGS<span className="arrow">↗</span></a>
                {a.pool ? <span className="flex items-baseline gap-[6px]"><span className="label">pool</span><Id kind="account" id={a.pool.poolAccountId} size="sm" network={net} /></span> : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}

/* ----------------------------------------------------------------- pieces */
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-[12px] border-b border-line pb-[6px] last:border-b-0">
      <span className="label">{k}</span>
      <span className="num text-[15px] text-fg-0">{v}</span>
    </div>
  );
}

/** The whole product in one glance: what you pay, what you get, and the sentence that explains it. */
function Answer({ premium, cover, days, pending = false, model = false }: { premium: number; cover: number | null; days: number; pending?: boolean; model?: boolean }) {
  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex items-end gap-[14px]">
        <span className={`num leading-none ${pending ? 'text-fg-3' : 'text-fg-0'}`} style={{ fontSize: 40, letterSpacing: '-0.02em' }}>{usd(premium, premium % 1 ? 2 : 0)}</span>
        <span className="num text-fg-3 pb-[6px]" style={{ fontSize: 22 }}>→</span>
        <span className={`num leading-none ${pending || cover === null ? 'text-fg-3' : 'text-ok'}`} style={{ fontSize: 40, letterSpacing: '-0.02em' }}>{cover === null ? '—' : pending ? '…' : usd(cover, 0)}</span>
      </div>
      <p className="text-[15px] leading-[1.45] text-fg-1" style={{ textWrap: 'pretty' }}>
        {cover === null
          ? 'No qualifying earthquake on record within 300 km, so there is nothing to price.'
          : <>Pay {usd(premium, premium % 1 ? 2 : 0)} once. If an M6+ earthquake strikes within 100 km before {dateIn(days)}, {usd(cover, 0)} is paid to you automatically{model ? ', by the model on the frozen record' : ''}. No claim, no adjuster.</>}
      </p>
    </div>
  );
}

/** After a purchase: not a receipt — the same ring as beat 05, holding their payout. */
function Held({ issued, net, onAnother }: { issued: agent.Issued; net: agent.Network; onAnother: () => void }) {
  const p = issued.policy;
  return (
    <section className="gap-[14px]">
      <div className="flex items-center justify-between">
        <Pill state="pending">protected · awaiting quorum</Pill>
        <span className="label num">policy #{p.serial}</span>
      </div>
      <svg viewBox="0 0 380 290" width="100%">
        <Lock cx={190} cy={136} r={90} agent oracles={[false, false, false]} threshold={2} names={['SGC', 'USGS ComCat', 'EMSC']} state="pending" centre={
          <g>
            <text x={190} y={132} textAnchor="middle" className="num" fill={C.fg0} fontSize={26}>{usd(p.payoutUsd, 0)}</text>
            <text x={190} y={156} textAnchor="middle" className="label" fill={C.fg2} fontSize={12}>held for you</text>
          </g>
        } />
      </svg>
      <p className="text-[15px] leading-[1.45] text-fg-1" style={{ textWrap: 'pretty' }}>
        Until {p.lapsesAt.slice(0, 10)}, an M6+ earthquake within 100 km pays {usd(p.payoutUsd, 0)} to your account by itself. The payout is already signed and on the ledger; it only waits for two of three oracle keys.
      </p>
      <a href={policyPath(p.serial)} onClick={(e) => { e.preventDefault(); navigate(policyPath(p.serial)); }} className="buy" style={{ textDecoration: 'none' }}>
        <span>Open policy #{p.serial}</span><span className="num">→</span>
      </a>
      <button type="button" className="chip self-start" onClick={onAnother}>protect another place</button>
      <div className="flex flex-wrap gap-x-[18px] gap-y-[6px] text-[14px]">
        <span className="flex items-baseline gap-[6px]"><span className="label">payout</span><Id kind="schedule" id={p.scheduleId} size="sm" network={net} /></span>
        <span className="flex items-baseline gap-[6px]"><span className="label">premium</span><Id kind="transaction" id={p.saleTxId} size="sm" network={net} /></span>
      </div>
    </section>
  );
}
