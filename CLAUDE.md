# CLAUDE.md

Guidance for Claude Code working in this repo. Keep it short, keep it true.

## What this is

**Conch** (formerly oh-my-query) — desktop SQL/AI client. Turborepo monorepo. React 19 renderer (Vite) packaged as a native desktop app via Electrobun. The bun-side process in `apps/app/src/bun/` exposes RPC handlers consumed by the renderer through `electrobun/view`.

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
- **Driving the native app**: use the `cua-driver` skill (CLI by default) as the default way to interact with the running desktop app (`desktop:dev`): summon the launcher, type, click, take screenshots and verify UI state. Use Playwright/`agent-browser` only for the browser build (`dev:web`, e2e).

## Monorepo

- `apps/app/` — desktop app: React 19 in `src/mainview/`, bun process in `src/bun/`, Electrobun, TanStack Router, Vite, Tailwind v4.
- `packages/config/` — shared `tsconfig.base.json`.
- `packages/agent/` — the bun-side AI ask pipeline (AI SDK v6). Tests run with `vitest run` and the `ai/test` mock model.
- `packages/env/` — type-safe env vars (`@t3-oss/env-core`, Zod) in `packages/env/src/web.ts`. Web vars must be prefixed `VITE_`.
- Workspace packages: `@conch/*` via `workspace:*`. Shared deps via bun's `catalog:` in root `package.json`.

## Architecture (`apps/app`)

