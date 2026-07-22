// worksheets.js — definitions of every on-device worksheet as an ordered list
// of prompt "fields". No DOM here: a worksheet is data + closures over the
// calculator's shared state (calc.data / calc settings). The controller
// (state.js) drives navigation, entry, SET and CPT against these fields.
//
// Field shape:
//   { label, kind: 'num'|'date'|'setting'|'output',
//     editable, computable, options?,
//     get(), set(v), compute?(), cycle?() }

import { flatten, npv, irr, nfv } from './engine/cashflow.js';
import { amortRange } from './engine/amort.js';
import { bondPriceDated, bondYieldDated, accruedInterest } from './engine/bond.js';
import { depreciationYear } from './engine/depreciation.js';
import { nomToEff, effToNom, breakeven, profit, deltaPct } from './engine/worksheet-math.js';
import { oneVarStats, twoVarStats } from './engine/statistics.js';
import { daysBetween, addDays } from './engine/dates.js';

const pad2 = (n) => String(n).padStart(2, '0');

// ── field factories ──────────────────────────────────────────────────────────
const numF = (label, get, set, opts = {}) => ({
  label, kind: 'num', editable: opts.editable !== false, computable: !!opts.compute,
  get, set, compute: opts.compute, format: opts.format,
});
const outF = (label, get, compute, opts = {}) => ({
  label, kind: 'output', editable: false, computable: true, get, compute, format: opts.format,
});
const dateF = (label, get, set, opts = {}) => ({
  label, kind: 'date', editable: true, computable: !!opts.compute, get, set, compute: opts.compute,
});
const setF = (label, options, get, set) => ({
  label, kind: 'setting', editable: false, computable: false, options, get, set,
  cycle() { set(options[(options.indexOf(get()) + 1) % options.length]); },
});
const confirmF = (label, onEnter) => ({
  label, kind: 'confirm', editable: false, computable: false, onEnter,
});

