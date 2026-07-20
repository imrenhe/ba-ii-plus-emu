// dates.js — calendar math for the Bond and Date worksheets.
//
// Dates are entered the way the physical device accepts them: as a number
// MM.DDYYYY (month, then a two-digit day, then the year) — e.g. 12.312024 is
// 31 Dec 2024. They are held internally as { m, d, y } and shown as MM-DD-YYYY.
// Two day-count conventions are supported: ACT (actual days) and 360 (30/360 US).

/** Parse a device-format date. Accepts the raw entry string "MM.DDYYYY". */
export function parseDeviceDate(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).trim();
  const m = s.match(/^(\d{1,2})(?:\.(\d{2})(\d{2,4})?)?$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = m[2] ? parseInt(m[2], 10) : 1;
  let year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
  if (m[3] && m[3].length === 2) year += year < 50 ? 2000 : 1900; // 2-digit year window
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { m: month, d: day, y: year };
}

/** Format { m, d, y } as MM-DD-YYYY. */
export function formatDate(date) {
  if (!date) return '';
  const mm = String(date.m).padStart(2, '0');
  const dd = String(date.d).padStart(2, '0');
  return `${mm}-${dd}-${date.y}`;
}

/** Convert to a JS Date at UTC noon (avoids timezone/DST drift). */
export function toJS(date) {
  return new Date(Date.UTC(date.y, date.m - 1, date.d, 12));
}

/** Convert a JS Date back to { m, d, y }. */
export function fromJS(js) {
  return { m: js.getUTCMonth() + 1, d: js.getUTCDate(), y: js.getUTCFullYear() };
}

const MS_PER_DAY = 86400000;

/** Actual number of days from a to b (b − a). */
export function daysBetweenACT(a, b) {
  return Math.round((toJS(b) - toJS(a)) / MS_PER_DAY);
}

/** 30/360 (US/NASD) day count from a to b. */
export function daysBetween360(a, b) {
  let d1 = a.d;
  let d2 = b.d;
  if (d1 === 31) d1 = 30;
  if (d2 === 31 && d1 === 30) d2 = 30;
  return 360 * (b.y - a.y) + 30 * (b.m - a.m) + (d2 - d1);
}

/** Days between two dates under the chosen method ('ACT' or '360'). */
export function daysBetween(a, b, method = 'ACT') {
  return method === '360' ? daysBetween360(a, b) : daysBetweenACT(a, b);
}

/** Add n actual days to a date. */
export function addDays(date, n) {
  return fromJS(new Date(toJS(date).getTime() + n * MS_PER_DAY));
}

/** Add n months to a date, clamping the day to the month's length. */
export function addMonths(date, n) {
  const total = (date.y * 12 + (date.m - 1)) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { m, d: Math.min(date.d, lastDay), y };
}

/** True if the date's year is a leap year. */
export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
