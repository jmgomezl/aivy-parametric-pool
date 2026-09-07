import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {createLiquidity,lpInput,validateLpTransaction,lpInterface,LP_POOL,LP_MANAGER,LP_LOWER,LP_UPPER} from '../src/settlement/liquidity.js';
import {BRIDGED_TOKEN} from '../src/settlement/bridgedSwap.js';
import {SWAP_USDC} from '../src/settlement/testnetSwap.js';
const address='0x1111111111111111111111111111111111111111', other='0x2222222222222222222222222222222222222222';
const now=1788823200000, deadline=BigInt(now/1000+600), max=(1n<<128n)-1n;
const input={address,action:'create',amountUnits:'10000'};
const mint=()=>({token0:SWAP_USDC,token1:BRIDGED_TOKEN,fee:3000,tickLower:LP_LOWER,tickUpper:LP_UPPER,amount0Desired:9999n,amount1Desired:9999n,amount0Min:9950n,amount1Min:9950n,recipient:address,deadline});
const collect=()=>({tokenId:231745n,recipient:address,amount0Max:max,amount1Max:max});
const tx=(name,p)=>({to:LP_MANAGER,from:address,chainId:11155111,value:'0',data:lpInterface.encodeFunctionData(name,[p])});
const expected={amount0:'10000',amount1:'10000'};
test('LP inputs reject arbitrary assets, chains, owners and excessive demo amounts',()=>{
  assert.deepEqual(lpInput(input),input);
  for(const patch of [{chainId:1},{token0:other},{amountUnits:'1000001'},{amountUnits:'9999'},{amountUnits:'1.1'},{address:'0x'},{action:'burn'},{tokenId:'12'}])assert.throws(()=>lpInput({...input,...patch}));
  for(const percentage of [0,101,1.5,'50'])assert.throws(()=>lpInput({address,action:'remove',tokenId:'231745',percentage}));
  assert.throws(()=>lpInput({address,action:'collect',tokenId:'231745',recipient:other}));
});
test('mint validates exact market, full range, recipient, amount limits and minima',()=>{
  assert.ok(validateLpTransaction(tx('mint',mint()),input,expected,now));
  for(const patch of [{token0:other},{token1:other},{recipient:other},{fee:500},{tickLower:-60},{tickUpper:60},{amount1Desired:10001n},{amount0Desired:1000001n},{amount0Desired:9000n},{amount0Min:0},{amount1Min:0},{deadline:deadline+1000n},{deadline:BigInt(now/1000)}])assert.throws(()=>validateLpTransaction(tx('mint',{...mint(),...patch}),input,expected,now));
  for(const patch of [{chainId:1},{value:'1'},{from:other},{to:other}])assert.throws(()=>validateLpTransaction({...tx('mint',mint()),...patch},input,expected,now));
  assert.throws(()=>validateLpTransaction({...tx('mint',mint()),data:tx('mint',mint()).data+'00'},input,expected,now));
});
test('increase, remove and collect cannot target another NFT or divert output',()=>{
  const increase={tokenId:231745n,amount0Desired:9999n,amount1Desired:9999n,amount0Min:9950n,amount1Min:9950n,deadline};
  const inc={...input,action:'increase',tokenId:'231745'};
  assert.ok(validateLpTransaction(tx('increaseLiquidity',increase),inc,expected,now));
  assert.throws(()=>validateLpTransaction(tx('increaseLiquidity',{...increase,tokenId:1n}),inc,expected,now));
  const ci={address,action:'collect',tokenId:'231745'};
  assert.ok(validateLpTransaction(tx('collect',collect()),ci,expected,now));
  for(const patch of [{tokenId:1n},{recipient:other},{amount0Max:1n}])assert.throws(()=>validateLpTransaction(tx('collect',{...collect(),...patch}),ci,expected,now));
  const removal={tokenId:231745n,liquidity:5000n,amount0Min:4975n,amount1Min:4975n,deadline};
  const ri={address,action:'remove',tokenId:'231745',percentage:50},re={liquidity:'5000',amount0:'5000',amount1:'5000'};
  const multi=(r=removal,c=collect())=>tx('multicall',[tx('decreaseLiquidity',r).data,tx('collect',c).data]);
  assert.ok(validateLpTransaction(multi(),ri,re,now));
  assert.throws(()=>validateLpTransaction(multi({...removal,liquidity:10000n}),ri,re,now));
  assert.throws(()=>validateLpTransaction(multi({...removal,amount0Min:1n}),ri,re,now));
  assert.throws(()=>validateLpTransaction(multi(removal,{...collect(),recipient:other}),ri,re,now));
  assert.throws(()=>validateLpTransaction(tx('decreaseLiquidity',removal),ri,re,now));
  assert.throws(()=>validateLpTransaction(tx('multicall',[multi().data]),ri,re,now));
  assert.throws(()=>validateLpTransaction(tx('multicall',[multi().data,tx('mint',mint()).data]),ri,re,now));
});

