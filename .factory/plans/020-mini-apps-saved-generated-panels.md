# Plan 020: Generate, save and reopen mini-apps: panels of inputs, sources, cards and actions

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **This plan has a hard STOP after Phase 0 (the json-render spike).** Do not start
> Phase 1 until the owner has read the spike report and picked a branch.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages apps/app/src` and
> `git status --short`. Plans 001–007 sit uncommitted on top of `12b9e8c`; plans
> 018 and 019 must be merged before Phase 1. Plans 018 and 019 were written in
> parallel with this one, so **reconcile every name below with 018 and 019 as they
> were actually written and built**. Confirm:
>
> - `packages/rpc/src/source.ts` exports `Source`, a discriminated union on `kind`
>   (`"sql"`, `"mcp"`, `"http"`), and the bun side has one source runner whose
>   result is core's `TabularResult`. As planned, 018 names it
>   `createSourceRunner(deps).run(source, params, values, signal) → { result, compiled }`
>   in `apps/app/src/bun/source-runner.ts`; this plan's `runSource` port wraps that call.
>   Re-check the name and signature as built.
> - `packages/rpc/src/action.ts` exports `ActionDef { id, label, effect, target, bind }`
>   with `effect: "read" | "write" | "external"`. 019 owns the confirm sheet, the
>   per-connection "Allow write actions" opt-in, the review of write templates at save
>   time, and `actions-audit.enc`. As planned, 019 runs actions in two steps,
>   `prepareAction(...) → ActionPreview { token, compiled, bound, … }` then
>   `executeAction({ token })` (single-use, 120 s token bound to the compiled call's hash),
>   reads row values from bun's own `run-cache.ts` via `ActionContext { runId, rowIndex, values }`,
>   and puts the confirm sheet in `components/actions/confirm-sheet/`. Re-check as built.
> - 019 (as planned) adds row selection to `components/ask/card-table.tsx` and a row menu in
>   `components/actions/`. Reuse them (Step 3.4); the fallback there applies only if 019 shipped without them.
> - Whether plan 014's `apps/app/src/bun/widget-scheduler.ts` exists. This plan does
>   not schedule background runs. If you add any bun-side timing, reuse that file
>   rather than writing a second scheduler.
> - Whether plan 009 added an `@connection` chip. If it did, generation uses the
>   chip's connection.
>
> If `Source` or `ActionDef` differ in substance (for example, no `effect`, or source
> runs that do not return `TabularResult`), STOP. Do not reshape 018's or 019's
> contracts from here.

## Status

- **Priority**: P3
- **Effort**: L (spike 1 day, then about 3 weeks)
- **Risk**: HIGH. Model output becomes a saved program that can hold write actions.
- **Depends on**: `.factory/plans/018-*.md` (Sources), `.factory/plans/019-*.md` (Actions). Uses 006 (widgets, `ParamDef`) and 007 (board grid, windows).
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19, branch `feat/launcher-002-shell`. The baseline is the **working tree**: plans 001–007 are implemented there but not committed. 008–019 are planned but not built.

## Why this matters

Widgets answer one question, and boards show many answers at once. The owner's
larger idea is "mini software": a small saved tool you describe in one
sentence. For example, "a refund desk: failed Stripe charges from the last 7 days next
to the matching orders, with a Refund button". A **mini-app** is that tool. It has
typed inputs, several named sources (SQL, MCP, HTTP from plan 018), declared actions
(plan 019), and a layout whose leaves are the `CardSpec` cards we already draw well.
Its data is **bound by path, never embedded**, so a saved mini-app re-runs on fresh
data every time it opens, without calling the AI. The model only writes the
composition, and it streams it, so the panel visibly assembles itself. That
assembly is a new signature moment.

## Current state

### What exists and gets reused

- **Contracts** (`packages/rpc/src/`):
  - `card-spec.ts:3` `CARD_SPEC_VERSION = 1`. `card-spec.ts:67-74` `CardSpec { formats, insight?, subtitle?, title, version, view }`. This contract is protected.
  - `widget.ts:21` `Ident = /^[a-z][a-z0-9_]{0,31}$/`; `widget.ts:109-122` `ParamDef` (`date | dateRange | number | text | select`, `fixed?`, select `options?`/`optionsSql?`); `widget.ts:130-134` `ParamValue`; `widget.ts:165` `paramValueSchema(def)`; `widget.ts:45-62` `Widget`, which has no `version` field. Protected.
  - `board.ts:9-18` `TILE_SIZES` `s|m|l|wide` → `TILE_SPANS` 3/4/6/12; `board.ts:20-30` `RefreshInterval`/`REFRESH_MS`; `board.ts:40-49` `Board` with `sharedValues` keyed by `board.ts:59-60` `sharedKey(param) = "${name}:${type}"`. Protected.
- **Storage**: `packages/core/src/records.ts:79` `createRecordStore(filePath, parse)` provides encrypted, atomic, locked CRUD. Records the parser rejects are **kept** on every write (`records.ts:78`), and an undecryptable file is quarantined, not overwritten (`records.ts:22-30`). `boards.ts` and `widgets.ts` are thin wrappers over it. Paths live in `packages/core/src/paths.ts:42-56`.
- **Card rendering**: `apps/app/src/mainview/components/ask/ask-card.tsx:30-37` `AskCard({ spec, result, view, onSelectView, intro?, actions? })` is pure. `components/widgets/widget-run-body.tsx:43-102` wraps it with skeleton, stale-while-revalidate (dim to 0.6), a progress hairline and a "No rows" state, driven by a `WidgetRunState` from `widgets/widget-run-reducer.ts`. `widgets/run-spec.ts:7-15` strips `insight`/`subtitle` because they describe old data.
- **Board pieces**:
  - `components/board/board-grid.tsx:26-34` `spanFor(size, width)` (12 columns; below 900px everything spans 6, below 600px it spans 12).
  - `board/board-inputs.ts:14-83` `sharedInputs`, `changedKeys`, `tilesAffectedBy`.
  - `board/use-board-refresh.ts:20-183` runs tiles with at most 4 concurrent runs, cancels superseded runs, and pauses its interval while `document.visibilityState` is hidden. It is coupled to tiles, widgets and `runWidget`.
  - `board/board-filters.tsx` is the inputs bar over `widgets/arguments/argument-pills.tsx`.
- **Argument pills are tied to widgets**: `argument-pills.tsx:14-18` `ArgumentInput { key, param, widgetId }`, and `arguments/use-param-options.ts:20` `useParamOptions(widgetId, param)` calls `loadParamOptions(widgetId, name)`.
- **Launcher**:
  - `components/launcher/use-launcher-stack.ts:6-14` is the `LauncherView` union. `push` ignores a view of the same kind as the top (`:40-45`).
  - `launcher/views/root-items.ts:84-90` lists the root sections in order: Recent, Widgets, Boards, Connections, Commands, with the "Ask" row first for free text (`:105-111`).
  - `launcher/launcher-surface.tsx:12` sets `PANEL_MAX_HEIGHT = 680`, and `bun/launcher-geometry.ts` sets `LAUNCHER_MAX_HEIGHT = 720`. CLAUDE.md says of the surface: "avoid content that changes height every frame."
- **Windows**:
  - `apps/app/src/bun/board-windows.ts:26-27` `boardUrl` → `#/board/:id`; `:46-146` handles the map, frames, focus and close.
  - `bun/focus-policy.ts:7-26` `FocusState { focusedBoardId, returnBoardId, openBoardIds }`.
  - `bun/rpc.ts:305-307` `toggleLauncher({ fromBoardId })`; `rpc.ts:146` broadcasts `boardChanged` to every live RPC, and `rpc.ts:169` sends `askEvent` only to the launcher RPC.
  - `bun/index.ts:19-60` wires boards and focus release.
- **Agent** (`packages/agent/src/`):
  - `ask.ts:78` streams with `streamText`, and `ask.ts:326` `runAsk` is an async generator over ports with up to 2 repairs.
  - `propose-params.ts:263-267` uses `generateText` + `Output.object`.
  - `check-card-spec.ts:63` `checkCardAgainstResult(spec, stats, rowCount)`.
  - `sql-stream.ts:1` `SQL_DELTA_INTERVAL_MS = 32` (message coalescing).
  - `schema-prompt.ts:97` `formatSchemaForPrompt`; `schema-filter.ts` `selectRelevantSchema`.
  - Tests use `MockLanguageModelV3` from `ai/test`.
