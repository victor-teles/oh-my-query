# Plan 009: Type `>` to run SQL, `#` to peek a table, `@` to switch connection

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages/agent packages/core packages/rpc apps/app/src apps/app/e2e`
> and `git status --short`. Plans 001–007 sit uncommitted in the working tree and
> are the baseline. Confirm four things before starting:
> `packages/agent/src/index.ts` exports `assertReadOnly` and `inferCardSpec`;
> `AskEvent` in `packages/rpc/src/ask.ts` still has a `card` variant with
> `source: "model" | "inferred"`; `apps/app/src/bun/rpc.ts` still has the
> unguarded `executeQuery` handler; and `RootView` still builds its list through
> `buildRootSections` in `components/launcher/views/root-items.ts`. If plan 008
> (⌘K result actions) has landed, its result actions must also work for the
> raw-SQL answers this plan adds (see Step 6).

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (text the user types is executed against their database; the bun-side read-only guard and read-only transactions are the safety boundary)
- **Depends on**: none (builds on 004–006, which are in the working tree)
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19. The baseline is the working tree with plans 001–007 implemented but uncommitted.

## Why this matters

Today every answer goes through the AI. A developer who already knows the query
has to phrase it as a question, wait for a model, and needs an API key before
the launcher does anything useful at all. This plan adds three prefixes to the
launcher input, all parsed by one pure function: `>` runs the typed SQL
read-only and draws a card with no AI and no key; `#orders` shows a table's
columns, types, indexes and row estimate and previews 50 rows; `@analytics`
switches the active connection inline, like the `analytics` chip in the owner's
demo. Raw-SQL answers can be saved as widgets through the existing save flow.
The result is a first-run path that works without AI, and a launcher that is
faster than a SQL client for quick looks.

## Current state

Files and their roles (all verified in the working tree):

- `apps/app/src/mainview/components/launcher/views/root-view.tsx` (343 lines,
  already over the ~150-line guideline): the root screen. It builds sections
  (lines 122–131), owns list selection, and dispatches `runItem` by item kind
  (lines 173–196). It renders `LauncherInput` with `chip={CHIP}` where
  `CHIP = <ActiveConnectionChip />` (line 49).
- `.../launcher/views/root-items.ts`: the pure `RootItem` union (lines 9–15:
  `command | connection | ask | widget | recent | board`) and
  `buildRootSections` (lines 64–112). When nothing matches and AI is not set
  up, it returns only the AI-setup command (lines 97–99). The Ask row is
  prepended only when `askWith` (the active connection, set only when AI is
  ready, `root-view.tsx:124`) and a prompt exist.
- `.../launcher/views/use-root-keyboard.ts`: ↑/↓/^N/^P move, ↵ runs, Tab opens
  widget inputs, ⌘K opens actions (lines 42–81); `footerFor` (lines 88–115).
- `.../launcher/views/root-list.tsx`: `renderItem` switches on `item.kind`
  (lines 52–124).
- `.../launcher/launcher-input-row.tsx`: the 56px input row; `chip` is a
  `ReactNode` slot rendered before the input (lines 17–29).
- `.../launcher/ask-row.tsx`: the "Ask {connection}: “…”" row, a model for new
  rows (`LauncherRow` + icon tile + `type-body` text).
- `.../launcher/connections/active-connection-chip.tsx`: the chip. It already
  shares `layoutId={handoffLayoutId(activeConnection.id)}` (line 36) with the
  connection row, so picking a connection row flies its glyph into the chip.
- `.../launcher/connections/connections-provider.tsx`: `useConnections()`
  gives `state.connections`, `activeConnection` and `activate(connection)`
  (`use-connection-operations.ts:73+`: connects, then `setActiveConnection`).
- `.../launcher/use-launcher-stack.ts:6-14`: the `LauncherView` union. New
  screens are variants here, never routes.
- `.../launcher/use-launcher-ask.ts`: the ask session lives above the stack so
  ↑ on an empty root reopens the last answer; `startAndShow` pushes `ask`.
- `apps/app/src/mainview/components/ask/use-ask.ts:60-88`: `start(prompt,
target)` subscribes to `askEvent` by `askId` and calls the `ask` request.
- `.../ask/ask-reducer.ts`: `start` resets and sets `status: "schema"`
  (lines 156–160); events apply only while working.
- `.../ask/ask-view.tsx`: `answeredOf` (lines 46–62) builds the
  `AnsweredAsk` used by save; `askAgain` (lines 122–130) re-asks the draft.
- `.../ask/ask-header.tsx:25` hardcodes the heading "Generated SQL";
  `ask-error.tsx` maps `AskErrorCode` to copy, with
  `NOT_READ_ONLY: "This would change data. oh-my-query only runs read-only questions."`
  and `UNSUPPORTED_ENGINE: "Asking questions works with SQL databases for now."`.
- `.../widgets/use-ask-save.ts`: `⌘S` → `confirmName` → `save(draftFromAsk(answered, name))`;
  `⌘⇧S` → `proposeWidgetParams` (needs an AI key; returns
  `{ error: "Add an AI provider in Settings to find inputs." }` without one,
  `widget-service.ts:306-309`).
- `apps/app/src/bun/widget-service.ts:261-272` (`checkDraft`, run by
  `saveWidget`): `assertReadOnly` on the template, then
  `compileSqlTemplate(template, {}, dialect)`. That compile **rejects** SQL with
  `{{name}}` placeholders (unknown input) and SQL whose code already contains a
  native bind marker (`packages/core/src/sql-template.ts:287-306`: `$1` for
  postgresql, `?` for mysql/sqlite/duckdb, `@p1` for tsql, `{x:` for
  clickhouse). Everything else saves as-is.
