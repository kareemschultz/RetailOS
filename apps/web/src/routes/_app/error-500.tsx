import { createFileRoute } from "@tanstack/react-router";

import { Error500View } from "@/features/misc-pages/error-views";

export const Route = createFileRoute("/_app/error-500")({
  component: Error500View,
});