- **Motion** (`apps/app/src/mainview/lib/motion.ts:85-141`): `SPRING` 400/30, `SPRING_SNAPPY` 600/49, `SPRING_SOFT` 260/32, `SPRING_MOMENTUM` 380/26, `FADE_IN` 160ms, `FADE_OUT` 110ms, `DRAW` 220ms, `PRESS` (scale 0.97), `REDUCED_FADE` 120ms, `staggerDelay(i)` (30ms, capped at 6), `useMotionPreset()`. Primitives live in `components/motion/` (`Pressable`, `SwapText`, `Reveal`, `CheckDraw`). The hook `hooks/use-delayed-visibility.ts` applies the 150ms/300ms rule.
- **State library**: there is no zustand. Use `useSyncExternalStore` over a small store.

### json-render: what the project already learned (git history)

`git log --all -S"json-render"` → `fe6c4d0` (2026-02-21), `f788d21` (2026-04-15),
`68d2890`, `2e01047` (2026-04-17). Plan 002 removed it in the working tree. HEAD
`12b9e8c` still has `apps/app/src/mainview/lib/json-render{,-validate,-charts}.ts`;
read them with `git show 12b9e8c:<path>`.

1. **Why it was removed** (plan 002, README "Findings considered and rejected"): free-form trees **embedded data**, so a saved spec could not re-run against fresh data. On 2026-11-19 this was re-evaluated: specs holding only `$state` pointers and no `state` block _can_ re-render on fresh data. The problem was how we used the library, not the library itself. **This plan therefore forbids literal data in layouts.** The zod schema allows only pointers for data.
2. **Catalog drift**: `json-render.ts` kept a hand-written `PRODUCTION_COMPONENTS` doc table apart from the zod definitions. It needed a runtime `throw` when the two drifted, and an unsafe `renderImplementations as unknown as Components<AppCatalog>` cast. → Generate the prompt from the same typed catalog. Exhaustiveness must hold at compile time, with **zero casts**.
3. **Off-brand components**: it pulled components from `@json-render/shadcn` (`^0.8.0`). → Use only our own components. Never install `@json-render/shadcn`.
4. **Validation gaps**: `json-render-validate.ts` had to add its own unknown-component check, because `validateSpec` did not flag unknown types; it reused the `missing_child` issue code for this. It also needed `autoFixSpec`, an error boundary and a "View raw spec" toggle. → Validate with our zod schema at the bun boundary, and wrap every element in an error boundary.
5. **Rows shape**: `2e01047` bound the active result at `/result` with `{ "$bindState": "/result/rows" }`. It had to convert positional rows (`unknown[][]`) into keyed records for `repeat`/`$item`, and remount on a `rowCount:executionTimeMs` key. → v1 keeps positional `CardResult` in state, uses no `repeat`, and builds a keyed row only when a row action fires.
6. **Churn**: the project was on `^0.8.0` in February. `npm view` on 2026-11-19 shows **0.23.2, published that day**, with 0.23.0/0.23.1/0.23.2 within four days and 0.21.0→0.23.2 in two months. The docs record one breaking migration (`valuePath`/`statePath` props → `$bindState` + `useBoundProp`).

Facts confirmed on 2026-11-19 with context7 (`/vercel-labs/json-render`) and `npm view`:

- **Packages**: `@json-render/react@0.23.2` has peer `react: ^19.2.3` (we pin `react` 19.2.3 exactly) and depends on `@json-render/core` at the same version. `@json-render/core` has peer `zod ^4.0.0` and dependency `zod ^4.3.6`. Our catalog has `zod ^4.1.13`. Unpacked sizes are 1.22MB (core) and 0.57MB (react). Real bundle cost is unmeasured.
- **Catalog and registry**: `defineCatalog(schema, { components: { X: { props: z.object(...), description } }, actions: { name: { params: z.object(...), description } } })`, with `schema` from `@json-render/react/schema`. `defineRegistry(catalog, { components, actions })` returns `{ registry, handlers, executeAction }`. Rendering is `<StateProvider store={createStateStore(initial)}><Renderer spec registry/></StateProvider>`, and `store.set("/path", value)` re-renders subscribers.
- **Expressions**:
  - `{ "$state": "/path" }` (read), `{ "$bindState": "/path" }` (two-way, via `useBoundProp(props.value, bindings?.value)`), and `{ "$cond", "$then", "$else" }`, `{ "$template": "…${/path}…" }`, `{ "$computed": fn }`.
  - `repeat: { statePath, key }` with `$item`/`$index`.
  - `visible`: `{ "$state": "/p", eq|neq|gt|not }`, `$and`/`$or`, arrays as AND.
- **Streaming**: `createSpecStreamCompiler<T>()` returns `push(chunk) → { result, newPatches }`, plus `getResult()`, `getPatches()` and `reset()`. The format is JSONL of RFC 6902 ops. `useUIStream({ api: "/api/generate" })` fetches **an HTTP endpoint**. Our generation arrives over Electrobun RPC messages, not HTTP.
- **Doc inconsistencies to settle in the spike**:
  - `Text` takes `text` in our old catalog and in shadcn, but `content` in the AG-UI example.
  - Old `statePath`/`valuePath` props vs `$state`/`$bindState` (and `repeat.statePath`, which still exists).
  - Action handlers are documented both as `setState((prev) => …)` (registry.mdx) and as `setState("/path", value)` (watchers.mdx).

## Commands you will need

| Purpose            | Command                                                          | Expected                          |
| ------------------ | ---------------------------------------------------------------- | --------------------------------- |
| App tests (both)   | `bun run --cwd apps/app test`                                    | all pass (REQUIRED)               |
| One browser test   | `bun run --cwd apps/app test:browser <path>`                     | pass                              |
| Agent / core / rpc | `bun run --cwd packages/agent test`, `…/core test`, `…/rpc test` | pass                              |
| Types / lint       | `bun run check-types`, `bun run check`                           | exit 0                            |
| e2e (browser stub) | `bun run --cwd apps/app e2e`                                     | all pass                          |
| Renderer build     | `bun run --cwd apps/app build`                                   | `dist/` built (bundle numbers)    |
| Desktop dev        | `bun run --cwd apps/app desktop:dev`                             | drive with the `cua-driver` skill |
| Package metadata   | `npm view @json-render/react@<v> version peerDependencies`       | spike evidence                    |

Never report success from `test:unit` alone.

## Implementation rules relevant to this plan

- **Strict TS**: no `any`, no unsafe casts (including `as unknown as X`), no `@ts-expect-error` without a one-line reason. Use `zod` at every system edge: model output, `mini-apps.enc`, RPC payloads from the renderer, MCP/HTTP results (018 owns those), and saved-file imports.
- **React 19 (CLAUDE.md)**:
  - Components stay around 150 lines, one per file, with at most about 6 props and no boolean-prop pile-ups.
  - Hooks own logic, and derived state is never synced through effects.
  - Hotkeys go in a `useXxxHotkeys` hook.
  - Pass `ref` as a prop; never use `forwardRef`.
- **No code comments by default.** Comment only a non-obvious why, in one line.
- **Colocated tests**: `*.test.ts` (pure, jsdom `unit` project) and `*.browser.test.tsx` (vitest-browser-react). Coverage stays at 80% or more. Snapshots cover the empty, loading, error and populated states.
- **Launcher screens** are new `LauncherView` variants in `use-launcher-stack.ts`, never routes. The mini-app _window_ is a route, like boards.
- **Protected contracts**: `CardSpec` and `AskEvent` do not change. `Widget` and `Board` do not change. This plan **adds** `MiniApp`, `PanelSpec` and `MiniAppGenEvent`, which are protected after it lands (see Contracts). It reads `Source` (018) and `ActionDef` (019) without changing them.
- **Runs never call the AI.** Opening a mini-app, changing an input, refreshing, and running an action make no model call. Only "Build an app" and "Change with a prompt…" call the model.
- **Values bind as parameters.** Every source run goes through 018's runner, which compiles `{{name}}` placeholders to driver markers (`compileSqlTemplate`) or to template maps. Nothing is spliced into SQL.
- **Generation never executes an action.** During generation, only _read_ sources run, read-only, with input defaults, to validate cards. Write actions follow owner decision 2 (2026-11-19):
  - each one shows a confirm sheet with the exact target and bound values on every run;
  - SQL write actions need the per-connection opt-in "Allow write actions", which is off by default;
  - SQL write statement templates are reviewed by a human at save time (the model may propose, never execute);
  - values bind as parameters, and every write is appended to the encrypted audit log.
  - MCP tools without `readOnlyHint` count as `write`.
