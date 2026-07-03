import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { commerceRouter } from "./commerce";
import { procurementRouter } from "./procurement";
import {
  accountingRouter,
  auditRouter,
  bondRouter,
  catalogRouter,
  companyRouter,
  inventoryRouter,
  locationRouter,
  membershipRouter,
  numberingRouter,
  onboardingRouter,
  posRouter,
  productRouter,
  reportsRouter,
  taxRouter,
  tenantRouter,
  transferRouter,
} from "./vs1";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  // Vertical Slice #1 flow (charter §32).
  tenant: tenantRouter,
  onboarding: onboardingRouter,
  catalog: catalogRouter,
  company: companyRouter,
  location: locationRouter,
  product: productRouter,
  inventory: inventoryRouter,
  transfer: transferRouter,
  bond: bondRouter,
  procurement: procurementRouter,
  accounting: accountingRouter,
  pos: posRouter,
  reports: reportsRouter,
  // Tenant administration surfaces (tax, staff/RBAC, audit trail, numbering).
  tax: taxRouter,
  membership: membershipRouter,
  audit: auditRouter,
  numbering: numberingRouter,
  // Shopix Commerce Experience — public, hostname-resolved storefront API.
  commerce: commerceRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
