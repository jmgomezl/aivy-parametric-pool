// Read-only: reconcile public policy economics with HCS and Hedera Mirror Node.
// node scripts/audit-economics.js --require-api-match
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readTermsMessage} from '../src/oracle/verify-policy.js';
import {summarizeExposure,assetKey} from '../src/pool/exposure.js';
import {probability} from '../src/pricing/hazard.js';
import {lpModel} from '../ui/src/lib/lp-model.mjs';

const base='https://quorum.aivylabs.xyz',mirror='https://testnet.mirrornode.hedera.com/api/v1';
const get=async url=>{const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`${r.status} ${url}`);return r.json();};
const txId=id=>id.includes('@')?id.replace('@','-').replace(/\.(\d+)$/,'-$1'):id;
const close=(a,b,eps=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=eps,`${a} != ${b}`);
const [pool,{policies}]=await Promise.all([get(base+'/api/pool'),get(base+'/api/policies')]);
const now=Date.now(),rows=[];
for(let i=0;i<policies.length;i+=4){
  const batch=await Promise.all(policies.slice(i,i+4).map(async p=>{
    const [,topic,seq]=/^hcs:\/\/(0\.0\.\d+)\/(\d+)$/.exec(p.termsPointer)??[];
    assert(topic&&seq,'A public policy must identify its terms.');
    const [first,payment]=await Promise.all([get(`${mirror}/topics/${topic}/messages/${seq}`),get(`${mirror}/transactions/${txId(p.saleTxId)}`)]);
    const terms=await readTermsMessage('testnet',topic,first);
    const native=!terms.asset||terms.asset.kind==='hbar',decimals=native?8:terms.asset.decimals;
    const asset=native?'HBAR':terms.asset.symbol;
    const premiumUnits=p.premiumUnits??Math.round(p.premiumHbar*1e8);
    const payoutUnits=p.payoutUnits??Math.round(p.payoutHbar*1e8);
    close(terms.settled.premiumUnits??Math.round(terms.settled.premiumHbar*1e8),premiumUnits,0);
    close(terms.settled.payoutUnits??Math.round(terms.settled.payoutHbar*1e8),payoutUnits,0);
    const transaction=payment.transactions.find(t=>t.name==='CRYPTOTRANSFER'&&t.result==='SUCCESS'&&t.nonce===0);
    assert(transaction,'Premium transfer must have reached SUCCESS.');
    const legs=native?transaction.transfers:transaction.token_transfers.filter(t=>t.token_id===terms.asset.tokenId);
    const amount=id=>legs.filter(l=>l.account===id).reduce((s,l)=>s+l.amount,0);
    const commissionUnits=p.brokerId?Math.round(premiumUnits*.15):0,poolUnits=premiumUnits-commissionUnits;
    assert.equal(amount(p.buyerId),-premiumUnits);assert.equal(amount(pool.poolAccountId),poolUnits);
    if(p.brokerId)assert.equal(amount(p.brokerId),commissionUnits);
    const days=terms.trigger.windowDays,prob=probability(terms.hazard.lambdaPriced,days);
    close(terms.modelled.payoutUsd*prob/terms.lossRatio,terms.modelled.premiumUsd,1e-5);
    const premium=premiumUnits/10**decimals,payout=payoutUnits/10**decimals;
    const expectedLoss=payout*prob,poolPremium=poolUnits/10**decimals;
    return {serial:p.serial,asset,premium,payout,days,probability:prob,lossRatio:terms.lossRatio,
      broker:commissionUnits/10**decimals,poolPremium,expectedLoss,
      modeledMarginBeforeCosts:poolPremium-expectedLoss,
      termPremiumRate:poolPremium/payout*100,annualPremiumComparison:poolPremium/payout*365/days*100,
      state:p.state,premiumTransaction:transaction.transaction_id,termsPointer:p.termsPointer};
  }));
  rows.push(...batch);
}
const balances=await get(`${mirror}/accounts/${pool.poolAccountId}?transactions=false`);
const tokenBalances=await get(`${mirror}/accounts/${pool.poolAccountId}/tokens?token.id=${pool.asset.tokenId}`);
const asset={kind:'token',symbol:pool.asset.symbol,tokenId:pool.asset.tokenId,decimals:6};
const exposure=summarizeExposure(policies,{now,legacyTokens:{aUSDd:pool.asset.tokenId}});
const current=exposure.find(g=>assetKey(g)===assetKey(asset));
const capital=Number(tokenBalances.tokens.find(t=>t.token_id===asset.tokenId).balance)/1e6;
const committed=current.committedUnits/1e6,headroom=capital-committed;
close(capital,pool.capital);
assert(headroom>=0,'Outstanding payouts must fit current token capital.');
for(const g of exposure.filter(g=>g.kind==='hbar'))assert(g.committedUnits<=balances.balance.balance,'Legacy HBAR needs its own HBAR backing.');
const apiExposureMatches=Math.abs(pool.committed-committed)<1e-6&&Math.abs(pool.headroom-headroom)<1e-6;
if(process.argv.includes('--require-api-match'))assert(apiExposureMatches,'Deployed capacity must use the same asset accounting.');

// Re-read an actual deposit, not just the stored UI success response.
const prior=JSON.parse(fs.readFileSync(new URL('../docs/evidence/business-flows.json',import.meta.url)));
const deposit=(await get(`${mirror}/transactions/${prior.transactions.uiDeposit.transaction_id}`)).transactions.find(t=>t.name==='CRYPTOTRANSFER'&&t.result==='SUCCESS');
assert(deposit);const account=prior.browserAccount,shareToken='0.0.10373724';
const leg=(token,id)=>deposit.token_transfers.filter(t=>t.token_id===token&&t.account===id).reduce((s,l)=>s+l.amount,0);
assert.equal(leg(asset.tokenId,account),-25e6);assert.equal(leg(asset.tokenId,pool.poolAccountId),25e6);assert.equal(leg(shareToken,account),25e8);
const share=await get(`${mirror}/tokens/${shareToken}`),issuedShares=Number(share.total_supply)/10**Number(share.decimals);
const example=lpModel({payoutHbar:800,premiumHbar:8,premiumUnits:8e6,brokerId:'example',trigger:{windowStart:'2026-01-01',windowEnd:'2026-01-31'}},25);
const report={checkedAt:new Date().toISOString(),scope:'Read-only economic and receipt review; no transfers, deposits or claims sent.',
  policiesReviewed:rows.length,allPremiumTransfersVerified:true,allPublishedPriceFormulasVerified:true,
  pool:{account:pool.poolAccountId,asset:asset.symbol,capital,committed,headroom,reservedPercent:committed/capital*100,obligations:current.obligations,
    previousApiCommitted:pool.committed,apiExposureMatches,
    legacyHbar:{capital:balances.balance.balance/1e8,committed:(exposure.find(g=>g.kind==='hbar')?.committedUnits??0)/1e8}},
  arps:{token:shareToken,issuedShares,deposit:{transaction:deposit.transaction_id,amount:25,shares:25,holdingPercentOfCurrentSupply:25/issuedShares*100},
    pricing:'Fixed 1:1 demo issuance; no NAV, profit entitlement or redemption.'},
  illustrativePolicy:example,policies:rows};
fs.writeFileSync(new URL('../docs/evidence/funding-economics.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({policiesReviewed:rows.length,allPremiumTransfersVerified:true,allPublishedPriceFormulasVerified:true,pool:report.pool,arps:report.arps}));
