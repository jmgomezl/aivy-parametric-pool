// Uniswap V3 market liquidity. This service reads chain state and prepares
// unsigned wallet transactions; it has no Hedera capital or signing authority.
import {Contract, FetchRequest, Interface, JsonRpcProvider, isAddress} from 'ethers';
import {BRIDGED_TOKEN} from './bridgedSwap.js';
import {SWAP_CHAIN, SWAP_USDC} from './testnetSwap.js';

export const LP_POOL = '0x520388428673bc16fad5aa5e49fdb1d30727ceb3';
export const LP_MANAGER = '0x1238536071e1c677a632429e3655c799b22cda52';
export const LP_SEED = '231745';
export const LP_LOWER = -887220, LP_UPPER = 887220;
const MAX128 = (1n << 128n) - 1n;
export const LP_ABI = [
  'function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns(uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)',
  'function increaseLiquidity((uint256 tokenId,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) payable returns(uint128 liquidity,uint256 amount0,uint256 amount1)',
  'function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) payable returns(uint256 amount0,uint256 amount1)',
  'function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) payable returns(uint256 amount0,uint256 amount1)',
  'function multicall(bytes[] data) payable returns(bytes[])',
  'function positions(uint256) view returns(uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)',
  'function ownerOf(uint256) view returns(address)',
  'function balanceOf(address) view returns(uint256)',
  'function tokenOfOwnerByIndex(address,uint256) view returns(uint256)',
  'function tokenURI(uint256) view returns(string)',
  'event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)',
];
const ERC20 = ['function balanceOf(address) view returns(uint256)', 'function allowance(address,address) view returns(uint256)', 'function approve(address,uint256) returns(bool)'];
export const lpInterface = new Interface(LP_ABI);
const tokenInterface = new Interface(ERC20);
const lower = s => String(s).toLowerCase();
const fail = message => { throw Object.assign(Error(message), {status:400}); };
const unavailable = () => Object.assign(Error('Uniswap liquidity is temporarily unavailable. Try refreshing.'), {status:503});
const idValid = id => typeof id === 'string' && /^[1-9]\d{0,19}$/.test(id);
export function lpInput(raw) {
  if (!raw || !['create','increase','collect','remove'].includes(raw.action) || !isAddress(raw.address) || /^0x0{40}$/i.test(raw.address)) fail('Choose a valid wallet and liquidity action.');
  const allowed = ['address','action', ...(raw.action === 'create' ? [] : ['tokenId']), ...(['create','increase'].includes(raw.action) ? ['amountUnits'] : raw.action === 'remove' ? ['percentage'] : [])];
  if (Object.keys(raw).some(k => !allowed.includes(k))) fail('Unsupported liquidity field.');
  if (raw.action !== 'create' && !idValid(raw.tokenId)) fail('Invalid position NFT.');
  if (['create','increase'].includes(raw.action) && (typeof raw.amountUnits !== 'string' || !/^\d{1,7}$/.test(raw.amountUnits) || BigInt(raw.amountUnits) < 10000n || BigInt(raw.amountUnits) > 1000000n)) fail('Add 0.01–1 aUSDd, plus the matching test USDC.');
  if (raw.action === 'remove' && (!Number.isInteger(raw.percentage) || raw.percentage < 1 || raw.percentage > 100)) fail('Choose 1–100% of this position.');
  return {...raw, address:lower(raw.address)};
}

