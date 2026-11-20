# Validation: plan 008, act on an answer with ⌘K

Date: 2026-11-19. Branch `feat/launcher-002-shell`, uncommitted, on top of the
uncommitted plans 001–007. Verdict: **partially verified**. Every automated
check passes and the core desktop flows passed in the real app. Recordings, the
Timelines trace and the accessibility toggles have not been run.

## What was built

- **⌘K actions on the answer card.** A `⋯` button on the card (`CardActionsButton`)
  or ⌘K opens a menu: Copy SQL (⌘C), Copy as CSV, Copy as TSV, Copy as Markdown,
  Copy Chart as PNG (bar, line, area and pie only), Save CSV to Downloads,
  Save as Widget… (⌘S), and Add to Board…. Add to Board on an unsaved answer
  first asks for a name ("Name the widget to add"), saves, then opens the board
  picker.
- **Widget run view uses the same export actions** (`exportActions`), followed
  by its own actions. Copy SQL still copies the compiled SQL with its
  placeholders, never the input values.
- **Footer status (`ResultStatus`).** It reports results such as "Copied 27 rows
  as CSV", adding " · first N rows" when the result was truncated. Saved files
  show a drawn check, the file name and a "Show in Finder" button. Failures show
  in `text-danger-ink`, and "Copying chart…" appears only when copying takes
  longer than 150 ms.
- **Copied-chart ring (`CopiedRing`).** A one-time 1px amber ring around the
  card shows what was copied. It is omitted under reduced motion.
- **Bun side.**
  - `downloads.ts` writes only into `Utils.paths.downloads`. It re-slugs the file
    name, creates the file exclusively and adds `-2`…`-99` on collisions. It
    reveals only files it saved itself, looked up through an opaque `savedId`.
  - The renderer may only save `csv`; `omq.json` is reserved for plan 015, which
    saves from the bun side.
  - `clipboard-image.ts` validates the base64 input and checks for the PNG
    signature before calling `Utils.clipboardWriteImage`.
- **RPC (additive).** `copyImage`, `saveToDownloads` and `revealSaved`.
  `CardSpec`, `AskEvent`, `Widget` and `Board` are unchanged.

## Found and fixed during the desktop run

- **Markdown alignment.** Postgres returns `count(*)` as a bigint string, so
  "every value is a number" left `order_count` left-aligned. `toMarkdown` now
  uses the card's `isNumericColumn` (column type plus values); `columnValues` and
  `isNumericColumn` accept `Pick<CardResult, "columns" | "rows">`. Tests cover an
  `INT8` string column (right-aligned) and a text column of digits (left).
- **Footer overflow.** With five shortcut hints, the status had about 180pt, so
  "Saved number-of-orders-by-status.csv" showed as "Saved num" and the check mark
  shrank to a dot. While a result message is showing, `askFooterHints` now keeps
  only "Actions ⌘K", and the check mark is `shrink-0`. Verified in the app:
  "✓ Saved number-of-orders-by-status-3.csv · Show in Finder".

## Adaptations from the plan

- **`lib/csv.ts` and its test are deleted** rather than turned into a wrapper,
  because nothing calls them any more. The cases they tested now live in
  `lib/table-text.test.ts`, together with the fix for unquoted `\r`.
- **`toCsv(table, "file" | "clipboard")` replaces `{ bom }`.** The choice of
  line ending is tied to the BOM, so the target is named instead.
- **`AskCard` takes `slots` and `ref`.** It used to take an `actions` prop;
  `slots` holds `actions` and the new `overlay`. As a result, `WidgetRunBody`
  takes `slots`/`cardRef`, and `board-tile.tsx` changed by one line.
- **`renderChartPng` returns a `Blob`, not a `Uint8Array`.** `blobToBase64`
  encodes it for the RPC call.
- **The "Views" footer hint is dropped once "Actions" is shown**, so the footer
  doesn't overflow. The view toggle on the card is still visible.
