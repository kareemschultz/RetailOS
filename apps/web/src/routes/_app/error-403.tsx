import { createFileRoute } from "@tanstack/react-router";

import { Error403View } from "@/features/misc-pages/error-views";

export const Route = createFileRoute("/_app/error-403")({
  component: Error403View,
});
