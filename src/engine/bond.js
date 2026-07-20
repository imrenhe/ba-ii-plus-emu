// bond.js — bond price, yield and accrued interest.
//
// Two entry points:
//   • bondPrice / bondYield — simple, coupon-date settlement measured in whole
//     coupon periods (used by teaching problems and unit tests).
//   • bondPriceDated / bondYieldDated — full device fidelity: real settlement
//     and redemption dates, a day-count convention (ACT or 30/360) and accrued
//     interest for settlement between coupon dates.

import { toJS, daysBetween, addMonths } from './dates.js';

// ── Simple, periods-based (settlement on a coupon date) ─────────────────────
export function bondPrice({ couponRate, yieldRate, periods, freq = 2, redemption = 100 }) {
  const c = (couponRate / freq); // coupon per period per 100 face
  const y = yieldRate / 100 / freq;
  if (y === 0) return c * periods + redemption;
  const disc = Math.pow(1 + y, -periods);
  return c * (1 - disc) / y + redemption * disc;
}

export function bondYield({ couponRate, price, periods, freq = 2, redemption = 100 }) {
  const f = (yPct) => bondPrice({ couponRate, yieldRate: yPct, periods, freq, redemption }) - price;
  return bisect(f, 1e-9, 200);
}

// ── Full, date-based ─────────────────────────────────────────────────────────
function compareDate(a, b) {
  return toJS(a) - toJS(b);
}

/** Coupon dates ascending; first is the coupon on/before settlement, last is redemption. */
function couponSchedule(settlement, redemption, freq) {
  const stepMonths = 12 / freq;
  const dates = [redemption];
  let cur = redemption;
  for (let guard = 0; guard < 4000; guard++) {
    const prev = addMonths(cur, -stepMonths);
    dates.unshift(prev);
    if (compareDate(prev, settlement) <= 0) break;
    cur = prev;
  }
  return dates;
}

/**
 * Given the schedule and settlement, return the current period's boundaries and
 * the number of coupons still to be received.
 */
function periodInfo(settlement, redemption, freq) {
  const sched = couponSchedule(settlement, redemption, freq);
  let prevCoupon = sched[0];
  let nextCoupon = sched[1] ?? redemption;
  for (let i = 0; i < sched.length - 1; i++) {
    if (compareDate(sched[i], settlement) <= 0 && compareDate(sched[i + 1], settlement) > 0) {
      prevCoupon = sched[i];
      nextCoupon = sched[i + 1];
      break;
    }
  }
  const remaining = sched.filter((d) => compareDate(d, settlement) > 0).length;
  return { prevCoupon, nextCoupon, remaining };
}

/**
 * Dirty price, clean price and accrued interest per 100 face for a given yield.
 * @returns {{ price:number, accrued:number, dirty:number, n:number }}
 */
export function bondPriceDated({
  settlement, redemption, couponRate, yieldRate, redemptionValue = 100, freq = 2, method = 'ACT',
}) {
  const c = couponRate / freq; // coupon per period per 100 face
  const y = yieldRate / 100 / freq;
  const { prevCoupon, nextCoupon, remaining } = periodInfo(settlement, redemption, freq);

  const E = daysBetween(prevCoupon, nextCoupon, method); // days in current period
  const A = daysBetween(prevCoupon, settlement, method); // accrued days
  const t = E === 0 ? 1 : (E - A) / E; // fraction of a period until next coupon
  const N = remaining;

  let dirty = 0;
  for (let k = 0; k < N; k++) {
    const exp = t + k;
    dirty += c / Math.pow(1 + y, exp);
  }
  dirty += redemptionValue / Math.pow(1 + y, t + (N - 1));

  const accrued = c * (E === 0 ? 0 : A / E);
  return { price: dirty - accrued, accrued, dirty, n: N };
}

/** Yield to maturity (annual %) from a clean price, with dates. */
export function bondYieldDated({
  settlement, redemption, couponRate, price, redemptionValue = 100, freq = 2, method = 'ACT',
}) {
  const f = (yPct) =>
    bondPriceDated({
      settlement, redemption, couponRate, yieldRate: yPct, redemptionValue, freq, method,
    }).price - price;
  return bisect(f, 1e-9, 200);
}

/** Accrued interest per 100 face at settlement. */
export function accruedInterest({ settlement, redemption, couponRate, freq = 2, method = 'ACT' }) {
  const c = couponRate / freq;
  const { prevCoupon, nextCoupon } = periodInfo(settlement, redemption, freq);
  const E = daysBetween(prevCoupon, nextCoupon, method);
  const A = daysBetween(prevCoupon, settlement, method);
  return E === 0 ? 0 : c * (A / E);
}

// Shared bisection root finder over [lo, hi].
function bisect(f, lo, hi) {
  let flo = f(lo);
  let fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return NaN;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (Math.abs(fmid) < 1e-9) return mid;
    if (flo * fmid < 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return (lo + hi) / 2;
}
