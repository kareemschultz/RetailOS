import { createFileRoute } from "@tanstack/react-router";

import OrdersDashboard from "@/features/orders/orders-dashboard";

export const Route = createFileRoute("/_app/orders")({
  component: OrdersScreen,
});

// Visual scaffold ported from the AdminCN Orders dashboard. The composition
// and its sample data live under `features/orders`; this route only supplies
// the RetailOS shell padding + title, matching every other `_app` page.
function OrdersScreen() {
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Orders</h1>
        <p className="text-muted-foreground">
          Fulfilment, shipping and returns at a glance. Sample data shown until
          the orders module is wired.
        </p>
      </div>
      <OrdersDashboard />
    </div>
  );
}
