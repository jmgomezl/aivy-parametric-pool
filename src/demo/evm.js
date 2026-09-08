// Frictionless, explicitly custodial Sepolia demo. No arbitrary signing API.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Contract,FetchRequest,Interface,JsonRpcProvider,Transaction,Wallet,keccak256} from 'ethers';
import {evmStore,EVM_LIMITS,evmError,checkRequest} from './evm-store.js';
import {withIssuanceLock} from '../issuance-lock.js';
import {createBridgedSwap,BRIDGED_TOKEN,PERMIT2} from '../settlement/bridgedSwap.js';
import {SWAP_ROUTER,SWAP_USDC} from '../settlement/testnetSwap.js';
import {LP_MANAGER,lpInput,lpInterface} from '../settlement/liquidity.js';
import {bridgeStatus,ITS} from '../settlement/bridge.js';

const CHAIN=11155111, FUNDER='0x18c5e6987a734638403bbd942e17d959952b8e4e';
const TOKENS=[SWAP_USDC,BRIDGED_TOKEN];
const erc20=new Interface(['function transfer(address to,uint256 amount) returns(bool)','function approve(address spender,uint256 amount) returns(bool)','function allowance(address,address) view returns(uint256)','function balanceOf(address) view returns(uint256)']);
const txFor=(from,to,data='0x',value='0x0')=>({from,to,data,value,chainId:'0xaa36a7'});
const pendingError=()=>evmError(409,'Waiting for the original transaction. Continue this operation to check it again.');
function fields(raw,allowed){if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!allowed.includes(k)))throw evmError(400,'Unsupported demo wallet request.');}

