# Architecture Decision Records (ADRs)

Per charter §34: every architectural decision is recorded as an ADR; **no major architectural change may be made silently.** At the end of each phase, the reassessment loop (§45) may add or supersede ADRs.

- Use `0000-template.md` for new ADRs. Number sequentially (`NNNN-kebab-title.md`).
- Status: Proposed → Accepted → (Superseded by NNNN | Deprecated).
- Keep ADRs short: context, decision, consequences, alternatives.

## Index

| ADR | Title | Status |
|---|---|---|
| 0001 | Base UI as the headless primitive (`base-lyra`) | Accepted |
| 0002 | No product feature code before Phase-0 lock-in | Accepted |
| 0003 | Baseline stack & architectural seams | Accepted |
| 0004 | Central-infra reuse (VPS Postgres/Redis via Pangolin) vs self-contained compose | Accepted |
| 0005 | Product Intelligence Layer deferred (must be disableable for private/self-hosted) | Proposed |
