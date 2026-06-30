import { createFileRoute } from "@tanstack/react-router";

import DataTables from "@/features/data-tables/data-tables";

export const Route = createFileRoute("/_app/data-tables")({
  component: DataTables,
});
