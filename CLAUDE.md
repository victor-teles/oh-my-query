# CLAUDE.md

Guidance for Claude Code working in this repo. Keep it short, keep it true.

## What this is

**oh-my-query** — desktop SQL/AI client. Turborepo monorepo. React 19 renderer (Vite) packaged as a native desktop app via Electrobun. The bun-side process in `apps/app/src/bun/` exposes RPC handlers consumed by the renderer through `electrobun/view`.

## Commands

```bash
bun install                              # deps
bun run dev                              # all apps (Turborepo)
bun run dev:web                          # renderer only — http://localhost:3001
bun run --cwd apps/app desktop:dev       # Electrobun dev (vite + watcher)
bun run --cwd apps/app desktop:build     # production desktop build
bun run check-types                      # tsc across workspaces
bun run check                            # lint + format check (Ultracite)
bun run fix                              # auto-fix lint + format
bun run --cwd apps/app test              # all tests — REQUIRED before declaring done
```

## Development Guidelines

- Run type-check, lint, and tests after multi-file changes, before declaring done.
- Do not stop mid-implementation. Execute all tasks of a plan sequentially; pause only for explicit user questions.
- Fix CI failures at the root cause. Never loosen thresholds or disable checks.
- Before implementing a GitHub issue, verify the branch and create a feature branch if on `main`.
- Always write tests for new code. Colocate `*.browser.test.tsx` (UI/hooks) or `*.test.ts` (pure logic) next to the unit. Cover rendering, primary interactions, and conditional branches. CI gates Vitest + Playwright at 80% line coverage.

## Monorepo

- `apps/app/` — desktop app: React 19 in `src/mainview/`, bun process in `src/bun/`, Electrobun, TanStack Router, Vite, Tailwind v4.
- `packages/config/` — shared `tsconfig.base.json`.
- `packages/env/` — type-safe env vars (`@t3-oss/env-core`, Zod) in `packages/env/src/web.ts`. Web vars must be prefixed `VITE_`.
- Workspace packages: `@oh-my-query/*` via `workspace:*`. Shared deps via bun's `catalog:` in root `package.json`.

## Architecture (`apps/app`)

- **Routing**: TanStack Router, file-based in `src/mainview/routes/`. `routeTree.gen.ts` is generated — don't edit.
- **Path alias**: `@/` → `apps/app/src/mainview/` (configured in `vite.config.ts` and `tsconfig.json`).
- **Styling**: Tailwind v4 via `@tailwindcss/vite`. CSS entry `src/mainview/index.css`. CSS vars in `oklch` for light/dark. Glass: `backdrop-blur-xl backdrop-saturate-200` + `bg-secondary/50`.
- **UI**: shadcn/ui (base-mira, non-RSC) in `src/mainview/components/ui/`. Add via `bunx shadcn@latest add <component>` from `apps/app/`.
- **Theming**: `next-themes`, dark default, class-based.
- **Desktop runtime**: Electrobun. Vite bundles the renderer into `dist/`, copied to `views/mainview/` inside the `.app`. The bun-side bundles from `src/bun/index.ts`.
  - RPC: `Electroview.defineRPC` (renderer, `src/mainview/lib/ipc.ts`) ↔ `defineElectrobunRPC` (bun, `src/bun/rpc.ts`).
  - DB drivers + persistence: `@oh-my-query/core`, `@oh-my-query/drivers`, `@oh-my-query/drivers-redis`. Consumed by `src/bun/rpc.ts`.
  - `@polyglot-sql/sdk` WASM is copied next to bundled bun code via `apps/app/scripts/copy-bun-assets.ts` (runs before `electrobun dev`/`build`).
  - Vite must use `base: "./"` so `dist/index.html` uses relative asset paths.
- **State**: Custom hooks centralize logic (`useQueryTabs`, `useConnectionLifecycle`). React Context (`QueryExecutionContext`) for cross-tree sharing.
- **Animation**: `motion` (Framer Motion v12+). `layout` for morphing, `AnimatePresence` for enter/exit. Spring `{ type: "spring", stiffness: 400, damping: 30 }`. CSS `@keyframes` for trivial cases. Always respect `prefers-reduced-motion`.
- **Titlebar**: slot props `leading` / `center` / `children`. `center` is absolutely positioned (Dynamic Island overlay).
- **SQL editor**: CodeMirror (`@uiw/react-codemirror` + `@codemirror/lang-sql`), GitHub Dark theme. Override with `!bg-background` on `.cm-editor`, `.cm-gutters`, `.cm-activeLineGutter`.

## Conventions

- **Bun** v1.3.9. **Turborepo** for builds.
- **Formatting** (Oxfmt): double quotes, semicolons, 2-space indent, ES5 trailing commas, sorted imports.
- **Linting** (Oxlint + Ultracite core/React presets).
- **TypeScript**: strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`. No `any`, no unsafe casts, no `// @ts-expect-error` without a one-line _why_.
- **React 19**: ref as a prop. Never `forwardRef`.
- **No code comments by default.** Don't narrate code, restate identifiers, or leave change-log breadcrumbs ("added X", "now uses Y", "removed Z"). Rename, restructure, or push the explanation into the commit/PR. Comment only when the _why_ is non-obvious — a hidden constraint, subtle invariant, or specific-bug workaround — and keep it to one short line.

## Skills

Activate on React/TypeScript work:

- `vercel-composition-patterns`
- `vercel-react-best-practices`
- `web-design-guidelines`

## Code quality bar

Every change is held to a senior bar.

