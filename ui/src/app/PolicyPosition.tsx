import {onLink} from '../lib/router';
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
   <div className="position-tabs" aria-label="Position view"><button aria-pressed={kind==='cover'} onClick={()=>onKind('cover')}>Cover receipt</button><button aria-pressed={kind==='liquidity'} onClick={()=>onKind('liquidity')}>Funding estimate ↗</button></div>
   {kind==='liquidity'?<div className="position-mobile-controls"><LPPreviewControls policy={policy} portion={portion} onPortion={onPortion}/></div>:null}
   <PositionNFT policy={policy} kind={kind} contribution={contribution}/>
   {kind==='cover'?<p className="position-caption">Cover NFT · terms and payout are verifiable on Hedera.</p>:null}
 </div>;
}
export function LPPreviewControls({policy,portion,onPortion}:{policy:Policy;portion:number;onPortion:(value:number)=>void}){
 const model=lpModel(policy,portion),asset=policy.asset??'HBAR';
 const number=(v:number)=>v.toLocaleString(undefined,{maximumFractionDigits:2});
 return <div className="lp-preview-controls">
   <p className="lp-preview-boundary">Policy estimate · deposits go to the shared pool</p><div className="lp-preview-heading"><h3>Economics · {placeName(policy).split(',')[0]}</h3><span>Preview</span></div>
   <Slider label="Example contribution" value={portion} min={0} max={100} step={.1} unit={asset} format={v=>number(policy.payoutHbar*v/100)} onChange={onPortion}/>
   {model?<><div className="lp-income"><div><span>Premium share · {model.days} days</span><strong className="num">+{number(model.income)}</strong><small>{asset} · hypothetical</small></div><div><span>Premium / capital · {model.days} days</span><strong className="num">{number(model.termRate)}%</strong><small>Before claims & costs</small></div></div>
   <div className="lp-estimate-note">One full policy term · no automatic renewal</div>
   <div className="lp-scenario-heading"><span>Illustrative amount remaining</span><small>Full contribution at risk</small></div>
   <div className="lp-scenarios">{[{label:`No payout · +${number(model.returnPct)}%`,value:model.noClaimTotal,capital:true,note:'After expiry · capital + premiums'},{label:`Payout triggers · ${number(model.lossPct)}%`,value:model.claimTotal,capital:false,note:'Capital used · premium share remains'}].map(outcome=><div key={outcome.label} className={outcome.capital?'lp-scenario-safe':'lp-scenario-loss'}><span>{outcome.label}</span><strong className="num">{number(outcome.value)} <small>{asset}</small></strong><div className="lp-scenario-bar" aria-hidden="true">{outcome.capital?<i style={{width:`${model.noClaimTotal?model.contribution/model.noClaimTotal*100:0}%`}}/>:null}<b style={{width:`${model.noClaimTotal?(outcome.capital?model.income:model.claimTotal)/model.noClaimTotal*100:0}%`}}/></div><small>{outcome.note}</small></div>)}</div>
   <a className="buy" href="/policies?view=fund" onClick={onLink}>{asset==='aUSDd'?'Fund the shared pool':'View the aUSDd pool'} →</a>
   <details className="lp-assumptions"><summary>Numbers & assumptions <span>+</span></summary><p>{number(policy.premiumHbar)} {asset} premium → {number(model.poolPremium)} to the pool{policy.brokerId?` + ${number(model.commission)} to the broker`:''}. This example assigns {number(model.share*100)}% of the pool premium and payout risk to {number(model.contribution)} {asset} of capital.</p><p>Assumes funding from issuance through the full {model.days}-day term. It is not a quote for joining this policy now. Premiums are received upfront; no-payout capital becomes free only after expiry. Costs reduce both outcomes.</p><p>Annual premium comparison: {number(model.annualRate)}% = {number(model.termRate)}% × 365 ÷ {model.days}. This assumes continuously funded renewals at unchanged prices, with no compounding, claims or idle capital. It is not an expected return or APY.</p><p>No per-policy deposit, income distribution or LP NFT is created here. Current ARPS deposits back aUSDd policies in the shared pool; withdrawals and income distributions are not enabled.{asset!=='aUSDd'?' This historical asset is separate from current aUSDd deposits.':''}</p></details></>:<p>Return estimate unavailable for this policy’s recorded terms.</p>}
   <div className="lp-preview-disclosure">Estimate for this policy, not your actual pool return · {asset} has no cash value.</div>
 </div>;
}
