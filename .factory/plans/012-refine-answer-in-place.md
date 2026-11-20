# Plan 012: Refine an answer in place, with an assumptions line and drill-down

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md` unless the coordinator owns that index.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages/agent packages/core/src packages/rpc/src apps/app/src/bun apps/app/src/mainview/components/ask apps/app/src/mainview/components/launcher apps/app/src/mainview/components/widgets apps/app/src/mainview/lib apps/app/e2e`
> and `git status --short`. Plans 001–007 are implemented but uncommitted in the
> working tree; that working tree is the baseline. Confirm three things before
> starting: `runAsk(prompt, ports, signal)` in `packages/agent/src/ask.ts` still
> builds `messages` from the prompt alone; `AskEvent` in
> `packages/rpc/src/ask.ts` has no `refine`/`assumptions` member; and
> `apps/app/src/mainview/components/ask/ask-view.tsx` still re-asks from scratch
> on `↵` (`askAgain`). If plan 008 (⌘K result actions) landed first, its menu
> must act on the **shown turn** after this plan (see Step 7).

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (touches the signature ask flow and the model context; read-only guarantees unchanged)
- **Depends on**: none. Soft: `.factory/plans/008-*.md` (result actions read the same "shown answer").
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19, on `feat/launcher-002-shell` with plans 001–007 uncommitted in the working tree (treated as baseline)

## Why this matters

