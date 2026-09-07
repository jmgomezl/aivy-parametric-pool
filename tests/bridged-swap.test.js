import test from 'node:test';import assert from 'node:assert/strict';import{Wallet}from'ethers';
import {bridgedInput,validatePermit,PERMIT_TYPES,PERMIT2,BRIDGED_TOKEN}from'../src/settlement/bridgedSwap.js';import{SWAP_ROUTER}from'../src/settlement/testnetSwap.js';
const input={address:'0x1111111111111111111111111111111111111111',amountUnits:'10000'},now=Date.now(),seconds=Math.floor(now/1000);
const fixture=()=>({domain:{name:'Permit2',chainId:11155111,verifyingContract:PERMIT2},types:PERMIT_TYPES,values:{details:{token:BRIDGED_TOKEN,amount:'10000',expiration:String(seconds+300),nonce:'0'},spender:SWAP_ROUTER,sigDeadline:String(seconds+120)}});
test('bridged swap limits exact token units and disallows arbitrary chains',()=>{assert.equal(bridgedInput(input).amountUnits,'10000');for(const patch of[{amountUnits:'1000001'},{amountUnits:'9999'},{amountUnits:'1.5'},{chainId:1},{address:'0x0000000000000000000000000000000000000000'}])assert.throws(()=>bridgedInput({...input,...patch}));});
test('permits bind exact amount and router on Sepolia',()=>{assert.ok(validatePermit(fixture(),input,now));for(const field of['amount','token']){const p=fixture();p.values.details[field]=field==='amount'?'10001':input.address;assert.throws(()=>validatePermit(p,input,now));}const p=fixture();p.values.spender=input.address;assert.throws(()=>validatePermit(p,input,now));});
test('rejects wrong permit domain, expiry, and extended schema',()=>{let p=fixture();p.domain.chainId=1;assert.throws(()=>validatePermit(p,input,now));p=fixture();p.values.sigDeadline=String(seconds-1);assert.throws(()=>validatePermit(p,input,now));p=fixture();p.values.details.expiration=String(seconds+90*86400);assert.throws(()=>validatePermit(p,input,now));p=fixture();p.types={...PERMIT_TYPES,PermitSingle:[...PERMIT_TYPES.PermitSingle,{name:'extra',type:'uint256'}]};p.values.extra=1;assert.throws(()=>validatePermit(p,input,now));});

import {AbiCoder,Interface} from 'ethers';
import {validateBridgedTransaction,validateBridgedQuote,createBridgedSwap} from '../src/settlement/bridgedSwap.js';
import {SWAP_USDC} from '../src/settlement/testnetSwap.js';
const abi=AbiCoder.defaultAbiCoder(),router=new Interface(['function execute(bytes,bytes[],uint256) payable']);
function swapFixture(){
 const q={chainId:11155111,swapper:input.address,tradeType:'EXACT_INPUT',input:{token:BRIDGED_TOKEN,amount:'10000'},output:{token:SWAP_USDC,recipient:input.address,amount:'9900',minimumAmount:'9850'},slippage:.5};
 const leg=abi.encode(['address','uint256','uint256','bytes','bool'],[input.address,10000,9850,'0x'+BRIDGED_TOKEN.slice(2)+'000bb8'+SWAP_USDC.slice(2),true]);
 const tx={chainId:11155111,to:SWAP_ROUTER,from:input.address,value:'0',data:router.encodeFunctionData('execute',['0x00',[leg],seconds+300])};return{q,tx,leg};
}
test('bridged calldata rejects altered authority, commands and output protection',()=>{
 const {q,tx,leg}=swapFixture();assert.ok(validateBridgedTransaction(tx,q,input,null,null,now));
 for(const patch of[{chainId:1},{to:input.address},{from:BRIDGED_TOKEN},{value:'1'},{data:router.encodeFunctionData('execute',['0x04',[leg],seconds+300])},{data:router.encodeFunctionData('execute',['0x00',[leg],seconds-1])}])assert.throws(()=>validateBridgedTransaction({...tx,...patch},q,input,null,null,now));
 for(const patch of[{token:input.address},{recipient:BRIDGED_TOKEN},{minimumAmount:'1'}])assert.throws(()=>validateBridgedQuote({...q,output:{...q.output,...patch}},input));
 const wrong=abi.encode(['address','uint256','uint256','bytes','bool'],[BRIDGED_TOKEN,10000,9850,'0x'+BRIDGED_TOKEN.slice(2)+'000bb8'+SWAP_USDC.slice(2),true]);
 assert.throws(()=>validateBridgedTransaction({...tx,data:router.encodeFunctionData('execute',['0x00',[wrong],seconds+300])},q,input,null,null,now));
});
test('untrusted quote terms are rejected before showing a draft',async()=>{
 const {q}=swapFixture();q.output.recipient=BRIDGED_TOKEN;
 const service=createBridgedSwap({now:()=>now,fetcher:async()=>({ok:true,json:async()=>({routing:'CLASSIC',quote:q})})});
 await assert.rejects(service.prepare(input),/quote terms/);
});
