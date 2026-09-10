import {reconcileDeposit} from './reconcile.js';
import {buildPluginBridge,AXELAR_PLUGIN_VERSION} from '../settlement/axelarPlugin.js';
import {bridgeStatus,bridgeInput,confirmBridgeDestination,bridgeGas,ITS_ACCOUNT} from '../settlement/bridge.js';
import {AccountBalanceQuery,AccountId,PrivateKey,TokenId,TransferTransaction,AccountAllowanceApproveTransaction,Client,Hbar} from '@hiero-ledger/sdk';
import {createFundedAccount,known} from '../accounts.js';
import {associate} from '../pool/shares.js';
import {deposit} from '../pool/deposit.js';
import {settlementAsset} from '../asset.js';
import {readTokenBalance} from '../ledger.js';
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
  async view(id){
   enabled();const a=store.account(id);
   const [tokens,shares]=await Promise.all([
    readTokenBalance(network,a.accountId,asset.tokenId),
    readTokenBalance(network,a.accountId,reg.shareTokenId),
   ]);
   return {ok:true,network,accountId:a.accountId,asset:asset.symbol,tokenId:asset.tokenId,shareTokenId:reg.shareTokenId,balance:tokens/1e6,shares:shares/1e8,referralCode:a.code,starterTx:a.starterTx,actions:a.actions,commissions:policies(network).filter(p=>p.brokerId===a.accountId).map(p=>({serial:p.serial,amount:Math.round(p.premiumUnits*.15)/1e6,transaction:p.saleTxId})),checkedAt:new Date().toISOString(),custody:'Service-managed testnet account. Browser access token controls this demo session. No cash value.'};
  },
  async bridge(id,input){
   enabled();const terms=bridgeInput(input),account=store.account(id),prior=account.actions.find(x=>x.requestId===terms.requestId);
   if(prior){if(prior.kind!=='bridge'||prior.amount!==terms.amount||prior.recipient!==terms.recipient)throw Object.assign(Error('Request already used for other bridge terms.'),{status:409});if(prior.status==='complete')return prior.result;
    if(prior.bridgeTxId){
     // Read-only reconciliation of the original transaction; never broadcast a replacement.
     await bridgeStatus({...prior,status:'complete',result:{bridgeTxId:prior.bridgeTxId}});
     const config=await confirmBridgeDestination(),result={status:'source-confirmed',bridgeTxId:prior.bridgeTxId,recipient:prior.recipient,amount:prior.amount,destinationToken:config.destinationToken,destinationChain:11155111};
     store.finish(id,terms.requestId,result);return result;
    }
    throw Object.assign(Error('Bridge transaction needs operator reconciliation. No transfer is repeated.'),{status:409});}
   const config=await confirmBridgeDestination();if(config.sourceTokenId!==asset.tokenId)throw Error('Bridge asset mismatch.');
   const b=await balance(account.accountId);if(b.tokens<terms.amount)throw Object.assign(Error('Not enough aUSDd to bridge.'),{status:400});
   const gas=await bridgeGas(),lp=signer(id);
   const prepared=await buildPluginBridge(input,gas);
   store.begin(id,terms.requestId,'bridge',terms.amount);
   const patch=value=>{const a=store.account(id);Object.assign(a.actions.find(x=>x.requestId===terms.requestId),value);store.patch(id,{actions:a.actions});};
   patch({recipient:terms.recipient,via:'hak-axelar-plugin',pluginVersion:AXELAR_PLUGIN_VERSION});
   const c=Client.forTestnet().setOperator(lp.id,lp.key);
   try{
    const native=(await new AccountBalanceQuery().setAccountId(lp.id).execute(client)).hbars.toTinybars().toNumber();
    if(native<200000000){
     const topup=new TransferTransaction().addHbarTransfer(agent.id,Hbar.fromTinybars(-(200000000-native))).addHbarTransfer(lp.id,Hbar.fromTinybars(200000000-native)).freezeWith(client);
     patch({gasFundingTxId:topup.transactionId.toString()});const paid=await topup.execute(client);await paid.getReceipt(client);
    }
    const spender=AccountId.fromString(ITS_ACCOUNT);
    const approval=await new AccountAllowanceApproveTransaction().approveTokenAllowance(asset.tokenId,lp.id,spender,terms.units).freezeWith(client).sign(lp.key);
    patch({approvalTxId:approval.transactionId.toString()});const approved=await approval.execute(client);await approved.getReceipt(client);
    const tx=prepared.freezeWith(c);
    patch({bridgeTxId:tx.transactionId.toString()});const sent=await tx.execute(c);await sent.getReceipt(c);
    const result={status:'source-confirmed',via:'hak-axelar-plugin',pluginVersion:AXELAR_PLUGIN_VERSION,bridgeTxId:sent.transactionId.toString(),recipient:terms.recipient,amount:terms.amount,destinationToken:config.destinationToken,destinationChain:11155111};
    store.finish(id,terms.requestId,result);return result;
   }finally{c.close();}
  },
  async fund(id,{requestId,amount}){enabled();store.account(id);const b=await balance(store.account(id).accountId);
   const prior=store.account(id).actions.find(x=>x.requestId===requestId);
   if(!prior&&(!Number.isFinite(amount)||amount<1||amount>100||Math.abs(Math.round(amount*100)-amount*100)>1e-7||amount>b.tokens))throw Object.assign(Error('Choose 1–100 aUSDd within your balance, with up to two decimals.'),{status:400});
   const action=store.begin(id,requestId,'deposit',amount);if(action.status==='complete')return action.result;if(prior){
    if(!prior.depositTxId)throw Object.assign(Error('Deposit needs operator review. No shares or payment are repeated.'),{status:409});
    const result=await reconcileDeposit(network,{transactionId:prior.depositTxId,assetId:asset.tokenId,shareId:reg.shareTokenId,poolId:reg.poolAccountId,treasuryId:agent.id.toString(),accountId:store.account(id).accountId,amount:prior.amount});
    store.finish(id,requestId,result);return result;
   }
   const lp=signer(id),result=await deposit(client,{tokenId:TokenId.fromString(reg.shareTokenId),treasuryId:agent.id,poolId:AccountId.fromString(reg.poolAccountId),lpId:lp.id,lpKey:lp.key,amountUnits:Math.round(amount*1e6),network,checkpoint:patch=>{const a=store.account(id);Object.assign(a.actions.find(x=>x.requestId===requestId),patch);store.patch(id,{actions:a.actions});}});
   const value={...result,amount,shares:result.units/1e8,poolId:reg.poolAccountId};store.finish(id,requestId,value);return value;
  },
 };
}
