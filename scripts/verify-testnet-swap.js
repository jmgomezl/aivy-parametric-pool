// Dedicated QA wallet only. Journals signed transaction BEFORE broadcast; resumes without a duplicate swap.
import 'dotenv/config';
import fs from 'node:fs';
import {Wallet,JsonRpcProvider,Contract,keccak256} from 'ethers';
import {createTestnetSwap,SWAP_USDC} from '../src/settlement/testnetSwap.js';
const walletFile='.artifacts/sepolia-verification-wallet.json',journalFile='.artifacts/sepolia-swap-verification.json';
const data=JSON.parse(fs.readFileSync(walletFile));if(data.chainId!==11155111)throw Error('Verification wallet must be testnet only.');
const p=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',11155111,{staticNetwork:true}),w=new Wallet(data.privateKey,p);
const save=j=>fs.writeFileSync(journalFile,JSON.stringify(j,null,2),{mode:0o600});
try{
 if((await p.getNetwork()).chainId!==11155111n)throw Error('Wrong RPC chain.');
 const token=new Contract(SWAP_USDC,['function balanceOf(address) view returns(uint256)'],p);
 let j=fs.existsSync(journalFile)?JSON.parse(fs.readFileSync(journalFile)):null;
 if(j){
  const receipt=await p.getTransactionReceipt(j.hash);
  if(receipt){Object.assign(j,{status:receipt.status===1?'CONFIRMED':'REVERTED',block:receipt.blockNumber,afterUsdc:(await token.balanceOf(w.address)).toString()});save(j);console.log(JSON.stringify({status:j.status,hash:j.hash,beforeUsdc:j.beforeUsdc,afterUsdc:j.afterUsdc}));}
  else console.log(JSON.stringify({status:'PENDING_OR_UNKNOWN',hash:j.hash,message:'Inspect this exact hash. This runner will not create another swap.'}));
 }else{
  const balance=await p.getBalance(w.address);console.log(JSON.stringify({address:w.address,balanceWei:balance.toString(),requiredFunding:'0.003 Sepolia ETH recommended'}));
  if(process.argv.includes('--execute')){
   const amountWei='10000000000000'; // 0.00001 ETH, minimum supported test.
   const q=await createTestnetSwap()({address:w.address,amountWei});
   const {chainId,...tx}=q.transaction;
   const gas=(await p.estimateGas(tx))*120n/100n,fee=(await p.getFeeData()).gasPrice;
   if(!fee||gas>500000n||gas*fee>1000000000000000n||balance<BigInt(amountWei)+gas*fee)throw Error('Insufficient test funds or gas cap exceeded.');
   const beforeUsdc=(await token.balanceOf(w.address)).toString();
   const signed=await w.signTransaction({...tx,chainId:11155111,nonce:await p.getTransactionCount(w.address,'pending'),gasLimit:gas,gasPrice:fee,type:0});
   j={status:'SIGNED',address:w.address,hash:keccak256(signed),signed,beforeUsdc,amountWei,quoteId:q.quoteId,minimumOut:q.minimumOut};save(j);
   await p.broadcastTransaction(signed);j.status='SUBMITTED';save(j);
   const receipt=await p.waitForTransaction(j.hash,1,45000);
   if(receipt){Object.assign(j,{status:receipt.status===1?'CONFIRMED':'REVERTED',block:receipt.blockNumber,afterUsdc:(await token.balanceOf(w.address)).toString()});save(j);}
   console.log(JSON.stringify({status:j.status,hash:j.hash,beforeUsdc:j.beforeUsdc,afterUsdc:j.afterUsdc}));
  }
 }
}finally{p.destroy();}
