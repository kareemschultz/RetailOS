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
  SelectGroup,
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ClipboardList,
  History,
  MapPin,
  Package,
  PackagePlus,
  Scale,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryScreen,
});

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const ALL_LOCATIONS = "all";
const NONE_VALUE = "none";
const MOVEMENTS_LIMIT = 50;
const CURRENCY_CODE_LENGTH = 3;

type CatalogClient = AppRouterClient["catalog"];
type InventoryClient = AppRouterClient["inventory"];
type SkuOption = Awaited<ReturnType<CatalogClient["skuCatalogList"]>>[number];
type LotOption = Awaited<ReturnType<InventoryClient["lotCatalogList"]>>[number];
type ProductOption = Awaited<
  ReturnType<AppRouterClient["product"]["catalog"]>
>[number];
type CountRow = Awaited<ReturnType<InventoryClient["countList"]>>[number];
type CountDetail = Awaited<ReturnType<InventoryClient["countDetail"]>>;
type ReceiveInput = Parameters<InventoryClient["receive"]>[0];
type AdjustInput = Parameters<InventoryClient["adjust"]>[0];
type CountStartInput = Parameters<InventoryClient["countStart"]>[0];
type CountLineInput = Parameters<InventoryClient["countLineUpsert"]>[0];

// Each cell is a backend DTO field (inventory.stockByLocation /
// stockLedgerList). The UI renders these values only — no summing, tax, FX, or
// rounding happens here; formatMoney is the minor-units -> display conversion.
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

interface MovementRow {
  balanceAfter: number;
  id: string;
  movementType: string;
  qtyDelta: number;
  serverTs: string | Date;
}

interface LocationOption {
  id: string;
  name: string;
}

const REASON_OPTIONS = [
  { label: "Damage", value: "damage" },
  { label: "Loss", value: "loss" },
  { label: "Expiry", value: "expiry" },
  { label: "Correction", value: "correction" },
  { label: "Count", value: "count" },
  { label: "Other…", value: "other" },
] as const;

const SCOPE_OPTIONS = [
  { label: "Cycle count", value: "cycle" },
  { label: "Full count", value: "full" },
  { label: "Zone count", value: "zone" },
] as const;

const COUNT_STATUS_LABELS: Record<string, string> = {
  posted: "Posted",
  started: "Started",
  void: "Cancelled",
};

// A signed quantity is display-only: the backend ledger owns the sign; we just
// prefix "+" on positive deltas so an increase reads distinctly from a decrease.
function signedQty(qty: number): string {
  return qty > 0 ? `+${qty}` : String(qty);
}

