import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { authClient } from "@/lib/auth-client";

const SESSION_LOOKUP_TIMEOUT_MS = 1000;

async function getSessionFailClosed() {
  try {
    return await Promise.race([
      authClient.getSession(),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), SESSION_LOOKUP_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  }
}

// Authenticated application layout. Mirrors the existing `_auth` guard
// (client-only; redirect to /login when there is no session) and wraps every
// child route in the RetailOS app shell. The active tenant is resolved
// server-side from the session's activeOrganizationId on every oRPC call.
//
// Fail closed: if the auth API is unavailable or slow, do not leave users on a
// blank protected route. Send them to login so the failure is explicit and safe.
export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const session = await getSessionFailClosed();
    if (!session?.data) {
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
