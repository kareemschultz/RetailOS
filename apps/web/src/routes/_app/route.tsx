import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { authClient } from "@/lib/auth-client";

// Authenticated application layout. Mirrors the existing `_auth` guard
// (client-only; redirect to /login when there is no session) and wraps every
// child route in the RetailOS app shell. The active tenant is resolved
// server-side from the session's activeOrganizationId on every oRPC call.
export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
