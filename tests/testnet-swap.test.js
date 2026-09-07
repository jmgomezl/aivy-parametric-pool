import test from 'node:test';
import assert from 'node:assert/strict';
import {AbiCoder,Interface} from 'ethers';
import {swapInput,validateSwap,SWAP_ROUTER,SWAP_USDC,createTestnetSwap} from '../src/settlement/testnetSwap.js';
const address='0x1111111111111111111111111111111111111111',amountWei='1000000000000000',now=Date.now(),abi=AbiCoder.defaultAbiCoder();
const iface=new Interface(['function execute(bytes commands,bytes[] inputs,uint256 deadline) payable']);
function fixture(){
 const quote={chainId:11155111,swapper:address,tradeType:'EXACT_INPUT',input:{token:'0x0000000000000000000000000000000000000000',amount:amountWei},output:{token:SWAP_USDC,recipient:address,amount:'1000000',minimumAmount:'995000'},slippage:.5};
 const inputs=[abi.encode(['address','uint256'],['0x0000000000000000000000000000000000000002',amountWei]),abi.encode(['address','uint256','uint256','bytes','bool'],[address,amountWei,995000,'0xfff9976782d46cc05630d1f6ebab18b2324d6b140001f4'+SWAP_USDC.slice(2),false])];
 const tx={from:address,to:SWAP_ROUTER,chainId:11155111,value:amountWei,data:iface.encodeFunctionData('execute',['0x0b00',inputs,Math.floor(now/1000)+1200])};
 return {quote,tx,inputs};
}
test('testnet native swap validates exact transaction and output protection',()=>{const {quote,tx}=fixture();assert.equal(validateSwap(tx,quote,{address,amountWei},now).chainId,'0xaa36a7');});
test('rejects caller-selected chain, recipient, amount excess and invalid input',()=>{for(const i of [{address,amountWei,chainId:1},{address,amountWei:'10000000000000001'},{address:'bad',amountWei},{address,amountWei:'-1'}])assert.throws(()=>swapInput(i));});
test('rejects changed router, chain, sender or transaction value',()=>{for(const patch of [{to:address},{chainId:1},{from:SWAP_ROUTER},{value:'1'}]){const {tx,quote}=fixture();assert.throws(()=>validateSwap({...tx,...patch},quote,{address,amountWei},now));}});
test('rejects commands that authorize arbitrary transfer and expired execution',()=>{for(const commands of ['0x0b80','0x0b04']){const {tx,quote,inputs}=fixture();tx.data=iface.encodeFunctionData('execute',[commands,inputs,Math.floor(now/1000)+1000]);assert.throws(()=>validateSwap(tx,quote,{address,amountWei},now));}const {tx,quote}=fixture();assert.throws(()=>validateSwap(tx,quote,{address,amountWei},now+3600000));});
test('rejects wrong recipient, unprotected output, or mismatched quote',()=>{for(const patch of [{recipient:SWAP_ROUTER},{minimumAmount:'0'},{minimumAmount:'900000'},{token:address}]){const {tx,quote}=fixture();quote.output={...quote.output,...patch};assert.throws(()=>validateSwap(tx,quote,{address,amountWei},now));}});
test('bounded service calls only quote/swap and does not broadcast',async()=>{const calls=[],{quote,tx}=fixture();const service=createTestnetSwap({now:()=>now,fetcher:async(url,opts)=>{calls.push(url);assert.equal(opts.headers['x-universal-router-version'],'2.0');return {ok:true,json:async()=>url.endsWith('/quote')?{routing:'CLASSIC',quote}:{swap:tx}};}});const result=await service({address,amountWei});assert.equal(result.ok,true);assert.equal(calls.length,2);assert.equal(result.minimumOut,'995000');});
