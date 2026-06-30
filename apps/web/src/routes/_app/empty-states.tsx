import { createFileRoute } from "@tanstack/react-router";

import EmptyStates from "@/features/empty-states/empty-states";

export const Route = createFileRoute("/_app/empty-states")({
  component: EmptyStatesScreen,
});

function EmptyStatesScreen() {
  return <EmptyStates />;
}
