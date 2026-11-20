# Validation: plan 010, id and email lookup

Date: 2026-11-19. Branch `feat/launcher-002-shell`, uncommitted, on top of
the uncommitted plans 001–009. Verdict: **partially verified**. Every automated
check passes. Step 0 (the desktop clipboard spike), the desktop checks of
Step 7, recordings, the Timelines trace and the accessibility toggles have not
been run.

## What was built

- **Classification (core).** `classifyLookupValue` (`lookup-value.ts`) reads a
  UUID (dashed, braced, quoted or 32 hex, lowercased), an email (kept as typed)
  or a positive int64. It strips one pair of wrapping quotes, brackets or
  braces and a `mailto:` prefix, and rejects line breaks and input over 320
  characters.
- **Probe planning (core).** `planLookupProbes` (`lookup-plan.ts`):
  - It picks candidate columns per Decision 4 with `columnKind`. That covers
    wrappers, size and sign suffixes, and SQLite affinity.
  - Each column is ranked key, then indexed, then scan. Ties go to an exact
    name, then the smaller table, then the name.
  - It skips unindexed columns on tables over 1M rows, ints too large for the
    column, and names that can't be bound (NUL, `{{`).
  - Caps: 40 probes and 25 tables.
  - Every template is `SELECT 1 … WHERE <quoted col> = {{value}} LIMIT 101`.
- **Lookup service (bun).** `lookup-service.ts`:
  - `LookupRequest` is parsed with zod. The value is re-classified at the edge
    (`LookupValueSchema` refine).
  - One lookup runs per connection, and a new one cancels the old.
  - Supported engines: postgresql, mysql, sqlite, duckdb and tsql. ClickHouse
    and non-SQL connections are refused with the Decision 1 copy.
  - Probes run 3 at a time. Each has a 3 s timeout (`raceWithCancel`, raced
    against abort for drivers that ignore the signal), inside a 15 s total
    budget.
  - Each probe is compiled with `compileSqlTemplate`, passes `assertReadOnly`
    (a failure stops the lookup with `FAILED`), and runs with
    `{ readOnly: true, params }`.
  - Nothing is written to history. Logged driver errors replace the value with
    `[value]`.
- **Match runs (bun).** `SqlRunSource` gains `match`.
  - `ask-service.ts` re-checks that the schema, table and column exist in the
    cached schema and that `lookupKindFits` holds. Otherwise it reports "This
    table changed since the search. Search again."
  - It then builds `SELECT * … = {{value}} LIMIT 50`, compiles it, and runs it
    through `runSql`. `runSql` gained an optional `params` that it passes to
    the execute port. `AskEvent` is unchanged.
- **Clipboard offer (bun).**
  - `createClipboardOffer` returns `null` without reading in three cases: the
    setting is off, a concealed, transient or auto-generated pasteboard marker
    is present, or the pasteboard types are unknown.
  - Otherwise it classifies the first 320 characters. Only the classified value
    leaves bun.
  - `launcher.ts` sends it in `launcherShown` through `summonPayload`. If the
    offer throws, the payload is `clipboard: null` and the window still shows.
  - The setting is cached in memory (`setClipboardLookups` updates it), so
    summoning never waits on disk.
- **Renderer.**
  - The search input now carries `lookup`.
  - Root sections:
    - "Look up" goes above Ask for a UUID or email, and below Ask for an
      integer.
    - "From clipboard" goes above Recent, and only while the query is empty.
    - The footer shows "Find".
  - `LookupView` is owned above the stack through `useLauncherLookup`, so
    results survive opening rows. It contains:
    - a read-only value token;
    - a status line, a progress hairline and a polite live region;
    - the ranked hit rows, which show the count, or "100+" when capped;
    - designed empty, error and stopped states.
  - Keys: ↑/↓, ↵ opens rows, Esc stops then pops, ⌘C copies the value.
  - The `match` answer has the heading "Matching rows" and an empty draft.
    ⌘S and ⌘⇧S do nothing, and the Save footer hint is hidden.
  - Settings has a "Suggest lookups from the clipboard" row with loading, read
    error with retry, and save error states.
  - The browser stub replays the plan's demo values, plus `slow@example.com` for
    the stop flow. `__omqSetClipboard(text)` feeds the next summon.

## Step 0 and the clipboard default

**Step 0 was not run** (owner-only: desktop). A static finding replaces part of
it:

- Electrobun 2.0.6's `Utils.clipboardAvailableFormats()` only ever returns
  `text`, `image`, `files` or `html` (the type docs, and the strings in
  `libNativeWrapper.dylib`). So the `org.nspasteboard.*` markers are **not
  visible** through it. That is the plan's STOP condition for the clipboard.
- Rather than drop the feature or read without a password check, the formats
  come from a new `pasteboard-types-native.ts`. It reads the real
  `NSPasteboard.types` through objc FFI, using the same pattern as
  `app-hide-native.ts`. If the native read is unavailable it returns `null`, and
  the offer then refuses to read (it fails closed).
- This was verified with `bun` on a **private named pasteboard**; the owner's
  clipboard was not touched:
  - empty: `[]`;
  - a concealed item:
    `["public.utf8-plain-text","NSStringPboardType","org.nspasteboard.ConcealedType"]`;
  - plain text: no marker.
  - Timing: 1.07 ms on the first call after setup and 0.014 ms warm, against
    the 20 ms stop line.
- **Default: off** (`DEFAULT_CLIPBOARD_LOOKUPS = false` in
  `@oh-my-query/rpc`). This is the plan's fallback while it is unknown whether
  macOS prompts. Flip it to `true` if Step 0 shows no prompt.
- Still needed from the owner:
  - Step 0 on the desktop: is there a prompt or banner, and how long does
    `clipboardReadText` take inside `show()`?
  - A password-manager copy, to confirm the concealed marker shows up in the
    live app.

## Adaptations from the plan

- The new `pasteboard-types-native.ts` (see above) is outside the planned file
  list. It is the only way to honour "skip concealed items" on Electrobun 2.0.6.
- `summon-payload.ts` is the small pure helper for the `launcher.ts` wrapper, as
  the plan suggested.
- `lookupKindFits` (core) is the single owner of "does this value kind fit this
  column", and is used by the `match` re-check.
- `LookupSkips` is exported from `@oh-my-query/core/client` (type only), so the
  RPC contract and the renderer don't import the server entry.
- The lookup and clipboard rows are placed in `root-items.ts`
  (`buildRootSections`), which owns search mode. `mode-items.ts` covers only
  the prefix modes.
- The view is split into more files than listed:
  - `lookup-progress.tsx`, `lookup-results.tsx` and `lookup-footer.ts`;
  - `lookup-message.tsx`, which covers both empty and error, instead of
    `lookup-empty.tsx`.
- **Copy wording.**
  - The stop status reads "Stopped · 6 of 14 columns", and the failure note
    "2 columns didn't answer in time". Progress counts probes, which are
    columns, so "tables" would be inaccurate.
  - The empty-state note says "Exact match. Emails are compared as typed." for
    emails, and "Exact match only." otherwise.
- `askFooterHints` takes `canSave` instead of `viewCount`. This keeps
  `ask-view.tsx` at 244 lines.
- **⌘K on a `match` answer.** "Save as widget" and "Add to board" are
  disabled, through the existing `canSave: false` path from 008, rather than
  removed from the menu.
- **File lengths.** `launcher-panel.tsx` grew from 325 to 355 lines; the lookup
  wiring lives in `use-launcher-lookup.ts`. `root-view.tsx` is at 340 lines
  (the cap is 343).

## Evidence

