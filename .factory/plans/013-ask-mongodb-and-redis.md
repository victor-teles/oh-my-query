# Plan 013: Ask MongoDB and Redis questions, read-only by construction

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md` unless the coordinator owns that index.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages/agent packages/core/src packages/rpc/src packages/drivers packages/drivers-mongo packages/drivers-redis apps/app/src/bun apps/app/src/mainview/components/ask apps/app/src/mainview/components/widgets apps/app/src/mainview/lib apps/app/e2e infra/docker-compose.yaml`
> and `git status --short`. Plans 001–007 are implemented but uncommitted in the
> working tree; that working tree is the baseline. Confirm: `MongoPool.execute`
> still rejects every call (`packages/drivers-mongo/src/pool.ts:159-168`),
> `RedisPool.execute` still ignores `options` (`packages/drivers-redis/src/pool.ts`),
> `CARD_SPEC_VERSION` is still `1`, and `AskEvent.sqlDone.dialect` is still
> `DialectType`. If plan 012 landed first, build on its `runAsk(prompt, ports,
signal, refine?)` and `RefineContext` (refine works per engine for free once
> the engine port exists — keep it working). If plan 018 landed first, do not
> add Mongo/Redis to `Source` here (see Out of scope).

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: HIGH (model-written queries against engines with no server-side read-only session; a protected contract version bump)
- **Depends on**: none hard. Soft: `.factory/plans/012-refine-answer-in-place.md`.
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19, on `feat/launcher-002-shell` with plans 001–007 uncommitted in the working tree (treated as baseline)

## Why this matters

MongoDB and Redis connections can be saved, but asking anything returns
"Asking questions works with SQL databases for now." For teams whose product
data lives in Mongo, or who want "how many sessions are live" or "top 10 on the
leaderboard" from Redis, the launcher is useless. This plan makes both engines
askable through the same signature flow (question → streamed query → read-only
run → card), with a **per-engine allowlist guard** (never a denylist), schema
sampling so the model knows the shapes, and flattening of documents and replies
into the same `TabularResult` every card already draws. Widgets stay SQL-only
(justified below), so the blast radius stays in the ask path.

## Current state

