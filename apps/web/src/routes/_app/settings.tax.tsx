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
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { Switch } from "@RetailOS/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Percent, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/settings/tax")({
  component: TaxSettingsScreen,
});

const SKELETON_KEYS = ["a", "b", "c"] as const;
const PERCENT_RE = /^\d{1,3}(\.\d{1,2})?$/;
const TRAILING_ZERO_RE = /0$/;

// "14" -> 1400 bps, "12.5" -> 1250 bps. String math, no float drift.
function percentToBps(input: string): number | null {
  const cleaned = input.trim();
  if (!PERCENT_RE.test(cleaned)) {
    return null;
  }
  const [whole, fraction = ""] = cleaned.split(".");
  const bps = Number(`${whole}${fraction.padEnd(2, "0")}`);
  if (bps < 0 || bps > 10_000) {
    return null;
  }
  return bps;
}

function bpsToPercent(bps: number): string {
  const whole = Math.floor(bps / 100);
  const fraction = bps % 100;
  if (fraction === 0) {
    return `${whole}%`;
  }
  return `${whole}.${String(fraction).padStart(2, "0").replace(TRAILING_ZERO_RE, "")}%`;
}

interface TaxRateRow {
  code: string;
  effectiveFrom: string | Date | null;
  effectiveTo: string | Date | null;
  id: string;
  isActive: boolean;
  kind: string;
  name: string;
  rateBps: number;
}

function TaxDialog({
  isSaving,
  onOpenChange,
  onSubmit,
  open,
  rate,
}: {
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    code?: string;
    isActive: boolean;
    name: string;
    rateBps: number;
  }) => Promise<void>;
  open: boolean;
  rate?: TaxRateRow;
}) {
  const [code, setCode] = useState(rate?.code ?? "VAT");
  const [name, setName] = useState(rate?.name ?? "");
  const [percent, setPercent] = useState(
    rate ? bpsToPercent(rate.rateBps).replace("%", "") : "14"
  );
  const [isActive, setIsActive] = useState(rate?.isActive ?? true);
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rate ? "Edit tax rate" : "New tax rate"}</DialogTitle>
          <DialogDescription>
            {rate
              ? "Once a rate has been charged on a sale its percentage is frozen — create a new rate to change the percentage."
              : "The active sales tax is applied automatically at the register and checkout."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const rateBps = percentToBps(percent);
            if (rateBps == null) {
              toast.error("Enter a rate between 0 and 100 (up to 2 decimals).");
              return;
            }
            await onSubmit({
              code: rate ? undefined : code.trim().toUpperCase(),
              isActive,
              name: name.trim(),
              rateBps,
            });
          }}
        >
          {rate ? null : (
            <div className="grid gap-2">
              <Label htmlFor="tax-code">Code</Label>
              <Input
                id="tax-code"
                maxLength={24}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="VAT"
                required
                value={code}
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="tax-name">Name</Label>
            <Input
              autoFocus
              id="tax-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="VAT 14%"
              required
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tax-percent">Rate (%)</Label>
            <Input
              id="tax-percent"
              inputMode="decimal"
              onChange={(event) => setPercent(event.target.value)}
              placeholder="14"
              required
              value={percent}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={isActive}
              id="tax-active"
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label className="text-sm" htmlFor="tax-active">
              Active (applied to new sales)
            </Label>
          </div>
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : "Save tax rate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaxContent({
  errorMessage,
  isError,
  isLoading,
  onEdit,
  onToggle,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onEdit: (row: TaxRateRow) => void;
  onToggle: (row: TaxRateRow) => void;
  rows: TaxRateRow[];
}) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" />
        </div>
        <p className="font-medium">Couldn’t load tax rates</p>
        <p className="text-muted-foreground text-sm">
          {errorMessage ?? "You need administrator access for tax settings."}
        </p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((k) => (
          <Skeleton className="h-14 rounded-none" key={k} />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Percent className="size-5" />
        </div>
        <p className="font-medium">No tax rates yet</p>
        <p className="text-muted-foreground text-sm">
          Sales are currently tax-free. Add a rate to start charging VAT/GST.
        </p>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Rate</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">{row.code}</TableCell>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-right font-medium font-mono">
              {bpsToPercent(row.rateBps)}
            </TableCell>
            <TableCell>
              {row.isActive ? (
                <Badge>Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button onClick={() => onEdit(row)} size="sm" variant="outline">
                  Edit
                </Button>
                <Button
                  onClick={() => onToggle(row)}
                  size="sm"
                  variant="outline"
                >
                  {row.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TaxSettingsScreen() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRateRow | undefined>();

  const rates = useQuery(orpc.tax.list.queryOptions({ input: {} }));
  const createRate = useMutation(orpc.tax.create.mutationOptions());
  const updateRate = useMutation(orpc.tax.update.mutationOptions());
  const rows = (rates.data ?? []) as TaxRateRow[];
  const isSaving = createRate.isPending || updateRate.isPending;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Link
          className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
          to="/settings"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Tax rates</h1>
          <p className="text-muted-foreground">
            The active sales tax applies automatically at the register. Rates
            already charged on sales keep their percentage forever — supersede,
            don’t rewrite.
          </p>
        </div>
      </div>
      <DataTableCard
        actions={
          <Button
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New tax rate
          </Button>
        }
        count={rates.isSuccess ? rows.length : undefined}
        title="Sales tax"
      >
        <TaxContent
          errorMessage={rates.error?.message}
          isError={rates.isError}
          isLoading={rates.isLoading}
          onEdit={(row) => {
            setEditing(row);
            setDialogOpen(true);
          }}
          onToggle={async (row) => {
            try {
              await updateRate.mutateAsync({
                id: row.id,
                isActive: !row.isActive,
              });
              toast.success(
                row.isActive ? "Rate deactivated" : "Rate activated"
              );
              await rates.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not update the rate."
              );
            }
          }}
          rows={rows}
        />
      </DataTableCard>
      {dialogOpen ? (
        <TaxDialog
          isSaving={isSaving}
          key={editing?.id ?? "new"}
          onOpenChange={setDialogOpen}
          onSubmit={async (values) => {
            try {
              if (editing) {
                await updateRate.mutateAsync({
                  id: editing.id,
                  isActive: values.isActive,
                  name: values.name,
                  rateBps: values.rateBps,
                });
                toast.success("Tax rate updated");
              } else {
                await createRate.mutateAsync({
                  code: values.code ?? "VAT",
                  isActive: values.isActive,
                  name: values.name,
                  rateBps: values.rateBps,
                });
                toast.success("Tax rate created");
              }
              setDialogOpen(false);
              setEditing(undefined);
              await rates.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not save the tax rate."
              );
            }
          }}
          open={dialogOpen}
          rate={editing}
        />
      ) : null}
    </div>
  );
}
