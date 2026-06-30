import { createFileRoute } from "@tanstack/react-router";

import { Error404View } from "@/features/misc-pages/error-views";

export const Route = createFileRoute("/_app/error-404")({
  component: Error404View,
});
