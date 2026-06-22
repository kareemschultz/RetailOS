import { ORPCError } from "@orpc/server";

// The standardized request context (charter §25): one object threaded through
// every protected mutation and shared by audit, domain events, structured
// logging, and (later) analytics. A superset of @RetailOS/db's ServiceContext,
// so it can be passed straight to the core services.
export interface RequestContext {
  actorUserId: string;
  correlationId: string;
  deploymentMode: string;
  employeeId?: string | null;
  impersonatorUserId?: string | null;
  organizationId: string;
  requestId: string;
  sessionId?: string | null;
  source: string;
  tenantId: string;
}

export interface RequestMeta {
  correlationId: string;
  deploymentMode: string;
  requestId: string;
  source: string;
}

// Minimal shape of the Better Auth session (organization + admin plugins).
interface SessionLike {
  session?: {
    id?: string | null;
    activeOrganizationId?: string | null;
    impersonatedBy?: string | null;
  } | null;
  user?: { id?: string | null } | null;
}

// Builds the request context, fail-closed: UNAUTHORIZED without an authenticated
// user, FORBIDDEN without an active organization (tenant). The tenant id IS the
// active organization id (Better Auth org == RetailOS tenant).
export function buildRequestContext(
  session: SessionLike | null | undefined,
  meta: RequestMeta
): RequestContext {
  const actorUserId = session?.user?.id;
  if (!actorUserId) {
    throw new ORPCError("UNAUTHORIZED");
  }
  const organizationId = session?.session?.activeOrganizationId;
  if (!organizationId) {
    throw new ORPCError("FORBIDDEN", {
      message: "No active organization (tenant) is selected",
    });
  }
  return {
    tenantId: organizationId,
    organizationId,
    actorUserId,
    sessionId: session?.session?.id ?? null,
    impersonatorUserId: session?.session?.impersonatedBy ?? null,
    requestId: meta.requestId,
    correlationId: meta.correlationId,
    source: meta.source,
    deploymentMode: meta.deploymentMode,
  };
}
