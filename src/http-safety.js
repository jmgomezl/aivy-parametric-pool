import { isIP } from 'node:net';
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;this.reason='invalid_input';} }
// Nginx appends the actual peer at the RIGHT edge. Never trust a caller's first
// X-Forwarded-For value. Headers are trusted only from our loopback proxy.
export function clientIp(req,trustProxy=process.env.TRUST_PROXY==='1') {
 const peer=req.socket.remoteAddress??'unknown';
 if(!trustProxy||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer))return peer;
 const raw=req.headers['x-forwarded-for'];
 const last=typeof raw==='string'?raw.split(',').at(-1).trim():'';
 return isIP(last)?last:peer;
}
export function requestPath(req){return new URL(req.url,'http://localhost').pathname.replace(/\/$/,'')||'/';}
export function readJsonBody(req,{limit=8192}={}){
 return new Promise((resolve,reject)=>{
  let size=0,parts=[],failed=false;
  const fail=error=>{if(failed)return;failed=true;parts=[];reject(error);};
  req.on('data',chunk=>{if(failed)return;size+=Buffer.byteLength(chunk);if(size>limit)return fail(new HttpError(413,'Request body exceeds 8 KB.'));parts.push(Buffer.from(chunk));});
  req.on('aborted',()=>fail(new HttpError(400,'Request interrupted.')));
  req.on('error',()=>fail(new HttpError(400,'Request interrupted.')));
  req.on('end',()=>{if(failed)return;try{const value=JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');if(!value||Array.isArray(value)||typeof value!=='object')throw new Error();resolve(value);}catch{fail(new HttpError(400,'Expected a JSON object.'));}});
 });
}
export function policyInput(input){
 const keys=['lat','lon','place','budgetUsd','days','requestId'];
 if(Object.keys(input).some(key=>!keys.includes(key)))throw new HttpError(400,'Unsupported policy field.');
 const {lat,lon,budgetUsd=4,days=30,requestId,place}=input;
 if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||!Number.isFinite(budgetUsd)||budgetUsd<1||budgetUsd>50||!Number.isInteger(days)||days<7||days>62)throw new HttpError(400,'Choose a valid location, a budget from $1 to $50, and 7 to 62 days.');
 if(requestId!==undefined&&(typeof requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)))throw new HttpError(400,'Invalid request identifier.');
 if(place!==undefined&&place!==null&&typeof place!=='string')throw new HttpError(400,'Invalid place label.');
 return {lat,lon,budgetUsd,days,requestId,place:place?.slice(0,100)??null};
}
