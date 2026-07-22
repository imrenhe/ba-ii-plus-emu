# FinCalc — a web-based financial calculator

**FinCalc** is a free, browser-based financial calculator for finance students.
It reproduces the *functional* workflow and key layout of a classic two-line
financial calculator — so students trained on the physical device navigate it
intuitively — with every worksheet driven entirely on the two-line display
(no pop-ups or separate data-entry screens), on both desktop and mobile.

It runs entirely in the browser: **no backend, no accounts, no network calls.**
All math is computed client-side and the whole thing deploys as static files.

> **Independent educational tool.** Not affiliated with, authorized, endorsed by,
> or sponsored by Texas Instruments or any calculator manufacturer. The visual
> design, color scheme and name are original; only the *functional* key layout is
> reproduced, for learning compatibility. No manufacturer logo, trade dress, or
> product name appears in the app.

---

## Features

Every worksheet is **prompt-driven on the LCD**, exactly like the reference
device: open it, step through its labelled fields with `↑`/`↓`, type values and
press `ENTER`, press `CPT` to compute, and `2ND SET` to change a setting.

- **Standard calculator** — arithmetic with **parentheses** and a **Chn / AOS**
  calculation mode (chain vs. algebraic order-of-operations, set in FORMAT);
  `%`, `+/−`, `√x`, `x²`, `1/x`, `yˣ`, `LN`, `eˣ`; full scientific keys:
  `SIN`/`COS`/`TAN` with `INV` and `HYP` modifiers, `x!`, `nPr`, `nCr`, `RAND`;
  `STO`/`RCL` memory registers 0–9. Numbers show thousands separators as you type.
- **Time Value of Money** — `N`, `I/Y`, `PV`, `PMT`, `FV`, `CPT`, with `P/Y`/`C/Y`
  and BEGIN/END (annuity-due) modes.
- **Cash Flow / NPV / IRR** — grouped (repeated-frequency) cash flows; NPV, NFV,
  IRR.
- **Amortization** — interest, principal and balance over any P1–P2 range, from
  the live TVM registers.
- **Bond** — full date handling: settlement/redemption dates, ACT or 30/360
  day-count, coupon frequency, price ↔ yield, and accrued interest.
- **Depreciation** — SL, SYD, DB, DBX (declining balance with crossover to
  straight line) and SLF, with a partial first year (month placed in service).
- **Statistics** — one-variable stats and two-variable regression (LIN, Ln, EXP,
  PWR) with `n`, means, sample/population std dev, sums, `a`/`b`/`r`, and Y′
  prediction.
- **Interest conversion (ICONV)** — nominal ↔ effective rate.
- **Breakeven (BRKEVN)** — solve any of FC, VC, P, Q, PFT.
- **Profit margin (PROFIT)** — solve any of cost, selling price, margin %.
- **Percent change (Δ%)** — OLD, NEW, %CH, #PD (compound growth).
- **Date (DATE)** — days between two dates, or a date plus a day count.
- **Settings** — decimal places, Chn/AOS mode and angle mode (FORMAT), P/Y & C/Y,
  BGN/END, memory (MEM), and full RESET (with a `RST ?` confirmation) — all
  on-screen worksheets.
- **Responsive & touch-friendly** — mobile-first, large tap targets, full
  physical-keyboard support on desktop.

## How to use it

### Standard math & TVM
Type numbers and use `+ − × ÷ =`. For TVM, enter a value then press `N`, `I/Y`,
`PV`, `PMT` or `FV` to store it; press `CPT` then a key to solve for it. Money
out is negative, money in positive. The default `P/Y` and `C/Y` are **1**, so
`N` and `I/Y` are per-period; for monthly problems either set `P/Y = 12` (via
`2ND` `P/Y`) or convert yourself (`N × 12`, `I/Y ÷ 12`).

```
Mortgage payment — $100,000 at 6%/yr, 30 years, monthly (P/Y = C/Y = 1):
  360  N            (30 × 12 periods)
  0.5  I/Y          (6 ÷ 12 per period)
  100000  PV
  0    FV
  CPT  PMT   →   -599.55
```

