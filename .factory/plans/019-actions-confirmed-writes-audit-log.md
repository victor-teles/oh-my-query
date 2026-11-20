# Plan 019: Act on rows and widgets, with confirmed writes and an encrypted audit log

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`. **This plan may not merge until a
> `/factory secure` review of its diff has run and every finding rated High or
> Critical is fixed (see "Security review gate").**
>
> **Drift check**: `git diff --stat 12b9e8c -- packages apps/app/src` and
> `git status --short`. Plans 001–007 are the uncommitted baseline and plan 018
> must be merged. Confirm before starting: `packages/rpc/src/source.ts` exports
> `Source`, `ArgTemplate`, `ParamRef`, `PathTemplate`, `QueryLeaf`;
> `packages/core/src/sources/` exports `bindArgs` and `buildRequestUrl`;
> `apps/app/src/bun/mcp-clients.ts` exports `createMcpClientManager` and
> `isReadEligible`; `apps/app/src/bun/native-confirm.ts` exports
> `confirmNative`; `Widget` carries `version: 2` and `source`.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH (this is where the read-only promise ends; it writes to databases and third-party systems)
- **Depends on**: `.factory/plans/018-mcp-and-http-widget-sources.md`
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19, branch `feat/launcher-002-shell`; the working tree with plans 001–007 implemented but uncommitted is the baseline, and this plan assumes 018 has landed on top.

## Why this matters

Answers lead to work: "refund this charge", "mark this order shipped", "open
this customer in Stripe", "copy the id". Today the user leaves the launcher for
an admin panel or a SQL console to do it, and the SQL console has none of our
guards. This plan adds **Actions**: typed, declared side effects attached to a
widget or to a row of its table. Reads and links run immediately. Every write
shows a confirm sheet with the exact target and the exact bound values, every
time. Writes are recorded in an encrypted, append-only audit log, and an
Activity view shows that log. The ask pipeline and widget runs stay read-only
forever. Writes exist only as actions a person reviewed when saving them.

## Owner decision #2 (2026-11-19), verbatim — binding

> **Writes are allowed, gated ("depends, may allow").** The ask pipeline and
> widget runs stay read-only forever. Writes exist ONLY as declared Actions
> (plan 019): every action has `effect: "read" | "write" | "external"`; any
> `write` shows a confirm sheet with the exact target and bound values every
> time; SQL write actions require a per-connection opt-in "Allow write
> actions" (default off) and a statement template that a human reviewed at
> save time (the AI may propose, never execute on the fly); values bind as
> parameters; every write is appended to an encrypted audit log. MCP tools
> without `readOnlyHint` are treated as `write`.

Consequences this plan enforces in code, not in UI alone:

1. `assertReadOnly` and the read-only execution path stay untouched. Writes use
   a **separate** guard (`assertGuardedWrite`) and a **separate** driver method
   (`executeWrite`). No code path can reach a write from `runWidget`, `ask`,
   `previewSource` or plan 016's MCP server.
2. The **effect is derived by bun at run time** from the target. It is never
   taken from a stored field or an AI proposal. The stored `effect` is a
   display hint, and bun refuses an action whose stored effect understates the
   derived effect.
3. MCP: a tool is `read` **only** when the server reports
   `annotations.readOnlyHint === true`. Plan 018's user-set "Treat as read"
   lets a tool feed a widget, but it never removes the confirm sheet from an
   action.

## Current state (after plan 018)

- `packages/rpc/src/source.ts` (plan 018) — `Source`, `ArgTemplate`
  (`{ $param }` placeholders, JSON values only), `PathTemplate`, `QueryLeaf`,
  `McpServerConfig`, `HttpEndpointConfig`, `CompiledSource`.
- `packages/core/src/sources/` (plan 018) — `bindArgs`, `buildRequestUrl`
  (origin- and base-path-locked), `toTabular`.
- `apps/app/src/bun/mcp-clients.ts`, `http-fetch.ts`, `source-runner.ts`,
  `native-confirm.ts` (plan 018). `confirmNative` wraps
  `Utils.showMessageBox` (verified in
  `apps/app/.hutch/types/sdks/main/core/Utils.d.ts:111-150`) with Cancel as
  default and cancel id. A webview cannot click it.
- `packages/agent/src/read-only-guard.ts` — `assertReadOnly(sql, dialect)`
  lexes literals and comments under **two flavors** (lines 17–30) and passes
  only when both agree. `ALLOWED_LEADING_KEYWORDS` (32–41) and
  `FORBIDDEN_WORDS` (43–75) are the deny-list idiom to mirror. `stripLiterals`
  (around line 190) is the reusable lexer.
- `packages/core/src/safe-mode.ts` — `classifyStandardSql` flags
  `DELETE`/`UPDATE` without `WHERE`; `normalizeSqlForAnalysis` strips
  comments and strings.
- `packages/core/src/sql-template.ts` — `compileSqlTemplate(template, values, dialect) → { sql, params }`
  (placeholder → driver marker), `maskTemplateInputs(template, dialect, "NULL")`,
  `templateInputNames`.
- `packages/core/src/traits.ts:18-43` — `ExecuteOptions { readOnly?, params? }`
  and `Pool.execute(sql, maxRows, schema, signal, options?)`. `drivers-pg/src/pool.ts:126`
  and `:247` show read-only runs wrapped in `BEGIN READ ONLY`, and `:185`
  shows an explicit `BEGIN`.
- `@polyglot-sql/sdk@0.3.3` (bundled; `parse(sql, dialect) → { success, ast?: any, error? }`
  verified in its `dist/index.d.ts:10102,10134`) — parse is available as a
  second, structural check. The `any` AST must be narrowed with zod.
- `packages/core/src/persistence.ts:210-219` — `appendHistory` is the
  append-only idiom: one `encryptLine` blob per line, `fs.appendFile` under
  `withFileLock`. `resetSecrets` at `:357`.
- `packages/core/src/persistence.ts:68-88` — `DatabaseConnection` has
  `environment?`, `piiRedaction?` and `customPiiPatterns?`. The renderer
  rewrites the **whole list** through `saveConnections`
  (`apps/app/src/bun/rpc.ts:294`), so **no security flag may live on
  `DatabaseConnection`**.
- `apps/app/src/bun/rpc.ts:270` — `openExternal({ url })` forwards any URL to
  `Utils.openExternal` without validation. Actions must not use it. Validating
  it is listed in the threat model as a pre-existing finding for the secure
  review.
- `packages/core/src/pii-redactor.ts` — `redactPii` (also in `core/client`).
- Renderer:
  - `components/ask/card-table.tsx` renders rows with no selection or
    keyboard focus (lines 69–85).
  - `components/widgets/widget-run-view.tsx` owns `⌘K` (lines 137–146) and
    the `ActionsMenu`.
  - `components/widgets/widget-actions.ts` lists the widget-level menu.
  - `components/launcher/actions/actions-menu.tsx` and `menu-action.ts` are
    the menu primitives.
  - `hooks/use-armed-confirm.ts` is the two-step delete idiom. It is not
    enough for writes.
  - `lib/clipboard.ts` exports `copyText`.

## Commands you will need

| Purpose          | Command                                                             | Expected                                |
| ---------------- | ------------------------------------------------------------------- | --------------------------------------- |
| Contracts        | `bun run --cwd packages/rpc test`                                   | all pass                                |
| Core             | `bun run --cwd packages/core test`                                  | all pass                                |
| Agent            | `bun run --cwd packages/agent test`                                 | all pass                                |
| Driver (pg)      | `bun run fixtures:up` then `bun run --cwd packages/drivers-pg test` | pass                                    |
| Other drivers    | `bun run --cwd packages/drivers-{mysql,sqlite,duckdb,mssql} test`   | pass (harness where present)            |
| App tests (both) | `bun run --cwd apps/app test`                                       | all pass — never from `test:unit` alone |
| Coverage         | `bun run --cwd apps/app test:coverage`                              | ≥ 80% lines                             |
| e2e              | `bun run --cwd apps/app e2e`                                        | all pass                                |
| Types / lint     | `bun run check-types`, `bun run check`                              | exit 0                                  |
| Desktop          | `bun run --cwd apps/app desktop:dev`                                | drive with `cua-driver`                 |
| Security gate    | `/factory secure` on this branch's diff                             | no open High/Critical                   |

## Implementation rules relevant to this plan

- **Two paths, never one with a flag.** Read execution stays in
  `source-runner.ts`; writes live in `action-service.ts` → `action-executor.ts`
  → `Pool.executeWrite` / `callTool` / `fetchJson`. Do not add a `readOnly:
