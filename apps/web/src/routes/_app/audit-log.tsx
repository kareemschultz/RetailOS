import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import { Input } from "@RetailOS/ui/components/input";
import { ScrollArea } from "@RetailOS/ui/components/scroll-area";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/audit-log")({
  component: AuditLogScreen,
});

const PAGE_SIZE = 50;
const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f"] as const;

interface AuditRow {
  action: string;
  actorEmail: string | null;
  actorName: string | null;
  actorUserId: string | null;
  createdAt: string | Date;
  entityId: string | null;
  entityType: string;
  id: string;
}

function formatTimestamp(value: string | Date) {
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function AuditDetailDialog({
  entryId,
  onOpenChange,
  open,
}: {
  entryId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const detail = useQuery(
    orpc.audit.detail.queryOptions({ input: { id: entryId } })
  );
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">
            {detail.data?.action ?? "Audit entry"}
          </DialogTitle>
          <DialogDescription>
            {detail.data
              ? `${detail.data.entityType} · ${formatTimestamp(detail.data.createdAt)}`
              : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {detail.isLoading ? <Skeleton className="h-48 rounded-lg" /> : null}
        {detail.data ? (
          <ScrollArea className="max-h-[60vh]">
            <div className="grid gap-4 pr-3">
              <div className="grid gap-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Actor:</span>{" "}
                  {detail.data.actorUserId ?? "system"}
                </p>
                <p>
                  <span className="text-muted-foreground">Entity:</span>{" "}
                  <span className="font-mono text-xs">
                    {detail.data.entityId ?? "—"}
                  </span>
                </p>
                {detail.data.idempotencyKey ? (
                  <p>
                    <span className="text-muted-foreground">
                      Idempotency key:
                    </span>{" "}
                    <span className="font-mono text-xs">
                      {detail.data.idempotencyKey}
                    </span>
                  </p>
                ) : null}
              </div>
              {detail.data.before == null ? null : (
                <div>
                  <p className="mb-1 font-medium text-sm">Before</p>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                    {JSON.stringify(detail.data.before, null, 2)}
                  </pre>
                </div>
              )}
              {detail.data.after == null ? null : (
                <div>
                  <p className="mb-1 font-medium text-sm">After</p>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                    {JSON.stringify(detail.data.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AuditContent({
  errorMessage,
  isError,
  isLoading,
  onSelect,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onSelect: (row: AuditRow) => void;
  rows: AuditRow[];
}) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" />
        </div>
        <p className="font-medium">Couldn’t load the audit trail</p>
        <p className="text-muted-foreground text-sm">
          {errorMessage ?? "You need administrator access to view audits."}
        </p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((k) => (
          <Skeleton className="h-12 rounded-none" key={k} />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ScrollText className="size-5" />
        </div>
        <p className="font-medium">No matching audit entries</p>
        <p className="text-muted-foreground text-sm">
          Adjust the filters, or come back after some activity.
        </p>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Entity</TableHead>
          <TableHead>Actor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            className="cursor-pointer"
            key={row.id}
            onClick={() => onSelect(row)}
          >
            <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
              {formatTimestamp(row.createdAt)}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                <span className="font-mono text-[11px]">{row.action}</span>
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {row.entityType}
            </TableCell>
            <TableCell className="text-sm">
              {row.actorName ?? row.actorUserId ?? "system"}
              {row.actorEmail ? (
                <span className="block text-muted-foreground text-xs">
                  {row.actorEmail}
                </span>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AuditLogScreen() {
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AuditRow | undefined>();

  const page = useQuery(
    orpc.audit.list.queryOptions({
      input: {
        action: actionFilter.trim() || undefined,
        entityType: entityFilter.trim() || undefined,
        limit: PAGE_SIZE,
        offset,
      },
    })
  );
  const rows = (page.data?.rows ?? []) as AuditRow[];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Audit trail</h1>
        <p className="text-muted-foreground">
          Every change, immutably recorded — who did what, when, and what it
          looked like before and after.
        </p>
      </div>
      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Input
              aria-label="Filter by action"
              className="h-9 rounded-lg sm:w-52"
              onChange={(event) => {
                setActionFilter(event.target.value);
                setOffset(0);
              }}
              placeholder="Action, e.g. product.update"
              value={actionFilter}
            />
            <Input
              aria-label="Filter by entity type"
              className="h-9 rounded-lg sm:w-44"
              onChange={(event) => {
                setEntityFilter(event.target.value);
                setOffset(0);
              }}
              placeholder="Entity, e.g. product"
              value={entityFilter}
            />
          </div>
        }
        footer={
          page.isSuccess
            ? `Showing ${rows.length} entr${rows.length === 1 ? "y" : "ies"} from ${offset + 1}`
            : undefined
        }
        title="Recent activity"
      >
        <AuditContent
          errorMessage={page.error?.message}
          isError={page.isError}
          isLoading={page.isLoading}
          onSelect={setSelected}
          rows={rows}
        />
      </DataTableCard>
      <div className="flex justify-end gap-2">
        <Button
          disabled={offset === 0 || page.isLoading}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          variant="outline"
        >
          Newer
        </Button>
        <Button
          disabled={!page.data?.hasMore || page.isLoading}
          onClick={() => setOffset(offset + PAGE_SIZE)}
          variant="outline"
        >
          Older
        </Button>
      </div>
      {selected ? (
        <AuditDetailDialog
          entryId={selected.id}
          key={selected.id}
          onOpenChange={(open) => {
            if (!open) {
              setSelected(undefined);
            }
          }}
          open={Boolean(selected)}
        />
      ) : null}
    </div>
  );
}
