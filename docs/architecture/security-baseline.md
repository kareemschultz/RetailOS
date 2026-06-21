# RetailOS Security Baseline

> **Scope.** This is the **concrete, actionable security baseline** for RetailOS (§29): the specific HTTP headers, CORS policy, rate limits, request-size limits, cookie policy, dependency/secret scanning, card-data rule, session/device revocation, impersonation controls, and zero-trust Edge networking that every deployment must apply.
>
> It is deliberately **distinct from the security *strategy* prose** in [`quality-security-ops.md`](./quality-security-ops.md) (and §25/§29 of the charter): that doc explains *why* and *how we think about* security/QA; this doc is the *wired knob list* an engineer enforces. Where the two overlap (secrets, observability, alerts), this doc points there rather than restating.
>
> **Source of truth.** Traceable to `retailos-master-charter.md` §29 (Security Architecture), with cross-refs to §6/§7 (auth/RBAC), §8/§9 (tenant isolation/residency), §15/§16 (Edge Hub/hardware), §19 (payments), §25 (secrets/audit). If this doc and the charter disagree, the charter wins (§40).

---

## 1. Security Headers (§29)

Set on **all** HTTP responses from the Hono server and the TanStack Start web app (illustrative values — tune CSP per surface):

| Header | Value (baseline) | Purpose |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; img-src 'self' data: <object-storage-host>; connect-src 'self' <api-host> <ws-host>; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'` | XSS / injection containment; `connect-src` includes the WS sync endpoint (§4) and env-configured object storage (§9) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | force HTTPS (HSTS) |
| `X-Frame-Options` | `DENY` (and CSP `frame-ancestors 'none'`) | clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME-sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | referrer leakage |
| `Permissions-Policy` | minimal allow-list (deny `camera`/`microphone`/`geolocation` except where a wizard needs them) | feature scoping |
| `Cross-Origin-Opener-Policy` | `same-origin` | cross-origin isolation |
| `Cross-Origin-Resource-Policy` | `same-origin` | resource isolation |

- **White-label note (§11):** CSP `img-src`/`connect-src` must accommodate per-tenant custom domains, logos, and storefront assets resolved by hostname — generated from tenant config, never a permissive `*`.
- **Tauri / native:** the desktop POS loads static assets locally; its hardware-bridge calls are governed by §6 of this doc (localhost/LAN binding), not browser CSP.

---

## 2. CORS Policy (§29)

- **Default deny.** No wildcard `Access-Control-Allow-Origin: *` on any authenticated or tenant-scoped endpoint.
- **Explicit allow-list**, resolved from tenant config by hostname (§11): the tenant's own custom domain(s), the platform admin/MSP origin, and the official storefront origin.
- `Access-Control-Allow-Credentials: true` only for first-party origins that carry the session cookie.
- **API-key / service-to-service** integration calls (§6 API Key plugin, §23) authenticate by scoped key, **not** by browser CORS, and are not granted credentialed CORS.
- Preflight (`OPTIONS`) responses cache conservatively and never echo an unvetted `Origin`.

---

## 3. Rate Limits — tenant-keyed token bucket (§8, §29)

- **Token bucket keyed by `tenant_id`** (noisy-neighbor mitigation, §8), with finer keys (`user_id`, `ip`, `device_id`/`terminal_id`, endpoint) layered on top for abuse-prone paths.
- Backed by **Redis** (§4) so limits hold across app instances.
- **Tighter buckets** on auth flows (login, signup, password reset, OTP), webhook ingress, and bulk import/export; heavy tenant tasks (large CSV imports) run on **isolated background worker nodes** so one tenant cannot exhaust shared resources (§8).
- **Reconnection-avalanche backpressure (§14)** is part of this layer: sync ingress applies backpressure + rate limits + batching so N terminals + M Edge Hubs reconnecting cannot cause lock storms or API timeouts.
- Exceeding a limit returns a `permission`/`network`-category structured error (`429`, charter §25 / quality-security-ops §1) with a `Retry-After` hint — never a raw stack.

```jsonc
// illustrative bucket config (per route class)
{
  "auth":      { "key": ["tenant_id","ip"],          "capacity": 10,  "refillPerSec": 0.5 },
  "pos_sale":  { "key": ["tenant_id","terminal_id"],  "capacity": 60,  "refillPerSec": 5   },
  "sync_in":   { "key": ["tenant_id","device_id"],    "capacity": 200, "refillPerSec": 20, "backpressure": true },
  "import":    { "key": ["tenant_id"],                "capacity": 5,   "refillPerSec": 0.1, "worker": "isolated" }
}
```

---

## 4. Request-Size Limits (§29)

- **Global max body size** enforced at the edge/server (e.g. 1 MB for JSON APIs) to blunt resource-exhaustion attacks.
- **Higher, explicit ceilings** only on file-upload routes (imports, product media, documents) — and those route through background jobs (§28), virus/type validation, and object storage (§9), never inline processing.
- **Sync batch caps:** offline/Edge Hub sync batches have a max event count/size; oversized batches are split, never rejected silently (§14).
- JSON depth/array-length limits to prevent parser abuse.

---

## 5. Cookie Policy (§29, §6)

Session cookies (Better Auth, §6):

