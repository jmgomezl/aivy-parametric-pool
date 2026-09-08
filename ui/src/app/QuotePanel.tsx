import {useDemo,startDemo,refreshDemo} from '../lib/demo';
import { PayoutConversion } from './PayoutConversion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as agent from '../lib/agent';
import { coverForBudget, placeName, sourceUrl } from '../lib/hazard';
import { onLink, policyPath } from '../lib/router';
import { refresh, remember, useAgent, trackRequest } from '../lib/store';
import { Slider, YearlyChange } from './History';
import type { MapState, Pin } from './AtlasMap';

type Phase = { at: 'loading' } | { at: 'quoted'; q: agent.Quote } | { at: 'declined'; r: agent.Refusal } | { at: 'issuing'; q: agent.Quote } | { at: 'held'; result: agent.Issued };
const dollars = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const reasons: Record<string,string> = { no_record:'Not enough historical data', exceeds_capital:'Not enough pool capacity', rate_limited:'Demo limit reached', daily_policy_cap:'Demo limit reached', daily_cover_cap:'Demo limit reached', below_viability:'Budget below the minimum', mainnet_writes_disabled:'Mainnet is read only' };

export function QuotePanel({ pin, map, budget, days, onBudget, onDays, onClose, onReturnToCover, exploration }: { pin: Pin; map: MapState; budget: number; days: number; onBudget:(v:number)=>void; onDays:(v:number)=>void; onClose:()=>void; onReturnToCover:()=>void; exploration?:ReactNode }) {
  const a=useAgent(), [phase,setPhase]=useState<Phase>({at:'loading'}), [retry,setRetry]=useState(0);
  const {account, busy:starting, error:accountError}=useDemo();
  const [referral,setReferral]=useState(()=>new URLSearchParams(location.search).get('ref')??'');
  const panel=useRef<HTMLElement>(null), requestId=useRef(crypto.randomUUID());
  useEffect(()=>{if(window.matchMedia('(max-width: 760px)').matches)panel.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});panel.current?.focus({preventScroll:true});},[]);
  useEffect(()=>{
    if(!a.checked||!a.online||map.exploring)return;
    let current=true;
    setPhase({at:'loading'});
    const timer=setTimeout(()=>agent.quote(pin.lat,pin.lon,budget,days).then(q=>{if(current)setPhase(q.ok?{at:'quoted',q}:{at:'declined',r:q});}).catch(()=>{if(current)setPhase({at:'declined',r:{ok:false,reason:'unreachable',message:'The quote service is temporarily unavailable. Try again.'}});}),250);
    return()=>{current=false;clearTimeout(timer);};
  },[a.checked,a.online,pin.lat,pin.lon,budget,days,retry,map.exploring]);
  const estimate=useMemo(()=>coverForBudget(pin.lat,pin.lon,budget,{now:map.now,minMag:map.minMag,days}),[pin.lat,pin.lon,budget,map.now,map.minMag,days]);
  const previousEstimate=useMemo(()=>coverForBudget(pin.lat,pin.lon,budget,{now:new Date(Date.UTC(map.year-1,11,31)),minMag:map.minMag,days}),[pin.lat,pin.lon,budget,map.year,map.minMag,days]);
  const coverChange=estimate.priced.count&&previousEstimate.priced.count&&Number.isFinite(previousEstimate.coverHbar)?(estimate.coverHbar/previousEstimate.coverHbar-1)*100:null;
  const busy=phase.at==='issuing';
  const needsReview=phase.at==='declined'&&['pending_recovery','uncertain','service_unavailable','issuance_busy'].includes(phase.r.reason);
  useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!e.defaultPrevented&&!busy)onClose();};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[busy,onClose]);
  const buy=async()=>{
    if(phase.at!=='quoted'||map.exploring||!a.writesAllowed)return;
    if(!account){await startDemo();return;}
    const q=phase.q;trackRequest(requestId.current,a.network);setPhase({at:'issuing',q});
    try {const result=await agent.buy({lat:pin.lat,lon:pin.lon,place:pin.name??null,budgetUsd:budget,days,requestId:requestId.current,...referral?{referralCode:referral.trim()}:{} });
      if(result.ok){trackRequest(requestId.current,a.network,true);remember(String(result.policy.serial),a.network);setPhase({at:'held',result});}
      else {if(!['pending_recovery','service_unavailable','issuance_busy'].includes(result.reason))trackRequest(requestId.current,a.network,true);setPhase({at:'declined',r:result});}
    }catch{setPhase({at:'declined',r:{ok:false,reason:'uncertain',message:'Confirmation was interrupted. Check Policies before retrying; your request may have completed.'}});}
    void refresh();void refreshDemo();
  };
  const q=phase.at==='quoted'||phase.at==='issuing'?phase.q:null;
  const poolFresh=a.pool&&a.poolAt&&a.online&&Date.now()-Date.parse(a.poolAt)<30000;
  const remaining=a.pool?Math.max(0,a.pool.budgetToday.limits.usd-a.pool.budgetToday.usd):null;
  const capacityBlocked=Boolean(q&&poolFresh&&(q.settled.payout>a.pool!.headroom||q.payout>remaining!));
  const balanceBlocked=Boolean(account&&q&&q.settled.premium>account.balance);
  const estimating=map.exploring||a.checked&&!a.online;
  const amount=estimating?(estimate.priced.count?estimate.coverHbar:null):q?.payout;
  const held=phase.at==='held'?phase.result.policy:null;
  return <aside className="panel quote-panel" ref={panel} tabIndex={-1} aria-label="Coverage quote">
    <div className="panel-top"><span className="eyebrow">{held?'Policy created':map.exploring?'Historical estimate':'Your cover'}</span><button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close quote">×</button></div>
    <div><h2>{placeName(pin)}</h2><div className="coordinates num">{pin.lat.toFixed(2)}, {pin.lon.toFixed(2)}</div></div>
    {held ? <><div className="created-policy" role="status"><span className="created-check">✓</span><h3>Payout committed.</h3><p>Your demo policy is on Hedera.</p><div className="payout-amount num">{held.payoutHbar.toLocaleString(undefined,{maximumFractionDigits:2})}<small>{held.asset??'HBAR'} · demo beneficiary</small></div><a href={policyPath(held.serial)} onClick={onLink} className="buy">View policy <span>→</span></a><button className="text-button" onClick={onClose}>Choose another place</button></div>{exploration}</> : <>
      {!map.exploring?<div className="demo-note"><span className="status-dot bg-pending"/><span>Testnet cover<strong>aUSDd · no cash value · fees sponsored</strong></span></div>:null}
      {phase.at==='declined'&&!estimating ? <section className="quote-refusal" role="status"><span className="eyebrow">{reasons[phase.r.reason]??'Unable to confirm'}</span><h3>{phase.r.reason==='no_record'?'Try another location.':['exceeds_capital','daily_cover_cap'].includes(phase.r.reason)?'Try a smaller payout.':needsReview?'Check your request in Policies.':'Please try again.'}</h3><p>{phase.r.message}</p>{phase.r.retryAfter?<small>Try again in {Math.ceil(phase.r.retryAfter/60)} minutes.</small>:null}<div className="flex flex-wrap gap-3">{!needsReview?<button className="chip" onClick={()=>setRetry(v=>v+1)}>Refresh quote</button>:null}<a className="chip" href="/policies" onClick={onLink}>View policies</a></div></section> : <section aria-live="polite">
        <div className="quote-numbers"><div><span>Premium · price of cover</span><strong className="num">{dollars(budget)}</strong><small>once</small></div><span className="quote-arrow" aria-hidden="true">→</span><div><span>Payout if conditions are met</span><strong className="num text-ok">{amount==null?'—':dollars(amount)}</strong><small>{days} days</small>{q&&!estimating?<small>{q.settled.payout.toLocaleString(undefined,{maximumFractionDigits:2})} {q.settled.symbol} on {a.network}</small>:null}{map.exploring?<YearlyChange change={coverChange} year={map.year}/>:null}</div></div>
        {estimating?<div className="estimate-label">{map.exploring?`Exploration · ${map.year} · M${map.minMag}+`:'Offline estimate'}{amount===null?' · insufficient historical data':''}</div>:!q?<p className="loading-line">Getting your quote…</p>:null}
        {!map.exploring?<div className="trigger-chips" aria-label="Payout conditions"><span>M6+</span><span>Within 100 km</span><span>Depth ≤70 km</span></div>:null}
        {!map.exploring?<p className="trigger-note">Two oracle signatures release a qualifying payout.</p>:null}
        {q&&!estimating?<div className="quote-capacity"><div><span>Your balance</span><strong>{account?`${account.balance.toFixed(2)} aUSDd`:'Start with 1,000 aUSDd'}</strong></div><small className={capacityBlocked||balanceBlocked?'text-pending':''}>{capacityBlocked?'Capacity limit · lower the budget.':balanceBlocked?'Insufficient balance for this premium.':poolFresh?'✓ Capacity available · verified before payment':'Capacity checked before payment'}</small></div>:null}
      </section>}
      {exploration}
      {!busy&&!needsReview?<section className="quote-inputs"><Slider label="Budget" value={budget} min={1} max={50} unit="" format={dollars} onChange={v=>{requestId.current=crypto.randomUUID();onBudget(v);}}/><details><summary>Duration <span className="num">{days} days</span></summary><Slider label="Days of cover" value={days} min={7} max={62} unit="days" onChange={v=>{requestId.current=crypto.randomUUID();onDays(v);}}/></details></section>:null}
      {!(phase.at==='declined'&&!estimating)?<div className="quote-action">
        {busy?<div className="issuing" role="status"><span className="working-dot"/><div><strong>Creating your policy…</strong><p>Waiting for ledger confirmation. Progress is saved in Policies.</p></div></div>:<button className="buy" onClick={map.exploring?onReturnToCover:buy} disabled={!map.exploring&&(!q||!a.writesAllowed||estimating||capacityBlocked||balanceBlocked||starting)}><span>{map.exploring?'Back to current cover':!a.online?'Estimates only':!a.writesAllowed?'Read only':starting?'Creating demo account…':!account?'Get testnet tokens →':'Pay premium & create cover'}</span><span aria-hidden="true">→</span></button>}

      </div>:null}
      {!busy&&!needsReview&&!estimating?<details className="quote-why"><summary>Referral / broker code {referral?'· applied':''}</summary><label>Referral code <input value={referral} placeholder="Optional broker code" maxLength={12} onChange={e=>{setReferral(e.target.value.toLowerCase());requestId.current=crypto.randomUUID();}}/></label><p>{referral?`Premium ${dollars(budget)} → pool ${dollars(budget*.85)} + broker ${dollars(budget*.15)}. Your price is unchanged.`:'No referral: the entire premium goes to the shared pool. Get your own referral link under Your demo account.'}</p></details>:null}
      {accountError?<p role="status">{accountError}</p>:null}
      {q&&!estimating&&!busy?<PayoutConversion usd={q.payout}/>:null}
      <details className="quote-why"><summary>Coverage & pricing details</summary><p>A qualifying earthquake must be M6+, within 100 km and no deeper than 70 km during the coverage window. Damage alone does not trigger a payout.</p><dl className="facts"><div><dt>Events within 300 km</dt><dd>{q&&!estimating?q.hazard.count:estimate.priced.count}</dd></div><div><dt>Modeled chance in {days} days</dt><dd>{((q&&!estimating?q.probability:estimate.priced.probability)*100).toFixed(2)}%</dd></div><div><dt>Historical record</dt><dd>Since 1970</dd></div></dl><p>A first-order historical model, not an actuarial assessment. No recorded events means insufficient evidence, not zero risk.</p><a className="hs" href={q&&!estimating?q.hazard.source:sourceUrl(pin.lat,pin.lon,map.minMag)} target="_blank" rel="noreferrer">View source data ↗</a></details>
    </>}
  </aside>;
}