### Worksheets (all on the LCD)
Press a worksheet key (or `2ND` + the gold label above a key), then:

| Action | Keys |
|---|---|
| Enter a value into the shown field | type digits, `ENTER` |
| Move between fields | `↑` / `↓` |
| Compute the shown field | `CPT` |
| Change a setting (ACT/360, END/BGN, method, model) | `2ND` `SET` |
| Clear the worksheet's data | `2ND` `CLR WORK` |
| Leave the worksheet | `2ND` `QUIT` |

**Opening worksheets:** `CF`, `NPV`, `IRR` are direct keys. The rest are 2ND
functions (press `2ND`, then the key under the gold label):

| Worksheet | Keys | Worksheet | Keys |
|---|---|---|---|
| Amortization | `2ND` `AMORT` (PV) | Depreciation | `2ND` `DEPR` (4) |
| Bond | `2ND` `BOND` (9) | Statistics data | `2ND` `DATA` (7) |
| Statistics results | `2ND` `STAT` (8) | Interest conv. | `2ND` `ICONV` (2) |
| Breakeven | `2ND` `BRKEVN` (6) | Profit margin | `2ND` `PROFIT` (3) |
| Percent change | `2ND` `Δ%` (5) | Date | `2ND` `DATE` (1) |
| P/Y & C/Y | `2ND` `P/Y` (I/Y) | Decimals & angle | `2ND` `FORMAT` (.) |
| BGN/END | `2ND` `BGN` (PMT) | Memory | `2ND` `MEM` (0) |

**Dates** are entered as `MM.DDYYYY` — e.g. `12.312024` `ENTER` → `12-31-2024`.

### Keyboard shortcuts (desktop)
Digits, `+ - * / = .`, `Enter`, `↑`/`↓`, `Backspace` (→), `Esc` (clear),
`c` (CPT), `Shift` (2ND), `q` (quit worksheet), `n` (±).

## Running locally

No build step. Serve the folder with any static file server:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or: npm run serve
```

Opening `index.html` via `file://` will **not** work — native ES modules require
`http(s)://`.

## Tests

Known-answer tests for the whole math engine plus the worksheet/controller flows
run on Node's built-in test runner — no dependencies to install:

```bash
npm test          # or: node --test
```

Coverage includes TVM, NPV/IRR, amortization, dated bonds & accrued interest,
depreciation (incl. partial-year and DBX crossover), interest conversion,
breakeven, profit, percent change, one- and two-variable statistics, scientific
functions, and end-to-end worksheet navigation (`tests/worksheet-flow.test.js`).

## Deploying to GitHub Pages

The repository is already static — **Settings → Pages → Deploy from a branch →
`main` / `/ (root)`**. It goes live at `https://<user>.github.io/<repo>/`.

## Project structure

```
index.html            Single-page shell (calculator + inline guide)
css/styles.css         Responsive styling; exact key matrix, original colors
src/
  engine/              Pure math — no DOM, independently unit-testable
    tvm.js             TVM solver + rate conversion
    cashflow.js        NPV, IRR, NFV, payback
    amort.js           Amortization schedule & range totals
    bond.js            Bond price / yield / accrued interest (with dates)
    depreciation.js    SL / SYD / DB / DBX / SLF, partial-year
    dates.js           Device date parse/format, ACT & 30/360 day counts
    worksheet-math.js  Interest conversion, breakeven, profit, percent change
    statistics.js      One- and two-variable statistics & regression
    sci.js             Trig/hyperbolic/inverse, factorial, nPr/nCr
    util.js            Root-finding + rounding helpers
  format.js            LCD number formatting / parsing
  worksheets.js        Field definitions for every worksheet (prompt lists)
  state.js             Controller: STD mode + prompt-driven worksheet engine
  display.js           Two-line LCD renderer (label = value + indicators)
  keypad.js            Exact key matrix + keyboard mapping
  main.js              Bootstrap, 2ND routing, worksheet navigation
tests/                 node --test known-answer & flow suites
```

The **math engine is fully decoupled from the UI** — every function in
`src/engine/` is pure and imported directly by the tests.

## License

MIT — see [LICENSE](LICENSE).
