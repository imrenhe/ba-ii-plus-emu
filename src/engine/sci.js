// sci.js — scientific functions for the non-finance keys. Pure and stateless;
// the controller decides angle mode and INV/HYP modifiers and calls in here.

export const DEG = 'DEG';
export const RAD = 'RAD';

const toRad = (x, mode) => (mode === DEG ? (x * Math.PI) / 180 : x);
const fromRad = (x, mode) => (mode === DEG ? (x * 180) / Math.PI : x);

/**
 * Trigonometric evaluation with optional inverse and hyperbolic modifiers.
 * @param {'sin'|'cos'|'tan'} fn
 * @param {number} x
 * @param {{ mode?: string, inverse?: boolean, hyp?: boolean }} opts
 */
export function trig(fn, x, { mode = DEG, inverse = false, hyp = false } = {}) {
  if (hyp) {
    if (inverse) {
      const r = { sin: Math.asinh, cos: Math.acosh, tan: Math.atanh }[fn](x);
      return r;
    }
    return { sin: Math.sinh, cos: Math.cosh, tan: Math.tanh }[fn](x);
  }
  if (inverse) {
    const r = { sin: Math.asin, cos: Math.acos, tan: Math.atan }[fn](x);
    return fromRad(r, mode);
  }
  const rad = toRad(x, mode);
  return { sin: Math.sin, cos: Math.cos, tan: Math.tan }[fn](rad);
}

/** Factorial n! for non-negative integers (via gamma for tolerance of rounding). */
export function factorial(n) {
  if (n < 0) return NaN;
  const k = Math.round(n);
  if (Math.abs(n - k) > 1e-9) return gamma(n + 1); // non-integer → gamma
  let acc = 1;
  for (let i = 2; i <= k; i++) acc *= i;
  return acc;
}

/** Permutations nPr = n! / (n−r)!. */
export function nPr(n, r) {
  if (r < 0 || r > n) return NaN;
  let acc = 1;
  for (let i = 0; i < r; i++) acc *= n - i;
  return acc;
}

/** Combinations nCr = n! / (r!·(n−r)!). */
export function nCr(n, r) {
  if (r < 0 || r > n) return NaN;
  r = Math.min(r, n - r);
  let acc = 1;
  for (let i = 0; i < r; i++) acc = (acc * (n - i)) / (i + 1);
  return Math.round(acc);
}

// Lanczos approximation of the gamma function (for non-integer factorials).
function gamma(z) {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}
