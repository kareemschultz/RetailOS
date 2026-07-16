// PRESENTATION ONLY. Renders a single backend-authoritative minor value
// (amountMinor + currency + scale, exactly as a commerce DTO carries it). No
// business math — every total/line/tax shown comes from a DTO field (or, in the
// mock layer, from the mock's own precomputed minor values) and is passed here
// only to be displayed. Mirrors apps/web/src/lib/format.ts so money reads
// identically across the admin, POS, and storefront surfaces.
export function formatMoney(
  amountMinor: number,
  currency: string,
  scale: number
): string {
  const value = amountMinor / 10 ** scale;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: scale,
      maximumFractionDigits: scale,
    }).format(value);
  } catch {
    // Unknown/non-ISO currency code: fall back to a plain fixed-scale render so
    // the UI never throws on an exotic tenant currency.
    return `${currency} ${value.toFixed(scale)}`;
  }
}
