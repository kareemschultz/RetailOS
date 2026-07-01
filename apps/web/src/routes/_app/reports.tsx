import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ModuleStatusPage } from "@/components/module-status-page";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsLanding,
});

function ReportsLanding() {
  return (
    <ModuleStatusPage
      actions={[
        {
          description:
            "Audit document-number blocks allocated to terminals and offline workflows.",
          label: "Number leases",
          to: "/reports/number-leases",
        },
        {
          description:
            "Accounting reports remain hidden until the GL, journals, and posting periods are real.",
          label: "Financial report status",
          to: "/reports/financial",
        },
      ]}
      eyebrow="Reports"
      icon={BarChart3}
      steps={[
        {
          description:
            "Safe operational report backed by the number-lease API and production schema.",
          label: "Number leases",
          status: "Available",
        },
        {
          description:
            "Stock, transfer, bond, and shift reporting should be promoted here as backend DTOs stabilize.",
          label: "Operational reports",
          status: "In build",
        },
        {
          description:
            "Trial balance, P&L, balance sheet, VAT/GRA reports, and cash-flow reports require Phase 5 accounting.",
          label: "Financial statements",
          status: "Planned",
        },
        {
          description:
            "Exports must be permission-gated and backed by immutable audit/accounting data.",
          label: "Audit exports",
          status: "Planned",
        },
      ]}
      summary="A single place for reports that are backed by real RetailOS data. Available reports open directly; planned financial reports stay clearly marked until the accounting foundation exists."
      title="Reports"
    />
  );
}
