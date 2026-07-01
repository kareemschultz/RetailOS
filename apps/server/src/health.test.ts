// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

describe("server health endpoints", () => {
  it("serves liveness before RPC/auth context middleware", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://retailos_app:retailos_app@127.0.0.1:1/retailos"
    );
    vi.stubEnv("BETTER_AUTH_SECRET", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("CORS_ORIGIN", "http://localhost:3001");
    vi.stubEnv("DEPLOYMENT_MODE", "self-hosted");

    const { default: app } = await import("./index");
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
  });
});
