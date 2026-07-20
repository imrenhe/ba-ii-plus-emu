// worksheet-math.js — the smaller BA II-style worksheets: interest conversion,
// breakeven, profit margin, and percent change. Each solves for one variable
// given the others, mirroring how CPT works on the corresponding prompt.

// ── Interest conversion (ICONV): NOM ↔ EFF given compoundings/year C ──────────
export function nomToEff(nom, c) {
  return (Math.pow(1 + nom / 100 / c, c) - 1) * 100;
}
export function effToNom(eff, c) {
  return (Math.pow(1 + eff / 100, 1 / c) - 1) * c * 100;
}

// ── Breakeven (BRKEVN): PFT = Q·(P − VC) − FC ────────────────────────────────
export const breakeven = {
  FC: ({ Q, P, VC, PFT }) => Q * (P - VC) - PFT,
  VC: ({ FC, Q, P, PFT }) => P - (PFT + FC) / Q,
  P: ({ FC, Q, VC, PFT }) => VC + (PFT + FC) / Q,
  Q: ({ FC, P, VC, PFT }) => (PFT + FC) / (P - VC),
  PFT: ({ FC, Q, P, VC }) => Q * (P - VC) - FC,
};

// ── Profit margin (PROFIT): MAR% = (SEL − CST)/SEL · 100 ─────────────────────
export const profit = {
  CST: ({ SEL, MAR }) => SEL * (1 - MAR / 100),
  SEL: ({ CST, MAR }) => CST / (1 - MAR / 100),
  MAR: ({ CST, SEL }) => ((SEL - CST) / SEL) * 100,
};

// ── Percent change / compound (Δ%): NEW = OLD·(1 + %CH/100)^#PD ───────────────
export const deltaPct = {
  OLD: ({ NEW, CH, PD }) => NEW / Math.pow(1 + CH / 100, PD),
  NEW: ({ OLD, CH, PD }) => OLD * Math.pow(1 + CH / 100, PD),
  CH: ({ OLD, NEW, PD }) => (Math.pow(NEW / OLD, 1 / PD) - 1) * 100,
  PD: ({ OLD, NEW, CH }) => Math.log(NEW / OLD) / Math.log(1 + CH / 100),
};
