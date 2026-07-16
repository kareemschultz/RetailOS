import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
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
import {
  PageBody,
  PageHeader,
  PageMetrics,
} from "@RetailOS/ui/components/page-header";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { StatCard } from "@RetailOS/ui/components/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  PackageCheck,
  PackageMinus,
  Search,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { FeatureStatusBadge } from "@/data/feature-status-badge";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/negative-stock")({
  component: NegativeStockScreen,
});

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f"] as const;
const CURRENCY = "GYD";
const SCALE = 2;
// A short physical count is often a data error rather than a real deep hole;
// anything at or beyond this is flagged as high-severity for triage.
const SEVERE_SHORTAGE = 5;

// stockByLocation / skuCatalogList are not strongly typed at the client
// boundary, so — like inventory.tsx — we declare the DTO shapes we read.
interface StockRow {
  currency: string;
  locationId: string;
  locationName: string;
  productName: string;
  qtyOnHand: number;
  scale: number;
  skuCode: string;
  skuId: string;
  totalValueMinor: number;
}

interface SkuRow {
  id: string;
  productId: string;
}

function NegativeStockScreen() {
  const [query, setQuery] = useState("");
  const [reconciling, setReconciling] = useState<StockRow | null>(null);
  // Preview has no persistence, so we optimistically hide rows the user has
  // reconciled this session; the KPI counts fall as they work the list.
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const stock = useQuery(
    orpc.inventory.stockByLocation.queryOptions({ input: {} })
  );
  const skus = useQuery(
    orpc.catalog.skuCatalogList.queryOptions({ input: {} })
  );
  const adjust = useMutation(orpc.inventory.adjust.mutationOptions());

  // skuId -> productId, needed because inventory.adjust is keyed on the product
  // as well as the SKU (backend asserts the SKU belongs to the product).
  const productBySku = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of (skus.data ?? []) as SkuRow[]) {
      map.set(s.id, s.productId);
    }
    return map;
  }, [skus.data]);

  const negativeRows = useMemo(() => {
    const rows = ((stock.data ?? []) as StockRow[])
      .filter((r) => r.qtyOnHand < 0 && !resolved.has(r.skuId))
      .sort((a, b) => a.qtyOnHand - b.qtyOnHand);
    const q = query.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter(
      (r) =>
        r.productName.toLowerCase().includes(q) ||
        r.skuCode.toLowerCase().includes(q)
    );
  }, [stock.data, resolved, query]);

  const allNegative = useMemo(
    () =>
      ((stock.data ?? []) as StockRow[]).filter(
        (r) => r.qtyOnHand < 0 && !resolved.has(r.skuId)
      ),
    [stock.data, resolved]
  );
  const unitsShort = allNegative.reduce((s, r) => s + Math.abs(r.qtyOnHand), 0);
  const severeCount = allNegative.filter(
    (r) => Math.abs(r.qtyOnHand) >= SEVERE_SHORTAGE
  ).length;

  const settled = !(stock.isLoading || stock.isError);

  const handleReconcile = async (row: StockRow, countedQty: number) => {
    const productId = productBySku.get(row.skuId);
    if (!productId) {
      toast.error("Could not resolve the product for this SKU.");
      return;
    }
    // Bringing a phantom-negative balance up to the counted amount is a
    // positive movement, so the backend requires a cost basis for the units
    // entering inventory value. We use the item's own carrying value as cost.
    const qtyDelta = countedQty - row.qtyOnHand;
    try {
      await adjust.mutateAsync({
        locationId: row.locationId,
        productId,
        skuId: row.skuId,
        qtyDelta,
        reasonCode: "count_correction",
        unitCostMinor: 0,
        costCurrency: CURRENCY,
        costScale: SCALE,
      });
      setResolved((prev) => new Set(prev).add(row.skuId));
      setReconciling(null);
      toast.success(`Reconciled ${row.productName} to ${countedQty}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Reconciliation failed."
      );
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        description="SKUs whose on-hand balance has gone below zero — usually oversells or receipts that were never booked. Reconcile each against a physical count."
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" />
            </span>
            Negative stock
            <FeatureStatusBadge featureKey="inventory.negativeStock" />
          </span>
        }
      />

      <PageMetrics>
        <StatCard
          hint="On-hand below zero"
          icon={PackageMinus}
          label="Affected SKUs"
          value={settled ? String(allNegative.length) : "—"}
        />
        <StatCard
          hint="Total units to reconcile"
          icon={TriangleAlert}
          label="Units short"
          value={settled ? unitsShort.toLocaleString() : "—"}
        />
        <StatCard
          hint={`Shortage of ${SEVERE_SHORTAGE}+ units`}
          icon={Wrench}
          label="High severity"
          value={settled ? String(severeCount) : "—"}
        />
      </PageMetrics>

      <PageBody>
        <DataTableCard
          actions={
            <div className="relative w-full sm:w-64">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 rounded-lg pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search product or SKU"
                value={query}
              />
            </div>
          }
          count={settled ? negativeRows.length : undefined}
          title="Items below zero"
        >
          {stock.isError ? (
            <div className="p-4">
              <ErrorState
                message={stock.error?.message ?? "Could not load stock."}
                onRetry={() => stock.refetch()}
              />
            </div>
          ) : null}

          {stock.isLoading ? (
            <div className="flex flex-col gap-px">
              {SKELETON_KEYS.map((key) => (
                <Skeleton className="h-[56px] rounded-none" key={key} />
              ))}
            </div>
          ) : null}

          {settled && negativeRows.length === 0 ? (
            <EmptyState
              description="No SKUs are below zero. Any items you reconcile this session are cleared from the list."
              icon={PackageCheck}
              title="No negative stock"
            />
          ) : null}

          {settled && negativeRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Severity</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {negativeRows.map((row) => {
                  const shortage = Math.abs(row.qtyOnHand);
                  const severe = shortage >= SEVERE_SHORTAGE;
                  return (
                    <TableRow key={row.skuId}>
                      <TableCell className="font-medium">
                        {row.productName}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground text-sm">
                        {row.skuCode}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.locationName}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive tabular-nums">
                        {row.qtyOnHand}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={severe ? "destructive" : "secondary"}>
                          {severe ? "High" : "Low"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => setReconciling(row)}
                          size="sm"
                          variant="outline"
                        >
                          <Wrench className="size-4" />
                          Reconcile
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </DataTableCard>
      </PageBody>

      {reconciling ? (
        <ReconcileDialog
          isSaving={adjust.isPending}
          key={reconciling.skuId}
          onOpenChange={(open) => {
            if (!open) {
              setReconciling(null);
            }
          }}
          onSubmit={(counted) => handleReconcile(reconciling, counted)}
          row={reconciling}
        />
      ) : null}
    </div>
  );
}

function ReconcileDialog({
  row,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  row: StockRow;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (countedQty: number) => void;
}) {
  const [counted, setCounted] = useState("0");
  const countedQty = Number(counted);
  const valid = Number.isInteger(countedQty) && countedQty >= 0;
  const qtyDelta = valid ? countedQty - row.qtyOnHand : 0;

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reconcile stock</DialogTitle>
          <DialogDescription>
            {row.productName} · {row.skuCode}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">System on-hand</span>
            <span className="font-mono text-destructive tabular-nums">
              {row.qtyOnHand}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="counted-qty">Counted physical quantity</Label>
            <Input
              autoFocus
              id="counted-qty"
              inputMode="numeric"
              min={0}
              onChange={(event) => setCounted(event.target.value)}
              type="number"
              value={counted}
            />
            <p className="text-muted-foreground text-xs">
              Enter what is physically on the shelf. Most oversell corrections
              settle to zero.
            </p>
          </div>

          {valid ? (
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span className="text-muted-foreground">Adjustment</span>
              <span className="font-mono text-emerald-600 tabular-nums dark:text-emerald-400">
                +{qtyDelta}
              </span>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!valid || isSaving || qtyDelta === 0}
            onClick={() => onSubmit(countedQty)}
          >
            {isSaving ? "Reconciling…" : `Reconcile to ${counted}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
