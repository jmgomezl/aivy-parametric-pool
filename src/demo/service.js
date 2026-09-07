import {AccountBalanceQuery,AccountId,PrivateKey,TokenId,TransferTransaction} from '@hiero-ledger/sdk';
import {createFundedAccount,known} from '../accounts.js';
import {associate} from '../pool/shares.js';
import {deposit} from '../pool/deposit.js';
import {settlementAsset} from '../asset.js';
import {mirrorGet} from '../ledger.js';
import {policies} from '../book.js';
import {demoStore} from './store.js';
export function demoService({client,agent,network,reg}){
 const store=demoStore(),asset=settlementAsset(network);
 const enabled=()=>{if(network!=='testnet'||asset.symbol!=='aUSDd'||asset.tokenId!==reg.demoTokenId)throw Object.assign(Error('Interactive demo is restricted to unbacked testnet tokens.'),{status:403});};
 const balance=async id=>{const b=await new AccountBalanceQuery().setAccountId(id).execute(client);return {tokens:Number(b.tokens?.get(TokenId.fromString(asset.tokenId))??0)/1e6,shares:Number(b.tokens?.get(TokenId.fromString(reg.shareTokenId))??0)/1e8};};
 const signer=id=>{const a=store.account(id),k=known(network).find(k=>k.id===a.accountId);if(!k)throw Error('Account custody unavailable.');return {id:AccountId.fromString(a.accountId),key:PrivateKey.fromStringDer(k.key)};};
 return {store,enabled,balance,signer,
  async start(id,ip){enabled();const existing=store.read().accounts[id];if(existing){store.account(id);return;}store.start(id,ip);
   const a=await createFundedAccount(client,network,.2,'visitor demo account');store.patch(id,{accountId:a.id.toString(),createTx:a.txId});
   await associate(client,a.id,a.key,TokenId.fromString(asset.tokenId));await associate(client,a.id,a.key,TokenId.fromString(reg.shareTokenId));
   const tx=await new TransferTransaction().addTokenTransfer(asset.tokenId,agent.id,-1000e6).addTokenTransfer(asset.tokenId,a.id,1000e6).freezeWith(client);
   store.patch(id,{starterTx:tx.transactionId.toString()});const sent=await tx.execute(client);await sent.getReceipt(client);store.patch(id,{status:'ready'});
  },
  async view(id){enabled();const a=store.account(id),tokens=(await mirrorGet(network,`/accounts/${a.accountId}/tokens`)).tokens??[],b={tokens:Number(tokens.find(t=>t.token_id===asset.tokenId)?.balance??0)/1e6,shares:Number(tokens.find(t=>t.token_id===reg.shareTokenId)?.balance??0)/1e8};return {ok:true,network,accountId:a.accountId,asset:asset.symbol,tokenId:asset.tokenId,shareTokenId:reg.shareTokenId,balance:b.tokens,shares:b.shares,referralCode:a.code,starterTx:a.starterTx,actions:a.actions,commissions:policies(network).filter(p=>p.brokerId===a.accountId).map(p=>({serial:p.serial,amount:Math.round(p.premiumUnits*.15)/1e6,transaction:p.saleTxId})),checkedAt:new Date().toISOString(),custody:'Service-managed testnet account. Browser access token controls this demo session. No cash value.'};},
  async fund(id,{requestId,amount}){enabled();store.account(id);const b=await balance(store.account(id).accountId);
   const prior=store.account(id).actions.find(x=>x.requestId===requestId);
   if(!prior&&(!Number.isFinite(amount)||amount<1||amount>100||Math.abs(Math.round(amount*100)-amount*100)>1e-7||amount>b.tokens))throw Object.assign(Error('Choose 1–100 aUSDd within your balance, with up to two decimals.'),{status:400});
   const action=store.begin(id,requestId,'deposit',amount);if(action.status==='complete')return action.result;if(prior)throw Object.assign(Error('Deposit submitted previously; awaiting reconciliation. Do not repeat it.'),{status:409});
   const lp=signer(id),result=await deposit(client,{tokenId:TokenId.fromString(reg.shareTokenId),treasuryId:agent.id,poolId:AccountId.fromString(reg.poolAccountId),lpId:lp.id,lpKey:lp.key,amountUnits:Math.round(amount*1e6),network,checkpoint:patch=>{const a=store.account(id);Object.assign(a.actions.find(x=>x.requestId===requestId),patch);store.patch(id,{actions:a.actions});}});
   const value={...result,amount,shares:result.units/1e8,poolId:reg.poolAccountId};store.finish(id,requestId,value);return value;
  },
 };
}
