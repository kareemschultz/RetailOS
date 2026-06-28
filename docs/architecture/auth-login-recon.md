# Auth & Login Recon — is a login page greenfield UI or auth-boundary work?

> **Read-only reconnaissance (no code changed).** Companion to the frontend-readiness recon discipline
> (same shape as the `tenant_ui_config` / number-leasing "merged vs load-bearing" passes). Purpose: decide
> whether building a RetailOS **login page** is safe pure-frontend presentation over already-working
> Better Auth, or whether it would touch the **auth boundary** (the one screen that gates all access, which
> must never get an unsupervised build).

## Verdict

**GREENFIELD pure-frontend presentation — safe, normal capability.** Better Auth is fully wired on the
backend (organization + admin plugins, session handling, fail-closed tenant resolution, RLS). A login UI
would be a presentation skin calling the **existing** `authClient` methods — **zero auth-boundary touch,
no server auth changes, no auth code review required**. The current login route is a real-but-minimal
functional scaffold; replacing it with a shadcn Studio block is ordinary UI assembly.

## Evidence (file:line)

### Backend Better Auth — fully wired
- `packages/auth/src/index.ts:1–42` — `createAuth()`: `emailAndPassword` enabled; `plugins: [organization(), admin(), expo()]` (L37); Drizzle pg adapter.
- `packages/api/src/context.ts:11–14` — session via `auth.api.getSession({ headers })` on every request; absent ⇒ unauthenticated.

### Tenant resolution — server-authoritative, fail-closed
- `packages/api/src/request-context.ts:40–65` — `buildRequestContext`: throws `UNAUTHORIZED` if no user (L46); throws `FORBIDDEN` "No active organization (tenant) is selected" if no `activeOrganizationId` (L50–51); `tenantId = session.session.activeOrganizationId` (L48 → L55). Fail-closed.
- `packages/api/src/index.ts:21,27–36` — `requireTenant` middleware → `tenantProcedure`; every **`tenantProcedure`** handler receives the resolved `tenantId` and RLS via `withTenant`. (Bare `protectedProcedure` at L21 is authenticated but **not** tenant-scoped — e.g. `privateData` in `routers/index.ts:19–22` — so "authenticated" ≠ "tenant-bound"; the tenant gate is `tenantProcedure` specifically.)
- `packages/api/src/routers/vs1.ts:102–114` — `tenant.setActive` calls Better Auth `auth.api.setActiveOrganization` (L108); standard org-switch, **not** a `tenantProcedure` (runs before a tenant is active). No custom boundary code.

### Login UI today — real, minimal scaffold
- `apps/web/src/routes/login.tsx` — a **real** TanStack Start file-based route; toggles `SignInForm`/`SignUpForm` (not a placeholder).
- `apps/web/src/components/sign-in-form.tsx:13–146` — wired to `authClient.signIn.email()` (L29); TanStack Form + Zod; success → `/dashboard`. Styling is **minimal** (centered card, no hero/branding/polish).
- `apps/web/src/components/sign-up-form.tsx:13–171` — `authClient.signUp.email()` (L30).
- `apps/web/src/lib/auth-client.ts` — `createAuthClient({ baseURL: env.VITE_SERVER_URL })`; client configured.
- `apps/web/src/routes/_app/route.tsx:10–18` — `beforeLoad` checks `authClient.getSession()`; redirects to `/login` if none (L15).

### Studio blocks available to source (Assembly Law)
- `docs/architecture/ui-inventory/shadcn-studio.md:947–958` — 5 blocks `login-page-01`…`login-page-05` (centered card, split-screen w/ brand image, OTP, social OAuth, remember-me/forgot).
- `docs/architecture/frontend-strategy.md:1326` — recommends `login-page-01/02`.
- Also greenfield (same safety level): `forgot-password-01…05`, `verify-email-01…05`, `two-factor-authentication-01…05`.

## Merged-vs-load-bearing

| Concern | Status |
|---|---|
| Better Auth backend wired (org/admin, session) | ✅ load-bearing, present |
| Tenant binding server-authoritative + fail-closed | ✅ load-bearing, present (`activeOrganizationId` → `tenantId`, RLS) |
| Login route + sign-in/up forms exist & call `authClient` | ✅ present (minimal styling) |
| Auth client configured | ✅ present |
| Tenant-level module licensing / feature flags | ❌ not present (separate concern; see entitlements design) |
| Would a new login UI touch the auth boundary? | ❌ **no** — pure presentation over existing client methods |

## Morning recommendation

Building/replacing the login page is a **normal low-risk frontend capability**, not auth-boundary work.
Source `login-page-01` or `login-page-02`, run the standard Import → Normalize (strip Next/auth/mock) →
Adapt (RetailOS tokens) → Extend pipeline, and wire to the **existing** `authClient.signIn.email()` /
`authClient.signUp.email()`. No server auth changes, no auth code review needed. Forgot-password,
verify-email, and 2FA screens are the same safety class when those Better Auth flows are enabled.

> **Required deliverable, not an optional nuance (corrected after Codex review of this doc):** the
> protected-route guards (`apps/web/src/routes/_app/route.tsx:11–17`, `apps/web/src/routes/_auth/route.tsx:6–15`)
> redirect **only** on `!session.data` — they do **not** check for an active organization client-side, and
> there is **no web caller for `tenant.setActive` yet**. So a user who is authenticated but has no
> `activeOrganizationId` (a member of multiple orgs, or any org not yet activated) lands in the
> authenticated shell where **every tenant API call fails `FORBIDDEN`** (the server `requireTenant`
> middleware is correctly fail-closed — the gap is purely a missing *frontend* step). Therefore an
> **org-selection step is a required part of the login flow**, not a nice-to-have. It is still greenfield
> frontend work — presentation over the existing `tenant.setActive` procedure, **no** server auth-boundary
> change — but it must be built, not skipped, or multi-org users hit a dead authenticated shell.
