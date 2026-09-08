// Hosted Blocky402 settlement. Keys stay with the payer and Blocky's fee payer.
// No local-settlement fallback: an outage must never silently change facilitator.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {decodePayment,verifyAuthorization} from './facilitator.js';
export const BLOCKY_URL='https://api.testnet.blocky402.com';
export const BLOCKY_FEE_PAYER='0.0.7162784';
export const BLOCKY_INFO={name:'Blocky402',url:BLOCKY_URL,network:'hedera:testnet',feePayer:BLOCKY_FEE_PAYER};
const invalid=reason=>({isValid:false,invalidReason:reason});

export function blockyEnvelope(payload,terms){
 if(terms.network!=='hedera:testnet'||terms.scheme!=='exact'||terms.extra?.feePayer!==BLOCKY_FEE_PAYER)throw Error('Unsupported Blocky payment terms.');
 const accepted={scheme:terms.scheme,network:terms.network,amount:terms.amount,asset:terms.asset,payTo:terms.payTo,maxTimeoutSeconds:terms.maxTimeoutSeconds,extra:{feePayer:BLOCKY_FEE_PAYER}};
 return {x402Version:2,paymentPayload:{x402Version:2,scheme:terms.scheme,network:terms.network,accepted,payload:{transaction:payload?.payload?.transaction}},paymentRequirements:accepted};
}

export function createBlockyFacilitator({network='testnet',fetcher=fetch,verifyLocal=verifyAuthorization,now=Date.now,directory=path.join(process.cwd(),'.artifacts')}={}){
 if(network!=='testnet')throw Error('This hosted Blocky integration is pinned to Hedera testnet.');
 let discovery=null,discoveredAt=0,discovering=null,active=0;
 const request=async(endpoint,body)=>{
  if(active>=4)throw Error('Blocky request limit reached.');active++;
  try{
   const response=await fetcher(BLOCKY_URL+endpoint,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(endpoint==='/settle'?20000:10000)});
   if(!response.ok)throw Error('Blocky request unavailable.');
   return await response.json();
  }finally{active--;}
 };
 const supported=async()=>{
  if(discovery&&now()-discoveredAt<60000)return discovery;
  if(discovering)return discovering;
  discovering=(async()=>{
   const data=await request('/supported');
   const match=data.kinds?.find(k=>k.x402Version===2&&k.scheme==='exact'&&k.network==='hedera:testnet'&&k.extra?.feePayer===BLOCKY_FEE_PAYER);
   if(!match||!data.signers?.['hedera:*']?.includes(BLOCKY_FEE_PAYER))throw Error('Blocky fee payer or network changed; review before signing.');
   discovery=BLOCKY_INFO;discoveredAt=now();return discovery;
  })().finally(()=>{discovering=null;});return discovering;
 };
 const verify=async(payload,terms)=>{
  try{
   const body=blockyEnvelope(payload,terms);
   const local=await verifyLocal(payload,terms,{network});if(!local.isValid)return local;
   await supported();
   const result=await request('/verify',body);
   if(result.isValid!==true||(result.payer&&result.payer!==local.payer))return invalid('blocky_verification_refused');
   return {...local,facilitator:BLOCKY_INFO};
  }catch{return invalid('blocky_unavailable');}
 };
 const settle=async(payload,terms)=>{
  let file,record;
  try{
   const body=blockyEnvelope(payload,terms);
   // Recheck authorization after catalogue work. A verifier is not a signer.
   const local=await verifyLocal(payload,terms,{network});if(!local.isValid)return {success:false,errorReason:local.invalidReason};
   await supported();
   const transaction=decodePayment(payload).transactionId.toString();
   const journal=path.join(directory,'blocky-payments-testnet');fs.mkdirSync(journal,{recursive:true,mode:0o700});
   file=path.join(journal,createHash('sha256').update(transaction).digest('hex')+'.json');
   record={transaction,resource:terms.resource,amount:terms.amount,asset:terms.asset,payer:local.payer,facilitator:BLOCKY_INFO,status:'pending',at:new Date(now()).toISOString()};
   // Atomic across the three processes. Once sent (or possibly sent), a payment
   // ID cannot authorize another request. No signed bytes are persisted here.
   try{fs.writeFileSync(file,JSON.stringify(record),{flag:'wx',mode:0o600});}
   catch(error){if(error.code==='EEXIST')return {success:false,errorReason:'payment_already_attempted'};throw error;}
   const result=await request('/settle',body);
   if(result.success!==true||result.network!=='hedera:testnet'||result.transaction!==transaction||(result.payer&&result.payer!==local.payer))throw Error('Unconfirmed or mismatched Blocky settlement.');
   record={...record,status:'confirmed',confirmedAt:new Date(now()).toISOString()};
   const temp=file+'.'+randomUUID();fs.writeFileSync(temp,JSON.stringify(record),{mode:0o600});fs.renameSync(temp,file);
   return {success:true,transaction,network:'hedera:testnet',payer:local.payer,facilitator:BLOCKY_INFO};
  }catch{
   // Retain the pending journal on a timeout, rejection or mismatched receipt.
   // A caller must reconcile the original ID, never pay automatically again.
   return {success:false,errorReason:file?'payment_outcome_uncertain':'blocky_unavailable'};
  }
 };
 return {supported,verify,settle,info:BLOCKY_INFO};
}
