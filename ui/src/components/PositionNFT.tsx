import { CoverageMap } from './CoverageMap';
import type { Policy } from '../lib/agent';
import { placeName } from '../lib/hazard';
import { policyState, statusLabel } from '../lib/store';

type Props = { policy: Policy; kind?: 'cover' | 'liquidity'; contribution?: number; compact?: boolean };
const number=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2});

/** A data-driven card. The LP variant is explicitly a proposed position, never an issued NFT. */
export function PositionNFT({policy:p,kind='cover',contribution=100,compact=false}:Props){
 const lp=kind==='liquidity',state=policyState(p);
 const asset=p.asset??'HBAR',amount=lp?contribution:p.payoutHbar;
 const name=placeName(p),parts=name.split(','),signed=p.ledger?.oracles.filter(o=>o.signed).length??0;
 const percentage=p.payoutHbar>0?Math.min(100,contribution/p.payoutHbar*100):0;
 return <article className={`position-nft ${lp?'position-nft-lp':''} ${compact?'position-nft-compact':''}`} aria-label={`${lp?'Liquidity position preview':'Cover NFT'} for ${name}, ${number(amount)} ${asset}`}>
   <div className="nft-frame" aria-hidden="true"/>
   <header className="nft-header"><span className="nft-brand">◉ AIVY</span><span>{lp?'LP · PREVIEW':'COVER NFT'} <span className="num">/{String(p.serial).padStart(4,'0')}</span></span></header>
   <div className="nft-location"><h2>{parts[0]}</h2><span>{parts.slice(1).join(',').trim()||'Earthquake cover'}</span></div>
   <div className="nft-traits"><span>M{p.trigger?.minMagnitude??6}+</span><span>{p.trigger?.radiusKm??100} KM</span><span>{asset}</span></div>
   <CoverageMap lat={p.lat} lon={p.lon} radiusKm={p.trigger?.radiusKm??100} name={name} lp={lp}/>
   <div className="nft-value"><span>{lp?'Proposed contribution':state==='paid'?'Payout executed':'Scheduled payout'}</span><div><strong className="num">{number(amount)}</strong><span>{asset}</span></div></div>
   <div className="nft-position-line"><span style={{width:lp?`${percentage}%`:state==='paid'?'100%':`${p.ledger?.available?signed/2*100:0}%`}}/></div>
   <footer className="nft-footer"><span className="nft-status"><i/>{lp?`${number(percentage)}% of policy target`:statusLabel(p)}</span><span>{lp?'NOT MINTED':p.network??'testnet'}</span></footer>
 </article>;
}
