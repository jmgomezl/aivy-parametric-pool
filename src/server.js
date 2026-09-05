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
import { AccountId, TokenId, TransferTransaction } from '@hiero-ledger/sdk';
import { client, operator, assertOperatorKey, NETWORK, HASHSCAN } from './config.js';
import { load } from './registry.js';
import { createFundedAccount } from './accounts.js';
import { quotePolicy, issuePolicy } from './policy/issue.js';
import { poolCapital } from './pool/solvency.js';
import { committedTinybar, policies, zoneExposureTinybar } from './book.js';
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
  (req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown').trim();

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
  const deps = {
    client: c, agent, network: NETWORK, poolId,
    policyTokenId: reg.policyTokenId, termsTopicId: reg.termsTopicId,
  };

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return json(res, 204, {});
    const url = new URL(req.url, `http://${req.headers.host}`);
    const route = url.pathname.replace(/\/$/, '');

    try {
      if (route === '/api/health') {
        return json(res, 200, { ok: true, network: NETWORK, writesAllowed: NETWORK !== 'mainnet' || LIMITS.allowMainnetWrites });
      }

      if (route === '/api/pool') {
        const asset = settlementAsset(NETWORK);
        const capital = await poolCapital(c, poolId, NETWORK);
        const committed = committedTinybar(NETWORK);
        return json(res, 200, {
          network: NETWORK, poolAccountId: reg.poolAccountId,
          asset: { symbol: asset.symbol, tokenId: asset.tokenId, isUsdc: Boolean(asset.isUsdc) },
          capital: fromUnits(capital, asset), committed: fromUnits(committed, asset),
          headroom: fromUnits(capital - committed, asset),
          capitalHbar: fromUnits(capital, asset), committedHbar: fromUnits(committed, asset),
          headroomHbar: fromUnits(capital - committed, asset),
          livePolicies: policies(NETWORK).filter((p) => !p.settled).length,
          budgetToday: budgetToday(),
          hashscan: HASHSCAN('account', reg.poolAccountId),
        });
      }

      // Free: no ledger write, no key, no limit.
      if (route === '/api/quote') {
        const lat = num(url.searchParams.get('lat')), lon = num(url.searchParams.get('lon'));
        if (lat == null || lon == null) return json(res, 400, { ok: false, message: 'lat and lon are required' });
        const q = await quotePolicy({ lat, lon, budgetUsd: num(url.searchParams.get('budget'), 4), days: num(url.searchParams.get('days'), 30) });
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

      if (route === '/api/policies' && req.method === 'GET') {
        return json(res, 200, { network: NETWORK, policies: policies(NETWORK) });
      }

      if (route.startsWith('/api/policies/') && req.method === 'GET') {
        const serial = route.split('/').pop();
        const p = policies(NETWORK).find((x) => String(x.serial) === serial);
        if (!p) return json(res, 404, { ok: false, message: `No policy ${serial} on ${NETWORK}.` });
        return json(res, 200, { ...p, hashscan: { schedule: HASHSCAN('schedule', p.scheduleId), sale: HASHSCAN('transaction', p.saleTxId) } });
      }

      if (route === '/api/policies' && req.method === 'POST') {
        const input = await body(req);
        const lat = num(input.lat), lon = num(input.lon);
        if (lat == null || lon == null) return json(res, 400, { ok: false, message: 'lat and lon are required' });

        // Price first: a refusal costs nothing and must not consume a rate slot.
        const quote = await quotePolicy({ lat, lon, budgetUsd: num(input.budgetUsd, 4), days: num(input.days, 30) });
        if (!quote.ok) return json(res, 200, quote);

        const denied = checkWrite({ network: NETWORK, ip: ipOf(req), usd: quote.payout });
        if (denied) return json(res, denied.status, { ok: false, ...denied });

        // The buyer needs the policy NFT and, when we settle in a token, the
        // settlement asset too — and enough of it to pay the premium.
        const asset = settlementAsset(NETWORK);
        const buyer = await createFundedAccount(c, NETWORK, 1, 'buyer (api)');
        await associate(c, buyer.id, buyer.key, TokenId.fromString(reg.policyTokenId));
        if (asset.kind === 'token') {
          await associate(c, buyer.id, buyer.key, TokenId.fromString(asset.tokenId));
          const fund = new TransferTransaction()
            .addTokenTransfer(TokenId.fromString(asset.tokenId), agent.id, -quote.settled.premiumUnits)
            .addTokenTransfer(TokenId.fromString(asset.tokenId), buyer.id, quote.settled.premiumUnits);
          await (await fund.execute(c)).getReceipt(c);
        }
        const broker = input.brokerId ? AccountId.fromString(input.brokerId) : null;

        const result = await issuePolicy(deps, {
          lat, lon, place: input.place ?? null, budgetUsd: num(input.budgetUsd, 4),
          days: num(input.days, 30), brokerId: broker, buyer,
        });
        if (!result.ok) return json(res, 200, result);

        recordWrite({ ip: ipOf(req), usd: quote.payout });
        return json(res, 201, {
          ...result,
          hashscan: {
            schedule: HASHSCAN('schedule', result.policy.scheduleId),
            sale: HASHSCAN('transaction', result.policy.saleTxId),
            policy: HASHSCAN('token', reg.policyTokenId),
          },
        });
      }

      return json(res, 404, { ok: false, message: `No route ${route}` });
    } catch (err) {
      return json(res, 500, { ok: false, message: err.message ?? String(err) });
    }
  });

  server.listen(PORT, () => {
    console.log(`underwriting agent on :${PORT}  network=${NETWORK}`);
    console.log(`  writes ${NETWORK === 'mainnet' && !LIMITS.allowMainnetWrites ? 'DISABLED (mainnet)' : 'enabled'}` +
      `  · ${LIMITS.perIpPerHour}/ip/hour · ${LIMITS.policiesPerDay}/day · $${LIMITS.usdPerDay.toLocaleString()}/day`);
  });
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
