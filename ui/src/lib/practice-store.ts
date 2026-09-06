import {useSyncExternalStore} from 'react';
import {initialPractice,validPractice,practiceChange,type Practice} from './practice.mjs';
const key='quorum.practice.v1',listeners=new Set<()=>void>();
let error:string|null=null;
const read=()=>{try{const raw=localStorage.getItem(key);if(!raw)return initialPractice();const s=JSON.parse(raw);if(!validPractice(s))throw Error();return s;}catch{error='Practice storage unavailable. Reset to start a new simulation.';return {...initialPractice(),available:0};}};
let current=read();
window.addEventListener('storage',e=>{if(e.key===key){current=read();listeners.forEach(f=>f());}});
export function usePractice(){const state=useSyncExternalStore(cb=>{listeners.add(cb);return()=>{listeners.delete(cb);};},()=>current);return {state,error};}
export function updatePractice(action:Parameters<typeof practiceChange>[1]){
 const next=practiceChange(action.type==='reset'?initialPractice():read(),action);
 try{localStorage.setItem(key,JSON.stringify(next));}catch{throw new Error('Browser storage is unavailable. Enable it to save a practice position.');}
 current=next;error=null;listeners.forEach(f=>f());return next;
}
export const positionId=(network:string,serial:string)=>`${network}:${serial}`;
