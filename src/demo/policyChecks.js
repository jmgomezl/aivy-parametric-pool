import {fetchPaid} from '../x402/client.js';
import {SOURCES} from '../oracle/sources.js';
const order=['usgs','emsc','geofon'];
const error=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export function latestPolicyCheck(store,serial){
 const row=Object.values(store.read().accounts).flatMap(a=>a.actions).filter(a=>a.kind==='oracle-check'&&a.serial===String(serial)).sort((a,b)=>b.at-a.at)[0];
 return row?{status:row.status,at:row.at,...row.result,checks:row.result?.checks??row.checks??[]}:null;
}
export async function checkPolicy({demo,network,reg,agent,sessionId,policy,input,pay=fetchPaid,now=Date.now}){
 demo.enabled();
 if(network!=='testnet'||reg.oracleSources?.join(',')!==order.join(',')||reg.oracleAccountIds?.length!==3||!reg.oracleAccountIds.every(id=>/^0\.0\.\d+$/.test(id)))error('Testnet oracle configuration unavailable.',503);
 if(!input||Object.keys(input).some(k=>k!=='requestId')||!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId??''))error('A saved check request ID is required.');
 const account=demo.store.account(sessionId),previous=account.actions.find(a=>a.requestId===input.requestId);
 if(previous){if(previous.kind!=='oracle-check'||previous.serial!==String(policy.serial))error('Request belongs to another action.',409);if(previous.status==='complete')return previous.result;error('Original check needs review. No payment is repeated.',409);}
 if(!['active','confirming'].includes(policy.state)||!policy.ledger?.available||!policy.ledger.agentSigned||!/^hcs:\/\/0\.0\.\d+\/\d+$/.test(policy.termsPointer))error('Only verified, active policies can be checked.',409);
 const recent=latestPolicyCheck(demo.store,policy.serial);
 if(recent?.status==='pending'||recent?.needsReview)error('An earlier check needs payment review before another request.',409);
 if(recent&&now()-recent.at<300000)return {...recent,cached:true};
 if((await demo.balance(account.accountId)).tokens<.003)error('The three oracle checks need up to 0.003 aUSDd.');
 demo.store.begin(sessionId,input.requestId,'oracle-check',.003,now());
 const patch=value=>{const a=demo.store.account(sessionId);Object.assign(a.actions.find(x=>x.requestId===input.requestId),value);demo.store.patch(sessionId,{actions:a.actions});};
 const checks=[];patch({serial:String(policy.serial),checks});
 const signer=demo.signer(sessionId);
 for(let i=0;i<order.length;i++){
  const sourceKey=order[i],resource=`https://${sourceKey}.aivylabs.xyz/attest-and-sign`;
  const row={sourceKey,source:SOURCES[sourceKey].name,status:'checking'};checks.push(row);patch({checks});
  try{
   const result=await pay(resource,{payerId:signer.id,payerKey:signer.key,network,policy:{resource,payTo:reg.oracleAccountIds[i],feePayer:agent.id.toString(),asset:reg.demoTokenId,maxAmount:'1000'},init:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scheduleId:policy.scheduleId,termsPointer:policy.termsPointer})},checkpoint:payment=>{Object.assign(row,{paymentTxId:payment.transactionId,status:'payment-submitted'});patch({checks});}});
   const body=await result.response.json();
   // A source that cannot answer declines before settling, so the signed payment
   // was never submitted. That is a source casting no vote, not a receipt to
   // reconcile: only 'source_unavailable' is returned ahead of the charge.
   if(!result.paid&&result.response.status===503&&body.error==='source_unavailable'&&body.sourceKey===sourceKey){
    Object.assign(row,{status:'unavailable',paid:false,paymentTxId:undefined,verdict:'The catalogue could not answer, so it was not paid and casts no vote.'});
    patch({checks});continue;
   }
   if(!result.response.ok||!result.paid||body.sourceKey!==sourceKey||typeof body.triggered!=='boolean')throw Error('Oracle response could not be verified.');
   if(body.payment?.transaction!==row.paymentTxId)throw Error('Payment receipt does not match the submitted transaction.');
   Object.assign(row,{status:body.unavailable?'unavailable':body.triggered?'qualifying-event':'no-match',paid:true,verdict:String(body.verdict??'').slice(0,300),queriedAt:body.queriedAt,query:body.query,signatureTxId:!body.unavailable&&body.triggered&&body.signature?.signed?body.signature.transactionId:undefined,alreadySettled:Boolean(body.signature?.alreadySettled),matches:(body.matches??[]).slice(0,3)});
  }catch{Object.assign(row,{status:row.paymentTxId?'needs-review':'unavailable',verdict:row.paymentTxId?'Payment submitted; check its receipt. No payment is repeated.':'Source unavailable or policy verification refused. No payment was submitted.'});}
  patch({checks});
 }
 const result={ok:true,serial:String(policy.serial),network:'testnet',checkedAt:new Date(now()).toISOString(),checks,needsReview:checks.some(c=>c.status==='needs-review'),cost:checks.filter(c=>c.paid).length*.001,maxCost:.003};
 demo.store.finish(sessionId,input.requestId,result);return result;
}