- `apps/app/src/bun/rpc.ts:199-236`: `executeQuery`, the legacy workspace
  handler. It calls `pool.execute(sql, maxRows, params.schema ?? null, signal)`
  with **no `readOnly` option and no guard**. It must not be used for this
  feature.
- `apps/app/src/bun/ask-service.ts`: `createAskService`. `buildPorts`
  (lines 95–146) finds the connection, `ensurePool`, rejects engines without a
  dialect (`UNSUPPORTED_ENGINE`), **requires a model** (lines 102–108),
  resolves the schema name, and builds an `execute` port that runs
  `pool.execute(sql, ASK_MAX_ROWS, database, signal, { readOnly: true })` and
  records history. It keeps one active ask per connection and a
  `CancellationRegistry`; `cancelAsk(askId)` cancels.
- `packages/agent/src/ask.ts`: `runAsk` and the private helpers
  `executeWithTimeout` (lines 158–192, 30s), `settle`, `untilAborted` and the
  `AskFailure` class.
- `packages/agent/src/read-only-guard.ts:243`:
  `assertReadOnly(sql, dialect): { ok: true } | { ok: false; reason }`.
- `packages/agent/src/infer-card-spec.ts:131`:
  `inferCardSpec(data, { prompt, sql })`. The title is a leading `-- comment`
  in the SQL, else the prompt (`titleFor`, line 27).
- `packages/rpc/src/ask.ts`: `AskEvent` (protected). It already has everything
  a raw run needs: `sqlDone`, `phase`, `result`, `card` with
  `source: "inferred"`, `error`, `done`.
- `apps/app/src/bun/schema-cache.ts`: 60s cache over `pool.fetchSchema(database)`;
  it calls `pools.getPool`, which throws if the pool is not connected, so
  callers must `ensurePool` first (`connection-access.ts:35-43`).
  `resolveSchemaName` (`connection-access.ts:45-56`) picks the database or
  schema to use (for Postgres this is a schema name such as `public`).
- `packages/core/src/types.ts:86-111`: `TableItem { name, columns: ColumnDetail[],
indexes: IndexItem[], foreignKeys, rowEstimate: number | null }`,
  `ColumnDetail { name, dataType, isNullable, isPrimaryKey, defaultValue }`,
  `IndexItem { name, columns, isUnique }`.
- No identifier-quoting helper exists outside `drivers-mssql`
  (`rg -n "quoteIdent" packages apps/app/src` finds only
  `packages/drivers-mssql/src/pool.ts:110`).
- Every driver fetches the full result and then slices to `maxRows`
  (for example `packages/drivers-pg/src/pool.ts:129-131`;
  `drivers-mysql/src/pool.ts:149`, `drivers-sqlite/src/pool.ts:247`). A row
  cap passed to `execute` does not bound memory; only a `LIMIT` in the SQL
  does.
- Browser mode: `apps/app/src/mainview/lib/browser-ipc-stub.ts` dispatches
  requests to emulators (`createAskEmulator` in `lib/browser-ask-stub.ts`) and
  logs every request in `globalThis.__omqIpcLog`.

## Commands you will need

| Purpose                             | Command                                                                  | Expected          |
| ----------------------------------- | ------------------------------------------------------------------------ | ----------------- |
| App tests (both projects, required) | `bun run --cwd apps/app test`                                            | all pass          |
| One browser test                    | `bun run --cwd apps/app test:browser <path>`                             | pass              |
| One unit test                       | `bun run --cwd apps/app test:unit <path>`                                | pass              |
| Agent tests                         | `bun run --cwd packages/agent test`                                      | all pass          |
| Core tests                          | `bun run --cwd packages/core test`                                       | all pass          |
| RPC tests                           | `bun run --cwd packages/rpc test`                                        | all pass          |
| Types                               | `bun run check-types`                                                    | exit 0            |
| Lint + format                       | `bun run check` (fix with `bun run fix`)                                 | exit 0            |
| e2e (browser build)                 | `bun run --cwd apps/app e2e`                                             | all pass          |
| Coverage                            | `bun run --cwd apps/app test:coverage`                                   | lines ≥ 80%       |
| Fixture Postgres                    | `bun run fixtures:up`                                                    | container running |
| Desktop                             | `bun run --cwd apps/app desktop:dev`, driven with the `cua-driver` skill | launcher opens    |

## Implementation rules relevant to this plan

- **The guard runs in bun, always.** The renderer never decides that SQL is
  safe. Every statement that `runSql` executes passes `assertReadOnly` in the
  bun process and then runs with `{ readOnly: true }`. Writes are never possible
  from the launcher input. The owner decided (2026-11-19) that asks and widget
  runs stay read-only forever and writes exist only as declared, confirmed
  actions (plan 019); raw SQL falls under the read-only side.
- **No AI on this path.** `runSql` never loads a model. A raw run must work with
  the AI settings removed.
- **Do not rewrite the user's SQL.** No wrapping in a derived table, no
  injected `LIMIT` (MySQL ignores `ORDER BY` inside a derived table without
  `LIMIT`, and `TOP` injection on T-SQL needs a parser). Generated SQL (the
  table preview) always carries its own `LIMIT`.
- **Identifiers are quoted by one pure function** (`quoteIdentifier`, Step 1).
  Values are never spliced into SQL.
- Strict TS: no `any`, no unsafe casts, no `@ts-expect-error` without a
  one-line why. Validate RPC input with zod at the bun boundary.
