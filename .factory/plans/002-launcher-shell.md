# Plan 002: Replace the workspace app with a native launcher panel

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: Run `git diff --stat 12b9e8c -- apps/app packages/rpc` and
> `git status --short`. Reconcile routine drift; pause if drift reintroduces or
> extends the workspace UI this plan deletes.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (deletes most of the renderer)
- **Depends on**: `.factory/plans/001-upgrade-electrobun.md`
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-17 (clean tree)

## Why this matters

oh-my-query is pivoting from a tabbed SQL workspace to a Raycast-style launcher
for databases: a global hotkey summons a floating panel, you type a question,
and the answer lands as SQL plus a chart. The owner chose a **launcher-only
rewrite**: the workspace (tabs, CodeMirror editor, results grid, schema tree,
EXPLAIN view, Dynamic Island titlebar) goes away. This plan lays the foundation
every later plan builds on. It covers the native window behavior, the empty
launcher shell, and the visual language. Without it, nothing else has a surface
to render into.

## Product direction (decided by the owner; do not reopen)

- Launcher only. No workspace editor. Keep the DB layer packages.
- The AI agent runs in the bun process (plan 004), not the renderer.
- v1 dynamic UI = generated result cards (005), saved and parameterized
  widgets (006), and boards (007).
- uiarc.dev and uaiblocks.dev are references for interaction patterns only.
  Build our own components on the warm-amber system. Do not install their
  registries.

## Current state

- `apps/app/src/bun/index.ts`: creates one `BrowserWindow` from `windowOptions`,
  sets the app menu, and forwards the "settings" menu click as `menuNavigate`.
- `apps/app/src/bun/window.ts`: a 1280×860 `hiddenInset`, `transparent: true`
  window. After plan 001, imports come from `"electrobun/main"`.
- `apps/app/src/bun/rpc.ts` (315 lines): `createRpc({ getMainWindow })`. It
  defines every request handler from `RpcSchema` (`packages/rpc/src/schema.ts`),
  plus `toggleWindowMaximize` and `rendererReady`.
- `apps/app/src/bun/menu.ts`: `APPLICATION_MENU`.
- Electrobun: plan 001 upgraded it to the latest stable 2.x (exact pin, Hutch
  toolchain, `.hutch/devkit` typings). **Plan 001's PR description lists the
  exact signatures** of `GlobalShortcut`, `Tray`, the `BrowserWindow` lifecycle
  and frame methods, the blur event, screen/cursor APIs and the no-Dock-icon
  option. Read it before Step 2. It also marks any primitive as "missing" with
  a fallback.
- Renderer: `apps/app/src/mainview/`.
  - `routes/__root.tsx`, `routes/_default.tsx`, `routes/_default/{index,settings}.tsx`
    plus `-components/` and `-hooks/`, and `routes/workspace/$connectionId.tsx`.
  - `components/{workspace,titlebar,command-palette,history,ai-elements,connection-form,icons,ui}`.
  - `contexts/*` (query execution, tabs, island, safe mode, …), `stores/*`,
    `hooks/*` (mostly workspace hooks), `lib/*`.
  - `lib/ipc.ts`: the `Electroview.defineRPC` client. Outside Electrobun it falls
    back to `createBrowserRequestStub()` so `bun run dev:web` and Playwright e2e
    run in a plain browser. **Keep this fallback pattern.**
- `components/ui/` holds shadcn (base-mira, `@base-ui/react`) primitives with
  browser tests and snapshots. Keep the ones the launcher uses: `button`, `kbd`,
  `input`, `command` (cmdk), `skeleton`, `spinner`, `tooltip`, `chart`,
  `scroll-area`, `separator`, `dialog`, `select`, `label`. Delete the rest only
  if nothing imports them after the rewrite.
- `components/connection-form/` is reused by plan 003. **Do not delete it.**
- Tokens: `apps/app/src/mainview/index.css` defines `oklch` light/dark vars.
  Dark primary is amber `oklch(0.9247 0.0524 66.1732)`. Chart vars
  `--chart-1..5` (dark: `0.82 0.12 70`, `0.75 0.09 190`, `0.75 0.11 25`,
  `0.76 0.07 110`, `0.65 0.03 70`). `--font-sans` is the `-apple-system`
  placeholder and `--font-mono` is JetBrains Mono Variable.
