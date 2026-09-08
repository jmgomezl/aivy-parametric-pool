import {useEffect,useState} from 'react';
import {NetworkPath} from '../components/NetworkPath';
import {SwapEvidence} from '../components/SwapEvidence';
import {onLink,navigate} from '../lib/router';
import {SwapLiquidity} from './SwapLiquidity';
import {DemoBridge,DemoSwap,DemoWalletNote} from './DemoEvm';

const readStep=()=>new URLSearchParams(location.search).get('step')==='swap'?'swap':'bridge';
export function SwapPage(){
 const [step,setStep]=useState(readStep);
 useEffect(()=>{const sync=()=>setStep(readStep());window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
 const choose=(next:string)=>navigate(next==='swap'?'/swap?step=swap':'/swap');
 return <div className="page"><div className="page-inner swap-page">
  <div className="eyebrow">Hedera testnet → Ethereum Sepolia</div>
  <h1>From Hedera to <span>Uniswap.</span></h1>
  <p className="swap-intro">Bridge your aUSDd. Swap for test USDC. Stay in one app.</p>
  <NetworkPath/>
  <DemoWalletNote/>
  <div className="swap-workspace">
   <section className="swap-workflow" aria-label="Bridge and swap test tokens">
    <div className="swap-step-tabs" role="group" aria-label="Cross-chain steps"><button aria-pressed={step==='bridge'} onClick={()=>choose('bridge')}><span>01</span> Bridge <small>Hedera → Sepolia</small></button><button aria-pressed={step==='swap'} onClick={()=>choose('swap')}><span>02</span> Swap <small>Uniswap on Sepolia</small></button></div>
    <p className="swap-requirements"><span className="status-dot"/>Real testnet transactions · no cash value.</p>
    <div hidden={step!=='bridge'}><DemoBridge onSwap={()=>choose('swap')}/></div>
    <div hidden={step!=='swap'}><DemoSwap/></div>
    {step==='bridge'?<button className="text-button swap-skip" onClick={()=>choose('swap')}>Try a swap with starter tokens →</button>:null}
   </section>
   <aside className="swap-context" aria-label="Why this integration matters">
    <h2>Native cover.<br/>A path to EVM liquidity.</h2>
    <p>Hedera commits the payout. Axelar connects the networks. Uniswap gives Hedera-origin tokens a place to trade.</p>
    <SwapEvidence/>
    <details className="swap-technical"><summary>How the agent is constrained <span>+</span></summary><p>The HAK Axelar plugin builds the bridge. Quorum verifies chain, token, recipient and amount. Uniswap APIs build the swap and liquidity operations.</p><p>The app signs only those bounded Sepolia actions in a separate service-managed demo wallet for this browser. Keys stay on the server; gas is sponsored.</p><p>Exact approvals · 0.5% slippage · gas limits · saved transaction hashes. No custom Solidity contracts from this project.</p><a href="https://github.com/jmgomezl/aivy-parametric-pool#why-uniswap" target="_blank" rel="noreferrer">Architecture & implementation ↗</a></details>
   </aside>
  </div>
  <SwapLiquidity/>
  <p className="swap-footer">This moves your demo account balance. Policy payouts go to a separate demo beneficiary. ARPS is not traded here. Sponsored test liquidity is not a USD peg or cash redemption.</p>
  <a className="hs" href="/" onClick={onLink}>Explore earthquake cover →</a>
 </div></div>;
}