- **The bun side owns the definitions.** The renderer asks to run `{ appId, actionId, runId?, rowIndex?, values }` (never row values; bun resolves the row from 019's run cache) or `{ appId, sourceName, values }`. Bun loads the `MiniApp` from `mini-apps.enc` (or the in-memory draft for a preview) and **never** trusts a source or action definition sent from the renderer.
- **Untrusted prompt material**: MCP tool names and descriptions, HTTP endpoint labels and schema comments go into the generation prompt as delimited data, never as instructions. Element text renders as text only (no `dangerouslySetInnerHTML`, no markdown).
- **Patch safety**: patch paths are allow-listed (Contracts). Any `__proto__`, `constructor` or `prototype` segment rejects the op.
- Keep `@oh-my-query/core` out of `apps/app/src/bun/index.ts` imports (WASM top-level await deadlock).
- AI keys and secrets stay in the bun process.
- **Brand**: warm, craft, trustworthy. Never write "AI-powered", never use sparkle icons. The command is called "Build an app", and the feature's noun is "app" in UI copy ("Apps" section).

## Contracts added (protected after this plan)

Both renderer branches share **one** saved format. The layout is a flat
`{ root, elements }` map. That is json-render's spec shape restricted to our
catalog, so the json-render branch renders it as-is and the in-house branch walks it.

`packages/rpc/src/panel-spec.ts`:

```ts
export const PANEL_ELEMENT_TYPES = [
  "Stack",
  "Grid",
  "Card",
  "ActionButton",
  "Heading",
  "Note",
] as const;
export const MAX_PANEL_ELEMENTS = 24;
export const ElementKey = z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/);
export const InputPath = z.string().regex(/^\/inputs\/[a-z][a-z0-9_]{0,31}$/);
export const SourcePath = z.string().regex(/^\/sources\/[a-z][a-z0-9_]{0,31}$/);
export const SourceFieldPath = z
  .string()
  .regex(/^\/sources\/[a-z][a-z0-9_]{0,31}\/(rows|rowCount|status)$/);
export const Visibility = z
  .object({
    $state: z.union([InputPath, SourceFieldPath]),
    eq: z.union([z.string().max(200), z.number()]).optional(),
    neq: z.union([z.string().max(200), z.number()]).optional(),
    gt: z.number().optional(),
    not: z.literal(true).optional(),
  })
  .strict();
const Leaf = {
  children: z.array(ElementKey).max(0).default([]),
  visible: Visibility.optional(),
};
const Branch = {
  children: z.array(ElementKey).max(MAX_PANEL_ELEMENTS).default([]),
  visible: Visibility.optional(),
};
export const PanelElement = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Stack"),
    props: z
      .object({
        direction: z.enum(["vertical", "horizontal"]),
        gap: z.enum(["s", "m", "l"]),
      })
      .strict(),
    ...Branch,
  }),
  z.object({
    type: z.literal("Grid"),
    props: z.object({}).strict(),
    ...Branch,
  }),
  z.object({
    type: z.literal("Card"),
    props: z
      .object({
        data: z.object({ $state: SourcePath }).strict(),
        spec: CardSpec,
        view: CardViewKind,
        size: TileSize,
        rowActions: z.array(z.string().min(1).max(100)).max(4).default([]),
      })
      .strict(),
    ...Leaf,
  }),
  z.object({
    type: z.literal("ActionButton"),
    props: z.object({ action: z.string().min(1).max(100) }).strict(),
    ...Leaf,
  }),
  z.object({
    type: z.literal("Heading"),
    props: z.object({ text: z.string().trim().min(1).max(80) }).strict(),
    ...Leaf,
  }),
  z.object({
    type: z.literal("Note"),
    props: z.object({ text: z.string().trim().min(1).max(280) }).strict(),
    ...Leaf,
  }),
]);
export const PanelSpec = z
  .object({ root: ElementKey, elements: z.record(ElementKey, PanelElement) })
  .superRefine(checkPanelStructure);
```

`checkPanelStructure` requires the following:

- the root exists;
- every child key exists;
- there are no cycles and no element with two parents;
- every element is reachable from the root;
- depth is at most 4 and there are at most `MAX_PANEL_ELEMENTS` elements;
- a `Card` appears only inside a `Grid` or `Stack`.

`Card.props.spec.insight` must be absent: the generator strips it, and the schema refines it away, because an insight describes old data (same rule as `run-spec.ts`). The property is called `text`, never `content`.

`packages/rpc/src/mini-app.ts`:

```ts
export const MINI_APP_VERSION = 1;
export const MAX_APP_SOURCES = 8;
export const MAX_APP_ACTIONS = 12;
export const MiniApp = z
  .object({
    version: z.literal(MINI_APP_VERSION),
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(60),
    emoji: z.string().max(8).optional(),
    description: z.string().max(280),
    prompt: z.string().max(4000),
    inputs: z.array(ParamDef).max(MAX_WIDGET_PARAMS),
    inputOptions: z.record(Ident, Ident).default({}),
    sources: z.record(Ident, Source),
    actions: z.array(ActionDef).max(MAX_APP_ACTIONS),
    refreshAfter: z.record(z.string(), z.array(Ident)).default({}),
    layout: PanelSpec,
    values: z.record(z.string(), ParamValue),
    refresh: RefreshInterval,
    createdAt: z.string(),
    updatedAt: z.string(),
    lastOpenedAt: z.string().nullable(),
  })
  .superRefine(checkMiniAppReferences);
export const MiniAppDraft = MiniApp.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastOpenedAt: true,
}).extend({ id: z.string().min(1).max(100).optional() });
```

The fields work as follows:

- `inputOptions` maps a `select` input name to a source name. The input's options are that source's first column (at most 200).
- `refreshAfter` maps an action id to the sources that re-run after it succeeds.
- `values` is keyed by `sharedKey(param)` (`name:type`), the same as `Board.sharedValues`.

`checkMiniAppReferences` requires the following:

- **Inputs:** input names are unique, and no input uses `optionsSql`, because a mini-app input has no connection of its own. Use `inputOptions` instead.
- **Layout references:** every `Card.data.$state` names a key in `sources`, and every `rowActions`/`ActionButton.action` is an `actions[].id`. Every `Visibility.$state` names an existing input or source.
- **Option and refresh maps:** each `inputOptions` key is a `select` input and each value is a source. Each `refreshAfter` key is an action id and each value is a source.
- **Action bindings:** every `ActionDef.bind` entry that reads an input names an existing input.
- **Size limit:** there are at most `MAX_APP_SOURCES` sources.
- **Not checked here:** placeholder names inside source templates. The bun boundary checks them, because that check needs the dialect lexer (Step 2.2).

`MiniAppGenEvent` (in `mini-app.ts`), streamed bun → renderer as message
`miniAppGenEvent: { genId, event }`:

```ts
export type MiniAppGenPhase = "plan" | "sources" | "layout" | "check";
export type MiniAppGenErrorCode =
  | "NO_AI_SETTINGS"
  | "AI_AUTH"
  | "AI_RATE_LIMIT"
  | "AI_NETWORK"
  | "INVALID_APP"
  | "TIMEOUT"
  | "CANCELLED";
export type DraftPatch =
  | { op: "add" | "replace"; path: string; value: unknown }
  | { op: "remove"; path: string };
export type MiniAppGenEvent =
  | { type: "phase"; phase: MiniAppGenPhase; detail: string }
  | { type: "patch"; ops: DraftPatch[] }
  | { type: "sourceResult"; name: string; result: TabularResult }
  | { type: "sourceError"; name: string; message: string; repairing: boolean }
  | { type: "error"; code: MiniAppGenErrorCode; message: string }
  | { type: "done"; draft: MiniAppDraft; notes: string[] };
```

**Stream format.** The model writes one RFC 6902 op per line (JSONL), which is
json-render's SpecStream format. Allowed paths (`packages/rpc/src/mini-app-patch.ts`,
pure, shared by both sides): `/name`, `/emoji`, `/description`, `/refresh`,
`/inputs/<index|->`, `/inputOptions/<ident>`, `/sources/<ident>`, `/actions/<index|->`,
`/refreshAfter/<id>`, `/layout/root`, `/layout/elements/<key>`. A whole value is
written per op, never a deep sub-path. `applyDraftPatch(draft, op)` returns
`{ ok: true, draft } | { ok: false, reason }`. Bun validates each op's value against
its zod piece (`ParamDef`, `Source`, `ActionDef`, `PanelElement`, …) **before**
forwarding it, so the renderer applies only valid ops. Whole-document refinements
(`checkPanelStructure`, `checkMiniAppReferences`) run only at `done`, and while
streaming the renderer tolerates missing children.

