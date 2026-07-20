// amort.js — amortization schedule derived from a solved TVM loan.
//
// Mirrors the BA II Plus AMORT worksheet: given a loan (PV), a periodic
// payment (PMT), and the per-period rate (i), report principal paid, interest
// paid, and remaining balance over a range of payments P1..P2.

import { periodicRate } from './tvm.js';

/**
 * Remaining balance after `period` payments.
 * @param {number} balance0  starting principal (positive)
 * @param {number} pmt       payment per period (positive magnitude)
 * @param {number} i         per-period rate (decimal)
 * @param {number} period    number of payments made
 */
export function balanceAfter(balance0, pmt, i, period) {
  let bal = balance0;
  for (let k = 0; k < period; k++) {
    const interest = bal * i;
    bal = bal + interest - pmt;
  }
  return bal;
}

/**
 * Full per-payment amortization schedule.
 * @returns {{period:number, payment:number, interest:number, principal:number, balance:number}[]}
 */
export function schedule({ loan, pmt, iy, py = 1, cy = py, periods }) {
  const i = periodicRate(iy, py, cy);
  const rows = [];
  let bal = loan;
  const n = periods ?? 0;
  for (let p = 1; p <= n; p++) {
    const interest = bal * i;
    let principal = pmt - interest;
    // Final payment: clear any residual so the balance lands exactly on zero.
    if (p === n && Math.abs(bal - principal) < pmt) principal = bal;
    bal = bal - principal;
    rows.push({
      period: p,
      payment: interest + principal,
      interest,
      principal,
      balance: bal,
    });
  }
  return rows;
}

/**
 * Aggregate interest, principal, and ending balance for the payment range
 * P1..P2 inclusive — the numbers the AMORT worksheet displays.
 */
export function amortRange({ loan, pmt, iy, py = 1, cy = py, p1, p2, periods }) {
  const rows = schedule({ loan, pmt, iy, py, cy, periods: periods ?? p2 });
  let interest = 0;
  let principal = 0;
  let endingBalance = loan;
  for (const row of rows) {
    if (row.period >= p1 && row.period <= p2) {
      interest += row.interest;
      principal += row.principal;
    }
    if (row.period === p2) endingBalance = row.balance;
  }
  return { p1, p2, principal, interest, balance: endingBalance };
}
