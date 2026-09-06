import { useId } from 'react';
import type { Policy } from '../lib/agent';
import { placeName } from '../lib/hazard';
import { policyState, statusLabel } from '../lib/store';

type Props = { policy: Policy; kind?: 'cover' | 'liquidity'; contribution?: number; compact?: boolean };
const number=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2});

/** A data-driven card. The LP variant is explicitly a proposed position, never an issued NFT. */
export function PositionNFT({policy:p,kind='cover',contribution=100,compact=false}:Props){
 const uid=useId().replace(/:/g,''),lp=kind==='liquidity',state=policyState(p);
 const asset=p.asset??'HBAR',amount=lp?contribution:p.payoutHbar;
 const name=placeName(p),parts=name.split(','),signed=p.ledger?.oracles.filter(o=>o.signed).length??0;
 const seed=Math.abs(p.lat*13+p.lon*7)%60;
 const percentage=p.payoutHbar>0?Math.min(100,contribution/p.payoutHbar*100):0;
 return <article className={`position-nft ${lp?'position-nft-lp':''} ${compact?'position-nft-compact':''}`} aria-label={`${lp?'Liquidity position preview':'Cover NFT'} for ${name}, ${number(amount)} ${asset}`}>
   <div className="nft-frame" aria-hidden="true"/>
   <header className="nft-header"><span className="nft-brand">◉ AIVY</span><span>{lp?'LP · PREVIEW':'COVER NFT'} <span className="num">/{String(p.serial).padStart(4,'0')}</span></span></header>
   <div className="nft-location"><h2>{parts[0]}</h2><span>{parts.slice(1).join(',').trim()||'Earthquake cover'}</span></div>
   <div className="nft-traits"><span>M{p.trigger?.minMagnitude??6}+</span><span>{p.trigger?.radiusKm??100} KM</span><span>{asset}</span></div>
   <svg className="nft-art" viewBox="0 0 360 244" role="img" aria-label="Generative location emblem">
     <defs>
       <linearGradient id={`${uid}-ink`} x1="0" y1="1" x2="1" y2="0"><stop stopColor={lp?'#b9e570':'#43daa2'}/><stop offset=".5" stopColor="#d9fbd3"/><stop offset="1" stopColor={lp?'#e8be77':'#519c8b'}/></linearGradient>
       <radialGradient id={`${uid}-wash`}><stop stopColor={lp?'#96ab52':'#30cda0'} stopOpacity=".26"/><stop offset="1" stopColor="#061812" stopOpacity="0"/></radialGradient>
       <pattern id={`${uid}-grid`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" stroke="#c4efdd" strokeOpacity=".07" fill="none"/></pattern>
     </defs>
     <rect width="360" height="244" fill={`url(#${uid}-grid)`}/>
     <ellipse cx="180" cy="122" rx="160" ry="118" fill={`url(#${uid}-wash)`}/>
     <g transform={`translate(180 119) rotate(${-28+seed/5})`} fill="none" stroke={`url(#${uid}-ink)`}>
       {Array.from({length:15},(_,i)=>{const radius=30+i*5.3;return <ellipse key={i} rx={radius} ry={radius*.57+Math.sin(i*.38)*8} transform={`rotate(${i*3.4})`} strokeWidth={i===14?1.8:.8} opacity={.28+i*.046}/>;})}
     </g>
     <path d="M40 187H320M180 28V214" fill="none" stroke="#badacc" strokeOpacity=".17" strokeDasharray="2 5"/>
     <circle cx="180" cy="119" r="5" fill="#d8ffe6"/><circle cx="180" cy="119" r="12" fill="none" stroke="#d8ffe6" strokeOpacity=".4"/>
     <g fill="#b1cdbf" fontSize="10" className="num"><text x="22" y="226">{Math.abs(p.lat).toFixed(2)}° {p.lat>=0?'N':'S'}</text><text x="338" y="226" textAnchor="end">{Math.abs(p.lon).toFixed(2)}° {p.lon>=0?'E':'W'}</text></g>
     <path d="M22 30V18H34M326 18H338V30M22 204V216H34M326 216H338V204" fill="none" stroke="#bbdac8" strokeOpacity=".5"/>
   </svg>
   <div className="nft-value"><span>{lp?'Proposed contribution':state==='paid'?'Payout executed':'Scheduled payout'}</span><div><strong className="num">{number(amount)}</strong><span>{asset}</span></div></div>
   <div className="nft-position-line"><span style={{width:lp?`${percentage}%`:state==='paid'?'100%':`${p.ledger?.available?signed/2*100:0}%`}}/></div>
   <footer className="nft-footer"><span className="nft-status"><i/>{lp?`${number(percentage)}% of policy target`:statusLabel(p)}</span><span>{lp?'NOT MINTED':p.network??'testnet'}</span></footer>
 </article>;
}
