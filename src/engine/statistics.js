// statistics.js — one-variable statistics (BA II Plus STAT worksheet).
//
// Data points may be weighted by a frequency, matching the worksheet's X/Frq
// entry. Reports n, ΣX, ΣX², mean, and both the sample (Sx, n−1) and
// population (σx, n) standard deviations.

/**
 * @param {Array<number | {x:number, freq?:number}>} points
 * @returns {{n:number, sumX:number, sumX2:number, mean:number, sampleStdDev:number, popStdDev:number}}
 */
export function oneVarStats(points) {
  let n = 0;
  let sumX = 0;
  let sumX2 = 0;
  for (const p of points) {
    const x = typeof p === 'number' ? p : p.x;
    const freq = typeof p === 'number' ? 1 : p.freq ?? 1;
    n += freq;
    sumX += x * freq;
    sumX2 += x * x * freq;
  }

  // Degenerate data (no points, or all frequencies 0) reports zeros rather
  // than NaN so the worksheet stays usable.
  const mean = n > 0 ? sumX / n : 0;
  const variancePop = n > 0 ? sumX2 / n - mean * mean : 0;
  const popStdDev = Math.sqrt(Math.max(0, variancePop));
  const sampleStdDev =
    n > 1 ? Math.sqrt(Math.max(0, (sumX2 - n * mean * mean) / (n - 1))) : 0;

  return { n, sumX, sumX2, mean, sampleStdDev, popStdDev };
}

// ── Two-variable statistics & regression (STAT worksheet models) ─────────────
// Models: LIN (y=a+bx), Ln (y=a+b·ln x), EXP (y=a·e^{bx}), PWR (y=a·x^b).
// Each is fitted as a linear regression on transformed data.
const TRANSFORMS = {
  LIN: { fx: (x) => x, fy: (y) => y },
  Ln: { fx: (x) => Math.log(x), fy: (y) => y },
  EXP: { fx: (x) => x, fy: (y) => Math.log(y) },
  PWR: { fx: (x) => Math.log(x), fy: (y) => Math.log(y) },
};

/**
 * @param {{x:number,y:number}[]} points
 * @param {'LIN'|'Ln'|'EXP'|'PWR'} model
 */
export function twoVarStats(points, model = 'LIN') {
  const n = points.length;
  const stat = (vals) => {
    const s = oneVarStats(vals);
    return s;
  };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const sx = stat(xs);
  const sy = stat(ys);

  const tf = TRANSFORMS[model] ?? TRANSFORMS.LIN;
  let sumTx = 0, sumTy = 0, sumTx2 = 0, sumTy2 = 0, sumTxy = 0;
  for (const p of points) {
    const tx = tf.fx(p.x);
    const ty = tf.fy(p.y);
    sumTx += tx; sumTy += ty; sumTx2 += tx * tx; sumTy2 += ty * ty; sumTxy += tx * ty;
  }
  // Linear fit ty = aLin + bLin·tx.
  const denom = n * sumTx2 - sumTx * sumTx;
  const bLin = denom === 0 ? NaN : (n * sumTxy - sumTx * sumTy) / denom;
  const aLin = (sumTy - bLin * sumTx) / n;
  const rDen = Math.sqrt((n * sumTx2 - sumTx * sumTx) * (n * sumTy2 - sumTy * sumTy));
  const r = rDen === 0 ? NaN : (n * sumTxy - sumTx * sumTy) / rDen;

  // Convert intercept/slope back to the model's natural parameters.
  let a = aLin;
  let b = bLin;
  if (model === 'EXP' || model === 'PWR') a = Math.exp(aLin);

  const predictY = (x) => {
    switch (model) {
      case 'Ln': return a + b * Math.log(x);
      case 'EXP': return a * Math.exp(b * x);
      case 'PWR': return a * Math.pow(x, b);
      default: return a + b * x;
    }
  };
  const predictX = (y) => {
    switch (model) {
      case 'Ln': return Math.exp((y - a) / b);
      case 'EXP': return Math.log(y / a) / b;
      case 'PWR': return Math.pow(y / a, 1 / b);
      default: return (y - a) / b;
    }
  };

  return {
    n,
    meanX: sx.mean, sampleStdDevX: sx.sampleStdDev, popStdDevX: sx.popStdDev,
    meanY: sy.mean, sampleStdDevY: sy.sampleStdDev, popStdDevY: sy.popStdDev,
    sumX: sx.sumX, sumX2: sx.sumX2, sumY: sy.sumX, sumY2: sy.sumX2, sumXY: sumProductXY(points),
    a, b, r, predictY, predictX,
  };
}

function sumProductXY(points) {
  let s = 0;
  for (const p of points) s += p.x * p.y;
  return s;
}
