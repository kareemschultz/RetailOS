import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import { Textarea } from "@RetailOS/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Store,
  WandSparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session?.data) {
      throw redirect({ to: "/login" });
    }
  },
  component: OnboardingScreen,
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function OnboardingScreen() {
  const navigate = useNavigate({ from: "/onboarding" });
  const status = useQuery(orpc.onboarding.status.queryOptions({ input: {} }));
  const complete = useMutation(orpc.onboarding.complete.mutationOptions());
  const [businessName, setBusinessName] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [locationName, setLocationName] = useState("Main Store");
  const [taxName, setTaxName] = useState("Sales tax");
  const [taxCode, setTaxCode] = useState("VAT");
  const [taxPercent, setTaxPercent] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (status.data && !status.data.requiresOnboarding) {
      navigate({ to: "/pos" });
    }
  }, [navigate, status.data]);

  const isBusy = complete.isPending || status.isLoading;

  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="grid gap-4 rounded-3xl border bg-card p-6 shadow-sm md:grid-cols-[1.1fr_0.9fr] md:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-sm">
              <WandSparkles className="size-4" />
              RetailOS onboarding
            </div>
            <div className="space-y-2">
              <h1 className="font-semibold text-3xl tracking-tight">
                Set up your business workspace
              </h1>
              <p className="max-w-2xl text-muted-foreground">
                Create the tenant, owner role, first company, first store, and
                sales-tax profile in one place. No wizard detours — just the
                essentials required before the POS opens.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
            {["Business profile", "Primary location", "Tax setup"].map(
              (item) => (
                <div
                  className="flex items-center gap-3 rounded-2xl border bg-background p-3 text-sm"
                  key={item}
                >
                  <CheckCircle2 className="size-4 text-primary" />
                  {item}
                </div>
              )
            )}
          </div>
        </div>

        <form
          className="grid gap-6 lg:grid-cols-[1fr_22rem]"
          onSubmit={async (event) => {
            event.preventDefault();
            const rateBps = Math.round(Number(taxPercent || "0") * 100);
            if (!Number.isFinite(rateBps)) {
              toast.error("Enter a valid tax percentage.");
              return;
            }
            try {
              await complete.mutateAsync({
                businessName,
                businessSlug: businessSlug || undefined,
                locationName,
                taxName,
                taxCode,
                taxRateBps: rateBps,
              });
              toast.success("RetailOS workspace created");
              await navigate({ to: "/pos" });
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not complete onboarding."
              );
            }
          }}
        >
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                Business details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="businessName">Business name</Label>
                <Input
                  id="businessName"
                  minLength={2}
                  onChange={(event) => {
                    setBusinessName(event.target.value);
                    if (!businessSlug) {
                      setBusinessSlug(slugify(event.target.value));
                    }
                  }}
                  placeholder="Acme Retail Ltd."
                  required
                  value={businessName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="businessSlug">Workspace slug</Label>
                <Input
                  id="businessSlug"
                  onChange={(event) =>
                    setBusinessSlug(slugify(event.target.value))
                  }
                  placeholder="acme-retail"
                  value={businessSlug}
                />
                <p className="text-muted-foreground text-xs">
                  Used for tenant identity and future storefront/subdomain
                  setup.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Business notes</Label>
                <Textarea
                  id="notes"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional internal notes for setup handoff"
                  value={notes}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid content-start gap-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="size-5 text-primary" />
                  First store
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="locationName">Location name</Label>
                  <Input
                    id="locationName"
                    minLength={2}
                    onChange={(event) => setLocationName(event.target.value)}
                    required
                    value={locationName}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="taxName">Tax profile</Label>
                  <Input
                    id="taxName"
                    minLength={2}
                    onChange={(event) => setTaxName(event.target.value)}
                    required
                    value={taxName}
                  />
                </div>
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="taxCode">Code</Label>
                    <Input
                      id="taxCode"
                      onChange={(event) => setTaxCode(event.target.value)}
                      required
                      value={taxCode}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="taxPercent">Rate %</Label>
                    <Input
                      id="taxPercent"
                      inputMode="decimal"
                      onChange={(event) => setTaxPercent(event.target.value)}
                      required
                      value={taxPercent}
                    />
                  </div>
                </div>
                <Button className="h-11 w-full" disabled={isBusy} type="submit">
                  {isBusy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating workspace…
                    </>
                  ) : (
                    "Create workspace"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </main>
  );
}
