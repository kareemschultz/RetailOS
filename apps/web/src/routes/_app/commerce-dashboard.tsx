import { createFileRoute } from "@tanstack/react-router";

import ECommerceDashboard from "@/features/commerce-dashboard/commerce-dashboard";

export const Route = createFileRoute("/_app/commerce-dashboard")({
  component: CommerceDashboardScreen,
});

// Visual scaffold ported from the AdminCN eCommerce dashboard. The composition
// and its sample data live under `features/commerce-dashboard`; this route only
// supplies the RetailOS shell padding + title, matching every other `_app` page.
function CommerceDashboardScreen() {
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Commerce dashboard
        </h1>
        <p className="text-muted-foreground">
          Sales, earnings and product performance overview. Sample data shown
          until the commerce module is wired.
        </p>
      </div>
      <ECommerceDashboard />
    </div>
  );
}
