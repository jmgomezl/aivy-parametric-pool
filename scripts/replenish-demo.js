// Operator-only testnet treasury replenishment, not an LP deposit or share sale.
// Dry run by default. Execute once with --execute; never retry an uncertain receipt blindly.
import fs from 'node:fs';
import {AccountBalanceQuery,TokenId,TransferTransaction} from '@hiero-ledger/sdk';
import {client,operator,NETWORK,assertOperatorKey} from '../src/config.js';
import {load} from '../src/registry.js';
import {settlementAsset} from '../src/asset.js';
const target=200_000,reg=load(NETWORK),asset=settlementAsset(NETWORK);
if(NETWORK!=='testnet'||asset.kind!=='token'||asset.isUsdc||asset.tokenId!==reg.demoTokenId)throw Error('Only the registered unbacked testnet demo token can be replenished.');
await assertOperatorKey();
const c=client(),agent=operator(),token=TokenId.fromString(asset.tokenId);
try{
 const balance=async id=>Number((await new AccountBalanceQuery().setAccountId(id).execute(c)).tokens?.get(token)??0);
 const [pool,treasury]=await Promise.all([balance(reg.poolAccountId),balance(agent.id)]);
 const units=Math.max(0,target*1e6-pool);
 const evidence={network:NETWORK,kind:'operator-demo-replenishment',asset:asset.symbol,token:asset.tokenId,from:agent.id.toString(),to:reg.poolAccountId,before:pool/1e6,target,amount:units/1e6,at:new Date().toISOString()};
 if(units>treasury)throw Error('Treasury cannot cover replenishment.');
 if(process.argv.includes('--execute')&&units>0){
   const tx=new TransferTransaction().addTokenTransfer(token,agent.id,-units).addTokenTransfer(token,reg.poolAccountId,units);
   const sent=await tx.execute(c);
   // Persist the submitted identifier BEFORE waiting for consensus.
   const journal='.artifacts/demo-replenishment-'+Date.now()+'.json';
   fs.writeFileSync(journal,JSON.stringify({...evidence,transaction:sent.transactionId.toString(),status:'SUBMITTED'},null,2),{mode:0o600});
   const receipt=await sent.getReceipt(c);
   Object.assign(evidence,{transaction:sent.transactionId.toString(),status:receipt.status.toString(),after:await balance(reg.poolAccountId)/1e6});
   fs.writeFileSync(journal,JSON.stringify(evidence,null,2),{mode:0o600});
 }else evidence.status=units?'DRY_RUN':'ALREADY_FUNDED';
 console.log(JSON.stringify(evidence,null,2));
}finally{c.close();}
