# Validation: plan 014, watch widgets in the background

Date: 2026-11-20. Worktree on `05d0542` (`feat/launcher-002-shell` content),
uncommitted. Verdict: **partially verified**. Every automated check passes and
the desktop app boots with the scheduler running. The desktop behaviors only a
person can judge (tray title, notifications, sleep/wake, battery, recordings,
Timelines trace, accessibility toggles) have not been run.

## What was built

- **Contracts (rpc).** `watch.ts`: `Watch`, `WatchDraft`, `WatchCondition`,
  `AlertState`, `RunSample`, `RunLogEntry`, `WidgetTrend`, `WatchStatus`,
  `WATCH_INTERVALS`/`WATCH_INTERVAL_MS`, `MAX_WATCHES`, `MAX_SAMPLES`, plus
  shared copy helpers (`alertLabel`, `formatThreshold`, `timeAgo`,
  `intervalPhrase`, `hasUnseenAlert`, `trendOfEntry`). `card-format.ts`: the
  moved formatter (`toNumber`, `columnValues`, `formatFor`, `formatContextFor`,
  `formatValue`, `formatTick`, `FormatContext`, `CardResult`) plus `scalarOf`,
  `formatScalar`, `formatScalarValue`. Eight requests and two messages
  (`watchesChanged`, `widgetSampled`) in `RpcSchema`; `LauncherNavigateView`
  gains `"watches"`; `WidgetRunResult` gains optional `trend`.
- **Stores (core).** `createWatchStore` (`watches.enc`) and
  `createRunLogStore` (`widget-runs.enc`, newest 30 samples per entry, at most
  8 entries per widget, LRU by latest sample), both on `createRecordStore`.
  `AppConfig.watchingPaused`.
- **Widget service.** One `execute` path (open connection → resolve → guard →
  compile → read-only run). `runWidget` keeps its contract, appends a sample
  and returns `trend`. `runDetached(widgetId, values, signal)` drops stale
  input names, never falls back to `lastValues`, never calls `updateWidget`,
  and returns `{ widget, result, compiledSql, values, valuesKey, sample,
previous }`. A run-log failure is logged and never fails a run.
- **Policy, scheduler, service.** `watch-policy.ts` (pure: battery floor,
  due/backoff, alert hysteresis + 60-minute cooldown, message copy).
  `widget-scheduler.ts` (one timer clamped 5–60 s, 2 global / 1 per
  connection, wake detection with 20 s grace and 2 s spacing, terminal
  `WIDGET_NOT_FOUND`/`CONNECTION_MISSING` never retried until something
  changes, status changes throttled to 1/s). `watch-service.ts` (CRUD with KPI
  rules, one menu-bar KPI, alert evaluation, failure notice after 3, tray
  status). `alert-notifier.ts` (3 per rolling 10 minutes, overflow coalesced).
  `tray-status.ts` (pure title/menu builders, zod-parsed clicks).
  `power-native.ts` (IOKit `IOPSGetTimeRemainingEstimate`).
- **Wiring.** `rpc.ts` builds everything and returns `background.start/stop/
acknowledge`; `index.ts` starts it after the launcher and stops it on
  `beforeQuit` (no core import). `launcher.ts` gains `setTrayStatus` (diffs
  title and menu before native calls) and routes `watch:open` / `watch:list`.
  Disconnect pauses a connection; connect, widget runs, asks and raw SQL
  resume it.
- **Renderer.** `components/watches/`: `WatchesProvider`, watch view (interval,
  menu bar, alert + threshold preview, inputs snapshot, production note,
  `⌘↵` save, `⌘⌫` armed stop), watches view (Pause all, status rows, ↵ / ⌫),
  `WidgetTrend` + `Sparkline`, alert rows. Root gains an **Alerts** section
  (↵ opens + acknowledges, ⌫ in an empty input dismisses), widget rows show a
  watch glyph and trend, ⌘K on widgets and in the run view gains
  Watch…/Edit Watch… and, for KPIs, Show in/Remove from Menu Bar. Board tiles
  show the trend from the run outcome. Settings gains Background → Watching.
  `browser-watch-stub.ts` emulates watches with a deterministic falling KPI
  series.

## Adaptations from the plan

- **`trend` is optional** on `WidgetRunResult` (`trend?: WidgetTrend | null`),
  as the plan allows, so existing producers stay valid.
