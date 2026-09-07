import {useState} from 'react';
const BASE=import.meta.env.VITE_AGENT_URL??'',TOKEN='0x5685b5660a86028d8a50c9e4fc33ff081b3cd9e9',ROUTER='0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b',STORE='quorum.bridged.swap.pending';
type Tx={from:string;to:string;data:string;value:string;chainId:string};
type Pending={kind:'approval'|'swap';hash?:string;transaction:Tx};
type Draft={id:string;expiresAt:number;amountOut:string;minimumOut:string;approval:Tx;permit:null|{domain:unknown;types:Record<string,unknown>;values:unknown}};
const wallet=()=>(window as unknown as {ethereum?:{request:(p:{method:string;params?:unknown[]})=>Promise<any>}}).ethereum;
const format=(v:string)=>(Number(v)/1e6).toLocaleString(undefined,{maximumFractionDigits:6});
export function BridgedSwap({embedded=false}:{embedded?:boolean}={}){
 const [amount,setAmount]=useState('0.01'),[draft,setDraft]=useState<Draft|null>(null),[approved,setApproved]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[recovery,setRecovery]=useState('');
 const [pending,setPending]=useState<Pending|null>(()=>{try{return JSON.parse(localStorage.getItem(STORE)??'null');}catch{return null;}});
 const [receipt,setReceipt]=useState(()=>localStorage.getItem(STORE+'.receipt')??'');
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await fn();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}};
 const api=async(path:string,body:unknown)=>{const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok)throw Error(j.message??'Swap service unavailable.');return j;};
 const identity=async(expected?:string)=>{const w=wallet();if(!w)throw Error('Open in an EVM wallet browser or use a wallet extension.');if(await w.request({method:'eth_chainId'})!=='0xaa36a7')throw Error('Switch your wallet to Ethereum Sepolia.');const accounts=await w.request({method:'eth_accounts'});if(!accounts[0]||(expected&&accounts[0].toLowerCase()!==expected.toLowerCase()))throw Error('Wallet account changed. Request a new quote.');return w;};
 const quote=async()=>{
  const w=wallet();if(!w)throw Error('Open in an EVM wallet browser or use a wallet extension.');
  await w.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xaa36a7'}]});const accounts=await w.request({method:'eth_requestAccounts'});
  if(!/^\d+(\.\d{1,2})?$/.test(amount)||Number(amount)<.01||Number(amount)>1)throw Error('Choose 0.01–1 aUSDd, up to two decimals.');
  const units=String(Math.round(Number(amount)*1e6));
  const balance=await w.request({method:'eth_call',params:[{to:TOKEN,data:'0x70a08231'+accounts[0].slice(2).toLowerCase().padStart(64,'0')},'latest']});
  if(BigInt(balance)<BigInt(units))throw Error('Not enough bridged aUSDd in this Sepolia wallet. Complete the bridge first.');
  const next=await api('/api/bridged-swap/quote',{address:accounts[0],amountUnits:units});
  const allowance=await w.request({method:'eth_call',params:[{to:TOKEN,data:'0xdd62ed3e'+accounts[0].slice(2).toLowerCase().padStart(64,'0')+'000000000022d473030f116ddee9f6b43ac78ba3'.padStart(64,'0')},'latest']});
  setDraft(next);setApproved(BigInt(allowance)>=BigInt(units));
 };
 const submit=async(transaction:Tx,kind:'approval'|'swap')=>{
  const w=await identity(transaction.from);
  if(transaction.chainId!=='0xaa36a7'||transaction.value!=='0x0'||transaction.to.toLowerCase()!==(kind==='approval'?TOKEN:ROUTER))throw Error('Unexpected transaction target.');
  const{chainId:_,...tx}=transaction;
  const gas=BigInt(await w.request({method:'eth_estimateGas',params:[tx]}))*120n/100n,price=BigInt(await w.request({method:'eth_gasPrice'}));
  if(gas>500000n||gas*price>1000000000000000n)throw Error('Gas exceeds the demo budget.');
  await identity(transaction.from);
  const record:Pending={kind,transaction};localStorage.setItem(STORE,JSON.stringify(record));setPending(record);
  try{record.hash=await w.request({method:'eth_sendTransaction',params:[{...tx,gas:'0x'+gas.toString(16)}]});localStorage.setItem(STORE,JSON.stringify(record));setPending({...record});setMessage('Submitted. Check confirmation before continuing.');}
  catch(e){if((e as {code?:number}).code===4001){localStorage.removeItem(STORE);setPending(null);throw Error('Declined in wallet.');}throw Error('Submission unknown. Use the transaction hash from wallet history to reconcile; do not repeat it.');}
 };
 const check=async()=>{
  if(!pending)return;const w=await identity(pending.transaction.from),hash=recovery||pending.hash;if(!hash||!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('Enter the transaction hash from wallet history.');
  const sent=await w.request({method:'eth_getTransactionByHash',params:[hash]}),expected=pending.transaction;
  if(!sent||sent.to?.toLowerCase()!==expected.to.toLowerCase()||sent.from.toLowerCase()!==expected.from.toLowerCase()||sent.input!==expected.data||BigInt(sent.value)!==0n)throw Error('This transaction does not match your request.');
  const result=await w.request({method:'eth_getTransactionReceipt',params:[hash]});if(!result){setMessage('Still pending on Sepolia.');return;}
  localStorage.removeItem(STORE);setPending(null);setRecovery('');setReceipt(hash);localStorage.setItem(STORE+'.receipt',hash);
  if(result.status!=='0x1'){setMessage('Transaction reverted. No swap completed; gas was spent.');setDraft(null);return;}
  if(pending.kind==='approval'){setApproved(true);setMessage('Exact token allowance confirmed. You can now sign the swap permit.');}
  else{setMessage('Swap confirmed. Test USDC received in your wallet.');setDraft(null);setApproved(false);}
 };
 const swap=async()=>{
  if(!draft||Date.now()>draft.expiresAt)throw Error('Quote expired. Request a new quote.');const w=await identity(draft.approval.from);
  const signature=draft.permit?await w.request({method:'eth_signTypedData_v4',params:[draft.approval.from,JSON.stringify({domain:draft.permit.domain,types:{...draft.permit.types,EIP712Domain:[{name:'name',type:'string'},{name:'chainId',type:'uint256'},{name:'verifyingContract',type:'address'}]},primaryType:'PermitSingle',message:draft.permit.values})]}):undefined;
  const built=await api('/api/bridged-swap/build',{id:draft.id,...(signature?{signature}:{})});if(Date.now()>built.expiresAt)throw Error('Swap data expired. Request a new quote.');await submit(built.transaction,'swap');
 };
 const Shell=embedded?'section':'details', Heading=embedded?'h2':'h4';
 return <Shell className={`testnet-swap ${embedded?'swap-embedded':''}`}>{!embedded?<summary>Swap bridged aUSDd <span>Uniswap ↗</span></summary>:null}<div className="testnet-swap-body"><div className="conversion-top"><span>Sepolia · test tokens only</span><span>0.5% slippage</span></div><Heading className={embedded?'flow-form-title':undefined}>aUSDd → test USDC</Heading><p>Approve an exact amount, then sign and confirm your swap. Sponsored test liquidity; prices can move.</p><label>Spend bridged aUSDd<input value={amount} inputMode="decimal" disabled={busy||Boolean(pending)} onChange={e=>{setAmount(e.target.value);setDraft(null);setApproved(false);}}/></label><button className="chip" disabled={busy||Boolean(pending)} onClick={()=>void run(quote)}>Connect wallet & get quote →</button>
 {draft?<><div className="conversion-amounts"><div><strong>{amount}</strong><span>bridged aUSDd</span></div><span>→</span><div><strong>{format(draft.amountOut)}</strong><span>test USDC</span></div></div><small>Minimum {format(draft.minimumOut)} USDC · gas extra</small>{!approved?<button className="buy" disabled={busy||Boolean(pending)} onClick={()=>void run(()=>submit(draft.approval,'approval'))}>Approve exactly {amount} aUSDd →</button>:<button className="buy" disabled={busy||Boolean(pending)} onClick={()=>void run(swap)}>Sign permit & review swap →</button>}</>:null}
 {pending?<><small>{pending.kind==='approval'?'Approval':'Swap'} awaiting confirmation.</small>{!pending.hash?<label>Transaction hash from wallet history<input value={recovery} onChange={e=>setRecovery(e.target.value)} placeholder="0x…"/></label>:<a href={`https://sepolia.etherscan.io/tx/${pending.hash}`} target="_blank" rel="noreferrer">Pending transaction ↗</a>}<button className="chip" disabled={busy} onClick={()=>void run(check)}>Check confirmation ↻</button></>:null}
 {message?<p role="status">{message}</p>:null}{receipt?<a href={`https://sepolia.etherscan.io/tx/${receipt}`} target="_blank" rel="noreferrer">Latest transaction receipt ↗</a>:null}
 </div></Shell>;
}
