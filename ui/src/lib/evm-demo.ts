import {useSyncExternalStore} from 'react';
import {demoCall,demoToken} from './demo';
export type DemoEvmPosition={tokenId:string;owner:string;liquidity:string;amount0:string;amount1:string;claimable0:string;claimable1:string;inRange:boolean;supported:boolean};
export type DemoEvmAction={requestId:string;kind:string;action?:string;status:'pending'|'complete'|'failed';message:string;steps:{name:string;hash?:string;status:string}[];result?:{transactionHash:string;tokenId?:string|null}|null};
export type DemoEvmWallet={status:'none'|'funding'|'ready';address?:string;running?:boolean;message?:string;balance0?:string;balance1?:string;balancesAvailable?:boolean;positions?:DemoEvmPosition[];nextCursor?:string|null;starterSteps?:{name:string;hash?:string;status:string}[];actions?:DemoEvmAction[]};
export type DemoEvmQuote={quoteId:string;kind:string;expiresAt:number;amountOut?:string;minimumOut?:string;amount0?:string;amount1?:string;maximum0?:string;action?:string;tokenId?:string|null};
const PENDING='quorum.demo.evm.operation';
let state:{wallet:DemoEvmWallet|null;busy:boolean;error:string}={wallet:null,busy:false,error:''};
const listeners=new Set<()=>void>();let reading:Promise<DemoEvmWallet|null>|null=null,timer:ReturnType<typeof setInterval>|undefined;
const emit=()=>listeners.forEach(fn=>fn());
const saved=():{requestId:string;quoteId:string}|null=>{try{return JSON.parse(localStorage.getItem(PENDING)??'null');}catch{return null;}};
function accept(wallet:DemoEvmWallet){state={...state,wallet,error:''};const p=saved(),a=wallet.actions?.find(a=>a.requestId===p?.requestId);if(a&&a.status!=='pending')localStorage.removeItem(PENDING);emit();return wallet;}
export function refreshEvmDemo(){
  if(!demoToken())return Promise.resolve(null);if(reading)return reading;
  reading=(async()=>{try{return accept(await demoCall('/api/demo/evm'));}catch(e){state={...state,error:(e as Error).message};emit();return null;}})().finally(()=>reading=null);return reading;
}
export async function startEvmDemo(){state={...state,busy:true,error:''};emit();try{return accept(await demoCall('/api/demo/evm/start',{}));}catch(e){state={...state,error:(e as Error).message};throw e;}finally{state={...state,busy:false};emit();}}
export async function quoteEvmDemo(kind:string,input:unknown):Promise<DemoEvmQuote>{return demoCall('/api/demo/evm/quote',{kind,input});}
export async function executeEvmDemo(quote:DemoEvmQuote){
  if(Date.now()>=quote.expiresAt)throw Error('Review expired. Refresh the amounts first.');
  const request=saved()??{requestId:crypto.randomUUID(),quoteId:quote.quoteId};
  if(request.quoteId!==quote.quoteId)throw Error('Continue the original demo operation first.');
  localStorage.setItem(PENDING,JSON.stringify(request));
  try{return accept(await demoCall('/api/demo/evm/execute',request));}catch(e){
    const w=await refreshEvmDemo();
    if((e as {status?:number}).status&&w&&!w.actions?.some(a=>a.requestId===request.requestId))localStorage.removeItem(PENDING);
    throw e;
  }
}
export async function resumeEvmDemo(){
  const pending=state.wallet?.actions?.find(a=>a.status==='pending'),local=saved();
  if(pending)return accept(await demoCall('/api/demo/evm/resume',{requestId:pending.requestId}));
  if(local){try{return accept(await demoCall('/api/demo/evm/execute',local));}catch(e){const w=await refreshEvmDemo();if((e as {status?:number}).status&&w&&!w.actions?.some(a=>a.requestId===local.requestId))localStorage.removeItem(PENDING);throw e;}}
  return refreshEvmDemo();
}
export const hasUnknownEvmOperation=()=>Boolean(saved());
let lastPoll=0;
const subscribe=(fn:()=>void)=>{listeners.add(fn);void refreshEvmDemo();if(!timer)timer=setInterval(()=>{if(document.visibilityState==='visible'&&(state.wallet?.running||state.wallet?.status==='funding'||Date.now()-lastPoll>=15000)){lastPoll=Date.now();void refreshEvmDemo();}},4000);return()=>{listeners.delete(fn);if(!listeners.size){clearInterval(timer);timer=undefined;}};};
export const useEvmDemo=()=>useSyncExternalStore(subscribe,()=>state);
export const demoUnits=(value?:string)=>value===undefined?'—':(Number(value)/1e6).toLocaleString(undefined,{maximumFractionDigits:6});
