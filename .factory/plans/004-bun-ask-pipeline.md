# Plan 004: Answer natural-language questions with a read-only agent in the bun process

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages apps/app/src/bun` and
> `git status --short`. Plans 002 and 003 must be merged. Confirm
> `packages/core/src/ai-config.ts` exports `getAiSettings()`.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (LLM-generated SQL runs against user databases)
- **Depends on**: `.factory/plans/003-launcher-connections-settings.md`
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-17 (assumes 002–003 landed)

## Why this matters

The core interaction works like this. The user types "Revenue by region". The
app reads the schema, writes SQL (streamed so the user can watch it), runs it
**read-only**, and returns a chart spec and a one-line insight. The owner chose
to run this in the bun process. That keeps API keys out of the webview, runs
queries next to the drivers, and turns the renderer into a pure event consumer.
This plan builds the engine and the wire contract. Plan 005 builds the UI.

## Reference behavior (from the owner's demo video)

1. The input shows the chip `analytics` and the text `Revenue by region`. The
   submit button turns into a stop button.
2. The header reads **Generated SQL · PostgreSQL · analytics**. The status
   reads "Writing SQL · Reading the analytics schema" above a skeleton bar
   chart. SQL streams in with a leading comment, for example
   `-- Monthly recurring revenue by region in 2026`.
3. The status changes to "Running query · Read only on analytics", and the
   header gains "12 lines".
4. The result appears: a check mark, then **PostgreSQL · 27 rows · 386ms**,
   the title "Monthly recurring revenue by region", and the subtitle
   "Jan to Sep 2026 · $475k in September". The legend shows each series with
   its latest value ("North America $258k"), above a line chart with a
   Bar/Line/Table toggle. One insight line follows: "Asia Pacific more than
   doubled this year, from $31k to $71k. Total MRR reached $475k in September,
   up 54% since January."

## Current state

- AI currently runs in the renderer:
  `apps/app/src/mainview/stores/ai-chat-store.ts` calls `streamText` from `ai`
  (v6, `"ai": "^6.0.97"`), with providers `@ai-sdk/{anthropic,openai,google}`
  (v3) and a model built by `lib/ai-provider.ts` (`createAIModel(settings)`,
  which supports openai, local, openrouter, anthropic and google).
- `apps/app/src/mainview/lib/ai-schema-formatter.ts` exports
  `formatSchemaForPrompt` (:188), `buildSystemPrompt` (:308) and
  `SchemaRedactOptions`. `lib/ai-errors.ts` exports `classifyAIError` (:148)
  and `AIErrorType`. Each has unit tests in the same folder.
- `packages/core`: `redactPii` and `PII_PATTERNS` (`pii-redactor.ts`),
  `normalizeSqlForAnalysis` and `classifyStandardSql` (`safe-mode.ts`, which
  detects drop, truncate, alter, and delete/update without a where clause),
  `CancellationRegistry` and `raceWithCancel` (`cancellation.ts`),
  `transpileSql`, `appendHistory`, and `getAiSettings` (from plan 003).
- `packages/core/src/traits.ts`:
  `Pool.execute(sql, maxRows, schema, signal): Promise<ExecuteResult>`.
  `ExecuteResult` is either `TabularResult { columns: {name,typeName}[], rows: unknown[][], rowCount, executionTimeMs, isTruncated }`
  or `DocumentResult` (Mongo). `Pool.dialect` is a `DialectType | null`
  (`postgresql`, `mysql`, `sqlite`, `clickhouse`, `duckdb`, `tsql`, …).
- `packages/drivers/src/safe-mode.ts`: `getDestructiveClassifier(dbType)`.
- `apps/app/src/bun/rpc.ts`: a module-level `pools = new ConnectionPoolManager()`,
  a `cancellation` registry, and a 60s `schemaCache` keyed by
  `${connectionId}::${db}`. The `executeQuery` handler (:154) shows the transpile,
  timeout and cancel pattern. Handlers are wrapped so errors go through
  `encodeRpcError` from `@oh-my-query/rpc`.
- Bun-side code has **no tests**, and Vitest coverage covers only
  `src/mainview/**`. Packages run their own `vitest run`. Testable agent logic
  therefore belongs in a **new package**, not in `src/bun`.
- `@json-render/*` was removed in plan 002. Its old free-form UI-tree approach
  embedded data in the spec. That does not work for saved widgets, which must
  re-run SQL. Replace it with the data-bound `CardSpec` below.

## Commands you will need

| Purpose              | Command                                                                      | Expected    |
| -------------------- | ---------------------------------------------------------------------------- | ----------- |
| Install              | `bun install`                                                                | exit 0      |
| Agent tests          | `bun run --cwd packages/agent test`                                          | all pass    |
| Core / drivers tests | `bun run --cwd packages/core test`, `bun run --cwd packages/drivers-pg test` | all pass    |
| All tests            | `bun run test` (turbo)                                                       | all pass    |
| Typecheck / lint     | `bun run check-types`, `bun run check`                                       | exit 0      |
| Fixture DB           | `bun run fixtures:up`                                                        | Postgres up |

## Implementation rules relevant to this plan

- TypeScript strict. No `any`. Validate untrusted input at the boundary with
  zod. Here, **LLM output is untrusted input**.
- The pipeline is a pure, testable function over injected ports, with no
  module-level singletons in `packages/agent`:
  ```ts
  interface AskPorts {
    model: LanguageModel; // from "ai"
    loadSchema(): Promise<SchemaInfo>;
    execute(sql: string, signal: AbortSignal): Promise<TabularResult>;
    dialect: DialectType;
    connectionLabel: string; // "analytics"
    redact: { enabled: boolean; customPatterns: string[] };
    now(): Date;
  }
  ```
- Never send full result sets to the model. Send at most column names, types,
  ≤20 sample rows (after PII redaction when the connection has
  `piiRedaction`), and computed per-column stats.
- Do not log credential values or row data. Logging phase transitions and
  timings is fine.
- No code comments except for a non-obvious why.
- **Pace events for motion.** The renderer (plan 005) animates every phase,
  so the event stream must be smooth and well ordered:
  - Coalesce `sqlDelta` into at most one message per ~32ms, so streamed SQL
    appears as a steady flow rather than bursts or a flood of tiny messages.
  - Flush the remaining buffer immediately before `sqlDone`.
  - Emit `phase` the moment work begins, never after it ends.
  - Never reorder events. `result` always comes after `sqlDone`, and `card`
    after `result`.
  - Never add artificial delays in bun. Minimum display times are the UI's
    job (`use-phase-display.ts` in plan 005).
  - Add a test asserting the ~32ms coalescing with fake timers.

## The contract (protected after this plan; 005–007 depend on it)

Put these in `packages/rpc/src/card-spec.ts` and `packages/rpc/src/ask.ts`, and
export them from `packages/rpc/src/index.ts`. They are zod schemas plus their
inferred types.

```ts
// card-spec.ts
export const ColumnFormat = z.object({
  kind: z.enum([
    "number",
    "integer",
    "percent",
    "currency",
    "compact",
    "date",
    "month",
    "text",
  ]),
  currency: z.string().length(3).optional(),
});
export const ChartView = z.object({
  kind: z.literal("chart"),
  mark: z.enum(["bar", "line", "area"]),
  x: z.string(),
  y: z.array(z.string()).min(1).max(6),
  groupBy: z.string().optional(), // long → wide pivot; requires y.length === 1
  stacked: z.boolean().default(false),
});
export const PieView = z.object({
  kind: z.literal("pie"),
  label: z.string(),
  value: z.string(),
});
export const KpiView = z.object({
  kind: z.literal("kpi"),
  value: z.string(),
  label: z.string().optional(),
  delta: z.string().optional(),
});
export const TableView = z.object({
  kind: z.literal("table"),
  columns: z.array(z.string()).optional(),
});
export const CardView = z.discriminatedUnion("kind", [
  ChartView,
  PieView,
  KpiView,
  TableView,
]);
export const CardSpec = z.object({
  version: z.literal(1),
  title: z.string().max(80),
  subtitle: z.string().max(120).optional(),
  view: CardView,
  formats: z.record(z.string(), ColumnFormat).default({}),
  insight: z.string().max(280).optional(),
});
```

```ts
// ask.ts
export type AskPhase = "schema" | "sql" | "run" | "present";
export type AskEvent =
  | { type: "phase"; phase: AskPhase; detail: string } // "Reading the analytics schema"
  | { type: "sqlDelta"; text: string }
  | { type: "sqlReset"; reason: string } // repair attempt restarts SQL
  | { type: "sqlDone"; sql: string; dialect: DialectType; lines: number }
  | {
      type: "result";
      columns: ColumnInfo[];
      rows: unknown[][];
      rowCount: number;
      executionTimeMs: number;
      isTruncated: boolean;
    }
  | { type: "card"; spec: CardSpec; source: "model" | "inferred" }
  | {
      type: "error";
      phase: AskPhase;
      code: AskErrorCode;
      message: string;
      sql?: string;
    }
  | { type: "done" };
export type AskErrorCode =
  | "NO_AI_SETTINGS"
  | "AI_AUTH"
  | "AI_RATE_LIMIT"
  | "AI_NETWORK"
  | "UNSUPPORTED_ENGINE"
  | "NOT_READ_ONLY"
  | "QUERY_FAILED"
  | "TIMEOUT"
  | "CANCELLED"
  | "INVALID_SPEC";
```

RPC additions in `packages/rpc/src/schema.ts`:

```ts
requests: {
  ask: { params: { askId: string; connectionId: string; database: string | null; prompt: string }; response: void };
  cancelAsk: { params: { askId: string }; response: void };
}
messages: { askEvent: { askId: string; event: AskEvent } }
```

## Scope

**In scope**

- `packages/agent/` (create). Copy `package.json`, `tsconfig.json` and the vitest
  setup from `packages/core`. Dependencies: `ai`, `@ai-sdk/*`, `zod`
  (`catalog:`), `@oh-my-query/core`, and `@oh-my-query/rpc`.
- `packages/rpc/src/{card-spec,ask,schema,index}.ts`.
- `packages/core/src/traits.ts` and every driver's `Pool.execute`: add a fifth
  optional `options?: ExecuteOptions` argument, where
  `interface ExecuteOptions { readOnly?: boolean }`. Plan 006 adds `params`.
- `packages/drivers-{pg,mysql,sqlite,duckdb,mssql,clickhouse}`: implement
  `readOnly`. Mongo and Redis ignore it, and ask rejects them first (see below).
- `apps/app/src/bun/rpc.ts`, plus a new `apps/app/src/bun/ask-service.ts`
  (thin wiring of ports to the pipeline, the per-`askId` AbortController, and
  event forwarding through `rpc.send.askEvent`).
- Move `ai-schema-formatter.ts`, `ai-errors.ts` and `ai-provider.ts` (with their
  tests) from `apps/app/src/mainview/lib/` into `packages/agent/src/`, then
  delete the renderer copies and the `ai`/`@ai-sdk/*` deps from
  `apps/app/package.json`. The bun bundle imports `@oh-my-query/agent`.

**Out of scope**

- Any renderer UI. Plan 005 consumes the events. Add only the typed IPC
  subscription helper in `lib/ipc.ts`
  (`onAskEvent(askId, handler) => unsubscribe`) and the browser-stub
  implementation.
- Multi-turn follow-ups ("now split by plan"). This is deferred; see
  Maintenance notes.
- Mongo and Redis ask support. They return `UNSUPPORTED_ENGINE` with the message
  "Asking questions works with SQL databases for now."

## Git workflow

- Branch `feat/launcher-004-ask-pipeline`. Commit only if authorized.

## Steps

### Step 1: Contract and package skeleton

Create `packages/agent` and the rpc contract files. Unit-test the `CardSpec`
parsing: valid specs for each view; a `groupBy` with more than one `y` is
rejected (add a `superRefine`); and a title over 80 characters is rejected.

### Step 2: Read-only guard (`packages/agent/src/read-only-guard.ts`)

`assertReadOnly(sql, dialect): { ok: true } | { ok: false; reason: string }`.
Work on `normalizeSqlForAnalysis(sql)`. The function must:

- Allow exactly one statement. A `;` followed by any non-whitespace is a
  rejection.
- Require the first keyword to be one of `select`, `with`, `show`, `describe`,
  `desc`, `explain`, `values` or `table`. Reject `pragma`, which can write in
  SQLite.
- Reject the statement if any of these appear anywhere as a whole word:
  `insert`, `update`, `delete`, `merge`, `upsert`, `replace into`, `create`,
  `drop`, `alter`, `truncate`, `grant`, `revoke`, `copy`, `call`, `exec`,
  `execute`, `attach`, `detach`, `vacuum`, `set`, `lock`, `into` (which catches
  `select … into`), `load`, `install` (DuckDB extensions), or `pg_sleep`,
  `pg_terminate_backend` and `dblink`.
- Also reject anything `classifyStandardSql` flags.

Tests cover at least 25 cases: allowed selects and CTEs, string literals that
contain forbidden words (`where note = 'drop table'`, which the normalizer
strips), comment injection (`select 1; -- \n drop table x`), data-modifying
CTEs (`with x as (delete from t returning *) select * from x`), `select into`,
and multi-statement input.

### Step 3: Driver read-only execution

For `readOnly: true`, use the strongest enforcement each engine supports, on the
same connection that runs the query:

- PostgreSQL: `BEGIN READ ONLY` … `ROLLBACK`, using a dedicated client from the
  pool.
- MySQL: `START TRANSACTION READ ONLY` … `ROLLBACK`.
- SQLite: `PRAGMA query_only = ON` for the call, then restore it. Or use a
  separate read-only handle if the driver opens files.
- DuckDB: a read-only connection if one is available. If not, rely on the guard
  and record the gap in the PR.
- MSSQL: run inside a transaction with `ROLLBACK`.
- ClickHouse: the per-query setting `readonly=1`.

Add one integration-style test per driver, where the package already has a test
harness (pg, clickhouse and duckdb have real `vitest run`). For example, check
that `insert` under `readOnly` rejects. Skip a test cleanly when its fixture is
unavailable, following the package's existing pattern.

### Step 4: Pipeline (`packages/agent/src/ask.ts`)

```ts
export async function* runAsk(prompt: string, ports: AskPorts, signal: AbortSignal): AsyncGenerator<AskEvent>
```

1. **schema**: yield `phase("schema", "Reading the {label} schema")`. Load the
   schema and format it with the moved `formatSchemaForPrompt`. Large schemas
   (more than about 150 tables) go through a relevance pre-filter first: score
   table and column names against the prompt tokens with the fuzzy matcher, keep
   the top 40 tables plus their foreign-key neighbors, and add a line noting the
   omission.
2. **sql**: yield `phase("sql", "Writing SQL")`. Call `streamText` with a system
   prompt that requires one read-only statement in the target dialect,
   beginning with a one-line `-- comment` that describes the result. It returns
   no prose and no code fences, aliases columns in snake_case, puts time
   buckets in the first column ordered ascending, limits the output to about
   500 rows unless asked otherwise, and avoids `select *`. Yield `sqlDelta`
   chunks with code fences stripped incrementally (fence detection must work
   across chunk boundaries). Then yield `sqlDone`.
3. **guard**: run `assertReadOnly`. On failure, yield an error with
   `NOT_READ_ONLY` and stop. Do not repair a guard failure, because a model that
   writes a mutation should not be pushed to disguise it.
4. **run**: yield `phase("run", "Read only on {label}")`, then call
   `ports.execute(sql)` with a 30s timeout and 2,000 max rows. On a DB error,
   attempt a **repair**, at most 2 times: yield `sqlReset`, then stream a
   corrected statement with the error message and the failed SQL in context,
   and repeat the guard and the run. After the final failure, yield
   `QUERY_FAILED` with the DB message and the last SQL. Then yield `result`.
5. **present**: yield `phase("present", "Shaping the result")`. Compute
   `stats` per column: numeric min/max/first/last/sum; distinct count; temporal
   range. Ask for structured output (AI SDK v6 structured output, either
   `generateObject` or `streamText` with an output schema, whichever the
   installed version documents) against `CardSpec` minus `version`. Pass
   columns, types, sample rows and stats, and instruct the model that the
   insight may only cite numbers from the stats. Validate the spec: every
   referenced column must exist; `y` columns must be numeric; a pie needs ≤8
   rows. If validation fails or the call takes more than 8s, use
   `inferCardSpec(result, prompt)`. Yield `card` with `source`.
6. Yield `done`. Every exit path yields exactly one terminal event, either
   `done` or `error`. `CANCELLED` is yielded when the signal aborts.

`inferCardSpec` is a pure, deterministic function:

- One row and one numeric column → `kpi`.
- Temporal or ordered first column and numeric y → `line`. If the data has an
  extra low-cardinality text column (≤6 distinct values), use `groupBy`.
- A categorical first column and numeric y → `bar`.
- Otherwise → `table`.

Its title comes from the SQL's leading comment, or from the prompt if there is
no comment. Formats are inferred from column names and types: `*_cents`,
`revenue`, `mrr`, `amount` and `price` → currency USD; `*_pct` and `rate` →
percent; date types → `month` when every value falls on the first of a month.

### Step 5: Bun wiring

In `ask-service.ts`, `startAsk(params)` does the following:

1. Resolve the connection, AI settings (`getAiSettings()`; when missing, emit
   `NO_AI_SETTINGS`), pool, dialect and PII options.
2. Build the ports. `execute` uses the transpile-free path with
   `{ readOnly: true }` and records history via `appendHistory`.
3. Iterate `runAsk`, forwarding each event via `rpc.send.askEvent`.
4. Store the AbortController by `askId`. `cancelAsk` aborts it and calls the
   driver cancellation for the running query (reuse `CancellationRegistry`).

Allow one active ask per connection: a new ask cancels the previous one.

## Test plan

- `packages/agent/src/read-only-guard.test.ts` (≥25 cases).
- `packages/agent/src/ask.test.ts`, using the AI SDK mock language model from
  `ai/test` (check the export name for v6) and fake ports. Cases:
  - Happy path, with the exact event order schema → sql deltas → sqlDone → run
    → result → present → card → done.
  - Fences stripped across chunks.
  - A guard rejection, with no execute call.
  - A DB error repaired on the first attempt (`sqlReset` is emitted).
  - Two failed repairs → `QUERY_FAILED`.
  - Cancel mid-SQL → `CANCELLED`, with no execute call.
  - An invalid model spec → `card` with `source: "inferred"`.
  - Present timeout → inferred spec.
  - PII redaction is applied to the sample rows sent to the model (assert on
    the mock's received prompt).
  - Schema pre-filter on a 300-table fixture.
- `packages/agent/src/infer-card-spec.test.ts`: the KPI, line + groupBy, bar,
  table and format inference cases.
- The moved tests (`ai-schema-formatter.test.ts`, `ai-errors.test.ts`) pass in
  their new location.
- `packages/rpc`: card-spec parse tests.

## Done criteria

- [ ] `rg -n "from \"ai\"|@ai-sdk" apps/app/src/mainview` → no matches.
- [ ] `bun run test` (turbo, all packages) exits 0. The `packages/agent` tests
      include every case listed above.
- [ ] `bun run check-types` and `bun run check` exit 0.
- [ ] Manual, desktop dev against the fixture Postgres: calling `ask` from the
      devtools console via the IPC helper streams events in order and ends in
      `card` + `done`. Prompting "delete all users" produces `NOT_READ_ONLY`, or
      a harmless select. Rows are never deleted.
- [ ] No row data or keys appear in bun logs during the manual run.

## STOP conditions

- A driver cannot enforce read-only on the same connection without a pool
  redesign. Ship guard-only for that engine, but **report it**. Do not silently
  skip it.
- The AI SDK v6 structured-output API cannot validate against a zod
  discriminated union for one of the configured providers (some
  OpenAI-compatible local models). Fall back to inferred specs for that
  provider and report it. Do not loosen the schema.
- Electrobun RPC messages cannot stream at the needed rate (more than about 50
  messages/s) without dropping. Batch `sqlDelta` at about 30ms and report.

## Maintenance notes

- `CardSpec` and `AskEvent` are protected contracts. Plans 005–007 render and
  persist them. Any change bumps `CardSpec.version` and adds a migration.
- Follow-up questions (conversation memory per ask) are deferred. When added,
  pass the previous SQL and spec as context. Do not build a chat thread UI.
- Reviewers should scrutinize the guard word list and the driver read-only
  wrappers more than the prompts.
