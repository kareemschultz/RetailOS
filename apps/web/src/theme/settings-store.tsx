import { useTheme } from "next-themes";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { FONT_CONFIG, type FontKey } from "./fonts";
import { type ThemePresetKey, themePresets } from "./theme-presets";

export type { FontKey } from "./fonts";
export type { ThemePresetKey } from "./theme-presets";

// Theme settings store — dropped in from the AdminCN settingsContext (Assembly
// Law: the apply logic is theirs), edited for our stack: localStorage instead of
// the next cookie/BroadcastChannel, next-themes for color mode, and our
// FONT_CONFIG (family strings) instead of next/font variables. Session/browser-
// scoped (no per-tenant backend persistence yet — locked decision).

export type Mode = "light" | "dark" | "system";
export type Collapsible = "offcanvas" | "icon" | "none";
export type Variant = "default" | "inset" | "floating";
export type Radius = "none" | "sm" | "md" | "lg";
export type Layout = "compact" | "full";
export type Scale = "sm" | "md" | "lg";

export const RADIUS_VALUES: Record<Radius, string> = {
  none: "0rem",
  sm: "0.45rem",
  md: "0.625rem",
  lg: "0.875rem",
};

export interface Settings {
  collapsible: Collapsible;
  font: FontKey;
  layout: Layout;
  mode: Mode;
  radius: Radius;
  scale: Scale;
  themePreset: ThemePresetKey;
  variant: Variant;
}

// RetailOS defaults: the Corporate preset + Inter + LG radius (our --radius).
export const initialSettings: Settings = {
  mode: "system",
  themePreset: "corporate",
  font: "inter",
  radius: "lg",
  scale: "md",
  layout: "full",
  variant: "default",
  collapsible: "icon",
};

const PRESET_CSS_VARS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

const STORAGE_KEY = "retailos-theme-settings";

interface SettingsContextValue {
  resetSettings: () => void;
  settings: Settings;
  updateSettings: (next: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readStored(): Settings {
  if (typeof window === "undefined") {
    return initialSettings;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw
      ? { ...initialSettings, ...(JSON.parse(raw) as Partial<Settings>) }
      : initialSettings;
  } catch {
    return initialSettings;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { setTheme, resolvedTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(initialSettings);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setSettings(readStored());
  }, []);

  const updateSettings = useCallback((next: Partial<Settings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore persistence errors
      }
      return merged;
    });
  }, []);

  const resetSettings = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setSettings(initialSettings);
  }, []);

  // Color mode → next-themes.
  useEffect(() => {
    setTheme(settings.mode);
  }, [settings.mode, setTheme]);

  // Theme preset → set/clear the OKLCH CSS variables on :root.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.themePreset === "default") {
      for (const key of PRESET_CSS_VARS) {
        root.style.removeProperty(`--${key}`);
      }
      return;
    }
    const preset = themePresets[settings.themePreset];
    if (!preset) {
      return;
    }
    const mode = resolvedTheme === "dark" ? "dark" : "light";
    for (const [key, value] of Object.entries(preset.styles[mode])) {
      if (value !== undefined) {
        root.style.setProperty(`--${key}`, value as string);
      }
    }
  }, [settings.themePreset, resolvedTheme]);

  // Radius.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--radius",
      RADIUS_VALUES[settings.radius]
    );
  }, [settings.radius]);

  // Scale (data attribute consumed by globals.css).
  useEffect(() => {
    const root = document.documentElement;
    if (settings.scale === "md") {
      root.removeAttribute("data-theme-scale");
    } else {
      root.setAttribute("data-theme-scale", settings.scale);
    }
  }, [settings.scale]);

  // Font family.
  useEffect(() => {
    const root = document.documentElement;
    const family =
      FONT_CONFIG[settings.font]?.family ?? FONT_CONFIG.inter.family;
    root.style.setProperty("font-family", family);
    root.style.setProperty("--font-sans", family);
  }, [settings.font]);

  const value = useMemo(
    () => ({ settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
