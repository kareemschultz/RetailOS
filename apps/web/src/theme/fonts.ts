// Font options for the theme customizer. RetailOS ships Inter (UI) + IBM Plex
// Mono via @fontsource (see index.css). The customizer applies the chosen
// family to --font-sans + font-family on the root. (AdminCN's 17 next/font
// Google fonts are deferred — adding more is an @fontsource import away.)

export type FontKey = "inter" | "system" | "mono";

export const FONT_CONFIG: Record<FontKey, { label: string; family: string }> = {
  inter: {
    label: "Inter",
    family: '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
  },
  system: {
    label: "System",
    family:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  mono: {
    label: "IBM Plex Mono",
    family: '"IBM Plex Mono", ui-monospace, "SFMono-Regular", monospace',
  },
};

export const FONT_GROUPS: { label: string; fonts: FontKey[] }[] = [
  { label: "Sans", fonts: ["inter", "system"] },
  { label: "Mono", fonts: ["mono"] },
];
