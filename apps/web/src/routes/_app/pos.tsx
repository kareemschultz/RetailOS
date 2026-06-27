import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartPanel, type QuoteLineMap } from "@/components/pos/cart-panel";
import { LocationSelector } from "@/components/pos/location-selector";
import { ProductSearch } from "@/components/pos/product-search";
import { QuotePanel } from "@/components/pos/quote-panel";
import { ReceiptPreview } from "@/components/pos/receipt-preview";
import { TenderDialog } from "@/components/pos/tender-dialog";
import type { CreateSaleResult, PosLocation } from "@/components/pos/types";
import { useCart } from "@/components/pos/use-cart";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/pos")({
  component: PosCheckout,
});

function PosCheckout() {
  const [location, setLocation] = useState<PosLocation | null>(null);
  const [tenderOpen, setTenderOpen] = useState(false);
  const [completed, setCompleted] = useState<CreateSaleResult | null>(null);
  const cart = useCart();

  const canQuote = location != null && cart.lines.length > 0;
  const quote = useQuery(
    orpc.pos.quote.queryOptions({
      input: location
        ? { locationId: location.id, lines: cart.lines }
        : { locationId: "", lines: [] },
      enabled: canQuote,
    })
  );

  // Per-sku line totals straight from the quote DTO (cart never computes them).
  const quoteLines: QuoteLineMap = useMemo(() => {
    const map: QuoteLineMap = new Map();
    for (const line of quote.data?.lines ?? []) {
      map.set(line.skuId, line.lineTotalMinor);
    }
    return map;
  }, [quote.data]);

  function onPaid(result: CreateSaleResult) {
    setTenderOpen(false);
    setCompleted(result);
    cart.clear();
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-semibold text-lg">Point of Sale</h1>
        <LocationSelector onSelect={setLocation} value={location?.id ?? null} />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_24rem]">
        {/* Item search — the left, primary column on tablet/desktop. */}
        <Card className="flex min-h-0 flex-col">
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            {location ? (
              <ProductSearch onAdd={(item) => cart.add(item)} />
            ) : (
              <p className="text-muted-foreground text-sm">
                Select a store to start ringing a sale.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Cart + quote — the right rail. */}
        <Card className="flex min-h-0 flex-col">
          <CardHeader>
            <CardTitle className="text-base">
              Cart{cart.count > 0 ? ` · ${cart.count}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col justify-between gap-4">
            <div className="min-h-0 flex-1 overflow-auto">
              <CartPanel
                currency={quote.data?.currency ?? null}
                items={cart.items}
                onRemove={cart.remove}
                onSetQty={cart.setQty}
                quoteLines={quoteLines}
                scale={quote.data?.scale ?? null}
              />
            </div>

            {cart.items.length > 0 ? (
              <QuotePanel
                disabled={!canQuote}
                isError={quote.isError}
                isLoading={quote.isLoading}
                onCharge={() => setTenderOpen(true)}
                onRetry={() => quote.refetch()}
                quote={quote.data}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {location && quote.data ? (
        <TenderDialog
          lines={cart.lines}
          locationId={location.id}
          onOpenChange={setTenderOpen}
          onPaid={onPaid}
          open={tenderOpen}
          quote={quote.data}
        />
      ) : null}

      <Dialog
        onOpenChange={(o) => {
          if (!o) {
            setCompleted(null);
          }
        }}
        open={completed != null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sale {completed?.number} complete</DialogTitle>
          </DialogHeader>
          {completed ? <ReceiptPreview saleId={completed.saleId} /> : null}
          <Button onClick={() => setCompleted(null)}>New sale</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
