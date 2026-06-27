import { Button } from "@RetailOS/ui/components/button";
import { Separator } from "@RetailOS/ui/components/separator";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { CreditCard } from "lucide-react";

import { formatMoney } from "@/lib/format";

import { ErrorState } from "../states";
import type { SaleQuote } from "./types";

// Renders the money side of pos.quote EXACTLY as the backend computed it. The
// frontend reads totals.* — it never sums lines, applies tax, or rounds.
export function QuotePanel({
  quote,
  isLoading,
  isError,
  disabled,
  onCharge,
  onRetry,
}: {
  quote: SaleQuote | undefined;
  isLoading: boolean;
  isError: boolean;
  disabled: boolean;
  onCharge: () => void;
  onRetry: () => void;
}) {
  if (isError) {
    return (
      <ErrorState message="Could not price this cart." onRetry={onRetry} />
    );
  }

  const money = (minor: number) =>
    quote ? formatMoney(minor, quote.currency, quote.scale) : "—";

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-1.5 text-sm">
        <Row label="Subtotal">
          {isLoading || !quote ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            money(quote.totals.subtotalMinor)
          )}
        </Row>
        {quote && quote.totals.discountMinor > 0 ? (
          <Row label="Discount">{money(-quote.totals.discountMinor)}</Row>
        ) : null}
        <Row label="Tax">
          {isLoading || !quote ? (
            <Skeleton className="h-4 w-12" />
          ) : (
            money(quote.totals.taxMinor)
          )}
        </Row>
      </dl>

      <Separator />

      <div className="flex items-baseline justify-between">
        <span className="font-medium text-sm">Total</span>
        <span className="font-mono font-semibold text-xl tabular-nums">
          {isLoading || !quote ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            money(quote.totals.totalMinor)
          )}
        </span>
      </div>

      <Button
        className="h-12 text-base"
        disabled={disabled || isLoading || !quote}
        onClick={onCharge}
        size="lg"
      >
        <CreditCard className="size-5" />
        Charge
      </Button>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{children}</dd>
    </div>
  );
}