// ── the worksheet registry ───────────────────────────────────────────────────
export function getWorksheet(id, calc) {
  const d = calc.data;
  switch (id) {
    // Cash-flow entry (CF key)
    case 'CF':
      return {
        id, title: 'CF',
        fields() {
          const cf = d.cf;
          const arr = [numF('CF0', () => cf.cf0, (v) => { cf.cf0 = v; })];
          cf.groups.forEach((g, i) => {
            arr.push(numF('C' + pad2(i + 1), () => g.amount, (v) => { g.amount = v; }));
            arr.push(numF('F' + pad2(i + 1), () => g.count,
              (v) => { g.count = Math.max(1, Math.round(v)); }));
          });
          const n = cf.groups.length;
          arr.push(numF('C' + pad2(n + 1), () => 0, (v) => {
            if (v !== 0) cf.groups.push({ amount: v, count: 1 });
          }));
          return arr;
        },
      };

    // NPV (NPV key): discount rate then NPV/NFV outputs, over the CF data
    case 'NPV':
      return {
        id, title: 'NPV',
        fields() {
          const flows = flatten(d.cf.cf0, d.cf.groups);
          return [
            numF('I', () => d.cf.rate, (v) => { d.cf.rate = v; }),
            outF('NPV', () => d.cf.npv, () => (d.cf.npv = npv(d.cf.rate, flows))),
            outF('NFV', () => d.cf.nfv, () => (d.cf.nfv = nfv(d.cf.rate, flows))),
          ];
        },
      };

    // IRR (IRR key)
    case 'IRR':
      return {
        id, title: 'IRR',
        fields() {
          const flows = flatten(d.cf.cf0, d.cf.groups);
          return [outF('IRR', () => d.cf.irr, () => (d.cf.irr = irr(flows)))];
        },
      };

    // Amortization (2nd AMORT) — reads the live TVM registers
    case 'AMORT':
      return {
        id, title: 'AMORT',
        fields() {
          const a = d.amort;
          const run = () => {
            const loan = Math.abs(calc.tvm.PV);
            const pmt = Math.abs(calc.tvm.PMT);
            const periods = Math.round(calc.tvm.N);
            const r = amortRange({
              loan, pmt, iy: calc.tvm.IY, py: calc.py, cy: calc.cy,
              p1: Math.round(a.p1), p2: Math.round(a.p2), periods,
            });
            const sign = calc.tvm.PMT < 0 ? -1 : 1;
            a.bal = r.balance * (calc.tvm.PV < 0 ? -1 : 1);
            a.prn = r.principal * sign;
            a.int = r.interest * sign;
          };
          return [
            numF('P1', () => a.p1, (v) => { a.p1 = Math.round(v); }),
            numF('P2', () => a.p2, (v) => { a.p2 = Math.round(v); }),
            outF('BAL', () => a.bal, () => { run(); return a.bal; }),
            outF('PRN', () => a.prn, () => { run(); return a.prn; }),
            outF('INT', () => a.int, () => { run(); return a.int; }),
          ];
        },
      };

    // Bond (2nd BOND) — full date fidelity
    case 'BOND':
      return {
        id, title: 'BOND',
        fields() {
          const b = d.bond;
          const args = () => ({
            settlement: b.sdt, redemption: b.rdt, couponRate: b.cpn,
            redemptionValue: b.rv, freq: b.freq === '1/Y' ? 1 : 2, method: b.method,
          });
          return [
            dateF('SDT', () => b.sdt, (v) => { b.sdt = v; }),
            numF('CPN', () => b.cpn, (v) => { b.cpn = v; }),
            dateF('RDT', () => b.rdt, (v) => { b.rdt = v; }),
            numF('RV', () => b.rv, (v) => { b.rv = v; }),
            setF('DCM', ['ACT', '360'], () => b.method, (v) => { b.method = v; }),
            setF('CF', ['2/Y', '1/Y'], () => b.freq, (v) => { b.freq = v; }),
            numF('YLD', () => b.yld, (v) => { b.yld = v; },
              { compute: () => (b.yld = bondYieldDated({ ...args(), price: b.pri })) }),
            numF('PRI', () => b.pri, (v) => { b.pri = v; },
              { compute: () => (b.pri = bondPriceDated({ ...args(), yieldRate: b.yld }).price) }),
            outF('AI', () => b.ai, () => (b.ai = accruedInterest(args()))),
          ];
        },
      };

    // Depreciation (2nd DEPR)
    case 'DEPR':
      return {
        id, title: 'DEPR',
        fields() {
          const p = d.depr;
          const argsFor = () => ({
            method: p.method, cost: p.cst, salvage: p.sal, life: p.lif,
            factor: p.factor, m01: p.m01,
          });
          const arr = [
            setF('MTH', ['SL', 'SYD', 'DB', 'DBX', 'SLF'], () => p.method, (v) => { p.method = v; }),
            numF('LIF', () => p.lif, (v) => { p.lif = v; }),
            numF('M01', () => p.m01, (v) => { p.m01 = v; }),
          ];
          if (p.method === 'DB' || p.method === 'DBX') {
            arr.push(numF('DB', () => p.factor, (v) => { p.factor = v; }));
          }
          arr.push(
            numF('CST', () => p.cst, (v) => { p.cst = v; }),
            numF('SAL', () => p.sal, (v) => { p.sal = v; }),
            numF('YR', () => p.yr, (v) => { p.yr = Math.round(v); }),
            outF('DEP', () => p.dep, () => (p.dep = depreciationYear(argsFor(), Math.round(p.yr)).depreciation)),
            outF('RBV', () => p.rbv, () => (p.rbv = depreciationYear(argsFor(), Math.round(p.yr)).rbv)),
            outF('RDV', () => p.rdv, () => (p.rdv = depreciationYear(argsFor(), Math.round(p.yr)).rdv)),
          );
          return arr;
        },
      };

    // Interest conversion (2nd ICONV)
    case 'ICONV':
      return {
        id, title: 'ICONV',
        fields() {
          const c = d.iconv;
          return [
            numF('NOM', () => c.nom, (v) => { c.nom = v; },
              { compute: () => (c.nom = effToNom(c.eff, c.cy)) }),
            numF('EFF', () => c.eff, (v) => { c.eff = v; },
              { compute: () => (c.eff = nomToEff(c.nom, c.cy)) }),
            numF('C/Y', () => c.cy, (v) => { c.cy = Math.max(1, Math.round(v)); }),
          ];
        },
      };

    // Breakeven (2nd BRKEVN)
    case 'BRKEVN':
      return {
        id, title: 'BRKEVN',
        fields() {
          const b = d.brkevn;
          const solve = (k) => numF(k, () => b[k], (v) => { b[k] = v; },
            { compute: () => (b[k] = breakeven[k](b)) });
          return [solve('FC'), solve('VC'), solve('P'), solve('PFT'), solve('Q')];
        },
      };

    // Profit margin (2nd PROFIT)
    case 'PROFIT':
      return {
        id, title: 'PROFIT',
        fields() {
          const p = d.profit;
          const solve = (k) => numF(k, () => p[k], (v) => { p[k] = v; },
            { compute: () => (p[k] = profit[k](p)) });
          return [solve('CST'), solve('SEL'), solve('MAR')];
        },
      };

    // Percent change / compound interest (2nd Δ%)
    case 'DELTA':
      return {
        id, title: 'Δ%',
        fields() {
          const p = d.delta;
          const solve = (k, label) => numF(label, () => p[k], (v) => { p[k] = v; },
            { compute: () => (p[k] = deltaPct[k](p)) });
          return [solve('OLD', 'OLD'), solve('NEW', 'NEW'), solve('CH', '%CH'), solve('PD', '#PD')];
        },
      };

    // Date (2nd DATE)
    case 'DATE':
      return {
        id, title: 'DATE',
        fields() {
          const dt = d.date;
          return [
            dateF('DT1', () => dt.dt1, (v) => { dt.dt1 = v; }),
            dateF('DT2', () => dt.dt2, (v) => { dt.dt2 = v; },
              { compute: () => (dt.dt2 = addDays(dt.dt1, Math.round(dt.dbd))) }),
            numF('DBD', () => dt.dbd, (v) => { dt.dbd = v; },
              { compute: () => (dt.dbd = daysBetween(dt.dt1, dt.dt2, dt.method)) }),
            setF('DCM', ['ACT', '360'], () => dt.method, (v) => { dt.method = v; }),
          ];
        },
      };

    // Statistics data entry (2nd DATA)
    case 'DATA':
      return {
        id, title: 'DATA',
        fields() {
          const st = d.stat;
          const arr = [];
          st.points.forEach((pt, i) => {
            arr.push(numF('X' + pad2(i + 1), () => pt.x, (v) => { pt.x = v; }));
            arr.push(numF('Y' + pad2(i + 1), () => pt.y, (v) => { pt.y = v; }));
          });
          const n = st.points.length;
          arr.push(numF('X' + pad2(n + 1), () => 0, (v) => {
            st.points.push({ x: v, y: 1 });
          }));
          return arr;
        },
      };

    // Statistics results (2nd STAT)
    case 'STAT':
      return {
        id, title: 'STAT',
        fields() {
          const st = d.stat;
          const model = st.model;
          const modelField = setF('MOD', ['1-V', 'LIN', 'Ln', 'EXP', 'PWR'],
            () => st.model, (v) => { st.model = v; });
          if (model === '1-V') {
            const s = oneVarStats(st.points.map((p) => ({ x: p.x, freq: p.y })));
            return [
              modelField,
              outF('n', () => s.n, () => s.n),
              outF('x̄', () => s.mean, () => s.mean),
              outF('Sx', () => s.sampleStdDev, () => s.sampleStdDev),
              outF('σx', () => s.popStdDev, () => s.popStdDev),
              outF('ΣX', () => s.sumX, () => s.sumX),
              outF('ΣX²', () => s.sumX2, () => s.sumX2),
            ];
          }
          const s = twoVarStats(st.points, model);
          return [
            modelField,
            outF('n', () => s.n, () => s.n),
            outF('x̄', () => s.meanX, () => s.meanX),
            outF('Sx', () => s.sampleStdDevX, () => s.sampleStdDevX),
            outF('σx', () => s.popStdDevX, () => s.popStdDevX),
            outF('ȳ', () => s.meanY, () => s.meanY),
            outF('Sy', () => s.sampleStdDevY, () => s.sampleStdDevY),
            outF('σy', () => s.popStdDevY, () => s.popStdDevY),
            outF('ΣX', () => s.sumX, () => s.sumX),
            outF('ΣX²', () => s.sumX2, () => s.sumX2),
            outF('ΣY', () => s.sumY, () => s.sumY),
            outF('ΣY²', () => s.sumY2, () => s.sumY2),
            outF('ΣXY', () => s.sumXY, () => s.sumXY),
            outF('a', () => s.a, () => s.a),
            outF('b', () => s.b, () => s.b),
            outF('r', () => s.r, () => s.r),
            numF("X'", () => st.xp, (v) => { st.xp = v; }),
            outF("Y'", () => st.yp, () => (st.yp = s.predictY(st.xp))),
          ];
        },
      };

    // ── settings worksheets ──────────────────────────────────────────────────
    case 'FORMAT':
      return {
        id, title: 'FORMAT',
        fields() {
          return [
            numF('DEC', () => calc.decimals, (v) => calc.setDecimals(v)),
            setF('MTH', ['Chn', 'AOS'], () => calc.calcMode, (v) => { calc.calcMode = v; }),
            setF('ANG', ['DEG', 'RAD'], () => calc.angleMode, (v) => { calc.angleMode = v; }),
          ];
        },
      };

    case 'PY':
      return {
        id, title: 'P/Y',
        fields() {
          return [
            numF('P/Y', () => calc.py, (v) => calc.setPY(v)),
            numF('C/Y', () => calc.cy, (v) => calc.setCY(v)),
          ];
        },
      };

    case 'BGN':
      return {
        id, title: 'BGN',
        fields() {
          return [setF('MODE', ['END', 'BGN'], () => (calc.begin ? 'BGN' : 'END'),
            (v) => calc.setBegin(v === 'BGN'))];
        },
      };

    case 'MEM':
      return {
        id, title: 'MEM',
        fields() {
          return calc.mem.map((_, i) =>
            numF('M' + i, () => calc.mem[i], (v) => { calc.mem[i] = v; }));
        },
      };

    // Reset-all confirmation (2ND RESET): shows "RST ?", ENTER confirms.
    case 'RESET':
      return {
        id, title: 'RST',
        fields() { return [confirmF('RST', () => calc.reset())]; },
      };

    default:
      return null;
  }
}

