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
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  ArrowRightLeft,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/uom-conversions")({
  component: UomConversionsScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type ConversionRow = Awaited<
  ReturnType<CatalogClient["uomConversionCatalogList"]>
>[number];
type UomRow = Awaited<ReturnType<CatalogClient["uomList"]>>[number];
type CategoryRow = Awaited<ReturnType<CatalogClient["categoryList"]>>[number];
type SkuOption = Awaited<ReturnType<CatalogClient["skuCatalogList"]>>[number];
type ProductOption = Awaited<
  ReturnType<AppRouterClient["product"]["catalog"]>
>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

type ConversionRole = "purchase" | "reporting" | "sale" | "stock";
type ScopeType = "category" | "global" | "product" | "sku";

const ROLE_LABELS: Record<string, string> = {
  purchase: "Purchase",
  reporting: "Reporting",
  sale: "Sale",
  stock: "Stock",
};
const ROLE_OPTIONS: Array<{ label: string; value: ConversionRole }> = [
  { label: "Purchase", value: "purchase" },
  { label: "Stock", value: "stock" },
  { label: "Sale", value: "sale" },
  { label: "Reporting", value: "reporting" },
];
const SCOPE_OPTIONS: Array<{ label: string; value: ScopeType }> = [
  { label: "Global (whole tenant)", value: "global" },
  { label: "Category", value: "category" },
  { label: "Product", value: "product" },
  { label: "SKU", value: "sku" },
];

interface ConversionFormValues {
  categoryId: string | null;
  factor: number;
  factorScale: number;
  fromUomId: string;
  isActive: boolean;
  productId: string | null;
  role: ConversionRole;
  skuId: string | null;
  toUomId: string;
}

function toRole(value: string | undefined): ConversionRole {
  const match = ROLE_OPTIONS.find((option) => option.value === value);
  return match?.value ?? "stock";
}

function scopeTypeOf(row?: ConversionRow): ScopeType {
  if (!row) {
    return "global";
  }
  if (row.skuId) {
    return "sku";
  }
  if (row.productId) {
    return "product";
  }
  if (row.categoryId) {
    return "category";
  }
  return "global";
}

function scopeIdOf(row?: ConversionRow): string {
  return row?.skuId ?? row?.productId ?? row?.categoryId ?? "";
}

function submitLabel(isSaving: boolean, isEdit: boolean, noun: string) {
  if (isSaving) {
    return "Saving…";
  }
  return isEdit ? `Save ${noun}` : `Create ${noun}`;
}

function SearchBox({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-9 rounded-lg pl-9"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search conversions"
        value={value}
      />
    </div>
  );
}

