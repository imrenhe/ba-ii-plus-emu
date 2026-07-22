// format.js — number formatting for the LCD display.

/** Format a number for the LCD with a fixed decimal count and thousands groups. */
export function formatDisplay(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Error';
  if (!isFinite(value)) return value > 0 ? '9.9e99' : '-9.9e99';

  const abs = Math.abs(value);
  // Fall back to scientific notation when the magnitude won't fit an LCD field.
  if (abs !== 0 && (abs >= 1e10 || abs < 1e-9)) {
    return value.toExponential(Math.min(decimals, 6));
  }

  const fixed = value.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${sign}${grouped}.${decPart}` : `${sign}${grouped}`;
}

/** Format an in-progress entry string with thousands separators (keeps a
 *  trailing '.' and the digits typed after it exactly as entered). */
export function formatEntry(str) {
  if (str === null || str === undefined) return '';
  let s = String(str);
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const dot = s.indexOf('.');
  const intPart = dot === -1 ? s : s.slice(0, dot);
  const rest = dot === -1 ? '' : s.slice(dot); // includes the '.'
  const grouped = (intPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + grouped + rest;
}

/** Parse a user/entry string back to a number, tolerating grouping commas. */
export function parseEntry(str) {
  if (str === '' || str === '-' || str === '.') return 0;
  return parseFloat(String(str).replace(/,/g, ''));
}