**Storage**: `mini-apps.enc` via `createMiniAppStore(parse)` in `packages/core/src/mini-apps.ts`
over `createRecordStore`, with `miniAppsPath()` in `paths.ts`. `parseMiniApp(raw)`
first runs `migrateMiniApp(raw)` (v1: identity; the switch exists so v2 has a home),
then `MiniApp.safeParse`. A record with an unknown `version` is not listed but is
**kept** on every write, as `records.ts:78` guarantees. Any change to `MiniApp`,
`PanelSpec`, or an embedded `Source`/`ActionDef` shape bumps `MINI_APP_VERSION` and adds
a migration with a test that loads a v1 fixture.

## Phases and steps

### Phase 0: json-render spike (time-boxed to 1 working day). STOP afterwards.

Work on a throwaway branch `spike/020-json-render`. **Nothing from it merges.**
Build the smallest thing that answers each criterion: the six catalog components as
stubs, plus a real `Card` over `AskCard` with a fixture `CardResult`. Write the report
to `.factory/validation/020-json-render-spike.md`. The report holds a table with one
row per criterion (result, evidence such as a command, version or number, and a
note), the chosen branch, and the exact version to pin.

| #   | Criterion                  | How to check                                                                                                                                                                                                  | Pass when                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Release health             | `npm view @json-render/core time --json`; read the GitHub release notes / CHANGELOG from 0.20.0 to latest.                                                                                                    | A release **at least 14 days old** exists (0.22.0, 2026-11-04, at planning time) that passes S2–S10, and no breaking change in the last 90 days touched `{root, elements}`, `$state`, `visible`, `createStateStore` or `defineRegistry` typing. Pin it **exactly** (no `^`).                                             |
| S2  | React 19                   | `bun add -E @json-render/core@<v> @json-render/react@<v>` in the spike branch; render under `<StrictMode>` with `motion` children.                                                                            | No peer warnings with `react` 19.2.3, and no console warnings (no `forwardRef`/legacy-context warnings).                                                                                                                                                                                                                 |
| S3  | One zod                    | `bun pm ls --all \| rg zod`                                                                                                                                                                                   | A single zod 4 copy resolves. If it needs the root catalog bumped to `^4.3.6`, that is allowed when every workspace's tests pass. Two copies = FAIL.                                                                                                                                                                     |
| S4  | Bundle cost                | `bun run --cwd apps/app build` before and after; compare gzip sizes per chunk (`gzip -c <file> \| wc -c`). Load json-render through a dynamic `import()` from the mini-app route and preview view.            | The launcher's main chunk grows **≤ 5 KB gzip**, and the lazy mini-app chunk adds **≤ 60 KB gzip**.                                                                                                                                                                                                                      |
| S5  | Catalog restricted to ours | `defineCatalog` with exactly our six types and our one action; `defineRegistry` with our components. Feed a spec containing `"type": "Button"` and one with an extra prop.                                    | Types check under our strict tsconfig with **no casts**. `validateSpec` (or the pinned equivalent) reports the unknown type; `<Renderer>` renders nothing for it (or our fallback), never a library default. Our `PanelSpec` fixtures validate unchanged.                                                                |
| S6  | External store             | `createStateStore({ inputs, sources })` in `<StateProvider store>`; `store.set("/sources/orders", slot)`; count renders with a counter in each component.                                                     | Only the components bound to `/sources/orders` re-render. The store can also be read outside React, for our run hooks.                                                                                                                                                                                                   |
| S7  | Bindings and visibility    | `{ "$state": "/sources/orders" }` into `Card.data`; `visible: { "$state": "/inputs/region", "eq": "EU" }`; `{ "$bindState": "/inputs/region" }` with `useBoundProp`; `repeat.statePath` over positional rows. | `$state` and `visible` work as documented. Record the actual `$bindState`/`useBoundProp` signature and whether `repeat` needs keyed records (lesson 5). v1 does not use `$bindState` or `repeat`; they are recorded for v2 forms.                                                                                        |
| S8  | Named actions              | Catalog action `run_action` with `params: z.object({ actionId: z.string() })`; wire an element event to it using the pinned syntax; send bad params.                                                          | The handler receives typed params; bad params never reach it; an unknown action name fails validation. Record the real `setState` signature (doc inconsistency).                                                                                                                                                         |
| S9  | Stream format              | Push our JSONL fixture (with a line split across chunks and one malformed line) through `createSpecStreamCompiler<T>()` in a **bun** script; try `useUIStream` with a non-HTTP source.                        | Informational. Our lines are valid SpecStream lines. Record whether the compiler is DOM-free and generic over `T`, and whether `useUIStream` accepts a custom transport. **Decision already made:** we keep our own `applyDraftPatch` either way, because we need per-op allow-listing and validation before forwarding. |
| S10 | Stable keys and motion     | Remove one element and add one sibling while counting mounts; wrap elements in `motion.div layout` inside `AnimatePresence`.                                                                                  | Element keys become React keys: removing one element does not remount its siblings, and exit animations run.                                                                                                                                                                                                             |
| S11 | Error isolation            | Throw inside one registry component.                                                                                                                                                                          | Informational. Record whether json-render isolates a failing element. Either way we wrap each element in our own boundary.                                                                                                                                                                                               |

The report must also settle the three doc inconsistencies (`text` vs `content`,
`statePath`/`valuePath` vs `$state`, and the two `setState` forms) against the pinned
version's `.d.ts`.

**Decision rule.**

- **json-render branch**: S1, S2, S3, S4, S5, S6, S7 (`$state` and `visible`), S8 and S10 all pass. json-render becomes the **renderer** behind our catalog adapter, with its external store. The saved format and stream format stay as in Contracts.
- **In-house branch**: any one of those fails. Build the in-house `PanelSpec` renderer: a walker, a store and a `visible` evaluator, about 300 lines (Step 3.2b).
- Neither branch changes the bun side, the contracts, the generation, or the UI around the panel.

**STOP after Phase 0.** Report the table, the recommended branch and the pin. Wait
for the owner's choice (owner confirmed this review gate on 2026-11-19). Delete the spike branch's prototype once the report exists.

### Phase 1: Contracts and storage

#### Step 1.1: `panel-spec.ts`, `mini-app.ts`, `mini-app-patch.ts` (rpc)

Create the files exactly as in Contracts and export them from `packages/rpc/src/index.ts`.
`ElementTypeDocs` is a `Record<(typeof PANEL_ELEMENT_TYPES)[number], string>` holding
one sentence per type, used for the prompt. A missing type is a compile error, which
fixes the drift lesson. Add pure layout ops beside the contract, following the
`board.ts:89-152` style: `moveChild`, `resizeCard`, `setCardView`, `removeElement`
(removing a Card whose source no other Card uses also offers source removal in the UI;
the op itself only removes the element) and `removeSource` (which removes the Cards
bound to it).

#### Step 1.2: `mini-apps.enc` store (core)

`packages/core/src/mini-apps.ts` → `createMiniAppStore(parse)` returns `listMiniApps`,
`getMiniApp`, `saveMiniApp`, `deleteMiniApp`, `updateMiniApp`. Add `miniAppsPath()` to
`paths.ts`. Model this on `widgets.ts`/`boards.ts`.

