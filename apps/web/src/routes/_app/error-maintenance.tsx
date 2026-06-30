import { createFileRoute } from "@tanstack/react-router";

import { MaintenanceView } from "@/features/misc-pages/error-views";

export const Route = createFileRoute("/_app/error-maintenance")({
  component: MaintenanceView,
});