Today every question is a one-shot. Typing "by month" after "MRR by region"
throws the answer away and asks a brand-new question that knows nothing of the
first, so users must restate everything. This plan turns the ask view into a
quiet dialogue without a chat drawer: typing a follow-up re-asks **with the
previous prompt, SQL and card as context**, and the card **morphs in place**
(the launcher's signature moment). Under the SQL header an **assumptions line**
states what the answer actually used — tables, the time column, filters, the
row cap — derived deterministically from the SQL, each one clickable to refine.
Clicking a bar, slice or row **drills down**: it pre-fills a refine with that
segment as a filter. Trust goes up (you can see what was assumed and change it)
and the cost of a second question drops to a few keystrokes.

## Current state

- `packages/agent/src/ask.ts` — the pure ask pipeline (`runAsk`). Ports at
  `ask.ts:22-30` (`model`, `loadSchema`, `execute`, `dialect`,
  `connectionLabel`, `redact`, `now`). The model conversation starts from the
  prompt alone (`ask.ts:233`):
  ```ts
  const messages: ModelMessage[] = [{ content: prompt, role: "user" }];
  ```
  Repairs append `assistant` SQL + `user` repair instruction (`ask.ts:256-264`).
  Schema relevance uses only the prompt: `selectRelevantSchema(await ports.loadSchema(), prompt)` (`ask.ts:208-211`).
  `presentCard` receives `{ model, prompt, redact, result, signal, sql }` (`ask.ts:292-299`).
  `runAsk(prompt, ports, signal)` is exported at `ask.ts:326`; its only caller
  is `apps/app/src/bun/ask-service.ts:192`.
- `packages/agent/src/prompts.ts` — `sqlSystemPrompt` (`:14-36`),
  `repairInstruction` (`:38-42`), `PRESENT_SYSTEM_PROMPT` (`:44-53`).
- `packages/agent/src/present.ts` — `PresentInput` (`:106-113`) and
  `describeResult` (`:120-136`) build the JSON payload (question, sql, columns,
  stats, sample rows; PII-redacted when enabled).
- `packages/rpc/src/ask.ts` — **protected** `AskEvent` union (`:19-40`) and the
  **unprotected** `AskParams { askId, connectionId, database, prompt }` (`:44-49`).
  `packages/rpc/src/card-spec.ts` — **protected** `CardSpec`, `CARD_SPEC_VERSION = 1`.
- `apps/app/src/bun/ask-service.ts` — validates `AskParams` with zod
  (`:34-39`), builds ports, runs `runAsk`, forwards events, and on `card`
  records a `RecentAsk` with `id: params.askId, prompt: params.prompt`
  (`:191-207`). One active ask per connection (`:235-244`).
- `packages/core/src/widgets.ts:28-51` — `pushRecentAsk` dedupes only by
  `(connectionId, prompt)` (case-insensitive), capped at 30.
- `packages/core/src/transpile.ts` — the only `@polyglot-sql/sdk` user. It is
  exported from core's **main** entry (`packages/core/src/index.ts:15`), never
  from `@oh-my-query/core/client` (whose header, `client.ts:1-3`, says it
  excludes "the polyglot WASM runtime"). The WASM is copied next to the bundled
  bun code by `apps/app/scripts/native-bun-assets.ts` (`polyglotSqlModule`).
  So **polyglot runs bun-side only**. Precedent: the `formatSql` RPC request is
  handled in `apps/app/src/bun/rpc.ts:237` with core's `formatSql`.
- polyglot API verified against the installed `@polyglot-sql/sdk@0.3.3`
  (`node_modules/.bun/@polyglot-sql+sdk@0.3.3/.../dist/index.d.ts`) with a bun
  probe during planning:
  - `parse(sql, Dialect.PostgreSQL)` → `{ success, ast?: any, error? }`; `ast`
    is an **array** of statements; a SELECT is `{ select: { expressions,
from, joins, where_clause: { this }, group_by, having, order_by, limit:
{ this: { literal: { literal_type, value } } }, top, with: { ctes } } }`.
  - Nodes are single-key objects keyed by type: `{ column: { name: { name },
table: { name } } }`, `{ function: { name, args } }`, binary ops keyed by op
    (`{ and: { left, right } }`, `{ gte: … }`), `{ alias: { this, alias } }`.
  - `ast.getTableNames(stmt)` returned `["regions","orders"]` for a query with a
    CTE `paid` — CTE names are **not** included.
  - `generate([node], Dialect.PostgreSQL)` renders a sub-expression:
    `{ success: true, sql: ["p.status <> 'refunded'"] }` (pass an **array**;
    a bare node fails with "expected a sequence").
  - Date bucketing parses as `function` nodes: `date_trunc` (pg, duckdb),
    `DATE_FORMAT` (mysql), `strftime` (sqlite), `DATE_PART` with a `var` unit
    arg (tsql `DATEPART`), `toStartOfMonth` (clickhouse).
- Renderer ask state: `components/ask/ask-reducer.ts` — `AskState`
  (`:29-44`) holds one live ask; `start` resets to `initialAskState`
  (`:158-160`); `result` sets `answer: { result, spec: null }` (`:113-120`) and
  `card` fills the spec (`:121-130`). Events apply only while working (`:176`).
- `components/ask/use-ask.ts` — owns the reducer, subscribes per `askId`
  (`:60-88`). `components/launcher/use-launcher-ask.ts` owns the session above
  the view stack so `↑` on an empty root reopens the last answer (`:11-33`).
- `components/ask/ask-view.tsx` — the input holds the prompt; `↵` calls
  `askAgain(draft)` which starts a **fresh** ask (`:122-130`, `:156-166`); the
  footer reads "Ask again" when the draft equals the prompt (`:232`). The card
  intro is "skip" for a restored answer, else "play" (`:82-87`).
- `components/ask/ask-card.tsx` — pure renderer of `{ spec, result, view }`
  (+ `onSelectView`, `intro`, `actions`); `intro: "update"` makes Recharts
  animate **between** data (`card-chart.tsx:26-39`, `DATA_UPDATE_MS = 300`).
  Boards and widget runs reuse it; keep its props unchanged.
- `components/widgets/widget-run-body.tsx` — the stale-while-revalidate
  pattern (`STALE_OPACITY = 0.6`, private `ProgressHairline` at `:18-41`,
  `intro={run.completedRuns > 1 ? "update" : "play"}` at `:93`). This plan is
  its second caller, so extract `ProgressHairline` (see Step 6).
- `lib/card-data.ts` — `seriesOf` pivots `groupBy` values into series labelled
  by the group value; groups beyond 6 fold into `OTHER_LABEL = "Other"` (`:41`);
  chart rows carry the x value under `X_KEY` via `xValue` (`:322-327`);
  `slicesOf` labels pie slices by value.
- `components/launcher/use-launcher-stack.ts:40-46` — `push` refuses a view of
  the same kind as the top, so refine turns can never become stack entries.
  `use-launcher-hotkeys.ts:28-37` — Esc: pop if depth > 1, else clear query,
  else dismiss. `ask-view` handles Esc-while-busy first (`use-ask-keyboard.ts:37-41`).
- Saving: `components/widgets/widget-draft.ts:20-35` `draftFromAsk` takes
  `{ prompt, sql, dialect, spec, view, connectionId }` from `answeredOf`
  (`ask-view.tsx:46-62`).
- Browser mode: `lib/browser-ask-stub.ts` replays recorded asks
  ("signups" → stacked bar, "delete/drop…" → refusal, else revenue by region).

## Commands you will need

| Purpose          | Command                                                                  | Expected                  |
| ---------------- | ------------------------------------------------------------------------ | ------------------------- |
| Agent tests      | `bun run --cwd packages/agent test`                                      | all pass                  |
| Core tests       | `bun run --cwd packages/core test`                                       | all pass (incl. polyglot) |
| RPC tests        | `bun run --cwd packages/rpc test`                                        | all pass                  |
| App tests (both) | `bun run --cwd apps/app test`                                            | all pass — REQUIRED       |
| One browser test | `bun run --cwd apps/app test:browser <path>`                             | pass                      |
| Coverage         | `bun run --cwd apps/app test:coverage`                                   | ≥80% lines                |
| e2e              | `bun run --cwd apps/app e2e`                                             | all pass                  |
| Types / lint     | `bun run check-types`, `bun run check`                                   | exit 0                    |
| Desktop          | `bun run --cwd apps/app desktop:dev`, driven with the `cua-driver` skill | launcher works            |

## Implementation rules relevant to this plan

- **Protected contracts stay untouched.** Do not change `AskEvent` or
  `CardSpec` (`packages/rpc/src/ask.ts`, `card-spec.ts`); any change there
  requires a `CardSpec.version` bump, which this plan does not authorize.
  Assumptions travel through a **new RPC request**, not a new event. `Widget`,
  `Board` and `RecentAsk` shapes stay identical (no migration).
- **Read-only is unchanged.** A refine is a normal ask: the new SQL goes
  through `assertReadOnly` and runs with `{ readOnly: true }`. The previous SQL
  sent as context is **never executed**.
- **AI and secrets stay in bun.** Refine context is validated at the RPC edge
  with zod (size caps below). The renderer never calls a model.
- **No extra model call** for assumptions: they come from parsing the SQL.
- polyglot returns `any`. Wrap it: accept `unknown`, narrow with small type
  guards (`isRecord`, `nodeOf(value, "column")`) or zod; no `any` may escape
  `sql-assumptions.ts`. No `// @ts-expect-error`.
- Strict TS, `noUncheckedIndexedAccess`, no unsafe casts. Small components
  (~150 lines), one per file, ≤ ~6 props, no boolean-prop proliferation
  (use `variant`/`state` enums), hooks own logic, hotkeys live in
  `useXxxKeyboard`/`useXxxHotkeys` hooks, never inline. Derive in render; no
  derived state synced through `useEffect`. Network/RPC responses are handled
  in event handlers (the `onAskEvent` callback), not effects.
- `AskCard` keeps depending only on `{ spec, result, view }` (+ existing
  callbacks). Drill-down attaches through a **context provider** that only the
  ask view mounts, so boards and widget runs stay non-interactive with no new
  props.
- No code comments by default; one short line only for a non-obvious why.
- Colocated tests: `*.test.ts` for pure logic (jsdom `unit` project),
  `*.browser.test.tsx` for components and hooks (vitest-browser-react, `render`
  from `vitest-browser-react`, `renderHook` from `@/test/render-hook`).
  Snapshots for empty/loading/error/populated states. 80% line coverage gate.
- Copy: quiet, senior-colleague voice; no "AI", no sparkles, no exclamation
  marks.

## Contracts added or changed (not protected; keep stable for 008/011/016)

In `packages/rpc/src/ask.ts` (unprotected part):

```ts
export const MAX_ASK_TURNS = 6;
export interface RefineContext {
  chainId: string; // askId of the chain's first turn; recents keep one entry per chain
  turns: string[]; // prompts of the earlier turns, oldest first, 1..MAX_ASK_TURNS-1
  sql: string; // SQL of the turn being refined (context only, never executed)
  spec: CardSpec; // its card
}
export interface AskParams {
  askId: string;
  connectionId: string;
  database: string | null;
  prompt: string; // the follow-up text for a refine, the question otherwise
  refine?: RefineContext;
}
```

New file `packages/rpc/src/assumptions.ts` (export from `index.ts`):

```ts
export type TimeGrain = "hour" | "day" | "week" | "month" | "quarter" | "year";
export type SqlAssumption =
  | { kind: "table"; name: string }
  | { kind: "time"; column: string; grain: TimeGrain | null }
  | { kind: "filter"; column: string | null; text: string }
  | { kind: "limit"; rows: number };
export interface SqlAssumptions {
  items: SqlAssumption[];
}
```

New RPC request in `packages/rpc/src/schema.ts`:
`describeSql: { params: { sql: string; dialect: DialectType }; response: SqlAssumptions | null }`.

Agent: `runAsk(prompt, ports, signal, refine?: RefineContext)` — the optional
4th argument keeps every existing caller (and plan 016's MCP `ask`) valid.

## UI and motion (mandatory)

The owner's bar: **the UI must be excellent and motion is mandatory.** A surface
without designed motion, or without designed empty, loading, populated and error
states, is not done. Use `apps/app/src/mainview/lib/motion.ts` and
`components/motion/`; do not hand-roll transitions.

- **Tokens:** `SPRING` (400/30) layout morphs and push/pop; `SPRING_SNAPPY`
  (600/49) selection, thumbs, toggles; `SPRING_SOFT` (260/32) height, panel and
  card reveals; `SPRING_MOMENTUM` only after a drag release; `FADE_IN` 160ms
  ease-out-quint; `FADE_OUT` 110ms; `PRESS` scale 0.97 over 100ms on
  pointerdown/keydown; `staggerDelay(i)` 30ms capped at 6. Primitives:
  `<Pressable>`, `<SwapText>`, `<Reveal>`. `useMotionPreset()` returns reduced
  equivalents (120ms crossfades, no transforms).
- **Principles:** respond on press; everything interruptible (springs retarget,
  no input lockout, no CSS transitions for re-triggerable things); exit the way
  you entered; `layoutId` for objects in two places; critically damped by
  default; animate only `transform`/`opacity`/`filter`, `layout` for size;
  exits ≈70% of entrances; one primary motion per moment; only progress
  indicators loop.
- **Accessibility:** reduced motion turns travel into crossfades or instant
  changes (feedback stays); reduced transparency → opaque; increased contrast →
  solid borders, muted text promoted; focus rings always visible; live regions
  announce state changes, never frames.
- **Flicker rule:** a loading state under 150ms never shows; once shown it
  holds ≥300ms (`useDelayedVisibility`).
- **The signature rule for this plan:** a refine must read as **the same card
  changing its mind**, never as a new screen. The card never unmounts between
  turns of a chain; nothing re-enters from zero.

### Motion moments in this plan

| Moment                         | Trigger                                            | What moves                                                                                                                                                                                                                                                                                                             | Token                                                         | Reduced motion                                   |
| ------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Follow-up lifts into the trail | `↵` with a follow-up                               | The typed text (a ghost `motion.span` over the input) travels up and settles as the newest crumb of the question trail (`layoutId="ask-turn-{index}"`). The input clears to the refine placeholder in the same frame.                                                                                                  | `SPRING`                                                      | Instant: crumb appears, input clears             |
| Current-turn thumb             | refine done, `↑`/`↓`, crumb click                  | The highlight behind the shown crumb slides (`layoutId="ask-turn-current"`).                                                                                                                                                                                                                                           | `SPRING_SNAPPY`                                               | Instant                                          |
| Card goes stale                | refine starts                                      | Card opacity 1→0.6; a 2px `ProgressHairline` appears at the card's top edge (the one allowed loop). No skeleton, no status block, card height unchanged.                                                                                                                                                               | `FADE_IN`                                                     | Dim stays (opacity is feedback); static hairline |
| Header metadata                | each phase of a refine                             | `<SwapText>` segments: `27 rows · 386ms` → `Writing SQL · 4 lines` → `Running · read only` → `31 rows · 402ms`.                                                                                                                                                                                                        | `FADE_IN`                                                     | Instant                                          |
| SQL while refining             | `sqlDelta` (only if the SQL block is expanded)     | Previous SQL dims to 40% and crossfades to the new stream (the plan 005 repair motion). Collapsed SQL stays collapsed.                                                                                                                                                                                                 | `FADE_OUT`, `FADE_IN`                                         | Instant                                          |
| **Card morph, same view**      | `card` of a refine (same view kind, same x column) | Recharts animates bars/lines **between** old and new data (`intro="update"`, 300ms). Title and subtitle `<SwapText>`. Legend items persist by series label: kept items move via `layout`, new ones fade + 2px rise, removed ones fade out. Card height follows through `LauncherSurface`. Opacity 0.6→1 as data lands. | Recharts 300ms, `SPRING`, `FADE_IN`/`FADE_OUT`, `SPRING_SOFT` | Instant data swap, 120ms fade                    |
| Card morph, new view           | `card` of a refine with a different view kind      | Body crossfades (existing keyed `AnimatePresence` in `AskCard`), the view-toggle thumb slides (`layoutId="card-view-thumb"`), height morphs.                                                                                                                                                                           | `FADE_IN`, `SPRING_SNAPPY`, `SPRING_SOFT`                     | Crossfade, instant height                        |
| Insight                        | after the morph                                    | Old insight fades out at `FADE_OUT`; new one `<Reveal>`s 120ms after data settles.                                                                                                                                                                                                                                     | `FADE_OUT`, `FADE_IN`                                         | Instant                                          |
| Changed SQL lines              | SQL expanded after a refine or step                | A 2px amber gutter mark on each changed line draws in (`scaleY 0→1`, origin top, `staggerDelay`).                                                                                                                                                                                                                      | `FADE_IN`, stagger                                            | Static marks                                     |
| Assumptions line               | first card                                         | Chips `<Reveal>` with stagger.                                                                                                                                                                                                                                                                                         | `FADE_IN`, stagger                                            | Instant                                          |
| Assumptions update             | refine/step                                        | Chips keyed by `kind:text`: kept chips move via `layout`; new chips fade + 2px rise; removed chips fade out; a chip of the same kind with new text `<SwapText>`s and gets one amber pulse (background opacity 0.14→0 over 900ms, once).                                                                                | `SPRING`, `FADE_IN`/`FADE_OUT`                                | Instant, no pulse                                |
| Chip / drill press             | click or `↵` on a chip, click on a segment         | Chip `PRESS`; clicked SVG segment flashes opacity 0.85; input receives the pre-filled text with the editable part selected; focus moves to the input (visible ring).                                                                                                                                                   | `PRESS`                                                       | Opacity press                                    |
| Drill hover                    | pointer over a bar/slice/row                       | Other segments of the same series dim to 0.5; pointer cursor; tooltip as today.                                                                                                                                                                                                                                        | `FADE_IN`                                                     | Same (opacity only)                              |
| Drill list                     | `⌘D`                                               | A list of segments (≤ 50) opens under the card header: scale 0.96→1 + fade from the header's right edge; selection pill `layoutId="drill-selection"`; exit mirrors entry.                                                                                                                                              | `SPRING_SNAPPY`, `FADE_OUT`                                   | Crossfade                                        |
| Step through turns             | `↑`/`↓` on an empty input, crumb click             | Same as "card morph" (update transition between the two turns' data), SQL crossfades, assumptions update.                                                                                                                                                                                                              | as above                                                      | Instant                                          |
| Refine error                   | `error` during a refine                            | Hairline fades; card returns to opacity 1; a compact `AskError` `<Reveal>`s between the header and the card with the destructive tint. No shake.                                                                                                                                                                       | `FADE_IN`                                                     | Instant                                          |
| Refine cancelled               | Esc / stop while refining                          | Hairline fades; card back to 1; header `<SwapText>`s back to the shown turn's metadata; the lifted crumb fades out.                                                                                                                                                                                                    | `FADE_OUT`, `SPRING`                                          | Instant                                          |
| Turn limit                     | `MAX_ASK_TURNS` reached                            | Placeholder `<SwapText>`s to "Start a new question with ⌘↵"; the footer hint swaps.                                                                                                                                                                                                                                    | `FADE_IN`                                                     | Instant                                          |

Live regions: on a refine's `card`, announce "Updated: {title}". On a step,
announce "Step {n} of {total}: {prompt}". On a drill pre-fill, announce
"Ready to refine: {text}". Never announce per frame.

## Scope

**In scope**

- `packages/rpc/src/{ask,assumptions,schema,index}.ts` (+ `assumptions.test.ts` if logic is added there).
- `packages/agent/src/{ask,prompts,present}.ts` and their tests; new `packages/agent/src/refine.ts` (+ `refine.test.ts`) for message building and the relevance text.
- `packages/core/src/sql-assumptions.ts` (create) + `sql-assumptions.test.ts`; export from `packages/core/src/index.ts` (main entry only).
- `packages/core/src/widgets.ts` (`pushRecentAsk` also replaces a record with the same `id`) + test.
- `apps/app/src/bun/ask-service.ts` (+ test), `apps/app/src/bun/rpc.ts` (`describeSql` handler).
- `apps/app/src/mainview/lib/ipc.ts`, `lib/browser-ask-stub.ts`, `lib/browser-ipc-stub.ts` (stub `describeSql`, recorded refines).
- `apps/app/src/mainview/lib/sql-diff.ts` (create, pure) + test; `lib/drill.ts` (create, pure) + test; `lib/view-switch.ts` (create, pure) + test.
- `apps/app/src/mainview/components/ask/*`: reducer, `use-ask`, `ask-view`, `ask-body`, `ask-sql-section`, `sql-block`, `ask-labels`, `ask-footer-hints`, `use-ask-keyboard`, card leaf components (`card-chart`, `card-pie`, `card-table`) for drill handlers; new `question-trail.tsx`, `assumptions-line.tsx`, `drill-context.tsx`, `drill-list.tsx`, `use-refine-input.ts`.
- `apps/app/src/mainview/components/motion/progress-hairline.tsx` (moved out of `widget-run-body.tsx`), and `widget-run-body.tsx` to import it.
- `apps/app/src/mainview/components/launcher/use-launcher-ask.ts`.
- `apps/app/src/mainview/components/widgets/use-ask-save.ts` / `widget-draft.ts` only if `answeredOf` needs the chain prompt.
- `apps/app/e2e/ask-flow.spec.ts` (extend) or `apps/app/e2e/refine-flow.spec.ts` (create).
- `CLAUDE.md` — the "Ask view" bullet (one or two lines on refine, assumptions, drill).
- `.factory/plans/README.md` status row (unless coordinator-owned).

**Out of scope**

- `AskEvent`, `CardSpec`, `Widget`, `Board`, `RecentAsk` shapes — protected; any need to change them is a STOP.
- MongoDB/Redis asks (plan 013). Assumptions for non-SQL return `null`.
- Refining a **widget run** or a board tile (widget runs never call the AI).
- Result actions menu (plan 008), raw `>` SQL mode (plan 009), History view (plan 011).
- Persisting chains across app restarts. Chains live in memory with the session; the recent entry keeps the latest turn.

## Git workflow

- Branch `feat/launcher-012-refine` from the current working branch (the
  baseline is uncommitted on `feat/launcher-002-shell`; do not commit unless
  the operator authorizes it). Do not push or open a PR unless instructed.

## Steps

### Step 1: Contracts and the describe request (rpc)

Add `MAX_ASK_TURNS`, `RefineContext` and `AskParams.refine?` to
`packages/rpc/src/ask.ts`; create `assumptions.ts`; add `describeSql` to
`RpcSchema.requests`. Export everything from `packages/rpc/src/index.ts`.
`git diff packages/rpc/src/card-spec.ts` must stay empty and the `AskEvent`
union must be byte-identical.

### Step 2: Assumptions from SQL (core, bun-side)

Create `packages/core/src/sql-assumptions.ts` exporting
`describeSqlAssumptions(sql: string, dialect: DialectType): SqlAssumptions | null`.
Reuse transpile's dialect mapping (move `DIALECT_MAP`/`toDialect` into a shared
private helper in core if needed, one owner). Rules, all deterministic:

1. Parse; return `null` when `success` is false, there is not exactly one
   statement, or it is not a `select`.
2. **Tables**: `ast.getTableNames(stmt)`, deduped in order, schema prefix
   dropped (`public.orders` → `orders`), max 4.
3. **Time**: scan the outer SELECT expressions (unwrap `alias`) for a bucketing
   function over a column. Map `date_trunc('month', c)`, `DATE_TRUNC`,
   `toStartOf{Hour,Day,Week,Month,Quarter,Year}(c)`, `DATE_PART`/`DATEPART`
   (unit from the `var` or string literal arg), `strftime(fmt, c)` and
   `DATE_FORMAT(c, fmt)` (grain from the format: `%Y-%m-%d` → day, `%Y-%m` →
   month, `%Y` → year, `%W`/`%V` → week) to `{ kind: "time", column, grain }`.
   If none, fall back to the first column compared in WHERE to a date literal,
   `current_date`/`now()`/`today()` or an interval → `grain: null`.
   `column` is `table.column` when the column node carries a table qualifier
   that is a real table (not an alias of a CTE), else the bare name.
4. **Filters**: split the outer `where_clause.this` on top-level `and`; skip
   column = column equalities (join predicates) and the conjunct already used
   as the time fallback only if it is a pure range (keep it as a filter
   otherwise). Render each with `generate([node], dialect)`, collapse
   whitespace, clip at 60 chars with `…`. `column` = first column name in the
   conjunct or `null`. Max 4. Also include filters from a single CTE that the
   outer query reads from (the common `WITH paid AS (… WHERE status <> 'refunded')`
   shape); deeper nesting is ignored.
5. **Limit**: numeric `limit.this.literal` or `top` → `{ kind: "limit", rows }`.
6. Order: tables, time, filters, limit; total cap 8. Any thrown error → `null`.

Tests (`sql-assumptions.test.ts`), table-driven per dialect (postgresql, mysql,
sqlite, tsql, clickhouse, duckdb): bucket + range + IN filter + limit; a CTE
with a filter; join predicates skipped; an unparsable statement → `null`; a
non-SELECT → `null`; clipping; the browser stub's recorded SQL produces the
same items the stub returns (keep them in sync via a shared fixture).

Wire `describeSql: ({ sql, dialect }) => describeSqlAssumptions(sql, dialect)`
in `apps/app/src/bun/rpc.ts` next to `formatSql` (`:237`), validating params
with zod (`sql` ≤ 20,000 chars, `dialect` in `DIALECTS`). Do not import
`@oh-my-query/core` from `src/bun/index.ts`.

### Step 3: Refine in the agent

Create `packages/agent/src/refine.ts`:

- `refineMessages(refine: RefineContext, prompt: string): ModelMessage[]` →
  ```text
  user:      "{turns[0]}"  + for each later turn: "\nThen: {turn}"
  assistant: "{refine.sql}"
  user:      refineInstruction(prompt, refine.spec)
  ```
- `refineInstruction` (in `prompts.ts`): "Change that query to answer this
  follow-up: {prompt}. Keep everything the follow-up does not change: filters,
  time range, grouping, limits. The previous answer was a {view kind} titled
  "{title}". Reply with SQL only." (Same rules as the system prompt; SQL only.)
- `relevanceText(refine, prompt)` = earlier turns + prompt + previous SQL,
  joined by newlines; `selectRelevantSchema` gets this instead of the prompt so
  tables already in use stay in the schema excerpt.
- `chainPrompt(turns: string[], prompt: string)` = all turn prompts joined with
  `" · "` (used for the present step and the recent entry; also exported to the
  renderer through a tiny copy in `components/ask/ask-chain.ts` — keep both
  behind tests with the same cases, or put it in `@oh-my-query/rpc` as a pure
  helper so there is one owner; prefer rpc).

Change `runAsk(prompt, ports, signal, refine?)`: when `refine` is present use
`refineMessages`, `relevanceText`, and pass `prompt: chainPrompt(...)` plus
`previous: refine.spec` to `presentCard`. Repairs keep appending to the same
`messages` array. `PresentInput` gains `previous?: CardSpec`; `describeResult`
adds `previousCard: { title, view }` when present; append one line to
`PRESENT_SYSTEM_PROMPT`: "When previousCard is given, keep its view and formats
unless the question asks for a different view or the new columns no longer fit
it." No new events; the event sequence of a refine equals that of an ask.

Tests (`ask.test.ts`, `refine.test.ts`, mock model from `ai/test`): the model
receives the three refine messages in order; the schema excerpt keeps a table
named only in the previous SQL; a refine whose model output is a write is still
rejected `NOT_READ_ONLY`; repairs after a refine keep the context; the present
payload contains `previousCard`; without `refine` the messages are unchanged
(regression for plan 004 behavior).

### Step 4: Bun ask service and recents

In `ask-service.ts`, extend `askParamsSchema` with:

```ts
refine: z.object({
  chainId: z.string().min(1).max(100),
  turns: z.array(z.string().trim().min(1).max(4000)).min(1).max(MAX_ASK_TURNS - 1),
  sql: z.string().min(1).max(20_000),
  spec: CardSpec,
}).optional(),
```

Pass `params.refine` to `runAsk`. On `card`, remember the ask with
`id: params.refine?.chainId ?? params.askId` and
`prompt: chainPrompt(params.refine?.turns ?? [], params.prompt)`.
In `packages/core/src/widgets.ts`, make `pushRecentAsk` drop records whose `id`
equals the new record's `id` **in addition to** the `sameAsk` rule, so a chain
keeps one recent entry that always holds its latest turn. Tests: oversized
context rejected at the edge; recent entry replaced across refines of one
chain; a fresh ask still dedupes by prompt.

### Step 5: Renderer state — chains, turns, assumptions

Extend `ask-reducer.ts`:

```ts
export interface AskTurn {
  prompt: string;
  sql: string;
  dialect: DialectType;
  answer: AskAnswer & { spec: CardSpec };
  view: CardViewKind;
  assumptions: SqlAssumptions | null;
}
// AskState adds:
turns: AskTurn[];        // completed turns of the current chain, oldest first
position: number;        // index of the shown turn, -1 when none
base: AskTurn | null;    // the turn being refined while a refine runs
chainId: string | null;
transition: "fresh" | "refine" | "step" | "restore";
// actions add:
| { type: "start"; prompt: string; askId: string }
| { type: "refine"; prompt: string; askId: string }
| { type: "stepTurn"; to: number }
| { type: "assumptions"; sql: string; value: SqlAssumptions | null }
```

Transitions (each a unit test in `ask-reducer.test.ts`):

- `start` clears the chain, `chainId = askId`, `transition = "fresh"`.
- `refine` is allowed only when not working, a turn is shown and
  `position + 1 < MAX_ASK_TURNS`. It truncates `turns` after `position`
  (branching, like browser history), sets `base = turns[position]`, resets the
  live fields, `transition = "refine"`.
- `result` during a refine stores the result **without** replacing what is
  shown (the base stays on screen until the card is ready).
- `card` completes the turn: append `AskTurn`, `position = turns.length - 1`,
  `base = null`, `view` from the spec (or kept from the base when the spec's
  view kind equals the base view and the user had switched views).
- `error`/cancel during a refine: `base` is restored as the shown turn,
  `failure` kept for display (error) or cleared (cancel → status `done`, not
  "Stopped").
- `stepTurn` (not working): shows `turns[to]` (sql, answer, view, assumptions),
  `transition = "step"`.
- `selectView` also updates `turns[position].view`.
- `assumptions` applies only when `sql` matches the live or shown turn's SQL
  (late responses for an older SQL are dropped).

Selectors (pure, tested): `shownTurn(state)`, `chainPromptOf(state)`,
`canRefine(state)`, `refineContextOf(state): RefineContext | null`
(earlier prompts up to `position`, shown SQL, spec, `chainId`).

`use-ask.ts`: `start(prompt, target)` and `refine(prompt, target)` share the
subscription code; `refine` sends `ask({ askId, ...target, prompt, refine: refineContextOf(state) })`.
Inside the `onAskEvent` callback, when a `sqlDone` arrives, call
`describeSql({ sql, dialect })` and dispatch `{ type: "assumptions", … }` on
resolve (ignore rejections with a `console.error`; the line simply stays
hidden). This is an event handler, not an effect. `stepTurn` is exposed too.
`use-launcher-ask.ts` keeps owning the session, so `↑` on an empty root still
reopens the last answer, now at the turn that was shown.

### Step 6: Ask view — refine input, trail, morph

- `use-refine-input.ts` owns the draft. When a turn is shown and not working
  the input is empty with placeholder "Refine — by month, only Europe, as a
  table…"; while the first turn runs it shows the question (as today). Reset
  the draft when the shown turn changes using the "store previous, compare in
  render" pattern already used in `use-ask-save.ts:31-36` (no effect).
  Exposes `prefill(text, selection?: [start, end])` for chips and drill.
- Keys (in `use-ask-keyboard.ts`, extended; tests for each):
  - `↵` with text: if `matchViewSwitch(text, views)` (pure, `lib/view-switch.ts`:
    "as a table", "show as line", "pie chart", "bar" … → a `CardViewKind`
    available in `alternatesFor`) → `selectView` locally, **no ask**; else
    refine when a turn is shown; else start.
  - `⌘↵` with text: always a fresh question (new chain).
  - `↑`/`↓` with an empty input and not working: step to the previous/next
    turn. With text, the keys keep their text-field meaning.
  - Esc while working: cancel (restores the base). Esc otherwise: pop to root
    (unchanged; the chain survives in the session). Turns are **not** stack
    entries, so Esc never walks the chain.
  - `⌘D`: open the drill list (Step 8). Existing `⌘C`, `⌘E`, `⌘S`, `⌘⇧S`,
    `⌘1–n` unchanged.
  - At the limit, `↵` with text does nothing but swap the placeholder and the
    footer to "⌘↵ New question".
- `question-trail.tsx`: one row above the SQL header, `type-meta`, crumbs for
  the chain (`Monthly MRR by region › only Europe › by quarter`); the shown
  crumb has the `ask-turn-current` highlight; crumbs are buttons (click =
  `stepTurn`); truncation keeps the first and last two crumbs with a `…` crumb
  that opens nothing (tooltip lists the hidden prompts). Hidden when the chain
  has one turn and nothing is running.
- `ask-body.tsx` gains a `refining` body kind: the base turn's `AskCard` with
  `intro="update"`, wrapped in the stale treatment (opacity 0.6 +
  `ProgressHairline`). Move `ProgressHairline` from `widget-run-body.tsx:18-41`
  to `components/motion/progress-hairline.tsx` and import it in both places.
  `usePhaseDisplay` returns `refining` while working with a `base`, so the
  150ms/300ms skeleton rule never shows a skeleton during a refine.
- `AskCard` intro: `transition === "restore"` → `"skip"`, `"fresh"` →
  `"play"`, `"refine"`/`"step"` → `"update"`.
- Header (`ask-labels.ts` `headerSegments`): during a refine show
  `Writing SQL · n lines` / `Running · read only` instead of the base's rows.
- SQL block: when expanded after a refine or step, mark changed lines using
  `changedLines(previousSql, sql): Set<number>` (`lib/sql-diff.ts`, a small
  LCS over trimmed lines, pure and tested). The previous SQL is the base's (or,
  on a step, the turn before).
- Refine error: render `AskError` above the (restored) card; "Retry" re-sends
  the same refine.
- Footer (`ask-footer-hints.ts`): with a shown turn → `↵ Refine`, `⌘↵ New
question`, `↑↓ Steps` (only when the chain has ≥ 2 turns), plus existing
  hints; working → `esc Stop`.

### Step 7: Assumptions line

`assumptions-line.tsx` renders `shownTurn.assumptions` between the trail/SQL
header and the card, one wrapping row of `type-meta` chips:
`orders, regions` (plain text, not interactive) · `created_at · by month` ·
`status <> 'refunded'` · `top 500`. Chips with an action are buttons
(`Pressable`) with visible focus rings and an `aria-label` that states the
action. Click or `↵` pre-fills the refine input (`prefill`), never runs:

| Chip               | Pre-fill                                                                                                                         | Selected range             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| time with grain    | `group by week instead of by month` (alternative grain: day→week, week→month, month→week, quarter→month, year→quarter, hour→day) | the alternative grain word |
| time without grain | `use another date column than created_at`                                                                                        | `another date column`      |
| filter             | `without status <> 'refunded'`                                                                                                   | none (caret at end)        |
| limit              | `show all rows, not only the top 500`                                                                                            | none                       |

Hidden (no reserved space) when `assumptions` is `null` or has no items.
Snapshots: populated, filter-only, null. Plan 008's ⌘K actions, if present,
must read `shownTurn` so "Copy SQL"/"Save as widget" act on the turn on screen.

### Step 8: Drill-down

`drill-context.tsx` provides `{ drill(segment: DrillSegment) }`; only
`AskView` mounts the provider (boards/widget runs don't, so their cards stay
inert). `CardChart`, `CardPie` and `CardTable` read it with a hook that returns
`null` outside the provider and only then attach handlers.

`lib/drill.ts` (pure, tested):

```ts
export interface DrillSegment { filters: { column: string; value: string | number }[] }
export const segmentOfBar(view, model, row, seriesKey): DrillSegment | null   // x (+ groupBy series label)
export const segmentOfSlice(view, label): DrillSegment | null
export const segmentOfRow(result, rowIndex): DrillSegment | null             // up to 2 non-numeric columns
export const drillPrompt(segment, formats): string  // `break down region "Europe", month "Mar 2026"`
export const drillSegments(spec, result): DrillSegment[]  // for the ⌘D list, ≤ 50
```

Rules: no segment for `OTHER_LABEL`, `null`, or empty values; values formatted
with the card's `formatValue` for display in the prompt; when the connection
has PII redaction on (`useConnections()` → `piiRedaction`), drop any segment
whose value `redactPii` (from `@oh-my-query/core/client`) would change, and
show "Hidden by PII redaction" in its tooltip.

Pointer: Recharts 2.15.4 `Bar` `onClick(data)` (row in `data.payload`, series
from the bar's `dataKey`), `LineChart`/`AreaChart` `onClick(state)` with
`state.activeLabel`, `Pie` slice `onClick`, table rows `onClick`. Keyboard and
AT: `⌘D` opens `drill-list.tsx`, a launcher-style list of `drillSegments`
(↑↓, ↵ pre-fills, Esc closes) labelled "Drill into…"; table rows also get
`tabIndex=0` + `↵` when a provider exists. A drill always **pre-fills**
(`prefill(drillPrompt(segment))`, caret at end) and never runs by itself.

### Step 9: Browser stub, e2e, docs

- `browser-ask-stub.ts`: when `params.refine` is present, replay a recorded
  refine: a prompt containing "europe"/"only" filters `REVENUE_BY_REGION` to
  Europe (title "Monthly recurring revenue in Europe"); "quarter" re-buckets to
  quarters; anything else re-emits the base with a different subtitle. Emit the
  same event sequence as a normal ask. Stub `describeSql` with recorded
  assumptions for each recorded SQL (shared fixture with the core test), and
  log both in `globalThis.__omqIpcLog`.
- e2e `refine-flow.spec.ts`: ask → card; type "only Europe" ↵ → the card
  updates in place (same `section` element handle, title changes), the trail
  shows two crumbs, the IPC log shows `ask` with `refine.turns.length === 1`;
  `↑` on empty input shows turn 1; click the `status` filter chip → input
  pre-filled, nothing sent; click a bar → pre-filled `break down …`; `⌘S`
  saves a widget whose `prompt` is the chain prompt and whose `sqlTemplate` is
  the refined SQL; "as a table" switches view with **no** new `ask` in the log.
- Update the CLAUDE.md "Ask view" bullet: refine keeps a turn chain in
  `ask-reducer` (↵ refine, ⌘↵ new, ↑/↓ steps, ≤ 6 turns), assumptions via the
  `describeSql` request (polyglot, bun-side), drill through `DrillProvider`.

## Test plan

- **rpc**: types compile; `chainPrompt` cases if placed in rpc.
- **core** `sql-assumptions.test.ts`: per-dialect fixtures (Step 2), null cases,
  clipping, CTE filter. `widgets.test.ts`: same-id replacement + existing dedupe.
- **agent** `refine.test.ts` + `ask.test.ts`: message shape, relevance text keeps
  previous tables, guard still rejects writes on refine, repairs keep context,
  present payload has `previousCard`, no-refine regression.
- **bun** `ask-service.test.ts`: refine params validated (too many turns, SQL too
  long, invalid spec → rejected); `runAsk` receives the context; recent entry
  uses `chainId` and the chain prompt.
- **renderer unit**: `ask-reducer.test.ts` (every transition in Step 5, incl.
  branching truncation, late assumptions dropped, error/cancel restore,
  turn limit), `sql-diff.test.ts`, `drill.test.ts` (Other/null/redacted
  excluded, prompts formatted), `view-switch.test.ts`.
- **renderer browser** (model after `ask-view.browser.test.tsx` and
  `widget-run-view.browser.test.tsx`, `emitIpcMessage()` from
  `src/mainview/test/ipc-mock.ts` to deliver `askEvent`s):
  `ask-view-refine.browser.test.tsx` (↵ refine sends `refine`, ⌘↵ fresh,
  ↑/↓ steps, Esc cancel restores base, limit placeholder, view-switch needs no
  ask), `question-trail.browser.test.tsx`, `assumptions-line.browser.test.tsx`
  (chip pre-fills + selection range, hidden when null),
  `drill-list.browser.test.tsx` and drill clicks on bar/pie/table, a board
  tile/widget run card stays inert (no provider). Both motion branches
  (`useReducedMotion` mocked) for trail, stale card and chips.
- **Snapshots**: refining (stale card + hairline), refined card with trail and
  assumptions, refine error over restored card, assumptions null, drill list
  open, turn limit reached.
- **Save regression**: `ask-save.browser.test.tsx` — saving after a refine
  stores the chain prompt, refined SQL, refined spec and the current view;
  `⌘⇧S` sends the refined SQL to `proposeWidgetParams`.
- **e2e**: `refine-flow.spec.ts` (Step 9); existing `ask-flow`/`widget-flow` stay green.

## Done criteria

- [ ] `git diff 12b9e8c -- packages/rpc/src/card-spec.ts` is empty and the
      `AskEvent` union in `packages/rpc/src/ask.ts` is unchanged; `Widget`,
      `Board`, `RecentAsk` schemas unchanged.
- [ ] Typing a follow-up in the ask view refines with context: the bun log
      shows one ask per refine, the model receives the previous SQL as an
      assistant message (agent test), and the new SQL still passes
      `assertReadOnly` and runs read-only.
- [ ] The card element is never unmounted across a refine or step (browser
      test holds the same `section` node) and Recharts runs the 300ms update
      transition, not the intro.
- [ ] Assumptions appear for every SQL dialect fixture, come from
      `describeSql` (no model call; verify the stub IPC log shows no `ask`
      triggered by them), and each interactive chip pre-fills without running.
- [ ] Drill on bar, line point, pie slice and table row pre-fills
      `break down …`; "Other", null and redacted segments are not drillable;
      `⌘D` offers the same segments from the keyboard.
- [ ] ↵/⌘↵/↑/↓/Esc behave as in Step 6; the launcher stack never gains an
      entry from a refine; `↑` on an empty root reopens the chain at its shown
      turn.
- [ ] Saving a refined answer as a widget (plain and with inputs) works and
      stores the chain prompt and refined SQL.
- [ ] `bun run check-types`, `bun run check`, `bun run --cwd packages/agent test`,
      `bun run --cwd packages/core test`, `bun run --cwd packages/rpc test`,
      `bun run --cwd apps/app test` (both projects) and
      `bun run --cwd apps/app e2e` pass; app line coverage ≥ 80%.
- [ ] Every row of "Motion moments in this plan" is implemented with its token
      and reduced-motion fallback, with a browser test per branch. Recordings at
      1× and 0.25× (`?slowmo=4`) of: ask → refine "only Europe" → refine "by
      quarter" → `↑` → drill on a bar → refine, from desktop dev driven with the
      `cua-driver` skill, attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of refine (stale → morph →
      assumptions update) and a step shows no frame over 16.7ms, and only
      `transform`/`opacity`/`filter` animate (Recharts' SVG attribute
      transition excepted, as in plan 005).
- [ ] Reduced Motion, Reduce Transparency and Increase Contrast verified on the
      trail, chips, stale card and drill list; designed empty (no assumptions),
      loading (refining), populated and error states have snapshots; WCAG AA
      contrast for chip text on the translucent panel.
- [ ] CLAUDE.md "Ask view" bullet updated; README status row updated.

## STOP conditions

- Refine or assumptions turn out to need a new `AskEvent` member or a
  `CardSpec` field (e.g., the renderer cannot get assumptions in time through
  the request). Report; do not bump `CardSpec.version` without the owner.
- polyglot fails to parse more than one of the six dialect fixtures, or its AST
  shape differs from the one recorded in "Current state" in a way the type
  guards cannot absorb. Ship the line for the dialects that parse, hide it for
  the rest, and report — never fall back to regex parsing of SQL.
- Real-model refines regress answers in manual testing (the model drops prior
  filters in ≥ 2 of 5 scripted chains on the fixture Postgres). Report the
  transcripts; do not loosen the guard or add a second model call without the
  owner.
- A "morph in place" cannot hold 60fps on a 2,000-row result in the Timelines
  trace. Report with the trace; do not remove the motion — reduce the data the
  chart animates (e.g., the table view skips the update animation) only with
  approval.
- Recharts 2.15.4 cannot expose click targets for a mark type without forking
  the component. Ship the `⌘D` list for that mark and report.

## Maintenance notes

- `RefineContext` is the stable shape plan 016 (MCP server `ask`) and plan 013
  (Mongo/Redis) build on; extend it additively.
- The chain lives only in the renderer session; if History (plan 011) wants to
  reopen a chain, it needs the chain persisted — a `RecentAsk` change, which is
  protected (migration required). Deliberately deferred.
- Reviewers: scrutinize `refineContextOf` (only turns up to `position`, never
  later branches), the zod caps on `refine`, `sql-assumptions.ts` for any `any`
  leaking, and that `DrillProvider` is mounted only in `AskView`.
- Deferred: assumptions for widget runs and board tiles (cheap reuse of
  `describeSql`, but tiles have no refine target), a grain picker menu on the
  time chip, persisting chains, and SQL-diff word-level highlighting.
