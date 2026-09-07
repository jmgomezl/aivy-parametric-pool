if(!process.argv.includes('--execute'))throw Error('Operator testnet tool. Review the script and use --execute to authorize ledger operations.');
// Execute the exact transfer already validated by bridgeStatus; dedicated test wallet only.
import fs from 'node:fs';import {Wallet,JsonRpcProvider,keccak256,Interface} from 'ethers';
import {ITS,ITS_TOKEN_ID} from '../src/settlement/bridge.js';
const s=JSON.parse(fs.readFileSync(process.env.BRIDGE_STATUS_RECORD??'.artifacts/bridge-seed-status.json')),journal='.artifacts/bridge-seed-execution.json';
if(s.status!=='ready-to-deliver'||s.deliveryTransaction?.to!==ITS||s.recipient.toLowerCase()!=='0x18c5e6987a734638403bbd942e17d959952b8e4e'||s.amount!==100)throw Error('Not the expected seed transfer.');
const key=JSON.parse(fs.readFileSync('.artifacts/sepolia-verification-wallet.json')),p=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',11155111,{staticNetwork:true}),w=new Wallet(key.privateKey,p);
try{
 if(fs.existsSync(journal)){const j=JSON.parse(fs.readFileSync(journal));console.log({hash:j.hash,status:(await p.getTransactionReceipt(j.hash))?.status});}
 else{
  const tx={...s.deliveryTransaction,from:w.address,chainId:11155111},gas=(await p.estimateGas(tx))*120n/100n,fee=(await p.getFeeData()).gasPrice*150n/100n;
  if(gas>1000000n||gas*fee>2000000000000000n)throw Error('Gas budget exceeded.');
  const raw=await w.signTransaction({...tx,gasLimit:gas,gasPrice:fee,type:0,nonce:await p.getTransactionCount(w.address,'pending')});const hash=keccak256(raw);
  fs.writeFileSync(journal,JSON.stringify({hash,raw,sourceHash:s.sourceHash}),{mode:0o600});await p.broadcastTransaction(raw);let receipt;try{receipt=await p.waitForTransaction(hash,1,45000);}catch{}
  console.log({hash,status:receipt?.status});
 }
}finally{p.destroy();}
