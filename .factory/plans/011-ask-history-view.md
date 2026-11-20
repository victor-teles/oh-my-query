# Plan 011: Search every past ask in a History view

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages/core/src packages/rpc/src apps/app/src`
> and `git status --short`. Plans 001–007 sit uncommitted in the working tree
> and are the baseline. Confirm: `packages/core/src/widgets.ts` exports
> `MAX_RECENT_ASKS = 30` and `createRecentAskStore`; `RpcSchema.requests.listRecentAsks`
> takes `Record<string, never>`; `components/launcher/views/root-items.ts`
> has `RECENTS_SHOWN = 5`. If plan 008 landed, reuse its `ResultAction` copy
> helpers; if plan 009 landed and added a no-AI "run SQL read-only" request,
> see Step 5's optional action.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19, on `feat/launcher-002-shell`
  with plans 001–007 implemented but uncommitted (the working tree is the
  baseline)

## Why this matters

The launcher root shows the last 5 asks, and storage keeps only 30. The
question you asked last Tuesday ("signups by plan, EU only") is gone, so you
pay for the model again and hope it writes the same SQL. A searchable History
view keeps a longer record (prompt, SQL, card spec — never result rows), finds
it by any word, and lets you ask again, copy the SQL or save it as a widget
without retyping. It also gives a visible place to remove or clear history,
which matters because prompts and SQL can contain customer identifiers.

## Current state

- **Storage** — `packages/core/src/widgets.ts`:
  ```ts
  export const MAX_RECENT_ASKS = 30; // :8
  export const createRecentAskStore = (parse) => {
    // :37
    const store = createRecordStore(recentAsksPath, parse);
    return {
      listRecentAsks: store.list,
      async pushRecentAsk(ask) {
        await updateRecords(recentAsksPath(), (records) =>
          [ask, ...records.filter((record) => !sameAsk(ask, record))].slice(
            0,
            MAX_RECENT_ASKS
          )
        );
      },
    };
  };
  ```
  `sameAsk` deduplicates by connection + case-insensitive trimmed prompt, so a
  repeated question moves to the top instead of duplicating. The file is
  `~/.config/oh-my-query/recent-asks.enc` (`paths.ts:46`), one encrypted JSON
  array rewritten atomically under a lock (`records.ts`). The generic store
  already has `remove(id)` (`records.ts:113`) but the recent store does not
  expose it.
- **Record shape** — `packages/rpc/src/widget.ts:272-282`:
  `RecentAsk { id, askedAt, connectionId, database, dialect, prompt, spec: CardSpec, sql }`.
  No result rows are stored; keep it that way. `RecentAsk` is not one of the
  protected contracts, but this plan does not change its shape.
- **Writes** — `apps/app/src/bun/ask-service.ts:162-168` calls
  `deps.rememberAsk(ask)` when an ask completes with a card; failures are logged,
  never surfaced.
- **Service** — `apps/app/src/bun/widget-service.ts:283`
  `listRecentAsks: () => deps.recents.listRecentAsks()`; RPC handler at
  `apps/app/src/bun/rpc.ts:259`.
- **Renderer** — `components/widgets/widgets-provider.tsx` loads widgets and
  recents together in `refresh()` (`:46-59`). `RootView` calls `refresh()` on
  every mount (`views/root-view.tsx:108-110`), i.e. every return to root, so the
  full recents payload crosses RPC each time. `root-items.ts:52-62` shows the
  first `RECENTS_SHOWN = 5` only when the query is empty. ↵ on a recent re-asks
  with the stored prompt and connection (`root-view.tsx:184-188`) — that calls
  the AI. Row UI: `components/widgets/recent-row.tsx`.
- **Search** — `lib/fuzzy-match.ts` `fuzzyMatch(candidate, query) → { score, matches } | null`;
  usage pattern in `components/widgets/widget-search.ts`.
- **A searchable list view to copy** — `components/launcher/views/board-picker-view.tsx`
  (input + `LauncherListbox`/`LauncherSection`/`LauncherRow` + `useListSelection`
  - footer). New screens are `LauncherView` variants in
    `components/launcher/use-launcher-stack.ts`, rendered by `renderView` in
    `launcher-panel.tsx:61-127`.
- **Menus** — `components/launcher/actions/actions-menu.tsx` (`ActionsMenu`,
  `actionsMenuHeight`) with the list+hook pattern of
  `views/catalog-actions.ts` / `views/use-catalog-menu.ts`; two-step confirm via
  `hooks/use-armed-confirm.ts` (`CONFIRM_WINDOW_MS = 3000`, label
  `DELETE_CONFIRM_LABEL`).
- **Saving** — `components/widgets/widget-draft.ts` `draftFromAsk(ask, name)`
  and `components/widgets/name-field.tsx` (inline name field);
  `useWidgets().save` / `markFresh`.
- **Browser stub** — `lib/browser-widget-stub.ts:181` `listRecentAsks`,
  `:198-219` `rememberAsk` (`MAX_RECENTS`).

## Commands you will need

| Purpose      | Command                                                   | Expected                 |
| ------------ | --------------------------------------------------------- | ------------------------ |
| Core tests   | `bun run --cwd packages/core test`                        | pass                     |
| App tests    | `bun run --cwd apps/app test`                             | all pass (both projects) |
| One file     | `bun run --cwd apps/app test:browser <path>`              | pass                     |
| Types / lint | `bun run check-types`, `bun run check`                    | exit 0                   |
| e2e          | `bun run --cwd apps/app e2e`                              | all pass                 |
| Desktop      | `bun run --cwd apps/app desktop:dev` + `cua-driver` skill | manual checks below      |

## Implementation rules relevant to this plan

- Strict TS, no `any`/unsafe casts; zod-validate every new RPC param in bun
  (`limit` 1–500 int, `askId` 1–100 chars).
- React 19: ref as a prop, ≤ ~150-line components, one per file, ≤ ~6 props,
  hooks own logic, no derived state via effects (grouping and filtering are
  computed in render, memoized only if measured), hotkeys in a
  `useHistoryKeyboard` hook.
- No code comments unless the why is non-obvious.
- Colocated tests: pure logic in `*.test.ts`, components/hooks in
  `*.browser.test.tsx`; snapshots for loading, empty, no-matches, populated and
  error; 80% line coverage.
- History never stores or shows result rows. Asking again calls the AI and
  must look like it (footer "Ask again", same as root).
- Copy: "History", "Search past asks…", "No asks yet", "Nothing matches “…”",
  "Removed from history", "History cleared". No hype.

## Decisions taken in this plan

- **Retention: raise the cap from 30 to 200.** At ~2–3 KB per record (SQL +
  spec), 200 records are ~0.6 MB of JSON, which is fine to decrypt and rewrite
  once per completed ask. Beyond that the single-array file should become a
  log; that is out of scope. Deduplication by prompt + connection stays.
- **Root asks for 5, History asks for all.** `listRecentAsks` gains an optional
  `limit` so the root no longer ships 200 records on every return to root.
- **Entry points:** a root command "Search History" (keywords: history, recent,
  past, asks) and `⌘Y` from the root input.

## UI and motion (mandatory)

Use `apps/app/src/mainview/lib/motion.ts` and `components/motion/`. Tokens:
`SPRING` (push/pop, layout), `SPRING_SNAPPY` (selection, list filtering),
`SPRING_SOFT` (reveals), `FADE_IN` 160ms, `FADE_OUT` 110ms, `STAGGER` 30ms
capped at 6; `useMotionPreset()` for reduced motion. Respond on press,
everything interruptible, exit the way you entered, animate only
`transform`/`opacity`/`filter`, one primary motion per moment. A loading state
under 150ms is never shown; once shown, ≥ 300ms. Reduced transparency → opaque;
increased contrast → solid borders, promoted muted text; focus rings always
visible; live region announces result counts ("12 asks match"), never frames.

| Moment         | Trigger                      | What moves                                                                                                                        | Token                            | Reduced motion |
| -------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------- |
| Open History   | Command, `⌘Y`                | Existing stack push (view slides in, panel height morphs via `LauncherSurface`).                                                  | `SPRING`                         | Crossfade      |
| First rows     | Data arrives                 | Sections `Reveal`; first 6 rows stagger in once per open, never on re-filter.                                                     | `FADE_IN`, `STAGGER`             | Instant        |
| Loading        | Fetch > 150ms                | Three skeleton rows, shown ≥ 300ms.                                                                                               | `FADE_IN`                        | Static         |
| Filter         | Typing                       | Rows reorder/leave with `layout`; leaving rows fade; section headers collapse with their last row. No stagger.                    | `SPRING_SNAPPY`, `FADE_OUT`      | Instant        |
| Selection      | ↑/↓/hover                    | Existing `LauncherRow` highlight (`layoutId`).                                                                                    | `SPRING_SNAPPY`                  | Instant        |
| Actions menu   | `⌘K`                         | Existing `ActionsMenu` scale-from-row.                                                                                            | `SPRING_SNAPPY`                  | Opacity        |
| Remove one     | Menu → Remove from History   | Row fades, list closes the gap with `layout`; selection moves to the next row; footer `SwapText` "Removed from history".          | `FADE_OUT`, `SPRING`             | Instant        |
| Clear all      | Menu → Clear History (armed) | Armed label + draining hairline (existing). On confirm, rows fade out (reverse stagger, cap 6), then the empty state `Reveal`s.   | `FADE_OUT`, `STAGGER`, `FADE_IN` | Instant        |
| Save as Widget | Menu or `⌘S`                 | Inline `NameField` expands under the input via `layout`; on confirm it collapses and the footer `SwapText`s "Saved · in Widgets". | `SPRING_SOFT`                    | Instant        |

Designed states: loading (skeleton), empty ("No asks yet. Ask a question from
the launcher and it shows up here."), no matches ("Nothing matches “…”"),
populated (grouped), error ("History couldn't load." + Retry), a row whose
connection was deleted (muted "connection removed").

## Scope

**In scope**

- `packages/core/src/widgets.ts` + `widgets.test.ts`: cap 200,
  `removeRecentAsk(id)`, `clearRecentAsks()`, `listRecentAsks(limit?)`.
- `packages/rpc/src/schema.ts`: `listRecentAsks` params `{ limit?: number }`;
  add `deleteRecentAsk: { params: { askId: string }; response: void }` and
  `clearRecentAsks: { params: Record<string, never>; response: void }`.
- `apps/app/src/bun/widget-service.ts` + test, `apps/app/src/bun/rpc.ts`.
- `apps/app/src/mainview/lib/ipc.ts`, `lib/browser-widget-stub.ts` (+ test),
  `lib/browser-ipc-stub.ts` if routing needs it, `test/launcher-ipc.tsx`.
- `apps/app/src/mainview/components/history/` (create): `history-view.tsx`,
  `history-list.tsx`, `history-row.tsx`, `history-search.ts` (+ `.test.ts`),
  `history-actions.ts` (+ `.test.ts`), `use-history.ts`, `use-history-menu.ts`,
  `use-history-keyboard.ts`, `history-view.browser.test.tsx`,
  `__snapshots__/`.
- `components/launcher/use-launcher-stack.ts` (+ test), `launcher-panel.tsx`,
  `root-commands.ts` (+ test), `views/use-root-keyboard.ts`,
  `views/root-view.tsx`, `components/widgets/widgets-provider.tsx`.
- `apps/app/e2e/history-flow.spec.ts` (create).

**Out of scope**

- Storing result rows or thumbnails of past answers.
- A per-ask "pin" or rename, folders, or sync.
- Changing `RecentAsk`'s shape, dedupe rules, or moving to an append-only log.
- A "keep history" setting (Clear History covers privacy for now).
- Running stored SQL without the AI, unless plan 009's request already exists
  (Step 5).

## Git workflow

- Branch `feat/launcher-011-history`. Commit only if authorized; do not push or
  open a PR unless told to.

## Steps

### Step 1: Store and RPC

- `widgets.ts`: `MAX_RECENT_ASKS = 200`. `listRecentAsks(limit?: number)`
  returns `store.list()` sliced to `limit` (records are already newest-first
  because `pushRecentAsk` prepends). Add `removeRecentAsk: store.remove` and
  `clearRecentAsks: () => updateRecords(recentAsksPath(), () => [])`.
- `widget-service.ts`: `listRecentAsks(request)` validates
  `z.object({ limit: z.number().int().min(1).max(500).optional() })`;
  `deleteRecentAsk({ askId })` and `clearRecentAsks()` delegate. Update the
  `RecentAskStore` type.
- `rpc.ts` handlers; `lib/ipc.ts` wrappers `listRecentAsks(limit?)`,
  `deleteRecentAsk(askId)`, `clearRecentAsks()`; browser stub equivalents over
  `localStorage` (raise its `MAX_RECENTS` to 200 to match).
- `widgets-provider.tsx` `refresh()` requests `listRecentAsks(RECENTS_SHOWN)`
  (import the constant from `root-items.ts` or move it next to the provider).

Tests: `widgets.test.ts` — cap is 200 (update the existing
"keeps only the last N" case), `limit` slices newest-first, remove one,
clear all, a corrupt file still quarantines (existing). `widget-service.test.ts`
— invalid `limit` rejected, delete/clear delegate.

### Step 2: Search and grouping (pure)

`components/history/history-search.ts`:

```ts
export interface HistoryEntry { ask: RecentAsk; connectionName: string | null }
export interface HistorySection { id: string; label: string; entries: HistoryMatch[] }
export interface HistoryMatch { entry: HistoryEntry; promptMatches: number[] }
export const historySections = (
  entries: readonly HistoryEntry[], query: string, now: Date
): HistorySection[]
```

- Empty query: group by the local calendar day of `askedAt`: "Today",
  "Yesterday", weekday name within the last 7 days, then "Month YYYY". Keep
  newest-first within a group.
- With a query: one section "Matches", ranked by the best `fuzzyMatch` score
  over prompt, `spec.title`, connection name and the SQL's table-ish words
  (score the SQL with a 0.5 weight so prompt hits win); ties → newer first.
  Return `promptMatches` (indices) so the row can emphasise matched characters.

Tests: day boundaries with an injected `now` (just after midnight, across a
month and a year, a DST change), weekday labels, ranking (prompt beats SQL,
recency breaks ties), empty input, no matches.

### Step 3: The view

- `LauncherView` gains `{ kind: "history" }`; `renderView` renders
  `<HistoryView onAsk={rootAsk.start} onBack={handleBack} onSaved={…} />` (pass
  what it needs as callbacks; `launcher-panel.tsx` already owns
  `useLauncherAsk`).
- `use-history.ts` loads `listRecentAsks()` (no limit) on mount with
  `status: "loading" | "ready" | "error"`, and exposes `remove(id)`,
  `clear()`, `retry()`. After a mutation it also calls `useWidgets().refresh()`
  so the root's Recent section stays truthful.
- `history-view.tsx`: `LauncherInput` (placeholder "Search past asks…",
  `role="combobox"`, `aria-controls` the list), the list, the menu, and
  `LauncherFooter` with action label "Ask again" (or "Ask on {active}" when the
  stored connection no longer exists) and hints `⌘K Actions`, `⌘C Copy SQL`.
  Keep each file under ~150 lines: `history-list.tsx` renders sections and
  states; `history-row.tsx` renders one row (history icon, prompt with matched
  characters in `font-medium text-foreground`, meta "connection · card title ·
  14:05" or "3 Nov").
- Keyboard (`use-history-keyboard.ts`): ↑/↓ and ⌃N/⌃P move, ↵ asks again,
  `⌘K` toggles the menu, `⌘C` copies SQL when nothing is selected in the
  input, `⌘S` starts Save as Widget, `⌃X` removes the selected ask (same as the
  menu, no confirm — it is one record and the footer confirms; not `⌘⌫`,
  which deletes to line start in the focused search field), Esc pops (the
  global handler already pops when depth > 1).
- Ask again: if the stored connection exists, start with
  `{ connectionId, database }`; otherwise use the active connection; with no
  connection at all, disable ↵ and show "Add a connection to ask again".

### Step 4: Root entry points

- `root-commands.ts`: add "Search History" (`HistoryIcon`, action label
  "Open", subtitle "Every question you've asked", keywords `history`, `recent`,
  `past`, `asks`, shortcut `["⌘","Y"]`). Update `root-commands.test.ts`.
- `use-root-keyboard.ts`: `⌘Y` → `onOpenHistory()`. `root-view.tsx` and
  `RootNavigation` gain `openHistory`; `launcher-panel.tsx` pushes
  `{ kind: "history" }`.

### Step 5: Actions menu

`history-actions.ts` (pure, like `catalog-actions.ts`):
`historyActions({ hasConnection })` →
Ask Again (`↵`), Copy SQL (`⌘C`), Copy Prompt, Save as Widget… (`⌘S`),
Remove from History (`⌃X`, destructive), Clear History… (destructive, armed
two-step via `useArmedConfirm`). If plan 008 landed, show `keys` on items via
its `MenuAction.keys`.

Save as Widget builds a draft with `draftFromAsk({ connectionId, dialect,
prompt, sql, spec, view: viewKindOf(spec.view) }, name)` and sets `database`
from the record, then `useWidgets().save` and `markFresh`. The bun
`saveWidget` path re-runs the read-only guard, so a stored statement that fails
it shows the existing error message in the footer.

Optional, only if plan 009 has landed with a guarded no-AI SQL run request:
add "Run SQL (no AI)" that pushes 009's raw-SQL result view with the stored SQL
and connection. Otherwise leave it out and note it for later.

## Test plan

- Core and service tests in Step 1; `history-search.test.ts` and
  `history-actions.test.ts` (unit project).
- `history-view.browser.test.tsx` (model after
  `components/launcher/views/board-picker-view.browser.test.tsx`, IPC through
  `mockIpc`):
  - loading → populated with "Today"/"Yesterday" groups (injected clock via the
    hook's `now` option or a fixed fixture date);
  - typing filters to "Matches" and highlights matched characters; no-match state;
  - ↵ calls `onAsk` with the stored connection; deleted connection falls back to
    the active one and the footer says so;
  - `⌘C` copies SQL; `⌘S` → name → `saveWidget` called with the stored SQL;
  - Remove from History calls `deleteRecentAsk`, row leaves, selection moves;
  - Clear History needs two presses within the window and calls `clearRecentAsks`;
  - error state with Retry;
  - both motion branches for row removal and first-reveal stagger;
  - snapshots: loading, empty, no matches, populated, error.
- Root: `root-view.browser.test.tsx` — `⌘Y` opens history; the provider asks for
  5 recents (assert the `limit` passed).
- e2e `history-flow.spec.ts` (browser stub): ask three questions, open History
  with `⌘Y`, type a word from the second, ↵, and see the ask view start; then
  remove one and confirm the root Recent section no longer lists it.
- Verification: `bun run --cwd packages/core test` and
  `bun run --cwd apps/app test` → all pass.

## Done criteria

- [ ] `bun run check-types`, `bun run check`, core tests, app tests (both
      projects) and e2e pass; coverage ≥ 80%.
- [ ] `rg -n "MAX_RECENT_ASKS = 200" packages/core/src/widgets.ts` matches, and
      the root fetch passes `limit: 5`.
- [ ] Desktop dev: after 40+ asks (or a seeded `recent-asks.enc` from a script
      using `createRecentAskStore`), History lists all of them grouped by day,
      search finds one by a word that appears only in its SQL, and quit +
      relaunch keeps them.
- [ ] Desktop dev: Clear History empties the view and the root Recent section;
      `recent-asks.enc` decrypts to `[]`.
- [ ] Every row of the motion table is implemented with its token and its
      reduced-motion fallback, with a browser test per branch; recordings at 1×
      and 0.25× (`?slowmo=4`) attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of open History → type to filter
      → remove a row → clear all shows no frame over 16.7ms with 200 entries,
      and only `transform`/`opacity`/`filter` animate.
- [ ] Reduce Motion, Reduce Transparency and Increase Contrast verified; the
      designed states are snapshotted.
- [ ] `git status` shows changes only in the in-scope files.

## STOP conditions

- Filtering 200 entries drops frames in the Timelines capture even with
  memoized search. Report the measurement; do not lower the cap or remove the
  filter motion without the owner's approval.
- Any need to store result rows or a rendered card to make History useful.
  That changes the privacy promise; stop and ask.
- Plan 018 or 019 has changed `recent-asks.enc` or `RecentAsk` in the meantime
  (e.g. to record non-SQL sources). Reconcile with that plan's migration before
  continuing.

## Maintenance notes

- At 200 records the single encrypted array is rewritten on every completed
  ask. If the cap ever rises again, move recents to an append-only encrypted log
  with compaction.
- Plan 012 (refine) produces follow-up asks; decide there whether a refinement
  is its own History entry (recommended: yes, prompt shows the refinement).
- Plan 013 (Mongo/Redis asks) will need `RecentAsk.sql` to hold a non-SQL query;
  the search code treats it as text and needs no change.
- Deferred: "Run SQL (no AI)" when plan 009's request exists; a detail pane
  showing the SQL of the selected entry.
