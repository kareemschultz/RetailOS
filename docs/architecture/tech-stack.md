# RetailOS — Tech-Stack Versions & Compatibility Reference

> Authoritative, **live-verified** version + cross-compatibility reference per charter §40 (documentation fidelity).
> "Installed (repo)" = the version pinned in the repo's `package.json` files and resolved in `bun.lock` as of the verified date.
> "Latest stable" = the npm `latest` dist-tag (or official release) confirmed against the source cited inline.
> Money/correctness rules live in the charter; this file is purely about toolchain versions and their interop.

**Verification method:** `npm view <pkg> version`, `npm view <pkg> peerDependencies`, `bun.lock` resolution, and official docs/release pages. Versions stated below were confirmed; anything unverifiable is explicitly marked.

---

## 1. Version table

Legend: ✅ up-to-date (pinned == latest, or latest within the pinned `^`/`~` range) · ⚠️ behind (newer stable exists, no known breakage) · ❗ risk (mismatch / unpinned / needs attention).

| Component | Installed (repo) | Latest stable (verified) | Up-to-date? | Compatibility notes |
|---|---|---|---|---|
| **Runtime / build** | | | | |
| Bun | `bun@1.3.12` (packageManager) | `1.3.14` (npm `bun`) | ⚠️ minor behind | Patch/minor only; no breaking interop. |
| Turborepo | `^2.9.16` | `2.9.18` (npm) | ✅ within range | Stable v2 line. |
| TypeScript | catalog `^6` → resolves `6.0.3` | `6.0.3` (npm `latest`) | ✅ | **TS 6.0 IS stable** (npm `latest`=6.0.3; transition release to TS 7, API-compatible with 5.9). New defaults: `strict`, `module:esnext`, `moduleResolution:bundler`, `target:es2025`. Supported by typescript-eslint range `>=4.8.4 <6.1.0`. ([devblogs.microsoft.com/typescript/announcing-typescript-6-0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), [typescript-eslint.io/users/dependency-versions](https://typescript-eslint.io/users/dependency-versions/)) |
| Vite | `^8.0.8` → resolves `8.0.16` | `8.0.16` (npm) | ✅ | `engines: node ^20.19 \|\| >=22.12`. Satisfies TanStack Start peer `vite >=7`. |
| Biome | `@biomejs/biome@2.4.16` (root, pinned); `2.5.0` also resolved | `2.5.0` (npm) | ⚠️ pinned behind | Two Biome versions in lock (2.4.16 via root, 2.5.0 transitive via ultracite). Harmless but pin one. |
| Ultracite | `7.8.3` (pinned exact) | `7.8.3` (npm) | ✅ | Wraps Biome 2.x; no conflict. |
| **Frontend (web)** | | | | |
| React | `^19.2.6` → `19.2.7` | `19.2.7` (npm) | ✅ within range | React 19. All TanStack libs accept `>=19`/`^19`. |
| react-dom | `^19.2.6` → `19.2.7` | `19.2.7` (npm) | ✅ | Must track React exactly (does). |
| TanStack Start | `^1.167.41` → lock `1.168.25` | `1.168.26` (npm) | ✅ within range | peer: `react >=18\|\|>=19`, `vite >=7`. ✓ |
| TanStack Router | `^1.168.22` → lock `1.170.15` | `1.170.16` (npm) | ✅ within range | peer: `react >=18\|\|>=19`. ✓ |
| TanStack Query | `^5.99.0` → lock `5.101.0` | `5.101.0` (npm) | ✅ | peer: `react ^18\|\|^19`. ✓ Also satisfies oRPC's `@tanstack/query-core >=5.80.2`. |
| TanStack Form | catalog `^1.28.0` → `1.33.0` | `1.33.0` (npm) | ✅ within range | peer: `react ^17\|\|^18\|\|^19`. ✓ |
| TanStack Table | not directly installed (planned per charter) | `8.21.3` (npm) | — | Not yet a dependency; ReUI/shadcn DataTable pull it when added. peer `react ^16.8–^19`. |
| Tailwind CSS | web `^4.2.2` → lock `4.3.0`/`4.3.1`; ui `^4.1.18` | `4.3.1` (npm) | ✅ within range | Tailwind v4 CSS-first / `@theme` token model — the white-label token contract (charter §5/§11). |
| `@tailwindcss/vite` | `^4.2.2` | tracks tailwind v4 | ✅ | v4 Vite plugin (no PostCSS needed in web). |
| Base UI | `@base-ui/react ^1.0.0` → lock **`1.6.0`** | `@base-ui/react@1.6.0` (npm) | ✅ | **Package renamed:** Base UI graduated from `@base-ui-components/react` (still at `1.0.0-rc.0`) to **`@base-ui/react`** with renumbered stable `1.x`. Repo correctly uses the new package. peer: `react/react-dom ^17\|\|^18\|\|^19`, optional `date-fns ^4`/`@date-fns/tz`. ([base-ui.com](https://base-ui.com)) |
| shadcn CLI | `shadcn@^3.6.2` → lock `3.8.5` | `4.11.0` (npm) | ⚠️ major behind | Repo on shadcn **3.8.5**; npm `latest` is **4.x**. v3 is fully functional with Tailwind v4 + Base UI; v4 is a CLI/registry evolution. Not auto-bumped by `^3`. Evaluate v4 before upgrading (registry config in `components.json` is the load-bearing part — see lessons-learned). |
| next-themes | catalog `^0.4.6` | `0.4.6` (npm) | ✅ | Theme switching; framework-agnostic. |
| Zustand | not currently a dependency (charter-planned) | `5.0.14` (npm) | — | Listed in charter §4 stack; not yet installed. v5 supports React 19. |
| lucide-react | web `^1.8.0`; ui `^0.546.0` | (two majors in repo) | ❗ inconsistent | **web has `^1.8.0`, packages/ui has `^0.546.0`** — different major lines of the same icon lib. Align to one. |
| sonner | `^2.0.7` (web) / `^2.0.5` (ui) | v2 line | ✅ | Toaster. |
| **Backend** | | | | |
| Hono | catalog `^4.8.2` → lock `4.12.26` | `4.12.26` (npm) | ✅ within range | v4. oRPC mounts as a Hono handler. |
| oRPC | catalog `@orpc/* ^1.13.14` → lock `1.14.6` | `1.14.6` (npm) | ✅ within range | `@orpc/server` peer: `ws >=8.18.1`, `crossws >=0.3.4`. `@orpc/tanstack-query` peer: `@orpc/client ==1.14.6` (exact) + `@tanstack/query-core >=5.80.2`. ✓ |
| Better Auth | catalog `better-auth@1.6.11` (pinned exact) | `1.6.20` (npm) | ⚠️ behind | peer (1.6.20): `react ^18\|\|^19`, `drizzle-orm ^0.45.2`, `drizzle-kit >=0.31.4`, `pg ^8`, `@tanstack/react-start ^1.0.0`, `vitest ^2\|\|^3\|\|^4`. All satisfied by repo. |
| `@better-auth/expo` | catalog `1.6.11` (pinned exact) | `1.6.20` (npm) | ⚠️ behind | **MUST equal core better-auth version.** Currently 1.6.11 == 1.6.11 ✓. Keep locked together on any bump. |
| Drizzle ORM | `drizzle-orm@^0.45.1` → lock `0.45.2` | `0.45.2` (npm) | ✅ within range | Postgres dialect. Satisfies Better Auth peer `^0.45.2`. |
| drizzle-kit | `^0.31.8` → lock `0.31.10` | `0.31.10` (npm) | ✅ within range | Satisfies Better Auth peer `>=0.31.4`. |
| pg (node-postgres) | `^8.17.1` | `8.22.0` (npm) | ✅ within range | Satisfies Better Auth peer `pg ^8`. |
| PostgreSQL (server) | docker `image: postgres` (**unpinned → `:latest`**) | PG 18 line current | ❗ unpinned | RLS (charter §8/§29) supported on all modern PG (≥9.5). **Pin a major** (e.g. `postgres:17-alpine`) for reproducibility/DR — an unpinned `:latest` violates the deterministic-build intent. |
| Redis client | **none installed** (docker has `redis:7-alpine`) | `ioredis 5.11.1` / `redis 6.0.0` (npm) | — (deferred) | Charter §47 lists Redis as foundation infra; the server has **no Redis client dependency yet**. Intentionally deferred until Phase 1+ needs it. Pick `ioredis` or `redis` then. |
| Zod | catalog `^4.1.13` → lock `4.4.3` | `4.4.3` (npm) | ✅ within range | Zod v4. oRPC uses `@orpc/zod`; Better Auth & `@t3-oss/env-core` consume Zod schemas. |
| **Native (Expo)** | | | | |
| Expo SDK | `expo@~56.0.3` → lock `56.0.12` | `56.0.12` (npm) | ✅ within range | SDK 56. peer deps are wildcard `*` (Expo manages alignment via the SDK). |
| React Native | `react-native@0.85.3` (pinned exact) | `0.86.0` (npm) | ⚠️ behind | RN **0.86 peer requires `react ^19.2.3` + `@types/react ^19.1.1`**. Repo native pins `react 19.2.3` exactly — matches RN 0.85's needs; verify the React pin if bumping RN to 0.86. |
| React (native) | `19.2.3` (pinned exact) | 19.2.x | ✅ (intentional pin) | **Native deliberately pins a different React (`19.2.3`) than web (`^19.2.6`)** — Expo/RN require an exact React. This is expected, not a bug; keep them independently managed. |
| Expo Router | `~56.2.5` → lock `56.2.11` | `56.2.11` (npm) | ✅ within range | Tracks Expo SDK 56. |
| uniwind | `^1.7.0` → `1.9.0` | `1.9.0` (npm) | ✅ within range | The charter's `native-uniwind` styling layer. peer: `react >=19`, `react-native >=0.81`, `tailwindcss >=4`, metro. ✓ This is the Tailwind-v4 bridge for RN. |
| NativeWind | not installed (uniwind used instead) | `4.2.5` (npm) | — | Charter mentions "native-uniwind / NativeWind"; repo uses **uniwind**, not NativeWind. Don't add both. |
| HeroUI Native | `^1.0.3` → `1.0.4` | `1.0.4` (npm) | ✅ within range | peer requires: `react >=19`, `react-native >=0.81`, `react-native-reanimated ^4.1.1`, `react-native-worklets >=0.5.1`, `react-native-gesture-handler ^2.28`, `react-native-screens >=4`, `react-native-svg ^15.12.1`, `react-native-safe-area-context ^5.6`, `tailwind-merge ^3.4`, `tailwind-variants ^3.2.2`, `@gorhom/bottom-sheet ^5.2.9`. **All satisfied** by the repo's native deps (reanimated 4.3.1, worklets 0.8.3, gesture-handler 2.31.1, screens 4.25.2, svg 15.15.4, safe-area 5.7, bottom-sheet 5.2.14). ✓ |
| **Desktop (Tauri)** | | | | |
| Tauri CLI | `@tauri-apps/cli@^2.11.2` → `2.11.3` | `2.11.3` (npm) | ✅ within range | Tauri v2. Updater is part of Tauri v2 plugin ecosystem (`@tauri-apps/plugin-updater`) — **not yet added**; charter §28 OTA-update requirement is deferred. |
| **Testing** | | | | |
| Vitest | `^4.1.9` | `4.1.9` (npm) | ✅ | Vitest 4. peer: `vite ^6\|\|^7\|\|^8` (repo Vite 8 ✓), `happy-dom *`, `jsdom *`. |
| happy-dom | `^20.10.6` | `20.10.6` (npm) | ✅ | DOM env for Vitest; React-19 compatible. |
| jsdom (web devDep) | `^29.0.2` | (v29 line) | ✅ | Also present alongside happy-dom; either works with Vitest 4. |
| @playwright/test | `^1.61.0` | `1.61.0` (npm) | ✅ | E2E + VRT + offline simulation (charter §4). |

---

## 2. Compatibility matrix / verified cross-dep constraints

Each line is a constraint **verified** against the cited source (peer-dep output from `npm view … peerDependencies`, lockfile resolution, or official docs).

1. **React 19 ↔ TanStack (Start/Router/Query/Form):** all accept React 19 — Start `react >=18 || >=19`; Router `react >=18 || >=19`; Query `react ^18 || ^19`; Form `react ^17 || ^18 || ^19`. Repo React `19.2.7` (web) satisfies all. *(source: `npm view @tanstack/* peerDependencies`.)*
2. **TanStack Start ↔ Vite:** Start peer `vite >=7.0.0`; repo Vite `8.0.16` ✓. Vite 8 `engines: node ^20.19 || >=22.12`. *(source: `npm view @tanstack/react-start@1.168.26 peerDependencies`, `npm view vite@8.0.16 engines`.)*
3. **oRPC ↔ TanStack Query:** `@orpc/tanstack-query` peer `@tanstack/query-core >=5.80.2` and `@orpc/client ==1.14.6` (exact). Repo Query `5.101.0` ✓; all `@orpc/*` resolve to the same `1.14.6` ✓. *(source: `npm view @orpc/tanstack-query@1.14.6 peerDependencies`.)*
4. **oRPC ↔ Hono:** oRPC mounts as a Hono request handler; `@orpc/server` peer only requires `ws >=8.18.1` / `crossws >=0.3.4` (for WS transport). Hono `4.12.26` is independent and compatible. *(source: `npm view @orpc/server@1.14.6 peerDependencies`.)*
5. **Better Auth ↔ @better-auth/expo:** the two **must be the same version**; both pinned `1.6.11` ✓. *(source: Better Auth docs + repo catalog pins.)*
6. **Better Auth ↔ Drizzle / pg / TanStack Start:** Better Auth 1.6.20 peer requires `drizzle-orm ^0.45.2` (repo `0.45.2` ✓), `drizzle-kit >=0.31.4` (repo `0.31.10` ✓), `pg ^8` (repo `8.x` ✓), `@tanstack/react-start ^1.0.0` (repo `1.168.x` ✓), `react ^18 || ^19` ✓. *(source: `npm view better-auth@1.6.20 peerDependencies`.)*
7. **Better Auth plugins required by charter §6 exist in 1.6.x:** organization, admin, two-factor (TOTP/OTP/backup codes), SCIM, and device-authorization (OAuth 2.0 Device Grant, RFC 8628) are all documented current plugins. *(source: [better-auth.com/docs/plugins](https://better-auth.com/docs/plugins), [/docs/plugins/scim](https://better-auth.com/docs/plugins/scim), [/docs/plugins/2fa](https://better-auth.com/docs/plugins/2fa), [/docs/plugins/organization](https://better-auth.com/docs/plugins/organization).)*
8. **Drizzle ORM ↔ drizzle-kit ↔ PostgreSQL:** ORM `0.45.2` + kit `0.31.10`, postgresql dialect. PostgreSQL RLS (charter §8/§29) is a core PG feature on every supported major (≥9.5); no Drizzle-side blocker. *(source: lockfile + `drizzle.config.ts dialect:"postgresql"`.)*
9. **Tailwind v4 ↔ Base UI ↔ shadcn:** Base UI is headless/unstyled (peer only React) and styles via Tailwind classes; Tailwind v4 CSS-first `@theme` tokens drive shadcn components. shadcn 3.8.5 supports Tailwind v4 + Base UI primitive. No version conflict; the load-bearing surface is `components.json` registry config (see lessons-learned 1–12), not the package version. *(source: `npm view @base-ui/react peerDependencies`, Tailwind v4 / shadcn docs.)*
10. **Tailwind v4 ↔ Biome/Ultracite:** Biome formats/lints TS/JS/CSS; Tailwind v4's CSS-first syntax (`@theme`, `@utility`) is plain CSS Biome can format. No coupling/conflict. *(source: tool design; Biome 2.x CSS support.)*
11. **Expo SDK 56 ↔ React Native ↔ React:** RN `0.85.3` (repo) aligns with Expo SDK 56's managed versions; React pinned `19.2.3` for native. RN **0.86** peer would require `react ^19.2.3` + `@types/react ^19.1.1`. *(source: `npm view react-native@0.86.0 peerDependencies`, repo native package.json.)*
12. **uniwind ↔ RN ↔ Tailwind v4:** uniwind `1.9.0` peer `react >=19`, `react-native >=0.81`, `tailwindcss >=4` — repo satisfies all. uniwind is the RN Tailwind-v4 bridge (replaces NativeWind here). *(source: `npm view uniwind@1.9.0 peerDependencies`.)*
13. **HeroUI Native ↔ RN ecosystem:** every HeroUI Native peer (reanimated ^4.1.1, worklets >=0.5.1, gesture-handler ^2.28, screens >=4, svg ^15.12.1, safe-area ^5.6, bottom-sheet ^5.2.9, tailwind-merge ^3.4, tailwind-variants ^3.2.2) is satisfied by the repo's native deps. *(source: `npm view heroui-native@1.0.4 peerDependencies` vs `apps/native/package.json`.)*
14. **Vitest 4 ↔ happy-dom ↔ React 19:** Vitest 4 peer `vite ^6||^7||^8` (repo Vite 8 ✓), `happy-dom *` (repo `20.10.6` ✓); `@testing-library/react ^16` (repo) supports React 19. *(source: `npm view vitest@4.1.9 peerDependencies`.)*
15. **TypeScript 6 ↔ toolchain:** TS `6.0.3` is the stable `latest`; API-compatible with 5.9, within typescript-eslint's `<6.1.0` support window; bundlers (Vite 8) do file emit. Repo `^6` resolves to `6.0.3`. *(source: [announcing-typescript-6-0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), [typescript-eslint dependency-versions](https://typescript-eslint.io/users/dependency-versions/).)*

---

## 3. Recommended actions

**Must-resolve (correctness / reproducibility):** — ✅ **DONE 2026-06-21**
- ✅ **Pinned the PostgreSQL image** — `docker-compose.yml` uses `postgres:18-alpine` (prod reuses central `postgres:18-alpine`).
- ✅ **Resolved the `lucide-react` major split** — all three packages (`apps/web`, `apps/fumadocs`, `packages/ui`) now reference catalog `lucide-react: ^1.21.0`; lockfile deduped to a single `1.21.0`. Gates re-run green after the bump (incl. a forced fresh `packages/ui` type-check against the new major).

**Should-do (stay current, low risk):** — ✅ **DONE 2026-06-21**
- ✅ Bumped **Better Auth** `1.6.11 → 1.6.20` **and** `@better-auth/expo` to `1.6.20` (kept equal). All peers satisfied; gates green.
- ✅ Collapsed the **two Biome versions** — root pin moved `2.4.16 → 2.5.0`; lockfile resolves a single `@biomejs/biome@2.5.0`.
- ⏳ (Optional, deferred) Refresh catalog floors to latest patch: Bun → `1.3.14`, etc. — cosmetic; not blocking.

**Decide before it bites later (no action required now):**
- **shadcn CLI v3 → v4:** repo is on `3.8.5`; npm `latest` is `4.x`. v3 works with Tailwind v4 + Base UI, so no urgency, but plan a deliberate evaluation (the registry config in `components.json` is the migration-sensitive part — see lessons-learned 1–12 before touching it).
- **React Native 0.85 → 0.86:** only when ready to validate the native React pin (`19.2.3`) against RN 0.86's `react ^19.2.3` peer, ideally driven by the next Expo SDK.

---

## 4. Known limitations / intentionally deferred

- **No Redis client library installed.** Docker provides `redis:7-alpine`, and the charter (§4/§47) lists Redis as foundation infra, but the server has no `ioredis`/`redis` dependency yet. **Deferred** until a Phase-1+ feature (rate limiting, queues, sync coordination) needs it; pick `ioredis` (mature, cluster-friendly) or `redis` v6 at that point.
- **TanStack Table not yet a dependency.** Charter §4/§5 plans it (DataTable/virtualized admin grids), pulled in transitively when ReUI / shadcn DataTable blocks are added. Latest is `8.21.3`.
- **Zustand not yet installed.** Charter §4 client-state choice; add `5.0.14` (React-19-ready) when client state needs it.
- **NativeWind not used** — the native app uses **uniwind** (charter's `native-uniwind`). Do not add NativeWind alongside it.
- **Tauri updater plugin not added.** Charter §28 OTA auto-update is a planned seam, not yet wired (`@tauri-apps/plugin-updater`).
- **`@base-ui-components/react` vs `@base-ui/react`:** the repo correctly uses the **renamed** `@base-ui/react` (stable `1.6.0`). The legacy `@base-ui-components/react` is frozen at `1.0.0-rc.0`; do not reintroduce it.
- **PostgreSQL version not pinned** (see §3) — flagged as a must-fix, listed here for completeness.
- **Native React intentionally diverges from web React** (`19.2.3` native vs `^19.2.6` web). Expected: Expo/RN require an exact React build; manage the two independently.

---

*Verified: 2026-06-21 against official sources (npm registry `version`/`peerDependencies`, `bun.lock` resolution, and the official docs cited inline). Versions stated were confirmed; items that could not be verified are explicitly marked. Re-verify before any major bump and append a `lessons-learned.md` entry if reality contradicts this file (charter §40).*