function ScopeEntitySelect({
  categories,
  onChange,
  products,
  scopeType,
  skus,
  value,
}: {
  categories: CategoryRow[];
  onChange: (value: string) => void;
  products: ProductOption[];
  scopeType: ScopeType;
  skus: SkuOption[];
  value: string;
}) {
  let options: Array<{ id: string; label: string }> = [];
  if (scopeType === "category") {
    options = categories.map((category) => ({
      id: category.id,
      label: category.code
        ? `${category.name} (${category.code})`
        : category.name,
    }));
  }
  if (scopeType === "product") {
    options = products.map((product) => ({
      id: product.id,
      label: `${product.name} (${product.sku})`,
    }));
  }
  if (scopeType === "sku") {
    options = skus.map((sku) => ({
      id: sku.id,
      label: `${sku.code} — ${sku.productName}`,
    }));
  }

  return (
    <Select
      onValueChange={(selected) => onChange(selected ?? "")}
      value={value}
    >
      <SelectTrigger className="w-full" id="conversion-scope-entity">
        <SelectValue placeholder="Choose a record" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UnitSelect({
  id,
  onChange,
  uoms,
  value,
}: {
  id: string;
  onChange: (value: string) => void;
  uoms: UomRow[];
  value: string;
}) {
  return (
    <Select
      onValueChange={(selected) => onChange(selected ?? "")}
      value={value}
    >
      <SelectTrigger className="w-full" id={id}>
        <SelectValue placeholder="Choose a unit" />
      </SelectTrigger>
      <SelectContent>
        {uoms.map((unit) => (
          <SelectItem key={unit.id} value={unit.id}>
            {unit.code} — {unit.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ConversionDialog({
  categories,
  conversion,
  isSaving,
  onOpenChange,
  onSubmit,
  open,
  products,
  skus,
  uoms,
}: {
  categories: CategoryRow[];
  conversion?: ConversionRow;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ConversionFormValues) => Promise<void>;
  open: boolean;
  products: ProductOption[];
  skus: SkuOption[];
  uoms: UomRow[];
}) {
  const [role, setRole] = useState<ConversionRole>(toRole(conversion?.role));
  const [scopeType, setScopeType] = useState<ScopeType>(
    scopeTypeOf(conversion)
  );
  const [scopeId, setScopeId] = useState(scopeIdOf(conversion));
  const [fromUomId, setFromUomId] = useState(conversion?.fromUomId ?? "");
  const [toUomId, setToUomId] = useState(conversion?.toUomId ?? "");
  const [factor, setFactor] = useState(String(conversion?.factor ?? 1));
  const [factorScale, setFactorScale] = useState(
    String(conversion?.factorScale ?? 0)
  );
  const [isActive, setIsActive] = useState(conversion?.isActive ?? true);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {conversion ? "Edit conversion" : "New conversion"}
          </DialogTitle>
          <DialogDescription>
            Define how quantities convert between units for purchasing,
            stocking, selling, and reporting.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!(fromUomId && toUomId)) {
              toast.error("Choose both the from and to units.");
              return;
            }
            if (scopeType !== "global" && !scopeId) {
              toast.error("Choose the record this conversion applies to.");
              return;
            }
            const parsedFactor = Number.parseInt(factor, 10);
            if (!Number.isInteger(parsedFactor) || parsedFactor <= 0) {
              toast.error("Factor must be a positive whole number.");
              return;
            }
            const parsedScale = Number.parseInt(factorScale || "0", 10);
            if (!Number.isInteger(parsedScale) || parsedScale < 0) {
              toast.error("Factor scale must be a whole number of 0 or more.");
              return;
            }
            await onSubmit({
              categoryId: scopeType === "category" ? scopeId : null,
              factor: parsedFactor,
              factorScale: parsedScale,
              fromUomId,
              isActive,
              productId: scopeType === "product" ? scopeId : null,
              role,
              skuId: scopeType === "sku" ? scopeId : null,
              toUomId,
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="conversion-role">Role</Label>
            <Select
              onValueChange={(selected) =>
                setRole(toRole(selected ?? undefined))
              }
              value={role}
            >
              <SelectTrigger className="w-full" id="conversion-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="conversion-scope">Scope</Label>
            <Select
              onValueChange={(selected) => {
                setScopeType((selected ?? "global") as ScopeType);
                setScopeId("");
              }}
              value={scopeType}
            >
              <SelectTrigger className="w-full" id="conversion-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {scopeType === "global" ? null : (
            <div className="grid gap-2">
              <Label htmlFor="conversion-scope-entity">Applies to</Label>
              <ScopeEntitySelect
                categories={categories}
                onChange={setScopeId}
                products={products}
                scopeType={scopeType}
                skus={skus}
                value={scopeId}
              />
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="conversion-from-uom">From unit</Label>
              <UnitSelect
                id="conversion-from-uom"
                onChange={setFromUomId}
                uoms={uoms}
                value={fromUomId}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conversion-to-uom">To unit</Label>
              <UnitSelect
                id="conversion-to-uom"
                onChange={setToUomId}
                uoms={uoms}
                value={toUomId}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="conversion-factor">Factor</Label>
              <Input
                id="conversion-factor"
                min={1}
                onChange={(event) => setFactor(event.target.value)}
                required
                step={1}
                type="number"
                value={factor}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conversion-factor-scale">Factor scale</Label>
              <Input
                id="conversion-factor-scale"
                min={0}
                onChange={(event) => setFactorScale(event.target.value)}
                required
                step={1}
                type="number"
                value={factorScale}
              />
            </div>
          </div>
          {conversion ? (
            <div className="grid gap-2">
              <Label htmlFor="conversion-status">Status</Label>
              <Select
                onValueChange={(selected) =>
                  setIsActive(selected !== "inactive")
                }
                value={isActive ? "active" : "inactive"}
              >
                <SelectTrigger className="w-full" id="conversion-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {submitLabel(isSaving, Boolean(conversion), "conversion")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScopeLabel({ row }: { row: ConversionRow }) {
  if (row.skuId) {
    return (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.skuName ?? row.skuCode}</p>
        <p className="font-mono text-muted-foreground text-xs">{row.skuCode}</p>
      </div>
    );
  }

  if (row.productId) {
    return (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.productName}</p>
        <p className="font-mono text-muted-foreground text-xs">
          {row.productSku}
        </p>
      </div>
    );
  }

  if (row.categoryId) {
    return (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.categoryName}</p>
        <p className="font-mono text-muted-foreground text-xs">
          {row.categoryCode}
        </p>
      </div>
    );
  }

  return <span className="text-muted-foreground text-sm">Global</span>;
}

function UnitLabel({ code, name }: { code: string; name: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-sm">{code}</p>
      <p className="truncate text-muted-foreground text-xs">{name}</p>
    </div>
  );
}

function UomConversionsTable({
  onArchive,
  onEdit,
  rows,
}: {
  onArchive: (row: ConversionRow) => void;
  onEdit: (row: ConversionRow) => void;
  rows: ConversionRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role</TableHead>
          <TableHead className="min-w-[220px]">Scope</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead className="text-right">Factor</TableHead>
          <TableHead className="text-right">Scale</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Badge variant="secondary">
                {ROLE_LABELS[row.role] ?? row.role}
              </Badge>
            </TableCell>
            <TableCell>
              <ScopeLabel row={row} />
            </TableCell>
            <TableCell>
              <UnitLabel code={row.fromUomCode} name={row.fromUomName} />
            </TableCell>
            <TableCell>
              <UnitLabel code={row.toUomCode} name={row.toUomName} />
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.factor}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground text-sm tabular-nums">
              {row.factorScale}
            </TableCell>
            <TableCell>
              <Badge variant={row.isActive ? "secondary" : "destructive"}>
                {row.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
              {new Date(row.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button onClick={() => onEdit(row)} size="sm" variant="outline">
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  onClick={() => onArchive(row)}
                  size="sm"
                  variant="destructive"
                >
                  <Archive className="size-3.5" />
                  Archive
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function UomConversionsContent({
  errorMessage,
  isError,
  isLoading,
  onArchive,
  onEdit,
  onRetry,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onArchive: (row: ConversionRow) => void;
  onEdit: (row: ConversionRow) => void;
  onRetry: () => void;
  rows: ConversionRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load UoM conversions."}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-[64px] rounded-none" key={key} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        description="Create purchase, stock, sale, and reporting unit conversions from the button above."
        icon={ArrowRightLeft}
        title="No conversions found"
      />
    );
  }

  return (
    <UomConversionsTable onArchive={onArchive} onEdit={onEdit} rows={rows} />
  );
}

function UomConversionsScreen() {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConversion, setEditingConversion] = useState<
    ConversionRow | undefined
  >();
  const trimmedQuery = query.trim();
  const conversions = useQuery(
    orpc.catalog.uomConversionCatalogList.queryOptions({
      input: trimmedQuery ? { q: trimmedQuery } : {},
    })
  );
  const uoms = useQuery(orpc.catalog.uomList.queryOptions({ input: {} }));
  const categories = useQuery(
    orpc.catalog.categoryList.queryOptions({ input: {} })
  );
  const products = useQuery(orpc.product.catalog.queryOptions({ input: {} }));
  const skus = useQuery(
    orpc.catalog.skuCatalogList.queryOptions({ input: {} })
  );
  const createConversion = useMutation(
    orpc.catalog.uomConversionCreate.mutationOptions()
  );
  const updateConversion = useMutation(
    orpc.catalog.uomConversionUpdate.mutationOptions()
  );
  const archiveConversion = useMutation(
    orpc.catalog.uomConversionArchive.mutationOptions()
  );
  const rows = conversions.data ?? [];
  const settled = !(conversions.isLoading || conversions.isError);
  const isSaving = createConversion.isPending || updateConversion.isPending;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          UoM conversions
        </h1>
        <p className="text-muted-foreground">
          Unit conversion rules joined to their product, SKU, category, and unit
          names.
        </p>
      </div>

      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              aria-label="Refresh UoM conversions"
              onClick={() => conversions.refetch()}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              onClick={() => {
                setEditingConversion(undefined);
                setDialogOpen(true);
              }}
              type="button"
            >
              <Plus className="size-4" />
              New conversion
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="Unit conversion registry"
      >
        <UomConversionsContent
          errorMessage={conversions.error?.message}
          isError={conversions.isError}
          isLoading={conversions.isLoading}
          onArchive={async (row) => {
            try {
              await archiveConversion.mutateAsync({ id: row.id });
              toast.success("Conversion archived");
              await conversions.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive conversion."
              );
            }
          }}
          onEdit={(row) => {
            setEditingConversion(row);
            setDialogOpen(true);
          }}
          onRetry={() => conversions.refetch()}
          rows={rows}
        />
      </DataTableCard>
      {dialogOpen ? (
        <ConversionDialog
          categories={categories.data ?? []}
          conversion={editingConversion}
          isSaving={isSaving}
          key={editingConversion?.id ?? "new"}
          onOpenChange={setDialogOpen}
          onSubmit={async (values) => {
            try {
              if (editingConversion) {
                await updateConversion.mutateAsync({
                  categoryId: values.categoryId,
                  factor: values.factor,
                  factorScale: values.factorScale,
                  fromUomId: values.fromUomId,
                  id: editingConversion.id,
                  isActive: values.isActive,
                  productId: values.productId,
                  role: values.role,
                  skuId: values.skuId,
                  toUomId: values.toUomId,
                });
                toast.success("Conversion updated");
              } else {
                await createConversion.mutateAsync({
                  categoryId: values.categoryId ?? undefined,
                  factor: values.factor,
                  factorScale: values.factorScale,
                  fromUomId: values.fromUomId,
                  productId: values.productId ?? undefined,
                  role: values.role,
                  skuId: values.skuId ?? undefined,
                  toUomId: values.toUomId,
                });
                toast.success("Conversion created");
              }
              setDialogOpen(false);
              setEditingConversion(undefined);
              await conversions.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not save conversion."
              );
            }
          }}
          open={dialogOpen}
          products={products.data ?? []}
          skus={skus.data ?? []}
          uoms={uoms.data ?? []}
        />
      ) : null}
    </div>
  );
}
