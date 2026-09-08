import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeExposure, exposureFor} from '../src/pool/exposure.js';
import {lpModel} from '../ui/src/lib/lp-model.mjs';
import {quote, coverForBudget} from '../src/pricing/hazard.js';

const now = Date.parse('2026-09-08'), end = '2026-10-08';
const token = {kind:'token',tokenId:'0.0.100',symbol:'aUSDd',decimals:6};
const hbar = {kind:'hbar',symbol:'HBAR',decimals:8,tokenId:null};
const opts = {now,legacyTokens:{aUSDd:token.tokenId}};
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('capacity segregates legacy tinybars, registered token units and pending reservations',()=>{
  const rows=[{payoutHbar:81.39615783,lapsesAt:end},{asset:'aUSDd',payoutUnits:800e6,lapsesAt:end},
    {settlementAsset:token,payoutUnits:20e6,lapsesAt:end,status:'needs_review'},
    {quote:{asset:{...token,tokenId:'0.0.101'}},payoutUnits:900e6,lapsesAt:end},
    {asset:'aUSDd',payoutUnits:10e6,lapsesAt:end,state:'paid'},
    {asset:'aUSDd',payoutUnits:30e6,lapsesAt:'2026-09-07'}];
  assert.equal(exposureFor(rows,token,opts),820e6);
  assert.equal(exposureFor(rows,hbar,opts),8139615783);
  assert.equal(summarizeExposure(rows,opts).length,3);
  assert.equal(exposureFor(rows,{...token,tokenId:'0.0.999'},opts),0,'a configured new token does not inherit old liabilities');
});

test('unknown assets, token amounts, expiry, overflow or inconsistent decimals refuse capacity',()=>{
  for(const row of [{payoutUnits:1,lapsesAt:end},{asset:'FAKE',payoutUnits:1,lapsesAt:end},
    {asset:'aUSDd',payoutHbar:1,lapsesAt:end},{asset:'aUSDd',payoutUnits:NaN,lapsesAt:end},
    {asset:'aUSDd',payoutUnits:1.5,lapsesAt:end},{asset:'aUSDd',payoutUnits:-1,lapsesAt:end},
    {asset:'aUSDd',payoutUnits:1,lapsesAt:'unknown'}]) assert.throws(()=>summarizeExposure([row],opts));
  assert.throws(()=>summarizeExposure([6,8].map(decimals=>({settlementAsset:{...token,decimals},payoutUnits:1,lapsesAt:end})),opts));
  assert.throws(()=>summarizeExposure([1,1].map(()=>({settlementAsset:token,payoutUnits:Number.MAX_SAFE_INTEGER,lapsesAt:end})),opts));
});

test('an 800 payout / 8 premium example conserves cash in both full-term outcomes',()=>{
  const policy={payoutHbar:800,premiumHbar:8,premiumUnits:8e6,brokerId:'0.0.7',trigger:{windowStart:'2026-01-01',windowEnd:'2026-01-31'}};
  const m=lpModel(policy,25);
  close(m.commission,1.2);close(m.poolPremium,6.8);close(m.poolPremium+m.commission,8);
  close(m.contribution,200);close(m.income,1.7);close(m.noClaimTotal,201.7);close(m.claimTotal,1.7);
  close(m.returnPct,.85);close(m.lossPct,-99.15);close(m.annualRate,.85*365/30);
  close(m.noClaimTotal-m.claimTotal,m.contribution);
  close(lpModel({...policy,brokerId:null},25).income,2);
  close(lpModel(policy,0).noClaimTotal,0);close(lpModel(policy,0).lossPct,0);
});

test('a 62-day policy retains its full term rather than inventing a 30-day exit',()=>{
  const m=lpModel({payoutHbar:800,premiumHbar:8,brokerId:null,trigger:{windowStart:'2026-01-01',windowEnd:'2026-03-04'}},25);
  assert.equal(m.days,62);assert.equal(m.noClaimTotal,202);assert.equal(m.claimTotal,2);
  close(m.annualRate,365/62);
});

test('policy preview respects base-unit commission rounding',()=>{
  const m=lpModel({payoutHbar:2,premiumHbar:1.000003,premiumUnits:1000003,brokerId:'0.0.7',trigger:{windowStart:'2026-01-01',windowEnd:'2026-01-31'}},100);
  close(m.commission,.15);close(m.poolPremium,.850003);
});

test('pricing loss ratio is measured against gross premium, before the broker split',()=>{
  const q=quote({lambda:.03,payout:800,days:30,lossRatio:.5});
  close(q.expectedLoss,q.premium*.5);
  close(q.expectedLoss/(q.premium*.85),.5/.85);
  close(coverForBudget({lambda:.03,budget:q.premium,days:30,lossRatio:.5}).cover,800);
  close(q.premium*.85-q.expectedLoss,q.premium*.35);
});
