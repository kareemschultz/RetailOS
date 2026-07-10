import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import {
  PageBody,
  PageHeader,
} from "@RetailOS/ui/components/page-header";
import { Switch } from "@RetailOS/ui/components/switch";
import { cn } from "@RetailOS/ui/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Palette, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { FeatureStatusBadge } from "@/data/feature-status-badge";
import {
  ACCENT_PRESETS,
  readableForeground,
  useBranding,
} from "@/theme/branding-store";

export const Route = createFileRoute("/_app/settings/branding")({
  component: BrandingSettingsScreen,
});

function BrandingSettingsScreen() {
  const { branding, updateBranding, resetBranding, source } = useBranding();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        actions={
          <Button
            onClick={() => {
              resetBranding();
              toast.success("Branding reset to RetailOS defaults");
            }}
            variant="outline"
          >
            <RotateCcw className="size-4" />
            Reset to defaults
          </Button>
        }
        description="Make RetailOS your own — set your business name, logo, and brand color. Changes apply instantly across the whole app."
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Palette className="size-5" />
            </span>
            Branding & white-label
            <FeatureStatusBadge featureKey="branding.whitelabel" />
          </span>
        }
      />

      <PageBody>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Identity</CardTitle>
                <CardDescription>
                  Your business name and the initials shown when the sidebar is
                  collapsed.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="appName">Application name</Label>
                  <Input
                    id="appName"
                    onChange={(e) => updateBranding({ appName: e.target.value })}
                    placeholder="e.g. Acme Retail"
                    value={branding.appName}
                  />
                  <p className="text-muted-foreground text-xs">
                    Shown in the sidebar wordmark, the browser tab, and the login
                    screen.
                  </p>
                </div>
                <div className="grid max-w-[200px] gap-2">
                  <Label htmlFor="shortName">Short initials</Label>
                  <Input
                    id="shortName"
                    maxLength={3}
                    onChange={(e) =>
                      updateBranding({ shortName: e.target.value.toUpperCase() })
                    }
                    placeholder="RO"
                    value={branding.shortName}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Logo</CardTitle>
                <CardDescription>
                  Paste a URL to your logo. Provide a light and a dark version
                  for best results across themes.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="logoLight">Logo URL (light mode)</Label>
                  <Input
                    id="logoLight"
                    onChange={(e) =>
                      updateBranding({ logoLightUrl: e.target.value || null })
                    }
                    placeholder="https://…/logo.svg"
                    value={branding.logoLightUrl ?? ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="logoDark">Logo URL (dark mode)</Label>
                  <Input
                    id="logoDark"
                    onChange={(e) =>
                      updateBranding({ logoDarkUrl: e.target.value || null })
                    }
                    placeholder="https://…/logo-dark.svg"
                    value={branding.logoDarkUrl ?? ""}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Brand color</CardTitle>
                <CardDescription>
                  Your accent color re-skins navigation, buttons, links, and
                  focus rings across the entire app.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex flex-wrap gap-2">
                  {ACCENT_PRESETS.map((preset) => {
                    const selected =
                      preset.hex.toLowerCase() ===
                      branding.accent.toLowerCase();
                    return (
                      <button
                        aria-label={preset.label}
                        aria-pressed={selected}
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl ring-2 ring-offset-2 ring-offset-background transition",
                          selected ? "ring-foreground" : "ring-transparent"
                        )}
                        key={preset.hex}
                        onClick={() => updateBranding({ accent: preset.hex })}
                        style={{ backgroundColor: preset.hex }}
                        title={preset.label}
                        type="button"
                      >
                        {selected ? (
                          <Check
                            className="size-4"
                            style={{ color: readableForeground(preset.hex) }}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    aria-label="Custom brand color"
                    className="size-10 cursor-pointer rounded-lg border bg-transparent"
                    onChange={(e) => updateBranding({ accent: e.target.value })}
                    type="color"
                    value={branding.accent}
                  />
                  <Input
                    className="w-36 font-mono"
                    onChange={(e) => updateBranding({ accent: e.target.value })}
                    value={branding.accent}
                  />
                  <span className="text-muted-foreground text-sm">
                    Custom hex
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Login & footer</CardTitle>
                <CardDescription>
                  Marketing copy and support contact shown on the sign-in screen.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tagline">Login tagline</Label>
                  <Input
                    id="tagline"
                    onChange={(e) =>
                      updateBranding({ loginTagline: e.target.value })
                    }
                    value={branding.loginTagline}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="support">Support email</Label>
                  <Input
                    id="support"
                    onChange={(e) =>
                      updateBranding({ supportEmail: e.target.value })
                    }
                    type="email"
                    value={branding.supportEmail}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <p className="font-medium text-sm">
                      Show &ldquo;Powered by RetailOS&rdquo;
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Display attribution on the login screen and footer.
                    </p>
                  </div>
                  <Switch
                    checked={branding.poweredBy}
                    onCheckedChange={(checked) =>
                      updateBranding({ poweredBy: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card className="overflow-hidden shadow-sm">
              <CardHeader>
                <CardTitle>Live preview</CardTitle>
                <CardDescription>
                  {source === "local"
                    ? "Custom branding active in this browser."
                    : "Showing RetailOS defaults."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-xl border p-3">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg font-semibold text-sm"
                    style={{
                      backgroundColor: branding.accent,
                      color: readableForeground(branding.accent),
                    }}
                  >
                    {branding.logoLightUrl ? (
                      <img
                        alt=""
                        className="size-full object-contain"
                        src={branding.logoLightUrl}
                      />
                    ) : (
                      branding.shortName || "RO"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{branding.appName}</p>
                    <p className="truncate text-muted-foreground text-xs">
                      {branding.loginTagline}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className="inline-flex items-center rounded-lg px-3 py-1.5 font-medium text-sm"
                    style={{
                      backgroundColor: branding.accent,
                      color: readableForeground(branding.accent),
                    }}
                  >
                    Primary button
                  </span>
                  <span
                    className="inline-flex items-center rounded-lg px-3 py-1.5 font-medium text-sm ring-1"
                    style={{
                      color: branding.accent,
                      borderColor: branding.accent,
                    }}
                  >
                    Link / accent
                  </span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Every accent-colored surface across the app — active nav,
                  buttons, selected tabs, focus rings — updates from this one
                  color.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </div>
  );
}
