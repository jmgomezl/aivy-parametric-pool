import {useState} from 'react';
import {onLink} from '../lib/router';
import type { Policy } from '../lib/agent';
import { PositionNFT } from '../components/PositionNFT';
import { Slider } from './History';
import { placeName } from '../lib/hazard';
import { lpScenario } from '../lib/lp-model.mjs';
export type PositionKind='cover'|'liquidity';
type Props={policy:Policy;kind:PositionKind;onKind:(kind:PositionKind)=>void;portion:number;onPortion:(value:number)=>void};
export function PolicyPosition({policy,kind,onKind,portion,onPortion}:Props){
 const contribution=policy.payoutHbar*portion/100;
 return <div className="position-view">
   <div className="position-tabs" aria-label="Position view"><button aria-pressed={kind==='cover'} onClick={()=>onKind('cover')}>Cover receipt</button><button aria-pressed={kind==='liquidity'} onClick={()=>onKind('liquidity')}>Funding estimate ↗</button></div>
   {kind==='liquidity'?<div className="position-mobile-controls"><LPPreviewControls policy={policy} portion={portion} onPortion={onPortion}/></div>:null}
   <PositionNFT policy={policy} kind={kind} contribution={contribution}/>
   {kind==='cover'?<p className="position-caption">Your cover receipt is an NFT. Explore possible funding returns with Funding estimate.</p>:null}
 </div>;
}
export function LPPreviewControls({policy,portion,onPortion}:{policy:Policy;portion:number;onPortion:(value:number)=>void}){
 const [horizon,setHorizon]=useState<'term'|'month'|'year'>('term');
 const model=lpScenario(policy,portion,horizon),asset=policy.asset??'HBAR';
 const number=(v:number)=>v.toLocaleString(undefined,{maximumFractionDigits:2});
 return <div className="lp-preview-controls">
   <p className="lp-preview-boundary">Policy estimate · deposits go to the shared pool</p><div className="lp-preview-heading"><h3>Economics · {placeName(policy).split(',')[0]}</h3><span>Preview</span></div>
   <Slider label="Example contribution" value={portion} min={0} max={100} step={.1} unit={asset} format={v=>number(policy.payoutHbar*v/100)} onChange={onPortion}/>
   <div className="scenario-horizons" aria-label="Estimate period">{(['term','month','year'] as const).map(h=><button className={`chip ${h===horizon?'chip-on':''}`} key={h} aria-pressed={h===horizon} onClick={()=>setHorizon(h)}>{h==='term'?'Policy term':h==='month'?'30 days':'1 year'}</button>)}</div>
   {model?<><div className="lp-income"><div><span>Annual premium rate · model</span><strong className="num">{number(model.annualRate)}%<small> / yr</small></strong></div><div><span>Premiums · {model.horizonDays} days</span><strong className="num">+{number(model.income)}</strong><small>{asset}</small></div></div>
   <div className="lp-estimate-note">Estimated · before claims & costs · no guaranteed yield</div>
   <div className="lp-scenario-heading"><span>Estimated amount remaining</span><small>Full contribution at risk</small></div>
   <div className="lp-scenarios">{[{label:`No qualifying event · +${number(model.returnPct)}%`,value:model.noClaimTotal,capital:true,note:'Capital + premiums'},{label:`Claim in first cover period · ${number(model.lossPct)}%`,value:model.claimTotal,capital:false,note:'Capital used · first-term premiums only'}].map(outcome=><div key={outcome.label} className={outcome.capital?'lp-scenario-safe':'lp-scenario-loss'}><span>{outcome.label}</span><strong className="num">{number(outcome.value)} <small>{asset}</small></strong><div className="lp-scenario-bar" aria-hidden="true">{outcome.capital?<i style={{width:`${model.noClaimTotal?model.contribution/model.noClaimTotal*100:0}%`}}/>:null}<b style={{width:`${model.noClaimTotal?(outcome.capital?model.income:model.claimTotal)/model.noClaimTotal*100:0}%`}}/></div><small>{outcome.note}</small></div>)}</div>
   <p className="lp-estimate-note">Longer periods assume renewal at the same rate, without compounding. A first-term claim consumes your capital and stops further income. Timing and costs change actual outcomes.</p>
   <a className="buy" href="/policies?view=fund" onClick={onLink}>Fund the shared pool →</a>
   <details className="lp-assumptions"><summary>Model & assumptions <span>+</span></summary><p>{Math.round(model.poolFraction*100)}% of this policy’s premium goes to the pool{policy.brokerId?' after the 15% broker split':''}. The preview allocates it in proportion to each contribution. Annual rate = pool premium ÷ payout target × 365 ÷ {model.days} days. Assumes continuous funding at the same terms, without compounding. Claims, fees and idle capital reduce returns; losses can consume your entire contribution.</p></details></>:<p>Return estimate unavailable for this policy’s recorded terms.</p>}
   <details className="lp-assumptions"><summary>What does this preview do? <span>+</span></summary><p>Designed for anyone to fund a policy and share premiums. No deposit, income distribution or LP NFT is created here. Current LP shares back the shared pool.</p></details>
   <div className="lp-preview-disclosure">Estimate for this policy, not your actual pool return · {asset} has no cash value.</div>
 </div>;
}
