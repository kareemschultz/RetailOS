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
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ClipboardList,
  FileText,
  Package,
  Plus,
  Trash2,
  Truck,
  Users,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/procurement")({
  component: ProcurementScreen,
});

type ProcurementClient = AppRouterClient["procurement"];
type SupplierRow = Awaited<
  ReturnType<ProcurementClient["supplierList"]>
>[number];
type PurchaseOrderRow = Awaited<
  ReturnType<ProcurementClient["purchaseOrderList"]>
>[number];
type PurchaseOrderDetail = Awaited<
  ReturnType<ProcurementClient["purchaseOrderDetail"]>
>;
type GoodsReceiptDetail = Awaited<
  ReturnType<ProcurementClient["goodsReceiptDetail"]>
>;

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

const PO_STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  billed: "secondary",
  cancelled: "destructive",
  draft: "outline",
  partially_billed: "default",
  partially_received: "default",
  received: "secondary",
};

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={PO_STATUS_VARIANTS[status] ?? "outline"}>
      {statusLabel(status)}
    </Badge>
  );
}

function formatDate(value: Date | string | null): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

// ── Suppliers ─────────────────────────────────────────────────────────────

function SuppliersTable({ rows }: { rows: SupplierRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">{row.code}</TableCell>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-muted-foreground">
              {row.email ?? "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.phone ?? "—"}
            </TableCell>
            <TableCell>
              <Badge
                variant={row.status === "active" ? "outline" : "secondary"}
              >
                {statusLabel(row.status)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CreateSupplierDialog({
  onCreated,
  onOpenChange,
}: {
  onCreated: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const codeFieldId = useId();
  const nameFieldId = useId();
  const emailFieldId = useId();
  const phoneFieldId = useId();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const createSupplier = useMutation(
    orpc.procurement.supplierCreate.mutationOptions()
  );

  async function submit() {
    if (!(code.trim() && name.trim())) {
      toast.error("Code and name are required.");
      return;
    }
    try {
      await createSupplier.mutateAsync({
        code: code.trim(),
        email: email.trim() || undefined,
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      toast.success("Supplier created");
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create supplier."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New supplier</DialogTitle>
          <DialogDescription>
            Suppliers can then be picked when creating purchase orders.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={codeFieldId}>Code</Label>
            <Input
              id={codeFieldId}
              onChange={(event) => setCode(event.target.value)}
              placeholder="SUP-001"
              value={code}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={nameFieldId}>Name</Label>
            <Input
              id={nameFieldId}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme Distribution"
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={emailFieldId}>Email (optional)</Label>
            <Input
              id={emailFieldId}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={phoneFieldId}>Phone (optional)</Label>
            <Input
              id={phoneFieldId}
              onChange={(event) => setPhone(event.target.value)}
              value={phone}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={createSupplier.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={createSupplier.isPending} onClick={submit}>
            {createSupplier.isPending ? "Creating…" : "Create supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuppliersPanel() {
  const [createOpen, setCreateOpen] = useState(false);
  const suppliers = useQuery(
    orpc.procurement.supplierList.queryOptions({ input: {} })
  );
  const rows = suppliers.data ?? [];
  const settled = !(suppliers.isLoading || suppliers.isError);

  return (
    <>
      <DataTableCard
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New supplier
          </Button>
        }
        count={settled ? rows.length : undefined}
        title="Suppliers"
      >
        {suppliers.isError ? (
          <div className="p-4">
            <ErrorState
              message={suppliers.error?.message ?? "Could not load suppliers."}
              onRetry={() => suppliers.refetch()}
            />
          </div>
        ) : null}
        {!suppliers.isError && suppliers.isLoading ? (
          <div className="flex flex-col gap-px">
            {SKELETON_KEYS.map((key) => (
              <Skeleton className="h-[52px] rounded-none" key={key} />
            ))}
          </div>
        ) : null}
        {!(suppliers.isError || suppliers.isLoading) && rows.length === 0 ? (
          <EmptyState
            description="Add a supplier before creating purchase orders."
            icon={Users}
            title="No suppliers yet"
          />
        ) : null}
        {!(suppliers.isError || suppliers.isLoading) && rows.length > 0 ? (
          <SuppliersTable rows={rows} />
        ) : null}
      </DataTableCard>
      {createOpen ? (
        <CreateSupplierDialog
          onCreated={async () => {
            await suppliers.refetch();
          }}
          onOpenChange={setCreateOpen}
        />
      ) : null}
    </>
  );
}

// ── Purchase orders: create ──────────────────────────────────────────────

interface DraftPoLine {
  key: string;
  label: string;
  productId: string;
  qty: number;
  skuId: string;
  unitCostMinor: number;
}

function DraftPoLinesTable({
  currency,
  lines,
  onRemove,
  scale,
}: {
  currency: string;
  lines: DraftPoLine[];
  onRemove: (key: string) => void;
  scale: number;
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
                {formatMoney(line.unitCostMinor, currency, scale)}
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

function CreatePurchaseOrderDialog({
  onCreated,
  onOpenChange,
  suppliers,
}: {
  onCreated: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierRow[];
}) {
  const numberFieldId = useId();
  const companyFieldId = useId();
  const supplierFieldId = useId();
  const skuFieldId = useId();
  const qtyFieldId = useId();
  const costFieldId = useId();

  const [number, setNumber] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<DraftPoLine[]>([]);
  const [pendingSkuId, setPendingSkuId] = useState("");
  const [pendingQty, setPendingQty] = useState("1");
  const [pendingCost, setPendingCost] = useState("0.00");

  const companies = useQuery(orpc.company.list.queryOptions({ input: {} }));
  const skus = useQuery(
    orpc.catalog.skuCatalogList.queryOptions({ input: {} })
  );
  const createPurchaseOrder = useMutation(
    orpc.procurement.purchaseOrderCreate.mutationOptions()
  );

  const currency = "USD";
  const scale = 2;

  function addLine() {
    const sku = (skus.data ?? []).find((row) => row.id === pendingSkuId);
    const qty = Number.parseInt(pendingQty, 10);
    const costAmount = Number.parseFloat(pendingCost);
    if (!sku) {
      toast.error("Pick a SKU to add.");
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Quantity must be a positive whole number.");
      return;
    }
    if (!Number.isFinite(costAmount) || costAmount < 0) {
      toast.error("Unit cost must be zero or a positive amount.");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        label: `${sku.productName} · ${sku.code}`,
        productId: sku.productId,
        qty,
        skuId: sku.id,
        unitCostMinor: Math.round(costAmount * 10 ** scale),
      },
    ]);
    setPendingSkuId("");
    setPendingQty("1");
    setPendingCost("0.00");
  }

  async function submit() {
    if (!(number.trim() && companyId && supplierId)) {
      toast.error("Number, company, and supplier are required.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one line.");
      return;
    }
    try {
      await createPurchaseOrder.mutateAsync({
        companyId,
        currency,
        lines: lines.map((line) => ({
          productId: line.productId,
          qtyOrdered: line.qty,
          skuId: line.skuId,
          unitCostMinor: line.unitCostMinor,
        })),
        number: number.trim(),
        scale,
        supplierId,
      });
      toast.success("Purchase order created as draft");
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create purchase order."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New purchase order</DialogTitle>
          <DialogDescription>
            Starts as a draft. Receive goods and record bills against it once
            it's created.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={numberFieldId}>PO number</Label>
            <Input
              id={numberFieldId}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="PO-1001"
              value={number}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={companyFieldId}>Company</Label>
              <Select
                onValueChange={(next) => setCompanyId(next ?? "")}
                value={companyId}
              >
                <SelectTrigger className="w-full" id={companyFieldId}>
                  <SelectValue placeholder="Pick a company" />
                </SelectTrigger>
                <SelectContent>
                  {(companies.data ?? []).map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={supplierFieldId}>Supplier</Label>
              <Select
                onValueChange={(next) => setSupplierId(next ?? "")}
                value={supplierId}
              >
                <SelectTrigger className="w-full" id={supplierFieldId}>
                  <SelectValue placeholder="Pick a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2 rounded-md border p-3">
            <p className="font-medium text-sm">Add line</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_5rem_6rem_auto]">
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
                  id={qtyFieldId}
                  min={1}
                  onChange={(event) => setPendingQty(event.target.value)}
                  step={1}
                  type="number"
                  value={pendingQty}
                />
              </div>
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor={costFieldId}>
                  Unit cost
                </Label>
                <Input
                  id={costFieldId}
                  min={0}
                  onChange={(event) => setPendingCost(event.target.value)}
                  step="0.01"
                  type="number"
                  value={pendingCost}
                />
              </div>
              <Button onClick={addLine} variant="outline">
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            <DraftPoLinesTable
              currency={currency}
              lines={lines}
              onRemove={(key) =>
                setLines((prev) => prev.filter((line) => line.key !== key))
              }
              scale={scale}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={createPurchaseOrder.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={createPurchaseOrder.isPending} onClick={submit}>
            {createPurchaseOrder.isPending ? "Creating…" : "Create draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Purchase orders: list ────────────────────────────────────────────────

function PurchaseOrdersTable({
  onSelect,
  rows,
}: {
  onSelect: (id: string) => void;
  rows: PurchaseOrderRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
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
            <TableCell>{row.supplierName}</TableCell>
            <TableCell className="text-muted-foreground">
              {row.companyName}
            </TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatDate(row.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Purchase order detail: receive + bill ────────────────────────────────

function ReceiveGoodsDialog({
  detail,
  onDone,
  onOpenChange,
}: {
  detail: PurchaseOrderDetail;
  onDone: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const numberFieldId = useId();
  const locationFieldId = useId();
  const [number, setNumber] = useState("");
  const [locationId, setLocationId] = useState("");
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});

  const locations = useQuery(
    orpc.location.list.queryOptions({
      input: { companyId: detail.header.companyId },
    })
  );
  const receiveGoods = useMutation(
    orpc.procurement.goodsReceiptCreate.mutationOptions()
  );

  const outstandingLines = useMemo(
    () => detail.lines.filter((line) => line.qtyReceived < line.qtyOrdered),
    [detail.lines]
  );

  async function submit() {
    if (!(number.trim() && locationId)) {
      toast.error("Receipt number and location are required.");
      return;
    }
    const lines = outstandingLines
      .map((line) => ({
        purchaseOrderLineId: line.id,
        qtyReceived: Number.parseInt(qtyByLine[line.id] ?? "0", 10),
      }))
      .filter(
        (line) => Number.isInteger(line.qtyReceived) && line.qtyReceived > 0
      );
    if (lines.length === 0) {
      toast.error("Enter a quantity for at least one line.");
      return;
    }
    try {
      await receiveGoods.mutateAsync({
        lines,
        locationId,
        number: number.trim(),
        purchaseOrderId: detail.header.id,
      });
      toast.success("Goods received");
      onOpenChange(false);
      await onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not receive goods."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive goods</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{detail.header.number}</span> — record
            what actually arrived. Partial receipts are fine; receive the rest
            later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={numberFieldId}>GRN number</Label>
              <Input
                id={numberFieldId}
                onChange={(event) => setNumber(event.target.value)}
                placeholder="GRN-1001"
                value={number}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={locationFieldId}>Receiving location</Label>
              <Select
                onValueChange={(next) => setLocationId(next ?? "")}
                value={locationId}
              >
                <SelectTrigger className="w-full" id={locationFieldId}>
                  <SelectValue placeholder="Pick a location" />
                </SelectTrigger>
                <SelectContent>
                  {(locations.data ?? []).map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {outstandingLines.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Every line on this purchase order has already been fully received.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="w-28 text-right">
                      Receive now
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outstandingLines.map((line) => {
                    const outstanding = line.qtyOrdered - line.qtyReceived;
                    return (
                      <TableRow key={line.id}>
                        <TableCell className="text-sm">
                          {line.productName} · {line.skuCode}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {outstanding}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="text-right"
                            max={outstanding}
                            min={0}
                            onChange={(event) =>
                              setQtyByLine((prev) => ({
                                ...prev,
                                [line.id]: event.target.value,
                              }))
                            }
                            type="number"
                            value={qtyByLine[line.id] ?? ""}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={receiveGoods.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={receiveGoods.isPending || outstandingLines.length === 0}
            onClick={submit}
          >
            {receiveGoods.isPending ? "Receiving…" : "Record receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateBillDialog({
  detail,
  onDone,
  onOpenChange,
}: {
  detail: PurchaseOrderDetail;
  onDone: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const numberFieldId = useId();
  const receiptFieldId = useId();
  const [number, setNumber] = useState("");
  const [receiptId, setReceiptId] = useState(detail.receipts[0]?.id ?? "");
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});

  const receiptDetail = useQuery(
    orpc.procurement.goodsReceiptDetail.queryOptions({
      enabled: receiptId !== "",
      input: { id: receiptId },
    })
  );
  const createBill = useMutation(
    orpc.procurement.supplierBillCreate.mutationOptions()
  );

  const receiptLines: GoodsReceiptDetail["lines"] =
    receiptDetail.data?.lines ?? [];

  async function submit() {
    if (!(number.trim() && receiptId)) {
      toast.error("Bill number and a goods receipt are required.");
      return;
    }
    const lines = receiptLines
      .map((line) => ({
        goodsReceiptLineId: line.id,
        qtyBilled: Number.parseInt(
          qtyByLine[line.id] ?? String(line.qtyReceived),
          10
        ),
      }))
      .filter((line) => Number.isInteger(line.qtyBilled) && line.qtyBilled > 0);
    if (lines.length === 0) {
      toast.error("Enter a quantity for at least one line.");
      return;
    }
    try {
      await createBill.mutateAsync({
        lines,
        number: number.trim(),
        purchaseOrderId: detail.header.id,
      });
      toast.success("Supplier bill recorded");
      onOpenChange(false);
      await onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not record bill."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record supplier bill</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{detail.header.number}</span> — bill
            against a goods receipt already recorded for this order.
          </DialogDescription>
        </DialogHeader>
        {detail.receipts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Receive goods before recording a bill — bills are matched to a
            specific goods receipt.
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={numberFieldId}>Bill number</Label>
                <Input
                  id={numberFieldId}
                  onChange={(event) => setNumber(event.target.value)}
                  placeholder="BILL-1001"
                  value={number}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={receiptFieldId}>Goods receipt</Label>
                <Select
                  onValueChange={(next) => setReceiptId(next ?? "")}
                  value={receiptId}
                >
                  <SelectTrigger className="w-full" id={receiptFieldId}>
                    <SelectValue placeholder="Pick a receipt" />
                  </SelectTrigger>
                  <SelectContent>
                    {detail.receipts.map((receipt) => (
                      <SelectItem key={receipt.id} value={receipt.id}>
                        {receipt.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {receiptLines.length > 0 ? (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="w-28 text-right">
                        Bill qty
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiptLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="text-sm">
                          {line.productName} · {line.skuCode}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {line.qtyReceived}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="text-right"
                            max={line.qtyReceived}
                            min={0}
                            onChange={(event) =>
                              setQtyByLine((prev) => ({
                                ...prev,
                                [line.id]: event.target.value,
                              }))
                            }
                            type="number"
                            value={
                              qtyByLine[line.id] ?? String(line.qtyReceived)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button
            disabled={createBill.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={createBill.isPending || detail.receipts.length === 0}
            onClick={submit}
          >
            {createBill.isPending ? "Recording…" : "Record bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrderDetailBody({
  detail,
  isError,
  isLoading,
  onBill,
  onReceive,
}: {
  detail: PurchaseOrderDetail | undefined;
  isError: boolean;
  isLoading: boolean;
  onBill: () => void;
  onReceive: () => void;
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
    return <ErrorState message="Could not load purchase order detail." />;
  }

  const { header, lines, receipts, bills } = detail;
  const canReceive =
    header.status !== "cancelled" &&
    lines.some((line) => line.qtyReceived < line.qtyOrdered);
  const canBill = header.status !== "cancelled" && receipts.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-sm">{header.supplierName}</span>
        <StatusBadge status={header.status} />
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Unit cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="text-sm">
                  {line.productName} · {line.skuCode}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {line.qtyOrdered}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {line.qtyReceived}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMoney(line.unitCostMinor, line.currency, line.scale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Goods receipts
          </p>
          {receipts.length === 0 ? (
            <p className="text-muted-foreground text-sm">None yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {receipts.map((receipt) => (
                <li
                  className="flex items-center justify-between"
                  key={receipt.id}
                >
                  <span className="font-mono text-xs">{receipt.number}</span>
                  <span className="text-muted-foreground">
                    {formatDate(receipt.receivedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Supplier bills
          </p>
          {bills.length === 0 ? (
            <p className="text-muted-foreground text-sm">None yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {bills.map((bill) => (
                <li className="flex items-center justify-between" key={bill.id}>
                  <span className="font-mono text-xs">{bill.number}</span>
                  <span className="text-muted-foreground">
                    {formatMoney(bill.totalMinor, bill.currency, bill.scale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {canReceive ? (
          <Button onClick={onReceive} variant="outline">
            <Truck className="size-4" />
            Receive goods
          </Button>
        ) : null}
        {canBill ? (
          <Button onClick={onBill}>
            <FileText className="size-4" />
            Record bill
          </Button>
        ) : null}
        {canReceive || canBill ? null : (
          <p className="text-muted-foreground text-xs">
            No actions available for this order right now.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Purchase orders panel ────────────────────────────────────────────────

function PurchaseOrdersContent({
  errorMessage,
  hasSuppliers,
  isError,
  isLoading,
  onRetry,
  onSelect,
  rows,
}: {
  errorMessage?: string;
  hasSuppliers: boolean;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  onSelect: (id: string) => void;
  rows: PurchaseOrderRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load purchase orders."}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-[52px] rounded-none" key={key} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        description={
          hasSuppliers
            ? "Create a purchase order to start procurement."
            : "Add a supplier first, then create a purchase order."
        }
        icon={ClipboardList}
        title="No purchase orders yet"
      />
    );
  }

  return <PurchaseOrdersTable onSelect={onSelect} rows={rows} />;
}

function PurchaseOrdersPanel({ suppliers }: { suppliers: SupplierRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);

  const purchaseOrders = useQuery(
    orpc.procurement.purchaseOrderList.queryOptions({ input: {} })
  );
  const detail = useQuery(
    orpc.procurement.purchaseOrderDetail.queryOptions({
      enabled: selectedId != null,
      input: { id: selectedId ?? "" },
    })
  );

  const rows = purchaseOrders.data ?? [];
  const settled = !(purchaseOrders.isLoading || purchaseOrders.isError);

  async function refreshAfterAction() {
    await Promise.all([purchaseOrders.refetch(), detail.refetch()]);
  }

  return (
    <>
      <DataTableCard
        actions={
          <Button
            disabled={suppliers.length === 0}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            New purchase order
          </Button>
        }
        count={settled ? rows.length : undefined}
        title="Purchase orders"
      >
        <PurchaseOrdersContent
          errorMessage={purchaseOrders.error?.message}
          hasSuppliers={suppliers.length > 0}
          isError={purchaseOrders.isError}
          isLoading={purchaseOrders.isLoading}
          onRetry={() => purchaseOrders.refetch()}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Purchase order{" "}
              {detail.data ? (
                <span className="font-mono">{detail.data.header.number}</span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              Lines, receiving status, and supplier bills.
            </DialogDescription>
          </DialogHeader>
          <PurchaseOrderDetailBody
            detail={detail.data}
            isError={detail.isError}
            isLoading={detail.isLoading}
            onBill={() => setBillOpen(true)}
            onReceive={() => setReceiveOpen(true)}
          />
        </DialogContent>
      </Dialog>

      {createOpen ? (
        <CreatePurchaseOrderDialog
          onCreated={async () => {
            await purchaseOrders.refetch();
          }}
          onOpenChange={setCreateOpen}
          suppliers={suppliers}
        />
      ) : null}

      {receiveOpen && detail.data ? (
        <ReceiveGoodsDialog
          detail={detail.data}
          onDone={refreshAfterAction}
          onOpenChange={setReceiveOpen}
        />
      ) : null}

      {billOpen && detail.data ? (
        <CreateBillDialog
          detail={detail.data}
          onDone={refreshAfterAction}
          onOpenChange={setBillOpen}
        />
      ) : null}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

function ProcurementScreen() {
  const suppliers = useQuery(
    orpc.procurement.supplierList.queryOptions({ input: {} })
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Procurement</h1>
        <p className="text-muted-foreground">
          Suppliers, purchase orders, receiving, and supplier bills.
        </p>
      </div>

      <Tabs defaultValue="purchase-orders">
        <TabsList>
          <TabsTrigger value="purchase-orders">
            <Package className="size-4" />
            Purchase orders
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            <Users className="size-4" />
            Suppliers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="purchase-orders">
          <PurchaseOrdersPanel suppliers={suppliers.data ?? []} />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