const poolAbi=new Interface(['function token0() view returns(address)','function token1() view returns(address)','function fee() view returns(uint24)','function liquidity() view returns(uint128)','function slot0() view returns(uint160,int24,uint16,uint16,uint16,uint8,bool)']);
const erc=new Interface(['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)']);
function harness(options={}){
  const calls=[],apiCalls=[];let ownerCalls=0;
  const provider={getBlockNumber:async()=>100,destroy(){},call:async request=>{
    const target=request.to.toLowerCase(),i=target===LP_POOL?poolAbi:target===LP_MANAGER?lpInterface:erc,d=i.parseTransaction(request);calls.push({target,name:d.name,args:d.args});
    let result;
    if(target===LP_POOL)result={token0:[SWAP_USDC],token1:[options.wrongPool?other:BRIDGED_TOKEN],fee:[3000],liquidity:[10000n],slot0:[1n<<96n,0,0,0,0,0,true]}[d.name];
    else if(target===LP_MANAGER){
      result={positions:[0,other,SWAP_USDC,BRIDGED_TOKEN,3000,LP_LOWER,LP_UPPER,10000n,0,0,0,0],balanceOf:[1],tokenOfOwnerByIndex:[231745n],collect:options.noFees?[0n,0n]:[10n,20n]}[d.name];
      if(d.name==='ownerOf'){ownerCalls++;result=[options.notOwner||(options.ownerChanges&&ownerCalls>1)?other:address];}
      if(d.name==='decreaseLiquidity')result=[d.args[0].liquidity,d.args[0].liquidity];
    }else result=d.name==='balanceOf'?[options.noBalance?0n:1000000n]:[options.approved?1000000n:0n];
    return i.encodeFunctionResult(d.name,result);
  }};
  const service=createLiquidity({provider,now:()=>now,fetcher:async(url,request)=>{
    const body=JSON.parse(request.body);apiCalls.push({url,body});
    if(options.apiDown)return {ok:false};
    let transaction,key;
    if(url.endsWith('/create')){key='create';transaction=tx('mint',mint());}
    else if(url.endsWith('/increase')){key='increase';const {tokenId=231745n,amount0Desired,amount1Desired,amount0Min,amount1Min}=mint();transaction=tx('increaseLiquidity',{tokenId,amount0Desired,amount1Desired,amount0Min,amount1Min,deadline});}
    else if(url.endsWith('/claim_fees')){key='claim';transaction=tx('collect',{...collect(),recipient:options.badRecipient?other:address});}
    else {key='decrease';transaction=tx('multicall',[tx('decreaseLiquidity',{tokenId:231745n,liquidity:5000n,amount0Min:4975n,amount1Min:4975n,deadline}).data,tx('collect',collect()).data]);}
    return {ok:true,json:async()=>({requestId:'api-proof',token0:{tokenAddress:SWAP_USDC,amount:options.badRatio?'900000':'10000'},token1:{tokenAddress:BRIDGED_TOKEN,amount:'10000'},[key]:transaction})};
  }});
  return {service,calls,apiCalls};
}
test('LP service builds all actions from the official API, with exact approvals',async()=>{
  process.env.UNISWAP_API_KEY='test-only';const {service,apiCalls}=harness();
  const r=await service.prepare(input);assert.equal(r.approvals.length,2);assert.equal(r.amount1,'10000');
  for(const a of r.approvals){const parsed=new Interface(['function approve(address,uint256)']).parseTransaction(a.transaction);assert.equal(parsed.args[0].toLowerCase(),LP_MANAGER);assert.equal(parsed.args[1],10000n);}
  assert.equal(apiCalls[0].url,'https://liquidity.api.uniswap.org/lp/create');assert.equal(apiCalls[0].body.tickBounds.tickLower,LP_LOWER);
  await service.prepare({...input,action:'increase',tokenId:'231745'});
  const c=await service.prepare({address,action:'collect',tokenId:'231745'});assert.equal(c.amount0,'10');assert.equal(c.approvals.length,0);
  const r2=await service.prepare({address,action:'remove',tokenId:'231745',percentage:50});assert.equal(r2.liquidity,'5000');
  const wallet=await service.wallet(address);assert.equal(wallet.positions[0].tokenId,'231745');assert.equal(wallet.positions[0].claimable1,'20');
  const market=await service.market();assert.equal(market.seed.owner,address);assert.equal(market.price0Per1,1);
});
test('service refuses foreign positions, ownership changes, bad output, insufficient balances and outages',async()=>{
  process.env.UNISWAP_API_KEY='test-only';
  for(const options of [{notOwner:true},{ownerChanges:true},{badRecipient:true}]){
    const {service}=harness(options);await assert.rejects(service.prepare({address,action:'collect',tokenId:'231745'}));
  }
  for(const options of [{noBalance:true},{badRatio:true},{apiDown:true},{wrongPool:true}]){
    const {service}=harness(options);await assert.rejects(service.prepare(input));
  }
  const {service,apiCalls}=harness({noFees:true});await assert.rejects(service.prepare({address,action:'collect',tokenId:'231745'}),/No tokens/);assert.equal(apiCalls.length,0);
});
test('liquidity API work is bounded and never requires token approvals for withdrawals',async()=>{
  process.env.UNISWAP_API_KEY='test-only';const {service}=harness({approved:true});
  for(let i=0;i<20;i++)assert.equal((await service.prepare(input)).approvals.length,0);
  await assert.rejects(service.prepare(input),e=>e.status===429);
});
