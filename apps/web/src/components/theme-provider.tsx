import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Thin wrapper over next-themes so the whole app reads RetailOS tokens in either
// mode. White-label tenants re-skin via the CSS custom properties in
// packages/ui/src/styles/globals.css — this only toggles the `.dark` class.
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
