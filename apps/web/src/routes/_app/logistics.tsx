import { createFileRoute } from "@tanstack/react-router";

import LogisticsDashboard from "@/features/logistics/logistics-dashboard";

export const Route = createFileRoute("/_app/logistics")({
  component: LogisticsScreen,
});

function LogisticsScreen() {
  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <LogisticsDashboard />
    </div>
  );
}
