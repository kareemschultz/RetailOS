# RetailOS

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Hono, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Tauri** - Build native desktop applications
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Use the Expo Go app to run the mobile application.
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@RetailOS/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

---

## UI Component Registries

All registries are configured in **both** the root `components.json` (the shadcn **MCP** reads the root)
and `packages/ui/components.json` (CLI installs use `-c packages/ui`, which targets the shared package).
shadcn references registry items as `@namespace/name` — **there is no `--registry` flag**. The shadcn CLI
fully supports this Vite/TanStack monorepo (`shadcn info -c apps/web` reports framework `TanStack Start`).

Full enumerated catalogs live in [`docs/architecture/ui-inventory/`](docs/architecture/ui-inventory/).

| Registry | Namespace(s) | Tier | Auth | Verified |
|---|---|---|---|---|
| shadcn/ui core | `@shadcn` | Free | none | built-in |
| Magic UI | `@magicui` | Free | none | ✅ 245 items |
| Magic UI Pro | `@magicui-pro` | Pro | Bearer header `${MAGICUI_PRO_REGISTRY_TOKEN}` | ✅ 103 items |
| shadcn studio | `@shadcn-studio` (free), `@ss-components`, `@ss-blocks`, `@ss-themes` | Free + Pro | query `params` `${EMAIL}` + `${LICENSE_KEY}` | ✅ config per official docs |
| ReUI | `@reui` | Free (MIT) | none | ✅ resolves (pinned to ReUI `base-nova` style) |

### Credentials (first-time setup)

Copy `.env.example` to `.env` and fill from Infisical (never commit values; `.env` is gitignored):

- `MAGICUI_PRO_REGISTRY_TOKEN` — Infisical `/credentials/magicui/MAGICUI_PRO_TOKEN`
- `EMAIL` + `LICENSE_KEY` — Infisical `/credentials/shadcnstudio/` (`SHADCN_STUDIO_EMAIL` / `SHADCN_STUDIO_LICENSE_KEY`)

### Installing components

```bash
# Free Magic UI (no token)
npx shadcn@latest add @magicui/marquee -c packages/ui
# Magic UI Pro (token in env)
npx shadcn@latest add @magicui-pro/header-1 -c packages/ui
# ReUI (data-dense: Data Grid, Filters, Kanban, virtualized tables)
npx shadcn@latest add @reui/data-grid -c packages/ui
# shadcn studio Pro (EMAIL + LICENSE_KEY in env)
npx shadcn@latest add @ss-blocks/<block-name> -c packages/ui
```

### shadcn studio — use the MCP to discover/install

The studio registries are configured correctly, but shadcn studio does **not** publish a searchable
registry index (`registry.json` 404s), so `shadcn search @ss-blocks` won't list items. Discover and install
studio blocks through the **studio MCP** (registered globally in `~/.claude.json`), which emits the correct
`npx shadcn add` commands:

| Command | What it does |
|---------|-------------|
| `/cui <description>` | Customize / reuse an existing block with your content |
| `/iui <description>` | Generate new inspired UI from scratch (Pro only) |
| `/rui <description>` | Refine / edit an already-installed block |
| `/ftc <description>` | Convert a Figma frame to code (requires Figma MCP) |

Workflow rules: collect ALL blocks before installing; one block per chat (except full pages via `/cui`);
use `/rui` only for post-install refinements.

### Origin UI — not configured (legacy)

Origin UI was evaluated but **not added**: its official repo states it is now a *"pre-acquisition collection…
with limited support and maintenance"* (active development moved to the `Particles`/coss-ui line), and
`originui.com` is bot-protected from this environment so its registry endpoint could not be live-verified.
**ReUI is the configured free source for data-dense operational UI.** Revisit Origin UI / Particles only
after confirming a working registry namespace + URL from official docs.

> **Magic UI Pro is Next.js + Framer Motion** — individual components port to Vite/TanStack fine, but Pro
> *page templates* need adapting. Per design-system rules, keep Magic UI off the POS checkout and
> high-frequency data-entry paths; use it on storefront / marketing / onboarding / auth surfaces.
> **Gotcha:** some Magic UI Pro components import `@radix-ui/react-icons` (e.g. `StarFilledIcon`) — replace with
> lucide's `Star` (`fill="currentColor"`) rather than installing `@radix-ui/react-icons` unless it's already a dependency.

## Deployment

### Docker Compose

- Target: web
- Config: `docker-compose.yml` (app Dockerfiles live in `apps/*/Dockerfile`)
- Build images: bun run docker:build
- Start: bun run docker:up
- Logs: bun run docker:logs
- Stop: bun run docker:down

Environment variables are read from each app's `.env` file (baked into web builds for public variables) and overridden in `docker-compose.yml` for container networking.

## Project Structure

```
RetailOS/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Start)
│   ├── native/      # Mobile application (React Native, Expo)
│   └── server/      # Backend API (Hono, ORPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run dev:native`: Start the React Native/Expo development server
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI
- `cd apps/web && bun run desktop:dev`: Start Tauri desktop app in development
- `cd apps/web && bun run desktop:build`: Build Tauri desktop app
- Note: Desktop builds package static web assets. TanStack Start needs a static/export build configuration before desktop packaging will work.
- `bun run docker:build`: Build the Docker Compose images
- `bun run docker:up`: Build and start the Docker Compose stack
- `bun run docker:logs`: Tail logs from the Docker Compose stack
- `bun run docker:down`: Stop the Docker Compose stack
