import type { AppRouterClient } from "@RetailOS/api/routers/index";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { StatCard } from "@RetailOS/ui/components/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  ClipboardCheck,
  ExternalLink,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Store,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

import { ErrorState, LoadingRows } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/operations")({
  component: OperationsScreen,
});

type ReportsClient = AppRouterClient["reports"];
type OperationsSummary = Awaited<
  ReturnType<ReportsClient["operationsSummary"]>
>;

const SKELETON_KEYS = ["summary", "inventory", "pos", "bond"] as const;

interface Workstream {
  description: string;
  href: string;
  label: string;
  status: "active" | "attention" | "settled";
  value: number;
}

function statusLabel(status: Workstream["status"]): string {
  if (status === "attention") {
    return "Needs review";
  }
  if (status === "settled") {
    return "Settled";
  }
  return "Active";
}

function statusVariant(status: Workstream["status"]) {
  if (status === "attention") {
    return "destructive" as const;
  }
  if (status === "settled") {
    return "secondary" as const;
  }
  return "default" as const;
}

function WorkstreamTable({ rows }: { rows: Workstream[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Workflow</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Count</TableHead>
          <TableHead className="w-[120px] text-right">Open</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell>
              <div className="flex flex-col gap-1">
                <span className="font-medium">{row.label}</span>
                <span className="text-muted-foreground text-xs">
                  {row.description}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant(row.status)}>
                {statusLabel(row.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.value}
            </TableCell>
            <TableCell className="text-right">
              <Button
                nativeButton={false}
                render={<Link to={row.href as never} />}
                size="sm"
                variant="ghost"
              >
                View
                <ExternalLink className="size-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OperationsError({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 shadow-sm">
      <CardContent className="p-5">
        <ErrorState message={message} />
      </CardContent>
    </Card>
  );
}

function SummaryCards({
  data,
  isLoading,
}: {
  data: OperationsSummary | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-28 rounded-2xl" key={key} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        hint="Currently running tills"
        icon={WalletCards}
        label="Open shifts"
        value={data?.pos.openShifts ?? 0}
      />
      <StatCard
        hint="Shipped, not yet received"
        icon={ArrowRightLeft}
        label="In transit"
        value={data?.transfers.shipped ?? 0}
      />
      <StatCard
        className={
          (data?.transfers.overdue ?? 0) > 0
            ? "border-destructive/40"
            : undefined
        }
        hint="Expected receipt date passed"
        icon={TriangleAlert}
        label="Overdue transfers"
        value={data?.transfers.overdue ?? 0}
      />
      <StatCard
        hint="Open receipts + pending releases"
        icon={ShieldCheck}
        label="Bonded queue"
        value={
          (data?.bonds.receiptsOpen ?? 0) +
          (data?.bonds.releasesPending ?? 0) +
          (data?.bonds.releasesApproved ?? 0)
        }
      />
    </div>
  );
}

function buildWorkstreams(data: OperationsSummary | undefined): Workstream[] {
  return [
    {
      description: "Registers and drawer sessions that are currently open.",
      href: "/shifts",
      label: "Cash control",
      status: (data?.pos.openShifts ?? 0) > 0 ? "active" : "settled",
      value: data?.pos.openShifts ?? 0,
    },
    {
      description: "Stock transfers that have shipped but are not received.",
      href: "/transfers",
      label: "Transfer pipeline",
      status: (data?.transfers.overdue ?? 0) > 0 ? "attention" : "active",
      value: data?.transfers.shipped ?? 0,
    },
    {
      description: "Bonded receipts and release requests awaiting action.",
      href: "/bonds",
      label: "Bonded goods",
      status:
        (data?.bonds.releasesPending ?? 0) +
          (data?.bonds.releasesApproved ?? 0) >
        0
          ? "attention"
          : "active",
      value:
        (data?.bonds.receiptsOpen ?? 0) +
        (data?.bonds.releasesPending ?? 0) +
        (data?.bonds.releasesApproved ?? 0),
    },
    {
      description: "Closed shifts today for end-of-day reconciliation.",
      href: "/sales",
      label: "Today’s settlement",
      status: "settled",
      value: data?.pos.closedToday ?? 0,
    },
  ];
}

function OperationsTabs({ data }: { data: OperationsSummary | undefined }) {
  const rows = buildWorkstreams(data);

  return (
    <Tabs className="gap-6" defaultValue="overview">
      <TabsList
        className="w-full justify-start gap-0 overflow-x-auto rounded-none border-b bg-transparent p-0"
        variant="line"
      >
        <TabsTrigger className="rounded-none border-0 px-4" value="overview">
          Overview
        </TabsTrigger>
        <TabsTrigger className="rounded-none border-0 px-4" value="inventory">
          Inventory flow
        </TabsTrigger>
        <TabsTrigger className="rounded-none border-0 px-4" value="pos">
          POS control
        </TabsTrigger>
        <TabsTrigger className="rounded-none border-0 px-4" value="compliance">
          Bonded compliance
        </TabsTrigger>
      </TabsList>

      <TabsContent className="space-y-6 text-base" value="overview">
        <DataTableCard
          count={rows.length}
          footer="Counts are read from tenant-scoped production workflow tables."
          title="Operating workstreams"
        >
          <WorkstreamTable rows={rows} />
        </DataTableCard>
      </TabsContent>

      <TabsContent className="grid gap-4 lg:grid-cols-3" value="inventory">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Inventory movement control</CardTitle>
            <CardDescription>
              Transfer status is grouped from stock transfer headers. Use the
              linked modules for line-level movement, receiving, and ledger
              audit.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <StatCard
              hint="Awaiting shipment"
              icon={ClipboardCheck}
              label="Draft"
              value={data?.transfers.draft ?? 0}
            />
            <StatCard
              hint="On the way"
              icon={ArrowRightLeft}
              label="Shipped"
              value={data?.transfers.shipped ?? 0}
            />
            <StatCard
              hint="Received today"
              icon={PackageCheck}
              label="Received today"
              value={data?.transfers.receivedToday ?? 0}
            />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Go deeper</CardTitle>
            <CardDescription>
              Operational drill-downs stay in their own workflow pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              nativeButton={false}
              render={<Link to="/inventory" />}
              variant="outline"
            >
              Stock on hand
            </Button>
            <Button
              nativeButton={false}
              render={<Link to="/stock-ledger" />}
              variant="outline"
            >
              Append-only ledger
            </Button>
            <Button
              nativeButton={false}
              render={<Link to="/transfers" />}
              variant="outline"
            >
              Transfers
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent className="grid gap-4 lg:grid-cols-3" value="pos">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>POS operating position</CardTitle>
            <CardDescription>
              Drawer state is summarized without exposing cash totals here. X/Z
              reports remain the authority for tender and reconciliation values.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <StatCard
              hint="Currently active"
              icon={Store}
              label="Open shifts"
              value={data?.pos.openShifts ?? 0}
            />
            <StatCard
              hint="Closed since midnight"
              icon={ReceiptText}
              label="Closed today"
              value={data?.pos.closedToday ?? 0}
            />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Control links</CardTitle>
            <CardDescription>
              Keep cashier action and management review separated.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              nativeButton={false}
              render={<Link to="/pos" />}
              variant="outline"
            >
              Point of Sale
            </Button>
            <Button
              nativeButton={false}
              render={<Link to="/shifts" />}
              variant="outline"
            >
              Shifts
            </Button>
            <Button
              nativeButton={false}
              render={<Link to="/sales" />}
              variant="outline"
            >
              Sales history
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent className="grid gap-4 lg:grid-cols-3" value="compliance">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Bonded goods queue</CardTitle>
            <CardDescription>
              Compliance counts are grouped from bonded receipt and release
              headers. Duty/tax figures stay inside the bonded workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <StatCard
              hint="Open bonded receipts"
              icon={ShieldCheck}
              label="Receipts open"
              value={data?.bonds.receiptsOpen ?? 0}
            />
            <StatCard
              hint="Awaiting review"
              icon={ClipboardCheck}
              label="Pending releases"
              value={data?.bonds.releasesPending ?? 0}
            />
            <StatCard
              hint="Approved, not released"
              icon={PackageCheck}
              label="Approved releases"
              value={data?.bonds.releasesApproved ?? 0}
            />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Compliance drill-down</CardTitle>
            <CardDescription>
              Open the bonded workflow for receipt and release line detail.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              nativeButton={false}
              render={<Link to="/bonds" />}
              variant="outline"
            >
              Bonded goods
            </Button>
            <Button
              nativeButton={false}
              render={<Link to="/reports/number-leases" />}
              variant="outline"
            >
              Number leases report
            </Button>
            <Button
              nativeButton={false}
              render={<Link to="/locations" />}
              variant="outline"
            >
              Locations
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function OperationsScreen() {
  const summary = useQuery(
    orpc.reports.operationsSummary.queryOptions({ input: {} })
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-medium text-muted-foreground text-sm">
            Enterprise command centre
          </p>
          <h1 className="font-semibold text-2xl tracking-tight">Operations</h1>
          <p className="max-w-3xl text-muted-foreground">
            A production cockpit for store operations, warehouse movement, POS
            control, and bonded-goods compliance — all backed by RetailOS APIs.
          </p>
        </div>
        <Button nativeButton={false} render={<Link to="/dashboard" />}>
          Executive dashboard
        </Button>
      </div>

      {summary.isError ? (
        <OperationsError
          message={
            summary.error?.message ?? "Could not load operations summary."
          }
        />
      ) : null}

      <SummaryCards data={summary.data} isLoading={summary.isLoading} />

      {summary.isLoading ? <LoadingRows rows={5} /> : null}
      {summary.isLoading ? null : <OperationsTabs data={summary.data} />}
    </div>
  );
}
