import {useEffect,useRef,useState} from 'react';
import proof from '../../../docs/evidence/uniswap-liquidity.json';
import {DemoLiquidity} from './DemoEvm';

const BASE=import.meta.env.VITE_AGENT_URL??'';
const MANAGER='0x1238536071e1c677a632429e3655c799b22cda52';
type Position={tokenId:string;owner:string;liquidity:string;amount0:string;amount1:string;claimable0:string;claimable1:string;inRange:boolean;supported:boolean};
type Market={pool:string;manager:string;balance0:string;balance1:string;price0Per1:number;feePercent:number;seed:Position;seedImage?:string|null;block:number;checkedAt:string};
const n=(v:string)=>(Number(v)/1e6).toLocaleString(undefined,{maximumFractionDigits:6});
const short=(v:string)=>`${v.slice(0,6)}…${v.slice(-4)}`;
const nft=(id:string)=>`https://sepolia.etherscan.io/nft/${MANAGER}/${id}`;

// Public liquidity actions always use the scoped, sponsored demo signer.
export function SwapLiquidity(){
  const [market,setMarket]=useState<Market|null>(null),[marketError,setMarketError]=useState(''),[loadingMarket,setLoadingMarket]=useState(false);
  const [open,setOpen]=useState(false),mounted=useRef(true);
  async function refreshMarket(){
    setLoadingMarket(true);
    try{
      const response=await fetch(`${BASE}/api/liquidity/market`,{signal:AbortSignal.timeout(35000)});
      const value=await response.json().catch(()=>{throw Error('Liquidity service unavailable. Try refreshing.');});
      if(!response.ok)throw Error(value.message??'Liquidity service unavailable.');
      if(mounted.current){setMarket(value);setMarketError('');}
    }catch(error){if(mounted.current){setMarket(null);setMarketError((error as Error).message);}}
    finally{if(mounted.current)setLoadingMarket(false);}
  }
  useEffect(()=>{mounted.current=true;void refreshMarket();return()=>{mounted.current=false;};},[]);
  return <section className="swap-liquidity" id="liquidity" aria-label="Uniswap pool and positions">
    <div className="liquidity-heading"><div><div className="eyebrow">Uniswap V3 · Sepolia</div><h2>The market behind your swap.</h2><p>Provide swap liquidity. Earn swap fees.</p></div><button className="text-button" disabled={loadingMarket} onClick={()=>void refreshMarket()} aria-label="Refresh Uniswap pool">{loadingMarket?'Refreshing…':'Refresh ↻'}</button></div>
    <div className="liquidity-overview">
      <div className="liquidity-market"><div className="liquidity-pair"><span className="liquidity-coins" aria-hidden="true"><i>a</i><i>U</i></span><strong>aUSDd / test USDC</strong><span className="liquidity-fee">0.3% swap fee</span></div>
        {market?<><div className="liquidity-reserves"><div><strong className="num">{n(market.balance1)}</strong><span>aUSDd in pool</span></div><span aria-hidden="true">⇄</span><div><strong className="num">{n(market.balance0)}</strong><span>test USDC in pool</span></div></div><div className="liquidity-range" aria-hidden="true"><span/><i/><span/></div><div className="liquidity-links"><a href={`https://sepolia.etherscan.io/address/${market.pool}`} target="_blank" rel="noreferrer">Verify pool ↗</a><small>Block {market.block.toLocaleString()} · {new Date(market.checkedAt).toLocaleTimeString()}</small></div></>:<p role="status">{marketError||'Reading the Uniswap pool…'}</p>}
      </div>
      <div className="liquidity-seed"><div className="liquidity-seed-details"><span className="eyebrow">Operator’s seed position</span>{market?.seed?<><a className="liquidity-nft-id" href={nft(market.seed.tokenId)} target="_blank" rel="noreferrer">NFT #{market.seed.tokenId} ↗</a><span>{BigInt(market.seed.liquidity)>0n?'Full range · active':'Liquidity removed'}</span><small>Sponsored test liquidity · held by {short(market.seed.owner)}</small></>:<span>Position unavailable</span>}</div>{market?.seedImage?<a className="liquidity-seed-art" href={nft(market.seed.tokenId)} target="_blank" rel="noreferrer"><img src={market.seedImage} alt={`Actual Uniswap V3 NFT #${market.seed.tokenId}`} width={90} height={155}/></a>:null}<button className="chip" aria-expanded={open} aria-controls="liquidity-controls" onClick={()=>setOpen(v=>!v)}>{open?'Close liquidity controls −':'Provide swap liquidity →'}</button></div>
    </div>
    <p className="liquidity-boundary">Separate from ARPS and cover reserves · test tokens have no cash value.</p>
    <details className="liquidity-recorded"><summary>Verified liquidity demo <span>+</span></summary><small>Recorded Sepolia lifecycle · NFT #{proof.tokenId} · now fully withdrawn</small><div>{[['Position minted',proof.transactions.create],['Fees collected',proof.transactions.collect],['Position withdrawn',proof.transactions['remove-rest']]].map(([label,hash])=><a key={hash} href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">{label} ↗</a>)}</div></details>
    <div id="liquidity-controls" hidden={!open} className="liquidity-controls"><DemoLiquidity/></div>
  </section>;
}
