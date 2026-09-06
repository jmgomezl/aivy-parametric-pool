import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AccountId,Hbar,TransferTransaction,TransactionId} from '@hiero-ledger/sdk';
import {verify,settle} from '../src/x402/facilitator.js';
const feePayer='0.0.1001',payer='0.0.1002',recipient='0.0.1003';
const terms={amount:'1000000',asset:'HBAR',payTo:recipient,extra:{feePayer}};
function payment(change=()=>{},token=false){
 const tx=new TransferTransaction().setMaxTransactionFee(new Hbar(1)).setTransactionId(TransactionId.generate(feePayer)).setNodeAccountIds([AccountId.fromString('0.0.3')]);
 if(token)tx.addTokenTransfer('0.0.2000',payer,-1000000).addTokenTransfer('0.0.2000',recipient,1000000);
 else tx.addHbarTransfer(payer,Hbar.fromTinybars(-1000000)).addHbarTransfer(recipient,Hbar.fromTinybars(1000000));
 change(tx);tx.freeze();return {payload:{transaction:Buffer.from(tx.toBytes()).toString('base64')}};
}
test('exact HBAR and token oracle payments are accepted',()=>{
 assert.deepEqual(verify(payment(),terms),{isValid:true,credited:'1000000',asset:'HBAR'});
 assert.equal(verify(payment(()=>{},true),{...terms,asset:'0.0.2000'}).isValid,true);
});
test('facilitator refuses extra debit, unrelated asset, approvals and excessive fees',async()=>{
 for(const change of [
  tx=>tx.addHbarTransfer(feePayer,-1).addHbarTransfer('0.0.9999',1),
  tx=>tx.addTokenTransfer('0.0.2000',feePayer,-1).addTokenTransfer('0.0.2000','0.0.9999',1),
  tx=>tx.setMaxTransactionFee(new Hbar(100)),
 ])assert.equal(verify(payment(change),terms).isValid,false);
 const approved=new TransferTransaction().addApprovedHbarTransfer(payer,Hbar.fromTinybars(-1000000)).addHbarTransfer(recipient,Hbar.fromTinybars(1000000)).setTransactionId(TransactionId.generate(feePayer)).setNodeAccountIds([AccountId.fromString('0.0.3')]).freeze();
 assert.equal(verify({payload:{transaction:Buffer.from(approved.toBytes()).toString('base64')}},terms).isValid,false);
 // No client or key is needed: invalid payments are rejected before signing.
 assert.equal((await settle(payment(tx=>tx.addHbarTransfer(feePayer,-1).addHbarTransfer('0.0.9999',1)),terms,{})).success,false);
});
