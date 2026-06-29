import type { AppRouterClient } from "@RetailOS/api/routers/index";
import { Badge } from "@RetailOS/ui/components/badge";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
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
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PackageOpen, TriangleAlert, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/bonds")({
  component: BondsScreen,
});

type BondClient = AppRouterClient["bond"];
type BondReceiptRow = Awaited<ReturnType<BondClient["receiptList"]>>[number];
type BondReceiptDetail = Awaited<ReturnType<BondClient["receiptDetail"]>>;

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
};

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

const EM_DASH = "—";

function formatDate(value: string | Date | null): string {
  if (!value) {
    return EM_DASH;
  }
  return new Date(value).toLocaleDateString();
}

function BondStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "closed" ? "secondary" : "default"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function ReceiptsContent({
  isLoading,
  isError,
  errorMessage,
  rows,
  locationName,
  onSelect,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  rows: BondReceiptRow[];
  locationName: (id: string) => string;
  onSelect: (id: string) => void;
}) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" />
        </div>
        <p className="font-medium">Couldn’t load bond receipts</p>
        <p className="text-muted-foreground text-sm">
          {errorMessage ?? "Check your connection or permissions and retry."}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((k) => (
          <Skeleton className="h-[64px] rounded-none" key={k} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PackageOpen className="size-5" />
        </div>
        <p className="font-medium">No bond receipts yet</p>
        <p className="text-muted-foreground text-sm">
          Customs-bonded receipts appear here once goods are received into bond.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[160px]">Number</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Supplier ref</TableHead>
          <TableHead>Customs ref</TableHead>
          <TableHead className="text-right">Received</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            className="cursor-pointer"
            key={row.id}
            onClick={() => onSelect(row.id)}
          >
            <TableCell className="font-medium font-mono text-xs">
              {row.number}
            </TableCell>
            <TableCell>{locationName(row.locationId)}</TableCell>
            <TableCell>
              <BondStatusBadge status={row.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.supplierRef ?? EM_DASH}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.customsReference ?? EM_DASH}
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {formatDate(row.receivedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

function ReceiptLinesTable({ lines }: { lines: BondReceiptDetail["lines"] }) {
  if (lines.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-muted-foreground text-sm">
        This receipt has no lines.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell>
                <p className="truncate font-mono text-xs">{line.skuId}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {line.productId}
                </p>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {line.qty}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatMoney(
                  line.unitCostMinor,
                  line.costCurrency,
                  line.costScale
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReceiptDetailBody({
  isLoading,
  isError,
  detail,
}: {
  isLoading: boolean;
  isError: boolean;
  detail: BondReceiptDetail | undefined;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <p className="text-destructive text-sm">
        Could not load this bond receipt.
      </p>
    );
  }

  const { receipt, lines } = detail;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <DetailField
          label="Supplier ref"
          value={receipt.supplierRef ?? EM_DASH}
        />
        <DetailField
          label="Customs ref"
          value={receipt.customsReference ?? EM_DASH}
        />
        <DetailField
          label="Landed cost ref"
          value={receipt.landedCostReference ?? EM_DASH}
        />
        <DetailField label="Received" value={formatDate(receipt.receivedAt)} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-medium text-sm">Lines</p>
        <ReceiptLinesTable lines={lines} />
      </div>
    </div>
  );
}

function BondsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const receipts = useQuery(orpc.bond.receiptList.queryOptions({ input: {} }));
  const locations = useQuery(orpc.location.list.queryOptions({ input: {} }));
  const detail = useQuery(
    orpc.bond.receiptDetail.queryOptions({
      input: { bondReceiptId: selectedId ?? "" },
      enabled: selectedId != null,
    })
  );

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const loc of locations.data ?? []) {
      map.set(loc.id, loc.name);
    }
    return map;
  }, [locations.data]);

  const locationName = (id: string) => locationNameById.get(id) ?? id;

  const rows = receipts.data ?? [];
  const settled = !(receipts.isLoading || receipts.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
          <Warehouse className="size-5" />
        </div>
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Bonded goods
          </h1>
          <p className="text-muted-foreground">
            Customs-bonded receipts and releases.
          </p>
        </div>
      </div>

      <DataTableCard
        count={settled ? rows.length : undefined}
        footer={
          settled && rows.length > 0
            ? `${rows.length} bond receipt${rows.length === 1 ? "" : "s"}`
            : undefined
        }
        title="Bond receipts"
      >
        <ReceiptsContent
          errorMessage={receipts.error?.message}
          isError={receipts.isError}
          isLoading={receipts.isLoading}
          locationName={locationName}
          onSelect={setSelectedId}
          rows={rows}
        />
      </DataTableCard>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
        open={selectedId != null}
      >
        <DialogContent className={cn("sm:max-w-2xl")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-base">
              {detail.data?.receipt.number ?? "Bond receipt"}
              {detail.data ? (
                <BondStatusBadge status={detail.data.receipt.status} />
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {detail.data
                ? locationName(detail.data.receipt.locationId)
                : "Customs-bonded receipt detail."}
            </DialogDescription>
          </DialogHeader>
          <ReceiptDetailBody
            detail={detail.data}
            isError={detail.isError}
            isLoading={detail.isLoading}
          />
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
