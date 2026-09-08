import {useEffect,useRef,useState} from 'react';
import proof from '../../../docs/evidence/uniswap-liquidity.json';
import {DemoLiquidity} from './DemoEvm';

const BASE=import.meta.env.VITE_AGENT_URL??'', CHAIN='0xaa36a7';
const MANAGER='0x1238536071e1c677a632429e3655c799b22cda52';
const TOKENS=['0x1c7d4b196cb0c7b01d743fbc6116a902379c7238','0x5685b5660a86028d8a50c9e4fc33ff081b3cd9e9'];
const STORE='quorum.uniswap.lp.pending', RECEIPTS='quorum.uniswap.lp.receipts';
type Tx={from:string;to:string;data:string;value:string;chainId:string};
type Action='create'|'increase'|'collect'|'remove';
type Position={tokenId:string;owner:string;liquidity:string;amount0:string;amount1:string;claimable0:string;claimable1:string;inRange:boolean;supported:boolean};
type Market={pool:string;manager:string;balance0:string;balance1:string;price0Per1:number;feePercent:number;seed:Position;seedImage?:string|null;block:number;checkedAt:string};
type Account={address:string;positions:Position[];balance0:string;balance1:string;nextCursor:string|null;checkedAt:string};
type Draft={action:Action;tokenId:string|null;amount0:string;amount1:string;approvals:{token:string;amount:string;transaction:Tx}[];transaction:Tx;expiresAt:number};
type Pending={id:string;kind:Action|'approval';transaction:Tx;nonce:string;hash?:string;tokenId?:string|null};
type Receipt={hash:string;kind:string;tokenId?:string|null;address:string;success:boolean};
type Wallet={request:(p:{method:string;params?:unknown[]})=>Promise<any>;on?:(event:string,cb:()=>void)=>void;removeListener?:(event:string,cb:()=>void)=>void};
const wallet=()=>(window as unknown as {ethereum?:Wallet}).ethereum;
const n=(v:string)=>(Number(v)/1e6).toLocaleString(undefined,{maximumFractionDigits:6});
const short=(v:string)=>`${v.slice(0,6)}…${v.slice(-4)}`;
const nft=(id:string)=>`https://sepolia.etherscan.io/nft/${MANAGER}/${id}`;
const labels:Record<string,string>={create:'Position created',increase:'Liquidity added',collect:'Tokens collected',remove:'Liquidity removed',approval:'Token approval'};
function stored<T>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem(key)??'null')??fallback;}catch{return fallback;}}
async function api<T>(path:string,body?:unknown):Promise<T> {
  const r=await fetch(`${BASE}/api/liquidity/${path}`,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(35000)});
  const value=await r.json().catch(()=>{throw Error('Liquidity service unavailable. Try refreshing.');});if(!r.ok)throw Error(value.message??'Liquidity service unavailable.');return value;
}

