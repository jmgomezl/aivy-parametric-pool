import test from 'node:test';
import assert from 'node:assert/strict';
import {readTermsMessage} from '../src/oracle/verify-policy.js';
const topic='0.0.3',tx={account_id:'0.0.1',transaction_valid_start:'123.4'},encode=s=>Buffer.from(s).toString('base64');
const raw=JSON.stringify({policy:'original identity only',payload:'x'.repeat(400)});
const part=(sequence,number,total,message)=>({sequence_number:sequence,chunk_info:{number,total,initial_transaction_id:tx},message:encode(message)});
const unrelated=sequence=>({...part(sequence,1,1,'{}'),chunk_info:{number:1,total:1,initial_transaction_id:{...tx,transaction_valid_start:`${sequence}.9`}}});
function mirror(rows){
 const calls=[];
 return {calls,fetch:async url=>{calls.push(String(url));const u=new URL(url),[op,n]=u.searchParams.get('sequencenumber').split(':'),desc=u.searchParams.get('order')==='desc';
 const selected=rows.filter(r=>op==='gt'?r.sequence_number>Number(n):r.sequence_number<Number(n)).sort((a,b)=>desc?b.sequence_number-a.sequence_number:a.sequence_number-b.sequence_number),page=selected.slice(0,100);
 const next=selected.length>100?`/api/v1/topics/${topic}/messages?sequencenumber=${op}:${page.at(-1).sequence_number}&order=${desc?'desc':'asc'}&limit=100`:null;
 return {ok:true,json:async()=>({messages:page,links:{next}})};}};
}
test('finds interleaved sibling chunks on later pages in both directions',async()=>{
 const first=part(201,1,3,raw.slice(0,100)),before=part(50,2,3,raw.slice(100,200)),after=part(399,3,3,raw.slice(200));
 const rows=Array.from({length:450},(_,i)=>unrelated(i+1)).filter(m=>![50,201,399].includes(m.sequence_number));rows.push(first,before,after);
 const m=mirror(rows);assert.deepEqual(await readTermsMessage('testnet',topic,first,m.fetch),JSON.parse(raw));assert.equal(m.calls.length,4);
});
test('unrelated transactions cannot complete a policy and lookups stay bounded',async()=>{
 const first=part(700,1,2,raw.slice(0,100)),m=mirror(Array.from({length:1400},(_,i)=>unrelated(i+1)));
 await assert.rejects(readTermsMessage('testnet',topic,first,m.fetch),/incomplete/);assert.equal(m.calls.length,10);
});
test('conflicting numbers and totals are rejected, including across both sides',async()=>{
 const first=part(10,1,2,raw.slice(0,100));
 for(const rows of [[part(9,2,2,raw.slice(100)),part(11,2,2,raw.slice(100))],[part(9,2,3,raw.slice(100))],[part(11,1.5,2,raw.slice(100))]]){
  await assert.rejects(readTermsMessage('testnet',topic,first,mirror(rows).fetch),/Inconsistent/);
 }
});
test('foreign or repeated pagination fails closed',async()=>{
 const first=part(10,1,2,raw.slice(0,100));
 for(const next of ['https://other.example/messages','/api/v1/topics/0.0.999/messages?limit=100']){
  await assert.rejects(readTermsMessage('testnet',topic,first,async()=>({ok:true,json:async()=>({messages:[],links:{next}})})),/Invalid message pagination/);
 }
 await assert.rejects(readTermsMessage('testnet',topic,first,async()=>({ok:true,json:async()=>({messages:[],links:{next:`/api/v1/topics/${topic}/messages?sequencenumber=gt:10&order=asc&limit=100`}})})),/Repeated message pagination/);
});
