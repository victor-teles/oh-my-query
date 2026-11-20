# Validation: plan 009, launcher input modes

Date: 2026-11-19. Branch `feat/launcher-002-shell`, uncommitted, on top of
the uncommitted plans 001–008. Verdict: **partially verified**. Every automated
check passes. The desktop checks (Step 8), recordings, the Timelines trace and
the accessibility toggles have not been run.

## What was built

- **`>` raw SQL.**
  - Typed SQL runs read-only on the active connection with no AI and no key.
  - It goes through a new bun request, `runSql` (`ask-service.ts` `startSqlRun`):
    `RunSqlParams` is parsed with zod, `assertReadOnly` runs in bun, and the query
    executes with `{ readOnly: true }`.
  - Results stream as the existing `AskEvent`s into the same ask view, headed
    "Your SQL" with "Run / Run again".
  - Raw runs are written to history but not added to Recent.
  - ⌘S saves a raw query as a widget with an empty `prompt`.
- **`#` table peek.**
  - A new `peekSchema` request (`schema-peek.ts`) returns the resolved schema,
    served from the 60 s cache.
  - The body has two fixed-height panes. On the left, tables ranked exact, then
    prefix, then fuzzy, with `schema.table` support and capped at 50. On the
    right, columns with type, primary-key glyph, nullable and `→ fk` target,
    plus indexes with a `unique` tag.
  - States: a skeleton (after 150 ms, kept at least 300 ms), an error with
    "Try again", "No tables in {schema}." and "No table matches …".
  - ⌘↓ focuses the column pane and Esc returns to the input.
  - The selected option points via `aria-describedby` at a one-line summary.
  - ↵ previews 50 rows through `runSql` with
    `previewSql(dialect, schema, table)` (core, quoted identifiers).
- **`@` connection.**
  - The chip dims (`tone: "pending"`) while you choose.
  - An exact name or unique name prefix followed by Space commits; Tab and ↵
    commit the selected row.
  - Committing activates the connection and clears the input.
- **Shared pieces.**
  - `parseLauncherInput` (one parser).
  - A mode badge with a polite live region ("SQL mode").
  - The placeholder "Search or ask… > SQL · # table · @ connection".
  - Notes for an empty `>`, no active connection ("Pick a connection to …") and
    non-SQL engines.
  - The AI-setup row is hidden in modes.
  - Pasted multi-line SQL is flattened, with `--` comments turned into `/* */`.

## Adaptations from the plan

- `run-query.ts` also holds `runToCompletion` and `resultEvent`, so `runAsk` and
  `runSql` share one phase-tracking and error-mapping path (no behavior change;
  all 176 existing agent tests unchanged and green).
- `runSql` checks for abort before emitting `sqlDone`, so a superseded run
  emits only `CANCELLED`.
- **`@` commits on connection names only.** The general connection search also
  matches host and database, which made prefixes ambiguous.
- **Connection-mode footer.** It shows "Switch ↩" without a duplicate "⇥ Switch"
  hint; Tab still commits.
- **`root-view.tsx` is 327 lines** (the cap is 343). The logic moved out to:
  - `use-root-sections.ts`: input parsing, sections, the table catalog.
  - `root-body.tsx`: which body to render for the mode.
  - `use-root-run.ts`: running an item.
  - `use-connection-token.ts`: the `@` commit.
  - `root-item-row.tsx`: the per-kind row switch, taken from `root-list.tsx`.
- `ask-view.tsx` stayed at 244 lines (the draft logic is in `ask-draft.ts`).
- SQL token colours moved from `sql-block.tsx` to `lib/sql-highlight.ts`
  (`SQL_TOKEN_CLASSES`), shared with the SQL row.
- The table body was split into `table-mode-body.tsx` (states),
  `table-panes.tsx` and `table-message.tsx` to stay under ~150 lines.
- **Hardened a pre-existing racy test.** `ask-view.browser.test.tsx` "designed
  states" snapshots could catch a `SwapText` mid-swap ("SQL" → "PostgreSQL");
  the test now waits for swaps to settle, and the snapshots now hold resting
  states.

## Evidence

| Check                                                                                                                               | Result                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check-types`, `bun run check`                                                                                              | PASS                                                                                                                                                                                                                                                                                                                              |
| `packages/core` tests                                                                                                               | PASS: 285, including 25 new `sql-identifiers` tests (every dialect, a hostile name, NUL and empty name, each limit form)                                                                                                                                                                                                          |
| `packages/agent` tests                                                                                                              | PASS: 185, including 9 new `run-sql` tests; the guard refuses `delete` and `select 1; select 2` before `execute`                                                                                                                                                                                                                  |
| `packages/rpc` tests                                                                                                                | PASS: 43, including `RunSqlParams` bounds                                                                                                                                                                                                                                                                                         |
| bun: `ask-service.test.ts`, `schema-peek.test.ts`                                                                                   | PASS. Raw runs never call `loadModel`; a refused statement never reaches `pool.execute`; `readOnly: true` is passed; supersede and `cancelAsk`; Redis gets "Running SQL works with SQL databases for now."                                                                                                                        |
| `bun run --cwd apps/app test:coverage`                                                                                              | PASS: 966 of 966, 95.21% lines                                                                                                                                                                                                                                                                                                    |
| `bun run --cwd apps/app e2e`                                                                                                        | PASS: 15 of 15, including the new `input-modes.spec.ts` (5): `>` run with `runSql` and no `ask` in `__omqIpcLog`, refusal, `#ord` peek and preview, `@bil` + Space commit, raw save found from root                                                                                                                               |
| `rg -n "executeQuery" apps/app/src/mainview/components`                                                                             | No matches                                                                                                                                                                                                                                                                                                                        |
| Protected contracts                                                                                                                 | `card-spec.ts`, `ask.ts` (`AskEvent`), `widget.ts`, `board.ts` not edited                                                                                                                                                                                                                                                         |
| Browser screenshots (dark)                                                                                                          | Checked SQL row, empty note, table peek, connection list, raw card                                                                                                                                                                                                                                                                |
| Memory (Step 8 measurement, driver level)                                                                                           | `select * from generate_series(1, 2000000)` on the fixture Postgres through `PostgresPool.execute` (cap 2,000 rows): RSS 113 → 341 MB (+228 MB) in 423 ms. Under the 1.5 GB stop line for a single int column, but it scales with row width. Follow-up: stream with a row cap in the drivers (plan note), never rewrite user SQL. |
| Desktop Step 8 (no AI key: KPI card, `> update` refusal with nothing changed, `#` + preview, `@` switch, save raw widget, relaunch) | NOT RUN. Needs the owner's desktop session and removing their AI key; awaiting go-ahead.                                                                                                                                                                                                                                          |
| Recordings 1× / 0.25×, Timelines trace, Reduce Motion / Transparency / Contrast                                                     | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                   |

## Motion table status

Implemented, with a full and a reduced-motion test branch:

- the mode badge in and out (`SPRING_SNAPPY` with a scale, `FADE_OUT`);
- the input sliding over via `layout="position"` (`SPRING`);
- the pending chip dim (`FADE_IN`);
- the detail swap keyed by table (`FADE_IN` with a 2px rise);
- the once-only detail `Reveal`;
- the delayed skeleton;
- the chip commit through the existing `handoffLayoutId`;
- run and preview through the existing ask motion.

**Not implemented: the 30 ms stagger when the list swaps mode.** Rows fade in and
out through `LauncherRow`, but without a per-row delay. A stagger needs
`LauncherRow` (shared by every launcher list) to learn its index, which would
change the entrance of all root lists. Raised with the owner rather than added
quietly.
