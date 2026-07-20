// cashflow.js — discounted-cash-flow analysis: NPV, IRR, NFV, payback.
//
// Cash flows follow the BA II Plus CF worksheet model: an initial flow CF0 at
// time 0, followed by a list of grouped flows. Each group is { amount, count }
// meaning `amount` repeated `count` consecutive periods. This mirrors the
// device's "CFj / Fj" (frequency) entry so students can enter, e.g., a level
// stream compactly.

/**
 * Expand grouped flows into a flat per-period array, index 0 = CF0.
 * @param {number} cf0
 * @param {{amount:number,count:number}[]} groups
 * @returns {number[]}
 */
export function flatten(cf0, groups = []) {
  const flows = [cf0];
  for (const g of groups) {
    const count = Math.max(0, Math.round(g.count ?? 1));
    for (let k = 0; k < count; k++) flows.push(g.amount);
  }
  return flows;
}

/**
 * Net present value at a per-period rate expressed as a percent.
 * NPV = Σ CF_t / (1 + rate/100)^t, t = 0..T.
 */
export function npv(ratePercent, flows) {
  const r = ratePercent / 100;
  let acc = 0;
  for (let t = 0; t < flows.length; t++) {
    acc += flows[t] / Math.pow(1 + r, t);
  }
  return acc;
}

/** Net future value: NPV compounded forward to the final period. */
export function nfv(ratePercent, flows) {
  const r = ratePercent / 100;
  return npv(ratePercent, flows) * Math.pow(1 + r, flows.length - 1);
}

/**
 * Internal rate of return (percent) — the rate where NPV = 0. Combines a
 * Newton step from a good guess with a robust bracketed scan so it converges
 * on textbook problems and reports NaN when no real IRR exists in range.
 * @returns {number} IRR in percent, or NaN
 */
export function irr(flows, { guess = 0.1 } = {}) {
  const f = (r) => {
    let acc = 0;
    for (let t = 0; t < flows.length; t++) acc += flows[t] / Math.pow(1 + r, t);
    return acc;
  };
  const df = (r) => {
    let acc = 0;
    for (let t = 1; t < flows.length; t++) {
      acc += (-t * flows[t]) / Math.pow(1 + r, t + 1);
    }
    return acc;
  };

  // Newton–Raphson.
  let r = guess;
  for (let i = 0; i < 100; i++) {
    const fr = f(r);
    if (!isFinite(fr)) break;
    if (Math.abs(fr) < 1e-9) return r * 100;
    const dfr = df(r);
    if (!isFinite(dfr) || dfr === 0) break;
    const next = r - fr / dfr;
    if (next <= -1) break; // keep 1+r positive
    if (Math.abs(next - r) < 1e-12) return next * 100;
    r = next;
  }

  // Fallback: scan [-99%, +1000%] for a sign change, then bisect.
  const lo = -0.9999;
  const hi = 10;
  const steps = 1000;
  let prev = lo;
  let fprev = f(prev);
  for (let s = 1; s <= steps; s++) {
    const cur = lo + ((hi - lo) * s) / steps;
    const fcur = f(cur);
    if (isFinite(fprev) && isFinite(fcur) && fprev * fcur <= 0) {
      let a = prev;
      let b = cur;
      for (let k = 0; k < 200; k++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (Math.abs(fm) < 1e-10) return m * 100;
        if (fprev * fm < 0) b = m;
        else {
          a = m;
          fprev = fm;
        }
      }
      return ((a + b) / 2) * 100;
    }
    prev = cur;
    fprev = fcur;
  }
  return NaN;
}

/**
 * Discounted payback period (in periods) at a given rate, using linear
 * interpolation within the period where cumulative discounted CF turns
 * non-negative. Returns NaN if it never recovers. Pass rate 0 for plain payback.
 */
export function payback(flows, ratePercent = 0) {
  const r = ratePercent / 100;
  let cum = 0;
  let prevCum = 0;
  for (let t = 0; t < flows.length; t++) {
    prevCum = cum;
    cum += flows[t] / Math.pow(1 + r, t);
    if (cum >= 0 && t > 0) {
      const thisFlow = cum - prevCum;
      if (thisFlow === 0) return t;
      return t - 1 + -prevCum / thisFlow;
    }
  }
  return NaN;
}
