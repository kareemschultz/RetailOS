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
    <div className="h-dvh lg:grid lg:grid-cols-6">
      {/* Product preview — sourced from shadcn Studio login-page-02, re-themed
          to RetailOS tokens; the preview is a real RetailOS POS, light + dark. */}
      <div className="max-lg:hidden lg:col-span-3 xl:col-span-4">
        <div className="relative z-1 flex h-full items-center justify-center overflow-hidden bg-muted px-6">
          <div className="ro-rise relative shrink rounded-[20px] p-2.5 shadow-xl outline-2 outline-border -outline-offset-[2px]">
            <img
              alt="RetailOS point of sale ringing up a live sale"
              className="max-h-[28rem] w-full rounded-lg object-contain dark:hidden"
              height={900}
              src="/pos-preview-light.png"
              width={1440}
            />
            <img
              alt="RetailOS point of sale ringing up a live sale"
              className="hidden max-h-[28rem] w-full rounded-lg object-contain dark:inline-block"
              height={900}
              src="/pos-preview-dark.png"
              width={1440}
            />
            <BorderBeam borderWidth={2} duration={8} size={120} />
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -z-1 opacity-70"
          >
            <AuthBackgroundShape />
          </div>
        </div>
      </div>

      {/* Auth form — right column. */}
      <div className="flex h-full flex-col items-center justify-center py-10 sm:px-5 lg:col-span-3 xl:col-span-2">
        <div className="ro-rise w-full max-w-md px-6">
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

            <p className="text-center text-muted-foreground">
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
