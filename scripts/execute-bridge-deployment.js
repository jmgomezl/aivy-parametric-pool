if(!process.argv.includes('--execute'))throw Error('Operator testnet tool. Review the script and use --execute to authorize ledger operations.');
// Permissionless execution of an already-approved Axelar command, bound to this token.
import fs from 'node:fs';import {Wallet,JsonRpcProvider,Contract,keccak256,AbiCoder,Transaction} from 'ethers';
import {ITS,ITS_TOKEN_ID} from '../src/settlement/bridge.js';
const record=JSON.parse(fs.readFileSync(process.env.BRIDGE_GMP_RECORD??'.artifacts/bridge-gmp-record.json')).data.find(x=>x.interchain_token_deployment_started?.tokenId==='68aec7c50e0386a3af5d9c8a8f94cdad6206ac78bbac7d3665d7641e8e0af96c');
if(!record?.approved)throw Error('Axelar approval missing.');
const call=record.call.returnValues,approved=record.approved.returnValues;
const [kind,source,payload]=AbiCoder.defaultAbiCoder().decode(['uint256','string','bytes'],call.payload);
const [messageType,tokenId]=AbiCoder.defaultAbiCoder().decode(['uint256','bytes32'],payload);
if(kind!==4n||source!=='hedera'||messageType!==1n||tokenId!==ITS_TOKEN_ID||call.destinationChain!=='ethereum-sepolia'||call.destinationContractAddress.toLowerCase()!==ITS.toLowerCase()||keccak256(call.payload)!==approved.payloadHash||approved.sourceChain!=='axelar'||approved.sourceAddress!==call.sender)throw Error('Mismatched bridge command.');
const key=JSON.parse(fs.readFileSync('.artifacts/sepolia-verification-wallet.json')),p=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',11155111,{staticNetwork:true}),wallet=new Wallet(key.privateKey,p),journal='.artifacts/axelar-destination-execution.json';
try{
 if(fs.existsSync(journal)){
  const j=JSON.parse(fs.readFileSync(journal));let r=await p.getTransactionReceipt(j.hash);
  if(!r&&process.argv.includes('--speed-up')){
   const pending=await p.getTransaction(j.hash);if(!pending||pending.blockNumber!==null)throw Error('Pending transaction not verified.');
   const current=(await p.getFeeData()).gasPrice,old=Transaction.from(j.raw),fee=current*150n/100n>old.gasPrice*125n/100n?current*150n/100n:old.gasPrice*125n/100n;
   if(fee*old.gasLimit>3000000000000000n)throw Error('Replacement exceeds gas budget.');
   const raw=await wallet.signTransaction({to:old.to,data:old.data,value:old.value,nonce:old.nonce,gasLimit:old.gasLimit,gasPrice:fee,chainId:11155111,type:0});
   j.previous??=[];j.previous.push(j.hash);j.hash=keccak256(raw);j.raw=raw;fs.writeFileSync(journal,JSON.stringify(j),{mode:0o600});
   await p.broadcastTransaction(raw);try{r=await p.waitForTransaction(j.hash,1,45000);}catch{};
  }
  console.log({hash:j.hash,status:r?.status});
 }
 else{
  const gateway=new Contract('0xe432150cce91c13a887f7D836923d5597adD8E31',['function isContractCallApproved(bytes32,string,string,address,bytes32) view returns(bool)'],p);
  if(!await gateway.isContractCallApproved(record.command_id,'axelar',call.sender,ITS,approved.payloadHash))throw Error('Command is not currently approved.');
  const service=new Contract(ITS,['function execute(bytes32,string,string,bytes)'],wallet);
  const tx=await service.execute.populateTransaction(record.command_id,'axelar',call.sender,call.payload);
  const gas=await p.estimateGas({...tx,from:wallet.address}),fee=(await p.getFeeData()).gasPrice;
  if(!fee||gas>3000000n||gas*fee>3000000000000000n)throw Error('Deployment execution gas exceeds test budget.');
  const raw=await wallet.signTransaction({...tx,chainId:11155111,gasLimit:gas*120n/100n,gasPrice:fee,type:0,nonce:await p.getTransactionCount(wallet.address,'pending')});
  const j={hash:keccak256(raw),raw,commandId:record.command_id};fs.writeFileSync(journal,JSON.stringify(j),{mode:0o600});
  await p.broadcastTransaction(raw);const r=await p.waitForTransaction(j.hash,1,45000);console.log({hash:j.hash,status:r?.status});
 }
}finally{p.destroy();}
