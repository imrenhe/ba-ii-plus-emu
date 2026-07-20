// main.js — bootstrap: build the UI, wire key presses through the controller,
// route 2ND-functions to worksheets/settings, and support keyboard input.

import { Calculator } from './state.js';
import { createDisplay } from './display.js';
import { renderKeypad, keyEventToCode } from './keypad.js';
import {
  openCashFlow, openAmort, openBond, openDepreciation, openStatistics, closeOverlay,
} from './worksheets.js';

const calc = new Calculator();

createDisplay(document.getElementById('display'), calc);
renderKeypad(document.getElementById('keypad'), handlePress);

// Simple prompt-based setting entry (P/Y, C/Y, decimals) keeps the keypad clean
// while remaining faithful to the worksheet the 2ND-function opens.
function promptNumber(message, current) {
  const raw = window.prompt(message, String(current));
  if (raw === null) return null;
  const v = parseFloat(raw);
  return Number.isNaN(v) ? null : v;
}

function handlePress(code) {
  const second = calc.second;

  // 2ND-function routing first — these consume the 2ND prefix.
  if (second) {
    calc.clearSecond();
    if (routeSecond(code)) return;
    // fall through if the key has no 2ND-function
  }

  switch (code) {
    // control
    case '2nd': calc.toggleSecond(); return;
    case 'cpt': calc.compute(); return;
    case 'onc': calc.clearEntry(); return;
    case 'up': case 'down': return; // reserved for worksheet navigation

    // TVM
    case 'N': calc.tvmKey('N'); return;
    case 'IY': calc.tvmKey('IY'); return;
    case 'PV': calc.tvmKey('PV'); return;
    case 'PMT': calc.tvmKey('PMT'); return;
    case 'FV': calc.tvmKey('FV'); return;

    // worksheets
    case 'CF': case 'NPV': case 'IRR': openCashFlow(); return;
    case 'enter': return;
    case 'del': calc.backspace(); return;

    // memory
    case 'sto': calc.arm('store'); return;
    case 'rcl': calc.arm('recall'); return;

    // operators / functions
    case 'div': calc.setOperator('/'); return;
    case 'mul': calc.setOperator('*'); return;
    case 'sub': calc.setOperator('-'); return;
    case 'add': calc.setOperator('+'); return;
    case 'eq': calc.equals(); return;
    case 'pct': calc.percent(); return;
    case 'sqrt': calc.unary('sqrt'); return;
    case 'inv': calc.unary('inv'); return;
    case 'ln': calc.unary('ln'); return;
    case 'pow': calc.setOperator('^pow'); return; // handled below via custom op
    case 'neg': calc.negate(); return;
    case 'bksp': calc.backspace(); return;

    // digits + dot
    case 'dot': calc.inputDigit('.'); return;
    default:
      if (code >= '0' && code <= '9') {
        // STO/RCL capture digits when armed.
        if (calc.storeArmed || calc.recallArmed) {
          calc.memoryDigit(Number(code));
        } else {
          calc.inputDigit(code);
        }
      }
  }
}

// Returns true if the 2ND-function was handled.
function routeSecond(code) {
  switch (code) {
    case 'PV': openAmort(calc); return true;             // AMORT
    case '9': openBond(); return true;                    // BOND
    case '6': openDepreciation(); return true;            // DEPR
    case '8': openStatistics(); return true;              // STAT
    case '7': openStatistics(); return true;              // DATA → stats entry
    case 'PMT': calc.toggleBegin(); return true;          // BGN/END
    case 'FV': calc.clearTVM(); return true;              // CLR TVM
    case 'IY': {                                          // P/Y (and C/Y)
      const py = promptNumber('Payments per year (P/Y):', calc.py);
      if (py !== null) calc.setPY(py);
      const cy = promptNumber('Compoundings per year (C/Y):', calc.cy);
      if (cy !== null) calc.setCY(cy);
      return true;
    }
    case 'N': {                                           // xP/Y → N = years × P/Y
      calc.commitEntry();
      calc.tvm.N = calc.currentValue() * calc.py;
      calc.x = calc.tvm.N;
      calc.label = 'N';
      calc.emit();
      return true;
    }
    case 'dot': {                                         // FORMAT (decimals)
      const dp = promptNumber('Decimal places (0–9):', calc.decimals);
      if (dp !== null) calc.setDecimals(dp);
      return true;
    }
    case 'sqrt': calc.unary('square'); return true;       // x²
    case 'ln': calc.unary('exp'); return true;            // eˣ
    case 'onc': calc.reset(); return true;                // RESET
    default: return false;
  }
}

// yˣ needs a second operand, so implement it as a pending binary op.
const origApplyOp = calc.applyOp.bind(calc);
calc.applyOp = (a, b, op) => (op === '^pow' ? Math.pow(a, b) : origApplyOp(a, b, op));

// ── keyboard support ──────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return; // let worksheet fields type
  if (e.key === 'Escape') {
    closeOverlay();
  }
  const code = keyEventToCode(e);
  if (code) {
    e.preventDefault();
    handlePress(code);
    flashKey(code);
  }
});

function flashKey(code) {
  const btn = document.querySelector(`.key[data-code="${code}"]`);
  if (btn) {
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 90);
  }
}

// Expose for quick manual debugging in the console.
window.__calc = calc;
