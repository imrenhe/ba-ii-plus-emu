// state.js — the calculator controller. Two operating contexts:
//
//   • STD  — the standard calculator: number entry, arithmetic, scientific
//            functions, memory, and the direct TVM keys (N/I/Y/PV/PMT/FV/CPT).
//   • Worksheet — a prompt-driven mode where the LCD shows one labelled field at
//            a time (e.g. "CF0", "SDT", "DEC"); ↓/↑ move between fields, digits +
//            ENTER store, SET cycles options, CPT computes. Field definitions
//            live in ./worksheets.js; the pure math lives in ./engine.
//
// No DOM here. The UI subscribes with onChange() and reads getDisplay().

import { computeTVM } from './engine/tvm.js';
import { trig, factorial, nPr, nCr, DEG, RAD } from './engine/sci.js';
import { parseDeviceDate, formatDate } from './engine/dates.js';
import { formatDisplay, parseEntry } from './format.js';
import { getWorksheet, defaultData, WORKSHEET_DATA_KEY } from './worksheets.js';

const TVM_KEYS = ['N', 'IY', 'PV', 'PMT', 'FV'];

export class Calculator {
  constructor() {
    this.listeners = [];
    this.reset();
  }

  reset() {
    this.x = 0;
    this.entryStr = null;
    this.acc = null;
    this.pendingOp = null;
    this.lastOp = null; // for repeated "="
    this.lastOperand = null;
    this.lastAnswer = 0;

    this.second = false;
    this.inverse = false; // INV prefix for trig
    this.hyp = false; // HYP prefix for trig
    this.computeArmed = false;
    this.storeArmed = false;
    this.recallArmed = false;

    this.label = '';
    this.error = false;

    this.mem = Array(10).fill(0);
    this.tvm = { N: 0, IY: 0, PV: 0, PMT: 0, FV: 0 };
    this.py = 1;
    this.cy = 1;
    this.begin = false;
    this.decimals = 2;
    this.angleMode = DEG;

    this.data = defaultData();

    this.ws = null; // active worksheet object
    this.wsIndex = 0;

    this.emit();
  }

