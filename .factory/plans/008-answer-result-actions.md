# Plan 008: Act on an answer with ⌘K — copy SQL, CSV, TSV, Markdown or the chart, save a CSV, save as a widget, add to a board

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- apps/app/src packages/rpc/src` and
> `git status --short`. Plans 001–007 sit uncommitted in the working tree and are
> the baseline. Confirm before starting:
> `apps/app/src/mainview/components/launcher/actions/actions-menu.tsx` exports
> `ActionsMenu` and `actionsMenuHeight`; `components/ask/ask-card.tsx` takes
> `{ spec, result, view, onSelectView, intro?, actions? }`;
> `components/widgets/use-widget-menu.ts` handles `"copy-csv"`; and
> `apps/app/.hutch/types/sdks/main/core/Utils.d.ts` declares
> `clipboardWriteImage(pngData: Uint8Array)` and `paths.downloads`. If plan 012
> (refine) has landed first, `ask-view.tsx` will have moved; mount the menu
> wherever the answered card now lives.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (new bun file writes and a webview → native image path)
- **Depends on**: none (plans 005–007 are the baseline)
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19, on `feat/launcher-002-shell`
  with plans 001–007 implemented but uncommitted (the working tree is the
  baseline)

## Why this matters

An answer is only useful once it leaves the launcher: pasted into Slack as a
table, into a spreadsheet as TSV, into a doc as a chart, or kept as a widget.
Today the ask view can only copy SQL (`⌘C`) and save (`⌘S`); CSV exists only
in a widget's run view, and there is no way to get the chart out at all. This
plan adds one `⌘K` actions menu on the answer card, reusing the menu that
widgets and boards already use, so every common "take it with me" move is two
keystrokes away. The same export actions replace the widget run view's lone
"Copy as CSV", so both surfaces behave identically.

## Current state

- **Menu primitive** (reuse, do not fork):
  - `components/launcher/actions/actions-menu.tsx` — `ActionsMenu<A extends MenuAction>`
    with `{ title, anchorId, actions, armedId, onRun, onClose }`. It focuses
    itself, handles ↑/↓/↵/Esc/Tab/⌘K, scales from the anchor (`useOriginAt`) with
    `SPRING_SNAPPY` + `FADE_IN`/`FADE_OUT`, and `actionsMenuHeight(count)`
    (`actions-menu.tsx:18`) gives the room the body must reserve.
  - `components/launcher/actions/menu-action.ts:5-11`:
    `interface MenuAction { id; label; icon: LucideIcon; tone: RowTone; disabled? }`.
  - `action-menu-item.tsx` draws the highlight with
    `layoutId="launcher-action-highlight"` and `SwapText` for the label.
- **Pattern to copy**: an action list is a pure function returning typed ids
  plus a hook that executes them. See
  `components/launcher/views/catalog-actions.ts` (`catalogActions(item)`,
  `CatalogActionId` union) and `views/use-catalog-menu.ts` (`open/close/run`,
  `useArmedConfirm`), and the widget equivalents
  `components/widgets/widget-actions.ts` (`widgetActions(hasResult)`) and
  `use-widget-menu.ts` (switch on `action.id`, `onFeedback("Copied CSV")`).
- **Ask view**: `components/ask/ask-view.tsx` (244 lines — already over the
  ~150-line bar; this plan must not make it longer, see Step 5). Keys come from
  `use-ask-keyboard.ts`: `⌘C` copy SQL (when no text selection), `⌘S` save,
  `⌘⇧S` save with inputs, `⌘E` toggle SQL, `⌘1…n` views. `⌘K` is unbound
  there. Save state is `useAskSave` (`components/widgets/use-ask-save.ts`,
  phases `idle|naming|saving|saved|finding|failed`). The answer lives in
  `state.answer: { result: CardResult & { executionTimeMs }, spec }`, the view
  in `state.view`, SQL in `state.sql`, dialect in `state.dialect`
  (`ask-reducer.ts:24-44`). Footer hints: `ask-footer-hints.ts`.
- **Widget run view**: `components/widgets/widget-run-view.tsx` mounts
  `ActionsMenu` with `widgetActions(...)` anchored on `RUN_HEADER_ID`, reserves
  `actionsMenuHeight` as body `minHeight`, and flashes feedback with
  `useFlashMessage` into the footer status.
- **Card**: `components/ask/ask-card.tsx` renders `<section aria-label={spec.title}>`;
  chart and pie views are Recharts 2.15.4 SVGs inside
  `<figure role="img">` (`card-chart.tsx:183`, `card-pie.tsx`). Series colors are
  CSS variables (`seriesColor` → `var(--chart-N)`, `lib/card-data.ts:70`;
  values in `index.css:32-37`, dark at `:101+`). KPI and table views are HTML.
- **Clipboard**: `lib/clipboard.ts` `copyText` (async Clipboard API, falls back to
  `execCommand("copy")` because WKWebView can refuse the async API on the
  `views://` scheme). `hooks/use-copy-feedback.ts` drives the SQL copy check.