false` call anywhere.
- **Bun decides; the renderer asks.** The renderer sends ids and row
  references, never statements, URLs, tool names or row values for execution.
  Row-bound values are read by bun from **its own cached copy** of the run
  result (`runId` + `rowIndex`). Input values are validated against the
  widget's `ParamDef` with zod.
- **Prepare, then execute with a single-use token.** `prepareAction` compiles
  the exact call and returns a preview plus a token. That token is 128 bits from
  `crypto.getRandomValues`, single use, valid for 120 s, and bound to the
  SHA-256 of the compiled call. `executeAction({ token })` runs exactly that
  call, after re-checking the opt-ins.
- **Fail closed on audit.** If appending the `started` audit entry fails, the
  write does not run.
- Values bind as parameters (SQL markers via `compileSqlTemplate`), JSON
  values (`bindArgs`) or encoded URL parts (`buildRequestUrl`). Copy is the
  only target that renders text, and its result is clipboard text that is
  never executed.
- Never log bound values, statements with values, secrets, or response
  bodies. The audit log is the only record.
- Strict TS, no `any` (narrow the polyglot AST with zod), no unsafe casts, no
  code comments unless the why is non-obvious. React 19 rules: components ≤
  ~150 lines, one per file, ≤ ~6 props, `variant`/`state` enums instead of
  boolean props, hooks own logic, no derived state in effects, hotkeys in
  `useXxxHotkeys`. New screens are `LauncherView` variants.
- Colocated tests (`*.test.ts` pure, `*.browser.test.tsx` UI); snapshots for
  empty/loading/error/populated; 80% line coverage.

## Contracts added (protected after this plan)

### `packages/rpc/src/action.ts` (create)

```ts
export const ACTION_EFFECTS = ["read", "write", "external"] as const;
export const ActionEffect = z.enum(ACTION_EFFECTS);

export const BindSource = z.discriminatedUnion("from", [
  z.object({ from: z.literal("row"), column: z.string().min(1).max(200) }),   // row-scoped actions only
  z.object({ from: z.literal("input"), name: Ident }),                        // a widget input's current value
  z.object({ from: z.literal("literal"), value: z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]) }),
]);

export const ActionTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("open-url"), baseUrl: SafeLinkUrl /* https only */, path: PathTemplate, query: z.record(z.string().max(64), QueryLeaf) }),
  z.object({ kind: z.literal("copy"), template: z.string().min(1).max(2000) }), // "{{name}}" text placeholders
  z.object({ kind: z.literal("sql"), connectionId: z.string().min(1).max(200), database: z.string().max(500).nullable(),
             dialect: Dialect, statementTemplate: z.string().min(1).max(4000), maxAffectedRows: z.number().int().min(1).max(100) }),
  z.object({ kind: z.literal("mcp"), serverId: z.string().min(1).max(100), tool: z.string().min(1).max(128), args: z.record(z.string().max(64), ArgTemplate) }),
  z.object({ kind: z.literal("http"), endpointId: z.string().min(1).max(100), method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
             path: PathTemplate, query: z.record(z.string().max(64), QueryLeaf), body: ArgTemplate.nullable() }),
]);

export const ActionDef = z.object({
  id: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(40),
  scope: z.enum(["row", "widget"]),
  effect: ActionEffect,                      // display hint; bun re-derives and refuses understatement
  target: ActionTarget,
  bind: z.record(Ident, BindSource),          // ≤ 12; every placeholder in target is bound, every binding is used
  reviewedAt: z.string(),                     // stamped by bun on save
  reviewHash: z.string().length(64),          // sha256 of canonical { target, bind, scope }, stamped by bun
  createdAt: z.string(),
  updatedAt: z.string(),
}).superRefine(actionRules);                  // row binds only when scope === "row"; placeholders ↔ bind keys

export const WidgetAction = ActionDef.extend({ widgetId: z.string().min(1).max(100) }); // stored in actions.enc
export const ActionDraft = /* ActionDef minus id?/effect/reviewedAt/reviewHash/createdAt/updatedAt */;