  // ── subscription ────────────────────────────────────────────────────────
  onChange(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  emit() { for (const fn of this.listeners) fn(this); }

  // ── display ──────────────────────────────────────────────────────────────
  getDisplay() {
    if (this.error) return { label: this.ws ? this.ws.title : '', value: 'Error', flags: this.flags() };
    if (this.ws) {
      const field = this.currentField();
      const value = this.entryStr !== null ? this.entryStr : this.fieldDisplay(field);
      return { label: field ? field.label : this.ws.title, value, flags: this.flags() };
    }
    const value = this.entryStr !== null ? this.entryStr : formatDisplay(this.x, this.decimals);
    return { label: this.label, value, flags: this.flags() };
  }

  flags() {
    return {
      second: this.second,
      inverse: this.inverse,
      hyp: this.hyp,
      begin: this.begin,
      rad: this.angleMode === RAD,
      compute: this.computeArmed,
      entry: this.entryStr !== null,
      worksheet: this.ws ? this.ws.title : '',
      nav: !!this.ws,
      set: !!(this.ws && this.currentField() && this.currentField().kind === 'setting'),
    };
  }

  fieldDisplay(field) {
    if (!field) return '';
    if (field.kind === 'date') return formatDate(field.get());
    if (field.kind === 'setting') return field.get();
    const v = field.get();
    if (v === null || v === undefined || Number.isNaN(v)) return formatDisplay(0, this.decimals);
    return formatDisplay(v, this.decimals);
  }

  currentField() {
    if (!this.ws) return null;
    const fields = this.ws.fields();
    if (this.wsIndex >= fields.length) this.wsIndex = fields.length - 1;
    if (this.wsIndex < 0) this.wsIndex = 0;
    return fields[this.wsIndex];
  }

  currentValue() {
    return this.entryStr !== null ? parseEntry(this.entryStr) : this.x;
  }

  // ── number entry ─────────────────────────────────────────────────────────
  inputDigit(d) {
    this.clearError();
    if (this.ws && !(this.currentField() && this.currentField().editable)) return;
    if (this.entryStr === null || this.entryStr === '0') {
      this.entryStr = d === '.' ? '0.' : d;
    } else if (d === '.') {
      if (!this.entryStr.includes('.')) this.entryStr += '.';
    } else if (this.entryStr.replace(/[-.]/g, '').length < 12) {
      this.entryStr += d;
    }
    if (!this.ws) { this.x = parseEntry(this.entryStr); this.label = ''; }
    this.emit();
  }

  negate() {
    if (this.entryStr !== null) {
      this.entryStr = this.entryStr.startsWith('-') ? this.entryStr.slice(1) : '-' + this.entryStr;
      if (!this.ws) this.x = parseEntry(this.entryStr);
    } else if (!this.ws) {
      this.x = -this.x;
    }
    this.emit();
  }

  backspace() {
    if (this.entryStr === null) return;
    this.entryStr = this.entryStr.length > 1 ? this.entryStr.slice(0, -1) : null;
    if (!this.ws) this.x = this.entryStr === null ? 0 : parseEntry(this.entryStr);
    this.emit();
  }

  clearEntry() {
    // CE|C. In a worksheet, clears the entry; twice quits nothing (CLR WORK handles data).
    if (this.entryStr !== null) {
      this.entryStr = null;
    } else if (!this.ws) {
      this.x = 0; this.acc = null; this.pendingOp = null; this.label = '';
    }
    this.clearError();
    this.emit();
  }

  commitEntry() {
    if (this.entryStr !== null && !this.ws) { this.x = parseEntry(this.entryStr); this.entryStr = null; }
  }

  // ── arithmetic ───────────────────────────────────────────────────────────
  setOperator(op) {
    if (this.ws) return;
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
    if (this.ws) return this.wsEnter();
    this.commitEntry();
    if (this.pendingOp && this.acc !== null) {
      this.lastOp = this.pendingOp;
      this.lastOperand = this.x;
      this.x = this.applyOp(this.acc, this.x, this.pendingOp);
      this.acc = null;
      this.pendingOp = null;
    } else if (this.lastOp !== null && this.lastOperand !== null) {
      this.x = this.applyOp(this.x, this.lastOperand, this.lastOp); // repeated "="
    }
    this.lastAnswer = this.x;
    this.entryStr = null;
    this.emit();
  }

  applyOp(a, b, op) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': if (b === 0) { this.raiseError(); return 0; } return a / b;
      case '^pow': return Math.pow(a, b);
      case 'nPr': return nPr(a, b);
      case 'nCr': return nCr(a, b);
      default: return b;
    }
  }

  percent() {
    if (this.ws) return;
    this.commitEntry();
    const base = this.acc !== null ? this.acc : 1;
    this.x = (this.x / 100) * (this.pendingOp ? base : 1);
    this.entryStr = null;
    this.emit();
  }

  unary(fn) {
    if (this.ws) return;
    this.commitEntry();
    const v = this.x;
    let r;
    switch (fn) {
      case 'sqrt': r = v < 0 ? NaN : Math.sqrt(v); break;
      case 'square': r = v * v; break;
      case 'inv': r = v === 0 ? NaN : 1 / v; break;
      case 'ln': r = v <= 0 ? NaN : Math.log(v); break;
      case 'exp': r = Math.exp(v); break;
      case 'fact': r = factorial(v); break;
      case 'round': r = Number(formatDisplay(v, this.decimals).replace(/,/g, '')); break;
      default: r = v;
    }
    if (Number.isNaN(r)) this.raiseError(); else { this.x = r; this.lastAnswer = r; }
    this.entryStr = null;
    this.emit();
  }

  trigFn(fn) {
    if (this.ws) return;
    this.commitEntry();
    const r = trig(fn, this.x, { mode: this.angleMode, inverse: this.inverse, hyp: this.hyp });
    this.inverse = false; this.hyp = false;
    if (Number.isNaN(r) || !isFinite(r)) this.raiseError(); else { this.x = r; this.lastAnswer = r; }
    this.entryStr = null;
    this.emit();
  }

  random() {
    if (this.ws) return;
    this.x = Math.random();
    this.entryStr = null;
    this.emit();
  }

  toggleInverse() { this.inverse = !this.inverse; this.emit(); }
  toggleHyp() { this.hyp = !this.hyp; this.emit(); }
  recallAnswer() { if (!this.ws) { this.x = this.lastAnswer; this.entryStr = null; this.emit(); } }

  // ── memory ────────────────────────────────────────────────────────────────
  arm(kind) { this.commitEntry(); this.storeArmed = kind === 'store'; this.recallArmed = kind === 'recall'; this.emit(); }

  memoryDigit(n) {
    if (this.storeArmed) { this.mem[n] = this.currentValue(); this.storeArmed = false; this.emit(); return true; }
    if (this.recallArmed) { this.x = this.mem[n]; this.entryStr = null; this.recallArmed = false; this.label = `M${n}`; this.emit(); return true; }
    return false;
  }

  // ── TVM (STD mode) ─────────────────────────────────────────────────────────
  tvmKey(key) {
    if (this.ws) return;
    this.commitEntry();
    if (this.computeArmed) { this.computeTVMFor(key); this.computeArmed = false; return; }
    this.tvm[key] = this.currentValue();
    this.x = this.tvm[key];
    this.entryStr = null;
    this.label = labelFor(key);
    this.emit();
  }

  compute() {
    if (this.ws) return this.wsCompute();
    this.commitEntry();
    this.computeArmed = true;
    this.label = 'CPT';
    this.emit();
  }

  computeTVMFor(key) {
    const { N, IY, PV, PMT, FV } = this.tvm;
    const args = { n: N, iy: IY, pv: PV, pmt: PMT, fv: FV, py: this.py, cy: this.cy, begin: this.begin };
    const result = computeTVM(key === 'IY' ? 'IY' : key, args);
    if (!isFinite(result) || Number.isNaN(result)) { this.raiseError(); return; }
    this.tvm[key] = result;
    this.x = result;
    this.lastAnswer = result;
    this.entryStr = null;
    this.label = labelFor(key);
    this.emit();
  }

  clearTVM() { this.tvm = { N: 0, IY: 0, PV: 0, PMT: 0, FV: 0 }; this.x = 0; this.entryStr = null; this.label = 'TVM CLR'; this.emit(); }

  // ── settings ──────────────────────────────────────────────────────────────
  setBegin(on) { this.begin = on; this.emit(); }
  setPY(v) { this.py = v > 0 ? v : 1; this.emit(); }
  setCY(v) { this.cy = v > 0 ? v : 1; this.emit(); }
  setDecimals(v) { this.decimals = Math.max(0, Math.min(9, Math.round(v))); this.emit(); }

  // ── 2ND prefix ──────────────────────────────────────────────────────────
  toggleSecond() { this.second = !this.second; this.emit(); }
  clearSecond() { if (this.second) { this.second = false; this.emit(); } }

  // ── worksheet mode ─────────────────────────────────────────────────────────
  openWorksheet(id) {
    const ws = getWorksheet(id, this);
    if (!ws) return;
    this.ws = ws;
    this.wsIndex = 0;
    this.entryStr = null;
    this.computeArmed = false;
    this.clearError();
    this.emit();
  }

  quitWorksheet() {
    if (!this.ws) return;
    this.ws = null;
    this.entryStr = null;
    this.label = '';
    this.emit();
  }

  wsNext() {
    if (!this.ws) return;
    const len = this.ws.fields().length;
    this.wsIndex = (this.wsIndex + 1) % len;
    this.entryStr = null;
    this.emit();
  }

  wsPrev() {
    if (!this.ws) return;
    const len = this.ws.fields().length;
    this.wsIndex = (this.wsIndex - 1 + len) % len;
    this.entryStr = null;
    this.emit();
  }

  wsEnter() {
    if (!this.ws) return;
    const field = this.currentField();
    if (!field || !field.editable || this.entryStr === null) { this.emit(); return; }
    if (field.kind === 'date') {
      const parsed = parseDeviceDate(this.entryStr);
      if (parsed) field.set(parsed);
    } else {
      field.set(parseEntry(this.entryStr));
    }
    this.entryStr = null;
    this.emit();
  }

  wsCompute() {
    if (!this.ws) return;
    const field = this.currentField();
    if (!field || !field.computable) { this.emit(); return; }
    const r = field.compute();
    this.entryStr = null;
    if (typeof r === 'number' && (Number.isNaN(r) || !isFinite(r))) this.raiseError();
    this.emit();
  }

  wsSet() {
    if (!this.ws) return;
    const field = this.currentField();
    if (field && field.kind === 'setting' && field.cycle) { field.cycle(); this.emit(); }
  }

  wsDelete() {
    // 2nd DEL — remove the current item in list worksheets (CF groups, DATA points)
    if (!this.ws) return;
    if (this.ws.id === 'CF') {
      const label = this.currentField()?.label || '';
      const m = label.match(/^[CF](\d+)$/);
      if (m) { const i = parseInt(m[1], 10) - 1; if (this.data.cf.groups[i]) this.data.cf.groups.splice(i, 1); }
    } else if (this.ws.id === 'DATA') {
      const label = this.currentField()?.label || '';
      const m = label.match(/^[XY](\d+)$/);
      if (m) { const i = parseInt(m[1], 10) - 1; if (this.data.stat.points[i]) this.data.stat.points.splice(i, 1); }
    }
    this.entryStr = null;
    this.emit();
  }

  clearWork() {
    if (!this.ws) return;
    const key = WORKSHEET_DATA_KEY[this.ws.id];
    if (key) {
      const fresh = defaultData();
      this.data[key] = fresh[key];
    }
    this.wsIndex = 0;
    this.entryStr = null;
    this.emit();
  }

  // ── errors ────────────────────────────────────────────────────────────────
  raiseError() { this.error = true; this.emit(); }
  clearError() { if (this.error) this.error = false; }
}

function labelFor(key) {
  return { N: 'N', IY: 'I/Y', PV: 'PV', PMT: 'PMT', FV: 'FV' }[key] || key;
}

export { TVM_KEYS };
