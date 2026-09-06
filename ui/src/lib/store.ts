import { useEffect, useState } from 'react';
import * as agent from './agent';
export interface AgentState {
  checked:boolean; online:boolean; network:agent.Network; writesAllowed:boolean;
  pool:agent.Pool|null; poolAt:string|null; policies:agent.Policy[]|null; policiesError:string|null;
}
let state:AgentState={checked:false,online:false,network:'testnet',writesAllowed:false,pool:null,poolAt:null,policies:null,policiesError:null};
const subs=new Set<(s:AgentState)=>void>();
let inflight:Promise<void>|null=null, timer:number|null=null;
export function refresh():Promise<void>{
  if(inflight)return inflight;
  inflight=(async()=>{
    try{
      const previousNetwork=state.network;
      const h=await agent.health();
      state={...state,checked:true,online:h.ok,network:h.network,writesAllowed:h.writesAllowed,...(previousNetwork!==h.network?{pool:null,poolAt:null,policies:null}: {})};
      subs.forEach(f=>f(state));
      const [pool,book]=await Promise.allSettled([agent.pool(),agent.policies()]);
      const same=previousNetwork===h.network;
      state={...state,checked:true,online:h.ok,network:h.network,writesAllowed:h.writesAllowed,
        pool:pool.status==='fulfilled'&&typeof pool.value.capital==='number'?pool.value:same?state.pool:null,
        poolAt:pool.status==='fulfilled'&&typeof pool.value.capital==='number'?new Date().toISOString():same?state.poolAt:null,
        policies:book.status==='fulfilled'&&Array.isArray(book.value.policies)?book.value.policies:same?state.policies:null,
        policiesError:book.status==='fulfilled'&&Array.isArray(book.value.policies)?null:'Policy updates are temporarily unavailable.'};
    }catch{state={...state,checked:true,online:false,policiesError:'The service is offline. Showing the last available policies.'};}
    subs.forEach(f=>f(state));
  })().finally(()=>{inflight=null;});return inflight;
}
export function useAgent():AgentState{
  const [s,setS]=useState(state);
  useEffect(()=>{subs.add(setS);void refresh();if(timer===null)timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},10000);
    const visible=()=>{if(document.visibilityState==='visible')void refresh();};document.addEventListener('visibilitychange',visible);
    return()=>{subs.delete(setS);document.removeEventListener('visibilitychange',visible);if(subs.size===0&&timer!==null){clearInterval(timer);timer=null;}};
  },[]);return s;
}
const key=(network:agent.Network)=>`aivy.created.${network}`;
export function mine(network:agent.Network='testnet'):string[]{try{return JSON.parse(localStorage.getItem(key(network))??'[]');}catch{return[];}}
export function remember(serial:string,network:agent.Network='testnet'){try{localStorage.setItem(key(network),JSON.stringify([...new Set([...mine(network),serial])]));}catch{/* private browser */}}
export const policyState=(p:agent.Policy)=>p.state??'unavailable';
export const statusLabel=(p:agent.Policy)=>({paid:'Paid',expired:'Expired',active:'Committed',confirming:'Confirming',unavailable:'Status unavailable'})[policyState(p)];

export function pendingRequests(network:agent.Network):string[]{try{return JSON.parse(localStorage.getItem(`aivy.pending.${network}`)??'[]');}catch{return[];}}
export function trackRequest(id:string,network:agent.Network,done=false){try{const ids=pendingRequests(network).filter(x=>x!==id);localStorage.setItem(`aivy.pending.${network}`,JSON.stringify(done?ids:[...ids,id]));}catch{/* storage unavailable */}}
