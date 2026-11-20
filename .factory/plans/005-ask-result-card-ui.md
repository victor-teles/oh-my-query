# Plan 005: Render the ask flow as a live result card in the launcher

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- apps/app/src/mainview packages/rpc`
> and `git status --short`. Plans 002–004 must be merged. Confirm that
> `@oh-my-query/rpc` exports `CardSpec`, `AskEvent` and `AskPhase`, and that
> `lib/ipc.ts` exports `onAskEvent`.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `.factory/plans/002-launcher-shell.md`, `.factory/plans/004-bun-ask-pipeline.md`
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-17 (assumes 002–004 landed)

## Why this matters

This is the product moment from the owner's demo, and the app's new signature
surface. It replaces the Dynamic Island. A question becomes streaming SQL, then
a live status, then a chart, all inside one calm panel that grows smoothly.
If this feels native and trustworthy, the launcher works. If it feels like a
chatbot drawer, it fails the brand.

## Reference behavior (the owner's demo, frame by frame)

The panel is 760px wide on a dark background. From top to bottom:

1. **Input row.** A leading chip (a database glyph and `analytics`), the
   question text, and a trailing square button. The button shows `↑` when idle
   and a filled stop square while busy.
2. **Header row** (28px, small type). A leading engine glyph, **Generated SQL**
   in medium weight, then muted metadata separated by `·`:
   - while writing: `PostgreSQL · analytics`, with a spinner on the right;
   - after the SQL is done: `PostgreSQL · 12 lines`;
   - after the result: `PostgreSQL · 27 rows · 386ms`.
     On the right are a check mark (success) or spinner, a copy button, and a
     chevron that expands or collapses the SQL.
3. **SQL block** (only while streaming, or when expanded). A mono font with line
   numbers and syntax colors, streaming character by character. It
   auto-collapses when the result arrives.
4. **Status line** (while working). A small spinner, a primary label such as
   "Writing SQL" or "Running query · 18,226 rows", and a muted second line such
   as "Reading the analytics schema" or "Read only on analytics". Below it is a
   **skeleton chart**: bars at very low contrast, plus a thin skeleton line for
   the insight.
5. **Result card.** A title (medium) and subtitle (muted) on the left, and a
   segmented control (`Bar | Line | Table`) on the right. A legend row follows,
   where each series shows a color dot, its name and its latest value in
   tabular numerals (`North America $258k`). Then the chart, with subtle
   horizontal gridlines, compact y ticks (`$300k`) and short x ticks (`Jan`,
   `Aug 3`). Last comes the **insight** line, with a small leading glyph in
   muted text, up to two lines.

The transitions in the video are smooth crossfades, and the skeleton is replaced
in place by the chart at the same height, so the panel does not jump.

## Current state

- From plan 002: `components/launcher/{launcher-panel,launcher-input,launcher-list,launcher-footer}.tsx`,
  `use-launcher-stack.ts` (the `LauncherView` union), `use-launcher-hotkeys.ts`,
  and `lib/motion.ts` (`SPRING`, `SPRING_SOFT`, `useMotionPreset`). The panel
  auto-resizes the native window from measured content height.
- From plan 003: the active connection is in `getActiveConnection`, and the
  input chip shows its name.
- From plan 004: `ipc.ask({ askId, connectionId, database, prompt })`,
  `ipc.cancelAsk({ askId })`, and `onAskEvent(askId, handler)`. The events are
  `phase`, `sqlDelta`, `sqlReset`, `sqlDone`, `result`, `card`, `error` and
  `done`. `CardSpec.view` is one of `chart` (`mark: bar|line|area`, `x`, `y[]`,
  `groupBy?`, `stacked`), `pie`, `kpi` or `table`. `formats` maps a column to
  `{ kind: number|integer|percent|currency|compact|date|month|text, currency? }`.
- `components/ui/chart.tsx` is the shadcn chart wrapper over `recharts@2.15.4`
  (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`).
  It has a browser test.
- `@codemirror/lang-sql` was kept by 002. It provides the SQL Lezer parser for
  highlighting without an editor. Use `@lezer/highlight`'s `highlightCode`,
  plus a tag→class map styled with the warm palette.