- **CSV**: `lib/csv.ts` `tabularResultToCsv(result, options)`; `escapeCell`
  quotes on delimiter, `"` and `\n` but **not `\r`** (bug to fix here).
  `downloadCsv` is unused by app code.
- **Electrobun 2.0.6** (verified in `apps/app/.hutch/types/sdks/main/core/Utils.d.ts`):
  `clipboardWriteText(text)`, `clipboardWriteImage(pngData: Uint8Array)`,
  `showItemInFolder(path)`, `openFileDialog(opts)` (open only), and
  `paths.downloads`. **There is no save-file dialog.** `openFileDialog` would
  also blur the launcher, and blur sends `launcherDismiss`
  (`src/bun/launcher.ts:112-121`), hiding the panel mid-flow. So "Save CSV"
  writes to `~/Downloads` directly, Raycast-style, and offers "Show in Finder".
- **Boards**: `views/board-picker-view.tsx` needs a `widgetId`; the launcher
  pushes `{ kind: "board-picker", widgetId }` via `handleAddToBoard`
  (`launcher-panel.tsx:194`). An ask must therefore be saved as a widget before
  it can go on a board.
- **Bun RPC**: handlers live in `apps/app/src/bun/rpc.ts` (`wrapHandlers`
  encodes errors with `encodeRpcError`); the schema is
  `packages/rpc/src/schema.ts` `RpcSchema.requests`. Renderer wrappers are in
  `src/mainview/lib/ipc.ts`; the browser build answers requests from
  `lib/browser-ipc-stub.ts` and logs them to `globalThis.__omqIpcLog`.

## Commands you will need

| Purpose       | Command                                                   | Expected                    |
| ------------- | --------------------------------------------------------- | --------------------------- |
| App tests     | `bun run --cwd apps/app test`                             | all pass (both projects)    |
| One file      | `bun run --cwd apps/app test:browser <path>`              | pass                        |
| Unit only     | `bun run --cwd apps/app test:unit`                        | pass (never the only proof) |
| Coverage      | `bun run --cwd apps/app test:coverage`                    | ≥ 80% lines                 |
| Types / lint  | `bun run check-types`, `bun run check`                    | exit 0                      |
| e2e (browser) | `bun run --cwd apps/app e2e`                              | all pass                    |
| Desktop       | `bun run --cwd apps/app desktop:dev` + `cua-driver` skill | manual checks below         |

## Implementation rules relevant to this plan

- Strict TS: no `any`, no unsafe casts, no `@ts-expect-error` without a one-line why.
- zod at the bun edge for every new request (sizes, base64 shape, file name).
  **The renderer never sends a path.** Bun picks the directory, sanitizes the
  name, and only reveals paths it wrote itself.
- React 19: ref as a prop (never `forwardRef`), components ≤ ~150 lines, one
  per file, ≤ ~6 props, hooks own logic, no derived state synced in effects,
  hotkeys in a `useXxxHotkeys`/`useXxxKeyboard` hook.