- **`ask-view.tsx` is 229 lines** (the baseline was 244).
  - The menu moved to `ask-actions-layer.tsx` and `use-ask-actions-menu.ts`.
  - Focus and naming moved to `use-ask-input-focus.ts`.
  - The answer helpers moved to `ask-answer.ts`.
- **Design-hook ignore.** `design-system-font` for "Mona Sans Variable" is
  recorded in `apps/app/.impeccable/config.json`. CLAUDE.md declares it as the
  UI typeface.

## Evidence

| Check                                                                                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check-types`                                                                       | PASS (0 errors)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `bun run check`                                                                             | PASS (0 lint errors, formatted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `bun run --cwd apps/app test`                                                               | PASS on the final run: 854 of 854, 107 files. Two earlier full runs each had a different timing-only failure (`ask-save` "Finding inputs…" at 150/250 ms, and the `widget-run-view` skeleton snapshot at 150 ms). Both pass in isolation, three of three. See the note below.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `bun run --cwd apps/app test:coverage`                                                      | PASS: 95.02% lines overall                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `bun run --cwd apps/app e2e`                                                                | PASS: 10 of 10. New test: ⌘K → Copy as Markdown → footer status, and ⌘K → Save CSV → `__omqIpcLog` has `saveToDownloads` with `extension: "csv"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Chart → PNG (Chromium)                                                                      | PASS: `chart-image.browser.test.tsx` checks the PNG signature, the IHDR width (layout × 2) and an opaque corner pixel for bar, line and pie. I inspected rendered previews by eye (dark theme): Mona Sans ticks, title, subtitle and a wrapped legend.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Bun downloads and clipboard image                                                           | PASS: 16 unit tests (slug, collisions, exclusive create, 20 MB cap, extension allow-list, reveal of known ids only, PNG signature)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Desktop (`desktop:dev`, cua-driver, real OMQ Postgres + AI key), run 2026-11-19 22:15–22:23 | PASS for: ⌘K opens the menu over a real answer (8 actions, ⌘C/⌘S hints); **Copy Chart as PNG in the packaged WKWebView** puts `public.png` + TIFF on the system clipboard, 1580×652 at 2×, opaque dark background, Mona Sans labels, title, subtitle and legend, hover tooltip and cursor excluded (STOP condition cleared); Copy as TSV gives tab-separated rows; Copy as Markdown gives a GitHub table; Save CSV writes `~/Downloads/number-of-orders-by-status.csv`, then `-2`, `-3`, `-4` (BOM + CRLF verified with `od`); Add to Board on an unsaved answer shows "Name the widget to add", saves, and opens the board picker; the widget run view's Delete (two-step) works with the shared menu. |
| Desktop: Show in Finder                                                                     | PASS. Confirmed by the owner in the running app on 2026-11-19 (Finder opened with the saved CSV). The driven click had missed the button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Desktop: paste into Preview / Numbers apps, tile visible on a board                         | NOT RUN. Clipboard contents were verified directly instead; no tile was added to the owner's existing "Desk check" board.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Recordings at 1× and 0.25×, Timelines trace, Reduce Motion / Transparency / Contrast        | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Timing flake note

Each of the two failures above appeared in only one full run and passed in
isolation three of three times. Both tests assert on a 150 ms display delay
under `maxWorkers: 4`. Plan 008 adds 3 browser test files, including real PNG
rendering, which may add load. If CI hits these tests, the fix belongs in the
tests' timing (wait for the condition rather than a fixed delay), not in a
looser threshold.

## Owner to run

1. `desktop:dev`: ask "revenue by region", then ⌘K → Copy Chart as PNG, then
   paste with Preview's File > New from Clipboard. Check this in both light and
   dark themes. If WKWebView refuses the export, follow the STOP rule in the
   plan.
2. Copy as TSV and paste into Numbers. Copy as Markdown and paste into a
   Markdown editor. Save CSV twice and confirm `-2`, then use Show in Finder.
3. On an unsaved answer, choose Add to Board, name the widget, pick a board,
   and confirm the tile appears on it.
4. Recordings, a Timelines trace of ⌘K → Copy Chart → close, and the three
   accessibility toggles.