- React 19 rules: components ~150 lines max, one per file, ≤ ~6 props, no
  boolean-prop proliferation (use `variant`/`tone` enums), hooks own logic, no
  derived state synced in effects, hotkeys live in `useXxxHotkeys`/`useXxxKeyboard`
  hooks. `root-view.tsx` is already 343 lines: this plan must not grow it.
  Move logic out (Step 4) so it ends no longer than it is today.
- No code comments by default; only a one-line why for a hidden constraint.
- Colocated tests: `*.test.ts` for pure logic (jsdom `unit` project),
  `*.browser.test.tsx` for components and hooks (`vitest-browser-react`;
  hooks via `@/test/render-hook`). Snapshot empty, loading, error and populated
  states. Coverage gate: 80% lines.
- Brand: warm, craft, trustworthy. Quiet copy, no "AI-powered", no sparkle
  icons. Keyboard and screen reader first. WCAG AA contrast on the translucent
  panel.

## Decisions made in this plan

1. **Raw SQL runs through a new bun request `runSql`, not `executeQuery`.**
   `executeQuery` has no guard and no read-only transaction (`rpc.ts:199-236`).
   `runSql` lives in `ask-service.ts`, shares its cancellation registry and its
   one-run-per-connection rule, and streams the existing `AskEvent`s over the
   existing `askEvent` message. `cancelAsk` cancels it. `AskEvent` and
   `CardSpec` do not change, so no `CardSpec.version` bump is needed.
2. **Raw SQL reuses the ask session and the ask view.** The answer appears in
   the same card, ↑ on an empty root reopens it, and save works unchanged. The
   ask state gains a `source` field (`"question" | "sql"`) so labels and copy
   fit.
3. **`@` switches the active connection.** Committing `@analytics` calls
   `activate(connection)`, exactly like picking a connection row. There is no
   per-query override; the chip always shows the one current connection.
4. **The table preview is raw SQL the renderer builds with a pure helper.**
   `previewSql(dialect, schema, table, 50)` (core, renderer-safe) produces
   `SELECT * FROM "public"."orders" LIMIT 50`, which runs through `runSql` like
   any typed SQL, guarded in bun. The ask view shows it and the user can edit it
   with `>`.
5. **Raw runs are not added to Recent.** Recent stays the list of AI asks
   ("Ask again" re-asks the model). Raw runs are still written to query history
   by the execute port. Plan 011 (History) may revisit this.

## Contracts added (protected after this plan)

In `packages/rpc/src/sql-run.ts` (new; export from `index.ts`):

```ts
export const SqlRunSource = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("sql"),
    sql: z.string().trim().min(1).max(20_000),
    title: z.string().trim().min(1).max(80).optional(),
  }),
]);
export const RunSqlParams = z.object({
  askId: z.string().min(1).max(100),
  connectionId: z.string().min(1).max(200),
  database: z.string().max(500).nullable(),
  source: SqlRunSource,
});
export type RunSqlParams = z.infer<typeof RunSqlParams>;

export interface SchemaPeek {
  database: string;
  dialect: DialectType;
  schema: SchemaInfo;
}
```

The union has one member on purpose: plan 010 adds a `match` member (rows where
one column equals a bound value). Requests in `RpcSchema` (`packages/rpc/src/schema.ts`):

```ts
runSql: { params: RunSqlParams; response: void };
peekSchema: { params: { connectionId: string }; response: SchemaPeek };
```

In `packages/core/src/sql-identifiers.ts` (new; export from both `client.ts` and
`index.ts`):

```ts
quoteIdentifier(dialect: DialectType, name: string): string
qualifiedTable(dialect: DialectType, schema: string | null, table: string): string
limitedSelect(dialect: DialectType, from: string, columns: "*" | "1", limit: number, where?: string): string
previewSql(dialect: DialectType, schema: string | null, table: string, limit?: number): string
```

In `packages/agent/src/run-sql.ts` (new; export from `index.ts`):

```ts
export type SqlRunPorts = Pick<AskPorts, "execute" | "dialect" | "connectionLabel">;
export async function* runSql(input: { sql: string; title?: string }, ports: SqlRunPorts, signal: AbortSignal): AsyncGenerator<AskEvent>
```

In the renderer, `components/launcher/input-mode.ts` (new):

```ts
export type LauncherInput =
  | { mode: "search"; text: string }
  | { mode: "sql"; sql: string }
  | { mode: "table"; needle: string }
  | { mode: "connection"; needle: string };
export const parseLauncherInput = (raw: string): LauncherInput;
```

Plans 010 (lookup) and 017 (`omq://` links) build on this parser and on
`runSql`; keep both names stable.

## UI and motion (mandatory)

The owner's bar: **the UI must be excellent and motion is mandatory.** A surface
without designed motion, or without designed empty, loading, populated and
error states, is not done. Use the system in `apps/app/src/mainview/lib/motion.ts`
and `components/motion/`; do not hand-roll transitions.

- **Tokens:** `SPRING` (400/30) for layout morphs and push/pop; `SPRING_SNAPPY`
  (600/49) for selection, toggles and small badges; `SPRING_SOFT` (260/32) for
  height and panel reveals; `SPRING_MOMENTUM` only after a drag release;
  `FADE_IN` 160ms ease-out-quint; `FADE_OUT` 110ms; `PRESS` scale 0.97 over
  100ms; stagger 30ms capped at 6 (`staggerDelay`). Primitives: `<Pressable>`,
  `<SwapText>` (keyed crossfade with 2px rise and blur-in, for changing
  values), `<Reveal>`. `useMotionPreset()` returns the reduced-motion
  equivalents (120ms crossfades, no transforms).
