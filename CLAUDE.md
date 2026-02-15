# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**oh-my-query** is a desktop application built for querying databases with IA. It's a Turborepo monorepo with a React frontend that runs both as a web app (Vite) and a native desktop app (Tauri v2). There is no backend — this is a frontend-only project.

## Commands

```bash
# Install dependencies
bun install

# Development
bun run dev          # Start all apps via Turborepo
bun run dev:web      # Start only the web app (http://localhost:3001)

# Tauri desktop app (run from apps/web)
cd apps/web && bun run desktop:dev    # Dev mode
cd apps/web && bun run desktop:build  # Production build

# Build & type-check
bun run build        # Build all apps
bun run check-types  # TypeScript type-check across all workspaces

# Linting & formatting (Ultracite = Oxlint + Oxfmt)
bun run check        # Check for lint/format issues
bun run fix          # Auto-fix lint/format issues
```

Always run `bun run fix` before committing.

## Monorepo Structure

- **`apps/web/`** — Main frontend app (React 19, TanStack Router, Vite, Tailwind v4, Tauri v2)
- **`packages/config/`** — Shared TypeScript config (`tsconfig.base.json`)
- **`packages/env/`** — Type-safe environment variables via `@t3-oss/env-core`

Workspace packages are prefixed `@oh-my-query/` and use `workspace:*` protocol. Shared dependencies use bun's `catalog:` protocol (defined in root `package.json`).

## Architecture

### Web App (`apps/web/`)

- **Routing**: TanStack Router with file-based routing in `src/routes/`. Route tree is auto-generated (`routeTree.gen.ts`).
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` plugin. CSS entry point is `src/index.css`. Theme uses CSS variables with `oklch` color format for light/dark modes.
- **UI Components**: shadcn/ui (base-mira style, non-RSC mode). Components live in `src/components/ui/`. Add new components with `bunx shadcn@latest add <component>` from the `apps/web/` directory.
- **Path alias**: `@/` maps to `apps/web/src/` (configured in both `vite.config.ts` and `tsconfig.json`).
- **Theming**: `next-themes` with dark mode default, class-based strategy.
- **Desktop**: Tauri v2 wraps the Vite dev server. Rust source in `src-tauri/`.
  - Window config: `decorations: true`, `titleBarStyle: "Overlay"` (PascalCase required), `hiddenTitle: true`, `transparent: true`
  - macOS vibrancy via `windowEffects` with `effects: ["sidebar"]` (requires `macOSPrivateApi: true` + `macos-private-api` Cargo feature)
  - Use `data-tauri-drag-region=""` for draggable areas; `TRAFFIC_LIGHT_INSET` (~78px) reserves space for native window controls
  - Platform detection: `isTauri()` helper for conditional desktop vs browser logic
  - Frontend-to-Rust calls via `@tauri-apps/api/core`'s `invoke`
- **SQL Editor**: CodeMirror (`@uiw/react-codemirror` + `@codemirror/lang-sql`) with GitHub Dark theme. Override backgrounds with Tailwind `!bg-background` on `.cm-editor`, `.cm-gutters`, `.cm-activeLineGutter` for transparency.

### Environment Variables

Defined in `packages/env/src/web.ts` using Zod schemas. Web-specific env vars must be prefixed with `VITE_`.

## Key Conventions

- **Package manager**: bun (v1.3.9)
- **Build orchestration**: Turborepo
- **Formatting**: Oxfmt — double quotes, semicolons, 2-space indent, trailing commas (ES5), sorted imports
- **Linting**: Oxlint with Ultracite's core + React presets
- **React 19**: Use ref as a prop directly, no `forwardRef`
- **TypeScript**: Strict mode with `noUncheckedIndexedAccess`, `verbatimModuleSyntax`
- Do not add comments to the code unless necessary for clarity
- Try always to break down complex components into smaller ones, even if they are only used once. This promotes reusability and readability.
- Create files new components: When a primitive or reusable create in src/components/ui, when is too specific for the screen create in the same folder as the screen.
