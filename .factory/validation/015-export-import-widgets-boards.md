# Validation: plan 015, export and import widgets and boards

Date: 2026-11-20. Built on `05d0542` (`feat/launcher-002-shell` content) in an
isolated worktree, uncommitted. Verdict: **partially verified**. Every
automated check passes. The desktop checks, recordings, the Timelines trace and
the accessibility toggles have not been run.

## What was built

- **Bundle contract** (`packages/rpc/src/bundle.ts`, exported from `index.ts`).
  - `Bundle` v1 exactly as the plan states: `format: "oh-my-query.bundle"`,
    `version: 1`, `exportedAt`, `connections` (≤ 50, `{ ref, name, type }`),
    `widgets` (≤ 200), `boards` (≤ 50, tiles ≤ 24). `superRefine` rejects a
    repeated ref within a kind and any `connectionRef` or `widgetRef` that
    doesn't resolve. Unknown keys are stripped, so a hand-added `password` or
    `lastValues` never reaches a store.
  - `buildBundle` assigns `c1…`/`w1…`/`b1…`, keeps only the connections the
    exported widgets use, strips `spec.insight`, drops `sharedValues`, ids,
    timestamps, `lastValues` and `lastRunAt`, and drops tiles whose widget is
    outside the export.
  - `readBundleText(text, source)`: BOM strip, 2 MB cap before `JSON.parse`,
    "isn't an export" for non-JSON or another `format`, "newer version" for
    `version > 1`, otherwise the first zod issue as `widgets[2].sqlTemplate: …`.
  - `planImport` (same-type candidates, case-insensitive name match, else the
    only candidate, else none; duplicates by name + suggested connection +
    whitespace-collapsed template) and `draftsFromBundle` (new tile ids, empty
    `lastValues`/`sharedValues`, tiles only for imported widgets).
  - RPC: `exportBundle`, `previewImport`, `applyImport` (additive in
    `schema.ts`).
