import {HttpError} from '../http-safety.js';

export const MAX_CYCLES=3;
export const PLACES=Object.freeze({
 medellin:{name:'Medellín, Colombia',lat:6.2442,lon:-75.5812},
 mexico:{name:'Mexico City, Mexico',lat:19.4326,lon:-99.1332},
 tokyo:{name:'Tokyo, Japan',lat:35.6762,lon:139.6503},
});
export const TRIGGER=Object.freeze({minMagnitude:6,radiusKm:100,maxDepthKm:70});

export function mandateInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['requestId','placeId','monthlyBudget','minimumPayout','acceptTerms'].includes(k)))throw new HttpError(400,'Unsupported cover-agent field.');
 const {requestId,placeId,monthlyBudget,minimumPayout,acceptTerms}=input;
 if(typeof requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(requestId))throw new HttpError(400,'A saved request identifier is required.');
 if(!Object.hasOwn(PLACES,placeId)||!Number.isFinite(monthlyBudget)||monthlyBudget<1||monthlyBudget>10||Math.abs(Math.round(monthlyBudget*100)-monthlyBudget*100)>1e-7||!Number.isFinite(minimumPayout)||minimumPayout<1||minimumPayout>2000||!Number.isInteger(minimumPayout))throw new HttpError(400,'Choose a supported place, 1–10 aUSDd per month, and a minimum payout of 1–2,000 aUSDd.');
 if(acceptTerms!==true)throw new HttpError(400,'Review and approve the testnet renewal rules first.');
 return {requestId,placeId,monthlyBudget,minimumPayout,acceptTerms:true};
}

// Calendar months preserve the original UTC day, clamping short months only.
// January 31 -> February 28 -> March 31, not a drifting 30-day interval.
export function monthAt(anchor,index){
 const d=new Date(anchor),last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+index+1,0)).getUTCDate();
 return Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+index,Math.min(d.getUTCDate(),last),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds(),d.getUTCMilliseconds());
}
export function periodAt(anchor,now){let i=0;while(i<MAX_CYCLES&&now>=monthAt(anchor,i+1))i++;return i;}
export function daysFor(anchor,index){return Math.round((monthAt(anchor,index+1)-monthAt(anchor,index))/86400000);}
export function quoteDenial(mandate,quote){
 if(!quote?.ok)return {status:409,reason:quote?.reason??'quote_unavailable',message:quote?.message??'A fresh quote is unavailable.'};
 if(quote.asset?.symbol!=='aUSDd'||quote.asset?.kind!=='token'||quote.asset?.tokenId!==mandate.tokenId)return {status:403,reason:'asset_changed',message:'The approved testnet asset changed. Purchases are paused.'};
 if(!Number.isSafeInteger(quote.settled?.premiumUnits)||quote.settled.premiumUnits<1||quote.settled.premiumUnits>Math.round(mandate.monthlyBudget*1e6))return {status:409,reason:'budget_exceeded',message:'The premium exceeds your approved monthly budget.'};
 if(!Number.isSafeInteger(quote.settled?.payoutUnits)||quote.settled.payoutUnits<mandate.minimumPayout*1e6)return {status:409,reason:'minimum_not_met',message:'The quote falls below your minimum payout. No purchase was made.'};
 if(quote.hazard?.triggerRadiusKm!==TRIGGER.radiusKm)return {status:409,reason:'terms_changed',message:'The trigger radius changed. Review is required.'};
 return null;
}
