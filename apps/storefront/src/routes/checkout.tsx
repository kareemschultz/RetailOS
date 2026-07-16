import { Button } from "@RetailOS/ui/components/button";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@RetailOS/ui/components/radio-group";
import { Textarea } from "@RetailOS/ui/components/textarea";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Banknote, CreditCard, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OrderSummary } from "../components/order-summary";
import { useCart, useOrder } from "../lib/cart-store";
import { type CheckoutDetails, useCheckout, useQuote } from "../lib/commerce";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

const PAYMENT_OPTIONS = [
  { icon: Banknote, label: "Cash on delivery", value: "cash" as const },
  { icon: CreditCard, label: "Card", value: "card" as const },
  { icon: Smartphone, label: "Mobile money", value: "mobile" as const },
];

function CheckoutPage() {
  const navigate = useNavigate();
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const setOrder = useOrder((s) => s.setOrder);
  const checkout = useCheckout();

  const [form, setForm] = useState<CheckoutDetails>({
    address: "",
    city: "Georgetown",
    email: "",
    fullName: "",
    note: "",
    paymentMethod: "cash",
    phone: "",
  });

  const quoteLines = useMemo(
    () => lines.map((l) => ({ handle: l.handle, quantity: l.quantity })),
    [lines]
  );
  const quote = useQuote(quoteLines);

  if (lines.length === 0 && !checkout.isPending) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          Your cart is empty
        </h1>
        <p className="text-muted-foreground">
          Add a few things before checking out.
        </p>
        <Button render={<Link search={{}} to="/shop" />}>
          Browse products
        </Button>
      </div>
    );
  }

  function update<K extends keyof CheckoutDetails>(
    key: K,
    value: CheckoutDetails[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    checkout.mutate(
      { details: form, lines: quoteLines },
      {
        onError: () =>
          toast.error("Something went wrong placing your order. Try again."),
        onSuccess: (order) => {
          setOrder(order);
          clearCart();
          navigate({ to: "/order-confirmed" });
        },
      }
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link
        className="mb-6 inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
        to="/cart"
      >
        <ArrowLeft className="size-4" />
        Back to cart
      </Link>

      <h1 className="mb-8 font-semibold text-3xl tracking-tight">Checkout</h1>

      <form
        className="grid gap-8 lg:grid-cols-[1fr_360px]"
        id="checkout-form"
        onSubmit={submit}
      >
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-medium">Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="fullName"
                label="Full name"
                onChange={(v) => update("fullName", v)}
                required
                value={form.fullName}
              />
              <Field
                id="phone"
                label="Phone"
                onChange={(v) => update("phone", v)}
                required
                type="tel"
                value={form.phone}
              />
            </div>
            <Field
              id="email"
              label="Email"
              onChange={(v) => update("email", v)}
              required
              type="email"
              value={form.email}
            />
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-medium">Delivery address</h2>
            <Field
              id="address"
              label="Street address"
              onChange={(v) => update("address", v)}
              required
              value={form.address}
            />
            <Field
              id="city"
              label="City / Town"
              onChange={(v) => update("city", v)}
              required
              value={form.city}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Delivery note (optional)</Label>
              <Textarea
                id="note"
                onChange={(e) => update("note", e.target.value)}
                placeholder="Landmarks, gate codes, preferred time…"
                value={form.note}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-medium">Payment</h2>
            <RadioGroup
              onValueChange={(v) =>
                update("paymentMethod", v as CheckoutDetails["paymentMethod"])
              }
              value={form.paymentMethod}
            >
              {PAYMENT_OPTIONS.map((option) => (
                <Label
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                  htmlFor={option.value}
                  key={option.value}
                >
                  <RadioGroupItem id={option.value} value={option.value} />
                  <option.icon className="size-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{option.label}</span>
                </Label>
              ))}
            </RadioGroup>
            <p className="text-muted-foreground text-xs">
              This is a demo checkout — no real payment is processed.
            </p>
          </section>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <OrderSummary isLoading={quote.isLoading} quote={quote.data} />
          <Button
            className="w-full"
            disabled={checkout.isPending}
            form="checkout-form"
            size="lg"
            type="submit"
          >
            {checkout.isPending ? "Placing order…" : "Place order"}
          </Button>
          <p className="text-center text-muted-foreground text-xs">
            By placing this order you agree to Everstock&apos;s terms of sale.
          </p>
        </div>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </div>
  );
}
