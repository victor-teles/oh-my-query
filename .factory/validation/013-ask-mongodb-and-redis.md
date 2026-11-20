# Validation: plan 013, ask MongoDB and Redis questions

Date: 2026-11-20. Detached worktree at `05d0542` (plans 001–012 in the base),
uncommitted. Verdict: **partially verified**. Types, lint, every package suite,
the driver fixture suites against real MongoDB 8 and Redis 7, and all 23 e2e
specs pass. The app suite passes except for two timing tests that fail only
under heavy machine load and pass in isolation (details below). The desktop
run, recordings, the Timelines trace, the accessibility toggles and the
real-model STOP check have not been run.

## What was built

- **Contract bump.** `CARD_SPEC_VERSION` is 2. `CardSpec.version` accepts 1 or
  2 and outputs 2, so stored widgets and recents load unchanged and are written
  as v2 on their next save. `AskEvent.sqlDone.dialect` and `RecentAsk.dialect`
  widen to `QueryLanguage` (`DialectType | "mongodb" | "redis"`, with
  `isSqlDialect`, in core). `Widget` and `Board` are unchanged; a `Widget` with
  `dialect: "mongodb"` still rejects.
- **Guards (core/client, pure, zod at the edge).** `parseMongoReadQuery`:
  ≤ 20 KB JSON, `{collection, description?, pipeline[1..30]}`, one operator
  per stage from the 24-stage allowlist, `$geoNear` first only, no `system.*`
  in the collection, `$lookup.from`, `$unionWith` or `$graphLookup.from`,
  nested pipelines checked recursively, and a walk over every key that rejects
  `$out $merge $function $accumulator $where $code $currentOp $listSessions
$listLocalSessions $planCacheStats $changeStream $collStats $indexStats`
  anywhere. `parseRedisReadPlan`: `commands` (1..20, ≤ 10 args of ≤ 512
  chars, the plan's allowlist with reply shapes, either one collection command
  or only single values) or `scan` (`match` ≤ 200, `groupBy`, `measure`,
  `limit` 1..100). Specific refusals for `KEYS`, `SORT`, `EVAL*`, `FCALL*`,
  `SCRIPT`, `FUNCTION`, `CONFIG`, `DEBUG`, `FLUSH*`, `DEL`, `UNLINK`, `SET*`,
  `*STORE`; anything else is "not in the read-only command list".
- **Flattening.** `flattenRecords` (core/client): union of keys in first-seen
  order, `_id` first, one level of dot paths, deeper values as compact JSON,
  30-column cap, `NUMERIC`/`TIMESTAMP`/`BOOLEAN`/`JSON`/`TEXT` inference.
- **Mongo driver.** `runMongoReadQuery` guards first (`DbError
NOT_READ_ONLY`), EJSON-deserializes (`relaxed: false`), appends
  `$limit: maxRows + 1`, passes `maxTimeMS: 30_000`, the abort `signal` and
  `comment: "oh-my-query ask"`, normalises BSON (`toPlainValue`) and flattens.
  An abort maps to `QUERY_CANCELLED`. `fetchSchema` samples up to 100
  collections, 4 at a time, `$sample` 50 with `maxTimeMS: 2000`, field paths
  to depth 2 with the dominant type, 40 fields, never values; a failed sample
  leaves `columns: []`.
- **Redis driver.** `runRedisReadPlan` guards first, then runs on
  `client.duplicate({ db, lazyConnect: true })` + `connect()`, disconnects on
  abort and quits in `finally`. Reply shapes per command; `scan` iterates
  `SCAN … COUNT 500` up to 10,000 keys or 50 iterations, groups by key pattern,
  `TYPE` or nothing, and measures count, `MEMORY USAGE` or `PTTL` over at most
  2,000 keys (pipelined); bounds set `isTruncated`. `fetchSchema` reads up to
  2,000 keys on a duplicated client into ≤ 60 patterns with `TYPE`, hash
  fields (`HKEYS`, ≤ 30) and a scaled `rowEstimate`. `key-patterns.ts`
  generalises ids, UUIDs, hex, emails, dates and token-like segments.
- **Engines (agent).** `AskPorts.dialect` became `AskPorts.engine`:
  `sqlEngine(dialect)` (byte-identical prompts, schema text and guard),
  `mongoEngine`, `redisEngine`, each with its system prompt, repair and refine
  instruction, schema formatter, guard and progress label. `sqlDone.dialect`
  is `engine.language`. The card step gets `language` only for non-SQL, so
  the SQL payload is unchanged. Refine works per engine.
