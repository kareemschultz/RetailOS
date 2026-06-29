export interface ThemeStyleProps {
  accent: string;
  "accent-foreground": string;
  background: string;
  border: string;
  card: string;
  "card-foreground": string;
  "chart-1": string;
  "chart-2": string;
  "chart-3": string;
  "chart-4": string;
  "chart-5": string;
  destructive: string;
  "destructive-foreground": string;
  foreground: string;
  input: string;
  "letter-spacing"?: string;
  muted: string;
  "muted-foreground": string;
  popover: string;
  "popover-foreground": string;
  primary: string;
  "primary-foreground": string;
  radius: string;
  ring: string;
  secondary: string;
  "secondary-foreground": string;
  "shadow-blur"?: string;
  "shadow-color"?: string;
  "shadow-offset-x"?: string;
  "shadow-offset-y"?: string;
  "shadow-opacity"?: string;
  "shadow-spread"?: string;
  sidebar: string;
  "sidebar-accent": string;
  "sidebar-accent-foreground": string;
  "sidebar-border": string;
  "sidebar-foreground": string;
  "sidebar-primary": string;
  "sidebar-primary-foreground": string;
  "sidebar-ring": string;
  spacing?: string;
}

export interface ThemeStyles {
  dark: Partial<ThemeStyleProps>;
  light: Partial<ThemeStyleProps>;
}

export interface ThemePreset {
  label: string;
  styles: ThemeStyles;
}
