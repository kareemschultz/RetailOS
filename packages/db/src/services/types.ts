// Minimal service context for VS#1 core services. The full standardized request
// context (organizationId / userId / employeeId / sessionId / source /
// deploymentMode) is introduced with the middleware (Commit 4); these services
// consume the subset they need and accept the wider context unchanged.
export interface ServiceContext {
  actorUserId?: string | null;
  correlationId?: string | null;
  impersonatorUserId?: string | null;
  requestId?: string | null;
  tenantId: string;
}
