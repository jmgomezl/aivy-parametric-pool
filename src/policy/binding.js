import { createHash } from 'node:crypto';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
export const termsMemo = terms => `aivy:v1:${createHash('sha256').update(JSON.stringify(canonical(terms))).digest('hex')}`;
export function validateTerms(terms, now = Date.now()) {
  const t=terms.trigger;
  if(terms.version!==1 || !t || !terms.poolId || !terms.beneficiaryId || !terms.asset)throw new Error('Legacy or incomplete policy: manual verification is required.');
  if(!Number.isFinite(t.location?.lat)||Math.abs(t.location.lat)>90||!Number.isFinite(t.location?.lon)||Math.abs(t.location.lon)>180)throw new Error('Invalid policy location');
  if(t.minMagnitude!==6||t.radiusKm!==100||t.maxDepthKm!==70)throw new Error('Unsupported policy trigger');
  const start=Date.parse(terms.issuedAt), end=Date.parse(terms.lapsesAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>62*86400000||now<start||now>=end)throw new Error('Policy is outside its coverage window');
  if(!Number.isSafeInteger(terms.settled?.payoutUnits)||terms.settled.payoutUnits<=0)throw new Error('Invalid payout amount');
  return {lat:t.location.lat,lon:t.location.lon,radiusKm:t.radiusKm,minMagnitude:t.minMagnitude,maxDepthKm:t.maxDepthKm,windowStart:terms.issuedAt,windowEnd:new Date(Math.min(now,end)).toISOString()};
}
