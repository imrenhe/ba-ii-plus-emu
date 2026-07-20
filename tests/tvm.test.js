import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTVM, tvmResidual, periodicRate } from '../src/engine/tvm.js';

const near = (a, b, eps = 1e-2) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);

test('FV of a lump sum: $1000 at 5% for 10 years', () => {
  // PV = -1000 (outflow today), no payments → FV = 1000·1.05^10 = 1628.89
  const fv = computeTVM('FV', { n: 10, iy: 5, pv: -1000, pmt: 0 });
  near(fv, 1628.89);
});

test('PV of a lump sum: $2000 in 8 years at 7%', () => {
  const pv = computeTVM('PV', { n: 8, iy: 7, pmt: 0, fv: 2000 });
  near(pv, -1164.02);
});

test('Mortgage payment: $100k, 6%/yr monthly, 30 years', () => {
  // P/Y = C/Y = 12 → 0.5% per month, 360 payments.
  const pmt = computeTVM('PMT', {
    n: 360, iy: 6, pv: 100000, fv: 0, py: 12, cy: 12,
  });
  near(pmt, -599.55);
});

test('Solve I/Y: $1000 grows to $2000 in 10 years', () => {
  const iy = computeTVM('IY', { n: 10, pv: -1000, pmt: 0, fv: 2000 });
  near(iy, 7.177, 1e-3);
});

test('Solve I/Y for an annuity (car loan): $20k, $377/mo, 60 months', () => {
  // Borrow 20,000 (inflow +), pay 60 payments of 377.42 (outflow −).
  const iy = computeTVM('IY', {
    n: 60, pv: 20000, pmt: -386.66, fv: 0, py: 12, cy: 12,
  });
  near(iy, 6.0, 1e-2);
});

test('Solve N: saving $100/mo at 6%/yr to reach $10,000', () => {
  const n = computeTVM('N', {
    iy: 6, pv: 0, pmt: -100, fv: 10000, py: 12, cy: 12,
  });
  near(n, 81.30, 1e-2);
});

test('FV of an ordinary annuity: $200/mo, 5%/yr, 20 years', () => {
  const fv = computeTVM('FV', {
    n: 240, iy: 5, pv: 0, pmt: -200, py: 12, cy: 12,
  });
  near(fv, 82206.73, 0.5);
});

test('Annuity due (BEGIN) vs ordinary (END) differ by (1+i)', () => {
  const args = { n: 10, iy: 8, pv: 0, pmt: -1000 };
  const fvEnd = computeTVM('FV', { ...args, begin: false });
  const fvBgn = computeTVM('FV', { ...args, begin: true });
  const i = periodicRate(8, 1, 1);
  near(fvBgn, fvEnd * (1 + i), 1e-4);
});

test('PV of annuity due: $500/yr for 5 years at 10%, payments at start', () => {
  const pv = computeTVM('PV', {
    n: 5, iy: 10, pmt: -500, fv: 0, begin: true,
  });
  // Ordinary PV = 1895.39; due = ×1.10 = 2084.93
  near(pv, 2084.93, 1e-2);
});

test('P/Y ≠ C/Y: 8% compounded quarterly, monthly payments', () => {
  // Nominal 8%, C/Y = 4, P/Y = 12. Per-month rate = (1+.08/4)^(4/12)-1.
  const i = periodicRate(8, 12, 4);
  near(i, Math.pow(1.02, 1 / 3) - 1, 1e-12);
});

test('round-trip: every solved value zeroes the TVM residual', () => {
  const base = { n: 48, iy: 9, pv: 15000, pmt: -373.28, fv: 0, py: 12, cy: 12 };
  for (const solveFor of ['N', 'PV', 'PMT', 'FV', 'IY']) {
    const solved = computeTVM(solveFor, base);
    const merged = { ...base };
    if (solveFor === 'IY') merged.iy = solved;
    else merged[solveFor.toLowerCase()] = solved;
    const i = periodicRate(merged.iy, merged.py, merged.cy);
    const r = tvmResidual({
      n: merged.n, i, pv: merged.pv, pmt: merged.pmt, fv: merged.fv,
    });
    assert.ok(Math.abs(r) < 1e-4, `${solveFor}: residual ${r} not ~0`);
  }
});

test('zero-interest case: PV + PMT·N + FV = 0', () => {
  const pmt = computeTVM('PMT', { n: 12, iy: 0, pv: 1200, fv: 0 });
  near(pmt, -100, 1e-9);
  const n = computeTVM('N', { iy: 0, pv: 1000, pmt: -50, fv: 0 });
  near(n, 20, 1e-9);
});
