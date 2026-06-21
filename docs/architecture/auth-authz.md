# RetailOS Authentication & Authorization Architecture

> Planning/design document. No implementation code. Illustrative tables and pseudocode only.
> Source of truth: `docs/architecture/retailos-master-charter.md`. Primary sections: **§6** (Better Auth), **§7** (Authorization & Entitlements), with cross-refs to §8/§9 (tenancy), §10 (feature flags/licensing), §13/§14 (offline), §25 (audit), §26/§35 (RLS-bypass tests), §29 (security).

---

## 1. Two-layer model at a glance

RetailOS splits identity/access into **two cooperating layers** with a hard boundary (§6):

| Layer | Owner | Scope of decisions | Storage |
|---|---|---|---|
| **Better Auth** | `packages/auth` | Identity, sessions, org membership, invitations, **coarse** org/admin roles, 2FA, API keys, device authorization, SCIM, SSO/OIDC | Better Auth tables (PostgreSQL via Drizzle adapter) |
| **RetailOS Entitlements Service** | `packages/api` (entitlements module) | **Fine-grained** ERP permissions, feature flags, subscription/license entitlements, company/location scope, approval rules, device authorization gate, offline entitlement snapshot | RetailOS domain tables (`roles`, `role_permissions`, `user_company_access`, `feature_flags`, `subscriptions`, …) |

**Direction of dependency:** Entitlements consumes Better Auth output; Better Auth never calls Entitlements. The session + active organization are the **input** to every entitlement decision (§6).

```
Request → Better Auth (who are you? which org? trusted device? 2FA satisfied?)
        → Entitlements ( given that session+org, MAY you do products.edit at company C, location L?)
        → Handler
```

---

## 2. Better Auth plugin plan (§6)

### 2.1 Plugin inventory, phasing, and rationale

| Plugin | Purpose (§6) | Phase | Notes |
|---|---|---|---|
| **Organization** | Orgs, members, teams, invitations, **active organization** context, base org access control | **Phase 1** | The tenant = a Better Auth organization. `activeOrganizationId` drives tenant scope. Do **not** fight this model (§6). |
| **Admin** | Platform user administration, suspension, bans/unbans, **support impersonation** | **Phase 1** | Every impersonation event audited (§25): `impersonator_user_id` recorded. Drives the MSP console (§10). |
| **Two-Factor (2FA)** | TOTP, OTP, backup codes, trusted devices | **Phase 1** | Mandatory for high-risk roles (see §2.2). |
| **API Key** | Integrations, supplier APIs, webhooks, service-to-service | **Phase 1** (foundation) → consumed heavily in Phase 6/8/11 | Keys are **scoped** (§29); scopes map to permission groups. Tenant-scoped secrets. |
| **Device Authorization** | POS terminals, warehouse tablets, kiosks, scanners, Tauri/mobile clients | **Phase 1** (design) → **Phase 4** (POS) / **Phase 10** (Edge Hub) | Establishes **device trust**; the §19 fast-cashier-switch (PIN/badge/biometric) layers on top of an already-authorized device. |
| **Captcha** | Login, signup, password reset, public storefront auth | **Phase 1** | Abuse prevention on all public auth flows (§29). |
| **SCIM** | Enterprise/gov/healthcare provisioning & deprovisioning from corporate IdPs | **Phase 1** (foundation) → enabled per tenant via `scim_enabled` flag (§10) | Provisioning maps IdP groups → coarse org roles only; ERP permissions still resolved by Entitlements. |
| **Have I Been Pwned (HIBP)** | Compromised-password checking | **Phase 1** | On signup + password change (§29). |
| **i18n** | Translated Better Auth error messages | **Phase 1** | Charter targets EN/ES/NL/FR/PT (§12). |
| **Passkeys** | WebAuthn passwordless | **Later** (Phase 11/13) | Strong-auth upgrade path; not required for Slice #1. |
| **SSO** | Enterprise SAML/OIDC login | **Later** (Phase 11+, per tenant `sso_enabled`) | For enterprise/gov tenants. |
| **OIDC Provider / OAuth Provider** | RetailOS *as* an identity provider for downstream apps | **Later** (Phase 13) | Reserve the seam; not Phase-1. |
| **JWT / Bearer** | Where stateless tokens are needed (Edge Hub, service calls) | **Phase 1** (as needed) | Used by Edge Hub ↔ cloud and oRPC service calls. |
| **Billing plugins** (Stripe/Polar/Chargebee) | Auth-linked subscription workflows | **Evaluate** — Phase 11 | Scaffold is `--payments none` (§4); RetailOS billing is domain logic (§10/§23). License enforcement stays **abstracted from auth** (§37). |

