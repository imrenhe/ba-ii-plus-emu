// depreciation.js — depreciation schedules (BA II Plus DEPR worksheet).
//
// Supports the worksheet's core methods: straight line (SL), sum-of-the-years'-
// digits (SYD), and declining balance (DB, e.g. 200 = double-declining). Each
// returns a per-year schedule with depreciation, remaining book value (RBV),
// and remaining depreciable value (RDV).

/**
 * @param {object} p
 * @param {'SL'|'SYD'|'DB'} p.method
 * @param {number} p.cost      depreciable cost basis
 * @param {number} p.salvage   salvage value
 * @param {number} p.life      useful life in years
 * @param {number} [p.factor]  declining-balance factor in percent (e.g. 200 for DDB)
 * @returns {{year:number, depreciation:number, rbv:number, rdv:number}[]}
 */
export function depreciate({ method, cost, salvage, life, factor = 200 }) {
  const rows = [];
  const depreciable = cost - salvage;
  let book = cost;

  if (method === 'SL') {
    const annual = depreciable / life;
    for (let y = 1; y <= life; y++) {
      const dep = annual;
      book -= dep;
      rows.push(row(y, dep, book, salvage));
    }
    return rows;
  }

  if (method === 'SYD') {
    const sumDigits = (life * (life + 1)) / 2;
    for (let y = 1; y <= life; y++) {
      const dep = (depreciable * (life - y + 1)) / sumDigits;
      book -= dep;
      rows.push(row(y, dep, book, salvage));
    }
    return rows;
  }

  if (method === 'DB') {
    const rate = factor / 100 / life;
    for (let y = 1; y <= life; y++) {
      let dep = book * rate;
      // Never depreciate below salvage.
      if (book - dep < salvage) dep = book - salvage;
      if (dep < 0) dep = 0;
      book -= dep;
      rows.push(row(y, dep, book, salvage));
    }
    return rows;
  }

  throw new Error(`Unknown depreciation method: ${method}`);
}

function row(year, depreciation, book, salvage) {
  const rbv = book;
  const rdv = Math.max(0, book - salvage);
  return { year, depreciation, rbv, rdv };
}