- Root `DESIGN.md` / `DESIGN.json` hold the full token set. Root `PRODUCT.md`
  holds the brand (warm · craft · trustworthy; no sparkle icons, no
  purple/cyan AI gradients; WCAG AA; reduced motion respected).
- Tests: `apps/app/vite.config.ts` defines Vitest projects `unit` (jsdom,
  `*.test.ts(x)`) and `browser` (Playwright Chromium, `*.browser.test.tsx`).
  Coverage includes `src/mainview/**` and excludes `routes/**` and `main.tsx`.
  e2e lives in `apps/app/e2e/{app-boots,connection-flow}.spec.ts`. Both assert
  the old welcome screen.
- `apps/web/` has no `package.json`. It is leftover Tauri/Storybook residue and
  out of scope.

## Commands you will need

| Purpose               | Command                                   | Expected on success  |
| --------------------- | ----------------------------------------- | -------------------- |
| Install               | `bun install`                             | exit 0               |
| Typecheck             | `bun run check-types`                     | exit 0               |
| Lint + format         | `bun run check`                           | exit 0               |
| Tests (both projects) | `bun run --cwd apps/app test`             | all pass             |
| Coverage              | `bun run --cwd apps/app test:coverage`    | ≥80% lines           |
| e2e                   | `bun run --cwd apps/app e2e`              | all pass             |
| Renderer in browser   | `bun run dev:web` → http://localhost:3001 | launcher renders     |
| Desktop dev           | `bun run --cwd apps/app desktop:dev`      | hotkey summons panel |

## Implementation rules relevant to this plan

