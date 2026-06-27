// PRESENTATION ONLY. formatMoney renders a single backend-authoritative minor
// value (amount + currency + scale, exactly as a DTO carries it). It performs
// NO business math: no summing, no tax, no rounding policy, no FX. Every total,
// line total, tax, and change shown in the UI comes from a backend DTO field
// (pos.quote / pos.receipt) and is passed here only to be displayed. This is the
// minor-units → human-readable conversion, not a calculation.
// Bare minor -> major NUMERIC string (e.g. "20.00"), for editable amount inputs
// where a currency-formatted string would be an invalid <input> value. The only
// place outside formatMoney that converts a backend minor value for display, so
// the tender prefill and the receipt/quote display stay in lockstep. Still
// presentation, not a calculation.
export function minorToAmountString(
  amountMinor: number,
  scale: number
): string {
  return (amountMinor / 10 ** scale).toFixed(scale);
}

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
