import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatten, npv, irr, nfv, payback } from '../src/engine/cashflow.js';

const near = (a, b, eps = 1e-2) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);

test('flatten expands grouped cash flows', () => {
  const flows = flatten(-1000, [{ amount: 100, count: 3 }, { amount: 500, count: 1 }]);
  assert.deepEqual(flows, [-1000, 100, 100, 100, 500]);
});

test('NPV of a classic project at 10%', () => {
  // CF0 = -1000, then 500, 400, 300, 200 (textbook example).
  const flows = [-1000, 500, 400, 300, 200];
  near(npv(10, flows), 147.12);
});

test('NPV at the IRR is zero', () => {
  const flows = [-1000, 500, 400, 300, 200];
  const r = irr(flows);
  near(npv(r, flows), 0, 1e-6);
});

test('IRR of a simple two-flow project: -100 now, 110 next period = 10%', () => {
  near(irr([-100, 110]), 10, 1e-6);
});

test('IRR of the classic project ≈ 17.80%', () => {
  const flows = [-1000, 500, 400, 300, 200];
  near(irr(flows), 17.805, 1e-2);
});

test('IRR with grouped/level cash flows: -5000 then 1000/yr for 7 yrs', () => {
  const flows = flatten(-5000, [{ amount: 1000, count: 7 }]);
  // Annuity IRR where 5000 = 1000·PVIFA(r,7) → r ≈ 9.196%
  near(irr(flows), 9.196, 1e-2);
});

test('NFV equals NPV compounded to the final period', () => {
  const flows = [-1000, 500, 400, 300, 200];
  const rate = 10;
  near(nfv(rate, flows), npv(rate, flows) * Math.pow(1.1, 4), 1e-6);
});

test('undiscounted payback of -1000 then 400/yr recovers during year 3', () => {
  const flows = [-1000, 400, 400, 400, 400];
  near(payback(flows, 0), 2.5, 1e-6);
});

test('IRR returns NaN for an all-positive stream (no sign change)', () => {
  assert.ok(Number.isNaN(irr([100, 200, 300])));
});
