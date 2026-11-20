# Plan 010: Paste an id or email and see every table that holds it

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages/core packages/rpc packages/agent apps/app/src apps/app/e2e`
> and `git status --short`. Plan 009 must be merged. Confirm: `parseLauncherInput`
> exists in `apps/app/src/mainview/components/launcher/input-mode.ts`;
> `SqlRunSource` in `packages/rpc/src/sql-run.ts` is a discriminated union on
> `kind`; `limitedSelect`, `qualifiedTable` and `quoteIdentifier` are exported
> from `packages/core/src/sql-identifiers.ts`; `ask-service.ts` has
> `startSqlRun`; and the `launcherShown` message in
> `packages/rpc/src/schema.ts` is still `Record<string, never>`. If 009 shipped
> with different names, map them; if it did not ship, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (fans out many queries against a user's database, and reads the system clipboard)
- **Depends on**: `.factory/plans/009-launcher-input-modes.md` (input parser, `runSql`, identifier quoting)
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19. The baseline is the working tree with plans 001–007 implemented but uncommitted, plus plan 009.

## Why this matters

Backend developers debug by chasing one value: a user's UUID from a log line,
an order id from a support ticket, an email from a Slack thread. Today that
means opening a SQL client, guessing which tables hold it, and writing the same
`WHERE x = …` five times. This plan makes it one gesture: paste the value into
the launcher (or summon the launcher while it is on the clipboard) and see
"users (1), orders (12), events (100+)", then ↵ on a table to see the rows. No
AI is involved. Candidate columns are chosen from the schema by name and type,
and every probe is bounded (`LIMIT`, per-probe timeout, table cap, total
budget), read-only, cancellable, and uses a bind parameter for the value.

## Current state

What 009 provides (verify each during the drift check):

- `apps/app/src/mainview/components/launcher/input-mode.ts`:
  `parseLauncherInput(raw)` → `{ mode: "search"; text } | { mode: "sql"; sql } | { mode: "table"; needle } | { mode: "connection"; needle }`.
- `packages/rpc/src/sql-run.ts`: `SqlRunSource` (one member,
  `{ kind: "sql"; sql; title? }`) and `RunSqlParams { askId, connectionId, database, source }`;
  request `runSql` (response `void`, events over `askEvent`).
- `packages/agent/src/run-sql.ts`: `runSql({ sql, title }, ports, signal)` →
  `sqlDone` → guard → `phase: run` → `result` → `card` (`inferCardSpec`) →
  `done`.
- `apps/app/src/bun/ask-service.ts`: `startSqlRun(params)`, sharing
  `cancelAsk` and the one-run-per-connection rule; `openTarget(params)` resolves
  connection, pool, dialect and schema name.
- `packages/core/src/sql-identifiers.ts`: `quoteIdentifier`, `qualifiedTable`,
  `limitedSelect(dialect, from, "*" | "1", limit, where?)`.
- Ask state has `source: "question" | "sql"`; `useAsk().startSql`; the ask view
  derives headings and save behavior from the source.

What already existed before 009 (verified in the working tree):

- `packages/core/src/sql-template.ts`: `compileSqlTemplate(template, values, dialect)`
  turns `{{name}}` into the dialect's marker (`$1` postgresql, `?`
  mysql/sqlite/duckdb, `@p1` tsql, `{p1:String|Float64|Date}` clickhouse,
  lines 250–285) and returns `{ sql, params }`. `maskTemplateInputs(template,
dialect, "NULL")` masks placeholders for guarding. This is the audited path
  for binding values; reuse it, do not write a second marker generator.
- `packages/core/src/types.ts:86-111`: `TableItem { name, columns, indexes,
foreignKeys, rowEstimate: number | null }`, `ColumnDetail { name, dataType,
isNullable, isPrimaryKey, defaultValue }`, `IndexItem { name, columns,
isUnique }`, `ForeignKeyItem { columns, referencedTable, … }`.
- `apps/app/src/bun/schema-cache.ts`: 60s cache over `fetchSchema(database)`.
  For Postgres the "database" is a schema name (`listDatabases` returns
  `information_schema.schemata`, `drivers-pg/src/pool.ts:73-84`), so one lookup
  searches one schema.
- `packages/core/src/cancellation.ts:36`: `raceWithCancel(work, { signal,
timeoutMs })`, used by `widget-service.ts:180-199` for read-only runs with a
  timeout. `CancellationRegistry` for request-scoped cancellation.
- Every driver fetches the full result and then slices to `maxRows`
  (`drivers-pg/src/pool.ts:129-131` and the same in mysql, sqlite, duckdb,
  clickhouse, mssql). Probes must carry `LIMIT` in SQL.
- Electrobun clipboard (bun side, `apps/app/.hutch/types/sdks/main/core/Utils.d.ts`):
  `clipboardReadText(): string | null` (line 155) and
  `clipboardAvailableFormats(): string[]` (line 191). The renderer has no read
  API and must not get one.
- `apps/app/src/bun/launcher.ts:73-79`: `show()` positions the window, shows
  it, then `rpc.send.launcherShown({})`. `show` is called by the hotkey toggle,
  the tray, and `navigate`. `apps/app/src/bun/index.ts` creates the launcher and
  must not import `@oh-my-query/core` (its WASM top-level await deadlocks the
  worker before `electrobun/main`); `launcher.ts` imports only Electrobun and
  local pure modules today. Keep it that way.
- `packages/rpc/src/schema.ts:192`: `launcherShown: Record<string, never>`.
  Renderer: `onLauncherShown(handler: () => void)` (`lib/ipc.ts:237`), used by
  `useLauncherPresence` (`components/launcher/use-launcher-presence.ts`), which
  calls `onShown(hiddenForMs)` in `LauncherStackView` (`launcher-panel.tsx:146-154`).
- `packages/core/src/config.ts:18-23`: `AppConfig { ai?, activeConnection?,
launcherHotkey? }`, read and written by `apps/app/src/bun/launcher-config.ts`.
  Settings rows live in `components/launcher/views/settings/`
  (`hotkey-row.tsx` + `use-launcher-hotkey-setting.ts` are the pattern);
  `components/ui/segmented-control.tsx` and `checkbox.tsx` exist.
- `components/launcher/launcher-panel.tsx` renders only the top view of the
  stack. A view's local state is lost when another view is pushed on top. The
  ask session survives because `useLauncherAsk` owns it above the stack
  (`use-launcher-ask.ts`); the lookup session must follow the same pattern.

## Commands you will need

| Purpose                             | Command                                                                                                    | Expected       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------- |
| App tests (both projects, required) | `bun run --cwd apps/app test`                                                                              | all pass       |
| One browser / unit test             | `bun run --cwd apps/app test:browser <path>` / `test:unit <path>`                                          | pass           |
| Core, RPC, agent tests              | `bun run --cwd packages/core test`, `bun run --cwd packages/rpc test`, `bun run --cwd packages/agent test` | all pass       |
| Types, lint                         | `bun run check-types`, `bun run check`                                                                     | exit 0         |
| e2e                                 | `bun run --cwd apps/app e2e`                                                                               | all pass       |
| Coverage                            | `bun run --cwd apps/app test:coverage`                                                                     | lines ≥ 80%    |
| Fixture Postgres                    | `bun run fixtures:up`                                                                                      | running        |
| Desktop                             | `bun run --cwd apps/app desktop:dev`, driven with the `cua-driver` skill                                   | launcher opens |

## Implementation rules relevant to this plan

- **The value is always a bind parameter.** Build probe SQL as a template whose
  only variable part is `{{value}}`, compile it with `compileSqlTemplate`, and
  run with `{ readOnly: true, params }`. Identifiers come only from the bun-side
  schema cache and are quoted with `quoteIdentifier`. A reviewer must be able to
  confirm this by reading the planner and `compileSqlTemplate` alone.
- **The bun plans the probes.** The renderer sends only the connection and the
  value. For opening rows, the renderer names a table and column it got from a
  hit; bun re-checks that both exist in the cached schema and that the column
  kind fits the value before running anything.
- **Bounded, always:** every probe has `LIMIT`, a per-probe timeout, and a place
  in a capped plan; the whole lookup has a time budget and is cancellable. One
  active lookup per connection; a new one cancels the old.
- **Every probe passes `assertReadOnly`** on the compiled SQL before it runs
  (defense in depth; it is generated SQL, but the rule is "nothing reaches a
  pool without the guard").
- **Clipboard privacy** (owner rule for this plan): read the clipboard only when
  the launcher is summoned, in bun, and only when the setting allows it; skip
  concealed or transient pasteboard items; classify immediately and send the
  renderer **only** a classified id/email, never raw clipboard text; never
  persist it, never log it, never send it anywhere but the renderer; present it
  as an offer row the user chooses, never run a lookup automatically.
- Strict TS (no `any`, no unsafe casts), zod at the RPC edge, no comments by
  default, colocated tests (`*.test.ts` pure, `*.browser.test.tsx` UI), 80%
  line coverage, snapshots for empty/loading/error/populated.
- React 19 rules: components ~150 lines, one per file, ≤ ~6 props, `variant`
  enums instead of booleans, hooks own logic, no derived state in effects,
  keyboard handling in a `useXxxKeyboard` hook. New screens are `LauncherView`
  variants. Do not grow `root-view.tsx` past its length after 009; add root
  behavior through 009's `mode-items.ts` / `use-root-run.ts` seams.
- Brand: warm, craft, trustworthy; quiet copy ("Found in 3 tables"), no hype,
  no sparkle icons. Keyboard and screen reader first; WCAG AA on the panel.

## Decisions made in this plan

1. **Lookup runs on postgresql, mysql, sqlite, duckdb and tsql.** ClickHouse is
   excluded in v1: its typed parameters (`{p1:String}`, `{p1:Float64}`) do not
   compare cleanly with `UUID` and `UInt64` columns, and a wrong comparison
   silently returns no rows. It shows "ID lookup isn't available for ClickHouse
   yet." MongoDB and Redis show the usual SQL-only state.
2. **Exact match only.** Emails compare with `=` as typed (no `lower()`, which
   would defeat indexes). The empty state says so ("Exact match. Emails are
   compared as typed.").
3. **One schema per lookup:** the connection's resolved schema/database (the
   one `resolveSchemaName` picks). Other schemas are not searched in v1.
4. **Integers are only probed on integer columns** whose name says id
   (`id`, `*_id`, `*Id`) or that are a primary key, and only when the value fits
   the column's integer range. UUIDs are probed on uuid-typed columns of any
   name and on text columns whose name says id/uuid/guid. Emails are probed on
   text columns whose name contains `email` or is `mail`/`*_mail`.
5. **The clipboard setting defaults to on**, unless Step 0 finds that reading
   the pasteboard triggers a macOS privacy prompt; then it defaults to off and
   the setting explains the prompt. Owner may override; record the outcome in
   the PR.
6. **Lookups are not written to query history.** A lookup is up to 40 tiny
   generated probes; logging them would bury real history.

## Contracts added (protected after this plan)

`packages/core/src/lookup-value.ts` (pure; export from `client.ts` and `index.ts`):

```ts
export const LOOKUP_KINDS = ["uuid", "email", "integer"] as const;
export type LookupValue =
  | { kind: "uuid"; value: string }     // lowercase, dashed, no braces
  | { kind: "email"; value: string }    // as typed, trimmed
  | { kind: "integer"; value: string }; // decimal string, 1..9223372036854775807
