// keypad.js — the key matrix (faithful BA II-style grouping, original styling)
// plus press dispatch. Each key: { code, label, second, group, key? }
//   code   — internal action id
//   label  — primary legend
//   second — 2ND-function legend printed above the key (optional)
//   group  — CSS style group (control | tvm | worksheet | op | num | mem)
//   keys   — physical keyboard keys that trigger it (optional)

export const LAYOUT = [
  // Row 1 — control
  { code: '2nd', label: '2ND', group: 'control', keys: ['Shift'] },
  { code: 'up', label: '▲', group: 'control', keys: ['ArrowUp'] },
  { code: 'down', label: '▼', group: 'control', keys: ['ArrowDown'] },
  { code: 'cpt', label: 'CPT', group: 'control', keys: ['c'] },
  { code: 'onc', label: 'ON/C', second: 'RESET', group: 'control', keys: ['Escape'] },

  // Row 2 — TVM (accent)
  { code: 'N', label: 'N', second: 'xP/Y', group: 'tvm' },
  { code: 'IY', label: 'I/Y', second: 'P/Y', group: 'tvm' },
  { code: 'PV', label: 'PV', second: 'AMORT', group: 'tvm' },
  { code: 'PMT', label: 'PMT', second: 'BGN', group: 'tvm' },
  { code: 'FV', label: 'FV', second: 'CLR TVM', group: 'tvm' },

  // Row 3 — worksheets / navigation
  { code: 'CF', label: 'CF', group: 'worksheet' },
  { code: 'NPV', label: 'NPV', group: 'worksheet' },
  { code: 'IRR', label: 'IRR', group: 'worksheet' },
  { code: 'enter', label: 'ENTER', second: 'SET', group: 'worksheet', keys: ['Enter'] },
  { code: 'del', label: 'DEL', second: 'INS', group: 'worksheet', keys: ['Delete'] },

  // Row 4 — memory + roots + divide
  { code: 'sto', label: 'STO', group: 'mem' },
  { code: 'rcl', label: 'RCL', group: 'mem' },
  { code: 'sqrt', label: '√x', second: 'x²', group: 'op' },
  { code: 'inv', label: '1/x', group: 'op' },
  { code: 'div', label: '÷', group: 'op', keys: ['/'] },

  // Row 5 — 7 8 9 y^x ×
  { code: '7', label: '7', second: 'DATA', group: 'num', keys: ['7'] },
  { code: '8', label: '8', second: 'STAT', group: 'num', keys: ['8'] },
  { code: '9', label: '9', second: 'BOND', group: 'num', keys: ['9'] },
  { code: 'pow', label: 'yˣ', group: 'op' },
  { code: 'mul', label: '×', group: 'op', keys: ['*'] },

  // Row 6 — 4 5 6 ln −
  { code: '4', label: '4', group: 'num', keys: ['4'] },
  { code: '5', label: '5', group: 'num', keys: ['5'] },
  { code: '6', label: '6', second: 'DEPR', group: 'num', keys: ['6'] },
  { code: 'ln', label: 'LN', second: 'eˣ', group: 'op' },
  { code: 'sub', label: '−', group: 'op', keys: ['-'] },

  // Row 7 — 1 2 3 % +
  { code: '1', label: '1', group: 'num', keys: ['1'] },
  { code: '2', label: '2', group: 'num', keys: ['2'] },
  { code: '3', label: '3', group: 'num', keys: ['3'] },
  { code: 'pct', label: '%', group: 'op', keys: ['%'] },
  { code: 'add', label: '+', group: 'op', keys: ['+'] },

  // Row 8 — +/- 0 . FORMAT =
  { code: 'neg', label: '+/−', group: 'num', keys: ['n'] },
  { code: '0', label: '0', group: 'num', keys: ['0'] },
  { code: 'dot', label: '.', second: 'FORMAT', group: 'num', keys: ['.'] },
  { code: 'bksp', label: '←', group: 'num', keys: ['Backspace'] },
  { code: 'eq', label: '=', group: 'op', keys: ['='] },
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
    if (k.second) {
      const sec = document.createElement('span');
      sec.className = 'key-second';
      sec.textContent = k.second;
      btn.appendChild(sec);
    }
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
  for (const k of LAYOUT) {
    if (k.keys && k.keys.includes(e.key)) return k.code;
  }
  return null;
}
