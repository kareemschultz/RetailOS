import { createFileRoute } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { ModuleStatusPage } from "@/components/module-status-page";

export const Route = createFileRoute("/_app/financials")({
  component: FinancialsLanding,
});

function FinancialsLanding() {
  return (
    <ModuleStatusPage
      actions={[
        {
          description: "Current safe report while accounting is being built.",
          label: "Number leases report",
          to: "/reports/number-leases",
        },
        {
          description:
            "The accounting dashboard is intentionally unavailable until GL is real.",
          label: "Financial report status",
          to: "/reports/financial",
        },
      ]}
      eyebrow="Financials"
      icon={Landmark}
      steps={[
        {
          description:
            "Chart of accounts, posting periods, journal headers, journal lines, and structural balance checks.",
          label: "Accounting foundation",
          status: "Planned",
        },
        {
          description:
            "Replay-safe consumers for sales, payments, inventory, bond releases, and procurement events.",
          label: "Event-driven posting",
          status: "Planned",
        },
        {
          description:
            "Customer invoices, supplier bills, payments, control accounts, and reconciliation.",
          label: "AR / AP / bank reconciliation",
          status: "Planned",
        },
        {
          description:
            "Trial balance, profit and loss, balance sheet, cash flow, and Guyana VAT/GRA read models.",
          label: "Financial statements",
          status: "Planned",
        },
      ]}
      summary="Financials will only show figures once the double-entry ledger, period close, and event-posting pipeline are built. Until then, RetailOS keeps financial dashboards honest rather than decorative."
      title="Financials & Accounting"
    />
  );
}