- Existing helpers kept by 002: `lib/format-cell.ts`, `lib/format-metrics.ts`
  and `lib/csv.ts`.

## Commands you will need

| Purpose          | Command                                                                                     | Expected                     |
| ---------------- | ------------------------------------------------------------------------------------------- | ---------------------------- |
| App tests        | `bun run --cwd apps/app test`                                                               | all pass                     |
| One file         | `bun run --cwd apps/app test:browser src/mainview/components/ask/ask-card.browser.test.tsx` | pass                         |
| Update snapshots | `bun run --cwd apps/app test:browser -- -u`                                                 | review the diff              |
| Typecheck / lint | `bun run check-types`, `bun run check`                                                      | exit 0                       |
| Browser preview  | `bun run dev:web`                                                                           | the stubbed ask flow renders |

## Implementation rules relevant to this plan

- Everything from plan 002 still applies: React 19, small components (≤~150
  lines, ≤~6 props), no derived state synced via effects, hooks own logic, and
  colocated tests.
- **State machine, not flags.** The ask state is a `useReducer` over the events,
  with a discriminated `status`:
  `idle | schema | sql | run | present | done | error | cancelled`.
  The reducer is a pure function in `ask-reducer.ts`, unit-tested
  exhaustively.
- Brand voice: no sparkle icon for the insight. Use a small neutral glyph, such
  as lucide `TrendingUp`/`TrendingDown` keyed to the trend direction, or a
  quiet `·`. No "AI-powered" copy. Status text is short and factual.
- Accessibility:
  - The status line is `role="status"` with `aria-live="polite"`. Announce
    phase changes only, never per-character SQL.
  - The segmented control is a radio group with arrow-key support.
  - Charts get an `aria-label` summarizing the title and series, and the Table
    view is the accessible fallback.
  - Every icon button has an `aria-label`.
  - All text on the translucent panel meets WCAG AA, including muted metadata.
- Motion: follow the "UI and motion" section and its moments table below.
  Implementation notes:
  - Use `AnimatePresence mode="popLayout"` for header, status and card swaps.
  - Recharts' `isAnimationActive` is true only on first render with motion
    allowed. View toggles and reduced motion set it to false.
  - Drive the ask choreography from the reducer's `status`, never from timers
    in components. Timing rules (the 150ms show delay and the 300ms minimum)
    live in one hook, `use-phase-display.ts`, which is unit-tested with fake
    timers.
- Charts:
  - Use the 6-series palette from plan 002 tokens. Series 1 is amber.
  - Gridlines are horizontal only, at very low alpha.
  - Use tabular numerals, compact currency ticks (`$300k`), and short date
    ticks derived from the column format.
  - Show at most 6 series. If a `groupBy` yields more, keep the top 5 by total
    and fold the rest into "Other".

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

### Motion moments in this plan (the product's signature surface)

This plan replaces the Dynamic Island as the app's "wait, what was that?"
moment. The phase choreography must read as **one continuous object changing
state**, not as a series of screens.

