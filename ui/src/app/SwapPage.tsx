import {useEffect,useState} from 'react';
import {NetworkPath} from '../components/NetworkPath';
import {SwapEvidence} from '../components/SwapEvidence';
import {onLink,navigate} from '../lib/router';
import {BridgeTransfer} from './BridgeTransfer';
import {BridgedSwap} from './BridgedSwap';
import {TestnetSwap} from './TestnetSwap';
import {SwapLiquidity} from './SwapLiquidity';

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
  <div className="swap-workspace">
   <section className="swap-workflow" aria-label="Bridge and swap test tokens">
    <div className="swap-step-tabs" role="group" aria-label="Cross-chain steps"><button aria-pressed={step==='bridge'} onClick={()=>choose('bridge')}><span>01</span> Bridge <small>Hedera → Sepolia</small></button><button aria-pressed={step==='swap'} onClick={()=>choose('swap')}><span>02</span> Swap <small>Uniswap on Sepolia</small></button></div>
    <p className="swap-requirements"><span className="status-dot"/>Test tokens · no cash value. Use a Sepolia wallet with test ETH for gas.</p>
    <div hidden={step!=='bridge'}><BridgeTransfer embedded onSwap={()=>choose('swap')}/></div>
    <div hidden={step!=='swap'}><BridgedSwap embedded/></div>
    {step==='bridge'?<button className="text-button swap-skip" onClick={()=>choose('swap')}>Already have bridged aUSDd? Go to swap →</button>:null}
   </section>
   <aside className="swap-context" aria-label="Why this integration matters">
    <h2>Native cover.<br/>A path to EVM liquidity.</h2>
    <p>Hedera commits the payout. Axelar connects the networks. Uniswap gives Hedera-origin tokens a place to trade.</p>
    <SwapEvidence/>
    <details className="swap-technical"><summary>How the agent is constrained <span>+</span></summary><p>The HAK Axelar plugin builds the transfer. Quorum checks its chain, token, recipient and amount before signing. The Uniswap Trading API builds a swap for your wallet to approve.</p><p>Exact approvals · 0.5% slippage · saved transaction IDs. No custom Solidity contracts from this project.</p><a href="https://github.com/jmgomezl/aivy-parametric-pool#why-uniswap" target="_blank" rel="noreferrer">Architecture & implementation ↗</a></details>
   </aside>
  </div>
  <SwapLiquidity/>
  <div className="swap-alternative"><div><h2>Only have Sepolia ETH?</h2><p>Try a direct Uniswap swap. No bridge needed.</p></div><TestnetSwap/></div>
  <p className="swap-footer">This moves your demo account balance. Policy payouts go to a separate demo beneficiary. ARPS is not traded here. Sponsored test liquidity is not a USD peg or cash redemption.</p>
  <a className="hs" href="/" onClick={onLink}>Explore earthquake cover →</a>
 </div></div>;
}