### Phase 2: Bun side

#### Step 2.1: Generation (agent)

Create `packages/agent/src/generate-mini-app.ts`:
`async function* generateMiniApp(input, ports, signal): AsyncGenerator<MiniAppGenEvent>`,
in the same pure-generator-over-ports style as `runAsk`.

- **`input`** is `{ prompt, base: MiniAppDraft | null, catalog: SourceCatalog, actionTargets: ActionTargetCatalog }`.
  - `SourceCatalog` lists the active connection (id, name, dialect, and a schema summary from `selectRelevantSchema` + `formatSchemaForPrompt` with redaction), plus 018's MCP servers (tool name, description, input JSON schema, `readOnlyHint`) and HTTP endpoints.
  - `ActionTargetCatalog` is 019's list of allowed targets, with each connection's write opt-in flag.
- **`ports`** is `{ model, runSource(source, values, signal): Promise<TabularResult>, now() }`.
- **Prompt**: the system prompt comes from `panelCatalogPrompt()`, built from `ElementTypeDocs` plus `z.toJSONSchema` of `PanelElement`, `ParamDef`, `Source` and `ActionDef`. It holds the patch grammar with a short worked example, and these rules:
  - layouts hold pointers only;
  - emit in order: name → inputs → sources → actions → layout root → elements, top-down;
  - `select` inputs take options from `inputOptions`, never `optionsSql`;
  - write actions are proposals a person will review;
  - no `insight`.
- **Untrusted material**: the catalog goes inside a clearly delimited data block. `base`, when set, is the current app JSON, and the model emits only the ops that change it.
- **Streaming**: stream with `streamText`. Split the text into lines and coalesce forwarded ops to one `patch` event per `SQL_DELTA_INTERVAL_MS` (32ms). Validate each op as described in Contracts; drop invalid ops and collect their reasons.
- **Early source runs**: as soon as `/sources/<name>` lands, and when the source is _read_ (a SQL source; an MCP tool with `readOnlyHint`; an HTTP GET), run it once with input defaults through `ports.runSource`, at most 3 concurrently. Emit `sourceResult` or `sourceError`.
- **Check at end of stream**: run `MiniAppDraft.safeParse`. For each SQL source, run `compileSqlTemplate` with defaults; an unknown or unused placeholder is a problem. Then run `checkCardAgainstResult` for each Card against its source's result, and gather dropped-op reasons.
- **Repairs**: problems trigger up to **2 repair rounds**. A repair sends the current draft plus a numbered problem list, and the model replies with ops.
- **Done or error**: emit `done` with `notes` (for example, "Left Refund unsaved until you review it"), or `error` with code `INVALID_APP`.
- **Error mapping**: map AI errors with `classifyAIError`, as `ask.ts` does. The timeout is 90s.

Export it from `packages/agent/src/index.ts`.

#### Step 2.2: Services and RPC (app bun)

- **`apps/app/src/bun/mini-app-service.ts`**:
  - CRUD over the store.
  - `runMiniAppSource({ target: { kind: "saved"; appId } | { kind: "draft"; genId }, sourceName, values, runId })` → `{ result }`. It validates `values` with `paramValueSchema` per input, fills missing values from `values`/defaults, maps `name:type` keys to template names, delegates to 018's `runSource` with a 30s timeout and 2,000 rows, and keeps a cancel map. It never calls the AI.
  - `cancelMiniAppRun({ runId })`.
  - `loadMiniAppInputOptions({ target, inputName })` runs the mapped source and returns the first column, capped at 200.
  - `saveMiniApp({ draft, reviewedWriteActionIds })` refuses to save if any `write` action is not in `reviewedWriteActionIds`, or targets a connection whose write opt-in is off. The error message names the action.
  - `markOpened(appId)`.
  - Every change broadcasts `miniAppChanged({ appId })` to all live RPCs, like `boardChanged`.
- **`apps/app/src/bun/mini-app-gen-service.ts`**:
  - One active generation at a time; a new start cancels the previous one.
  - It keeps the last 3 drafts in memory by `genId` for preview runs.
  - It broadcasts `miniAppGenEvent` to every live RPC, and renderers filter by the `genId` they started. Today `askEvent` only reaches the launcher (`rpc.ts:169`), and regeneration can start from a mini-app window.
  - Requests: `generateMiniApp({ genId, prompt, connectionId, database, baseAppId })` and `cancelMiniAppGeneration({ genId })`.
- **Run cache**: every successful `runMiniAppSource` records its result in 019's `run-cache.ts` under its `runId` (019 caches launcher widget runs only; extend its recorder to accept mini-app runs, same 20-run / 10-min bounds).
- **Actions** follow 019's two-step flow, never a one-shot call:
  - `prepareMiniAppAction({ appId, actionId, runId, rowIndex, values })` resolves the `ActionDef` from the stored app (never from the renderer) and delegates to 019's `prepareAction` with `ActionContext { runId, rowIndex, values }`. It returns 019's `ActionPreview` (token, compiled call, bound values).
  - The renderer shows 019's confirm sheet for `write` (every time) and calls 019's `executeAction({ token })`. `read` and `external` follow 019's rules.
  - After success, bun returns `{ refreshed: refreshAfter[actionId] ?? [] }` so the renderer re-runs those sources. Confirm, opt-in and audit stay 019's job.
- **Wiring**: add every request and message to `packages/rpc/src/schema.ts` and wire them in `rpc.ts`. Generalize `board-windows.ts` into `panel-windows.ts`:
  - `PanelRef = { kind: "board" | "app"; id }` and `open(ref, title)`, with URL `#/board/:id` or `#/app/:id`.
  - Frames persist by `frameKey(ref)`. Boards keep their bare id so the existing `board-frames.json` still restores; apps use `app:<id>`.
  - Rename `FocusState`'s `*BoardId` fields to window keys in `focus-policy.ts`, and rename `toggleLauncher({ fromBoardId })` to `{ fromWindowKey }`. Update `index.ts`, the board view caller and the IPC stub.
  - Add `openMiniApp({ appId })`.

### Phase 3: Renderer: the panel and the launcher flow

#### Step 3.1: Shared pieces (`apps/app/src/mainview/components/mini-app/`)

- **`mini-app-state.ts`**: a store with the state shape `{ inputs: ParamValues /* by input name */, sources: Record<name, WidgetRunState> }`. Reuse `widgetRunReducer` for each source slot. The store is `createMiniAppStore()` over `useSyncExternalStore`, or json-render's `createStateStore` in that branch, behind the same `MiniAppStateStore` interface (`get`, `set`, `subscribe`).
- **Run queue**: extract the queue and cancel logic from `board/use-board-refresh.ts` into `hooks/use-run-queue.ts` (`useRunQueue({ max: 4, start(key, runId), cancel(runId) })`). Port boards onto it and keep `use-board-refresh.browser.test.tsx` green. Mini-apps are the second caller, which justifies the extraction.
- **`use-mini-app-runs.ts`** runs sources (at most 4 at a time), handles the visible-only `refresh` interval, and re-runs after actions.
- **`mini-app-inputs.ts`** (pure): `sourcesUsing(app, inputName)` scans each source's templates for `{{name}}`/`{{name.from|to}}`. `affectedSources(app, changedKeys)` reuses `changedKeys` from `board-inputs.ts`.
- **Option loading**: generalize `ArgumentInput.widgetId` into `owner: { kind: "widget"; widgetId } | { kind: "mini-app"; target }`. `useParamOptions(owner, param)` picks `loadParamOptions` or `loadMiniAppInputOptions`. Update the widget and board callers.
- **Elements** (`elements/`): `panel-stack.tsx`, `panel-grid.tsx` (12 columns with `spanFor` from `board-grid.tsx`), `panel-card.tsx`, `panel-action-button.tsx`, `panel-heading.tsx`, `panel-note.tsx`. Each takes **resolved props only**.
  - `PanelCard` renders `WidgetRunBody` with `runSpec`-style title and subtitle and the card's `view`.
  - Every element is wrapped in `element-boundary.tsx`, which shows an inline "This part couldn't be shown" with the element key.
  - `PanelActionButton` shows an effect cue: `write` gets a small "Writes" label in `type-micro` amber; `external` gets an arrow-out icon.