- **Principles:** respond on press; everything interruptible (springs retarget,
  no input lockout, no CSS transitions for anything re-triggerable); exit the
  way you entered at ~70% of the entrance duration; `layoutId` for objects that
  appear in two places; animate only `transform`, `opacity`, `filter`, and use
  `layout` (FLIP) for size; one primary motion per moment; only progress
  indicators loop. Nothing animates per keystroke of typed SQL.
- **Accessibility:** reduced motion turns slides and springs into crossfades or
  instant changes; reduced transparency makes surfaces opaque; increased
  contrast gives solid borders and promotes muted text. Focus rings always
  visible. Live regions announce state changes ("SQL mode", "Running query",
  "orders, 12 columns"), never animation frames.
- **No flicker:** a loading state that would last under 150ms is never shown;
  once shown it stays at least 300ms.

### Motion moments in this plan

| Moment              | Trigger                                              | What moves                                                                                                                                                          | Token                          | Reduced motion  |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------- |
| Mode badge in       | First character becomes `>`, `#` or `@`              | A small badge ("SQL", "Table", "Connection") appears between the chip and the input: scale 0.92→1 plus opacity; the input text slides right via `layout`.           | `SPRING_SNAPPY`                | Instant         |
| Mode badge out      | Prefix deleted or Esc clears                         | Badge fades and scales to 0.96; input slides back via `layout`.                                                                                                     | `FADE_OUT`, `SPRING`           | Instant         |
| List swaps mode     | Entering or leaving a mode                           | Old sections fade out; new section rows fade in with a 30ms stagger (cap 6). Panel height follows through the existing `LauncherSurface` morph.                     | `FADE_OUT`, `FADE_IN`, stagger | 120ms crossfade |
| SQL row text        | Typing after `>`                                     | Nothing animates; the SQL text updates in place with syntax colors.                                                                                                 | —                              | —               |
| Table list + detail | Enter `#` mode                                       | Two panes: table list (left, ~40%) and detail (right). The detail pane `<Reveal>`s once. Body height is fixed so ↑/↓ never changes panel height.                    | `FADE_IN`                      | Instant         |
| Detail swap         | ↑/↓ to another table                                 | Detail content crossfades keyed by table id with a 2px rise; the header row count uses `<SwapText>`.                                                                | `FADE_IN` / `FADE_OUT`         | Instant         |
| Schema loading      | First `#` on a connection whose schema is not cached | Skeleton rows in both panes, shown only after 150ms, kept ≥ 300ms.                                                                                                  | `FADE_IN`                      | Static skeleton |
| Pending connection  | Typing `@…`                                          | The active chip dims to opacity 0.5 to say "about to change".                                                                                                       | `FADE_IN`                      | Instant         |
| Connection commit   | ↵, Tab, or Space on a unique `@` match               | The chosen row's glyph and name fly into the chip through the existing `handoffLayoutId` shared layout; the old chip fades; the `@token` disappears from the input. | `SPRING` (layout), `FADE_OUT`  | Instant swap    |
| Run SQL / preview   | ↵ on the SQL row or a table                          | Standard stack push to the ask view, then the existing ask motion: "Running query" status → result card intro.                                                      | `SPRING`, existing ask tokens  | Crossfade       |
| Read-only refusal   | Guard rejects                                        | Existing ask-error reveal with the offending keyword marked in the SQL block.                                                                                       | existing                       | existing        |

## Scope

**In scope** (the only files to create or modify):

- `packages/core/src/sql-identifiers.ts` and `sql-identifiers.test.ts` (create);
  `packages/core/src/client.ts`, `packages/core/src/index.ts` (exports).
- `packages/agent/src/run-query.ts` (create: `executeWithTimeout`, `settle`,
  `untilAborted`, `AskFailure`, `cancelled`, moved out of `ask.ts` without
  behavior change), `packages/agent/src/ask.ts` (import them),
  `packages/agent/src/run-sql.ts` and `run-sql.test.ts` (create),
  `packages/agent/src/index.ts`.
- `packages/rpc/src/sql-run.ts` and `sql-run.test.ts` (create),
  `packages/rpc/src/schema.ts`, `packages/rpc/src/index.ts`.
- `apps/app/src/bun/ask-service.ts` and `ask-service.test.ts`,
  `apps/app/src/bun/schema-peek.ts` and `schema-peek.test.ts` (create),
  `apps/app/src/bun/connection-access.ts` (engine message only),
  `apps/app/src/bun/rpc.ts` (wire two handlers).
- `apps/app/src/mainview/lib/ipc.ts`, `lib/browser-ipc-stub.ts`,
  `lib/browser-ask-stub.ts`, `lib/browser-schema-stub.ts` (create) and their tests.
- `apps/app/src/mainview/components/launcher/`: `input-mode.ts` (+ test),
  `mode-badge.tsx`, `sql-row.tsx`, `views/root-items.ts` (+ test),
  `views/mode-items.ts` (+ test, create), `views/root-view.tsx`,
  `views/root-list.tsx`, `views/use-root-keyboard.ts`,
  `views/use-root-run.ts` (create), `views/use-connection-token.ts` (create),
  `views/connection-token.ts` (+ test, create),
  `connections/active-connection-chip.tsx`, `use-launcher-ask.ts`,
  `launcher-panel.tsx`, `launcher-input.tsx` (paste handling only).
- `apps/app/src/mainview/components/launcher/schema/` (create): `table-row.tsx`,
  `table-detail.tsx`, `table-detail-skeleton.tsx`, `table-search.ts` (+ test),
  `use-table-catalog.ts`, `table-mode-body.tsx`, browser tests and snapshots.
