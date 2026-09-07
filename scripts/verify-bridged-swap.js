if(!process.argv.includes('--execute'))throw Error('Operator testnet tool. Review the script and use --execute to authorize ledger operations.');
import 'dotenv/config';import fs from 'node:fs';import {JsonRpcProvider,Wallet,Contract,keccak256}from'ethers';
import{createBridgedSwap,BRIDGED_TOKEN}from'../src/settlement/bridgedSwap.js';import{SWAP_USDC}from'../src/settlement/testnetSwap.js';
const p=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',11155111,{staticNetwork:true}),k=JSON.parse(fs.readFileSync('.artifacts/sepolia-verification-wallet.json')),w=new Wallet(k.privateKey,p),file='.artifacts/bridged-swap-verification.json';
const journal=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{steps:{},address:w.address};const save=()=>fs.writeFileSync(file,JSON.stringify(journal,null,2),{mode:0o600});
async function send(name,prepared){if(journal.steps[name]){const r=await p.getTransactionReceipt(journal.steps[name].hash);if(r?.status!==1)throw Error('Previous transaction not confirmed; inspect its hash.');return r;}
 const {chainId:_,...tx}=prepared,gas=(await p.estimateGas(tx))*120n/100n,fee=(await p.getFeeData()).gasPrice*150n/100n;if(gas>500000n||gas*fee>1000000000000000n)throw Error('Gas budget exceeded.');
 const raw=await w.signTransaction({...tx,chainId:11155111,gasLimit:gas,gasPrice:fee,type:0,nonce:await p.getTransactionCount(w.address,'pending')}),hash=keccak256(raw);journal.steps[name]={hash,raw};save();await p.broadcastTransaction(raw);const r=await p.waitForTransaction(hash,1,45000);if(r?.status!==1)throw Error('Transaction not confirmed.');return r;
}
try{
 const token=new Contract(BRIDGED_TOKEN,['function balanceOf(address) view returns(uint256)'],p),usdc=new Contract(SWAP_USDC,['function balanceOf(address) view returns(uint256)'],p);
 if(!journal.before){journal.before={ausdd:String(await token.balanceOf(w.address)),usdc:String(await usdc.balanceOf(w.address))};save();}
 if(!journal.steps.swap){const service=createBridgedSwap(),q=await service.prepare({address:w.address,amountUnits:'10000'});await send('approval',q.approval);const signature=q.permit?await w.signTypedData(q.permit.domain,q.permit.types,q.permit.values):undefined;const built=await service.build({id:q.id,...(signature?{signature}:{})});await send('swap',built.transaction);}
 journal.after={ausdd:String(await token.balanceOf(w.address)),usdc:String(await usdc.balanceOf(w.address))};journal.status=(await p.getTransactionReceipt(journal.steps.swap.hash))?.status===1?'CONFIRMED':'PENDING';save();console.log(JSON.stringify({status:journal.status,before:journal.before,after:journal.after,approval:journal.steps.approval.hash,swap:journal.steps.swap.hash}));
}finally{p.destroy();}
