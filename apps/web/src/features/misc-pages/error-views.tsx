import { MiscPage } from "@/features/misc-pages/misc-page";

export function Error404View() {
  return (
    <MiscPage
      action={{ label: "Back to dashboard", to: "/dashboard" }}
      description="The page you're looking for isn't here. It may have been moved or removed — let's get you back to RetailOS."
      heading="Page not found"
      morphingTexts={["404", "RetailOS", "Page Drifted"]}
      title="404 — Whoops!"
    />
  );
}

export function Error401View() {
  return (
    <MiscPage
      action={{ label: "Sign in", to: "/login" }}
      description="This page is only available to signed-in RetailOS users. Please sign in to access your store, inventory, and reports."
      heading="Sign in required"
      morphingTexts={["401", "RetailOS", "Verify First"]}
      title="401 — Hold up!"
    />
  );
}

export function Error403View() {
  return (
    <MiscPage
      action={{ label: "Back to dashboard", to: "/dashboard" }}
      description="You don't have permission to view this page. Contact your tenant administrator if you believe this is an error."
      heading="Access denied"
      morphingTexts={["403", "RetailOS", "Restricted"]}
      title="403 — Restricted area"
    />
  );
}

export function Error500View() {
  return (
    <MiscPage
      action={{ label: "Back to dashboard", to: "/dashboard" }}
      description="RetailOS hit an unexpected error. Please try again shortly — if it keeps happening, contact support with your request ID."
      heading="Something went wrong"
      morphingTexts={["500", "RetailOS", "Try Again"]}
      title="500 — Server error"
    />
  );
}

export function MaintenanceView() {
  return (
    <MiscPage
      action={{ label: "Back to dashboard", to: "/dashboard" }}
      description="RetailOS is performing scheduled updates right now. Offline POS keeps working — back-office will be available again shortly."
      heading="Temporarily unavailable"
      morphingTexts={["Back Soon", "RetailOS", "Brief Pause"]}
      title="Under maintenance"
    />
  );
}
