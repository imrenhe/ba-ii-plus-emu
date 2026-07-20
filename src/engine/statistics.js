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

  const mean = n > 0 ? sumX / n : NaN;
  const variancePop = n > 0 ? sumX2 / n - mean * mean : NaN;
  const popStdDev = Math.sqrt(Math.max(0, variancePop));
  const sampleStdDev =
    n > 1 ? Math.sqrt(Math.max(0, (sumX2 - n * mean * mean) / (n - 1))) : NaN;

  return { n, sumX, sumX2, mean, sampleStdDev, popStdDev };
}
