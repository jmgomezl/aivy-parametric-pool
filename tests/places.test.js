import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceSearch, normalizePlace, placeResults } from '../src/places.js';
const feature=(name,state,country,lat,lon,extra={})=>({type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:{name,state,country,osm_value:'city',type:'city',...extra}});
test('global places preserve regional disambiguation, normalize accents and reject invalid coordinates',()=>{
 assert.equal(normalizePlace(' Medellín '),'medellin');
 assert.notEqual(normalizePlace('ガ'),normalizePlace('カ')); 
 const rows=placeResults({features:[feature('Medellín','Antioquia','Colombia',6.24,-75.57),feature('Medellin','Cebu','Philippines',11.12,123.96,{osm_value:'town'}),feature('Medellín','Antioquia','Colombia',6.26,-75.60,{type:'district'}),feature('Invalid','','',95,12)]});
 assert.equal(rows.length,2);assert.equal(rows[0].name,'Medellín, Antioquia, Colombia');assert.equal(rows[0].lat,6.24);assert.match(rows[1].name,/Philippines/);
});
test('worldwide queries share in-flight requests and cached accent variants',async()=>{
 let calls=0;
 const search=createPlaceSearch(async(url,options)=>{calls++;assert.equal(url.hostname,'photon.komoot.io');assert.ok(url.searchParams.getAll('layer').includes('locality'));assert.ok(options.signal);return{ok:true,json:async()=>({features:[feature('Medellín','Antioquia','Colombia',6.24,-75.57)]})};});
 const [first,second]=await Promise.all([search('Medellin'),search('Medellín')]);assert.deepEqual(first,second);assert.equal(calls,1);
 assert.deepEqual(await search('MEDELLIN'),first);assert.equal(calls,1);
 await assert.rejects(search('a'),/2 to 100/);await assert.rejects(search('x'.repeat(101)),/2 to 100/);
});
test('upstream failure is not reported as an empty successful search',async()=>{
 const search=createPlaceSearch(async()=>({ok:false,status:503}));await assert.rejects(search('Envigado'),/unavailable/);
});