- **Bun ask service.** The engine comes from the pool: `pool.dialect` → SQL,
  `isMongoPool` → Mongo, `isRedisPool` → Redis, anything else →
  `UNSUPPORTED_ENGINE` ("Asking questions doesn't work with this database
  yet."). History and recents record the language. Raw `>` SQL runs stay
  SQL-only.
- **Renderer.** Header title "Generated pipeline" / "Generated commands"
  (from the language, falling back to the connection type before `sqlDone`),
  "Writing the pipeline/commands" status, a JSON highlighter
  (`lib/json-highlight.ts`: `$operator` keys and upper-case command names in
  the amber keyword colour, `$field` references, strings, numbers), the
  refusal underline on `$merge`/`SET`, `describeSql` skipped for non-SQL, and
  "Saving works with SQL databases for now." for ⌘S/⌘⇧S with a dimmed,
  `aria-disabled` Save hint. History disables "Run SQL (no AI)" and "Save as
  Widget…" for non-SQL recents. A capped result reads "2,000+ rows".
- **Browser stub.** A `mongodb` connection replays "orders by status" (bar);
  a `redis` connection replays "keys by pattern" (bar) or "leaderboard"
  (table); "merge/delete/set…" replays the engine's refusal.
- **Fixtures.** `infra/docker-compose.yaml` has a `redis` service
  (`redis:7-alpine`, `127.0.0.1:6379`).

## Adaptations from the plan

- **Engine files are flat.** `packages/agent/src/{query,sql,mongo,redis}-engine.ts`
  instead of `engines/*.ts`: the lint config forbids parent-relative imports.
- **`refineInstruction` is part of `QueryEngine`,** and so is `writingDetail`,
  so a Mongo refine asks for JSON, not SQL, and the progress label is honest.
- **Runners import from `@oh-my-query/drivers/read`.** The package index also
  re-exports them, but importing the index from `ask-service.ts` pulls
  `bun:sqlite`, which the jsdom test project can't load.
- **Guards are not on `@oh-my-query/core`'s main barrel** (only `core/client`):
  adding them pushed `index.ts` over the barrel-size lint threshold.
- **`zod` added to `@oh-my-query/core`** (catalog version; one `bun.lock` line).
- **Extra denied Mongo key `$code`** (EJSON's JavaScript type). Stricter than
  the plan's list.
- **Redis ranges.** Rank-based `ZRANGE`/`ZREVRANGE` get the same "≤ 2,000 and
  no mixed signs" rule as `LRANGE` (`0 -1` is unbounded). `SRANDMEMBER` and
  `HRANDFIELD` counts are capped at 2,000. `SORT_RO` is "not in the list"
  rather than a `SORT` write refusal.
- **Prompts ask for two-space indented JSON** so the streamed block has lines.
- **Recordings live in `lib/browser-engine-recordings.ts`;** `RecordedAsk`
  gained an optional `language`.
- **`.factory/plans/README.md` not edited** (the coordinator owns the index).

## Evidence

| Check                                                            | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check-types`                                            | PASS (14 of 14 tasks)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `bun run check`                                                  | PASS (0 errors, format clean)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `packages/core`                                                  | PASS: 533 tests, including table-driven allow/deny for every stage and command, nested denials (`$merge` in a `$lookup` sub-pipeline, `$where` in `$match`, `$function` in `$group`, `$out` in `$unionWith`), malformed and oversized input, and realistic plans that pass                                                                                                                                                                                                                                                          |
| `packages/rpc`                                                   | PASS: 76. v1 spec → 2, v3 rejects; v1 `Widget` and `RecentAsk` parse; Mongo recent accepted; Mongo widget rejected                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `packages/agent`                                                 | PASS: 234. Mongo ask streams, guards, runs and presents; `$merge` → `NOT_READ_ONLY` with the pipeline and no execute; repair uses the pipeline instruction; refine works for Mongo; Redis scan and commands plans; SET/DEL/EVAL/KEYS/CONFIG refused with no execute; SQL engine byte-identical                                                                                                                                                                                                                                      |
| `packages/drivers-mongo` (fixture up)                            | PASS: 86, incl. the fixture suite: a real pipeline answers, a `$merge` pipeline is refused before the server and the target collection does not exist, and a heavy pipeline is cancelled 300ms after abort with `QUERY_CANCELLED`                                                                                                                                                                                                                                                                                                   |
| `packages/drivers-redis` (fixture up)                            | PASS: 137, incl. the fixture suite: scan by pattern, ZREVRANGE WITHSCORES, memory by type, `SET` refused before the server and the key does not exist, schema from patterns with hash fields                                                                                                                                                                                                                                                                                                                                        |
| `packages/drivers`                                               | PASS: 10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| STOP check: `maxTimeMS` honoured                                 | PASS: `mongosh` ran the same heavy pipeline with `maxTimeMS: 2000`; it stopped with `MaxTimeMSExpired` after 2,042ms                                                                                                                                                                                                                                                                                                                                                                                                                |
| v1 records through the real stores                               | PASS (`apps/app/src/bun/widget-records.test.ts`): encrypted v1 `widgets.enc`/`recent-asks.enc` load through `defaultWidgetStore`/`defaultRecentAskStore`, show `version: 2`, and are rewritten as v2 on update/push; a Mongo recent loads next to SQL ones                                                                                                                                                                                                                                                                          |
| `bun run --cwd apps/app test`                                    | 1345 of 1347 on the last full run. The two failures (`history-view` "clears every ask only after a second press", `widget-run-view` "shows a skeleton only when the first run takes longer than 150ms") are timing tests in files this plan did not touch; they fail only while sibling executors load the machine (load average 15–17) and pass in isolation (41 of 41). Earlier full runs under load also tripped other untouched timing tests (`ipc.test.ts` handshake, `launcher-panel`, `root-view`); each passed in isolation |
| New app tests                                                    | `ask-view-engines.browser.test.tsx` (both motion branches: Mongo streaming block with caret and snapshot, Redis refusal underline and snapshot, save-unavailable status and snapshot, ⌘⇧S and the 2.4s return), `ask-service-engines.test.ts`, `widget-records.test.ts`, `json-highlight.test.ts`, `query-kind.test.ts` (incl. `offendingKeyword`), `ask-answer.test.ts`, `browser-engine-stub.test.ts`, plus additions to `ask-labels`, `history-actions`, `use-ask`                                                               |
| Coverage (`test:coverage`)                                       | 95.63% lines, 94.13% statements, 87.46% branches (gate 80%), on a run with 1346 of 1347 passing (only the history clear race below failed)                                                                                                                                                                                                                                                                                                                                                                                          |
| `bun run --cwd apps/app e2e`                                     | PASS: 23 of 23, including "answers and refuses on mongodb/redis": "Generated pipeline/commands", "Read only on …", bar card, ⌘S shows the unavailable status with no `saveWidget` and no `describeSql` in `__omqIpcLog`, then a write is refused with `$merge`/`SET` underlined. Run under the shared lock with port 3001 free; Playwright started and stopped its own server                                                                                                                                                       |
| `rg -n "\.select\(" packages/drivers-redis/src/read-plan.ts`     | no matches                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `Widget`/`Board` unchanged                                       | `git diff 05d0542 -- packages/rpc/src/board.ts` empty; `widget.ts` only adds `QueryLanguageSchema` and widens `RecentAsk.dialect`                                                                                                                                                                                                                                                                                                                                                                                                   |
| Desktop run with `cua-driver` on the fixture DBs                 | NOT RUN (owner): needs the AI key and the native app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Recordings at 1× and 0.25×, Timelines trace                      | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Reduce Motion / Reduce Transparency / Increase Contrast on a Mac | NOT RUN (owner). Browser tests cover both motion branches                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| WCAG AA of JSON highlighting                                     | Not measured. The highlighter reuses the SQL token classes (`text-chart-1/2/4/5`, `text-foreground`, `text-panel-muted`) already used on the same panel                                                                                                                                                                                                                                                                                                                                                                             |
| STOP check: real model, 10 benign questions per engine           | NOT RUN: needs the owner's AI key                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Managed Redis ACLs (SCAN/MEMORY/INFO denied)                     | NOT RUN: no managed Redis available                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## Motion table status

No new choreography; the deltas reuse existing primitives.

| Moment             | Implementation                                                                                                                                | Tests                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Query header label | `AskHeader` title from `sqlHeading(source, kind)`; segments keep `SwapText` (`MongoDB · 14 lines` → `n rows · ms`).                           | `ask-labels`, `ask-view-engines`                                        |
| Query streaming    | JSON in the existing `SqlBlock`: same fixed streaming box, caret (static under reduced motion), pin-to-bottom and `layout` growth.            | `ask-view-engines` (both branches, snapshot)                            |
| Read-only refusal  | Existing error `Reveal`; `offendingKeyword` reads the leading `$stage`/COMMAND token, which the JSON tokenizer emits as a bare keyword token. | `ask-view-engines` (both branches, snapshot), `query-kind.test.ts`, e2e |
| Save unavailable   | `SavePhase` `unavailable` → `SaveStatus` `SwapText` for 2.4s, then back; Save hint dimmed with `aria-disabled`; no shake.                     | `ask-view-engines` (both branches), e2e                                 |
| Truncated sample   | Header reads `2,000+ rows`; the table summary already reads "Showing 200 of 2,000+".                                                          | `ask-labels`                                                            |
