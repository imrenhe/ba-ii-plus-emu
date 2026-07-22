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

// ── AMORT auto-roll ──────────────────────────────────────────────────────────
test('AMORT rolls to the next payment range when scrolling past INT', () => {
  const c = new Calculator();
  c.setPY(12); c.setCY(12);
  c.tvm = { N: 360, IY: 6, PV: 100000, PMT: -599.55, FV: 0 };
  c.openWorksheet('AMORT');
  enter(c, '1');          // P1 = 1
  c.wsNext(); enter(c, '12'); // P2 = 12
  c.wsNext(); c.wsNext(); c.wsNext(); // BAL, PRN, INT (now at last field)
  c.wsNext();             // roll past INT
  assert.equal(c.data.amort.p1, 13);
  assert.equal(c.data.amort.p2, 24);
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
