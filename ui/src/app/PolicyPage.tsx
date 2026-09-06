import { AgentGuardrails } from './AgentGuardrails';
import { PayoutConversion } from './PayoutConversion';
import { useEffect, useState } from 'react';
import * as agent from '../lib/agent';
import { SignatureGate } from '../components/SignatureGate';
import { Id } from '../components/ui';
import { placeName } from '../lib/hazard';
import { hsPointer } from '../lib/hashscan';
import { onLink } from '../lib/router';
import { mine, policyState, refresh, statusLabel, useAgent } from '../lib/store';
import { PolicyPosition, LPPreviewControls, type PositionKind } from './PolicyPosition';
import { OracleProof } from './OracleProof';

export function PolicyPage({serial}:{serial:string}){
  const a=useAgent();
  const [position,setPosition]=useState<PositionKind>(()=>new URLSearchParams(location.search).get('position')==='lp'?'liquidity':'cover'),[portion,setPortion]=useState(10);
  useEffect(()=>{const sync=()=>setPosition(new URLSearchParams(location.search).get('position')==='lp'?'liquidity':'cover');window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  const [retry,setRetry]=useState(0);
  const [lookup,setLookup]=useState<{p?:agent.Policy;error?:string;missing?:boolean}>({});
  const found=a.policies?.find(p=>String(p.serial)===serial);
  useEffect(()=>{if(!a.checked||!a.online||found)return;let live=true;agent.policy(serial).then(p=>{if(live)setLookup('ok'in p&&p.ok===false?{missing:p.reason==='not_found',error:p.message}:{p:p as agent.Policy});}).catch(()=>{if(live)setLookup({error:'The policy service is temporarily unavailable.'});});return()=>{live=false;};},[a.checked,a.online,serial,found,retry]);
  const p=found??lookup.p;
  if(!p)return <div className="page"><div className="page-inner empty-state"><h1>{lookup.missing?'Policy not found':a.checked&&(!a.online||lookup.error)?'Policy temporarily unavailable':'Loading policy…'}</h1><p>{lookup.error??(!a.online&&a.checked?'Please retry when the service reconnects.':'Checking the latest record.')}</p><a className="hs" href="/policies" onClick={onLink}>← All policies</a><button className="chip" onClick={()=>{setLookup({});setRetry(v=>v+1);void refresh();}}>Retry</button></div></div>;
  const sourceFilter=new URLSearchParams(location.search).get('filter');
  const backQuery=new URLSearchParams({...position==='liquidity'?{view:'fund'}:{},...sourceFilter&&['global','recent','here','all','active'].includes(sourceFilter)?{filter:sourceFilter}:{}});
  const galleryPath='/policies'+(backQuery.size?'?'+backQuery:'');
  const state=policyState(p), paid=state==='paid', expired=state==='expired', ledger=p.ledger;
  const oracles=ledger?.oracles??[];
  const signed=oracles.filter(o=>o.signed).length;
  const policyTerms=<>        <div className="demo-note"><span className="status-dot bg-pending"/><span>Funded demo<strong>{p.asset==='aUSDd'?'aUSDd is unbacked and has no cash value.':'Testnet assets have no cash value; recorded mainnet transfers are labeled separately.'}</strong></span></div>
        <div className="trigger-chips"><span>M{p.trigger?.minMagnitude??6}+</span><span>Within {p.trigger?.radiusKm??100} km</span><span>Depth ≤{p.trigger?.maxDepthKm??70} km</span></div>
        <dl className="facts"><div><dt>{paid?'Paid on':'Cover ends'}</dt><dd>{new Date(p.executedAt??p.lapsesAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</dd></div><div><dt>Modeled premium</dt><dd>${p.premiumUsd.toFixed(2)} once</dd></div></dl>
        <p className="trigger-note">{paid?'The scheduled transfer executed after the required signatures arrived.':expired?'The coverage window has ended. This alone does not prove that no qualifying event occurred.':'The network executes when the agent and two oracle keys have signed. Damage alone does not trigger a payout.'}</p></>;
  return <div className="page"><div className="page-inner policy-detail">
    <a className="back-link" href={galleryPath} onClick={onLink}>← {position==='liquidity'?'Funding previews':'Policies'}</a>
    <div className="policy-detail-grid">
      <div className="policy-main"><div className="eyebrow">Policy #{serial} · {a.network}{mine(a.network).includes(serial)?' · created here':''}</div><h1>{placeName(p)}</h1>
        <div className={`state-label state-${state}`} role="status"><span className="status-dot"/>{statusLabel(p)}</div>
        <div className="policy-payout"><span>{paid?'Payout executed':expired?'Cover ended':'Scheduled payout'}</span><strong className="num">{p.payoutHbar.toLocaleString(undefined,{maximumFractionDigits:2})}</strong><small>{p.asset??'HBAR'} · demo beneficiary</small></div>
        {position==='liquidity'?<LPPreviewControls policy={p} portion={portion} onPortion={setPortion}/>:null}
        {position==='liquidity'?<details className="lp-policy-terms"><summary>Policy terms <span>+</span></summary>{policyTerms}</details>:policyTerms}
        {position==='cover'?<PayoutConversion usd={p.payoutUsd}/>:null}
      </div>
      <div className="policy-visual"><PolicyPosition policy={p} kind={position} onKind={kind=>{setPosition(kind);const query=new URLSearchParams(location.search);if(kind==='liquidity')query.set('position','lp');else query.delete('position');history.replaceState(null,'',`/policy/${serial}${query.size?'?'+query:''}`);}} portion={portion} onPortion={setPortion}/>
        <details className="nft-settlement-details"><summary>Settlement confirmations <span>{ledger?.available?`${signed} signed · 2 required`:'—'}</span></summary>
        <SignatureGate agent={ledger?.available ? ledger.agentSigned ?? null : null}
          oracles={oracles.map(o=>({name:o.name,signed:ledger?.available?o.signed:null}))}
          outcome={!ledger?.available?'Unable to verify':paid?'Transferred':expired?'Cover ended':'Awaiting payout'}
          reason={!ledger?.available?'Refresh to check the ledger.':paid?'Scheduled transfer executed.':expired?'Coverage window ended.':'The network waits for the required signatures.'}/>
        <div className="ledger-freshness" role="status">{a.policiesError??(ledger?.available?`Ledger checked ${new Date(ledger.checkedAt).toLocaleTimeString()}`:'Ledger status unavailable')} <button className="text-button" onClick={()=>void refresh()}>Refresh ↻</button></div>
        {!paid&&!expired?<div className="monitor-note"><strong>{p.monitoring?.mode==='automatic'?'Oracle checks enabled':'Event checks: manual demo'}</strong><span>{p.monitoring?.message??'The payout waits on the ledger. Oracle services must be asked to verify an event.'}</span></div>:null}
        </details>
      </div>
    </div>
    <details className="proof-details"><summary>View on Hedera <span>↗</span></summary><dl className="facts"><div><dt>Demo beneficiary</dt><dd><Id kind="account" id={p.buyerId} network={a.network}/></dd></div><div><dt>Scheduled payout</dt><dd><Id kind="schedule" id={p.scheduleId} network={a.network}/></dd></div><div><dt>Premium transfer</dt><dd><Id kind="transaction" id={p.saleTxId} network={a.network}/></dd></div><div><dt>Recorded terms</dt><dd><Id kind="topic" id={p.termsPointer} href={hsPointer(p.termsPointer,a.network)} network={a.network}/></dd></div></dl></details>
    <a href="/story#2" onClick={onLink} className="settlement-story-link">See confirmations become a payout <span>Recorded mainnet demo →</span></a>
    <details className="proof-details"><summary>Agent guardrails & proof <span>+</span></summary><AgentGuardrails/><p>The oracle quorum cannot spend without the agent's signature. This recorded mainnet experiment proves that specific key restriction.</p><OracleProof/></details>
  </div></div>;
}