| Moment               | Trigger                    | What moves                                                                                                                                                                                                                                                  | Token                              | Reduced motion                  |
| -------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------- |
| Ask starts           | `↵`                        | The submit button morphs to a stop square (icon crossfade plus `layout`). The header row `<Reveal>`s below the input, and the panel's height morphs.                                                                                                        | `SPRING_SNAPPY`, `SPRING_SOFT`     | Crossfade, instant height       |
| Header metadata      | Each phase                 | Each `·` segment is its own `<SwapText>`: `analytics` → `12 lines` → `27 rows · 386ms`. New numbers blur in.                                                                                                                                                | `FADE_IN`                          | Instant                         |
| Status line          | `phase` events             | The label pair `<SwapText>`s ("Writing SQL" → "Running query"). The spinner uses CSS rotation (an allowed loop). Status appears only if a phase lasts more than 150ms.                                                                                      | `FADE_IN`                          | Static dot instead of a spinner |
| SQL streaming        | `sqlDelta`                 | Text appends with no per-character animation (performance). A soft caret blinks (CSS `steps`). Line numbers appear as lines arrive. The block grows via `layout` up to its max height, then scrolls and pins to the bottom.                                 | `SPRING_SOFT`                      | Static caret                    |
| Repair               | `sqlReset`                 | The old SQL dims to 40% and crossfades to the new stream. The status `<SwapText>`s to "Fixing the query · attempt 2".                                                                                                                                       | `FADE_OUT`, `FADE_IN`              | Instant                         |
| Skeleton             | phase `schema`/`sql`/`run` | 12 low-contrast bars with a slow shimmer (CSS gradient translate over 1.6s). Bar heights are deterministic. Once shown, it stays at least 300ms.                                                                                                            | CSS loop                           | No shimmer                      |
| Success check        | `result`                   | The header spinner becomes a check that draws in (`pathLength`, 220ms).                                                                                                                                                                                     | `SPRING_SNAPPY`                    | Instant                         |
| SQL auto-collapse    | `result`                   | The SQL block collapses via `layout` height, the chevron rotates 180°, and the card rises into the freed space.                                                                                                                                             | `SPRING_SOFT`, `SPRING_SNAPPY`     | Instant                         |
| **Skeleton → chart** | `card`                     | A crossfade at a **fixed body height**, so nothing jumps. Bars grow from the baseline (`scaleY`, `transform-origin: bottom`, staggered 12ms each, 200ms total cap). Lines draw left to right (stroke dash, 450ms ease-out). These run on first render only. | Recharts animation, 450ms ease-out | Chart appears with a 120ms fade |
| Title, legend        | `card`                     | The title and subtitle `<Reveal>`. The legend items stagger in, and their values blur in.                                                                                                                                                                   | `FADE_IN`, `STAGGER`               | Instant                         |
| Insight              | after the chart settles    | `<Reveal>` with a 120ms delay                                                                                                                                                                                                                               | `FADE_IN`                          | Instant                         |
| View toggle          | Bar/Line/Table, `⌘1/2/3`   | The segmented thumb slides via `layoutId="card-view-thumb"`. The body crossfades with **no** re-entry animation. The table's rows fade in, without stagger beyond 6.                                                                                        | `SPRING_SNAPPY`, `FADE_IN`         | Instant                         |
| Tooltip / crosshair  | pointer move               | Tracks the pointer 1:1, with **no** position transition. The tooltip only fades in.                                                                                                                                                                         | none, plus `FADE_IN`               | Same                            |
| Copy SQL             | Click or `⌘C`              | The icon swaps to a check for 1.2s. `aria-live` says "Copied".                                                                                                                                                                                              | `FADE_IN`                          | Instant                         |
| Error                | `error`                    | The error block `<Reveal>`s with a destructive tint. The SQL stays expanded, and for `NOT_READ_ONLY` the offending keyword is underlined. No shake.                                                                                                         | `FADE_IN`                          | Instant                         |
| Cancel               | Stop or Esc                | The stop square morphs back to `↑`. Partial SQL dims and the status `<SwapText>`s to "Stopped".                                                                                                                                                             | `SPRING_SNAPPY`                    | Instant                         |
| Reopen last ask      | `↑` on empty root          | Push from the right, restoring the card without replaying its entrance animations.                                                                                                                                                                          | `SPRING`                           | Crossfade                       |

## Scope

**In scope**

- `apps/app/src/mainview/components/ask/` (create): `ask-view.tsx`,
  `ask-reducer.ts`, `use-ask.ts`, `ask-header.tsx`, `sql-block.tsx`,
  `ask-status.tsx`, `ask-skeleton.tsx`, `ask-card.tsx`, `card-view-toggle.tsx`,
  `card-legend.tsx`, `card-chart.tsx`, `card-kpi.tsx`, `card-table.tsx`,
  `card-insight.tsx`, `ask-error.tsx` and `use-phase-display.ts`, each with a
  test.
- `apps/app/src/mainview/lib/card-data.ts` (create, pure). It contains
  `pivotLongToWide`, `seriesOf(spec, rows)`, `latestValues`, `formatValue`,
  `formatTick` and `alternatesFor(spec, result)` (which views the toggle
  offers), plus `card-data.test.ts`.