- **Clean.** Self-explanatory names. One thing per function at one level of abstraction. No dead code, commented-out blocks, or stray `console.log`. Early returns over nested branches. Pure where possible; isolate side effects at the edges.
- **Modular.** Small units with a single reason to change. Co-locate component + hook + types + test. Cross module boundaries only through public surfaces. No circular imports.
- **Extensible, not speculative.** Compose over inherit. Data + behavior over flags. Generalize on the second caller, not the first.
- **SOLID with judgment.** SRP per module/component/hook. Extend via composition (children, slots, render props, hook factories), not prop explosion. Depend on the narrowest interface that does the job.
- **Errors at the right boundary.** Don't bury, swallow, or rethrow generically. Validate at system edges (user input, RPC, drivers). Trust internal contracts.
- **Tested.** Unit test pure logic. Render + interaction test components and hooks. Snapshot critical UI states (empty, loading, error, populated). 80%+ line coverage required; no critical paths untested.

### React rules

- **Small components.** > ~150 lines, or > 1 distinct responsibility (data + layout + interaction) → split.
- **One component per file.** File name matches the export (`connection-form.tsx` → `ConnectionForm`). Tiny private subcomponents may share the file; reused ones move out.
- **Clean props.**
  - Cap ~6 props. More → split, or accept a typed object (`config`, `connection`).
  - No boolean prop proliferation. Use `variant` / `size` / `state` enums or compose. See `vercel-composition-patterns`.
  - Props say _what_, not _how_. Prefer `children`/slots over `renderXxx` props.
  - Type precisely. No `any`, no `Record<string, unknown>` escapes. Discriminated unions for variant shapes.
- **State.**
  - Live at the lowest component that needs it. Lift only when siblings genuinely share it.
  - Derive in render (or `useMemo` if measurably costly). Never store derived state and sync via `useEffect`.
  - Group fields that always change together (`useReducer` when transitions matter).
  - Async/server data uses project hooks (`useConnections`, `useQueryTabs`), not `useState` + `useEffect`.
  - If you need global state, use zustand or React Context — but prefer colocation and prop drilling.
- **Hooks.**
  - Top level only. Names start with `use`.
  - `useEffect` syncs with external systems — it's not "after render." Derive what you can; handle events in handlers.
  - Exhaustive dep arrays. Never silence the lint rule — fix the design.
  - Clean up subscriptions/timers/listeners in the same effect.
  - Extract reusable stateful logic into custom hooks (one purpose, stable shape).
  - `useCallback` / `useMemo` only for real referential-stability or cost reasons. Don't sprinkle prophylactically.
  - Use React 19: `use`, ref-as-prop, Actions, `useId`, `useSyncExternalStore`. See `vercel-react-best-practices`.

## Component & route composition

Routes orchestrate; they don't implement. > ~100 lines → extract.

**Where things live**

- Reusable primitives (buttons, inputs, popovers): `apps/app/src/mainview/components/ui/`.
- Cross-screen feature components: `apps/app/src/mainview/components/<feature>/`.
- Screen-specific components: `<route>/-components/` (the `-` prefix is ignored by TanStack Router).
- Screen-specific hooks: `<route>/-hooks/`.
- App-wide hooks: `apps/app/src/mainview/hooks/`.

**Patterns**

- Many small single-purpose components beat one large one — even for one-time uses.
- Children own the hooks/handlers they need. Don't thread state through routes when the child can own it.
- Group related state + effects into purpose-named hooks (`useConnections`, `useConnectionSelection`, `useHomeIslandSync`, `useHomeHotkeys`).
- Titlebar actions, empty states, populated states — separate components, switched via `AnimatePresence`.
- Hotkey wiring lives in a `useXxxHotkeys` hook, never inline.

**Stays in the route**

- Cross-cutting flow `useState` (welcome/glow timers coordinating island + dialog state).
- Dialog mounts (`<AddConnectionDialog>`, `<EditConnectionDialog>`) — siblings of the main view.
- Top-level layout: `<Titlebar>`, scroll container, `AnimatePresence` switcher.

**Don't over-engineer**

- No `components/ui/` primitive for a single use site. Wait for caller #2.
- Don't split a 30-line component to hit a count. Split when responsibilities (data / layout / interaction) earn names.

## Tests

Vitest 4 browser mode (Playwright + Chromium) via `vitest-browser-react` for all React tests — components and hooks alike. Pure-logic, no-DOM tests stay as `*.test.ts(x)` in the jsdom `unit` project.

- Pattern: `import { render } from "vitest-browser-react"; const screen = render(<Component … />)`. Query with `screen.getByRole(...)`. Interact with `await el.click()`. Snapshot with `expect(el.element()).toMatchSnapshot()` or `expect(screen.container).toMatchSnapshot()`. Negative assert: `screen.getBy*(...).query()` returns `null`.
- Hooks: `import { renderHook, waitFor } from "@/test/render-hook"` — same shape as the historical `@testing-library/react` API (`{ result, rerender, unmount }`, `renderHook(cb, { initialProps })`).
- Snapshots committed in `__snapshots__/` next to each test. `src/mainview/test/setup-browser.ts` strips volatile inline styles (`transform`, `opacity`) so motion-driven components serialize stably.
- Scripts (from `apps/app`):
  - `bun run test` — both projects.
  - `bun run test:unit` — jsdom logic-only (`*.test.ts(x)`).
  - `bun run test:browser` — interaction + snapshot (`*.browser.test.tsx`).
  - `bun run test:watch` — watch mode for both.
  - Scope: append a path, e.g. `bun run test:browser src/mainview/components/ui/button.browser.test.tsx`.
- Update snapshots: `bun run test:browser -- -u`. Review the diff like code.

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
