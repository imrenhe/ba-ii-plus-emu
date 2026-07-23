import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../src/state.js';

const near = (a, b, eps = 1e-2) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);

// Type a number string into the current context (digits, '.', leading '-').
function typeNum(c, s) {
  const neg = String(s).startsWith('-');
  for (const ch of String(neg ? s.slice(1) : s)) c.inputDigit(ch);
  if (neg) c.negate();
}
// Enter a value into the current worksheet field.
function enter(c, s) { typeNum(c, s); c.wsEnter(); }

test('CF entry → NPV and IRR via the prompt flow', () => {
  const c = new Calculator();
  c.openWorksheet('CF');
  enter(c, '-1000');            // CF0
  c.wsNext(); enter(c, '500');  // C01 (add slot creates group)
  c.wsNext(); c.wsNext(); enter(c, '400'); // → F01 → C02
  c.wsNext(); c.wsNext(); enter(c, '300');
  c.wsNext(); c.wsNext(); enter(c, '200');
  assert.deepEqual(c.data.cf.groups.map((g) => g.amount), [500, 400, 300, 200]);

  c.openWorksheet('NPV');
  enter(c, '10');               // I = 10%
  c.wsNext();                   // NPV field
  c.wsCompute();
  near(c.data.cf.npv, 147.12);

  c.openWorksheet('IRR');
  c.wsCompute();
  near(c.data.cf.irr, 17.805, 1e-2);
});

test('CF: entering a zero cash flow (C01=0) still exposes F01', () => {
  const c = new Calculator();
  c.openWorksheet('CF');
  enter(c, '-100');            // CF0
  c.wsNext(); enter(c, '0');   // C01 = 0 → must create the group
  assert.equal(c.data.cf.groups.length, 1);
  assert.equal(c.data.cf.groups[0].amount, 0);
  c.wsNext();                  // ↓ should reach F01
  assert.equal(c.currentField().label, 'F01');
  enter(c, '3');               // F01 = 3
  assert.equal(c.data.cf.groups[0].count, 3);
});

test('CF frequency groups: -5000 then 1000 ×7 gives IRR ≈ 9.196%', () => {
  const c = new Calculator();
  c.openWorksheet('CF');
  enter(c, '-5000');
  c.wsNext(); enter(c, '1000'); // C01
  c.wsNext(); enter(c, '7');    // F01 = 7
  c.openWorksheet('IRR');
  c.wsCompute();
  near(c.data.cf.irr, 9.196, 1e-2);
});

test('FORMAT worksheet sets decimal places', () => {
  const c = new Calculator();
  c.openWorksheet('FORMAT');
  enter(c, '4'); // DEC = 4
  assert.equal(c.decimals, 4);
});

test('P/Y worksheet sets payments and compoundings per year', () => {
  const c = new Calculator();
  c.openWorksheet('PY');
  enter(c, '12');          // P/Y
  c.wsNext(); enter(c, '4'); // C/Y
  assert.equal(c.py, 12);
  assert.equal(c.cy, 4);
});

test('AMORT reads TVM registers and totals a payment range', () => {
  const c = new Calculator();
  c.setPY(12); c.setCY(12);
  c.tvm = { N: 360, IY: 6, PV: 100000, PMT: -599.55, FV: 0 };
  c.openWorksheet('AMORT');
  enter(c, '1');            // P1
  c.wsNext(); enter(c, '12'); // P2
  c.wsNext(); c.wsCompute();  // BAL
  c.wsNext(); c.wsCompute();  // PRN
  c.wsNext(); c.wsCompute();  // INT
  const a = c.data.amort;
  assert.ok(a.bal > 98000 && a.bal < 100000, `bal ${a.bal}`);
  near(a.prn + a.int, -12 * 599.55, 1e-2); // payments are negative
});

test('BOND worksheet: dates via device format, compute price', () => {
  const c = new Calculator();
  c.openWorksheet('BOND');
  enter(c, '1.012020');    // SDT = 01-01-2020
  c.wsNext(); enter(c, '8'); // CPN
  c.wsNext(); enter(c, '1.012030'); // RDT
  // RV(100), DCM, CF settings left default; jump to YLD
  c.wsNext(); c.wsNext(); c.wsNext(); c.wsNext(); enter(c, '6'); // YLD
  c.wsNext(); c.wsCompute(); // PRI
  near(c.data.bond.pri, 114.88, 1e-2);
  assert.deepEqual(c.data.bond.sdt, { m: 1, d: 1, y: 2020 });
});

test('DATA + STAT worksheets: one-variable mean and std dev', () => {
  const c = new Calculator();
  c.openWorksheet('DATA');
  // enter values with default frequency 1 (skip the Y fields)
  for (const v of [2, 4, 4, 4, 5, 5, 7, 9]) {
    // navigate to the trailing X add-slot each time
    const fields = c.ws.fields();
    c.wsIndex = fields.length - 1;
    enter(c, String(v));
  }
  assert.equal(c.data.stat.points.length, 8);
  c.openWorksheet('STAT'); // model 1-V default
  c.wsNext(); c.wsCompute(); // n
  c.wsNext(); c.wsCompute(); // mean
  const s = c.currentField();
  near(s.get(), 5, 1e-9);
});

test('BRKEVN solves the shown variable with CPT', () => {
  const c = new Calculator();
  c.openWorksheet('BRKEVN');
  enter(c, '1000');            // FC
  c.wsNext(); enter(c, '30');  // VC
  c.wsNext(); enter(c, '50');  // P
  c.wsNext(); c.wsNext(); enter(c, '100'); // → PFT → Q
  c.wsPrev();                  // back to PFT
  c.wsCompute();
  near(c.data.brkevn.PFT, 1000, 1e-6);
});

test('ENTER indicator lights only on fields stored with ENTER', () => {
  const c = new Calculator();
  assert.equal(c.flags().enter, false); // standard mode
  c.openWorksheet('CF');
  assert.equal(c.flags().enter, true);  // CF0 editable
  c.openWorksheet('NPV');
  c.wsNext();                            // NPV output field
  assert.equal(c.currentField().label, 'NPV');
  assert.equal(c.flags().enter, false);
  c.openWorksheet('BOND');
  c.wsIndex = 4;                         // day-count setting
  assert.equal(c.flags().enter, false);
  assert.equal(c.flags().set, true);
});

test('QUIT returns to the standard calculator', () => {
  const c = new Calculator();
  c.openWorksheet('CF');
  assert.ok(c.ws);
  c.quitWorksheet();
  assert.equal(c.ws, null);
  // arithmetic works again
  for (const ch of '7') c.inputDigit(ch);
  c.setOperator('+');
  for (const ch of '8') c.inputDigit(ch);
  c.equals();
  assert.equal(c.x, 15);
});