export type ActionContext = { runId: string; rowIndex: number | null; values: ParamValues };
export interface ActionPreview {
  token: string; expiresAt: string; effect: ActionEffect;
  label: string;
  target: { kind: ActionTarget["kind"]; name: string; environment: string | null }; // connection/server/endpoint name
  compiled: CompiledAction;                    // exactly what will run; markers for SQL, never secrets
  bound: { name: string; value: BindValue; from: "row" | "input" | "literal"; detail: string }[];
  limits: { maxAffectedRows?: number };
}
export type CompiledAction =
  | { kind: "open-url"; url: string }
  | { kind: "copy"; text: string }
  | { kind: "sql"; statement: string; params: BindValue[] }
  | { kind: "mcp"; tool: string; args: unknown }
  | { kind: "http"; method: string; url: string; body: unknown };
export type ActionOutcome =
  | { ok: true; summary: string; affectedRows?: number; status?: number; response?: unknown }  // response clipped to 16 KB
  | { ok: false; code: string; message: string };

export const AuditEntry = z.object({
  id: z.string(), executionId: z.string(), phase: z.enum(["started", "finished"]), at: z.string(),
  actionId: z.string(), actionLabel: z.string(), widgetId: z.string().nullable(),
  effect: ActionEffect, targetKind: z.string(), targetName: z.string(), environment: z.string().nullable(),
  compiled: z.unknown(), bound: z.array(z.unknown()), outcome: z.unknown().nullable(),
  durationMs: z.number().nullable(), prevHash: z.string().length(64),
});
```

`WidgetAction` is stored separately in `actions.enc`, so **`Widget` does not
change** and no second widget migration is needed. Plan 020 embeds
`ActionDef[]` in `MiniApp` directly.

Effect derivation (`deriveEffect`, pure, in `packages/rpc/src/action.ts`):

| Target                                                          | Effect                                              | Confirm sheet                                 | Audited |
| --------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------- | ------- |
| `copy`                                                          | `read`                                              | No                                            | No      |
| `open-url`                                                      | `external`                                          | No (the URL shows in the menu row's subtitle) | Yes     |
| `http` `GET`                                                    | `read`                                              | No                                            | No      |
| `http` `POST`/`PUT`/`PATCH`/`DELETE`                            | `write`                                             | Always                                        | Yes     |
| `mcp`, tool `readOnlyHint === true`                             | `read`                                              | No                                            | No      |
| `mcp`, any other tool (missing, false, or user "Treat as read") | `write`                                             | Always                                        | Yes     |
| `sql`                                                           | `write` (SQL actions are writes; reads are widgets) | Always                                        | Yes     |

### Other contract changes

- `packages/core/src/traits.ts`: a **separate capability**, not a new
  `Pool` method:

  ```ts
  export interface GuardedWrite {
    executeWrite(sql: string, params: BindValue[], options: { schema: string | null; maxAffectedRows: number; signal: AbortSignal }): Promise<{ affectedRows: number }>;
  }
  export const supportsGuardedWrites = (pool: Pool): pool is Pool & GuardedWrite => /* own-property check */;
  ```

  Implement it for **pg, mysql, sqlite, duckdb and mssql**. Each runs in an
  explicit transaction with a 15 s statement timeout. If `affectedRows >
