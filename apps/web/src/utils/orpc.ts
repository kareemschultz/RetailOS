import type { AppRouter } from "@RetailOS/api/routers/index";
import { env } from "@RetailOS/env/web";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { mockClient } from "./mock-client";

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        toast.error(`Error: ${error.message}`, {
          action: {
            label: "retry",
            onClick: () => {
              query.invalidate();
            },
          },
        });
      },
    }),
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  });
}

const link = new RPCLink({
  url: `${env.VITE_SERVER_URL}/rpc`,
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include",
    });
  },
});

const getORPCClient = () => createORPCClient(link) as RouterClient<AppRouter>;

// In the frontend-only preview there is no backend to reach. Serve the typed
// Everstock mock client instead so every admin screen renders sample catalog
// data. MUST be gated on the same preview flag used for the auth bypass.
export const client: RouterClient<AppRouter> = env.VITE_PREVIEW_NO_AUTH
  ? (mockClient as RouterClient<AppRouter>)
  : getORPCClient();

export const orpc = createTanstackQueryUtils(client);
