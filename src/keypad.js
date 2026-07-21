// keypad.js — the exact BA II-style key matrix (9 rows × 5 columns), read left
// to right, top to bottom, from the reference device. Each key carries its
// primary legend, its 2ND-function legend (printed above), a style group, and
// optional physical-keyboard bindings. Visual design/colors are original.

export const LAYOUT = [
  // Row A — control
  { code: 'cpt', label: 'CPT', second: 'QUIT', group: 'control', keys: ['c'] },
  { code: 'enter', label: 'ENTER', second: 'SET', group: 'control', keys: ['Enter'] },
  { code: 'up', label: '↑', second: 'DEL', group: 'control', keys: ['ArrowUp'] },
  { code: 'down', label: '↓', second: 'INS', group: 'control', keys: ['ArrowDown'] },
  { code: 'onoff', label: 'ON/OFF', group: 'control' },

  // Row B — 2ND + cash-flow worksheet keys + right arrow
  { code: '2nd', label: '2ND', group: 'second', keys: ['Shift'] },
  { code: 'CF', label: 'CF', group: 'ws' },
  { code: 'NPV', label: 'NPV', group: 'ws' },
  { code: 'IRR', label: 'IRR', group: 'ws' },
  { code: 'right', label: '→', group: 'control', keys: ['Backspace', 'ArrowRight'] },

  // Row C — TVM
  { code: 'N', label: 'N', second: 'xP/Y', group: 'tvm' },
  { code: 'IY', label: 'I/Y', second: 'P/Y', group: 'tvm' },
  { code: 'PV', label: 'PV', second: 'AMORT', group: 'tvm' },
  { code: 'PMT', label: 'PMT', second: 'BGN', group: 'tvm' },
  { code: 'FV', label: 'FV', second: 'CLR TVM', group: 'tvm' },

  // Row D — % √ x² 1/x ÷
  { code: 'pct', label: '%', second: 'K', group: 'fn', keys: ['%'] },
  { code: 'sqrt', label: '√x', group: 'fn' },
  { code: 'square', label: 'x²', group: 'fn' },
  { code: 'inv', label: '1/x', group: 'fn' },
  { code: 'div', label: '÷', group: 'op', keys: ['/'] },

  // Row E — INV ( ) yˣ ×
  { code: 'INV', label: 'INV', second: 'HYP', group: 'fn' },
  { code: 'lparen', label: '(', second: 'SIN', group: 'fn' },
  { code: 'rparen', label: ')', second: 'COS', group: 'fn' },
  { code: 'pow', label: 'yˣ', second: 'TAN', group: 'fn' },
  { code: 'mul', label: '×', second: 'x!', group: 'op', keys: ['*'] },

  // Row F — LN 7 8 9 −
  { code: 'ln', label: 'LN', second: 'eˣ', group: 'fn' },
  { code: '7', label: '7', second: 'DATA', group: 'num', keys: ['7'] },
  { code: '8', label: '8', second: 'STAT', group: 'num', keys: ['8'] },
  { code: '9', label: '9', second: 'BOND', group: 'num', keys: ['9'] },
  { code: 'sub', label: '−', second: 'nPr', group: 'op', keys: ['-'] },

  // Row G — STO 4 5 6 +
  { code: 'sto', label: 'STO', second: 'ROUND', group: 'mem' },
  { code: '4', label: '4', second: 'DEPR', group: 'num', keys: ['4'] },
  { code: '5', label: '5', second: 'Δ%', group: 'num', keys: ['5'] },
  { code: '6', label: '6', second: 'BRKEVN', group: 'num', keys: ['6'] },
  { code: 'add', label: '+', second: 'nCr', group: 'op', keys: ['+'] },

  // Row H — RCL 1 2 3 =
  { code: 'rcl', label: 'RCL', group: 'mem' },
  { code: '1', label: '1', second: 'DATE', group: 'num', keys: ['1'] },
  { code: '2', label: '2', second: 'ICONV', group: 'num', keys: ['2'] },
  { code: '3', label: '3', second: 'PROFIT', group: 'num', keys: ['3'] },
  { code: 'eq', label: '=', second: 'ANS', group: 'equals', keys: ['='] },

  // Row I — CE|C 0 . +/−  (last column intentionally empty, as on the device)
  { code: 'onc', label: 'CE|C', second: 'CLR WORK', group: 'clear', keys: ['Escape'] },
  { code: '0', label: '0', second: 'MEM', group: 'num', keys: ['0'] },
  { code: 'dot', label: '.', second: 'FORMAT', group: 'num', keys: ['.'] },
  { code: 'neg', label: '+/−', second: 'RESET', group: 'num', keys: ['n'] },
];

export function renderKeypad(root, onPress) {
  root.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'keypad';
  for (const k of LAYOUT) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `key key-${k.group}`;
    btn.dataset.code = k.code;
    btn.setAttribute('aria-label', k.second ? `${k.label} (2nd: ${k.second})` : k.label);
    const sec = document.createElement('span');
    sec.className = 'key-2nd-label';
    sec.textContent = k.second || '';
    btn.appendChild(sec);
    const main = document.createElement('span');
    main.className = 'key-main';
    main.textContent = k.label;
    btn.appendChild(main);
    btn.addEventListener('click', () => {
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 90);
      onPress(k.code);
    });
    grid.appendChild(btn);
  }
  root.appendChild(grid);
  return grid;
}

/** Map a physical keyboard event to a key code, or null. */
export function keyEventToCode(e) {
  if (e.key >= '0' && e.key <= '9') return e.key;
  for (const k of LAYOUT) if (k.keys && k.keys.includes(e.key)) return k.code;
  return null;
}