// Input-boundary conversion only (same as products.index.tsx): a typed decimal
// becomes integer minor units before it is sent to the backend. No money math
// beyond this conversion ever happens client-side.
function displayToMinor(value: string, scale: number): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 10 ** scale);
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDateTime(value: string | Date | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

function skuLabel(sku: SkuOption): string {
  return `${sku.productName} — ${sku.code}`;
}

function countStatusVariant(status: string): "secondary" | "outline" {
  return status === "started" ? "secondary" : "outline";
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Package;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

function ErrorPanel({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" />
      </div>
      <p className="font-medium">Couldn’t load data</p>
      <p className="text-muted-foreground text-sm">
        {message ?? "Check your connection or permissions and retry."}
      </p>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-px">
      {SKELETON_KEYS.map((k) => (
        <Skeleton className="h-[60px] rounded-none" key={k} />
      ))}
    </div>
  );
}

function OptionSelect({
  ariaLabel,
  disabled,
  onChange,
  options,
  placeholder,
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  value: string;
}) {
  return (
    <Select
      disabled={disabled}
      onValueChange={(next) => onChange(next ?? "")}
      value={value}
    >
      <SelectTrigger aria-label={ariaLabel} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ConfirmDialog({
  confirmLabel,
  description,
  isPending,
  onConfirm,
  onOpenChange,
  open,
  title,
}: {
  confirmLabel: string;
  description: string;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Keep as is
          </Button>
          <Button
            disabled={isPending}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {isPending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReceiveFormState {
  cost: string;
  currency: string;
  idempotencyKey: string;
  locationId: string;
  lotId: string;
  productId: string;
  qty: string;
  scale: string;
  skuId: string;
}

// Validates the dialog fields and builds the EXACT inventory.receive input.
// When a SKU is selected the cost triplet (unitCostMinor + costCurrency +
// costScale) is required together, matching the backend valuation contract.
function buildReceiveInput(
  state: ReceiveFormState
): { error: string } | { input: ReceiveInput } {
  if (!state.locationId) {
    return { error: "Choose a location." };
  }
  if (!state.productId) {
    return { error: "Choose a product." };
  }
  const qty = Number(state.qty);
  if (!(Number.isInteger(qty) && qty > 0)) {
    return { error: "Quantity must be a positive whole number." };
  }
  const base: ReceiveInput = {
    idempotencyKey: state.idempotencyKey,
    locationId: state.locationId,
    productId: state.productId,
    qty,
  };
  if (state.skuId === NONE_VALUE) {
    return { input: base };
  }
  const scale = Number(state.scale);
  if (!(Number.isInteger(scale) && scale >= 0)) {
    return { error: "Cost scale must be a non-negative whole number." };
  }
  const unitCostMinor = displayToMinor(state.cost, scale);
  if (unitCostMinor == null) {
    return { error: "Enter a valid non-negative unit cost." };
  }
  const currency = state.currency.trim().toUpperCase();
  if (currency.length !== CURRENCY_CODE_LENGTH) {
    return { error: "Currency must be a 3-letter code." };
  }
  return {
    input: {
      ...base,
      costCurrency: currency,
      costScale: scale,
      lotId: state.lotId === NONE_VALUE ? undefined : state.lotId,
      skuId: state.skuId,
      unitCostMinor,
    },
  };
}

function ReceiveDialog({
  isSaving,
  locations,
  lots,
  onOpenChange,
  onSubmit,
  open,
  products,
  skus,
}: {
  isSaving: boolean;
  locations: LocationOption[];
  lots: LotOption[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ReceiveInput) => Promise<void>;
  open: boolean;
  products: ProductOption[];
  skus: SkuOption[];
}) {
  const [locationId, setLocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [skuId, setSkuId] = useState(NONE_VALUE);
  const [lotId, setLotId] = useState(NONE_VALUE);
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("0.00");
  const [currency, setCurrency] = useState("GYD");
  const [scale, setScale] = useState("2");
  // Generated ONCE per dialog-open (the dialog is key-remounted each open), so
  // a retried submission replays the SAME idempotency key and can never
  // double-receive stock.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const productSkus = skus.filter((s) => s.productId === productId);
  const skuLots = lots.filter((l) => l.skuId === skuId);
  const hasSku = skuId !== NONE_VALUE;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive stock</DialogTitle>
          <DialogDescription>
            Record a valued stock receipt into a location. Pick a SKU to value
            the receipt — the cost triplet is required together.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = buildReceiveInput({
              cost,
              currency,
              idempotencyKey,
              locationId,
              lotId,
              productId,
              qty,
              scale,
              skuId,
            });
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            await onSubmit(result.input);
          }}
        >
          <div className="grid gap-2">
            <Label>Location</Label>
            <OptionSelect
              ariaLabel="Receive location"
              onChange={setLocationId}
              options={locations.map((l) => ({ label: l.name, value: l.id }))}
              placeholder="Choose a location"
              value={locationId}
            />
          </div>
          <div className="grid gap-2">
            <Label>Product</Label>
            <OptionSelect
              ariaLabel="Receive product"
              onChange={(next) => {
                setProductId(next);
                setSkuId(NONE_VALUE);
                setLotId(NONE_VALUE);
              }}
              options={products.map((p) => ({
                label: `${p.name} (${p.sku})`,
                value: p.id,
              }))}
              placeholder="Choose a product"
              value={productId}
            />
          </div>
          <div className="grid gap-2">
            <Label>SKU (for valued receipt)</Label>
            <OptionSelect
              ariaLabel="Receive SKU"
              disabled={!productId}
              onChange={(next) => {
                setSkuId(next);
                setLotId(NONE_VALUE);
              }}
              options={[
                { label: "None — product-level receipt", value: NONE_VALUE },
                ...productSkus.map((s) => ({
                  label: `${s.code}${s.name ? ` — ${s.name}` : ""}`,
                  value: s.id,
                })),
              ]}
              placeholder="None — product-level receipt"
              value={skuId}
            />
          </div>
          <div className="grid gap-2">
            <Label>Lot (optional)</Label>
            <OptionSelect
              ariaLabel="Receive lot"
              disabled={!hasSku}
              onChange={setLotId}
              options={[
                { label: "No lot", value: NONE_VALUE },
                ...skuLots.map((l) => ({ label: l.lotNumber, value: l.id })),
              ]}
              placeholder="No lot"
              value={lotId}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="receive-qty">Quantity</Label>
            <Input
              id="receive-qty"
              min={1}
              onChange={(event) => setQty(event.target.value)}
              required
              step={1}
              type="number"
              value={qty}
            />
          </div>
          {hasSku ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_5rem_6rem]">
              <div className="grid gap-2">
                <Label htmlFor="receive-cost">Unit cost</Label>
                <Input
                  id="receive-cost"
                  min={0}
                  onChange={(event) => setCost(event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={cost}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receive-currency">Currency</Label>
                <Input
                  id="receive-currency"
                  maxLength={3}
                  minLength={3}
                  onChange={(event) =>
                    setCurrency(event.target.value.toUpperCase())
                  }
                  required
                  value={currency}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receive-scale">Scale</Label>
                <Input
                  id="receive-scale"
                  min={0}
                  onChange={(event) => setScale(event.target.value)}
                  required
                  type="number"
                  value={scale}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Receiving…" : "Receive stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface AdjustFormState {
  cost: string;
  currency: string;
  locationId: string;
  lotId: string;
  qtyDelta: string;
  reason: string;
  reasonOther: string;
  scale: string;
  skuId: string;
}

// Validates the dialog fields and builds the EXACT inventory.adjust input.
// productId is derived from the selected SKU (the backend asserts the tuple).
// A positive adjustment requires the cost triplet, matching the backend guard.
function buildAdjustInput(
  state: AdjustFormState,
  skus: SkuOption[]
): { error: string } | { input: AdjustInput } {
  if (!state.locationId) {
    return { error: "Choose a location." };
  }
  const sku = skus.find((s) => s.id === state.skuId);
  if (!sku) {
    return { error: "Choose a SKU." };
  }
  const qtyDelta = Number(state.qtyDelta);
  if (!Number.isInteger(qtyDelta) || qtyDelta === 0) {
    return { error: "Quantity delta must be a non-zero whole number." };
  }
  const reasonCode =
    state.reason === "other" ? state.reasonOther.trim() : state.reason;
  if (!reasonCode) {
    return { error: "Enter a reason for the adjustment." };
  }
  const base: AdjustInput = {
    locationId: state.locationId,
    lotId: state.lotId === NONE_VALUE ? undefined : state.lotId,
    productId: sku.productId,
    qtyDelta,
    reasonCode,
    skuId: sku.id,
  };
  if (qtyDelta < 0) {
    return { input: base };
  }
  const scale = Number(state.scale);
  if (!(Number.isInteger(scale) && scale >= 0)) {
    return { error: "Cost scale must be a non-negative whole number." };
  }
  const unitCostMinor = displayToMinor(state.cost, scale);
  if (unitCostMinor == null) {
    return { error: "Enter a valid non-negative unit cost." };
  }
  const currency = state.currency.trim().toUpperCase();
  if (currency.length !== CURRENCY_CODE_LENGTH) {
    return { error: "Currency must be a 3-letter code." };
  }
  return {
    input: {
      ...base,
      costCurrency: currency,
      costScale: scale,
      unitCostMinor,
    },
  };
}

function AdjustDialog({
  isSaving,
  locations,
  lots,
  onOpenChange,
  onSubmit,
  open,
  skus,
}: {
  isSaving: boolean;
  locations: LocationOption[];
  lots: LotOption[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: AdjustInput) => Promise<void>;
  open: boolean;
  skus: SkuOption[];
}) {
  const [locationId, setLocationId] = useState("");
  const [skuId, setSkuId] = useState("");
  const [lotId, setLotId] = useState(NONE_VALUE);
  const [qtyDelta, setQtyDelta] = useState("-1");
  const [reason, setReason] = useState<string>("damage");
  const [reasonOther, setReasonOther] = useState("");
  const [cost, setCost] = useState("0.00");
  const [currency, setCurrency] = useState("GYD");
  const [scale, setScale] = useState("2");

  const skuLots = lots.filter((l) => l.skuId === skuId);
  const isPositive = Number(qtyDelta) > 0;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Write stock up or down with a reason code. Negative deltas write off
            at ledger cost; positive deltas need a unit cost.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = buildAdjustInput(
              {
                cost,
                currency,
                locationId,
                lotId,
                qtyDelta,
                reason,
                reasonOther,
                scale,
                skuId,
              },
              skus
            );
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            await onSubmit(result.input);
          }}
        >
          <div className="grid gap-2">
            <Label>Location</Label>
            <OptionSelect
              ariaLabel="Adjustment location"
              onChange={setLocationId}
              options={locations.map((l) => ({ label: l.name, value: l.id }))}
              placeholder="Choose a location"
              value={locationId}
            />
          </div>
          <div className="grid gap-2">
            <Label>SKU</Label>
            <OptionSelect
              ariaLabel="Adjustment SKU"
              onChange={(next) => {
                setSkuId(next);
                setLotId(NONE_VALUE);
              }}
              options={skus.map((s) => ({ label: skuLabel(s), value: s.id }))}
              placeholder="Choose a SKU"
              value={skuId}
            />
          </div>
          <div className="grid gap-2">
            <Label>Lot (optional)</Label>
            <OptionSelect
              ariaLabel="Adjustment lot"
              disabled={!skuId}
              onChange={setLotId}
              options={[
                { label: "No lot", value: NONE_VALUE },
                ...skuLots.map((l) => ({ label: l.lotNumber, value: l.id })),
              ]}
              placeholder="No lot"
              value={lotId}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adjust-qty">Quantity delta</Label>
            <Input
              id="adjust-qty"
              onChange={(event) => setQtyDelta(event.target.value)}
              required
              step={1}
              type="number"
              value={qtyDelta}
            />
            <p className="text-muted-foreground text-xs">
              Negative writes stock off; positive writes stock up.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Reason</Label>
            <OptionSelect
              ariaLabel="Adjustment reason"
              onChange={setReason}
              options={REASON_OPTIONS.map((r) => ({
                label: r.label,
                value: r.value,
              }))}
              placeholder="Choose a reason"
              value={reason}
            />
          </div>
          {reason === "other" ? (
            <div className="grid gap-2">
              <Label htmlFor="adjust-reason-other">Custom reason</Label>
              <Input
                id="adjust-reason-other"
                minLength={1}
                onChange={(event) => setReasonOther(event.target.value)}
                placeholder="Describe the reason"
                required
                value={reasonOther}
              />
            </div>
          ) : null}
          {isPositive ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_5rem_6rem]">
              <div className="grid gap-2">
                <Label htmlFor="adjust-cost">Unit cost</Label>
                <Input
                  id="adjust-cost"
                  min={0}
                  onChange={(event) => setCost(event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={cost}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adjust-currency">Currency</Label>
                <Input
                  id="adjust-currency"
                  maxLength={3}
                  minLength={3}
                  onChange={(event) =>
                    setCurrency(event.target.value.toUpperCase())
                  }
                  required
                  value={currency}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adjust-scale">Scale</Label>
                <Input
                  id="adjust-scale"
                  min={0}
                  onChange={(event) => setScale(event.target.value)}
                  required
                  type="number"
                  value={scale}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Adjusting…" : "Adjust stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StartCountDialog({
  isSaving,
  locations,
  onOpenChange,
  onSubmit,
  open,
}: {
  isSaving: boolean;
  locations: LocationOption[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CountStartInput) => Promise<void>;
  open: boolean;
}) {
  const [locationId, setLocationId] = useState("");
  const [scope, setScope] = useState<"full" | "cycle" | "zone">("cycle");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start stock count</DialogTitle>
          <DialogDescription>
            Open a count for a location, then record counted quantities per SKU
            before posting.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!locationId) {
              toast.error("Choose a location.");
              return;
            }
            await onSubmit({ locationId, scope });
          }}
        >
          <div className="grid gap-2">
            <Label>Location</Label>
            <OptionSelect
              ariaLabel="Count location"
              onChange={setLocationId}
              options={locations.map((l) => ({ label: l.name, value: l.id }))}
              placeholder="Choose a location"
              value={locationId}
            />
          </div>
          <div className="grid gap-2">
            <Label>Scope</Label>
            <OptionSelect
              ariaLabel="Count scope"
              onChange={(next) =>
                setScope((next || "cycle") as "full" | "cycle" | "zone")
              }
              options={SCOPE_OPTIONS.map((s) => ({
                label: s.label,
                value: s.value,
              }))}
              placeholder="Cycle count"
              value={scope}
            />
          </div>
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Starting…" : "Start count"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CountLineForm({
  isSaving,
  lots,
  onSubmit,
  skus,
}: {
  isSaving: boolean;
  lots: LotOption[];
  onSubmit: (values: {
    countedQty: number;
    lotId?: string;
    skuId: string;
  }) => Promise<void>;
  skus: SkuOption[];
}) {
  const [skuId, setSkuId] = useState("");
  const [lotId, setLotId] = useState(NONE_VALUE);
  const [countedQty, setCountedQty] = useState("0");

  const skuLots = lots.filter((l) => l.skuId === skuId);

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end"
      onSubmit={async (event) => {
        event.preventDefault();
        const qty = Number(countedQty);
        if (!skuId) {
          toast.error("Choose a SKU.");
          return;
        }
        if (!(Number.isInteger(qty) && qty >= 0)) {
          toast.error("Counted quantity must be a whole number ≥ 0.");
          return;
        }
        await onSubmit({
          countedQty: qty,
          lotId: lotId === NONE_VALUE ? undefined : lotId,
          skuId,
        });
      }}
    >
      <div className="grid gap-2">
        <Label>SKU</Label>
        <OptionSelect
          ariaLabel="Count line SKU"
          onChange={(next) => {
            setSkuId(next);
            setLotId(NONE_VALUE);
          }}
          options={skus.map((s) => ({ label: skuLabel(s), value: s.id }))}
          placeholder="Choose a SKU"
          value={skuId}
        />
      </div>
      <div className="grid gap-2">
        <Label>Lot (optional)</Label>
        <OptionSelect
          ariaLabel="Count line lot"
          disabled={!skuId}
          onChange={setLotId}
          options={[
            { label: "No lot", value: NONE_VALUE },
            ...skuLots.map((l) => ({ label: l.lotNumber, value: l.id })),
          ]}
          placeholder="No lot"
          value={lotId}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="count-line-qty">Counted qty</Label>
        <Input
          id="count-line-qty"
          min={0}
          onChange={(event) => setCountedQty(event.target.value)}
          required
          step={1}
          type="number"
          value={countedQty}
        />
      </div>
      <Button disabled={isSaving} type="submit">
        {isSaving ? "Saving…" : "Save line"}
      </Button>
    </form>
  );
}

function CountsContent({
  errorMessage,
  isError,
  isLoading,
  onOpen,
  rows,
  selectedCountId,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onOpen: (id: string) => void;
  rows: CountRow[];
  selectedCountId: string | null;
}) {
  if (isError) {
    return <ErrorPanel message={errorMessage} />;
  }
  if (isLoading) {
    return <RowsSkeleton />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        description="Start a count for a location to reconcile counted stock against the ledger."
        icon={ClipboardList}
        title="No stock counts yet"
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Location</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Posted</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.locationName}</TableCell>
            <TableCell className="capitalize">{row.scope}</TableCell>
            <TableCell>
              <Badge variant={countStatusVariant(row.status)}>
                {COUNT_STATUS_LABELS[row.status] ?? row.status}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDateTime(row.startedAt)}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDateTime(row.postedAt)}
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <Button
                  onClick={() => onOpen(row.id)}
                  size="sm"
                  variant={row.id === selectedCountId ? "default" : "outline"}
                >
                  {row.id === selectedCountId ? "Viewing" : "Open"}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CountLinesTable({ detail }: { detail: CountDetail }) {
  if (detail.lines.length === 0) {
    return (
      <EmptyState
        description="Add counted quantities per SKU below, then post the count."
        icon={Scale}
        title="No lines counted yet"
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[240px]">SKU</TableHead>
          <TableHead className="text-right">Counted</TableHead>
          <TableHead className="text-right">System</TableHead>
          <TableHead className="text-right">Variance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {detail.lines.map((line) => (
          <TableRow key={line.id}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{line.productName}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {line.skuCode}
                </p>
              </div>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {line.countedQty}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {line.systemQty ?? "—"}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {line.varianceQty == null ? "—" : signedQty(line.varianceQty)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CountDetailPanel({
  detail,
  errorMessage,
  isError,
  isLoading,
  isSavingLine,
  lots,
  onAddLine,
  onRequestCancel,
  onRequestPost,
  skus,
}: {
  detail: CountDetail | undefined;
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  isSavingLine: boolean;
  lots: LotOption[];
  onAddLine: (values: {
    countedQty: number;
    lotId?: string;
    skuId: string;
  }) => Promise<void>;
  onRequestCancel: () => void;
  onRequestPost: () => void;
  skus: SkuOption[];
}) {
  if (isError) {
    return <ErrorPanel message={errorMessage} />;
  }
  if (isLoading || !detail) {
    return <RowsSkeleton />;
  }
  const isStarted = detail.status === "started";
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="font-medium">{detail.locationName}</span>
        <span className="text-muted-foreground capitalize">
          {detail.scope} count
        </span>
        <Badge variant={countStatusVariant(detail.status)}>
          {COUNT_STATUS_LABELS[detail.status] ?? detail.status}
        </Badge>
        <span className="text-muted-foreground">
          Started {formatDateTime(detail.startedAt)}
        </span>
        {detail.postedAt ? (
          <span className="text-muted-foreground">
            Posted {formatDateTime(detail.postedAt)}
          </span>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-lg border">
        <CountLinesTable detail={detail} />
      </div>
      {isStarted ? (
        <>
          <CountLineForm
            isSaving={isSavingLine}
            key={detail.id}
            lots={lots}
            onSubmit={onAddLine}
            skus={skus}
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={onRequestCancel}
              type="button"
              variant="destructive"
            >
              Cancel count
            </Button>
            <Button
              disabled={detail.lines.length === 0}
              onClick={onRequestPost}
              type="button"
            >
              Post count
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StockCountsSection({
  locations,
  lots,
  onInventoryChanged,
  skus,
}: {
  locations: LocationOption[];
  lots: LotOption[];
  onInventoryChanged: () => Promise<void>;
  skus: SkuOption[];
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [selectedCountId, setSelectedCountId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"cancel" | "post" | null>(
    null
  );

  const counts = useQuery(orpc.inventory.countList.queryOptions({ input: {} }));
  const detail = useQuery(
    orpc.inventory.countDetail.queryOptions({
      enabled: selectedCountId != null,
      input: { stockCountId: selectedCountId ?? "" },
    })
  );

  const startCount = useMutation(orpc.inventory.countStart.mutationOptions());
  const upsertLine = useMutation(
    orpc.inventory.countLineUpsert.mutationOptions()
  );
  const postCount = useMutation(orpc.inventory.countPost.mutationOptions());
  const cancelCount = useMutation(orpc.inventory.countCancel.mutationOptions());

  const handleStart = async (input: CountStartInput) => {
    try {
      const row = await startCount.mutateAsync(input);
      toast.success("Stock count started");
      setStartOpen(false);
      setSelectedCountId(row.id);
      await counts.refetch();
    } catch (error) {
      toast.error(errorText(error, "Could not start the count."));
    }
  };

  const handleAddLine = async (values: {
    countedQty: number;
    lotId?: string;
    skuId: string;
  }) => {
    if (!selectedCountId) {
      return;
    }
    const input: CountLineInput = {
      countedQty: values.countedQty,
      lotId: values.lotId,
      skuId: values.skuId,
      stockCountId: selectedCountId,
    };
    try {
      await upsertLine.mutateAsync(input);
      toast.success("Count line saved");
      await detail.refetch();
    } catch (error) {
      toast.error(errorText(error, "Could not save the count line."));
    }
  };

  const handlePost = async () => {
    if (!selectedCountId) {
      return;
    }
    try {
      await postCount.mutateAsync({ stockCountId: selectedCountId });
      toast.success("Stock count posted — variances adjusted");
      setConfirmAction(null);
      await Promise.all([counts.refetch(), detail.refetch()]);
      await onInventoryChanged();
    } catch (error) {
      toast.error(errorText(error, "Could not post the count."));
    }
  };

  const handleCancel = async () => {
    if (!selectedCountId) {
      return;
    }
    try {
      await cancelCount.mutateAsync({ stockCountId: selectedCountId });
      toast.success("Stock count cancelled");
      setConfirmAction(null);
      await Promise.all([counts.refetch(), detail.refetch()]);
    } catch (error) {
      toast.error(errorText(error, "Could not cancel the count."));
    }
  };

  return (
    <>
      <DataTableCard
        actions={
          <Button onClick={() => setStartOpen(true)}>
            <ClipboardList className="size-4" />
            Start count
          </Button>
        }
        count={counts.data ? counts.data.length : undefined}
        title="Stock counts"
      >
        <CountsContent
          errorMessage={counts.error?.message}
          isError={counts.isError}
          isLoading={counts.isLoading}
          onOpen={setSelectedCountId}
          rows={counts.data ?? []}
          selectedCountId={selectedCountId}
        />
      </DataTableCard>

      {selectedCountId ? (
        <DataTableCard title="Count detail">
          <CountDetailPanel
            detail={detail.data}
            errorMessage={detail.error?.message}
            isError={detail.isError}
            isLoading={detail.isLoading}
            isSavingLine={upsertLine.isPending}
            lots={lots}
            onAddLine={handleAddLine}
            onRequestCancel={() => setConfirmAction("cancel")}
            onRequestPost={() => setConfirmAction("post")}
            skus={skus}
          />
        </DataTableCard>
      ) : null}

      {startOpen ? (
        <StartCountDialog
          isSaving={startCount.isPending}
          locations={locations}
          onOpenChange={setStartOpen}
          onSubmit={handleStart}
          open={startOpen}
        />
      ) : null}

      <ConfirmDialog
        confirmLabel="Post count"
        description="Posting writes an inventory adjustment for every variance line. This cannot be undone — the ledger keeps the full trail."
        isPending={postCount.isPending}
        onConfirm={handlePost}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
          }
        }}
        open={confirmAction === "post"}
        title="Post this stock count?"
      />
      <ConfirmDialog
        confirmLabel="Cancel count"
        description="Cancelling voids the count. Counted lines are kept for audit but no stock adjustments are made."
        isPending={cancelCount.isPending}
        onConfirm={handleCancel}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
          }
        }}
        open={confirmAction === "cancel"}
        title="Cancel this stock count?"
      />
    </>
  );
}

function StockContent({
  isLoading,
  isError,
  errorMessage,
  rows,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  rows: StockRow[];
}) {
  if (isError) {
    return <ErrorPanel message={errorMessage} />;
  }
  if (isLoading) {
    return <RowsSkeleton />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        description="Receive stock or pick another location to see balances here."
        icon={Package}
        title="No stock on hand"
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[280px]">Product</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="text-right">Qty on hand</TableHead>
          <TableHead className="text-right">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.skuId}-${row.locationId}`}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.productName}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.skuCode}
                </p>
              </div>
            </TableCell>
            <TableCell>{row.locationName}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.qtyOnHand}
            </TableCell>
            <TableCell className="text-right font-medium font-mono tabular-nums">
              {formatMoney(row.totalValueMinor, row.currency, row.scale)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MovementsContent({
  isLoading,
  isError,
  errorMessage,
  rows,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  rows: MovementRow[];
}) {
  if (isError) {
    return <ErrorPanel message={errorMessage} />;
  }
  if (isLoading) {
    return <RowsSkeleton />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        description="Stock receipts, sales, transfers, and adjustments appear here as they happen."
        icon={History}
        title="No movements yet"
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Qty delta</TableHead>
          <TableHead className="text-right">Balance after</TableHead>
          <TableHead className="text-right">When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Badge variant="secondary">{row.movementType}</Badge>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {signedQty(row.qtyDelta)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.balanceAfter}
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm">
              {new Date(row.serverTs).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LocationFilter({
  value,
  locations,
  onChange,
}: {
  value: string;
  locations: LocationOption[];
  onChange: (next: string) => void;
}) {
  return (
    <Select
      onValueChange={(next) => onChange(next ?? ALL_LOCATIONS)}
      value={value}
    >
      <SelectTrigger aria-label="Filter by location" className="w-56">
        <MapPin className="size-4 text-muted-foreground" />
        <SelectValue placeholder="All locations" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={ALL_LOCATIONS}>All locations</SelectItem>
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function InventoryScreen() {
  const [locationFilter, setLocationFilter] = useState<string>(ALL_LOCATIONS);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  // Key-remount counter so each dialog open gets fresh state (and, for
  // receive, a fresh idempotency key) — the products.index.tsx trick.
  const [dialogNonce, setDialogNonce] = useState(0);
  const locationId =
    locationFilter === ALL_LOCATIONS ? undefined : locationFilter;

  // All figures are backend-authoritative DTOs (RLS- and permission-scoped);
  // the client never computes a balance or a value.
  const stock = useQuery(
    orpc.inventory.stockByLocation.queryOptions({ input: { locationId } })
  );
  const movements = useQuery(
    orpc.inventory.stockLedgerList.queryOptions({
      input: { limit: MOVEMENTS_LIMIT },
    })
  );
  const locations = useQuery(orpc.location.list.queryOptions({ input: {} }));
  const products = useQuery(orpc.product.catalog.queryOptions({ input: {} }));
  const skus = useQuery(
    orpc.catalog.skuCatalogList.queryOptions({ input: {} })
  );
  const lots = useQuery(
    orpc.inventory.lotCatalogList.queryOptions({ input: {} })
  );

  const receiveStock = useMutation(orpc.inventory.receive.mutationOptions());
  const adjustStock = useMutation(orpc.inventory.adjust.mutationOptions());

  const stockRows = (stock.data ?? []) as StockRow[];
  const movementRows = (movements.data ?? []) as MovementRow[];
  const locationOptions = (locations.data ?? []) as LocationOption[];
  const productOptions = products.data ?? [];
  const skuOptions = skus.data ?? [];
  const lotOptions = lots.data ?? [];
  const stockSettled = !(stock.isLoading || stock.isError);

  const refetchInventory = async () => {
    await Promise.all([stock.refetch(), movements.refetch()]);
  };

  const handleReceive = async (input: ReceiveInput) => {
    try {
      await receiveStock.mutateAsync(input);
      toast.success("Stock received");
      setReceiveOpen(false);
      await refetchInventory();
    } catch (error) {
      toast.error(errorText(error, "Could not receive stock."));
    }
  };

  const handleAdjust = async (input: AdjustInput) => {
    try {
      await adjustStock.mutateAsync(input);
      toast.success("Stock adjusted");
      setAdjustOpen(false);
      await refetchInventory();
    } catch (error) {
      toast.error(errorText(error, "Could not adjust stock."));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">
          Stock on hand and recent movements across every location.
        </p>
      </div>

      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <LocationFilter
              locations={locationOptions}
              onChange={setLocationFilter}
              value={locationFilter}
            />
            <Button
              onClick={() => {
                setDialogNonce((n) => n + 1);
                setAdjustOpen(true);
              }}
              variant="outline"
            >
              <Scale className="size-4" />
              Adjust stock
            </Button>
            <Button
              onClick={() => {
                setDialogNonce((n) => n + 1);
                setReceiveOpen(true);
              }}
            >
              <PackagePlus className="size-4" />
              Receive stock
            </Button>
          </div>
        }
        count={stockSettled ? stockRows.length : undefined}
        title="Stock on hand"
      >
        <StockContent
          errorMessage={stock.error?.message}
          isError={stock.isError}
          isLoading={stock.isLoading}
          rows={stockRows}
        />
      </DataTableCard>

      <StockCountsSection
        locations={locationOptions}
        lots={lotOptions}
        onInventoryChanged={refetchInventory}
        skus={skuOptions}
      />

      <DataTableCard title="Recent movements">
        <MovementsContent
          errorMessage={movements.error?.message}
          isError={movements.isError}
          isLoading={movements.isLoading}
          rows={movementRows}
        />
      </DataTableCard>

      {receiveOpen ? (
        <ReceiveDialog
          isSaving={receiveStock.isPending}
          key={`receive-${dialogNonce}`}
          locations={locationOptions}
          lots={lotOptions}
          onOpenChange={setReceiveOpen}
          onSubmit={handleReceive}
          open={receiveOpen}
          products={productOptions}
          skus={skuOptions}
        />
      ) : null}
      {adjustOpen ? (
        <AdjustDialog
          isSaving={adjustStock.isPending}
          key={`adjust-${dialogNonce}`}
          locations={locationOptions}
          lots={lotOptions}
          onOpenChange={setAdjustOpen}
          onSubmit={handleAdjust}
          open={adjustOpen}
          skus={skuOptions}
        />
      ) : null}
    </div>
  );
}
