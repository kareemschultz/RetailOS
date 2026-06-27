import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { useEffect } from "react";

import { orpc } from "@/utils/orpc";

import { EmptyState, ErrorState } from "../states";
import type { PosLocation } from "./types";

// Renders pos.locationList. autoSelect (exactly one eligible location) skips the
// dropdown entirely — single-store tenants go login -> auto -> sell. Multi-store
// tenants get a picker. The cashier never types or pastes an id.
export function LocationSelector({
  value,
  onSelect,
}: {
  value: string | null;
  onSelect: (location: PosLocation) => void;
}) {
  const query = useQuery(orpc.pos.locationList.queryOptions({ input: {} }));

  const autoSelect = query.data?.autoSelect ?? false;
  const locations = query.data?.locations;
  const sole = autoSelect ? locations?.[0] : undefined;

  // Auto-select the sole eligible location once it arrives.
  useEffect(() => {
    if (sole && value !== sole.id) {
      onSelect(sole);
    }
  }, [sole, value, onSelect]);

  if (query.isLoading) {
    return <Skeleton className="h-9 w-56" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message="Could not load locations."
        onRetry={() => query.refetch()}
      />
    );
  }

  if (!locations || locations.length === 0) {
    return (
      <EmptyState
        description="Ask an administrator to set up a sellable store before ringing sales."
        icon={Store}
        title="No sellable locations"
      />
    );
  }

  if (sole) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
        <Store className="size-4 text-muted-foreground" />
        <span className="font-medium">{sole.displayName}</span>
      </div>
    );
  }

  return (
    <Select
      onValueChange={(id) => {
        const next = locations.find((loc) => loc.id === id);
        if (next) {
          onSelect(next);
        }
      }}
      value={value ?? undefined}
    >
      <SelectTrigger aria-label="Select store" className="w-56">
        <Store className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Select a store" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.displayName}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
