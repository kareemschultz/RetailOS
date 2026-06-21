# ADR 0001 — Base UI as the headless primitive (`base-lyra`)

- **Status:** Accepted
- **Date:** 2026-06-21
- **Charter refs:** §4, §5

## Context

shadcn/ui can sit on either Radix UI or Base UI primitives. The charter (§5) mandates **Base UI** project-wide (consistent component API, ARIA/focus/keyboard, first-class enter/exit transition hooks, RTL, active roadmap) and forbids mixing Radix and Base UI variants of the same component.

## Decision

Use **Base UI** as the headless primitive layer. **Verified:** `packages/ui` depends on `@base-ui/react` and the installed components (`button`, `input`, `dropdown-menu`, `checkbox`) import from `@base-ui` — the configured shadcn style **`base-lyra`** is the **Base UI family** (`base-*`), not Radix (`radix-*`). No conflict with §5; no migration needed.

## Consequences

- Positive: single primitive API; motion via Base UI `data-[starting-style]`/`data-[ending-style]` + `render` prop (§5 motion strategy); RTL-ready (§11 white-label, i18n §12).
- Negative: some community blocks ship Radix variants — they must be re-sourced/re-themed to Base UI before use (§5 sourcing rule). The shadcn studio `base-*` styles match; ReUI is pinned to its `base-nova` Base-UI style.
- Follow-up: enforce in review — reject Radix-variant imports of components that have a Base UI equivalent.

## Alternatives considered

- Radix UI — mature, but the charter selected Base UI for transitions/RTL/API consistency; switching now would contradict §5 and the installed `base-lyra` style.