- `apps/app/src/mainview/lib/sql-highlight.ts`: pure tokenization to spans.
  Tolerates partial SQL.
- `components/launcher/*`: add an `ask` `LauncherView` variant, wire `↵` on free
  text to push it, and route the input's busy and stop state.
- `lib/ipc.ts` browser stub: a scripted fake ask that replays a
  recorded event sequence with timers. It powers `dev:web`, e2e and the demo,
  and uses the demo's "Revenue by region" data.
- `apps/app/e2e/ask-flow.spec.ts` (create).

**Out of scope**

- Saving, widgets and parameters (plan 006). Leave a disabled `⌘S Save`
  footer hint only if it is useful for layout, or omit it.
- Any change to the `AskEvent`/`CardSpec` contracts.
- Editing the SQL by hand. The SQL is read-only and copyable.

## Git workflow

- Branch `feat/launcher-005-ask-card`. Commit only if authorized.

## Steps

### Step 1: Pure data layer

`card-data.ts` handles these transforms:

- **Long→wide pivot.** `month, region, mrr` with `groupBy: "region"` becomes
  rows of `{ month, "North America": n, Europe: n, … }` plus a series list.
- **Latest value per series.** Use the last non-null value in x order.
- **Value formatting** per `ColumnFormat`. Currency is compact above 10k
  (`$258k`, `$1.2M`), and values that end in `_cents` or carry a cents type
  hint are divided by 100 _only_ when the format says so. In practice the
  model's SQL already divides, so never guess. Month formatting gives `Jan`,
  date formatting gives `Aug 3`, and percent gives `12.5%`.
- **`alternatesFor`.** A chart with temporal x offers `Bar, Line, Table`. A
  categorical x offers `Bar, Table`. A pie offers `Pie, Bar, Table`. A KPI
  offers `KPI, Table`. A table offers `Table` plus any chart the data supports,
  using the same rules as 004's `inferCardSpec`. Mirror that logic here; do not
  import from `packages/agent`.

Unit-test each transform, including nulls, a single row, more than 6 series
folded into "Other", and negative numbers.

### Step 2: Ask state

