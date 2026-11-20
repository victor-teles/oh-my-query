# Plan 015: Export and import widgets and boards as a shareable file

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages/rpc/src packages/core/src apps/app/src`
> and `git status --short`. Plans 001–007 sit uncommitted in the working tree
> and are the baseline. Confirm `packages/rpc/src/widget.ts` `Widget` still has
> top-level `connectionId`, `dialect` and `sqlTemplate`. **If
> `packages/rpc/src/source.ts` exists, plan 018 has landed**: widgets then carry
> `source: Source` and a record version. Follow "Interaction with plan 018"
> below before writing any code. If plan 008 landed, reuse its
> `apps/app/src/bun/downloads.ts` (`saveToDownloads`/`revealSaved`) instead of
> creating it.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (imported SQL is untrusted input; import writes to the user's stores)
- **Depends on**: none. Must follow plan 018's `Widget` version if 018 lands first.
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19, on `feat/launcher-002-shell`
  with plans 001–007 implemented but uncommitted (the working tree is the
  baseline)

## Why this matters

A board someone built for "weekly revenue review" lives only on their machine.
Teams want to hand it to a colleague, keep it in a repo, or move it to a new
laptop. This plan exports widgets and boards to a small JSON file — SQL
templates, card specs, typed inputs and board layout — and imports it on
another machine by mapping each connection by name and engine. It never
carries credentials, hosts, result rows, last-used input values or the stored
insight sentence (that sentence describes old data). Imported SQL is treated as
untrusted: it is shown before import and passes the same read-only guard as any
saved widget.

## Current state

- **Contracts (protected)** — `packages/rpc/src/widget.ts:243-270`:
  `Widget { id, name, prompt, connectionId, database, dialect, sqlTemplate,
spec: CardSpec, view, params: ParamDef[] (≤6, unique names), lastValues,
createdAt, updatedAt, lastRunAt }` and `WidgetDraft` (same minus
  timestamps, optional `id`). `packages/rpc/src/board.ts:32-57`:
  `BoardTile { id, size, view?, widgetId }`, `Board { id, name, emoji?,
refresh, sharedValues, tiles (≤ 24), createdAt, updatedAt }`, `BoardDraft`.
  `CardSpec` (`card-spec.ts:67-74`) has optional `insight` (≤ 280 chars).
  **This plan does not change any of them**; the file format is its own
  versioned schema that maps to and from them.
- **Stores** — `packages/core/src/widgets.ts` (`createWidgetStore`),
  `boards.ts` (`createBoardStore`), both on `records.ts`'s encrypted
  `createRecordStore` (`widgets.enc`, `boards.enc` under
  `~/.config/oh-my-query/`).
- **Services** —
  - `apps/app/src/bun/widget-service.ts:354-368` `saveWidget(draft)`: parses
    `WidgetDraft`, runs `checkDraft` (read-only guard on the template with
    placeholders masked to `NULL`, then `compileSqlTemplate` with defaults),
    assigns id and timestamps. **Import must go through this**, never write
    the store directly.
  - `apps/app/src/bun/board-service.ts:83-96` `saveBoard(draft)` parses
    `BoardDraft`, stamps, saves and calls `onChanged` (broadcasts
    `boardChanged`).
- **Connections** — `packages/core/src/persistence.ts:68-88`
  `DatabaseConnection { id, name, type: string, host, port, database,
username, password, … }`. Bun reads them with `getConnections()` from
  `@oh-my-query/core`; `connection-access.ts` `findConnection(id)`. Renderer
  engine labels: `components/launcher/connections/connection-search.ts`
  `databaseTypeLabel`.
- **RPC** — schema `packages/rpc/src/schema.ts`, handlers
  `apps/app/src/bun/rpc.ts` (`createAppRpcs`, `wrapHandlers` encodes errors),
  renderer wrappers `src/mainview/lib/ipc.ts`, browser stub
  `lib/browser-ipc-stub.ts` (+ `browser-widget-stub.ts`, `browser-board-stub.ts`).
- **Electrobun 2.0.6** (verified in `apps/app/.hutch/types/sdks/main/core/Utils.d.ts`):
  `clipboardReadText(): string | null`, `clipboardWriteText(text)`,
  `openFileDialog({ startingFolder?, allowedFileTypes?, canChooseFiles?,
canChooseDirectory?, allowsMultipleSelection? }): Promise<string[]>` —
  its defaults are `allowsMultipleSelection: true` and
  `canChooseDirectory: true` (`.hutch/devkit/api/sdks/main/core/Utils.ts:220-227`),
  so pass both explicitly as `false`. `showItemInFolder(path)`,
  `paths.downloads`. There is **no save dialog**.
- **Launcher blur** — `apps/app/src/bun/launcher.ts:112-121`: a blur while
  visible sends `launcherDismiss`, and the renderer animates out and hides. The
  window is `setAlwaysOnTop(true)` (`:70`). A native open panel would therefore
  both hide behind the launcher and dismiss it. Step 4 adds a modal guard.
- **Launcher UI** — new screens are `LauncherView` variants
  (`components/launcher/use-launcher-stack.ts`) rendered in
  `launcher-panel.tsx` `renderView`. Root commands: `root-commands.ts`.
  Catalog ⌘K menu for boards/widgets: `views/catalog-actions.ts`
  (`CatalogActionId` union) + `views/use-catalog-menu.ts`. Connection chips used
  for rebinding a widget: `components/widgets/widget-error.tsx` (uses
  `ConnectionGlyph` + `Pressable`). Flash feedback: `hooks/use-flash-message.ts`.

## Commands you will need

| Purpose      | Command                                                   | Expected                 |
| ------------ | --------------------------------------------------------- | ------------------------ |
| RPC tests    | `bun run --cwd packages/rpc test`                         | pass                     |
| App tests    | `bun run --cwd apps/app test`                             | all pass (both projects) |
| One file     | `bun run --cwd apps/app test:browser <path>`              | pass                     |
| Types / lint | `bun run check-types`, `bun run check`                    | exit 0                   |
| e2e          | `bun run --cwd apps/app e2e`                              | all pass                 |
| Desktop      | `bun run --cwd apps/app desktop:dev` + `cua-driver` skill | manual checks below      |

## Implementation rules relevant to this plan

- **Never export:** passwords, usernames, hosts, ports, connection database
  paths, connection ids, widget/board ids, `lastValues`, `lastRunAt`,
  timestamps, board `sharedValues`, `spec.insight`, result rows. A test asserts
  the serialized export of a fixture with secrets in every field contains none
  of them.
- **Validate at the edge with zod**: the file/clipboard text is size-capped
  (2 MB) before `JSON.parse`, then parsed with the `Bundle` schema. Every
  widget then goes through `widget-service.saveWidget` (read-only guard +
  template compile). Boards go through `board-service.saveBoard`.
- **Imported SQL is shown before import.** No silent import.
- Imports always create new records with new ids; they never overwrite.
- Strict TS (no `any`, no unsafe casts), React 19 rules (≤ ~150-line
  components, one per file, ≤ ~6 props, hooks own logic, no derived state in
  effects, hotkeys in a `useXxxKeyboard` hook), no code comments unless the why
  is non-obvious, colocated tests, snapshots of every designed state, 80% line
  coverage.

## Contracts added (protected after this plan)

`packages/rpc/src/bundle.ts` (export from `index.ts`):

```ts
export const BUNDLE_FORMAT = "oh-my-query.bundle";
export const BUNDLE_VERSION = 1;
export const MAX_BUNDLE_BYTES = 2_000_000;

