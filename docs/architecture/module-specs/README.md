# Module Specifications

Per charter §42, **no module implementation begins until its spec is documented here** (entry criteria); the §35 Definition of Done is the exit criteria. One file per module (`<module>.md`), using the template below. Update the spec whenever the module changes (§34).

---

## Module spec template

```markdown
# <Module> — Specification

- Status: Draft | Approved | In progress | Done
- Charter refs: §N…
- Competitive analysis: docs/architecture/competitive/<module>.md (required before build, §41)

## Vision
Why this module exists; the business outcome.

## Personas
Who uses it (cashier, manager, accountant, warehouse, admin, MSP…).

## User stories
- As a <persona>, I want <goal>, so that <benefit>.

## Business rules
Domain rules, invariants (e.g. ledger must balance; numbering is gapless).

## Permissions / entitlements
Required permissions (§7), feature flags (§10), approval workflows (§22).

## Data model
Tables/entities touched; tenant scoping; audit fields; RLS notes (§8/§29).

## Offline behavior
Cache/queue/conflict policy on each form factor (§13/§14); device-grace.

## Money / fiscal
Minor-units handling, tax, document numbering, fiscal seam (§17/§19).

## Reporting
Reports/insights produced; read-model/analytics needs (§27).

## Integrations
External systems, webhooks, idempotency (§23); import/migration from competitors (§41/§42).

## Edge cases & error states
Failure modes; structured error codes (§25).

## Observability
Metrics/logs/alerts (§26).

## Acceptance criteria / Definition of Done (§35)
- Types pass · Tests pass · Tenant scoping verified (+ RLS-bypass check) · Audit works ·
  Errors friendly+structured · Logs structured · Permissions/entitlements enforced ·
  Money = minor units · Docs updated · Rollback plan.

## Rollback plan
How to safely revert; migration expand/contract notes (§8).
```
