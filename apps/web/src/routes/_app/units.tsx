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
import { Archive, Pencil, Plus, Ruler, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/units")({ component: UnitsScreen });

type CatalogClient = AppRouterClient["catalog"];
type UnitRow = Awaited<ReturnType<CatalogClient["uomList"]>>[number];
type UnitKind = "count" | "weight" | "volume" | "length";

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const KIND_LABELS: Record<string, string> = {
  count: "Count",
  length: "Length",
  volume: "Volume",
  weight: "Weight",
};
const KIND_OPTIONS: Array<{ label: string; value: UnitKind }> = [
  { label: "Count", value: "count" },
  { label: "Weight", value: "weight" },
  { label: "Volume", value: "volume" },
  { label: "Length", value: "length" },
];

function SearchBox({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-9 rounded-lg pl-9"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search units"
        value={value}
      />
    </div>
  );
}

function UnitDialog({
  isSaving,
  onOpenChange,
  onSubmit,
  open,
  unit,
}: {
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    code: string;
    decimalScale: number;
    kind: UnitKind;
    name: string;
  }) => Promise<void>;
  open: boolean;
  unit?: UnitRow;
}) {
  const [name, setName] = useState(unit?.name ?? "");
  const [code, setCode] = useState(unit?.code ?? "");
  const [kind, setKind] = useState<UnitKind>(
    (unit?.kind as UnitKind | undefined) ?? "count"
  );
  const [decimalScale, setDecimalScale] = useState(
    String(unit?.decimalScale ?? 0)
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{unit ? "Edit unit" : "New unit"}</DialogTitle>
          <DialogDescription>
            Units power product quantities, purchasing, inventory, and
            reporting.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const scale = Number.parseInt(decimalScale || "0", 10);
            if (!Number.isInteger(scale) || scale < 0) {
              toast.error(
                "Decimal scale must be a positive whole number or zero."
              );
              return;
            }
            await onSubmit({
              code: code.trim(),
              decimalScale: scale,
              kind,
              name: name.trim(),
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="unit-name">Name</Label>
            <Input
              autoFocus
              id="unit-name"
              minLength={1}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Each"
              required
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unit-code">Code</Label>
            <Input
              id="unit-code"
              minLength={1}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="EA"
              required
              value={code}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Kind</Label>
              <Select
                onValueChange={(value) =>
                  setKind((value ?? "count") as UnitKind)
                }
                value={kind}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit-scale">Decimal scale</Label>
              <Input
                id="unit-scale"
                min={0}
                onChange={(event) => setDecimalScale(event.target.value)}
                required
                type="number"
                value={decimalScale}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : undefined}
              {!isSaving && unit ? "Save unit" : undefined}
              {isSaving || unit ? undefined : "Create unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UnitsTable({
  onArchive,
  onEdit,
  rows,
}: {
  onArchive: (row: UnitRow) => void;
  onEdit: (row: UnitRow) => void;
  rows: UnitRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[260px]">Unit</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead className="text-right">Scale</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.name}</p>
                <p className="text-muted-foreground text-xs">
                  Inventory normalizes quantities to base units.
                </p>
              </div>
            </TableCell>
            <TableCell>
              <span className="font-mono text-muted-foreground text-xs">
                {row.code}
              </span>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {KIND_LABELS[row.kind] ?? row.kind}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.decimalScale}
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

function UnitsContent({
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
  onArchive: (row: UnitRow) => void;
  onEdit: (row: UnitRow) => void;
  onRetry: () => void;
  rows: UnitRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load units of measure."}
          onRetry={onRetry}
        />
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-[60px] rounded-none" key={key} />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        description="Create a unit from the button above."
        icon={Ruler}
        title="No units found"
      />
    );
  }
  return <UnitsTable onArchive={onArchive} onEdit={onEdit} rows={rows} />;
}

function UnitsScreen() {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitRow | undefined>();
  const units = useQuery(orpc.catalog.uomList.queryOptions({ input: {} }));
  const createUnit = useMutation(orpc.catalog.uomCreate.mutationOptions());
  const updateUnit = useMutation(orpc.catalog.uomUpdate.mutationOptions());
  const archiveUnit = useMutation(orpc.catalog.uomArchive.mutationOptions());
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const data = units.data ?? [];
    if (!q) {
      return data;
    }
    return data.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        row.kind.toLowerCase().includes(q)
    );
  }, [units.data, query]);
  const settled = !(units.isLoading || units.isError);
  const isSaving = createUnit.isPending || updateUnit.isPending;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Units</h1>
        <p className="text-muted-foreground">
          Units of measure used by products, SKUs, purchasing, and stock.
        </p>
      </div>
      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              onClick={() => {
                setEditingUnit(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              New unit
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="Units of measure"
      >
        <UnitsContent
          errorMessage={units.error?.message}
          isError={units.isError}
          isLoading={units.isLoading}
          onArchive={async (row) => {
            try {
              await archiveUnit.mutateAsync({ id: row.id });
              toast.success("Unit archived");
              await units.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive unit."
              );
            }
          }}
          onEdit={(row) => {
            setEditingUnit(row);
            setDialogOpen(true);
          }}
          onRetry={() => units.refetch()}
          rows={rows}
        />
      </DataTableCard>
      {dialogOpen ? (
        <UnitDialog
          isSaving={isSaving}
          key={editingUnit?.id ?? "new"}
          onOpenChange={setDialogOpen}
          onSubmit={async (values) => {
            try {
              if (editingUnit) {
                await updateUnit.mutateAsync({ id: editingUnit.id, ...values });
                toast.success("Unit updated");
              } else {
                await createUnit.mutateAsync(values);
                toast.success("Unit created");
              }
              setDialogOpen(false);
              setEditingUnit(undefined);
              await units.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not save unit."
              );
            }
          }}
          open={dialogOpen}
          unit={editingUnit}
        />
      ) : null}
    </div>
  );
}
