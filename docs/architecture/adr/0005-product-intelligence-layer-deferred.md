# ADR 0005 — Product Intelligence Layer (deferred backlog; must be disableable)

- **Status:** Accepted (deferred — backlog only; no implementation in Phase 0/1)
- **Date:** 2026-06-21
- **Charter refs:** §9, §10, §18, §26, §27, §37, §39

## Context

The charter already reserves several intelligence-adjacent seams: OCR/LLM document parsing for procurement behind a provider interface (§18), correlated insights on dashboards (§27), and a tenant-health/observability layer (§26). Beyond those, there is appetite for a broader **Product Intelligence Layer** — cross-module AI/ML capabilities such as demand forecasting, reorder-point suggestions, anomaly/fraud detection (unusual void/refund patterns), customer segmentation/CLV prediction, and natural-language reporting.

This is attractive commercially but carries real risk if treated as core: it tends to assume always-on managed AI services, hosted inference endpoints, and data egress — none of which are acceptable for the self-hosted, dedicated, managed-private, and data-sovereign deployment tiers (§9), and all of which conflict with the offline-first principle (§3) and residency attestation (§9). It must never become a hard dependency that breaks a tenant who cannot or will not send data to an external model.

## Decision

Record the **Product Intelligence Layer as a deferred backlog item**, not Phase-0/1 scope, with these binding constraints for whenever it is built:

1. **Feature-flag gated and fully disableable.** Gated behind a `product_intelligence_enabled` (and per-capability sub-flags) entitlement/feature flag (§10). With it off, the entire product operates with zero functional regression — it is strictly additive. Private and self-hosted deployments can disable it completely.
2. **Provider-interface, self-hostable, no managed-only dependency.** Any model/inference provider sits behind an interface (consistent with the fiscalization/tax/payment/OCR seam pattern, §18/ADR-0003), so a tenant can point it at a self-hosted/in-region model or turn it off entirely. No capability may assume a specific managed cloud AI service.
3. **Reads from analytics/read models, never OLTP checkout tables** (§27). Built on domain-event-fed projections / read replicas; it must not add load to the POS/inventory write path or violate the POS latency budgets (§44).
4. **Tenant-scoped, residency-aware, audited, human-in-the-loop for anything that posts.** Honors tenant scope + RLS at the read layer (§27); respects data-residency attestation and never silently egresses tenant data (§9); suggestions that drive a financial/inventory mutation require human review before posting (mirrors the OCR rule, §18); AI-extracted-vs-corrected values are audited (§25).

No code, schema, or dependency is added now. This ADR exists so the seam is reserved with the right constraints and the idea is not later bolted on as a non-optional, cloud-coupled core feature (§39 forbids that drift).

## Consequences

- **Positive:** preserves a high-value commercial differentiator (§37) without compromising the deployment-agnostic, offline-first, data-sovereign guarantees; keeps Phase-0/1 lean; reuses the established provider-seam + read-model patterns rather than inventing new coupling.
- **Negative / trade-offs:** explicitly punts concrete design; risks scope creep if the disableable/seam constraints are not enforced when it is eventually picked up — this ADR is the guardrail.
- **Follow-ups:** when scheduled (post-core phases), produce a module spec (§42) + competitive analysis (§41) first; add the feature flag(s) to the §10 flag set; design the read-model projections it consumes.

## Alternatives considered

- **Build it into core now / as an always-on feature:** rejected — premature, and an always-on AI dependency breaks self-hosted/sovereign/offline tiers (§3/§9) and the §44 latency budgets.
- **Mandatory managed AI provider:** rejected — violates §9 data sovereignty and the no-managed-only-dependency rule (cf. ADR-0003 webhook dispatcher).
- **Drop the idea entirely:** rejected — it is a real commercial differentiator (§37); reserving a constrained seam costs nothing and prevents bad coupling later.
