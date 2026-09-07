import {useEffect,useState} from 'react';
import {useDemo,demoCall,refreshDemo,receipt} from '../lib/demo';
const BASE=import.meta.env.VITE_AGENT_URL??'',key='quorum.bridge.request';
type Request={requestId:string;recipient:string;amount:number};
export function BridgeTransfer(){
 const {account}=useDemo(),[ready,setReady]=useState(false),[amount,setAmount]=useState('1'),[recipient,setRecipient]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [pending,setPending]=useState<Request|null>(()=>{try{return JSON.parse(localStorage.getItem(key)??'null');}catch{return null;}});
 const [tx,setTx]=useState(''),[status,setStatus]=useState<{status:string;sourceHash?:string;destinationHash?:string;explorer?:string;deliveryTransaction?:{to:string;data:string;value:string;chainId:string}}|null>(null);
 const latest=account?.actions.filter(a=>a.kind==='bridge'&&a.status==='complete').at(-1);
 const check=async()=>{if(!latest)return;try{setStatus(await demoCall('/api/demo/bridge/status?requestId='+encodeURIComponent(latest.requestId)));}catch(e){setMessage((e as Error).message);}};
 useEffect(()=>{if(!latest)return;void check();const timer=setInterval(()=>void check(),15000);return()=>clearInterval(timer);},[latest?.requestId]);
 const deliver=async()=>{
  const w=(window as unknown as {ethereum?:{request:(p:{method:string;params?:unknown[]})=>Promise<any>}}).ethereum;
  if(!w||!status?.deliveryTransaction){setMessage('Connect an EVM wallet with Sepolia ETH for gas.');return;}
  setBusy(true);try{
   await w.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xaa36a7'}]});const addresses=await w.request({method:'eth_requestAccounts'});
   const {chainId:_,...prepared}=status.deliveryTransaction;
   if(prepared.to.toLowerCase()!=='0xb5fb4be02232b1bba4dc8f81dc24c26980de9e3c'||prepared.value!=='0x0')throw Error('Invalid delivery transaction.');
   const transaction={...prepared,from:addresses[0]},gas=BigInt(await w.request({method:'eth_estimateGas',params:[transaction]}))*120n/100n,fee=BigInt(await w.request({method:'eth_gasPrice'}));
   if(gas>1000000n||gas*fee>2000000000000000n)throw Error('Delivery gas exceeds the demo limit.');
   const hash=await w.request({method:'eth_sendTransaction',params:[{...transaction,gas:'0x'+gas.toString(16)}]});
   setMessage('Delivery submitted: '+hash+'. Axelar commands can execute only once.');await check();
  }catch(e){setMessage((e as Error).message);await check();}finally{setBusy(false);}
 };
 useEffect(()=>{let active=true;fetch(BASE+'/api/bridge').then(r=>r.json()).then(j=>{if(active)setReady(Boolean(j.ok));}).catch(()=>{});return()=>{active=false;};},[]);
 useEffect(()=>{if(!pending)return;const action=account?.actions.find(a=>a.requestId===pending.requestId);if(action?.status==='complete'&&action.result?.bridgeTxId){setTx(action.result.bridgeTxId);setMessage('Source confirmed. Axelar is delivering your test tokens to Sepolia.');setPending(null);localStorage.removeItem(key);}},[account,pending]);
 const connect=async()=>{const w=(window as unknown as {ethereum?:{request:(p:{method:string})=>Promise<string[]>}}).ethereum;if(!w){setMessage('Use an EVM wallet browser or enter your Sepolia wallet address.');return;}try{const accounts=await w.request({method:'eth_requestAccounts'});setRecipient(accounts[0]??'');}catch{setMessage('Wallet connection declined.');}};
 const send=async()=>{
  if(!account)return;setBusy(true);setMessage('');
  const request=pending??{requestId:crypto.randomUUID(),recipient,amount:Number(amount)};
  localStorage.setItem(key,JSON.stringify(request));setPending(request);
  try{const r=await demoCall('/api/demo/bridge',request);setTx(r.bridgeTxId);setMessage('Source confirmed. Axelar is delivering your test tokens to Sepolia.');localStorage.removeItem(key);setPending(null);await refreshDemo();}
  catch(e){setMessage((e as Error).message);if((e as Error & {status?:number}).status){try{const view=await demoCall('/api/demo');if(!view.actions.some((a:{requestId:string})=>a.requestId===request.requestId)){localStorage.removeItem(key);setPending(null);}}catch{/* Keep unknown requests blocked. */}}await refreshDemo();}finally{setBusy(false);}
 };
 return <details className="testnet-swap"><summary>Move aUSDd to Sepolia <span>Axelar · HAK ↗</span></summary><div className="testnet-swap-body"><div className="conversion-top"><span>Hedera testnet → Sepolia</span><span>No cash value</span></div><p>Your aUSDd is locked on Hedera; the linked aUSDd token is delivered to your EVM wallet. This does not convert it into USDC.</p>
 {!ready?<p role="status">The bridge destination is being verified. Transfers are not yet available.</p>:!account?<button className="chip" onClick={()=>window.dispatchEvent(new Event('quorum:account'))}>Open your demo account →</button>:<><label>Bridge aUSDd<input value={amount} inputMode="decimal" disabled={busy||Boolean(pending)} onChange={e=>setAmount(e.target.value)}/></label><small>Balance {account.balance.toLocaleString()} aUSDd · 0.01–10 per transfer</small><label>Receive at your Sepolia address<input value={pending?.recipient??recipient} disabled={busy||Boolean(pending)} onChange={e=>setRecipient(e.target.value)} placeholder="0x…"/></label><button className="text-button" disabled={busy||Boolean(pending)} onClick={()=>void connect()}>Use connected wallet ↗</button><button className="buy" disabled={busy||Boolean(pending)||!/^0x[0-9a-fA-F]{40}$/.test(recipient)||!Number.isFinite(Number(amount))||Number(amount)<.01||Number(amount)>10||Number(amount)>account.balance} onClick={()=>void send()}>{busy?'Waiting for Hedera…':'Confirm bridge transfer →'}</button><small>Managed demo account · source fees sponsored. Destination delivery is asynchronous.</small></>}
 {latest?<div className="testnet-swap-receipt"><strong>{status?.status==='delivered'?'✓ Delivered to Sepolia':status?.status==='ready-to-deliver'?'Approved · awaiting delivery':'Cross-chain delivery in progress'}</strong><a href={receipt(latest.result!.bridgeTxId!)} target="_blank" rel="noreferrer">Hedera receipt ↗</a>{status?.explorer?<a href={status.explorer} target="_blank" rel="noreferrer">Track Axelar message ↗</a>:null}{status?.destinationHash?<a href={`https://sepolia.etherscan.io/tx/${status.destinationHash}`} target="_blank" rel="noreferrer">Sepolia receipt ↗</a>:null}<button className="text-button" onClick={()=>void check()}>Check delivery ↻</button>{status?.deliveryTransaction?<><small>The relayer may complete this automatically. You can also pay Sepolia gas to complete the approved delivery.</small><button className="chip" disabled={busy} onClick={()=>void deliver()}>Complete delivery in wallet →</button></>:null}</div>:null}
 {message?<p role="status">{message}</p>:null}{pending?<div><p>A transfer request is pending. Check its original transaction before continuing.</p><button className="chip" disabled={busy} onClick={()=>void send()}>Reconcile original request ↻</button></div>:null}{tx?<a href={receipt(tx)} target="_blank" rel="noreferrer">Verify Hedera transfer ↗</a>:null}
 </div></details>;
}