- TypeScript strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`. No
  `any`. No unsafe casts: the existing `as never` in `index.ts` may stay only
  if the v2 types still force it, with a one-line why.
- React 19: ref as a prop, never `forwardRef`. One component per file, file
  name = export name in kebab case. Components stay under ~150 lines and ≤ ~6
  props. Hotkeys live in a `useXxxHotkeys` hook. No derived state synced via
  `useEffect`.
- No code comments unless the _why_ is non-obvious (one short line).
- Formatting is Oxfmt: double quotes, semicolons, 2 spaces, ES5 trailing
  commas, sorted imports.
- Motion and UI follow the **UI and motion system** section below. It is
  mandatory. A surface with no designed motion, or no designed loading, empty
  and error states, is not done.
- New code gets colocated tests: `*.test.ts` for pure logic,
  `*.browser.test.tsx` for UI and hooks, using
  `import { render } from "vitest-browser-react"` and
  `import { renderHook } from "@/test/render-hook"`.

## UI and motion system (mandatory; plans 003–007 inline and extend it)

The owner's bar: **the UI must be excellent, and motion is mandatory.** Motion
is part of how the launcher explains itself: where something came from, what
is happening, and what just finished. It is not decoration. The references are
Raycast, Things 3, Linear and Arc. The anti-references are stock
shadcn/dashboard UIs and the purple/cyan "AI app" look.

### Motion principles

1. **Respond on press, not on release.** Buttons and rows show pressed
   feedback on `pointerdown` and `keydown`: `scale: 0.97` within 100ms
   (`PRESS`). Commit on release or `↵`.
2. **Everything is interruptible.** Use `motion` springs, which retarget from
   the current on-screen value and velocity. Never lock input during a
   transition. If you press the hotkey mid-show, the panel reverses from where
   it is. Never use CSS `transition`/`@keyframes` for anything a user can
   re-trigger mid-flight. CSS keyframes are only for ambient loops (shimmer,
   caret, spinner).
3. **Spatial consistency.** Things leave the way they came. A pushed view
   enters from the right and pops out to the right. A popover scales from its
   trigger (`transform-origin` at the trigger). The panel drops from just
   above and retracts upward.
4. **Shared-element continuity.** When the same object appears in two places,
   it moves between them with `layoutId` rather than fading out and in.
   Examples: the selected-row pill, the connection chip, and the segmented
   control thumb.
5. **Critically damped by default.** Overshoot is reserved for motion the user
   threw: a drag release with velocity (plan 007 tiles). Menus, views and cards
   settle without bounce.
6. **Animate only `transform`, `opacity` and `filter`.** For height changes,
   use `layout` animations (FLIP, transform-based), not `height` tweens. The
   panel's native window frame follows the content (see Step 5).
7. **Exits are faster than entrances**, at about 70% of the duration. Exiting
   content gets `pointer-events: none` right away.
8. **Restraint.** Each moment gets one primary motion. Staggers are at most
   30ms per item and 180ms total. Only the first 6 items get an entrance
   animation, and the rest appear with them. Nothing loops except progress
   indicators.

### Tokens (`src/mainview/lib/motion.ts`)

| Token             | Value                                                                   | Use                                                      |
| ----------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| `SPRING`          | `{ type: "spring", stiffness: 400, damping: 30 }`                       | Repo standard (CLAUDE.md): layout morphs, view push/pop. |
| `SPRING_SNAPPY`   | `{ type: "spring", stiffness: 600, damping: 49 }` (≈ critically damped) | Selection pill, segmented thumb, toggles, hover-follow.  |
| `SPRING_SOFT`     | `{ type: "spring", stiffness: 260, damping: 32 }` (≈ critically damped) | Panel height, summon/dismiss, card reveal.               |
| `SPRING_MOMENTUM` | `{ type: "spring", stiffness: 380, damping: 26 }` (slight overshoot)    | Only after a drag release with velocity.                 |
| `FADE_IN`         | `{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }`                          | Opacity and blur-in of text and metadata.                |
| `FADE_OUT`        | `{ duration: 0.11, ease: [0.4, 0, 1, 1] }`                              | Exits.                                                   |
| `PRESS`           | `{ duration: 0.1, ease: "easeOut" }`, `scale: 0.97`                     | Pressed state.                                           |
| `STAGGER`         | `0.03`, capped at 6 items                                               | List and tile entrances.                                 |

Also export these:

- **`useMotionPreset()`.** It returns the tokens, or their reduced-motion
  equivalents: every spring and slide becomes a 120ms opacity crossfade, and
  the press scale becomes an opacity dim to 0.85. Read
  `useReducedMotion()` from `motion`.
- **`<MotionConfig>` setup** in the root, with `reducedMotion="user"`.
- **A dev-only slow-motion switch.** `?slowmo=4` or `localStorage
"omq:slowmo"` multiplies every duration and divides spring stiffness by
  N². That makes recordings at 0.25× possible. Strip it from production
  bundles via `import.meta.env.DEV`.

Shared motion primitives go in `src/mainview/components/motion/`. Create them
only when a second plan needs them; plan 002 needs the first three:

- `<Pressable>`: the press feedback wrapper (`asChild`-style, via composition);
- `<SwapText>`: a keyed `AnimatePresence` that crossfades with a 2px rise and
  a 4px blur-in, for metadata that changes value;
- `<Reveal>`: opacity plus a 4px rise plus a blur-in, with an optional delay.

### Materials, accessibility, and type

- **Material.** The panel is a translucent warm-ink layer:
  `backdrop-filter: blur(24px) saturate(200%)`, `--panel` background, a 1px
  `--panel-border`, a 1px top `--panel-highlight` (light catching the edge),
  and a two-layer shadow. Never stack a light translucent surface on another
  one. Inner surfaces such as cards and the SQL block use opaque-ish raised
  tokens.
- **`prefers-reduced-transparency: reduce`**: the panel background goes to
  ~97% opacity and the blur is dropped.
- **`prefers-contrast: more`**: solid background, a 1px border at
  ≥3:1, and muted text promoted to the foreground color.
- **Type scale** (Mona Sans Variable, with JetBrains Mono for SQL and data):

  | Role       | Size / line-height | Weight | Tracking |
  | ---------- | ------------------ | ------ | -------- |
  | Input      | 17/24              | 450    | -0.01em  |
  | Title      | 14/20              | 560    | -0.006em |
  | Body/row   | 13/18              | 450    | 0        |
  | Meta       | 12/16              | 450    | +0.005em |
  | Micro, kbd | 11/14              | 520    | +0.02em  |

  Numbers use `tabular-nums`. Meta text over translucency uses weight 500,
  not flat grey, so it stays legible.

- **Spacing and shape.** Spacing follows a 4px grid. Radii are concentric:
  panel 16, inner surfaces 16 − padding, rows 10, chips 8, kbd 5. Hit targets
  are at least 28×28. Icons are 16px with optical alignment against cap height.
- **States are designed, not defaulted.** Every view ships empty, loading,
  populated and error states, each with its own snapshot.
- **Focus.** The focus ring is a 2px amber ring with a 2px offset, always
  visible on keyboard focus. Rows show selection by background pill, not by
  outline alone.

### Signature motion moments in this plan

| Moment         | Trigger                   | What moves                                                                                                                       | Token                      | Reduced motion     |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------ |
| Summon         | hotkey, `launcherShown`   | panel `opacity 0→1`, `scale 0.98→1`, `y -8→0`, backdrop blur ramps in with opacity ("materialize")                               | `SPRING_SOFT`              | 120ms opacity only |
| Dismiss        | hotkey, blur, Esc at root | reverse of summon toward `y -8`; `hideLauncher` fires after the exit animation completes, or immediately under reduced motion    | `FADE_OUT` + `SPRING_SOFT` | instant hide       |
| Height morph   | content size change       | content wrapper `layout`; the native frame pre-grows to the max of old and new heights, then shrinks after the animation settles | `SPRING_SOFT`              | instant            |
| Selection      | ↑/↓, hover                | the active-row pill moves via `layoutId="launcher-selection"`                                                                    | `SPRING_SNAPPY`            | instant            |
| Push/pop view  | `↵` into a view, Esc      | incoming view `x 16→0` + opacity; the outgoing view `x 0→-16` + fade; pop mirrors it                                             | `SPRING`                   | 120ms crossfade    |
| Filter results | typing                    | rows that remain keep their position via `layout`; new rows fade in (no stagger while typing)                                    | `SPRING_SNAPPY`, `FADE_IN` | instant            |
| Submit ↔ stop  | busy state                | the button's icon crossfades while the shape morphs (radius 8→6) via `layout`                                                    | `SPRING_SNAPPY`            | crossfade          |
| Footer hints   | context change            | `<SwapText>` per hint                                                                                                            | `FADE_IN`                  | instant            |
| Press          | pointerdown, keydown      | `scale 0.97`                                                                                                                     | `PRESS`                    | opacity dim        |

## Scope

**In scope**

- `apps/app/package.json`: add `@fontsource-variable/mona-sans`. Do not
  change the `electrobun` version (plan 001 owns it). Remove deps that become unused (CodeMirror,
  `@uiw/*`, `streamdown` and `@streamdown/*`, `@json-render/*`,
  `react-resizable-panels`, `@tanstack/react-table`, `use-stick-to-bottom`, and
  any others with no remaining importer). **Keep** `ai` and `@ai-sdk/*` until
  plan 004 moves them, and keep `recharts` and `@codemirror/lang-sql` (plan 005
  uses the SQL parser for highlighting).
- `apps/app/electrobun.config.ts`: the no-Dock-icon option only, if plan 001
  found one.
- `apps/app/src/bun/{index,window,menu,rpc}.ts`, new `apps/app/src/bun/launcher.ts`
- `packages/rpc/src/schema.ts`: add launcher window requests and messages.
  Remove requests used only by the workspace (`getTabs`, `saveTabs`,
  `explainQuery`, `toggleWindowMaximize`, Redis key browsing). Leave
  `executeQuery`, schema, connection, history and config requests.
- `apps/app/src/mainview/**`: delete the workspace UI. Build the launcher shell.
- `apps/app/e2e/*.spec.ts`: rewrite for the launcher.
- `CLAUDE.md`: Architecture section only. Replace workspace and Dynamic Island
  guidance with the launcher architecture.

**Out of scope**

- `packages/core`, `packages/drivers*`: no behavior changes.
- AI or agent code (plan 004). Connections UI (plan 003).
- `apps/web/`, `.github/workflows/*`, release signing.
- `PRODUCT.md` / `DESIGN.md` rewrites. Note needed changes in the PR instead.

## Git workflow

- Branch: `feat/launcher-002-shell` from `main`.
- Commit only if authorized. Message style: `Replace workspace with native launcher shell`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Confirm the platform baseline

Run `bun install` and `bunx electrobun sync` (in `apps/app`). Confirm that
`apps/app/package.json` pins the latest stable `electrobun` and that
`.hutch/devkit/` exists. Then read plan 001's PR description for the list of
primitive signatures, and build Step 2 against those exact APIs.

If a newer stable Electrobun has shipped since plan 001 landed, upgrade by
repeating plan 001 Steps 1–5 in this branch, before any UI work.

If plan 001 recorded no blur event, the renderer's `window` `blur` event calls
a `hideLauncher` RPC instead. That is an acceptable fallback.

**Evidence**: `bun run check-types` → exit 0 before any UI work.

### Step 2: Launcher window controller (bun)

Create `apps/app/src/bun/launcher.ts`. It exports a `createLauncher({ rpc })`
that owns:

- One panel `BrowserWindow`: `titleBarStyle: "hidden"`, `transparent: true`,
  no traffic lights, always on top, visible on all workspaces, initially
  hidden. Width is 760. Initial height is the input row only (~64px).
- `toggle()`: if visible, hide. Otherwise compute a frame centered horizontally
  on the screen with the cursor (or the main screen if the API is missing),
  with the top edge at ~22% of screen height. Then `setFrame`, `show`,
  `activate`, and send the `launcherShown` message so the renderer focuses the
  input and resets transient state.
- `hide()` hides the window. It does not close it, so state survives.
- `resize(height)` clamps to `[64, 720]`, keeps the top edge fixed, and
  grows downward.
- A global shortcut. Default `Alt+Shift+Space`, so it doesn't collide with
  Spotlight `Cmd+Space` or the Raycast/Alfred default `Alt+Space`. Read an
  override from `AppConfig.launcherHotkey` via `@oh-my-query/core`
  `getConfig()`. Add that optional field to `AppConfig` in
  `packages/core/src/config.ts`. That is the only core change allowed.
- A `Tray` with menu items "Open Launcher", "Settings…", and "Quit".
- Blur → `hide()`, unless a native dialog is open. Track that with a
  boolean the controller owns.

Wire it in `index.ts` in place of the old main window. Keep
`ApplicationMenu`, since Edit-menu roles are needed for copy and paste in a
webview, but drop the View/Window items that make no sense for a panel.
`Cmd+,` sends `launcherNavigate({ view: "settings" })`.

Add to `packages/rpc/src/schema.ts`:

```ts
requests: {
  resizeLauncher: { params: { height: number }; response: void };
  hideLauncher: { params: Record<string, never>; response: void };
  // …existing requests kept per Scope
}
messages: {
  launcherShown: Record<string, never>;
  launcherNavigate: { view: "root" | "settings" };
  // updateProgress stays; menuNavigate is replaced by launcherNavigate
}
```

Keep the `RequestHandlers` mapped type in `rpc.ts`, so a missing handler stays a
type error.

**Evidence**: In `desktop:dev`, pressing the hotkey shows the panel on the
active screen, pressing it again hides it, and clicking another app hides it.
Record what you observed in the PR. CI cannot prove this.

### Step 3: Delete the workspace renderer

Delete `routes/workspace/`, `routes/_default*`, `components/{workspace,titlebar,command-palette,history,ai-elements}`,
workspace-only `contexts/*`, `stores/*`, `hooks/*`, and `lib/*`, along with
their tests and `__snapshots__`. Before deleting a `lib/*` module, check
whether plans 003–007 need it, and keep it if so:

- Keep `connections.ts`, `connection-appearance.ts`, `fuzzy-match.ts`,
  `format-cell.ts`, `format-metrics.ts`, `csv.ts`, `error-message.ts`,
  `rpc-error` handling, `ipc.ts`, `persistence.ts`, and `utils.ts`.
- Keep `ai-schema-formatter.ts`, `ai-errors.ts`, `ai-settings*.ts`, and
  `ai-provider.ts` until plan 004 moves them. They may sit unused for one plan.
  If lint flags unused files, mark them in the PR rather than deleting.
- Rename `lib/tauri.ts` if it still exists and only re-exports IPC types, and
  update imports.

Regenerate `routeTree.gen.ts` by running the dev server or build. Never edit it
by hand.

**Evidence**: `rg -l "workspace|dynamic-island|QueryTabs" apps/app/src/mainview` → no matches outside deleted paths. `bun run check-types` → exit 0.

### Step 4: Visual foundation

In `index.css`:

- Set `--font-sans` to `"Mona Sans Variable", -apple-system, system-ui,
sans-serif`, imported via `@fontsource-variable/mona-sans`. Keep JetBrains
  Mono for `--font-mono`. Use `font-feature-settings: "ss01", "tnum"` on
  numeric data. This is the recommended pairing; see Open decisions in the
  README.
- Add launcher tokens built from the existing warm neutrals:
  `--panel` (warm ink at ~78% alpha), `--panel-border` (`oklch(1 0 0 / 0.10)`),
  `--panel-highlight` (1px top inner highlight `oklch(1 0 0 / 0.06)`),
  `--row-hover`, `--row-active` (amber at ~14% alpha), and `--shadow-panel`
  (large soft shadow, 2 layers). Give the panel `backdrop-blur-xl
backdrop-saturate-200`, radius 16px, with inner radii concentric
  (16 − padding).
- Extend the chart palette to 6 series that stay distinguishable on the dark
  panel and pass 3:1 against it. Keep amber as series 1. Avoid a purple/cyan
  "AI" pairing.
- Keep the light-mode values coherent. Dark stays the default via `next-themes`.

Create `src/mainview/lib/motion.ts` with every token in the "Tokens"
table, `useMotionPreset()`, and the dev slow-motion switch. Create
`components/motion/{pressable,swap-text,reveal}.tsx`. Add the
`prefers-reduced-transparency` and `prefers-contrast` overrides to
`index.css`. Apply the type scale as Tailwind v4 `@theme` tokens (for example
`--text-input`, `--text-meta`) so components never hard-code sizes.

### Step 5: Launcher shell (renderer)

- `routes/__root.tsx` renders `<LauncherPanel>`. Use a single index route.
  Views inside the panel are local state, not routes, because launchers are
  stack-based. Add `components/launcher/use-launcher-stack.ts`, a `useReducer`
  over `{ stack: LauncherView[] }` with `push`/`pop`/`reset`. `LauncherView`
  is a discriminated union whose variants are `root` and `settings` (plus
  later plans' views).
- `components/launcher/launcher-panel.tsx` is the translucent surface. It
  measures its content with `ResizeObserver` and calls
  `resizeLauncher({ height })` (rAF-throttled, rounded up to integers). It owns
  the summon and dismiss, height-morph and push/pop motion from the
  signature-moments table. The native window grows to the max of the old and
  new heights **before** the content animates, and shrinks only after the
  layout animation's `onLayoutAnimationComplete`. That way content never clips,
  and the transparent area outside the panel stays click-through
  (`passthrough` or a hit-test region if Electrobun supports it; otherwise
  keep the transient overgrowth under one animation).
- `components/launcher/launcher-input.tsx` is a large input (17px, Mona Sans
  450). It has a leading context chip slot (`chip` prop), placeholder text
  "Ask a question or search…", and a trailing submit button that shows the
  `↵` glyph and becomes a stop square while busy (as in the reference video).
- `components/launcher/launcher-list.tsx` is a cmdk list with sections. Root
  sections for now are "Connections" (placeholder) and "Settings". Rows are
  36px with an icon, title, muted subtitle, and right-aligned `Kbd` hint.
  Arrow keys move, and the selected-row highlight is a `layoutId` pill.
- `components/launcher/launcher-footer.tsx` is a 32px footer with the active
  connection (placeholder), a primary action hint (`↵ Open`), and `⌘K
Actions`.
- `components/launcher/use-launcher-hotkeys.ts`: `Esc` pops the stack, or
  clears the input if non-empty, or calls `hideLauncher` at root. `⌘,` pushes
  settings. On `launcherShown`, it focuses the input and resets to root if the
  panel was hidden for more than 60s.
- The settings view is an empty `settings` placeholder that plan 003 fills.

### Step 6: Tests, e2e, docs

- Browser tests for `LauncherPanel` (resize calls, using a mocked `ipc`
  module), `LauncherInput` (chip, busy state, submit), `LauncherList`
  (keyboard navigation, empty state), `useLauncherStack` (push/pop/reset),
  and `useLauncherHotkeys` (Esc ordering). Unit test `motion.ts`: the tokens,
  the reduced-motion mapping, and the slowmo multiplier being a no-op when
  `import.meta.env.DEV` is false.
- Motion behavior tests (browser): with `prefers-reduced-motion` emulated
  (`page.emulateMedia` in the vitest browser context, or by mocking
  `useReducedMotion`), push/pop and summon resolve without transforms, and
  `hideLauncher` is called immediately. With motion on, `hideLauncher` is
  called after the exit completes, using fake timers or awaiting
  `onAnimationComplete`. A second hotkey press during summon reverses the
  animation instead of queueing it: assert that the final state is hidden and
  that only one `hideLauncher` call happens.
- Tests for `Pressable`, `SwapText` and `Reveal`, covering both
  reduced-motion branches.
- Snapshots of the root panel with empty input, with typed input and filtered
  rows, and with the settings view.
- Rewrite `e2e/app-boots.spec.ts` so it loads `/`, sees the textbox
  "Ask a question or search…", and finds no console errors. Delete
  `connection-flow.spec.ts`; plan 003 recreates it.
- Update `CLAUDE.md` › Architecture: launcher window controller, stack views,
  no Titlebar/Dynamic Island, and the AI agent in bun (planned). Update the
  "Signature moment" line to point at the launcher's ask-phase morph (plan 005).

## Test plan

- New: `components/launcher/*.browser.test.tsx`,
  `lib/motion.test.ts`, `components/launcher/use-launcher-stack.browser.test.tsx`.
- Pattern: model after `components/ui/command.browser.test.tsx` and an
  existing hook test such as `hooks/use-workspace-mode.browser.test.tsx`. Read
  it before deleting.
- `bun run --cwd apps/app test` → all pass. `test:coverage` → ≥80% lines.

## Done criteria

- [ ] `electrobun` is still the exact latest stable pinned by plan 001, and
      no `electrobun/bun` imports remain.
- [ ] `bun run check-types`, `bun run check`, `bun run --cwd apps/app test`, and `e2e` exit 0. Coverage ≥80%.
- [ ] `rg "workspace/\$connectionId|DynamicIsland|useQueryTabs" apps/app/src` → no matches.
- [ ] Desktop dev, manual: the hotkey toggles the panel on the cursor's screen,
      blur hides it, Esc at root hides it, the tray menu works, the panel grows
      and shrinks with content without clipping, and reduced motion removes the
      spring. Record this in the PR.
- [ ] Every row of the "Signature motion moments" table is implemented with
      the listed token and reduced-motion fallback. The PR includes a screen
      recording of each moment at 1× and at 0.25× (`?slowmo=4`), from desktop
      dev.
- [ ] Frame timing: a Safari Web Inspector Timelines recording (WKWebView) of
      summon → type → push settings → pop → dismiss shows no frame over 16.7ms
      during the animations. Attach a screenshot. Only `transform`, `opacity`
      and `filter` animate: no layout or paint thrash in the trace.
- [ ] Interrupt check: pressing the hotkey twice quickly mid-summon reverses
      smoothly, and typing during a push/pop is never dropped.
- [ ] macOS Reduce Motion, Reduce Transparency and Increase Contrast are each
      toggled and verified, and recorded in the PR.
- [ ] Empty, loading, populated and error snapshots exist for the root view
      and settings view.
- [ ] `components/connection-form/` still exists and compiles.
- [ ] README index row updated.

## STOP conditions

- Plan 001 recorded `GlobalShortcut` as missing. The launcher concept depends
  on it. Report the options: a native helper, or another runtime.
- Transparent, frameless windows cannot get real vibrancy or blur on 2.x. The
  panel would need an opaque fallback, which is a visual direction change, so
  confirm it with the owner.
- A signature moment cannot reach 60fps in WKWebView even after you limit it
  to `transform`/`opacity`/`filter`. The usual causes are `backdrop-filter`
  combined with a scale animation, or the native resize. Report the trace and
  proposed alternatives, such as animating the blur layer separately or
  pre-sizing the window. **Do not silently remove or simplify motion**,
  because motion is a hard requirement.

## Maintenance notes

- Plans 003–007 add `LauncherView` variants and RPC entries. Keep the union
  and the `RequestHandlers` map exhaustive.
- The resize handshake (renderer measures, bun sets the frame) is the
  likeliest source of jank. Reviewers should watch for resize loops between
  `ResizeObserver` and window frame changes.
- Deferred: a user-configurable hotkey UI (plan 003 settings) and
  launch-at-login.