#### Step 3.2a (json-render branch): `json-render-panel.tsx`

Adapter: `defineCatalog(schema, { components: zod props from PanelElement, actions: { run_action } })`, then `defineRegistry` maps each type to our element components, with zero casts. `<StateProvider store>` + `<Renderer>`. Load it with a dynamic `import()` (bundle budget S4). Pin the exact version in `apps/app/package.json`.

#### Step 3.2b (in-house branch): `panel-renderer.tsx` + `panel-visibility.ts`

`PanelRenderer({ layout, store, onAction })` walks from `root`. It resolves
`{ $state }` with `usePanelValue(path)` (`useSyncExternalStore` selector) and renders
`ELEMENTS: { [T in PanelElementType]: Component }` (a mapped type, so exhaustiveness
is checked at compile time). Element keys are React keys. `panel-visibility.ts`
provides `isVisible(cond, state)`, a pure function that is tested in a table. The
budget is about 300 lines total.

#### Step 3.3: Launcher flow

- **Root.** With free text and AI ready, a second row follows "Ask {connection}": **"Build an app: “…”"**. Add a root command **"New App"** (id `new-app`, next to `new-board` in `root-commands.ts`). Add an **"Apps"** section between Widgets and Boards (`RootSection.id` gains `"apps"`, and `RootItem` gains `{ kind: "mini-app"; id; app }`).
  - Each row shows the emoji, name and description, plus a meta line naming the source kinds and action count ("Postgres · Stripe · 2 actions").
  - ↵ opens the window and hides the launcher.
  - ⌘K offers Rename, Duplicate, Change with a prompt…, and Delete (two-step, via `use-armed-confirm`).
  - Add `MiniAppsProvider` modeled on `widgets/widgets-provider.tsx`.
- **`mini-app-generate` view.** Add the `LauncherView` variant `{ kind: "mini-app-generate"; prompt: string; baseAppId: string | null }`.
  - On push, the panel morphs **once** to `PANEL_MAX_HEIGHT` and stays there. The draft assembles inside a fixed scroll frame, so the surface never changes height per frame.
  - A header shows the prompt and a phase line (`SwapText`: "Choosing data…", "Checking orders…", "Laying out…", "Ready").
  - `use-mini-app-generation.ts` with the pure `mini-app-gen-reducer.ts` holds `{ draft, phase, sourceSlots, changedKeys, notes, error }`. It applies patches with `applyDraftPatch` in one `requestAnimationFrame` batch per message.
  - The inputs bar renders as soon as inputs arrive, reusing `ArgumentPills` with the mini-app owner. Changing an input in preview re-runs only the affected sources (`target: draft`).
  - Esc cancels the generation, then pops.
- **Review and save (⌘S).** An inline sheet expands under the header, with the same pattern as the widget save:
  - a name field (prefilled);
  - inputs (rename or remove; a removed input becomes `fixed`, never spliced, as in widgets);
  - sources listed with their kind and their SQL template or tool call shown read-only;
  - actions with effect badges.
  - Each `write` action needs its own **"I reviewed this"** checkbox showing 019's template preview. If its connection's writes are off, the row is disabled and reads "Writes are off for {connection}", with a link to Settings.
  - ⌘↵ saves, and the footer then `SwapText`s to "Saved · ↵ to open".
- **Errors** reuse `ask-error` copy patterns. `NO_AI_SETTINGS` offers AI setup; `INVALID_APP` shows "Couldn't build a working app from that. Try naming the data you want." plus the first problem.

#### Step 3.4: Actions in the panel

- **Panel buttons** call `prepareMiniAppAction`. A `read` action executes its token immediately and gives inline feedback (copy → `use-copy-feedback`). A `write` action opens 019's confirm sheet (`components/actions/confirm-sheet/`) with the preview's exact target and bound values, on **every** run, and only ⌘↵ there calls `executeAction({ token })`. `external` follows 019's rule.
- **Row actions**:
  - Reuse 019's row selection in `CardTable` and its row menu; pass the card's `runId` and the selected `rowIndex`.
  - Only if 019 shipped without them: ↑/↓ selects a table row inside a focused Card, and ⌘K lists that card's row actions for the selected row. Either way the renderer sends `runId` + `rowIndex`, never row values (lesson 5's keyed row is built bun-side from the run cache).
- After success, re-run `refreshed` sources using stale-while-revalidate. A failure shows inline in the Card or the button area, never as a toast.

### Phase 4: The mini-app window, editing and regeneration

#### Where a mini-app opens: its own window (recommended)

Generation and preview happen in the launcher, because that is where the question
is typed and where the assembly moment belongs. A **saved** mini-app opens in its
own window at `#/app/:appId`, like a board, for four reasons:

1. The launcher hides on blur, so it would lose state mid-task. That happens when you copy an id from elsewhere, or when a write confirm is open.
2. A grid of several cards plus inputs does not fit `PANEL_MAX_HEIGHT` (680).
3. The window can refresh on an interval with the board's visibility gating.
4. The launcher surface must not host content whose height changes every frame.

The rejected alternative was running saved apps as a launcher view. It is
quicker to summon, but it fails points 1–3. A future "peek" can show one card of an
app in the launcher.

- **`routes/app.$appId.tsx`** is thin and renders `<MiniAppView appId key>`.
- **`mini-app-view.tsx`** composes the following:
  - `mini-app-header.tsx`: emoji, name, refresh select, "Updated 2m ago" (reuse `updatedLabel`), ⌘R, ⌘E.
  - The inputs bar: `BoardFilters` pattern with copy "Applies to every part that uses it".
  - The panel renderer.
  - The window sets `data-surface="app"` like `useBoardSurface`.
- **Inputs**: changing a value re-runs only `affectedSources`, and each affected Card gets the board's one-shot tint. Values persist to `MiniApp.values` with `saveMiniApp`.
- **Edit mode (⌘E)**: reuse `use-tile-drag.ts` and the `⌥←/→` and `⌥↑/↓` handling for Cards inside a Grid, through `moveChild`/`resizeCard`. Other edits:
  - rename the app;
  - change a card's view, which persists `props.view`;
  - remove a card (two-step);
  - remove an input (it becomes `fixed`);
  - remove an action;
  - remove a source (cascades its cards after a two-step confirm).
  - There is **no hand-editing of SQL** in v1, the same as widgets.
- **"Change with a prompt…"** (⌘K → it, or ⌘⇧E): an inline prompt field calls `generateMiniApp({ baseAppId })`. Ops patch a **copy** of the app in place, unchanged elements stay mounted, and changed ones tint. ⌘S runs the same review rules (any new or changed `write` action needs a fresh review), and Esc discards the copy.
- **`use-mini-app-hotkeys.ts`** holds ⌘R, ⌘E, ⌘K, ⌘⇧E and Esc. The launcher hotkey forwards with `toggleLauncher({ fromWindowKey })`.
- **Missing pieces**: a source whose connection or MCP server was deleted shows the widget-style "Choose a connection" rebind inside its Card. For a server, it reads "This server was removed" with no rebind in v1.

### Phase 5: Browser stub, e2e, docs and evidence

- **`lib/browser-mini-app-stub.ts`** replays a recorded generation. The prompt "refund desk" gives two sources, one `write` action and a Grid of 3 cards. A prompt containing "broken" fails after 2 repairs. It also handles runs and actions, logs to `globalThis.__omqIpcLog`, and `openMiniApp` opens `#/app/:id` in a new tab.
- **Docs**: in `CLAUDE.md`, add a "Mini-apps" bullet under Architecture (contracts, files, the runs-never-call-AI rule, and the reviewed-write rule), and add the entry points to `README.md`. Keep the brand voice.
- Gather the motion evidence (Done criteria).

## UI and motion (mandatory)

The tokens are listed in Current state. These rules are inlined from the system:

