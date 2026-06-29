import { db, schema } from "@RetailOS/db";
import { env } from "@RetailOS/env/server";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

import { o, publicProcedure } from "./index";

// Shopix storefront gateway (charter §11, design §2). The PUBLIC, anonymous,
// internet-facing entry point. Unlike tenantProcedure (authenticated org member →
// tenant_id = activeOrganizationId), the storefront has NO session: the tenant is
// resolved from the request HOSTNAME, fail-closed. This is a distinct trust
// boundary (design §1) — it never touches the staff RBAC and never grants a
// permission; it only resolves which tenant's public storefront is being served.

// The storefront request context injected by storefrontProcedure. Deliberately
// minimal: a tenant id + request metadata, NO actor/permission/session — a
// storefront caller is anonymous. Handlers scope tenant-owned reads with
// withTenant(db, ctx.storefront.tenantId, ...) exactly like the authenticated path.
export interface StorefrontContext {
  correlationId: string;
  deploymentMode: string;
  host: string;
  requestId: string;
  source: string;
  tenantId: string;
}

const PORT_SUFFIX = /:\d+$/;

// Normalize a raw Host header to a comparable hostname: trim, lowercase, strip an
// optional :port. Returns null for an empty/missing host (→ fail-closed upstream).
export function normalizeHost(
  rawHost: string | null | undefined
): string | null {
  if (!rawHost) {
    return null;
  }
  const host = rawHost.trim().toLowerCase().replace(PORT_SUFFIX, "");
  return host.length > 0 ? host : null;
}

// Resolve a request hostname to a tenant id, fail-closed (returns null when no
// tenant owns the host — the caller then rejects, never falling back to a default
// tenant). This is a PLATFORM-level read of the organization registry:
// `organization` is the tenant registry itself (its `id` IS the tenant id; it has
// no `tenant_id` column and no RLS), so the lookup runs on the base db without a
// tenant GUC. It reveals nothing cross-tenant — it returns only the single org id
// that owns the public hostname being requested.
export async function resolveTenantFromHost(
  rawHost: string | null | undefined
): Promise<string | null> {
  const host = normalizeHost(rawHost);
  if (!host) {
    return null;
  }

  // 1) Exact custom/explicit storefront domain (e.g. "shop.acme.com").
  const byDomain = (
    await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.storefrontDomain, host))
      .limit(1)
  ).at(0);
  if (byDomain) {
    return byDomain.id;
  }

  // 2) "{slug}.{STOREFRONT_BASE_DOMAIN}" subdomain pattern, when configured.
  const base = env.STOREFRONT_BASE_DOMAIN?.toLowerCase();
  if (base && host.endsWith(`.${base}`)) {
    const slug = host.slice(0, host.length - (base.length + 1));
    // A single label only — "a.b.shop.retailos.com" is not a valid storefront slug.
    if (slug.length > 0 && !slug.includes(".")) {
      const bySlug = (
        await db
          .select({ id: schema.organization.id })
          .from(schema.organization)
          .where(eq(schema.organization.slug, slug))
          .limit(1)
      ).at(0);
      if (bySlug) {
        return bySlug.id;
      }
    }
  }

  return null;
}

// Per-(host + IP) fixed-window rate limit (design §1.5, GAP-6). In-memory →
// single-node only; behind a multi-node deploy this MUST move to a Redis token
// bucket (charter §8). Public reads cannot mutate, so an in-memory limiter is a
// real (if coarse) control today. Budget is env-driven (STOREFRONT_RATE_LIMIT_PER_MIN).
const RATE_WINDOW_MS = 60_000;
// Cap on distinct (host+IP) buckets. A public surface lets anonymous callers
// mint new keys by rotating Host/IP; without a bound the limiter's own Map is a
// memory-exhaustion (self-DoS) vector. When the cap is hit we sweep expired
// buckets before admitting a new key (folded review HIGH). Multi-node ⇒ Redis
// keys with native TTL (charter §8).
const MAX_RATE_BUCKETS = 50_000;
const FORWARDED_FOR_SEPARATOR = /\s*,\s*/;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

// Drop every expired bucket. Map iteration tolerates deletes mid-loop.
function pruneExpiredRateBuckets(now: number): void {
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }
}

// Best-effort client IP behind the proxy (Traefik/Pangolin sets x-forwarded-for).
// Falls back to "unknown" so a missing header still rate-limits per host (coarse).
function clientIp(headers: Headers | undefined): string {
  const fwd = headers?.get("x-forwarded-for");
  if (fwd) {
    return fwd.split(FORWARDED_FOR_SEPARATOR)[0] ?? "unknown";
  }
  return headers?.get("x-real-ip") ?? "unknown";
}

const rateLimit = o.middleware(({ context, next }) => {
  const host = normalizeHost(context.headers?.get("host")) ?? "unknown";
  const key = `${host}:${clientIp(context.headers)}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    // New window (also lazily reclaims an expired bucket's slot). Before
    // admitting a brand-new key at the cap, sweep expired buckets so a
    // Host/IP-rotation flood cannot grow the Map without bound.
    if (!bucket && rateBuckets.size >= MAX_RATE_BUCKETS) {
      pruneExpiredRateBuckets(now);
    }
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
  } else {
    bucket.count += 1;
    if (bucket.count > env.STOREFRONT_RATE_LIMIT_PER_MIN) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many requests — please slow down",
      });
    }
  }
  return next();
});

// Resolves the hostname → tenant and injects the StorefrontContext. Fail-closed:
// an unknown/missing host rejects with NOT_FOUND (never a default tenant, never a
// cross-tenant spill — consistent with the RLS fail-closed posture).
const requireStorefrontTenant = o.middleware(async ({ context, next }) => {
  const host = normalizeHost(context.headers?.get("host"));
  const tenantId = await resolveTenantFromHost(host);
  if (!(host && tenantId)) {
    throw new ORPCError("NOT_FOUND", {
      message: "No storefront is configured for this host",
    });
  }
  const storefront: StorefrontContext = {
    tenantId,
    host,
    requestId: context.meta.requestId,
    correlationId: context.meta.correlationId,
    source: context.meta.source,
    deploymentMode: context.meta.deploymentMode,
  };
  // Hard trust-boundary (design §1.4): a storefront caller is ANONYMOUS. Even if
  // the request happens to carry a staff session cookie, null the staff
  // session/auth in the downstream context so storefront handlers CANNOT read
  // staff identity or reach the RBAC — the customer principal never bleeds into
  // staff context. Nulling here also narrows the downstream type, so a handler
  // that tries to read `context.session` fails to compile (the bad thing is
  // structurally inexpressible, not merely avoided).
  return next({ context: { storefront, session: null, auth: null } });
});

// The public storefront procedure: anonymous (no session/permission), tenant
// resolved from hostname. The storefront analogue of tenantProcedure. Rate-limit
// runs FIRST (before tenant resolution) so an unknown-host flood is also bounded.
export const storefrontProcedure = publicProcedure
  .use(rateLimit)
  .use(requireStorefrontTenant);
