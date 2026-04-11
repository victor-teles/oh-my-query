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
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` plugin. CSS entry point is `src/index.css`. Theme uses CSS variables with `oklch` color format for light/dark modes. Glassmorphism effects use `backdrop-blur-xl backdrop-saturate-200` with semi-transparent backgrounds (e.g., `bg-secondary/50`).
- **UI Components**: shadcn/ui (base-mira style, non-RSC mode). Components live in `src/components/ui/`. Add new components with `bunx shadcn@latest add <component>` from the `apps/web/` directory.
- **Path alias**: `@/` maps to `apps/web/src/` (configured in both `vite.config.ts` and `tsconfig.json`).
- **Theming**: `next-themes` with dark mode default, class-based strategy.
- **Desktop**: Tauri v2 wraps the Vite dev server. Rust source in `src-tauri/`.
  - Window config: `decorations: true`, `titleBarStyle: "Overlay"` (PascalCase required), `hiddenTitle: true`, `transparent: true`
  - macOS vibrancy via `windowEffects` with `effects: ["sidebar"]` (requires `macOSPrivateApi: true` + `macos-private-api` Cargo feature)
  - Use `data-tauri-drag-region=""` for draggable areas; `TRAFFIC_LIGHT_INSET` (~78px) reserves space for native window controls
  - When overlaying interactive UI on `data-tauri-drag-region`, use `pointer-events-none` on the container and `pointer-events-auto` on the interactive element to allow both window dragging and UI interaction
  - Platform detection: `isTauri()` helper for conditional desktop vs browser logic
  - Frontend-to-Rust calls via `@tauri-apps/api/core`'s `invoke`
  - Rust backend: Tauri commands use `sqlx` for database interactions. Dynamic SQL queries are dispatched based on database type (e.g., different `SELECT version()` syntax per DBMS).
- **Animations**: `motion` (Framer Motion v12+) for complex animations. Use `layout` props for morphing transitions and `AnimatePresence` for enter/exit animations. Spring config `{ type: "spring", stiffness: 400, damping: 30 }` for iOS-like snappiness. Simple animations can use CSS `@keyframes`.
- **State Management**: Custom React hooks (e.g., `useQueryTabs`, `useConnectionLifecycle`) centralize state logic. React Context (e.g., `QueryExecutionContext`) for cross-component state sharing between disconnected parts of the component tree.
- **Titlebar**: Uses `leading`, `center`, and `children` slot props. The `center` slot uses absolute positioning to overlay content (like the Dynamic Island) without disrupting the flex layout.
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

## Design Context

### Users

Backend and full-stack developers who live in terminals and IDEs and treat oh-my-query as a daily driver alongside their editor. Keyboard-first, long sessions debugging and exploring data, running on macOS as a native Tauri app alongside a code editor. Connecting to PostgreSQL, MySQL, SQLite, MongoDB, Redis, or ClickHouse.

**Job to be done**: "Give me a fast, beautiful, trustworthy place to talk to my databases — with an AI that helps without getting in the way."

### Brand Personality

- **Three words**: _warm · craft · trustworthy_
- **Voice**: Quiet confidence. No marketing language, no hype, no "✨ AI-powered." Talks to the user like a senior colleague who respects their time.
- **Emotional goal**: A tool you're genuinely happy to sit inside for a 3-hour debugging session — the kind of care you feel in Things 3, Postico, or Linear.

### Aesthetic Direction

- **Lineage**: Refined & native-calm. Positive references: **TablePlus, Postico, Things 3, Linear, Arc**.
- **Anti-references**:
  - **DBeaver / phpMyAdmin / pgAdmin** — bureaucratic grey panels, icon-heavy toolbars, zero personality.
  - **Generic AI-app UI** — purple/cyan gradients, neon accents on dark, sparkle icons, chatbot drawer bolted onto an admin UI.
- **Theme**: Dark-first with warm amber accent, to be refined rather than replaced. Light mode exists but dark is the hero. Current palette (`oklch` warm neutrals, amber primary ~`0.92 0.052 66°`) is the starting point, not a placeholder.
- **Typography**: The `-apple-system` stack is a placeholder — the biggest gap to fill. Pair a distinctive display/UI face with a refined mono for SQL and data. Avoid Inter, IBM Plex, Space Grotesk, Fraunces, Instrument Sans.
- **Motion**: iOS-like springs, purposeful, never decorative. Must degrade cleanly under `prefers-reduced-motion`.
- **Signature moment**: The **Dynamic Island-style connection indicator** in the titlebar is the "wait, what was that?" — invest here first.

### Design Principles

1. **Warmth is structural, not decorative.** Amber and vibrancy exist because they make long sessions feel cared-for, not because dark mode needs "pop."
2. **Native-calm, not native-cosplay.** Inherit macOS discipline (keyboard-first, quiet chrome, real vibrancy, deliberate motion) — don't imitate macOS widgets.
3. **The AI disappears into the editor.** No chatbot drawer aesthetic, no sparkle iconography. AI output lands in the editor like a colleague pasted it, not like a product feature.
4. **Density with breathing room.** Resolve pro-user density and calm space through typographic rhythm and varied spacing — not cards on cards or hidden disclosure.
5. **Keyboard + AT are non-negotiable.** Focus rings always visible. WCAG AA contrast everywhere, including results tables and the Dynamic Island. `prefers-reduced-motion` fully respected.
6. **Make the Dynamic Island the signature.** When something wants to be distinctive, put the effort here first.
