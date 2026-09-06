// Pin a place, get an answer. The panel asks the agent on every change (free),
// shows its verdict in its own words, and — only on an explicit press — asks
// it to write the policy. The four ledger steps land right here.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Big, C, Delta, Lock } from '../components/viz';
import { Id, Pill } from '../components/ui';
import * as agent from '../lib/agent';
import { MAX_DAYS, MODEL, around, placeName, price, sourceUrl, type PriceOpts } from '../lib/hazard';
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

const STEPS = ['terms to HCS', 'policy minted', 'premium settled', 'payout scheduled'];
const usd = (n: number, digits = 2) => `$${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

/** The refusal reasons, in plain language for the pill. */
const REASON: Record<string, string> = {
  no_record: 'nothing to insure',
  below_viability: 'too small to write',
  window_too_long: 'window too long',
  exceeds_capital: 'no headroom',
  rate_limited: 'rate limited',
  mainnet_writes_disabled: 'mainnet · read only',
  daily_policy_cap: 'closed for today',
  daily_cover_cap: 'closed for today',
};

function KV({ k, v, dim = false }: { k: string; v: React.ReactNode; dim?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-[12px] py-[6px] border-b border-line last:border-b-0">
      <span className="label">{k}</span>
      <span className={`num text-[15px] text-right ${dim ? 'text-fg-2' : 'text-fg-0'}`}>{v}</span>
    </div>
  );
}

export function QuotePanel({ pin, map, onClose, onIssued }: { pin: Pin; map: MapState; onClose: () => void; onIssued?: (p: agent.Policy) => void }) {
  const a = useAgent();
  const [budget, setBudget] = useState(4);
  const [days, setDays] = useState(MODEL.days);
  const [phase, setPhase] = useState<Phase>({ at: 'quoting' });
  const req = useRef(0);

  // Ask the agent whenever the question changes. Debounced so slider drags do not flood it.
  useEffect(() => {
    if (!a.checked) return;
    if (!a.online) return;
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

  // a new pin means a new question, even mid-purchase display
  useEffect(() => { setPhase({ at: 'quoting' }); }, [pin.lat, pin.lon]);

  const buy = useCallback(async () => {
    if (phase.at !== 'quoted') return;
    const quote = phase.quote;
    setPhase({ at: 'issuing', quote, step: 0 });
    const tick = setInterval(() => setPhase((p) => (p.at === 'issuing' ? { ...p, step: Math.min(p.step + 1, STEPS.length - 1) } : p)), 1400);
    let result: agent.Issued | agent.Refusal;
    try { result = await agent.buy({ lat: pin.lat, lon: pin.lon, place: pin.name ?? null, budgetUsd: budget, days }); }
    catch (e) { result = { ok: false, reason: 'unreachable', message: e instanceof Error ? e.message : 'The agent stopped answering.' }; }
    clearInterval(tick);
    if (result.ok) {
      remember(String(result.policy.serial));
      setPhase({ at: 'held', issued: result });
      onIssued?.(result.policy);
    } else {
      setPhase({ at: 'declined', refusal: result });
    }
    void refresh();
  }, [phase, pin, budget, days, onIssued]);

  // the frozen catalogue: always available, and the only source while scrubbing or offline
  const localOpts = useMemo<PriceOpts>(() => ({ now: map.now, minMag: map.minMag, days, payoutHbar: MODEL.payoutHbar }), [map.now, map.minMag, days]);
  const local = useMemo(() => price(pin.lat, pin.lon, localOpts), [pin.lat, pin.lon, localOpts]);
  const yearAgo = useMemo(() => price(pin.lat, pin.lon, { ...localOpts, now: new Date(map.now.getTime() - 365.25 * 86400000) }), [pin.lat, pin.lon, localOpts, map.now]);
  const fullNearby = useMemo(() => around(pin.lat, pin.lon, map.minMag), [pin.lat, pin.lon, map.minMag]);

  const net = a.network;
  const q = phase.at === 'quoted' ? phase.quote : phase.at === 'issuing' ? phase.quote : phase.at === 'held' ? phase.issued.quote : null;
  const historical = !map.live;
  const canBuy = phase.at === 'quoted' && a.online && a.writesAllowed && !historical;

  return (
    <aside className="panel">
      {/* who */}
      <div className="flex items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <div className="label">{historical ? `record as of ${map.year}` : 'quote'}</div>
          <div className="truncate text-[24px] leading-tight text-fg-0" style={{ letterSpacing: '-0.01em' }}>{placeName(pin)}</div>
          <div className="label num mt-[2px]">{pin.lat.toFixed(2)}, {pin.lon.toFixed(2)}</div>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} title="close">×</button>
      </div>

      {/* the answer */}
      {historical ? (
        <section className="flex flex-col gap-[12px]">
          <Pill state="pending">model · {map.year}</Pill>
          <div className="grid grid-cols-2 gap-x-[16px] gap-y-[12px]">
            <Big label={`M${map.minMag}+ within 300 km`} value={String(local.count)} size={30} />
            <Big label={`chance in ${days} days`} value={(local.probability * 100).toFixed(2)} unit="%" size={30} />
            <div className="col-span-2"><Big label={`${MODEL.payoutHbar} ℏ of cover would have cost`} value={local.premiumHbar.toFixed(4)} unit="ℏ" size={30} tone={local.count ? 'ok' : 'dim'} after={<Delta now={local.premiumHbar} before={yearAgo.premiumHbar} />} /></div>
          </div>
          <div className="label">Scrub the year back to today for a live quote.</div>
        </section>
      ) : !a.checked ? (
        <div className="label">reaching the agent…</div>
      ) : !a.online ? (
        <section className="flex flex-col gap-[12px]">
          <Pill state="pending">agent offline · frozen catalogue</Pill>
          <div className="grid grid-cols-2 gap-x-[16px] gap-y-[12px]">
            <Big label={`M${map.minMag}+ within 300 km`} value={String(local.count)} size={30} />
            <Big label={`chance in ${days} days`} value={(local.probability * 100).toFixed(2)} unit="%" size={30} />
            <div className="col-span-2"><Big label={`${MODEL.payoutHbar} ℏ of cover, by the model`} value={local.premiumHbar.toFixed(4)} unit="ℏ" size={30} tone={local.count ? 'ok' : 'dim'} after={<Delta now={local.premiumHbar} before={yearAgo.premiumHbar} />} /></div>
          </div>
          <div className="label">No live price and no issuing until the agent is back. Start it with <span className="num">npm run serve</span>.</div>
        </section>
      ) : phase.at === 'held' ? (
        <Held issued={phase.issued} net={net} />
      ) : phase.at === 'issuing' ? (
        <section className="flex flex-col gap-[14px]">
          <Pill state="ok">writing to {net}</Pill>
          <div className="flex flex-col gap-[10px]">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-[12px] text-[16px]">
                <span className={`num ${i <= phase.step ? 'text-ok' : 'text-fg-3'}`}>{i < phase.step ? '✓' : i === phase.step ? '•' : '·'}</span>
                <span className={i <= phase.step ? 'text-fg-0' : 'text-fg-3'}>{s}</span>
              </div>
            ))}
          </div>
          <div className="label">Four transactions, in order. Nothing is skipped and nothing is faked; this takes a few seconds.</div>
        </section>
      ) : phase.at === 'declined' ? (
        <section className="flex flex-col gap-[12px]">
          <Pill state="refused">{REASON[phase.refusal.reason] ?? phase.refusal.reason.replace(/_/g, ' ')}</Pill>
          <p className="text-[17px] leading-[1.45] text-fg-0" style={{ textWrap: 'pretty' }}>{phase.refusal.message}</p>
          {typeof phase.refusal.retryAfter === 'number' ? <div className="label num">try again in {Math.ceil(phase.refusal.retryAfter / 60)} min</div> : null}
          <div className="label">The agent declined. That is an answer, not an error: it only writes promises the pool can keep.</div>
        </section>
      ) : (
        <section className="flex flex-col gap-[14px]">
          <div className="flex items-center gap-[10px]">
            <Pill state={q ? 'ok' : 'neutral'}>{q ? 'the agent will underwrite this' : 'asking the agent…'}</Pill>
          </div>
          <div className="grid grid-cols-2 gap-x-[16px] gap-y-[12px]">
            <Big label="premium" value={q ? usd(q.premium) : '—'} tone={q ? 'ok' : 'dim'} size={34} />
            <Big label={`buys cover of · ${days} days`} value={q ? usd(q.payout, 0) : '—'} size={34} />
          </div>
          {q ? <div className="label num">settles as {q.settled.payout.toFixed(2)} {q.settled.symbol} on Hedera {net}</div> : null}
          <button
            type="button"
            disabled={!canBuy}
            onClick={buy}
            className="buy"
            title={!a.writesAllowed ? 'this agent does not write on mainnet' : undefined}
          >
            <span>{a.writesAllowed ? 'Protect this place' : 'Read only on mainnet'}</span>
            {q ? <span className="num">{usd(q.premium)}</span> : null}
          </button>
          {!a.writesAllowed ? <div className="label">Quotes are live. Issuing is switched off on mainnet; the agent issues on testnet.</div> : null}
        </section>
      )}

      {/* the knobs */}
      {!historical && phase.at !== 'held' && phase.at !== 'issuing' ? (
        <section className="grid grid-cols-2 gap-x-[16px]">
          <Slider label="budget" value={budget} min={1} max={50} unit="USD" onChange={setBudget} format={(v) => `$${v}`} />
          <Slider label="window" value={days} min={7} max={MAX_DAYS} unit="days" onChange={setDays} />
        </section>
      ) : null}

      {/* why */}
      <section className="flex flex-col gap-[6px]">
        <div className="kicker">the record here</div>
        <div>
          {q ? (
            <>
              <KV k={`M6+ within ${q.hazard.referenceRadiusKm} km since ${q.hazard.since.slice(0, 4)}`} v={q.hazard.count} />
              <KV k="annual rate λ · trigger circle" v={`${q.hazard.lambda.toFixed(4)} / yr`} />
              <KV k={`priced at λ + ${q.hazard.z}σ · uncertainty ${Math.round(q.hazard.relativeError * 100)} %`} v={`${q.hazard.lambdaPriced.toFixed(4)} / yr`} />
              <KV k={`chance in ${q.days} days`} v={`${(q.probability * 100).toFixed(3)} %`} />
              <KV k="target loss ratio" v={q.lossRatio.toFixed(2)} dim />
              <KV k="viability floor" v={usd(q.floor)} dim />
            </>
          ) : (
            <>
              <KV k={`M${map.minMag}+ within 300 km since 1970`} v={local.count} />
              <KV k="annual rate λ · trigger circle" v={`${local.lambda.toFixed(4)} / yr`} />
              <KV k={`chance in ${days} days`} v={`${(local.probability * 100).toFixed(3)} %`} />
              <KV k="source" v="frozen catalogue" dim />
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-[8px]">
        <div className="flex items-baseline justify-between">
          <div className="kicker">cost by year · model</div>
          <div className="label num">{MODEL.payoutHbar} ℏ cover · {days} d</div>
        </div>
        <History nearby={fullNearby} opts={localOpts} markYear={map.year} />
      </section>

      <section className="flex flex-wrap items-baseline gap-x-[18px] gap-y-[6px] text-[14px]">
        <span className="label">verify</span>
        <a className="hs label" href={q?.hazard.source ?? sourceUrl(pin.lat, pin.lon, map.minMag)} target="_blank" rel="noreferrer">recount at USGS<span className="arrow">↗</span></a>
        {a.pool ? <span className="flex items-baseline gap-[6px]"><span className="label">pool</span><Id kind="account" id={a.pool.poolAccountId} size="sm" network={net} /></span> : null}
      </section>
    </aside>
  );
}

/** The state after a purchase: not a receipt — the same ring as beat 05, holding their payout. */
function Held({ issued, net }: { issued: agent.Issued; net: agent.Network }) {
  const p = issued.policy;
  return (
    <section className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <Pill state="pending">awaiting quorum</Pill>
        <span className="label num">policy #{p.serial}</span>
      </div>
      <svg viewBox="0 0 380 300" width="100%">
        <Lock cx={190} cy={140} r={92} agent oracles={[false, false, false]} threshold={2} names={['SGC', 'USGS ComCat', 'EMSC']} state="pending" centre={
          <g>
            <text x={190} y={136} textAnchor="middle" className="num" fill={C.fg0} fontSize={26}>{agent.payoutLabel(p)}</text>
            <text x={190} y={160} textAnchor="middle" className="label" fill={C.fg2} fontSize={12}>held for you</text>
          </g>
        } />
      </svg>
      <p className="text-[16px] leading-[1.45] text-fg-1">Your payout is on the ledger, signed by the agent, waiting for two of three oracle keys. Nothing is running. Watchers: none.</p>
      <div className="flex flex-wrap gap-x-[18px] gap-y-[6px] text-[14px]">
        <span className="flex items-baseline gap-[6px]"><span className="label">payout</span><Id kind="schedule" id={p.scheduleId} size="sm" network={net} /></span>
        <span className="flex items-baseline gap-[6px]"><span className="label">premium</span><Id kind="transaction" id={p.saleTxId} size="sm" network={net} /></span>
      </div>
      <a href={policyPath(p.serial)} onClick={(e) => { e.preventDefault(); navigate(policyPath(p.serial)); }} className="buy" style={{ textDecoration: 'none' }}>
        <span>Open policy #{p.serial}</span><span className="num">→</span>
      </a>
    </section>
  );
}