**Phase-1 set** (foundation per §31 "Phase 1 — Identity, Tenant, RBAC and Audit" + §47): Organization, Admin, 2FA, API Key, Device Authorization, Captcha, SCIM, HIBP, i18n, JWT/Bearer.
**Deferred:** Passkeys, SSO, OIDC/OAuth Provider, billing plugins.

### 2.2 Roles that MUST have 2FA (§6)

Mandatory TOTP/2FA (enforced before the protected action; offline grace governed by §13/§14 snapshot):

- **`platform_admin`** (platform owner / MSP staff) — highest blast radius.
- **`tenant_admin`** — tenant-wide configuration, billing, user management.
- **`accountant`** / finance users — financial postings, period close, payments (§19/§20).
- Any role flagged **high-risk** by the tenant: roles holding `accounting.approve_journal`, `procurement.approve_po`, `bond.approve_release`, `banking.reconcile`, `audit.export`, `settings.manage`, `users.invite/disable`, or `platform.manage_tenants`.

2FA enforcement is checked in the validation pipeline (§4) as a precondition for sensitive permissions; the requirement itself is a property of the **role/permission**, evaluated by Entitlements using the Better Auth 2FA state as input.

---

## 3. The access-control boundary (§6) — what lives where

**Better Auth = coarse.** It answers: *who is this user, which organization is active, are they a member, what coarse org role do they hold (owner/admin/member), is the device authorized, is 2FA satisfied, is the account banned/suspended.*

**RetailOS Entitlements = fine-grained.** It answers everything ERP-specific:

| Concern | Owned by Entitlements | Charter |
|---|---|---|
| ERP permissions (`products.*`, `pos.*`, `accounting.*`, …) | ✅ | §7 |
| Feature flags (`accounting_enabled`, `ecommerce_enabled`, …) | ✅ | §10 |
| Subscription / license entitlements & usage limits | ✅ | §10/§37 |
| Company/location access scope | ✅ | §7/§8 |
| Approval rules (voids, refunds, bond release, journals…) | ✅ | §7/§22 |
| License constraints (perpetual/trial/suspended, grace) | ✅ | §10/§37 |
| Device authorization gate (per-action) | ✅ (reads BA device trust) | §7/§16 |
| Offline entitlement snapshot | ✅ | §7/§13 |

**Contract / non-negotiables (§6):**

1. Entitlements takes **`{ session, activeOrganization }`** as input — never re-implements sessions or membership.
2. **Do not duplicate or fight Better Auth's organization model.** Tenant ≡ organization; teams/members/invitations stay in Better Auth. RetailOS adds *company* and *location* sub-scoping **below** the org, plus permission resolution — it does not shadow the org.
3. Better Auth coarse roles are intentionally few (owner/admin/member + platform admin via Admin plugin). All other roles (`manager`, `cashier`, `accountant`, `warehouse`, `procurement`, `support`) are **RetailOS roles** resolved by Entitlements, not Better Auth roles.
4. License enforcement is **abstracted from authentication** (§37) and operates across all deployment modes (§9).

```text
EntitlementDecision resolve(session, activeOrg, action, scopeCtx):
  membership = betterAuth.requireMember(session, activeOrg)          // coarse (BA)
  if action.requires2FA and not session.twoFactorVerified: DENY      // BA state
  role        = retailos.roleFor(membership.userId, activeOrg)        // RetailOS
  if not role.permissions.has(action): DENY
  if not retailos.featureFlag(activeOrg, action.featureFlag): DENY    // §10
  if not retailos.subscriptionAllows(activeOrg, action): DENY         // §10/§37
  if not retailos.companyLocationAccess(role, scopeCtx): DENY         // §7/§8
  if action.deviceGated and not betterAuth.deviceTrusted(ctx): DENY   // §16
  if action.needsApproval: PENDING_APPROVAL                           // §22
  ALLOW
```

