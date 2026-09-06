import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuoteService } from '../src/settlement/crossAsset.js';
const result = { amountOut:'300000000000000000', outputDecimals:18, route:[[{type:'v3-pool'}]], quote:{quoteId:'quote-test',gasFeeUSD:'0.002'}, unsignedTx:{chainId:8453} };
test('conversion uses the real chain token and exact units, with explicit non-execution evidence', async () => {
 let input;
 const quote=createQuoteService({executeQuote:async p=>{input=p;return result;},now:()=>1000});
 const q=await quote({payoutUsd:800,chainId:8453});
 assert.equal(input.amountIn,'800000000');assert.equal(input.tokenIn,'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
 assert.equal(q.to.amount,result.amountOut);assert.equal(q.quoteId,'quote-test');
 assert.equal(q.network,'mainnet');assert.equal(q.approved,false);assert.equal(q.broadcast,false);
 assert.match(q.boundary,/hypothetical/);assert.equal(Date.parse(q.expiresAt)-Date.parse(q.quotedAt),30000);
});
test('coalesces requests, expires prices, and keeps chains and amounts separate', async () => {
 let n=0, now=1000;
 const quote=createQuoteService({executeQuote:async()=>{n++;return result;},now:()=>now});
 await Promise.all([quote({payoutUsd:800}),quote({payoutUsd:800})]);assert.equal(n,1);
 await quote({payoutUsd:800});assert.equal(n,1);
 await quote({payoutUsd:800,chainId:130});assert.equal(n,2);
 await quote({payoutUsd:801});assert.equal(n,3);
 now+=31000;await quote({payoutUsd:800});assert.equal(n,4);
});
test('refuses invalid amounts, unsupported chains and arbitrary output tokens before API use', async () => {
 const quote=createQuoteService({executeQuote:()=>{throw new Error('must not be called');}});
 for(const payoutUsd of [NaN,Infinity,-1,0,.001,1000001]) await assert.rejects(quote({payoutUsd}),{reason:'invalid_input'});
 await assert.rejects(quote({payoutUsd:800,chainId:1}),{reason:'invalid_input'});
 await assert.rejects(quote({payoutUsd:800,tokenOut:'random'}),{reason:'invalid_input'});
});
test('upstream errors cannot expose credentials and failed results are not cached', async () => {
 let n=0;
 const quote=createQuoteService({executeQuote:async()=>{if(++n===1)throw new Error('secret upstream detail');return result;}});
 await assert.rejects(quote({payoutUsd:800}),e=>e.reason==='quote_unavailable'&&!e.message.includes('secret'));
 assert.equal((await quote({payoutUsd:800})).ok,true);assert.equal(n,2);
});
test('refuses malformed or zero output instead of presenting an invented conversion', async () => {
 for(const malformed of [{...result,amountOut:null},{...result,amountOut:'0'},{...result,outputDecimals:null}]) {
  const quote=createQuoteService({executeQuote:async()=>malformed});
  await assert.rejects(quote({payoutUsd:800}),{reason:'quote_unavailable'});
 }
});
test('bounds upstream requests while cached quotes remain accessible', async () => {
 let now=0, n=0;
 const quote=createQuoteService({executeQuote:async()=>{n++;return result;},now:()=>now});
 for(let i=1;i<=60;i++)await quote({payoutUsd:i});
 await assert.rejects(quote({payoutUsd:61}),{reason:'rate_limited'});
 await quote({payoutUsd:60});assert.equal(n,60);
 now=61000;await quote({payoutUsd:61});assert.equal(n,61);
});
