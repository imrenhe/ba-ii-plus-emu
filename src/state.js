// state.js — the calculator controller. Owns all mutable state and the key
// dispatch logic for arithmetic, memory, and the TVM worksheet. Pure-math lives
// in ./engine; UI rendering lives elsewhere and reads this state via getDisplay()
// and subscribes with onChange().

import { computeTVM } from './engine/tvm.js';
import { formatDisplay, parseEntry } from './format.js';

const TVM_KEYS = ['N', 'IY', 'PV', 'PMT', 'FV'];

export class Calculator {
  constructor() {
    this.listeners = [];
    this.reset();
  }

  reset() {
    this.x = 0; // value currently shown / "display register"
    this.entryStr = null; // string while typing; null → show formatted x
    this.acc = null; // arithmetic accumulator (left operand)
    this.pendingOp = null; // '+', '-', '*', '/'
    this.second = false; // 2ND prefix active
    this.computeArmed = false; // CPT pressed, awaiting a TVM key
    this.label = ''; // top-line label
    this.message = ''; // transient status (e.g. "BGN", "RAD")
    this.error = false;

    this.mem = Array(10).fill(0); // STO/RCL registers 0–9
    this.recallArmed = false;
    this.storeArmed = false;

    // TVM worksheet registers.
    this.tvm = { N: 0, IY: 0, PV: 0, PMT: 0, FV: 0 };
    this.py = 1; // payments per year (default: annual)
    this.cy = 1; // compoundings per year
    this.begin = false; // END mode default
    this.decimals = 2;

    this.emit();
  }

  // ── subscription ──────────────────────────────────────────────────────────
  onChange(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }
  emit() {
    for (const fn of this.listeners) fn(this);
  }

  // ── display ────────────────────────────────────────────────────────────────
  getDisplay() {
    if (this.error) return { label: this.label, value: 'Error', flags: this.flags() };
    const value =
      this.entryStr !== null ? this.entryStr : formatDisplay(this.x, this.decimals);
    return { label: this.label, value, flags: this.flags() };
  }

  flags() {
    return {
      second: this.second,
      begin: this.begin,
      compute: this.computeArmed,
      message: this.message,
    };
  }

  currentValue() {
    return this.entryStr !== null ? parseEntry(this.entryStr) : this.x;
  }

  // ── number entry ─────────────────────────────────────────────────────────
  inputDigit(d) {
    this.clearError();
    if (this.entryStr === null || this.entryStr === '0') {
      this.entryStr = d === '.' ? '0.' : d;
    } else if (d === '.') {
      if (!this.entryStr.includes('.')) this.entryStr += '.';
    } else {
      if (this.entryStr.replace(/[-.]/g, '').length < 12) this.entryStr += d;
    }
    this.x = parseEntry(this.entryStr);
    this.label = '';
    this.emit();
  }

  negate() {
    if (this.entryStr !== null) {
      this.entryStr = this.entryStr.startsWith('-')
        ? this.entryStr.slice(1)
        : '-' + this.entryStr;
      this.x = parseEntry(this.entryStr);
    } else {
      this.x = -this.x;
    }
    this.emit();
  }

  backspace() {
    if (this.entryStr === null) return;
    this.entryStr = this.entryStr.length > 1 ? this.entryStr.slice(0, -1) : null;
    this.x = this.entryStr === null ? 0 : parseEntry(this.entryStr);
    this.emit();
  }

  clearEntry() {
    // CE/C: first press clears entry, second clears pending arithmetic.
    if (this.entryStr !== null || this.x !== 0) {
      this.entryStr = null;
      this.x = 0;
      this.label = '';
    } else {
      this.acc = null;
      this.pendingOp = null;
    }
    this.clearError();
    this.emit();
  }

  // ── arithmetic ───────────────────────────────────────────────────────────
  setOperator(op) {
    this.commitEntry();
    if (this.pendingOp && this.acc !== null) {
      this.acc = this.applyOp(this.acc, this.x, this.pendingOp);
      this.x = this.acc;
    } else {
      this.acc = this.x;
    }
    this.pendingOp = op;
    this.entryStr = null;
    this.label = '';
    this.emit();
  }

  equals() {
    this.commitEntry();
    if (this.pendingOp && this.acc !== null) {
      this.x = this.applyOp(this.acc, this.x, this.pendingOp);
      this.acc = null;
      this.pendingOp = null;
    }
    this.entryStr = null;
    this.emit();
  }