- `apps/app/src/mainview/components/ask/`: `ask-reducer.ts` (+ test),
  `use-ask.ts`, `ask-view.tsx`, `ask-labels.ts` (+ test), `ask-header.tsx`,
  `ask-error.tsx`, `ask-footer-hints.ts`, and their browser tests/snapshots.
- `apps/app/e2e/input-modes.spec.ts` (create).
- `.factory/plans/README.md` (status row only).

**Out of scope** (do not touch):

- `executeQuery`, `cancelQuery` and the legacy workspace handlers in `rpc.ts`:
  they are the old workspace path; changing them risks callers that still exist.
- Driver row streaming or server-side cursors. The full-fetch-then-slice issue
  affects asks too; it is a separate plan (see Maintenance notes).
- `AskEvent`, `CardSpec`, `Widget`, `Board` contracts. Not needed.
- Any write path. Raw SQL is read-only, always.
- Recent asks and History (plan 011).
- MongoDB and Redis input modes (plan 013): they show a designed "works with SQL
  databases" state, nothing more.

## Git workflow

- Branch `feat/launcher-009-input-modes` (the repo's `feat/launcher-NNN-*`
  convention), created from the current working branch. Commit only if
  authorized. Do not push or open a PR unless instructed.

## Steps

### Step 1: Identifier quoting and preview SQL (core, pure)

Create `packages/core/src/sql-identifiers.ts`:

| Dialect                                                 | Quote        | Escape inside    |
| ------------------------------------------------------- | ------------ | ---------------- |
| postgresql, sqlite, duckdb, snowflake, redshift, oracle | `"name"`     | `"` → `""`       |
| mysql, clickhouse, bigquery                             | `` `name` `` | `` ` `` → ` `` ` |
| tsql                                                    | `[name]`     | `]` → `]]`       |

`quoteIdentifier` throws `DbError("INVALID_IDENTIFIER", …)` for an empty name or
one containing `\0`. `qualifiedTable` joins quoted schema and table with `.`
(schema omitted when `null`). `limitedSelect` builds
`SELECT {columns} FROM {from}[ WHERE {where}] LIMIT {n}`, except tsql
`SELECT TOP ({n}) {columns} FROM …` and oracle `… FETCH FIRST {n} ROWS ONLY`;
`n` must be a positive safe integer. `previewSql` = `limitedSelect(dialect,
qualifiedTable(...), "*", limit ?? 50)`. The `where` argument is for plan 010;
it is code built by callers from quoted identifiers and `{{value}}`
placeholders only.

Tests (`sql-identifiers.test.ts`): every dialect row above; names with spaces,
quotes, backticks, brackets, `;`, `--` and the hostile name
`x"; drop table t; --`; the empty-name and NUL errors; each `limitedSelect`
form.

### Step 2: The raw run pipeline (agent, pure over ports)

Move `executeWithTimeout`, `settle`, `untilAborted`, `AskFailure` and `cancelled`
from `ask.ts` into `run-query.ts` and import them back. `runAsk` behavior and
tests must not change (`bun run --cwd packages/agent test` stays green before
you add anything).

Create `run-sql.ts`. `runSql({ sql, title }, ports, signal)` yields, in order:

1. `{ type: "sqlDone", sql, dialect: ports.dialect, lines }`, so the SQL block
   shows the statement immediately (no `sqlDelta`s).
2. `assertReadOnly(sql, ports.dialect)`. On rejection:
   `{ type: "error", phase: "sql", code: "NOT_READ_ONLY", message: reason, sql }`
   and stop.
3. `{ type: "phase", phase: "run", detail: "Read only on {connectionLabel}" }`.
4. `executeWithTimeout` (30s). Failure: `QUERY_FAILED` or `TIMEOUT` with
   `phase: "run"` and `sql`. No repairs: the user wrote this SQL.
5. `{ type: "result", columns, rows, rowCount, executionTimeMs, isTruncated }`.
6. `{ type: "card", source: "inferred", spec: inferCardSpec(result, { prompt: title ?? "Query on {connectionLabel}", sql }) }`.
   A leading `-- comment` in the SQL wins as the title (existing `titleFor`).
7. `{ type: "done" }`. Cancellation anywhere yields `CANCELLED`.

Export `runSql` and `SqlRunPorts` from `index.ts`.

Tests (`run-sql.test.ts`, model after `ask.test.ts` but with no model): the
event order for a happy run; a KPI result (one row, one number) gets a `kpi`
view; `delete from t` → `NOT_READ_ONLY` with no `execute` call (assert the fake
was never called); two statements → refusal; execute rejects →
`QUERY_FAILED` with the driver message; a timeout → `TIMEOUT`; abort before
and during execute → `CANCELLED`; `-- Revenue by month` title.

### Step 3: Bun wiring (`runSql`, `peekSchema`)

In `packages/rpc/src/sql-run.ts` add the contracts above and add both requests
to `RpcSchema`.

In `ask-service.ts`, split `buildPorts` into `openTarget(params)` (connection,
pool, dialect check, schema name) and the model step, so asks keep requiring a
model and raw runs never load one. Add
`startSqlRun(input: RunSqlParams): void`: parse with `RunSqlParams`, apply the
same one-active-run-per-connection rule and `CancellationRegistry` as
`startAsk` (so `cancelAsk` stops either), build `SqlRunPorts` from
`openTarget` plus the same `execute` port (read-only, history recorded), and
forward `runSql` events through `deps.send({ askId, event })`. Setup failures
emit an `error` event with `phase: "run"`. The unsupported-engine message for
raw runs is "Running SQL works with SQL databases for now." (add a second
constant next to `UNSUPPORTED_ENGINE_MESSAGE` in `connection-access.ts`). Do not
call `rememberAsk` for raw runs.