const Ref = z.string().regex(/^[a-z][0-9]{1,4}$/); // "c1", "w12", "b3"
export const BundleConnection = z.object({
  ref: Ref,
  name: z.string().trim().min(1).max(200),
  type: z.string().min(1).max(40),
});
export const BundleWidget = z.object({
  ref: Ref,
  connectionRef: Ref,
  name: Widget.shape.name,
  prompt: Widget.shape.prompt,
  database: Widget.shape.database,
  dialect: Dialect,
  sqlTemplate: Widget.shape.sqlTemplate,
  spec: CardSpec, // insight removed on export, ignored on import
  view: CardViewKind,
  params: Widget.shape.params,
});
export const BundleBoard = z.object({
  ref: Ref,
  name: Board.shape.name,
  emoji: Board.shape.emoji,
  refresh: RefreshInterval,
  tiles: z
    .array(
      z.object({
        widgetRef: Ref,
        size: TileSize,
        view: CardViewKind.optional(),
      })
    )
    .max(MAX_BOARD_TILES),
});
export const Bundle = z
  .object({
    format: z.literal(BUNDLE_FORMAT),
    version: z.literal(BUNDLE_VERSION),
    exportedAt: z.string(),
    connections: z.array(BundleConnection).max(50),
    widgets: z.array(BundleWidget).max(200),
    boards: z.array(BundleBoard).max(50),
  })
  .superRefine(/* refs unique per kind; every connectionRef and widgetRef resolves */);