- No code comments unless the why is non-obvious (one short line).
- Tests colocated: `*.test.ts` for pure logic (jsdom `unit` project),
  `*.browser.test.tsx` for components and hooks (vitest-browser-react). Snapshot
  the menu in its key states. 80% line coverage gate.
- Protected contracts are **not** changed: `CardSpec`, `AskEvent`
  (`packages/rpc/src/card-spec.ts`, `ask.ts`), `Widget`, `Board`. New RPC
  requests are additive.
- Brand voice: plain verbs ("Copy as CSV", "Copied 27 rows"), no exclamation,
  no sparkle iconography.

## Contracts added

In `packages/rpc/src/schema.ts` `RpcSchema.requests` (additive):

```ts
copyImage: { params: { pngBase64: string }; response: void };
saveToDownloads: {
  params: { baseName: string; extension: "csv"; content: string };
  response: { fileName: string; savedId: string };
};
revealSaved: { params: { savedId: string }; response: void };
```

`savedId` is an opaque id bun maps to the absolute path it wrote; the renderer
never sees or sends a path. Plan 015 reuses the bun `downloads.ts` module
(calling `save` bun-side with the `omq.json` extension) and `revealSaved`;
keep the module generic.

`MenuAction` gains an optional `keys?: readonly string[]` rendered as a
`KeyCombo` on the right of the item (so `⌘C` and `⌘S` are discoverable from the
menu). Existing actions without `keys` render unchanged.

## UI and motion (mandatory)

The motion system is `apps/app/src/mainview/lib/motion.ts` and
`components/motion/` (`Pressable`, `SwapText`, `Reveal`, `CheckDraw`). Use it;
do not hand-roll transitions. Tokens: `SPRING` (layout morphs, push/pop),
`SPRING_SNAPPY` (selection, menus), `SPRING_SOFT` (height/reveals), `FADE_IN`
160ms, `FADE_OUT` 110ms, `PRESS` scale 0.97 / 100ms, `STAGGER` 30ms capped at 6.
`useMotionPreset()` returns reduced-motion equivalents. Principles: respond on
press, everything interruptible (springs retarget, no input lockout), exit the
way you entered, animate only `transform`/`opacity`/`filter`, one primary
motion per moment, only progress indicators loop. A loading state under 150ms
is never shown; once shown it stays ≥ 300ms. Reduced transparency → opaque
surfaces; increased contrast → solid borders and promoted muted text. Focus
rings always visible; live regions announce outcomes, never frames.

| Moment                 | Trigger                       | What moves                                                                                                                                                                                                                           | Token                        | Reduced motion     |
| ---------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ------------------ |
| Menu opens             | `⌘K` or the card's `⋯` button | Existing `ActionsMenu`: scale 0.96→1 from the `⋯` button, opacity in. The body's reserved min-height grows via `layout` so the panel morphs once, not twice.                                                                         | `SPRING_SNAPPY`, `FADE_IN`   | Opacity only       |
| Highlight moves        | ↑/↓/hover                     | Shared `layoutId="launcher-action-highlight"` pill.                                                                                                                                                                                  | `SPRING_SNAPPY`              | Instant            |
| Menu closes            | Esc, `⌘K`, run an action      | Mirrors entry at exit speed; focus returns to the ask input.                                                                                                                                                                         | `FADE_OUT`                   | Opacity only       |
| Copied (text formats)  | Run a copy action             | Footer status `SwapText` → "Copied 27 rows as CSV" (2px rise, blur-in) for 1.6s. No card motion.                                                                                                                                     | `FADE_IN` via `SwapText`     | Crossfade          |
| Copying the chart      | Run "Copy Chart as PNG"       | If rendering exceeds 150ms, footer `SwapText` "Copying chart…" (min 300ms). On success the card's chart region gets a one-shot 1px amber ring, opacity 0→0.5→0 over 600ms, showing exactly what was copied; footer → "Copied chart". | `FADE_IN`, `FADE_OUT`        | No ring; text only |
| Saved CSV              | Run "Save CSV to Downloads"   | Footer `SwapText` "Saved revenue-by-region.csv" plus a "Show in Finder" text button that `Reveal`s beside it; `CheckDraw` draws once.                                                                                                | `FADE_IN`, `DRAW`            | Instant, no draw   |
| Save as Widget         | Menu or `⌘S`                  | Existing inline `NameField` expands under the header via `layout`.                                                                                                                                                                   | `SPRING_SOFT`                | Instant            |
| Add to Board (unsaved) | Menu                          | Same `NameField`, label "Name the widget to add". On confirm it collapses and the board picker pushes in.                                                                                                                            | `SPRING_SOFT`, then `SPRING` | Crossfade          |
| Action failed          | RPC error                     | Footer status `SwapText` in `text-danger-ink` ("The chart couldn't be copied."), `role="status"`.                                                                                                                                    | `FADE_IN`                    | Crossfade          |

