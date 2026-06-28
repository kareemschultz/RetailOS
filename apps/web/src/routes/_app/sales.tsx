import type { AppRouterClient } from "@RetailOS/api/routers/index";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@RetailOS/ui/components/alert";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import { Separator } from "@RetailOS/ui/components/separator";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { cn } from "@RetailOS/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CircleCheck,
  CircleDashed,
  CircleOff,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { LocationSelector } from "@/components/pos/location-selector";
import { ReceiptPreview } from "@/components/pos/receipt-preview";
import type { PosLocation } from "@/components/pos/types";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/sales")({
  component: SalesConsole,
});

type PosClient = AppRouterClient["pos"];
type SaleSearchRow = Awaited<ReturnType<PosClient["saleSearch"]>>[number];
type SaleDetail = Awaited<ReturnType<PosClient["saleDetail"]>>;

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  partial: "Partial",
  void: "Voided",
  voided: "Voided",
};

const REFUND_LABELS: Record<SaleDetail["refundState"]["status"], string> = {
  full: "Fully refunded",
  none: "Not refunded",
  partial: "Partly refunded",
};

function SalesConsole() {
  const searchFieldId = useId();
  const voidReasonId = useId();
  const [location, setLocation] = useState<PosLocation | null>(null);
  const [queryText, setQueryText] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [reprintSaleId, setReprintSaleId] = useState<string | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidKey, setVoidKey] = useState<string | null>(null);

  const trimmedQuery = queryText.trim();
  const searchInput = useMemo(
    () => ({
      limit: 20,
      locationId: location?.id,
      q: trimmedQuery || undefined,
    }),
    [location?.id, trimmedQuery]
  );

  const sales = useQuery(
    orpc.pos.saleSearch.queryOptions({ input: searchInput })
  );
  const detail = useQuery(
    orpc.pos.saleDetail.queryOptions({
      input: { saleId: selectedSaleId ?? "" },
      enabled: selectedSaleId != null,
    })
  );
  const voidSale = useMutation(orpc.pos.void.mutationOptions());

  useEffect(() => {
    if (!sales.data?.length) {
      setSelectedSaleId(null);
      return;
    }
    if (
      !(selectedSaleId && sales.data.some((sale) => sale.id === selectedSaleId))
    ) {
      setSelectedSaleId(sales.data[0]?.id ?? null);
    }
  }, [sales.data, selectedSaleId]);

  function openVoidDialog() {
    if (!selectedSaleId) {
      return;
    }
    setVoidKey(crypto.randomUUID());
    setVoidReason("");
    setVoidDialogOpen(true);
  }

  function confirmVoid() {
    if (!(selectedSaleId && voidKey) || voidSale.isPending) {
      return;
    }
    voidSale.mutate(
      {
        idempotencyKey: voidKey,
        saleId: selectedSaleId,
        voidReason: voidReason.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Sale voided");
          setVoidDialogOpen(false);
          setVoidKey(null);
          detail.refetch();
          sales.refetch();
        },
      }
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Sales</h1>
          <p className="text-muted-foreground">
            Find recent POS sales, reprint receipts, and review post-sale
            actions.
          </p>
        </div>
        <LocationSelector onSelect={setLocation} value={location?.id ?? null} />
      </div>

      <div className="grid min-h-[640px] gap-4 lg:grid-cols-[minmax(360px,440px)_1fr]">
        <Card className="flex min-h-0 flex-col shadow-sm">
          <CardHeader className="border-b">
            <CardTitle>Recent sales</CardTitle>
            <CardDescription>
              Operational lookup is limited to the last 30 days.
            </CardDescription>
            <div className="pt-2">
              <Label className="sr-only" htmlFor={searchFieldId}>
                Search sale number
              </Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  id={searchFieldId}
                  onChange={(event) => setQueryText(event.target.value)}
                  placeholder="Search sale number"
                  value={queryText}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 p-0">
            {sales.isLoading ? <LoadingRows className="p-4" rows={8} /> : null}
            {sales.isError ? (
              <div className="p-4">
                <ErrorState
                  message="Could not load recent sales."
                  onRetry={() => sales.refetch()}
                />
              </div>
            ) : null}
            {sales.data?.length === 0 ? (
              <EmptyState
                description="Try another sale number or clear the location filter."
                icon={ReceiptText}
                title="No recent sales found"
              />
            ) : null}
            {sales.data?.length ? (
              <div className="max-h-[560px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sale</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.data.map((sale) => (
                      <SaleRow
                        isSelected={selectedSaleId === sale.id}
                        key={sale.id}
                        onSelect={() => setSelectedSaleId(sale.id)}
                        sale={sale}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <SaleDetailPanel
          detail={detail.data}
          isError={detail.isError}
          isLoading={detail.isLoading}
          onOpenReprint={(saleId) => setReprintSaleId(saleId)}
          onOpenVoid={openVoidDialog}
          onRetry={() => detail.refetch()}
          selectedSaleId={selectedSaleId}
        />
      </div>

      <Dialog
        onOpenChange={(open) => {
          setVoidDialogOpen(open);
          if (!open) {
            setVoidKey(null);
          }
        }}
        open={voidDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void sale</DialogTitle>
            <DialogDescription>
              This reverses the sale, restocks every line, and marks the receipt
              as voided.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <TriangleAlert />
            <AlertTitle>Review before continuing</AlertTitle>
            <AlertDescription>
              A void is recorded as a new audited transaction and cannot be
              edited afterward.
            </AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2">
            <Label htmlFor={voidReasonId}>Reason</Label>
            <Input
              id={voidReasonId}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="Manager-approved mistake"
              value={voidReason}
            />
          </div>
          {voidSale.isError ? (
            <p className="text-destructive text-sm">{voidSale.error.message}</p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={voidSale.isPending}
              onClick={() => setVoidDialogOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={voidSale.isPending} onClick={confirmVoid}>
              {voidSale.isPending ? "Voiding..." : "Void sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setReprintSaleId(null);
          }
        }}
        open={reprintSaleId != null}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
            <DialogDescription>
              Print or save this receipt copy.
            </DialogDescription>
          </DialogHeader>
          {reprintSaleId ? <ReceiptPreview saleId={reprintSaleId} /> : null}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaleRow({
  sale,
  isSelected,
  onSelect,
}: {
  sale: SaleSearchRow;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <TableRow
      className={cn(
        "cursor-pointer",
        isSelected ? "bg-muted/70 hover:bg-muted" : ""
      )}
      onClick={onSelect}
    >
      <TableCell>
        <div className="min-w-0">
          <p className="truncate font-medium">{sale.number}</p>
          <p className="text-muted-foreground text-xs">
            {new Date(sale.createdAt).toLocaleString()}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <SaleStatusBadge status={sale.status} />
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {formatMoney(sale.totalMinor, sale.currency, sale.scale)}
      </TableCell>
    </TableRow>
  );
}

function SaleDetailPanel({
  selectedSaleId,
  detail,
  isLoading,
  isError,
  onRetry,
  onOpenReprint,
  onOpenVoid,
}: {
  selectedSaleId: string | null;
  detail: SaleDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenReprint: (saleId: string) => void;
  onOpenVoid: () => void;
}) {
  if (!selectedSaleId) {
    return (
      <Card className="shadow-sm">
        <EmptyState
          description="Select a recent sale to view receipt lines and available actions."
          icon={ReceiptText}
          title="Select a sale"
        />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <LoadingRows rows={7} />
        </CardContent>
      </Card>
    );
  }

  if (isError || !detail) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-5">
          <ErrorState message="Could not load sale detail." onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  const receipt = detail.receipt;
  const money = (minor: number) =>
    formatMoney(minor, receipt.currency, receipt.scale);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{receipt.receiptNumber}</CardTitle>
              <CardDescription>
                {receipt.location.name} ·{" "}
                {new Date(receipt.timestamp).toLocaleString()}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <SaleStatusBadge status={receipt.sale.status} />
              <RefundStatusBadge status={detail.refundState.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <SummaryTile label="Total" value={money(receipt.totals.totalMinor)} />
          <SummaryTile
            label="Tendered"
            value={money(receipt.payments.summary.tenderedMinor)}
          />
          <SummaryTile
            label="Change"
            value={money(receipt.payments.summary.changeMinor)}
          />
        </CardContent>
      </Card>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[1fr_300px]">
        <Card className="min-h-0 shadow-sm">
          <CardHeader className="border-b">
            <CardTitle>Receipt lines</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Refunded</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.lines.map((line) => {
                  const refundLine = detail.refundState.lines.find(
                    (state) => state.saleLineId === line.saleLineId
                  );
                  return (
                    <TableRow key={line.saleLineId}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {line.productName ?? line.skuCode ?? "Item"}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {line.skuCode ?? "No SKU"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {line.qty}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {refundLine?.refundedQty ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {money(line.lineTotalMinor)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <CardTitle>Actions</CardTitle>
            <CardDescription>
              Actions reflect your role and the current sale status.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-5">
            <Button
              disabled={!detail.availableActions.canReprint}
              onClick={() => onOpenReprint(receipt.sale.id)}
              variant="outline"
            >
              <Printer data-icon="inline-start" />
              Reprint receipt
            </Button>
            <ActionRow
              active={detail.availableActions.canRefund}
              icon="refund"
              label="Refund"
            />
            {detail.availableActions.canVoid ? (
              <Button onClick={onOpenVoid} variant="outline">
                <CircleOff data-icon="inline-start" />
                Void sale
              </Button>
            ) : (
              <ActionRow active={false} icon="void" label="Void sale" />
            )}
            <Separator />
            <div className="flex items-start gap-2 text-muted-foreground text-xs">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p>Only actions valid for this sale are shown.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-mono font-semibold text-lg tabular-nums">{value}</p>
    </div>
  );
}

function ActionRow({
  active,
  label,
  icon,
}: {
  active: boolean;
  label: string;
  icon: "refund" | "void";
}) {
  const Icon = icon === "refund" ? RotateCcw : CircleOff;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </span>
      <Badge variant="secondary">
        {active ? (
          <CircleCheck data-icon="inline-start" />
        ) : (
          <CircleDashed data-icon="inline-start" />
        )}
        {active ? "Available" : "Unavailable"}
      </Badge>
    </div>
  );
}

function SaleStatusBadge({ status }: { status: string }) {
  const isVoided = status === "void" || status === "voided";
  return (
    <Badge variant={isVoided ? "destructive" : "secondary"}>
      {isVoided ? (
        <CircleOff data-icon="inline-start" />
      ) : (
        <CircleCheck data-icon="inline-start" />
      )}
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function RefundStatusBadge({
  status,
}: {
  status: SaleDetail["refundState"]["status"];
}) {
  return (
    <Badge variant="secondary">
      <RotateCcw data-icon="inline-start" />
      {REFUND_LABELS[status]}
    </Badge>
  );
}
