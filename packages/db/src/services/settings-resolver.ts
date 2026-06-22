// §6 — ONE reusable strategy/settings resolver. Services must NOT scatter
// ad-hoc config lookups; they resolve through this mechanism.
//
// Resolution order (most specific wins):
//   product → category → location → tenant → platform default
//
// Depth rules:
//   - FINANCIAL-consistency settings (costing method, valuation behavior) must
//     resolve at TENANT or TENANT+CATEGORY at most — arbitrary per-product
//     costing overrides are discouraged (financial integrity). Use
//     `allowedLevelsFor(key)`.
//   - OPERATIONAL/physical settings (tracking mode, UoM, expiry policy, removal
//     strategy, reorder policy, oversell policy) may resolve at any level.
//
// HISTORICAL INTEGRITY (seam #2): this resolver returns the CURRENT effective
// setting. It must NOT be used to re-interpret historical movements — the
// financial strategy actually applied is STAMPED on the movement row at write
// time (`stock_ledger.costing_method_applied`). A later config change therefore
// never silently re-values committed history.

export const RESOLUTION_ORDER = [
  "product",
  "category",
  "location",
  "tenant",
  "platform",
] as const;
export type ResolutionLevel = (typeof RESOLUTION_ORDER)[number];

// Settings whose value must stay financially consistent across a tenant.
export const FINANCIAL_SETTINGS = [
  "costingMethod",
  "valuationBehavior",
] as const;

// Levels a FINANCIAL setting may resolve at (no product/location — depth rule).
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

// The allowed levels for a given setting key (financial ⇒ shallow).
export function allowedLevelsFor(key: string): readonly ResolutionLevel[] {
  return isFinancialSetting(key) ? FINANCIAL_LEVELS : RESOLUTION_ORDER;
}
