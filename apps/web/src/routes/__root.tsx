import { Toaster } from "@RetailOS/ui/components/sonner";
import { TooltipProvider } from "@RetailOS/ui/components/tooltip";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import type { orpc } from "@/utils/orpc";

import { ThemeProvider } from "../components/theme-provider";
import appCss from "../index.css?url";
import { SettingsProvider } from "../theme/settings-store";
export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Tell the UA which color schemes we support so native controls + the
      // scrollbar match the active theme.
      { name: "color-scheme", content: "light dark" },
      { title: "RetailOS" },
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
    // suppressHydrationWarning: next-themes sets the `class`/`style` on <html>
    // before React hydrates, which would otherwise trip a hydration mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <SettingsProvider>
            <TooltipProvider>
              <Outlet />
            </TooltipProvider>
            <Toaster richColors />
          </SettingsProvider>
        </ThemeProvider>
        <TanStackRouterDevtools position="bottom-left" />
        <ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
        <Scripts />
      </body>
    </html>
  );
}
