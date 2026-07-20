// tvm.js — Time Value of Money solver.
//
// Sign convention matches the TI BA II Plus (and most finance textbooks):
// cash inflows are positive, outflows negative. The governing equation, for a
// per-period rate i, number of periods N, and payment-timing flag g
// (g = 1 for BEGIN / annuity-due, g = 0 for END / ordinary annuity):
//
//   0 = PV + (1 + i·g)·PMT·[(1 − (1+i)^−N) / i] + FV·(1+i)^−N
//
// When i = 0 this degenerates to  0 = PV + PMT·N + FV.
//
// The solver works entirely in the *per-period* rate i. Conversion between the
// nominal annual rate I/Y (with P/Y payments and C/Y compoundings per year)
// and i lives in periodicRate()/nominalRate() so the UI layer can stay simple.

import { newton, bisection } from './util.js';

/**
 * Convert a nominal annual rate I/Y (percent) into the effective per-period
 * rate used by the TVM equation, honoring payments/year and compoundings/year.
 *
 *   i = (1 + (I/Y/100)/C/Y) ^ (C/Y / P/Y) − 1
 *
 * When P/Y === C/Y this simplifies to (I/Y/100)/P/Y.
 */
export function periodicRate(iy, py = 1, cy = py) {
  const nominal = iy / 100;
  if (nominal === 0) return 0;
  return Math.pow(1 + nominal / cy, cy / py) - 1;
}

/** Inverse of periodicRate(): per-period rate i back to nominal annual I/Y (%). */
export function nominalRate(i, py = 1, cy = py) {
  if (i === 0) return 0;
  return cy * (Math.pow(1 + i, py / cy) - 1) * 100;
}

/** Present-value-of-annuity factor  a = (1 − (1+i)^−N) / i  (N for i = 0). */
function annuityFactor(i, n) {
  if (i === 0) return n;
  return (1 - Math.pow(1 + i, -n)) / i;
}

/**
 * Evaluate the TVM equation residual. Zero means the five values are
 * consistent. All arguments are in per-period terms (rate i, not I/Y).
 */
export function tvmResidual({ n, i, pv, pmt, fv, begin = false }) {
  const g = begin ? 1 : 0;
  const disc = Math.pow(1 + i, -n);
  return pv + (1 + i * g) * pmt * annuityFactor(i, n) + fv * disc;
}

export function solveFV({ n, i, pv, pmt, begin = false }) {
  const g = begin ? 1 : 0;
  if (i === 0) return -(pv + pmt * n);
  const disc = Math.pow(1 + i, -n);
  return -(pv + (1 + i * g) * pmt * annuityFactor(i, n)) / disc;
}

export function solvePV({ n, i, pmt, fv, begin = false }) {
  const g = begin ? 1 : 0;
  if (i === 0) return -(pmt * n + fv);
  const disc = Math.pow(1 + i, -n);
  return -((1 + i * g) * pmt * annuityFactor(i, n) + fv * disc);
}

export function solvePMT({ n, i, pv, fv, begin = false }) {
  const g = begin ? 1 : 0;
  if (i === 0) {
    if (n === 0) return NaN;
    return -(pv + fv) / n;
  }
  const disc = Math.pow(1 + i, -n);
  return -(pv + fv * disc) / ((1 + i * g) * annuityFactor(i, n));
}

export function solveN({ i, pv, pmt, fv, begin = false }) {
  const g = begin ? 1 : 0;
  if (i === 0) {
    if (pmt === 0) return NaN;
    return -(pv + fv) / pmt;
  }
  if (pmt === 0) {
    // 0 = pv + fv·(1+i)^−N  →  (1+i)^N = −fv/pv
    if (pv === 0 || -fv / pv <= 0) return NaN;
    return Math.log(-fv / pv) / Math.log(1 + i);
  }
  // Rearranged: (PV + k) + (FV − k)·(1+i)^−N = 0, with k = PMT·(1+i·g)/i.
  const k = (pmt * (1 + i * g)) / i;
  const ratio = -(pv + k) / (fv - k);
  if (ratio <= 0) return NaN;
  return -Math.log(ratio) / Math.log(1 + i);
}

/**
 * Solve for the per-period rate i given the other four values. Returns the
 * per-period rate (not I/Y). Uses Newton from a sensible guess and falls back
 * to bracketed bisection over a wide plausible range.
 */
export function solvePeriodicRate({ n, pv, pmt, fv, begin = false }) {
  const f = (i) => tvmResidual({ n, i, pv, pmt, fv, begin });

  // Guess: for a pure annuity, PMT·N/(−(PV+FV)) approximates the rate scale.
  const total = pv + pmt * n + fv;
  let guess = 0.05;
  if (pmt !== 0 && n > 0) {
    const approx = -total / (pmt * n);
    if (isFinite(approx) && approx > -0.9) guess = Math.max(approx, 0.0001);
  }

  const viaNewton = newton(f, guess);
  if (viaNewton !== null && isFinite(viaNewton) && viaNewton > -1) {
    return viaNewton;
  }
  // Fallback: scan for a sign change, then bisect.
  const lo = -0.9999;
  const hi = 100; // 10000% per period upper bound — extremely generous
  let prev = lo;
  let fprev = f(prev);
  const steps = 400;
  for (let s = 1; s <= steps; s++) {
    const cur = lo + ((hi - lo) * s) / steps;
    const fcur = f(cur);
    if (isFinite(fprev) && isFinite(fcur) && fprev * fcur <= 0) {
      const r = bisection(f, prev, cur);
      if (r !== null) return r;
    }
    prev = cur;
    fprev = fcur;
  }
  return NaN;
}

/**
 * High-level dispatch: given four of the five TVM variables plus P/Y and C/Y,
 * solve for the requested one. `iy` is the nominal annual rate in percent.
 *
 * @param {'N'|'IY'|'PV'|'PMT'|'FV'} solveFor
 * @returns {number} the solved value in the same units as the corresponding input
 */
export function computeTVM(solveFor, { n, iy, pv, pmt, fv, py = 1, cy = py, begin = false }) {
  const i = periodicRate(iy, py, cy);
  switch (solveFor) {
    case 'N':
      return solveN({ i, pv, pmt, fv, begin });
    case 'PV':
      return solvePV({ n, i, pmt, fv, begin });
    case 'PMT':
      return solvePMT({ n, i, pv, fv, begin });
    case 'FV':
      return solveFV({ n, i, pv, pmt, begin });
    case 'IY': {
      const per = solvePeriodicRate({ n, pv, pmt, fv, begin });
      return nominalRate(per, py, cy);
    }
    default:
      throw new Error(`Unknown TVM variable: ${solveFor}`);
  }
}
