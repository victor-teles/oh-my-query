# Plan 018: Widgets can read from MCP tools and HTTP endpoints, not only SQL

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- packages/rpc packages/core packages/agent apps/app/src`
> and `git status --short`. Plans 001–007 sit uncommitted in the working tree and
> are this plan's baseline. Confirm before starting:
> `packages/rpc/src/widget.ts` still exports `Widget` with top-level
> `connectionId`/`database`/`dialect`/`sqlTemplate` (lines 243–261);
> `packages/core/src/records.ts` still exports `createRecordStore`;
> `apps/app/src/bun/widget-service.ts` still owns `runWidget`;
> `apps/app/src/mainview/components/board/use-board-refresh.ts` still calls
> `runWidget` for every tile. If plan 015 (export/import) landed first, its
> import path must accept the v2 `Widget` produced here — reconcile in Step 2.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH (spawns user-configured processes, makes network calls with stored secrets, migrates a protected contract)
- **Depends on**: none (plans 006 and 007 are the baseline)
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19, branch `feat/launcher-002-shell`; the working tree with plans 001–007 implemented but uncommitted is the baseline.

## Why this matters

Today a widget is one SQL template on one database connection. The numbers a
developer watches every morning live in more places than their database:
Stripe, GitHub, Linear, PostHog, an internal admin API. This plan generalizes
the widget's data producer into a **Source**: a SQL template (today), an **MCP
tool call**, or an **HTTP GET**, each returning the same `TabularResult` so the
same `CardSpec` cards, argument pills and boards work unchanged. A board can
then show Postgres revenue next to open Stripe disputes. It is the first step
toward mini-apps (plan 020) and the foundation for actions (plan 019). The
read-only promise holds: sources are read-only by construction, runs never call
the AI, and input values travel as typed JSON values or bind parameters, never
as concatenated strings.

## Current state

- `packages/rpc/src/widget.ts` — the protected `Widget` contract (lines
  243–261): `connectionId`, `database`, `dialect`, `sqlTemplate` sit at the top
  level next to `spec`, `view`, `params`, `lastValues`. `ParamDef`
  (lines 109–122) is a discriminated union on `type`
  (`date | dateRange | number | text | select`), `select` may carry
  `optionsSql`. `toTemplateValue(def, value, now)` (lines 205–238) resolves
  presets into a `TemplateValue`. `WidgetRunResult` (lines 300–304) is
  `{ result: TabularResult; compiledSql: string; values }`.
- `packages/core/src/records.ts` — `createRecordStore(filePath, parse)`
  persists **an encrypted JSON array** (one `encryptLine` blob, AES-GCM, key in
  `~/.config/oh-my-query/.key`, mode 0600) written by `atomicWrite` under
  `withFileLock`. There is **no version field and no migration hook**. The rule
  that makes a migration safe is at line 78: _"Records the parser rejects (a
  newer or older shape) are kept on every write."_ `updateWhere` (lines 88–105)
  rewrites only the records it changes; everything else is written back raw.
  An unreadable file is quarantined (`.corrupt-<ts>`), never overwritten.
- `packages/core/src/widgets.ts` — `createWidgetStore(parse)` over
  `widgetsPath()` (`widgets.enc`). `packages/core/src/paths.ts` holds every
  path; `packages/core/src/persistence.ts:357` `resetSecrets()` deletes every
  encrypted file.
- `apps/app/src/bun/widget-service.ts` — `createWidgetService(deps)`.
  `defaultWidgetStore()` (line 79) parses with `parseWith(Widget)`.
  `runWidget` (lines 322–352) validates values (`resolveValues`, zod via
  `paramValueSchema`), guards with `assertReadOnly`, compiles with
  `compileSqlTemplate`, executes `{ readOnly: true, params }` with
  `WIDGET_MAX_ROWS = 2000` and a 30 s `raceWithCancel`, then updates
  `lastValues`/`lastRunAt`. `saveWidget` (354–368) runs `checkDraft`.
- `apps/app/src/bun/rpc.ts` — `createAppRpcs(host)` wires every handler; all
  errors pass through `encodeRpcError`. `apps/app/src/bun/ai-settings-service.ts`
  is the exemplar for secrets: zod-parse input, store encrypted, return only a
  redacted shape (`hasKey`, `keyHint`).
- `apps/app/src/bun/index.ts:1` — _"Don't import @oh-my-query/core here"_
  (WASM top-level-await deadlock). New bun modules are imported from `rpc.ts`,
  never directly from `index.ts`.
- `apps/app/src/mainview/components/board/use-board-refresh.ts` — every tile
  calls `runWidget({ runId, values, widgetId })` (line 70), at most 4 at once,
  cancels superseded runs. It never inspects the SQL. Mixed tiles therefore
  need **no renderer routing**; routing by source kind happens bun-side
  behind the same RPC.
- SQL-specific reads in the renderer that must become source-aware:
  `components/widgets/widget-draft.ts:25-47` (builds drafts from asks and
  widgets), `components/widgets/use-widget-menu.ts:48` (Copy SQL uses
  `compiledSql ?? widget.sqlTemplate`), `components/widgets/widget-run-view.tsx:86`
  (finds the connection; `rebind` at 106–112), `components/launcher/views/root-list.tsx:56`
  (connection glyph for widget rows), `lib/browser-widget-stub.ts:102-158`.
- `packages/agent/src/infer-card-spec.ts:131` — `inferCardSpec(data, { prompt, sql })`
  derives a `CardSpec` from any tabular data. `column-stats.ts:37` treats a
  column as numeric when `typeName` matches
  `/int|numeric|decimal|float|double|real|money|number|serial|hugeint/i`.
- `packages/agent/src/propose-params.ts:263` — the exemplar for a structured
  LLM call: `generateText({ output: Output.object({ schema }) })` with one
  repair pass and strict post-validation.
- Electrobun (verified in `apps/app/.hutch/types/sdks/main/core/Utils.d.ts:111-150`):
  `Utils.showMessageBox({ type, title, message, detail, buttons, defaultId, cancelId })`
  → `Promise<{ response: number }>` is a native dialog the webview cannot click.
- **MCP client library (verified)**:
  - `ai@6.0.97` (installed) no longer exports `createMCPClient`; in AI SDK v6
    it lives in the separate `@ai-sdk/mcp` package (context7, `vercel/ai`
    `content/docs/07-reference/01-ai-sdk-core/23-create-mcp-client.mdx`), which
    is not installed and wraps tools for model use.
  - `@modelcontextprotocol/sdk@1.26.0` is already in `bun.lock` (via `shadcn`).
    Verified in its `dist/esm/client/`: `Client.listTools()` returns tools with
    `annotations.readOnlyHint`, `inputSchema`, `outputSchema`;
    `Client.callTool(params, resultSchema?, options?)` returns
    `structuredContent` / `content` / `isError` and validates
    `structuredContent` against `outputSchema`;
    `StdioClientTransport(server: StdioServerParameters)` with `command`,
    `args`, `env`, `cwd`; `getDefaultEnvironment()` (a safe env subset);
    `StreamableHTTPClientTransport(url, { requestInit })`. Its docs example
    asserts `calc.annotations?.readOnlyHint === true` after `listTools`.
  - **Decision: use `@modelcontextprotocol/sdk` `Client` directly.** We need raw
    annotations and schemas and must call tools without a model. Add it as an
    explicit dependency of `apps/app` pinned to the latest **1.x** stable
    (imports `@modelcontextprotocol/sdk/client/index.js`, `/client/stdio.js`,
    `/client/streamableHttp.js`). Do not adopt the v2 split packages
    (`@modelcontextprotocol/client`) shown on the SDK's `main` branch.

## Owner decisions that bind this plan (2026-11-19)

- **Writes are allowed only as declared Actions (plan 019).** _"The ask pipeline
  and widget runs stay read-only forever. … MCP tools without `readOnlyHint`
  are treated as `write`."_ So: a widget source may only call an MCP tool whose
  server reports `annotations.readOnlyHint === true`, or which the user has
  explicitly marked "Treat as read" for that server in settings. HTTP sources
  are `GET` only.
- **Shared contract names** (plans 014/016/019/020 depend on them): `Source` in
  `packages/rpc/src/source.ts` is a discriminated union on `kind`:
  `"sql" | "mcp" | "http"`. Every source run returns core's `TabularResult`.
  MCP _client_ configuration is `McpServerConfig`, stored in
  `mcp-servers.enc`. The app _exposing itself_ as an MCP server is plan 016's
  `mcp-server` module — never name anything here `mcp-server`; this plan's
  module is `mcp-clients`.

## Commands you will need

| Purpose             | Command                                      | Expected                                       |
| ------------------- | -------------------------------------------- | ---------------------------------------------- |
| Install (after dep) | `bun install`                                | exit 0                                         |
| Contract tests      | `bun run --cwd packages/rpc test`            | all pass                                       |
| Core tests          | `bun run --cwd packages/core test`           | all pass                                       |
| Agent tests         | `bun run --cwd packages/agent test`          | all pass                                       |
| App tests (both)    | `bun run --cwd apps/app test`                | all pass — never report from `test:unit` alone |
| One browser test    | `bun run --cwd apps/app test:browser <path>` | pass                                           |
| Coverage            | `bun run --cwd apps/app test:coverage`       | ≥ 80% lines                                    |
| e2e                 | `bun run --cwd apps/app e2e`                 | all pass                                       |
| Types / lint        | `bun run check-types`, `bun run check`       | exit 0                                         |
| Desktop             | `bun run --cwd apps/app desktop:dev`         | app launches; drive with `cua-driver`          |

## Implementation rules relevant to this plan

- **Values are JSON values, never strings glued into calls.** MCP args are a
  JSON template whose placeholders are explicit objects
  (`{ "$param": "region" }`), replaced by the typed value. HTTP query values go
  through `URL.searchParams.set`; path placeholders are whole segments encoded
  with `encodeURIComponent`. The final URL's origin must equal the endpoint's
  base origin and its path must stay under the base path. A reviewer must be
  able to verify this by reading `bindArgs` and `buildRequestUrl` alone.
- **Validate at every edge with zod**: RPC inputs, decrypted config records,
  MCP `listTools`/`callTool` responses (narrow schemas, unknown fields
  dropped), HTTP responses (content type, size), and AI proposals.
- **Secrets stay in bun.** Env values, header values and auth tokens are never
  returned over RPC, never logged, never written into `compiled` previews or
  error messages. The renderer gets `hasValue` + a 4-character hint, exactly
  like `RedactedAiSettings`.
- **Untrusted output.** Tool descriptions, tool results and HTTP bodies are
  attacker-influenced. They render only as React text (no
  `dangerouslySetInnerHTML`, no markdown rendering), and they reach the model
  only in the authoring proposal step, whose output is schema-validated and
  previewed by a human.
- **Runs never call the AI.** Only `proposeSourceWidget` (authoring) does.
- Strict TS, no `any`, no unsafe casts (the polyglot/JSON boundaries use zod
  or `unknown` narrowing), no code comments unless the why is non-obvious.
- React 19 rules: components ≤ ~150 lines, one per file, ≤ ~6 props (group
  into typed objects), no boolean-prop proliferation (use `variant`/`state`
  enums), hooks own logic, no derived state synced in effects, hotkeys in
  `useXxxHotkeys` hooks. New screens are `LauncherView` variants in
  `components/launcher/use-launcher-stack.ts`, not routes.
- Tests are colocated: `*.test.ts` for pure logic, `*.browser.test.tsx`
  (vitest-browser-react) for components and hooks; snapshots for empty,
  loading, error and populated states. 80% line coverage gate.
- Keep `@oh-my-query/core` imports out of `apps/app/src/bun/index.ts`.

## Contracts added or changed (protected after this plan)

### `packages/rpc/src/source.ts` (create)

```ts
export const ParamRef = z
  .object({ $param: Ident, part: z.enum(["from", "to"]).optional() })
  .strict();
