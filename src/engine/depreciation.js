// depreciation.js — depreciation schedules for the DEPR worksheet.
//
// Methods: SL (straight line), SYD (sum-of-years'-digits), DB (declining
// balance), DBX (declining balance with automatic crossover to straight line),
// SLF (straight line, French — treated as SL here). Supports a partial first
// year via M01, the month placed in service (1 = full first year).
//
// The per-life-year amounts are computed as if the asset were placed in service
// at the start of a year, then prorated across calendar years by the first-year
// fraction f1 = (13 − M01)/12. This conserves the total depreciable base and
// matches the device's behavior for the common cases.

/** Depreciation amount for each full life-year (index 0 = year 1), before proration. */
function lifeYearAmounts({ method, cost, salvage, life, factor = 200 }) {
  const base = cost - salvage;
  const out = [];
  if (method === 'SL' || method === 'SLF') {
    for (let i = 0; i < life; i++) out.push(base / life);
    return out;
  }
  if (method === 'SYD') {
    const sum = (life * (life + 1)) / 2;
    for (let i = 1; i <= life; i++) out.push((base * (life - i + 1)) / sum);
    return out;
  }
  if (method === 'DB' || method === 'DBX') {
    const rate = factor / 100 / life;
    let book = cost;
    for (let i = 1; i <= life; i++) {
      const remainingLife = life - i + 1;
      let dep = book * rate;
      if (method === 'DBX') {
        const slDep = (book - salvage) / remainingLife; // crossover candidate
        if (slDep > dep) dep = slDep;
      }
      if (book - dep < salvage) dep = book - salvage; // never below salvage
      if (dep < 0) dep = 0;
      out.push(dep);
      book -= dep;
    }
    return out;
  }
  throw new Error(`Unknown depreciation method: ${method}`);
}

/**
 * Full calendar-year schedule.
 * @returns {{year:number, depreciation:number, rbv:number, rdv:number}[]}
 */
export function depreciate({ method, cost, salvage, life, factor = 200, m01 = 1 }) {
  const amounts = lifeYearAmounts({ method, cost, salvage, life, factor });
  const f1 = Math.min(1, Math.max(0, (13 - m01) / 12));

  // Prorate life-year amounts across calendar years.
  const calYears = f1 >= 1 ? life : life + 1;
  const cal = new Array(calYears).fill(0);
  for (let i = 0; i < amounts.length; i++) {
    cal[i] += amounts[i] * f1;
    if (i + 1 < calYears) cal[i + 1] += amounts[i] * (1 - f1);
  }

  const rows = [];
  let book = cost;
  for (let y = 1; y <= calYears; y++) {
    const dep = cal[y - 1];
    book -= dep;
    rows.push({
      year: y,
      depreciation: dep,
      rbv: book,
      rdv: Math.max(0, book - salvage),
    });
  }
  return rows;
}

/** DEP / RBV / RDV for a single calendar year (what the worksheet shows). */
export function depreciationYear(args, year) {
  const rows = depreciate(args);
  const row = rows.find((r) => r.year === year);
  return row ?? { year, depreciation: 0, rbv: args.cost, rdv: args.cost - args.salvage };
}