---

## 4. The 11 authorization layers (§7) and the per-action validation pipeline

Every protected action passes **all** applicable layers (§7). Order is chosen so the cheapest/most-decisive checks fail first.

| # | Layer (§7) | Question | Resolved by | Fail mode |
|---|---|---|---|---|
| 1 | **Platform** | Is this a platform-owner action; is platform context valid? | Better Auth (Admin) | 403 |
| 2 | **Tenant** | Is there an active organization; is the row in this tenant? | Better Auth (active org) + tenant guard + RLS | 403 / RLS deny |
| 3 | **Company** | Does the user have access to the target company? | Entitlements (`user_company_access`) | 403 |
| 4 | **Location** | Does the user have access to the target location? | Entitlements | 403 |
| 5 | **Module** | Is the module enabled & permitted (e.g. `accounting`)? | Entitlements + feature flag | 403 / 404 |
| 6 | **Action** | Does the role grant the specific permission (`pos.refund`)? | Entitlements (RBAC) | 403 |
| 7 | **Approval workflow** | Does this action require approval before it commits? | Entitlements + workflow engine (§22) | `PENDING_APPROVAL` |
| 8 | **Feature flag** | Is the feature enabled for this tenant (§10)? | Entitlements | 403 / hidden |
| 9 | **Subscription / license entitlement** | Within plan, usage limit, license valid/grace? | Entitlements (§10/§37) | 402 / 403 |
| 10 | **Device authorization** | If applicable, is the device trusted/authorized? | Better Auth Device Auth + Entitlements gate | 403 |
| 11 | **Offline entitlement snapshot** | Offline: do cached entitlements + token grace permit this? | Cached snapshot on device (§13/§14) | local deny |

### 4.1 Per-action validation pipeline (§7)

Charter §7: *"Every protected action validates session, active organization, tenant scope, membership, role, permission, company/location access, feature flag, subscription/license entitlement, device authorization if applicable, and approval requirement if applicable."*

```text
guard(action, ctx):
  1. session            = requireSession(ctx)                 # BA — else 401
  2. activeOrg          = requireActiveOrganization(session)  # BA — else 403
  3. tenantScope        = setTenantGuard(activeOrg.tenantId)  # app guard + RLS GUC (§8)
  4. membership         = requireMembership(session, activeOrg)# BA — else 403
  5. require2FAIf(action.highRisk, session)                   # BA 2FA state (§6)
  6. role               = resolveRole(membership)             # Entitlements
  7. requirePermission(role, action.permission)               # RBAC (§7)
  8. requireCompanyLocationAccess(role, ctx.company, ctx.location)
  9. requireFeatureFlag(activeOrg, action.featureFlag)        # §10
 10. requireSubscriptionEntitlement(activeOrg, action)         # §10/§37
 11. requireDeviceAuthorization(ctx.device) IF action.deviceGated  # §16
 12. approval = evaluateApproval(action, ctx)                  # §22 → may return PENDING
 13. audit.record(actor, impersonator, action, ctx)            # §25 — every mutation
 14. proceed(action)  |  or queue offline w/ snapshot check (§13)
```

- **Defense in depth:** layer 2 is enforced both at the **application tenant guard** *and* **PostgreSQL RLS** (see `tenancy-deployment.md`). A permission bug must not become a cross-tenant leak.
- **Offline path:** when offline (§13), steps 6–10 are evaluated against the **cached entitlement snapshot** and **device-token grace window**; mutations queue with idempotency keys and re-validate server-side on sync (§14). The snapshot can only ever *restrict*, never *grant beyond*, the last known online entitlements.
- **Audit (§25):** every mutation records `actor_user_id`, `impersonator_user_id`, action, entity, old/new, request_id, correlation_id, idempotency_key, device. Impersonation is always visible (§10 banner).

---

## 5. RBAC matrix — roles × permission groups (§7)

