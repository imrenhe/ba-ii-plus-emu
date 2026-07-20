# FinCalc — a web-based financial calculator

**FinCalc** is a free, browser-based financial calculator for finance students.
It reproduces the *functional* workflow of a classic two-line financial
calculator — Time Value of Money, cash-flow analysis, amortization, bonds,
depreciation and statistics — so students trained on a physical device can
navigate it intuitively, on both desktop and mobile.

It runs entirely in the browser: **no backend, no accounts, no network calls.**
All math is computed client-side and the whole thing deploys as static files.

> **Not affiliated with Texas Instruments.** This is an independent educational
> tool. It is not affiliated with, authorized, endorsed by, or sponsored by
> Texas Instruments. "BA II Plus" and "Texas Instruments" are trademarks of
> their respective owner, used here only nominatively to describe compatibility.
> The visual design, color scheme and name are original.

---

## Features

- **Two-line LCD display** — active variable label on top, value below, with
  `2ND` / `BGN` / `CPT` indicator flags.
- **Time Value of Money** — `N`, `I/Y`, `PV`, `PMT`, `FV`, `CPT`, with
  `P/Y`/`C/Y` (payments & compoundings per year) and BEGIN/END (annuity-due)
  modes.
- **Cash Flow · NPV · IRR** — grouped/repeated cash flows, plus NFV and payback.
- **Amortization** — per-payment schedule and P1–P2 range summaries.
- **Bond** — price ↔ yield on a coupon date, per 100 face value.
- **Depreciation** — straight-line (SL), sum-of-years'-digits (SYD) and
  declining-balance (DB/DDB).
- **Statistics** — one-variable mean, sample & population standard deviation,
  ΣX, ΣX², with optional frequency weights.
- **Standard calculator** — arithmetic, `+/−`, `%`, `√`, `x²`, `1/x`, `yˣ`,
  `LN`, `eˣ`, and `STO`/`RCL` memory registers 0–9.
- **Responsive & touch-friendly** — mobile-first layout, large tap targets,
  full physical-keyboard support on desktop.

## Usage

### Arithmetic
Type numbers and use `+ − × ÷ =` like any calculator. `%` converts the entry to
a decimal (or a percentage of the pending operand).

### Time Value of Money
Enter a value, then press the register key to store it:

```
Example — 30-year mortgage payment on $100,000 at 6%/yr, monthly
  Keep P/Y = 1 and C/Y = 1, and enter the periodic values directly:
  360     N       (30 years × 12 payments = 360 periods)
  0.5     I/Y     (6% per year ÷ 12 = 0.5% per period)
  100000  PV
  0       FV
  CPT     PMT     →   -599.55
```

The default `P/Y` and `C/Y` are **1**, so `N` and `I/Y` are always the number of
periods and the rate *per period*. For non-annual compounding, convert them
yourself — scale `N` by the number of periods per year and divide `I/Y` by that
same number (e.g. monthly → `N × 12`, `I/Y ÷ 12`; semiannual → `N × 2`,
`I/Y ÷ 2`). This keeps every problem on one consistent per-period basis.

**Sign convention** (same as the physical device): money *out* is negative,
money *in* is positive. A loan you receive is `+PV`; the payments you make are
`−PMT`.

### 2ND functions
Press `2ND`, then a key, to use the small label printed above it — for example:

| Keys           | Action                          |
|----------------|---------------------------------|
| `2ND` `I/Y`    | Set P/Y and C/Y                 |
| `2ND` `PMT`    | Toggle BEGIN / END mode         |
| `2ND` `FV`     | Clear the TVM registers         |
| `2ND` `N`      | `xP/Y` — multiply entry by P/Y  |
| `2ND` `.`      | Set decimal places (0–9)        |
| `2ND` `PV`     | Amortization worksheet          |
| `2ND` `9`      | Bond worksheet                  |
| `2ND` `6`      | Depreciation worksheet          |
| `2ND` `8`      | Statistics worksheet            |

Worksheets are also reachable from the labelled tabs above the keypad.

### Keyboard shortcuts (desktop)
Digits, `+ - * / = .`, `Enter` (=), `Backspace` (⌫), `Esc` (clear / close
overlay), `c` (CPT), `Shift` (2ND), `n` (±).

## Running locally

No build step. Serve the folder with any static file server:

```bash
# Python (built in)
python3 -m http.server 8000
# then open http://localhost:8000

# or npm
npm run serve
```

Opening `index.html` directly via `file://` will **not** work because the app
uses native ES modules, which browsers only load over `http(s)://`.

## Tests

Known-answer tests for the math engine (TVM, NPV/IRR, amortization, bonds,
depreciation, statistics) plus the calculator controller run on Node's built-in
test runner — no dependencies to install:

```bash
npm test          # or: node --test
```

Each test file (`tests/*.test.js`) checks classic textbook problems against the
pure functions in `src/engine/`.

## Deploying to GitHub Pages

The repository is already static — just serve it:

1. Push to GitHub.
2. **Settings → Pages → Build and deployment → Deploy from a branch.**
3. Choose your branch and the `/ (root)` folder, then save.
4. The app will be live at `https://<user>.github.io/<repo>/`.

## Project structure

```
index.html            Single-page shell + help dialog
css/styles.css        Responsive, mobile-first styling (original design)
src/
  engine/             Pure math — no DOM, independently unit-testable
    tvm.js            TVM solver + I/Y <-> per-period rate conversion
    cashflow.js       NPV, IRR, NFV, payback
    amort.js          Amortization schedule & range totals
    bond.js           Bond price / yield
    depreciation.js   SL / SYD / DB schedules
    statistics.js     One-variable statistics
    util.js           Root-finding + rounding helpers
  format.js           LCD number formatting / parsing
  state.js            Calculator controller (registers, modes, key logic)
  display.js          Two-line LCD renderer
  keypad.js           Key matrix + keyboard mapping
  worksheets.js       Worksheet overlay panels
  main.js             Bootstrap + event wiring
tests/                node --test known-answer test suites
```

The **math engine is fully decoupled from the UI** — every function in
`src/engine/` is pure and imported directly by the tests, so calculations can be
verified independently of the DOM.

## License

MIT — see [LICENSE](LICENSE).
