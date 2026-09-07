// Trading API execution for the pinned, canonically bridged test token only.
import {randomUUID} from 'node:crypto';
import {AbiCoder,Interface,isAddress,TypedDataEncoder,verifyTypedData} from 'ethers';
import {SWAP_ROUTER,SWAP_USDC} from './testnetSwap.js';
export const BRIDGED_TOKEN='0x5685b5660a86028d8a50c9e4fc33ff081b3cd9e9';
export const PERMIT2='0x000000000022d473030f116ddee9f6b43ac78ba3';
export const PERMIT_TYPES={PermitSingle:[{name:'details',type:'PermitDetails'},{name:'spender',type:'address'},{name:'sigDeadline',type:'uint256'}],PermitDetails:[{name:'token',type:'address'},{name:'amount',type:'uint160'},{name:'expiration',type:'uint48'},{name:'nonce',type:'uint48'}]};
const abi=AbiCoder.defaultAbiCoder(),router=new Interface(['function execute(bytes commands,bytes[] inputs,uint256 deadline) payable']),erc20=new Interface(['function approve(address,uint256) returns(bool)']);
const fail=message=>{throw Object.assign(Error(message),{status:400});};
export function bridgedInput(input){
 if(!input||Object.keys(input).some(k=>!['address','amountUnits'].includes(k))||!isAddress(input.address)||/^0x0{40}$/i.test(input.address)||typeof input.amountUnits!=='string'||!/^\d{1,7}$/.test(input.amountUnits))fail('Invalid bridged-token swap.');
 const units=BigInt(input.amountUnits);if(units<10000n||units>1000000n)fail('Swap 0.01–1 bridged aUSDd per transaction.');return {address:input.address.toLowerCase(),amountUnits:units.toString()};
}
export function validatePermit(permit,input,now=Date.now()){
 if(!permit)return null;
 const {domain,values,types}=permit,seconds=Math.floor(now/1000);
 if(domain?.name!=='Permit2'||Number(domain.chainId)!==11155111||domain.verifyingContract?.toLowerCase()!==PERMIT2||values?.details?.token?.toLowerCase()!==BRIDGED_TOKEN||String(values.details.amount)!==input.amountUnits||values.spender?.toLowerCase()!==SWAP_ROUTER)fail('Permit does not match the swap.');
 if(BigInt(values.details.expiration)<BigInt(seconds)||BigInt(values.details.expiration)>BigInt(seconds+31*86400)||BigInt(values.sigDeadline)<BigInt(seconds)||BigInt(values.sigDeadline)>BigInt(seconds+3600))fail('Permit validity is outside the allowed window.');
 const expected={name:'Permit2',chainId:11155111,verifyingContract:PERMIT2};
 if(TypedDataEncoder.hash(domain,types,values)!==TypedDataEncoder.hash(expected,PERMIT_TYPES,values))fail('Unsupported permit schema.');
 return {domain:expected,types:PERMIT_TYPES,values};
}
export function validateBridgedQuote(q,input){
 if(q.chainId!==11155111||q.swapper?.toLowerCase()!==input.address||q.tradeType!=='EXACT_INPUT'||q.input?.token?.toLowerCase()!==BRIDGED_TOKEN||q.input.amount!==input.amountUnits||q.output?.token?.toLowerCase()!==SWAP_USDC||q.output.recipient?.toLowerCase()!==input.address||q.slippage!==.5)fail('Unexpected quote terms.');
 const minimum=BigInt(q.output.minimumAmount),output=BigInt(q.output.amount);if(minimum<=0n||minimum>output||minimum*10000n<output*9950n-10000n)fail('Invalid minimum output.');
}
export function validateBridgedTransaction(tx,q,input,permit,signature,now=Date.now()){
 if(tx.chainId!==11155111||tx.to?.toLowerCase()!==SWAP_ROUTER||tx.from?.toLowerCase()!==input.address||BigInt(tx.value)!==0n)fail('Unexpected swap transaction.');
 validateBridgedQuote(q,input);
 const minimum=BigInt(q.output.minimumAmount);
 const parsed=router.parseTransaction({data:tx.data}),expected=permit?'0x0a00':'0x00';
 if(!parsed||parsed.args.commands!==expected||parsed.args.inputs.length!==(permit?2:1)||Number(parsed.args.deadline)<now/1000+30||Number(parsed.args.deadline)>now/1000+3600)fail('Unsupported router commands.');
 if(permit){const [decoded,sig]=abi.decode(['tuple(tuple(address token,uint160 amount,uint48 expiration,uint48 nonce) details,address spender,uint256 sigDeadline)','bytes'],parsed.args.inputs[0]);
  if(decoded.details.token.toLowerCase()!==BRIDGED_TOKEN||decoded.details.amount!==BigInt(input.amountUnits)||decoded.details.expiration!==BigInt(permit.values.details.expiration)||decoded.details.nonce!==BigInt(permit.values.details.nonce)||decoded.spender.toLowerCase()!==SWAP_ROUTER||decoded.sigDeadline!==BigInt(permit.values.sigDeadline)||sig.toLowerCase()!==signature.toLowerCase())fail('Router permit mismatch.');
 }
 const [recipient,amountIn,minOut,path,payer]=abi.decode(['address','uint256','uint256','bytes','bool'],parsed.args.inputs[permit?1:0]);
 if(![input.address,'0x0000000000000000000000000000000000000001'].includes(recipient.toLowerCase())||amountIn!==BigInt(input.amountUnits)||minOut!==minimum||!payer||path.toLowerCase()!=='0x'+BRIDGED_TOKEN.slice(2)+'000bb8'+SWAP_USDC.slice(2))fail('Swap path or recipient mismatch.');
 return {from:input.address,to:SWAP_ROUTER,data:tx.data,value:'0x0',chainId:'0xaa36a7'};
}
export function createBridgedSwap({fetcher=fetch,now=Date.now}={}){
 const drafts=new Map();let windowStart=now(),calls=0,active=0;
 const api=async(path,body)=>{const r=await fetcher('https://trade-api.gateway.uniswap.org/v1/'+path,{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.UNISWAP_API_KEY??'','x-universal-router-version':'2.0'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Object.assign(Error('Uniswap route unavailable. Request a new quote.'),{status:503});return r.json();};
 const limit=()=>{if(now()-windowStart>60000){calls=0;windowStart=now();}if(calls++>=20||active>=3)throw Object.assign(Error('Swap quote limit reached.'),{status:429});};
 return {
  async prepare(raw){const input=bridgedInput(raw);limit();active++;try{
   for(const[id,d]of drafts)if(d.expiresAt<=now())drafts.delete(id);if(drafts.size>=100)throw Object.assign(Error('Swap drafts full. Try later.'),{status:429});
   const result=await api('quote',{type:'EXACT_INPUT',tokenInChainId:11155111,tokenOutChainId:11155111,tokenIn:BRIDGED_TOKEN,tokenOut:SWAP_USDC,amount:input.amountUnits,swapper:input.address,slippageTolerance:.5,protocols:['V3'],permitAmount:'EXACT'});
   if(result.routing!=='CLASSIC'||result.permitTransaction)fail('Unsupported swap authorization.');
   validateBridgedQuote(result.quote,input);
   const permit=validatePermit(result.permitData,input,now());
   const id=randomUUID(),expiresAt=now()+120000;drafts.set(id,{input,quote:result.quote,permit,expiresAt});
   return {ok:true,id,expiresAt,permit,amountOut:result.quote.output.amount,minimumOut:result.quote.output.minimumAmount,approval:{from:input.address,to:BRIDGED_TOKEN,data:erc20.encodeFunctionData('approve',[PERMIT2,input.amountUnits]),value:'0x0',chainId:'0xaa36a7'}};
  }finally{active--;}}
  ,async build(raw){if(!raw||Object.keys(raw).some(k=>!['id','signature'].includes(k)))fail('Unsupported signature request.');const d=drafts.get(raw.id);if(!d||d.expiresAt<=now())fail('Quote expired. Request a new quote.');limit();active++;try{
   if(d.permit&&verifyTypedData(d.permit.domain,d.permit.types,d.permit.values,raw.signature).toLowerCase()!==d.input.address)fail('Permit signer does not match the wallet.');
   if(!d.permit&&raw.signature)fail('Unexpected signature.');
   const result=await api('swap',{quote:d.quote,...(d.permit?{permitData:d.permit,signature:raw.signature}:{}),simulateTransaction:false});
   return {ok:true,transaction:validateBridgedTransaction(result.swap,d.quote,d.input,d.permit,raw.signature,now()),expiresAt:now()+30000};
  }finally{active--;}}
 };
}
