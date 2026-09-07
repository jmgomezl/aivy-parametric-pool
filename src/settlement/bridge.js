// Testnet canonical ITS bridge. API callers cannot choose contracts, networks, or assets.
import fs from 'node:fs';
import {isAddress,Contract,JsonRpcProvider,Interface} from 'ethers';
export const ITS_ACCOUNT='0.0.6757567';
export const ITS='0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C';
export const BRIDGE_TOKEN='0x00000000000000000000000000000000009e4b7b';
export const ITS_TOKEN_ID='0x68aec7c50e0386a3af5d9c8a8f94cdad6206ac78bbac7d3665d7641e8e0af96c';
export const bridgeInterface=new Interface(['function interchainTransfer(bytes32 tokenId,string destinationChain,bytes destinationAddress,uint256 amount,bytes metadata,uint256 gasValue) payable']);
const invalid=message=>{throw Object.assign(Error(message),{status:400});};
export function bridgeInput(input){
 if(!input||Object.keys(input).some(k=>!['requestId','amount','recipient'].includes(k)))invalid('Unsupported bridge fields.');
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId??'')||!isAddress(input.recipient)||/^0x0{40}$/i.test(input.recipient))invalid('Choose a valid recipient and request identifier.');
 if(typeof input.amount!=='number'||!Number.isFinite(input.amount)||input.amount<.01||input.amount>10||Math.abs(input.amount*100-Math.round(input.amount*100))>1e-7)invalid('Bridge 0.01–10 test aUSDd, with up to two decimals.');
 return {...input,recipient:input.recipient.toLowerCase(),units:Math.round(input.amount*1e6)};
}
export function gasTinybars(feeWei){
 if(typeof feeWei!=='string'||!/^\d{1,22}$/.test(feeWei))throw Error('Invalid bridge fee estimate.');
 const tinybars=(BigInt(feeWei)+9999999999n)/10000000000n;
 if(tinybars<=0n||tinybars>100000000n)throw Error('Bridge gas exceeds the 1 testnet HBAR limit.');
 return tinybars;
}
export async function bridgeGas(){
 const r=await fetch('https://testnet.api.gmp.axelarscan.io',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method:'estimateITSFee',sourceChain:'hedera',destinationChain:'ethereum-sepolia',event:'InterchainTransfer',gasLimit:300000,gasMultiplier:1.2}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Bridge gas estimate unavailable.');const text=(await r.text()).trim();return gasTinybars(text.startsWith('"')?JSON.parse(text):text);
}
export function bridgeConfig(){
 const j=JSON.parse(fs.readFileSync('.artifacts/axelar-bridge-testnet.json','utf8'));
 if(j.network!=='testnet'||j.sourceChain!==296||j.destinationChain!==11155111||j.sourceToken?.toLowerCase()!==BRIDGE_TOKEN||j.service!==ITS||j.interchainTokenId!==ITS_TOKEN_ID||!isAddress(j.destinationToken))throw Object.assign(Error('Bridge destination is not ready.'),{status:503});
 return {network:'testnet',sourceTokenId:j.sourceTokenId,destinationToken:j.destinationToken,service:ITS,interchainTokenId:ITS_TOKEN_ID};
}
export async function confirmBridgeDestination(){
 const config=bridgeConfig(),p=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',11155111,{staticNetwork:true});
 try{const source=await fetch('https://testnet.mirrornode.hedera.com/api/v1/contracts/'+ITS_ACCOUNT,{signal:AbortSignal.timeout(10000)});if(!source.ok||(await source.json()).evm_address?.toLowerCase()!==ITS.toLowerCase())throw Error('Bridge source contract verification failed.');const service=new Contract(ITS,['function registeredTokenAddress(bytes32) view returns(address)'],p);if((await service.registeredTokenAddress(ITS_TOKEN_ID)).toLowerCase()!==config.destinationToken.toLowerCase())throw Error('Bridge deployment verification failed.');return config;}finally{p.destroy();}
}
export function bridgeCalldata(recipient,units,tinybars){
 return bridgeInterface.encodeFunctionData('interchainTransfer',[ITS_TOKEN_ID,'ethereum-sepolia',recipient,units,'0x',tinybars]);
}
const sourceEvents=new Interface(['event InterchainTransfer(bytes32 indexed tokenId,address indexed sourceAddress,string destinationChain,bytes destinationAddress,uint256 amount,bytes32 indexed dataHash)']);
const destinationEvents=new Interface(['event InterchainTransferReceived(bytes32 indexed commandId,bytes32 indexed tokenId,string sourceChain,bytes sourceAddress,address indexed destinationAddress,uint256 amount,bytes32 dataHash)']);
const executeInterface=new Interface(['function execute(bytes32 commandId,string sourceChain,string sourceAddress,bytes payload)']);
export function verifyBridgeSource(source,action){
 if(source.result!=='SUCCESS')throw Error('Source transaction failed.');
 const event=source.logs.filter(l=>l.address.toLowerCase()===ITS.toLowerCase()).map(l=>{try{return sourceEvents.parseLog(l);}catch{return null;}}).find(e=>e?.name==='InterchainTransfer');
 if(!event||event.args.tokenId!==ITS_TOKEN_ID||event.args.destinationChain!=='ethereum-sepolia'||event.args.destinationAddress.toLowerCase()!==action.recipient.toLowerCase()||event.args.amount!==BigInt(Math.round(action.amount*1e6)))throw Error('Source transfer does not match the recorded request.');
 return event;
}
export async function bridgeStatus(action){
 if(action.kind!=='bridge'||action.status!=='complete'||!action.result?.bridgeTxId)throw Object.assign(Error('Source bridge transaction is not confirmed.'),{status:409});
 const id=action.result.bridgeTxId.replace('@','-').replace(/\.(\d+)$/,'-$1');
 const r=await fetch('https://testnet.mirrornode.hedera.com/api/v1/contracts/results/'+id,{signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Source receipt is not indexed yet.');const source=await r.json();
 const event=verifyBridgeSource(source,action);
 const result={ok:true,status:'in-transit',sourceHash:source.hash,sourceTxId:action.result.bridgeTxId,recipient:action.recipient,amount:action.amount,explorer:'https://testnet.axelarscan.io/gmp/'+source.hash};
 const find=async hash=>{const response=await fetch('https://testnet.api.gmp.axelarscan.io',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method:'searchGMP',txHash:hash,size:10}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Bridge status unavailable.');return (await response.json()).data??[];};
 const rows=await find(source.hash),parent=rows.find(x=>x.call?.transactionHash?.toLowerCase()===source.hash.toLowerCase());
 if(!parent?.callback?.messageIdHash)return result;
 const children=await find(parent.callback.messageIdHash),child=children.find(x=>x.id===parent.callback.id);
 if(!child)return result;
 const p=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',11155111,{staticNetwork:true});
 try{
  if(child.executed?.transactionHash){
   const receipt=await p.getTransactionReceipt(child.executed.transactionHash);
   const received=receipt?.logs.filter(l=>l.address.toLowerCase()===ITS.toLowerCase()).map(l=>{try{return destinationEvents.parseLog(l);}catch{return null;}}).find(e=>e?.name==='InterchainTransferReceived');
   if(receipt?.status===1&&received?.args.commandId===child.command_id&&received.args.tokenId===ITS_TOKEN_ID&&received.args.sourceChain==='hedera'&&received.args.sourceAddress.toLowerCase()===event.args.sourceAddress.toLowerCase()&&received.args.destinationAddress.toLowerCase()===action.recipient.toLowerCase()&&received.args.amount===event.args.amount)return {...result,status:'delivered',destinationHash:receipt.hash};
  }
  if(child.approved){
   const call=child.call.returnValues,approved=child.approved.returnValues;
   // The calldata is accepted only if the gateway's on-chain approval binds it.
   const gateway=new Contract('0xe432150cce91c13a887f7D836923d5597adD8E31',['function isContractCallApproved(bytes32,string,string,address,bytes32) view returns(bool)'],p);
   const {keccak256,AbiCoder}=await import('ethers');
   const [kind,from,payload]=AbiCoder.defaultAbiCoder().decode(['uint256','string','bytes'],call.payload);
   const [messageType,tokenId,sourceAddress,destinationAddress,amount,data]=AbiCoder.defaultAbiCoder().decode(['uint256','bytes32','bytes','bytes','uint256','bytes'],payload);
   if(kind!==4n||from!=='hedera'||messageType!==0n||tokenId!==ITS_TOKEN_ID||sourceAddress.toLowerCase()!==event.args.sourceAddress.toLowerCase()||destinationAddress.toLowerCase()!==action.recipient.toLowerCase()||amount!==event.args.amount||data!=='0x'||call.destinationContractAddress?.toLowerCase()!==ITS.toLowerCase()||call.destinationChain!=='ethereum-sepolia'||approved.sourceChain!=='axelar'||approved.sourceAddress!==call.sender||keccak256(call.payload)!==approved.payloadHash)throw Error('Destination payload does not match the bridge.');
   if(await gateway.isContractCallApproved(child.command_id,'axelar',call.sender,ITS,approved.payloadHash))return {...result,status:'ready-to-deliver',deliveryTransaction:{chainId:'0xaa36a7',to:ITS,value:'0x0',data:executeInterface.encodeFunctionData('execute',[child.command_id,'axelar',call.sender,call.payload])}};
  }
  return result;
 }finally{p.destroy();}
}
