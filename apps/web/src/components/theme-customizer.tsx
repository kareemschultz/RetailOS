import { Button } from "@RetailOS/ui/components/button";
import { Label } from "@RetailOS/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@RetailOS/ui/components/popover";
import {
  RadioGroup,
  RadioGroupItem,
} from "@RetailOS/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@RetailOS/ui/components/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
import { BanIcon, PaletteIcon, RefreshCcwIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { FONT_CONFIG, FONT_GROUPS, type FontKey } from "@/theme/fonts";
import {
  type Collapsible,
  type Layout,
  type Mode,
  type Radius,
  type Scale,
  useSettings,
  type Variant,
} from "@/theme/settings-store";
import { type ThemePresetKey, themePresets } from "@/theme/theme-presets";

// Theme customizer panel — dropped in from the AdminCN ThemeCustomizer (Assembly
// Law: the panel, controls, and apply wiring are theirs), edited for our stack:
// our settings store + fonts, no next/link, sidebar-mode sets `collapsible`.

const MODES: { value: Mode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];
const LAYOUTS: { value: Layout; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "full", label: "Full" },
];
const SCALE_MODES: { value: Scale; label: string }[] = [
  { value: "sm", label: "SM" },
  { value: "md", label: "MD" },
  { value: "lg", label: "LG" },
];
const SIDEBAR_MODES: { value: Collapsible; label: string }[] = [
  { value: "none", label: "Default" },
  { value: "icon", label: "Icon" },
  { value: "offcanvas", label: "Full" },
];
const VARIANTS: { value: Variant; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "inset", label: "Inset" },
  { value: "floating", label: "Floating" },
];
const RADII: { value: Radius; tooltip: string }[] = [
  { value: "none", tooltip: "0rem" },
  { value: "sm", tooltip: "0.45rem" },
  { value: "md", tooltip: "0.625rem" },
  { value: "lg", tooltip: "0.875rem" },
];
const DEFAULT_PRIMARY: Record<"light" | "dark", string> = {
  light: "oklch(0.48 0.2 260.48)",
  dark: "oklch(0.56 0.24 260.95)",
};

const SWATCH_TILE =
  "has-data-checked:bg-accent relative flex flex-col items-center gap-2 border px-2 py-2 text-center shadow-xs outline-none transition-[color,box-shadow] not-last:border-r-0 first:rounded-l-md last:rounded-r-md";

