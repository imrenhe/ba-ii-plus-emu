import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../src/state.js';

const type = (calc, s) => {
  for (const ch of String(s)) calc.inputDigit(ch);
};

test('basic arithmetic: 12 + 8 = 20', () => {
  const c = new Calculator();
  type(c, '12');
  c.setOperator('+');
  type(c, '8');
  c.equals();
  assert.equal(c.x, 20);
});

test('chained arithmetic: 2 + 3 × 4 evaluates left-to-right like the device', () => {
  const c = new Calculator();
  type(c, '2');
  c.setOperator('+');
  type(c, '3');
  c.setOperator('*'); // computes 2+3=5 first
  type(c, '4');
  c.equals();
  assert.equal(c.x, 20);
});

test('divide by zero raises Error 1 (overflow)', () => {
  const c = new Calculator();
  type(c, '5');
  c.setOperator('/');
  type(c, '0');
  c.equals();
  assert.equal(c.getDisplay().value, 'Error 1');
});

test('TVM with no sign change raises Error 5 (no solution)', () => {
  // PV=100, FV=200, I/Y=10, PMT=0 → compute N has no solution.
  const c = new Calculator();
  type(c, '100'); c.tvmKey('PV');
  type(c, '200'); c.tvmKey('FV');
  type(c, '10'); c.tvmKey('IY');
  type(c, '0'); c.tvmKey('PMT');
  c.compute(); c.tvmKey('N'); // CPT N
  assert.equal(c.getDisplay().value, 'Error 5');
  assert.equal(c.errorCode, 5);
});

test('domain error raises Error 2 (√ of a negative)', () => {
  const c = new Calculator();
  type(c, '4'); c.negate();
  c.unary('sqrt');
  assert.equal(c.getDisplay().value, 'Error 2');
});

test('memory: STO 1 then RCL 1 round-trips', () => {
  const c = new Calculator();
  type(c, '42');
  c.arm('store');
  c.memoryDigit(1);
  c.clearEntry();
  c.clearEntry();
  c.arm('recall');
  c.memoryDigit(1);
  assert.equal(c.x, 42);
});

test('TVM key flow: enter N/I/Y/PV/PMT then CPT FV', () => {
  const c = new Calculator();
  c.setPY(1);
  c.setCY(1);
  type(c, '10');
  c.tvmKey('N');
  type(c, '5');
  c.tvmKey('IY');
  type(c, '1000');
  c.negate();
  c.tvmKey('PV');
  c.tvmKey('PMT'); // PMT = 0 (display currently -1000? re-enter)
  type(c, '0');
  c.tvmKey('PMT');
  c.compute();
  c.tvmKey('FV');
  assert.ok(Math.abs(c.x - 1628.89) < 0.01, `FV was ${c.x}`);
  assert.equal(c.getDisplay().label, 'FV');
});

test('CE|C clears a freshly-typed number to 0', () => {
  const c = new Calculator();
  type(c, '789');
  assert.equal(c.getDisplay().value, '789');
  c.clearEntry();
  assert.equal(c.x, 0);
  assert.equal(c.getDisplay().value, '0.0000');
});

test('CE|C clears the current operand but keeps the pending calculation', () => {
  const c = new Calculator();
  type(c, '100'); c.setOperator('+'); type(c, '789');
  c.clearEntry();                 // clears 789 → 0, keeps "100 +"
  assert.equal(c.getDisplay().value, '0.0000');
  type(c, '50'); c.equals();
  assert.equal(c.x, 150);
});

test('ON/OFF: single press sleeps, wake() restores', () => {
  const c = new Calculator();
  assert.equal(c.powerOff, false);
  c.powerButton();
  assert.equal(c.powerOff, true);
  assert.equal(c.wake(), true);   // consumed the wake press
  assert.equal(c.powerOff, false);
  assert.equal(c.wake(), false);  // nothing to wake
});

test('ON/OFF easter egg: 7 rapid presses cycle the LCD theme', () => {
  const c = new Calculator();
  assert.equal(c.lcdTheme, 'green');
  for (let i = 0; i < 7; i++) c.powerButton(); // fast, within the 600ms window
  assert.equal(c.themeIndex, 1);
  assert.equal(c.lcdTheme, 'amber');
  assert.equal(c.powerOff, false); // forced on so the new theme is visible
});

test('negate toggles sign of the entry', () => {
  const c = new Calculator();
  type(c, '100');
  c.negate();
  assert.equal(c.currentValue(), -100);
  c.negate();
  assert.equal(c.currentValue(), 100);
});

test('percent converts a plain entry to its decimal form', () => {
  const c = new Calculator();
  type(c, '50');
  c.percent();
  assert.equal(c.x, 0.5);
});
