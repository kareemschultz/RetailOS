import { createFileRoute } from "@tanstack/react-router";

import { PermissionsApp } from "@/features/permissions/permissions-page";

export const Route = createFileRoute("/_app/permissions")({
  component: PermissionsScreen,
});

function PermissionsScreen() {
  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <PermissionsApp />
    </div>
  );
}
