import { Button } from "@RetailOS/ui/components/button";
import { Separator } from "@RetailOS/ui/components/separator";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Mail, Package } from "lucide-react";
import { useEffect } from "react";
import { useOrder } from "../lib/cart-store";
import { formatMoney } from "../lib/format";

export const Route = createFileRoute("/order-confirmed")({
  component: OrderConfirmedPage,
});

function OrderConfirmedPage() {
  const order = useOrder((s) => s.order);
  const clearOrder = useOrder((s) => s.clearOrder);

  // Clear the one-shot order from session state when leaving this page.
  useEffect(() => () => clearOrder(), [clearOrder]);

  if (!order) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          No recent order
        </h1>
        <p className="text-muted-foreground">
          Your order confirmation isn&apos;t available here anymore.
        </p>
        <Button render={<Link search={{}} to="/shop" />}>
          Continue shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-8" />
        </span>
        <h1 className="font-semibold text-3xl tracking-tight">
          Thank you for your order
        </h1>
        <p className="max-w-sm text-muted-foreground leading-relaxed">
          We&apos;ve received your order and will send a confirmation shortly.
          Here are your details.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Order number</dt>
            <dd className="font-mono font-medium tabular-nums">
              {order.orderNumber}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Sale reference</dt>
            <dd className="font-mono font-medium tabular-nums">
              {order.saleNumber}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600 text-xs capitalize dark:text-emerald-400">
                {order.status}
              </span>
            </dd>
          </div>

          <Separator className="my-1" />

          <div className="flex items-center justify-between">
            <dt className="font-semibold">Total paid</dt>
            <dd className="font-mono font-semibold text-base tabular-nums">
              {formatMoney(order.totalMinor, order.currency, order.scale)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-muted/50 p-5 text-sm">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            A receipt is on its way to your email.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            We&apos;ll notify you when your order is out for delivery.
          </p>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <Button render={<Link search={{}} to="/shop" />} size="lg">
          Continue shopping
        </Button>
      </div>
    </div>
  );
}