export function ThemeCustomizer() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";

  const activePreset =
    settings.themePreset === "default"
      ? null
      : themePresets[settings.themePreset as keyof typeof themePresets];
  const activePrimaryColor =
    activePreset?.styles[mode].primary ?? DEFAULT_PRIMARY[mode];
  const activeLabel = activePreset?.label ?? "Default";

  return (
    <Popover>
      <PopoverTrigger render={<Button size="icon" variant="ghost" />}>
        <PaletteIcon />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[calc(100vh-8rem)] flex-col gap-5 overflow-y-auto px-0 py-3"
        sideOffset={8}
      >
        <div className="flex flex-col gap-1 px-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-lg">Theme Customizer</h3>
            <Button onClick={resetSettings} size="icon-sm" variant="ghost">
              <RefreshCcwIcon />
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Customize your theme to your liking.
          </p>
        </div>

        <div className="flex flex-col gap-1 px-3">
          <Label htmlFor="theme-preset">Theme Preset</Label>
          <Select
            id="theme-preset"
            onValueChange={(value) =>
              updateSettings({ themePreset: value as ThemePresetKey })
            }
            value={settings.themePreset}
          >
            <SelectTrigger className="w-full">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: activePrimaryColor }}
              />
              <span className="flex-1 text-left">{activeLabel}</span>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="p-1">
              <SelectItem className="[&>div]:items-center" value="default">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: DEFAULT_PRIMARY[mode] }}
                />
                Default
              </SelectItem>
              {Object.entries(themePresets).map(([key, preset]) => (
                <SelectItem
                  className="[&>div]:items-center"
                  key={key}
                  value={key}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: preset.styles[mode].primary }}
                  />
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 px-3">
          <Label htmlFor="font">Font</Label>
          <Select
            id="font"
            onValueChange={(value) =>
              updateSettings({ font: value as FontKey })
            }
            value={settings.font}
          >
            <SelectTrigger className="w-full">
              <span className="flex-1 text-left">
                {FONT_CONFIG[settings.font]?.label ?? "Inter"}
              </span>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="p-1">
              {FONT_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.fonts.map((fontKey) => (
                    <SelectItem
                      className="[&>div]:items-center"
                      key={fontKey}
                      value={fontKey}
                    >
                      <span style={{ fontFamily: FONT_CONFIG[fontKey].family }}>
                        {FONT_CONFIG[fontKey].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 px-3">
          <Label htmlFor="color-mode">Color Mode</Label>
          <RadioGroup
            className="grid grid-cols-3 gap-0 rounded-md"
            id="color-mode"
            onValueChange={(v) => updateSettings({ mode: v as Mode })}
            value={settings.mode}
          >
            {MODES.map(({ value, label }) => (
              <Label
                className={SWATCH_TILE}
                htmlFor={`mode-${value}`}
                key={value}
              >
                <RadioGroupItem
                  aria-label={`mode-${value}`}
                  className="sr-only absolute inset-0"
                  id={`mode-${value}`}
                  value={value}
                />
                <p className="font-medium text-foreground text-sm leading-none">
                  {label}
                </p>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-1 px-3">
          <Label htmlFor="radius">Radius</Label>
          <RadioGroup
            className="grid grid-cols-4 gap-0 rounded-md"
            id="radius"
            onValueChange={(v) => updateSettings({ radius: v as Radius })}
            value={settings.radius}
          >
            {RADII.map(({ value, tooltip }) => (
              <Tooltip key={value}>
                <TooltipTrigger
                  render={
                    <Label
                      className={SWATCH_TILE}
                      htmlFor={`radius-${value}`}
                    />
                  }
                >
                  <RadioGroupItem
                    aria-label={`radius-${value}`}
                    className="sr-only absolute inset-0"
                    id={`radius-${value}`}
                    value={value}
                  />
                  {value === "none" ? (
                    <BanIcon className="size-3.5" />
                  ) : (
                    <p className="font-medium text-foreground text-sm leading-none">
                      {value.toUpperCase()}
                    </p>
                  )}
                </TooltipTrigger>
                <TooltipContent>{tooltip}</TooltipContent>
              </Tooltip>
            ))}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-1 px-3">
          <Label htmlFor="layout">Content Layout</Label>
          <RadioGroup
            className="grid grid-cols-2 gap-0 rounded-md"
            id="layout"
            onValueChange={(v) => updateSettings({ layout: v as Layout })}
            value={settings.layout}
          >
            {LAYOUTS.map(({ value, label }) => (
              <Label
                className={SWATCH_TILE}
                htmlFor={`layout-${value}`}
                key={value}
              >
                <RadioGroupItem
                  aria-label={`layout-${value}`}
                  className="sr-only absolute inset-0"
                  id={`layout-${value}`}
                  value={value}
                />
                <p className="font-medium text-foreground text-sm leading-none">
                  {label}
                </p>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-1 px-3">
          <Label htmlFor="scale">Scale</Label>
          <RadioGroup
            className="grid grid-cols-3 gap-0 rounded-md"
            id="scale"
            onValueChange={(v) => updateSettings({ scale: v as Scale })}
            value={settings.scale}
          >
            {SCALE_MODES.map((item) => (
              <Label
                className={SWATCH_TILE}
                htmlFor={`scale-${item.value}`}
                key={item.value}
              >
                <RadioGroupItem
                  aria-label={`scale-${item.value}`}
                  className="sr-only absolute inset-0"
                  id={`scale-${item.value}`}
                  value={item.value}
                />
                <p className="font-medium text-foreground text-sm leading-none">
                  {item.label}
                </p>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-1 px-3 max-xl:hidden">
          <Label htmlFor="variant">Sidebar Variant</Label>
          <RadioGroup
            className="grid grid-cols-3 gap-0 rounded-md"
            id="variant"
            onValueChange={(v) => updateSettings({ variant: v as Variant })}
            value={settings.variant}
          >
            {VARIANTS.map(({ value, label }) => (
              <Label
                className={SWATCH_TILE}
                htmlFor={`sidebar-variant-${value}`}
                key={value}
              >
                <RadioGroupItem
                  aria-label={`variant-${value}`}
                  className="sr-only absolute inset-0"
                  id={`sidebar-variant-${value}`}
                  value={value}
                />
                <p className="font-medium text-foreground text-sm leading-none">
                  {label}
                </p>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-1 px-3 max-xl:hidden">
          <Label htmlFor="sidebar-mode">Sidebar Mode</Label>
          <RadioGroup
            className="grid grid-cols-3 gap-0 rounded-md"
            id="sidebar-mode"
            onValueChange={(v) =>
              updateSettings({ collapsible: v as Collapsible })
            }
            value={settings.collapsible}
          >
            {SIDEBAR_MODES.map((m) => (
              <Label
                className={SWATCH_TILE}
                htmlFor={`sidebar-mode-${m.value}`}
                key={m.value}
              >
                <RadioGroupItem
                  aria-label={`sidebar-mode-${m.value}`}
                  className="sr-only absolute inset-0"
                  id={`sidebar-mode-${m.value}`}
                  value={m.value}
                />
                <p className="font-medium text-foreground text-sm leading-none">
                  {m.label}
                </p>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}
