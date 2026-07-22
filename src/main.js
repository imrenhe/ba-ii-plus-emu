// main.js — bootstrap and key dispatch. Builds the UI, routes each key press
// through the controller, handles the 2ND-function layer and worksheet
// navigation, and mirrors physical-keyboard input onto the keypad.

import { Calculator } from './state.js';
import { createDisplay } from './display.js';
import { renderKeypad, keyEventToCode } from './keypad.js';

const calc = new Calculator();
createDisplay(document.getElementById('display'), calc);
renderKeypad(document.getElementById('keypad'), handlePress);

function handlePress(code) {
  // While "off", ON/OFF handles power; any other key just wakes the screen.
  if (calc.powerOff) {
    if (code === 'onoff') calc.powerButton();
    else calc.wake();
    return;
  }
  if (calc.second) {
    calc.clearSecond();
    if (routeSecond(code)) return; // consumed by a 2ND-function
  }
  routePrimary(code);
}

// ── 2ND-function layer (the small labels printed above each key) ─────────────
function routeSecond(code) {
  switch (code) {
    case 'cpt': calc.quitWorksheet(); return true;                 // QUIT
    case 'enter': calc.wsSet(); return true;                       // SET
    case 'up': calc.wsDelete(); return true;                       // DEL
    case 'down': calc.wsNext(); return true;                       // INS (no-op insert → advance)
    case 'onc': calc.clearWork(); return true;                     // CLR WORK

    case 'N': calc.commitEntry(); calc.tvm.N = calc.currentValue() * calc.py; // xP/Y
      calc.x = calc.tvm.N; calc.entryStr = null; calc.label = 'N'; calc.emit(); return true;
    case 'IY': calc.openWorksheet('PY'); return true;              // P/Y
    case 'PV': calc.openWorksheet('AMORT'); return true;           // AMORT
    case 'PMT': calc.openWorksheet('BGN'); return true;            // BGN
    case 'FV': calc.clearTVM(); return true;                       // CLR TVM

    case 'pct': return true;                                       // K (constant) — reserved
    case 'div': calc.random(); return true;                        // RAND
    case 'INV': calc.toggleHyp(); return true;                     // HYP
    case 'lparen': calc.trigFn('sin'); return true;                // SIN
    case 'rparen': calc.trigFn('cos'); return true;                // COS
    case 'pow': calc.trigFn('tan'); return true;                   // TAN
    case 'mul': calc.unary('fact'); return true;                   // x!
    case 'ln': calc.unary('exp'); return true;                     // eˣ
    case '7': calc.openWorksheet('DATA'); return true;             // DATA
    case '8': calc.openWorksheet('STAT'); return true;             // STAT
    case '9': calc.openWorksheet('BOND'); return true;             // BOND
    case 'sub': calc.setOperator('nPr'); return true;              // nPr
    case 'sto': calc.unary('round'); return true;                  // ROUND
    case '4': calc.openWorksheet('DEPR'); return true;             // DEPR
    case '5': calc.openWorksheet('DELTA'); return true;            // Δ%
    case '6': calc.openWorksheet('BRKEVN'); return true;           // BRKEVN
    case 'add': calc.setOperator('nCr'); return true;              // nCr
    case '1': calc.openWorksheet('DATE'); return true;             // DATE
    case '2': calc.openWorksheet('ICONV'); return true;            // ICONV
    case '3': calc.openWorksheet('PROFIT'); return true;           // PROFIT
    case 'eq': calc.recallAnswer(); return true;                   // ANS
    case '0': calc.openWorksheet('MEM'); return true;              // MEM
    case 'dot': calc.openWorksheet('FORMAT'); return true;         // FORMAT
    case 'neg': calc.openWorksheet('RESET'); return true;          // RESET (confirm)
    default: return false;
  }
}

// ── primary key layer ────────────────────────────────────────────────────────
function routePrimary(code) {
  switch (code) {
    case '2nd': calc.toggleSecond(); return;
    case 'cpt': calc.compute(); return;
    case 'enter': calc.equals(); return;         // in a worksheet, equals() stores
    case 'up': calc.ws ? calc.wsPrev() : null; return;
    case 'down': calc.ws ? calc.wsNext() : null; return;
    case 'onoff': calc.powerButton(); return;
    case 'right': calc.backspace(); return;
    case 'onc':
      // CE|C: in a worksheet, clear a pending entry, else exit to the standard
      // calculator (like the device). In standard mode, clear as usual.
      if (calc.ws && calc.entryStr === null && !calc.error) calc.quitWorksheet();
      else calc.clearEntry();
      return;

    case 'CF': calc.openWorksheet('CF'); return;
    case 'NPV': calc.openWorksheet('NPV'); return;
    case 'IRR': calc.openWorksheet('IRR'); return;

    case 'N': calc.tvmKey('N'); return;
    case 'IY': calc.tvmKey('IY'); return;
    case 'PV': calc.tvmKey('PV'); return;
    case 'PMT': calc.tvmKey('PMT'); return;
    case 'FV': calc.tvmKey('FV'); return;

    case 'pct': calc.percent(); return;
    case 'sqrt': calc.unary('sqrt'); return;
    case 'square': calc.unary('square'); return;
    case 'inv': calc.unary('inv'); return;
    case 'div': calc.setOperator('/'); return;

    case 'INV': calc.toggleInverse(); return;
    case 'lparen': calc.openParen(); return;
    case 'rparen': calc.closeParen(); return;
    case 'pow': calc.setOperator('^pow'); return;
    case 'mul': calc.setOperator('*'); return;

    case 'ln': calc.unary('ln'); return;
    case 'sub': calc.setOperator('-'); return;
    case 'sto': calc.arm('store'); return;
    case 'add': calc.setOperator('+'); return;
    case 'rcl': calc.arm('recall'); return;
    case 'eq': calc.equals(); return;
    case 'neg': calc.negate(); return;

    case 'dot': digitOrMemory('.'); return;
    default:
      if (code >= '0' && code <= '9') digitOrMemory(code);
  }
}

function digitOrMemory(ch) {
  if ((calc.storeArmed || calc.recallArmed) && ch >= '0' && ch <= '9') {
    calc.memoryDigit(Number(ch));
  } else {
    calc.inputDigit(ch);
  }
}

// ── physical keyboard ────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  if (e.key === 'q') { calc.quitWorksheet(); return; }
  const code = keyEventToCode(e);
  if (code) {
    e.preventDefault();
    handlePress(code);
    flashKey(code);
  }
});

function flashKey(code) {
  const btn = document.querySelector(`.key[data-code="${code}"]`);
  if (btn) { btn.classList.add('pressed'); setTimeout(() => btn.classList.remove('pressed'), 90); }
}

window.__calc = calc;
