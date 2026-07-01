import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { ModuleStatusPage } from "@/components/module-status-page";

export const Route = createFileRoute("/_app/procurement")({
  component: ProcurementLanding,
});

function ProcurementLanding() {
  return (
    <ModuleStatusPage
      actions={[
        {
          description:
            "Current reorder signals are inventory-backed; PO conversion is a planned procurement slice.",
          label: "Stock dashboard",
          to: "/inventory",
        },
        {
          description:
            "Bonded receiving already proves the valued-receipt primitive for future GRNs.",
          label: "Bonded goods",
          to: "/bonds",
        },
      ]}
      eyebrow="Procurement"
      icon={ClipboardList}
      steps={[
        {
          description:
            "Supplier records, contacts, RLS, composite FKs, and supplier performance seams.",
          label: "Suppliers",
          status: "Planned",
        },
        {
          description:
            "Purchase orders, PO lines, approval thresholds, and reorder suggestion conversion.",
          label: "Purchase orders",
          status: "Planned",
        },
        {
          description:
            "Goods received notes, partial receiving, over-receipt handling, and ledger valuation.",
          label: "Receiving / GRNs",
          status: "Planned",
        },
        {
          description:
            "Supplier bills, bill matching, landed-cost pools, and AP event contracts.",
          label: "Bills & landed costs",
          status: "Planned",
        },
      ]}
      summary="Procurement will cover suppliers, purchase orders, receiving, supplier bills, landed costs, and three-way matching. The current app exposes the inventory and bond workflows that procurement will build on."
      title="Procurement & Purchase Orders"
    />
  );
}
