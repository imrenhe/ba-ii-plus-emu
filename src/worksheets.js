// worksheets.js — modal overlays for the CF/NPV/IRR, AMORT, BOND, DEPR and STAT
// worksheets. Each panel binds directly to the tested pure-math engine and
// mirrors the corresponding BA II-style worksheet's inputs and computed values.

import { flatten, npv, irr, nfv, payback } from './engine/cashflow.js';
import { schedule, amortRange } from './engine/amort.js';
import { bondPrice, bondYield } from './engine/bond.js';
import { depreciate } from './engine/depreciation.js';
import { oneVarStats } from './engine/statistics.js';
import { formatDisplay } from './format.js';

let overlayEl = null;

function fmt(v, dp = 2) {
  return Number.isNaN(v) || v === undefined || v === null || !isFinite(v)
    ? '—'
    : formatDisplay(v, dp);
}

function openOverlay(title, buildBody) {
  closeOverlay();
  overlayEl = document.createElement('div');
  overlayEl.className = 'ws-overlay';
  overlayEl.innerHTML = `
    <div class="ws-panel" role="dialog" aria-modal="true" aria-label="${title} worksheet">
      <header class="ws-head">
        <h2>${title}</h2>
        <button class="ws-close" aria-label="Close worksheet">✕</button>
      </header>
      <div class="ws-body"></div>
    </div>`;
  document.body.appendChild(overlayEl);
  overlayEl.querySelector('.ws-close').addEventListener('click', closeOverlay);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closeOverlay();
  });
  buildBody(overlayEl.querySelector('.ws-body'));
  const first = overlayEl.querySelector('input, select, button:not(.ws-close)');
  if (first) first.focus();
}

export function closeOverlay() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

// Small DOM helpers -----------------------------------------------------------
function field(label, id, value = '', attrs = {}) {
  const type = attrs.type || 'number';
  const step = attrs.step || 'any';
  return `<label class="ws-field"><span>${label}</span>
    <input id="${id}" type="${type}" step="${step}" inputmode="decimal"
      value="${value}" ${attrs.extra || ''}></label>`;
}
function num(el, id) {
  const v = parseFloat(el.querySelector('#' + id).value);
  return Number.isNaN(v) ? 0 : v;
}
function out(html) {
  return `<div class="ws-out">${html}</div>`;
}

// ── Cash Flow / NPV / IRR ────────────────────────────────────────────────────
export function openCashFlow(container = document.body, initialFocus = 'CF') {
  openOverlay('Cash Flow · NPV · IRR', (body) => {
    body.innerHTML = `
      <p class="ws-hint">Enter the initial outlay (CF0) and each subsequent cash
        flow with how many consecutive periods it repeats (frequency).</p>
      ${field('CF0 (time 0)', 'cf0', '-1000')}
      <div id="cf-rows"></div>
      <div class="ws-row-btns">
        <button type="button" id="cf-add" class="ws-btn">+ Add cash flow</button>
      </div>
      ${field('Discount rate I (%)', 'cf-rate', '10')}
      <div class="ws-actions">
        <button type="button" id="cf-compute" class="ws-btn ws-btn-primary">Compute</button>
      </div>
      <div id="cf-results"></div>`;

    const rowsEl = body.querySelector('#cf-rows');
    const addRow = (amount = '', count = '1') => {
      const idx = rowsEl.children.length + 1;
      const row = document.createElement('div');
      row.className = 'ws-cf-row';
      row.innerHTML = `
        <span class="ws-cf-idx">C${String(idx).padStart(2, '0')}</span>
        <input class="cf-amt" type="number" step="any" inputmode="decimal"
          placeholder="amount" value="${amount}">
        <input class="cf-cnt" type="number" step="1" min="1" inputmode="numeric"
          placeholder="× freq" value="${count}">
        <button type="button" class="ws-x" aria-label="Remove">✕</button>`;
      row.querySelector('.ws-x').addEventListener('click', () => {
        row.remove();
        renumber();
      });
      rowsEl.appendChild(row);
    };
    const renumber = () => {
      [...rowsEl.children].forEach((r, i) => {
        r.querySelector('.ws-cf-idx').textContent = 'C' + String(i + 1).padStart(2, '0');
      });
    };
    // Seed with the classic example.
    addRow('500', '1');
    addRow('400', '1');
    addRow('300', '1');
    addRow('200', '1');
    body.querySelector('#cf-add').addEventListener('click', () => addRow());

    body.querySelector('#cf-compute').addEventListener('click', () => {
      const cf0 = num(body, 'cf0');
      const groups = [...rowsEl.children].map((r) => ({
        amount: parseFloat(r.querySelector('.cf-amt').value) || 0,
        count: Math.max(1, Math.round(parseFloat(r.querySelector('.cf-cnt').value) || 1)),
      }));
      const flows = flatten(cf0, groups);
      const rate = num(body, 'cf-rate');
      const theNPV = npv(rate, flows);
      const theIRR = irr(flows);
      const theNFV = nfv(rate, flows);
      const pb = payback(flows, 0);
      body.querySelector('#cf-results').innerHTML = out(`
        <div class="ws-grid">
          <div><span>NPV</span><strong>${fmt(theNPV)}</strong></div>
          <div><span>IRR</span><strong>${fmt(theIRR, 4)}%</strong></div>
          <div><span>NFV</span><strong>${fmt(theNFV)}</strong></div>
          <div><span>Payback</span><strong>${fmt(pb, 2)}</strong></div>
        </div>`);
    });
  });
}

