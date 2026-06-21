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

## Premium UI Libraries

### shadcn/studio Pro (631+ blocks)

Pro license held by KareTech Solutions. Credentials are in Infisical at `/credentials/shadcnstudio/`.

**Setup (first time):**

1. Copy `.env.example` to `.env` and fill in `EMAIL` and `LICENSE_KEY` from Infisical.
2. The MCP server is registered globally in `~/.claude.json` — no per-project install needed.

**Usage in Claude Code** (TanStack Start = MCP commands only, no CLI registry):

| Command | What it does |
|---------|-------------|
| `/cui <description>` | Customize / reuse an existing block with your content |
| `/iui <description>` | Generate new inspired UI from scratch (Pro only) |
| `/rui <description>` | Refine / edit an already-installed block |
| `/ftc <description>` | Convert a Figma frame to code (requires Figma MCP) |

**Workflow rules:**
- Collect ALL blocks before installing any — never interrupt mid-workflow.
- One block per chat window (exception: full landing pages via `/cui`).
- Use `/rui` only for post-install refinements, never initial builds.

---

### Magic UI Pro

Pro license held by KareTech Solutions. Token is in Infisical at `/credentials/magicui/MAGICUI_PRO_TOKEN`.

**Setup (first time):**

1. Add `MAGICUI_PRO_REGISTRY_TOKEN=<token>` to your `.env` (already in `.env.example`).
2. The registry is pre-configured in `packages/ui/components.json`.

**Install a Magic UI Pro component:**

```bash
# From packages/ui (shared components)
MAGICUI_PRO_REGISTRY_TOKEN=<token> npx shadcn@latest add --registry https://r.magicui.design <component-name> -c packages/ui

# Example
MAGICUI_PRO_REGISTRY_TOKEN=<token> npx shadcn@latest add --registry https://r.magicui.design animated-beam -c packages/ui
```

**Important:** Magic UI Pro uses `@radix-ui/react-icons` in some components. If a component imports `StarFilledIcon` from that package and it's not installed, replace it with lucide's `Star` styled with `fill="currentColor"`. Do not install `@radix-ui/react-icons` unless it's already a dependency.

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
