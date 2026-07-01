import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
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

const TAX_PRESETS = [
  { label: "VAT / sales tax", name: "Sales tax", code: "VAT", rate: "14" },
  { label: "GST", name: "GST", code: "GST", rate: "14" },
  { label: "No tax / exempt", name: "No tax", code: "NONE", rate: "0" },
] as const;

const TAX_CODES = ["VAT", "GST", "TAX", "NONE"] as const;
const TAX_RATES = ["0", "8", "10", "12", "14", "15"] as const;

function getSubmissionSlug(slug: string, name: string) {
  const enteredSlug = slugify(slug);
  if (enteredSlug.length >= 2) {
    return enteredSlug;
  }

  const nameSlug = slugify(name);
  return nameSlug.length >= 2 ? nameSlug : enteredSlug;
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
            const normalizedSlug = getSubmissionSlug(
              businessSlug,
              businessName
            );
            const rateBps = Math.round(Number(taxPercent || "0") * 100);
            if (normalizedSlug && normalizedSlug.length < 2) {
              toast.error(
                "Workspace slug must be at least 2 characters. Use the business name or enter a longer slug."
              );
              return;
            }
            if (!Number.isFinite(rateBps)) {
              toast.error("Enter a valid tax percentage.");
              return;
            }
            try {
              await complete.mutateAsync({
                businessName,
                businessSlug: normalizedSlug || undefined,
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
                  minLength={2}
                  onBlur={() => {
                    const normalizedSlug = getSubmissionSlug(
                      businessSlug,
                      businessName
                    );
                    if (normalizedSlug !== businessSlug) {
                      setBusinessSlug(normalizedSlug);
                    }
                  }}
                  onChange={(event) =>
                    setBusinessSlug(slugify(event.target.value))
                  }
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="acme-retail"
                  value={businessSlug}
                />
                <p className="text-muted-foreground text-xs">
                  Used for tenant identity and future storefront/subdomain
                  setup. If this is left blank or too short, RetailOS will use
                  the business name.
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
                  <Label htmlFor="taxProfile">Tax profile</Label>
                  <Select
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }
                      const preset = TAX_PRESETS.find(
                        (option) => option.label === value
                      );
                      if (!preset) {
                        return;
                      }
                      setTaxName(preset.name);
                      setTaxCode(preset.code);
                      setTaxPercent(preset.rate);
                    }}
                    value={
                      TAX_PRESETS.find(
                        (option) =>
                          option.name === taxName &&
                          option.code === taxCode &&
                          option.rate === taxPercent
                      )?.label ?? "Custom"
                    }
                  >
                    <SelectTrigger
                      className="h-11 w-full text-sm"
                      id="taxProfile"
                    >
                      <SelectValue placeholder="Choose tax profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {TAX_PRESETS.map((preset) => (
                          <SelectItem key={preset.label} value={preset.label}>
                            {preset.label} ({preset.code} {preset.rate}%)
                          </SelectItem>
                        ))}
                        <SelectItem value="Custom">Custom</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_7rem]">
                  <div className="grid gap-2">
                    <Label htmlFor="taxName">Name</Label>
                    <Input
                      id="taxName"
                      minLength={2}
                      onChange={(event) => setTaxName(event.target.value)}
                      required
                      value={taxName}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="taxCode">Code</Label>
                    <Select
                      onValueChange={(value) => {
                        if (value) {
                          setTaxCode(value);
                        }
                      }}
                      value={taxCode}
                    >
                      <SelectTrigger
                        className="h-11 w-full text-sm"
                        id="taxCode"
                      >
                        <SelectValue placeholder="Code" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {TAX_CODES.map((code) => (
                            <SelectItem key={code} value={code}>
                              {code}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="taxPercent">Rate %</Label>
                    <Select
                      onValueChange={(value) => {
                        if (value) {
                          setTaxPercent(value);
                        }
                      }}
                      value={taxPercent}
                    >
                      <SelectTrigger
                        className="h-11 w-full text-sm"
                        id="taxPercent"
                      >
                        <SelectValue placeholder="Rate" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {TAX_RATES.map((rate) => (
                            <SelectItem key={rate} value={rate}>
                              {rate}%
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
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
