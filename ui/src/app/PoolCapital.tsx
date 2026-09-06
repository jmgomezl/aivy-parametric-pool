import {useAgent} from '../lib/store';
export function PoolCapital(){
 const a=useAgent(),p=a.pool;
 if(!p)return <div className="capital-overview" role="status">Shared pool balance unavailable. Capacity is checked before cover is created.</div>;
 const n=(v:number)=>v.toLocaleString(undefined,{maximumFractionDigits:2});
 return <section className="capital-overview" aria-label="Shared pool capital"><div className="capital-heading"><span>Shared pool · {p.network} · {p.asset.symbol}</span><a href={p.hashscan} target="_blank" rel="noreferrer">Verify ↗</a></div><div className="capital-values">{[['Total capital',p.capital],['Reserved for cover',p.committed],['Available',p.headroom]].map(([label,v])=><div key={label}><span>{label}</span><strong className="num">{n(Number(v))}</strong></div>)}</div><div className="capital-bar" aria-hidden="true"><span style={{width:`${p.capital>0?Math.min(100,p.committed/p.capital*100):0}%`}}/></div><small>{!a.online||!a.poolAt||Date.now()-Date.parse(a.poolAt)>30000?'Last known balance · ':''}Shared across policies, not separate policy vaults. Practice funding does not add capital.</small></section>;
}
