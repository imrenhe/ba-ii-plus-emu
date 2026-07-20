import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amortRange, schedule, balanceAfter } from '../src/engine/amort.js';
import { bondPrice, bondYield } from '../src/engine/bond.js';
import { depreciate } from '../src/engine/depreciation.js';
import { oneVarStats } from '../src/engine/statistics.js';

const near = (a, b, eps = 1e-2) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);

// ── Amortization ──────────────────────────────────────────────────────────
test('amort: $100k mortgage, 6%/yr monthly, first payment split', () => {
  const pmt = 599.55; // solved separately in tvm tests
  const rows = schedule({ loan: 100000, pmt, iy: 6, py: 12, cy: 12, periods: 360 });
  // Month 1 interest = 100000 · 0.005 = 500; principal = 99.55.
  near(rows[0].interest, 500, 1e-6);
  near(rows[0].principal, 99.55, 1e-2);
});

test('amort: full schedule pays the loan down to ~zero', () => {
  const pmt = 599.55;
  const rows = schedule({ loan: 100000, pmt, iy: 6, py: 12, cy: 12, periods: 360 });
  near(rows[rows.length - 1].balance, 0, 1e-6);
});

test('amort: range aggregates interest and principal for year 1', () => {
  const pmt = 599.55;
  const r = amortRange({ loan: 100000, pmt, iy: 6, py: 12, cy: 12, p1: 1, p2: 12, periods: 360 });
  // Sum of first 12 payments = 12 · 599.55 = 7194.60; principal + interest must match.
  near(r.principal + r.interest, 12 * pmt, 1e-6);
  near(r.balance, balanceAfter(100000, pmt, 0.005, 12), 1e-6);
});

// ── Bond ──────────────────────────────────────────────────────────────────
test('bond: par bond prices at 100 when coupon = yield', () => {
  near(bondPrice({ couponRate: 5, yieldRate: 5, periods: 20, freq: 2 }), 100, 1e-6);
});

test('bond: premium when yield below coupon', () => {
  // 8% coupon, 6% yield, 10 yrs semiannual → price ≈ 114.88
  near(bondPrice({ couponRate: 8, yieldRate: 6, periods: 20, freq: 2 }), 114.88, 1e-2);
});

test('bond: yield inverts price (round-trip)', () => {
  const price = bondPrice({ couponRate: 8, yieldRate: 6, periods: 20, freq: 2 });
  near(bondYield({ couponRate: 8, price, periods: 20, freq: 2 }), 6, 1e-4);
});

// ── Depreciation ────────────────────────────────────────────────────────────
test('depreciation SL: even annual charge', () => {
  const rows = depreciate({ method: 'SL', cost: 10000, salvage: 1000, life: 5 });
  near(rows[0].depreciation, 1800, 1e-6);
  near(rows[4].rbv, 1000, 1e-6);
});

test('depreciation SYD: first year is life/sum of the depreciable base', () => {
  const rows = depreciate({ method: 'SYD', cost: 10000, salvage: 1000, life: 5 });
  // Year 1 = 9000 · 5/15 = 3000
  near(rows[0].depreciation, 3000, 1e-6);
  near(rows[4].rbv, 1000, 1e-6);
});

test('depreciation DDB: 200% declining balance, never below salvage', () => {
  const rows = depreciate({ method: 'DB', cost: 10000, salvage: 1000, life: 5, factor: 200 });
  // Year 1 = 10000 · (2/5) = 4000
  near(rows[0].depreciation, 4000, 1e-6);
  assert.ok(rows[rows.length - 1].rbv >= 1000 - 1e-9);
});

// ── Statistics ──────────────────────────────────────────────────────────────
test('stats: mean and sample/population std dev', () => {
  const s = oneVarStats([2, 4, 4, 4, 5, 5, 7, 9]);
  near(s.mean, 5, 1e-9);
  near(s.popStdDev, 2, 1e-9); // classic dataset: σ = 2
  near(s.sampleStdDev, 2.13809, 1e-4);
});

test('stats: frequency-weighted points match expanded data', () => {
  const weighted = oneVarStats([{ x: 10, freq: 3 }, { x: 20, freq: 2 }]);
  const expanded = oneVarStats([10, 10, 10, 20, 20]);
  near(weighted.mean, expanded.mean, 1e-9);
  near(weighted.popStdDev, expanded.popStdDev, 1e-9);
  assert.equal(weighted.n, 5);
});
