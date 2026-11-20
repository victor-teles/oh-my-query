# Plan 014: Watch widgets in the background: a menu-bar KPI, alerts, and change since the last run

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages/rpc/src packages/core/src apps/app/src apps/app/electrobun.config.ts apps/app/assets`
> and `git status --short`. Plans 001–007 sit uncommitted in the working tree
> and are the baseline. Confirm four things before starting:
> `apps/app/src/bun/widget-service.ts` exports `createWidgetService` with a
> `runWidget` that calls `deps.widgets.updateWidget(...)` after the run;
> `apps/app/src/bun/launcher.ts` creates the only `Tray`;
> `packages/core/src/records.ts` exports `createRecordStore`; and
> `apps/app/src/mainview/lib/card-data.ts` exports `formatValue`, `formatTick`,
> `formatFor`, `formatContextFor`, `toNumber` and `columnValues`. If plan 016
> or 018 landed first, reconcile with the shared names in "Contracts added"
> (`runDetached`, `Source`) instead of duplicating them.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (unattended database queries on a timer; native notifications; a battery cost)
- **Depends on**: none (builds on 006 widgets and 007 boards, already in the working tree)
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19, with plans 001–007 uncommitted on `feat/launcher-002-shell` as the baseline

## Why this matters

Today a widget only runs when someone looks at it: from the launcher, or from
an open board window (`useBoardRefresh` runs tiles only while the board's
`document.visibilityState` is visible). "Trust the answer" stops at the moment
you close the panel. This plan adds one bun-side scheduler that keeps chosen
widgets running in the background, and three features on top of it:

- **C1 Menu-bar KPI.** Pin one KPI widget and its formatted value becomes the
  tray title (iStat-style), refreshed on its interval.
- **C2 Alerts.** A widget condition (`value < n`, `value > n`, `rows > 0`,
  `changed`) posts a native notification, once, with hysteresis, and the alert
  stays reachable from the tray and the launcher until it is seen.
- **C3 Change since last run.** Every run (foreground or background) appends a
  small encrypted sample, so widget rows and board tiles show a delta and a
  sparkline.

The app becomes something that tells you, instead of something you have to
remember to ask.

## Current state

Files and their roles (all verified in the working tree):

- `apps/app/src/bun/widget-service.ts` — validates values, guards and compiles
  the template, runs read-only (`WIDGET_TIMEOUT_MS = 30_000`,
  `WIDGET_MAX_ROWS = 2000`). `runWidget` (lines 322–352) always writes
  `lastRunAt` and `lastValues` back to `widgets.enc`:

  ```ts
  // widget-service.ts:343-347
  await deps.widgets.updateWidget(widget.id, (current) => ({
    ...current,
    lastRunAt: now.toISOString(),
    lastValues: resolved,
  }));
  ```

  A background run must **not** do this: `listWidgets` sorts by `lastRunAt`
  (`byRecency`, line 131), so a timer would reshuffle the user's root list and
  overwrite the inputs they last chose. `resolveValues` (lines 229–259) throws
  `INVALID_INPUT` for names that are no longer editable params.

- `apps/app/src/bun/connection-access.ts` — `ensurePool` connects on demand
  from the stored credentials (`pools.connect(...)` if `!pools.has(id)`). A
  background run can therefore open a connection by itself.
- `apps/app/src/bun/rpc.ts` — composition root (`createAppRpcs`): builds the
  widget, board and ask services, defines every handler, and keeps `live`
  RPCs to broadcast `boardChanged`. `deleteWidget` (lines 191–194) also calls
  `boards.removeWidget`. `openWidgetInLauncher` (lines 273–275) calls
  `getLauncher()?.navigate({ kind: "widget-run", widgetId })`.
- `apps/app/src/bun/launcher.ts` — creates the tray (lines 134–164):

  ```ts
  const tray = new Tray({ height: 18, image: "views://assets/tray-template.png", template: true, width: 18 });
  tray.setMenu([{ action: TRAY_ACTIONS.open, label: "Open Launcher", type: "normal" }, …]);
  tray.on("tray-clicked", (event) => { switch (actionOf(event)) { … } });
  ```

  `LauncherController` (lines 22–29) has `hide`, `markRendererReady`,
  `navigate`, `resize`, `show`, `toggle`. The tray is private to this file.

- `apps/app/src/bun/index.ts` — line 1 forbids importing `@oh-my-query/core`
  there (WASM top-level await deadlock). Keep all new core usage in modules
  imported from `rpc.ts`.
- `apps/app/src/bun/app-hide-native.ts`, `accessibility-native.ts`,
  `native-symbols.ts` — the repo's `bun:ffi` pattern for macOS APIs (dlopen,
  `symbolAddress`, fail soft to `null` off macOS or on error). Follow it for the
  power-source probe.
- `packages/core/src/records.ts` — `createRecordStore(filePath, parse)` gives
  encrypted, atomic, in-process-locked `get/list/save/remove/update/updateWhere`
  over a JSON array; unreadable files are quarantined; records the parser
  rejects are kept on write. `widgets.ts` and `boards.ts` wrap it. Paths live
  in `packages/core/src/paths.ts` (`widgetsPath()`, `boardsPath()`, …, all under
  `~/.config/oh-my-query/`).
- `packages/rpc/src/widget.ts` — the protected `Widget` schema (lines 248–261),
  `ParamValue`, `ParamValues`, `paramValueSchema`, `editableParams`, and the RPC
  shapes `RunWidgetRequest` / `WidgetRunResult` (lines 291–304).
- `packages/rpc/src/board.ts` — `REFRESH_INTERVALS = ["off","1m","5m","15m","1h"]`
  and `REFRESH_MS`.
- `packages/rpc/src/schema.ts` — `RpcSchema` requests and messages (lines
  43–199); `LauncherNavigateView` includes `{ kind: "widget-run"; widgetId }`.
- `apps/app/src/mainview/lib/card-data.ts` — the renderer's pure formatting:
  `toNumber` (81), `columnValues` (92), `formatFor` (124), `formatContextFor`
  (149), private `format`/`compact`/`currency` (165–301), `formatValue` (303),
  `formatTick` (309). It imports only types from `@/lib/ipc`. Callers of these
  helpers: `components/ask/card-chart.tsx`, `card-kpi.tsx`, `card-legend.tsx`,
  `card-table.tsx`, `card-tooltip.tsx`, plus `lib/card-data.test.ts`.
  `card-kpi.tsx` shows how a KPI is formatted:
  `formatValue(value, formatFor({ formats }, view.value, values), formatContextFor(values))`.
- `apps/app/src/mainview/components/board/use-board-refresh.ts` — board tiles
  run through `runWidget` with `MAX_CONCURRENT_RUNS = 4`, cancel superseded
  runs, and pause while the document is hidden.
- `apps/app/src/mainview/components/widgets/widget-row.tsx` — root widget row
  (connection glyph, name, summary, `Inputs ⇥` hint, `FreshPulse`).
  `components/board/board-tile.tsx` — tile body, `cardActions` slot passed to
  `WidgetRunBody`.
- `apps/app/src/mainview/components/launcher/views/catalog-actions.ts` — ⌘K
  actions for a widget row (`run-widget`, `add-to-board`);
  `use-catalog-menu.ts` dispatches them. `components/widgets/widget-actions.ts`
  — ⌘K actions inside the widget run view.
- `apps/app/src/mainview/components/launcher/use-launcher-stack.ts` —
  `LauncherView` union; new screens are new variants.
- `apps/app/src/mainview/components/launcher/views/settings-view.tsx` —
  `SettingsGroup` + `SettingRow` sections.
- `apps/app/src/mainview/lib/browser-ipc-stub.ts` — browser-mode IPC
  emulation; `globalThis.__omqIpcLog` records requests for e2e.
- UI primitives available: `components/ui/segmented-control.tsx`,
  `checkbox.tsx`, `input.tsx`, `hooks/use-armed-confirm.ts`,
  `components/motion/{pressable,swap-text,reveal,check-draw}.tsx`.

### Electrobun facts (verified in `apps/app/.hutch/types/sdks/main/`, Electrobun 2.0.6)

- `core/Tray.d.ts`: `Tray` has `setTitle(title: string)`, `setImage(path)`,
  `setMenu(MenuItemConfig[])`, `on("tray-clicked", handler)`, `setVisible`.
  `MenuItemConfig` (`proc/native.d.ts:1123`) supports `label`, `action`,
  `data`, `enabled`, `checked`, `hidden`, `submenu`, `tooltip`, and separators.
  The click event carries `data.action` (and `data.data`).
- `core/Utils.d.ts:40-92`: `showNotification({ title, body?, subtitle?, silent? })`
  returns `void`. **There is no click callback.** `events/ApplicationEvents.d.ts`
  lists only `applicationMenuClicked`, `beforeQuit`, `contextMenuClicked`,
  `openUrl`, `reopen`. `strings` on `~/.hutch/releases/electrobun/2.0.6/macos-arm64/libNativeWrapper.dylib`
  shows `UNUserNotificationCenter` scheduling with a legacy fallback but no
  `userNotificationCenter:didReceiveNotificationResponse:` delegate method. So
  "clicking a notification opens the widget" cannot be wired directly; Step 1
  measures what a click does, and the design below does not depend on it.
- No power or sleep/wake events are exposed. Wake is detected from timer drift;
  battery state comes from IOKit via `bun:ffi` (Step 6).

## Commands you will need

| Purpose            | Command                                                                                             | Expected                  |
| ------------------ | --------------------------------------------------------------------------------------------------- | ------------------------- |
| App tests (both)   | `bun run --cwd apps/app test`                                                                       | all pass (REQUIRED)       |
| One unit file      | `bun run --cwd apps/app test:unit src/bun/widget-scheduler.test.ts`                                 | pass                      |
| One browser file   | `bun run --cwd apps/app test:browser src/mainview/components/widgets/widget-trend.browser.test.tsx` | pass                      |
| Update snapshots   | `bun run --cwd apps/app test:browser -- -u`                                                         | review the diff like code |
| Contracts          | `bun run --cwd packages/rpc test`                                                                   | pass                      |
| Core stores        | `bun run --cwd packages/core test`                                                                  | pass                      |
| Typecheck          | `bun run check-types`                                                                               | exit 0                    |
| Lint + format      | `bun run check` (fix with `bun run fix`)                                                            | exit 0                    |
| e2e (browser stub) | `bun run --cwd apps/app e2e`                                                                        | all pass                  |
| Desktop dev        | `bun run --cwd apps/app desktop:dev`, driven with the `cua-driver` skill                            | app runs                  |

## Implementation rules relevant to this plan

- Strict TypeScript: no `any`, no unsafe casts, `noUncheckedIndexedAccess`.
  Validate with zod at every edge: RPC params, every record read from disk
  (`createRecordStore` parsers), and tray-click payloads.
- **Widget runs never call the AI.** Background runs go through the same
  read-only path as foreground runs (`assertReadOnly` on the masked template,
  `{ readOnly: true, params }`, bind parameters only). No new SQL path.
- **Protected contracts stay untouched.** Do not change `Widget`
  (`packages/rpc/src/widget.ts`), `Board`, `CardSpec` or `AskEvent`. Watch
  config lives in its own store (decision below). `WidgetRunResult` is an RPC
  response shape, not a persisted record; adding one optional field to it is
  allowed.
- Keep `@oh-my-query/core` out of `apps/app/src/bun/index.ts`.
- Pure logic is separated from timers and I/O: `watch-policy.ts` (pure),
  `widget-scheduler.ts` (loop over injected ports, tested with fake timers),
  wiring in `rpc.ts`. Inject `now()` and timer functions; never read
  `Date.now()` inside policy code.
- React: components ≤ ~150 lines, one per file, ≤ ~6 props, no boolean prop
  proliferation (use `variant`/`state` enums), logic in hooks, no derived state
  synced through `useEffect`, hotkeys in a `useXxxHotkeys` hook, React 19 ref
  as a prop. No code comments unless a non-obvious why.
- Tests are colocated: `*.test.ts` for pure/bun code (jsdom `unit` project,
  which also runs `src/bun/**`), `*.browser.test.tsx` for components and hooks
  (`vitest-browser-react`). Coverage gate is 80% lines on `src/mainview`.
- Copy follows the brand: warm, quiet, no hype, no sparkle icons. Notification
  and tray text are plain sentences ("MRR is $48.2k, below $50k").

## Decisions made in this plan

1. **Watch config lives in a separate `watches.enc` store, not on `Widget`.**
   Extending `Widget` needs a versioned migration of `widgets.enc` and makes
   every widget edit race with scheduler writes (alert state changes on every
   evaluation). A separate store keeps `Widget` frozen, lets plan 018 migrate
   `Widget` to `source: Source` independently, and makes "delete all watches"
   trivial. A watch references `widgetId`; deleting the widget deletes its
   watches and run log.
2. **A watch snapshots its input values.** `Watch.values` is copied from the
   widget's `lastValues` when the watch is created, so later interactive runs
   with other inputs do not change what is watched. The watch view offers
   "Use the inputs from your last run" to refresh the snapshot.
3. **Background runs never touch `lastRunAt`/`lastValues`.** Add
   `runDetached(widgetId, values, signal)` to the widget service. Plan 016
   (`run_widget` over MCP) uses the same method, so name it exactly that.
4. **The scalar of a run** (for the tray title, `below`/`above`, delta and
   sparkline) is `scalarOf(spec, result)`: the KPI `value` column's first row
   when `spec.view.kind === "kpi"`; otherwise the single numeric cell when the
   result is exactly one row by one numeric column; otherwise `null`.
   Threshold alerts and menu-bar pinning are offered only when the widget's
   spec is a KPI view. `hasRows` and `changed` work for every widget.
5. **Due times come from the run log.** A watch is due at
   `lastSampleAt + effectiveInterval`. A foreground run (launcher or board)
   with the same values appends a sample too, so it naturally postpones the
   background run: no duplicate queries while a board is open.
6. **Notification clicks are not relied on** (no click API, see above). Fired
   alerts stay visible in the tray menu (each item opens the widget) and as an
   **Alerts** section at the top of the launcher root until opened or
   dismissed. If Step 1 shows that a click fires the `reopen` event, also open
   the newest unseen alert's widget from `reopen`. Do not build a
   `UNUserNotificationCenter` delegate through FFI.
7. **Battery policy**: on battery, the effective interval is
   `max(interval, 15m)`. Unknown power state counts as AC.
8. **One menu-bar KPI in v1.** Pinning another unpins the previous one.

## Contracts added (protected after this plan)

`packages/rpc/src/watch.ts` (export from `index.ts`):

```ts
export const WATCH_INTERVALS = ["1m", "5m", "15m", "1h"] as const;
export const WatchInterval = z.enum(WATCH_INTERVALS);
export const WATCH_INTERVAL_MS: Record<WatchInterval, number>; // 60_000 … 3_600_000
export const MAX_WATCHES = 20;

export const WatchCondition = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("below"), threshold: z.number().finite() }),
  z.object({ kind: z.literal("above"), threshold: z.number().finite() }),
  z.object({ kind: z.literal("hasRows") }),
  z.object({ kind: z.literal("changed") }),
]);

export const AlertState = z.object({
  armed: z.boolean(), // may fire on the next true evaluation
  falseStreak: z.number().int().min(0), // consecutive false evaluations since firing
  lastFiredAt: z.string().nullable(),
  seenAt: z.string().nullable(), // opened or dismissed in the UI
});

export const Watch = z.object({
  version: z.literal(1),
  id: z.string().min(1).max(100),
  widgetId: z.string().min(1).max(100),
  values: z.record(z.string(), ParamValue),
  interval: WatchInterval,
  menuBar: z.boolean(),
  alert: WatchCondition.nullable(),
  alertState: AlertState,
  paused: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const WatchDraft = Watch.pick({
  widgetId: true,
  values: true,
  interval: true,
  menuBar: true,
  alert: true,
  paused: true,
}).extend({ id: z.string().min(1).max(100).optional() });

export const RunSample = z.object({
  at: z.string(),
  value: z.number().finite().nullable(),
  rowCount: z.number().int().min(0),
  digest: z.string().regex(/^[0-9a-f]{16}$/),
});
export const MAX_SAMPLES = 30;
export const RunLogEntry = z.object({
  id: z.string(), // `${widgetId}:${valuesKey}`
  widgetId: z.string(),
  valuesKey: z.string().regex(/^[0-9a-f]{16}$/),
  samples: z.array(RunSample).max(MAX_SAMPLES), // newest last
});

export interface WidgetTrend {
  valuesKey: string;
  latest: RunSample | null;
  previous: RunSample | null;
  series: number[]; // last ≤ 20 non-null values, oldest first
}

export type WatchState = "idle" | "running" | "error" | "paused" | "waiting";
export interface WatchStatus {
  watchId: string;
  state: WatchState;
  lastRunAt: string | null;
  nextRunAt: string | null;
  error: { code: string; message: string } | null;
  display: string | null; // formatted scalar for the menu bar / list
}
```

`valuesKey` = first 16 hex chars of SHA-256 over the canonical JSON (keys
sorted) of the **resolved, unexpanded** values returned by `resolveValues`
(presets stay as `"last30d"`, so "last 30 days" compares with itself across
days). `digest` = first 16 hex chars of SHA-256 over `JSON.stringify(rows)`.

`packages/rpc/src/card-format.ts` (moved, not rewritten): `toNumber`,
`columnValues`, `formatFor`, `formatContextFor`, `formatValue`, `formatTick`,
`FormatContext`, plus new `scalarOf(spec, result) → { value: number; column: string } | null`
and `formatScalar(spec, result) → string | null` (compact, via `formatTick`).
`CardResult` (columns/rows/rowCount/isTruncated) moves with them.

RPC (`packages/rpc/src/schema.ts`):

| Request             | Params                    | Response                      |
| ------------------- | ------------------------- | ----------------------------- |
| `listWatches`       | `{}`                      | `Watch[]`                     |
| `saveWatch`         | `{ watch: WatchDraft }`   | `Watch`                       |
| `deleteWatch`       | `{ watchId }`             | `void`                        |
| `listWatchStatuses` | `{}`                      | `WatchStatus[]`               |
| `listWidgetTrends`  | `{ widgetIds: string[] }` | `Record<string, WidgetTrend>` |
| `acknowledgeAlert`  | `{ watchId }`             | `void`                        |
| `setWatchingPaused` | `{ paused: boolean }`     | `void`                        |
| `getWatchingPaused` | `{}`                      | `boolean`                     |

Messages (bun → every live RPC): `watchesChanged: Record<string, never>` and
`widgetSampled: { widgetId: string; valuesKey: string }`.

`WidgetRunResult` gains `trend: WidgetTrend | null` (response only).

## UI and motion (mandatory)

The owner's bar: the UI must be excellent and motion is mandatory. A surface
without designed motion, or without designed empty, loading, populated and
error states, is not done. Use `apps/app/src/mainview/lib/motion.ts` and
`components/motion/`; never hand-roll transitions.

- **Tokens:** `SPRING` (400/30) layout morphs and push/pop. `SPRING_SNAPPY`
  (600/49) selection, toggles, segmented pills. `SPRING_SOFT` (260/32) height
  and reveals. `SPRING_MOMENTUM` only after a drag release (not used here).
  `FADE_IN` 160ms ease-out-quint, `FADE_OUT` 110ms. `DRAW` 220ms for strokes
  (`CheckDraw` uses `pathLength` with it). `PRESS` scale 0.97 over 100ms.
  `staggerDelay` 30ms capped at 6. `useMotionPreset()` gives the reduced
  equivalents (`REDUCED_FADE` 120ms linear, no transforms).
- **Principles:** respond on press; everything interruptible (springs retarget,
  no input lockout, no CSS transitions for re-triggerable motion); exit the way
  you entered at ~70% duration; animate only `transform`, `opacity`, `filter`
  (and SVG `pathLength`, as `CheckDraw` already does); `layout` for size
  changes; one primary motion per moment; only progress indicators loop.
- **Accessibility:** reduced motion turns travel into crossfades or instant
  changes; reduced transparency gives opaque surfaces; increased contrast gives
  solid borders and promoted muted text; focus rings always visible; live
  regions announce state changes ("Watching MRR every 5 minutes"), never
  animation frames. Deltas are never conveyed by color alone: always a sign and
  an arrow glyph, and an `aria-label` like "Up 4.2% since 9:41".
- **No flicker:** loading states under 150ms are never shown; once shown they
  stay ≥ 300ms (`hooks/use-delayed-visibility.ts`).

### Designed states

| Surface          | Empty                                          | Loading                             | Populated                                 | Error                                                         |
| ---------------- | ---------------------------------------------- | ----------------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| Trend (row/tile) | < 2 samples: nothing rendered (no "0%")        | none (trend arrives with data)      | delta chip + 48×14 sparkline              | last run failed: muted "Couldn't refresh" with time           |
| Watch view       | new watch: defaults (5m, no alert)             | saving: button `SwapText` "Saving…" | existing watch values + status line       | inline field error (threshold not finite), save failure note  |
| Watches list     | "Nothing watched yet. ⌘K on a widget → Watch…" | skeleton rows after 150ms           | rows with status, next run, display value | load failure with Retry                                       |
| Root Alerts      | section absent                                 | —                                   | rows "MRR below $50k · 4m ago"            | —                                                             |
| Tray             | no title, base menu                            | —                                   | title `$12.4k`, KPI + alerts in menu      | title keeps last value ≤ 3× interval, then `—`; menu says why |

### Motion moments in this plan

| Moment                      | Trigger                                   | What moves                                                                                             | Token                               | Reduced motion         |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------- | ---------------------- |
| Watch view push             | ⌘K → "Watch…"                             | Standard stack push                                                                                    | `SPRING`                            | Crossfade              |
| Interval / condition select | Arrow keys or click on segmented controls | Selection pill moves via `layoutId` per control                                                        | `SPRING_SNAPPY`                     | Instant                |
| Threshold field             | Choosing Below/Above (or leaving them)    | Field row expands/collapses via `layout`; contents fade                                                | `SPRING_SOFT`, `FADE_IN`/`FADE_OUT` | Instant                |
| Threshold preview           | Typing a threshold                        | Formatted preview ("$50k") `SwapText`s                                                                 | `FADE_IN`                           | Instant swap           |
| Saved                       | `⌘↵` in the watch view                    | Footer `SwapText`s to "Watching · every 5 min" with `CheckDraw`; view pops                             | `FADE_IN`, `DRAW`, `SPRING`         | Instant, no draw       |
| Watched glyph on a row      | Watch created/removed                     | Bell / gauge glyph fades and scales 0.9→1 next to the name                                             | `FADE_IN` / `FADE_OUT`              | Opacity only           |
| Sparkline first appearance  | Trend reaches 2 samples                   | Polyline draws in (`pathLength` 0→1)                                                                   | `DRAW`                              | Drawn, no animation    |
| New sample                  | `widgetSampled` or a run result           | Polyline group translates one step left (`x: step→0`), last point dot fades in; delta chip `SwapText`s | `SPRING_SOFT`, `FADE_IN`            | Instant                |
| Alert row arrives           | Root opened with an unseen alert          | Alerts section `Reveal`s; one-shot amber background pulse (0.14→0 over 900ms, same as `FreshPulse`)    | `FADE_IN`, `FADE_OUT`               | No pulse               |
| Alert dismissed             | `⌫` on an alert row                       | Row fades; list closes the gap via `layout`                                                            | `FADE_OUT`, `SPRING`                | Instant                |
| Watches list rows           | View appears                              | Rows stagger in                                                                                        | `staggerDelay`, `FADE_IN`           | Instant                |
| Status line (running)       | A watch run starts/ends while visible     | 2px progress hairline under the row (the only loop), status `SwapText`s                                | `FADE_IN`                           | Static "Running…" text |

The tray title and native notifications are system-drawn; they have no motion.

## Scope

**In scope**

- `packages/rpc/src/watch.ts` (create), `watch.test.ts` (create)
- `packages/rpc/src/card-format.ts` (create, moved from the renderer), `card-format.test.ts` (create, moved tests plus `scalarOf`)
- `packages/rpc/src/schema.ts`, `widget.ts` (`WidgetRunResult.trend` only), `index.ts`
- `packages/core/src/paths.ts` (`watchesPath()`, `runLogPath()`), `packages/core/src/watches.ts` + `watches.test.ts` (create: `createWatchStore`, `createRunLogStore`), `index.ts`, `config.ts` (`watchingPaused?: boolean` on `AppConfig`)
- `apps/app/src/bun/widget-service.ts` (+ test): `runDetached`, run-log append, `trend` in results
- `apps/app/src/bun/watch-policy.ts` (create, pure) + test
- `apps/app/src/bun/widget-scheduler.ts` (create) + test
- `apps/app/src/bun/watch-service.ts` (create: CRUD, statuses, alerts, notifier, tray status) + test
- `apps/app/src/bun/alert-notifier.ts` (create, rate limiting over `Utils.showNotification`) + test
- `apps/app/src/bun/tray-status.ts` (create, pure title/menu builders) + test
- `apps/app/src/bun/power-native.ts` (create, IOKit probe)
- `apps/app/src/bun/launcher.ts` (`setTrayStatus`, tray click routing), `rpc.ts` (wiring), `index.ts` (start/stop only; no core import)
- `apps/app/src/mainview/lib/card-data.ts` and the five `components/ask/card-*.tsx` callers (import moved helpers from `@oh-my-query/rpc`), `lib/card-data.test.ts` (drop moved cases)
- `apps/app/src/mainview/lib/ipc.ts`, `lib/browser-ipc-stub.ts` (+ a `lib/browser-watch-stub.ts` emulator)
- `apps/app/src/mainview/components/watches/` (create): `watch-view.tsx`, `use-watch-form.ts`, `watch-condition-field.tsx`, `watches-view.tsx`, `watch-status-row.tsx`, `widget-trend.tsx`, `sparkline.tsx`, `use-widget-trends.ts`, `alert-row.tsx`, `use-alerts.ts`, tests and snapshots
- `apps/app/src/mainview/components/launcher/use-launcher-stack.ts` (variants `watch` and `watches`), `launcher-panel.tsx` (render them), `views/root-items.ts`, `views/root-list.tsx`, `views/catalog-actions.ts`, `views/use-catalog-menu.ts`, `views/settings-view.tsx`
- `apps/app/src/mainview/components/widgets/widget-row.tsx`, `widget-actions.ts`, `use-widget-menu.ts`
- `apps/app/src/mainview/components/board/board-tile.tsx` (trend in the card actions slot)
- `apps/app/e2e/watch-flow.spec.ts` (create)
- `.factory/plans/README.md` (status row)

**Out of scope**

- Changing `Widget`, `Board`, `CardSpec`, `AskEvent` schemas.
- Running asks (AI) on a schedule. Only saved widgets are watched.
- Multiple menu-bar items, per-watch sounds, email/Slack delivery, quiet hours.
- An FFI `UNUserNotificationCenter` delegate or patching Electrobun.
- Moving board refresh into the bun scheduler. Boards keep `useBoardRefresh`;
  they only gain trends.
- MongoDB/Redis widgets (still `UNSUPPORTED_ENGINE`).

## Git workflow

- Branch `feat/launcher-014-watch-widgets` from the current working branch.
  Commit only if authorized. Do not push or open a PR unless instructed.

## Steps

### Step 1: Spike notification and tray behavior (half a day, desktop dev)

In desktop dev, add a temporary debug call (removed before commit) that posts
`Utils.showNotification({ title: "Test", body: "…" })` and logs every
`Electrobun.events` `reopen` and `tray-clicked`. Using the `cua-driver` skill:
post a notification while the launcher is hidden, click it, and record what
happens (app activates? `reopen` fired? nothing?). Also call
`tray.setTitle("$12.4k")` with the template image and confirm the title renders
next to the icon in light and dark menu bars, and that `setTitle("")` removes
it. Record findings in the PR description. Outcome decides only whether
`reopen` also routes to the newest unseen alert (Decision 6).

### Step 2: Move formatting into `@oh-my-query/rpc` and add `scalarOf`

Move the pure formatting helpers listed in "Contracts added" from
`apps/app/src/mainview/lib/card-data.ts` to `packages/rpc/src/card-format.ts`
unchanged (they only use `Intl` and types). Import `ColumnFormat`/`CardSpec`
from `./card-spec.ts` and `ColumnInfo` from `@oh-my-query/core/client`.
Update the five renderer callers and `card-data.ts` to import from
`@oh-my-query/rpc`; do not leave re-export shims. Move the matching test cases
from `lib/card-data.test.ts` into `card-format.test.ts`. Add `scalarOf` and
`formatScalar` with tests: KPI view (first row, string numerics via
`toNumber`), 1×1 numeric non-KPI, multi-row non-KPI → `null`, null cell →
`null`, currency/percent formatting through `formatTick`.

**Evidence**: `bun run --cwd packages/rpc test` and `bun run --cwd apps/app test`
pass with no snapshot changes in `components/ask/__snapshots__/`.

### Step 3: Contracts and stores

Create `packages/rpc/src/watch.ts` as specified. Create
`packages/core/src/watches.ts`:

- `createWatchStore(parse)` over `watchesPath()` (`watches.enc`) with
  `list/get/save/remove/update` and `removeForWidget(widgetId)`.
- `createRunLogStore(parse)` over `runLogPath()` (`widget-runs.enc`) with
  `append(widgetId, valuesKey, sample)` (keeps the newest `MAX_SAMPLES` per
  entry and at most 8 entries per widget, evicting the entry with the oldest
  latest sample), `entry(widgetId, valuesKey)`, `latestFor(widgetIds)`
  (the most recently sampled entry per widget), and `removeForWidget(widgetId)`.

Both reuse `createRecordStore`/`updateRecords` (encryption, atomic write,
lock, quarantine). Add `watchingPaused?: boolean` to `AppConfig` in
`packages/core/src/config.ts`.

### Step 4: Detached runs, samples and trends in the widget service

Refactor `createWidgetService` so one internal function performs
"require widget → open connection → resolve values → guard → compile → run
read-only" and returns `{ widget, resolved, compiled, result }`. Then:

- `runWidget` (unchanged contract) calls it, persists `lastRunAt`/`lastValues`
  as today, appends a sample, and returns `trend`.
- `runDetached(widgetId, values, signal)` drops value names that are no longer
  editable params (instead of throwing), calls it, appends a sample, and does
  **not** call `updateWidget`. It returns
  `{ widget, result, compiledSql, values, sample, previous, valuesKey }`.
- Appending: `scalarOf(widget.spec, result)` → `value`; `rowCount`; `digest`.
  A run-log write failure is logged and never fails the run.
- After appending, call the injected `onSampled(widgetId, valuesKey)` so
  `rpc.ts` can broadcast `widgetSampled`.
- `listWidgetTrends(widgetIds)` builds `WidgetTrend`s from `latestFor`.

Add `runLog` and `onSampled` to `WidgetServiceDeps`. Update
`widget-service.test.ts`: detached run leaves `lastRunAt` and `lastValues`
untouched; stray value names are dropped for detached runs and still rejected
for `runWidget`; samples are appended with the right `valuesKey` for presets;
a failing run appends nothing; a run-log failure still returns the result.

### Step 5: Pure policy (`watch-policy.ts`)

Pure functions with injected time, table-driven tests:

- `effectiveIntervalMs(interval, power)` → `WATCH_INTERVAL_MS[interval]`, or
  at least 15 minutes on battery.
- `nextDueAt({ lastSampleAt, intervalMs, failures, now })` → `now` when never
  sampled; else `lastSampleAt + intervalMs`; after `n` consecutive failures,
  `lastAttemptAt + min(intervalMs × 2^n, 1h)`.
- `evaluateAlert(condition, previous, sample, state, now)` →
  `{ fire: boolean; next: AlertState }`:
  - `below`/`above`: true when `sample.value` is non-null and strictly past the
    threshold. Fire only when `armed`. After firing, `armed = false`,
    `falseStreak = 0`. Re-arm after **2 consecutive false** evaluations
    (hysteresis that needs no unit-aware margin). A null value counts as
    neither true nor false (state unchanged).
  - `hasRows`: true when `rowCount > 0`, same arming rules.
  - `changed`: true when `previous` exists and `digest` differs. The first
    sample never fires. It re-arms on the next evaluation.
  - **Cooldown**: never fire twice for one watch within 60 minutes, even when
    re-armed.
- `alertMessage(widgetName, condition, display, thresholdDisplay)` →
  notification `{ title, body }`, e.g. `MRR` / `MRR is $48.2k, below $50k.`,
  `Failed payments` / `3 rows match now.`, `Signups by day` / `The result changed.`
- `trayTitle` rules live in `tray-status.ts` (Step 8), not here.

### Step 6: Power probe (`power-native.ts`)

Following `accessibility-native.ts`: dlopen
`/System/Library/Frameworks/IOKit.framework/IOKit` with
`IOPSGetTimeRemainingEstimate: { args: [], returns: FFIType.f64 }`. The return
value `-2` (`kIOPSTimeRemainingUnlimited`) means on AC power; anything else
means battery. Export `createPowerProbe(): (() => "ac" | "battery") | null`,
returning `null` off macOS or on error (callers treat `null` as AC). Verify on
a MacBook unplugged and plugged in; if the symbol is unavailable, ship with
`null` and report it.

### Step 7: The scheduler (`widget-scheduler.ts`)

One scheduler per process, created in `rpc.ts`, started from `index.ts` after
the launcher exists, stopped on `beforeQuit`. It owns timing and concurrency
only; policy comes from `watch-policy.ts`; I/O comes through ports:

```ts
interface SchedulerPorts {
  now(): number;
  setTimer(run: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  listWatches(): Promise<Watch[]>;
  lastSampleAt(watch: Watch): Promise<number | null>;
  connectionOf(watch: Watch): Promise<string | null>; // null → widget gone
  isPaused(connectionId: string): boolean; // user disconnected it
  power(): "ac" | "battery";
  watchingPaused(): Promise<boolean>;
  run(watch: Watch, signal: AbortSignal): Promise<WatchRunOutcome>;
  report(
    watch: Watch,
    outcome: WatchRunOutcome | WatchRunFailure
  ): Promise<void>;
}
```

Behavior (each is a test with `vi.useFakeTimers()`):

- One timer, re-armed to the earliest due time, clamped to [5s, 60s] so state
  changes are picked up within a minute.
- At most **2** background runs at once, and at most **1 per connection**.
  Board refreshes are separate (renderer, max 4); this keeps the combined load
  per connection at ≤ 5.
- A watch whose widget or connection disappeared is skipped (status `error`,
  code `WIDGET_NOT_FOUND`/`CONNECTION_MISSING`), never retried in a tight loop.
- **Wake detection**: when a tick fires more than 60s later than scheduled,
  treat it as a wake: wait a 20s grace period (network comes back), then run
  overdue watches once each, 2s apart. Missed intervals are never replayed.
- **Explicit disconnect**: `rpc.ts` marks a connection paused when the user
  calls `disconnectFromDatabase`, and clears it on `connectToDatabase` or any
  foreground run on it. Paused connections are not reconnected by the
  scheduler (status `paused`).
- Global pause (`AppConfig.watchingPaused`) and per-watch `paused` stop runs
  without deleting anything.
- `stop()` aborts in-flight runs and clears the timer.
- Status changes (`running`, `idle`, `error`, next run time) are kept in
  memory and exposed through `listWatchStatuses`; changes broadcast
  `watchesChanged` at most once per second.

### Step 8: Watch service, alerts, notifier and tray (bun)

- `watch-service.ts`: CRUD with zod validation (`WatchDraft`), `MAX_WATCHES`,
  one `menuBar` at a time, `menuBar`/threshold alerts rejected unless the
  widget spec is a KPI view (`INVALID_INPUT`, "Only KPI widgets can show in the
  menu bar."), `values` validated against the widget's params. `report()`
  evaluates the alert with `watch-policy`, persists `alertState` only when it
  changed, sends notifications through the notifier, updates the tray, and
  broadcasts `watchesChanged`. After 3 consecutive failures it posts one
  "Couldn't check {widget}" notification, then stays quiet until a success.
- `alert-notifier.ts`: wraps `Utils.showNotification`. At most 3 notifications
  per rolling 10 minutes; overflow is coalesced into one
  "2 more alerts · open the menu bar to see them" notification per window.
  Subtitle is the connection name. Not silent.
- `tray-status.ts` (pure): `trayTitle(pinned)` → `""` when nothing is pinned;
  the compact display (`formatScalar`, ≤ 10 chars, ellipsized) while the last
  success is within 3× the effective interval; `"—"` after that.
  `trayMenu(status)` → `MenuItemConfig[]`: the pinned KPI as a disabled line
  ("MRR · $12.4k · 2m ago" or "MRR · couldn't refresh · 2m ago"), "Open MRR"
  (`action: "watch:open"`, `data: { widgetId }`), up to 5 unseen alerts
  ("MRR below $50k · 4m ago", same action), "Watching 4 widgets…" (opens the
  `watches` view), separator, then the existing Open Launcher / Settings… /
  Quit items.
- `launcher.ts`: keep the tray private; add
  `setTrayStatus(status: TrayStatus)` to `LauncherController`, which calls
  `tray.setTitle(trayTitle(...))` and `tray.setMenu(trayMenu(...))`. Parse
  tray-click `data` with zod; `watch:open` → `navigate({ kind: "widget-run", widgetId })`
  and acknowledge the alert. If Step 1 found that notification clicks fire
  `reopen`, route `reopen` to the newest unseen alert's widget when it fired
  within the last 10 minutes; otherwise keep today's `show()`.
- `rpc.ts`: build the run-log and watch stores, the scheduler and the watch
  service; add the RPC handlers; on `deleteWidget` also remove the widget's
  watches and run log; broadcast `watchesChanged` / `widgetSampled` to every
  live RPC (same pattern as `broadcastBoardChanged`). Return a
  `startBackground()`/`stopBackground()` pair for `index.ts`.

### Step 9: Renderer

- `lib/ipc.ts`: wrappers for the new requests and `onWatchesChanged`,
  `onWidgetSampled` subscriptions. `browser-ipc-stub.ts` + a
  `browser-watch-stub.ts` emulator: in-memory watches; "MRR" style KPI widgets
  get a deterministic sample series so trends and alerts render in
  `dev:web` and e2e.
- `use-widget-trends.ts`: fetches trends for visible widget ids, refetches on
  `widgetSampled` for those ids. `WidgetTrend` component: delta chip
  (`▲ 4.2%`/`▼ 1.1%`, sign + arrow + `aria-label`, `text-success-ink` /
  `text-danger-ink`, neutral when 0) formatted with the widget's
  `spec.formats` via `formatValue`; percent when `previous.value` ≠ 0, else
  absolute. `Sparkline`: inline SVG 48×14, `stroke="currentColor"`, muted,
  last point as a 2px dot; hidden from AT (`aria-hidden`), because the chip
  carries the meaning.
- `WidgetRow`: show `WidgetTrend` before the `Inputs ⇥` hint and a small bell
  (alert) or gauge (menu bar) glyph after the name when watched. Keep props
  ≤ 6: pass a `watch` summary object, not booleans.
- `BoardTile`: render `WidgetTrend` in the `cardActions` slot, fed from the
  run outcome's `trend`.
- New `LauncherView` variants `{ kind: "watch"; widgetId: string }` and
  `{ kind: "watches" }`.
  - **Watch view**: header "Watch {widget}"; interval segmented control
    (1m / 5m / 15m / 1h); "Show in menu bar" checkbox (KPI only, otherwise a
    muted one-line reason); alert segmented control (None / Below / Above /
    Has rows / Changes; Below/Above KPI only) with a threshold number field
    and a formatted preview; inputs summary from `valuesSummary` with
    "Use the inputs from your last run"; for a connection whose
    `environment` is production, one muted line "Runs every 5 minutes on
    {connection} (production)." `⌘↵` saves, `⌫⌘` (armed confirm via
    `useArmedConfirm`) stops watching. Hotkeys in `useWatchHotkeys`.
  - **Watches view** (from Settings → Background → "Watching"): each watch
    with widget name, display value, status (`Every 5 min · next 9:46`,
    `Paused`, `Couldn't refresh: {message}`), ↵ opens the watch view, `⌫`
    removes (armed confirm). A "Pause all watching" checkbox at the top.
- ⌘K on a widget row (`catalog-actions.ts`) and in the widget run view
  (`widget-actions.ts`) gain "Watch…" / "Edit Watch…" and, for KPI widgets,
  "Show in Menu Bar" / "Remove from Menu Bar".
- Root: an **Alerts** section first (above Recent) listing unseen fired
  alerts; ↵ opens the widget and acknowledges, `⌫` acknowledges only.
  Section id `"alerts"` in `RootSection`.

### Step 10: e2e

`apps/app/e2e/watch-flow.spec.ts` (browser stub): select the MRR widget,
⌘K → Watch…, choose Below with a threshold above the stub's value, `⌘↵`, and
assert the bell glyph on the row, a `saveWatch` entry in
`globalThis.__omqIpcLog`, and — after the stub emits a sample that crosses the
threshold — an Alerts row in root that opens the widget run view on ↵.

## Test plan

- `packages/rpc`: `watch.test.ts` (schema accepts/rejects, threshold finite,
  `WatchDraft` defaults), `card-format.test.ts` (moved cases + `scalarOf`,
  `formatScalar`).
- `packages/core`: `watches.test.ts` (CRUD, encryption round trip, sample cap
  30, 8-entry LRU per widget, `removeForWidget`, corrupt file quarantined).
  Model on `packages/core/src/widgets.test.ts`.
- `apps/app/src/bun`: `watch-policy.test.ts` (due times, battery floor,
  backoff, every alert transition including hysteresis, cooldown, null value,
  first `changed` sample), `widget-scheduler.test.ts` (fake timers: due runs,
  2 global / 1 per connection, wake grace and no replay, paused connection,
  global pause, missing widget, `stop()` aborts), `watch-service.test.ts`
  (single menu bar, KPI-only rules, report → notify once, failure
  notification once after 3), `alert-notifier.test.ts` (3 per 10 min,
  coalescing), `tray-status.test.ts` (title rules incl. stale `—`, menu items
  and actions), `widget-service.test.ts` additions (Step 4). Model on
  `widget-service.test.ts` and `board-service.test.ts`.
- Renderer browser tests: `widget-trend.browser.test.tsx` (empty < 2 samples,
  up/down/flat, aria-label, reduced-motion branch), `watch-view.browser.test.tsx`
  (non-KPI hides menu bar and thresholds, threshold preview, save, armed
  delete, production note), `watches-view.browser.test.tsx` (empty, loading,
  populated, error, pause all), root alerts section, widget row glyphs, board
  tile trend. Snapshots for each designed state.
- e2e: `watch-flow.spec.ts`.

## Done criteria

- [ ] `bun run --cwd apps/app test`, `bun run --cwd packages/rpc test`,
      `bun run --cwd packages/core test`, `bun run check-types`, `bun run check`
      and `bun run --cwd apps/app e2e` pass; app line coverage ≥ 80%.
- [ ] `git diff 12b9e8c -- packages/rpc/src/widget.ts` shows only the
      `trend` field on `WidgetRunResult`; `Widget`, `Board`, `CardSpec` and
      `AskEvent` schemas are unchanged.
- [ ] A test proves a background (`runDetached`) run does not change
      `lastRunAt` or `lastValues`, and the scheduler never calls the AI (no
      model port exists in its dependency graph).
- [ ] `rg -n "@oh-my-query/core" apps/app/src/bun/index.ts` has no match.
- [ ] Desktop dev (`cua-driver`): pin a KPI widget → the tray title shows its
      compact value and updates on the interval with no window open; set
      "Below" above the current value → exactly one notification, then none
      while the condition stays true; the alert appears in the tray menu and
      root and opens the widget; record what a notification click did (Step 1).
- [ ] Sleep the Mac for ≥ 2 minutes with a 1m watch: after wake, one run
      after the grace period (bun log), not a burst.
- [ ] Unplugged (if testing on a laptop): a 1m watch runs every 15 minutes.
- [ ] With a board open on a watched widget, the bun log shows no background
      run for that widget while board refreshes keep it fresh.
- [ ] Every row of "Motion moments in this plan" is implemented with its token
      and reduced-motion fallback, with a browser test per branch; recordings
      at 1× and 0.25× (`?slowmo=4`) attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of: root with 6 trending rows →
      a new sample arriving → open the watch view → choose Below → save, shows
      no frame over 16.7ms, and only `transform`/`opacity`/`filter`/`pathLength`
      animate.
- [ ] Reduce Motion, Reduce Transparency and Increase Contrast verified on the
      watch view, watches view, root alerts and trends; deltas readable without
      color; WCAG AA contrast on the translucent panel.
- [ ] No files outside the in-scope list are modified (`git status`).

## STOP conditions

- `Tray.setTitle` does not render text next to a template image on macOS
  (Step 1). Report it; do not swap in a custom-drawn image without the
  owner's approval.
- `showNotification` shows nothing in desktop dev or the packaged build even
  after granting permission. Ship the tray and root alert surfaces, report the
  notification gap, and do not substitute `showMessageBox` (modal) for alerts.
- Implementing C3 would require changing the persisted `Widget` schema. That
  is out of scope; report instead.
- Background runs measurably hurt the launcher (summon latency or dropped
  frames during a run in the Timelines trace). Report with the trace before
  reducing concurrency below 1 per connection or adding a worker.

## Maintenance notes

- Plan 016 (MCP server) reuses `runDetached`. Plan 018 replaces the widget's
  SQL fields with `source: Source` via a `Widget` migration; the scheduler only
  calls `runDetached`, so it is source-agnostic, but `scalarOf` and digests
  assume `TabularResult`, which every source returns.
- Plan 016 adds an "external agent is querying" line and icon to the tray.
  Extend `TrayStatus`/`trayMenu` in `tray-status.ts`; do not create a second
  tray-menu builder.
- Reviewers: scrutinize that no timer path can fire runs in a loop (backoff,
  missing widget, disconnected connection), that alert state writes only
  happen on transitions, and that `reopen` routing never steals a normal
  summon.
- Deferred: multiple menu-bar KPIs, quiet hours, per-watch inputs editor with
  argument pills, alert history view, notification click routing once
  Electrobun exposes a notification-response event (file upstream).