- **Respond and interrupt**: respond on press, not on release. Everything is interruptible, and springs retarget from their current value.
- **Exits**: exit the way you entered, at about 70% of the entrance duration.
- **What animates**: animate only `transform`, `opacity` and `filter`; use `layout` (FLIP) for size and position.
- **One motion per moment**: allow one primary motion per moment, and only progress indicators loop.
- **No flicker**: a loading state shorter than 150ms never shows; once shown, it stays at least 300ms (`useDelayedVisibility`).
- **Reduced motion**: travel becomes a crossfade (`REDUCED_FADE`) or an instant change; feedback stays.
- **Reduced transparency**: surfaces become opaque (`launcher-material` falls back).
- **Increased contrast**: borders become solid and muted text is promoted.
- **Always on**: focus rings always show. Live regions announce state ("Orders loaded", "Refund needs confirmation"), never animation frames.

**Assembly performance**: apply patches at most once per animation frame. A Card
mounts recharts only once its source has a result; before that it shows a skeleton.
Never animate height on the launcher surface during streaming; the frame is
pre-grown once.

### Motion moments in this plan

| Moment                         | Trigger                                           | What moves                                                                                                                                                                                                       | Token                                    | Reduced motion                |
| ------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------- |
| Build starts                   | ↵ on "Build an app"                               | The view pushes. The panel grows **once** to its max height; the prompt row morphs into the header via `layoutId="app-prompt"`; the phase line `SwapText`s.                                                      | `SPRING` (push), `SPRING_SOFT` (height)  | Crossfade; instant height     |
| **Element arrives**            | A `patch` adds `/layout/elements/<k>`             | The slot enters with opacity and a 6px rise. Siblings reflow via `layout`. Several ops in one frame batch stagger. A Card arrives as an outlined skeleton titled with `spec.title`, **never as an empty frame**. | `SPRING_SOFT`, `staggerDelay`, `SPRING`  | Instant appear                |
| Inputs arrive                  | `/inputs/-`                                       | Pills slide out `x -8→0` with opacity, staggered (same as the widget argument pills).                                                                                                                            | `SPRING`, `staggerDelay`                 | Instant                       |
| Source data lands              | `sourceResult`                                    | The Card skeleton crossfades to the chart; recharts plays its intro (`intro="play"`); the header `rows · ms` `SwapText`s.                                                                                        | `FADE_IN`, recharts intro                | Instant swap, no chart intro  |
| Source repairs                 | `sourceError` with `repairing`                    | The Card dims to 0.6 with the progress hairline and an inline amber "Fixing this query…" line. No shake.                                                                                                         | `FADE_IN`                                | Static hairline               |
| Element replaced               | A `replace` op (repair or "Change with a prompt") | Content crossfades in place; position changes via `layout`; a one-shot amber outline tint fades over 600ms.                                                                                                      | `FADE_IN`, `SPRING`, `FADE_OUT` 600ms    | Tint without fade             |
| Element removed                | A `remove` op                                     | Fades and scales to 0.98, then siblings close the gap via `layout`.                                                                                                                                              | `FADE_OUT`, `SPRING`                     | Instant                       |
| Ready                          | `done`                                            | The phase line `SwapText`s to "Ready · ⌘S to save" with `CheckDraw`. A live region announces it.                                                                                                                 | `FADE_IN`, `DRAW`                        | No draw                       |
| Cancel build                   | Esc while streaming                               | Assembled elements fade out in reverse order (capped stagger); the view pops; the panel morphs back to the root height.                                                                                          | `FADE_OUT`, `SPRING_SOFT`                | Instant pop                   |
| Review sheet                   | ⌘S                                                | The sheet expands under the header via `layout`; write-action rows `Reveal` with the template preview; the checkbox tick uses `SPRING_SNAPPY`.                                                                   | `SPRING_SOFT`, `SPRING_SNAPPY`           | Instant                       |
| Saved, then open               | ⌘↵, then ↵                                        | The footer `SwapText`s to "Saved". On ↵ the launcher plays its exit, and the window's cards stagger in **after** the first data or skeleton exists (as the board opens).                                         | `FADE_IN`, `SPRING_SOFT`, `staggerDelay` | Instant                       |
| Input change                   | An inputs-bar commit                              | Only the affected Cards dim to 0.6 with the hairline (stale-while-revalidate), get the one-shot tint, and recharts transitions between data (300ms).                                                             | `FADE_IN`, `FADE_OUT` 600ms              | Instant swap; static hairline |
| Action press                   | Click or ↵ on an ActionButton                     | `Pressable` press scale. A read action's label `SwapText`s to "Copied" or the result.                                                                                                                            | `PRESS`, `FADE_IN`                       | Opacity press                 |
| Write confirm                  | A `write` action                                  | 019's sheet scales 0.96→1 from the trigger; Esc exits by mirroring the entrance. After success, the refreshed Cards revalidate (stale-while-revalidate).                                                         | `SPRING_SNAPPY` / `FADE_OUT`             | Crossfade                     |
| Row action cue                 | Row focus or hover in a Card table                | The action chip fades in at the row end; the keyboard path is ⌘K.                                                                                                                                                | `FADE_IN`                                | Instant                       |
| Edit mode, drag, keyboard move | ⌘E, drag, ⌥-arrows                                | Same as boards: handles `Reveal`, 1:1 pointer tracking, momentum projection on release, reflow via `layout`.                                                                                                     | `SPRING`, `SPRING_MOMENTUM`              | No lift; instant reflow       |
| Element error                  | An element throws                                 | The boundary content crossfades in.                                                                                                                                                                              | `FADE_IN`                                | Instant                       |
| Empty Apps                     | Root, no apps, "app" typed                        | One `Reveal` line: "Describe a tool and press ↵ on Build an app".                                                                                                                                                | `FADE_IN`                                | Instant                       |

## Scope

**In scope**

- `packages/rpc/src/{panel-spec,mini-app,mini-app-patch,schema,index}.ts` and their tests.
- `packages/core/src/{mini-apps,paths,index}.ts` and `mini-apps.test.ts`.
- `packages/agent/src/{generate-mini-app,mini-app-prompt,index}.ts` and their tests.
- `apps/app/src/bun/`:
  - `mini-app-service.ts` and `mini-app-gen-service.ts` (create, with tests);
  - `rpc.ts`, `index.ts`, `focus-policy.ts` (+ test);
  - `board-windows.ts` → `panel-windows.ts`, and `board-frames.ts` (key only).
- `apps/app/src/mainview/`:
  - `components/mini-app/**` (create);
  - `routes/app.$appId.tsx` (create);
  - `hooks/use-run-queue.ts` (create; port `board/use-board-refresh.ts` onto it);
  - `components/widgets/arguments/{argument-pills.tsx,use-param-options.ts,select-pill.tsx}` (the owner generalization);
  - the launcher files `use-launcher-stack.ts`, `root-commands.ts`, `views/root-items.ts`, `views/root-list.tsx`, `views/root-view.tsx`, and `launcher-panel.tsx` (view switch);
  - `board/board-view.tsx` (the `fromWindowKey` rename only);
  - `lib/ipc.ts`, `lib/browser-ipc-stub.ts`, and `lib/browser-mini-app-stub.ts` (create).
- `apps/app/package.json`: the exact json-render pin, **json-render branch only**.
- `apps/app/e2e/mini-app-flow.spec.ts` (create).
- `CLAUDE.md`, `README.md` (Mini-apps docs) and `.factory/validation/020-*.md`.

**Out of scope**

