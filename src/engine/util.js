// util.js — shared numeric helpers for the finance engine.
// Pure functions only; no DOM, no side effects.

/** Round to a fixed number of decimal places, avoiding binary-float artifacts. */
export function round(value, decimals = 10) {
  if (!isFinite(value)) return value;
  const f = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** True when two numbers are within `eps` of each other. */
export function approxEqual(a, b, eps = 1e-7) {
  return Math.abs(a - b) <= eps;
}

/**
 * Find a root of f in [lo, hi] by bisection. Assumes f(lo) and f(hi)
 * bracket a sign change. Returns null if they don't or it fails to converge.
 */
export function bisection(f, lo, hi, { tol = 1e-10, maxIter = 200 } = {}) {
  let flo = f(lo);
  let fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (!isFinite(fmid)) return null;
    if (Math.abs(fmid) < tol || (hi - lo) / 2 < tol) return mid;
    if (flo * fmid < 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Newton–Raphson root finder with a numerically-estimated derivative and a
 * guard against divergence. Returns null on failure.
 */
export function newton(f, guess, { tol = 1e-10, maxIter = 100, h = 1e-6 } = {}) {
  let x = guess;
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x);
    if (!isFinite(fx)) return null;
    if (Math.abs(fx) < tol) return x;
    const dfx = (f(x + h) - f(x - h)) / (2 * h);
    if (!isFinite(dfx) || dfx === 0) return null;
    const next = x - fx / dfx;
    if (!isFinite(next)) return null;
    if (Math.abs(next - x) < tol) return next;
    x = next;
  }
  return null;
}
