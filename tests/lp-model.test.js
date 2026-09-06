import test from 'node:test';
import assert from 'node:assert/strict';
import {lpModel} from '../ui/src/lib/lp-model.mjs';
const policy={payoutHbar:800,premiumHbar:8,brokerId:null,trigger:{windowStart:'2026-01-01T00:00:00Z',windowEnd:'2026-01-31T00:00:00Z'}};
test('LP preview annualizes term income without compounding and exposes full principal loss',()=>{
 const p=lpModel(policy,25);assert.equal(p.contribution,200);assert.equal(p.income,2);assert.equal(p.noClaimTotal,202);assert.equal(p.claimTotal,2);assert.equal(p.annualRate,365/30);
 assert.equal(lpModel({...policy,brokerId:'0.0.1'},25).income,1.7);
 assert.equal(lpModel(policy,50).annualRate,p.annualRate);
});
test('LP preview bounds share and refuses missing or invalid pricing periods',()=>{
 assert.equal(lpModel(policy,-1).contribution,0);assert.equal(lpModel(policy,150).contribution,800);
 assert.equal(lpModel({...policy,trigger:undefined}),null);assert.equal(lpModel({...policy,payoutHbar:0}),null);assert.equal(lpModel(policy,NaN),null);
});
