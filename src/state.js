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
import { formatDisplay, formatEntry, parseEntry } from './format.js';
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
    // Arithmetic evaluator (supports both Chn chain and AOS order-of-operations,
    // plus parentheses) via an operand stack + operator stack.
    this.valStack = [];
    this.opStack = []; // operators; '(' marks a parenthesis
    this.awaitingOperand = false; // an operator/'(' was just pressed, no operand yet
    this.operandPushed = false;   // this.x is already represented on valStack
    this.justEvaluated = false;   // last action was '=' (enables repeated "=")
    this.lastOp = null;           // for repeated "="
    this.lastOperand = null;
    this.lastAnswer = 0;
    this.calcMode = 'Chn';        // 'Chn' (chain) or 'AOS' (algebraic order of ops)

    this.second = false;
    this.inverse = false; // INV prefix for trig
    this.hyp = false; // HYP prefix for trig
    this.computeArmed = false;
    this.storeArmed = false;
    this.recallArmed = false;

    this.label = '';
    this.error = false;
    this.errorCode = 0; // BA II-style error number (see raiseError)

    this.mem = Array(10).fill(0);
    this.tvm = { N: 0, IY: 0, PV: 0, PMT: 0, FV: 0 };
    this.py = 1;
    this.cy = 1;
    this.begin = false;
    this.decimals = 4;
    this.angleMode = DEG;

    this.data = defaultData();

    this.ws = null; // active worksheet object
    this.wsIndex = 0;

    // Power / easter egg.
    this.powerOff = false;
    this.themeIndex = 0;
    this._powerStreak = 0;
    this._lastPowerPress = 0;

    this.emit();
  }

  // ── power button (with a hidden theme-cycle easter egg) ────────────────────
  static get LCD_THEMES() { return ['green', 'amber', 'blue']; }
  get lcdTheme() { return Calculator.LCD_THEMES[this.themeIndex]; }

  /** ON/OFF: a single press sleeps/wakes; 7 rapid presses cycle the LCD theme. */
  powerButton() {
    const now = Date.now();
    this._powerStreak = now - this._lastPowerPress < 600 ? this._powerStreak + 1 : 1;
    this._lastPowerPress = now;
    if (this._powerStreak >= 7) {
      this._powerStreak = 0;
      this.themeIndex = (this.themeIndex + 1) % Calculator.LCD_THEMES.length;
      this.powerOff = false; // make sure the new theme is visible
      this.emit();
      return;
    }
    this.powerOff = !this.powerOff;
    this.emit();
  }

  /** Wake from sleep on any other key; returns true if it consumed the press. */
  wake() {
    if (this.powerOff) { this.powerOff = false; this.emit(); return true; }
    return false;
  }

  // ── subscription ────────────────────────────────────────────────────────
  onChange(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  emit() { for (const fn of this.listeners) fn(this); }

  // ── display ──────────────────────────────────────────────────────────────
  getDisplay() {
    if (this.error) return { label: '', value: this.errorString(), flags: this.flags() };
    if (this.ws) {
      const field = this.currentField();
      let value;
      if (this.entryStr !== null) {
        // Dates are typed as MM.DDYYYY — don't group those; group plain numbers.
        value = field && field.kind === 'date' ? this.entryStr : formatEntry(this.entryStr);
      } else {
        value = this.fieldDisplay(field);
      }
      // Settings show their value directly (no label); confirm keeps its label
      // (e.g. "RST ?"); both suppress the "=" via flags.noEquals.
      const label = !field ? this.ws.title
        : field.kind === 'setting' ? '' : field.label;
      return { label, value, flags: this.flags() };
    }
    const value = this.entryStr !== null ? formatEntry(this.entryStr) : formatDisplay(this.x, this.decimals);
    return { label: this.label, value, flags: this.flags() };
  }

  flags() {
    const f = this.ws ? this.currentField() : null;
    return {
      second: this.second,
      inverse: this.inverse,
      hyp: this.hyp,
      begin: this.begin,
      rad: this.angleMode === RAD,
      compute: this.computeArmed,
      // ENTER indicator: lit when the current field is one you store with ENTER
      // (editable inputs, or the RESET confirm) — off for outputs/settings/STD.
      enter: !!(f && (f.editable || f.kind === 'confirm')),
      worksheet: this.ws ? this.ws.title : '',
      nav: !!this.ws,
      set: !!(f && f.kind === 'setting'),
      noEquals: !!(f && (f.kind === 'setting' || f.kind === 'confirm')),
    };
  }

  fieldDisplay(field) {
    if (!field) return '';
    if (field.kind === 'confirm') return '?';
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
    if (!this.ws) { this.x = parseEntry(this.entryStr); this.label = ''; this._freshOperand(); }
    this.emit();
  }

  /** Mark this.x as a newly-entered operand (not yet folded into the stacks). */
  _freshOperand() { this.operandPushed = false; this.awaitingOperand = false; this.justEvaluated = false; }

  negate() {
    if (this.entryStr !== null) {
      this.entryStr = this.entryStr.startsWith('-') ? this.entryStr.slice(1) : '-' + this.entryStr;
      if (!this.ws) this.x = parseEntry(this.entryStr);
    } else if (this.ws) {
      // Negate the stored value of the current numeric field.
      const f = this.currentField();
      if (f && f.editable && f.kind === 'num') f.set(-(f.get() || 0));
    } else {
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
      if (!this.ws) this.x = 0; // clear the displayed number to 0 (device behavior)
    } else if (!this.ws) {
      this.x = 0; this.label = '';
      this.valStack = []; this.opStack = [];
      this.awaitingOperand = false; this.operandPushed = false; this.justEvaluated = false;
    }
    this.clearError();
    this.emit();
  }

  commitEntry() {
    if (this.entryStr !== null && !this.ws) { this.x = parseEntry(this.entryStr); this.entryStr = null; }
  }

  // ── arithmetic (Chn chain, or AOS order-of-operations, with parentheses) ────
  /** Operator precedence. In Chn mode every operator is equal (left-to-right). */
  _prec(op) {
    if (this.calcMode === 'Chn') return 1;
    switch (op) {
      case '+': case '-': return 1;
      case '*': case '/': return 2;
      case '^pow': case 'nPr': case 'nCr': return 3;
      default: return 0;
    }
  }

  _top() { return this.opStack[this.opStack.length - 1]; }

  _reduceTop() {
    const op = this.opStack.pop();
    const b = this.valStack.pop();
    const a = this.valStack.pop();
    this.lastOp = op; this.lastOperand = b;
    this.valStack.push(this.applyOp(a, b, op));
  }

  setOperator(op) {
    if (this.ws || this.error) return;
    this.commitEntry();
    this.justEvaluated = false;
    if (this.awaitingOperand) {
      // Two operators in a row → just replace the pending one.
      if (this._top() !== undefined && this._top() !== '(') this.opStack[this.opStack.length - 1] = op;
      else this.opStack.push(op);
    } else {
      if (!this.operandPushed) this.valStack.push(this.x);
      while (this.opStack.length && this._top() !== '(' && this._prec(this._top()) >= this._prec(op)) {
        this._reduceTop();
      }
      this.x = this.valStack[this.valStack.length - 1];
      this.opStack.push(op);
      this.operandPushed = true;
      this.awaitingOperand = true;
    }
    this.entryStr = null;
    this.label = '';
    this._checkResult();
    this.emit();
  }

  openParen() {
    if (this.ws || this.error) return;
    this.commitEntry();
    this.opStack.push('(');
    this.awaitingOperand = true;
    this.operandPushed = false;
    this.justEvaluated = false;
    this.entryStr = null;
    this.emit();
  }

  closeParen() {
    if (this.ws || this.error) return;
    this.commitEntry();
    this.justEvaluated = false;
    // Push the current operand, including when an operator is dangling ("(2+)")
    // so it repeats rather than folding a missing operand.
    if (this.awaitingOperand || !this.operandPushed) this.valStack.push(this.x);
    while (this.opStack.length && this._top() !== '(') this._reduceTop();
    if (this._top() === '(') this.opStack.pop();
    if (this.valStack.length) this.x = this.valStack[this.valStack.length - 1];
    this.awaitingOperand = false;
    this.operandPushed = true;
    this.entryStr = null;
    this._checkResult();
    this.emit();
  }

  equals() {
    if (this.ws) return this.wsEnter();
    if (this.error) return;
    this.commitEntry();
    if (this.opStack.length === 0 && this.justEvaluated && this.lastOp !== null) {
      this.x = this.applyOp(this.x, this.lastOperand, this.lastOp); // repeated "="
    } else {
      // Push the current operand; when an operator is dangling ("5 + ="), repeat
      // it as the right operand (→ 10) instead of folding a missing operand.
      if (this.awaitingOperand || !this.operandPushed) this.valStack.push(this.x);
      while (this.opStack.length) {
        if (this._top() === '(') this.opStack.pop();
        else this._reduceTop();
      }
      if (this.valStack.length) this.x = this.valStack.pop();
    }
    this.valStack = []; this.opStack = [];
    this.operandPushed = false; this.awaitingOperand = false; this.justEvaluated = true;
    this._checkResult();
    this.lastAnswer = this.x;
    this.entryStr = null;
    this.emit();
  }

  _checkResult() {
    if (this.error) return;
    if (Number.isNaN(this.x)) this.raiseError(2);       // e.g. invalid nPr/nCr
    else if (!isFinite(this.x)) this.raiseError(1);     // overflow / divide by zero
  }

  applyOp(a, b, op) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': if (b === 0) { this.raiseError(1); return 0; } return a / b;
      case '^pow': return Math.pow(a, b);
      case 'nPr': return nPr(a, b);
      case 'nCr': return nCr(a, b);
      default: return b;
    }
  }

  percent() {
    if (this.ws || this.error) return;
    this.commitEntry();
    // With a pending + or −, % means "this percent OF the left operand"
    // (e.g. 200 + 5% = 210). With × / ÷ or nothing pending, % is just ÷100
    // (e.g. 200 × 5% = 10, 50% = 0.5).
    const op = this.opStack.length > 0 ? this._top() : null;
    if ((op === '+' || op === '-') && this.valStack.length > 0) {
      this.x = (this.x / 100) * this.valStack[this.valStack.length - 1];
    } else {
      this.x = this.x / 100;
    }
    this._freshOperand();
    this.entryStr = null;
    this.emit();
  }

  unary(fn) {
    if (this.ws || this.error) return;
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
    if (Number.isNaN(r)) this.raiseError(fn === 'inv' ? 1 : 2);
    else if (!isFinite(r)) this.raiseError(1);
    else { this.x = r; this.lastAnswer = r; this._freshOperand(); }
    this.entryStr = null;
    this.emit();
  }

  trigFn(fn) {
    if (this.ws || this.error) return;
    this.commitEntry();
    const r = trig(fn, this.x, { mode: this.angleMode, inverse: this.inverse, hyp: this.hyp });
    this.inverse = false; this.hyp = false;
    if (Number.isNaN(r)) this.raiseError(2);
    else if (!isFinite(r)) this.raiseError(1);
    else { this.x = r; this.lastAnswer = r; this._freshOperand(); }
    this.entryStr = null;
    this.emit();
  }

  random() {
    if (this.ws) return;
    this.x = Math.random();
    this._freshOperand();
    this.entryStr = null;
    this.emit();
  }

  toggleInverse() { this.inverse = !this.inverse; this.emit(); }
  toggleHyp() { this.hyp = !this.hyp; this.emit(); }
  recallAnswer() { if (!this.ws) { this.x = this.lastAnswer; this._freshOperand(); this.entryStr = null; this.emit(); } }

  // ── memory ────────────────────────────────────────────────────────────────
  arm(kind) { this.commitEntry(); this.storeArmed = kind === 'store'; this.recallArmed = kind === 'recall'; this.emit(); }

  memoryDigit(n) {
    if (this.storeArmed) {
      this.storeArmed = false;
      if (this.ws) {
        const f = this.currentField();
        const v = this.entryStr !== null ? parseEntry(this.entryStr)
          : f && typeof f.get?.() === 'number' ? f.get() : this.x;
        this.mem[n] = v;
      } else {
        this.mem[n] = this.currentValue();
      }
      this.emit();
      return true;
    }
    if (this.recallArmed) {
      this.recallArmed = false;
      if (this.ws) {
        // Show the recalled value as a pending entry so it can be stored with ENTER.
        this.entryStr = String(this.mem[n]);
      } else {
        this.x = this.mem[n]; this.entryStr = null; this.label = `M${n}`; this._freshOperand();
      }
      this.emit();
      return true;
    }
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
    this._freshOperand();
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
    // No real solution for the given signs of PV/PMT/FV → Error 5, as on the device.
    if (!isFinite(result) || Number.isNaN(result)) { this.raiseError(5); return; }
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
    this.storeArmed = false;
    this.recallArmed = false;
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
    if (field && field.kind === 'confirm') { field.onEnter(); return; } // e.g. RESET
    if (!field || !field.editable || this.entryStr === null) { this.emit(); return; }
    if (field.kind === 'date') {
      const parsed = parseDeviceDate(this.entryStr);
      if (!parsed) { this.raiseError(6); return; } // invalid date → Error 6
      field.set(parsed);
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
    if (typeof r === 'number' && (Number.isNaN(r) || !isFinite(r))) {
      // IRR / bond-yield failures are iteration errors (7); others have no solution (5).
      const iterative = this.ws.id === 'IRR' || (this.ws.id === 'BOND' && field.label === 'YLD');
      this.raiseError(iterative ? 7 : 5);
    }
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
  // Error codes mirror the reference device:
  //   1 Overflow / divide by zero      2 Invalid argument (domain error)
  //   4 Value out of range             5 No solution exists (TVM)
  //   6 Invalid date                   7 Iteration limit exceeded (IRR / yield)
  raiseError(code = 0) { this.error = true; this.errorCode = code; this.emit(); }
  clearError() { if (this.error) { this.error = false; this.errorCode = 0; } }
  errorString() { return this.errorCode ? `Error ${this.errorCode}` : 'Error'; }
}

function labelFor(key) {
  return { N: 'N', IY: 'I/Y', PV: 'PV', PMT: 'PMT', FV: 'FV' }[key] || key;
}

export { TVM_KEYS };
