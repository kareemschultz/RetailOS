import { Badge } from "@RetailOS/ui/components/badge";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BarChart3,
  CircleDollarSign,
  FileSpreadsheet,
  History,
  Landmark,
  type LucideIcon,
  Package,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Ticket,
} from "lucide-react";

export const Route = createFileRoute("/_app/reports/")({
  component: ReportsHub,
});

interface ReportCard {
  description: string;
  icon: LucideIcon;
  title: string;
  to: LinkProps["to"];
}

// Every card links to a REAL, live screen — this hub never lists a
// destination that doesn't exist. Upcoming reports live in the quiet
// section at the bottom, clearly marked, never as dead links.
const AVAILABLE_REPORTS: ReportCard[] = [
  {
    description: "Look up sales, view receipts, and process refunds or voids.",
    icon: ReceiptText,
    title: "Sales console",
    to: "/sales",
  },
  {
    description: "Stock on hand by product, location, and lot.",
    icon: Package,
    title: "Stock on hand",
    to: "/inventory",
  },
  {
    description:
      "Every stock movement ever recorded — receipts, sales, transfers, adjustments.",
    icon: History,
    title: "Stock ledger",
    to: "/stock-ledger",
  },
  {
    description: "Transfers between locations, including goods in transit.",
    icon: ArrowLeftRight,
    title: "Transfers",
    to: "/transfers",
  },
  {
    description: "Bonded receipts, duty status, and release history.",
    icon: ShieldCheck,
    title: "Bonded goods",
    to: "/bonds",
  },
  {
    description: "Till sessions, cash movements, and end-of-day closes.",
    icon: CircleDollarSign,
    title: "Shifts & cash",
    to: "/shifts",
  },
  {
    description: "Manual journals, chart of accounts, and posting periods.",
    icon: Landmark,
    title: "Journals",
    to: "/financials",
  },
  {
    description:
      "Document-number blocks leased to terminals and offline devices.",
    icon: Ticket,
    title: "Number leases",
    to: "/reports/number-leases",
  },
  {
    description: "Who changed what, when — the immutable audit trail.",
    icon: ScrollText,
    title: "Audit trail",
    to: "/audit-log",
  },
];

const UPCOMING_REPORTS: { description: string; title: string }[] = [
  {
    description:
      "Trial balance, profit & loss, balance sheet, and VAT returns — these need sales and purchases to post to the ledger automatically, which is still being built.",
    title: "Financial statements",
  },
  {
    description:
      "A tamper-evident export of a fiscal year's books for your accountant or the tax authority.",
    title: "Auditor package",
  },
];

function ReportsHub() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
          <BarChart3 className="size-6" />
          Reports
        </h1>
        <p className="text-muted-foreground">
          Every report here opens a live screen backed by your real data.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AVAILABLE_REPORTS.map((report) => (
          <Link className="group" key={report.title} to={report.to}>
            <Card className="h-full shadow-sm transition-colors group-hover:border-primary/40">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <report.icon className="size-5" />
                </div>
                <div>
                  <p className="font-medium">{report.title}</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {report.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
          <FileSpreadsheet className="size-4" />
          Coming soon
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {UPCOMING_REPORTS.map((report) => (
            <Card className="border-dashed shadow-none" key={report.title}>
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-muted-foreground">
                    {report.title}
                  </p>
                  <Badge variant="outline">Coming soon</Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {report.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
