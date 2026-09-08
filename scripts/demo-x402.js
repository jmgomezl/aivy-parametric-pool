// One bounded Blocky402 testnet request. --status reconciles without paying again.
import fs from 'node:fs';
import {NETWORK} from '../src/config.js';
import {fetchPaid} from '../src/x402/client.js';
import {createBlockyFacilitator,BLOCKY_FEE_PAYER,BLOCKY_INFO} from '../src/x402/blocky.js';
const file='.artifacts/demo-blocky402-request.json';
if(NETWORK!=='testnet')throw Error('Hedera testnet only.');
if(process.argv.includes('--status')){
 const saved=JSON.parse(fs.readFileSync(file,'utf8'));
 const id=saved.transactionId.replace('@','-').replace(/(\d+)\.(\d+)$/,'$1-$2');
 const r=await fetch(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${id}`,{signal:AbortSignal.timeout(10000)});
 console.log(JSON.stringify({transaction:saved.transactionId,mirrorStatus:r.status,...(r.ok?{ledger:await r.json()}:{message:'No indexed result yet; do not assume an uncertain request was unpaid.'})},null,2));
}else{
 if(!process.argv.includes('--execute'))throw Error('Use --execute for one 0.001 test aUSDd request, or --status to inspect its receipt.');
 if(fs.existsSync(file))throw Error('An earlier request exists. Use --status; no new payment is made.');
 await createBlockyFacilitator().supported();
 const reg=JSON.parse(fs.readFileSync('.artifacts/registry-testnet.json','utf8'));
 if(!reg.x402PayerId||!reg.x402PayerKey)throw Error('Dedicated testnet x402 payer is required in the private local registry.');
 const resource='https://usgs.aivylabs.xyz/attest',policy={resource,payTo:'0.0.10386832',feePayer:BLOCKY_FEE_PAYER,asset:'0.0.10374011',maxAmount:'1000'};
 const spec={lat:19.4326,lon:-99.1332,radiusKm:100,minMagnitude:6,maxDepthKm:70,windowStart:'2025-01-01T00:00:00Z',windowEnd:'2025-02-01T00:00:00Z'};
 const result=await fetchPaid(resource,{payerId:reg.x402PayerId,payerKey:reg.x402PayerKey,network:NETWORK,policy,init:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({spec})},checkpoint:payment=>{fs.mkdirSync('.artifacts',{recursive:true,mode:0o700});fs.writeFileSync(file,JSON.stringify({...payment,facilitator:BLOCKY_INFO,status:'pending'}),{flag:'wx',mode:0o600});}});
 const body=await result.response.json();
 if(!result.response.ok||!result.paid||body.payment?.facilitator?.name!=='Blocky402')throw Error('Request not confirmed. Inspect --status before any further payment.');
 fs.writeFileSync('.artifacts/demo-blocky402-result.json',JSON.stringify({network:NETWORK,purpose:'Historical query; no policy signature',spec,...body},null,2),{mode:0o600});
 console.log(JSON.stringify({network:NETWORK,facilitator:body.payment.facilitator,transaction:body.payment.transaction,verdict:body.verdict},null,2));
}
