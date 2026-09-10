import test from 'node:test';
import assert from 'node:assert/strict';
import {mirrorGet, mirrorUnits, parseMirrorJson, readTokenBalance, readPolicies} from '../src/ledger.js';

test('Mirror wire integers survive parsing exactly, including negative transfer legs and arrays', async () => {
  const wire = '{"balance":3389692518476689184,"transfers":[-3389692518476689184,9007199254740991],"memo":"balance:3389692518476689184","timestamp":"1700000000.123456789","fraction":1.5}';
  const data = await mirrorGet('testnet', '/accounts/0.0.2', async () => new Response(wire));
  assert.equal(BigInt(data.balance), 3389692518476689184n);
  assert.equal(BigInt(data.transfers[0]), -3389692518476689184n);
  assert.equal(data.transfers[1], Number.MAX_SAFE_INTEGER);
  assert.equal(data.memo, 'balance:3389692518476689184');
  assert.equal(data.timestamp, '1700000000.123456789');
  assert.equal(data.fraction, 1.5);
  assert.throws(() => parseMirrorJson('{"balance":1e30}'), /Unsupported ledger number/);
});

test('demo balance conversion refuses rounded, missing, negative and malformed units', () => {
  for (const value of [null, undefined, '', true, -1, '1.5', 1.5, '9007199254740992', 9007199254740992, Infinity]) {
    assert.throws(() => mirrorUnits(value), /balance/);
  }
  assert.equal(mirrorUnits(0), 0);
  assert.equal(mirrorUnits('9007199254740991'), Number.MAX_SAFE_INTEGER);
});

test('known balances use token filters even when more than 25 unrelated holdings precede them', async () => {
  const calls = [], tokens = Array.from({length: 30}, (_, i) => ({token_id:`0.0.${i+1}`, balance:42}));
  tokens.push({token_id:'0.0.100',balance:990000000}, {token_id:'0.0.101',balance:2600000000});
  const fetcher = async (url, options) => {
    const u = new URL(url); calls.push(u);
    assert.equal(u.hostname, 'testnet.mirrornode.hedera.com');
    assert.equal(u.pathname, '/api/v1/accounts/0.0.5/tokens');
    assert.ok(options.signal);
    const filtered = u.searchParams.has('token.id') ? tokens.filter(t => t.token_id === u.searchParams.get('token.id')) : tokens;
    return Response.json({tokens:filtered.slice(0,25), links:{next:filtered.length>25?'/api/v1/accounts/0.0.5/tokens?token.id=gt:0.0.25':null}});
  };
  assert.deepEqual(await Promise.all(['0.0.100','0.0.101'].map(id => readTokenBalance('testnet','0.0.5',id,fetcher))), [990000000,2600000000]);
  assert.equal(calls.length, 2);
});

test('an unindexed association or incomplete response is never presented as a zero balance', async () => {
  for (const page of [{}, {tokens:[]}, {tokens:[{token_id:'0.0.99',balance:0}]},
    {tokens:[{token_id:'0.0.100'}]}, {tokens:[{token_id:'0.0.100',balance:0}],links:{next:'/api/v1/anything'}}]) {
    await assert.rejects(readTokenBalance('testnet','0.0.5','0.0.100',async()=>Response.json(page)), /balance/i);
  }
  assert.equal(await readTokenBalance('testnet','0.0.5','0.0.100',async()=>Response.json({tokens:[{token_id:'0.0.100',balance:0}],links:{next:null}})),0);
  let calls=0;
  await assert.rejects(readTokenBalance('testnet','0.0.5','https://elsewhere',async()=>{calls++;}), /entity/);
  await assert.rejects(mirrorGet('unknown','/accounts/0.0.5',async()=>{calls++;}), /network/);
  assert.equal(calls,0);
});

test('404 indexing gaps and 429/503 remain unverified instead of inventing a policy state', async () => {
  for (const status of [404,429,503]) {
    const fetcher = async () => new Response('', {status});
    await assert.rejects(mirrorGet('testnet','/schedules/0.0.999993',fetcher), error => error.mirrorStatus===status && (status!==404 || /not yet indexed/.test(error.message)));
    const [policy]=await readPolicies('testnet',[{scheduleId:'0.0.999993'}],{}, {fetcher,cacheMs:0});
    assert.equal(policy.state,'unavailable');
    assert.equal(policy.ledger.available,false);
    assert.equal(policy.ledger.executedAt,null);
  }
});
