// An untrusted HTTP 402 response is not authorization to spend.
export function validatePaymentTerms(requirements,{network,policy}={}) {
 const id=value=>typeof value==='string'&&/^\d+\.\d+\.\d+$/.test(value);
 if(!['testnet','mainnet'].includes(network)||!policy||!id(policy.payTo)||!id(policy.feePayer)||!(id(policy.asset)||policy.asset==='HBAR')||typeof policy.maxAmount!=='string'||!/^\d+$/.test(policy.maxAmount)||BigInt(policy.maxAmount)<=0n||typeof policy.resource!=='string')throw new Error('An explicit payment policy is required before signing.');
 const resource=new URL(policy.resource);
 if(resource.protocol!=='https:'||resource.username||resource.password)throw new Error('Payment resource must use HTTPS.');
 if(requirements?.x402Version!==2||requirements.scheme!=='exact'||requirements.network!==`hedera:${network}`||requirements.payTo!==policy.payTo||requirements.asset!==policy.asset||requirements.extra?.feePayer!==policy.feePayer||requirements.resource!==policy.resource)throw new Error('Payment requirements do not match the authorized policy.');
 const raw=requirements.amount;
 if(typeof raw!=='string'||!/^\d{1,19}$/.test(raw)||BigInt(raw)<=0n||BigInt(raw)>BigInt(policy.maxAmount)||BigInt(raw)>9223372036854775807n)throw new Error('Payment amount exceeds the authorized budget.');
 return requirements;
}