- **Product shape**: a Raycast-style launcher. A global hotkey (default `Option+Shift+Space`, override via `launcherHotkey` in the app config) summons one translucent panel. The only other windows are boards.
- **Launcher window** (bun, `src/bun/launcher.ts`): one frameless, transparent, always-on-top panel (800 pt wide incl. a 20 pt shadow margin, top edge at 22% of the cursor's screen), a `GlobalShortcut`, a template `Tray` (`assets/tray-template.png`), no Dock icon. Bun only shows/hides the native window; the renderer owns visual state.
  - Hotkey constraints: Electrobun's `GlobalShortcut` is an NSEvent global monitor, so it needs Accessibility trust (`requireAccessibility` prompts and re-registers once granted) and never sees keys while this app is active. So the renderer closes the panel on its own hotkey (`matchesAccelerator`), board windows forward it through `toggleLauncher({ fromBoardId })`, and hiding the launcher hands focus back through `focusAfterLauncherHides` (`focus-policy.ts`, pure): keep a focused board, activate the board it came from, `deactivate` while other boards are open, otherwise `-[NSApplication hide:]` (`app-hide-native.ts`). A blur before `rendererReady` hides natively. Dev rebuilds are ad-hoc signed, so macOS may ask for Accessibility again.
  - Messages: `launcherShown` (bun showed the window), `launcherToggle` (hotkey while visible — renderer reverses whatever is in flight), `launcherDismiss` (window blur), `launcherNavigate`. Requests: `resizeLauncher` (renderer measures, bun sets the frame), `hideLauncher` (renderer calls it after the exit animation).
  - Frame math lives in `src/bun/launcher-geometry.ts` (pure, tested). Keep `@conch/core` out of `src/bun/index.ts` imports — evaluating its WASM top-level await before `electrobun/main` deadlocks the worker.
- **Launcher UI** (`src/mainview/components/launcher/`): `LauncherPanel` composes `LauncherSurface` (summon/dismiss + height morph synced to the native frame) and a stack of views (`useLauncherStack`, push/pop, Esc order: pop → clear query → dismiss). Views live in `launcher/views/`; new screens are new `LauncherView` variants, not routes. `LauncherSurface` animates height with Motion layout projection anchored by `originY: 0` (not a CSS `transformOrigin` string); avoid content that changes height every frame.
- **Ask view** (`src/mainview/components/ask/`): free text at root shows an "Ask {connection}" row first; ↵ pushes the `ask` view. `useAsk` (owned by `LauncherPanel` via `useLauncherAsk`, so ↑ on an empty root reopens the last answer) reduces `AskEvent`s in `ask-reducer.ts`; `usePhaseDisplay` owns the 150ms/300ms working-state timing. `AskCard` depends only on `{ spec, result, view }` so widgets and boards can reuse it; pure transforms live in `lib/card-data.ts`. In browser mode the stub replays recorded asks (`lib/browser-ask-stub.ts`): "signups" → stacked bar, "delete/drop…" → refusal, anything else → revenue by region; a `mongodb` connection replays "orders by status" and a `redis` one "keys by pattern" or "leaderboard", with "merge/delete/set…" refused.
  - Refine: the reducer keeps a chain of up to 6 turns (`turns`/`position`; selectors `shownTurn`, `refineContextOf` in `ask-chain.ts`). ↵ refines the shown question turn (`ask` with optional `AskParams.refine`, never an `AskEvent`/`CardSpec` change), ⌘↵ asks a new question, ↑/↓ on an empty input step turns, and "as a table"-style phrases only switch the view. Raw `>` SQL and match answers never refine: plain text starts a new question. The card never unmounts across a refine (`AskAnswerView` dims it under `ProgressHairline`, then morphs with `intro="update"`). Assumptions come from the bun `describeSql` request (polyglot, `describeSqlAssumptions` in core), never the model; drill-down attaches through `DrillProvider`, which only `AskView` mounts, and always pre-fills instead of running. Recents keep one entry per chain (`id` = the chain's first `askId`).
- **Widgets** (`src/mainview/components/widgets/`, `src/bun/widget-service.ts`): a saved answer is a `Widget` (SQL template + `CardSpec` + typed `ParamDef` inputs, contracts in `@conch/rpc` `widget.ts`, protected). Templates use `{{name}}` / `{{range.from|to}}`; `compileSqlTemplate` (core) only swaps placeholders for driver markers, so values always travel as bind parameters (`ExecuteOptions.params`). The bun service validates values with zod, runs read-only, and stores `widgets.enc` / `recent-asks.enc`. Runs never call the AI; `proposeParams` (agent) only runs on ⌘⇧S and rejects templates that change more than literals. A removed input becomes `fixed` (still bound), never spliced back into SQL. Root shows Recent, Widgets and Boards; Tab on a widget opens argument pills (`arguments/`); ⌘K on a widget or board row opens the catalog actions (`views/use-catalog-menu.ts`).
- **History** (`src/mainview/components/history/`): `recent-asks.enc` keeps the last 200 asks (prompt, SQL, `CardSpec`, never rows), deduped by connection + prompt. Root fetches only `RECENTS_SHOWN` via `listRecentAsks({ limit })`; the `history` view (⌘Y or "Search History") loads all, groups by local day, searches prompt/title/connection/SQL words (`history-search.ts`), and asks again, runs the SQL without AI, copies, saves as a widget, removes (⌃X) or clears (armed) through `deleteRecentAsk` / `clearRecentAsks`.
- **Boards** (`src/mainview/components/board/`, `src/bun/board-service.ts`, `src/bun/board-windows.ts`): a `Board` (contract and pure tile ops in `@conch/rpc` `board.ts`) is a 12-column grid of tiles (`s|m|l|wide` → 3/4/6/12 columns) pointing at widgets, plus `sharedValues` keyed by `name:type` and a `refresh` interval. Stored in `boards.enc` (`createBoardStore` over core's generic `createRecordStore`); deleting a widget removes its tiles and broadcasts `boardChanged`. Each board is a normal titled `BrowserWindow` loading `#/board/:id` with its own RPC (handlers shared, `createAppRpcs`); frames persist in `board-frames.json`. The renderer runs tiles through `useBoardRefresh` (at most 4 concurrent `runWidget`s, cancels superseded runs, interval paused while `document.visibilityState` is hidden). Shared inputs are the union of tile params by `name:type`; changing one re-runs only the tiles that use it (`board-inputs.ts`). Edit mode (⌘E) adds drag handles (`use-tile-drag.ts`: 1:1 pointer, momentum projection, `SPRING_MOMENTUM` settle) and ⌥-arrow move/resize. The launcher adds boards through `board-picker` / `board-name` views.
- **Connections + settings**: `ConnectionsProvider` (`launcher/connections/`) owns the list, active connection and live sessions for every view. The AI key is encrypted in `ai.enc` by `@conch/core`; the renderer only ever sees `RedactedAiSettings`. App data lives in `~/.config/conch` (`paths.ts`); on launch `migrateAppData` moves a legacy `~/.config/oh-my-query` there. The GitHub repo, release asset names (`oh_my_query_*`), updater URLs, Homebrew cask and the legacy keyring service still use the old name on purpose.
- **Motion system**: tokens and `useMotionPreset()` in `src/mainview/lib/motion.ts` (`SPRING`, `SPRING_SNAPPY`, `SPRING_SOFT`, `SPRING_MOMENTUM`, `FADE_IN/OUT`, `PRESS`, stagger); primitives `Pressable`, `SwapText`, `Reveal` in `components/motion/`. `?slowmo=4` (dev only) slows every animation for recordings.
- **AI (ask pipeline)**: `@conch/agent` runs in the bun process, never the renderer. `runAsk(prompt, ports, signal)` is a pure async generator (schema → streamed SQL → `assertReadOnly` guard → read-only run with up to 2 repairs → `CardSpec`) over injected ports; `src/bun/ask-service.ts` wires ports to pools and forwards `AskEvent`s via the `askEvent` message (`ask`/`cancelAsk` requests, one active ask per connection). `CardSpec` and `AskEvent` in `@conch/rpc` are protected contracts: change them only with a `CardSpec.version` bump (now 2; v1 records upgrade on parse). Every SQL driver honours `Pool.execute(..., { readOnly: true })` on the same connection. `AskPorts.engine` (`sqlEngine(dialect)`, `mongoEngine`, `redisEngine`) owns the prompt, schema formatter and guard per `QueryLanguage`; Mongo/Redis asks are allowlist-guarded JSON (`parseMongoReadQuery`/`parseRedisReadPlan` in `core/client`) run by `runMongoReadQuery`/`runRedisReadPlan` (`@conch/drivers/read`, Redis on a duplicated client, never `SELECT`); widgets stay SQL-only.
- **Routing**: TanStack Router with hash history: `/` is the launcher, `/board/$boardId` a board window; `routeTree.gen.ts` is generated into `src/mainview/` — don't edit.
- **Path alias**: `@/` → `apps/app/src/mainview/` (configured in `vite.config.ts` and `tsconfig.json`).
- **Styling**: Tailwind v4 via `@tailwindcss/vite`. CSS entry `src/mainview/index.css`. CSS vars in `oklch` for light/dark. The panel material is the `launcher-material` utility (`--panel*` tokens, falls back to opaque under `prefers-reduced-transparency`); type roles are `type-input|title|body|meta|micro` utilities. Fonts: Mona Sans Variable (UI), JetBrains Mono (SQL/data).
- **UI**: shadcn/ui (base-mira, non-RSC) in `src/mainview/components/ui/`. Add via `bunx shadcn@latest add <component>` from `apps/app/`.
- **Theming**: `next-themes`, dark default, class-based.
- **Desktop runtime**: Electrobun 2 (pinned exactly in `apps/app/package.json`; keep it on the latest stable, never a beta). The CLI runs through Hutch, which downloads the toolchain into `~/.hutch` and projects the SDK into `apps/app/.hutch/devkit` (git-ignored). Vite bundles the renderer into `dist/`, copied to `views/mainview/` inside the `.app` and loaded from `views://mainview/index.html`. The bun-side bundles from `src/bun/index.ts`.
  - SDK imports: `electrobun/main` (bun side) and `electrobun/view` (renderer). They resolve from the devkit, not `node_modules`: `tsconfig.json` paths point at declarations generated into `.hutch/types`, and `vite.config.ts` aliases `electrobun/view` to the devkit source.
  - `bun install` runs `postinstall` → `electrobun:prepare` (`electrobun sync` + `scripts/electrobun-types.ts`). Rerun `bun run --cwd apps/app electrobun:prepare` after changing the Electrobun version.
  - Router uses hash history so the packaged `views://` page resolves routes.
  - RPC: `Electroview.defineRPC` (renderer, `src/mainview/lib/ipc.ts`) ↔ `defineElectrobunRPC` (bun, `src/bun/rpc.ts`).
  - DB drivers + persistence: `@conch/core`, `@conch/drivers`, `@conch/drivers-redis`. Consumed by `src/bun/rpc.ts`.
  - `@polyglot-sql/sdk` WASM is copied next to bundled bun code via `apps/app/scripts/copy-bun-assets.ts` (runs before `electrobun dev`/`build`).
  - Vite must use `base: "./"` so `dist/index.html` uses relative asset paths.
- **State**: Custom hooks centralize logic (`useLauncherStack`, `useLauncherPresence`, `useWindowHeightSync`).
- **Animation**: `motion` (v12+) through the motion system above. `layout`/`layoutId` for morphs and shared elements, `AnimatePresence` for enter/exit, springs for anything interruptible; CSS `@keyframes` only for ambient loops. `MotionConfig reducedMotion="user"` wraps the app and every animation has a reduced-motion path.
- **Tests**: `emitIpcMessage()` (`src/mainview/test/ipc-mock.ts`) delivers bun → renderer messages through the real `@/lib/ipc`. In browser mode (`dev:web`, e2e) the IPC stub emulates the window: `hideLauncher` hides it, `Option+Shift+Space` plays the global hotkey, `openBoard` opens `#/board/:id` in a new tab, and `globalThis.__conchIpcLog` records every request for e2e assertions.

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
- **Signature moment**: The launcher's ask flow (`.factory/plans/005`): one panel that morphs from question → streaming SQL → running → chart card. Invest here first.

### Design Principles

1. **Warmth is structural, not decorative.** Amber and vibrancy exist because they make long sessions feel cared-for, not because dark mode needs "pop."
2. **Native-calm, not native-cosplay.** Inherit macOS discipline (keyboard-first, quiet chrome, real vibrancy, deliberate motion) — don't imitate macOS widgets.
3. **The AI disappears into the editor.** No chatbot drawer aesthetic, no sparkle iconography. AI output lands in the editor like a colleague pasted it, not like a product feature.
4. **Density with breathing room.** Resolve pro-user density and calm space through typographic rhythm and varied spacing — not cards on cards or hidden disclosure.
5. **Keyboard + AT are non-negotiable.** Focus rings always visible. WCAG AA contrast everywhere, including on the translucent launcher panel. `prefers-reduced-motion` fully respected.
6. **Make the launcher's ask flow the signature.** When something wants to be distinctive, put the effort here first.
