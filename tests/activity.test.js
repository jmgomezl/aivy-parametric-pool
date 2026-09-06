import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordPayment, paymentActivity } from '../src/activity.js';

test('payment receipts are network-scoped, public-only and deduplicated', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aivy-receipts-'));
  try {
    const receipt = { network:'testnet', transaction:'0.0.123@1788600000.123456789', amount:'1000', asset:'0.0.456', resource:'https://usgs.aivylabs.xyz/attest?secret=not-public', privateKey:'not-public', header:'not-public' };
    assert.deepEqual(paymentActivity('testnet',dir), []);
    recordPayment(receipt,dir); recordPayment(receipt,dir);
    const rows=paymentActivity('testnet',dir);
    assert.equal(rows.length,1); assert.equal(rows[0].resource,'https://usgs.aivylabs.xyz/attest');
    assert.equal(JSON.stringify(rows).includes('not-public'),false);
    assert.deepEqual(paymentActivity('mainnet',dir),[]);
    assert.throws(()=>recordPayment({...receipt,network:'other'},dir));
    assert.throws(()=>recordPayment({...receipt,transaction:'unconfirmed'},dir));
    fs.appendFileSync(path.join(dir,'activity-testnet.jsonl'),'partial-write');
    assert.equal(paymentActivity('testnet',dir).length,1);
  } finally { fs.rmSync(dir,{recursive:true}); }
});
