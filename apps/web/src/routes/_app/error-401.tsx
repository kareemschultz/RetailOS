import { createFileRoute } from "@tanstack/react-router";

import { Error401View } from "@/features/misc-pages/error-views";

export const Route = createFileRoute("/_app/error-401")({
  component: Error401View,
});
