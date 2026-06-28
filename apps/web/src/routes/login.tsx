import { BorderBeam } from "@RetailOS/ui/components/border-beam";
import { createFileRoute } from "@tanstack/react-router";
import { Package, ShoppingCart, WifiOff } from "lucide-react";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

const FEATURES = [
  {
    icon: ShoppingCart,
    title: "Fast POS",
    desc: "Ring up sales in seconds — touch, scan, or search.",
  },
  {
    icon: Package,
    title: "Live inventory",
    desc: "Every sale moves the stock ledger in real time.",
  },
  {
    icon: WifiOff,
    title: "Offline-first",
    desc: "Keep selling when the Wi-Fi drops out.",
  },
];

function Wordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={
          onDark
            ? "flex size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20"
            : "flex size-9 items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-foreground)]"
        }
      >
        <ShoppingCart className="size-5" />
      </div>
      <span className="font-semibold text-lg tracking-tight">RetailOS</span>
    </div>
  );
}

function RouteComponent() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const isSignIn = mode === "signin";

  return (
    <div className="h-dvh lg:grid lg:grid-cols-6">
      {/* Brand preview — left (sourced from shadcn Studio login-page-02, re-themed) */}
      <div className="max-lg:hidden lg:col-span-3 xl:col-span-4">
        <div className="relative flex h-full items-center justify-center overflow-hidden bg-muted px-6">
          <div
            aria-hidden="true"
            className="ro-aurora pointer-events-none absolute size-[40rem] rounded-full bg-[var(--brand)] opacity-15 blur-3xl"
          />
          <div className="relative w-full max-w-xl rounded-3xl bg-[oklch(0.17_0.06_264)] p-10 text-white shadow-xl">
            <BorderBeam duration={8} size={120} />
            <Wordmark onDark />
            <h1 className="mt-10 text-balance font-semibold text-3xl leading-[1.1] tracking-tight">
              Run your whole store from one screen.
            </h1>
            <p className="mt-3 text-white/65">
              POS, inventory, and back office in one operating system — built
              for real shops, even when the Wi-Fi isn't.
            </p>
            <ul className="mt-9 space-y-4">
              {FEATURES.map((feature) => (
                <li className="flex items-start gap-3.5" key={feature.title}>
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                    <feature.icon className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium">{feature.title}</p>
                    <p className="text-sm text-white/55">{feature.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Form — right */}
      <div className="flex h-full flex-col items-center justify-center px-6 py-10 lg:col-span-3 xl:col-span-2">
        <div className="ro-rise w-full max-w-md">
          <Wordmark />
          <div className="mt-10">
            <h2 className="font-semibold text-2xl tracking-tight">
              {isSignIn ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1.5 text-muted-foreground">
              {isSignIn
                ? "Sign in to your RetailOS workspace."
                : "Get your store up and running in minutes."}
            </p>
          </div>

          <div className="mt-8">
            {isSignIn ? <SignInForm /> : <SignUpForm />}
          </div>

          <p className="mt-6 text-center text-muted-foreground text-sm">
            {isSignIn ? "New to RetailOS? " : "Already have an account? "}
            <button
              className="font-medium text-[var(--brand)] underline-offset-4 hover:underline"
              onClick={() => setMode(isSignIn ? "signup" : "signin")}
              type="button"
            >
              {isSignIn ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
