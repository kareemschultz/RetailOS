import { createFileRoute, redirect } from "@tanstack/react-router";

// The root path sends users into the app. `/pos` is guarded by the `_app` layout
// (redirects to /login when there is no session), so an unauthenticated visit
// flows `/` → `/pos` → `/login`, and an authenticated one lands on the POS shell.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/pos" });
  },
});