Permission **groups** correspond to the §7 example namespaces. Legend: **F** = full (all verbs incl. approve), **W** = write (view/create/edit, no approve/destructive), **R** = read-only, **A** = approve-only, **—** = none. `manager` is per-company/location scoped; `platform_admin` is platform-scoped (not a tenant role).

| Permission group | platform_admin | tenant_admin | manager | cashier | accountant | warehouse | procurement | support |
|---|---|---|---|---|---|---|---|---|
| `platform.*` | **F** | — | — | — | — | — | — | R¹ |
| `settings.*` | F | **F** | R | — | — | — | — | R |
| `users.*` (invite/disable) | F | **F** | W² | — | — | — | — | R |
| `audit.*` (view/export) | F | **F** | R | — | R | — | — | R |
| `products.*` | F | F | **W** | R | R | R | W | R |
| `inventory.*` | F | F | **F** | R | R | **W** | W | R |
| `pos.*` | F | F | **F** | **W**³ | — | — | — | R |
| `accounting.*` | F | F | R | — | **F** | — | — | R |
| `banking.*` | F | F | R | — | **F** | — | — | R |
| `crm.*` | F | F | **F** | W⁴ | R | — | W | R |
| `procurement.*` | F | F | A⁵ | — | R | — | **F** | R |
| `warehouse.*` | F | F | **F** | — | — | **W** | W | R |
| `bond.*` | F | F | A⁵ | — | R | W | W | R |
| `ecommerce.*` | F | F | **W** | — | R | W⁶ | W | R |
| `reports.*` | F | F | **R** | R⁷ | R | R | R | R |

Footnotes:
1. `support` sees platform/tenant **health** read-only via the MSP console; mutations happen only through **audited impersonation** (Admin plugin) acting as a tenant user, never with standalone write rights.
2. `manager` may invite/disable staff **only within their company/location scope** (layers 3–4).
3. `cashier` write within POS = sell/open-shift; **refund/void are approval-gated** (layer 7 / §22). Charter: cashiers only access POS unless explicitly granted (§7).
4. `cashier` CRM write = customer lookup / quick-create at checkout only.
5. `manager` holds **approve** authority for `procurement.approve_po` and `bond.approve_release` (threshold-based, §22) but not day-to-day procurement/bond data entry.
6. `warehouse` ecommerce write = fulfillment/fulfillment-location actions only.
7. `cashier` reports = own shift / X-Z reports only (§19).

**Separation-of-duties invariants (§7):** *"Finance users must not automatically have warehouse permissions. Warehouse users must not automatically have financial permissions. Cashiers must only access POS-related features unless explicitly granted more."* These are enforced as default role grants above and verified by tests (§35).

> Roles are **data**, tenant-customizable. The table is the **seeded default**; tenants may clone/edit roles. `platform_admin` is fixed and platform-scoped.

---

## 6. Permission matrix — example permissions (§7)

Verb-level grants for the §7 example permissions. **✔** granted by default, **A** = granted but **approval-gated** (§22), **blank** = not granted. (`platform_admin`/`tenant_admin` hold all and are omitted for density.)

