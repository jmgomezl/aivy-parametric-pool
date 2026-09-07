import {useState,useEffect,useRef} from 'react';
import {useDemo,startDemo,refreshDemo,receipt} from '../lib/demo';
const n=(v:number)=>v.toLocaleString(undefined,{maximumFractionDigits:2});
export function DemoAccount(){
 const {account:a,busy,error}=useDemo(),[copyState,setCopyState]=useState<'idle'|'copied'|'manual'>('idle');
 const panel=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const show=()=>{if(panel.current){panel.current.open=true;panel.current.querySelector('summary')?.focus();window.scrollTo({top:0,behavior:'instant'});}};window.addEventListener('quorum:account',show);return()=>window.removeEventListener('quorum:account',show);},[]);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{
   const current=panel.current;
   if(current?.open&&event.target instanceof Node&&!current.contains(event.target)) current.open=false;
  };
  const escape=(event:KeyboardEvent)=>{
   const current=panel.current;
   if(event.key==='Escape'&&current?.open){
    event.preventDefault();
    current.open=false;
    current.querySelector('summary')?.focus();
   }
  };
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[]);
 const referralLink=a?`${location.origin}/?ref=${a.referralCode}`:'';
 const close=()=>{if(panel.current){panel.current.open=false;panel.current.querySelector('summary')?.focus();}};
 return <details className="demo-account" ref={panel}><summary>{a?<><span>Your testnet balance</span><strong className="num">{n(a.balance)} aUSDd</strong></>:<span>Your demo account</span>}</summary><div className="demo-account-body">
 <div className="account-panel-heading"><span className="account-network"><i aria-hidden="true"/>Testnet · no cash value</span><button className="account-icon" aria-label="Close demo account" onClick={close}>×</button></div>
 {a?<>
 <div className="account-balance"><div><span className="account-label">Available balance</span><h3>{n(a.balance)} <small>aUSDd</small></h3></div><button className="account-icon" aria-label="Refresh balances" title="Refresh balances" onClick={()=>void refreshDemo()}>↻</button></div>
 <div className="account-identity"><span>Service-managed</span><a href={`https://hashscan.io/testnet/account/${a.accountId}`} target="_blank" rel="noreferrer">Verify account ↗</a></div>
 <dl className="account-metrics"><div><dt>Pool shares</dt><dd>{n(a.shares)} <small>ARPS</small></dd></div><div><dt>Referral earnings</dt><dd>{n(a.commissions.reduce((sum,c)=>sum+c.amount,0))} <small>aUSDd</small></dd></div></dl>
 <section className="account-referrals" aria-label="Broker referrals"><div className="account-referral-heading"><h4>Refer & earn</h4><span>{a.commissions.length} referrals</span></div>
 <div className="account-referral-flow"><span>Share link</span><span aria-hidden="true">→</span><span>Buyer pays</span><span aria-hidden="true">→</span><span><strong>15%</strong> for you</span></div>
 <button className="buy account-copy" onClick={async()=>{try{await navigator.clipboard.writeText(referralLink);setCopyState('copied');}catch{setCopyState('manual');}}}><span aria-live="polite">{copyState==='copied'?'Link copied ✓':'Copy referral link ↗'}</span></button>
 {copyState==='manual'?<label className="account-copy-fallback">Copy this link<input aria-label="Referral link" readOnly value={referralLink} onFocus={e=>e.currentTarget.select()}/></label>:null}
 <details className="account-disclosure"><summary>Referral details</summary><p>You earn 15% of each referred premium on testnet. The pool receives 85%; the buyer pays the same price.</p><p>Test a purchase in another browser or profile using your link.</p><p>Referral code: <code>{a.referralCode}</code></p></details></section>
 <details className="account-disclosure"><summary>Your transactions <span aria-hidden="true">↗</span></summary><a href={receipt(a.starterTx)} target="_blank" rel="noreferrer">Starter tokens ↗</a>{a.commissions.map(c=><div className="account-transaction" key={c.serial}><a href={receipt(c.transaction)} target="_blank" rel="noreferrer">Referral · policy #{c.serial} · +{n(c.amount)} aUSDd ↗</a></div>)}{a.actions.map(x=><div className="account-transaction" key={x.requestId}><span>{x.kind==='deposit'?'Pool deposit':x.kind==='bridge'?'Bridge to Sepolia':x.kind==='oracle-check'?'Oracle check · max cost':'Cover premium'} · {n(x.amount)} aUSDd</span>{x.status==='complete'&&(x.result?.bridgeTxId||x.result?.depositTxId||x.result?.saleTxId)?<a href={receipt(x.result.bridgeTxId??x.result.depositTxId??x.result.saleTxId!)} target="_blank" rel="noreferrer">Verified transaction ↗</a>:x.status==='complete'&&x.kind==='oracle-check'?<span>See policy check receipts</span>:<span>Needs confirmation / review</span>}</div>)}</details>
 </>:<><h3>1,000 <small>aUSDd to try</small></h3><div className="account-start-flow"><span>Buy cover</span><span>Fund the pool</span><span>Earn referrals</span></div><p>Service-managed account · fees sponsored.</p><button className="buy account-copy" disabled={busy} onClick={()=>void startDemo()}>{busy?'Creating account…':'Start demo account →'}</button></>}
 <details className="account-disclosure"><summary>About this demo</summary><p>Service-managed keys. This browser’s access token controls the demo account; clearing browser storage loses access. Fees are sponsored. Tokens and shares have no cash value.</p></details>{error?<p role="alert">{error}</p>:null}
 </div></details>;
}
