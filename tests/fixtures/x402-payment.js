import {AccountId,Hbar,PrivateKey,Timestamp,TransferTransaction,TransactionId} from '@hiero-ledger/sdk';
import {requirements} from '../../src/x402/gate.js';
export const PAYER='0.0.1002',TOKEN='0.0.2000';
export const payerKey=PrivateKey.generateED25519();
export const terms=asset=>requirements({amount:'1000000',asset,payTo:'0.0.1003',feePayer:'0.0.1001',network:'hedera:testnet',resource:'https://usgs.example/attest'});
export async function payment({key=payerKey,asset='HBAR',signed=true,start=Date.now()-1000,feePayer='0.0.1001',nodes=['0.0.3','0.0.4']}={}){
 const tx=new TransferTransaction().setMaxTransactionFee(new Hbar(1)).setTransactionId(TransactionId.withValidStart(AccountId.fromString(feePayer),Timestamp.fromDate(new Date(start)))).setNodeAccountIds(nodes.map(AccountId.fromString));
 if(asset==='HBAR')tx.addHbarTransfer(PAYER,Hbar.fromTinybars(-1000000)).addHbarTransfer('0.0.1003',Hbar.fromTinybars(1000000));
 else tx.addTokenTransfer(asset,PAYER,-1000000).addTokenTransfer(asset,'0.0.1003',1000000);
 tx.freeze();if(signed)await tx.sign(key);
 return {x402Version:2,scheme:'exact',network:'hedera:testnet',payload:{transaction:Buffer.from(tx.toBytes()).toString('base64')}};
}
export const header=payload=>Buffer.from(JSON.stringify(payload)).toString('base64');
export function payerFetcher({key=payerKey,type='ED25519',balance=2000000,deleted=false,account=PAYER,freeze_status='UNFROZEN',kyc_status='GRANTED',token=TOKEN,events=[]}={}){
 return async url=>{
  events.push(String(url));
  return Response.json(String(url).includes('/tokens?')?{tokens:[{token_id:token,balance,freeze_status,kyc_status}]}:{account,deleted,key:{_type:type,key:key.publicKey.toStringRaw()},balance:{balance}});
 };
}
