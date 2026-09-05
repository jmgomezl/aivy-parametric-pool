// The pricing model is implemented twice on purpose: once here, against the live
// USGS API, and once in ui/src/lib/hazard.ts, against a frozen catalogue so the
// atlas can price any point on Earth instantly without a network call.
//
// Two implementations can drift. These tests pin the arithmetic and assert the
// shared constants still match the browser copy, so a change to one that is not
// mirrored in the other fails here rather than on camera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MODEL, MAX_DAYS, probability, quote, coverForBudget } from '../src/pricing/hazard.js';
import { underwrite, minimumPremium, ISSUE_COST } from '../src/pricing/underwrite.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('probability follows the Poisson survival function', () => {
  close(probability(0, 30), 0);
  close(probability(0.0235, 30), 1 - Math.exp(-0.0235 * (30 / 365.25)));
  assert.ok(probability(0.2, 30) > probability(0.02, 30));
});

test('premium is expected loss divided by the target loss ratio', () => {
  const q = quote({ lambda: 0.0303, payout: 800 });
  close(q.expectedLoss, 800 * q.probability);
  close(q.premium, q.expectedLoss / 0.5);
});

test('budget mode is the exact inverse of payout mode', () => {
  const lambda = 0.0303;
  const { cover } = coverForBudget({ lambda, budget: 4 });
  const back = quote({ lambda, payout: cover });
  close(back.premium, 4, 1e-9);
});

test('uncertainty loading is one over root n, and extinguishes as the record grows', () => {
  const loaded = (n) => 1 + MODEL.z / Math.sqrt(n);
  close(loaded(4), 1.5);
  close(loaded(100), 1.1);
  assert.ok(loaded(4) > loaded(12) && loaded(12) > loaded(103));
});

test('the viability floor is derived from the issue cost, not invented', () => {
  close(minimumPremium(0.5, 0.10), 0.20);
  close(minimumPremium(0.6, 0.10), 0.25);
  close(minimumPremium(), ISSUE_COST / (1 - MODEL.lossRatio));
});

test('an unrecorded place is declined rather than priced at almost nothing', () => {
  const r = underwrite({ hazard: { count: 0, lambdaPriced: 0, source: 'x' }, payout: 800 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_record');
});

test('cover too small to be worth writing is declined', () => {
  const hazard = { count: 4, lambda: 0.0078, lambdaPriced: 0.0117, source: 'x', z: 1 };
  const r = underwrite({ hazard, payout: 50 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'below_viability');
  assert.ok(r.premium < r.floor);
});

test('cover cannot outlive the scheduled payout that backs it', () => {
  const hazard = { count: 12, lambda: 0.0235, lambdaPriced: 0.0303, source: 'x', z: 1 };
  assert.equal(underwrite({ hazard, budget: 4, days: MAX_DAYS + 1 }).reason, 'window_too_long');
  assert.equal(underwrite({ hazard, budget: 4, days: MAX_DAYS }).ok, true);
});

test('a quote carries every input needed to recompute it', () => {
  const hazard = {
    count: 12, years: 56.7, lambda: 0.0235, lambdaPriced: 0.0303, relativeError: 1 / Math.sqrt(12),
    z: 1, triggerRadiusKm: 100, referenceRadiusKm: 300, since: '1970-01-01', source: 'https://…',
  };
  const r = underwrite({ hazard, budget: 4 });
  for (const key of ['count', 'years', 'lambda', 'lambdaPriced', 'relativeError', 'z',
                     'triggerRadiusKm', 'referenceRadiusKm', 'since', 'source']) {
    assert.ok(r.hazard[key] !== undefined, `quote is missing hazard.${key}`);
  }
});

test('the browser copy of the model shares this one\'s constants', () => {
  const ui = fs.readFileSync(new URL('../ui/src/lib/hazard.ts', import.meta.url), 'utf8');
  const read = (key) => {
    const m = new RegExp(`${key}:\\s*([0-9.]+|'[^']*')`).exec(ui);
    assert.ok(m, `ui/src/lib/hazard.ts does not define ${key}`);
    return m[1].startsWith("'") ? m[1].slice(1, -1) : Number(m[1]);
  };
  for (const key of ['referenceRadiusKm', 'triggerRadiusKm', 'days', 'lossRatio', 'minMagnitude', 'z']) {
    assert.equal(read(key), MODEL[key], `${key} differs between the agent and the browser model`);
  }
  assert.equal(read('since'), MODEL.since);
  assert.match(ui, /1 \/ Math\.sqrt\(count\)/, 'the browser model lost the uncertainty loading');
});
