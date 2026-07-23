import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../src/state.js';
import { formatEntry } from '../src/format.js';

const near = (a, b, eps = 1e-2) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);
const type = (c, s) => { for (const ch of String(s)) c.inputDigit(ch); };
const enter = (c, s) => { type(c, s); c.wsEnter(); };

// ── AOS vs Chn + parentheses ─────────────────────────────────────────────────
test('AOS respects order of operations: 2 + 3 × 4 = 14', () => {
  const c = new Calculator();
  c.calcMode = 'AOS';
  type(c, '2'); c.setOperator('+'); type(c, '3'); c.setOperator('*'); type(c, '4'); c.equals();
  assert.equal(c.x, 14);
});

test('Chn is strictly left-to-right: 2 + 3 × 4 = 20', () => {
  const c = new Calculator(); // Chn default
  type(c, '2'); c.setOperator('+'); type(c, '3'); c.setOperator('*'); type(c, '4'); c.equals();
  assert.equal(c.x, 20);
});

test('parentheses override precedence: (2 + 3) × 4 = 20 in AOS', () => {
  const c = new Calculator();
  c.calcMode = 'AOS';
  c.openParen(); type(c, '2'); c.setOperator('+'); type(c, '3'); c.closeParen();
  c.setOperator('*'); type(c, '4'); c.equals();
  assert.equal(c.x, 20);
});

test('nested expression in AOS: 10 × (2 + 3) − 4 = 46', () => {
  const c = new Calculator();
  c.calcMode = 'AOS';
  type(c, '10'); c.setOperator('*');
  c.openParen(); type(c, '2'); c.setOperator('+'); type(c, '3'); c.closeParen();
  c.setOperator('-'); type(c, '4'); c.equals();
  assert.equal(c.x, 46);
});

test('repeated "=" reapplies the last operation', () => {
  const c = new Calculator();
  type(c, '5'); c.setOperator('+'); type(c, '3'); c.equals(); // 8
  assert.equal(c.x, 8);
  c.equals(); // 11
  assert.equal(c.x, 11);
  c.equals(); // 14
  assert.equal(c.x, 14);
});

// ── percent semantics (device-style) ─────────────────────────────────────────
test('% with × / ÷ is a plain ÷100; with + / − it is percent-of-operand', () => {
  const mul = new Calculator();
  type(mul, '200'); mul.setOperator('*'); type(mul, '5'); mul.percent(); mul.equals();
  assert.equal(mul.x, 10);            // 200 × 5% = 10

  const div = new Calculator();
  type(div, '80'); div.setOperator('/'); type(div, '5'); div.percent(); div.equals();
  assert.equal(div.x, 1600);          // 80 ÷ 5% = 80 / 0.05

  const add = new Calculator();
  type(add, '200'); add.setOperator('+'); type(add, '5'); add.percent(); add.equals();
  assert.equal(add.x, 210);           // 200 + 5% = 210

  const bare = new Calculator();
  type(bare, '50'); bare.percent();
  assert.equal(bare.x, 0.5);
});

// ── dangling operator repeats the operand instead of erroring ─────────────────
test('operator then "=" repeats the operand (5 + = → 10)', () => {
  const c = new Calculator();
  type(c, '5'); c.setOperator('+'); c.equals();
  assert.equal(c.x, 10);
  const m = new Calculator();
  type(m, '7'); m.setOperator('*'); m.equals();
  assert.equal(m.x, 49);
});

test('close-paren with a dangling operator repeats: (2 + ) = 4', () => {
  const c = new Calculator();
  c.openParen(); type(c, '2'); c.setOperator('+'); c.closeParen(); c.equals();
  assert.equal(c.x, 4);
});

// ── error state blocks further operations until cleared ──────────────────────
test('operations are ignored while an error is shown', () => {
  const c = new Calculator();
  type(c, '5'); c.setOperator('/'); type(c, '0'); c.equals(); // Error 1
  assert.equal(c.getDisplay().value, 'Error 1');
  c.setOperator('+');            // ignored — still error
  assert.equal(c.getDisplay().value, 'Error 1');
  c.unary('sqrt');              // ignored
  assert.equal(c.getDisplay().value, 'Error 1');
  type(c, '9');                 // a digit clears the error and starts fresh
  assert.equal(c.getDisplay().value, '9');
});

