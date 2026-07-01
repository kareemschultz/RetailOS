import type { AppRouterClient } from "@RetailOS/api/routers/index";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
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
  Building2,
  type LucideIcon,
  MapPin,
  Plus,
  ShieldCheck,
  TriangleAlert,
  Warehouse,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/locations")({
  component: LocationsScreen,
});

// Exact server DTO (display-safe projection from location.list — no cash-control
// toggles, removal strategy, or capacity seams). Derived from the router client
// so the page can never drift from the backend's returned shape.
type LocationRow = Awaited<
  ReturnType<AppRouterClient["location"]["list"]>
>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

const TYPE_LABELS: Record<string, string> = {
  store: "Store",
  warehouse: "Warehouse",
  bonded: "Bonded",
  distribution_center: "Distribution center",
  fulfillment_center: "Fulfillment center",
};

type LocationType =
  | "store"
  | "warehouse"
  | "bonded"
  | "distribution_center"
  | "fulfillment_center";

const LOCATION_TYPES: Array<{ label: string; value: LocationType }> = [
  { label: "Store", value: "store" },
  { label: "Warehouse", value: "warehouse" },
  { label: "Bonded", value: "bonded" },
  { label: "Distribution center", value: "distribution_center" },
  { label: "Fulfillment center", value: "fulfillment_center" },
];

function LocationDialog({
  companyId,
  isSaving,
  onCreated,
  onOpenChange,
  open,
}: {
  companyId?: string;
  isSaving: boolean;
  onCreated: (values: {
    companyId: string;
    name: string;
    type: LocationType;
  }) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>("store");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New location</DialogTitle>
          <DialogDescription>
            Add a store, warehouse, or bonded facility for POS and inventory.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!companyId) {
              toast.error("Load an existing company before adding a location.");
              return;
            }
            await onCreated({ companyId, name: name.trim(), type });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="location-name">Name</Label>
            <Input
              autoFocus
              id="location-name"
              minLength={1}
              onChange={(event) => setName(event.target.value)}
              placeholder="Main Store"
              required
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select
              onValueChange={(value) =>
                setType((value ?? "store") as LocationType)
              }
              value={type}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button disabled={isSaving || !companyId} type="submit">
              {isSaving ? "Saving…" : "Create location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="truncate font-mono font-semibold text-2xl tracking-tight">
            {value}
          </p>
          {hint ? (
            <p className="text-muted-foreground text-xs">{hint}</p>
          ) : null}
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function CapabilityBadges({ location }: { location: LocationRow }) {
  const flags: string[] = [];
  if (location.isSellable) {
    flags.push("Sellable");
  }
  if (location.isBonded) {
    flags.push("Bonded");
  }
  if (location.isTransit) {
    flags.push("In-transit");
  }
  if (location.isQuarantine) {
    flags.push("Quarantine");
  }

  if (flags.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <Badge key={flag} variant="outline">
          {flag}
        </Badge>
      ))}
    </div>
  );
}

function LocationsTable({
  isLoading,
  isError,
  errorMessage,
  rows,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  rows: LocationRow[];
}) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" />
        </div>
        <p className="font-medium">Couldn’t load locations</p>
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
          <Skeleton className="h-[60px] rounded-none" key={k} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <MapPin className="size-5" />
        </div>
        <p className="font-medium">No locations yet</p>
        <p className="text-muted-foreground text-sm">
          Stores, warehouses, and bonded facilities will appear here.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[220px]">Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="min-w-[200px]">Capabilities</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((location) => (
          <TableRow key={location.id}>
            <TableCell className="font-medium">{location.name}</TableCell>
            <TableCell>
              <Badge variant="secondary">
                {TYPE_LABELS[location.type] ?? location.type}
              </Badge>
            </TableCell>
            <TableCell>
              <CapabilityBadges location={location} />
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm">
              {new Date(location.createdAt).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LocationsScreen() {
  // location.list returns a display-safe DTO; counts below are plain array
  // tallies (not money/business math), so deriving them client-side is safe.
  const [dialogOpen, setDialogOpen] = useState(false);
  const locations = useQuery(orpc.location.list.queryOptions({ input: {} }));
  const createLocation = useMutation(orpc.location.create.mutationOptions());

  const rows = locations.data ?? [];
  const settled = !(locations.isLoading || locations.isError);
  const companyId = rows.at(0)?.companyId;

  const storeCount = rows.filter((l) => l.type === "store").length;
  const warehouseCount = rows.filter((l) => l.type === "warehouse").length;
  const bondedCount = rows.filter((l) => l.isBonded).length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Locations</h1>
        <p className="text-muted-foreground">
          Your stores, warehouses, and bonded facilities.
        </p>
      </div>

      {locations.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SKELETON_KEYS.slice(0, 4).map((k) => (
            <Skeleton className="h-28 rounded-2xl" key={k} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            hint="All facilities"
            icon={MapPin}
            label="Locations"
            value={settled ? rows.length : "—"}
          />
          <KpiCard
            hint="Retail outlets"
            icon={Building2}
            label="Stores"
            value={settled ? storeCount : "—"}
          />
          <KpiCard
            hint="Storage sites"
            icon={Warehouse}
            label="Warehouses"
            value={settled ? warehouseCount : "—"}
          />
          <KpiCard
            hint="Bonded facilities"
            icon={ShieldCheck}
            label="Bonded"
            value={settled ? bondedCount : "—"}
          />
        </div>
      )}

      <DataTableCard
        actions={
          <Button
            disabled={!companyId}
            onClick={() => setDialogOpen(true)}
            title={
              companyId
                ? "Add location"
                : "At least one existing company/location must load first"
            }
          >
            <Plus className="size-4" />
            New location
          </Button>
        }
        count={settled ? rows.length : undefined}
        footer={
          settled && rows.length > 0
            ? `${rows.length} location${rows.length === 1 ? "" : "s"}`
            : undefined
        }
        title="All locations"
      >
        <LocationsTable
          errorMessage={locations.error?.message}
          isError={locations.isError}
          isLoading={locations.isLoading}
          rows={rows}
        />
      </DataTableCard>
      {dialogOpen ? (
        <LocationDialog
          companyId={companyId}
          isSaving={createLocation.isPending}
          onCreated={async (values) => {
            try {
              await createLocation.mutateAsync(values);
              toast.success("Location created");
              setDialogOpen(false);
              await locations.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not create location."
              );
            }
          }}
          onOpenChange={setDialogOpen}
          open={dialogOpen}
        />
      ) : null}
    </div>
  );
}
