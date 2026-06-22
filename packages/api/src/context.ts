import { auth } from "@RetailOS/auth";
import { env } from "@RetailOS/env/server";
import { randomUUID } from "node:crypto";
import type { Context as HonoContext } from "hono";
import type { RequestMeta } from "./request-context";

export interface CreateContextOptions {
  context: HonoContext;
}

export async function createContext({ context }: CreateContextOptions) {
  const headers = context.req.raw.headers;
  const session = await auth.api.getSession({ headers });

  // Request metadata shared by audit / events / logging (charter §25). Honor an
  // inbound correlation/request id (offline sync, retries, cross-service) or mint one.
  const requestId = headers.get("x-request-id") ?? randomUUID();
  const meta: RequestMeta = {
    requestId,
    correlationId: headers.get("x-correlation-id") ?? requestId,
    source: headers.get("x-client-source") ?? "web",
    deploymentMode: env.DEPLOYMENT_MODE,
  };

  return {
    auth: null,
    session,
    meta,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
