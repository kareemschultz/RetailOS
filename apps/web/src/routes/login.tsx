import { BorderBeam } from "@RetailOS/ui/components/border-beam";
import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";

import AuthBackgroundShape from "@/components/auth-background-shape";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-foreground)]">
        <ShoppingCart className="size-5" />
      </div>
      <span className="font-semibold text-xl tracking-tight">RetailOS</span>
    </div>
  );
}

function RouteComponent() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const isSignIn = mode === "signin";

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Product preview — fills the left half on lg+. shadcn Studio
          login-page-02 structure (framed preview + BorderBeam + background
          shape), re-themed to RetailOS. The light POS shot is used in both
          themes so the bright screen pops against the panel. */}
      <div className="relative hidden overflow-hidden bg-muted px-8 lg:flex lg:items-center lg:justify-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_55%_at_50%_38%,color-mix(in_oklch,var(--brand)_20%,transparent),transparent_72%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute opacity-60 mix-blend-luminosity"
        >
          <AuthBackgroundShape />
        </div>

        <div className="ro-rise relative z-10 w-full max-w-2xl rounded-2xl bg-card p-2 shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
          <img
            alt="RetailOS point of sale ringing up a live sale"
            className="w-full rounded-xl object-contain"
            height={900}
            src="/pos-preview-light.png"
            width={1440}
          />
          <BorderBeam borderWidth={2} duration={9} size={140} />
        </div>
      </div>

      {/* Auth form — fills the right half on lg+, the only column on mobile. */}
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
        <div className="ro-rise w-full max-w-sm">
          <div className="flex flex-col gap-6">
            <Wordmark />

            <div>
              <h2 className="mb-1.5 font-semibold text-2xl tracking-tight">
                {isSignIn ? "Sign in to RetailOS" : "Create your account"}
              </h2>
              <p className="text-muted-foreground">
                {isSignIn
                  ? "Run your whole store from one screen — even offline."
                  : "Get your store up and running in minutes."}
              </p>
            </div>

            {isSignIn ? <SignInForm /> : <SignUpForm />}

            <p className="text-center text-muted-foreground text-sm">
              {isSignIn ? "New to RetailOS? " : "Already have an account? "}
              <button
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={() => setMode(isSignIn ? "signup" : "signin")}
                type="button"
              >
                {isSignIn ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