- **`runLogEntryId` lives in core** (`${widgetId}:${valuesKey}`), the store
  that owns the id. `createRunLogStore(parse, limits)` takes the limits from
  rpc's `MAX_SAMPLES` / `MAX_RUN_LOG_ENTRIES_PER_WIDGET`, because core cannot
  import rpc.
- **`run-samples.ts`** (bun) owns `valuesKeyOf`, `rowsDigest`, `sampleOf`.
- **Due times read the watch's own key.** `lastSampleFor(widgetId, values)`
  computes the key from the snapshot (stale names dropped, defaults filled,
  same as `runDetached`), so a foreground run with the same inputs postpones
  the background run.
- **One watch per widget.** Saving a second watch for a widget updates the
  first. Changing the alert condition resets `alertState`.
- **`hasRows` / `changed` re-arming.** `changed` re-arms on the next
  evaluation; threshold and `hasRows` re-arm after two false evaluations.
- **Tray refresh.** Besides status changes, the tray is refreshed once a
  minute so "2m ago" and the 3× staleness rule stay true with no runs.
- **`WatchStatus.display` and `lastRunAt`** are derived from the run log, so
  they survive restarts. The failure line in rows reads
  "Couldn't refresh since 9:41" (the last good sample), because `WatchStatus`
  has no failure timestamp.
- **Copy helpers in rpc** (`alertLabel`, `timeAgo`) are shared by the tray
  and the root Alerts section.
- **Small moves.** `FreshPulse` → `components/motion/fresh-pulse.tsx` (second
  caller: alert rows). `useNow` → `hooks/use-now.ts` (second caller).
  `launcher-config.ts` gains `readWatchingPaused`/`writeWatchingPaused`.
  `WidgetRow` takes `events` and `watching` objects to stay at 6 props.
- **`reopen` routing** keeps today's `show()`; Step 1 (what a notification
  click does) is an owner check.

## Evidence