// ── worksheet: negate a stored field, and STO/RCL ────────────────────────────
test('+/− negates a stored worksheet field value', () => {
  const c = new Calculator();
  c.openWorksheet('CF');
  type(c, '100'); c.wsEnter(); // CF0 = 100 (stored, no active entry)
  c.negate();
  assert.equal(c.data.cf.cf0, -100);
});

test('RCL inside a worksheet recalls into the entry so ENTER stores it', () => {
  const c = new Calculator();
  c.mem[3] = 42;
  c.openWorksheet('CF');
  c.wsNext();              // C01 slot
  c.arm('recall'); c.memoryDigit(3);
  assert.equal(c.getDisplay().value, '42');
  c.wsEnter();
  assert.equal(c.data.cf.groups[0].amount, 42);
});

// ── thousands separators during entry ────────────────────────────────────────
test('formatEntry groups the integer part while typing', () => {
  assert.equal(formatEntry('1234567'), '1,234,567');
  assert.equal(formatEntry('1234.5'), '1,234.5');
  assert.equal(formatEntry('-1000'), '-1,000');
  assert.equal(formatEntry('0.'), '0.');
});

test('display shows grouped entry', () => {
  const c = new Calculator();
  type(c, '1234567');
  assert.equal(c.getDisplay().value, '1,234,567');
});

// ── RESET confirmation worksheet ─────────────────────────────────────────────
test('RESET worksheet: ENTER confirms and restores defaults', () => {
  const c = new Calculator();
  c.setDecimals(2);
  c.calcMode = 'AOS';
  type(c, '99'); c.tvmKey('N');
  c.openWorksheet('RESET');
  assert.equal(c.getDisplay().value, '?'); // "RST ?"
  c.wsEnter(); // confirm
  assert.equal(c.ws, null);
  assert.equal(c.decimals, 4);
  assert.equal(c.calcMode, 'Chn');
  assert.equal(c.tvm.N, 0);
});

// ── AMORT: values auto-compute on display; P1/P2 stay put ─────────────────────
test('AMORT BAL/PRN/INT auto-compute when arrowed to (no CPT)', () => {
  const c = new Calculator();
  c.setPY(12); c.setCY(12);
  c.tvm = { N: 360, IY: 6, PV: 100000, PMT: -599.55, FV: 0 };
  c.openWorksheet('AMORT'); // P1=1, P2=1 defaults
  c.wsNext(); c.wsNext();   // → BAL (no CPT pressed)
  assert.equal(c.currentField().label, 'BAL');
  near(c.currentField().get(), 99900.45);
  c.wsNext(); near(c.currentField().get(), -99.55);  // PRN
  c.wsNext(); near(c.currentField().get(), -500);    // INT
});

test('AMORT does not auto-advance P1/P2 when scrolling past INT', () => {
  const c = new Calculator();
  c.setPY(12); c.setCY(12);
  c.tvm = { N: 360, IY: 6, PV: 100000, PMT: -599.55, FV: 0 };
  c.openWorksheet('AMORT');
  enter(c, '1');              // P1 = 1
  c.wsNext(); enter(c, '1');  // P2 = 1
  c.wsNext(); c.wsNext(); c.wsNext(); // BAL, PRN, INT
  c.wsNext();                 // past INT → wraps to P1
  assert.equal(c.data.amort.p1, 1);
  assert.equal(c.data.amort.p2, 1);
});

// ── setting fields show their value directly (bond day-count label) ──────────
test('bond day-count setting shows its value directly (no label)', () => {
  const c = new Calculator();
  c.openWorksheet('BOND');
  c.wsIndex = 4; // DCM setting field
  const d = c.getDisplay();
  assert.equal(d.label, '');
  assert.equal(d.value, 'ACT');
});

// ── 2-var STAT exposes the sum fields ────────────────────────────────────────
test('2-var STAT includes ΣX, ΣXY, ... sum fields', () => {
  const c = new Calculator();
  c.data.stat.points = [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }];
  c.data.stat.model = 'LIN';
  c.openWorksheet('STAT');
  const labels = c.ws.fields().map((f) => f.label);
  for (const l of ['ΣX', 'ΣX²', 'ΣY', 'ΣY²', 'ΣXY']) assert.ok(labels.includes(l), `missing ${l}`);
});
