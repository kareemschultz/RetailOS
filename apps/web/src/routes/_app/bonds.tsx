import type { AppRouterClient } from "@RetailOS/api/routers/index";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import { cn } from "@RetailOS/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  PackageCheck,
  PackageOpen,
  Plus,
  Trash2,
  TriangleAlert,
  Warehouse,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/bonds")({
  component: BondsScreen,
});

type BondClient = AppRouterClient["bond"];
type BondReceiptRow = Awaited<ReturnType<BondClient["receiptList"]>>[number];
type BondReceiptDetail = Awaited<ReturnType<BondClient["receiptDetail"]>>;
type BondReleaseRow = Awaited<ReturnType<BondClient["releaseList"]>>[number];
type LocationRow = Awaited<
  ReturnType<AppRouterClient["location"]["list"]>
>[number];

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
};

const RELEASE_STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  released: "Released",
};

const RELEASE_STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  approved: "default",
  pending: "outline",
  released: "secondary",
};

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

const EM_DASH = "—";

function formatDate(value: string | Date | null): string {
  if (!value) {
    return EM_DASH;
  }
  return new Date(value).toLocaleDateString();
}

// Decimal text → integer minor units at the given scale. The ONLY place a
// user-typed amount becomes a backend money value (same conversion the
// products screen uses). Returns null for invalid/negative input.
function displayToMinor(value: string, scale: number): number | null {
  const parsed = Number(value);
  if (!(Number.isFinite(parsed) && parsed >= 0)) {
    return null;
  }
  return Math.round(parsed * 10 ** scale);
}

function BondStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "closed" ? "secondary" : "default"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function ReleaseStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={RELEASE_STATUS_VARIANTS[status] ?? "outline"}>
      {RELEASE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function TableStateRows({
  emptyDescription,
  emptyTitle,
  errorMessage,
  isError,
  isLoading,
}: {
  emptyDescription: string;
  emptyTitle: string;
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
}) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" />
        </div>
        <p className="font-medium">Couldn’t load bonded records</p>
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

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <PackageOpen className="size-5" />
      </div>
      <p className="font-medium">{emptyTitle}</p>
      <p className="text-muted-foreground text-sm">{emptyDescription}</p>
    </div>
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
  if (isError || isLoading || rows.length === 0) {
    return (
      <TableStateRows
        emptyDescription="Customs-bonded receipts appear here once goods are received into bond."
        emptyTitle="No bond receipts yet"
        errorMessage={errorMessage}
        isError={isError}
        isLoading={isLoading}
      />
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

function ReleasesContent({
  errorMessage,
  isError,
  isLoading,
  onSelect,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onSelect: (id: string) => void;
  rows: BondReleaseRow[];
}) {
  if (isError || isLoading || rows.length === 0) {
    return (
      <TableStateRows
        emptyDescription="Duty-paid releases from bond to store appear here once executed."
        emptyTitle="No bond releases yet"
        errorMessage={errorMessage}
        isError={isError}
        isLoading={isLoading}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[160px]">Number</TableHead>
          <TableHead>Receipt</TableHead>
          <TableHead className="min-w-[220px]">Route</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Created</TableHead>
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
            <TableCell className="font-mono text-muted-foreground text-xs">
              {row.receiptNumber}
            </TableCell>
            <TableCell>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate">{row.sourceLocationName}</span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{row.destLocationName}</span>
              </div>
            </TableCell>
            <TableCell>
              <ReleaseStatusBadge status={row.status} />
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {formatDate(row.createdAt)}
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
                <p className="truncate font-medium">{line.productName}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {line.skuCode}
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

// ── Release history detail ────────────────────────────────────────────────────

function ReleaseDetailDialog({
  locationName,
  onOpenChange,
  releaseId,
}: {
  locationName: (id: string) => string;
  onOpenChange: (open: boolean) => void;
  releaseId: string;
}) {
  const detail = useQuery(
    orpc.bond.releaseDetail.queryOptions({ input: { releaseId } })
  );
  // The release lines carry duty/tax minor units; their currency/scale live on
  // the originating receipt lines. Fetching the receipt for display is a
  // presentation join, not client money math.
  const receipt = useQuery(
    orpc.bond.receiptDetail.queryOptions({
      enabled: detail.data != null,
      input: { bondReceiptId: detail.data?.bondReceiptId ?? "" },
    })
  );

  const costByReceiptLineId = useMemo(() => {
    const map = new Map<string, { currency: string; scale: number }>();
    for (const line of receipt.data?.lines ?? []) {
      map.set(line.id, { currency: line.costCurrency, scale: line.costScale });
    }
    return map;
  }, [receipt.data]);

  const lineMoney = (
    minor: number,
    cost: { currency: string; scale: number } | undefined
  ) => (cost ? formatMoney(minor, cost.currency, cost.scale) : EM_DASH);

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-base">
            {detail.data?.number ?? "Bond release"}
            {detail.data ? (
              <ReleaseStatusBadge status={detail.data.status} />
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Duty-paid release from bond, with per-line duty and tax.
          </DialogDescription>
        </DialogHeader>
        {detail.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : null}
        {detail.isError ? (
          <p className="text-destructive text-sm">
            Could not load this bond release.
          </p>
        ) : null}
        {detail.data ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3">
              <DetailField
                label="From (bonded)"
                value={locationName(detail.data.sourceLocationId)}
              />
              <DetailField
                label="To"
                value={locationName(detail.data.destLocationId)}
              />
              <DetailField
                label="Created"
                value={formatDate(detail.data.createdAt)}
              />
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Duty</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.data.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <p className="truncate font-medium">
                          {line.productName}
                        </p>
                        <p className="truncate text-muted-foreground text-xs">
                          {line.skuCode}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {line.qty}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {lineMoney(
                          line.dutyMinor,
                          costByReceiptLineId.get(line.bondReceiptLineId)
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {lineMoney(
                          line.taxMinor,
                          costByReceiptLineId.get(line.bondReceiptLineId)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

// ── Receive-into-bond mini wizard ─────────────────────────────────────────────

interface DraftReceiptLine {
  costCurrency: string;
  costScale: number;
  key: string;
  label: string;
  productId: string;
  qty: number;
  skuId: string;
  unitCostMinor: number;
}

function DraftReceiptLinesTable({
  lines,
  onRemove,
}: {
  lines: DraftReceiptLine[];
  onRemove: (key: string) => void;
}) {
  if (lines.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-4 text-center text-muted-foreground text-sm">
        No lines yet — pick a SKU, quantity, and unit cost above.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit cost</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.key}>
              <TableCell className="font-medium text-sm">
                {line.label}
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
              <TableCell className="text-right">
                <Button
                  aria-label={`Remove ${line.label}`}
                  onClick={() => onRemove(line.key)}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BondReceiveDialog({
  locations,
  onDone,
  onOpenChange,
}: {
  locations: LocationRow[];
  onDone: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const locationFieldId = useId();
  const supplierFieldId = useId();
  const customsFieldId = useId();
  const landedFieldId = useId();
  const skuFieldId = useId();
  const qtyFieldId = useId();
  const costFieldId = useId();
  const currencyFieldId = useId();
  const scaleFieldId = useId();

  const [locationId, setLocationId] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [customsRef, setCustomsRef] = useState("");
  const [landedRef, setLandedRef] = useState("");
  const [lines, setLines] = useState<DraftReceiptLine[]>([]);
  const [pendingSkuId, setPendingSkuId] = useState("");
  const [pendingQty, setPendingQty] = useState("1");
  const [pendingCost, setPendingCost] = useState("0.00");
  const [pendingCurrency, setPendingCurrency] = useState("GYD");
  const [pendingScale, setPendingScale] = useState("2");

  const skus = useQuery(
    orpc.catalog.skuCatalogList.queryOptions({ input: {} })
  );
  const receive = useMutation(orpc.bond.receive.mutationOptions());

  // The backend only accepts bonded locations (is_bonded=true) for a bond
  // receipt — the picker offers exactly that set (availability mirrors
  // enforcement). companyId travels derived from the picked location.
  const bondedLocations = useMemo(
    () => locations.filter((loc) => loc.isBonded),
    [locations]
  );
  const selectedLocation = bondedLocations.find((loc) => loc.id === locationId);

  function addLine() {
    const sku = (skus.data ?? []).find((row) => row.id === pendingSkuId);
    if (!sku) {
      toast.error("Pick a SKU to add.");
      return;
    }
    const qty = Number.parseInt(pendingQty, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Quantity must be a positive whole number.");
      return;
    }
    const scale = Number.parseInt(pendingScale || "2", 10);
    if (!Number.isInteger(scale) || scale < 0) {
      toast.error("Scale must be a whole number.");
      return;
    }
    const unitCostMinor = displayToMinor(pendingCost, scale);
    if (unitCostMinor == null || unitCostMinor <= 0) {
      toast.error("Bonded stock needs a positive unit cost.");
      return;
    }
    if (pendingCurrency.trim().length !== 3) {
      toast.error("Currency must be a 3-letter code.");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        costCurrency: pendingCurrency.trim().toUpperCase(),
        costScale: scale,
        key: crypto.randomUUID(),
        label: `${sku.productName} · ${sku.code}`,
        productId: sku.productId,
        qty,
        skuId: sku.id,
        unitCostMinor,
      },
    ]);
    setPendingSkuId("");
    setPendingQty("1");
    setPendingCost("0.00");
  }

  async function submit() {
    if (!selectedLocation) {
      toast.error("Pick a bonded location.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one line.");
      return;
    }
    try {
      await receive.mutateAsync({
        companyId: selectedLocation.companyId,
        customsReference: customsRef.trim() || undefined,
        landedCostReference: landedRef.trim() || undefined,
        lines: lines.map((line) => ({
          costCurrency: line.costCurrency,
          costScale: line.costScale,
          productId: line.productId,
          qty: line.qty,
          skuId: line.skuId,
          unitCostMinor: line.unitCostMinor,
        })),
        locationId: selectedLocation.id,
        supplierRef: supplierRef.trim() || undefined,
      });
      toast.success("Goods received into bond");
      onOpenChange(false);
      await onDone();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not record the bond receipt."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Receive into bond</DialogTitle>
          <DialogDescription>
            Record a customs-bonded receipt. Stock stays in the bonded location
            until a duty-paid release moves it to a store.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={locationFieldId}>Bonded location</Label>
            <Select
              onValueChange={(next) => setLocationId(next ?? "")}
              value={locationId}
            >
              <SelectTrigger className="w-full" id={locationFieldId}>
                <SelectValue placeholder="Pick a bonded location" />
              </SelectTrigger>
              <SelectContent>
                {bondedLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bondedLocations.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No bonded locations exist yet — create one under Locations
                first.
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor={supplierFieldId}>Supplier ref</Label>
              <Input
                id={supplierFieldId}
                onChange={(event) => setSupplierRef(event.target.value)}
                placeholder="Optional"
                value={supplierRef}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={customsFieldId}>Customs ref</Label>
              <Input
                id={customsFieldId}
                onChange={(event) => setCustomsRef(event.target.value)}
                placeholder="Optional"
                value={customsRef}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={landedFieldId}>Landed cost ref</Label>
              <Input
                id={landedFieldId}
                onChange={(event) => setLandedRef(event.target.value)}
                placeholder="Optional"
                value={landedRef}
              />
            </div>
          </div>
          <div className="grid gap-2 rounded-md border p-3">
            <p className="font-medium text-sm">Add line</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_5rem]">
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor={skuFieldId}>
                  SKU
                </Label>
                <Select
                  onValueChange={(next) => setPendingSkuId(next ?? "")}
                  value={pendingSkuId}
                >
                  <SelectTrigger className="w-full" id={skuFieldId}>
                    <SelectValue placeholder="Pick a SKU" />
                  </SelectTrigger>
                  <SelectContent>
                    {(skus.data ?? []).map((sku) => (
                      <SelectItem key={sku.id} value={sku.id}>
                        {sku.productName} · {sku.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor={qtyFieldId}>
                  Quantity
                </Label>
                <Input
                  aria-label="Quantity"
                  id={qtyFieldId}
                  min={1}
                  onChange={(event) => setPendingQty(event.target.value)}
                  step={1}
                  type="number"
                  value={pendingQty}
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_5rem_4rem_auto]">
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor={costFieldId}>
                  Unit cost
                </Label>
                <Input
                  aria-label="Unit cost"
                  id={costFieldId}
                  inputMode="decimal"
                  min={0}
                  onChange={(event) => setPendingCost(event.target.value)}
                  step="0.01"
                  type="number"
                  value={pendingCost}
                />
              </div>
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor={currencyFieldId}>
                  Currency
                </Label>
                <Input
                  aria-label="Currency"
                  id={currencyFieldId}
                  maxLength={3}
                  onChange={(event) =>
                    setPendingCurrency(event.target.value.toUpperCase())
                  }
                  value={pendingCurrency}
                />
              </div>
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor={scaleFieldId}>
                  Scale
                </Label>
                <Input
                  aria-label="Scale"
                  id={scaleFieldId}
                  min={0}
                  onChange={(event) => setPendingScale(event.target.value)}
                  type="number"
                  value={pendingScale}
                />
              </div>
              <Button onClick={addLine} variant="outline">
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            <DraftReceiptLinesTable
              lines={lines}
              onRemove={(key) =>
                setLines((prev) => prev.filter((line) => line.key !== key))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={receive.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={receive.isPending} onClick={submit}>
            {receive.isPending ? "Recording…" : "Receive into bond"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Release-from-bond mini wizard ─────────────────────────────────────────────

interface ReleaseLineEntry {
  dutyText: string;
  qtyText: string;
  taxText: string;
}

const EMPTY_RELEASE_ENTRY: ReleaseLineEntry = {
  dutyText: "",
  qtyText: "",
  taxText: "",
};

function ReleaseLineRow({
  entry,
  line,
  onChange,
}: {
  entry: ReleaseLineEntry;
  line: BondReceiptDetail["lines"][number];
  onChange: (patch: Partial<ReleaseLineEntry>) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <p className="truncate font-medium">{line.productName}</p>
        <p className="truncate text-muted-foreground text-xs">
          {line.skuCode} · received {line.qty} @{" "}
          {formatMoney(line.unitCostMinor, line.costCurrency, line.costScale)}
        </p>
      </TableCell>
      <TableCell>
        <Input
          aria-label={`Release quantity for ${line.skuCode}`}
          className="w-20"
          min={0}
          onChange={(event) => onChange({ qtyText: event.target.value })}
          placeholder="0"
          step={1}
          type="number"
          value={entry.qtyText}
        />
      </TableCell>
      <TableCell>
        <Input
          aria-label={`Duty for ${line.skuCode}`}
          className="w-24"
          inputMode="decimal"
          min={0}
          onChange={(event) => onChange({ dutyText: event.target.value })}
          placeholder="0.00"
          step="0.01"
          type="number"
          value={entry.dutyText}
        />
      </TableCell>
      <TableCell>
        <Input
          aria-label={`Tax for ${line.skuCode}`}
          className="w-24"
          inputMode="decimal"
          min={0}
          onChange={(event) => onChange({ taxText: event.target.value })}
          placeholder="0.00"
          step="0.01"
          type="number"
          value={entry.taxText}
        />
      </TableCell>
    </TableRow>
  );
}

interface ReleaseLineInput {
  bondReceiptLineId: string;
  dutyMinor: number;
  qty: number;
  taxMinor: number;
}

// Parse ONE release line's typed entry: null = skip (no quantity entered),
// string = validation error message, otherwise the backend-ready line.
// Duty/tax decimals convert at the LINE's cost currency scale.
function parseReleaseLine(
  line: BondReceiptDetail["lines"][number],
  entry: ReleaseLineEntry
): ReleaseLineInput | string | null {
  const qtyText = entry.qtyText.trim();
  if (!qtyText || qtyText === "0") {
    return null;
  }
  const qty = Number.parseInt(qtyText, 10);
  if (!Number.isInteger(qty) || qty <= 0) {
    return `Quantity for ${line.skuCode} must be a positive whole number.`;
  }
  const dutyMinor = entry.dutyText.trim()
    ? displayToMinor(entry.dutyText, line.costScale)
    : 0;
  const taxMinor = entry.taxText.trim()
    ? displayToMinor(entry.taxText, line.costScale)
    : 0;
  if (dutyMinor == null || taxMinor == null) {
    return `Duty/tax for ${line.skuCode} must be valid amounts.`;
  }
  return { bondReceiptLineId: line.id, dutyMinor, qty, taxMinor };
}

function BondReleaseDialog({
  detail,
  locations,
  onDone,
  onOpenChange,
}: {
  detail: BondReceiptDetail;
  locations: LocationRow[];
  onDone: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const destFieldId = useId();
  const [destId, setDestId] = useState("");
  const [entries, setEntries] = useState<Record<string, ReleaseLineEntry>>({});
  const release = useMutation(orpc.bond.release.mutationOptions());

  // Destination availability mirrors the backend release guards: same company
  // as the receipt, and NOT bonded (a release moves stock OUT of bond).
  // In-transit virtual nodes are excluded as internal plumbing.
  const destOptions = useMemo(
    () =>
      locations.filter(
        (loc) =>
          loc.companyId === detail.receipt.companyId &&
          !loc.isBonded &&
          !loc.isTransit
      ),
    [detail.receipt.companyId, locations]
  );

  function updateEntry(lineId: string, patch: Partial<ReleaseLineEntry>) {
    setEntries((prev) => ({
      ...prev,
      [lineId]: { ...(prev[lineId] ?? EMPTY_RELEASE_ENTRY), ...patch },
    }));
  }

  // Convert the typed decimals to backend minor units per line (see
  // parseReleaseLine). Returns null (with a toast) on bad input.
  function buildLines(): ReleaseLineInput[] | null {
    const built: ReleaseLineInput[] = [];
    for (const line of detail.lines) {
      const parsed = parseReleaseLine(
        line,
        entries[line.id] ?? EMPTY_RELEASE_ENTRY
      );
      if (parsed == null) {
        continue;
      }
      if (typeof parsed === "string") {
        toast.error(parsed);
        return null;
      }
      built.push(parsed);
    }
    return built;
  }

  async function submit() {
    if (!destId) {
      toast.error("Pick a destination location.");
      return;
    }
    const builtLines = buildLines();
    if (builtLines == null) {
      return;
    }
    if (builtLines.length === 0) {
      toast.error("Enter a release quantity on at least one line.");
      return;
    }
    try {
      await release.mutateAsync({
        bondReceiptId: detail.receipt.id,
        destLocationId: destId,
        lines: builtLines,
      });
      toast.success("Bonded stock released");
      onOpenChange(false);
      await onDone();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not release the bonded stock."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Release from bond —{" "}
            <span className="font-mono">{detail.receipt.number}</span>
          </DialogTitle>
          <DialogDescription>
            Move bonded stock to a store location and post the customs duty and
            tax onto its cost. This is recorded as an approved release and
            cannot be edited afterward.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={destFieldId}>Release to</Label>
            <Select
              onValueChange={(next) => setDestId(next ?? "")}
              value={destId}
            >
              <SelectTrigger className="w-full" id={destFieldId}>
                <SelectValue placeholder="Pick a destination location" />
              </SelectTrigger>
              <SelectContent>
                {destOptions.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Duty</TableHead>
                  <TableHead>Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.lines.map((line) => (
                  <ReleaseLineRow
                    entry={entries[line.id] ?? EMPTY_RELEASE_ENTRY}
                    key={line.id}
                    line={line}
                    onChange={(patch) => updateEntry(line.id, patch)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground text-xs">
            Leave a line's quantity at 0 to keep it in bond. Duty and tax are
            entered in each line's cost currency; the backend rejects releasing
            more than is on hand in bond.
          </p>
        </div>
        <DialogFooter>
          <Button
            disabled={release.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={release.isPending} onClick={submit}>
            {release.isPending ? "Releasing…" : "Confirm release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptsCard({
  errorMessage,
  isError,
  isLoading,
  locationName,
  onReceive,
  onSelect,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  locationName: (id: string) => string;
  onReceive: () => void;
  onSelect: (id: string) => void;
  rows: BondReceiptRow[];
}) {
  const settled = !(isLoading || isError);
  return (
    <DataTableCard
      actions={
        <Button onClick={onReceive}>
          <Plus className="size-4" />
          Receive into bond
        </Button>
      }
      count={settled ? rows.length : undefined}
      footer={
        settled && rows.length > 0
          ? `${rows.length} bond receipt${rows.length === 1 ? "" : "s"}`
          : undefined
      }
      title="Bond receipts"
    >
      <ReceiptsContent
        errorMessage={errorMessage}
        isError={isError}
        isLoading={isLoading}
        locationName={locationName}
        onSelect={onSelect}
        rows={rows}
      />
    </DataTableCard>
  );
}

function ReleasesCard({
  errorMessage,
  isError,
  isLoading,
  onSelect,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onSelect: (id: string) => void;
  rows: BondReleaseRow[];
}) {
  const settled = !(isLoading || isError);
  return (
    <DataTableCard
      count={settled ? rows.length : undefined}
      footer={
        settled && rows.length > 0
          ? `${rows.length} release${rows.length === 1 ? "" : "s"}`
          : undefined
      }
      title="Bond releases"
    >
      <ReleasesContent
        errorMessage={errorMessage}
        isError={isError}
        isLoading={isLoading}
        onSelect={onSelect}
        rows={rows}
      />
    </DataTableCard>
  );
}

function ReceiptDetailDialog({
  detail,
  isError,
  isLoading,
  locationName,
  onOpenChange,
  onRelease,
  open,
}: {
  detail: BondReceiptDetail | undefined;
  isError: boolean;
  isLoading: boolean;
  locationName: (id: string) => string;
  onOpenChange: (open: boolean) => void;
  onRelease: () => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className={cn("sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-base">
            {detail?.receipt.number ?? "Bond receipt"}
            {detail ? <BondStatusBadge status={detail.receipt.status} /> : null}
          </DialogTitle>
          <DialogDescription>
            {detail
              ? locationName(detail.receipt.locationId)
              : "Customs-bonded receipt detail."}
          </DialogDescription>
        </DialogHeader>
        <ReceiptDetailBody
          detail={detail}
          isError={isError}
          isLoading={isLoading}
        />
        <DialogFooter showCloseButton>
          {detail && detail.lines.length > 0 ? (
            <Button onClick={onRelease}>
              <PackageCheck className="size-4" />
              Release stock
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BondsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(
    null
  );
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);

  const receipts = useQuery(orpc.bond.receiptList.queryOptions({ input: {} }));
  const releases = useQuery(orpc.bond.releaseList.queryOptions({ input: {} }));
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
  const releaseRows = releases.data ?? [];

  async function refreshAfterRelease() {
    await Promise.all([
      receipts.refetch(),
      releases.refetch(),
      detail.refetch(),
    ]);
  }

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

      <Tabs className="gap-6" defaultValue="receipts">
        <TabsList>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="releases">Releases</TabsTrigger>
        </TabsList>

        <TabsContent value="receipts">
          <ReceiptsCard
            errorMessage={receipts.error?.message}
            isError={receipts.isError}
            isLoading={receipts.isLoading}
            locationName={locationName}
            onReceive={() => setReceiveOpen(true)}
            onSelect={setSelectedId}
            rows={rows}
          />
        </TabsContent>

        <TabsContent value="releases">
          <ReleasesCard
            errorMessage={releases.error?.message}
            isError={releases.isError}
            isLoading={releases.isLoading}
            onSelect={setSelectedReleaseId}
            rows={releaseRows}
          />
        </TabsContent>
      </Tabs>

      <ReceiptDetailDialog
        detail={detail.data}
        isError={detail.isError}
        isLoading={detail.isLoading}
        locationName={locationName}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
        onRelease={() => setReleaseOpen(true)}
        open={selectedId != null}
      />

      {receiveOpen ? (
        <BondReceiveDialog
          locations={locations.data ?? []}
          onDone={async () => {
            await receipts.refetch();
          }}
          onOpenChange={setReceiveOpen}
        />
      ) : null}

      {releaseOpen && detail.data ? (
        <BondReleaseDialog
          detail={detail.data}
          locations={locations.data ?? []}
          onDone={refreshAfterRelease}
          onOpenChange={setReleaseOpen}
        />
      ) : null}

      {selectedReleaseId ? (
        <ReleaseDetailDialog
          locationName={locationName}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedReleaseId(null);
            }
          }}
          releaseId={selectedReleaseId}
        />
      ) : null}
    </div>
  );
}