Designed states: menu with an answer (all enabled), menu after an error with SQL
(only Copy SQL enabled), menu on a KPI/table view (no PNG row), menu in a widget
run view, the "Saved" footer, and the failure footer. Snapshot each.

## Scope

**In scope**

- `apps/app/src/mainview/lib/table-text.ts` (create) + `table-text.test.ts`:
  `toCsv`, `toTsv`, `toMarkdown` over `{ columns, rows }`, plus `exportBaseName(title)`.
- `apps/app/src/mainview/lib/csv.ts` + `csv.test.ts`: delegate to `toCsv`,
  fix `\r` quoting; delete `downloadCsv` if still unused.
- `apps/app/src/mainview/lib/chart-image.ts` (create) + `chart-image.browser.test.tsx`;
  `lib/chart-image-layout.ts` (create, pure) + `chart-image-layout.test.ts`.
- `apps/app/src/mainview/components/result-actions/` (create):
  `result-actions.ts` (pure list), `result-actions.test.ts`,
  `use-result-export.ts` (hook), `use-result-export.browser.test.tsx`,
  `card-actions-button.tsx` (the `⋯` button).
- `apps/app/src/mainview/components/launcher/actions/menu-action.ts`,
  `action-menu-item.tsx` (optional `keys`).
- `apps/app/src/mainview/components/ask/`: `ask-view.tsx`, `use-ask-keyboard.ts`,
  `ask-footer-hints.ts`, `ask-card.tsx` (accept `ref` on the section),
  `ask-body.tsx` (pass `ref` + `actions`), new `use-ask-actions-menu.ts`, tests.
- `apps/app/src/mainview/components/widgets/`: `use-ask-save.ts` (an
  `afterSave` intent), `widget-actions.ts`, `use-widget-menu.ts`,
  `widget-run-view.tsx`, `widget-run-body.tsx` (pass `ref`), tests.
- `apps/app/src/mainview/lib/ipc.ts`, `lib/browser-ipc-stub.ts` (new requests).
- `packages/rpc/src/schema.ts` (three requests).
- `apps/app/src/bun/downloads.ts` (create) + `downloads.test.ts`;
  `apps/app/src/bun/rpc.ts` (handlers).
- `apps/app/e2e/ask-flow.spec.ts` (extend) or `e2e/result-actions.spec.ts` (create).

**Out of scope**

- Board tile actions (`components/board/tile-actions.ts`). They can adopt
  `useResultExport` later; boards have their own window and focus rules.
- A native save panel. Electrobun 2.0.6 has none, and a modal would dismiss
  the launcher on blur.
- Excel/`.xlsx`, JSON export, or "Copy as SQL INSERTs".
- Any change to `CardSpec`, `AskEvent`, `Widget`, `Board`.
- Refine (plan 012) and history (plan 011).

## Git workflow

- Branch `feat/launcher-008-result-actions` from the current branch. Commit only
  if authorized; do not push or open a PR unless told to.

## Steps

### Step 1: Table text formats (pure)