| Check                                                                                  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check-types`                                                                  | PASS (14 tasks)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `bun run check`                                                                        | PASS (format clean, 0 lint errors)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `packages/rpc` tests                                                                   | PASS: 98 (9 files). `card-format.test.ts` (moved cases + `scalarOf`, `formatScalar`), `watch.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `packages/core` tests                                                                  | PASS: 396 (20 files). `watches.test.ts`: CRUD, encryption, quarantine, 30-sample cap, 8-entry LRU, `removeForWidget`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| bun unit tests                                                                         | PASS: `watch-policy` (23), `widget-scheduler` (12, fake timers: due runs, 2 global / 1 per connection, battery floor, wake grace and spacing with no replay, disconnected connection, global and per-watch pause, missing widget, terminal connection error, backoff, `stop()` aborts and reports nothing, 1/s throttle), `watch-service` (9), `alert-notifier` (5), `tray-status` (10), `run-samples` (4), `widget-service` additions (detached run leaves `lastRunAt`/`lastValues` untouched, stray names dropped vs rejected, preset `valuesKey`, failing run appends nothing, run-log failure still returns). |
| `bun run --cwd apps/app test`                                                          | PASS: 1412 of 1412 (159 files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `bun run --cwd apps/app test:coverage`                                                 | PASS: 95.62% lines overall; `components/watches` 97.07% lines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `bun run --cwd apps/app e2e`                                                           | PASS: 22 of 22, including `watch-flow.spec.ts` (⌘K → Watch…, Below $50k, ⌘↵, bell glyph, `saveWatch` in `__omqIpcLog`, the stub sample fires the alert, Alerts row ↵ opens the widget and logs `acknowledgeAlert`, no console errors). Run under the shared lock; Playwright started and stopped its own server on :3001.                                                                                                                                                                                                                                                                                         |
| Contracts                                                                              | `git diff -- packages/rpc/src/widget.ts`: only the `WidgetTrend` type import and `trend?` on `WidgetRunResult`. `Widget`, `Board`, `CardSpec`, `AskEvent` unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| No AI in the scheduler                                                                 | `runDetached` test asserts `loadModel` is never called; the scheduler's ports have no model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `@oh-my-query/core` in `index.ts`                                                      | Only the existing warning comment matches; no import.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Desktop boot smoke (`desktop:dev`)                                                     | PASS: app launched, tray created, global shortcut registered, `[rpc] renderer ready`, no `[watch]`/`[power]` errors. Processes stopped afterwards.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| IOKit power probe                                                                      | PASS on this Mac on AC (`createPowerProbe()()` → `"ac"`). Battery reading NOT RUN.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Browser screenshots                                                                    | Watch view, saved state, root Alerts with trends, watches view, dark theme (dev-only captures, not committed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Step 1 spike (notification click, `setTitle` rendering)                                | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Tray title updates with no window, one notification per crossing, alert in tray + root | NOT RUN (owner, desktop)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Sleep ≥ 2 min, one run after grace                                                     | NOT RUN (owner); covered by the fake-timer test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Unplugged: 1m watch runs every 15 min                                                  | NOT RUN (owner); covered by tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Board open: no background run for its widget                                           | NOT RUN (owner); due times use the shared run log (tested).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Recordings 1× / 0.25×, Timelines trace                                                 | NOT RUN (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Reduce Motion / Transparency / Increase Contrast, WCAG on the panel                    | NOT RUN (owner). Reduced-motion branches are browser-tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Flakes seen: `history-view` "clears every ask only after a second press" and
the `widget-run-view` skeleton snapshot failed once each while a sibling or
Playwright ran in parallel; both pass alone and in the two quiet full runs.

## Motion table status

| Moment                      | Implementation                                                                                                                          | Tests                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Watch view push             | Existing stack push (`SPRING`, crossfade reduced).                                                                                      | `launcher-panel` (tray → watches → watch) |
| Interval / condition select | `SegmentedControl` pill `layoutId` (`SPRING_SNAPPY`, instant reduced).                                                                  | `watch-view`                              |
| Threshold field             | Row fades in/out (`FADE_IN`/`FADE_OUT`), rows below move with `layout="position"` (`SPRING_SOFT`); reduced: duration 0.                 | `watch-view` (both branches)              |
| Threshold preview           | `SwapText` of `formatThreshold`.                                                                                                        | `watch-view`                              |
| Saved                       | Footer `SwapText` → "Watching · every 5 min" with `CheckDraw`, pops after 700 ms; live region announces "Watching MRR every 5 minutes". | `watch-view`, e2e                         |
| Watched glyph               | Fades and scales 0.9→1 (`FADE_IN`/`FADE_OUT`), opacity only reduced.                                                                    | `root-view-watches`                       |
| Sparkline first appearance  | `pathLength` 0→1 (`DRAW`) once per series; static reduced.                                                                              | `widget-trend`                            |
| New sample                  | Group slides one step (`SPRING_SOFT`), last dot fades in, chip `SwapText`s; instant reduced.                                            | `widget-trend`                            |
| Alert row arrives           | Alerts section `Reveal`s when its content changed; one-shot amber pulse (0.14→0, 900 ms); no pulse reduced.                             | `root-view-watches` (both branches)       |
| Alert dismissed             | Row fades (`FADE_OUT`), list closes the gap via `layout` (`SPRING`).                                                                    | `root-view-watches`                       |
| Watches list rows           | Stagger in (`staggerDelay`, `FADE_IN`); instant reduced.                                                                                | `watches-view` (both branches)            |
| Status line (running)       | 2px `ProgressHairline` under the row (the only loop), status `SwapText`; static bar + "Running…" reduced.                               | `watches-view`                            |

## Owner-open checks

1. Step 1 spike in desktop dev: does clicking a notification activate the app
   or fire `reopen`? Does `tray.setTitle("$12.4k")` render beside the template
   icon in light and dark menu bars, and does `setTitle("")` remove it?
   (STOP condition if the title does not render.)
2. Pin a KPI: title shows and updates on its interval with no window open.
3. "Below" above the current value: exactly one notification, then none while
   it stays true; alert in the tray menu and root; opening acknowledges it.
4. Sleep ≥ 2 minutes with a 1m watch: one run after ~20 s (bun log
   `[watch] background run of widget …`), not a burst.
5. On battery: a 1m watch runs every 15 minutes.
6. Board open on a watched widget: no background run while the board
   refreshes it.
7. Recordings at 1× and `?slowmo=4`, Safari Timelines trace, accessibility
   toggles and WCAG AA contrast on the translucent panel.