/** Fresh default data for all worksheets (used by reset and CLR WORK). */
export function defaultData() {
  return {
    cf: { cf0: 0, groups: [], rate: 0, npv: 0, nfv: 0, irr: 0 },
    amort: { p1: 1, p2: 1, bal: 0, prn: 0, int: 0 },
    bond: {
      sdt: { m: 1, d: 1, y: 2020 }, cpn: 0, rdt: { m: 1, d: 1, y: 2030 },
      rv: 100, method: 'ACT', freq: '2/Y', yld: 0, pri: 0, ai: 0,
    },
    depr: {
      method: 'SL', lif: 1, m01: 1, factor: 200, cst: 0, sal: 0, yr: 1,
      dep: 0, rbv: 0, rdv: 0,
    },
    iconv: { nom: 0, eff: 0, cy: 1 },
    brkevn: { FC: 0, VC: 0, P: 0, PFT: 0, Q: 0 },
    profit: { CST: 0, SEL: 0, MAR: 0 },
    delta: { OLD: 0, NEW: 0, CH: 0, PD: 0 },
    date: { dt1: { m: 1, d: 1, y: 2020 }, dt2: { m: 1, d: 1, y: 2020 }, dbd: 0, method: 'ACT' },
    stat: { points: [], model: '1-V', xp: 0, yp: 0 },
  };
}

/** Which data key a worksheet's CLR WORK resets (null = don't reset settings). */
export const WORKSHEET_DATA_KEY = {
  CF: 'cf', NPV: 'cf', IRR: 'cf', AMORT: 'amort', BOND: 'bond', DEPR: 'depr',
  ICONV: 'iconv', BRKEVN: 'brkevn', PROFIT: 'profit', DELTA: 'delta', DATE: 'date',
  DATA: 'stat', STAT: 'stat',
};
