// bond.js — bond price and yield (BA II Plus BOND worksheet, simplified).
//
// Works on a settlement that falls on a coupon date (the common textbook case),
// so time is measured in whole coupon periods. Price is quoted per 100 of face
// (redemption) value. Coupon rate and yield are annual percentages; frequency
// is coupons per year (2 for semiannual — the worksheet default).

/**
 * Clean price per 100 face, given yield to maturity.
 * @param {object} p
 * @param {number} p.couponRate  annual coupon rate, percent
 * @param {number} p.yieldRate   annual yield to maturity, percent
 * @param {number} p.periods     number of coupon periods to maturity
 * @param {number} [p.freq]      coupons per year (default 2)
 * @param {number} [p.redemption] redemption value per 100 (default 100)
 */
export function bondPrice({ couponRate, yieldRate, periods, freq = 2, redemption = 100 }) {
  const c = (couponRate / 100 / freq) * 100; // coupon amount per period per 100
  const y = yieldRate / 100 / freq; // yield per period
  if (y === 0) return c * periods + redemption;
  const disc = Math.pow(1 + y, -periods);
  const annuity = (1 - disc) / y;
  return c * annuity + redemption * disc;
}

/**
 * Yield to maturity (annual percent) given a clean price, solved numerically.
 * @returns {number} annual YTM percent, or NaN
 */
export function bondYield({ couponRate, price, periods, freq = 2, redemption = 100 }) {
  const f = (yPct) =>
    bondPrice({ couponRate, yieldRate: yPct, periods, freq, redemption }) - price;

  // Bisection over 0%..200% annual yield — ample for teaching problems.
  let lo = 1e-9;
  let hi = 200;
  let flo = f(lo);
  let fhi = f(hi);
  if (flo * fhi > 0) return NaN;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (Math.abs(fmid) < 1e-9) return mid;
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
