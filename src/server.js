import {checkPolicy,latestPolicyCheck} from './demo/policyChecks.js';
import {createBridgedSwap} from './settlement/bridgedSwap.js';
import {createLiquidity} from './settlement/liquidity.js';
import {createEvmDemo} from './demo/evm.js';
import {bridgeConfig,bridgeStatus} from './settlement/bridge.js';
import {createTestnetSwap} from './settlement/testnetSwap.js';
// The underwriting agent, over HTTP.
//
// Quoting is free and touches nothing — it reads the USGS record and does
// arithmetic, so it is open. Issuing writes to the ledger and spends the agent's
// own HBAR, so it goes through src/guards.js first and is refused outright on
// mainnet unless someone deliberately opted in from a terminal.
//
// A visitor gets a throwaway buyer account funded by the agent. That is a
// custodial demo, not the production shape: in production the buyer signs their
// own leg of the premium transfer, which the kit already supports through
// AgentMode.RETURN_BYTES.
import http from 'node:http';
import {demoService} from './demo/service.js';
import {createDemoPurchase} from './demo/purchase.js';
import {coverAgentStore} from './cover-agent/store.js';
import {coverAgentService} from './cover-agent/service.js';
import {coverCompanion,companionGate} from './cover-agent/companion.js';
import {quorumCompanion} from './companion/quorum.js';
import mainnetRecord from '../ui/src/data/mainnet.json' with {type:'json'};
import {LP_POOL} from './settlement/liquidity.js';
import {PLACES,TRIGGER,MAX_CYCLES} from './cover-agent/rules.js';
import {capability} from './demo/store.js';
import { searchPlaces } from './places.js';
import { paymentActivity } from './activity.js';
import {BLOCKY_INFO} from './x402/blocky.js';
import { AccountId } from '@hiero-ledger/sdk';
import { client, operator, assertOperatorKey, NETWORK, HASHSCAN } from './config.js';
import { load } from './registry.js';
import { quotePolicy, isIssuing } from './policy/issue.js';
import { readPolicies, mirrorGet } from './ledger.js';
import { policies, reservations, settle, request, legacyTokens } from './book.js';
import { summarizeExposure, assetKey } from './pool/exposure.js';
import { withIssuanceLock } from './issuance-lock.js';
import { createWriteGuard, LIMITS } from './guards.js';
import { clientIp, readJsonBody, HttpError, withHttpErrors } from './http-safety.js';
import { settlementAsset, fromUnits } from './asset.js';
import { quoteCrossAsset, STABLES } from './settlement/crossAsset.js';

const PORT = Number(process.env.PORT ?? 8791);
const json = (res, status, body) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(body, null, 2));
};

const num = (v, fallback) => (v == null || v === '' || Number.isNaN(Number(v)) ? fallback : Number(v));