```

The file extension is `.omq.json`. New RPC requests (additive):

```ts
exportBundle: {
  params: { scope: { kind: "all" } | { kind: "widget"; widgetId: string } | { kind: "board"; boardId: string };
            destination: "file" | "clipboard" };
  response: { widgets: number; boards: number; fileName: string | null; savedId: string | null };
};
previewImport: {
  params: { source: "clipboard" | "file" };
  response: { status: "cancelled" } | { status: "invalid"; message: string }
          | { status: "ready"; bundle: Bundle; plan: ImportPlan };
};
applyImport: {
  params: { bundle: Bundle; connectionMap: Record<string, string | null>; skipWidgetRefs: string[]; boards: boolean };
  response: ImportResult;
};
```

`ImportPlan` lists, per connection ref, the local candidates
(`{ id, name, type }` only — never credentials) and a suggested id; per widget,
`duplicateOfWidgetId` when an existing widget has the same name and the same
whitespace-normalized template on the suggested connection. `ImportResult` is
`{ widgets: number; boards: number; skipped: { ref; name; reason }[]; failed: { ref; name; reason }[] }`.

## Interaction with plan 018 (Widget sources)

Plan 018 replaces the widget's top-level SQL fields with `source: Source`
(`kind: "sql" | "mcp" | "http"`) through a versioned migration of `widgets.enc`.
The bundle schema is deliberately **decoupled** from the stored `Widget`
shape, so either order works:

- **015 lands first (expected):** export v1 as above. Plan 018 must then add
  bundle `version: 2` with `source` in place of `dialect`/`sqlTemplate`/
  `connectionRef`, keep accepting v1 (convert to `{ kind: "sql", … }`), and
  extend the "never export" test to MCP/HTTP fields (server ids, endpoint
  secrets, headers).
- **018 landed first:** export only widgets whose `source.kind === "sql"`,
  still as bundle v1 fields; list the others in the export result as skipped
  ("MCP and HTTP widgets can't be exported yet"). Boards drop tiles that point
  at skipped widgets. Import builds a v2 widget draft with
  `source: { kind: "sql", … }`. Do not invent a v2 bundle here.

## UI and motion (mandatory)

Use `apps/app/src/mainview/lib/motion.ts` and `components/motion/`. Tokens:
`SPRING` (push/pop, layout), `SPRING_SNAPPY` (selection, toggles),
`SPRING_SOFT` (reveals, height), `FADE_IN` 160ms, `FADE_OUT` 110ms, `DRAW`,
`STAGGER` 30ms capped at 6; `useMotionPreset()` for reduced motion. Respond on
press, interruptible springs, exit the way you entered, animate only
`transform`/`opacity`/`filter`, one primary motion per moment. A loading state
under 150ms is never shown; once shown it stays ≥ 300ms. Reduced transparency →
opaque; increased contrast → solid borders, promoted muted text; focus rings
always visible; outcomes announced in a live region.

| Moment           | Trigger                         | What moves                                                                                                                    | Token                      | Reduced motion |
| ---------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------- |
| Exported         | Export command / catalog action | Footer status `SwapText` "Exported 6 widgets, 2 boards" with a `CheckDraw`, then a "Show in Finder" text button `Reveal`s.    | `FADE_IN`, `DRAW`          | Instant        |
| Open Import      | Command                         | Stack push into the import view (two source rows).                                                                            | `SPRING`                   | Crossfade      |
| Reading          | Source chosen, > 150ms          | Row's trailing spinner hairline (≥ 300ms).                                                                                    | `FADE_IN`                  | Static         |
| Review appears   | Bundle parsed                   | Body morphs height (`LauncherSurface`); mapping rows then widget rows stagger in (cap 6).                                     | `SPRING_SOFT`, `STAGGER`   | Instant        |
| Map a connection | ←/→ or click a chip             | Selection pill moves between connection chips via `layoutId="import-map-<ref>"`.                                              | `SPRING_SNAPPY`            | Instant        |
| Toggle a widget  | Space / click                   | Check box fills and the row's opacity goes 1 ↔ 0.5; counts in the footer `SwapText`.                                          | `SPRING_SNAPPY`, `FADE_IN` | Instant        |
| Show SQL         | ⌘E on a widget row              | SQL block expands under the row via `layout`, collapses on repeat.                                                            | `SPRING_SOFT`              | Instant        |
| Importing → done | ⌘↵                              | Footer `SwapText` "Importing…" (delay rule), then the result summary `Reveal`s; new widgets pulse once in root (`markFresh`). | `FADE_IN`, `SPRING`        | Instant        |
| Invalid file     | Parse fails                     | `ErrorNotice` (from `components/ask/error-notice.tsx`) reveals with the reason.                                               | `SPRING_SOFT`              | Instant        |

Designed states: source choice, reading, clipboard empty ("The clipboard has no
oh-my-query export."), invalid file (reason + path of the first issue, e.g.
"widgets[2].sqlTemplate"), review with all mapped, review with an unmapped
connection (its widgets disabled and labelled "Choose a connection"),
duplicates defaulted off ("Already here"), importing, done with skips/failures,
done clean. Snapshot each.

## Scope

**In scope**

- `packages/rpc/src/bundle.ts` (create), `bundle.test.ts` (create),
  `index.ts`, `schema.ts`.
- `apps/app/src/bun/bundle-service.ts` (create) + `bundle-service.test.ts`;
  `apps/app/src/bun/rpc.ts`; `apps/app/src/bun/launcher.ts` (modal guard);
  `apps/app/src/bun/downloads.ts` (create only if plan 008 has not).
- `apps/app/src/mainview/lib/ipc.ts`, `lib/browser-ipc-stub.ts` (+ tests).
- `apps/app/src/mainview/components/bundle/` (create): `import-view.tsx`,
  `import-sources.tsx`, `import-review.tsx`, `connection-mapping-row.tsx`,
  `import-widget-row.tsx`, `import-summary.tsx`, `import-reducer.ts`
  (+ `.test.ts`), `use-import.ts`, `use-import-keyboard.ts`,
  `use-export.ts`, browser tests and `__snapshots__/`.
- `components/launcher/use-launcher-stack.ts`, `launcher-panel.tsx`,
  `root-commands.ts` (+ test), `views/catalog-actions.ts`,
  `views/use-catalog-menu.ts`, `views/root-view.tsx` (footer flash) and
  their tests.
- `apps/app/e2e/bundle-flow.spec.ts` (create).

**Out of scope**

- Changing `Widget`, `Board`, `CardSpec` or their stores.
- Exporting connections themselves (even without secrets) or creating
  connections on import.
- Merging/overwriting existing widgets ("update in place"), sync, or a
  team registry.
- Opening `.omq.json` by double-click (`fileAssociations` arrive through the
  `open-url` event; that belongs with plan 017's URL handling).
- MCP/HTTP sources (plan 018).

## Git workflow

- Branch `feat/launcher-015-bundles`. Commit only if authorized; do not push or
  open a PR unless told to.

## Steps

### Step 1: Bundle schema and pure transforms (`packages/rpc`)

In `bundle.ts`, besides the schemas:

- `buildBundle({ widgets, boards, connections, now }): Bundle` — assigns refs
  in order (`c1…`, `w1…`, `b1…`), includes only connections used by the
  exported widgets, strips `spec.insight`, drops board `sharedValues`, maps
  tile `widgetId` → `widgetRef` (tiles pointing at a widget not in the export
  are dropped). `connections` input is `{ id, name, type }[]` — the caller
  strips everything else before calling.
- `planImport(bundle, local: { id; name; type }[], existing: Widget[]): ImportPlan`
  — candidates are local connections with the same `type`; suggested is the
  candidate whose name equals the bundle name case-insensitively, else the
  only candidate, else `null`. Duplicate = same `name`, same suggested
  connection, and `sqlTemplate` equal after collapsing whitespace.
- `draftsFromBundle(bundle, connectionMap, skip): { widgets: { ref; draft: WidgetDraft }[]; boardDrafts(idByRef): BoardDraft[] }`
  — `lastValues: {}`; boards get `sharedValues: {}`, new tile ids
  (`crypto.randomUUID()` injected for tests), and keep only tiles whose widget
  imported.

Tests (`bundle.test.ts`): round trip `buildBundle` → `Bundle.parse` →
`draftsFromBundle` keeps SQL, params, spec (minus insight), view, tile sizes
and order; the **secrets test** (fixture connection with password/host/user,
widget with `lastValues` and `insight`, board with `sharedValues`) — the JSON
string contains none of those values; dangling `connectionRef`/`widgetRef`,
duplicate refs, unknown `format`, `version: 2`, 201 widgets, and a 25-tile
board are rejected; name match is case-insensitive; same-type single
candidate is suggested; duplicates detected despite whitespace differences.

### Step 2: Bun service

`apps/app/src/bun/bundle-service.ts`, with injected deps for tests:

```ts
createBundleService({
  widgets: Pick<WidgetService, "listWidgets" | "saveWidget">,
  boards: Pick<BoardService, "listBoards" | "getBoard" | "saveBoard">,
  connections(): Promise<{ id: string; name: string; type: string }[]>,
  downloads: { save(input): Promise<{ fileName; savedId }> },
  clipboard: { readText(): string | null; writeText(text: string): void },
  pickFile(): Promise<string | null>,
  readFile(path: string): Promise<string>,
  now(): Date,
})
```

- `exportBundle({ scope, destination })`: resolve scope (`all`; one widget;
  one board plus its widgets), `buildBundle`, `JSON.stringify(bundle, null, 2)`.
  `file` → `downloads.save({ baseName: "oh-my-query-<slug>-<yyyymmdd>", extension: "json", content })`
  (file name ends `.omq.json`; make the downloads module accept the compound
  extension `omq.json` in its allow-list); `clipboard` → `clipboard.writeText`.
- `previewImport({ source })`: read text (clipboard, or `pickFile()` →
  `null` means `{ status: "cancelled" }`), reject over `MAX_BUNDLE_BYTES`,
  `JSON.parse` in a try (→ `invalid`, "This isn't an oh-my-query export."),
  `Bundle.safeParse` (→ `invalid` with the first issue's message and dotted
  path), then `planImport`.
- `applyImport(request)`: re-parse the whole request with zod (the bundle came
  back from the renderer and is untrusted again); check every non-null
  `connectionMap` value is a local connection of the right `type`; save
  widgets one by one through `saveWidget`, collecting failures with the
  service's error message (e.g. a `NOT_READ_ONLY` template) and continuing;
  then save boards. Return counts, skipped and failed. Partial success is the
  contract: what imported stays imported, and the summary lists the rest.

`rpc.ts`: construct the service with the existing `widgets`/`boards` services,
`getConnections()` mapped to `{ id, name, type }`, `Utils.clipboardReadText`/
`clipboardWriteText`, `fs.readFile`, and
`pickFile: () => host.launcher()?.runModal(() => Utils.openFileDialog({ allowedFileTypes: "json", canChooseFiles: true, canChooseDirectory: false, allowsMultipleSelection: false, startingFolder: Utils.paths.downloads })).then((paths) => paths?.[0] ?? null)`.
Verify the `allowedFileTypes` format against the devkit implementation
(`.hutch/devkit/api/sdks/main/proc/native.ts` `openFileDialog`) — it may want
`"json"` or `"*.json"`.

Tests (`bundle-service.test.ts`, in-memory fakes like
`board-service.test.ts`): export scopes, clipboard vs file, cancelled pick,
oversize, invalid JSON, schema failure message, mapping to a wrong-type
connection rejected, a guard failure on one widget leaves the others imported
and reports it, boards drop tiles of skipped widgets, ids are always new.

### Step 3: Downloads module

If plan 008 landed, reuse `apps/app/src/bun/downloads.ts`. Otherwise create it
exactly as plan 008 Step 3 specifies (bun picks `Utils.paths.downloads`,
sanitized slug, extension allow-list, exclusive create with `-2…-99`
suffixes, opaque `savedId` for reveal, `saveToDownloads`/`revealSaved` RPC),
with the allow-list `["csv", "omq.json"]`.

### Step 4: Modal guard on the launcher

`LauncherController` gains `runModal<T>(open: () => Promise<T>): Promise<T>`:
set `modal = true` (the blur handler returns early while it is set), call
`window.setAlwaysOnTop(false)` so the system panel can sit above the launcher,
await `open()`, then in `finally` restore `setAlwaysOnTop(true)`,
`window.activate()`, and clear `modal`. The renderer's stack is untouched
because the window never hides. Add a pure test if the blur decision is
extracted (e.g. `shouldDismissOnBlur({ visible, rendererReady, modal })` in
`launcher-geometry.ts`'s style — a small pure module with a test).

### Step 5: Renderer

- Export:
  - Root commands "Export Widgets and Boards" (`DownloadIcon`, action label
    "Export", subtitle "Saves a .omq.json to Downloads") and "Import Widgets
    and Boards…" (`UploadIcon`, "Import").
  - Catalog actions: board → "Export Board", widget → "Export Widget"
    (`CatalogActionId` gains `"export-board" | "export-widget"`).
  - `use-export.ts` calls `exportBundle` and reports through a root footer
    flash (`useFlashMessage`; the root footer status shows the flash when
    present, otherwise `ConnectionStatus`), with "Show in Finder" calling
    `revealSaved`.
- Import view (`LauncherView` `{ kind: "import" }`), driven by
  `import-reducer.ts`:
  `choose → reading → review → importing → done`, plus `invalid` and
  `error`. `choose` lists "From Clipboard" (↵) and "From File…".
  `review` shows, in order:
  1. one `connection-mapping-row` per bundle connection: "analytics ·
     PostgreSQL" then chips for each candidate plus "Skip"; ←/→ move the
     selection when the row is focused;
  2. widget rows with a checkbox (Space), name, connection, param summary, and
     ⌘E to expand the full SQL (read-only `sql-block.tsx` from
     `components/ask/`); duplicates start unchecked with an "Already here" tag;
     widgets whose connection is skipped are disabled with "Choose a connection";
  3. boards (`{name} · N tiles`) with one "Import boards" toggle.
     Footer: action "Import 5 widgets, 1 board" `⌘↵`.
     `done` shows the summary, then ↵ returns to root with the first imported
     widget marked fresh (`useWidgets().markFresh`, `refresh()`); the board list
     reloads.
- Keyboard lives in `use-import-keyboard.ts`; Esc pops.

## Test plan

- `bundle.test.ts` and `bundle-service.test.ts` as above;
  `import-reducer.test.ts` (every transition, including `cancelled` returning
  to `choose`).
- Browser tests (model after `components/launcher/views/board-picker-view.browser.test.tsx`,
  IPC via `mockIpc`): export command flashes and reveals; catalog "Export
  Board" calls `exportBundle` with the board scope; import from clipboard →
  review; remap a connection with ←/→; uncheck a widget; ⌘E shows its SQL;
  ⌘↵ calls `applyImport` with the exact map and skips; done summary lists a
  failed widget; invalid bundle shows the reason; both motion branches for
  review stagger and SQL expand; snapshots of every designed state.
- e2e `bundle-flow.spec.ts` (browser stub; the stub's `exportBundle` writes to
  an in-memory "clipboard" and `previewImport` reads it): save a widget, add it
  to a board, export to clipboard, delete both, import, and see the widget in
  root and the board in the Boards section.
- Verification: `bun run --cwd packages/rpc test`, `bun run --cwd apps/app test`.

## Done criteria

- [ ] `bun run check-types`, `bun run check`, rpc tests, app tests (both
      projects) and e2e pass; coverage ≥ 80%.
- [ ] The secrets test passes, and a manual export from desktop dev, grepped
      for the connection's host, user and password, finds none of them.
- [ ] Desktop dev: export all → `~/Downloads/oh-my-query-…omq.json` appears and
      "Show in Finder" reveals it; Import → From File… opens the system panel
      above the launcher, the launcher stays open behind it, and choosing the
      file shows the review.
- [ ] Desktop dev: a hand-edited bundle whose widget template is
      `delete from orders` imports nothing for that widget and the summary says
      it would change data; the other widgets import.
- [ ] Desktop dev on a second profile (or after deleting the widgets): import
      maps "analytics" by name, the board opens with its tiles and default
      inputs, and widgets run.
- [ ] Every row of the motion table is implemented with its token and its
      reduced-motion fallback, with a browser test per branch; recordings at 1×
      and 0.25× (`?slowmo=4`) attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of import review (stagger,
      remap, SQL expand, import) shows no frame over 16.7ms and only
      `transform`/`opacity`/`filter` animating.
- [ ] Reduce Motion, Reduce Transparency and Increase Contrast verified; all
      designed states snapshotted.
- [ ] `git status` shows changes only in the in-scope files.

## STOP conditions

- The open panel cannot be shown above or alongside the launcher without the
  launcher hiding or losing its stack (Step 4 fails on desktop). Ship clipboard
  import only, keep "From File…" out, and report what happened.
- Plan 018 landed with a `Widget` shape this plan's "Interaction with plan 018"
  section does not cover (e.g. no `kind: "sql"` source). Stop and reconcile.
- Any requirement to export connection details beyond name and engine type
  (host, database file, user). That is a privacy decision for the owner.
- An import path that would write `widgets.enc`/`boards.enc` without going
  through `saveWidget`/`saveBoard`. Do not add one.

## Maintenance notes

- The bundle format is a public contract once files exist in the wild: never
  change v1's meaning; add `version: 2` and keep reading v1.
- Select inputs with a static `options` list are exported as-is; those lists
  can contain real values (e.g. customer names). If that becomes a concern,
  export only `optionsSql` and drop static lists that came from data.
- When plan 017 lands, `.omq.json` double-click can route through the
  `open-url` handler into `previewImport` with a file source.
- Board shared values are intentionally not exported; the importer sees each
  widget's defaults.