export function SwapLiquidity({managed=false}:{managed?:boolean}){
  const [market,setMarket]=useState<Market|null>(null),[marketError,setMarketError]=useState(''),[loadingMarket,setLoadingMarket]=useState(false);
  const [open,setOpen]=useState(()=>Boolean(stored(STORE,null))),[account,setAccount]=useState<Account|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [selected,setSelected]=useState('new'),[mode,setMode]=useState<'add'|'collect'|'remove'>('add'),[amount,setAmount]=useState('0.01'),[percentage,setPercentage]=useState(100),[draft,setDraft]=useState<Draft|null>(null);
  const [pending,setPending]=useState<Pending|null>(()=>stored(STORE,null)),[recovery,setRecovery]=useState('');
  const [receipts,setReceipts]=useState<Receipt[]>(()=>stored(RECEIPTS,[]));
  const epoch=useRef(0),mounted=useRef(true);
  const position=account?.positions.find(p=>p.tokenId===selected),adding=mode==='add';
  const blocked=busy||Boolean(pending);
  async function refreshMarket(){setLoadingMarket(true);try{const m=await api<Market>('market');if(mounted.current){setMarket(m);setMarketError('');}}catch(e){if(mounted.current){setMarket(null);setMarketError((e as Error).message);}}finally{if(mounted.current)setLoadingMarket(false);}}
  useEffect(()=>{mounted.current=true;void refreshMarket();return()=>{mounted.current=false;epoch.current++;};},[]);
  useEffect(()=>{
    const w=wallet();
    const changed=()=>{epoch.current++;setAccount(null);setDraft(null);setSelected('new');setMessage('Wallet changed. Reconnect to refresh your positions.');};
    const sync=()=>{setPending(stored(STORE,null));setReceipts(stored(RECEIPTS,[]));setDraft(null);};
    w?.on?.('accountsChanged',changed);w?.on?.('chainChanged',changed);window.addEventListener('storage',sync);
    return()=>{w?.removeListener?.('accountsChanged',changed);w?.removeListener?.('chainChanged',changed);window.removeEventListener('storage',sync);};
  },[]);
  const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setMessage('');try{await fn();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}};
  async function identity(expected?:string){
    const w=wallet();if(!w)throw Error('Use an EVM wallet extension or open this page in your wallet browser.');
    if(await w.request({method:'eth_chainId'})!==CHAIN)throw Error('Switch your wallet to Ethereum Sepolia.');
    const accounts=await w.request({method:'eth_accounts'}),address=accounts[0]?.toLowerCase();
    if(!address||(expected&&address!==expected.toLowerCase()))throw Error('Connect the wallet that owns this position.');
    return {w,address};
  }
  async function refreshAccount(address:string,cursor?:string){
    const version=epoch.current,data=await api<Account>(`wallet?address=${encodeURIComponent(address)}${cursor?`&cursor=${cursor}`:''}`);
    await identity(address);if(version!==epoch.current)throw Error('Wallet changed. Reconnect.');
    setAccount(previous=>({...data,positions:cursor&&previous?.address===address?[...previous.positions,...data.positions]:data.positions}));
    return data;
  }
  async function connect(){
    const w=wallet();if(!w)throw Error('Use an EVM wallet extension or open this page in your wallet browser.');
    await w.request({method:'wallet_switchEthereumChain',params:[{chainId:CHAIN}]});
    await w.request({method:'eth_requestAccounts'});const {address}=await identity();
    const data=await refreshAccount(address);setSelected(data.positions.find(p=>p.tokenId!==market?.seed?.tokenId&&BigInt(p.liquidity)>0n)?.tokenId??'new');setDraft(null);
  }
  function invalidate(){setDraft(null);setMessage('');}
  async function review(){
    if(localStorage.getItem(STORE))throw Error('Confirm the pending transaction first.');
    if(!account)throw Error('Connect your Sepolia wallet.');
    await identity(account.address);
    if(adding&&(!/^\d+(\.\d{1,2})?$/.test(amount)||Number(amount)<.01||Number(amount)>1))throw Error('Choose 0.01–1 aUSDd, up to two decimals.');
    const action:Action=adding?(selected==='new'?'create':'increase'):mode;
    const version=epoch.current;
    const next=await api<Draft>('prepare',{address:account.address,action,...(action==='create'?{}:{tokenId:selected}),...(adding?{amountUnits:String(Math.round(Number(amount)*1e6))}:mode==='remove'?{percentage}:{})});
    await identity(account.address);if(version!==epoch.current)throw Error('Wallet changed. Review again.');
    setDraft(next);
  }
  async function submit(){
    if(!draft||Date.now()>=draft.expiresAt)throw Error('Review expired. Refresh the amounts before signing.');
    // Cross-tab exclusion covers the wallet prompt and journal write.
    const send=async()=>{
      if(localStorage.getItem(STORE))throw Error('A liquidity transaction is awaiting confirmation.');
      const approval=draft.approvals[0],transaction=approval?.transaction??draft.transaction,kind=approval?'approval':draft.action;
      const {w,address}=await identity(transaction.from);
      if(transaction.chainId!==CHAIN||BigInt(transaction.value)!==0n||transaction.to.toLowerCase()!==(approval?approval.token:MANAGER))throw Error('Unexpected transaction target.');
      if(approval){
        const expected='0x095ea7b3'+MANAGER.slice(2).padStart(64,'0')+BigInt(approval.amount).toString(16).padStart(64,'0');
        if(!TOKENS.includes(approval.token)||BigInt(approval.amount)<=0n||BigInt(approval.amount)>1000000n||transaction.data.toLowerCase()!==expected)throw Error('Unexpected token approval.');
      }
      if(draft.tokenId){
        const owner=await w.request({method:'eth_call',params:[{to:MANAGER,data:'0x6352211e'+BigInt(draft.tokenId).toString(16).padStart(64,'0')},'latest']});
        if('0x'+owner.slice(-40).toLowerCase()!==address)throw Error('This wallet no longer owns the position.');
      }
      const {chainId:_,...tx}=transaction;
      const gas=BigInt(await w.request({method:'eth_estimateGas',params:[tx]}))*120n/100n;
      const gasPrice=BigInt(await w.request({method:'eth_gasPrice'}))*120n/100n;
      if(gas>1000000n||gas*gasPrice>2000000000000000n)throw Error('Gas exceeds the testnet limit. Try again later.');
      const nonce=await w.request({method:'eth_getTransactionCount',params:[address,'pending']});
      await identity(address);if(Date.now()>=draft.expiresAt)throw Error('Review expired. Refresh before signing.');
      const record:Pending={id:crypto.randomUUID(),kind,transaction,nonce,tokenId:draft.tokenId};
      localStorage.setItem(STORE,JSON.stringify(record));setPending(record);setOpen(true);
      try{
        record.hash=await w.request({method:'eth_sendTransaction',params:[{...tx,nonce,gas:'0x'+gas.toString(16),gasPrice:'0x'+gasPrice.toString(16)}]});
        localStorage.setItem(STORE,JSON.stringify(record));setPending({...record});setDraft(null);setMessage('Submitted on Sepolia. Check confirmation to continue.');
      }catch(e){
        if((e as {code?:number}).code===4001){localStorage.removeItem(STORE);setPending(null);throw Error('Declined in wallet.');}
        throw Error('Submission unknown. Find its hash in wallet history and check it here before trying again.');
      }
    };
    if(navigator.locks)await navigator.locks.request('quorum.uniswap.lp',send);else await send();
  }
  async function check(){
    const record=stored<Pending|null>(STORE,null);if(!record)return;
    const {w}=await identity(record.transaction.from),hash=recovery.trim()||record.hash;
    if(!hash||!/^0x[0-9a-f]{64}$/i.test(hash))throw Error('Enter the transaction hash from wallet history.');
    const sent=await w.request({method:'eth_getTransactionByHash',params:[hash]}),tx=record.transaction;
    if(!sent||sent.from?.toLowerCase()!==tx.from.toLowerCase()||sent.to?.toLowerCase()!==tx.to.toLowerCase()||sent.input?.toLowerCase()!==tx.data.toLowerCase()||BigInt(sent.value)!==0n||BigInt(sent.nonce)!==BigInt(record.nonce))throw Error('This hash does not match the saved operation.');
    const result=await w.request({method:'eth_getTransactionReceipt',params:[hash]});
    if(!result){setMessage('Still awaiting confirmation on Sepolia.');return;}
    let tokenId=record.tokenId;
    if(result.status==='0x1'&&record.kind==='create'){
      const mint=result.logs.find((l:{address:string;topics:string[]})=>l.address.toLowerCase()===MANAGER&&l.topics[0]==='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'&&BigInt(l.topics[1])===0n&&'0x'+l.topics[2].slice(-40).toLowerCase()===tx.from.toLowerCase());
      if(!mint)throw Error('Receipt is missing the expected position NFT. Keep this transaction for verification.');
      tokenId=BigInt(mint.topics[3]).toString();
    }
    const list=[{hash,kind:record.kind,tokenId,address:tx.from.toLowerCase(),success:result.status==='0x1'},...stored<Receipt[]>(RECEIPTS,[]).filter(r=>r.hash!==hash)].slice(0,12);
    localStorage.setItem(RECEIPTS,JSON.stringify(list));localStorage.removeItem(STORE);setReceipts(list);setPending(null);setRecovery('');setDraft(null);
    setMessage(result.status==='0x1'?`${labels[record.kind]} on Sepolia.${record.kind==='approval'?' Review again to continue.':''}`:'Transaction reverted. Gas was spent; the liquidity action did not complete.');
    try{await refreshAccount(tx.from.toLowerCase());if(tokenId)setSelected(tokenId);await refreshMarket();}catch{setAccount(null);setMessage('Receipt saved. Reconnect to refresh your on-chain balances.');}
  }
  const userReceipts=receipts.filter(r=>r.address===account?.address);
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
    {pending&&!open&&!managed?<button className="liquidity-resume chip" onClick={()=>setOpen(true)}>Transaction pending · Check confirmation →</button>:null}
    <div id="liquidity-controls" hidden={!open} className="liquidity-controls">
      {managed?<DemoLiquidity/>:<>
      <div className="liquidity-account-bar"><h3>Your Uniswap position</h3>{account?<><a href={`https://sepolia.etherscan.io/address/${account.address}`} target="_blank" rel="noreferrer">{short(account.address)} ↗</a><button className="text-button" disabled={busy} onClick={()=>void run(async()=>{await refreshAccount(account.address);setDraft(null);})}>Refresh wallet ↻</button></>:<button className="chip" disabled={busy} onClick={()=>void run(connect)}>{busy?'Connecting…':'Connect Sepolia wallet →'}</button>}</div>
      {account?<div className="liquidity-manage-grid"><div className="liquidity-position">
        <label>Position<select value={selected} disabled={blocked} onChange={e=>{setSelected(e.target.value);setMode('add');invalidate();}}><option value="new">Create a new position NFT</option>{account.positions.map(p=><option key={p.tokenId} value={p.tokenId}>NFT #{p.tokenId}{BigInt(p.liquidity)===0n?' · removed':''}</option>)}</select></label>
        {account.nextCursor?<button className="text-button" disabled={busy} onClick={()=>void run(async()=>{await refreshAccount(account.address,account.nextCursor!);})}>Load more wallet positions →</button>:null}
        {position?<><div className="liquidity-position-top"><strong>NFT #{position.tokenId}</strong><a href={nft(position.tokenId)} target="_blank" rel="noreferrer">Verify position ↗</a></div><div className="liquidity-position-values"><div><span>In position</span><strong>{n(position.amount1)} aUSDd</strong><strong>{n(position.amount0)} test USDC</strong></div><div><span>Uncollected</span><strong className="liquidity-earned">{n(position.claimable1)} aUSDd</strong><strong className="liquidity-earned">{n(position.claimable0)} test USDC</strong></div></div><small>{BigInt(position.liquidity)===0n?'Liquidity removed · NFT retained':position.inRange?'In range · earning from swaps':'Out of range'}</small>{!position.supported?<p>Manage this custom range through another Uniswap interface. Quorum supports full-range positions.</p>:null}</>:<div className="liquidity-new-position"><span aria-hidden="true">∞</span><strong>Full-range liquidity</strong><p>Two tokens in. A real Uniswap position NFT for you.</p></div>}
      </div><div className="liquidity-actions">
        <div className="liquidity-action-tabs" role="group" aria-label="Position action">{(['add','collect','remove'] as const).map(action=><button key={action} aria-pressed={mode===action} disabled={blocked||(action!=='add'&&!position)} onClick={()=>{setMode(action);invalidate();}}>{action==='add'?'Add liquidity':action==='collect'?'Collect fees':'Remove'}</button>)}</div>
        {adding?<label>Add bridged aUSDd<input value={amount} inputMode="decimal" disabled={blocked} onChange={e=>{setAmount(e.target.value);invalidate();}}/><small>0.01–1 aUSDd + matching test USDC</small></label>:mode==='remove'?<label>Remove from this position<select value={percentage} disabled={blocked} onChange={e=>{setPercentage(Number(e.target.value));invalidate();}}>{[25,50,100].map(p=><option key={p} value={p}>{p}%{p===100?' · exit position':''}</option>)}</select><small>Returns both tokens and uncollected fees to your wallet.</small></label>:<p>Collect accrued tokens into your Sepolia wallet. Liquidity stays in the pool.</p>}
        <small className="liquidity-wallet-balance">Wallet · {n(account.balance1)} aUSDd · {n(account.balance0)} test USDC</small>
        {!draft?<button className="buy" disabled={blocked||(Boolean(position)&&!position?.supported)||(mode==='remove'&&position?.liquidity==='0')||(mode==='collect'&&position?.claimable0==='0'&&position?.claimable1==='0')} onClick={()=>void run(review)}>{busy?'Checking on-chain…':mode==='add'?'Review liquidity →':mode==='remove'?'Review withdrawal →':'Review collection →'}</button>:<div className="liquidity-review"><span>{adding?'You provide':mode==='remove'?'Estimated principal returned':'Available to collect'}</span><strong>{n(draft.amount1)} aUSDd <span>+</span> {n(draft.amount0)} test USDC</strong><small>{mode==='collect'?'Sepolia gas extra':'0.5% slippage · Sepolia gas extra'}</small><button className="buy" disabled={blocked} onClick={()=>void run(submit)}>{draft.approvals[0]?`Approve ${n(draft.approvals[0].amount)} ${draft.approvals[0].token===TOKENS[0]?'test USDC':'aUSDd'} →`:draft.action==='create'?'Create position NFT →':draft.action==='increase'?'Add liquidity →':draft.action==='remove'?'Withdraw to wallet →':'Collect to wallet →'}</button><button className="text-button" disabled={blocked} onClick={()=>void run(review)}>Refresh review ↻</button></div>}
      </div></div>:<p className="liquidity-connect-note">Use the Sepolia wallet that received your bridged tokens. You need both tokens and test ETH for gas.</p>}
      {pending?<div className="liquidity-pending" role="status"><strong>{pending.kind==='approval'?'Token approval':'Liquidity transaction'} awaiting confirmation</strong><small>Wallet {short(pending.transaction.from)} · Ethereum Sepolia</small>{pending.hash?<a href={`https://sepolia.etherscan.io/tx/${pending.hash}`} target="_blank" rel="noreferrer">View pending transaction ↗</a>:<label>Transaction hash from wallet history<input value={recovery} onChange={e=>setRecovery(e.target.value)} placeholder="0x…"/></label>}<button className="chip" disabled={busy} onClick={()=>void run(check)}>Check confirmation ↻</button></div>:null}
      {message?<p className="liquidity-message" role="status">{message}</p>:null}
      {userReceipts.length?<details className="liquidity-receipts"><summary>Your liquidity receipts <span>↗</span></summary>{userReceipts.map(r=><a key={r.hash} href={`https://sepolia.etherscan.io/tx/${r.hash}`} target="_blank" rel="noreferrer">{r.success?labels[r.kind]:'Reverted transaction'}{r.tokenId?` · #${r.tokenId}`:''} ↗</a>)}</details>:null}
      <details className="liquidity-explainer"><summary>What earns fees? <span>+</span></summary><p>Swaps pay a 0.3% pool fee. Your position accrues its share while in range. Actual fees depend on trading activity; this is not an APY or insurance premium income.</p><p>Full-range positions can change their token mix as the market moves. Removing liquidity returns the position’s current tokens, not a guaranteed original deposit. “Uncollected” includes fees and any principal previously removed without collection.</p><p>Your wallet signs exact token approvals and each action. Quorum pins Sepolia, this pool, its tokens and the position owner. No ARPS, policy reserves or mainnet funds are used.</p></details>
      </>}
    </div>
  </section>;
}
