import type { Policy } from '../lib/agent';
import { PositionNFT } from '../components/PositionNFT';
import { Slider } from './History';
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
 return <div className="lp-preview-controls">
   <h3>Back this policy</h3>
   <Slider label="Contribution" value={portion} min={0} max={100} step={.1} unit={policy.asset??'HBAR'} format={v=>(Math.round(policy.payoutHbar*v)/100).toLocaleString(undefined,{maximumFractionDigits:2})} onChange={onPortion}/>
   <div className="lp-preview-flow" aria-label="Proposed flow: your capital backs this policy"><span>Your capital</span><span aria-hidden="true">→</span><span>Policy #{policy.serial}</span></div>
   <p>Concept preview. No deposit or NFT is created. Current LP shares back the shared pool.</p>
 </div>;
}