async function main() {
  await assertOperatorKey();
  const c = client();
  const agent = operator();
  const reg = load(NETWORK);
  for (const key of ['poolAccountId', 'shareTokenId', 'policyTokenId', 'termsTopicId']) {
    if (!reg[key]) throw new Error(`${NETWORK} is not provisioned (${key} missing). Run: npm run provision`);
  }
  const writeGuard=createWriteGuard({network:NETWORK,seed:()=>[...policies(NETWORK),...reservations(NETWORK)]});
  await withIssuanceLock(NETWORK,()=>writeGuard.initialize());
  const poolId = AccountId.fromString(reg.poolAccountId);
  const identities = {agentPublicKey:agent.key.publicKey.toStringRaw(),oraclePublicKeys:reg.oraclePublicKeys,oracleSources:reg.oracleSources??['usgs','emsc','sgc']};
  const currentPolicies = () => readPolicies(NETWORK,policies(NETWORK),identities);
  const publicPolicy = ({requestId, quote, ...p}) => p;
  const deps = {
    client: c, agent, network: NETWORK, poolId,
    policyTokenId: reg.policyTokenId, termsTopicId: reg.termsTopicId,
    reconcile: async () => {for(const p of await currentPolicies())if(p.state==='paid')settle(NETWORK,p.serial,p.executedAt);},
  };

  const prepareTestnetSwap=createTestnetSwap();
  const bridgedSwaps=createBridgedSwap();
  const liquidity=createLiquidity();
  const demo=demoService({client:c,agent,network:NETWORK,reg});
  const purchaseDemoPolicy=createDemoPurchase({demo,deps,writeGuard,reg,network:NETWORK});
  let coverAgents=NETWORK==='testnet'&&process.env.COVER_AGENTS_ENABLED!=='0'?coverAgentService({
    store:coverAgentStore(),account:id=>demo.store.account(id),purchase:purchaseDemoPolicy,
    quote:quotePolicy,lookup:id=>request(NETWORK,id),network:NETWORK,tokenId:reg.demoTokenId,
    reconcile:(id,requestId,p)=>withIssuanceLock(NETWORK,()=>{
      const action=demo.store.account(id).actions.find(a=>a.requestId===requestId);
      if(!action||action.kind!=='cover')throw Error('Renewal purchase ownership cannot be reconciled.');
      if(action.status!=='complete')demo.store.finish(id,requestId,{serial:String(p.serial),saleTxId:p.saleTxId,beneficiaryId:p.buyerId,brokerId:p.brokerId});
    }),
  }):null;
  if(coverAgents){try{await coverAgents.initialize();}catch(error){console.error('Cover agents disabled until journal recovery:',error);coverAgents=null;}}
  const chatGate=companionGate();
  const companion=coverCompanion({gate:chatGate,snapshot:async owner=>{
    if(!owner)return {mandate:null,policy:null};
    const {mandate}=coverAgents.view(owner);
    const latest=mandate?.attempts.filter(a=>a.status==='complete').at(-1)?.policy;
    const recorded=latest?policies(NETWORK).find(p=>String(p.serial)===latest.serial):null;
    const [policy]=recorded?await readPolicies(NETWORK,[recorded],identities):[];
    return {mandate,policy:policy??null};
  }});
  const evmDemo=createEvmDemo({network:NETWORK,liquidity,demo});

  const poolSnapshot=async()=>{
        const asset = settlementAsset(NETWORK);
        const rows=await currentPolicies();
        const balance=asset.kind==='hbar'?await mirrorGet(NETWORK,`/accounts/${poolId}?transactions=false`):await mirrorGet(NETWORK,`/accounts/${poolId}/tokens?token.id=${asset.tokenId}`);
        const capital=asset.kind==='hbar'?balance.balance.balance:Number(balance.tokens?.find(t=>t.token_id===asset.tokenId)?.balance??0);
        const exposure=summarizeExposure([...rows,...reservations(NETWORK)],{legacyTokens:legacyTokens(NETWORK)});
        const current=exposure.find(group=>assetKey(group)===assetKey(asset)),committed=current?.committedUnits??0;
        return {
          checkedAt:new Date().toISOString(),network: NETWORK, poolAccountId: reg.poolAccountId, policyTokenId: reg.policyTokenId,
          asset: { symbol: asset.symbol, tokenId: asset.tokenId, isUsdc: Boolean(asset.isUsdc) },
          capital: fromUnits(capital, asset), committed: fromUnits(committed, asset),
          headroom: fromUnits(capital - committed, asset),
          capitalHbar: fromUnits(capital, asset), committedHbar: fromUnits(committed, asset),
          headroomHbar: fromUnits(capital - committed, asset),
          livePolicies: current?.obligations??0,
          otherCommitments: exposure.filter(group=>assetKey(group)!==assetKey(asset)).map(group=>({asset:group.symbol,tokenId:group.tokenId,committed:fromUnits(group.committedUnits,group),obligations:group.obligations})),
          budgetToday: writeGuard.budget(),
          hashscan: HASHSCAN('account', reg.poolAccountId),
        };
  };
  const quorumChat=NETWORK==='testnet'?quorumCompanion({gate:chatGate,read:{
    network:NETWORK,poolId:reg.poolAccountId,tokenId:reg.demoTokenId,swapPool:LP_POOL,mainnet:mainnetRecord,
    owner:id=>{const a=demo.store.read().accounts[id];return a?.status==='ready'?{accountId:a.accountId,actions:a.actions}:null;},
    account:id=>demo.view(id),pool:poolSnapshot,payments:()=>paymentActivity(NETWORK),
    policy:async serial=>{const row=policies(NETWORK).find(p=>String(p.serial)===serial);return row?(await readPolicies(NETWORK,[row],identities))[0]:null;},
    swapRecord:id=>{let w;try{w=evmDemo.store.wallet(id);}catch(e){if(e.status===401)return null;throw e;}const a=w.actions.at(-1);if(!a)return null;const hash=a.result?.transactionHash;return {kind:a.kind,status:a.status,hash:/^0x[a-fA-F0-9]{64}$/.test(hash??'')?hash:null};},
  }}):null;

  const server = http.createServer(withHttpErrors(async (req, res) => {
    if (req.method === 'OPTIONS') return json(res, 204, {});
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname.replace(/\/$/, '');
      if(route==='/api/companion/chat'&&req.method==='POST'){
        if(!quorumChat)throw new HttpError(403,'The companion is available on the testnet demo.');
        return json(res,200,await quorumChat({owner:req.headers.authorization?capability(req):null,ip:clientIp(req),input:await readJsonBody(req)}));
      }
      if(route==='/api/cover-agents'||route.startsWith('/api/cover-agents/')){
        if(!coverAgents)throw new HttpError(403,'Testnet cover agents are unavailable.');
        const action=route.slice('/api/cover-agents'.length)||'/';
        if(action==='/info'&&req.method==='GET')return json(res,200,{ok:true,network:NETWORK,places:PLACES,trigger:TRIGGER,maxCycles:MAX_CYCLES,maxMonthlyPremium:10,asset:'aUSDd',execution:'deterministic'});
        if(action==='/quote'&&req.method==='POST')return json(res,200,await coverAgents.preview(await readJsonBody(req)));
        if(action==='/chat'&&req.method==='POST')return json(res,200,await companion({owner:req.headers.authorization?capability(req):null,ip:clientIp(req),input:await readJsonBody(req)}));
        const id=capability(req);
        if(action==='/'&&req.method==='GET')return json(res,200,coverAgents.view(id));
        if(action==='/account'&&req.method==='GET')return json(res,200,await demo.view(id));
        if(action==='/start'&&req.method==='POST'){
          const body=await readJsonBody(req);if(Object.keys(body).length)throw new HttpError(400,'Unsupported account options.');
          await withIssuanceLock(NETWORK,()=>demo.start(id,clientIp(req)));return json(res,200,await demo.view(id));
        }
        if(action==='/activate'&&req.method==='POST')return json(res,202,await coverAgents.activate(id,await readJsonBody(req),clientIp(req)));
        if(['/pause','/resume','/run'].includes(action)&&req.method==='POST'){
          const body=await readJsonBody(req);if(Object.keys(body).length)throw new HttpError(400,'Renewal rules cannot be overridden by a run request.');
          return json(res,200,await coverAgents[action.slice(1)](id));
        }
        throw new HttpError(404,'Unknown cover-agent action.');
      }
      if (route.startsWith('/api/demo/evm')) {
        const id=capability(req);
        if (route==='/api/demo/evm'&&req.method==='GET') return json(res,200,await evmDemo.view(id));
        if (route==='/api/demo/evm/start'&&req.method==='POST') {const body=await readJsonBody(req);if(Object.keys(body).length)throw new HttpError(400,'Unsupported starter options.');return json(res,200,await evmDemo.start(id,clientIp(req)));}
        if (route==='/api/demo/evm/quote'&&req.method==='POST') return json(res,200,await evmDemo.quote(id,await readJsonBody(req)));
        if (route==='/api/demo/evm/execute'&&req.method==='POST') return json(res,200,await evmDemo.execute(id,await readJsonBody(req)));
        if (route==='/api/demo/evm/resume'&&req.method==='POST') return json(res,200,await evmDemo.resume(id,await readJsonBody(req)));
        if (route==='/api/demo/evm/bridge'&&req.method==='POST') return json(res,200,await evmDemo.bridge(id,await readJsonBody(req),clientIp(req)));
      }
      if (route.startsWith('/api/liquidity')) {
        if (NETWORK!=='testnet') throw new HttpError(403,'Testnet liquidity only.');
        if (route==='/api/liquidity/market' && req.method==='GET') return json(res,200,await liquidity.market());
        if (route==='/api/liquidity/wallet' && req.method==='GET') return json(res,200,await liquidity.wallet(url.searchParams.get('address'),url.searchParams.get('cursor')??'0'));
        if (route==='/api/liquidity/prepare' && req.method==='POST') return json(res,200,await liquidity.prepare(await readJsonBody(req)));
      }
      if(['/api/bridged-swap/quote','/api/bridged-swap/build'].includes(route)&&req.method==='POST'){
        if(NETWORK!=='testnet')throw new HttpError(403,'Testnet only.');
        const input=await readJsonBody(req);return json(res,200,await bridgedSwaps[route.endsWith('/quote')?'prepare':'build'](input));
      }
      if(route==='/api/demo/bridge/status'&&req.method==='GET'){
        const id=capability(req),action=demo.store.account(id).actions.find(a=>a.requestId===url.searchParams.get('requestId'));
        if(!action)throw new HttpError(404,'Bridge request not found.');
        return json(res,200,await bridgeStatus(action));
      }
      if(route==='/api/bridge'&&req.method==='GET'){
        try{return json(res,200,{ok:true,...bridgeConfig()});}catch{return json(res,503,{ok:false,message:'Bridge destination is being verified.'});}
      }
      if(route==='/api/demo/bridge'&&req.method==='POST'){
        const id=capability(req),input=await readJsonBody(req);
        const result=await withIssuanceLock(NETWORK,()=>demo.bridge(id,input));return json(res,200,{ok:true,...result});
      }
      if(route==='/api/testnet-swap'&&req.method==='POST'){
        if(NETWORK!=='testnet')throw new HttpError(403,'Testnet swap interface only.');
        return json(res,200,await prepareTestnetSwap(await readJsonBody(req)));
      }
      if(route==='/api/demo'&&req.method==='GET')return json(res,200,await demo.view(capability(req)));
      if(route==='/api/demo/start'&&req.method==='POST'){
        const id=capability(req);await withIssuanceLock(NETWORK,()=>demo.start(id,clientIp(req)));return json(res,200,await demo.view(id));
      }
      if(route==='/api/demo/deposit'&&req.method==='POST'){
        const id=capability(req),input=await readJsonBody(req);
        if(Object.keys(input).some(k=>!['requestId','amount'].includes(k)))throw new HttpError(400,'Unsupported deposit field.');
        const result=await withIssuanceLock(NETWORK,()=>demo.fund(id,input));return json(res,200,{ok:true,...result});
      }
      if (route === '/api/places'  && req.method === 'GET') {
        try { return json(res,200,{places:await searchPlaces(url.searchParams.get('q')),source:'Photon / OpenStreetMap'}); }
        catch(error) { return json(res,error.status??503,{ok:false,reason:'search_unavailable',message:error.status===400?error.message:'Worldwide search is unavailable. Try again or enter coordinates.'}); }
      }

      if (route === '/api/guardrails' && req.method === 'GET') return json(res,200,{network:NETWORK,execution:'deterministic',x402:NETWORK==='testnet'?BLOCKY_INFO:null,publicWrites:NETWORK==='testnet',limits:LIMITS,budget:writeGuard.budget(),checkedAt:new Date().toISOString(),custody:'Shared demo host; separate keys are not independent operators.',authorization:'Agent AND 2 of 3 oracle keys',signing:'Fixed scheduled transfer; oracle verifies recorded terms and transfer bytes.'});

      if (route === '/api/activity' && req.method === 'GET') return json(res, 200, { network: NETWORK, payments: paymentActivity(NETWORK), checkedAt: new Date().toISOString() });

      if (route === '/api/health') {
        return json(res, 200, { ok: true, network: NETWORK, writesAllowed: NETWORK === 'testnet', x402:NETWORK==='testnet'?BLOCKY_INFO:null });
      }

      if (route === '/api/pool') return json(res,200,await poolSnapshot());

      // Free: no ledger write, no key, no limit.
      if (route === '/api/quote') {
        const lat = num(url.searchParams.get('lat')), lon = num(url.searchParams.get('lon'));
        if (lat == null || lon == null) return json(res, 400, { ok: false, message: 'lat and lon are required' });
        const q = await quotePolicy({ lat, lon, budgetUsd: num(url.searchParams.get('budget'), 4), days: num(url.searchParams.get('days'), 30), network: NETWORK });
        return json(res, q.ok ? 200 : 200, q); // a refusal is a valid answer, not an error
      }

      // What a payout would convert into elsewhere. A quote, and it says so.
      if (route === '/api/settle-quote' && req.method === 'GET') {
        const usd = Number(url.searchParams.get('usd'));
        if (usd == null) return json(res, 400, { ok: false, message: 'usd is required' });
        try {
          const q = await quoteCrossAsset({
            payoutUsd: usd,
            chainId: Number(url.searchParams.get('chainId') ?? 8453),
            tokenOut: url.searchParams.get('tokenOut') ?? undefined,
          });
          return json(res, 200, q);
        } catch (err) {
          return json(res, 200, {
            ok: false, reason: err.reason ?? 'quote_unavailable', message: err.message,
            chains: Object.entries(STABLES).map(([id, s]) => ({ chainId: Number(id), chain: s.chain })),
          });
        }
      }

      if (route.startsWith('/api/requests/') && req.method === 'GET') {
        const id=route.split('/').pop();
        if(!/^[a-zA-Z0-9-]{16,80}$/.test(id))return json(res,400,{ok:false,reason:'invalid_input'});
        const saved=request(NETWORK,id);
        if(!saved)return json(res,404,{ok:false,reason:'not_found',message:'No request was recorded. It is safe to request a new quote.'});
        if(saved.quote && saved.scheduleId)return json(res,200,{ok:true,status:'complete',policy:publicPolicy(saved)});
        return json(res,200,{ok:true,status:isIssuing(NETWORK,id)?'creating':'needs_review',place:saved.place,stage:saved.stage,message:saved.message??(isIssuing(NETWORK,id)?'Your request is saved. Waiting for ledger confirmation.':'This reserved request needs operator review before it can be retried.'),recordedAt:saved.recordedAt});
      }

      if (route === '/api/policies' && req.method === 'GET') {
        return json(res, 200, { network: NETWORK, policies: (await currentPolicies()).map(publicPolicy) });
      }

      const checkRoute=/^\/api\/policies\/(\d+)\/check$/.exec(route);
      if(checkRoute&&req.method==='GET')return json(res,200,{ok:true,check:latestPolicyCheck(demo.store,checkRoute[1])});
      if(checkRoute&&req.method==='POST'){
        const sessionId=capability(req),input=await readJsonBody(req);
        const p=(await currentPolicies()).find(p=>String(p.serial)===checkRoute[1]);
        if(!p)throw new HttpError(404,'Policy not found.');
        const result=await withIssuanceLock(NETWORK,()=>checkPolicy({demo,network:NETWORK,reg,agent,sessionId,policy:p,input}));
        return json(res,200,result);
      }

      if (route.startsWith('/api/policies/') && req.method === 'GET') {
        const serial = route.split('/').pop();
        const p = (await currentPolicies()).find((x) => String(x.serial) === serial);
        if (!p) return json(res, 404, { ok: false, reason:'not_found', message: `No policy ${serial} on ${NETWORK}.` });
        return json(res, 200, { ...publicPolicy(p), hashscan: { schedule: HASHSCAN('schedule', p.scheduleId), sale: HASHSCAN('transaction', p.saleTxId) } });
      }

      if (route === '/api/policies' && req.method === 'POST') {
        if (NETWORK !== 'testnet') return json(res,403,{ok:false,reason:'mainnet_writes_disabled',message:'The public demo creates policies on testnet only.'});
        const result = await purchaseDemoPolicy({sessionId:capability(req),ip:clientIp(req),input:await readJsonBody(req)});
        if(!result.ok)return json(res,200,result);
        return json(res, 201, {
          ...result, policy:publicPolicy(result.policy),
          hashscan: {
            schedule: HASHSCAN('schedule', result.policy.scheduleId),
            sale: HASHSCAN('transaction', result.policy.saleTxId),
            policy: HASHSCAN('token', reg.policyTokenId),
          },
        });
      }

      return json(res, 404, { ok: false, message: `No route ${route}` });
  },{respond:json}));

  server.requestTimeout=30_000;
  server.headersTimeout=10_000;
  server.listen(PORT, process.env.HOST ?? '127.0.0.1', () => {
    console.log(`underwriting agent on :${PORT}  network=${NETWORK}`);
    console.log(`  writes ${NETWORK !== 'testnet' ? 'DISABLED (mainnet)' : 'enabled'}` +
      `  · ${LIMITS.perIpPerHour}/ip/hour · ${LIMITS.policiesPerDay}/day · $${LIMITS.usdPerDay.toLocaleString()}/day`);
  });
  coverAgents?.start();
  let draining=false;
  const shutdown=async()=>{
    if(draining)return;draining=true;
    // Stop admission, finish accepted requests, then drain journaled EVM jobs.
    await new Promise(resolve=>server.close(resolve));
    await coverAgents?.close();
    await evmDemo.close();liquidity.close();c.close();process.exit(0);
  };
  process.once('SIGTERM',()=>void shutdown());
  process.once('SIGINT',()=>void shutdown());
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
