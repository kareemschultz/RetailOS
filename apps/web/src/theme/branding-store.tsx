import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// White-label branding store — the tenant-facing skin layer that sits ON TOP of
// the theme settings store (theme-presets = the palette system; branding = the
// tenant identity). Session/browser-scoped via localStorage for now, shaped so a
// future `tenant.branding` oRPC endpoint can hydrate/persist it with zero UI
// change (see `useBranding().source`). Everything here is presentation only.
//
// What white-labeling controls:
//   - appName / shortName  → sidebar wordmark, document <title>, login screen
//   - logoLightUrl / logoDarkUrl → sidebar + login logo (falls back to the mark)
//   - accent (hex)         → overrides --primary / --sidebar-primary / --ring so
//                            the whole app re-skins to the tenant's brand color
//   - accentForeground     → auto-derived readable text color on the accent
//   - loginTagline / supportEmail / poweredBy → marketing/support surfaces

export interface Branding {
  accent: string; // hex, e.g. "#2563eb" — overrides the preset primary
  appName: string;
  loginTagline: string;
  logoDarkUrl: string | null;
  logoLightUrl: string | null;
  poweredBy: boolean; // show "Powered by RetailOS" on login/footer
  shortName: string; // collapsed sidebar / favicon initials
  supportEmail: string;
}

// RetailOS house brand — the default white-label profile.
export const defaultBranding: Branding = {
  appName: "RetailOS",
  shortName: "RO",
  logoLightUrl: null,
  logoDarkUrl: null,
  accent: "#2563eb", // RetailOS Blue (design-language primary accent)
  loginTagline: "The operating system for modern retail.",
  supportEmail: "support@retailos.app",
  poweredBy: true,
};

// A few ready-made accent swatches for the branding picker (tenants can also
// enter any custom hex). Kept blue-forward per the design language, plus common
// brand hues so the picker feels real.
export const ACCENT_PRESETS: { hex: string; label: string }[] = [
  { label: "RetailOS Blue", hex: "#2563eb" },
  { label: "Indigo", hex: "#4f46e5" },
  { label: "Teal", hex: "#0d9488" },
  { label: "Emerald", hex: "#059669" },
  { label: "Amber", hex: "#d97706" },
  { label: "Rose", hex: "#e11d48" },
  { label: "Slate", hex: "#475569" },
  { label: "Violet", hex: "#7c3aed" },
];

const STORAGE_KEY = "retailos-branding";

type BrandingSource = "default" | "local" | "tenant";

interface BrandingContextValue {
  branding: Branding;
  resetBranding: () => void;
  source: BrandingSource;
  updateBranding: (next: Partial<Branding>) => void;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

function readStored(): Branding {
  if (typeof window === "undefined") {
    return defaultBranding;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw
      ? { ...defaultBranding, ...(JSON.parse(raw) as Partial<Branding>) }
      : defaultBranding;
  } catch {
    return defaultBranding;
  }
}

// Relative luminance → pick black/white foreground so text on the accent stays
// legible whatever brand color a tenant enters (WCAG-ish contrast heuristic).
export function readableForeground(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) {
    return "#ffffff";
  }
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.5 ? "#0a0f1a" : "#ffffff";
}

// Applies the tenant accent to the live emphasis tokens (primary / sidebar-primary
// / ring / chart-1 / brand). Called by the settings store AFTER it paints a theme
// preset, so branding always wins over the preset's own primary — a single applier
// avoids the effect-ordering race between the two stores. Hex is valid in these
// CSS vars because Tailwind v4 consumes them directly in color utilities.
export function applyAccentVars(accent: string) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  const fg = readableForeground(accent);
  for (const [key, value] of [
    ["primary", accent],
    ["primary-foreground", fg],
    ["sidebar-primary", accent],
    ["sidebar-primary-foreground", fg],
    ["ring", accent],
    ["sidebar-ring", accent],
    ["chart-1", accent],
    ["brand", accent],
  ] as const) {
    root.style.setProperty(`--${key}`, value);
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [source, setSource] = useState<BrandingSource>("default");

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    const stored = readStored();
    setBranding(stored);
    setSource(
      typeof window !== "undefined" &&
        window.localStorage.getItem(STORAGE_KEY) !== null
        ? "local"
        : "default"
    );
  }, []);

  const updateBranding = useCallback((next: Partial<Branding>) => {
    setBranding((prev) => {
      const merged = { ...prev, ...next };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore persistence errors
      }
      return merged;
    });
    setSource("local");
  }, []);

  const resetBranding = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setBranding(defaultBranding);
    setSource("default");
  }, []);

  // NOTE: accent tokens are applied by the settings store (applyAccentVars),
  // which re-paints them AFTER the theme preset so branding always wins the
  // race for --primary. Branding only owns the title + logo/name surfaces here.

  // Document title reflects the tenant name.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = branding.appName;
    }
  }, [branding.appName]);

  const value = useMemo(
    () => ({ branding, updateBranding, resetBranding, source }),
    [branding, updateBranding, resetBranding, source]
  );

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return ctx;
}
