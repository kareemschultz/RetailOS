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
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Store,
  Upload,
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

// Post-completion hand-off: the natural next step for a real store is loading
// their catalog (QuickBooks/Excel import), so that's the primary action.
function OnboardingSuccess({ businessName }: { businessName: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-lg shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-7" />
          </div>
          <div className="space-y-1">
            <h1 className="font-semibold text-2xl tracking-tight">
              {businessName || "Your workspace"} is ready
            </h1>
            <p className="text-muted-foreground">
              Tenant, first store, and tax profile are set. Next: bring in your
              products — import your QuickBooks or Excel item list in minutes.
            </p>
          </div>
          <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button render={<Link to="/products/import" />}>
              <Upload className="size-4" />
              Import products
            </Button>
            <Button render={<Link to="/pos" />} variant="outline">
              Open the POS
            </Button>
            <Button render={<Link to="/dashboard" />} variant="outline">
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
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
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // Freshly-completed onboarding shows the success hand-off instead of
    // bouncing straight to the POS.
    if (completed) {
      return;
    }
    if (status.data && !status.data.requiresOnboarding) {
      navigate({ to: "/pos" });
    }
  }, [completed, navigate, status.data]);

  const isBusy = complete.isPending || status.isLoading;

  if (completed) {
    return <OnboardingSuccess businessName={businessName} />;
  }

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
              setCompleted(true);
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