- The refusal: `apps/app/src/bun/connection-access.ts:11-12`
  `UNSUPPORTED_ENGINE_MESSAGE = "Asking questions works with SQL databases for now."`,
  thrown by `ask-service.ts:96-101` when `pool.dialect` is null and by
  `tabular()` (`connection-access.ts:58-65`) for non-tabular results. Renderer
  copy in `components/ask/ask-error.tsx:57-61`. Widgets refuse separately in
  `apps/app/src/bun/widget-service.ts:170-175` ("Widgets work with SQL
  databases for now.") with copy in `components/widgets/widget-error.tsx:42-45`.
- **MongoDB cannot run any query today.** `MongoPool` (`drivers-mongo/src/pool.ts`)
  has `dialect = null`, `fetchSchema` lists collections with **empty
  `columns`** (`:113-157`), and `execute` always rejects (`:159-168`). The
  installed driver is `mongodb@6.21.0`, whose operation options accept
  `signal?: AbortSignal` (`mongodb.d.ts:68`), `AggregateOptions.maxTimeMS`, and
  which re-exports `BSON` (with `BSON.EJSON`).
- **Redis runs raw command text and ignores read-only.**
  `RedisPool.execute(sql, maxRows, schema, signal)` (`drivers-redis/src/pool.ts`)
  parses lines with `parseRedisCommands` and sends each through
  `client.call(name, ...args)`; there is no `options` parameter, so
  `{ readOnly: true }` is silently ignored. It also calls `client.select(db)` on
  the **shared** connection and never restores it. `fetchSchema` returns no
  tables. `ioredis@5.10.1` offers `redis.duplicate(override?: Partial<RedisOptions>)`.
- The "safe mode" work from commit 37ab651 (`drivers-mongo/src/safe-mode.ts`,
  `drivers-redis/src/safe-mode.ts`, `core/src/safe-mode.ts`) is a **denylist of
  destructive patterns** (`dropDatabase(`, `deleteMany({})`, `FLUSHALL`,
  `DEL *` …) for a confirm-before-run UX. It is **not** reusable as a read-only
  guard: anything not listed (e.g. `$merge`, `SET`, `EVAL`) passes it. Reuse
  only its rule-table style (`matchRule`), not its policy. The opportunity map's
  claim "Drivers already honour `readOnly`" is false for these two engines.
- Ask pipeline: `packages/agent/src/ask.ts` is SQL-shaped — `AskPorts.dialect:
DialectType` (`:22-30`), `sqlSystemPrompt` (`prompts.ts:14-36`),
  `assertReadOnly(sql, dialect)` (`ask.ts:238`), `formatSchemaForPrompt(schema,
dialect, …)` (`schema-prompt.ts`, `DIALECT_LABELS`). The fence stripper and
  streaming (`sql-stream.ts`) are text-generic. `presentCard` works on any
  `TabularResult`.
- **Protected contract in the way:** `AskEvent`'s
  `{ type: "sqlDone"; sql; dialect: DialectType; lines }`
  (`packages/rpc/src/ask.ts:23`). A Mongo pipeline has no valid `DialectType`,
  so asking these engines **requires an `AskEvent` change**, which the repo
  rule allows only with a `CardSpec.version` bump. `CARD_SPEC_VERSION = 1` and
  `version: z.literal(CARD_SPEC_VERSION)` (`card-spec.ts:3,72`); `Widget.spec`
  (`widget.ts:257`) and `RecentAsk.spec` (`widget.ts:279`) embed `CardSpec`, so
  stored files carry `version: 1`. `RecentAsk.dialect` is the SQL-only
  `Dialect` enum (`widget.ts:30-43`, `:272-281`). Boards hold no spec.
- Fixtures: `infra/docker-compose.yaml` has a `mongodb` service (`mongo:8`,
  root `omq`/`omq`, db `oh_my_query`, `127.0.0.1:27017`) but **no Redis**;
  `bun run fixtures:up` starts only Postgres. Driver fixture tests follow
  `drivers-pg/src/read-only.test.ts:97-120` (connect, `describe.skipIf(!fixture)`).
- `apps/app` depends on `@oh-my-query/drivers` only; Mongo/Redis helpers must be
  re-exported from `packages/drivers/src/index.ts` (which today exports only
  `ConnectionPoolManager`, `getDriver`, `testConnection`).

## Decisions made in this plan

1. **Bump `CARD_SPEC_VERSION` to 2** (owner approved 2026-11-19; shape unchanged) to widen
   `AskEvent.sqlDone.dialect` from `DialectType` to `QueryLanguage`
   (`DialectType | "mongodb" | "redis"`). `CardSpec` parsing accepts `version:
1 | 2` and outputs `2`, so every stored widget and recent ask loads unchanged
   and is rewritten as v2 on its next save. The field keeps its name `dialect`
   to minimise churn.
2. **Widgets stay SQL-only.** Widget runs depend on `compileSqlTemplate`
   turning `{{name}}` into driver bind markers; Mongo/Redis have no equivalent
   in that compiler, and `Widget.dialect`/`sqlTemplate` are protected. Plan 018
   generalizes widgets into `Source` kinds with a versioned migration — that is
   where `"mongo"`/`"redis"` sources belong, once, rather than a one-off
   `Widget` change now. In the ask view `⌘S`/`⌘⇧S` on a non-SQL answer show
   "Saving works with SQL databases for now." in the save status; result
   actions that don't create widgets (plan 008 copy/export) keep working.
3. **Recents include Mongo/Redis asks.** `RecentAsk.dialect` widens to
   `QueryLanguage` (a widening: every existing file still parses; covered by a
   load test). Re-asking a recent works for any engine.
4. **Mongo asks are aggregation pipelines only.** `find` is a strict subset
   (`$match/$project/$sort/$limit`), so one shape keeps the guard and prompt
   small.
5. **Redis asks are a JSON plan, not raw command text**: either a short list of
   allowlisted read commands or a bounded key `scan` aggregation (count /
   memory / TTL by key pattern or type). The model never writes free-form
   command lines.
6. **Guards live in `@oh-my-query/core/client`** (pure, no driver deps), are
   called by the agent before running (to emit `NOT_READ_ONLY` with the query)
   **and** again inside the driver entry points (defense in depth: no caller
   can bypass them).

## Commands you will need

| Purpose            | Command                                                                                                    | Expected                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Fixtures           | `docker compose -f infra/docker-compose.yaml up -d mongodb redis`                                          | both healthy (Redis added by this plan) |
| Mongo driver tests | `bun run --cwd packages/drivers-mongo test`                                                                | pass; fixture suites run when up        |
| Redis driver tests | `bun run --cwd packages/drivers-redis test`                                                                | pass; fixture suites run when up        |
| Core / rpc / agent | `bun run --cwd packages/core test`, `bun run --cwd packages/rpc test`, `bun run --cwd packages/agent test` | all pass                                |
| App tests (both)   | `bun run --cwd apps/app test`                                                                              | all pass — REQUIRED                     |
| e2e                | `bun run --cwd apps/app e2e`                                                                               | all pass                                |
| Types / lint       | `bun run check-types`, `bun run check`                                                                     | exit 0                                  |
| Desktop            | `bun run --cwd apps/app desktop:dev` driven with the `cua-driver` skill                                    | asks work on fixture connections        |

## Implementation rules relevant to this plan

- **Allowlist, never denylist.** A query passes only if every stage/command/
  operator is known-read. Unknown → reject with a plain reason naming the
  offending token. Denied tokens get specific messages for clarity, but the
  allowlist is the policy.
- **Defense in depth.** The same guard function runs in the agent (before
  execute) and in the driver entry point (`runMongoReadQuery`,
  `runRedisReadPlan`). Drivers never accept an unguarded model query.
- **Bounded everything:** 30s per query (`maxTimeMS`, abort signal), ≤ 2,000
  rows (`ASK_MAX_ROWS`), Mongo pipeline ≤ 30 stages and ≤ 20 KB JSON, Redis
  plan ≤ 20 commands, scans ≤ 10,000 keys / 50 iterations, memory/TTL measures
  ≤ 2,000 keys. Hitting a bound sets `isTruncated: true`; it never errors.
- **No shared-state mutation:** Redis work runs on `client.duplicate({ db })`,
  closed in `finally`; never `SELECT` on the pool's shared client.
- **PII:** schema text sent to the model contains field names/types and
  generalized key patterns only, never values; run it through `redactPii` when
  the connection has redaction on (as `formatSchemaForPrompt` does today).
- Validate model output with zod at the edge (`JSON.parse` → zod → guard);
  EJSON-deserialize only after the guard passes.
- Strict TS (no `any`, no unsafe casts — driver replies are `unknown`, narrow
  them), `noUncheckedIndexedAccess`. No code comments by default. Small
  components, hooks own logic, hotkeys in hooks. Colocated tests (`*.test.ts`
  pure, `*.browser.test.tsx` UI), snapshots for empty/loading/error/populated,
  80% line coverage.
- Keep `@oh-my-query/core` out of `apps/app/src/bun/index.ts` imports.
- Copy is quiet and specific: "Generated pipeline · MongoDB", "Read only on
  sessions-cache"; no "AI".

## Contracts added or changed

Protected (changed under this plan's version bump):

```ts
// packages/core/src/types.ts (+ export the guard from core/client)
export type QueryLanguage = DialectType | "mongodb" | "redis";
export const isSqlDialect = (language: QueryLanguage): language is DialectType =>
  language !== "mongodb" && language !== "redis";

// packages/rpc/src/card-spec.ts
export const CARD_SPEC_VERSION = 2;
version: z.union([z.literal(1), z.literal(2)]).transform(() => CARD_SPEC_VERSION),

// packages/rpc/src/ask.ts — the only AskEvent change
| { type: "sqlDone"; sql: string; dialect: QueryLanguage; lines: number }

// packages/rpc/src/widget.ts — RecentAsk only; Widget.dialect stays `Dialect`
export const QueryLanguageSchema = z.enum([...DIALECTS, "mongodb", "redis"]);
RecentAsk.dialect: QueryLanguageSchema
```

New (unprotected), in `packages/core/src/` and exported from `client.ts`:

```ts
// mongo-read-query.ts
export interface MongoReadQuery { description?: string; collection: string; pipeline: Record<string, unknown>[] }
export const parseMongoReadQuery = (text: string): { ok: true; query: MongoReadQuery } | { ok: false; reason: string };

// redis-read-plan.ts
export type RedisReadPlan =
  | { kind: "commands"; description?: string; commands: [string, ...string[]][] }
  | { kind: "scan"; description?: string; match: string; groupBy: "pattern" | "type" | "none";
      measure: "count" | "memory" | "ttl"; limit: number };
export const parseRedisReadPlan = (text: string): { ok: true; plan: RedisReadPlan } | { ok: false; reason: string };

// flatten.ts
export const flattenRecords = (records: readonly Record<string, unknown>[], options: { maxColumns: number; isTruncated: boolean }): TabularResult;
```

Agent (internal port, not protected): `AskPorts.dialect` is replaced by
`AskPorts.engine: QueryEngine`:

```ts
export interface QueryEngine {
  language: QueryLanguage;
  label: string; // "PostgreSQL", "MongoDB", "Redis"
  systemPrompt(input: {
    connectionLabel: string;
    schemaText: string;
    today: Date;
  }): string;
  repairInstruction(error: string): string;
  formatSchema(schema: SchemaInfo, options: SchemaPromptOptions): string;
  guard(text: string): ReadOnlyVerdict;
}
export const sqlEngine: (dialect: DialectType) => QueryEngine; // today's behaviour, unchanged
export const mongoEngine: QueryEngine;
export const redisEngine: QueryEngine;
```

## UI and motion (mandatory)

Motion is mandatory and never cut; use `lib/motion.ts` tokens and
`components/motion/` primitives (rules as in plan 005: `SPRING` 400/30 for
morphs, `SPRING_SNAPPY` 600/49 for selection/toggles, `SPRING_SOFT` 260/32 for
height/reveals, `FADE_IN` 160ms, `FADE_OUT` 110ms, `PRESS` 0.97/100ms, stagger
30ms capped at 6; animate only `transform`/`opacity`/`filter`; interruptible;
reduced motion → crossfade or instant; reduced transparency → opaque;
increased contrast → solid borders; focus rings always visible; loading never
shows under 150ms and holds ≥300ms). This plan adds **no new choreography**:
Mongo/Redis asks must look and move exactly like SQL asks. The deltas are labels,
highlighting and one disabled state.

| Moment             | Trigger                                | What moves                                                                                                                                                                     | Token         | Reduced motion |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | -------------- |
| Query header label | ask starts on a Mongo/Redis connection | Header title reads "Generated pipeline" / "Generated commands"; segments `<SwapText>` as today (`MongoDB · 14 lines` → `27 rows · 120ms`).                                     | `FADE_IN`     | Instant        |
| Query streaming    | `sqlDelta`                             | JSON streams into the existing block with the JSON highlighter (keys, strings, numbers, `$operators` in the amber accent); same caret, same `layout` growth and pin-to-bottom. | `SPRING_SOFT` | Static caret   |
| Read-only refusal  | guard rejects                          | Existing error `<Reveal>`; the offending stage/command (e.g. `$merge`, `SET`) is underlined in the block exactly like a SQL keyword today.                                     | `FADE_IN`     | Instant        |
| Save unavailable   | `⌘S`/`⌘⇧S` on a non-SQL answer         | Footer status `<SwapText>`s to "Saving works with SQL databases for now." for 2.4s, then back; the Save hint is shown dimmed (`aria-disabled`). No shake.                      | `FADE_IN`     | Instant        |
| Truncated sample   | scan/rows hit a bound                  | Header row count reads `2,000+ rows` (existing `+` convention) and the table summary "Showing 200 of 2,000+"; no extra motion.                                                 | —             | —              |

## Scope

**In scope**

- `packages/core/src/{types,client,index}.ts`; create `mongo-read-query.ts`,
  `redis-read-plan.ts`, `flatten.ts` + `*.test.ts` for each.
- `packages/rpc/src/{card-spec,ask,widget,index}.ts` + tests (`card-spec.test.ts`,
  `widget.test.ts` v1-file load cases).
- `packages/agent/src/`: create `engines/{sql,mongo,redis}.ts` (+ tests), adapt
  `ask.ts`, `prompts.ts` (Mongo/Redis prompts), `schema-prompt.ts` (per-engine
  formatters), `index.ts`; update `ask.test.ts`.
- `packages/drivers-mongo/src/`: create `read-query.ts` (`runMongoReadQuery`,
  BSON value normalisation) + tests (unit + fixture); `pool.ts` `fetchSchema`
  field sampling + tests; `index.ts` exports.
- `packages/drivers-redis/src/`: create `read-plan.ts` (`runRedisReadPlan`),
  `key-patterns.ts` (pattern generalisation, sampling) + tests (unit +
  fixture); `pool.ts` `fetchSchema` from key patterns; `index.ts` exports.
- `packages/drivers/src/index.ts` (re-export the two runners and `isMongoPool`/`isRedisPool`).
- `apps/app/src/bun/ask-service.ts` (+ test), `connection-access.ts`.
- `apps/app/src/mainview/`: `components/ask/ask-reducer.ts` (dialect type),
  `ask-header.tsx` (title by language), `sql-block.tsx` (+ `lib/json-highlight.ts`
  - test), `ask-view.tsx`/`widgets/use-ask-save.ts` (save disabled for non-SQL),
    `ask-error.tsx` copy, `lib/browser-ask-stub.ts` (recorded Mongo + Redis asks),
    colocated tests/snapshots.
- Every `version: 1` CardSpec literal in fixtures/stubs/tests → `CARD_SPEC_VERSION`
  (18 files reference it today; `rg -n "version: 1\b|CARD_SPEC_VERSION" apps/app/src packages/*/src`).
- `infra/docker-compose.yaml` (add a `redis` service, `redis:7-alpine`, `127.0.0.1:6379`).
- `apps/app/e2e/ask-flow.spec.ts` (Mongo and Redis cases).
- `CLAUDE.md` (Engines line in the AI bullet), `.factory/plans/README.md` status
  row and the "Engines" default line.

**Out of scope**

- Widgets, boards and `proposeParams` for Mongo/Redis (Decision 2). `Widget`
  and `Board` schemas must not change.
- Adding `mongo`/`redis` kinds to `Source` (plan 018 owns `Source`).
- Assumptions line (plan 012's `describeSql`) for non-SQL: return `null`
  without calling polyglot.
- Mongo `$facet`, `$out`, `$merge`, server-side JS, change streams, admin
  commands; Redis modules other than none (RedisJSON/TimeSeries deferred);
  Redis Cluster key slots (single-node and managed single-endpoint only).
- Changing `RedisPool.execute`'s raw-text behaviour for other callers (none in
  the launcher today); asks never call it.

## Git workflow

- Branch `feat/launcher-013-mongo-redis` from the current working branch. Commit
  only if authorized; do not push or open a PR unless instructed.

## Steps

### Step 1: Version bump and language type (rpc, core)

Add `QueryLanguage`/`isSqlDialect` to core types and `client.ts`. In rpc: bump
`CARD_SPEC_VERSION` to 2 with the upgrade-on-parse union; widen
`AskEvent.sqlDone.dialect` and `RecentAsk.dialect`. Replace hard-coded
`version: 1` in fixtures/stubs with the constant. Tests:

- `card-spec.test.ts`: a v1 spec parses and outputs `version: 2`; v3 rejects.
- `widget.test.ts`: a v1 `Widget` record and a v1 `RecentAsk` record (copied
  from a real pre-plan file shape, with `version: 1` and a SQL dialect) parse;
  a `RecentAsk` with `dialect: "mongodb"` parses; a `Widget` with
  `dialect: "mongodb"` still **rejects**.
- core: a `widgets.enc`/`recent-asks.enc` written with v1 records loads through
  the real record store (`createWidgetStore`/`createRecentAskStore`) and
  re-saves as v2.

### Step 2: Guards (core/client, pure)

`parseMongoReadQuery(text)`:

1. `JSON.parse` (reject non-object, > 20 KB); zod shape
   `{ description?: string ≤ 200, collection: /^[^$\0]{1,120}$/ not starting with
"system.", pipeline: array 1..30 of objects }`.
2. Each stage has exactly one key, in `STAGES = { $match, $project, $addFields,
$set, $unset, $group, $sort, $limit, $skip, $count, $unwind, $lookup,
$bucket, $bucketAuto, $sortByCount, $replaceRoot, $replaceWith, $sample,
$unionWith, $setWindowFields, $densify, $fill, $geoNear, $graphLookup }`.
   `$geoNear` only as the first stage. `$lookup.from`, `$unionWith.coll`/string
   form and `$graphLookup.from` must not start with `system.`.
3. Nested pipelines (`$lookup.pipeline`, `$unionWith.pipeline`) are validated
   recursively with the same stage allowlist.
4. A recursive walk over **every** key in the pipeline rejects
   `$out, $merge, $function, $accumulator, $where, $currentOp, $listSessions,
$listLocalSessions, $planCacheStats, $changeStream, $collStats, $indexStats`
   wherever they appear, with "`$merge` writes data; only read-only pipelines
   can run here."
5. Unknown stage → "`$foo` is not an allowed pipeline stage."

`parseRedisReadPlan(text)`: `JSON.parse` + zod discriminated union on `kind`.

- `commands`: 1..20 commands, each `[name, ...args]`, ≤ 10 args, each ≤ 512
  chars. Allowlist (case-insensitive), each with a reply shape:
  - scalar: `GET STRLEN EXISTS TYPE TTL PTTL HGET HLEN HEXISTS LLEN LINDEX SCARD
SISMEMBER ZCARD ZSCORE ZCOUNT ZRANK ZREVRANK XLEN PFCOUNT BITCOUNT GETRANGE
DBSIZE`, `MEMORY USAGE <key>` (args[0] must be `USAGE`),
    `INFO <memory|stats|keyspace|clients|server>`;
  - keyed: `MGET` (key/value), `HMGET` (field/value);
  - collection: `HGETALL HKEYS HVALS SMEMBERS SRANDMEMBER HRANDFIELD`,
    `LRANGE` (stop − start ≤ 1,999), `ZRANGE ZREVRANGE ZRANGEBYSCORE
ZREVRANGEBYSCORE` (any `WITHSCORES`/`LIMIT`/`BYSCORE`/`REV` options; no
    `STORE`), `XRANGE XREVRANGE` (must include `COUNT n`, n ≤ 2,000).
    A plan is either exactly one collection command, or 1..20 scalar/keyed
    commands. Explicitly rejected with a specific reason: `KEYS` ("use a scan
    plan"), `SORT`, `EVAL*`, `FCALL*`, `SCRIPT`, `FUNCTION`, `CONFIG`, `DEBUG`,
    `FLUSH*`, `DEL`, `UNLINK`, `SET*`, `*STORE`; anything else → "`X` is not in
    the read-only command list."
- `scan`: `match` glob ≤ 200 chars, `groupBy`, `measure`, `limit` 1..100.

Tests are table-driven: every allowed stage/command passes in a minimal valid
form; every denied token is rejected **including when nested** (`$merge` inside
a `$lookup` sub-pipeline, `$where` inside `$match`, `$function` inside
`$group`); malformed JSON, wrong types and oversized inputs reject; a
legitimate realistic pipeline and plan pass (so "reject everything" can't
satisfy the suite).

### Step 3: Flattening (core/client) and BSON normalisation (drivers-mongo)

`flattenRecords(records, { maxColumns: 30, isTruncated })`: columns are the
union of keys in first-seen order; nested plain objects flatten one level with
dot paths (`address.city`); deeper objects and arrays become compact JSON
strings; `typeName` per column: all numbers → `NUMERIC`, all ISO date strings →
`TIMESTAMP`, all booleans → `BOOLEAN`, any JSON-stringified → `JSON`, else
`TEXT` (so `lib/card-data.ts`'s numeric/date detection works unchanged).
Mongo `_id` that is an ObjectId hex is kept as the first column only if the
pipeline did not `$project` it away. In `drivers-mongo/src/read-query.ts`,
`toPlainValue` maps BSON before flattening: ObjectId → hex string, Date → ISO
string, Decimal128/Long/Int32/Double → number when finite and safe else string,
Binary → `"<binary n bytes>"`, UUID → string, everything else → `String()`.
Tests: mixed shapes, column cap, nested/array handling, type inference,
`_bsontype` values.

### Step 4: Driver entry points

**Mongo** — `runMongoReadQuery(pool, text, database, maxRows, signal):
Promise<TabularResult>`: guard with `parseMongoReadQuery` (throw
`DbError("NOT_READ_ONLY", reason)` on failure), `BSON.EJSON.deserialize` the
pipeline (relaxed: false) so `{"$date": …}`/`{"$oid": …}` become BSON types,
then `client.db(database).collection(collection).aggregate([...pipeline,
{ $limit: maxRows + 1 }], { maxTimeMS: 30_000, signal, comment: "oh-my-query ask" })
.toArray()`; truncate to `maxRows`, set `isTruncated`, flatten. Map errors with
`mapMongoError`.

**Mongo schema** — `MongoPool.fetchSchema` fills `columns` by sampling: for up
to 100 non-view collections (sorted by name), 4 at a time, `aggregate([{ $sample:
{ size: 50 } }], { maxTimeMS: 2_000 })`; collect field paths to depth 2 with the
dominant BSON type name (`objectId`, `string`, `int`/`double` → `number`,
`date`, `bool`, `array<object>`, `object` …), up to 40 fields per collection;
a failed or timed-out sample leaves `columns: []`. Never include values.

**Redis** — `runRedisReadPlan(pool, text, database, maxRows, signal):
Promise<TabularResult>`: guard with `parseRedisReadPlan`, then run on
`client.duplicate({ db: parseDbIndex(database) })` (quit in `finally`, abort on
`signal`):

- collection command → rows by shape: `HGETALL` (field, value), `ZRANGE …
WITHSCORES` (member, score), `LRANGE/SMEMBERS/…` (value), `XRANGE` (id +
  entry fields flattened);
- scalar/keyed commands → one row per value: (command, key, value), `MGET`
  zipped with its keys, `HMGET` with its fields, `INFO` parsed into
  (field, value) rows;
- `scan` → iterate `SCAN cursor MATCH match COUNT 500` until done or 10,000
  keys / 50 iterations; group by generalised pattern (Step 5) or `TYPE`; measure
  `count`, or pipelined `MEMORY USAGE`/`PTTL` over at most 2,000 keys; rows
  `(group, keys[, memory_bytes | avg_ttl_secs])` sorted by the measure desc,
  first `limit`; `isTruncated` when a bound was hit.
  Numeric strings in replies become numbers so cards chart them.

**Redis schema** — `RedisPool.fetchSchema(db)` (on a duplicated client): scan
up to 2,000 keys, generalise names into patterns, and for each pattern (≤ 60,
most frequent first) record `TYPE`; for hashes, `HKEYS` of one sample key
(≤ 30 fields). Map to `TableItem`: `name` = pattern, `columns` = hash fields
(dataType `string`) or one `value` column whose dataType is the Redis type,
`rowEstimate` = sampled count scaled by `DBSIZE / sampled` (rounded).

`key-patterns.ts` (pure): split on `:`, replace segments that look like
integers, UUIDs, hex ≥ 12 chars, emails, ISO dates or base64-ish tokens ≥ 16
chars with `*`; collapse repeated patterns. Tests with realistic keys
(`session:3f2a…`, `user:42:cart`, `rate:alice@example.com`).

Re-export both runners, `isMongoPool`, `isRedisPool` from
`packages/drivers/src/index.ts`. Unit tests use fake clients (model after
`drivers-mongo/src/pool.test.ts`); fixture suites (skipped when the fixture is
down, like `drivers-pg/src/read-only.test.ts:97-120`) insert their own data
under a unique collection / key prefix, run real pipelines/plans, assert rows,
assert that a `$merge` pipeline and a `SET` command are rejected **before**
reaching the server (the target collection/key does not exist afterwards), and
clean up. Add the `redis` service to `infra/docker-compose.yaml`.

### Step 5: Engines in the agent

Create `packages/agent/src/engines/`:

- `sql.ts` — `sqlEngine(dialect)` wraps today's `sqlSystemPrompt`,
  `repairInstruction`, `formatSchemaForPrompt` and `assertReadOnly`. SQL
  behaviour must be byte-identical (existing `ask.test.ts` stays green).
- `mongo.ts` — system prompt: "You write one read-only MongoDB aggregation that
  answers a question about the "{label}" database. Reply with JSON only, no
  prose, no Markdown: {"description": "<one line describing the result>",
  "collection": "<name>", "pipeline": [ … ]}. Use only these stages: {list}.
  Never use $out, $merge, $function, $accumulator or $where. Write dates as
  {"$date": "2026-01-01T00:00:00Z"} and use "$$NOW" for now. End with a
  $project so every output field is a flat scalar named in snake_case. For a
  time series put the time bucket first and sort by it ascending. Return at most
  500 documents unless the question asks for more. Today is {date}.
  Collections: {schema}". Schema formatter: `orders (≈12,400 docs): _id
objectId, created_at date, total number, items array<object>, items.sku
string`. Guard: `parseMongoReadQuery` → `ReadOnlyVerdict`.
- `redis.ts` — system prompt describing the two plan kinds with one example
  each, the command allowlist, "Use a scan plan to count or size keys; never
  KEYS", bounds, JSON only. Schema formatter: `session:* (hash, ≈3,400 keys):
user_id, created_at, ip` / `leaderboard:* (zset, ≈4 keys)`.
- Change `AskPorts.dialect` → `engine`; `ask.ts` uses
  `ports.engine.{systemPrompt,repairInstruction,formatSchema,guard,language}`;
  `sqlDone` carries `dialect: ports.engine.language`; the "run" phase detail
  stays "Read only on {label}"; the comment-first-line rule stays SQL-only.
- `presentCard` input `sql` is the query text for every engine (the payload key
  may stay `sql`; add `language` so the model knows what it reads).
- Tests with the `ai/test` mock model: a Mongo ask streams JSON, passes the
  guard, executes through a fake port, presents a card; a Mongo answer with
  `$merge` yields `error NOT_READ_ONLY` with the query attached and **no
  execute call**; a Redis scan plan and a commands plan; a repair after an
  execution error re-prompts with the engine's repair instruction; refine (if
  plan 012 landed) keeps working for Mongo.

### Step 6: Bun ask service

In `buildPorts`, choose the engine from the pool instead of refusing:
`pool.dialect` → `sqlEngine(dialect)` + today's execute;
`isMongoPool(pool)` → `mongoEngine` + `execute: (text, signal) =>
runMongoReadQuery(pool, text, database, ASK_MAX_ROWS, signal)`;
`isRedisPool(pool)` → `redisEngine` + `runRedisReadPlan(...)`; anything else →
the existing `UNSUPPORTED_ENGINE` failure with the new copy "Asking questions
doesn't work with this database yet." `resolveSchemaName` works unchanged
(Mongo lists databases; Redis lists `0..n`). History keeps recording every
run: `HistoryEntry.dialect` is already `string | null`
(`packages/core/src/persistence.ts:46-49`), so pass
`ports.engine.language` (generalise `recordHistory`'s `pool.dialect` argument
accordingly). `remember` stores
`dialect: ports.engine.language`. Tests: Mongo and Redis pools pick the right
engine (fake pools via `isMongoPool`/`isRedisPool`), a non-supported pool
still fails `UNSUPPORTED_ENGINE`, recents record the language.

### Step 7: Renderer

- `ask-reducer.ts`: `dialect: QueryLanguage | null`.
- Header title by language: `Generated SQL` / `Generated pipeline` /
  `Generated commands` (derive from `state.dialect`, falling back to the active
  connection type before `sqlDone`).
- `lib/json-highlight.ts` (pure, tested): tokenizes JSON into the existing
  `Token`/`TokenKind` shape (`keyword` for `$operators` and Redis command names,
  `string`, `number`, `punctuation`, `plain`); `SqlBlock` picks the tokenizer by
  language. `offendingKeyword` also matches `$stage` and upper-case command
  tokens so the refusal underline works.
- Saving: `answeredOf`/`useAskSave` treat a non-SQL `dialect` as unsavable:
  `⌘S`/`⌘⇧S` set a `{ kind: "unavailable" }` save phase rendered by
  `SaveStatus` as "Saving works with SQL databases for now." (2.4s), and the
  footer Save hint renders dimmed with `aria-disabled`. Plan 008's "Save as
  widget"/"Add to board" actions (if present) use the same predicate.
- `ask-error.tsx` `UNSUPPORTED_ENGINE` title → "Asking questions doesn't work
  with this database yet."
- Browser stub: a connection of type `mongodb` replays a recorded pipeline
  ("orders by status" → bar), type `redis` replays a scan plan ("keys by
  pattern" → bar) and a commands plan ("leaderboard" → table); a prompt
  containing "merge"/"delete" replays a `NOT_READ_ONLY` refusal for both.
  Check `test/connection-fixture.ts` / the stub's connection list and add one
  Mongo and one Redis fixture connection.
- Snapshots: Mongo streaming block, Redis refusal with underline, save
  unavailable status.

### Step 8: e2e, docs

- `ask-flow.spec.ts`: switch to the Mongo fixture connection, ask "orders by
  status", see "Generated pipeline", a bar card and "Read only"; ask a write →
  refusal with `$merge` underlined; `⌘S` shows the unavailable status and
  `__omqIpcLog` has no `saveWidget`. Same for Redis with "keys by pattern".
- CLAUDE.md: in the AI bullet, replace the SQL-only implication with one line:
  "Mongo/Redis asks use `mongoEngine`/`redisEngine` (allowlist guards in
  `core/client`, `runMongoReadQuery`/`runRedisReadPlan` in drivers); widgets
  stay SQL-only." Update the README "Engines" default line.

## Test plan

- **core**: `mongo-read-query.test.ts`, `redis-read-plan.test.ts` (allow and
  deny tables incl. nested), `flatten.test.ts`, v1 file load through the record
  stores.
- **rpc**: `card-spec.test.ts` (v1 → v2, v3 rejected), `widget.test.ts`
  (v1 widget/recent load, Mongo recent accepted, Mongo widget rejected).
- **drivers-mongo**: `read-query.test.ts` (fake client: `$limit` appended,
  options carry `maxTimeMS`/`signal`, guard runs before any client call, BSON
  normalisation), `pool.test.ts` sampling (bounded, failures tolerated), fixture
  suite.
- **drivers-redis**: `read-plan.test.ts` (fake client: duplicate-with-db used,
  quit in `finally` even on error, each reply shape, scan bounds →
  `isTruncated`), `key-patterns.test.ts`, `pool.test.ts` schema from patterns,
  fixture suite (needs the new compose service).
- **agent**: engine tests + `ask.test.ts` cases (Step 5); existing SQL tests
  unchanged.
- **bun**: `ask-service.test.ts` engine selection and recents.
- **renderer**: `json-highlight.test.ts`; browser tests for header title per
  language, refusal underline for `$merge`/`SET`, save unavailable (both motion
  branches); snapshots listed in Step 7.
- **e2e**: Step 8.

## Done criteria

- [ ] On the fixture Mongo and Redis, desktop dev answers "orders by status"
      (Mongo) and "keys by pattern" / "top 10 on the leaderboard" (Redis) with a
      card, driven with the `cua-driver` skill; screenshots attached.
- [ ] A model reply containing `$merge`/`$out`/`$where`/`$function` (Mongo) or
      `SET`/`DEL`/`EVAL`/`KEYS`/`CONFIG` (Redis) is refused with
      `NOT_READ_ONLY` before any server call (agent test asserts no execute;
      driver fixture test asserts the target collection/key does not exist).
- [ ] `rg -n "\.select\(" packages/drivers-redis/src/read-plan.ts` returns no
      matches (asks never `SELECT` on the shared client).
- [ ] Stored v1 widgets and recent asks load after the bump (record-store
      test with real v1-shaped files), and the app shows them in the root list.
- [ ] `Widget` and `Board` schemas are unchanged
      (`git diff 12b9e8c -- packages/rpc/src/board.ts` empty; `Widget` object
      unchanged in `widget.ts`); widget runs on a Mongo/Redis connection still
      return `UNSUPPORTED_ENGINE`.
- [ ] SQL asks are unchanged: existing agent, bun and renderer ask tests pass
      without edits other than the `CARD_SPEC_VERSION` constant.
- [ ] `bun run check-types`, `bun run check`, package tests (core, rpc, agent,
      drivers-mongo, drivers-redis), `bun run --cwd apps/app test` (both
      projects) and `bun run --cwd apps/app e2e` pass; app coverage ≥ 80%.
- [ ] Every row of "Motion moments in this plan" is implemented with its
      reduced-motion fallback and a browser test per branch; recordings at 1×
      and 0.25× (`?slowmo=4`) of a Mongo ask and a Redis refusal attached; a
      Timelines capture of a Mongo ask shows no frame over 16.7ms; Reduced
      Motion, Reduce Transparency and Increase Contrast verified on the new
      states; JSON highlighting meets WCAG AA on the panel.
- [ ] CLAUDE.md and README updated; README status row updated.

## STOP conditions

- The `CardSpec.version` bump was approved by the owner on 2026-11-19. Stop only
  if another plan has already bumped `CARD_SPEC_VERSION` past 1 with a different
  meaning; reconcile and report — never encode Mongo/Redis as a fake `DialectType`.
- A v1 widget or recent-ask file fails to load after the bump in any test or in
  desktop dev. Stop; data loss is not acceptable.
- `mongodb@6.21.0` ignores `signal` or `maxTimeMS` on `aggregate` in the fixture
  test (a 30s `$function`-free heavy pipeline does not stop). Report; do not
  ship Mongo asks without cancellation.
- The real model fails the guard on ≥ 3 of 10 scripted benign questions per
  engine (it keeps reaching for `$facet`, `KEYS` …). Report examples; do not
  widen the allowlist without the owner (adding `$facet` needs a flattening
  design).
- Managed Redis providers deny `SCAN`/`MEMORY USAGE`/`INFO` to the configured
  user in manual testing. Ship with the denied measure disabled and report;
  never fall back to `KEYS`.
- Plan 018 has landed and moved widgets to `Source`. Re-check Decision 2 with
  the owner before touching anything widget-related.

## Maintenance notes

- The guards are the security boundary. Any new stage/command needs a test
  proving it cannot write, and a reviewer should read `mongo-read-query.ts` and
  `redis-read-plan.ts` line by line — they are short on purpose.
- Neither engine offers a per-session read-only mode the way SQL drivers do
  (`BEGIN READ ONLY` etc.). Recommend in docs that users connect with a
  read-only role (`read` on the database in Mongo, an ACL user limited to
  `+@read` in Redis); a future plan could probe the role and show it in the
  connection status.
- History entries now carry `"mongodb"`/`"redis"` in `dialect`; any history
  filter UI (plan 011) should label them by language, not assume SQL.
- Deferred: Mongo/Redis widget sources (after 018), `$facet` with a nested-card
  design, RedisJSON/TimeSeries commands, Redis Cluster, assumptions for
  pipelines (fields from `$match`/`$group`).