Create `schema-peek.ts`: `createSchemaPeek({ pools, schemas })` with
`peek({ connectionId })`: zod-validate, `findConnection` (missing →
`DbError("CONNECTION_MISSING", "This connection no longer exists.")`),
`ensurePool`, no dialect → `DbError("UNSUPPORTED_ENGINE", "Table peek works with SQL databases for now.")`,
`resolveSchemaName(pool, null, connection)`, then `schemas.get(id, database)`.
Return `{ database, dialect, schema }`.

Wire both in `rpc.ts`: `runSql: (params) => asks.startSqlRun(params)` and
`peekSchema: ({ connectionId }) => peek.peek({ connectionId })`. Add
`peekSchema` to `TRACED_METHODS`.

Tests: `ask-service.test.ts` gains raw-run cases with a fake pool (model after
its existing fakes): no model loaded (assert `loadModel` never called), a
refused statement never reaches `pool.execute`, `readOnly: true` is passed,
a second run on the same connection cancels the first, `cancelAsk` stops a raw
run, Mongo-type connection → `UNSUPPORTED_ENGINE`. `schema-peek.test.ts`:
connects a disconnected pool first, missing connection, unsupported engine,
cached second call (model after `schema-cache.test.ts`).

**Evidence**: with the fixture up (`bun run fixtures:up`) and the AI key
removed in Settings, a raw run of `select 1 as one` in desktop dev produces a
KPI card.

### Step 4: The input parser and root modes (renderer)

`input-mode.ts`: `parseLauncherInput(raw)` looks at `raw.trimStart()`:

- starts with `>` → `{ mode: "sql", sql: rest.trim() }`;
- starts with `#` → `{ mode: "table", needle: rest.trim() }` (a needle may be
  `schema.table`);
- matches `/^@(\S*)$/` → `{ mode: "connection", needle }`;
- anything else, including `@foo bar` → `{ mode: "search", text: raw }`.

Table-driven tests cover each prefix, leading spaces, empty rest, `>>`,
`@` alone, `@foo bar`, and plain text.

`views/mode-items.ts` (pure) builds sections per mode, extending `RootItem`
with `{ kind: "sql"; id: "sql"; sql: string; connection }` and
`{ kind: "table"; id; schema: string; table: TableItem }`:

- **sql**: no active connection → the Connections section labeled "Pick a
  connection to run SQL"; a MongoDB/Redis connection → a designed note "SQL runs
  work with SQL databases." and no runnable row; empty `sql` → a note "Type a
  read-only query. ↵ runs it on {name}."; otherwise one SQL row. The AI-setup
  command (`root-items.ts:97-99`) never appears in this mode.
- **table**: same connection and engine rules; otherwise tables matched by
  `schema/table-search.ts` (exact name, then prefix, then `fuzzyMatch` from
  `lib/fuzzy-match.ts`; `schema.table` needles match both parts), capped at 50.
- **connection**: `filterConnections(connections, needle)` in the "Switch
  connection" section (existing `connection` items).
- **search**: today's `buildRootSections`, unchanged.

Root view restructuring (required, since `root-view.tsx` is over budget):

- `use-root-run.ts` takes over `runItem`/`runById` and adds:
  `sql` → `ask.startSql(sql, target)`; `table` → `ask.startSql(previewSql(dialect, schema, table.name), target, table.name)`;
  `connection` in connection mode → `activate(connection)` then
  `onQueryChange("")`.
- `connection-token.ts` (pure): `commitToken(nextValue, connections)` returns
  the connection to commit when `nextValue` matches `/^@(\S+) $/` and exactly
  one connection matches. `use-connection-token.ts` calls it from the change
  handler; Tab also commits the selected match.
- `use-root-keyboard.ts`: Tab commits in connection mode; in table mode
  `⌘↓` moves focus into the detail pane (scrollable, `tabIndex=0`) and Esc
  from there returns focus to the input.
- `footerFor` gains mode labels: SQL row "Run"; table row "Preview rows" with
  hint `⌘↓ Columns`; connection mode "Switch" with hint `⇥ Switch`.
- `root-list.tsx`: move the per-kind switch into a small `RootItemRow` if
  adding two kinds would push it past ~150 lines.
- Input placeholder: "Search or ask… > SQL · # table · @ connection".
- `mode-badge.tsx` renders the badge passed through the existing `chip` slot
  next to the connection chip, with an `aria-live="polite"` visually hidden
  label announcing the mode once on change.
- `ActiveConnectionChip` gains `tone: "active" | "pending"`; pending in
  connection mode.
- Paste: WebKit strips line breaks from `<input type="text">` values, so
  pasted multi-line SQL would be glued together (`select a\nfrom t` →
  `select afrom t`). In `launcher-input.tsx` handle `onPaste`: when the pasted
  text contains line breaks, insert it with each line break replaced by a
  space and each `--` line comment converted to `/* … */` (use
  `tokenizeSqlTemplate` from `@oh-my-query/core/client` to find comment
  segments; escape `*/` inside). Put the transform in a pure, tested
  `flatten-pasted-sql.ts`.

`sql-row.tsx`: like `ask-row.tsx`; a terminal glyph tile, "Run on {name} · read
only" in `text-panel-muted`, and the SQL in JetBrains Mono (`font-mono`)
colored with `tokenizeSql` from `lib/sql-highlight.ts`, single line, truncated
with an ellipsis.

### Step 5: Table peek (renderer)