  applyOp(a, b, op) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/':
        if (b === 0) { this.raiseError(); return 0; }
        return a / b;
      default: return b;
    }
  }

  percent() {
    // BA II Plus %: turns the display into a percentage of the pending operand.
    this.commitEntry();
    const base = this.acc !== null ? this.acc : 1;
    this.x = (this.x / 100) * (this.pendingOp ? base : 1);
    this.entryStr = null;
    this.emit();
  }

  // Unary scientific helpers (2ND functions on the math keys).
  unary(fn) {
    this.commitEntry();
    const v = this.x;
    let r;
    switch (fn) {
      case 'sqrt': r = v < 0 ? NaN : Math.sqrt(v); break;
      case 'square': r = v * v; break;
      case 'inv': r = v === 0 ? NaN : 1 / v; break;
      case 'ln': r = v <= 0 ? NaN : Math.log(v); break;
      case 'exp': r = Math.exp(v); break;
      default: r = v;
    }
    if (Number.isNaN(r)) this.raiseError();
    else this.x = r;
    this.entryStr = null;
    this.emit();
  }

  commitEntry() {
    if (this.entryStr !== null) {
      this.x = parseEntry(this.entryStr);
      this.entryStr = null;
    }
  }

  // ── memory (STO / RCL n) ─────────────────────────────────────────────────
  arm(kind) {
    this.commitEntry();
    this.storeArmed = kind === 'store';
    this.recallArmed = kind === 'recall';
    this.emit();
  }

  memoryDigit(n) {
    if (this.storeArmed) {
      this.mem[n] = this.currentValue();
      this.storeArmed = false;
      this.emit();
      return true;
    }
    if (this.recallArmed) {
      this.x = this.mem[n];
      this.entryStr = null;
      this.recallArmed = false;
      this.label = `RCL ${n}`;
      this.emit();
      return true;
    }
    return false;
  }

  // ── TVM worksheet ────────────────────────────────────────────────────────
  /** Store the current display into a TVM register, or compute it if armed. */
  tvmKey(key) {
    this.commitEntry();
    if (this.computeArmed) {
      this.computeTVMFor(key);
      this.computeArmed = false;
      return;
    }
    this.tvm[key] = this.currentValue();
    this.x = this.tvm[key];
    this.entryStr = null;
    this.label = labelFor(key);
    this.emit();
  }

  compute() {
    this.commitEntry();
    this.computeArmed = true;
    this.label = 'CPT';
    this.emit();
  }

  computeTVMFor(key) {
    const { N, IY, PV, PMT, FV } = this.tvm;
    const args = {
      n: N, iy: IY, pv: PV, pmt: PMT, fv: FV,
      py: this.py, cy: this.cy, begin: this.begin,
    };
    const solveFor = key === 'IY' ? 'IY' : key;
    const result = computeTVM(solveFor, args);
    if (!isFinite(result) || Number.isNaN(result)) {
      this.raiseError();
      return;
    }
    this.tvm[key] = result;
    this.x = result;
    this.entryStr = null;
    this.label = labelFor(key);
    this.emit();
  }

  clearTVM() {
    this.tvm = { N: 0, IY: 0, PV: 0, PMT: 0, FV: 0 };
    this.x = 0;
    this.entryStr = null;
    this.label = 'TVM CLR';
    this.emit();
  }

  // ── settings ─────────────────────────────────────────────────────────────
  setBegin(on) {
    this.begin = on;
    this.message = on ? 'BGN' : '';
    this.emit();
  }
  toggleBegin() { this.setBegin(!this.begin); }

  setPY(v) { this.py = v > 0 ? v : 1; this.emit(); }
  setCY(v) { this.cy = v > 0 ? v : 1; this.emit(); }
  setDecimals(v) {
    this.decimals = Math.max(0, Math.min(9, Math.round(v)));
    this.emit();
  }

  // ── 2ND prefix ───────────────────────────────────────────────────────────
  toggleSecond() {
    this.second = !this.second;
    this.emit();
  }
  clearSecond() {
    if (this.second) {
      this.second = false;
      this.emit();
    }
  }

  // ── errors ───────────────────────────────────────────────────────────────
  raiseError() {
    this.error = true;
    this.label = 'Error';
    this.emit();
  }
  clearError() {
    if (this.error) {
      this.error = false;
      this.label = '';
    }
  }
}

function labelFor(key) {
  return { N: 'N', IY: 'I/Y', PV: 'PV', PMT: 'PMT', FV: 'FV' }[key] || key;
}

export { TVM_KEYS };
