// Operator-only, testnet-only canonical ITS setup. Existing bridge contracts; no custom Solidity.
import fs from 'node:fs';
import {Contract,Interface,JsonRpcProvider} from 'ethers';
import {ContractExecuteTransaction,ContractId,Hbar,TokenId} from '@hiero-ledger/sdk';
import {client,NETWORK,assertOperatorKey} from '../src/config.js';
import {load} from '../src/registry.js';
const file='.artifacts/axelar-bridge-testnet.json',execute=process.argv.includes('--execute');
const FACTORY='0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D66',ITS='0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C';
if(NETWORK!=='testnet')throw Error('Testnet only.');
const reg=load(NETWORK),token='0x'+TokenId.fromString(reg.demoTokenId).toEvmAddress();
const source=new JsonRpcProvider('https://testnet.hashio.io/api',296,{staticNetwork:true}),destination=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',11155111,{staticNetwork:true});
const factoryAbi=['function canonicalInterchainTokenId(address) view returns(bytes32)','function registerCanonicalInterchainToken(address) payable returns(bytes32)','function deployRemoteCanonicalInterchainToken(address,string,uint256) payable returns(bytes32)'];
const factory=new Contract(FACTORY,factoryAbi,source),iface=new Interface(factoryAbi),serviceAbi=['function registeredTokenAddress(bytes32) view returns(address)'];
const srcService=new Contract(ITS,serviceAbi,source),dstService=new Contract(ITS,serviceAbi,destination);
const state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{network:'testnet',sourceChain:296,destinationChain:11155111,sourceToken:token,sourceTokenId:reg.demoTokenId,factory:FACTORY,service:ITS,steps:{}};
if(state.sourceToken!==token)throw Error('Bridge asset changed.');
const save=()=>fs.writeFileSync(file,JSON.stringify(state,null,2),{mode:0o600});
let c;
try{
 state.interchainTokenId=await factory.canonicalInterchainTokenId(token);
 const lookup=async service=>{try{return await service.registeredTokenAddress(state.interchainTokenId);}catch{return null;}};
 state.sourceRegistered=await lookup(srcService);state.destinationToken=await lookup(dstService);
 const send=async(name,args,valueWei=0n)=>{
  if(state.steps[name]&&state.steps[name].status!=='CONTRACT_REVERT_EXECUTED')throw Error(`${name} already submitted. Reconcile its transaction before repeating.`);
  await assertOperatorKey();c??=client();
  const tinybars=(valueWei+9999999999n)/10000000000n;
  if(tinybars>100000000n)throw Error('Cross-chain gas exceeds 1 testnet HBAR cap.');
  const tx=new ContractExecuteTransaction().setContractId(ContractId.fromEvmAddress(0,0,FACTORY)).setGas(4000000).setFunctionParameters(Buffer.from(iface.encodeFunctionData(name,args).slice(2),'hex')).setPayableAmount(Hbar.fromTinybars(tinybars.toString())).setMaxTransactionFee(new Hbar(30)).freezeWith(c);
  if(state.steps[name]){state.history??=[];state.history.push({step:name,...state.steps[name]});}
  state.steps[name]={transaction:tx.transactionId.toString(),status:'PREPARED'};save();
  const sent=await tx.execute(c);state.steps[name].status='SUBMITTED';save();
  try{const receipt=await sent.getReceipt(c);state.steps[name].status=receipt.status.toString();save();}catch(e){if(e.status?.toString()==='CONTRACT_REVERT_EXECUTED'){state.steps[name].status='CONTRACT_REVERT_EXECUTED';save();}throw e;}
 };
 for(const step of Object.values(state.steps))if(step.status==='SUBMITTED'){
  const tid=step.transaction.replace('@','-').replace(/\.(\d+)$/,'-$1');
  const response=await fetch('https://testnet.mirrornode.hedera.com/api/v1/contracts/results/'+tid);
  if(response.ok){const result=await response.json();if(['SUCCESS','CONTRACT_REVERT_EXECUTED'].includes(result.result)){step.status=result.result;save();}}
 }
 if(!state.sourceRegistered&&execute){await send('registerCanonicalInterchainToken',[token]);state.sourceRegistered=token;save();}
 if(!state.destinationToken&&state.sourceRegistered&&execute&&(!state.steps.deployRemoteCanonicalInterchainToken||state.steps.deployRemoteCanonicalInterchainToken.status==='CONTRACT_REVERT_EXECUTED')){
  const response=await fetch('https://testnet.api.gmp.axelarscan.io',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method:'estimateITSFee',sourceChain:'hedera',destinationChain:'ethereum-sepolia',event:'InterchainTokenDeployment',gasLimit:2000000,gasMultiplier:1.2}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Axelar gas estimate unavailable.');
  const feeText=(await response.text()).trim();const fee=BigInt(feeText.startsWith('"')?JSON.parse(feeText):feeText);
  // Hedera SDK attaches tinybars; round the ABI gas value to the same amount.
  const value=(fee+9999999999n)/10000000000n*10000000000n;
  await send('deployRemoteCanonicalInterchainToken',[token,'ethereum-sepolia',value/10000000000n],value);
 }
 save();console.log(JSON.stringify(state,null,2));
}finally{source.destroy();destination.destroy();c?.close();}
