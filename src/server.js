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
import { searchPlaces } from './places.js';
import { paymentActivity } from './activity.js';
import { AccountId, TokenId, TransferTransaction } from '@hiero-ledger/sdk';
import { client, operator, assertOperatorKey, NETWORK, HASHSCAN } from './config.js';
import { load } from './registry.js';
import { createFundedAccount } from './accounts.js';
import { quotePolicy, issuePolicy, isIssuing } from './policy/issue.js';
import { readPolicies, mirrorGet } from './ledger.js';
import { policies, reservations, settle, request } from './book.js';
import { checkWrite, recordWrite, budgetToday, LIMITS } from './guards.js';
import { associate } from './pool/shares.js';
import { settlementAsset, fromUnits } from './asset.js';
import { quoteCrossAsset, STABLES } from './settlement/crossAsset.js';

const PORT = Number(process.env.PORT ?? 8791);
const json = (res, status, body) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(body, null, 2));
};

const ipOf = (req) =>
  (process.env.TRUST_PROXY === '1' ? req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket.remoteAddress : req.socket.remoteAddress) ?? 'unknown';

const num = (v, fallback) => (v == null || v === '' || Number.isNaN(Number(v)) ? fallback : Number(v));

const body = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', (c) => { data += c; if (data.length > 8192) reject(new Error('body too large')); });
  req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('invalid JSON')); } });
});

