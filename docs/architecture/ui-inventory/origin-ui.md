# Origin UI — Evaluated, NOT Configured (legacy)

> **Status: not added to the RetailOS registries.** Decision date 2026-06-21. Revisit only if a working,
> actively-maintained registry endpoint is confirmed (see "If revisited" below).

## Why it's not configured

1. **It's legacy / maintenance-only.** Origin UI's own official repository (`origin-space/originui`) describes
   it as *"a pre-acquisition collection of Radix-based, shadcn-style components that remains available for use,
   but with limited support and maintenance,"* and states that **active development has moved to the new
   `Particles` components built on the coss-ui primitives.** Adopting a frozen library as a core free source
   is a maintenance risk for a long-lived product like RetailOS.
2. **Endpoint could not be live-verified here.** `originui.com` is bot-protected from this environment — plain
   fetches return `403 Forbidden` / Cloudflare HTML challenges, and CLI probes of the conventional registry
   pattern (`https://originui.com/r/{name}.json`) returned an HTML page, not registry JSON. Per
   `lessons-learned.md` #5 and #10, we do **not** ship a registry entry we cannot live-verify, and per #1 the
   URL must contain a valid `{name}` template that actually resolves.

## What we use instead

**ReUI (`@reui`)** is the configured, actively-maintained, MIT-licensed free source for data-dense
operational UI (Data Grid, Filters, Kanban, virtualized tables) — see [`reui.md`](reui.md). Combined with the
owned **shadcn core** primitives ([`shadcn-core.md`](shadcn-core.md)) and **shadcn studio Pro**
([`shadcn-studio.md`](shadcn-studio.md)), the operational-surface needs Origin UI would have covered are met.

## If revisited

Before adding Origin UI (or its successor **Particles** at `coss.com/ui/particles`):

1. Confirm the **exact registry namespace + URL** from the official docs (live, not assumed) — e.g. whether it
   is a namespaced `@originui` registry with a `{name}` template, or direct item-URL installs only.
2. Verify it resolves live: `npx shadcn@latest view <namespace-or-url> -c packages/ui` returns registry JSON
   (not an HTML challenge page).
3. Check the maintenance status and whether Particles supersedes it for new work.
4. Only then add the entry to **both** the root `components.json` and `packages/ui/components.json`, and record
   the verification in `lessons-learned.md`.

> No counts are listed here on purpose — per the honesty rule (charter §40), we do not publish a catalog for a
> source we could not enumerate.