- `ask-reducer.ts` is a pure reducer over `AskEvent`, plus local actions
  `{ type: "start", prompt }`, `{ type: "selectView", view }` and
  `{ type: "toggleSql" }`. It accumulates the SQL text (`sqlReset` clears it
  and keeps a `repairs` count). It derives `lines` from the SQL text, and
  stores the result, spec, selected view (it defaults to the spec's view), and
  `sqlExpanded`. That field defaults to true while writing; the `result`
  event sets it to false unless the user toggled it.
- `use-ask.ts` creates the `askId` (`nanoid`), subscribes with `onAskEvent`
  before calling `ask`, unsubscribes on unmount or a new ask, and exposes
  `{ state, start, cancel, selectView, toggleSql }`. A new question while busy
  cancels the previous ask.

### Step 3: Components

Build these to the reference behavior above, as small, single-purpose
components:

- **`sql-block`**: line numbers, highlighted spans, a soft caret at the end
  while streaming, a max height of about 220px with internal scroll, and
  `⌘C` copies when focused.
- **`ask-header`**: shows the metadata per state.
- **`ask-status`**: shows the label pair per phase. For repairs it says "Fixing
  the query · attempt 2".
- **`ask-skeleton`**: 12 bars of varied deterministic heights at about 6%
  foreground alpha. It uses a shimmer, which is disabled under reduced
  motion, and is the same height as the card body (about 200px chart).
- **`ask-card`**: composes the toggle, legend, the chart, KPI or table body,
  and the insight.
- **`card-table`**: the first 200 rows with a sticky header, right-aligned
  tabular numbers, and a "Showing 200 of 2,000" line. No virtualization is
  needed at this cap.
- **`ask-error`**: maps each `AskErrorCode` to calm copy and one next action:
  - `NO_AI_SETTINGS` → "Open Settings"
  - `NOT_READ_ONLY` → "This would change data. oh-my-query only runs read-only
    questions." The SQL stays expanded.
  - `QUERY_FAILED` → the DB message, with the SQL expanded and a Retry action.
  - `UNSUPPORTED_ENGINE`, and the AI auth, rate-limit and network errors, each
    get a clear sentence.
- **Footer while on an ask**: `↵ Ask again`, `⌘C Copy SQL`, `⌘E Toggle SQL`,
  `⌘1/2/3` to switch views, and `Esc Back`.

### Step 4: Launcher integration

- On the root view, free text plus `↵` with no list row selected starts an ask
  against the active connection. If the list has matches, the first row is
  "Ask {connection}: “{text}”" and the matches follow, so `↵` still asks by
  default. This is Raycast's fallback-command pattern.
- The input stays editable during an ask. Submitting again restarts the ask,
  and the stop button cancels.
- `Esc` on an ask view pops to root, but keeps the last ask state in memory,
  so pressing `↑` on an empty input at root reopens it.

### Step 5: Browser stub, e2e, snapshots

- The scripted stub replays two recorded asks: "Weekly signups by plan"
  (stacked bar with 4 series, matching the video's first card) and "Revenue by
  region" (a line with 3 series and groupBy). Interpolate the recorded events
  with about 15ms per SQL chunk, 600ms for run, and 500ms for present.
- `e2e/ask-flow.spec.ts`: type "Revenue by region" and press Enter. Expect
  "Writing SQL", then the "Monthly recurring revenue by region" heading, then
  the Line radio checked. Switch to Table and expect a table with rows. Check
  that no console errors were logged.
- Snapshots: writing SQL (mid-stream), running, the populated line card, the
  table view, the KPI card, the `NOT_READ_ONLY` error and the
  `NO_AI_SETTINGS` error.

## Test plan

- Unit: `ask-reducer.test.ts`, which covers every event in every status,
  including the repair flow and a cancel arriving after `done` (ignored).
  Also `card-data.test.ts` and `sql-highlight.test.ts` (with partial input).
- Browser: one test per component. `use-ask` is tested with a mocked
  ipc module: subscribe-before-ask ordering, cancellation of the previous ask,
  and unsubscribe on unmount. Model the hook tests after the existing
  `@/test/render-hook` usage.
- e2e as above.
- `bun run --cwd apps/app test` → all pass. Coverage ≥80%.

## Done criteria

- [ ] In `dev:web`, the scripted "Revenue by region" ask visually matches the
      reference sequence (input → SQL streaming → running → line card with
      legend values and insight). Attach before/after screenshots to the PR.
- [ ] In desktop dev against the fixture Postgres with a real AI key, a
      question produces a real card, and the panel grows without clipping or
      jumping at the skeleton→chart swap.
- [ ] With reduced motion enabled in macOS, there are no springs or chart
      animations, and the swaps are instant.
- [ ] Contrast spot-check: muted metadata and legend text are ≥4.5:1 over the
      panel against a white desktop wallpaper (the worst case for translucency).
- [ ] Check-types, check, test, coverage and e2e all pass.
- [ ] Every row of "Motion moments in this plan" is implemented with its token and its
      reduced-motion fallback, with a browser test per branch. Recordings at 1× and 0.25×
      (`?slowmo=4`) are attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of a full ask: submit → SQL streaming → running → card → Bar/Line/Table toggles → copy shows no frame
      over 16.7ms, and only `transform`/`opacity`/`filter` animate.
- [ ] Reduced Motion, Reduce Transparency and Increase Contrast are each verified on this
      plan's surfaces, along with designed empty, loading, populated and error states (snapshots).

## STOP conditions

- Recharts 2.15.4 cannot render the needed charts (compact ticks, stacked bars,
  6 series, no animation) without heavy hacks. Report this before swapping
  chart libraries, because that adds a dependency decision.
- The native resize cannot keep up with the content height animation (visible
  clipping or flicker in desktop dev). Report the measured behavior and the
  options: pre-grow to a fixed card height, or animate the native frame from
  bun.

## Maintenance notes

- Plan 006 adds Save (`⌘S`) and reuses `ask-card` unchanged with data from a
  widget run. Keep `ask-card` dependent only on `{ spec, result, view }`, never
  on ask state.
- Plan 007 renders many `ask-card`s on a board. Keep the chart components
  width-responsive (`ChartContainer` already is) and free of launcher context.