- **Bun service** (`apps/app/src/bun/bundle-service.ts`).
  - Export scopes all / widget / board; `file` goes through the existing
    `downloads.ts` (plan 008 had landed, `omq.json` was already in its
    allow-list) as `oh-my-query-<slug>-<yyyymmdd>.omq.json`; `clipboard` uses
    `Utils.clipboardWriteText`.
  - `previewImport` reads the clipboard or a picked file through
    `readTextUpTo(path, 2 MB)` (stat before read), then `readBundleText` and
    `planImport`. Candidates carry only `{ id, name, type }`.
  - `applyImport` re-parses the whole request with zod, checks each mapped id
    is a local connection of the bundle connection's type, then saves widgets
    one by one through `widgetService.saveWidget` (read-only guard + template
    compile) and boards through `boardService.saveBoard`. Failures are
    collected (`NOT_READ_ONLY` → "Its SQL would change data, so it wasn't
    imported.") and the rest continue. Imports never pass an id, so every
    record is new.
- **Launcher modal guard** (`launcher.ts`, `launcher-blur.ts`).
  `LauncherController.runModal` sets `modal`, drops always-on-top, awaits the
  panel, then restores always-on-top, activates the window and clears `modal`.
  The blur decision is the pure `blurResponse({ visible, rendererReady, modal })`.
  `pickFile` passes `allowedFileTypes: "json"`, `canChooseDirectory: false`,
  `allowsMultipleSelection: false`, starting in Downloads.
- **Renderer** (`components/bundle/`).
  - Root commands "Export Widgets and Boards" and "Import Widgets and Boards…";
    catalog actions "Export Board" and "Export Widget".
  - `useExport` flashes the root footer for 6 s ("Exported 6 widgets, 2
    boards" with a drawn check and a "Show in Finder" button that calls
    `revealSaved`), or the error. `useFlashMessage` gained an optional
    duration and a generic payload.
  - Import view (`{ kind: "import" }`) driven by `import-reducer.ts`:
    `choose → reading → review → importing → done`, plus `invalid` and
    `error`. Review: one radiogroup per bundle connection (←/→ or click),
    one checkbox per widget (Space; "Already here" duplicates start off;
    widgets of a skipped connection read "Choose a connection" and can't be
    turned on), ⌘E expands the full SQL (and any select input's options
    query), one "Import boards" toggle with "N of M tiles". ⌘↵ imports;
    the summary lists "Didn't import" and "Skipped" with reasons; Done returns
    to root with the first imported widget selected and pulsing.

## Adaptations from the plan

- **Plan 018 had not landed** (no `packages/rpc/src/source.ts`), so v1 is
  exported from top-level `connectionId`/`dialect`/`sqlTemplate`.
- **Plan 008 had landed**, so `downloads.ts` is reused unchanged.
- **`ImportResult` gains `importedWidgetIds`** (additive) so the launcher can
  mark the first imported widget fresh, and `ImportIssue` gains
  `kind: "widget" | "board"` so the summary can say which. The invalid
  preview folds the issue path into `message` instead of adding a field.
- **Unmapped and unchecked widgets are skipped by the service** with a reason
  ("No connection chosen", "Not selected"); a board whose tiles all dropped is
  skipped ("None of its widgets were imported"); boards turned off are listed
  as skipped. A board that was empty in the export still imports.
- **Widgets whose connection no longer exists are left out of an export**: the
  file couldn't say which engine they need.
- **Exports over the limits fail early** ("An export holds up to 200 widgets…
  Export a board instead.") and an export with nothing in it fails with
  "There's nothing to export yet."
- **Checkboxes are native** (`sr-only` input inside a label) to satisfy
  `prefer-tag-over-role`; Space toggles and Enter doesn't.
- **Extra files** to keep units small: `bundle-labels.ts`, `import-checkbox.tsx`,
  `import-boards-row.tsx`, `import-footer.tsx`, `export-status.tsx`,
  `views/root-status.tsx`, `lib/browser-bundle-stub.ts`, `test/bundle-fixtures.ts`.
- `SqlBlock` gained an optional `label` (default "Generated SQL") so the
  expanded SQL is announced as "SQL for {widget}".
- The e2e seeds the widget instead of saving one through an ask (the save path
  is covered by `widget-flow.spec.ts`), then adds it to a board, exports,
  deletes both through the UI, imports and finds both again.

## Motion table

| Moment           | Implementation                                                                                                                                 | Reduced motion                     | Test                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------- |
| Exported         | `ExportStatus`: fade/blur in, `CheckDraw` (`DRAW`), `SwapText`, "Show in Finder" `Reveal` after `DRAW`                                         | instant (no blur/offset, no delay) | `root-view-boards` export tests    |
| Open Import      | stack push via existing `StackViewFrame` (`SPRING`)                                                                                            | existing crossfade                 | `launcher-import-flow`             |
| Reading          | `ProgressHairline` in the row's trailing slot behind `useDelayedVisibility` (150 ms / ≥ 300 ms)                                                | static bar                         | `import-view` "reading hairline"   |
| Review appears   | panel height via `LauncherSurface` layout (`SPRING_SOFT`); rows stagger (`staggerDelay`, cap 6) on `y` (`SPRING_SOFT`) and opacity (`FADE_IN`) | `initial={false}`, instant         | `import-motion` both branches      |
| Map a connection | pill `layoutId="import-map-<ref>"`, `SPRING_SNAPPY`                                                                                            | `{ duration: 0 }`                  | `import-view` remap tests          |
| Toggle a widget  | check fill/mark scale + opacity (`SPRING_SNAPPY`), row opacity 1 ↔ 0.5 (`FADE_IN`), footer `SwapText`                                          | `{ duration: 0 }`                  | `import-view` toggle tests         |
| Show SQL         | block enters with opacity + y, `layout` (`SPRING_SOFT`); rows below move with `layout="position"`                                              | instant                            | `import-motion` both branches      |
| Importing → done | footer `SwapText` "Importing…" behind the delay rule; summary `Reveal`; root `FreshPulse` via `markFresh`                                      | instant                            | `import-view` importing/done tests |
| Invalid file     | existing `ErrorNotice` (`Reveal`)                                                                                                              | existing                           | `import-view` invalid tests        |

Designed states snapshotted (`components/bundle/__snapshots__/import-view.browser.test.tsx.snap`):
source choice, reading, clipboard empty, invalid file, review with an unmapped
connection and duplicates off, review all mapped, importing, done with
failures and skips, done clean; plus the export flash
(`root-view-boards.browser.test.tsx.snap`).

## Commands

| Command                                | Result                                                  |
| -------------------------------------- | ------------------------------------------------------- |
| `bun run --cwd packages/rpc test`      | pass, 96 tests (26 new in `bundle.test.ts`)             |
| `bun run --cwd apps/app test`          | pass, 152 files, 1362 tests                             |
| `bun run --cwd apps/app test:coverage` | pass, 95.8 % lines overall; new renderer files 88–100 % |
| `bun run check-types`                  | pass (14 tasks)                                         |
| `bun run check`                        | pass, 0 warnings, 0 errors                              |
| `bun run --cwd apps/app e2e`           | pass, 22/22 (new `bundle-flow.spec.ts`)                 |

Security evidence: `bundle.test.ts` "never serializes credentials, ids,
timestamps, values or insights" (fixture with password, host, user, port,
database path, ids, `lastValues`, `lastRunAt`, `sharedValues`, insight);
"drops keys it doesn't know"; `planImport` "returns only id, name and type";
`bundle-service.test.ts` re-validation of the returned bundle, wrong-type and
missing connections, and a `delete from orders` widget failing while the others
import; the e2e asserts the IPC log never contains the seeded host or user.

## Not run (owner)

- Desktop dev: export all → `~/Downloads/oh-my-query-…omq.json`, grep it for
  the connection's host, user and password; "Show in Finder".
- Desktop dev: Import → From File… shows the system panel above the launcher,
  the launcher stays open behind it, and the chosen file shows the review
  (Step 4; the STOP condition applies if the panel can't sit above it).
  `allowedFileTypes: "json"` follows Electrobun's comma-separated extension
  format but was not observed on device.
- Desktop dev: a hand-edited bundle with `delete from orders` imports the rest
  and the summary says it would change data (covered at service level only).
- Desktop dev on a second profile: "analytics" maps by name, the board opens
  with its tiles and default inputs, widgets run.
- Recordings at 1× and 0.25× (`?slowmo=4`), a Safari Timelines trace of the
  review, Reduce Motion / Reduce Transparency / Increase Contrast.
- Contrast: unchecked rows sit at 0.5 opacity as the plan specifies; check
  their text against AA under Increase Contrast.

## Follow-ups

- A select input's `optionsSql` is shown before import and guarded when it
  runs (`assertReadOnly` + read-only execution), but `saveWidget` doesn't guard
  it at save time. Guarding it in `checkDraft` would reject such widgets at
  import too.
- Plan 018 must add bundle `version: 2` with `source`, keep reading v1, and
  extend the secrets test to MCP/HTTP fields.
