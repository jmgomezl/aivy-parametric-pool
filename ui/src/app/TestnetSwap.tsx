import {useState} from 'react';
type Wallet={request:(input:{method:string;params?:unknown[]})=>Promise<any>};
type Prepared={amountOut:string;minimumOut:string;expiresAt:number;transaction:{from:string;to:string;data:string;value:string;chainId:string}};
const wallet=()=>(window as unknown as {ethereum?:Wallet}).ethereum;
const money=(v:string)=>(Number(v)/1e6).toLocaleString(undefined,{maximumFractionDigits:4});
const key='quorum.sepolia.swap.receipt', pendingKey='quorum.sepolia.swap.pending';
export function TestnetSwap(){
 const [address,setAddress]=useState(''),[amount,setAmount]=useState('0.001'),[quote,setQuote]=useState<Prepared|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[hash,setHash]=useState(()=>localStorage.getItem(key)??'');
 const [pending,setPending]=useState(()=>Boolean(localStorage.getItem(pendingKey))),[recoveryHash,setRecoveryHash]=useState('');
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await action();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}};
 const connect=async()=>{
  const w=wallet();if(!w)throw Error('Open this site in an EVM wallet browser, or a browser with a wallet extension.');
  await w.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xaa36a7'}]});
  const accounts=await w.request({method:'eth_requestAccounts'});if(!accounts[0])throw Error('No wallet account selected.');
  setAddress(accounts[0]);setQuote(null);return accounts[0] as string;
 };
 const prepare=async()=>{
  if(pending)throw Error('Check your previous swap before submitting another.');
  const current=await connect();
  if(!/^0\.\d{1,5}$/.test(amount)||Number(amount)<.00001||Number(amount)>.01)throw Error('Choose 0.00001–0.01 Sepolia ETH, up to five decimals.');
  const amountWei=(BigInt(amount.split('.')[1].padEnd(18,'0'))).toString();
  const response=await fetch((import.meta.env.VITE_AGENT_URL??'')+'/api/testnet-swap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:current,amountWei}),signal:AbortSignal.timeout(45000)});
  const q=await response.json();if(!response.ok)throw Error(q.message??q.error??'Testnet quote unavailable.');setQuote(q);
 };
 const check=async()=>{
  const w=wallet();if(!w)throw Error('Connect your EVM wallet to check this receipt.');
  if(await w.request({method:'eth_chainId'})!=='0xaa36a7')throw Error('Switch your wallet to Ethereum Sepolia.');
  const target=recoveryHash||hash;
  if(!/^0x[0-9a-fA-F]{64}$/.test(target))throw Error('Enter the transaction hash from your wallet history.');
  const stored=localStorage.getItem(pendingKey);
  if(stored){
   const expected=JSON.parse(stored),sent=await w.request({method:'eth_getTransactionByHash',params:[target]});
   if(!sent||sent.from.toLowerCase()!==expected.from.toLowerCase()||sent.to?.toLowerCase()!==expected.to.toLowerCase()||sent.input!==expected.data||BigInt(sent.value)!==BigInt(expected.value))throw Error('This receipt does not match the pending swap.');
  }
  const r=await w.request({method:'eth_getTransactionReceipt',params:[target]});
  if(r){setHash(target);localStorage.setItem(key,target);localStorage.removeItem(pendingKey);setPending(false);setRecoveryHash('');}
  setMessage(!r?'Transaction pending. Check again shortly.':r.status==='0x1'?'Swap confirmed on Sepolia. Test USDC was sent to the signing wallet.':'Transaction reverted. No swap completed; gas may have been spent.');
 };
 const execute=async()=>{
  const w=wallet();if(!w||!quote)throw Error('Request a new quote first.');
  if(Date.now()>=quote.expiresAt){setQuote(null);throw Error('Quote expired. Request a new quote.');}
  const [chain,accounts]=await Promise.all([w.request({method:'eth_chainId'}),w.request({method:'eth_accounts'})]);
  if(chain!=='0xaa36a7'||accounts[0]?.toLowerCase()!==quote.transaction.from.toLowerCase()){setQuote(null);throw Error('Wallet or network changed. Request a new quote.');}
  const {chainId:_,...tx}=quote.transaction;
  const [gas,price,balance]=await Promise.all([w.request({method:'eth_estimateGas',params:[tx]}),w.request({method:'eth_gasPrice'}),w.request({method:'eth_getBalance',params:[tx.from,'pending']})]);
  const gasLimit=BigInt(gas)*120n/100n,gasPrice=BigInt(price);
  if(gasLimit>500000n||gasLimit*gasPrice>1000000000000000n)throw Error('Estimated gas exceeds the demo limit. Try later.');
  if(BigInt(balance)<BigInt(tx.value)+gasLimit*gasPrice)throw Error('Insufficient Sepolia ETH for the swap and gas.');
  if(Date.now()>=quote.expiresAt){setQuote(null);throw Error('Quote expired during simulation. Request a new quote.');}
  setQuote(null); // A second click cannot reuse this prepared request.
  setMessage('Review the Sepolia swap in your wallet.');
  const [lastChain,lastAccounts]=await Promise.all([w.request({method:'eth_chainId'}),w.request({method:'eth_accounts'})]);
  if(lastChain!=='0xaa36a7'||lastAccounts[0]?.toLowerCase()!==tx.from.toLowerCase())throw Error('Wallet changed. Request a new quote.');
  localStorage.setItem(pendingKey,JSON.stringify(tx));setPending(true);
  let txHash:string;
  try{txHash=await w.request({method:'eth_sendTransaction',params:[{...tx,gas:'0x'+gasLimit.toString(16),gasPrice:'0x'+gasPrice.toString(16)}]});}
  catch(e){if((e as {code?:number}).code===4001){localStorage.removeItem(pendingKey);setPending(false);throw Error('Swap declined in wallet. Nothing submitted by this app.');}throw Error('Submission status unknown. Check your wallet history and paste its transaction hash below before trying again.');}
  setHash(txHash);localStorage.setItem(key,txHash);setMessage('Submitted to Sepolia. Check the receipt for confirmation.');
 };
 return <details className="testnet-swap"><summary>Execute a testnet swap <span>Uniswap ↗</span></summary><div className="testnet-swap-body">
 <div className="conversion-top"><span>Ethereum Sepolia · no cash value</span><span>Your wallet signs</span></div>
 <h4>Test ETH → test USDC</h4><p>Separate EVM wallet funds. This does not move Hedera aUSDd or your cover payout.</p>
 <label>Spend Sepolia ETH<input inputMode="decimal" value={amount} disabled={busy} onChange={e=>{setAmount(e.target.value);setQuote(null);}}/></label>
 <button className="chip" disabled={busy||pending} onClick={()=>void run(prepare)}>{busy?'Working…':address?'Get live swap quote':'Connect wallet & quote →'}</button>
 {quote?<><div className="conversion-amounts"><div><strong>{amount}</strong><span>Sepolia ETH</span></div><span>→</span><div><strong>{money(quote.amountOut)}</strong><span>test USDC</span></div></div><small>Minimum {money(quote.minimumOut)} USDC · 0.5% slippage · gas extra</small><button className="buy" disabled={busy} onClick={()=>void run(execute)}>Review & swap in wallet →</button></>:null}
 {message?<p role="status">{message}</p>:null}
 {pending?<div><p>A previous swap needs confirmation before another can be sent.</p><label>Transaction hash from wallet history<input value={recoveryHash} onChange={e=>setRecoveryHash(e.target.value)} placeholder="0x…"/></label><button className="text-button" disabled={busy} onClick={()=>void run(check)}>Check pending swap ↻</button></div>:null}
 {hash?<div className="testnet-swap-receipt"><a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">Latest swap receipt ↗</a><button className="text-button" disabled={busy} onClick={()=>void run(check)}>Check confirmation ↻</button></div>:null}
 <details><summary>Funds & execution details</summary><p>The app requests Uniswap API calldata. Your wallet simulates, signs and sends it. Native ETH input needs no token approval. The server holds no EVM signing key.</p><p>Need test funds? Use a Sepolia faucet for your wallet. Never send mainnet funds to this test.</p><a href="https://ethereum.org/en/developers/docs/networks/#sepolia" target="_blank" rel="noreferrer">Sepolia network & faucets ↗</a></details>
 </div></details>;
}
