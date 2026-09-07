// Bounded operator QA on Sepolia. Never uses ARPS or insurance reserves.
// The private journal stores signed bytes before broadcasting and is resumable.
import 'dotenv/config';
import fs from 'node:fs';
import {Contract,Interface,JsonRpcProvider,Wallet,keccak256} from 'ethers';
import {createLiquidity,lpInterface,LP_MANAGER,LP_POOL,LP_SEED} from '../src/settlement/liquidity.js';
import {createBridgedSwap,BRIDGED_TOKEN,PERMIT2} from '../src/settlement/bridgedSwap.js';
if(!process.argv.includes('--execute'))throw Error('Review this bounded Sepolia lifecycle, then pass --execute.');
const config=JSON.parse(fs.readFileSync('.artifacts/sepolia-verification-wallet.json'));
if(config.chainId!==11155111)throw Error('Sepolia verification wallet required.');
const provider=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',11155111,{staticNetwork:true});
const wallet=new Wallet(config.privateKey,provider),address=wallet.address.toLowerCase(),service=createLiquidity({provider});
const journalFile='.artifacts/uniswap-lp-lifecycle.json';
const journal=fs.existsSync(journalFile)?JSON.parse(fs.readFileSync(journalFile)):{chainId:11155111,address,steps:{}};
if(journal.address!==address||journal.chainId!==11155111)throw Error('Journal wallet mismatch.');
const save=()=>{fs.writeFileSync(journalFile+'.tmp',JSON.stringify(journal,null,2),{mode:0o600});fs.renameSync(journalFile+'.tmp',journalFile);};
async function send(name,transaction){
  if(journal.steps[name]){
    const previous=journal.steps[name],receipt=await provider.getTransactionReceipt(previous.hash);
    if(receipt?.status===1){previous.status='CONFIRMED';save();return receipt;}
    throw Error(`Reconcile original ${name}: ${previous.hash}. No new transaction submitted.`);
  }
  if(await provider.getTransactionCount(address,'pending')!==await provider.getTransactionCount(address,'latest'))throw Error('Wallet has a pending transaction. Reconcile it first.');
  if(transaction.chainId!=='0xaa36a7'||transaction.from.toLowerCase()!==address||BigInt(transaction.value)!==0n)throw Error('Unexpected verification transaction.');
  const {chainId,from,...tx}=transaction;
  const gas=(await provider.estimateGas({...tx,from:address}))*120n/100n,price=(await provider.getFeeData()).gasPrice*120n/100n;
  if(gas>1000000n||gas*price>2000000000000000n)throw Error('Step exceeds 1M gas / 0.002 test ETH.');
  const spent=Object.values(journal.steps).reduce((n,s)=>n+BigInt(s.gasBudget??0),0n);
  if(spent+gas*price>8000000000000000n)throw Error('Lifecycle exceeds 0.008 test ETH budget.');
  const raw=await wallet.signTransaction({...tx,chainId:11155111,nonce:await provider.getTransactionCount(address,'pending'),gasLimit:gas,gasPrice:price,type:0});
  const hash=keccak256(raw);journal.steps[name]={hash,raw,gasBudget:String(gas*price),status:'SIGNED'};save();
  await provider.broadcastTransaction(raw);journal.steps[name].status='SUBMITTED';save();
  console.log('Submitted',name,hash);
  const r=await provider.waitForTransaction(hash,1,45000);
  if(r?.status!==1)throw Error(`Original ${name} is pending or reverted: ${hash}`);
  journal.steps[name].status='CONFIRMED';save();return r;
}
async function lpAction(name,input){
  if(journal.steps[name])return send(name,null);
  let draft=await service.prepare({address,...input});
  for(let i=0;draft.approvals.length&&i<3;i++){
    const a=draft.approvals[0];await send(`${name}-approve-${a.token}`,a.transaction);
    draft=await service.prepare({address,...input});
  }
  if(draft.approvals.length)throw Error('Allowances still insufficient. Review original approvals.');
  return send(name,draft.transaction);
}
async function snapshot(){return {market:await service.market(),wallet:await service.wallet(address),ethWei:String(await provider.getBalance(address))};}
try{
  if(!journal.before){journal.before=await snapshot();save();}
  if(!journal.tokenId){
    const receipt=await lpAction('create',{action:'create',amountUnits:'100000'});
    const transfer=receipt.logs.filter(l=>l.address.toLowerCase()===LP_MANAGER).map(l=>{try{return lpInterface.parseLog(l);}catch{return null;}}).find(l=>l?.name==='Transfer'&&l.args.from==='0x0000000000000000000000000000000000000000'&&l.args.to.toLowerCase()===address);
    if(!transfer)throw Error('Missing new NFT receipt.');journal.tokenId=String(transfer.args.tokenId);save();
  }
  if(journal.tokenId===LP_SEED)throw Error('Refusing to alter the seed position.');
  await lpAction('increase',{action:'increase',tokenId:journal.tokenId,amountUnits:'100000'});
  if(!journal.steps['fee-generating-swap']){
    const swaps=createBridgedSwap(),input={address,amountUnits:'1000000'};
    let draft=await swaps.prepare(input);
    const token=new Contract(BRIDGED_TOKEN,['function allowance(address,address) view returns(uint256)'],provider);
    if(await token.allowance(address,PERMIT2)<1000000n){await send('swap-approval',draft.approval);draft=await swaps.prepare(input);}
    const signature=draft.permit?await wallet.signTypedData(draft.permit.domain,draft.permit.types,draft.permit.values):undefined;
    const built=await swaps.build({id:draft.id,...(signature?{signature}:{})});
    await send('fee-generating-swap',built.transaction);
  }else await send('fee-generating-swap',null);
  if(!journal.beforeCollect){journal.beforeCollect=await service.wallet(address);save();}
  await lpAction('collect',{action:'collect',tokenId:journal.tokenId});
  if(!journal.afterCollect){journal.afterCollect=await service.wallet(address);save();}
  await lpAction('remove-half',{action:'remove',tokenId:journal.tokenId,percentage:50});
  if(!journal.afterHalf){journal.afterHalf=await service.wallet(address);save();}
  await lpAction('remove-rest',{action:'remove',tokenId:journal.tokenId,percentage:100});
  journal.after=await snapshot();
  const final=journal.after.wallet.positions.find(p=>p.tokenId===journal.tokenId);
  if(!final||final.liquidity!=='0'||final.claimable0!=='0'||final.claimable1!=='0')throw Error('Position not fully withdrawn.');
  if(journal.after.market.seed.liquidity!==journal.before.market.seed.liquidity)throw Error('Seed liquidity changed. Review before publishing evidence.');
  journal.status='VERIFIED';save();
  const evidence={network:'Ethereum Sepolia',chainId:11155111,checkedAt:new Date().toISOString(),pool:LP_POOL,manager:LP_MANAGER,wallet:address,tokenId:journal.tokenId,seedPosition:LP_SEED,seedLiquidityBefore:journal.before.market.seed.liquidity,seedLiquidityAfter:journal.after.market.seed.liquidity,amounts:'0.1 aUSDd plus matching test USDC, then another 0.1; a separate 1 aUSDd swap generates fees.',transactions:Object.fromEntries(Object.entries(journal.steps).map(([name,s])=>[name,s.hash])),beforeCollect:journal.beforeCollect.positions.find(p=>p.tokenId===journal.tokenId),afterCollect:journal.afterCollect.positions.find(p=>p.tokenId===journal.tokenId),afterHalf:journal.afterHalf.positions.find(p=>p.tokenId===journal.tokenId),finalPosition:final,boundaries:'Real testnet tokens, no cash value. Separate operator verification wallet. No ARPS or insurance capital used. The original seed position was not altered.'};
  const transferInterface=new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);
  evidence.tokensReceived={};
  for(const name of ['collect','remove-half','remove-rest']){
    const receipt=await provider.getTransactionReceipt(evidence.transactions[name]);
    if(receipt?.status!==1)throw Error('Missing successful lifecycle receipt.');
    const transfers=[];
    for(const log of receipt.logs){
      if(![BRIDGED_TOKEN,journal.after.market.token0].includes(log.address.toLowerCase()))continue;
      try{const event=transferInterface.parseLog(log);if(event?.name==='Transfer'&&event.args.to.toLowerCase()===address)transfers.push({token:log.address.toLowerCase(),amountUnits:String(event.args.value)});}catch{/* Other token events. */}
    }
    if(!transfers.length)throw Error('Expected token delivery is missing.');
    evidence.tokensReceived[name]=transfers;
  }
  fs.writeFileSync('docs/evidence/uniswap-liquidity.json',JSON.stringify(evidence,null,2)+'\n');console.log('VERIFIED',JSON.stringify({tokenId:journal.tokenId,transactions:evidence.transactions,final}));
}finally{service.close();}