| Permission (§7) | manager | cashier | accountant | warehouse | procurement | support |
|---|---|---|---|---|---|---|
| `products.view` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `products.create` | ✔ | | | | ✔ | |
| `products.edit` | ✔ | | | | ✔ | |
| `products.archive` | ✔ | | | | | |
| `inventory.view` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `inventory.adjust` | ✔ | | | ✔ | | |
| `inventory.transfer` | ✔ | | | ✔ | ✔ | |
| `inventory.receive` | ✔ | | | ✔ | ✔ | |
| `inventory.approve_adjustment` | ✔ | | | | | |
| `pos.open_shift` | ✔ | ✔ | | | | |
| `pos.create_sale` | ✔ | ✔ | | | | |
| `pos.refund` | A | A | | | | |
| `pos.void_sale` | A | A | | | | |
| `accounting.view` | ✔ | | ✔ | | ✔ | ✔ |
| `accounting.create_journal` | | | ✔ | | | |
| `accounting.approve_journal` | | | A | | | |
| `banking.view` | ✔ | | ✔ | | | ✔ |
| `banking.reconcile` | | | ✔ | | | |
| `crm.view` | ✔ | ✔ | ✔ | | ✔ | ✔ |
| `crm.create_lead` | ✔ | ✔ | | | ✔ | |
| `crm.manage` | ✔ | | | | ✔ | |
| `procurement.create_po` | | | | | ✔ | |
| `procurement.approve_po` | A | | | | A | |
| `warehouse.receive` | ✔ | | | ✔ | ✔ | |
| `warehouse.pick` | ✔ | | | ✔ | | |
| `warehouse.pack` | ✔ | | | ✔ | | |
| `warehouse.dispatch` | ✔ | | | ✔ | | |
| `bond.release` | | | | ✔ | ✔ | |
| `bond.approve_release` | A | | | | | |
| `ecommerce.manage_products` | ✔ | | | | ✔ | |
| `ecommerce.manage_orders` | ✔ | | | ✔ | ✔ | |
| `reports.view` | ✔ | ✔⁷ | ✔ | ✔ | ✔ | ✔ |
| `audit.view` | ✔ | | ✔ | | | ✔ |
| `audit.export` | | | A | | | |
| `settings.manage` | | | | | | |
| `users.invite` | ✔² | | | | | |
| `users.disable` | ✔² | | | | | |
| `platform.manage_tenants` | | | | | | |

`A` (approve-gated) permissions still require the verb grant **plus** a passing approval workflow (layer 7) to commit. Destructive POS actions (`refund`, `void_sale`) always require confirmation/undo (§5 UI guardrails) and audit (§25).

---

## 7. Worked example — a POS refund (offline-capable)

1. **Session/org** valid; active org = tenant T (BA).
2. **Tenant guard** sets `app.tenant_id = T`; **RLS** scopes all rows (defense in depth — see `tenancy-deployment.md`).
3. **Membership** confirmed (BA).
4. Role = `cashier`; **2FA** not required for cashier, but the refund **amount threshold** may demand a manager approver who *is* 2FA-bound (§6/§22).
5. `pos.refund` permission present (✔ for cashier) — but marked **A**.
6. Company/location access OK (cashier bound to location L).
7. **Feature flag** `accounting_enabled` (refund posts to clearing) checked (§10).
8. **Subscription/license** valid (not suspended/grace-expired) (§10/§37).
9. **Device** authorized POS terminal (§16); offline → uses **device-token grace** (§13).
10. **Approval (layer 7):** over threshold → manager PIN/badge override (§19 fast-switch) → audited approval.
11. **Audit (§25):** records cashier as actor, manager as approver, request/correlation/idempotency keys.
12. Offline → queues to `offline_refund_queue` with idempotency key; re-validated server-side on sync (§14); never silently discarded.

---

## Known limitations / intentionally deferred

- **Passkeys, SSO, OIDC/OAuth Provider** — designed-for but **deferred** to Phase 11+/13; only TOTP 2FA + password (+HIBP) are Phase-1.
- **Billing/subscription plugins** — Better Auth billing integration is **evaluate-only**; RetailOS billing & license enforcement are domain logic abstracted from auth (§10/§37), scaffolded `--payments none` (§4).
- **SCIM group → role mapping** — SCIM provisions coarse org membership in Phase 1; automatic IdP-group→RetailOS-role mapping is deferred (manual role assignment until then).
- **Fast-cashier-switch hardware** (PIN/badge/biometric, §19) is **POS-phase (Phase 4)**; biometric template handling (non-reversible only, never synced raw, §25) is designed here but not built in Phase 1.
- **Offline approval workflows** — approval-gated actions performed fully offline rely on cached approver entitlements + grace; complex multi-step approvals may queue as `PENDING` until reconnect rather than completing offline.
- **Tenant-custom role editing UI** — roles are data and customizable, but the management UI/wizard is a later phase; Phase 1 seeds the default roles in §5.
- **OIDC Provider mode** (RetailOS as IdP for third parties) is reserved as a seam only; no schema or endpoints in Phase 1.
- **Cross-deployment license grace** is designed (§37) but offline license certificate verification logic lands with the licensing phase (Phase 11).
