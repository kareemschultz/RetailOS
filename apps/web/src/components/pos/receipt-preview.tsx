import { Separator } from "@RetailOS/ui/components/separator";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

import { ErrorState } from "../states";

// Thermal-style preview of pos.receipt. EVERY money value is a DTO field. Every
// reserved seam (fiscal.*, qr.*, barcode.imageUrl, footer.policyText) is null
// today, so each is rendered ONLY when present — a null seam is "not shown",
// never an error or a broken layout.
export function ReceiptPreview({ saleId }: { saleId: string }) {
  const query = useQuery(orpc.pos.receipt.queryOptions({ input: { saleId } }));

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton className="h-4 w-full" key={i} />
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        message="Could not load the receipt."
        onRetry={() => query.refetch()}
      />
    );
  }

  const r = query.data;
  const money = (minor: number) => formatMoney(minor, r.currency, r.scale);

  return (
    <div className="mx-auto w-full max-w-xs rounded-md border bg-card p-4 font-mono text-xs tabular-nums">
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="font-semibold text-sm">{r.company.name}</span>
        <span className="text-muted-foreground">{r.location.name}</span>
        {r.company.taxIdentificationNumber ? (
          <span className="text-muted-foreground">
            TIN {r.company.taxIdentificationNumber}
          </span>
        ) : null}
      </div>

      <Separator className="my-2" />

      <div className="flex justify-between text-muted-foreground">
        <span>{r.receiptNumber}</span>
        <span>{new Date(r.timestamp).toLocaleString()}</span>
      </div>

      <Separator className="my-2" />

      <ul className="flex flex-col gap-1">
        {r.lines.map((line) => (
          <li className="flex justify-between gap-2" key={line.saleLineId}>
            <span className="min-w-0 truncate">
              {line.qty}× {line.productName ?? line.skuCode ?? "Item"}
            </span>
            <span className="shrink-0">{money(line.lineTotalMinor)}</span>
          </li>
        ))}
      </ul>

      <Separator className="my-2" />

      <div className="flex flex-col gap-0.5">
        <Line label="Subtotal" value={money(r.totals.subtotalMinor)} />
        {r.totals.discountMinor > 0 ? (
          <Line label="Discount" value={money(-r.totals.discountMinor)} />
        ) : null}
        <Line label="Tax" value={money(r.totals.taxMinor)} />
        <Line bold label="Total" value={money(r.totals.totalMinor)} />
      </div>

      <Separator className="my-2" />

      <div className="flex flex-col gap-0.5">
        {r.payments.items.map((payment) => (
          <Line
            key={payment.tenderId}
            label={payment.method}
            value={money(payment.amountMinor)}
          />
        ))}
        <Line label="Change" value={money(r.payments.summary.changeMinor)} />
      </div>

      {/* Reserved seams — rendered only when the backend populates them. */}
      {r.fiscal.fiscalNumber ? (
        <>
          <Separator className="my-2" />
          <div className="text-center text-muted-foreground">
            Fiscal: {r.fiscal.fiscalNumber}
          </div>
        </>
      ) : null}

      {r.qr.imageUrl ? (
        <div className="mt-2 flex justify-center">
          <img
            alt="Receipt QR code"
            className="size-24"
            height={96}
            src={r.qr.imageUrl}
            width={96}
          />
        </div>
      ) : null}

      {r.footer.policyText ? (
        <p className="mt-2 text-center text-muted-foreground">
          {r.footer.policyText}
        </p>
      ) : null}
    </div>
  );
}

function Line({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={
        bold ? "flex justify-between font-semibold" : "flex justify-between"
      }
    >
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