// ── Amortization ────────────────────────────────────────────────────────────
export function openAmort(calc) {
  const t = calc?.tvm ?? { PV: 100000, PMT: -599.55, IY: 6 };
  openOverlay('Amortization', (body) => {
    body.innerHTML = `
      <p class="ws-hint">Prefilled from your TVM registers. Enter the payment
        range P1–P2 to summarize; a full schedule is shown below.</p>
      ${field('Loan amount (PV)', 'am-pv', Math.abs(t.PV) || 100000)}
      ${field('Payment (PMT)', 'am-pmt', Math.abs(t.PMT) || 0)}
      ${field('Annual rate I/Y (%)', 'am-iy', t.IY || 6)}
      ${field('Periods (N)', 'am-n', Math.round(t.N) || 360, { step: '1' })}
      <div class="ws-two">
        ${field('P/Y', 'am-py', calc?.py ?? 1, { step: '1' })}
        ${field('C/Y', 'am-cy', calc?.cy ?? 1, { step: '1' })}
      </div>
      <div class="ws-two">
        ${field('P1', 'am-p1', 1, { step: '1' })}
        ${field('P2', 'am-p2', 12, { step: '1' })}
      </div>
      <div class="ws-actions">
        <button type="button" id="am-compute" class="ws-btn ws-btn-primary">Compute</button>
      </div>
      <div id="am-results"></div>`;

    body.querySelector('#am-compute').addEventListener('click', () => {
      const loan = num(body, 'am-pv');
      const pmt = num(body, 'am-pmt');
      const iy = num(body, 'am-iy');
      const periods = Math.round(num(body, 'am-n'));
      const py = Math.round(num(body, 'am-py')) || 1;
      const cy = Math.round(num(body, 'am-cy')) || 1;
      const p1 = Math.round(num(body, 'am-p1'));
      const p2 = Math.round(num(body, 'am-p2'));
      const range = amortRange({ loan, pmt, iy, py, cy, p1, p2, periods });
      const rows = schedule({ loan, pmt, iy, py, cy, periods });
      const tableRows = rows
        .filter((r) => r.period >= p1 && r.period <= p2)
        .map(
          (r) => `<tr><td>${r.period}</td><td>${fmt(r.interest)}</td>
            <td>${fmt(r.principal)}</td><td>${fmt(r.balance)}</td></tr>`
        )
        .join('');
      body.querySelector('#am-results').innerHTML =
        out(`<div class="ws-grid">
            <div><span>Principal (P1–P2)</span><strong>${fmt(range.principal)}</strong></div>
            <div><span>Interest (P1–P2)</span><strong>${fmt(range.interest)}</strong></div>
            <div><span>Balance @P2</span><strong>${fmt(range.balance)}</strong></div>
          </div>`) +
        `<div class="ws-table-wrap"><table class="ws-table">
            <thead><tr><th>#</th><th>Interest</th><th>Principal</th><th>Balance</th></tr></thead>
            <tbody>${tableRows}</tbody></table></div>`;
    });
  });
}

// ── Bond ────────────────────────────────────────────────────────────────────
export function openBond() {
  openOverlay('Bond', (body) => {
    body.innerHTML = `
      <p class="ws-hint">Settlement assumed on a coupon date. Price is per 100 of
        face value. Choose what to solve for.</p>
      ${field('Coupon rate (%/yr)', 'bd-coupon', '8')}
      ${field('Periods to maturity', 'bd-n', '20', { step: '1' })}
      ${field('Coupons per year', 'bd-freq', '2', { step: '1' })}
      ${field('Redemption (per 100)', 'bd-redeem', '100')}
      <div class="ws-two">
        ${field('Yield (%/yr)', 'bd-yield', '6')}
        ${field('Price (per 100)', 'bd-price', '')}
      </div>
      <div class="ws-actions">
        <button type="button" id="bd-price-btn" class="ws-btn ws-btn-primary">Compute Price</button>
        <button type="button" id="bd-yield-btn" class="ws-btn">Compute Yield</button>
      </div>
      <div id="bd-results"></div>`;

    const read = () => ({
      couponRate: num(body, 'bd-coupon'),
      periods: Math.round(num(body, 'bd-n')),
      freq: Math.round(num(body, 'bd-freq')) || 2,
      redemption: num(body, 'bd-redeem') || 100,
    });
    body.querySelector('#bd-price-btn').addEventListener('click', () => {
      const p = bondPrice({ ...read(), yieldRate: num(body, 'bd-yield') });
      body.querySelector('#bd-price').value = p.toFixed(4);
      body.querySelector('#bd-results').innerHTML = out(
        `<div class="ws-grid"><div><span>Price</span><strong>${fmt(p, 4)}</strong></div></div>`
      );
    });
    body.querySelector('#bd-yield-btn').addEventListener('click', () => {
      const y = bondYield({ ...read(), price: num(body, 'bd-price') });
      body.querySelector('#bd-yield').value = y.toFixed(4);
      body.querySelector('#bd-results').innerHTML = out(
        `<div class="ws-grid"><div><span>Yield</span><strong>${fmt(y, 4)}%</strong></div></div>`
      );
    });
  });
}

