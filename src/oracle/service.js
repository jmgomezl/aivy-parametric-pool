// One oracle, as a paid service.
//
// This is the shape the whole design assumes: an attestation is a service some
// independent party runs, and asking for one costs money. Until now the oracles
// were functions in the same process as the thing that trusted them, which is
// not an oracle at all — it is a comment.
//
// Run one per catalogue:
//   SOURCE=usgs   PORT=8801 node src/oracle/service.js
//   SOURCE=emsc   PORT=8802 node src/oracle/service.js
//   SOURCE=geofon PORT=8803 node src/oracle/service.js
//
// GET  /                 what this oracle is and what it charges — free
// POST /attest           an attestation against this catalogue — paid, x402
// POST /attest-and-sign  the same, and signs the payout if it fired — paid
import http from 'node:http';
import { ScheduleId, ScheduleSignTransaction, Client, AccountId } from '@hiero-ledger/sdk';
import { parseKey } from '../config.js';
import { SOURCES } from './sources.js';
import { attest } from './attest.js';
import { charge, requirements } from '../x402/gate.js';
import { settlementAsset } from '../asset.js';

const SOURCE = process.env.SOURCE ?? 'usgs';
const PORT = Number(process.env.PORT ?? 8801);
const NETWORK = process.env.HEDERA_NETWORK ?? 'testnet';
const PRICE = Number(process.env.ATTESTATION_PRICE ?? 1000); // 0.001 USDC, six decimals
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;

const source = SOURCES[SOURCE];
if (!source) throw new Error(`Unknown SOURCE "${SOURCE}". Known: ${Object.keys(SOURCES).join(', ')}`);

// This oracle's own identity. It is paid here, and it signs with this key —
// which is exactly why it must not be the same account as the pool agent.
const ORACLE_ID = process.env.ORACLE_ACCOUNT_ID;
const ORACLE_KEY = process.env.ORACLE_PRIVATE_KEY;
const FEE_PAYER_ID = process.env.X402_FEE_PAYER_ID ?? ORACLE_ID;
const FEE_PAYER_KEY = process.env.X402_FEE_PAYER_KEY ?? ORACLE_KEY;

const asset = settlementAsset(NETWORK);
const caip2 = `hedera:${NETWORK}`;

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-payment' });
  res.end(JSON.stringify(body, null, 2));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let d = '';
  req.on('data', (c) => { d += c; if (d.length > 8192) reject(new Error('body too large')); });
  req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { reject(new Error('invalid JSON')); } });
});

const termsFor = (path) => requirements({
  amount: PRICE,
  payTo: ORACLE_ID,
  asset: asset.tokenId ?? 'HBAR',
  resource: `${PUBLIC_URL}${path}`,
  description: `One seismic attestation from ${source.name}, ${source.operator}.`,
  network: caip2,
  feePayer: FEE_PAYER_ID,
});

// A k-of-n quorum means the last oracles to answer are, by design, too late:
// the payout executed the moment the k-th signature landed. That is the system
// working, not a failure, and it must not read as an error — the oracle still
// did its job, still got paid, and still put its verdict on record.
const ALREADY_SETTLED = /SCHEDULE_ALREADY_EXECUTED|INVALID_SCHEDULE_ID|SCHEDULE_ALREADY_DELETED/i;

async function signSchedule(scheduleId) {
  const client = (NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet())
    .setOperator(AccountId.fromString(ORACLE_ID), parseKey(ORACLE_KEY));
  try {
    const tx = await (await new ScheduleSignTransaction()
      .setScheduleId(ScheduleId.fromString(scheduleId)).freezeWith(client))
      .sign(parseKey(ORACLE_KEY));
    const res = await tx.execute(client);
    await res.getReceipt(client);
    return { signed: true, transactionId: res.transactionId.toString() };
  } catch (err) {
    const detail = String(err?.message ?? err);
    if (ALREADY_SETTLED.test(detail)) {
      return { signed: false, alreadySettled: true, reason: 'The quorum was reached before this signature arrived; the payout has already executed.' };
    }
    return { signed: false, error: detail.slice(0, 200) };
  } finally { client.close(); }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const path = new URL(req.url, `http://${req.headers.host}`).pathname.replace(/\/$/, '') || '/';

  try {
    if (path === '/') {
      return json(res, 200, {
        oracle: source.name, operator: source.operator, account: ORACLE_ID,
        network: caip2,
        price: { amount: String(PRICE), asset: asset.tokenId ?? 'HBAR', symbol: asset.symbol },
        endpoints: { attest: 'POST /attest', attestAndSign: 'POST /attest-and-sign' },
        note: 'Attestations are paid with x402. Ask without payment to receive the terms.',
      });
    }

    if ((path === '/attest' || path === '/attest-and-sign') && req.method === 'POST') {
      const body = await readBody(req);
      const spec = body.spec ?? body;
      for (const k of ['lat', 'lon', 'radiusKm', 'minMagnitude', 'windowStart']) {
        if (spec[k] == null) return json(res, 400, { error: `spec.${k} is required` });
      }

      const gate = await charge({
        header: req.headers['x-payment'],
        terms: termsFor(path),
        feePayerId: FEE_PAYER_ID, feePayerKey: FEE_PAYER_KEY, network: NETWORK,
      });
      if (!gate.paid) return json(res, gate.status, gate.body);

      const attestation = await attest(SOURCE, spec);

      // An oracle signs only what it just verified for itself.
      let signature = null;
      if (path === '/attest-and-sign' && attestation.triggered && body.scheduleId) {
        signature = await signSchedule(body.scheduleId);
      } else if (path === '/attest-and-sign' && !attestation.triggered) {
        signature = { signed: false, reason: attestation.verdict };
      }

      return json(res, 200, { ...attestation, signature, payment: gate.settlement });
    }

    return json(res, 404, { error: `No route ${path}` });
  } catch (err) {
    return json(res, 500, { error: String(err.message ?? err) });
  }
});

server.listen(PORT, () => {
  console.log(`${source.name} oracle on :${PORT}  (${source.operator})`);
  console.log(`  paid to ${ORACLE_ID} · ${PRICE} ${asset.symbol} per attestation · ${caip2}`);
});