| Check                                                                                                                                                | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check-types` (repo)                                                                                                                         | PASS: 14/14 tasks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `bun run check` (repo)                                                                                                                               | PASS: format clean, lint 0 warnings and 0 errors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `packages/core` vitest                                                                                                                               | PASS: 369. New: `lookup-value` (45) and `lookup-plan` (39). Every template compiles on postgresql, mysql, sqlite, duckdb and tsql with exactly one bound param and no raw value. Hostile names are quoted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `packages/rpc` vitest                                                                                                                                | PASS: 59. New `lookup.test.ts` covers each kind, misclassified, oversize and unknown kinds. `sql-run.test.ts` covers the `match` member.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `packages/agent` vitest                                                                                                                              | PASS: 186. `runSql` passes bound params to the execute port.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| bun: `lookup-service.test.ts` (16)                                                                                                                   | PASS. Covered: event order; `readOnly: true`, one bound param, `LIMIT 101` and no raw value on every execute; the 100 cap; peak concurrency of 3; a hung probe reported as `timeout` while the others finish; the budget producing `budgetExceeded`; supersede; `cancelLookup` stopping the scheduling; ClickHouse and Mongo refused; a guard failure giving `FAILED` with no execute; `NO_CANDIDATES`; a missing connection; a misclassified value rejected; the value never logged.                                                                                                                                                                                                           |
| bun: `clipboard-offer.test.ts` (12)                                                                                                                  | PASS. With the setting off, concealed, transient or auto-generated markers, or unknown types, `readText` is never called. The 320-character cut is applied. Prose returns `null`. A throwing offer still shows the launcher.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| bun: `ask-service.test.ts` (+5)                                                                                                                      | PASS. A `match` run binds `["ada@example.com"]` with `LIMIT 50`. An unknown table, column or schema, or a kind that doesn't fit, never reaches the pool.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `bun run --cwd apps/app test:coverage`                                                                                                               | PASS: 126 files, 1087 tests, 95.34% lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `bun run --cwd apps/app test`                                                                                                                        | PASS (see final report)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Renderer browser tests                                                                                                                               | Lookup view in every state, with snapshots: planning, probing with hits, done with hits, done empty with skip notes, error, stopped. Keyboard: arrows, ↵, click, Esc stops and is then let through, ⌘C. Panel flow: the Find row comes first; hits stream in rank order; opening rows sends a `match` source; "Matching rows" appears; ⌘S opens no name field; Esc returns to intact results; Esc stops, then pops. Clipboard offer: shown with no `lookup` before ↵, hidden while typing, back on an empty query, forgotten after hide. Settings row: toggle, save error that puts the box back, read error with retry. `useLookup`: id filtering, supersede, cancel, a send failure, unmount. |
| `bun run --cwd apps/app e2e`                                                                                                                         | PASS: 19 of 19, including the new `lookup-flow.spec.ts` (4): UUID gives 3 hits in order, then the rows, then back; a slow lookup stopped; a clipboard email offered with no `lookup` in `__omqIpcLog` before the click; "hello world" gives no offer                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `rg clipboardReadText apps/app/src`                                                                                                                  | Only `rpc.ts` (passed into `createClipboardOffer`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `rg navigator.clipboard.read apps/app/src`                                                                                                           | No matches                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Protected contracts                                                                                                                                  | `card-spec.ts`, `ask.ts` (`AskEvent`), `widget.ts` and `board.ts` not edited                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Native pasteboard types (bun, private pasteboard)                                                                                                    | PASS: the concealed marker is visible, about 0.014 ms warm                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Step 0 desktop spike                                                                                                                                 | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Step 7 desktop checks (fixture Postgres, a real id, a password-manager copy, setting off, budget on a large table, `pg_stat_activity` pile-up check) | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Recordings 1× / 0.25×, Timelines trace, Reduce Motion / Transparency / Contrast                                                                      | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## Motion table status

Each row has a full and a reduced-motion test branch.

- **Lookup row appears.** A `SectionEnter` wrapper uses `layout="position"`
  with the `SPRING` token and fades opacity from 0 to 1 with `FADE_IN`.
  Reduced motion starts it at opacity 1, so it is instant. Tested through
  `data-motion` set to fade or instant.
- **Clipboard offer.** `RevealWhenChanged` (slot `clipboard`, keyed by the
  value) uses `FADE_IN`. **Reduced motion is the shared `Reveal`'s 120 ms
  crossfade, not instant**, the same as Recent.
- **Open lookup and Open rows.** These use the standard stack push with
  `SPRING`. Reduced motion is the existing crossfade.
- **Progress.** A 2 px `bg-primary` hairline with `scaleX = done / total`,
  `originX: 0` and the `SPRING_SOFT` token. Reduced motion uses
  `duration: 0`, so the bar jumps per step. It exits with `FADE_OUT`, or
  instantly under reduced motion.
- **Hit arrives.** Rows use `LauncherRow`, with `layout` (`SPRING`) and an
  opacity fade (`FADE_IN`). `AnimatePresence initial={false}` means a row never
  re-enters when you come back. **Reduced motion is `LauncherRow`'s shared
  crossfade, not an instant insert.** The count is not faded separately from
  its row.
- **Done and Stop.** The status line swaps with `SwapText`, and the hairline
  fades out and stays where it stopped. Reduced motion is `SwapText`'s
  crossfade.
- **Empty.** Uses `Reveal`.

Three rows use a short crossfade instead of the table's "Instant" under reduced
motion, because they reuse the shared primitives. The plan's principles allow
crossfades; the owner can ask for a strict instant variant.