`lib/table-text.ts`, input `TableLike = Pick<TabularResult, "columns" | "rows">`:

- `toCsv(table, { bom })`: RFC 4180. Quote a cell containing `,` `"` `\r` or `\n`;
  double inner quotes; `null`/`undefined` → empty; objects → `JSON.stringify`;
  booleans `true`/`false`; header row from `columns[].name`; lines joined with
  `\r\n` for files (`bom: true` adds `﻿` so Excel reads UTF-8) and `\n` for
  the clipboard. Make `lib/csv.ts`'s `tabularResultToCsv` call it so existing
  callers keep working.
- `toTsv(table)`: tab-separated, no quoting; tabs and newlines inside a cell
  become a single space (spreadsheet paste convention). Nulls empty.
- `toMarkdown(table)`: GitHub table. Escape `|` as `\|`, newlines → `<br>`,
  nulls → empty. Numeric columns (every non-null value is a `number`) get a
  right-aligned separator `---:`. Cap at the rows present (≤ 2,000; the ask and
  widget paths already cap rows).
- `exportBaseName(title)`: lower-case, runs of non `[a-z0-9]` → `-`, trimmed,
  ≤ 60 chars, fallback `"oh-my-query-result"`.

Tests: quoting matrix (comma, quote, CR, LF, tab, pipe, unicode, emoji), nulls,
JSON cells, empty result (header only), numeric alignment detection, BOM on/off.

### Step 2: Chart → PNG in the webview

Why this approach: the chart is an inline Recharts SVG whose colors and fonts
come from CSS variables and document fonts. Libraries such as `html-to-image`
wrap DOM in `<foreignObject>`, which taints the canvas in WebKit so `toBlob`
throws. Serializing the SVG itself (no `foreignObject`) keeps the canvas clean.

`lib/chart-image.ts` exports
`renderChartPng(input: { figure: SVGSVGElement; title: string; subtitle?: string; legend: { label: string; color: string }[]; scale?: number }): Promise<Uint8Array>`:

1. Clone the SVG. Walk original and clone in parallel; for each element copy the
   **computed** `fill`, `stroke`, `stroke-width`, `stroke-opacity`,
   `fill-opacity`, `opacity`, `font-size`, `font-weight` onto the clone as
   attributes (this resolves `var(--chart-N)` and `currentColor`). Drop
   `class` and event attributes. Remove the Recharts tooltip/cursor layers.
2. Inline the UI font so tick labels render in Mona Sans inside the
   sandboxed SVG image: import the latin `wght` normal woff2 from
   `@fontsource-variable/mona-sans/files/mona-sans-latin-wght-normal.woff2?url`
   (verify the exact file name in `apps/app/node_modules`), fetch it once,
   base64 it, cache the data URL in module scope, and add
   `<style>@font-face{font-family:"Mona Sans Variable";src:url(data:font/woff2;base64,…)}</style>`.
3. Serialize with `XMLSerializer`, load into an `Image` from a
   `data:image/svg+xml` URL, `await image.decode()`.
4. Canvas at `scale` (default `window.devicePixelRatio`, min 2). Paint an
   opaque background resolved from the panel's solid surface token (resolve
   through a probe element's computed `background-color`, so it follows the
   current theme). Draw title/subtitle and legend with `ctx.fillText` using the
   document's loaded fonts (`await document.fonts.ready`), then the chart image,
   positioned by `chartImageLayout` (pure, `lib/chart-image-layout.ts`:
   24px padding, title 15px/600, subtitle 12px, legend row 12px with 8px
   swatches, wrapping legend lines to the width).
5. `canvas.toBlob("image/png")` → bytes. Reject with a typed error if the blob
   is null or `toBlob` throws (`SecurityError`).

Only chart and pie views offer this action (they are SVG). KPI and table views
do not list it.

