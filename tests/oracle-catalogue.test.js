import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES} from '../src/oracle/sources.js';
import {attestOrUnavailable, quorumReached} from '../src/oracle/attest.js';

const query={lat:35.6762,lon:139.6503,radiusKm:100,minMagnitude:5.5,since:'2026-09-06T05:09:14.655Z',until:'2026-09-07T17:12:59.064Z'};
test('FDSN 204 means an empty catalogue for all sources, without retries',async()=>{
 const original=global.fetch;let calls=0;
 try{global.fetch=async()=>{calls++;return new Response(null,{status:204});};
  for(const source of Object.values(SOURCES))assert.deepEqual((await source.fetch(query)).events,[]);
  assert.equal(calls,3);
 }finally{global.fetch=original;}
});
test('empty or malformed HTTP 200 is unavailable, never a no-event result',async()=>{
 const original=global.fetch;
 try{
  for(const [key,body] of [['usgs',''],['emsc','{}'],['geofon','']]){
   let calls=0;global.fetch=async()=>{calls++;return new Response(body);};
   await assert.rejects(SOURCES[key].fetch(query));assert.equal(calls,3);
  }
 }finally{global.fetch=original;}
});
test('catalogue errors produce a controlled missing vote without leaking internals',async()=>{
 const result=await attestOrUnavailable('emsc',{},async()=>{throw Error('secret internal details');});
 assert.equal(result.unavailable,true);assert.equal(result.triggered,false);
 assert.equal(quorumReached([result]).agreeing,0);
 assert.ok(!JSON.stringify(result).includes('secret'));
});
