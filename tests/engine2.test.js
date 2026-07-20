import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDeviceDate, formatDate, daysBetweenACT, daysBetween360, addDays, addMonths,
} from '../src/engine/dates.js';
import { bondPriceDated, bondYieldDated, accruedInterest, bondPrice } from '../src/engine/bond.js';
import { depreciate } from '../src/engine/depreciation.js';
import { nomToEff, effToNom, breakeven, profit, deltaPct } from '../src/engine/worksheet-math.js';
import { twoVarStats } from '../src/engine/statistics.js';
import { trig, factorial, nPr, nCr, DEG } from '../src/engine/sci.js';

const near = (a, b, eps = 1e-2) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);

// ── Dates ────────────────────────────────────────────────────────────────────
test('parse device date MM.DDYYYY', () => {
  assert.deepEqual(parseDeviceDate('12.312024'), { m: 12, d: 31, y: 2024 });
  assert.equal(formatDate({ m: 6, d: 5, y: 2020 }), '06-05-2020');
});

test('ACT vs 30/360 day counts across a leap year', () => {
  const a = { m: 1, d: 1, y: 2020 };
  const b = { m: 1, d: 1, y: 2021 };
  assert.equal(daysBetweenACT(a, b), 366); // 2020 is a leap year
  assert.equal(daysBetween360(a, b), 360);
});

test('addDays and addMonths', () => {
  assert.deepEqual(addDays({ m: 1, d: 31, y: 2020 }, 1), { m: 2, d: 1, y: 2020 });
  assert.deepEqual(addMonths({ m: 1, d: 31, y: 2020 }, 1), { m: 2, d: 29, y: 2020 });
});

// ── Bond (dated) ─────────────────────────────────────────────────────────────
test('dated par bond on a coupon date prices at 100', () => {
  const r = bondPriceDated({
    settlement: { m: 1, d: 1, y: 2020 }, redemption: { m: 1, d: 1, y: 2030 },
    couponRate: 6, yieldRate: 6, freq: 2, method: 'ACT',
  });
  near(r.price, 100, 1e-6);
  near(r.accrued, 0, 1e-9);
});

test('dated premium bond matches the periods-based formula on a coupon date', () => {
  const dated = bondPriceDated({
    settlement: { m: 1, d: 1, y: 2020 }, redemption: { m: 1, d: 1, y: 2030 },
    couponRate: 8, yieldRate: 6, freq: 2, method: 'ACT',
  });
  const simple = bondPrice({ couponRate: 8, yieldRate: 6, periods: 20, freq: 2 });
  near(dated.price, simple, 1e-6);
});

test('accrued interest at mid-period (ACT)', () => {
  // 6% semiannual, coupons 1/1 & 7/1; settle 4/1/2020 → 91/182 of 3.00 = 1.50
  const ai = accruedInterest({
    settlement: { m: 4, d: 1, y: 2020 }, redemption: { m: 1, d: 1, y: 2030 },
    couponRate: 6, freq: 2, method: 'ACT',
  });
  near(ai, 1.5, 1e-6);
});

test('bond yield inverts dated price', () => {
  const args = {
    settlement: { m: 1, d: 1, y: 2020 }, redemption: { m: 1, d: 1, y: 2030 },
    couponRate: 8, freq: 2, method: 'ACT',
  };
  const price = bondPriceDated({ ...args, yieldRate: 6 }).price;
  near(bondYieldDated({ ...args, price }), 6, 1e-4);
});

// ── Depreciation (partial year) ──────────────────────────────────────────────
test('SL with mid-year start (M01=7) splits into 6 calendar years', () => {
  const rows = depreciate({ method: 'SL', cost: 10000, salvage: 1000, life: 5, m01: 7 });
  assert.equal(rows.length, 6);
  near(rows[0].depreciation, 900, 1e-6); // half of 1800
  near(rows[5].depreciation, 900, 1e-6);
  near(rows.reduce((s, r) => s + r.depreciation, 0), 9000, 1e-6);
});

test('DBX crosses over to straight line and ends at salvage', () => {
  const rows = depreciate({ method: 'DBX', cost: 10000, salvage: 1000, life: 5, factor: 200 });
  near(rows[0].depreciation, 4000, 1e-6);
  near(rows[rows.length - 1].rbv, 1000, 1e-6);
});

// ── Interest conversion / breakeven / profit / percent change ────────────────
test('ICONV nominal ↔ effective', () => {
  near(nomToEff(12, 12), 12.6825, 1e-4);
  near(effToNom(12.6825, 12), 12, 1e-3);
});

test('breakeven solves each variable', () => {
  near(breakeven.PFT({ FC: 1000, Q: 100, P: 50, VC: 30 }), 1000, 1e-9);
  near(breakeven.Q({ FC: 1000, P: 50, VC: 30, PFT: 1000 }), 100, 1e-9);
});

test('profit margin', () => {
  near(profit.SEL({ CST: 80, MAR: 20 }), 100, 1e-9);
  near(profit.MAR({ CST: 80, SEL: 100 }), 20, 1e-9);
});

test('percent change / compound', () => {
  near(deltaPct.NEW({ OLD: 100, CH: 10, PD: 2 }), 121, 1e-9);
  near(deltaPct.CH({ OLD: 100, NEW: 121, PD: 2 }), 10, 1e-9);
});

// ── Two-variable regression ──────────────────────────────────────────────────
test('LIN regression recovers a perfect line', () => {
  const s = twoVarStats([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }], 'LIN');
  near(s.a, 0, 1e-9);
  near(s.b, 2, 1e-9);
  near(s.r, 1, 1e-9);
  near(s.predictY(4), 8, 1e-9);
});

test('PWR regression recovers y = 2·x^3', () => {
  const s = twoVarStats([{ x: 1, y: 2 }, { x: 2, y: 16 }, { x: 3, y: 54 }], 'PWR');
  near(s.a, 2, 1e-6);
  near(s.b, 3, 1e-6);
  near(s.r, 1, 1e-6);
});

// ── Scientific ───────────────────────────────────────────────────────────────
test('trig in degrees, inverse, and factorial/combinatorics', () => {
  near(trig('sin', 30, { mode: DEG }), 0.5, 1e-9);
  near(trig('sin', 0.5, { mode: DEG, inverse: true }), 30, 1e-9);
  near(trig('cos', 0, { mode: DEG, hyp: true }), 1, 1e-9); // cosh(0)=1
  assert.equal(factorial(5), 120);
  assert.equal(nPr(5, 2), 20);
  assert.equal(nCr(5, 2), 10);
});