export const classifyLookupValue = (raw: string): LookupValue | null;
```

`packages/core/src/lookup-plan.ts` (pure; export from `index.ts` only):

```ts
export interface LookupLimits {
  maxProbes: number; // 40
  maxTables: number; // 25
  largeTableRows: number; // 1_000_000 — unindexed columns on bigger tables are skipped
  countCap: number; // 100 — probes fetch countCap + 1 rows
}
export interface LookupProbe {
  rank: number;
  schema: string;
  table: string;
  column: string;
  template: string; // SELECT 1 FROM <qualified> WHERE <col> = {{value}} LIMIT 101
  strength: "key" | "indexed" | "scan";
}
export interface LookupPlan {
  probes: LookupProbe[];
  skipped: { largeUnindexed: number; overLimit: number; outOfRange: number };
  tables: number;
}
export const columnKind: (
  dataType: string,
  dialect: DialectType
) => "uuid" | "text" | "integer" | "other";
export const planLookupProbes: (
  schema: SchemaInfo,
  value: LookupValue,
  dialect: DialectType,
  limits?: LookupLimits
) => LookupPlan;
export const lookupTemplateValue: (value: LookupValue) => TemplateValue;
```

`packages/rpc/src/lookup.ts` (new; export from `index.ts`):

```ts
export const LookupValueSchema; // zod discriminated union mirroring LookupValue, re-validated with classifyLookupValue
export const LookupRequest = z.object({
  lookupId: z.string().min(1).max(100),
  connectionId: z.string().min(1).max(200),
  database: z.string().max(500).nullable(),
  value: LookupValueSchema,
});
export interface LookupHit {
  rank: number;
  schema: string;
  table: string;
  column: string;
  matchedRows: number; // capped at 100
  capped: boolean; // true when 101 rows came back
  elapsedMs: number;
}
export type LookupEvent =
  | {
      type: "planned";
      probes: number;
      tables: number;
      skipped: LookupPlan["skipped"];
    }
  | { type: "hit"; hit: LookupHit }
  | { type: "progress"; done: number; total: number }
  | {
      type: "probeFailed";
      table: string;
      column: string;
      reason: "timeout" | "error";
    }
  | { type: "done"; elapsedMs: number; budgetExceeded: boolean }
  | {
      type: "error";
      code:
        | "NO_CANDIDATES"
        | "UNSUPPORTED_ENGINE"
        | "CONNECTION_MISSING"
        | "FAILED"
        | "CANCELLED";
      message: string;
    };
