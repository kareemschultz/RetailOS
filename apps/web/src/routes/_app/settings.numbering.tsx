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
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Hash, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/settings/numbering")({
  component: NumberingScreen,
});

const SKELETON_KEYS = ["a", "b", "c"] as const;
const MAX_RANGE_END = 2_000_000_000;

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  sale: "Receipt / sale",
};

interface BlockRow {
  companyId: string;
  companyName: string;
  docType: string;
  fiscalYear: number | null;
  id: string;
  locationId: string | null;
  locationName: string | null;
  next: number;
  rangeEnd: number;
  rangeStart: number;
  series: string;
}

function BlockDialog({
  companies,
  isSaving,
  onOpenChange,
  onSubmit,
  open,
}: {
  companies: Array<{ id: string; name: string }>;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    companyId: string;
    docType: "invoice" | "sale";
    rangeEnd: number;
    rangeStart: number;
    series: string;
  }) => Promise<void>;
  open: boolean;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [docType, setDocType] = useState<"invoice" | "sale">("sale");
  const [series, setSeries] = useState("default");
  const [rangeStart, setRangeStart] = useState("1");
  const [rangeEnd, setRangeEnd] = useState("999999");
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New number block</DialogTitle>
          <DialogDescription>
            A sequential, tamper-evident range for receipts or invoices. Blocks
            can’t be edited once created — when one runs out, create the next.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const start = Number.parseInt(rangeStart, 10);
            const end = Number.parseInt(rangeEnd, 10);
            if (!(Number.isInteger(start) && start >= 1)) {
              toast.error("Range start must be a positive whole number.");
              return;
            }
            if (!(Number.isInteger(end) && end >= start)) {
              toast.error("Range end must be at least the range start.");
              return;
            }
            if (end > MAX_RANGE_END) {
              toast.error("Range end is limited to 2,000,000,000.");
              return;
            }
            if (!companyId) {
              toast.error("Choose a company.");
              return;
            }
            await onSubmit({
              companyId,
              docType,
              rangeEnd: end,
              rangeStart: start,
              series: series.trim() || "default",
            });
          }}
        >
          <div className="grid gap-2">
            <Label>Company</Label>
            <Select
              onValueChange={(value) => setCompanyId(value ?? "")}
              value={companyId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Document type</Label>
            <Select
              onValueChange={(value) =>
                setDocType((value ?? "sale") as "invoice" | "sale")
              }
              value={docType}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">Receipt / sale</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="block-series">Series</Label>
            <Input
              id="block-series"
              onChange={(event) => setSeries(event.target.value)}
              placeholder="default"
              value={series}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="block-start">Range start</Label>
              <Input
                id="block-start"
                min={1}
                onChange={(event) => setRangeStart(event.target.value)}
                required
                type="number"
                value={rangeStart}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="block-end">Range end</Label>
              <Input
                id="block-end"
                min={1}
                onChange={(event) => setRangeEnd(event.target.value)}
                required
                type="number"
                value={rangeEnd}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Creating…" : "Create block"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BlocksContent({
  errorMessage,
  isError,
  isLoading,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  rows: BlockRow[];
}) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" />
        </div>
        <p className="font-medium">Couldn’t load number blocks</p>
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
          <Hash className="size-5" />
        </div>
        <p className="font-medium">No number blocks yet</p>
        <p className="text-muted-foreground text-sm">
          Receipts and invoices draw sequential numbers from blocks. Create the
          first one to start issuing documents.
        </p>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Series</TableHead>
          <TableHead className="text-right">Range</TableHead>
          <TableHead className="text-right">Next number</TableHead>
          <TableHead className="text-right">Remaining</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const remaining = row.rangeEnd - row.next + 1;
          return (
            <TableRow key={row.id}>
              <TableCell>
                <p className="font-medium">{row.companyName}</p>
                {row.locationName ? (
                  <p className="text-muted-foreground text-xs">
                    {row.locationName}
                  </p>
                ) : null}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {DOC_TYPE_LABELS[row.docType] ?? row.docType}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{row.series}</TableCell>
              <TableCell className="text-right font-mono text-xs">
                {row.rangeStart.toLocaleString()}–
                {row.rangeEnd.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-medium font-mono">
                {row.next.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                {remaining <= 0 ? (
                  <Badge variant="destructive">Exhausted</Badge>
                ) : (
                  <span className="font-mono text-sm">
                    {remaining.toLocaleString()}
                  </span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function NumberingScreen() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const blocks = useQuery(orpc.numbering.blockList.queryOptions({ input: {} }));
  const companies = useQuery(orpc.company.list.queryOptions({ input: {} }));
  const createBlock = useMutation(orpc.numbering.blockCreate.mutationOptions());
  const rows = (blocks.data ?? []) as BlockRow[];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Link
          className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
          to="/settings"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Document numbering
          </h1>
          <p className="text-muted-foreground">
            Sequential number ranges for receipts and invoices — no two
            terminals can ever mint the same number, and issued ranges are
            immutable.
          </p>
        </div>
      </div>
      <DataTableCard
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New block
          </Button>
        }
        count={blocks.isSuccess ? rows.length : undefined}
        title="Number blocks"
      >
        <BlocksContent
          errorMessage={blocks.error?.message}
          isError={blocks.isError}
          isLoading={blocks.isLoading}
          rows={rows}
        />
      </DataTableCard>
      {dialogOpen ? (
        <BlockDialog
          companies={(companies.data ?? []).map((company) => ({
            id: company.id,
            name: company.name,
          }))}
          isSaving={createBlock.isPending}
          onOpenChange={setDialogOpen}
          onSubmit={async (values) => {
            try {
              await createBlock.mutateAsync(values);
              toast.success("Number block created");
              setDialogOpen(false);
              await blocks.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not create the block."
              );
            }
          }}
          open={dialogOpen}
        />
      ) : null}
    </div>
  );
}
