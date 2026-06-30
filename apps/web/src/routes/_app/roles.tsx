import { createFileRoute } from "@tanstack/react-router";

import { RolesApp } from "@/features/roles/roles-page";

export const Route = createFileRoute("/_app/roles")({
  component: RolesScreen,
});

function RolesScreen() {
  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <RolesApp />
    </div>
  );
}
