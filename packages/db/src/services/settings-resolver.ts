// §6 — ONE reusable strategy/settings resolver. Services must NOT scatter
// ad-hoc config lookups; they resolve through this mechanism.
//
// Resolution order (most specific wins):
//   product → category → location → tenant → platform default
//
// Depth rules (ADR-0008, resolved toward D1 — 2026-06-22):
//   - By DEFAULT every setting — operational AND financial (costing method) —
//     resolves through the FULL order, so item-level costing is honored (a FIFO
//     pharmacy SKU beside an AVCO grocery SKU is valid, per D1).
//   - `FINANCIAL_LEVELS` is an OPTIONAL cap a caller MAY pass to keep a setting
//     shallow; it is NOT the default for costing. Financial integrity is NOT a
//     depth cap — it is SET-ONCE: `costing_method` is immutable for an item once
//     that item has any stock_ledger movement (enforced in the catalog routers).
//
// HISTORICAL INTEGRITY (seam #2): this resolver returns the CURRENT effective
// setting. It must NOT be used to re-interpret historical movements — the
// financial strategy actually applied is STAMPED on the movement row at write
// time (`stock_ledger.costing_method_applied`, written by applyValuation). A
// later config change therefore never silently re-values committed history, and
// a set-once violation is detectable after the fact.

export const RESOLUTION_ORDER = [
  "product",
  "category",
  "location",
  "tenant",
  "platform",
] as const;
export type ResolutionLevel = (typeof RESOLUTION_ORDER)[number];

// Settings classified as financial (informational; integrity = set-once, not a
// depth cap — see ADR-0008).
export const FINANCIAL_SETTINGS = [
  "costingMethod",
  "valuationBehavior",
] as const;

// OPTIONAL shallow cap a caller may pass explicitly (e.g. a tenant that wants to
// forbid item-level overrides). NOT applied by default — costing resolves at all
// levels per D1.
export const FINANCIAL_LEVELS: readonly ResolutionLevel[] = [
  "category",
  "tenant",
  "platform",
];

export type LevelValues<T> = Partial<
  Record<ResolutionLevel, T | null | undefined>
>;

export interface Resolved<T> {
  source: ResolutionLevel | null;
  value: T | null;
}

// First non-null value across the allowed levels, in resolution order.
export function resolveSetting<T>(
  values: LevelValues<T>,
  allowedLevels: readonly ResolutionLevel[] = RESOLUTION_ORDER
): Resolved<T> {
  for (const level of RESOLUTION_ORDER) {
    if (!allowedLevels.includes(level)) {
      continue;
    }
    const candidate = values[level];
    if (candidate != null) {
      return { source: level, value: candidate };
    }
  }
  return { source: null, value: null };
}

export function isFinancialSetting(key: string): boolean {
  return (FINANCIAL_SETTINGS as readonly string[]).includes(key);
}

// Default allowed levels: the FULL order for every setting (item-level costing
// is honored per D1). A caller that wants a shallow cap passes FINANCIAL_LEVELS
// explicitly to resolveSetting; this default never caps. `key` is accepted for
// call-site symmetry/future per-key policy.
export function allowedLevelsFor(_key: string): readonly ResolutionLevel[] {
  return RESOLUTION_ORDER;
}