- `HttpOnly` — not readable by JS (mitigates XSS token theft).
- `Secure` — HTTPS only.
- `SameSite=Lax` for the first-party app session; `Strict` where no cross-site navigation flow needs it. Cross-site storefront/payment-callback flows are handled explicitly, never by loosening to `None` without `Secure` + a documented reason.
- Scoped `Domain`/`Path`; short, sliding session lifetime; rotation on privilege change.
- **No app state in `localStorage`/`sessionStorage`** (§5 UI guardrail) — offline app state uses the form-factor offline engine (Dexie/SQLite), not web storage.

---

## 6. Dependency Audit & Secret Scanning (§28, §29, §43)

- **Dependency audit** runs in CI on every PR (a §43 quality gate) — blocks merge on known-vulnerable transitive deps.
- **Secret scanning (SAST + secret detection)** runs in CI and pre-commit where possible: no token, key, or credential may land in git. Reinforces the **Secrets policy** (charter §25 / quality-security-ops §4: envelope encryption, KMS/Vault/sealed/customer key, redaction, no plaintext in git).
- **Container scanning (Trivy)** on all images before registry push; **distroless/Alpine-minimal** to shrink attack surface (§28).
- Registry tokens (shadcn studio / Magic UI Pro) are secrets under the same policy — env-only, never inlined (§5/§36).

---

## 7. Card Data — tokenized providers only (§19, §29)

- **No raw payment card data (PAN) is ever stored**, logged, or transmitted by RetailOS.
- Card payments use a **compliant tokenized provider flow** only (e.g. Stripe Terminal for integrated EFTPOS, §19).
- **Integrated vs Standalone terminals (§19):** integrated terminals receive the exact amount over local IP / provider API and return a token/result; standalone terminals only record *that* a card was used. Neither path lets card data touch RetailOS storage.
- This keeps RetailOS out of PCI cardholder-data scope by design.

---

## 8. Session & Device Revocation (§6, §29)

- **Session revocation** — admins can revoke a user's sessions immediately (Better Auth Admin plugin, §6); suspension/ban terminates active sessions.
- **Device revocation / unpair** — device-authorized POS terminals, warehouse tablets, kiosks, scanner stations, and Tauri/mobile clients can be **revoked/unpaired** (Better Auth Device Authorization, §6); revoking a device collapses its **offline operating window** to its remaining device-token grace (§13) — a revoked terminal cannot keep operating offline indefinitely.
- **Force-update lock (§28):** clients too far behind the cloud schema are force-locked until they update (Tauri updater / EAS Update / Edge Hub image pull), tied to session/entitlement/payload versioning (§13).
- **Fast cashier switching (§19)** (4-digit PIN / RFID-NFC badge / biometric) re-authenticates a cashier on an *already device-trusted* terminal; revoking the device or session invalidates the underlying trust. Biometric templates are non-reversible hashes only, never raw, never synced to cloud (§19/§25).

---

## 9. Impersonation — banner + audit (§6, §10, §25)

- All support impersonation runs through Better Auth Admin (§6) and is **fully audit-logged** (`impersonator_user_id` on every audit row, §25).
- An **always-visible impersonation banner** (§5 Platform/MSP console) shows on every screen while a support user is impersonating — the operator can never forget they are acting as a tenant.
- Support access is an **audited support-access request workflow** (§10/§38) — not silent backdoor access.
- Impersonation events emit critical-path audit + alerting (quality-security-ops §2 critical alerts).

---

## 10. Zero-Trust Edge Networking (§15, §29)

- **Edge Hub ↔ cloud is never plaintext** over LAN or WAN. Secured with **mTLS** or an encrypted tunnel (**Cloudflare Tunnel** or **WireGuard**) with **mutual authentication and certificate rotation**.
- **Hardware bridge / daemon (§16):** binds to **localhost or trusted LAN only**, requires **pairing/token authorization**, **rejects unauthorized origins**, supports **unpair/revoke**, and **logs all hardware actions**.
- Tunnel/cert material is a secret under §4 (envelope-encrypted, KMS/Vault/sealed/customer key); certs rotate on a schedule and on device revocation (§8 above).
- This complements Edge Hub DR (§15) and secrets handling (§25) — the transport is encrypted *and* the offline data is recoverable.

---

## Known limitations / intentionally deferred

- **Most baseline controls are designed, not yet enforced in CI/runtime.** Header/CORS/rate-limit/size-limit middleware, the Trivy container scan, dependency audit, and secret scanning are **TODO** for Phase 0/1 — only `check-types` and `check` (Ultracite/Biome) are currently wired (see quality-security-ops §7).
- **CSP is a baseline starting point** and will need per-surface tightening (storefront vs admin vs POS) and per-tenant custom-domain allow-listing once white-label hostname resolution (§11) is implemented; `'unsafe-inline'` on `style-src` is a known temporary allowance to remove.
- **Exact rate-limit numbers are illustrative** and must be tuned against real POS/sync load (§44) before production.
- **Tokenized-provider integrations** (Stripe Terminal et al., §19/§23) are reserved seams, not yet implemented; the "no raw card data" rule is enforceable in design but untested end-to-end.
- **mTLS / tunnel cert-rotation automation** (§15) is specified but not yet built; the Edge Hub itself is a later phase (Phase 10, §31).
- **SCIM deprovisioning, Have-I-Been-Pwned compromised-password checks, and Captcha** (§6) are planned Better Auth plugins, not yet wired.
- This document is **planning/design only** — no implementation code; illustrative config is illustrative.
