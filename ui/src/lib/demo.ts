import {useSyncExternalStore} from 'react';
const BASE=import.meta.env.VITE_AGENT_URL??'',key='quorum.testnet.session';
export function demoToken(){try{return localStorage.getItem(key)??'';}catch{return '';}}
function ensureToken(){let token=demoToken();if(!token){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem(key,token);}return token;}
export interface DemoAccount {ok:true;network:string;accountId:string;asset:string;balance:number;shares:number;shareTokenId:string;referralCode:string;starterTx:string;commissions:{serial:string;amount:number;transaction:string}[];checkedAt:string;actions:{requestId:string;kind:string;amount:number;status:string;result?:{depositTxId?:string;shares?:number;serial?:string;saleTxId?:string;brokerId?:string}}[]}
let state:{account:DemoAccount|null;busy:boolean;error:string}={account:null,busy:false,error:''};
const listeners=new Set<()=>void>();const emit=()=>listeners.forEach(f=>f());let reading:Promise<void>|null=null;
export async function demoCall(path:string,body?:unknown){const response=await fetch(BASE+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',authorization:`Bearer ${ensureToken()}`},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(120000)});const r=await response.json();if(!response.ok||r.ok===false)throw Error(r.message??'Demo request unavailable.');return r;}
export function refreshDemo(){if(!demoToken())return Promise.resolve();if(reading)return reading;reading=(async()=>{try{state={...state,account:await demoCall('/api/demo'),error:''};}catch(e){state={...state,error:(e as Error).message};}emit();})().finally(()=>{reading=null;});return reading;}
export async function startDemo(){if(state.busy)return;state={...state,busy:true,error:''};emit();try{state={account:await demoCall('/api/demo/start',{}),busy:false,error:''};}catch(e){state={...state,busy:false,error:(e as Error).message};}emit();}
let timer:ReturnType<typeof setInterval>|undefined;
const subscribe=(cb:()=>void)=>{listeners.add(cb);void refreshDemo();if(!timer)timer=setInterval(()=>{if(document.visibilityState==='visible')void refreshDemo();},15000);return()=>{listeners.delete(cb);if(!listeners.size){clearInterval(timer);timer=undefined;}};};
export function useDemo(){return useSyncExternalStore(subscribe,()=>state);}
export const receipt=(id:string)=>`https://hashscan.io/testnet/transaction/${id}`;
