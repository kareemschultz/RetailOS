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
import { ArrowLeft, Building2, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/settings/companies")({
  component: CompaniesScreen,
});

const SKELETON_KEYS = ["a", "b"] as const;

interface CompanyRow {
  createdAt: string | Date;
  deletedAt: string | Date | null;
  id: string;
  name: string;
}

function CompanyDialog({
  company,
  isSaving,
  onOpenChange,
  onSubmit,
  open,
}: {
  company?: CompanyRow;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<void>;
  open: boolean;
}) {
  const [name, setName] = useState(company?.name ?? "");
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {company ? "Rename company" : "New company"}
          </DialogTitle>
          <DialogDescription>
            Companies group your stores and warehouses — a business can run
            several legal entities under one roof.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit(name.trim());
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="company-name">Name</Label>
            <Input
              autoFocus
              id="company-name"
              minLength={1}
              onChange={(event) => setName(event.target.value)}
              placeholder="My Trading Ltd"
              required
              value={name}
            />
          </div>
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : "Save company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveCompanyDialog({
  company,
  isSaving,
  onConfirm,
  onOpenChange,
  open,
}: {
  company: CompanyRow;
  isSaving: boolean;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archive {company.name}?</DialogTitle>
          <DialogDescription>
            The company disappears from pickers and reports going forward.
            Companies with active locations can’t be archived — archive or move
            the locations first. Nothing is deleted; history stays intact.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Keep it
          </Button>
          <Button disabled={isSaving} onClick={onConfirm} variant="destructive">
            {isSaving ? "Archiving…" : "Archive company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompaniesContent({
  errorMessage,
  isError,
  isLoading,
  locationCounts,
  onArchive,
  onRename,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  locationCounts: Map<string, number>;
  onArchive: (row: CompanyRow) => void;
  onRename: (row: CompanyRow) => void;
  rows: CompanyRow[];
}) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" />
        </div>
        <p className="font-medium">Couldn’t load companies</p>
        <p className="text-muted-foreground text-sm">
          {errorMessage ?? "Check your permissions and retry."}
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
          <Building2 className="size-5" />
        </div>
        <p className="font-medium">No companies yet</p>
        <p className="text-muted-foreground text-sm">
          Create the first company, then add its stores and warehouses under
          Locations.
        </p>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[240px]">Company</TableHead>
          <TableHead>Locations</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((company) => (
          <TableRow key={company.id}>
            <TableCell className="font-medium">{company.name}</TableCell>
            <TableCell>
              <Badge variant="secondary">
                {locationCounts.get(company.id) ?? 0} location
                {(locationCounts.get(company.id) ?? 0) === 1 ? "" : "s"}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {new Date(company.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => onRename(company)}
                  size="sm"
                  variant="outline"
                >
                  Rename
                </Button>
                <Button
                  onClick={() => onArchive(company)}
                  size="sm"
                  variant="destructive"
                >
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

function CompaniesScreen() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyRow | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<CompanyRow | undefined>();

  const companies = useQuery(orpc.company.list.queryOptions({ input: {} }));
  const locations = useQuery(orpc.location.list.queryOptions({ input: {} }));
  const createCompany = useMutation(orpc.company.create.mutationOptions());
  const updateCompany = useMutation(orpc.company.update.mutationOptions());
  const archiveCompany = useMutation(orpc.company.archive.mutationOptions());

  const rows = (companies.data ?? []) as CompanyRow[];
  const locationCounts = new Map<string, number>();
  for (const location of locations.data ?? []) {
    locationCounts.set(
      location.companyId,
      (locationCounts.get(location.companyId) ?? 0) + 1
    );
  }
  const isSaving = createCompany.isPending || updateCompany.isPending;

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
          <h1 className="font-semibold text-2xl tracking-tight">Companies</h1>
          <p className="text-muted-foreground">
            The legal entities in this business. Stores, warehouses, and bonded
            locations live under a company —{" "}
            <Link className="underline hover:text-foreground" to="/locations">
              manage locations here
            </Link>
            .
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
            New company
          </Button>
        }
        count={companies.isSuccess ? rows.length : undefined}
        title="Companies"
      >
        <CompaniesContent
          errorMessage={companies.error?.message}
          isError={companies.isError}
          isLoading={companies.isLoading}
          locationCounts={locationCounts}
          onArchive={setArchiveTarget}
          onRename={(row) => {
            setEditing(row);
            setDialogOpen(true);
          }}
          rows={rows}
        />
      </DataTableCard>
      {dialogOpen ? (
        <CompanyDialog
          company={editing}
          isSaving={isSaving}
          key={editing?.id ?? "new"}
          onOpenChange={setDialogOpen}
          onSubmit={async (name) => {
            try {
              if (editing) {
                await updateCompany.mutateAsync({ id: editing.id, name });
                toast.success("Company renamed");
              } else {
                await createCompany.mutateAsync({ name });
                toast.success("Company created");
              }
              setDialogOpen(false);
              setEditing(undefined);
              await companies.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not save the company."
              );
            }
          }}
          open={dialogOpen}
        />
      ) : null}
      {archiveTarget ? (
        <ArchiveCompanyDialog
          company={archiveTarget}
          isSaving={archiveCompany.isPending}
          key={archiveTarget.id}
          onConfirm={async () => {
            try {
              await archiveCompany.mutateAsync({ id: archiveTarget.id });
              toast.success("Company archived");
              setArchiveTarget(undefined);
              await companies.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive the company."
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
    </div>
  );
}
