import type { Quote } from "../data/commerce-types";
import { formatMoney } from "../lib/format";

// Renders the SERVER-authoritative quote. Every figure here is a DTO field from
// commerce.quote (or the mock's buildMockQuote) — subtotal, per-tax rows, and
// grand total are never recomputed in the UI.
export function OrderSummary({
  quote,
  isLoading,
}: {
  quote: Quote | undefined;
  isLoading: boolean;
}) {
  const currency = quote?.currency ?? "GYD";
  const scale = quote?.scale ?? 2;

  function line(minor: number) {
    return formatMoney(minor, currency, scale);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 font-medium">Order summary</h2>

      {isLoading || !quote ? (
        <div className="flex flex-col gap-3">
          {["subtotal", "tax", "total"].map((k) => (
            <div
              className="h-4 animate-pulse rounded bg-muted motion-reduce:animate-none"
              key={k}
            />
          ))}
        </div>
      ) : (
        <dl className="flex flex-col gap-2.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-mono tabular-nums">
              {line(quote.totals.subtotalMinor)}
            </dd>
          </div>

          {quote.totals.discountMinor > 0 ? (
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <dt>Discount</dt>
              <dd className="font-mono tabular-nums">
                −{line(quote.totals.discountMinor)}
              </dd>
            </div>
          ) : null}

          {quote.taxBreakdown.map((tax) => (
            <div
              className="flex items-center justify-between"
              key={tax.label}
            >
              <dt className="text-muted-foreground">{tax.label}</dt>
              <dd className="font-mono tabular-nums">{line(tax.taxMinor)}</dd>
            </div>
          ))}

          <div className="mt-2 flex items-center justify-between border-border border-t pt-3">
            <dt className="font-semibold">Total</dt>
            <dd className="font-mono font-semibold text-base tabular-nums">
              {line(quote.totals.totalMinor)}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
