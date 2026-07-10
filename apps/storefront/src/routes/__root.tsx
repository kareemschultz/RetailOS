import { Toaster } from "@RetailOS/ui/components/sonner";
import { TooltipProvider } from "@RetailOS/ui/components/tooltip";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";

import { StorefrontFooter } from "../components/storefront-footer";
import { StorefrontHeader } from "../components/storefront-header";
import appCss from "../index.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light dark" },
      { name: "theme-color", content: "#1a44c2" },
      {
        name: "description",
        content:
          "Shopix — a modern home, kitchen and living store. Considered goods for everyday rituals, powered by RetailOS.",
      },
      { title: "Shopix — Home, Kitchen & Living" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
          enableSystem
        >
          <TooltipProvider>
            <div className="flex min-h-screen flex-col bg-background text-foreground">
              <StorefrontHeader />
              <main className="flex-1">
                <Outlet />
              </main>
              <StorefrontFooter />
            </div>
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
