import { PayoutConversion } from './PayoutConversion';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as agent from '../lib/agent';
import { coverForBudget, placeName, sourceUrl } from '../lib/hazard';
import { onLink, policyPath } from '../lib/router';
import { refresh, remember, useAgent, trackRequest } from '../lib/store';
import { Slider, YearlyChange } from './History';
import type { MapState, Pin } from './AtlasMap';

type Phase = { at: 'loading' } | { at: 'quoted'; q: agent.Quote } | { at: 'declined'; r: agent.Refusal } | { at: 'issuing'; q: agent.Quote } | { at: 'held'; result: agent.Issued };
const dollars = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const reasons: Record<string,string> = { no_record:'Not enough historical data', exceeds_capital:'Not enough pool capacity', rate_limited:'Demo limit reached', daily_policy_cap:'Demo limit reached', daily_cover_cap:'Demo limit reached', below_viability:'Budget below the minimum', mainnet_writes_disabled:'Mainnet is read only' };

export function QuotePanel({ pin, map, budget, days, onBudget, onDays, onClose, onReturnToCover }: { pin: Pin; map: MapState; budget: number; days: number; onBudget:(v:number)=>void; onDays:(v:number)=>void; onClose:()=>void; onReturnToCover:()=>void }) {
  const a=useAgent(), [phase,setPhase]=useState<Phase>({at:'loading'}), [retry,setRetry]=useState(0);
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
  useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)onClose();};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[busy,onClose]);
  const buy=async()=>{
    if(phase.at!=='quoted'||map.exploring||!a.writesAllowed)return;
    const q=phase.q;trackRequest(requestId.current,a.network);setPhase({at:'issuing',q});
    try {const result=await agent.buy({lat:pin.lat,lon:pin.lon,place:pin.name??null,budgetUsd:budget,days,requestId:requestId.current});
      if(result.ok){trackRequest(requestId.current,a.network,true);remember(String(result.policy.serial),a.network);setPhase({at:'held',result});}
      else {if(!['pending_recovery','service_unavailable','issuance_busy'].includes(result.reason))trackRequest(requestId.current,a.network,true);setPhase({at:'declined',r:result});}
    }catch{setPhase({at:'declined',r:{ok:false,reason:'uncertain',message:'Confirmation was interrupted. Check Policies before retrying; your request may have completed.'}});}
    void refresh();
  };
  const q=phase.at==='quoted'||phase.at==='issuing'?phase.q:null;
  const estimating=map.exploring||a.checked&&!a.online;
  const amount=estimating?(estimate.priced.count?estimate.coverHbar:null):q?.payout;
  const held=phase.at==='held'?phase.result.policy:null;
  return <aside className="panel quote-panel" ref={panel} tabIndex={-1} aria-label="Coverage quote">
    <div className="panel-top"><span className="eyebrow">{held?'Policy created':'Your cover'}</span><button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close quote">×</button></div>
    <div><h2>{placeName(pin)}</h2><div className="coordinates num">{pin.lat.toFixed(2)}, {pin.lon.toFixed(2)}</div></div>
    {held ? <div className="created-policy" role="status"><span className="created-check">✓</span><h3>Payout committed.</h3><p>Your demo policy is on Hedera.</p><div className="payout-amount num">{held.payoutHbar.toLocaleString(undefined,{maximumFractionDigits:2})}<small>{held.asset??'HBAR'} · demo beneficiary</small></div><a href={policyPath(held.serial)} onClick={onLink} className="buy">View policy <span>→</span></a><button className="text-button" onClick={onClose}>Choose another place</button></div> : <>
      <div className="demo-note"><span className="status-dot bg-pending"/><span>Funded testnet demo<strong>No payment required. Demo tokens have no cash value.</strong></span></div>
      {phase.at==='declined'&&!estimating ? <section className="quote-refusal" role="status"><span className="eyebrow">{reasons[phase.r.reason]??'Unable to confirm'}</span><h3>{phase.r.reason==='no_record'?'Try another location.':['exceeds_capital','daily_cover_cap'].includes(phase.r.reason)?'Try a smaller payout.':['pending_recovery','uncertain'].includes(phase.r.reason)?'Check your request in Policies.':'Please try again.'}</h3><p>{phase.r.message}</p>{phase.r.retryAfter?<small>Try again in {Math.ceil(phase.r.retryAfter/60)} minutes.</small>:null}<div className="flex flex-wrap gap-3"><button className="chip" onClick={()=>setRetry(v=>v+1)}>Refresh quote</button><a className="chip" href="/policies" onClick={onLink}>View policies</a></div></section> : <section aria-live="polite">
        <div className="quote-numbers"><div><span>Modeled premium</span><strong className="num">{dollars(budget)}</strong><small>once</small></div><span className="quote-arrow" aria-hidden="true">→</span><div><span>Modeled payout</span><strong className="num text-ok">{amount==null?'—':dollars(Math.round(amount))}</strong><small>{days} days</small>{map.exploring?<YearlyChange change={coverChange} year={map.year}/>:null}</div></div>
        {estimating?<div className="estimate-label">{map.exploring?`Exploration · ${map.year} · M${map.minMag}+`:'Offline estimate'}{amount===null?' · insufficient historical data':''}</div>:!q?<p className="loading-line">Getting your quote…</p>:null}
        <div className="trigger-chips" aria-label="Payout conditions"><span>M{map.exploring?map.minMag:6}+</span><span>Within 100 km</span></div>
        <p className="trigger-note">Released after two confirmations.</p>
        {q&&!estimating?<div className="settlement-line"><span>Demo payout</span><strong className="num">{q.settled.payout.toLocaleString(undefined,{maximumFractionDigits:2})} {q.settled.symbol}</strong></div>:null}
        {busy?<div className="issuing" role="status"><span className="working-dot"/><div><strong>Creating your policy…</strong><p>Waiting for ledger confirmation. Progress is saved in Policies.</p></div></div>:<button className="buy" onClick={map.exploring?onReturnToCover:buy} disabled={!map.exploring&&(!q||!a.writesAllowed||estimating)}><span>{map.exploring?'Back to current cover':!a.online?'Estimates only':!a.writesAllowed?'Read only':'Create demo cover'}</span><span aria-hidden="true">→</span></button>}

      </section>}
      {!busy?<section className="quote-inputs"><Slider label="Budget" value={budget} min={1} max={50} unit="" format={dollars} onChange={v=>{requestId.current=crypto.randomUUID();onBudget(v);}}/><details><summary>Duration <span className="num">{days} days</span></summary><Slider label="Days of cover" value={days} min={7} max={62} unit="days" onChange={v=>{requestId.current=crypto.randomUUID();onDays(v);}}/></details></section>:null}
      {q&&!estimating&&!busy?<PayoutConversion usd={q.payout}/>:null}
      <details className="quote-why"><summary>Coverage & pricing details</summary><p>A qualifying earthquake must be M6+, within 100 km and no deeper than 70 km during the coverage window. Damage alone does not trigger a payout.</p><dl className="facts"><div><dt>Events within 300 km</dt><dd>{q&&!estimating?q.hazard.count:estimate.priced.count}</dd></div><div><dt>Modeled chance in {days} days</dt><dd>{((q&&!estimating?q.probability:estimate.priced.probability)*100).toFixed(2)}%</dd></div><div><dt>Historical record</dt><dd>Since 1970</dd></div></dl><p>A first-order historical model, not an actuarial assessment. No recorded events means insufficient evidence, not zero risk.</p><a className="hs" href={q&&!estimating?q.hazard.source:sourceUrl(pin.lat,pin.lon,map.minMag)} target="_blank" rel="noreferrer">View source data ↗</a></details>
    </>}
  </aside>;
}
