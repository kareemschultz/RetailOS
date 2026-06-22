import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";
import { buildRequestContext } from "./request-context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return await next({
    context: {
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

// Tenant guard: builds the standardized request context (fail-closed — requires
// an authenticated user AND an active organization/tenant) and injects it. Every
// tenant-scoped router uses this; handlers then run their work inside
// withTenant(db, ctx.requestContext.tenantId, ...) so RLS scopes the queries.
const requireTenant = o.middleware(({ context, next }) => {
  const requestContext = buildRequestContext(context.session, context.meta);
  return next({
    context: {
      requestContext,
    },
  });
});

export const tenantProcedure = protectedProcedure.use(requireTenant);

export type { RequestContext } from "./request-context";
export { buildRequestContext } from "./request-context";