// Only the exact expected calls are accepted, including calls nested in multicall.
// Canonical re-encoding also rejects trailing calldata and malformed tuples.
export function validateLpTransaction(tx, input, expected, now = Date.now()) {
  if (!tx || tx.chainId !== SWAP_CHAIN || lower(tx.to) !== LP_MANAGER || lower(tx.from) !== input.address || BigInt(tx.value ?? -1) !== 0n) fail('Unexpected liquidity transaction authority.');
  function decode(data) {
    const parsed = lpInterface.parseTransaction({data});
    if (!parsed || lpInterface.encodeFunctionData(parsed.fragment, parsed.args).toLowerCase() !== data.toLowerCase()) fail('Unsupported liquidity calldata.');
    return parsed;
  }
  const root = decode(tx.data);
  const calls = root.name === 'multicall' ? root.args.data.map(decode) : [root];
  const names = {create:'mint',increase:'increaseLiquidity',collect:'collect',remove:'decreaseLiquidity,collect'};
  if (calls.map(c => c.name).join(',') !== names[input.action]) fail('Unexpected liquidity operations.');
  for (const call of calls) {
    const p = call.args[0];
    if (call.name !== 'mint' && String(p.tokenId) !== input.tokenId) fail('Position NFT mismatch.');
    if (call.name === 'collect') {
      if (lower(p.recipient) !== input.address || p.amount0Max !== MAX128 || p.amount1Max !== MAX128) fail('Collection must return tokens to the position owner.');
      continue;
    }
    if (p.deadline < BigInt(Math.floor(now/1000)+30) || p.deadline > BigInt(Math.floor(now/1000)+900)) fail('Liquidity quote expired or deadline too long.');
    if (call.name === 'mint' && (lower(p.token0) !== SWAP_USDC || lower(p.token1) !== BRIDGED_TOKEN || p.fee !== 3000n || p.tickLower !== BigInt(LP_LOWER) || p.tickUpper !== BigInt(LP_UPPER) || lower(p.recipient) !== input.address)) fail('Only the pinned full-range Sepolia market is allowed.');
    if (call.name === 'decreaseLiquidity') {
      if (p.liquidity !== BigInt(expected.liquidity)) fail('Removal exceeds the requested share of this position.');
    } else {
      if (p.amount1Desired > BigInt(input.amountUnits) || p.amount1Desired < BigInt(input.amountUnits)-2n || p.amount0Desired > 1000000n || p.amount0Desired <= 0n) fail('Liquidity amounts exceed the demo limits.');
      for (const i of [0,1]) if (p[`amount${i}Desired`] > BigInt(expected[`amount${i}`]) || p[`amount${i}Desired`] < BigInt(expected[`amount${i}`])-2n) fail('Liquidity amounts do not match the review.');
    }
    for (const i of [0,1]) {
      const reference = call.name === 'decreaseLiquidity' ? BigInt(expected[`amount${i}`]) : p[`amount${i}Desired`];
      const min = p[`amount${i}Min`];
      if (min > reference || min < reference*995n/1000n) fail('Liquidity slippage protection is too low.');
    }
  }
  return {from:input.address,to:LP_MANAGER,data:tx.data,value:'0x0',chainId:'0xaa36a7'};
}