export type ArgTemplate =
  | string
  | number
  | boolean
  | null
  | z.infer<typeof ParamRef>
  | ArgTemplate[]
  | { [key: string]: ArgTemplate };
export const ArgTemplate: z.ZodType<ArgTemplate>; // z.lazy; depth ≤ 6, ≤ 64 keys per object, ≤ 16 KB serialized
export const QueryLeaf = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  ParamRef,
]);
export const PathTemplate = z
  .string()
  .max(500)
  .regex(/^\/[^?#\s]*$/); // "{{name}}" only as a whole segment
export const SelectPath = z.string().max(200); // parsed by core parseSelectPath; refine on parse success

export const SqlSource = z.object({
  kind: z.literal("sql"),
  connectionId: z.string().min(1).max(200),
  database: z.string().max(500).nullable(),
  dialect: Dialect,
  sqlTemplate: z.string().min(1).max(20_000),
});
export const McpSource = z.object({
  kind: z.literal("mcp"),
  serverId: z.string().min(1).max(100),
  tool: z.string().min(1).max(128),
  args: z.record(z.string().max(64), ArgTemplate),
  select: SelectPath,
});
export const HttpSource = z.object({
  kind: z.literal("http"),
  endpointId: z.string().min(1).max(100),
  method: z.literal("GET"),
  path: PathTemplate,
  query: z.record(z.string().min(1).max(64), QueryLeaf), // ≤ 20 keys
  select: SelectPath,
});
export const Source = z.discriminatedUnion("kind", [
  SqlSource,
  McpSource,
  HttpSource,
]);

export type CompiledSource =
  | { kind: "sql"; sql: string } // markers, never values
  | { kind: "mcp"; server: string; tool: string; args: unknown }
  | { kind: "http"; endpoint: string; url: string }; // no auth header, ever
```

`McpSource.select` is added beyond the shared brief's field list because tool
results need the same JSON → rows step as HTTP. Plans 019/020 import
`ArgTemplate`, `ParamRef`, `PathTemplate`, `QueryLeaf` and `Source` from here.

`ParamRef` semantics: `{ $param: "period" }` on a `dateRange` binds
`{ from, to }`; `{ $param: "period", part: "from" }` binds the ISO string;
`date` binds `"YYYY-MM-DD"`; `number` binds a JSON number; `text`/`select`
bind a JSON string. `part` on a non-range param is an error.

### Source configuration (same file, or `source-config.ts` if it passes ~200 lines)

```ts
const SecretMap = z.record(HeaderOrEnvName, z.string().max(4000)); // ≤ 20 entries
export const McpServerConfig = z.discriminatedUnion("transport", [
  z.object({ transport: z.literal("stdio"), id, name, command: AbsolutePath,
             args: z.array(z.string().max(1000)).max(32), env: SecretMap,
             readTools: z.array(z.string().max(128)).max(200), createdAt, updatedAt }),
  z.object({ transport: z.literal("http"), id, name, url: SafeServiceUrl,
             headers: SecretMap, readTools, createdAt, updatedAt }),
]);
export const HttpEndpointConfig = z.object({
  id, name, baseUrl: SafeServiceUrl,
  auth: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({ kind: z.literal("header"), name: HeaderName, value: z.string().max(4000) }),
  ]),
  createdAt, updatedAt,
});
// SafeServiceUrl: https://…, or http:// only for localhost / 127.0.0.1 / [::1]; no userinfo, no fragment.
// HeaderName: RFC 7230 token, not Host/Content-Length/Transfer-Encoding/Connection; values reject CR/LF.
export type RedactedMcpServer   // secrets → { name, hasValue, hint }[]
export type RedactedHttpEndpoint
export type McpServerInput / HttpEndpointInput // secret value undefined = keep current (mergeAiSettings semantics)
export interface McpToolSummary { name; title: string | null; description: string; readOnlyHint: boolean | null;
  readEligible: boolean; inputSchema: unknown }