export interface LookupEventMessage {
  lookupId: string;
  event: LookupEvent;
}
```

`SqlRunSource` (009) gains a second member:

```ts
z.object({
  kind: z.literal("match"),
  schema: z.string().min(1).max(500),
  table: z.string().min(1).max(500),
  column: z.string().min(1).max(500),
  value: LookupValueSchema,
});
```

`RpcSchema` changes: requests `lookup: { params: LookupRequest; response: void }`,
`cancelLookup: { params: { lookupId: string }; response: void }`,
`getClipboardLookups` / `setClipboardLookups` (`{ enabled: boolean }`); message
`lookupEvent: LookupEventMessage`; and `launcherShown` becomes
`{ clipboard: LookupValue | null }`.

`AppConfig` gains `clipboardLookups?: boolean` (absent = the Step 0 default).

`AskEvent`, `CardSpec`, `Widget` and `Board` do not change.

## UI and motion (mandatory)

The owner's bar: **the UI must be excellent and motion is mandatory**; a
surface without designed motion and designed empty, loading, populated and
error states is not done. Use `apps/app/src/mainview/lib/motion.ts` and
`components/motion/`:

- **Tokens:** `SPRING` (400/30) layout morphs and push/pop; `SPRING_SNAPPY`
  (600/49) selection and small state changes; `SPRING_SOFT` (260/32) height and
  reveals; `SPRING_MOMENTUM` only after drag release; `FADE_IN` 160ms,
  `FADE_OUT` 110ms; `PRESS` 0.97/100ms; stagger 30ms capped at 6.
  `<Pressable>`, `<SwapText>` (keyed crossfade, 2px rise, blur-in),
  `<Reveal>`; `useMotionPreset()` for reduced-motion equivalents.
- **Principles:** respond on press; interruptible springs, no input lockout;
  exits ~70% of entrances; `layout` (FLIP) for list insertions; only
  `transform`/`opacity`/`filter` animate; one primary motion per moment; only
  progress indicators loop.
- **Accessibility:** reduced motion → crossfades or instant; reduced
  transparency → opaque; increased contrast → solid borders, promoted muted
  text; visible focus rings; a polite live region announces the first hit and
  the final summary ("Found in users, orders and events"), never each
  progress tick.
- **No flicker:** loading states under 150ms are never shown; once shown they
  stay ≥ 300ms.

### Motion moments in this plan

| Moment             | Trigger                                                     | What moves                                                                                                                                         | Token                         | Reduced motion               |
| ------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------- |
| Lookup row appears | Root text classifies as uuid/email/integer                  | The "Find … in {connection}" row enters at its section position via `layout` with opacity 0→1.                                                     | `SPRING`, `FADE_IN`           | Instant                      |
| Clipboard offer    | Summon with an id/email on the clipboard and an empty query | "From clipboard" section `<Reveal>`s above Recent, only when the offered value differs from the last one shown (same rule as `RevealWhenChanged`). | `FADE_IN`                     | Instant                      |
| Open lookup        | ↵ on a lookup row                                           | Standard stack push to the lookup view.                                                                                                            | `SPRING`                      | Crossfade                    |
| Progress           | Probes running                                              | A 2px amber hairline at the top of the results grows with `scaleX = done / total` (`transform-origin: left`).                                      | `SPRING_SOFT`                 | Bar jumps per step, no tween |
| Hit arrives        | `hit` event                                                 | The row inserts at its rank position via `layout`; rows below shift. Its count fades in; never re-enters.                                          | `SPRING`, `FADE_IN`           | Instant insert               |
| Done               | `done` event                                                | Status line `<SwapText>`s from "Searching 14 tables…" to "Found in 3 tables · 412ms"; the hairline fades out.                                      | `FADE_IN`, `FADE_OUT`         | Instant                      |
| Empty              | Done with no hits                                           | The empty state `<Reveal>`s with the searched-tables count and skip notes.                                                                         | `FADE_IN`                     | Instant                      |
| Stop               | Esc while probing                                           | Hairline stops where it is and fades; status `<SwapText>`s to "Stopped · 6 of 14 tables".                                                          | `FADE_OUT`                    | Instant                      |
| Open rows          | ↵ on a hit                                                  | Stack push to the ask view; the existing card intro shows the matching rows as a table card. Esc pops back to the intact results.                  | `SPRING`, existing ask tokens | Crossfade                    |

## Scope

**In scope** (the only files to create or modify):

- `packages/core/src/lookup-value.ts`, `lookup-plan.ts` and their tests
  (create); `packages/core/src/client.ts`, `index.ts`, `config.ts`
  (`clipboardLookups?: boolean`).
- `packages/rpc/src/lookup.ts` and test (create); `sql-run.ts` (+ test, the
  `match` member); `schema.ts`; `index.ts`.
- `apps/app/src/bun/lookup-service.ts` and test (create);
  `apps/app/src/bun/clipboard-offer.ts` and test (create);
  `apps/app/src/bun/ask-service.ts` (+ test, `match` source resolution);
  `apps/app/src/bun/launcher.ts` (accept and call `summonOffer`);
  `apps/app/src/bun/index.ts` (pass `rpcs.summonOffer` into `createLauncher`,
  nothing else); `apps/app/src/bun/launcher-config.ts` (+ clipboard setting);
  `apps/app/src/bun/rpc.ts` (wire requests, the message, and return
  `summonOffer` from `createAppRpcs`).
- `apps/app/src/mainview/lib/ipc.ts`, `browser-ipc-stub.ts`,
  `browser-lookup-stub.ts` (create) and tests.
- `apps/app/src/mainview/components/lookup/` (create): `lookup-reducer.ts`
  (+ test), `use-lookup.ts` (+ browser test), `lookup-view.tsx`,
  `lookup-header.tsx`, `lookup-hit-row.tsx`, `lookup-empty.tsx`,
  `lookup-row.tsx` (the root row), `lookup-labels.ts` (+ test),
  `use-lookup-keyboard.ts`, browser tests and snapshots.
- `apps/app/src/mainview/components/launcher/`: `input-mode.ts` (+ test, add
  `lookup` to the search variant), `views/mode-items.ts` / `root-items.ts`
  (+ tests), `views/use-root-run.ts`, `views/root-list.tsx` (or its
  `RootItemRow`), `use-launcher-stack.ts` (+ test, `lookup` view),
  `use-launcher-lookup.ts` (create), `launcher-panel.tsx`,
  `use-launcher-presence.ts` (pass the shown payload),
  `views/settings-view.tsx`, `views/settings/clipboard-lookup-row.tsx` and
  `use-clipboard-lookup-setting.ts` (create).
- `apps/app/src/mainview/components/ask/`: `ask-reducer.ts`, `use-ask.ts`,
  `ask-view.tsx`, `ask-labels.ts`, `ask-footer-hints.ts` (the `match` source).
- `apps/app/e2e/lookup-flow.spec.ts` (create).
- `.factory/plans/README.md` (status row only).

**Out of scope:**

- Case-insensitive, partial or full-text matching; prefixed ids (`cus_…`,
  ULIDs, Snowflake ids as text); binary(16) UUIDs in MySQL. Each needs its own
  index-cost thinking.
- ClickHouse, MongoDB and Redis lookups (Decision 1).
- Searching more than the resolved schema; following foreign keys to related
  rows. Deferred.
- Any renderer clipboard read (`navigator.clipboard.readText`): the renderer
  never reads the clipboard.
- Driver changes. Saving lookups as widgets (a `match` answer cannot be saved;
  see Step 6).

## Git workflow

- Branch `feat/launcher-010-lookup` from the branch that carries 009. Commit only
  if authorized. Do not push or open a PR unless instructed.

## Steps

### Step 0: Clipboard spike (half a day, before UI work)

On the development Mac (Darwin 27 at planning time), in `desktop:dev`, call
`Utils.clipboardReadText()` and `Utils.clipboardAvailableFormats()` inside
`show()` from a hotkey summon while another app is frontmost, then from a tray
click. Record:

1. Whether macOS shows a paste-permission prompt or a "pasted from" banner.
2. The exact format strings returned for: plain text copied from a browser, a
   password copied from a password manager (1Password or Apple Passwords), and
   an empty clipboard. You are looking for the pasteboard markers
   `org.nspasteboard.ConcealedType`, `org.nspasteboard.TransientType` and
   `org.nspasteboard.AutoGeneratedType`.
3. The time each call takes.

Decision rule: no prompt → the setting defaults to on. A prompt → default off,
and the settings row explains that macOS will ask once. If concealed markers
are not visible through `clipboardAvailableFormats`, STOP the clipboard part
(Steps 4–5 clipboard items) and report; ship typed/pasted lookup only. Write
the findings in the PR description.

### Step 1: Classify values (core, pure)

`classifyLookupValue(raw)`:

- Reject input longer than 320 characters or containing a line break.
- Trim. Strip one wrapping pair of `"`, `'`, `` ` ``, `<…>`, or `{…}` (UUID
  braces), and a `mailto:` prefix.
