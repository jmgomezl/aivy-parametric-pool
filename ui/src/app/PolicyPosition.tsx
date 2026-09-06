import type { Policy } from '../lib/agent';
import { PositionNFT } from '../components/PositionNFT';
import { Slider } from './History';
import { placeName } from '../lib/hazard';
import { lpModel } from '../lib/lp-model.mjs';
export type PositionKind='cover'|'liquidity';
type Props={policy:Policy;kind:PositionKind;onKind:(kind:PositionKind)=>void;portion:number;onPortion:(value:number)=>void};
export function PolicyPosition({policy,kind,onKind,portion,onPortion}:Props){
 const contribution=policy.payoutHbar*portion/100;
 return <div className="position-view">
   <div className="position-tabs" aria-label="Position view"><button aria-pressed={kind==='cover'} onClick={()=>onKind('cover')}>Cover NFT</button><button aria-pressed={kind==='liquidity'} onClick={()=>onKind('liquidity')}>LP preview ↗</button></div>
   {kind==='liquidity'?<div className="position-mobile-controls"><LPPreviewControls policy={policy} portion={portion} onPortion={onPortion}/></div>:null}
   <PositionNFT policy={policy} kind={kind} contribution={contribution}/>
   <p className="position-caption">{kind==='cover'?'A visual receipt for this policy’s cover. Explore the LP preview to see the proposed funding side.':'Proposed per-policy LP receipt · not an issued NFT.'}</p>
 </div>;
}
export function LPPreviewControls({policy,portion,onPortion}:{policy:Policy;portion:number;onPortion:(value:number)=>void}){
 const model=lpModel(policy,portion),asset=policy.asset??'HBAR';
 const number=(v:number)=>v.toLocaleString(undefined,{maximumFractionDigits:2});
 return <div className="lp-preview-controls">
   <div className="eyebrow">Open funding · concept preview</div><h3>Back {placeName(policy).split(',')[0]}. Share its premiums.</h3>
   <Slider label="Your contribution" value={portion} min={0} max={100} step={.1} unit={asset} format={v=>number(policy.payoutHbar*v/100)} onChange={onPortion}/>
   <div className="lp-preview-flow" aria-label="Proposed flow: contribute capital, back this policy, receive a share of premiums"><span>Your capital</span><span aria-hidden="true">→</span><span>Policy #{policy.serial}</span><span aria-hidden="true">→</span><span>Premiums</span></div>
   {model?<><div className="lp-income"><div><span>Est. annual premium rate</span><strong className="num">{number(model.annualRate)}%<small> / yr</small></strong><small>Before claims & costs</small></div><div><span>Your {model.days}-day premiums</span><strong className="num">{number(model.income)}</strong><small>{asset} · {number(portion)}% share</small></div></div>
   <div className="lp-outcomes"><div><span>No qualifying payout</span><strong>{number(model.noClaimTotal)} {asset}</strong><small>Capital + premium share</small></div><div><span>Payout triggers</span><strong>{number(model.claimTotal)} {asset}</strong><small>Your contributed capital is used</small></div></div>
   <details className="lp-assumptions"><summary>How the estimate works</summary><p>{Math.round(model.poolFraction*100)}% of this policy’s premium goes to the pool{policy.brokerId?' after the 15% broker split':''}. The preview allocates it pro rata to contributors. Annual rate = pool premium ÷ payout target × 365 ÷ {model.days} days. Assumes continuous funding at the same terms, without compounding. Claims, fees and idle capital reduce returns; losses can consume your entire contribution.</p></details></>:<p>Return estimate unavailable for this policy’s recorded terms.</p>}
   <p>Designed for anyone to fund a policy. Preview only: no deposit, income distribution or LP NFT is created. Current LP shares back the shared pool.</p>
 </div>;
}