maxAffectedRows`, it rolls back and throws `TOO_MANY_ROWS`. ClickHouse,
  Mongo and Redis do not implement it, and their actions report "Write actions
  aren't available for this database."

- `packages/rpc/src/source.ts` (plan 018's file): `fetchJson` in bun is
  generalized to `requestJson(endpoint, { method, url, body })`; GET stays
  the only method a `Source` may use.
- New encrypted files (paths in `packages/core/src/paths.ts`; all added to
  `resetSecrets`): `actions.enc` (WidgetAction records), `write-permissions.enc`
  (`{ id: "<kind>:<id>", kind: "connection" | "mcp" | "http", allowedAt }`),
  `actions-audit.enc` (append-only, one encrypted entry per line).

## Write permission model

- **Per-connection "Allow write actions", default off** (owner decision). The
  same opt-in covers each MCP server and HTTP endpoint (default off), because
  their write tools carry the same risk (owner approved 2026-11-19).
- Stored bun-side in `write-permissions.enc`, **never** on
  `DatabaseConnection` (the renderer rewrites connections wholesale).
- **Enabling** goes through `setWriteActionsAllowed({ kind, id, allowed: true })`,
  and bun first shows `confirmNative`: "Allow write actions on
  analytics-prod?" The detail line reads: "Saved actions will be able to
  change data on this connection. Every write still asks you first." Cancel is
  the default. **Disabling** needs no confirmation and takes effect for tokens
  already issued.
- **Saving or changing a write action** (any action whose derived effect is
  `write`) also calls `confirmNative`. The dialog shows the action label, the
  target name and environment, and the statement, tool or method+URL template.
  That is the save-time human review the owner requires, and it is enforced by
  bun, so a renderer cannot create write capability on its own. The in-panel
  review step (Step 6) is the comfortable version of the same information.
- `reviewHash` is checked at prepare time. A stored action whose canonical
  target and bindings no longer hash to `reviewHash` is refused with
  `ACTION_NOT_REVIEWED`. Only `saveAction`, after the native review, writes a
  new hash.

## Guarded SQL writes — what is permitted

`packages/agent/src/write-guard.ts`: `assertGuardedWrite(template, dialect) → { ok: true; kind: "insert" | "update" | "delete"; table: string } | { ok: false; reason }`.
It runs on the template with placeholders masked to `NULL`
(`maskTemplateInputs`). It shares the two-flavor lexer with `read-only-guard.ts`;
extract `stripLiterals` into `packages/agent/src/sql-lex.ts` without changing
`assertReadOnly`'s behavior (its tests must pass unchanged). A statement is
permitted only when **all** of these hold under both lexer flavors:

1. Exactly one statement (a single optional trailing `;`).
2. The leading keyword is `INSERT`, `UPDATE` or `DELETE`. No `WITH` (it rules
   out data-modifying CTEs), no `MERGE`, no `REPLACE`, no `UPSERT`.
3. One target table, with no joins and no subqueries. The words `select`,
   `join` and `union` are forbidden, as are `from` after the target in `UPDATE`
   and `using` in `DELETE`.
4. `UPDATE` and `DELETE` have a top-level `WHERE` that references at least one
   `{{placeholder}}`, so `WHERE 1=1` and `WHERE true` fail. `INSERT` is
   `INSERT INTO t (cols) VALUES (…)` with exactly one row tuple. There is no
   `INSERT … SELECT`, `ON CONFLICT` or `ON DUPLICATE KEY`.
5. Nothing from this deny-list appears outside literals: DDL and privilege
   words (`create`, `drop`, `alter`, `truncate`, `rename`, `grant`, `revoke`,
   `comment`), transaction and session words (`begin`, `commit`, `rollback`,
   `savepoint`, `set`, `lock`), and execution and file words (`call`, `exec`,
   `execute`, `do`, `copy`, `load`, `attach`, `pragma`, `into outfile`,
   `dumpfile`, `load_file`, `pg_sleep`, `sleep(`, `benchmark(`, `dblink`,
   `lo_import`, `pg_read_file`, `xp_cmdshell`, `openrowset`, `opendatasource`).
   MySQL executable comments (`/*!`) are rejected. `RETURNING` is allowed.
6. `@polyglot-sql/sdk` `parse(template-masked, dialect)` succeeds, yields one
   statement, and its top-level node kind matches rule 2. The AST is narrowed
   with a zod schema covering only the fields read. If the AST shape can't be
   classified for a dialect, the guard rejects. It never falls back to lexical
   checks alone.

At execution: `compileSqlTemplate` → `executeWrite(sql, params, { maxAffectedRows })`.
`maxAffectedRows` defaults to 1, and the maximum is 100.

## Threat model

**Assets**

- Database contents and integrity on connections with writes enabled.
- Third-party systems reachable through MCP servers and HTTP endpoints.
- Stored credentials: connection passwords, MCP env/headers, HTTP auth, AI key.
- The audit log's completeness.

**Trust boundaries**

1. **Renderer ↔ bun RPC.** The webview is semi-trusted. It renders
   attacker-influenced data (row values, tool results, HTTP bodies, tool
   descriptions) and can call every RPC.
2. **Bun ↔ databases, MCP servers and HTTP APIs.**
3. **Bun ↔ the AI provider.** It is used only at save time, and its prompts
   carry untrusted tool descriptions and schema names.
4. **Local disk.** The `.enc` files and the AES key share `~/.config/oh-my-query/`.

**Attacker-controlled inputs**

- Database cell values that a row action binds.
- MCP tool descriptions, annotations and results.
- HTTP response bodies.
- Anything pasted into prompts.

**Out of scope**

- An attacker running code as the user. They can read `.key` and every
  `.enc` file, and they could run SQL directly. Encryption at rest protects
  against casual disclosure, backups and sync, not against this attacker.
- Malicious owners of configured MCP servers beyond their own tools. A server
  is trusted to execute its own tools, not to choose which of our actions run.

| #   | Attacker story                                                                                      | Mitigation in this plan                                                                                                                                                                                                                      | Residual                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | A cell value like `1 OR 1=1` or `'; DROP TABLE x; --` is bound into a write                         | Values are bind parameters; the guard requires a placeholder in `WHERE`; `maxAffectedRows` rolls back larger hits; the driver tests prove injection-as-data                                                                                  | A legitimately bound wrong row; the confirm sheet shows the exact value                                                                                                     |
| T2  | An AI-proposed or prompt-injected statement (via tool descriptions or schema comments) deletes data | AI output only fills the editor; the write guard; in-panel review, then a native save dialog; never executed on the fly                                                                                                                      | A user approves a harmful but well-formed statement, which is recorded in the audit log                                                                                     |
| T3  | Compromised renderer (XSS from rendered data) executes writes                                       | React text-only rendering, no `dangerouslySetInnerHTML` (grep gate); write capability needs native dialogs (opt-in and save); row values come from bun's own run cache; inputs zod-checked; tokens single-use and bound to the compiled hash | It can self-confirm existing reviewed actions with input/literal values; this residual is accepted and recorded for the secure review                                       |
| T4  | Effect downgrade: a tool's `readOnlyHint` lies or flips                                             | The effect is derived at prepare time from live `listTools`; only `readOnlyHint === true` counts; user "Treat as read" never removes confirmation                                                                                            | A server that lies with `readOnlyHint: true` runs without confirmation. This is documented in the confirm-less read row; such tools are still listed with their server name |
| T5  | Confirm-sheet spoofing or reflex confirm                                                            | Confirm is never default-focused; ⌘↵ is required; enabled only after 600 ms; the sheet shows connection name and environment in amber, plus exact values; ↵ alone never confirms                                                             | Habituation over time; mitigated by showing environment and values every time                                                                                               |
| T6  | Token replay / TOCTOU between preview and execute                                                   | The token is single use, expires after 120 s, and is bound to the SHA-256 of the compiled call; opt-in, tool effect and connection are re-checked at execute                                                                                 | None material                                                                                                                                                               |
| T7  | open-url phishing via row data (`javascript:`, other hosts)                                         | `SafeLinkUrl` is https only with a fixed origin; values are whole encoded path segments or query values; `buildRequestUrl` asserts origin; actions never use the unvalidated `openExternal` RPC                                              | The pre-existing `openExternal` RPC (rpc.ts:270) accepts any URL. Flag it in the secure review; fixing it is a one-line scheme allow-list if the review agrees              |
| T8  | Auth-header leak via redirect or the audit log                                                      | `redirect: "manual"`; the audit records method + URL + body, never headers; `compiled` never includes secrets                                                                                                                                | —                                                                                                                                                                           |
| T9  | Audit tampering or truncation                                                                       | Append-only encrypted lines with a SHA-256 hash chain (`prevHash`); Activity shows "Log verified" or the first broken link; a failed `started` append blocks the write                                                                       | Tail truncation by a local attacker is undetectable; that attacker is out of scope                                                                                          |
| T10 | Write path reachable from read paths                                                                | Separate guard, separate capability (`GuardedWrite`), and separate service; a test asserts that `runWidget`, `previewSource` and `ask` never call `executeWrite`; `rg` gate in Done criteria                                                 | —                                                                                                                                                                           |
| T11 | Data exfiltration through an external action (open-url with row values to a third-party host)       | The origin is fixed at save time by the native-reviewed definition (open-url is saved with the same review step, without the native dialog); audited                                                                                         | A user-authored link to their own tool, which is intended                                                                                                                   |

**Severity calibration for the secure review**

- **Critical**: any path where a write runs without a confirm sheet, or
  executes SQL outside `assertGuardedWrite`, or reaches `executeWrite` from a
  read path.
- **High**: a bound value that changes statement structure or URL origin;
  write capability created without a native dialog; secrets in RPC or audit.
- **Medium**: an audit entry missing for a write or external action; a
  confirm sheet that omits a bound value.
- **Low**: Activity UI inaccuracies that don't hide entries.

## Security review gate

Before merge, run `/factory secure` scoped to this branch's diff (Factory
"security diff" flow), with the threat model above as input. Persist the report
under `.factory/security/scans/`. Merge only when every High or Critical
finding is fixed and re-verified. Record accepted Medium and Low findings,
with their rationale, in the PR. The T3 and T7 residuals must appear in the
report as explicitly reviewed.

## UI and motion (mandatory)

Use the motion system in `apps/app/src/mainview/lib/motion.ts` and
`components/motion/`. Do not hand-roll transitions.

- **Tokens:**
  - `SPRING`: morphs and push/pop.
  - `SPRING_SNAPPY`: selection, focus pills, toggles.
  - `SPRING_SOFT`: heights, sheets, reveals.
  - `SPRING_MOMENTUM`: only after a drag release.
  - `FADE_IN`: 160 ms. `FADE_OUT`: 110 ms.
  - `PRESS`: scale 0.97.
  - `staggerDelay`: 30 ms, capped at 6.
  - Primitives: `<Pressable>`, `<SwapText>`, `<Reveal>`, `check-draw.tsx`.
  - `useMotionPreset()` for reduced motion.
- **Principles:**
  - Respond on press.
  - Everything is interruptible, with no input lockout. The 600 ms confirm
    enablement is an interaction rule, not an animation, and Cancel and Esc
    work throughout.
  - Exits take about 70% of the entrance duration.
  - Animate only `transform`, `opacity` and `filter`, and use `layout` for
    size.
  - One primary motion per moment.
  - Only progress indicators loop.
- **Accessibility:**
  - The confirm sheet is a modal `role="alertdialog"` with
    `aria-labelledby` and `aria-describedby`.
  - Focus is trapped and starts on **Cancel**. It returns to the invoking row
    on close.
  - A live region announces "Write completed: 1 row updated" or the error.
  - Amber connection text meets WCAG AA on the translucent panel and on its
    opaque fallback.
  - Reduced transparency makes the sheet opaque. Increased contrast gives it
    solid borders.
- **Flicker:**
  - Loading states wait 150 ms before showing, and stay at least 300 ms once
    shown.
- **Copy:**
  - Quiet and exact. "Run write", not "Execute!".
  - Name the connection: "Writes to analytics-prod · at most 1 row".

### Confirm sheet design (write effect)

- The sheet slides up from the bottom edge of the launcher body and covers it
  (not the input row). The panel height morphs to fit. The dimmed card behind
  it stays visible at 0.4 opacity.
- **Header:**
  - Action label, e.g. "Refund charge".
  - A `write` effect badge.
- **Target line:**
  - SQL: "Writes to **analytics-prod**" (name in amber, with the environment
    badge, e.g. `production`), "· at most 1 row".
  - MCP: "Calls **refund_charge** on **Stripe**".
  - HTTP: "**POST** api.example.com/v1/refunds".
- **Exact call:**
  - SQL: the statement in `SqlBlock` with markers highlighted.
  - MCP: the args JSON pretty-printed with the bound leaves highlighted.
  - HTTP: the URL and body.
- **Bound values table:** each row shows name · value (monospace, untruncated,
  wraps) · source (`row.charge_id`, `input region`, `literal`).
- **Buttons:** **Cancel** (focused, Esc) and **Run write ⌘↵**.
  - The confirm button is disabled for its first 600 ms, with a static label
    and no countdown animation.
  - ↵ on Cancel cancels. ↵ never confirms.
- **Outcome:** after running, the sheet swaps its body for the outcome
  ("1 row updated · 42 ms", or the error with its code). ⌘C copies the outcome,
  and Esc closes.

### Motion moments in this plan

| Moment                     | Trigger                                       | What moves                                                                                             | Token                                    | Reduced motion       |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- | -------------------- |
| Row selection              | ↑/↓ in a focused table, click                 | The selection highlight moves between rows via `layoutId="row-selection"`                              | `SPRING_SNAPPY`                          | Instant              |
| Row actions menu           | ⌘K with a selected row, right-click / ⌃-click | `ActionsMenu` scales 0.96→1 from the row (origin = row), row actions first, then widget actions        | `SPRING_SNAPPY` / `FADE_OUT`             | Crossfade            |
| Read/external action       | ↵ on an action row                            | Menu closes; footer `<SwapText>` "Copied" / "Opened in browser"                                        | `FADE_OUT`, `FADE_IN`                    | Instant              |
| Preparing                  | ↵ on a write action                           | Menu closes; if prepare exceeds 150 ms, a 2 px hairline shows (min 300 ms)                             | `FADE_IN`                                | Static hairline      |
| Confirm sheet enter        | Preview ready                                 | Sheet `y 100%→0` + backdrop to 0.4; panel height morphs via `layout`                                   | `SPRING_SOFT`, `FADE_IN`                 | Crossfade, no travel |
| Confirm sheet exit         | Esc / Cancel                                  | Reverse of enter at ~70% duration                                                                      | `SPRING_SOFT`, `FADE_OUT`                | Crossfade            |
| Confirm enables            | 600 ms after open                             | Button opacity 0.5→1                                                                                   | `FADE_IN`                                | Instant              |
| Running write              | ⌘↵                                            | Button `PRESS`; label `<SwapText>` "Running…"; hairline loops                                          | `PRESS`, `FADE_IN`                       | Static               |
| Outcome                    | Execute resolves                              | Body crossfades to outcome; success check draws in; error `ErrorNotice` `<Reveal>`                     | `FADE_IN`, `check-draw`                  | Instant, no draw     |
| Action editor push         | "Add Action…" in ⌘K                           | Standard stack push; target-kind segmented thumb slides; field group swaps with `layout`               | `SPRING`, `SPRING_SNAPPY`, `SPRING_SOFT` | Crossfade            |
| AI suggestion fills editor | ⌘⇧S "Suggest"                                 | Filled fields one-shot amber pulse (0.14→0, 900 ms), staggered                                         | `staggerDelay`, `FADE_OUT`               | No pulse             |
| Review step                | ⌘↵ in editor (write)                          | Push `action-review`, showing exactly the confirm sheet's body with sample values from the current row | `SPRING`                                 | Crossfade            |
| Write toggle on connection | Space on "Allow write actions"                | Toggle thumb slides **after** the native dialog returns OK (never optimistic)                          | `SPRING_SNAPPY`                          | Instant              |
| Activity list              | Open Activity                                 | Day groups `<Reveal>`; first 6 rows stagger; new entries insert via `layout` with a single amber pulse | `FADE_IN`, `staggerDelay`, `SPRING`      | Instant              |
| Activity detail            | ↵ on an entry                                 | Push detail view; compiled call and values `<Reveal>`                                                  | `SPRING`, `FADE_IN`                      | Crossfade            |

## Scope

**In scope**

- `packages/rpc/src/action.ts` (create) + `action.test.ts`; `schema.ts`, `index.ts`.
- `packages/agent/src/sql-lex.ts` (extracted), `write-guard.ts` + test,
  `propose-action.ts` + test, `read-only-guard.ts` (import the extracted lexer
  only), `index.ts`.
- `packages/core/src/traits.ts` (`GuardedWrite`, `supportsGuardedWrites`),
  `paths.ts`, `persistence.ts` (`resetSecrets`), `actions.ts` (create:
  action store, permission store), `audit-log.ts` (create: append, read,
  verify chain) + tests.
- `packages/drivers-{pg,mysql,sqlite,duckdb,mssql}/src/pool.ts` + tests (`executeWrite`).
- `apps/app/src/bun/`:
  - Create `action-service.ts`, `action-executor.ts`, `run-cache.ts` and
    `write-permissions.ts`, each with tests.
  - `http-fetch.ts` (generalize to `requestJson`).
  - `widget-service.ts` (record runs into `run-cache`).
  - `rpc.ts`.
- `apps/app/src/mainview/`:
  - `components/ask/card-table.tsx` (row selection).
  - `components/actions/` (create: row menu, confirm sheet, editor, review,
    hooks).
  - `components/activity/` (create).
  - `components/widgets/widget-run-view.tsx`, `widget-actions.ts`,
    `use-widget-menu.ts`.
  - `components/launcher/use-launcher-stack.ts`, `launcher-panel.tsx`,
    `root-commands.ts`.
  - Connection settings: the "Allow write actions" row in
    `views/connection-edit-view.tsx` and the plan 018 source editors.
  - `lib/ipc.ts`, `lib/browser-ipc-stub.ts` (+ `browser-action-stub.ts`).
- `apps/app/e2e/action-flow.spec.ts` (create).
- `.factory/security/scans/<id>/` (report from the review gate).

**Out of scope**

- Actions on board tiles (boards keep read-only tiles in v1; deferred).
- Actions in mini-apps (plan 020 consumes `ActionDef`).
- Actions exposed through the MCP server (plan 016 stays read-only in v1).
- Multi-statement or transactional "scripts". DDL of any kind. Bulk writes over 100 rows.
- Changing `Widget`, `Board`, `CardSpec`, `AskEvent`, `assertReadOnly` behavior.
- Undo. The audit entry records what ran; reverting is a new, reviewed action.

## Git workflow

- Branch `feat/019-actions` from the branch carrying plan 018. Commit only if authorized. Do not push or open a PR unless instructed.

## Steps

### Step 1: Contracts and pure rules (rpc)

Create `action.ts` as specified: `ActionTarget`, `ActionDef`, `WidgetAction`,
`ActionDraft`, `deriveEffect(target, toolReadOnlyHint: boolean | null)`,
`actionRules` (placeholders in `path`/`query`/`args`/`body`/`template`/
`statementTemplate` ↔ `bind` keys; `row` binds only with `scope: "row"`),
`canonicalActionJson(def)` (stable key order, used for `reviewHash` and the
token hash). Tests: every rule, every effect row in the table above, canonical
JSON stable under key reordering.

### Step 2: Write guard and driver capability (agent + core + drivers)

- Extract the lexer to `sql-lex.ts`; `read-only-guard.test.ts` passes
  unchanged.
- `write-guard.ts` per "Guarded SQL writes". Table-driven tests: every
  permitted shape per dialect, and rejections for `WHERE 1=1`, missing
  `WHERE`, `WITH … DELETE`, `UPDATE … FROM`, `DELETE … USING`, subqueries,
  `INSERT … SELECT`, multi-row `VALUES`, `ON CONFLICT`, two statements, a
  statement hidden in a comment or literal under one flavor only, `/*!`,
  every deny-list word, and an AST that polyglot can't parse.
- `GuardedWrite` in `traits.ts`; implement `executeWrite` per driver with the
  client's native transaction and parameter API, a 15 s statement timeout, and
  rollback when `affectedRows > maxAffectedRows`. Driver tests (where a harness
  exists; pg via `bun run fixtures:up`): one row updated, `TOO_MANY_ROWS`
  rolls back (row count unchanged afterwards), a malicious string value is
  stored as data, cancellation rolls back.

### Step 3: Stores, permissions and the audit log (core + bun)

- `core/src/actions.ts`: `createActionStore(parse)` over `actions.enc`
  (`listForWidget`, `get`, `save`, `remove`, `removeForWidget`), and
  `createPermissionStore(parse)` over `write-permissions.enc`.
- `core/src/audit-log.ts`:
  - `appendAudit(entry)` encrypts one line, appends it under the file lock,
    and computes `prevHash` from the previous **encrypted** line (or 64 zeros).
  - `readAudit({ limit, offset })` returns newest first.
  - `verifyAudit()` returns `{ ok: true } | { ok: false; brokenAt: index }`.
  - Never truncate.
  - Tests: chain across appends, a tampered middle line detected, concurrent
    appends serialized, an unreadable line reported and not thrown.
- `bun/write-permissions.ts`: `isAllowed(kind, id)` and `setAllowed(kind, id, allowed)`.
  Enabling calls the injected `confirmNative`. Deleting a connection, server or
  endpoint removes its permission.
- Add every new path to `resetSecrets`.

### Step 4: Run cache and action service (bun)

- `bun/run-cache.ts`: `widget-service` records each successful `runWidget`
  result by `runId`, keeping at most 20 runs for 10 min, with columns and rows
  only. `rowAt(runId, rowIndex)` resolves a row from that cache. Board and
  preview runs are not cached, because actions are launcher-only in v1.
- `bun/action-service.ts` — `createActionService(deps)`:
  - `listActions(widgetId)` returns actions with their **derived** effect.
  - `saveAction({ widgetId, draft })` does the following, in order:
    1. Zod-parses the draft.
    2. Runs `actionRules`.
    3. For `sql` targets, runs `assertGuardedWrite` and checks that the
       connection's pool supports `GuardedWrite`.
    4. For `mcp` targets, checks that the tool exists.
    5. Derives the effect. For a write, it requires `confirmNative` with the
       full template. Declining throws `REVIEW_DECLINED`.
    6. Stamps `reviewedAt` and `reviewHash`, then stores the action.
  - `deleteAction`.
  - `prepareAction({ actionId, context })` does the following, in order:
    1. Loads the action and recomputes `reviewHash`.
    2. Re-derives the effect from live data, using `listTools` for MCP.
    3. Refuses an understated stored effect.
    4. For a write, requires the target's write permission.
    5. Resolves the bindings: `row` values come from `run-cache` (a missing run
       returns `RUN_EXPIRED`: "Run the widget again to act on its rows"),
       `input` values are validated against the widget's `ParamDef`, and
       `literal` values are used as stored.
    6. Compiles the call: `compileSqlTemplate`, `bindArgs` or
       `buildRequestUrl` plus `bindArgs` for the body. `copy` replaces
       `{{name}}` with `String(value)`.
    7. Issues a token and returns an `ActionPreview`.
  - `executeAction({ token })` does the following, in order:
    1. Consumes the token.
    2. Re-checks the permission and the effect, and that the compiled call
       hash matches.
    3. For write and external actions, appends the `started` audit entry and
       aborts if that append fails.
    4. Runs the call through `action-executor.ts`.
    5. Appends the `finished` entry.
    6. Returns `ActionOutcome`.
  - `copy` runs in the renderer with `copyText(compiled.text)`. `open-url` runs
    in bun with `Utils.openExternal` on the validated URL.
  - Bound values in audit entries pass through `redactPii` when the connection
    has `piiRedaction` on.
- `bun/action-executor.ts`: `sql` → `ensurePool` + `executeWrite`; `mcp` →
  `callTool` (30 s); `http` → `requestJson` (`redirect: "manual"`, JSON body,
  1 MB response cap, response clipped to 16 KB for the outcome).
- Tests (fakes for pools, MCP manager, fetch, `confirmNative`, clock):
  - No write runs without a token.
  - A token can't be reused or used after expiry.
  - Turning the permission off between prepare and execute refuses the run.
  - A tool that flips from read to write gets a confirm path.
  - A tampered stored action is refused.
  - A failed audit append blocks execution.
  - Row values come from the cache, not the request.
  - Input validation rejects bad values.
  - The `started` and `finished` audit pair is written.
  - `runWidget`, `previewSource` and the ask service never reach
    `executeWrite` (a spy).

### Step 5: Proposing actions (agent, save time only)

`packages/agent/src/propose-action.ts` —
`proposeAction({ prompt, widget columns, inputs, targets, model, signal }) → { draft } | { error }`.
`targets` is one of:

- the connection's schema (tables plus columns, reusing `schema-prompt.ts`);
- the server's tools with annotations;
- the endpoint name.

The output is validated with `ActionDraft`, `actionRules` and, for SQL,
`assertGuardedWrite`, with one repair pass. The function never saves and never
executes. Its result only fills the editor.

Tests use the mock model:

- a valid UPDATE proposal;
- a proposal with `WHERE 1=1`, which is rejected;
- a proposal binding a column that doesn't exist, which is rejected;
- a prompt-injected tool description asking for `DROP`, where the guard
  rejects the result.

### Step 6: Renderer

- **Row selection** in `card-table.tsx`:
  - A focusable table with roving `aria-selected` rows, moved with ↑/↓.
  - Selection is lifted through a small `useRowSelection` hook owned by
    `WidgetRunPanel`.
  - Selection resets when the run changes.
- **Row context menu** opens on right-click or ⌃-click on a row, and on ⌘K
  with a row selected. It reuses `ActionsMenu` and lists:
  1. the row actions;
  2. "Copy Value" and "Copy Row as JSON" (built-in `copy` reads);
  3. the widget actions.

  Each action row shows an effect glyph and a subtitle with its target name.

- **Widget-level actions** appear in the existing `⌘K` menu above "Copy SQL".
  "Add Action…" and "Manage Actions…" are added to `widget-actions.ts`.
- **`LauncherView` variants:**
  - `{ kind: "action-edit"; widgetId; draft: ActionDraft | null; actionId: string | null }`
  - `{ kind: "action-review"; widgetId; draft: ActionDraft }`
  - `{ kind: "activity" }`
  - `{ kind: "activity-entry"; executionId }`
- **Action editor**, split into small files under `components/actions/editor/`:
  - Label, and scope (row or widget).
  - Target kind, chosen with a segmented control.
  - Target fields per kind. The statement uses `SqlBlock`-style mono input.
    The MCP tool picker shows a "Read-only" or "Changes data" badge. HTTP has a
    method select.
  - A binding table that is generated from the placeholders, with one select
    per placeholder: row column, input or literal.
  - Max rows for SQL.
  - ⌘⇧S "Suggest" calls `proposeAction`.
  - ⌘↵ goes to review when the action writes, and saves directly otherwise.
- **Review view:** shows the confirm sheet body with the current row's
  values, plus "Save Action ⌘↵". Bun then shows the native dialog. On decline,
  the view stays open with "Not saved".
- **Confirm sheet** (`components/actions/confirm-sheet/`): as designed above.
  - Owned by `useActionRun` (prepare → confirm → execute → outcome reducer).
  - Hotkeys live in `useConfirmSheetHotkeys`.
- **Connection and source settings:** an "Allow write actions" toggle row.
  - Description: "Saved actions can change data here. Every write asks you
    first."
  - It becomes on only after `setWriteActionsAllowed` resolves true.
- **Activity view** (root command "Activity", and a link in Settings):
  - Entries are grouped by day, newest first.
  - Each row shows effect, label, target name (amber for writes), outcome
    ✓/✗ and relative time.
  - Type-to-filter on label and target.
  - The header shows integrity: "Log verified", or "Log broken at entry N".
  - The detail view shows the compiled call, the bound values, the outcome and
    the duration.
  - Empty state: "No actions yet. Writes and links you run appear here."
- **States to design and snapshot:**
  - action menu with no actions;
  - editor per target kind;
  - review;
  - confirm sheet for SQL, MCP and HTTP;
  - running;
  - success;
  - error (`TOO_MANY_ROWS`, `RUN_EXPIRED`, permission off, driver unsupported);
  - Activity empty, populated and broken-chain.

### Step 7: Desktop verification and the security gate

1. In `desktop:dev`, drive with `cua-driver` against the fixture Postgres.
2. Turn on "Allow write actions" for the fixture connection. The native dialog
   must appear above the launcher, with Cancel as the default.
3. Create a row action `UPDATE orders SET status = {{status}} WHERE id = {{id}}`
   bound to `row.id` and a literal `shipped`. Review it and accept the native
   dialog.
4. Run it on one row. Check that:
   - the sheet shows the connection in amber, the environment, the statement
     and both values;
   - ↵ does nothing;
   - ⌘↵ runs it;
   - Activity shows the entry.
5. Turn writes off and try again. You should see the "Allow write actions"
   error.
6. Repeat with the plan 018 stub or a real MCP server's write tool.
7. Run `/factory secure` on the branch diff and fix any finding rated High or
   Critical.

## Test plan

- **rpc:** `action.test.ts` (Step 1).
- **agent:**
  - `write-guard.test.ts` (Step 2);
  - `propose-action.test.ts` (Step 5);
  - the existing `read-only-guard.test.ts`, unchanged.
- **core:** `actions.test.ts` and `audit-log.test.ts` (Step 3). Model them
  after `widgets.test.ts` and the history tests in `persistence.test.ts`.
- **drivers:** `executeWrite` tests for pg, mysql, sqlite, duckdb and mssql,
  where a harness exists.
- **bun:**
  - `action-service.test.ts` (every Step 4 case);
  - `run-cache.test.ts`;
  - `write-permissions.test.ts`;
  - `action-executor.test.ts`.
- **renderer browser tests:**
  - row selection keyboard and pointer;
  - the row menu contents per effect;
  - the confirm sheet: focus starts on Cancel, ↵ cancels, ⌘↵ is disabled for
    600 ms and then confirms, Esc closes, the bound-values table and amber
    connection are present, the live region announces the outcome;
  - editor binding generation;
  - the review → save-declined path;
  - Activity filter and the integrity line;
  - both motion branches for every animated component;
  - snapshots for every state listed in Step 6.
- **e2e** `action-flow.spec.ts` (browser stub):
  1. Enable writes on the stub connection. The stub emulates the native
     dialog as accepted.
  2. Add a row action and review it.
  3. Run it on row 2.
  4. Assert from `globalThis.__omqIpcLog` that `executeAction` was called once
     with a token and **no statement or values in the payload**.
  5. Open Activity and see the entry.

## Done criteria

- [ ] All package tests, `bun run --cwd apps/app test` (both projects), `e2e`, `check-types` and `check` pass; app coverage ≥ 80%.
- [ ] `rg -n "readOnly: false|executeWrite" apps/app/src packages --glob '!*.test.*'` shows `executeWrite` only in drivers, `traits.ts` and `action-executor.ts`, and no `readOnly: false` anywhere.
- [ ] `rg -n "dangerouslySetInnerHTML" apps/app/src/mainview` returns nothing.
- [ ] Tests prove: no write without a single-use token; a token can't be replayed; permission revocation takes effect before execute; a failed audit append blocks the write; row values come from bun's run cache; a tampered action is refused; the effect is never taken from storage or AI output.
- [ ] `assertGuardedWrite` rejects every case listed in Step 2; driver tests show `TOO_MANY_ROWS` rolls back and injection strings are stored as data.
- [ ] Enabling write actions and saving a write action each require a native dialog with Cancel default; declining changes nothing (tests + desktop).
- [ ] The confirm sheet never focuses the confirm button by default, requires ⌘↵, shows the exact statement/call, every bound value and the connection name in amber with its environment.
- [ ] `actions-audit.enc` holds a verified hash chain after the desktop run; Activity shows each write and external action with outcome; no secret appears in any entry (test).
- [ ] `/factory secure` report saved under `.factory/security/scans/`; no open High/Critical; T3 and T7 residuals explicitly addressed.
- [ ] Every row of "Motion moments in this plan" implemented with its token and reduced-motion fallback, with a browser test per branch; recordings at 1× and 0.25× (`?slowmo=4`) attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of row select → ⌘K → confirm sheet → run → outcome shows no frame over 16.7 ms and only `transform`/`opacity`/`filter` animating.
- [ ] Reduced Motion, Reduce Transparency and Increase Contrast verified on the confirm sheet, editor, review and Activity; amber text passes WCAG AA on both panel materials.
- [ ] No files outside the in-scope list are modified (`git status`); README status row updated.

## STOP conditions

- polyglot's AST can't reliably classify statement kind, `WHERE` presence or
  table count for a supported dialect. Ship write actions only for dialects
  where it can, report the rest, and never fall back to the lexical check alone.
- A driver can't run `executeWrite` inside a transaction with an
  affected-row count before commit. Exclude that engine and report; do not
  ship an engine without the row-limit rollback.
- `Utils.showMessageBox` can't be shown above the launcher panel with
  keyboard focus. Report. Do not replace the native dialog with an in-webview
  one; that removes the T3 mitigation.
- The secure review finds a Critical issue whose fix changes owner decision #2
  (for example, writes from the ask flow). Stop and ask the owner.
- Implementing actions requires changing `Widget`, `Board`, `CardSpec`,
  `AskEvent` or `assertReadOnly` behavior.
- The owner rejects extending "Allow write actions" to MCP servers and HTTP
  endpoints. Remove those toggles, keep confirm sheets, and report.

## Maintenance notes

- Plan 020's `MiniApp.actions: ActionDef[]` must call `prepareAction` and
  `executeAction` through this service, with a mini-app run cache instead of a
  widget run cache. Do not duplicate the effect derivation or the token logic.
- Plan 016's MCP server must never expose actions in v1. If it ever does,
  every write needs the same native confirmation in the app, not in the
  calling agent.
- If `CardSpec` gains drill-down (plan 012), row selection here and drill-down
  clicks must share one selection model.
- Reviewers should scrutinize `write-guard.ts`, `action-service.ts` (token,
  re-checks, audit ordering), each driver's `executeWrite` rollback path, and
  the confirm sheet's focus handling.
- Deferred: actions on board tiles; undo templates; bulk (multi-row
  selection) actions with per-row confirm; audit log rotation and export;
  fixing the pre-existing unvalidated `openExternal` RPC if the secure review
  does not do it.