export function createLiquidity({fetcher=fetch, provider, now=Date.now}={}) {
  if (!provider) {
    const request = new FetchRequest('https://ethereum-sepolia-rpc.publicnode.com'); request.timeout = 12000;
    provider = new JsonRpcProvider(request, SWAP_CHAIN, {staticNetwork:true});
  }
  const manager = new Contract(LP_MANAGER, LP_ABI, provider);
  const pool = new Contract(LP_POOL, ['function token0() view returns(address)','function token1() view returns(address)','function fee() view returns(uint24)','function liquidity() view returns(uint128)','function slot0() view returns(uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,uint8,bool)'], provider);
  const tokens = [SWAP_USDC, BRIDGED_TOKEN].map(a => new Contract(a, ERC20, provider));
  const artCache=new Map();
  let active=0, start=now(), reads=0, writes=0, cachedMarket, marketPromise;
  async function limited(kind, fn) {
    if (now()-start >= 60000) {start=now(); reads=0; writes=0;}
    if (active >= 4 || (kind === 'read' ? reads++ >= 90 : writes++ >= 20)) throw Object.assign(Error('Liquidity requests are busy. Try shortly.'),{status:429});
    active++;
    try {return await fn();} catch(e) {if(e.status) throw e; throw unavailable();} finally {active--;}
  }
  async function api(path, body) {
    if (!process.env.UNISWAP_API_KEY) throw unavailable();
    const r = await fetcher(`https://liquidity.api.uniswap.org/lp/${path}`, {method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.UNISWAP_API_KEY},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
    if (!r.ok) throw unavailable(); return r.json();
  }
  async function state() {
    const block = await provider.getBlockNumber(), o={blockTag:block};
    const [token0,token1,fee,slot,liquidity] = await Promise.all([pool.token0(o),pool.token1(o),pool.fee(o),pool.slot0(o),pool.liquidity(o)]);
    if (lower(token0)!==SWAP_USDC || lower(token1)!==BRIDGED_TOKEN || fee!==3000n || slot.sqrtPriceX96<=0n) fail('Pool identity could not be verified.');
    return {block, sqrt:slot.sqrtPriceX96, tick:Number(slot.tick), liquidity:String(liquidity)};
  }
  async function position(tokenId, s, address) {
    const o={blockTag:s.block};
    const [p,owner] = await Promise.all([manager.positions(tokenId,o),manager.ownerOf(tokenId,o)]);
    if (address && lower(owner)!==address) fail('Connect the wallet that owns this position NFT.');
    if (lower(p.token0)!==SWAP_USDC || lower(p.token1)!==BRIDGED_TOKEN || p.fee!==3000n) return null;
    const supported = p.tickLower===BigInt(LP_LOWER) && p.tickUpper===BigInt(LP_UPPER);
    // eth_call from the owner computes current principal/fees without sending a transaction.
    const [principal,claimable] = await Promise.all([
      p.liquidity>0n ? manager.decreaseLiquidity.staticCall({tokenId,liquidity:p.liquidity,amount0Min:0,amount1Min:0,deadline:Math.floor(now()/1000)+3600},{...o,from:owner}) : [0n,0n],
      manager.collect.staticCall({tokenId,recipient:owner,amount0Max:MAX128,amount1Max:MAX128},{...o,from:owner}),
    ]);
    return {tokenId,owner:lower(owner),liquidity:String(p.liquidity),tickLower:Number(p.tickLower),tickUpper:Number(p.tickUpper),supported,inRange:s.tick>=Number(p.tickLower)&&s.tick<Number(p.tickUpper),amount0:String(principal[0]),amount1:String(principal[1]),claimable0:String(claimable[0]),claimable1:String(claimable[1])};
  }
  async function seedArt() {
    if(artCache.has(LP_SEED))return artCache.get(LP_SEED);
    try {
      const uri=await manager.tokenURI(LP_SEED);
      if(typeof uri!=='string'||uri.length>100000||!uri.startsWith('data:application/json;base64,'))return null;
      const metadata=JSON.parse(Buffer.from(uri.split(',')[1],'base64').toString());
      if(typeof metadata.image!=='string'||metadata.image.length>40000||!/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(metadata.image))return null;
      // Render only as an image resource, never as inline HTML/SVG or token text.
      artCache.set(LP_SEED,metadata.image);return metadata.image;
    }catch{return null;}
  }
  const service = {
    market() {
      if (cachedMarket && now()-cachedMarket.at<15000) return Promise.resolve(cachedMarket.value);
      if (marketPromise) return marketPromise;
      marketPromise=limited('read',async()=>{
        const s=await state(),o={blockTag:s.block};
        const [balance0,balance1,seed,seedImage]=await Promise.all([tokens[0].balanceOf(LP_POOL,o),tokens[1].balanceOf(LP_POOL,o),position(LP_SEED,s),seedArt()]);
        const value={pool:LP_POOL,manager:LP_MANAGER,chainId:SWAP_CHAIN,feePercent:.3,token0:SWAP_USDC,token1:BRIDGED_TOKEN,balance0:String(balance0),balance1:String(balance1),price0Per1:(2**192/Number(s.sqrt)**2),liquidity:s.liquidity,seed,seedImage,block:s.block,checkedAt:new Date(now()).toISOString()};
        cachedMarket={at:now(),value};return value;
      }).finally(()=>{marketPromise=null;}); return marketPromise;
    },
    wallet(address, cursor='0') {
      if (!isAddress(address) || /^0x0{40}$/i.test(address) || !/^\d{1,8}$/.test(cursor)) fail('Invalid wallet or position page.');
      address=lower(address);
      return limited('read',async()=>{
        const s=await state(),o={blockTag:s.block};
        const [count,balance0,balance1]=await Promise.all([manager.balanceOf(address,o),tokens[0].balanceOf(address,o),tokens[1].balanceOf(address,o)]);
        const end=BigInt(cursor)+10n<count?BigInt(cursor)+10n:count;
        const positions=[];
        for(let i=BigInt(cursor);i<end;i++) {
          const id=String(await manager.tokenOfOwnerByIndex(address,i,o));
          const p=await position(id,s,address);if(p) positions.push(p);
        }
        return {address,positions,balance0:String(balance0),balance1:String(balance1),nextCursor:end<count?String(end):null,block:s.block,checkedAt:new Date(now()).toISOString()};
      });
    },
    prepare(raw) {
      const input=lpInput(raw);
      return limited('write',async()=>{
        const s=await state(),p=input.action==='create'?null:await position(input.tokenId,s,input.address);
        if (input.action!=='create' && (!p || !p.supported)) fail('This interface manages full-range positions in this market only.');
        if (input.action==='remove' && BigInt(p.liquidity)===0n) fail('This position has no liquidity left to remove.');
        if (input.action==='collect' && BigInt(p.claimable0)+BigInt(p.claimable1)===0n) fail('No tokens are available to collect yet.');
        const common={walletAddress:input.address,chainId:SWAP_CHAIN,protocol:'V3',simulateTransaction:false};
        const pair={token0Address:SWAP_USDC,token1Address:BRIDGED_TOKEN};
        const timed={slippageTolerance:.5,deadline:Math.floor(now()/1000)+600};
        const amounts={independentToken:{tokenAddress:BRIDGED_TOKEN,amount:input.amountUnits}};
        const requests={
          create:['create',{...common,...timed,existingPool:{...pair,poolReference:LP_POOL},tickBounds:{tickLower:LP_LOWER,tickUpper:LP_UPPER},...amounts}],
          increase:['increase',{...common,...timed,...pair,nftTokenId:input.tokenId,...amounts}],
          remove:['decrease',{...common,...timed,...pair,nftTokenId:input.tokenId,liquidityPercentageToDecrease:input.percentage}],
          collect:['claim_fees',{...common,tokenId:input.tokenId}],
        };
        const [path,body]=requests[input.action],result=await api(path,body);
        const adding=['create','increase'].includes(input.action);
        let expected;
        if (adding) {
          if (lower(result.token0?.tokenAddress)!==SWAP_USDC || lower(result.token1?.tokenAddress)!==BRIDGED_TOKEN || !/^\d{1,7}$/.test(result.token0?.amount) || result.token1?.amount!==input.amountUnits) fail('Uniswap returned unexpected tokens.');
          // Independently bound the dependent amount by the live full-range ratio.
          const estimate=BigInt(input.amountUnits)*(1n<<192n)/(s.sqrt*s.sqrt),amount0=BigInt(result.token0.amount);
          if (amount0<=0n || amount0>1000000n || amount0<estimate*995n/1000n-2n || amount0>estimate*1005n/1000n+2n) fail('Market moved or matching USDC exceeds 1 token. Request less liquidity.');
          expected={amount0:result.token0.amount,amount1:input.amountUnits};
        } else if (input.action==='remove') {
          const liquidity=BigInt(p.liquidity)*BigInt(input.percentage)/100n;
          if (!liquidity) fail('Position is too small for that removal.');
          const amounts=await manager.decreaseLiquidity.staticCall({tokenId:input.tokenId,liquidity,amount0Min:0,amount1Min:0,deadline:timed.deadline},{blockTag:s.block,from:input.address});
          expected={liquidity:String(liquidity),amount0:String(amounts[0]),amount1:String(amounts[1])};
        } else expected={amount0:p.claimable0,amount1:p.claimable1};
        const transaction=validateLpTransaction(result[{create:'create',increase:'increase',remove:'decrease',collect:'claim'}[input.action]],input,expected,now());
        const approvals=[];
        if (adding) {
          for (const i of [0,1]) {
            const amount=BigInt(expected[`amount${i}`]),token=[SWAP_USDC,BRIDGED_TOKEN][i];
            const [balance,allowance]=await Promise.all([tokens[i].balanceOf(input.address),tokens[i].allowance(input.address,LP_MANAGER)]);
            if (balance<amount) fail(`Not enough ${i?'bridged aUSDd':'test USDC'}. Bridge or swap tokens first.`);
            if (allowance<amount) approvals.push({token,amount:String(amount),transaction:{from:input.address,to:token,data:tokenInterface.encodeFunctionData('approve',[LP_MANAGER,amount]),value:'0x0',chainId:'0xaa36a7'}});
          }
        }
        // Recheck ownership immediately before returning the unsigned request.
        if (p && lower(await manager.ownerOf(input.tokenId))!==input.address) fail('Position ownership changed. Refresh your wallet.');
        return {action:input.action,tokenId:input.tokenId??null,...expected,approvals,transaction,expiresAt:now()+90000,requestId:result.requestId,block:s.block};
      });
    },
    close:()=>provider.destroy(),
  };
  return service;
}
