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
  PageBody,
  PageHeader,
  PageMetrics,
} from "@RetailOS/ui/components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { StatCard } from "@RetailOS/ui/components/stat-card";
import { Switch } from "@RetailOS/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { ViewSwitcher } from "@RetailOS/ui/components/view-switcher";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  Building2,
  type LucideIcon,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  TriangleAlert,
  Warehouse,
} from "lucide-react";
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

function EditLocationDialog({
  isSaving,
  location,
  onOpenChange,
  onSubmit,
  open,
}: {
  isSaving: boolean;
  location: LocationRow;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { isSellable: boolean; name: string }) => Promise<void>;
  open: boolean;
}) {
  const [name, setName] = useState(location.name);
  const [isSellable, setIsSellable] = useState(location.isSellable);
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit location</DialogTitle>
          <DialogDescription>
            The type and bonded/quarantine flags are fixed once a location
            exists — structural changes mean a new location plus a transfer.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({ isSellable, name: name.trim() });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="edit-location-name">Name</Label>
            <Input
              autoFocus
              id="edit-location-name"
              minLength={1}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={isSellable}
              id="edit-location-sellable"
              onCheckedChange={(checked) => setIsSellable(checked === true)}
            />
            <Label className="text-sm" htmlFor="edit-location-sellable">
              Sellable (appears in the POS location picker)
            </Label>
          </div>
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : "Save location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveLocationDialog({
  isSaving,
  location,
  onConfirm,
  onOpenChange,
  open,
}: {
  isSaving: boolean;
  location: LocationRow;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archive {location.name}?</DialogTitle>
          <DialogDescription>
            The location disappears from pickers going forward. A location that
            still holds stock can’t be archived — transfer or adjust the stock
            out first. Nothing is deleted; movement history stays intact.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Keep it
          </Button>
          <Button disabled={isSaving} onClick={onConfirm} variant="destructive">
            {isSaving ? "Archiving…" : "Archive location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  onArchive,
  onEdit,
  rows,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onArchive: (row: LocationRow) => void;
  onEdit: (row: LocationRow) => void;
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
          <TableHead className="text-right">Actions</TableHead>
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
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => onEdit(location)}
                  size="sm"
                  variant="outline"
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  onClick={() => onArchive(location)}
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

// The location.list DTO is flat, but the design language calls for a
// Warehouse → facility hierarchy view. We group by location type into an
// expandable tree so a manager can scan "all warehouses / all stores / all
// bonded" at a glance — the same data, shaped the way the eye reads it.
const HIERARCHY_ORDER: LocationType[] = [
  "warehouse",
  "distribution_center",
  "fulfillment_center",
  "store",
  "bonded",
];

const GROUP_ICONS: Record<LocationType, LucideIcon> = {
  warehouse: Warehouse,
  distribution_center: Warehouse,
  fulfillment_center: Warehouse,
  store: Building2,
  bonded: ShieldCheck,
};

function LocationHierarchy({
  onEdit,
  rows,
}: {
  onEdit: (row: LocationRow) => void;
  rows: LocationRow[];
}) {
  const groups = HIERARCHY_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type] ?? type,
    icon: GROUP_ICONS[type],
    items: rows.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) {
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
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div className="overflow-hidden rounded-2xl border" key={group.type}>
            <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
              <GroupIcon className="size-4 text-muted-foreground" />
              <span className="font-medium">{group.label}</span>
              <Badge className="ml-auto" variant="secondary">
                {group.items.length}
              </Badge>
            </div>
            <ul className="divide-y">
              {group.items.map((location) => (
                <li
                  className="flex items-center gap-3 px-4 py-3 pl-10"
                  key={location.id}
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-primary/50" />
                  <span className="min-w-0 flex-1 truncate font-medium text-sm">
                    {location.name}
                  </span>
                  <CapabilityBadges location={location} />
                  <Button
                    onClick={() => onEdit(location)}
                    size="sm"
                    variant="ghost"
                  >
                    <Pencil className="size-3.5" />
                    <span className="sr-only">Edit {location.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function LocationMetrics({
  isLoading,
  rows,
  settled,
}: {
  isLoading: boolean;
  rows: LocationRow[];
  settled: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SKELETON_KEYS.slice(0, 4).map((k) => (
          <Skeleton className="h-28 rounded-2xl" key={k} />
        ))}
      </div>
    );
  }
  const storeCount = rows.filter((l) => l.type === "store").length;
  const warehouseCount = rows.filter((l) => l.type === "warehouse").length;
  const bondedCount = rows.filter((l) => l.isBonded).length;
  return (
    <PageMetrics>
      <StatCard
        hint="All facilities"
        icon={MapPin}
        label="Locations"
        value={settled ? rows.length : "—"}
      />
      <StatCard
        hint="Retail outlets"
        icon={Building2}
        label="Stores"
        value={settled ? storeCount : "—"}
      />
      <StatCard
        hint="Storage sites"
        icon={Warehouse}
        label="Warehouses"
        value={settled ? warehouseCount : "—"}
      />
      <StatCard
        hint="Bonded facilities"
        icon={ShieldCheck}
        label="Bonded"
        value={settled ? bondedCount : "—"}
      />
    </PageMetrics>
  );
}

function LocationsScreen() {
  // location.list returns a display-safe DTO; counts below are plain array
  // tallies (not money/business math), so deriving them client-side is safe.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LocationRow | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<LocationRow | undefined>();
  const [view, setView] = useState<"table" | "hierarchy">("table");
  const locations = useQuery(
    // The management screen is the ONE place internal in-transit nodes are
    // visible (with their badge) — every picker elsewhere excludes them.
    orpc.location.list.queryOptions({ input: { includeTransit: true } })
  );
  const createLocation = useMutation(orpc.location.create.mutationOptions());
  const updateLocation = useMutation(orpc.location.update.mutationOptions());
  const archiveLocation = useMutation(orpc.location.archive.mutationOptions());

  const rows = locations.data ?? [];
  const settled = !(locations.isLoading || locations.isError);
  const companyId = rows.at(0)?.companyId;

  return (
    <PageBody className="mx-auto w-full max-w-7xl p-6">
      <PageHeader
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
        description="Your stores, warehouses, and bonded facilities."
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </span>
            Locations
          </span>
        }
      />

      <LocationMetrics
        isLoading={locations.isLoading}
        rows={rows}
        settled={settled}
      />

      <DataTableCard
        actions={
          <ViewSwitcher
            onChange={(next) => setView(next as "table" | "hierarchy")}
            value={view}
            views={["table", "hierarchy"]}
          />
        }
        count={settled ? rows.length : undefined}
        footer={
          settled && rows.length > 0
            ? `${rows.length} location${rows.length === 1 ? "" : "s"}`
            : undefined
        }
        title="All locations"
      >
        {view === "hierarchy" ? (
          <LocationHierarchy onEdit={setEditTarget} rows={rows} />
        ) : (
          <LocationsTable
            errorMessage={locations.error?.message}
            isError={locations.isError}
            isLoading={locations.isLoading}
            onArchive={setArchiveTarget}
            onEdit={setEditTarget}
            rows={rows}
          />
        )}
      </DataTableCard>
      {editTarget ? (
        <EditLocationDialog
          isSaving={updateLocation.isPending}
          key={editTarget.id}
          location={editTarget}
          onOpenChange={(open) => {
            if (!open) {
              setEditTarget(undefined);
            }
          }}
          onSubmit={async (values) => {
            try {
              await updateLocation.mutateAsync({
                id: editTarget.id,
                ...values,
              });
              toast.success("Location updated");
              setEditTarget(undefined);
              await locations.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not update location."
              );
            }
          }}
          open={Boolean(editTarget)}
        />
      ) : null}
      {archiveTarget ? (
        <ArchiveLocationDialog
          isSaving={archiveLocation.isPending}
          key={archiveTarget.id}
          location={archiveTarget}
          onConfirm={async () => {
            try {
              await archiveLocation.mutateAsync({ id: archiveTarget.id });
              toast.success("Location archived");
              setArchiveTarget(undefined);
              await locations.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive location."
              );
            }
          }}
          onOpenChange={(open) => {
            if (!open) {
              setArchiveTarget(undefined);
            }
          }}
          open={Boolean(archiveTarget)}
        />
      ) : null}
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
    </PageBody>
  );
}