`use-table-catalog.ts`: when the mode is `table` and the active connection is a
SQL engine, call `peekSchema(connectionId)` (new `ipc.ts` wrapper) and expose
`{ status: "loading" | "ready" | "error", peek, retry }`. Re-fetch when the
connection changes; bun's 60s cache makes repeat calls cheap, so do not add a
renderer cache. Apply the 150ms/300ms skeleton rule.

`table-mode-body.tsx`: two panes in a fixed-height body (pick one height,
around 320px, and keep it for every state): the table list (`table-row.tsx`:
name, schema in muted text, "~1.2M rows" via `Intl.NumberFormat` compact, or
"rows unknown" for `null`) and `table-detail.tsx` for the selected table:

- header: table name, schema, row estimate, column count;
- columns: name (mono), type (muted mono), a key glyph for primary keys,
  "null" for nullable, and "→ customers.id" for foreign keys;
- indexes: name, columns, a "unique" tag.

States: loading (skeleton), error (message plus "Try again" button calling
`retry`), empty ("No tables in {schema}."), no match ("No table matches
“{needle}”."). The selected option carries `aria-describedby` pointing to a
visually hidden one-line summary ("orders, 12 columns, about 1.2 million rows,
primary key id"), so screen-reader users get the peek without leaving the
input.

### Step 6: Ask view for raw runs and the save bridge

- `ask-reducer.ts`: add `source: "question" | "sql"` to `AskState` (default
  `"question"`). The `start` action takes `source`; for `"sql"` the initial
  status and phase are `"run"`, so "Writing SQL" never appears.
- `use-ask.ts`: add `startSql(sql, target, title?)` sharing the session logic
  of `start` (one `askId`, one subscription, `abandon` first), calling the new
  `runSql` IPC wrapper. `use-launcher-ask.ts` exposes it in `rootAsk` and
  pushes the `ask` view, like `startAndShow`.
- `ask-view.tsx`: the draft starts as `"> " + sql` for SQL sources. Submitting
  goes through `parseLauncherInput`: `sql` → `startSql`, anything else →
  `start` (questions; `#`/`@` text is treated as a question here). Keep the
  file from growing: put source-dependent copy in `ask-labels.ts`
  (`sqlHeading(source)`: "Generated SQL" / "Your SQL"; footer action
  "Run"/"Run again" vs "Ask"/"Ask again") and pass the heading into
  `ask-header.tsx` as a prop.
- `ask-error.tsx`: source-aware copy for two codes. `NOT_READ_ONLY` with
  source `sql`: "This would change data. The launcher only runs read-only
  queries." `UNSUPPORTED_ENGINE` with source `sql`: "Running SQL works with SQL
  databases for now."
- **Save bridge** (verified requirements): `answeredOf` needs `spec`,
  `dialect` (from `sqlDone`), `view` (from `card`), `sql` and the connection
  id; raw runs supply all of them (`startSql` stores the SQL as
  `state.prompt`). In `answeredOf` (`ask-view.tsx:46-62`) set `prompt` to `""`
  for SQL sources (`Widget.prompt` allows an empty string, `widget.ts`); no
  change to `widget-draft.ts` is needed.
  `⌘S` then saves through the existing `saveWidget`, which re-guards the SQL
  and compiles it. Two kinds of raw statement cannot be saved, and the user sees the
  service's message in `SaveStatus`: SQL containing `{{…}}` (unknown input) and
  SQL whose code already has a native bind marker (`$1`, `?` on
  mysql/sqlite/duckdb, `@p1`, `{x:`). `⌘⇧S` works when AI is configured and
  otherwise shows "Add an AI provider in Settings to find inputs." The saved
  widget runs with no AI, as every widget does.
- If plan 008's ⌘K result actions exist, confirm Copy, Save as widget and Add
  to board work on a raw-SQL card; adapt only through 008's own extension
  points.

### Step 7: Browser stub and e2e

- `browser-schema-stub.ts`: a demo `SchemaInfo` (schema `public`: `orders`,
  `customers`, `events`, `subscriptions`, with realistic columns, a PK, an FK
  and an index each). `peekSchema` returns it with dialect `postgresql`.
- `browser-ask-stub.ts`: add `runSql`. Stub-only rule (the real guard is in
  bun): a statement whose first word is `insert|update|delete|drop|alter|truncate|create`
  replays `NOT_READ_ONLY`; SQL containing `"orders"` replays a 50-row orders
  table; `signups` replays the stacked bar; anything else replays revenue by
  region. Same event order as Step 2.
- `e2e/input-modes.spec.ts` (model after `e2e/ask-flow.spec.ts`):
  1. `> select region, mrr from revenue` ↵ → card; `__omqIpcLog` contains
     `runSql` and **no** `ask` request.
  2. `> delete from orders` ↵ → the read-only refusal.
  3. `#ord` → `orders` selected, detail shows its columns; ↵ → a table card
     titled "orders".
  4. `@` → connection list; type a unique prefix and Space → chip shows the
     new connection and the input is empty.
  5. Run SQL, press `⌘S`, name it, Esc to root, and find the widget by name.

### Step 8: Desktop verification

In `desktop:dev` with the fixture Postgres and **no AI key**, drive the launcher
with the `cua-driver` skill: `> select count(*) from <a fixture table>` (KPI
card); `> update …` (refusal, nothing changed: re-select and compare);
`#` + a fixture table (detail, then preview); `@` switch between two
connections; save a raw query as a widget, quit, relaunch, and run it.

Also measure once and report (do not fix here): run `> select * from
generate_series(1, 2000000)` on the fixture and note bun process memory before
and after (Activity Monitor or `ps -o rss`).

## Test plan

- Core: `sql-identifiers.test.ts` (Step 1 cases).
- Agent: `run-sql.test.ts` (Step 2 cases); existing `ask.test.ts` untouched and
  green after the `run-query.ts` move.
- RPC: `sql-run.test.ts`: `RunSqlParams` accepts a valid run and rejects empty
  SQL, SQL over 20,000 chars, a title over 80 chars, and an unknown `source.kind`.
- Bun: `ask-service.test.ts` additions and `schema-peek.test.ts` (Step 3).
- Renderer unit: `input-mode.test.ts`, `mode-items.test.ts`,
  `connection-token.test.ts`, `table-search.test.ts`,
  `flatten-pasted-sql.test.ts`, `ask-reducer.test.ts` (sql source start and
  event flow), `ask-labels.test.ts` (headings, footer labels).
- Renderer browser (model after `launcher-ask-flow.browser.test.tsx` and
  `root-view-widgets.browser.test.tsx`; deliver bun messages with
  `emitIpcMessage()` from `src/mainview/test/ipc-mock.ts`):
  - root in each mode: badge shown and announced, SQL row, no-connection
    state, Mongo state, empty-SQL note, AI-setup row absent in SQL mode;
  - table mode: loading skeleton (delayed), error with retry, empty, no match,
    populated, ↑/↓ swaps detail, ⌘↓ focus into detail and Esc back,
    `aria-describedby` summary;
  - connection mode: pending chip tone, Space commit, Tab commit, ↵ commit,
    ambiguous prefix does not commit on Space;
  - ask view with SQL source: heading "Your SQL", no "Writing SQL" status,
    refusal copy, re-run from an edited `>` draft, ⌘S save of a raw query;
  - both motion branches (full and reduced) for the badge, the detail swap and
    the chip commit.
  - Snapshots: SQL mode populated, SQL empty note, table loading, table error,
    table populated, connection mode list, ask view with a raw card and with a
    refusal.
- e2e: `input-modes.spec.ts` (Step 7).

## Done criteria

- [ ] `bun run --cwd apps/app test`, `bun run --cwd packages/agent test`,
      `bun run --cwd packages/core test`, `bun run --cwd packages/rpc test`,
      `bun run check-types`, `bun run check` and `bun run --cwd apps/app e2e`
      all pass; app line coverage ≥ 80%.
- [ ] `rg -n "executeQuery" apps/app/src/mainview/components` returns nothing:
      the launcher never uses the unguarded handler.
- [ ] A browser test proves `runSql` runs with no AI settings, and the e2e log
      shows no `ask` request for `>` input. Desktop dev with the AI key
      removed shows a raw-SQL card.
- [ ] A bun test proves a refused statement never reaches `pool.execute`, and
      every executed raw statement passes `readOnly: true`.
- [ ] `git diff --stat` shows no change to `packages/rpc/src/card-spec.ts`,
      `packages/rpc/src/ask.ts` (`AskEvent`), `widget.ts` or `board.ts`.
- [ ] `wc -l apps/app/src/mainview/components/launcher/views/root-view.tsx`
      is ≤ 343.
- [ ] Desktop checks from Step 8 pass; the memory measurement is reported in
      the PR.
- [ ] Every row of "Motion moments in this plan" is implemented with its token
      and its reduced-motion fallback, with a browser test per branch.
      Recordings at 1× and 0.25× (`?slowmo=4`) are attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of: type `>` (badge) → run →
      card; `#` → ↑/↓ through five tables → preview; `@` → commit, shows no
      frame over 16.7ms, and only `transform`/`opacity`/`filter` animate.
- [ ] Reduced Motion, Reduce Transparency and Increase Contrast are each
      verified on the badge, the SQL row, the table panes and the chip, along
      with designed empty, loading, populated and error states (snapshots).
- [ ] `.factory/plans/README.md` row for 009 updated.

## STOP conditions

- `assertReadOnly` accepts a statement in Step 2's tests that changes data on
  a real driver (for example a data-modifying CTE or a function with side
  effects that the read-only transaction does not stop on some engine). Stop
  and report the statement and engine; do not ship raw SQL for that engine
  with a weaker guarantee.
- A driver ignores `readOnly: true` for some statement shape in the desktop
  check. Same: stop and report.
- Making raw runs share the ask session forces a change to `AskEvent` or
  `CardSpec`. Stop: those are protected and need a version bump the owner must
  approve.
- The Step 8 measurement shows an unbounded raw select can take the bun process
  past ~1.5 GB or freeze the launcher. Finish the plan, but report it as a
  blocker for release and propose the driver-level fix (streaming with a row
  cap) as its own plan. Do not rewrite user SQL to work around it.
- Motion cannot meet the 60fps bar (for example the two-pane detail swap).
  Stop and report; never cut motion.

## Maintenance notes

- Plan 010 (lookup) adds a `match` source to `SqlRunSource`, reuses
  `limitedSelect`/`quoteIdentifier`, and extends the `search` variant of
  `LauncherInput` with a classified lookup value. Plan 017 (`omq://` links)
  should route text through `parseLauncherInput`, not a second parser.
- Follow-up (separate plan): every driver fetches the whole result and slices
  to `maxRows`. Asks and raw SQL are both exposed. The fix is in the drivers
  (cursor or stream with a hard row cap), not in SQL rewriting.
- Reviewers: read `run-sql.ts` and `startSqlRun` to confirm the guard runs
  before any execute and `readOnly: true` is always passed; read
  `sql-identifiers.ts` for quoting; check that nothing in the renderer decides
  safety.
- Deferred: multi-line SQL editing (a code editor in the ask view), `#` for
  views and other schemas than the resolved one, raw runs in Recent/History
  (plan 011), raw SQL for MongoDB/Redis (plan 013).
