import { useEffect, useState } from 'react';
import * as agent from '../lib/agent';
import globalDemos from '../data/global-demos.json';
import { lpModel } from '../lib/lp-model.mjs';
import { PositionNFT } from '../components/PositionNFT';
import { onLink, policyPath } from '../lib/router';
import { mine, policyState, refresh, useAgent, pendingRequests, trackRequest, remember } from '../lib/store';

const readFilter=()=>{const value=new URLSearchParams(location.search).get('filter');return ['global','recent','here','all','active'].includes(value??'')?value!:'global';};
export function PoliciesPage(){
  const a=useAgent(), [filter,setFilter]=useState(readFilter);
  const [funding,setFunding]=useState(()=>new URLSearchParams(location.search).get('view')==='fund');
  const updateQuery=(isFunding:boolean,nextFilter:string)=>{const query=new URLSearchParams();if(isFunding)query.set('view','fund');if(nextFilter!=='global')query.set('filter',nextFilter);history.replaceState(null,'',`/policies${query.size?'?'+query:''}`);};
  const setView=(value:boolean)=>{setFunding(value);updateQuery(value,filter);};
  useEffect(()=>{const sync=()=>{setFunding(new URLSearchParams(location.search).get('view')==='fund');setFilter(readFilter());};window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  const [requests,setRequests]=useState<Record<string,agent.RequestStatus>>({});
  useEffect(()=>{let live=true;const check=async()=>{const result=await Promise.all(pendingRequests(a.network).map(async id=>{try{return [id,await agent.requestStatus(id)] as const;}catch{return [id,{ok:false,reason:'unavailable',message:'Request status is temporarily unavailable.'} as agent.Refusal] as const;}}));if(!live)return;for(const [id,r] of result){if(r.ok&&r.status==='complete'&&r.policy){remember(String(r.policy.serial),a.network);trackRequest(id,a.network,true);void refresh();}}setRequests(Object.fromEntries(result.filter(([,r])=>!r.ok||r.status!=='complete')));};void check();const timer=window.setInterval(()=>void check(),10000);return()=>{live=false;clearInterval(timer);};},[a.network]);
  const created=new Set(mine(a.network));
  const featured=new Set(globalDemos.network===a.network?globalDemos.policies.map(p=>p.serial):[]);
  const rows=[...(a.policies??[])].filter(p=>filter==='global'&&featured.has(p.serial)||filter==='all'||filter==='recent'||filter==='here'&&created.has(String(p.serial))||filter==='active'&&['active','confirming'].includes(policyState(p))).sort((x,y)=>Number(y.serial)-Number(x.serial)).slice(0,filter==='recent'?6:undefined);
  return <div className="page"><div className="page-inner policies-page">
    <div className="page-title-row"><div><div className="eyebrow">{a.network} demo</div><h1>{funding?'Fund a policy':'Policies'}</h1><p>{funding?'Choose a place. Back its cover. Share its premiums.':'View cover or explore its funding side.'}</p></div><a href="/" onClick={onLink} className={funding?'chip':'buy compact'}>Create demo cover <span>↗</span></a></div>
    <div className="position-tabs policy-view-tabs" aria-label="Policy view"><button aria-pressed={!funding} onClick={()=>setView(false)}>Cover NFTs</button><button aria-pressed={funding} onClick={()=>setView(true)}>Fund a policy · preview</button></div>
    {funding?<p className="funding-note">Open participation concept · estimates before claims & costs · deposits are not enabled.</p>:null}
    <div className="policy-filters" aria-label="Filter policies">{[['global','Global demos'],['recent','Recent'],['here','Created here'],['all','All policies'],['active','Committed']].map(([id,label])=><button key={id} className={`chip ${filter===id?'chip-on':''}`} aria-pressed={filter===id} onClick={()=>{setFilter(id);updateQuery(funding,id);}}>{label}</button>)}<button className="text-button" onClick={()=>void refresh()}>Refresh ↻</button></div>
    {Object.entries(requests).map(([id,r])=><div className="notice request-notice" key={id} role="status"><strong>{r.ok?r.status==='creating'?'Creating your cover…':'Request needs review':'Request status unavailable'}</strong><p>{r.message??'Your request is saved. This page will update when the policy is confirmed.'}</p><small className="num">Request {id}</small>{!r.ok&&r.reason==='not_found'?<button className="text-button" onClick={()=>{trackRequest(id,a.network,true);setRequests(v=>Object.fromEntries(Object.entries(v).filter(([key])=>key!==id)));}}>Dismiss</button>:null}</div>)}
    {a.policiesError?<div className="notice" role="status">{a.policiesError} <button className="text-button" onClick={()=>void refresh()}>Retry</button></div>:null}
    {!a.checked||a.policies===null&&!a.policiesError?<div className="empty-state">Loading policies…</div>:rows.length===0?<div className="empty-state"><span className="empty-ring"/><h2>{filter==='here'?'No policies created in this browser.':filter==='active'?'No committed policies.':filter==='global'?'Global demo records are not available.':'No policies to show.'}</h2><a className="hs" href="/" onClick={onLink}>Choose a place →</a></div>:<div className="policy-cards">{rows.map(p=><a key={p.serial} href={policyPath(p.serial)+'?'+new URLSearchParams({...funding?{position:'lp'}:{},filter})} onClick={onLink} className="nft-gallery-link" aria-label={`Open ${funding?'LP preview':'cover NFT'} ${p.serial}${p.place?` for ${p.place}`:''}`}><PositionNFT policy={p} kind={funding?'liquidity':'cover'} contribution={p.payoutHbar*.1} compact/>{funding?<div className="funding-card-rate"><span>Est. annual premiums</span><strong>{lpModel(p)?.annualRate.toFixed(2)??'—'}% <small>before claims</small></strong><span>Explore contribution →</span></div>:null}</a>)}</div>}
    <p className="demo-footer">Demo beneficiary accounts are managed by the service. “Created here” identifies this browser, not wallet ownership. aUSDd has no cash value.</p>
  </div></div>;
}