- UUID: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` →
  lowercase. Also accept 32 hex characters without dashes and canonicalize.
- Email: no whitespace, exactly one `@`, a non-empty local part ≤ 64, a domain
  with a dot and a 2+ letter TLD, total ≤ 254. Keep the case as typed.
- Integer: `/^[1-9][0-9]{0,18}$/` and `BigInt(value) <= 9223372036854775807n`.
- Anything else → `null`.

Tests: canonical and uppercase UUIDs, braces, no-dash form, invalid hex;
plain, plus-addressed and quoted emails, `mailto:`, missing TLD, two `@`;
`1`, `42`, the int64 maximum, max + 1, leading zero, negative, decimal, `1e5`;
whitespace and newline rejection; 321-character input.

### Step 2: Plan probes (core, pure)

`columnKind(dataType, dialect)` lowercases `dataType`, strips a `(…)` size
suffix and wrappers such as ClickHouse `LowCardinality(…)`/`Nullable(…)`, then:

| Kind    | Types                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| uuid    | `uuid` (postgresql, duckdb), `uniqueidentifier` (tsql)                                                                                                                          |
| text    | `char`, `character`, `varchar`, `character varying`, `text`, `citext`, `nchar`, `nvarchar`, `string`; for sqlite, any type containing `CHAR`, `CLOB` or `TEXT` (affinity rules) |
| integer | `smallint`, `int2`, `integer`, `int`, `int4`, `bigint`, `int8`, `mediumint`, `serial`, `bigserial`, `hugeint`, `ubigint`, `uinteger`; for sqlite, any type containing `INT`     |
| other   | everything else (including `tinyint`, `bit`, `boolean`, `numeric`, `binary`)                                                                                                    |

Integer ranges for `outOfRange`: `smallint`/`int2` ≤ 32,767; `integer`,
`int`, `int4`, `mediumint` (≤ 8,388,607 for mediumint), `serial` ≤
2,147,483,647; everything else 64-bit.

`planLookupProbes(schema, value, dialect, limits)` walks every table (not
views) in `schema.schemas`, selects candidate columns per Decision 4, and gives
each a strength:

- `key`: the column is a primary key, or the leading column of a unique index;
- `indexed`: the leading column of any index, or a foreign-key column;
- `scan`: anything else. A `scan` column on a table whose `rowEstimate` is
  above `largeTableRows` is skipped (`largeUnindexed`). An unknown (`null`)
  estimate is allowed but ranked after known ones.

Sort by strength (key, indexed, scan), then by name fit (exact `id`/`email`
before suffix matches), then by `rowEstimate` ascending, then by table and
column name for a stable order. Keep at most `maxTables` distinct tables and
`maxProbes` probes; the rest count as `overLimit`. `rank` is the final index.
Each probe's template is
`limitedSelect(dialect, qualifiedTable(dialect, schemaName, table), "1", countCap + 1, `${quoteIdentifier(dialect, column)} = {{value}}`)`.

`lookupTemplateValue`: uuid and email → `{ kind: "text", value }`; integer →
`{ kind: "number", value: Number(value) }` when `≤ Number.MAX_SAFE_INTEGER`,
else `{ kind: "text", value }` (the database casts it to the column type).

Tests (`lookup-plan.test.ts`, with a fixture `SchemaInfo` of ~10 tables): each
value kind picks the expected columns; a uuid-typed `external_ref` is chosen,
a text `notes` column is not; integer `99999` skips an `int2` column
(`outOfRange`); key before indexed before scan; a 5M-row unindexed column is
skipped; caps produce `overLimit`; views are ignored; ordering is stable across
runs; every template compiles with `compileSqlTemplate` for postgresql, mysql,
sqlite, duckdb and tsql, binds exactly one parameter, and contains no raw value
(assert the value string does not occur in the compiled SQL); hostile table and
column names are quoted.

### Step 3: Lookup service (bun)

`apps/app/src/bun/lookup-service.ts`, shaped like `ask-service.ts`:

- `startLookup(input)`: parse with `LookupRequest`; re-run
  `classifyLookupValue(value.value)` and reject a mismatch; cancel the previous
  lookup on the same connection; register the `lookupId`.
- Resolve the target: `findConnection` (missing → `CONNECTION_MISSING`),
  `ensurePool`, dialect must be one of postgresql, mysql, sqlite, duckdb, tsql
  (else `UNSUPPORTED_ENGINE` with the Decision 1 copy for ClickHouse and "ID
  lookup works with SQL databases." otherwise), `resolveSchemaName`,
  `schemas.get`.
- `planLookupProbes`. No probes → `error` `NO_CANDIDATES` ("No columns in
  {schema} look like they hold {an email | a UUID | an id}."). Otherwise emit
  `planned`.
- Run probes with **concurrency 3**, each through `raceWithCancel` with a
  **3s** timeout, under one lookup signal that also aborts at a **15s** total
  budget. For each probe: `compileSqlTemplate(template, { value: lookupTemplateValue(value) }, dialect)`,
  `assertReadOnly(compiled.sql, dialect)` (a failure here is a bug: emit
  `FAILED` and stop), then `pool.execute(compiled.sql, countCap + 1, schemaName, signal, { readOnly: true, params: compiled.params })`.
  `rowCount > 0` → `hit` with `matchedRows = min(rowCount, countCap)` and
  `capped = rowCount > countCap`. Timeout → `probeFailed` `timeout`; any other
  error → `probeFailed` `error` (log the message server-side only, with the
  value redacted). Emit `progress` after each settled probe.
- After all probes settle or the budget fires: `done` with `budgetExceeded`.
  Cancellation → `error` `CANCELLED`. Always remove the registry entry.
- Never append to history (Decision 6). Never log the value.

Extend `ask-service.ts` `startSqlRun` for the `match` source: look up the
table and column in `schemas.get` for the resolved schema (missing →
`QUERY_FAILED` "This table changed since the search. Search again."), check
`columnKind` fits the value kind, build
`limitedSelect(dialect, qualifiedTable(...), "*", 50, `${quoteIdentifier(column)} = {{value}}`)`,
compile, guard, and run `runSql` with the compiled SQL (markers, never the
value) and `params`. `runSql`'s input gains an optional `params: BindValue[]`
passed to the execute port. Title: `{table} · {column}`.

Wire in `rpc.ts`: `lookup`, `cancelLookup`, and a `send` that calls
`launcherRpc?.send.lookupEvent(message)`.

Tests (`lookup-service.test.ts`, fake pools in the style of
`widget-service.test.ts`): events in order for two hits and one miss; every
`execute` call has `readOnly: true`, one bound param, and SQL without the raw
value; concurrency never exceeds 3 (instrument the fake); a probe that hangs is
reported as `timeout` and the others still finish; the budget ends a slow
lookup with `budgetExceeded`; a second lookup on the same connection cancels
the first; `cancelLookup` yields `CANCELLED` and stops scheduling; ClickHouse
and Mongo connections are refused; a value whose kind does not match its
string is refused. `ask-service.test.ts`: the `match` source rejects an
unknown table or column and runs with a bound param.

### Step 4: Clipboard offer (bun)

`apps/app/src/bun/clipboard-offer.ts`:

```ts
export const createClipboardOffer = (deps: {
  enabled(): boolean;
  formats(): string[];
  readText(): string | null;
}) => (): LookupValue | null
```

It returns `null` without reading when disabled, or when `formats()` contains a
concealed, transient or auto-generated marker (exact strings from Step 0).
Otherwise it reads text, keeps at most the first 320 characters, and returns
`classifyLookupValue(text)`. The raw text never leaves the function.
`enabled()` reads a cached boolean that `setClipboardLookups` updates, so
summoning never waits on disk.

`createAppRpcs` builds it with `Utils.clipboardReadText` and
`Utils.clipboardAvailableFormats` and returns it as `summonOffer`. `index.ts`
passes `rpcs.summonOffer` to `createLauncher`; `launcher.ts` takes it as an
option and sends `rpc.send.launcherShown({ clipboard: summonOffer() })` inside
`show()`. Wrap the call so an exception yields `clipboard: null` and never
blocks showing the window. This is the only call site of `clipboardReadText`
in the app. `launcher.ts` and `index.ts` may reference `LookupValue` only
through `import type` (erased at runtime); they must not import a runtime value
from `@oh-my-query/core`.

Settings: `launcher-config.ts` gains `readClipboardLookups()` (default from
Step 0) and `writeClipboardLookups(enabled)`; requests `getClipboardLookups`
and `setClipboardLookups`. In the Launcher group of `settings-view.tsx` add
`clipboard-lookup-row.tsx` ("Suggest lookups from the clipboard", with the
note "Read only when you open the launcher. Only ids and emails are offered.
Nothing is stored."), using `use-clipboard-lookup-setting.ts` modeled on
`use-launcher-hotkey-setting.ts`, with loading and error states.

Tests: `clipboard-offer.test.ts`: disabled → `readText` never called;
concealed marker → never called; long text truncated before classification;
UUID text → the classified value; prose → `null`; `readText` throwing → the
launcher still shows (test the wrapper in `launcher.ts` through a small pure
helper if `launcher.ts` itself is hard to test).

### Step 5: Root integration (renderer)

- `input-mode.ts`: the search variant becomes
  `{ mode: "search"; text: string; lookup: LookupValue | null }`, computed with
  `classifyLookupValue(text)`. Tests updated.
- `mode-items.ts` / `root-items.ts`: in search mode with a lookup value and an
  active SQL connection, add a `{ kind: "lookup"; id: "lookup"; value; connection; origin: "typed" }`
  item. UUID and email: its own "Look up" section first, above the Ask row.
  Integer: after the Ask row (a bare number is more often a search). With an
  empty query and a clipboard offer: a "From clipboard" section above Recent
  with `origin: "clipboard"`. The offer shows only while the query is empty
  (derived, not stored).
- `lookup-row.tsx`: like `ask-row.tsx`; a search glyph tile, "Find
  {shortValue} in {connection}" (`shortValue` truncates a UUID in the middle,
  `3f2a1b…c91e`), and a muted kind tag ("UUID", "Email", "ID"). The clipboard
  variant reads "Find {shortValue} from your clipboard". `variant: "typed" | "clipboard"`.
- `launcher-panel.tsx`: hold `clipboardOffer` state set from the
  `launcherShown` payload (extend `useLauncherPresence`'s `onShown` with the
  payload) and cleared when presence becomes hidden. Pass it to `RootView`.
- `use-root-run.ts`: `lookup` → `push({ kind: "lookup", value, connectionId })`
  after starting the lookup through `useLauncherLookup`.
- `footerFor`: lookup row → action "Find".

### Step 6: Lookup view and opening rows (renderer)

- `use-launcher-stack.ts`: add `{ kind: "lookup"; value: LookupValue; connectionId: string }`.
- `use-launcher-lookup.ts`, owned by `LauncherStackView` like
  `useLauncherAsk`, holds the `useLookup()` session so results survive pushing
  the ask view.
- `lookup-reducer.ts` (pure): status `planning | probing | done | error | cancelled`;
  `total`, `done`, `hits` kept sorted by `rank`, `failed`, `skipped`,
  `elapsedMs`, `budgetExceeded`, `error`. Events for a stale `lookupId` are
  ignored.
- `use-lookup.ts`: `start(value, connectionId)`, `cancel()`; subscribes to
  `lookupEvent` by id (new `onLookupEvent` in `ipc.ts`), cancels on unmount of
  the session owner.
- `lookup-view.tsx`: an input row showing the value as a read-only token next to
  the connection chip (Esc pops to root); `lookup-header.tsx` (status line,
  progress hairline, polite live region); a listbox of `lookup-hit-row.tsx`
  rows (table name, `column` in mono, schema muted, count "12" or "100+");
  `lookup-empty.tsx`. `use-lookup-keyboard.ts`: ↑/↓ move, ↵ open rows, Esc
  stops a running lookup first, then pops; `⌘C` copies the value.
- States, all designed: planning (status only, no list), probing with zero hits
  (status + hairline), probing with hits, done with hits ("Found in 3 tables ·
  412ms"; when some probes failed or timed out add "2 tables didn't answer in
  time"), done empty ("No rows match 3f2a…c91e in 14 tables." plus "Exact
  match. Emails are compared as typed." and, when relevant, "Skipped 3 large
  tables without an index on the column."), error (copy per code), and stopped.
- Opening rows: `useAsk` gets `startMatch(hit, value, target)` calling
  `runSql` with the `match` source, and the ask state's `source` gains
  `"match"`. For `match`: heading "Matching rows", the draft starts empty with
  the normal ask placeholder (typing asks a new question), and **⌘S/⌘⇧S are
  disabled with their footer hints hidden**: the compiled SQL contains a native
  bind marker, which `saveWidget` rejects (`sql-template.ts:287-306`). If plan
  008's result actions exist, hide "Save as widget" for this source the same
  way.
- `browser-lookup-stub.ts`: a fixed demo: UUID
  `3f2a1b4c-9d8e-4f7a-b6c5-d4e3f2a1c91e` → `users.id (1)`, `orders.user_id (12)`,
  `events.actor_id (100+)` streamed 80–250ms apart; `ada@example.com` →
  `users.email (1)`, `invoices.billing_email (3)`; `42` → `orders.id (1)`;
  anything else → no hits. `__omqSetClipboard(text)` (test-only global) sets
  the text the stubbed `launcherShown` classifies on the next summon.

### Step 7: e2e and desktop

`e2e/lookup-flow.spec.ts` (model after `e2e/widget-flow.spec.ts`):

1. Paste the demo UUID → the "Find …" row is first; ↵ → hits appear in rank
   order; status ends "Found in 3 tables".
2. ↵ on `orders` → a table card; Esc → the lookup results are still there.
3. Esc during a slow lookup → "Stopped".
4. `__omqSetClipboard("ada@example.com")`, play the hotkey → "From clipboard"
   row; nothing ran until ↵ (assert `__omqIpcLog` has no `lookup` call before
   ↵).
5. `__omqSetClipboard("hello world")` → no offer.

Desktop (`desktop:dev`, fixture Postgres, `cua-driver`): copy a real id from a
fixture table, summon, choose the offer, open the rows. Copy a password from a
password manager, summon: no offer. Turn the setting off: no offer. Run a
lookup against a large table and confirm the probes stop at the budget.

## Test plan

- Core: `lookup-value.test.ts` (Step 1), `lookup-plan.test.ts` (Step 2).
- RPC: `lookup.test.ts` (schema accepts each kind, rejects bad ids, oversize
  strings, unknown kinds); `sql-run.test.ts` (`match` member).
- Bun: `lookup-service.test.ts`, `clipboard-offer.test.ts`, `ask-service.test.ts`
  additions (Steps 3–4).
- Renderer unit: `input-mode.test.ts`, `mode-items.test.ts` (row placement per
  kind, clipboard section only on empty query), `lookup-reducer.test.ts`
  (ordering by rank, stale ids, done/empty/stopped), `lookup-labels.test.ts`
  (short values, counts, status copy), `use-launcher-stack.test.ts`.
- Renderer browser (pattern: `launcher-ask-flow.browser.test.tsx`; deliver
  `lookupEvent` and `launcherShown` with `emitIpcMessage()`): root rows for each
  kind; clipboard offer shown, hidden after typing, cleared on hide; lookup view
  in every state above; ↵ opens rows and Esc returns to intact results; Esc stops
  then pops; ⌘S does nothing on a `match` answer; the settings row toggles and
  shows its error state; both motion branches for hit insertion, progress and
  the done swap. Snapshots: planning, probing with hits, done with hits, done
  empty with skip notes, error, stopped, clipboard offer row.
- e2e: `lookup-flow.spec.ts` (Step 7).

## Done criteria

- [ ] All commands in "Commands you will need" pass; app line coverage ≥ 80%.
- [ ] `rg -n "clipboardReadText" apps/app/src` matches only
      `apps/app/src/bun/clipboard-offer.ts` (and `rpc.ts` where it is passed in);
      `rg -n "navigator.clipboard.read" apps/app/src` matches nothing.
- [ ] Tests prove: the offer never reads when disabled or concealed; only a
      classified value is sent; no lookup runs before the user presses ↵.
- [ ] Tests prove every probe and every `match` run passes `readOnly: true`,
      binds the value as a parameter, carries `LIMIT`/`TOP`, and passed
      `assertReadOnly`; the raw value never appears in executed SQL.
- [ ] Concurrency ≤ 3, per-probe timeout, total budget, caps and cancellation
      are each covered by a test.
- [ ] `git diff --stat` shows no change to `card-spec.ts`, `ask.ts`
      (`AskEvent`), `widget.ts` or `board.ts`.
- [ ] Step 0 findings and the chosen setting default are in the PR description.
- [ ] Desktop checks from Step 7 pass.
- [ ] Every row of "Motion moments in this plan" is implemented with its token
      and reduced-motion fallback, with a browser test per branch. Recordings
      at 1× and 0.25× (`?slowmo=4`) attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of paste → lookup with 3 hits
      streaming → open rows → back shows no frame over 16.7ms and only
      `transform`/`opacity`/`filter` animating.
- [ ] Reduced Motion, Reduce Transparency and Increase Contrast verified on the
      lookup row, clipboard offer and lookup view, with designed empty, loading,
      populated and error states (snapshots).
- [ ] `.factory/plans/README.md` row for 010 updated.

## STOP conditions

- Step 0 shows the concealed/transient pasteboard markers are not visible
  through Electrobun, or a clipboard read blocks `show()` noticeably (over
  ~20ms). Ship typed/pasted lookup only and report; do not read the clipboard
  without a way to skip passwords.
- A driver cannot bind the probe parameter against its column type (for
  example MSSQL `uniqueidentifier` with a text parameter fails, or MySQL
  compares an integer id as a string and loses its index). Exclude that kind
  for that engine and report. Never inline the value.
- A probe that hits its timeout keeps running server-side and piles up across
  lookups on a real driver (check `pg_stat_activity` on the fixture during
  Step 7). Report with evidence before shipping; lower concurrency is an
  acceptable interim, removing the timeout is not.
- 009's `runSql` cannot take bound parameters without changing `AskEvent`.
  Stop: `AskEvent` is protected.
- Motion cannot meet the 60fps bar with streaming insertions. Stop and report;
  never cut motion.

## Maintenance notes

- Plan 016 (MCP server) may expose lookup as a read-only tool; it should call
  `planLookupProbes` and the lookup service, not reimplement them. Plan 017
  (`omq://`) can route `omq://lookup?v=…` through `classifyLookupValue`.
- Reviewers: read `planLookupProbes` and `lookup-service.ts` for the binding and
  bounds rules, and `clipboard-offer.ts` for the privacy rules; check nothing
  logs the value.
- Tunables live in one place (`LookupLimits` defaults and the service's
  concurrency/timeout/budget constants). Change them with tests, not ad hoc.
- Deferred: case-insensitive email matching where a functional index exists,
  prefixed and ULID ids, ClickHouse support with typed parameters per column,
  searching every schema, following foreign keys from a hit, and saving a
  lookup as a widget with a `text` input (the `match` template already has the
  `{{value}}` shape such a widget would need).
