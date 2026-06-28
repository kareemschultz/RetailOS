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
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel — fills the left half, hidden on mobile. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[oklch(0.17_0.06_264)] p-10 text-white lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="ro-aurora absolute -top-32 -left-24 size-[34rem] rounded-full bg-[var(--brand)] opacity-30 blur-3xl" />
          <div
            className="ro-aurora absolute -right-16 -bottom-28 size-[30rem] rounded-full bg-[oklch(0.623_0.214_259.815)] opacity-20 blur-3xl"
            style={{ animationDelay: "-9s" }}
          />
        </div>

        <div className="relative">
          <Wordmark onDark />
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-balance font-semibold text-4xl leading-[1.05] tracking-tight xl:text-5xl">
            Run your whole store from one screen.
          </h1>
          <p className="mt-5 text-pretty text-lg text-white/65">
            POS, inventory, and back office in one operating system — built for
            real shops, even when the Wi-Fi isn't.
          </p>

          <div className="relative mt-10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
            <BorderBeam duration={9} size={140} />
            <ul className="space-y-5">
              {FEATURES.map((feature, index) => (
                <li
                  className="ro-rise flex items-start gap-4"
                  key={feature.title}
                  style={{ animationDelay: `${index * 80 + 120}ms` }}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/20 ring-1 ring-[var(--brand)]/30">
                    <feature.icon className="size-5 text-[oklch(0.8_0.12_255)]" />
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

        <p className="relative text-sm text-white/40">
          The retail operating system.
        </p>
      </aside>

      {/* Form panel — fills the right half, content centered. */}
      <main className="flex items-center justify-center bg-background px-6 py-12 sm:px-10">
        <div className="ro-rise w-full max-w-[26rem]">
          <div className="mb-9 flex justify-center lg:hidden">
            <Wordmark />
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="font-semibold text-2xl tracking-tight">
              {isSignIn ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1.5 text-muted-foreground text-sm">
              {isSignIn
                ? "Sign in to your RetailOS workspace."
                : "Get your store up and running in minutes."}
            </p>

            <div className="mt-7">
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
      </main>
    </div>
  );
}
