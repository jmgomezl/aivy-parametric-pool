import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Wallet,Transaction,keccak256} from 'ethers';
import {evmStore,EVM_LIMITS} from '../src/demo/evm-store.js';
import {createEvmDemo} from '../src/demo/evm.js';
import {LP_MANAGER,lpInterface,LP_LOWER,LP_UPPER} from '../src/settlement/liquidity.js';
import {SWAP_USDC} from '../src/settlement/testnetSwap.js';
import {BRIDGED_TOKEN} from '../src/settlement/bridgedSwap.js';
const A='a'.repeat(64),B='b'.repeat(64),FUNDER='0x18c5e6987a734638403bbd942e17d959952b8e4e';
function fixture(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'quorum-evm-')),store=evmStore(directory),signer=Wallet.createRandom();
 const w=store.allocate(A,'ip-a',()=>signer);store.patch(w.id,w=>w.status='ready');
 const receipts=new Map(),submitted=[];let hidden=false,broadcasts=0;
 const provider={send:async()=> '0xaa36a7',estimateGas:async()=>21000n,getFeeData:async()=>({gasPrice:1n}),getBalance:async()=>10n**18n,getTransactionCount:async()=>0,
  getTransactionReceipt:async hash=>hidden?null:receipts.get(hash),getTransaction:async hash=>receipts.has(hash)?{hash}:null,waitForTransaction:async hash=>hidden?null:receipts.get(hash),destroy(){},
  broadcastTransaction:async raw=>{broadcasts++;const tx=Transaction.from(raw);submitted.push(tx);const log=lpInterface.encodeEventLog(lpInterface.getEvent('Transfer'),['0x0000000000000000000000000000000000000000',signer.address,123]);receipts.set(keccak256(raw),{hash:keccak256(raw),status:1,logs:[{address:LP_MANAGER,...log}]});return {hash:keccak256(raw)};}};
 const liquidity={wallet:async address=>({address,balance0:'100000',balance1:'100000',positions:[],nextCursor:null}),prepare:async input=>({amount0:'10000',amount1:'10000',approvals:[],transaction:{from:input.address,to:LP_MANAGER,value:'0x0',chainId:'0xaa36a7',data:lpInterface.encodeFunctionData('mint',[{token0:SWAP_USDC,token1:BRIDGED_TOKEN,fee:3000,tickLower:LP_LOWER,tickUpper:LP_UPPER,amount0Desired:10000,amount1Desired:10000,amount0Min:9950,amount1Min:9950,recipient:input.address,deadline:Math.floor(Date.now()/1000)+300}])}})};
 const service=createEvmDemo({network:'testnet',store,provider,liquidity,funder:{address:FUNDER}});
 return {directory,store,signer,w,service,provider,liquidity,submitted,hide:v=>hidden=v,broadcasts:()=>broadcasts,done:async()=>{await service.close();fs.rmSync(directory,{recursive:true,force:true});}};
}
const settle=service=>Promise.all([...service.jobs.values()]);
test('wallet allocation is isolated, persistent, private, idempotent and admission bounded',async()=>{const f=fixture();try{
 const b=f.store.allocate(B,'ip-b',()=>Wallet.createRandom());assert.notEqual(b.address,f.w.address);assert.equal(evmStore(f.directory).allocate(A,'ip-a',()=>{throw Error('must reuse');}).address,f.w.address);
 for(const id of ['c','d'])f.store.allocate(id.repeat(64),'ip-a',()=>Wallet.createRandom());assert.throws(()=>f.store.allocate('e'.repeat(64),'ip-a',()=>Wallet.createRandom()),/limit/);
 assert.equal(fs.statSync(path.join(f.directory,'evm-demo-testnet.json')).mode&0o777,0o600);
 const view=JSON.stringify(await f.service.view(A));for(const secret of [f.signer.privateKey,A,'privateKey','raw','allocations'])assert.ok(!view.includes(secret));
}finally{await f.done();}});
test('journal corruption and abandoned writer lock fail closed',async()=>{const f=fixture();try{
 fs.writeFileSync(path.join(f.directory,'evm-state.lock'),'busy');assert.throws(()=>f.store.patch(f.w.id,()=>{}),/busy/);fs.unlinkSync(path.join(f.directory,'evm-state.lock'));
 fs.writeFileSync(path.join(f.directory,'evm-demo-testnet.json'),'broken');assert.throws(()=>f.store.read(),/operator review/);
}finally{await f.done();}});
test('requests and consumed quotes cannot be replayed with changed IDs or terms',async()=>{const f=fixture();try{
 const q={id:'quote-one',kind:'lp',input:{action:'create'},limits:{}};f.store.begin(A,'request-1234567890',q);assert.throws(()=>f.store.begin(A,'request-1234567890',{...q,id:'other'}),/another operation/);
 f.store.patch(f.w.id,w=>w.actions[0].status='complete');assert.throws(()=>f.store.begin(A,'request-0987654321',q),/original request/);assert.equal(f.store.begin(A,'request-1234567890',q).status,'complete');
}finally{await f.done();}});
test('gas reservations are durable, idempotent and conservatively capped',async()=>{const f=fixture();try{
 f.store.sponsorReserve('one',EVM_LIMITS.sponsorDailyWei);evmStore(f.directory).sponsorReserve('one',EVM_LIMITS.sponsorDailyWei);assert.throws(()=>f.store.sponsorReserve('two','1'),/daily limit/);assert.equal(f.store.read().sponsorReservations.length,1);
}finally{await f.done();}});
test('mainnet and caller-controlled signer/recipient/calldata are refused',async()=>{const f=fixture();try{
 const main=createEvmDemo({network:'mainnet',store:f.store,provider:f.provider,liquidity:f.liquidity,funder:{address:FUNDER}});await assert.rejects(main.start(A,'ip'),/testnet only/);
 for(const field of ['address','recipient','privateKey','data','chainId','to'])await assert.rejects(f.service.quote(A,{kind:'lp',input:{action:'create',amountUnits:'10000',[field]:'attacker'}}),/Unsupported/);
 assert.equal(f.broadcasts(),0);
}finally{await f.done();}});
test('a quote is bound to its session; signed operation returns verified NFT without exposing raw bytes',async()=>{const f=fixture();try{
 const b=f.store.allocate(B,'ip-b',()=>Wallet.createRandom());f.store.patch(b.id,w=>w.status='ready');
 const q=await f.service.quote(A,{kind:'lp',input:{action:'create',amountUnits:'10000'}});
 await assert.rejects(f.service.execute(B,{requestId:'request-1234567890',quoteId:q.quoteId}),/expired/);
 await f.service.execute(A,{requestId:'request-1234567890',quoteId:q.quoteId});await settle(f.service);
 const view=await f.service.view(A);assert.equal(view.actions[0].status,'complete');assert.equal(view.actions[0].result.tokenId,'123');assert.equal(f.submitted[0].from.toLowerCase(),f.w.address);assert.equal(f.submitted[0].chainId,11155111n);
 await f.service.execute(A,{requestId:'request-1234567890',quoteId:q.quoteId});await settle(f.service);assert.equal(f.broadcasts(),1);assert.ok(!JSON.stringify(view).includes('raw'));
}finally{await f.done();}});
test('unknown broadcast is reconciled with its original hash after restart, without a second mint',async()=>{const f=fixture();try{
 f.hide(true);const q=await f.service.quote(A,{kind:'lp',input:{action:'create',amountUnits:'10000'}});await f.service.execute(A,{requestId:'request-1234567890',quoteId:q.quoteId});await settle(f.service);
 assert.equal(f.store.wallet(A).actions[0].status,'pending');assert.equal(f.broadcasts(),1);f.hide(false);
 const resumed=createEvmDemo({network:'testnet',store:evmStore(f.directory),provider:f.provider,liquidity:f.liquidity,funder:{address:FUNDER}});await resumed.resume(A,{requestId:'request-1234567890'});await settle(resumed);
 assert.equal(f.store.wallet(A).actions[0].status,'complete');assert.equal(f.broadcasts(),1);
}finally{await f.done();}});
test('wrong RPC chain is rejected before a key signs or funds move',async()=>{const f=fixture();try{
 f.provider.send=async()=> '0x1';const q=await f.service.quote(A,{kind:'lp',input:{action:'create',amountUnits:'10000'}});await f.service.execute(A,{requestId:'request-1234567890',quoteId:q.quoteId});await settle(f.service);assert.equal(f.broadcasts(),0);assert.equal(f.store.wallet(A).actions[0].status,'failed');
}finally{await f.done();}});
test('activity spending cannot consume the gas allowance reserved for exit',async()=>{const f=fixture();try{
 f.store.patch(f.w.id,w=>w.steps.prior={from:w.address,gasBudget:'3000000000000000',status:'confirmed'});
 const q=await f.service.quote(A,{kind:'lp',input:{action:'create',amountUnits:'10000'}});await f.service.execute(A,{requestId:'request-1234567890',quoteId:q.quoteId});await settle(f.service);
 const a=f.store.wallet(A).actions[0];assert.equal(a.status,'failed');assert.match(a.message,/reserved for withdrawing/);assert.equal(f.broadcasts(),0);
}finally{await f.done();}});
