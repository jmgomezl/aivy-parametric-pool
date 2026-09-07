import {mirrorGet} from '../ledger.js';
// A lost response must be reconciled against the exact atomic deposit, never re-minted.
export function verifyDepositReceipt(rows,{transactionId,assetId,shareId,poolId,treasuryId,accountId,amount}){
 const id=transactionId.replace('@','-').replace(/\.(\d+)$/,'-$1');
 const row=rows.find(r=>r.transaction_id===id&&r.result==='SUCCESS'&&r.name==='CRYPTOTRANSFER'&&!r.scheduled&&(r.nonce??0)===0);
 const expected=[[assetId,accountId,-Math.round(amount*1e6)],[assetId,poolId,Math.round(amount*1e6)],[shareId,treasuryId,-Math.round(amount*1e8)],[shareId,accountId,Math.round(amount*1e8)]];
 if(!row||row.nft_transfers?.length||row.token_transfers?.length!==4||expected.some(([token,account,units])=>!row.token_transfers.some(t=>t.token_id===token&&t.account===account&&String(t.amount)===String(units)&&!t.is_approval)))throw Object.assign(Error('Deposit is not yet verified. Keep the original request for review.'),{status:409});
 return {amount,shares:amount,poolId,depositTxId:transactionId};
}
export async function reconcileDeposit(network,terms){
 const id=terms.transactionId.replace('@','-').replace(/\.(\d+)$/,'-$1');
 const result=await mirrorGet(network,'/transactions/'+encodeURIComponent(id));
 return verifyDepositReceipt(result.transactions??[],terms);
}