- Changing `Source`, `ActionDef`, `CardSpec`, `AskEvent`, `Widget` or `Board`. Those belong to their own plans.
- `@json-render/shadcn` or any third-party component set.
- Free-form forms, `repeat` lists and `$bindState` editors inside the layout (v2, if the spike shows json-render earns it).
- Background runs, notifications, menu-bar values for mini-apps (plan 014's scheduler, later).
- Hand-editing SQL templates or action statements outside 019's review UI.
- Exporting, importing or sharing mini-apps (plan 015 may add it with `MINI_APP_VERSION`).
- Adding a mini-app to a board.
- Exposing mini-apps through the MCP server (plan 016).

## Git workflow

- Spike: `spike/020-json-render` (throwaway, never merged).
- Build: `feat/launcher-020-mini-apps`, created from the branch that holds 018 and 019. Commit only if authorized; never push or open a PR unless told to.

## Test plan

- **rpc**:
  - `panel-spec.test.ts`: valid fixtures; unknown type; literal data where a pointer belongs (`data: { rows: [...] }` is rejected); `content` instead of `text` is rejected; a cycle, a two-parent element, an unreachable element, depth 5 and 25 elements are each rejected; a Card at root is rejected; `insight` is stripped or rejected.
  - `mini-app.test.ts`: every reference rule in `checkMiniAppReferences` with one passing and one failing case each; `optionsSql` is rejected; limits.
  - `mini-app-patch.test.ts`: every allowed path; disallowed paths (`/version`, `/id`, `/createdAt`, deep sub-paths) and `__proto__`/`constructor` segments are rejected; `-` appends; `remove` on a missing key.
  - The layout ops, at the edges.
- **core** `mini-apps.test.ts`: CRUD round-trip encrypted; a `version: 2` record survives a v1 save; a corrupt file is quarantined; `migrateMiniApp` keeps v1 unchanged.
- **agent** `generate-mini-app.test.ts` (`MockLanguageModelV3` streaming JSONL):
  - the happy path, checking event order (phase → patches → sourceResult → done);
  - a line split across chunks;
  - a malformed line is dropped, then repaired;
  - a Card that names a missing column is repaired via `checkCardAgainstResult`;
  - two failed repairs → `INVALID_APP`;
  - a write source is **not** run during generation, and a write action is never run (the `runSource` spy only sees read sources, and nothing calls an action);
  - `base` produces only the changed ops;
  - cancel mid-stream → `CANCELLED`;
  - the prompt contains every `PANEL_ELEMENT_TYPES` entry, and the catalog block is delimited.
- **bun** tests in `mini-app-service.test.ts`, modeled on `widget-service.test.ts`:
  - values validated against `ParamDef`, and an invalid value is rejected before any run;
  - the renderer cannot supply a source or action definition;
  - save refuses an unreviewed write action, and one whose connection has writes off;
  - `refreshAfter` is returned after an action;
  - `focus-policy.test.ts` passes with window keys.
- **Renderer**, as browser tests unless noted:
  - the generation reducer (unit);
  - `mini-app-generate-view` (assembly order, Esc cancel, the input change re-running only affected sources, the review sheet's write gating);
  - `panel-card` states (skeleton, data, no rows, error, stale-while-revalidate);
  - `panel-action-button` (read runs, write opens the confirm, and confirm cancel runs nothing);
  - `mini-app-view` (inputs, edit-mode keyboard move and resize, regenerate tint);
  - root "Apps" rows and ⌘K;
  - `use-run-queue` (5 keys → 4 in flight, superseded cancel, unmount cancel), with `use-board-refresh` tests unchanged;
  - `isVisible` (unit, table-driven; in-house branch);
  - a test for both motion branches of every animated component.
- **Snapshots**: generate view (streaming, ready, error); review sheet with a gated write action; window (empty data, loading, populated, Card error); root with Apps.
- **e2e** `mini-app-flow.spec.ts` (stub): type "refund desk" and choose "Build an app". Assert the elements appear in stream order. ⌘S, tick review, ⌘↵, ↵ opens `#/app/:id`. Change the date range and assert that the stub log shows only the dependent source re-run. Press Refund on a row and the confirm shows the bound `charge_id`. Confirm and assert exactly one `runMiniAppAction` in the log. Cancel a second one and assert none.

## Done criteria

- [ ] `.factory/validation/020-json-render-spike.md` exists with all of S1–S11, the chosen branch and the pinned version, and the owner's go-ahead is recorded there.
- [ ] `bun run check-types` and `bun run check` exit 0. `bun run --cwd apps/app test` (both projects), the agent, core and rpc tests, and `bun run --cwd apps/app e2e` all pass. Coverage is ≥ 80%.
- [ ] `rg -n "as unknown as" apps/app/src/mainview/components/mini-app packages/rpc/src/{panel-spec,mini-app,mini-app-patch}.ts packages/agent/src/generate-mini-app.ts` finds no matches.
- [ ] `rg -n "@json-render/shadcn" apps/app/package.json` finds no matches. In the json-render branch, both `@json-render/*` versions are exact (no `^`/`~`).
- [ ] Opening, refreshing, changing inputs and running actions make **no AI call**: the browser test asserts on the stub's call log, and desktop dev runs with the network offline for the AI host (sources against the local fixture Postgres).
- [ ] A saved app re-runs on fresh data. In desktop dev, save "Orders by status" against the fixture Postgres, insert a row with `psql`, reopen, and see the new count. `mini-apps.enc` contains no row data (decrypt it in a core test helper and assert that no `rows` key exists).
- [ ] A write action cannot run without the confirm sheet, cannot be saved unreviewed, and cannot be saved for a connection whose writes are off. Each run appends one audit entry (019's log).
- [ ] The launcher's main chunk grows ≤ 5 KB gzip relative to the pre-plan build (before/after numbers are in the PR).
- [ ] In desktop dev (`cua-driver`): build an app from the launcher, watch it assemble, save, open its window, change an input, run a read action, run a confirmed write action against a fixture table, then quit and relaunch to confirm the app persists.
- [ ] Every row of "Motion moments in this plan" is implemented with its token and its reduced-motion fallback, with a browser test per branch. Recordings at 1× and 0.25× (`?slowmo=4`) from desktop dev are attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of (a) a full build streaming into the launcher and (b) an input change on an 8-card app window shows no frame over 16.7ms, and only `transform`, `opacity` and `filter` animate.
- [ ] Reduced Motion, Reduce Transparency and Increase Contrast are each verified on the generate view, the review sheet and the window. Designed empty, loading, populated and error states have snapshots. WCAG AA contrast holds on the translucent panel, including the "Writes" label.
- [ ] `CLAUDE.md` and `README.md` describe mini-apps. The README row for 020 is updated.

## STOP conditions

- **After Phase 0, always.** Wait for the owner to pick a branch.
- **Plans 018 or 019 are not merged**, or `Source`, `ActionDef`, the source runner, the confirm sheet or the write opt-in differ in substance from the drift-check list. Do not invent them here.
- **The model can't produce valid apps.** In desktop dev, with the owner's configured model, if more than 1 of 5 representative prompts fails to produce a valid draft within 2 repairs, report the prompts, the drafts and the problem lists. The prompts are a refund desk, "orders by status with a region input", a GitHub issues triage panel over MCP, a signups KPI with a date range, and a churned-customers table with an "Open in Stripe" action. Do not loosen validation. The alternative to evaluate is AI SDK `Output.object` partial streaming, with ops diffed from partial objects.
- **Any code path lets generation run an action or a write source**, or lets the renderer supply a definition that bun executes. This is a design defect; stop and report.
- **Assembly can't stay smooth.** If the launcher assembly cannot hold a fixed frame without per-frame height changes, or the Timelines bar fails, report the measurements. Never cut a motion row to pass.
- **The json-render branch was chosen, but a later version bump** (needed for a security fix, say) breaks S5–S8. Report it and propose moving to the in-house branch rather than adapting the saved format.
- **The bundle budget is exceeded** after implementation. Report the numbers before you code-split further or drop features.

## Maintenance notes

- `MiniApp` embeds `Source`, `ActionDef`, `ParamDef` and `CardSpec`. A version bump in any of them needs a `MINI_APP_VERSION` bump and a migration in `migrateMiniApp`, with a v1 fixture test. Reviewers: check that a migration never reads row data, because none is stored.
- The saved layout format belongs to us, not to json-render. The saved records never depend on the library's version; only the adapter does. Keep it that way.
- Reviewers should scrutinize these:
  - `mini-app-patch.ts` (path allow-list, prototype keys);
  - the bun-side lookups in `runMiniAppAction`/`runMiniAppSource`;
  - the save gate for write actions;
  - the prompt's untrusted-data delimiting.
- Board windows now go through `panel-windows.ts`, so any new window type should be a new `PanelRef.kind` rather than a third window manager.
- Deferred work:
  - background refresh and alerts for apps, which should reuse plan 014's `widget-scheduler.ts`;
  - forms with `$bindState`, and `repeat` lists (v2);
  - export and import of apps (with plan 015);
  - adding an app's cards to a board;
  - exposing apps as MCP tools (plan 016, read-only only).