Tests: `chart-image-layout.test.ts` (wrapping legend, long titles truncated with
ellipsis, subtitle absent). `chart-image.browser.test.tsx` renders a real
`AskCard` from `test/card-fixtures.ts` in bar, line and pie views and asserts
the result starts with the PNG signature `89 50 4E 47 0D 0A 1A 0A`, its IHDR
width/height equal the layout size × scale, and a sampled background pixel is
opaque.

### Step 3: Bun side — clipboard image and Downloads

`apps/app/src/bun/downloads.ts`:

```ts
export const createDownloads = (deps: {
  dir: () => string;
  writeExclusive(path: string, content: string | Uint8Array): Promise<void>;
  reveal(path: string): void;
}) => ({ save, reveal });
```

- `save({ baseName, extension, content })`: zod-validate (`baseName` matches
  `/^[a-z0-9-]{1,60}$/` after re-running the same slug rule server-side;
  `extension` ∈ `["csv", "omq.json"]` — the RPC only lets the renderer pass
  `"csv"`; `"omq.json"` is for plan 015's bun-side export; `content` ≤ 20 MB). Build
  `<dir>/<baseName>.<ext>`; if it exists try `-2`, `-3`… up to 99, creating the
  file with an exclusive flag (`fs.open(path, "wx")`) so two saves never
  overwrite each other. Register the path under a random `savedId`
  (in-memory `Map`, last 20 entries). Return `{ fileName, savedId }`.
- `reveal(savedId)`: look the id up; unknown → `DbError("NOT_FOUND", …)`; else
  `Utils.showItemInFolder(path)`.

In `rpc.ts`, wire `dir: () => Utils.paths.downloads`, and add:

- `copyImage({ pngBase64 })`: zod `z.string().max(16_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/)`,
  decode with `Buffer.from(…, "base64")`, require the 8-byte PNG signature,
  then `Utils.clipboardWriteImage(new Uint8Array(bytes))`.
- `saveToDownloads`, `revealSaved` → the downloads module.

Add matching wrappers to `lib/ipc.ts` and stub them in `lib/browser-ipc-stub.ts`
(record the call in `__omqIpcLog`; `saveToDownloads` returns
`{ fileName: "<baseName>.csv", savedId: "stub" }`).

Tests (`downloads.test.ts`, unit project, temp dir): slug and extension
validation, collision suffixes, exclusive create (pre-existing file untouched),

> 20 MB rejected, `reveal` of an unknown id rejected, `reveal` of a known id
> calls the injected `reveal` with the saved path. Add a `copyImage` handler test
> for the bad-signature rejection if the handler is extracted into a testable
> function (prefer extracting `decodePng(base64): Uint8Array` into
> `downloads.ts` or a sibling and testing it).

### Step 4: The shared action list and executor

`components/result-actions/result-actions.ts`:

```ts
export type ResultActionId =
  | "copy-sql" | "copy-csv" | "copy-tsv" | "copy-markdown"
  | "copy-png" | "save-csv" | "save-widget" | "add-to-board";
export interface ResultAction extends MenuAction { id: ResultActionId }
export const resultActions = (ctx: {
  hasSql: boolean; hasRows: boolean; view: CardViewKind | null;
  surface: "ask" | "widget";
}): ResultAction[]
```

Order: Copy SQL (`keys: ["⌘","C"]`), Copy as CSV, Copy as TSV, Copy as
Markdown, Copy Chart as PNG (only when `view` is `bar|line|area|pie`), Save CSV
to Downloads, then for `surface: "ask"` only: Save as Widget… (`⌘S`), Add to
Board…. Data actions are `disabled` without rows. Icons from `lucide-react`
(`ClipboardCopyIcon`, `FileSpreadsheetIcon`, `TableIcon`, `HashIcon` or
`FileTextIcon`, `ImageIcon`, `DownloadIcon`, `BookmarkPlusIcon`,
`LayoutGridIcon`).

`use-result-export.ts`:
`useResultExport({ table, title, figureRef, legend, onFeedback })` returns
`{ copy(format), copyChart(), saveCsv(), revealLast() , lastSaved }`. It uses
`copyText` for text formats, `renderChartPng` + `copyImage` for PNG (with the
150ms/300ms "Copying chart…" rule via the existing `useDelayedVisibility`
hook), and `saveToDownloads` with `toCsv(table, { bom: true })`. Feedback
strings: "Copied 27 rows as CSV" (append " · first 2,000 rows" when
`isTruncated`), "Copied chart", "Saved revenue-by-region.csv". Errors become
"The chart couldn't be copied." / "The file couldn't be saved." plus the RPC
message when it is user-meaningful.

### Step 5: Ask view menu

- New `components/ask/use-ask-actions-menu.ts` owns `open/close/toggle/run`
  for the ask view (same shape as `use-widget-menu.ts`). It maps
  `save-widget` → `saving.beginNaming()`, and `add-to-board` → if
  `phase.kind === "saved"` push the board picker with `phase.widget.id`, else
  begin naming with an `afterSave: "board"` intent.
- `use-ask-save.ts`: `beginNaming(intent: "save" | "board" = "save")`; after a
  successful save with intent `"board"`, call a new `onSavedForBoard(widgetId)`
  option. `AskView` receives `onAddToBoard` from `launcher-panel.tsx` (it
  already exists as `handleAddToBoard`) — add it to `AskViewProps`.
- `use-ask-keyboard.ts`: `⌘K` → `onToggleActions()`. Keep all existing keys.
  `ask-footer-hints.ts`: add `{ keys: ["⌘","K"], label: "Actions" }` when the
  view has an answer (place it first; drop "Views" hint before the panel's
  footer overflows — check the widest case).
- `ask-card.tsx`: accept `ref?: Ref<HTMLElement>` on the `<section>`; the
  export hook finds `figure svg` inside it. `ask-body.tsx` passes `ref` and an
  `actions` slot containing `CardActionsButton` (a `Pressable` `⋯` with
  `aria-haspopup="menu"`, `aria-expanded`, id used as the menu `anchorId`).
- Mount `ActionsMenu` in the scrolling body like `widget-run-view.tsx:202-213`,
  reserving `actionsMenuHeight(actions.length)` as min-height while open. On
  close, focus returns to the ask input.
- Keep `ask-view.tsx` from growing: move the naming-field wiring
  (`attachField`/`closeNaming`/`confirmName`, lines 100–120) into a
  `useAskNamingField` hook or similar so the file ends no longer than today.

### Step 6: Widget run view uses the same actions

Replace `widgetActions`' `copy-sql`/`copy-csv` with the shared
`resultActions({ surface: "widget", … })` items, followed by the widget-only
items (Edit Inputs, Rename, Duplicate, Add to Board, Delete). Keep
`WidgetActionId` as the union of `ResultActionId` (minus ask-only ids) and the
widget ids so the switch in `use-widget-menu.ts` stays exhaustive. Pass the
card `ref` through `widget-run-body.tsx`. Copy SQL keeps using
`outcome.compiledSql ?? widget.sqlTemplate` (markers, never inlined values).

## Test plan

- Unit: `table-text.test.ts`, `csv.test.ts` (CR fix), `chart-image-layout.test.ts`,
  `result-actions.test.ts` (each surface/view/rows combination, ordering,
  disabled flags), `apps/app/src/bun/downloads.test.ts`.
- Browser (model after `components/widgets/widget-run-view.browser.test.tsx`
  and `components/ask/ask-save.browser.test.tsx`; IPC via `mockIpc` from
  `src/mainview/test/ipc-mock.ts`):
  - `⌘K` opens the menu on an answered ask; ↓/↵ runs; Esc returns focus to the input.
  - Copy CSV/TSV/Markdown put the expected text on the clipboard (spy on
    `navigator.clipboard.writeText`) and show the footer feedback.
  - Copy Chart as PNG calls `copyImage` with a base64 PNG (signature check);
    absent on KPI and table views; failure shows the danger footer.
  - Save CSV calls `saveToDownloads` with `extension: "csv"` and a BOM'd body;
    "Show in Finder" calls `revealSaved` with the returned id.
  - Save as Widget opens the name field; Add to Board on an unsaved answer
    saves, then pushes the board picker with the new widget id; on a saved
    answer it pushes immediately.
  - After an error with SQL only Copy SQL is enabled.
  - Widget run view lists the shared items and still copies compiled SQL.
  - Both motion branches (`MotionConfig reducedMotion="always"` vs default) for
    the PNG ring and the saved footer.
  - Snapshots: menu on chart view, menu on table view, error-state menu,
    widget run menu, saved footer.
- e2e (browser stub): ask "revenue by region", `⌘K`, choose "Copy as Markdown",
  assert the footer; `⌘K` → "Save CSV to Downloads", assert `__omqIpcLog`
  contains `saveToDownloads`.
- Verification: `bun run --cwd apps/app test` → all pass including the new files.

## Done criteria

- [ ] `bun run check-types`, `bun run check`, `bun run --cwd apps/app test`
      (both projects) and `bun run --cwd apps/app e2e` pass; coverage ≥ 80%.
- [ ] `rg -n "path" packages/rpc/src/schema.ts` shows no renderer-supplied
      path in `saveToDownloads`/`revealSaved`; bun rejects names outside the slug rule.
- [ ] Desktop dev (`cua-driver`): ask a question, `⌘K` → Copy Chart as PNG,
      paste into Preview (`⌘N` from clipboard) and see the titled chart with
      Mona Sans ticks on an opaque background in both light and dark themes.
- [ ] Desktop dev: Copy as TSV pasted into Numbers lands in columns; Copy as
      Markdown pasted into a Markdown editor renders a table; Save CSV writes
      `~/Downloads/<title>.csv` (then `-2` on repeat) and "Show in Finder" reveals it.
- [ ] Desktop dev: Add to Board from an unsaved answer names, saves and opens
      the picker; the board shows the tile.
- [ ] `ask-view.tsx` is not longer than at the baseline (244 lines).
- [ ] Every row of the motion table is implemented with its token and its
      reduced-motion fallback, with a browser test per branch; recordings at 1×
      and 0.25× (`?slowmo=4`) from desktop dev are attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of ⌘K open → move → Copy Chart
      as PNG → close shows no frame over 16.7ms and only
      `transform`/`opacity`/`filter` animating (the PNG render itself happens
      off the animation; if it blocks a frame, move work after the menu exit).
- [ ] Reduce Motion, Reduce Transparency and Increase Contrast verified on the
      menu, footer feedback and PNG ring; designed states snapshotted.
- [ ] `git status` shows changes only in the in-scope files.

## STOP conditions

- `canvas.toBlob` throws `SecurityError` or returns `null` in the packaged
  WKWebView even without `foreignObject`. Do not add a screenshot or
  Screen-Recording path; ship the other actions, leave Copy Chart as PNG out,
  and report the WebKit version and error.
- `Utils.clipboardWriteImage` does not produce a pasteable image in Preview,
  Slack and Notes, or the RPC transport rejects a ~1 MB payload. Report the
  size limit observed; do not downscale below 2× without the owner's approval.
- The font cannot be inlined (asset URL not fetchable from `views://`). Report;
  falling back to the system font for tick labels needs owner approval because
  it breaks the type system.
- Supporting a different target directory or a save panel would require a
  native dialog that dismisses the launcher. Do not build one here.

## Maintenance notes

- `useResultExport` is the one place for result export; board tiles
  (`tile-actions.ts`) and history (plan 011) should adopt it rather than copy it.
- `downloads.ts` is shared with plan 015 (export JSON). Keep `extension` an
  allow-list; adding one is a deliberate change.
- Recharts upgrades can change SVG structure (tooltip layers, class names).
  `chart-image.browser.test.tsx` is the guard; re-run it on any Recharts bump.
- Plan 012 (refine) moves the answer card; the menu travels with the card, not
  the view.
- Deferred: a "Copy Ask Link" (`omq://ask?...`) item belongs to plan 017.
