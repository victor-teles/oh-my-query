# Plan 007: Compose widgets into live boards with shared inputs

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages apps/app/src` and
> `git status --short`. Plans 002–006 must be merged. Confirm three things:
> `runWidget`, `cancelWidgetRun` and `listWidgets` exist in
> `packages/rpc/src/schema.ts`; `Widget` and `ParamDef` are exported from
> `@oh-my-query/rpc`; and `ask-card.tsx` renders from `{ spec, result, view }`.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (second window type in a launcher-style app)
- **Depends on**: `.factory/plans/006-saved-parameterized-widgets.md`
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-17 (assumes 002–006 landed)

## Why this matters

Widgets answer one question at a time. A board answers "how are we doing?"
at a glance. It is a persistent, auto-refreshing grid of widgets, where one
shared date range drives every tile. This is the "dynamic system" part of the
owner's vision. The launcher stays the front door: boards are opened, created
and filled from it. A board itself is a calm, read-mostly window you can leave
open on a second screen.

## Current state

- **Window.** `apps/app/src/bun/launcher.ts` (plan 002) owns a single panel
  window, a global hotkey and a tray. The app may run as an accessory (no
  Dock icon) if 002 enabled that.
- **Widgets.** The widget data and runs come from plan 006:
  - persistence: `packages/core/src/widgets.ts` (encrypted, atomic, locked);
  - run RPC: `runWidget({ widgetId, values, runId }) → { result, compiledSql }`;
  - the `ParamDef` union: `date`, `dateRange`, `number`, `text` and `select`
    with `options`/`optionsSql`;
  - presets resolved by `resolvePreset` in `packages/core/src/sql-template.ts`.
- **Renderer pieces.** The single-route renderer has these parts:
  - `components/ask/ask-card.tsx`, `card-*` and `lib/card-data.ts`, which are
    pure, width-responsive card rendering;
  - `components/widgets/*`, which include the argument pill editors (date
    range presets, select type-ahead, number and text). **Reuse these editors
    for board filters.**
  - `lib/motion.ts` (`SPRING`, `SPRING_SOFT`, `useMotionPreset`).
  - Routing is TanStack Router, file-based, in `src/mainview/routes/`.
    `routeTree.gen.ts` is generated.
- **Launcher integration point.** The widget run view's "Add to board" action
  exists but is disabled, as plan 006 left it.

## Commands you will need

| Purpose          | Command                                | Expected           |
| ---------------- | -------------------------------------- | ------------------ |
| All tests        | `bun run test`                         | all pass           |
| App tests        | `bun run --cwd apps/app test`          | all pass           |
| Typecheck / lint | `bun run check-types`, `bun run check` | exit 0             |
| e2e              | `bun run --cwd apps/app e2e`           | all pass           |
| Desktop dev      | `bun run --cwd apps/app desktop:dev`   | board window opens |

## Implementation rules relevant to this plan

- Plan 002's rules apply in full: strict TS, React 19, small components, hooks
  own logic, colocated tests, motion with a reduced-motion path, WCAG AA,
  visible focus, and no comments except for a non-obvious why.
- Bound concurrency for refreshes (4 at a time per board). Cancel in-flight
  runs on unmount and on a new refresh using `cancelWidgetRun`.
- Never refresh a hidden board. Gate on `document.visibilityState` and on a
  bun-side occlusion or miniaturize signal if Electrobun exposes one.
- A board is read-mostly. Editing the layout is an explicit mode (`⌘E`), not
  always-on drag handles.

## Contracts added

In `packages/rpc/src/board.ts`:

```ts
export const TileSize = z.enum(["s", "m", "l", "wide"]); // grid spans 3/4/6/12 of 12 columns
export const BoardTile = z.object({
  id: z.string(),
  widgetId: z.string(),
  size: TileSize,
  view: CardView.shape.kind.optional(),
});
export const Board = z.object({
  id: z.string(),
  name: z.string().max(60),
  emoji: z.string().optional(),
  tiles: z.array(BoardTile).max(24),
  sharedValues: z.record(z.string(), ParamValue), // keyed by `${name}:${type}`
  refresh: z.enum(["off", "1m", "5m", "15m", "1h"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

**Shared inputs.** The board's filter bar shows the union of its tiles'
params, grouped by `name` + `type`. Setting a value there overrides
`lastValues` for every tile that has a param with that exact `name:type`. A
tile whose param has no board value uses its own `lastValues`.

## UI and motion (mandatory)

The owner's bar is that **the UI must be excellent and motion is mandatory**.
A surface without designed motion, or without designed empty, loading,
populated and error states, is not done. Plan 002 built the system in
`apps/app/src/mainview/lib/motion.ts` and `components/motion/`. Use it. Do
not hand-roll transitions. The rules, inlined here:

- **Tokens:**
  - `SPRING` (400/30) is for layout morphs and push/pop.
  - `SPRING_SNAPPY` (600/49, ≈ critically damped) is for selection, thumbs and
    toggles.
  - `SPRING_SOFT` (260/32) is for height, panel and card reveals.
  - `SPRING_MOMENTUM` (380/26) is used **only** after a drag release with
    velocity.
  - `FADE_IN` is 160ms ease-out-quint; `FADE_OUT` is 110ms.
  - `PRESS` is `scale 0.97` over 100ms on pointerdown and keydown.
  - `STAGGER` is 30ms, capped at 6 items.
  - Primitives: `<Pressable>`, `<SwapText>` (keyed crossfade, 2px rise and
    4px blur-in, for changing values) and `<Reveal>`.
  - `useMotionPreset()` returns the reduced-motion equivalents (120ms
    crossfades, no transforms).
- **Principles:**
  - Respond on press, not on release.
  - Everything is interruptible. Springs retarget from the current value. No
    input lockout, and no CSS transitions for anything that can be
    re-triggered.
  - Exit the way you entered.
  - Use `layoutId` shared elements for objects that appear in two places.
  - Critically damped by default; overshoot only for thrown objects.
  - Animate only `transform`, `opacity` and `filter`, and use `layout`
    (FLIP) for size changes.
  - Exits run at about 70% of entrance duration.
  - One primary motion per moment.
  - Only progress indicators loop.
- **Accessibility:**
  - Reduced motion: every slide or spring becomes a crossfade or an instant
    change. Feedback stays; travel goes.
  - Reduced transparency: opaque surfaces.
  - Increased contrast: solid borders, muted text promoted.
  - Focus rings are always visible. Live regions announce state changes,
    never animation frames.
- **Avoid flicker:** a loading state that would last under 150ms is never
  shown (delay before showing). Once shown, it stays at least 300ms.
- **Evidence** (Done criteria):
  - Screen recordings of every moment in the table below, at 1× and 0.25×
    (`?slowmo=4`), from desktop dev.
  - A Safari Web Inspector Timelines capture showing no frame over 16.7ms
    during the animations.
  - Reduced Motion, Reduce Transparency and Increase Contrast each verified.
  - Browser tests for both motion branches of every component that animates.

### Motion moments in this plan

| Moment                      | Trigger                        | What moves                                                                                                                                                                                                                                                                                                                                                       | Token                            | Reduced motion                           |
| --------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------- |
| Board opens                 | Window shown                   | Tiles stagger in (opacity plus a 6px rise; 30ms each, 180ms total cap) **after** the first data or skeleton is ready, never into empty frames.                                                                                                                                                                                                                   | `SPRING_SOFT`, `STAGGER`         | Instant                                  |
| Refresh                     | Timer, `⌘R` or a filter change | Per affected tile, the previous data dims to 0.6, and a 2px progress hairline appears at the tile's top (indeterminate shimmer). Recharts transitions between data in 300ms. "Updated 2m ago" `<SwapText>`s.                                                                                                                                                     | `FADE_IN`, recharts 300ms        | Instant swap; static hairline            |
| Filter change               | A shared input changes         | Only matching tiles refresh. They get a brief one-shot outline tint, so the user sees _which_ tiles the filter affected.                                                                                                                                                                                                                                         | `FADE_OUT` 600ms                 | Tint without fade                        |
| Edit mode                   | `⌘E`                           | Drag handles and size controls `<Reveal>` per tile. The grid gains 4px of extra gap via `layout`. Exiting reverses this.                                                                                                                                                                                                                                         | `SPRING`, `FADE_IN`              | Instant                                  |
| **Drag reorder**            | Pointer drag in edit mode      | Tracks the pointer 1:1, keeping the grab offset (`setPointerCapture`). The lifted tile scales to 1.02 and its shadow deepens. Siblings reflow via `layout` as the projected drop index changes. On release, the drop index comes from **momentum projection** (`current + (v/1000)·0.998/(1−0.998)`), and the tile settles with the release velocity handed off. | 1:1, `SPRING`, `SPRING_MOMENTUM` | No lift scale; instant reflow and settle |
| Keyboard reorder and resize | `⌥←/→`, `⌥↑/↓`                 | The tile moves or resizes via `layout`, and focus follows the tile.                                                                                                                                                                                                                                                                                              | `SPRING`                         | Instant                                  |
| Tile resize                 | Size control                   | Span change via `layout`. The chart re-measures after settle, not every frame.                                                                                                                                                                                                                                                                                   | `SPRING`                         | Instant                                  |
| Add tile                    | From the launcher              | The new tile enters at the end with a `<Reveal>` and a one-shot amber pulse, and the board scrolls it into view (smooth, unless reduced motion).                                                                                                                                                                                                                 | `FADE_IN`                        | Instant, no pulse                        |
| Remove tile                 | Overflow → Remove              | The tile fades and scales to 0.98, then siblings close the gap via `layout`.                                                                                                                                                                                                                                                                                     | `FADE_OUT`, `SPRING`             | Instant                                  |
| Tile error                  | Run fails                      | The tile body crossfades to the inline error, with a Retry button. No shake.                                                                                                                                                                                                                                                                                     | `FADE_IN`                        | Instant                                  |
| Empty board                 | No tiles                       | One `<Reveal>` of the line and the shortcut hint                                                                                                                                                                                                                                                                                                                 | `FADE_IN`                        | Instant                                  |

## Scope

**In scope**

- `packages/rpc/src/{board,schema,index}.ts`
- `packages/core/src/boards.ts` (create) and its test (`boards.enc`, encrypted
  CRUD; deleting a widget removes its tiles from every board).
- `packages/core/src/widgets.ts`: the deleteWidget cascade only.
- `apps/app/src/bun/{launcher,index,rpc}.ts`, plus a new
  `apps/app/src/bun/board-windows.ts`.
- `apps/app/src/mainview/routes/board.$boardId.tsx` (create; this route stays
  thin), and `apps/app/src/mainview/components/board/` (create).
- The launcher root list and the widget run view actions (enable "Add to
  board").
- `apps/app/e2e/board-flow.spec.ts` (create).
- Docs: in `README.md` (features, shortcuts) and `CLAUDE.md` (architecture),
  describe the launcher, widgets and boards. In `PRODUCT.md`, update
  "Context of use", "Job to be done" and "Signature moment" to describe the
  launcher and remove the Tauri/Dynamic Island references. Keep the brand
  personality and principles unchanged.

**Out of scope**

- Sharing or exporting boards, multi-user use, and web publishing.
- Free-form canvas positioning. The grid is a 12-column flow.
- Alerts and thresholds.

## Git workflow

- Branch `feat/launcher-007-boards`. Commit only if authorized.

## Steps

### Step 1: Persistence and RPC

`boards.ts` handles CRUD plus `addTile`, `removeTile`, `moveTile(index → index)`,
`resizeTile` and `setSharedValue`. The RPC adds `listBoards`, `getBoard`,
`saveBoard`, `deleteBoard` and `openBoard({ boardId })`. The bun side also
sends a `boardChanged({ boardId })` message, so every open window reloads when
another window edits the same board.

### Step 2: Board windows (bun)

`board-windows.ts` keeps a map from `boardId` to `BrowserWindow`.
`openBoard` either focuses the existing window or creates one with these
settings:

- `titleBarStyle: "hiddenInset"`, opaque warm background, resizable;
- a default size of 1100×760, with the frame remembered per board;
- URL = the renderer's `#/board/{id}` (or the route path the router uses),
  in both `views://` and dev URL modes.

Closing a board window does not quit the app. If the app runs as an accessory
with no Dock icon, opening a board must still activate the app and bring the
window to the front. Verify this in desktop dev. The launcher hotkey keeps
working while a board is focused.

### Step 3: Board UI

- **`board-view.tsx`** composes the header, filter bar and grid.
- **`board-header.tsx`** shows the emoji and name (editable inline in edit
  mode), the refresh select, "Updated 2m ago" (relative, ticking each
  minute), a refresh button (`⌘R`) and an edit toggle (`⌘E`).
- **`board-filters.tsx`** shows the shared inputs, using plan 006's pill
  editors. Changing a value refreshes only the affected tiles.
- **`board-grid.tsx`** is a 12-column CSS grid. The `s`, `m`, `l` and `wide`
  sizes span 3, 4, 6 and 12 columns. Below 900px wide, everything spans 6;
  below 600px, everything spans 12.
- **`board-tile.tsx`** shows a compact header with the widget name, a
  view toggle and an overflow menu (Open in launcher, Size, Remove, Copy SQL),
  above an `ask-card` without its insight. While refreshing, the previous data
  stays visible at reduced opacity, with a 2px progress hairline at the top of
  the tile. That hairline is the only loading treatment after the first load;
  the first load shows the plan 005 skeleton. Errors show inline in the tile,
  with a Retry button.
- **`use-board-refresh.ts`** manages runs per tile. It handles the concurrency
  limit of 4, cancellation, the interval timer gated on visibility, and
  stale-while-revalidate state per tile.
- **Edit mode.** Tiles get a drag handle and size controls. Reorder by drag:
  use motion layout animations with drop-index computation from the pointer
  over the flattened order. Reorder by keyboard: `⌥←` and `⌥→` move the
  focused tile, and `⌥↑` and `⌥↓` change its size. Each move persists through
  `saveBoard`. Under reduced motion, reorders are instant.
- **Empty board.** One calm line, "Add widgets from the launcher", plus a
  shortcut hint.

### Step 4: Launcher integration

- **Root section "Boards"** (between Widgets and Connections). Pressing `↵`
  opens a board's window and hides the launcher. Its `⌘K` actions are Rename,
  Duplicate and Delete (two-step).
- **"New Board" command.** It takes an inline name, then opens the window.
- **"Add to board…"** in the widget run view and on widget rows (`⌘K`). It
  pushes a picker of existing boards plus "New board…". Adding a widget selects
  the size from its view: KPI→`s`, chart→`m`, table→`l`.

### Step 5: Docs

Update `README.md`, `CLAUDE.md` and `PRODUCT.md` as listed in Scope. Keep the
brand voice: no hype. Remove the workspace-era shortcuts table and replace it
with the launcher shortcuts.

## Test plan

- Core `boards.test.ts`: CRUD, tile moves at the edges, and the delete-widget
  cascade.
- Renderer browser tests:
  - `use-board-refresh`: fake timers, the concurrency limit (5 tiles → 4
    in flight), cancel on unmount, a paused interval when hidden, and a shared
    value change that refreshes only the matching tiles;
  - the board header, filters (union by `name:type`), tile states (first load,
    refreshing, error) and edit-mode keyboard reorder and resize.
- Snapshots: an empty board, a populated 5-tile board, edit mode, and a tile
  error.
- e2e `board-flow.spec.ts` (stub): create a board from the launcher, add two
  widgets, open `/board/:id` directly, change the shared date range, and see
  both tiles re-run (assert on the stub's run log).

## Done criteria

- [ ] In desktop dev, the launcher opens a board, and the board window opens in
      front even when the app has no Dock icon.
- [ ] The launcher hotkey still works while a board is focused.
- [ ] Closing all boards leaves the app running in the tray.
- [ ] A shared date range on a board with 4 widgets (two of them share
      `period:dateRange`) re-runs only those two.
- [ ] With the board window minimized or hidden, the stub log or bun log shows
      no refresh runs at the `1m` interval.
- [ ] `README.md`, `CLAUDE.md` and `PRODUCT.md` describe the launcher, widgets
      and boards. `rg -n "Dynamic Island|Tauri|query tab" README.md CLAUDE.md PRODUCT.md`
      finds no matches.
- [ ] All tests, check-types, check and e2e pass. Coverage is ≥80%.
- [ ] Every row of "Motion moments in this plan" is implemented with its token and its
      reduced-motion fallback, with a browser test per branch. Recordings at 1× and 0.25×
      (`?slowmo=4`) are attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of a 12-tile board: refresh all, change a shared filter, and drag-reorder in edit mode shows no frame
      over 16.7ms, and only `transform`/`opacity`/`filter` animate.
- [ ] Reduced Motion, Reduce Transparency and Increase Contrast are each verified on this
      plan's surfaces, along with designed empty, loading, populated and error states (snapshots).

## STOP conditions

- Electrobun cannot keep a normal window activatable while the app runs as an
  accessory or tray-only app. Report the options to the owner, such as
  showing a Dock icon only while a board is open. That is a product-visible
  change.
- Rendering more than 12 recharts tiles on one board drops below 50fps while
  scrolling in desktop dev. Report the measurements before changing chart
  libraries.

## Maintenance notes

- Future alerting can piggyback on `use-board-refresh`'s schedule, but should
  move to the bun side so it works while windows are closed.
- If `CardSpec.version` bumps, boards inherit the migration through widgets.
  Boards store no spec of their own beyond the `view` override.
