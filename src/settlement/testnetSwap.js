// Wallet-approved native-input swaps only. No server signing or bridge authority.
import {AbiCoder,Interface,isAddress} from 'ethers';
export const SWAP_CHAIN=11155111;
export const SWAP_ROUTER='0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b';
export const SWAP_USDC='0x1c7d4b196cb0c7b01d743fbc6116a902379c7238';
const WETH='fff9976782d46cc05630d1f6ebab18b2324d6b14';
const NATIVE='0x0000000000000000000000000000000000000000';
const abi=AbiCoder.defaultAbiCoder(),router=new Interface(['function execute(bytes commands,bytes[] inputs,uint256 deadline) payable']);
const fail=message=>{throw Object.assign(Error(message),{status:400});};
export function swapInput(input){
 if(!input||Object.keys(input).some(k=>!['address','amountWei'].includes(k)))fail('Unsupported swap fields.');
 if(!isAddress(input.address)||/^0x0{40}$/i.test(input.address))fail('Connect a valid EVM wallet.');
 if(typeof input.amountWei!=='string'||!/^\d{1,17}$/.test(input.amountWei))fail('Invalid ETH amount.');
 const amount=BigInt(input.amountWei);
 if(amount<10000000000000n||amount>10000000000000000n)fail('Choose 0.00001–0.01 Sepolia ETH.');
 return {address:input.address.toLowerCase(),amountWei:amount.toString()};
}
export function validateSwap(tx,quote,input,now=Date.now()){
 const {address,amountWei}=swapInput(input);
 if(!tx||tx.chainId!==SWAP_CHAIN||tx.to?.toLowerCase()!==SWAP_ROUTER||tx.from?.toLowerCase()!==address||BigInt(tx.value)!==BigInt(amountWei))fail('Swap transaction does not match your request.');
 if(quote.chainId!==SWAP_CHAIN||quote.swapper?.toLowerCase()!==address||quote.tradeType!=='EXACT_INPUT'||quote.input?.token!==NATIVE||quote.input?.amount!==amountWei||quote.output?.token?.toLowerCase()!==SWAP_USDC||quote.output?.recipient?.toLowerCase()!==address)fail('Quote does not match your request.');
 const output=BigInt(quote.output.amount),minimum=BigInt(quote.output.minimumAmount);
 if(output<=0n||minimum<=0n||minimum>output||minimum*10000n<output*9950n-10000n||quote.slippage!==0.5)fail('Invalid output protection.');
 const parsed=router.parseTransaction({data:tx.data});
 if(!parsed||parsed.args.commands!=='0x0b00'||parsed.args.inputs.length!==2)fail('Unsupported swap route. Try a new quote.');
 const deadline=Number(parsed.args.deadline);
 if(deadline<=Math.floor(now/1000)+60||deadline>Math.floor(now/1000)+3600)fail('Invalid swap deadline.');
 const [wrapTo,wrapAmount]=abi.decode(['address','uint256'],parsed.args.inputs[0]);
 const [recipient,amountIn,minOut,path,payerIsUser]=abi.decode(['address','uint256','uint256','bytes','bool'],parsed.args.inputs[1]);
 if(wrapTo.toLowerCase()!=='0x0000000000000000000000000000000000000002'||wrapAmount!==BigInt(amountWei)||amountIn!==BigInt(amountWei)||minOut!==minimum||payerIsUser||![address,'0x0000000000000000000000000000000000000001'].includes(recipient.toLowerCase()))fail('Unsafe swap commands.');
 // One V3 pool, canonical WETH -> Circle test USDC. No split or arbitrary calls.
 const p=path.toLowerCase().slice(2);
 if(p.length!==86||!p.startsWith(WETH)||!p.endsWith(SWAP_USDC.slice(2))||!['000064','0001f4','000bb8','002710'].includes(p.slice(40,46)))fail('Unsupported token route.');
 return {from:address,to:SWAP_ROUTER,data:tx.data,value:'0x'+BigInt(amountWei).toString(16),chainId:'0xaa36a7'};
}
export function createTestnetSwap({fetcher=fetch,now=Date.now}={}){
 let start=now(),count=0,active=0;
 return async input=>{
  const checked=swapInput(input);
  if(now()-start>=60000){start=now();count=0;}
  if(count>=20||active>=3)throw Object.assign(Error('Swap quotes are busy. Try again shortly.'),{status:429});
  count++;active++;
  try{
   const call=async(path,body)=>{
    const r=await fetcher('https://trade-api.gateway.uniswap.org/v1/'+path,{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.UNISWAP_API_KEY??'','x-universal-router-version':'2.0'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw Object.assign(Error('Uniswap testnet route unavailable. Retry shortly.'),{status:503});
    return r.json();
   };
   const q=await call('quote',{type:'EXACT_INPUT',tokenInChainId:SWAP_CHAIN,tokenOutChainId:SWAP_CHAIN,tokenIn:NATIVE,tokenOut:SWAP_USDC,amount:checked.amountWei,swapper:checked.address,slippageTolerance:.5,protocols:['V3']});
   if(q.routing!=='CLASSIC'||q.permitData||q.permitTransaction)fail('Unsupported authorization route.');
   const built=await call('swap',{quote:q.quote,simulateTransaction:false});
   const transaction=validateSwap(built.swap,q.quote,checked,now());
   return {ok:true,network:'Ethereum Sepolia',chainId:SWAP_CHAIN,tokenOut:SWAP_USDC,amountWei:checked.amountWei,amountOut:q.quote.output.amount,minimumOut:q.quote.output.minimumAmount,quoteId:q.quote.quoteId,expiresAt:now()+60000,transaction};
  }finally{active--;}
 };
}