async function main() {
  await assertOperatorKey();
  const c = client();
  const agent = operator();
  const reg = load(NETWORK);
  for (const key of ['poolAccountId', 'shareTokenId', 'policyTokenId', 'termsTopicId']) {
    if (!reg[key]) throw new Error(`${NETWORK} is not provisioned (${key} missing). Run: npm run provision`);
  }
  const poolId = AccountId.fromString(reg.poolAccountId);
  const identities = {agentPublicKey:agent.key.publicKey.toStringRaw(),oraclePublicKeys:reg.oraclePublicKeys,oracleSources:reg.oracleSources??['usgs','emsc','sgc']};
  const currentPolicies = () => readPolicies(NETWORK,policies(NETWORK),identities);
  const publicPolicy = ({requestId, quote, ...p}) => p;
  const deps = {
    client: c, agent, network: NETWORK, poolId,
    policyTokenId: reg.policyTokenId, termsTopicId: reg.termsTopicId,
    reconcile: async () => {for(const p of await currentPolicies())if(p.state==='paid')settle(NETWORK,p.serial,p.executedAt);},
  };

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return json(res, 204, {});
    const url = new URL(req.url, `http://${req.headers.host}`);
    const route = url.pathname.replace(/\/$/, '');

    try {
      if (route === '/api/places' && req.method === 'GET') {
        try { return json(res,200,{places:await searchPlaces(url.searchParams.get('q')),source:'Photon / OpenStreetMap'}); }
        catch(error) { return json(res,error.status??503,{ok:false,reason:'search_unavailable',message:error.status===400?error.message:'Worldwide search is unavailable. Try again or enter coordinates.'}); }
      }

      if (route === '/api/activity' && req.method === 'GET') return json(res, 200, { network: NETWORK, payments: paymentActivity(NETWORK), checkedAt: new Date().toISOString() });

      if (route === '/api/health') {
        return json(res, 200, { ok: true, network: NETWORK, writesAllowed: NETWORK === 'testnet' });
      }

      if (route === '/api/pool') {
        const asset = settlementAsset(NETWORK);
        const rows=await currentPolicies();
        const balance=asset.kind==='hbar'?await mirrorGet(NETWORK,`/accounts/${poolId}?transactions=false`):await mirrorGet(NETWORK,`/accounts/${poolId}/tokens?token.id=${asset.tokenId}`);
        const capital=asset.kind==='hbar'?balance.balance.balance:Number(balance.tokens?.find(t=>t.token_id===asset.tokenId)?.balance??0);
        const committed=[...rows,...reservations(NETWORK)].filter(p=>p.state!=='paid'&&!p.settled&&Date.parse(p.lapsesAt)>Date.now()).reduce((sum,p)=>sum+(p.payoutUnits??Math.round(p.payoutHbar*1e8)),0);
        return json(res, 200, {
          network: NETWORK, poolAccountId: reg.poolAccountId, policyTokenId: reg.policyTokenId,
          asset: { symbol: asset.symbol, tokenId: asset.tokenId, isUsdc: Boolean(asset.isUsdc) },
          capital: fromUnits(capital, asset), committed: fromUnits(committed, asset),
          headroom: fromUnits(capital - committed, asset),
          capitalHbar: fromUnits(capital, asset), committedHbar: fromUnits(committed, asset),
          headroomHbar: fromUnits(capital - committed, asset),
          livePolicies: rows.filter(p=>p.state==='active'||p.state==='confirming').length,
          budgetToday: budgetToday(),
          hashscan: HASHSCAN('account', reg.poolAccountId),
        });
      }

      // Free: no ledger write, no key, no limit.
      if (route === '/api/quote') {
        const lat = num(url.searchParams.get('lat')), lon = num(url.searchParams.get('lon'));
        if (lat == null || lon == null) return json(res, 400, { ok: false, message: 'lat and lon are required' });
        const q = await quotePolicy({ lat, lon, budgetUsd: num(url.searchParams.get('budget'), 4), days: num(url.searchParams.get('days'), 30), network: NETWORK });
        return json(res, q.ok ? 200 : 200, q); // a refusal is a valid answer, not an error
      }

      // What a payout would convert into elsewhere. A quote, and it says so.
      if (route === '/api/settle-quote') {
        const usd = num(url.searchParams.get('usd'), null);
        if (usd == null) return json(res, 400, { ok: false, message: 'usd is required' });
        try {
          const q = await quoteCrossAsset({
            payoutUsd: usd,
            chainId: num(url.searchParams.get('chainId'), 8453),
            tokenOut: url.searchParams.get('tokenOut') ?? undefined,
          });
          return json(res, 200, q);
        } catch (err) {
          return json(res, 200, {
            ok: false, reason: 'quote_unavailable', message: err.message,
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

      if (route.startsWith('/api/policies/') && req.method === 'GET') {
        const serial = route.split('/').pop();
        const p = (await currentPolicies()).find((x) => String(x.serial) === serial);
        if (!p) return json(res, 404, { ok: false, reason:'not_found', message: `No policy ${serial} on ${NETWORK}.` });
        return json(res, 200, { ...publicPolicy(p), hashscan: { schedule: HASHSCAN('schedule', p.scheduleId), sale: HASHSCAN('transaction', p.saleTxId) } });
      }

      if (route === '/api/policies' && req.method === 'POST') {
        const input = await body(req);
        const lat = num(input.lat), lon = num(input.lon);
        if (lat == null || lon == null) return json(res, 400, { ok: false, message: 'lat and lon are required' });

        if (NETWORK !== 'testnet') return json(res,403,{ok:false,reason:'mainnet_writes_disabled',message:'The public demo creates policies on testnet only.'});
        if (input.requestId && !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId)) return json(res,400,{ok:false,reason:'invalid_input',message:'Invalid request identifier.'});
        const result = await issuePolicy({...deps,
          beforeWrite:quote=>checkWrite({network:NETWORK,ip:ipOf(req),usd:quote.payout}),
          afterWrite:quote=>recordWrite({ip:ipOf(req),usd:quote.payout}),
          createBuyer:async quote=>{
            const asset=settlementAsset(NETWORK);
            const buyer=await createFundedAccount(c,NETWORK,1,'demo beneficiary');
            await associate(c,buyer.id,buyer.key,TokenId.fromString(reg.policyTokenId));
            if(asset.kind==='token'){
              await associate(c,buyer.id,buyer.key,TokenId.fromString(asset.tokenId));
              const fund=new TransferTransaction().addTokenTransfer(TokenId.fromString(asset.tokenId),agent.id,-quote.settled.premiumUnits).addTokenTransfer(TokenId.fromString(asset.tokenId),buyer.id,quote.settled.premiumUnits);
              await(await fund.execute(c)).getReceipt(c);
            }
            return buyer;
          }
        },{lat,lon,place:typeof input.place==='string'?input.place.slice(0,100):null,budgetUsd:num(input.budgetUsd,4),days:num(input.days,30),requestId:input.requestId});
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
    } catch (err) {
      return json(res, 500, { ok: false, reason:err.reason??'service_unavailable', message: err.message ?? String(err) });
    }
  });

  server.listen(PORT, process.env.HOST ?? '127.0.0.1', () => {
    console.log(`underwriting agent on :${PORT}  network=${NETWORK}`);
    console.log(`  writes ${NETWORK === 'mainnet' && !LIMITS.allowMainnetWrites ? 'DISABLED (mainnet)' : 'enabled'}` +
      `  · ${LIMITS.perIpPerHour}/ip/hour · ${LIMITS.policiesPerDay}/day · $${LIMITS.usdPerDay.toLocaleString()}/day`);
  });
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