// ── Depreciation ────────────────────────────────────────────────────────────
export function openDepreciation() {
  openOverlay('Depreciation', (body) => {
    body.innerHTML = `
      <label class="ws-field"><span>Method</span>
        <select id="dp-method">
          <option value="SL">Straight line (SL)</option>
          <option value="SYD">Sum-of-years'-digits (SYD)</option>
          <option value="DB">Declining balance (DB)</option>
        </select></label>
      ${field('Cost', 'dp-cost', '10000')}
      ${field('Salvage', 'dp-salvage', '1000')}
      ${field('Life (years)', 'dp-life', '5', { step: '1' })}
      ${field('DB factor (%)', 'dp-factor', '200', { step: '1' })}
      <div class="ws-actions">
        <button type="button" id="dp-compute" class="ws-btn ws-btn-primary">Compute</button>
      </div>
      <div id="dp-results"></div>`;

    body.querySelector('#dp-compute').addEventListener('click', () => {
      const rows = depreciate({
        method: body.querySelector('#dp-method').value,
        cost: num(body, 'dp-cost'),
        salvage: num(body, 'dp-salvage'),
        life: Math.round(num(body, 'dp-life')),
        factor: num(body, 'dp-factor'),
      });
      const tr = rows
        .map(
          (r) => `<tr><td>${r.year}</td><td>${fmt(r.depreciation)}</td>
            <td>${fmt(r.rbv)}</td><td>${fmt(r.rdv)}</td></tr>`
        )
        .join('');
      body.querySelector('#dp-results').innerHTML =
        `<div class="ws-table-wrap"><table class="ws-table">
          <thead><tr><th>Yr</th><th>Depr</th><th>RBV</th><th>RDV</th></tr></thead>
          <tbody>${tr}</tbody></table></div>`;
    });
  });
}

// ── Statistics (1-var) ───────────────────────────────────────────────────────
export function openStatistics() {
  openOverlay('Statistics · 1-Var', (body) => {
    body.innerHTML = `
      <p class="ws-hint">Enter data values separated by commas or spaces. Optional
        weights use <code>value:frequency</code> (e.g. <code>10:3, 20:2</code>).</p>
      <label class="ws-field ws-field-wide"><span>Data (X)</span>
        <textarea id="st-data" rows="3">2, 4, 4, 4, 5, 5, 7, 9</textarea></label>
      <div class="ws-actions">
        <button type="button" id="st-compute" class="ws-btn ws-btn-primary">Compute</button>
      </div>
      <div id="st-results"></div>`;

    body.querySelector('#st-compute').addEventListener('click', () => {
      const raw = body.querySelector('#st-data').value.trim();
      const points = raw
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((tok) => {
          if (tok.includes(':')) {
            const [x, f] = tok.split(':');
            return { x: parseFloat(x), freq: parseFloat(f) || 1 };
          }
          return parseFloat(tok);
        })
        .filter((p) => (typeof p === 'number' ? !Number.isNaN(p) : !Number.isNaN(p.x)));
      const s = oneVarStats(points);
      body.querySelector('#st-results').innerHTML = out(`
        <div class="ws-grid">
          <div><span>n</span><strong>${fmt(s.n, 0)}</strong></div>
          <div><span>x̄ (mean)</span><strong>${fmt(s.mean, 4)}</strong></div>
          <div><span>Sx (sample)</span><strong>${fmt(s.sampleStdDev, 4)}</strong></div>
          <div><span>σx (pop.)</span><strong>${fmt(s.popStdDev, 4)}</strong></div>
          <div><span>ΣX</span><strong>${fmt(s.sumX, 4)}</strong></div>
          <div><span>ΣX²</span><strong>${fmt(s.sumX2, 4)}</strong></div>
        </div>`);
    });
  });
}
