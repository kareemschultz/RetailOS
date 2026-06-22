import { describe, expect, it } from "vitest";
import { buildRequestContext } from "./request-context";

const META = {
  requestId: "req-1",
  correlationId: "corr-1",
  source: "web",
  deploymentMode: "saas",
};

describe("buildRequestContext (tenant guard, fail-closed)", () => {
  it("rejects when there is no authenticated user", () => {
    expect(() => buildRequestContext(null, META)).toThrow();
    expect(() => buildRequestContext({ user: null }, META)).toThrow();
  });

  it("rejects when there is no active organization (tenant)", () => {
    expect(() =>
      buildRequestContext({ user: { id: "u1" }, session: { id: "s1" } }, META)
    ).toThrow();
  });

  it("builds the standardized context from session + meta", () => {
    const ctx = buildRequestContext(
      {
        user: { id: "u1" },
        session: {
          id: "s1",
          activeOrganizationId: "org_1",
          impersonatedBy: "admin1",
        },
      },
      META
    );
    expect(ctx.tenantId).toBe("org_1");
    expect(ctx.organizationId).toBe("org_1");
    expect(ctx.actorUserId).toBe("u1");
    expect(ctx.sessionId).toBe("s1");
    expect(ctx.impersonatorUserId).toBe("admin1");
    expect(ctx.requestId).toBe("req-1");
    expect(ctx.correlationId).toBe("corr-1");
    expect(ctx.source).toBe("web");
    expect(ctx.deploymentMode).toBe("saas");
  });
});
