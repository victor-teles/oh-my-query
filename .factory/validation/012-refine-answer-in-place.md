# Validation: plan 012, refine an answer in place

Date: 2026-11-20. Branch `feat/launcher-002-shell`, uncommitted, on top of the
uncommitted plans 001–011. Verdict: **partially verified**. Every automated
check passes. The desktop run, recordings, the Timelines trace, the
accessibility toggles and the real-model refine check have not been run.

## What was built

- **Refine with context.** In the ask view, ↵ on a shown question answer
  sends `ask` with the optional `AskParams.refine`
  (`{ chainId, turns, sql, spec }`, zod-checked in bun with the plan's caps).
  `runAsk(prompt, ports, signal, refine?)` replays the earlier prompts, the
  previous SQL (as an assistant message, never executed) and a refine
  instruction. Schema relevance also reads the earlier prompts and SQL.
  Presenting gets the chain prompt and `previousCard`. The new SQL still goes
  through `assertReadOnly` and runs read-only. There are no new events, and a
  refine emits the same event sequence as an ask.
- **Chains in the renderer.** `ask-reducer.ts` keeps `turns`, `position`,
  `chainId` and `transition`. A refine at an earlier turn drops the later
  turns. While a refine runs, the shown turn stays on screen. When a refine
  fails or is stopped, the shown turn is restored. A chain holds at most 6
  turns. The selectors `shownTurn`, `canRefine`, `atTurnLimit`,
  `refineContextOf` and `chainPromptOf` are covered by tests. 008's ⌘K
  actions, saving and export all read the shown turn.
- **Keys.**
  - ↵: refine.
  - ⌘↵: new question.
  - ↑/↓ on an empty input: step through turns.
  - Esc while working: stop and restore. Otherwise Esc pops to root. Refines
    never add stack entries, and ↑ on root reopens the chain at the shown
    turn.
  - ⌘D: drill list.
  - "as a table" and similar phrases (`lib/view-switch.ts`): switch the view
    with no ask.
- **Assumptions.** The new bun request `describeSql` calls
  `describeSqlAssumptions` (core, polyglot, main entry only) and returns
  tables, time column and grain, filters (including one CTE's) and the row
  cap. The renderer requests it from the `onAskEvent` handler on `sqlDone`.
  Chips pre-fill the input and select the word to edit. They never run.
- **Drill-down.** `DrillProvider` is mounted only by `AskView`. It covers
  bars (series and x), line and area points (x), pie slices, and table rows
  (click or ↵). The ⌘D list shows at most 50 segments. "Other", null and blank
  values are skipped, and values that PII redaction would change are not
  drillable ("Hidden by PII redaction").
- **Recents.** `pushRecentAsk` also replaces a record with the same `id`. A
  chain's recent uses `id = chainId` and `prompt = chainPrompt`, so History
  (011) keeps one entry per chain. `RecentAsk` is unchanged.
- **Raw SQL decision.** `>` still re-runs SQL. Plain text after a raw-SQL or
  match answer starts a new question, because there is no model context to
  refine. For these answers, assumptions show but their chips are inert, and
  drill is off.

## Adaptations from the plan

- **`RefineContext` location.** The zod schema, `MAX_ASK_TURNS` and
  `chainPrompt` live in a new `packages/rpc/src/refine.ts`, so `ask.ts` only
  gains `refine?` on `AskParams`.
- **Assumption types.** `SqlAssumption`/`SqlAssumptions`/`TimeGrain` are
  defined in core, because core cannot import rpc. They are re-exported from
  `rpc/assumptions.ts`.
- **`base` is derived, not stored.** A refine cuts `turns` after `position`,
  so `turns[position]` is the base. `isRefining(state)` means working with
  turns.
- **Restore transition.** The root's reopen dispatches `restore`. The card
  intro maps restore to skip, fresh to play, and refine or step to update.
- **Header metadata.** It reads `Writing SQL · n lines` → `Running · read only`
  → `Shaping · n rows` → `n rows · ms`. The plan has no "Shaping" step; it was
  added for the presenting phase.
- **Footer.** A refinable answer shows `Refine ↩`, `⌘↩ New question`,
  `↑↓ Steps` (with 2 or more turns), `⌘K Actions` and `⌘S Save`. Copy SQL and
  SQL toggle are left out for width. ⌘C and ⌘E still work, and both actions
  are in ⌘K.
- **Placeholder.** The ask view draws its placeholder in an overlay
  (`RefineOverlay`, `SwapText`) and sets `aria-placeholder` instead of the
  native placeholder, so it can swap at the turn limit.
- **Drill list.** It reuses `ActionMenuItem`, whose highlight `layoutId` is
  the shared `launcher-action-highlight`, not `drill-selection`. It opens
  under the card header at the right edge.
- **PII tooltip.** Redacted segments show "Hidden by PII redaction" on table
  rows (title) and as disabled ⌘D items. A redacted chart mark is simply not
  clickable, with no tooltip on the SVG.
- **Stub fixture sync.** The plan asked for a fixture shared with the core
  test. Instead, `lib/browser-refine-stub.test.ts` checks every recorded stub
  assumption against the real `describeSqlAssumptions`, and the core test keeps
  its own per-dialect fixtures.
- **↵ during a refine is ignored.** The text stays in the input. ↵ during a
  first ask still starts a new one, as before.
- **Line budgets.** `ask-view.tsx` is 242 lines (cap 244) and
  `launcher-panel.tsx` is unchanged at 266. The logic moved to
  `use-refine-input.ts`, `use-ask-drill.ts`, `ask-answer-view.tsx`,
  `askOverlayHeight` and `chainHintOf`.
- **Shared code.** `ProgressHairline` moved to
  `components/motion/progress-hairline.tsx` (now with a fade in and out) and
  is used by both the widget run and the ask view. The recorded answers moved
  to `lib/browser-ask-recordings.ts`, re-exported from `browser-ask-stub.ts`.
  The polyglot dialect map moved to `core/polyglot-dialect.ts`, the single
  owner for transpile and assumptions.

## Evidence

| Check                                                               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check-types`, `bun run check`                              | PASS (0 errors, format clean)                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `packages/core` tests                                               | PASS: 387. Includes `sql-assumptions` for all 6 dialect fixtures (postgresql, mysql, sqlite, tsql, clickhouse, duckdb), the CTE filter, skipped join predicates, the date-range fallback, clipping, the cap of 8, and null for unparsable, non-SELECT and multi-statement SQL. Also covers `widgets` same-id replacement. One run hit a flake in the untouched `persistence.test.ts` ("migrates plaintext history lines"); it passed 3 of 3 reruns.     |
| `packages/agent` tests                                              | PASS: 195. A refine sends system, user, assistant (previous SQL) and user messages, with the same event sequence as an ask. A table named only in the previous SQL stays in the schema excerpt. A write is still `NOT_READ_ONLY` with no `execute`. Repairs keep the context. The present payload has `previousCard`. With no refine, the messages are unchanged.                                                                                       |
| `packages/rpc` tests                                                | PASS: 70. Covers `chainPrompt` and `RefineContext` bounds.                                                                                                                                                                                                                                                                                                                                                                                              |
| bun `ask-service.test.ts`                                           | PASS. A refine with too many turns, SQL over 20,000 chars or an invalid spec is rejected at the edge. The model receives the context. The recent uses `chainId` and the chain prompt.                                                                                                                                                                                                                                                                   |
| `bun run --cwd apps/app test`                                       | PASS: 1280 of 1280 (143 files)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `bun run --cwd apps/app test:coverage`                              | PASS: 95.72% lines. New files are 90–100%.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `bun run --cwd apps/app e2e`                                        | PASS: 21 of 21, including the new `refine-flow.spec.ts`. It checks a refine in place (the same `section` keeps a probe attribute while the title changes), 2 crumbs, `refine.turns.length === 1`, ↑ to turn 1, a chip pre-fill with no ask, a bar click pre-filling `break down region …`, "as a table" with no ask, and ⌘S saving the chain prompt and the refined SQL. No dev server was running on :3001, so Playwright started and stopped its own. |
| Protected contracts                                                 | `AskEvent` union, `card-spec.ts`, `widget.ts` (`Widget`, `RecentAsk`) and `board.ts` were not edited. `CARD_SPEC_VERSION` is still 1.                                                                                                                                                                                                                                                                                                                   |
| Desktop run with `cua-driver`                                       | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Recordings at 1× and 0.25×                                          | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Timelines trace (60 fps, 2,000 rows)                                | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Reduce Motion, Reduce Transparency, Increase Contrast on a real Mac | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| WCAG contrast of chips on the panel                                 | NOT RUN (owner). Chips use the existing `text-foreground` and `text-panel-muted` tokens.                                                                                                                                                                                                                                                                                                                                                                |
| STOP check: real model, 5 scripted chains on the fixture Postgres   | NOT RUN. Needs the owner's AI key and database.                                                                                                                                                                                                                                                                                                                                                                                                         |

## Motion table status

Every row is implemented with its token and a reduced-motion path. Each row
has a browser test that runs the full branch and the reduced branch.

| Moment                         | Implementation                                                                                                                                                                                                                                                                               | Tests                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Follow-up lifts into the trail | A ghost `motion.span` in `RefineOverlay` shares `layoutId="ask-turn-{n}"` with the new crumb (`SPRING`, `layoutCrossfade={false}`). Reduced: no ghost and no `layoutId`.                                                                                                                     | `refine-overlay`, `question-trail`          |
| Current-turn thumb             | `layoutId="ask-turn-current"` with `SPRING_SNAPPY`. Reduced: static.                                                                                                                                                                                                                         | `question-trail`                            |
| Card goes stale                | Opacity 0.6 with `FADE_IN`, and `ProgressHairline` (the only loop) fades in and out. Reduced: the dim stays and the hairline is static.                                                                                                                                                      | `ask-view-refine-states`, `ask-view-refine` |
| Header metadata                | Positional `SwapText` segments.                                                                                                                                                                                                                                                              | `ask-labels`, `ask-view-refine-states`      |
| SQL while refining             | The previous SQL stays at 40% (`stopped`) until the first token, then crossfades (`FADE_OUT`/`FADE_IN`). Collapsed SQL stays collapsed.                                                                                                                                                      | `ask-view-refine-states`                    |
| Card morph, same view          | The same `section` survives (one body key for card, refining and refine-error). `intro="update"` gives the Recharts 300ms transition. Title and subtitle use `SwapText`. Legend items are keyed by label with `layout` (`SPRING`) and fade in or out. Reduced: no layout and `REDUCED_FADE`. | `ask-view-refine` (same node), `ask-card`   |
| Card morph, new view           | The existing keyed `AnimatePresence`, segmented thumb and height morph.                                                                                                                                                                                                                      | existing `ask-card`                         |
| Insight                        | Keyed `AnimatePresence`; the old insight fades out with `FADE_OUT`, and the new one `Reveal`s 300ms + 120ms after an update. Reduced: no delay.                                                                                                                                              | `ask-card`, `ask-view-refine`               |
| Changed SQL lines              | A 2px amber mark per changed line (`scaleY` 0→1, origin top, `staggerDelay`), from `lib/sql-diff.ts`. Reduced: static.                                                                                                                                                                       | `sql-block`                                 |
| Assumptions line               | Chips appear with `FADE_IN` and a stagger. Reduced: opacity only.                                                                                                                                                                                                                            | `assumptions-line`                          |
| Assumptions update             | Keyed by kind (time, limit, tables) or filter text, with `layout` (`SPRING`), entry and exit fades, `SwapText`, and one amber pulse (0.14→0 over 900ms). Reduced: no pulse.                                                                                                                  | `assumptions-line`                          |
| Chip and drill press           | Chips use `Pressable` (`PRESS`, opacity under reduced motion). SVG marks use CSS `:active` at 0.85 opacity. Focus moves to the input with the edit range selected.                                                                                                                           | `assumptions-line`, `ask-view-refine`       |
| Drill hover                    | Other bars and slices drop to 0.5 `fill-opacity`, with a pointer cursor. The same in reduced motion (opacity only).                                                                                                                                                                          | `card-drill`                                |
| Drill list                     | Scale 0.96→1 plus a fade (`SPRING_SNAPPY`, `FADE_OUT` on exit). Reduced: crossfade.                                                                                                                                                                                                          | `drill-list`                                |
| Step through turns             | Same as the card morph, plus the SQL crossfade and the assumptions update.                                                                                                                                                                                                                   | `ask-view-refine`                           |
| Refine error                   | The hairline fades, the card returns to 1, and `AskError` `Reveal`s above it. No shake.                                                                                                                                                                                                      | `ask-view-refine-states`                    |
| Refine cancelled               | The hairline fades, the shown turn returns, and the pending crumb fades out.                                                                                                                                                                                                                 | `ask-view-refine`, `question-trail`         |
| Turn limit                     | The placeholder `SwapText`s to "Start a new question with ⌘↵", and the action label and footer swap.                                                                                                                                                                                         | `ask-view-refine-states`                    |

Live regions: "Updated: {title}", "Step n of total: {prompt}" and "Ready to
refine: {text}" go through one polite `sr-only` region, so they are announced
once per settled change and never per frame.
