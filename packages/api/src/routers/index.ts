import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import {
  catalogRouter,
  companyRouter,
  inventoryRouter,
  locationRouter,
  posRouter,
  productRouter,
  reportsRouter,
  tenantRouter,
} from "./vs1";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  // Vertical Slice #1 flow (charter §32).
  tenant: tenantRouter,
  catalog: catalogRouter,
  company: companyRouter,
  location: locationRouter,
  product: productRouter,
  inventory: inventoryRouter,
  pos: posRouter,
  reports: reportsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
