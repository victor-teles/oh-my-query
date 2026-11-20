# Plan 006: Save answers as widgets with typed inputs, runnable from the launcher

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages apps/app/src` and
> `git status --short`. Plans 002–005 must be merged. Confirm three things:
> `Pool.execute` accepts `options?: ExecuteOptions`,
> `packages/agent/src/read-only-guard.ts` exports `assertReadOnly`, and
> `components/ask/ask-card.tsx` takes `{ spec, result, view }`.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (user input becomes part of SQL execution)
- **Depends on**: `.factory/plans/005-ask-result-card-ui.md`
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-17 (assumes 002–005 landed)

## Why this matters

Asking once is a demo. The daily-driver loop is "MRR by region, last quarter",
run with two keystrokes, every morning, without waiting for the model. This
plan makes any answer savable as a **widget**: a stored SQL template, a
`CardSpec`, and optional **typed inputs** such as a date range, a region or a
threshold. Widgets show up in the launcher root like Raycast commands. Typed
inputs appear inline in the input row. Running a widget never calls the AI.
Widgets are also the building block for boards (plan 007).

## Current state

- Plan 004 put `CardSpec` and `AskEvent` in `packages/rpc`, the read-only guard
  in `packages/agent`, `ExecuteOptions { readOnly?: boolean }` on
  `Pool.execute` in `packages/core/src/traits.ts`, and read-only enforcement in
  the drivers `pg`, `mysql`, `sqlite`, `duckdb`, `mssql` and `clickhouse`.
- Plan 005 put the ask UI in `apps/app/src/mainview/components/ask/`, with
  `ask-card.tsx` as a pure renderer of `{ spec, result, view }`, the pure
  transforms in `lib/card-data.ts`, and the `ask` view in `LauncherView`.
- Persistence conventions live in `packages/core/src/persistence.ts`.
  Everything is under `~/.config/oh-my-query/`. Connections and history are
  encrypted with `encryptLine`/`decryptLine` and written with `atomicWrite`
  under a per-file lock (`fileLocks`).
- `lib/fuzzy-match.ts` is the renderer's fuzzy matcher, which the root list
  already uses.
- No driver accepts bind parameters today. `execute(sql, maxRows, schema, signal, options?)`
  takes only a SQL string.

## Commands you will need

| Purpose           | Command                                  | Expected                                 |
| ----------------- | ---------------------------------------- | ---------------------------------------- |
| All package tests | `bun run test`                           | all pass                                 |
| App tests         | `bun run --cwd apps/app test`            | all pass                                 |
| Driver test (pg)  | `bun run --cwd packages/drivers-pg test` | pass (fixture via `bun run fixtures:up`) |
| Typecheck / lint  | `bun run check-types`, `bun run check`   | exit 0                                   |
| e2e               | `bun run --cwd apps/app e2e`             | all pass                                 |

## Implementation rules relevant to this plan

- **Parameter values never get spliced into SQL text.** They travel as driver
  bind parameters. The only text substitution allowed is placeholder →
  positional marker. A reviewer must be able to verify this by reading
  `compileSqlTemplate` alone.
- Validate values at the bun boundary against the widget's `ParamDef` with
  zod. Examples: a `select` value must be one of its options (or one of the
  option-query results); a `number` must be finite and within optional
  min/max; a date must be ISO `YYYY-MM-DD`.
- The rest of the plan 002 rules apply: strict TS, small components, hooks own
  logic, colocated tests, and no comments except for a non-obvious why.

## Contracts added (protected after this plan)

In `packages/rpc/src/widget.ts`:

```ts
export const ParamDef = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("date"),
    name: Ident,
    label: z.string(),
    default: DatePreset.or(IsoDate),
  }),
  z.object({
    type: z.literal("dateRange"),
    name: Ident,
    label: z.string(),
    default: RangePreset.or(IsoRange),
  }),
  z.object({
    type: z.literal("number"),
    name: Ident,
    label: z.string(),
    default: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    type: z.literal("text"),
    name: Ident,
    label: z.string(),
    default: z.string().max(200),
  }),
  z.object({
    type: z.literal("select"),
    name: Ident,
    label: z.string(),
    default: z.string(),
    options: z.array(z.string()).max(200).optional(),
    optionsSql: z.string().optional(),
  }),
]);
// Ident = /^[a-z][a-z0-9_]{0,31}$/ ; RangePreset = "last7d" | "last30d" | "thisMonth" | "lastMonth" | "thisQuarter" | "lastQuarter" | "ytd" | "last12m"
export const Widget = z.object({
  id: z.string(),
  name: z.string().max(60),
  connectionId: z.string(),
  database: z.string().nullable(),
  prompt: z.string(),
  sqlTemplate: z.string(),
  dialect: DialectType,
  spec: CardSpec,
  view: CardView.shape.kind /* last selected view */,
  params: z.array(ParamDef).max(6),
  lastValues: z.record(z.string(), ParamValue),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastRunAt: z.string().nullable(),
});
export const RecentAsk = z.object({
  id,
  prompt,
  connectionId,
  database,
  sql,
  dialect,
  spec,
  askedAt,
});
```

Template syntax is `{{name}}`. A `dateRange` named `period` exposes
`{{period.from}}` and `{{period.to}}`, with a half-open interval
(`>= from and < to`). Using `{{…}}` rather than `:name` avoids collisions with
Postgres `::type` casts.

## UI and motion (mandatory)

The owner's bar is that **the UI must be excellent and motion is mandatory**.
A surface without designed motion, or without designed empty, loading,
populated and error states, is not done. Plan 002 built the system in
`apps/app/src/mainview/lib/motion.ts` and `components/motion/`. Use it. Do
not hand-roll transitions. The rules, inlined here:

- **Tokens:**
  - `SPRING` (400/30) is for layout morphs and push/pop.
  - `SPRING_SNAPPY` (600/49, ≈ critically damped) is for selection, thumbs and
    toggles.
  - `SPRING_SOFT` (260/32) is for height, panel and card reveals.
  - `SPRING_MOMENTUM` (380/26) is used **only** after a drag release with
    velocity.
  - `FADE_IN` is 160ms ease-out-quint; `FADE_OUT` is 110ms.
  - `PRESS` is `scale 0.97` over 100ms on pointerdown and keydown.
  - `STAGGER` is 30ms, capped at 6 items.
  - Primitives: `<Pressable>`, `<SwapText>` (keyed crossfade, 2px rise and
    4px blur-in, for changing values) and `<Reveal>`.
  - `useMotionPreset()` returns the reduced-motion equivalents (120ms
    crossfades, no transforms).
- **Principles:**
  - Respond on press, not on release.
  - Everything is interruptible. Springs retarget from the current value. No
    input lockout, and no CSS transitions for anything that can be
    re-triggered.
  - Exit the way you entered.
  - Use `layoutId` shared elements for objects that appear in two places.
  - Critically damped by default; overshoot only for thrown objects.
  - Animate only `transform`, `opacity` and `filter`, and use `layout`
    (FLIP) for size changes.
  - Exits run at about 70% of entrance duration.
  - One primary motion per moment.
  - Only progress indicators loop.
- **Accessibility:**
  - Reduced motion: every slide or spring becomes a crossfade or an instant
    change. Feedback stays; travel goes.
  - Reduced transparency: opaque surfaces.
  - Increased contrast: solid borders, muted text promoted.
  - Focus rings are always visible. Live regions announce state changes,
    never animation frames.
- **Avoid flicker:** a loading state that would last under 150ms is never
  shown (delay before showing). Once shown, it stays at least 300ms.
- **Evidence** (Done criteria):
  - Screen recordings of every moment in the table below, at 1× and 0.25×
    (`?slowmo=4`), from desktop dev.
  - A Safari Web Inspector Timelines capture showing no frame over 16.7ms
    during the animations.
  - Reduced Motion, Reduce Transparency and Increase Contrast each verified.
  - Browser tests for both motion branches of every component that animates.

### Motion moments in this plan

| Moment                | Trigger                       | What moves                                                                                                                                                                                                                            | Token                        | Reduced motion                   |
| --------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------- |
| Argument pills appear | `Tab` on a widget row         | Pills slide out from behind the widget name (`x -8→0` plus opacity, 30ms stagger). The input text morphs into a name token via `layout`.                                                                                              | `SPRING`, `STAGGER`          | Instant                          |
| Active pill           | `Tab`/`⇧Tab`                  | The focus pill moves via `layoutId="arg-focus"`.                                                                                                                                                                                      | `SPRING_SNAPPY`              | Instant                          |
| Date range popover    | Focus a `dateRange` pill      | Scales 0.96→1 from the pill (`transform-origin` = pill). Presets list with the selection pill. Exit mirrors entry.                                                                                                                    | `SPRING_SNAPPY` / `FADE_OUT` | Crossfade                        |
| Select type-ahead     | Typing in a `select` pill     | The options list filters with `layout`. Loading options shows a skeleton row only after 150ms.                                                                                                                                        | `SPRING_SNAPPY`              | Instant                          |
| Run with new values   | `↵` or commit in the run view | **Stale-while-revalidate.** Previous data dims to 0.6 and a 2px progress hairline appears at the card's top edge. Recharts then animates _between_ the old and new data (300ms), instead of re-entering. Header numbers `<SwapText>`. | `FADE_IN`, recharts 300ms    | No data transition; instant swap |
| Save (`⌘S`)           | Ask view                      | An inline name field expands under the header via `layout`, pre-filled and selected. On confirm it collapses, and the footer `<SwapText>`s to "Saved · ⌥⏎ to run" with a check draw-in.                                               | `SPRING_SOFT`, `FADE_IN`     | Instant                          |
| Finding inputs        | `⌘⇧S`                         | The status line `<SwapText>`s to "Finding inputs…" with the skeleton delay rules, then pushes the inputs view.                                                                                                                        | `FADE_IN`, `SPRING`          | Crossfade                        |
| Inputs review         | View appears                  | Proposed input rows stagger in. Each row's default value is shown in a highlighted pill that matches the literal it replaced.                                                                                                         | `STAGGER`                    | Instant                          |
| Remove input          | `⌫` on a row                  | The row fades and the list closes the gap via `layout`.                                                                                                                                                                               | `FADE_OUT`, `SPRING`         | Instant                          |
| New widget in root    | Return to root after saving   | The new widget row is inserted via `layout` with a single one-shot amber background pulse (opacity 0.14→0 over 900ms), and it is selected.                                                                                            | `SPRING`, `FADE_OUT`         | No pulse                         |
| Recents               | Root, empty input             | The Recent section `<Reveal>`s. It is not re-animated on every summon, only when its content changed since the last view.                                                                                                             | `FADE_IN`                    | Instant                          |

## Scope

**In scope**

- `packages/rpc/src/{widget,schema,index}.ts`
- `packages/core/src/sql-template.ts` (create) and its test. It contains
  `compileSqlTemplate(template, values, dialect) → { sql, params: unknown[] }`
  and `resolvePreset(preset, now, weekStart)`.
- `packages/core/src/widgets.ts` (create) and its test. It provides encrypted
  CRUD for `widgets.enc` and the last 30 entries of `recent-asks.enc`. Add the
  paths in `paths.ts`.
- `packages/core/src/traits.ts`: `ExecuteOptions.params?: unknown[]`.
- `packages/drivers-{pg,mysql,sqlite,duckdb,mssql,clickhouse}`: bind
  positional params. Mongo and Redis keep throwing `UNSUPPORTED_ENGINE`
  for widgets.
- `packages/agent/src/propose-params.ts` (create) and its test. It runs an LLM
  pass that turns a concrete SQL statement into a template plus `ParamDef[]`.
- `apps/app/src/bun/rpc.ts` and a new `apps/app/src/bun/widget-service.ts`.
- `apps/app/src/mainview/components/widgets/` (create), the root list
  integration in `components/launcher/*`, and `components/ask/*` (Save
  actions only).
- `apps/app/e2e/widget-flow.spec.ts` (create) and the browser stub in
  `lib/ipc.ts`.

**Out of scope**

- Boards (plan 007).
- Hand-editing SQL templates in a code editor. A "Refine…" action that
  re-asks with the current SQL as context is deferred.
- Scheduled or background runs and notifications.
- Regenerating the insight on widget runs. Widget runs show the card without
  the stored insight, because that text describes old data.

## Git workflow

- Branch `feat/launcher-006-widgets`. Commit only if authorized.

## Steps

### Step 1: Template compiler (core)

`compileSqlTemplate` scans the template outside string literals and comments,
reusing the lexing approach in `normalizeSqlForAnalysis`, but it keeps the
original text. It replaces each `{{ident}}` or `{{ident.from|to}}` with the
dialect's positional marker:

| Dialect               | Marker                                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| postgresql            | `$1`                                                                          |
| mysql, sqlite, duckdb | `?`                                                                           |
| tsql                  | `@p1`                                                                         |
| clickhouse            | `{p1:String}`, with the type taken from the ParamDef: Date, Float64 or String |

Placeholders inside literals or comments, unknown names, and unused params are
errors. A value repeated N times is pushed N times for `?` dialects and reused
by index for `$n` and `@pn`. Tests cover each dialect, `::date` casts next to
placeholders, placeholders inside quotes (error), and a range expansion.

`resolvePreset` is pure, with an injected `now`. Test it across month, quarter
and year boundaries, and across a DST change.

### Step 2: Driver binding

Implement `options.params` per driver using each client's native parameter
API. Add a test per driver with a harness: a value with a quote and
`'; drop table x; --` round-trips as data. Combine `readOnly` and `params`.

### Step 3: Persistence and RPC

`widgets.ts` provides `listWidgets`, `getWidget`, `saveWidget` (upsert by id),
`deleteWidget`, `listRecentAsks` and `pushRecentAsk` (deduplicated by
prompt and connection, capped at 30). Both files are encrypted, written
atomically, and locked.

New RPC requests:

- `listWidgets`, `saveWidget`, `deleteWidget` and `listRecentAsks`.
- `proposeWidgetParams({ sql, prompt, dialect })` →
  `{ template, params } | { error }`.
- `runWidget({ widgetId, values, runId })` →
  `{ result: TabularResult, compiledSql: string }`. The `compiledSql` uses
  markers; values are never inlined, and it is used for Copy SQL.
- `cancelWidgetRun({ runId })`.
- `loadParamOptions({ widgetId, paramName })` → `string[]`. It runs
  `optionsSql` read-only, capped at 200 rows, using the first column.

`widget-service.ts` validates values against the `ParamDef`s and fills missing
values from `lastValues` or the defaults. It then runs `assertReadOnly` on the
template with each placeholder replaced by `NULL`, compiles the template, and
executes with `{ readOnly: true, params }` and 30s/2,000 limits. Finally it
updates `lastValues` and `lastRunAt`.

The ask service from plan 004 calls `pushRecentAsk` when an ask completes
with a card.

### Step 4: Proposing inputs (agent)

`proposeParams(sql, prompt, dialect, model)` returns a template plus at most 4
`ParamDef`s, as a structured output. The prompt asks the model to lift only
literals a user would plausibly vary: date bounds (as `dateRange` with the
closest preset), category filters (as `select` with an `optionsSql` that
selects the distinct values), limits and thresholds (as `number`), and free
text (as `text`). It must keep every other literal unchanged.

Validate the result. The template must compile with the defaults, pass the
guard, and use every param exactly as declared. On failure, return
`{ error }`; the UI then offers a plain save without inputs. Tests use the
mock model: valid proposals, a proposal with an unused param (rejected), and a
proposal that changes non-literal SQL. Detect that last case by comparing
`normalizeSqlForAnalysis` output with placeholders and literals masked, and
reject it.

### Step 5: Save from an ask

In the ask view, `⌘S` **Save** opens an inline name field (pre-filled with
the card title) and stores a widget with no params, keeping the current view.
`⌘⇧S` **Save with inputs…** calls `proposeWidgetParams`. It shows "Finding
inputs…" in the status line, then pushes `widget-inputs-view`. That view lists
each proposed input as a row with its label, type and default. The user can
rename an input, change its default (with a type-specific editor) or remove
it, then save with `⌘↵`. A success state shows "Saved · ⌥⏎ to run". There are
no toasts.

### Step 6: Widgets in the launcher

- Root sections, in order: **Recent** (the last 5 asks; empty input only),
  **Widgets** (fuzzy matched on name and prompt, with the connection emoji and
  a param summary), **Connections** and **Settings**. With free text, the
  "Ask {connection}: “…”" row stays first, and widget matches follow.
- **Inline arguments**, using Raycast's pattern. When a widget row with
  params is selected and you press `Tab`, argument pills appear in the input
  row to the right of the widget name. Each pill is labeled and editable:
  - `select` gets a type-ahead dropdown backed by `loadParamOptions`;
  - `dateRange` gets a popover with presets plus a custom from/to pair;
  - `number` and `text` get inline fields.
    `Tab` and `⇧Tab` cycle through the pills, and `↵` runs. `↵` without `Tab`
    runs with the last values.
- **Widget run view.** `ask-card` sits under a compact header showing the
  widget name, connection, `27 rows · 386ms` and the argument pills, which can
  be edited in place and re-run on commit. Actions (`⌘K`): Copy SQL, Copy as
  CSV (via `lib/csv.ts`), Edit inputs, Rename, Duplicate, Delete (two-step
  confirm), and Add to board (disabled until plan 007).
- Errors reuse `ask-error`, mapped from DB errors, validation errors and
  missing connections. A missing connection offers "Choose a connection",
  which rebinds the widget.

## Test plan

- Core: `sql-template.test.ts` (dialects, literals, ranges, errors, presets)
  and `widgets.test.ts` (CRUD, encryption, recent dedupe and cap, a corrupt
  file).
- Drivers: injection-as-data and read-only plus params, where a harness exists.
- Agent: `propose-params.test.ts` (the cases in Step 4).
- Renderer:
  - browser tests for the widget rows, the argument pills (including
    `Tab`/`⇧Tab`, the date presets, the select type-ahead with mocked
    options, and `↵`), the widget inputs view, the save flows, and the widget
    run view;
  - snapshots of the root list with recents and widgets, the argument pills
    active, the inputs review and the run view.
- e2e `widget-flow.spec.ts` (stub): ask, save with inputs, return to root,
  find the widget by typing, `Tab` to set "Europe", `↵`, and see the card.

## Done criteria

- [ ] `rg -n "\\$\\{.*value" packages/core/src/sql-template.ts` and a review of
      the compiler show no value interpolation into SQL.
- [ ] The driver tests prove a malicious `select`/`text` value is treated as
      data.
- [ ] Running a widget makes no AI call. Verify this with the stub's call log
      in a browser test, and in desktop dev with the network offline.
- [ ] `bun run test`, the app tests, check-types, check and e2e pass.
      Coverage is ≥80%.
- [ ] Manual check in desktop dev: save "Revenue by region" with a
      `dateRange` and a `region` select, re-run it with different values, and
      quit and relaunch to confirm the widget persists.
- [ ] Every row of "Motion moments in this plan" is implemented with its token and its
      reduced-motion fallback, with a browser test per branch. Recordings at 1× and 0.25×
      (`?slowmo=4`) are attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of `Tab` into arguments → date-range popover → run with new values (stale-while-revalidate) → save with inputs shows no frame
      over 16.7ms, and only `transform`/`opacity`/`filter` animate.
- [ ] Reduced Motion, Reduce Transparency and Increase Contrast are each verified on this
      plan's surfaces, along with designed empty, loading, populated and error states (snapshots).

## STOP conditions

- A driver's client library cannot bind positional parameters in read-only
  mode (for example, ClickHouse typed params inside the readonly setting).
  Ship that engine without parameterized widgets (plain save only), and report
  it. Never fall back to string interpolation.
- The `proposeParams` structural-equality check rejects most real proposals in
  manual testing. Report examples. Do not weaken the check without the
  owner's approval.

## Maintenance notes

- Plan 007 boards reference widgets by id and pass shared values whose names
  match. Keep `Ident` names stable when editing inputs, because renaming breaks
  board bindings. The edit view should warn when a widget is on a board.
- Deferred: refining a widget by re-asking, scheduled runs, widget export and
  import.