export interface SourceTestResult { ok: boolean; message: string; latencyMs: number; toolCount?: number; readToolCount?: number }
```

### `Widget` v2 (`packages/rpc/src/widget.ts`, protected — versioned migration)

```ts
export const WIDGET_VERSION = 2;
export const Widget = z.object({
  version: z.literal(2),
  id, name, prompt, spec: CardSpec, view: CardViewKind,
  source: Source,
  params, lastValues, createdAt, updatedAt, lastRunAt,
}).superRefine(sourceParamRules);
const WidgetV1 = /* today's object, unchanged, not exported from index.ts */;
export const upgradeWidgetV1 = (v1: WidgetV1): Widget; // pure: moves the 4 SQL fields into { kind: "sql", … }, sets version 2
export const parseStoredWidget = (raw: unknown): Widget | null; // Widget first, then WidgetV1 → upgrade; else null
export const WidgetDraft = /* Widget minus version/id/createdAt/updatedAt/lastRunAt, optional id */;
export interface WidgetRunResult { result: TabularResult; compiled: CompiledSource; values: ParamValues }
```

`sourceParamRules`: for `mcp`/`http`, every `ParamRef` and every `{{name}}`
path segment names a declared param, every non-fixed param is used, and no
`select` param has `optionsSql` (options must be static). For `sql`, the
existing rules stay in `checkDraft`.

**Migration semantics.** Migration happens on read, in the parser. A v1 record
parses into a v2 `Widget` in memory. It is written back as v2 only when it is
saved or updated (for example `lastRunAt` after a run). Untouched v1 records stay
v1 on disk. Older builds still read the file, because the store keeps every
record its parser rejects, so a downgrade hides v2 widgets and never deletes
them. `Board` and `RecentAsk` do not change.

## UI and motion (mandatory)

The owner's bar is that **the UI must be excellent and motion is mandatory**. A
surface without designed motion, or without designed empty, loading, populated
and error states, is not done. Use the system in
`apps/app/src/mainview/lib/motion.ts` and `components/motion/`; never hand-roll
transitions.

- **Tokens**: `SPRING` (layout morphs, push/pop), `SPRING_SNAPPY` (selection,
  toggles), `SPRING_SOFT` (height, panel and card reveals), `SPRING_MOMENTUM`
  (only after a drag release), `FADE_IN` 160 ms ease-out-quint, `FADE_OUT`
  110 ms, `PRESS` (scale 0.97, 100 ms), `staggerDelay` (30 ms, capped at 6),
  primitives `<Pressable>`, `<SwapText>`, `<Reveal>`, and `useMotionPreset()`
  for reduced-motion equivalents.
- **Principles**: respond on press; everything interruptible (springs retarget,
  no input lockout, no CSS transitions for re-triggerable motion); exit the way
  you entered at ~70% duration; `layoutId` for objects in two places; animate
  only `transform`/`opacity`/`filter` and use `layout` for size; one primary
  motion per moment; only progress indicators loop.
- **Accessibility**: reduced motion turns travel into crossfades or instant
  changes; reduced transparency makes surfaces opaque (`launcher-material`
  already falls back); increased contrast promotes muted text and solid
  borders; focus rings always visible; live regions announce state, not frames.
- **Avoid flicker**: never show a loading state that would last under 150 ms;
  once shown, keep it at least 300 ms (`hooks/use-delayed-visibility.ts`).
- **Copy**: quiet, specific, no "AI-powered" or sparkle language. "Reading
  tools…", "Choosing a call…", "Treat as read", "This tool can change data, so
  it can't feed a widget."

### Motion moments in this plan

| Moment                   | Trigger                                  | What moves                                                                                                                                    | Token                          | Reduced motion             |
| ------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------- |
| Sources group appears    | Open Settings                            | The "Sources" group `<Reveal>`s with the others; rows stagger                                                                                 | `FADE_IN`, `staggerDelay`      | Instant                    |
| Source editor push       | ↵ on a source row / "Add MCP Server"     | Standard stack push (x 16→0 + opacity), panel height morphs                                                                                   | `SPRING`, `SPRING_SOFT`        | Crossfade                  |
| Transport switch         | Segmented "Local command / Remote URL"   | Selection thumb slides; field group swaps with `layout` height                                                                                | `SPRING_SNAPPY`, `SPRING_SOFT` | Instant                    |
| Test connection          | `⌘T` / Test button                       | Button `PRESS`; status line `<SwapText>` "Testing…" (delayed 150 ms) → "Connected · 12 tools · 4 read · 86 ms" or the error                   | `PRESS`, `FADE_IN`             | Instant swap               |
| Tool list                | Test succeeds                            | Tool rows stagger in; read-only badge fades in per row                                                                                        | `staggerDelay`, `FADE_IN`      | Instant                    |
| Treat as read            | Space on a tool row                      | Checkbox draws in (`check-draw.tsx`); amber caution line expands under the row                                                                | `SPRING_SNAPPY`, `SPRING_SOFT` | Instant                    |
| Pick a source            | Root command "New Widget from a Source…" | Push `source-picker`; rows stagger                                                                                                            | `SPRING`, `staggerDelay`       | Crossfade                  |
| Proposing a call         | ↵ with a description                     | Status `<SwapText>` "Reading tools…" → "Choosing a call…"; 2 px progress hairline (the only loop)                                             | `FADE_IN`                      | Static hairline, text swap |
| Proposal fills the draft | Proposal arrives                         | Filled fields get a one-shot amber background pulse (opacity 0.14→0, 900 ms), staggered                                                       | `staggerDelay`, `FADE_OUT`     | No pulse                   |
| Preview                  | `⌘↵`                                     | Card area expands via `layout`, card `<Reveal>`s; a re-preview is stale-while-revalidate (old card dims to 0.6, hairline, data morphs 300 ms) | `SPRING_SOFT`, `FADE_IN`       | Instant swap               |
| Save                     | `⌘S`                                     | Name field expands under the header (reuse `NameField`), collapses on confirm; footer `<SwapText>` "Saved · ⌥⏎ to run"                        | `SPRING_SOFT`, `FADE_IN`       | Instant                    |
| Mixed board tile         | Board renders                            | No new motion; the tile's source glyph is part of the existing tile header. Tile refresh keeps plan 007's motion                              | —                              | —                          |
| Source error             | Run fails                                | `ErrorNotice` `<Reveal>`s in place of the card; retry `PRESS`                                                                                 | `FADE_IN`                      | Instant                    |

## Scope

**In scope**

- `packages/rpc/src/source.ts` (create) + `source.test.ts`; `widget.ts`,
  `widget.test.ts`, `schema.ts`, `index.ts`.
- `packages/core/src/sources/` (create): `json-select.ts`, `to-tabular.ts`,
  `arg-template.ts`, `request-url.ts`, each with a colocated `*.test.ts`;
  exported from `core/src/index.ts` and the renderer-safe `core/src/client.ts`.
- `packages/core/src/paths.ts` (`mcpServersPath()` → `mcp-servers.enc`,
  `httpEndpointsPath()` → `http-endpoints.enc`), `packages/core/src/source-configs.ts`
  (create; record stores over `createRecordStore`), `persistence.ts`
  (`resetSecrets` deletes both files), `widgets.test.ts` (v1 fixture).
- `packages/agent/src/propose-source.ts` (create) + test; `index.ts` export.
- `apps/app/package.json` (add `@modelcontextprotocol/sdk` 1.x).
- `apps/app/src/bun/`: `source-runner.ts`, `mcp-clients.ts`,
  `http-fetch.ts`, `source-settings-service.ts`, `native-confirm.ts` (create,
  each with tests where they hold logic); `widget-service.ts`,
  `widget-service.test.ts`, `rpc.ts`.
- `apps/app/src/mainview/`: `lib/ipc.ts`, `lib/browser-ipc-stub.ts`,
  `lib/browser-widget-stub.ts` (+ a `browser-source-stub.ts`),
  `components/launcher/use-launcher-stack.ts`, `launcher-panel.tsx`,
  `root-commands.ts`, `views/root-list.tsx`, `views/settings-view.tsx`,
  `views/settings/sources-section.tsx` and friends (create),
  `components/sources/` (create: editor, picker, draft, preview),
  `components/widgets/*` (source-aware draft, menu, run meta, rebind).
- `apps/app/e2e/source-widget-flow.spec.ts` (create).

**Out of scope**

- Writes of any kind, actions, confirm sheets, audit log — plan 019.
- Non-GET HTTP, request bodies, OAuth flows for MCP or HTTP (header/env secrets only).
- MCP resources, prompts, sampling, elicitation, notifications.
- Asking free-form questions of MCP data through the ask pipeline (the ask flow stays SQL).
- Background refresh (plan 014 reuses `source-runner`), export/import (plan 015).
- Changing `Board`, `CardSpec`, `AskEvent` or `RecentAsk`.

## Git workflow

- Branch `feat/018-widget-sources` from the current baseline. Commit only if authorized. Do not push or open a PR unless instructed.

## Steps

### Step 1: Pure source helpers (core)

In `packages/core/src/sources/`:

- `json-select.ts` — `parseSelectPath(path) → Segment[] | { error }` and
  `select(json, segments) → unknown`. Supported subset only: `$`, `.key`,
  `['key']`, `[n]`, `[*]` (array flatten, at most 2 wildcards). No filters, no
  recursive descent, no script expressions, no `eval`/`Function`; general
  JSONPath libraries are rejected because several evaluate expressions
  (jsonpath-plus had a remote-code-execution advisory for exactly this).
- `to-tabular.ts` — `toTabular(json, select, { maxRows = 2000, maxColumns = 50 }) → TabularResult`:
  array of objects → union of keys in first-seen order over the first 200 rows,
  nested objects flattened one level as `a.b`, deeper values/arrays as
  `JSON.stringify` clipped to 500 chars; array of scalars → one column
  `value`; one object → one row; one scalar → one row, one column. Column
  `typeName` ∈ `number | boolean | timestamp | text | json` (timestamp when
  every non-null sample is an ISO-8601 date/time), so `column-stats.ts`
  recognizes numbers. Rows beyond `maxRows` set `isTruncated`. `executionTimeMs`
  is filled by the caller.
- `arg-template.ts` — `collectParamRefs(template)`, `bindArgs(template, values: Record<string, TemplateValue>) → unknown`
  (pure; replaces `ParamRef` objects only; throws on unknown names or `part`
  on non-range values).
- `request-url.ts` — `buildRequestUrl(baseUrl, path, query, values) → URL`:
  `new URL(base)`; path segments that are exactly `{{name}}` become
  `encodeURIComponent(String(value))` and reject `""`, `.` and `..`; any other
  `{{` in the path is an error; query via `searchParams.set`; assert
  `url.origin === base.origin` and `url.pathname.startsWith(base.pathname)`.

Tests (table-driven): select subset and every rejected syntax; Stripe-style
`$.data[*]`, GitHub-style top-level arrays, nested flatten, mixed key sets,
truncation, scalar shapes, type inference; `bindArgs` with each param type and
range parts; `buildRequestUrl` with `../`, `%2F`, `//evil.com`, `@`, unicode,
and a value equal to a full URL (stays one encoded segment).

### Step 2: Contracts and the v1 → v2 migration (rpc + core)

Create `source.ts` and change `widget.ts` as specified above. Update
`schema.ts` request types and `index.ts` exports. `widget-service.ts`'s
`defaultWidgetStore` switches to `createWidgetStore(parseStoredWidget)`.

Tests:

- `widget.test.ts`: a literal v1 object (copy one from today's
  `widget-service.test.ts` fixtures) upgrades to the expected v2 object;
  v2 round-trips; garbage → `null`; `sourceParamRules` cases (unused param,
  unknown `$param`, `optionsSql` on an MCP widget).
- `packages/core/src/widgets.test.ts`: write a **real encrypted v1
  `widgets.enc`** (array of two v1 widgets plus one unknown-shape record) in a
  temp home, then list (two v2 widgets), update one (`lastRunAt`), and assert
  on disk: the updated record is v2, the other is still v1, the unknown record
  survives byte-for-byte. Model after the existing tests in that file.
- If plan 015 landed: its import accepts v1 and v2 files via `parseStoredWidget`.

### Step 3: Source configuration storage and settings service (core + bun)

- `core/src/source-configs.ts`: `createMcpServerStore(parse)`,
  `createHttpEndpointStore(parse)` over `createRecordStore` with the two new
  paths. Add both paths to `resetSecrets`.
- `bun/source-settings-service.ts`: list (redacted), save (zod-parse input,
  merge secrets like `mergeAiSettings`, stamp times), delete (returns the
  names of widgets using it; the renderer confirms with that count), test.
  `stdio` commands: a bare command is resolved with `Bun.which(command, { PATH })`
  over `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin` plus the user's `PATH`,
  and stored as an absolute path (GUI apps get a minimal PATH).
- `bun/native-confirm.ts`: `confirmNative({ title, message, detail, confirmLabel }) → Promise<boolean>`
  over `Utils.showMessageBox` with `defaultId` and `cancelId` on **Cancel**.
  Saving an MCP server whose `command`, `args` or `url` changed, or marking a
  tool "Treat as read", requires this native confirmation showing the exact
  command line / URL / tool name. A webview cannot click a native dialog, so a
  compromised renderer cannot make the app spawn a new process or downgrade a
  tool on its own. Inject it as a dependency so tests pass a fake.
- Tests: redaction never returns a value; merge keeps secrets when the input
  omits them; `SafeServiceUrl`/`HeaderName` rejections; delete reports users;
  native confirm declined → nothing saved.

### Step 4: MCP client manager and HTTP fetch (bun)

- `bun/mcp-clients.ts` — `createMcpClientManager({ servers, connect, now })`:
  one `Client` per server id, connected lazily; `listTools(serverId)` cached
  60 s, parsed with a narrow zod schema; `callTool(serverId, tool, args, signal)`
  with a 30 s timeout and at most 2 concurrent calls per server; idle clients
  closed after 5 min; `invalidate(serverId)` on config change or delete;
  `closeAll()`. stdio env = `{ ...getDefaultEnvironment(), ...server.env }`
  (never the full parent env). Streamable HTTP passes headers through
  `requestInit.headers`. Read eligibility is one pure function:
  `isReadEligible(tool, server) = tool.annotations?.readOnlyHint === true || server.readTools.includes(tool.name)`.
- Tool result → JSON: `structuredContent` when present; otherwise a single
  `text` content item that parses as JSON; otherwise `SOURCE_NOT_DATA`
  ("This tool returned text, not data."). `isError: true` → `SOURCE_FAILED`
  with the first text item clipped to 300 chars. Results over 5 MB serialized →
  `SOURCE_TOO_LARGE`.
- `bun/http-fetch.ts` — `fetchJson(endpoint, url, signal)`: `GET`,
  `redirect: "manual"` (any 3xx → error naming the target origin, so the auth
  header never follows a redirect), `Accept: application/json`, auth header
  from config, 30 s timeout, body read with a 5 MB byte cap, only
  `application/json` or `+json` content types, status ≥ 400 → `SOURCE_FAILED`
  with status and the first 300 chars of the body.
- Tests: an in-memory MCP server (`McpServer` from
  `@modelcontextprotocol/sdk/server/mcp.js` + `InMemoryTransport.createLinkedPair()`
  from `@modelcontextprotocol/sdk/inMemory.js`, both verified present in 1.26.0)
  exposing one read and one write tool, plus one stdio fixture script under
  `apps/app/src/bun/test-fixtures/` to cover process spawn and env;
  `Bun.serve` on 127.0.0.1 for HTTP (redirect, 500, wrong content type, huge
  body, slow response + cancel).

### Step 5: Source runner and widget service (bun)

- `bun/source-runner.ts` — `createSourceRunner(deps)` with
  `run(source, params, values, signal) → { result, compiled }`, a `switch` on
  `source.kind`:
  - `sql`: today's code moved out of `widget-service.ts` unchanged (guard,
    compile, read-only execute with params).
  - `mcp`: load server (missing → `SOURCE_MISSING`); `listTools`; tool missing
    → `TOOL_MISSING`; **not read-eligible → `TOOL_NOT_READ_ONLY`** ("This tool
    can change data, so it can't feed a widget."), checked on **every** run so
    an annotation change takes effect; `bindArgs`; `callTool`; `toTabular`.
  - `http`: load endpoint; `buildRequestUrl`; `fetchJson`; `toTabular`.
    `compiled` never contains a secret or a bound value inside a string.
- `widget-service.ts`: `runWidget` resolves values exactly as today, then calls
  the runner; `saveWidget`'s `checkDraft` dispatches per kind (sql: today;
  mcp/http: `sourceParamRules`, select path parses, tool is read-eligible,
  URL builds with defaults). `loadParamOptions` stays SQL-only. Add
  `previewSource({ source, params, values, runId })` (same path, nothing
  stored) and route `cancelWidgetRun` to it too.
- Tests in `widget-service.test.ts`: a v1 widget on disk runs; mixed list
  sorted; an MCP widget whose tool flips to `readOnlyHint: false` is refused;
  unknown input name rejected; values reach the fake tool as JSON numbers and
  objects, never strings with braces; the HTTP URL a fake receives.

### Step 6: Proposing a source call (agent)

`packages/agent/src/propose-source.ts` —
`proposeSource({ prompt, target, tools | endpoint, model, now, signal }) → { draft: { source, params, spec } } | { error }`.

- MCP: offer the model only **read-eligible** tools (name, description clipped
  to 500 chars, input schema clipped to 4 KB). Output via
  `generateText({ output: Output.object({ schema: SourceProposal }) })`:
  `{ tool, args (ArgTemplate), select, params: ParamDef[] (≤ 4, no optionsSql) }`.
- HTTP: the model sees the endpoint name and base URL only, proposes
  `{ path, query, select, params }`. If this proves unreliable, the draft form
  (Step 8) is the path; do not add speculative heuristics.
- Validate: tool exists and is read-eligible; `sourceParamRules`; args satisfy
  the tool's `inputSchema` (use the `ajv` validator the MCP SDK already depends
  on, `strict: false`; add `ajv` as an explicit dependency if imported directly);
  one repair pass with the validation message, as `propose-params.ts` does.
- The spec is inferred after preview (`inferCardSpec` over the preview result
  with `{ prompt, sql: "" }`), not proposed by the model.
- Tool descriptions are untrusted: the system prompt states that tool text is
  data, and nothing the model returns is executed without a human preview.
- Tests with the `ai/test` mock model: valid proposal; proposal naming a
  write tool (rejected); unknown `$param`; args failing the schema then
  repaired; no model configured → `{ error }`.

### Step 7: RPC surface (bun ↔ renderer)

Add to `RpcSchema.requests` and wire in `rpc.ts` (all through `wrapHandlers`):
`listMcpServers`, `saveMcpServer`, `deleteMcpServer`, `testMcpServer`,
`listMcpTools`, `listHttpEndpoints`, `saveHttpEndpoint`, `deleteHttpEndpoint`,
`testHttpEndpoint`, `proposeSourceWidget({ target, prompt })`,
`previewSource({ source, params, values, runId })`. `runWidget` keeps its
params; its response becomes `WidgetRunResult` with `compiled`. Mirror each in
`lib/ipc.ts` and the browser stub (`browser-source-stub.ts`: one fake MCP
server "Stripe (stub)" with tools `list_disputes` (read) and `refund_charge`
(write), one HTTP endpoint "Status API (stub)"; deterministic results).

### Step 8: Renderer — settings, picker, draft, preview

- **Settings → Sources** (`views/settings/sources-section.tsx`): rows for each
  server/endpoint (name, transport, last test status), plus "Add MCP Server"
  and "Add HTTP Endpoint". Empty state: one quiet line, "Connect an MCP server
  or an HTTP API to build widgets from it."
- `LauncherView` variants: `{ kind: "source-edit"; target: { type: "mcp" | "http"; id: string | null } }`,
  `{ kind: "source-picker" }`,
  `{ kind: "source-draft"; target: SourceTarget; draft: SourceDraft | null }`.
- **Source editor** (`components/sources/mcp-server-form.tsx`,
  `http-endpoint-form.tsx`, `secret-rows.tsx`, `tool-list.tsx`,
  `use-source-editor.ts`, `use-source-editor-hotkeys.ts`): name; transport
  segmented control; command + args or URL; secret rows (name + masked value,
  hint shown, "unchanged" placeholder); `⌘T` Test; tool list with a
  "Read-only" badge from `readOnlyHint` and a **Treat as read** checkbox for
  the rest, with the amber caution line "Only mark tools that never change
  data. You'll confirm this in a system dialog." `⌘S` saves.
- **Root command** "New Widget from a Source…" (`root-commands.ts`) → picker →
  draft view. The draft view (`source-draft-view.tsx` + `use-source-draft.ts`)
  has a description input on top (↵ proposes, MCP only), then the editable
  fields: tool (select of read-eligible tools only) and args (JSON textarea,
  validated live) for MCP; path + query rows for HTTP; select path; inputs
  reuse `widget-inputs` review rows. `⌘↵` previews with `previewSource` and
  shows the card via `AskCard`; `⌘S` saves via `NameField` + `saveWidget`.
  Works without an AI key (fields typed by hand).
- **Source-aware widget surfaces**: `widget-draft.ts` builds `source`;
  `root-list.tsx` and board tile headers show a `SourceGlyph` (connection glyph
  for sql, server initial + "MCP" micro label, endpoint initial + "HTTP");
  `use-widget-menu.ts` "Copy SQL" becomes "Copy SQL" / "Copy Call" (tool + args
  JSON) / "Copy URL" per `compiled.kind`; `widget-run-view.tsx` "Choose a
  connection" rebind stays SQL-only, and MCP/HTTP missing-source errors offer
  "Open Sources settings".
- States to design and snapshot: settings Sources empty/populated/test-error;
  editor testing/connected/failed; tool list with a write tool; draft empty,
  proposing, proposal error, preview loading/populated/error; widget row and
  tile per kind.

### Step 9: Desktop verification

In `desktop:dev`, driven with `cua-driver`: add a local stdio MCP server (the
reference `@modelcontextprotocol/server-everything` or any read tool you have),
confirm the native dialog appears **above** the launcher panel and Cancel is
default, test it, build a widget from a read tool, add it to a board next to a
SQL widget, set board refresh to 1m and watch both refresh; add an HTTP
endpoint (a local `Bun.serve` JSON fixture is fine) and repeat. Quit and
relaunch; widgets persist. Start with a copy of a real v1 `widgets.enc` and
confirm every old widget still lists and runs.

## Test plan

- rpc: `source.test.ts` (schema edges, `SafeServiceUrl`, `HeaderName`,
  `ArgTemplate` depth/size limits), `widget.test.ts` (migration, rules).
- core: `sources/*.test.ts` (Step 1), `widgets.test.ts` (encrypted v1 file,
  mixed versions, unknown record preserved), `source-configs.test.ts`.
- agent: `propose-source.test.ts` (Step 6). Model after `propose-params.test.ts`.
- bun: `mcp-clients.test.ts`, `http-fetch.test.ts`, `source-runner.test.ts`,
  `source-settings-service.test.ts`, `widget-service.test.ts` additions.
  Model after `widget-service.test.ts` and `board-service.test.ts`.
- renderer browser tests (vitest-browser-react, `render` + `screen.getByRole`):
  sources section, MCP and HTTP forms (secret hint, test states, treat-as-read
  flow), picker, draft (propose → fields filled, manual edit, preview, save),
  widget row and run view per kind, board tile per kind; motion branches
  (`useMotionPreset` reduced and full) for every animated component.
- e2e `source-widget-flow.spec.ts` (browser stub): add the stub MCP server in
  Settings, test it, see `refund_charge` without a read badge, create a widget
  from `list_disputes` with a `status` select input, preview, save, run it from
  root with `Tab` → change status → `↵`, add it to a board with a SQL widget,
  open the board, see both tiles. Assert via `globalThis.__omqIpcLog` that no
  AI request happened during runs.

## Done criteria

- [ ] `bun run --cwd packages/rpc test`, `packages/core test`, `packages/agent test`, `bun run --cwd apps/app test` (both projects), `e2e`, `check-types` and `check` pass; app coverage ≥ 80%.
- [ ] An encrypted v1 `widgets.enc` fixture loads, runs and is rewritten record-by-record as v2; an unknown record survives (test proves it).
- [ ] `rg -n "\\$\\{" packages/core/src/sources/arg-template.ts packages/core/src/sources/request-url.ts` shows no value interpolation into URLs or args; review of both files confirms it.
- [ ] A tool without `readOnlyHint: true` and not marked "Treat as read" can be neither proposed, saved, previewed nor run as a source (tests at each layer), and flipping a saved tool's annotation refuses the next run.
- [ ] No secret value crosses RPC: a test serializes every settings response and asserts the stored secret strings are absent; `compiled` for HTTP never includes the auth header.
- [ ] Widget runs make no AI call (stub log in e2e; desktop run with the network to the AI provider blocked).
- [ ] Saving a changed stdio command and marking a tool "Treat as read" each show a native dialog with Cancel as default; declining saves nothing (test + desktop check).
- [ ] Desktop: a board shows a SQL tile and an MCP tile refreshing together; a real pre-migration `widgets.enc` still lists and runs every widget.
- [ ] Every row of "Motion moments in this plan" is implemented with its token and reduced-motion fallback, with a browser test per branch; recordings at 1× and 0.25× (`?slowmo=4`) attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of propose → preview → save shows no frame over 16.7 ms and only `transform`/`opacity`/`filter` animating.
- [ ] Reduced Motion, Reduce Transparency and Increase Contrast verified on Settings → Sources, the editor, the draft view and mixed boards; designed empty, loading, populated and error states have snapshots.
- [ ] No files outside the in-scope list are modified (`git status`); README status row updated.

## STOP conditions

- `@modelcontextprotocol/sdk` 1.x latest stable no longer exposes `Client`,
  `StdioClientTransport`, `StreamableHTTPClientTransport` and tool
  `annotations` at the paths above, or only a pre-release does. Report; do not
  switch to `@ai-sdk/mcp` (it hides annotations behind AI SDK tools) without
  approval.
- The packaged app cannot spawn stdio children (hardened runtime, sandbox) or
  `Utils.showMessageBox` opens behind the always-on-top launcher panel or
  without focus. Report with evidence; never remove the native confirmation.
- Any real v1 widget fails to upgrade in the desktop check. Do not ship a
  migration that hides a user's widget.
- Making the source work requires changing `Board`, `CardSpec` or `AskEvent`.
- An MCP server the owner cares about marks no tools with `readOnlyHint`, so
  "Treat as read" becomes the common path. Report it; do not relax the rule.

## Maintenance notes

- Plan 019 reuses `ArgTemplate`, `bindArgs`, `buildRequestUrl`,
  `mcp-clients.ts`, `fetchJson` (extended to other methods there) and
  `isReadEligible`. Keep them pure and dependency-injected.
- Plan 014's scheduler must call `source-runner`, not the SQL path, so MCP and
  HTTP widgets work in the menu bar and alerts. Plan 015's export must strip
  nothing from `Source` (it holds no secrets by design) and must never export
  `McpServerConfig`/`HttpEndpointConfig`. Plan 020's `MiniApp.sources` is a
  `Record<name, Source>` from this file.
- A future `Widget` v3 adds another `WidgetVn` parser in `parseStoredWidget`;
  keep upgrades pure and chained (v1 → v2 → v3).
- Reviewers should scrutinize: `request-url.ts`, `arg-template.ts`,
  `isReadEligible`, the stdio env construction, `redirect: "manual"`, and
  that `compiled` never carries secrets.
- Deferred: OAuth for remote MCP servers, MCP resources, POST-based "read"
  APIs (GraphQL), per-source refresh hints, asking questions of MCP data.