export function createEvmDemo({network,liquidity,demo,store=evmStore(),provider,funder,now=Date.now}={}){
  if(!provider){const request=new FetchRequest('https://ethereum-sepolia-rpc.publicnode.com');request.timeout=12000;provider=new JsonRpcProvider(request,CHAIN,{staticNetwork:true});}
  const configFile=path.join(store.directory,'sepolia-demo-funder.json');
  const swaps=createBridgedSwap(),quotes=new Map(),jobs=new Map(),views=new Map();
  let chainChecked=false;
  function enabled(){if(network!=='testnet')throw evmError(403,'Managed wallets are Sepolia testnet only.');if(!funder&&!fs.existsSync(configFile))throw evmError(503,'Demo wallets are being prepared. Retry shortly; verified examples remain available.');}
  function sponsor(){enabled();if(!funder){const c=JSON.parse(fs.readFileSync(configFile));if(c.chainId!==CHAIN)throw Error('Invalid sponsor network.');funder=new Wallet(c.privateKey,provider);}if(funder.address.toLowerCase()!==FUNDER)throw Error('Unexpected sponsor identity.');return funder;}
  async function chain(){enabled();if(!chainChecked){if(BigInt(await provider.send('eth_chainId',[]))!==BigInt(CHAIN))throw Error('RPC is not Sepolia.');chainChecked=true;}}
  const lock=(name,fn)=>withIssuanceLock('evm-'+name,fn,{directory:store.directory,timeoutMs:name==='sponsor'?90000:2000});
  const getWallet=wid=>{const w=store.read().wallets[wid];if(!w)throw Error('Missing wallet.');return w;};
  const getScope=(wid,rid)=>{const w=getWallet(wid);return rid?w.actions.find(a=>a.requestId===rid):w;};
  const patchScope=(wid,rid,fn)=>store.patch(wid,w=>fn(rid?w.actions.find(a=>a.requestId===rid):w));
  const checkpoint=(wid,rid,name,patch)=>patchScope(wid,rid,s=>{s.steps[name]={...s.steps[name],...patch};});
  function updateMessage(wid,rid,message){patchScope(wid,rid,s=>s.message=message);}
  function publicSteps(steps){return Object.entries(steps).map(([name,s])=>({name,hash:s.hash,status:s.status}));}
  function publicAction(a){return {requestId:a.requestId,kind:a.kind,action:a.input?.action,status:a.status,message:a.message,at:a.at,steps:publicSteps(a.steps),result:a.result??null};}

  async function receipt(wid,rid,name,signer){
    const saved=getScope(wid,rid).steps[name];if(!saved)return null;
    const decoded=Transaction.from(saved.raw);
    if(decoded.hash!==saved.hash||decoded.chainId!==BigInt(CHAIN)||decoded.from.toLowerCase()!==signer.address.toLowerCase())throw Error('Signed transaction journal mismatch.');
    let r=await provider.getTransactionReceipt(saved.hash);
    if(!r){
      if(!await provider.getTransaction(saved.hash)){
        // Explicit continuation may rebroadcast identical signed bytes, never a new nonce.
        try{await provider.broadcastTransaction(saved.raw);}catch{/* The original hash is the only authority. */}
      }
      try{r=await provider.waitForTransaction(saved.hash,1,45000);}catch{throw pendingError();}
    }
    if(!r)throw pendingError();
    checkpoint(wid,rid,name,{status:r.status===1?'confirmed':'reverted'});
    if(r.status!==1)throw evmError(400,'Transaction reverted. Its receipt is saved; no replacement was sent.');
    return r;
  }

  // Only internally constructed and validated operations reach this function.
  async function send(wid,rid,name,transaction,{funding=false}={}){
    await chain();
    const w=getWallet(wid),signer=funding?sponsor():new Wallet(w.privateKey,provider);
    if(getScope(wid,rid).steps[name])return receipt(wid,rid,name,signer);
    if(transaction.chainId!=='0xaa36a7'||transaction.from.toLowerCase()!==signer.address.toLowerCase())throw Error('Signing identity mismatch.');
    if(funding){
      if(transaction.to.toLowerCase()===w.address){if(transaction.data!=='0x'||BigInt(transaction.value)<=0n||BigInt(transaction.value)>BigInt(EVM_LIMITS.transactionGasWei)+100000000000000n)throw Error('Invalid gas allocation.');}
      else{
        const p=erc20.parseTransaction(transaction);
        if(!TOKENS.includes(transaction.to.toLowerCase())||BigInt(transaction.value)!==0n||p?.name!=='transfer'||p.args.to.toLowerCase()!==w.address||p.args.amount!==BigInt(EVM_LIMITS.starterTokenUnits)||erc20.encodeFunctionData(p.fragment,p.args)!==transaction.data)throw Error('Invalid starter token transfer.');
      }
    }else if(BigInt(transaction.value)!==0n||![LP_MANAGER,SWAP_ROUTER,...TOKENS,ITS.toLowerCase()].includes(transaction.to.toLowerCase()))throw Error('Unsupported managed transaction.');
    const {chainId,from,...tx}=transaction;
    const gas=(await provider.estimateGas({...tx,from:signer.address}))*120n/100n;
    const gasPrice=(await provider.getFeeData()).gasPrice*120n/100n,fee=gas*gasPrice;
    if(gas>1000000n||fee>BigInt(EVM_LIMITS.transactionGasWei))throw evmError(400,'Network gas exceeds the demo limit. Try again when fees fall.');
    if(!funding){
      const spent=Object.values(w.steps).concat(w.actions.flatMap(a=>Object.values(a.steps))).filter(s=>s.from===w.address).reduce((n,s)=>n+BigInt(s.gasBudget??0),0n);
      const exit=rid&&getScope(wid,rid).input?.action==='remove';
      const budget=BigInt(EVM_LIMITS.walletGasWei)-(exit?0n:1000000000000000n);
      if(spent+fee>budget)throw evmError(429,exit?'This wallet’s gas allowance is used. Your position is preserved; contact the demo operator.':'Activity gas allowance used. The remaining allowance is reserved for withdrawing liquidity.');
      const balance=await provider.getBalance(w.address);
      if(balance<fee){
        const amount=fee-balance+50000000000000n;
        await lock('sponsor',()=>send(wid,rid,'gas-'+name,txFor(sponsor().address,w.address,'0x','0x'+amount.toString(16)),{funding:true}));
      }
    }else{
      const cost=fee+BigInt(transaction.value);
      if(await provider.getBalance(signer.address)<cost+BigInt(EVM_LIMITS.sponsorReserveWei))throw evmError(503,'Demo gas reserve needs a refill. Existing receipts and positions are safe.');
      store.sponsorReserve(`${wid}:${rid??'starter'}:${name}`,cost,now());
    }
    const [nonce,pendingNonce]=await Promise.all([provider.getTransactionCount(signer.address,'latest'),provider.getTransactionCount(signer.address,'pending')]);
    if(nonce!==pendingNonce)throw pendingError();
    const raw=await signer.signTransaction({...tx,chainId:CHAIN,nonce,gasLimit:gas,gasPrice,type:0});
    const hash=keccak256(raw);
    checkpoint(wid,rid,name,{raw,hash,status:'signed',from:signer.address.toLowerCase(),nonce,gasBudget:String(fee),at:now()});
    try{await provider.broadcastTransaction(raw);checkpoint(wid,rid,name,{status:'submitted'});}catch{throw pendingError();}
    return receipt(wid,rid,name,signer);
  }
  async function initialize(wid){
    for(const [name,token]of [['test-USDC',SWAP_USDC],['aUSDd',BRIDGED_TOKEN]]){
      updateMessage(wid,null,`Funding ${name} on Sepolia`);
      await lock('sponsor',()=>send(wid,null,'starter-'+name,txFor(sponsor().address,token,erc20.encodeFunctionData('transfer',[getWallet(wid).address,EVM_LIMITS.starterTokenUnits])),{funding:true}));
    }
    updateMessage(wid,null,'Sponsoring testnet gas');
    await lock('sponsor',()=>send(wid,null,'starter-gas',txFor(sponsor().address,getWallet(wid).address,'0x','0x'+BigInt(EVM_LIMITS.starterGasWei).toString(16)),{funding:true}));
    store.patch(wid,w=>{w.status='ready';w.message='Demo wallet ready';});
  }
  function launch(wid,rid,work){
    const key=wid;if(jobs.has(key))return;
    const job=lock('wallet-'+wid,work).catch(error=>{
      const scope=getScope(wid,rid),uncertain=Object.entries(scope.steps).some(([name,s])=>['signed','submitted'].includes(s.status)||(['swap','liquidity','delivery'].includes(name)&&s.status==='confirmed'));
      patchScope(wid,rid,s=>{s.message=error.status?error.message:'Demo operation interrupted. Continue the original request to reconcile its receipts.';if(rid&&!uncertain)s.status='failed';});
    }).finally(()=>jobs.delete(key));
    jobs.set(key,job);
  }
  async function delivery(id,bridgeRequestId){
    const w=store.wallet(id),a=demo.store.account(id).actions.find(a=>a.requestId===bridgeRequestId);
    if(!a||a.kind!=='bridge'||a.recipient?.toLowerCase()!==w.address)throw evmError(400,'This bridge does not belong to your demo wallet.');
    const status=await bridgeStatus(a);
    if(!['delivered','ready-to-deliver'].includes(status.status))throw evmError(409,'Axelar is still approving the delivery. Check again shortly.');
    return status;
  }
  async function finish(wid,rid,result){views.delete(getWallet(wid).address);patchScope(wid,rid,a=>{a.status='complete';a.result=result;a.message='Confirmed on Sepolia';});}
  async function action(id,rid){
    const w=store.wallet(id),a=w.actions.find(a=>a.requestId===rid);if(!a||a.status!=='pending')return;
    const signer=new Wallet(w.privateKey,provider),mainName=a.kind==='swap'?'swap':a.kind==='lp'?'liquidity':'delivery';
    // Reconcile every signed stage before checking allowances or rebuilding quotes.
    for(const [name,s]of Object.entries(a.steps))if(['signed','submitted'].includes(s.status)&&name!==mainName){
      if(s.from===w.address)await receipt(w.id,rid,name,signer);
      else await lock('sponsor',()=>receipt(w.id,rid,name,sponsor()));
    }
    // A receipt for the final step settles the operation before any new API request.
    if(a.steps[mainName]){const r=await receipt(w.id,rid,mainName,signer);return completeReceipt(w.id,a,r);}
    if(a.kind==='swap'){
      let draft=await swaps.prepare({address:w.address,amountUnits:a.input.amountUnits});
      if(BigInt(draft.minimumOut)<BigInt(a.limits.minimumOut))throw evmError(400,'Price changed beyond your reviewed minimum. Request a fresh quote.');
      const token=new Contract(BRIDGED_TOKEN,erc20,provider);
      if(await token.allowance(w.address,PERMIT2)<BigInt(a.input.amountUnits)){
        updateMessage(w.id,rid,'Approving the exact aUSDd amount');await send(w.id,rid,'approve-aUSDd',draft.approval);
        draft=await swaps.prepare({address:w.address,amountUnits:a.input.amountUnits});
        if(BigInt(draft.minimumOut)<BigInt(a.limits.minimumOut))throw evmError(400,'Price moved. Approval is confirmed; review a new swap quote.');
      }
      const signature=draft.permit?await signer.signTypedData(draft.permit.domain,draft.permit.types,draft.permit.values):undefined;
      const built=await swaps.build({id:draft.id,...(signature?{signature}:{})});
      updateMessage(w.id,rid,'Swapping through Uniswap');const r=await send(w.id,rid,'swap',built.transaction);return completeReceipt(w.id,a,r);
    }
    if(a.kind==='lp'){
      let prepared;
      for(let round=0;round<4;round++){
        prepared=await liquidity.prepare({address:w.address,...a.input});
        if(['create','increase'].includes(a.input.action)&&(BigInt(prepared.amount0)>BigInt(a.limits.maximum0)||BigInt(prepared.amount1)>BigInt(a.limits.maximum1)))throw evmError(400,'Matching token amount changed. Review liquidity again.');
        if(a.input.action==='remove'&&[0,1].some(i=>BigInt(prepared['amount'+i])*995n/1000n<BigInt(a.limits['minimum'+i])))throw evmError(400,'Withdrawal amounts moved beyond your reviewed minimum. Review again.');
        if(!prepared.approvals.length)break;
        const approval=prepared.approvals[0];updateMessage(w.id,rid,`Approving exact ${approval.token===SWAP_USDC?'test USDC':'aUSDd'}`);
        await send(w.id,rid,'approve-'+approval.token,approval.transaction);
      }
      if(prepared.approvals.length)throw evmError(400,'Allowances changed. Review your original approvals before continuing.');
      updateMessage(w.id,rid,a.input.action==='collect'?'Collecting fees':a.input.action==='remove'?'Returning position tokens':'Adding Uniswap liquidity');
      const r=await send(w.id,rid,'liquidity',prepared.transaction);return completeReceipt(w.id,a,r);
    }
    const status=await delivery(id,a.input.bridgeRequestId);
    if(status.status==='delivered')return finish(w.id,rid,{transactionHash:status.destinationHash,alreadyDelivered:true});
    updateMessage(w.id,rid,'Completing the approved Axelar delivery');
    const r=await send(w.id,rid,'delivery',{...status.deliveryTransaction,from:w.address});return completeReceipt(w.id,a,r);
  }
  async function completeReceipt(wid,a,r){
    let tokenId=a.input.tokenId??null;
    if(a.kind==='lp'&&a.input.action==='create'){
      const event=r.logs.filter(l=>l.address.toLowerCase()===LP_MANAGER).map(l=>{try{return lpInterface.parseLog(l);}catch{return null;}}).find(e=>e?.name==='Transfer'&&e.args.from==='0x0000000000000000000000000000000000000000'&&e.args.to.toLowerCase()===getWallet(wid).address);
      if(!event)throw Error('Expected NFT mint event missing.');tokenId=String(event.args.tokenId);
    }
    return finish(wid,a.requestId,{transactionHash:r.hash,tokenId});
  }
  const service={
    store, jobs,
    async view(id){
      enabled();let w;try{w=store.wallet(id);}catch(e){if(e.status===401)return {ok:true,status:'none',custody:'service-managed',chainId:CHAIN};throw e;}
      const result={ok:true,status:w.status,address:w.address,chainId:CHAIN,custody:'service-managed',message:w.message,running:jobs.has(w.id),starterSteps:publicSteps(w.steps),actions:w.actions.map(publicAction),checkedAt:new Date(now()).toISOString()};
      if(w.status==='ready'){try{
        let entry=views.get(w.address);if(!entry||now()-entry.at>10000){entry={at:now(),promise:liquidity.wallet(w.address)};views.set(w.address,entry);if(views.size>100)views.delete(views.keys().next().value);}
        const view=await entry.promise;Object.assign(result,{balance0:view.balance0,balance1:view.balance1,positions:view.positions,nextCursor:view.nextCursor,balancesAvailable:true});
      }catch{views.delete(w.address);result.balancesAvailable=false;}}
      return result;
    },
    async start(id,ip){enabled();sponsor();const w=store.allocate(id,ip,()=>Wallet.createRandom(),now());if(w.status!=='ready')launch(w.id,null,()=>initialize(w.id));return service.view(id);},
    async quote(id,raw){
      enabled();fields(raw,['kind','input']);fields(raw.input,raw.kind==='swap'?['amountUnits']:raw.kind==='lp'?['action','tokenId','amountUnits','percentage']:raw.kind==='delivery'?['bridgeRequestId']:[]);
      const w=store.wallet(id);if(w.status!=='ready')throw evmError(409,'Your demo wallet is still being funded.');
      if(w.actions.some(a=>a.status==='pending'))throw evmError(409,'Confirm the original operation first.');
      let data,limits,input=raw.input;
      if(raw.kind==='swap'){
        data=await swaps.prepare({address:w.address,...input});
        const balance=await new Contract(BRIDGED_TOKEN,erc20,provider).balanceOf(w.address);
        if(balance<BigInt(input.amountUnits))throw evmError(400,'Bridge more aUSDd into your demo wallet first.');
        limits={minimumOut:data.minimumOut};
      }else if(raw.kind==='lp'){
        lpInput({address:w.address,...input});data=await liquidity.prepare({address:w.address,...input});
        limits={maximum0:String((BigInt(data.amount0)*1005n+999n)/1000n+2n),maximum1:data.amount1,minimum0:String(BigInt(data.amount0)*995n/1000n),minimum1:String(BigInt(data.amount1)*995n/1000n)};
      }else if(raw.kind==='delivery'){
        checkRequest(input.bridgeRequestId);data=await delivery(id,input.bridgeRequestId);limits={};
      }else throw evmError(400,'Choose a supported demo operation.');
      for(const [key,q]of quotes)if(q.expiresAt<=now())quotes.delete(key);
      if(quotes.size>=100)throw evmError(429,'Demo quotes are busy. Try shortly.');
      const idQuote=randomUUID(),q={id:idQuote,owner:id,kind:raw.kind,input,limits,expiresAt:now()+120000};quotes.set(idQuote,q);
      return {ok:true,quoteId:idQuote,kind:raw.kind,expiresAt:q.expiresAt,amountOut:data.amountOut,minimumOut:data.minimumOut,amount0:data.amount0,amount1:data.amount1,maximum0:limits.maximum0,action:input.action,tokenId:input.tokenId??null};
    },
    async execute(id,raw){
      enabled();fields(raw,['requestId','quoteId']);checkRequest(raw.requestId);
      const w=store.wallet(id),prior=w.actions.find(a=>a.requestId===raw.requestId);
      if(prior){if(prior.quoteId!==raw.quoteId)throw evmError(409,'Request ID already used for different terms.');if(prior.status==='pending')launch(w.id,raw.requestId,()=>action(id,raw.requestId));return service.view(id);}
      const q=quotes.get(raw.quoteId);if(!q||q.owner!==id||q.expiresAt<=now())throw evmError(400,'Quote expired. Review it again.');
      store.begin(id,raw.requestId,q,now());launch(w.id,raw.requestId,()=>action(id,raw.requestId));return service.view(id);
    },
    async resume(id,raw){enabled();fields(raw,['requestId']);checkRequest(raw.requestId);const w=store.wallet(id),a=w.actions.find(a=>a.requestId===raw.requestId);if(!a)throw evmError(404,'Original operation not found.');if(a.status==='pending')launch(w.id,a.requestId,()=>action(id,a.requestId));return service.view(id);},
    async bridge(id,raw,ip){enabled();fields(raw,['requestId','amount']);const w=store.wallet(id);if(w.status!=='ready')throw evmError(409,'Wait for your demo wallet to be ready.');
      return withIssuanceLock(network,async()=>{if(!demo.store.read().accounts[id])await demo.start(id,ip);return demo.bridge(id,{...raw,recipient:w.address});});
    },
    async warm(count=3){
      enabled();sponsor();if(!Number.isInteger(count)||count<1||count>3)throw Error('Warm 1–3 demo wallets.');
      for(let i=0;i<count;i++){
        const s=store.read(),free=Object.values(s.wallets).filter(w=>!Object.values(s.allocations).includes(w.id));
        if(free.filter(w=>w.status==='ready').length>=count)break;
        const w=free.find(w=>w.status==='funding')??store.create(Wallet.createRandom(),now());
        await lock('wallet-'+w.id,()=>initialize(w.id));
      }
      return {ready:Object.values(store.read().wallets).filter(w=>w.status==='ready'&&!Object.values(store.read().allocations).includes(w.id)).length};
    },
    close:async()=>{await Promise.allSettled(jobs.values());provider.destroy();},
  };
  return service;
}
