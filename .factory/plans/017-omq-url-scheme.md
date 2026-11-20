# Plan 017: Drive the launcher with `omq://` links

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- apps/app/electrobun.config.ts apps/app/src packages/rpc/src`
> and `git status --short`. Plans 001–007 sit uncommitted in the working tree
> and are the baseline. Confirm: `apps/app/package.json` pins `electrobun`
> `2.0.6` and `apps/app/.hutch/types/config/ElectrobunConfig.d.ts` still
> documents `app.urlSchemes`; `LauncherNavigateView` in
> `packages/rpc/src/schema.ts:30-33` is `"root" | "settings" | { kind: "widget-run"; widgetId }`;
> `apps/app/src/bun/index.ts` imports `electrobun/main` first. **If plan 009
> landed** (the `@connection` input chip), map the link's `conn` onto that chip
> instead of the staged chip described in Step 5.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED (an external, untrusted entry point into the app)
- **Depends on**: none (plan 009 soft: reuse its connection chip if present)
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-19, on `feat/launcher-002-shell`
  with plans 001–007 implemented but uncommitted (the working tree is the
  baseline)

## Why this matters

Raycast quicklinks, Alfred workflows, Apple Shortcuts, shell scripts and a
team wiki can all open a URL. A small `omq://` scheme lets them summon the
launcher with a question already typed, open a saved widget, or open a board,
so oh-my-query fits into the tools people already drive their day with. Links
are untrusted input from anywhere, so the scheme is designed so that a link can
**prepare** work but never **start** an AI ask on its own; the user's ↵ stays
the moment of consent.

## Current state

- **Electrobun 2.0.6** (verified):
  - `apps/app/.hutch/types/config/ElectrobunConfig.d.ts:59-74`:
    `app.urlSchemes?: string[]` — "macOS: Fully supported. App must be in
    /Applications folder for registration to work." The build engine writes
    `CFBundleURLTypes` → `CFBundleURLSchemes` into `Info.plist`.
  - Incoming URLs: `.hutch/devkit/api/sdks/main/proc/native.ts:3145-3157`
    registers a native `setURLOpenHandler` at SDK module load and emits the
    app event `"open-url"` with `{ url }`
    (`sdks/main/events/ApplicationEvents.d.ts:7-20`). The app subscribes with
    `Electrobun.events.on("open-url", (event) => …)`, the same API
    `launcher.ts:168` uses for `"reopen"`. If no listener is attached when a
    URL arrives (cold start), the event is lost — so subscribe before the
    first `await` in `main()`.
- **Bun entry** — `apps/app/src/bun/index.ts`: `main()` builds RPCs, board
  windows, then `await readLauncherHotkey()` and `createLauncher(...)`. Line 1
  warns: don't import `@oh-my-query/core` here (its WASM top-level await
  before `electrobun/main` deadlocks the worker). `@oh-my-query/core/client`
  and `@oh-my-query/rpc` are WASM-free (`packages/core/src/client.ts:1-3`).
- **Launcher controller** — `apps/app/src/bun/launcher.ts:81-108`:
  `navigate(view)` shows the window if hidden and sends
  `launcherNavigate({ view })`. `markRendererReady()` flips a flag set by the
  `rendererReady` request. A navigate sent before the renderer subscribes is
  dropped today.
- **Board windows** — `rpc.ts:263-269` `openBoard` handler: `boards.getBoard`
  then `host.boardWindows()?.open(board.id, boardTitle(board))`; throws
  `BOARD_NOT_FOUND` when missing.
- **Renderer navigation** — `components/launcher/launcher-panel.tsx:262-273`:
  ```ts
  const handleNavigate = useEffectEvent((view: LauncherNavigateView) => {
    if (view === "settings") {
      stack.push(SETTINGS);
      return;
    }
    stack.reset();
    if (typeof view === "object") {
      stack.push({ kind: "widget-run", values: {}, widgetId: view.widgetId });
    }
  });
  ```
  The widget run view runs on open with the widget's last values
  (`components/widgets/use-widget-run.ts:30-75`), and bun validates every value
  against the widget's `ParamDef` (`widget-service.ts:229-259`).
- **Root** — `components/launcher/views/root-view.tsx`: the query is owned by
  `LauncherStackView` (`setQuery`). The "Ask {connection}" row is built from
  `askWith = activeConnection` when the AI is ready (`root-view.tsx:122-131`,
  `root-items.ts:100-111`); ↵ on it calls `startAsk(prompt, { connectionId })`,
  which pushes the ask view and calls the AI. Widget argument pills come from
  `views/use-root-arguments.ts` (`open(widgetId)` fills `currentValues`).
  Connections and `activate(connection)` come from
  `components/launcher/connections/connections-provider.tsx`.
- **Value validation** — `packages/rpc/src/widget.ts`: `Ident`
  (`/^[a-z][a-z0-9_]{0,31}$/`), `paramValueSchema(def, allowedOptions?)`,
  `RangePreset`, `IsoRange`, `editableParams`. Prompts are capped at 4,000
  characters by the ask service (`ask-service.ts:38`).
- **Catalog menu** — `views/catalog-actions.ts` / `use-catalog-menu.ts`
  (widget and board ⌘K), widget run menu `components/widgets/widget-actions.ts`
  / `use-widget-menu.ts`; `lib/clipboard.ts` `copyText`.

## Commands you will need

| Purpose        | Command                                                   | Expected                                |
| -------------- | --------------------------------------------------------- | --------------------------------------- |
| RPC tests      | `bun run --cwd packages/rpc test`                         | pass                                    |
| App tests      | `bun run --cwd apps/app test`                             | all pass (both projects)                |
| Types / lint   | `bun run check-types`, `bun run check`                    | exit 0                                  |
| e2e            | `bun run --cwd apps/app e2e`                              | all pass                                |
| Packaged build | `bun run --cwd apps/app desktop:build`                    | `.app` produced under `apps/app/build/` |
| Open a link    | `open 'omq://ask?q=revenue%20by%20region&conn=analytics'` | launcher appears, staged                |
| Desktop dev    | `bun run --cwd apps/app desktop:dev` + `cua-driver` skill | manual checks below                     |

## Threat model and the ↵ rule

Anyone can produce an `omq://` link: a web page, an email, a chat message, a
calendar invite, another app, or any local process via `open`. Browsers
usually ask "Open oh-my-query?", but that prompt can be remembered, and other
apps do not ask at all. So:

- **An ask never starts from a link.** The link fills the input and selects
  the target connection; nothing leaves the machine until the user presses ↵.
  Why: an ask sends the database schema (table and column names, and whatever
  the prompt pipeline includes) plus the link's text to the configured AI
  provider — that is data egress and spend under wording an attacker chose. The
  text can also be a prompt injection that steers the generated SQL toward
  sensitive tables or expensive scans. The read-only guard stops writes; it does
  not stop what gets read, shown on screen, or billed. Seeing the exact
  question and connection, then pressing ↵, is the consent.
- **A saved widget may run from a link only when the link supplies nothing but
  its id.** That is exactly what clicking it on a board does today: the SQL is
  a template the user saved and reviewed, it runs read-only with bound
  parameters, and it never calls the AI.
- **Link-supplied input values are staged, not run.** They open the widget's
  argument pills pre-filled; ↵ runs. Otherwise a link could bind arbitrary
  values (an email, a region) and persist them as the widget's last values
  without the user seeing them.
- **Boards open** like any board open (tiles refresh on their own schedule).
- **Links never create, change or delete anything**, never carry credentials,
  and never switch the active connection by themselves (the switch happens on ↵).
- **Last link wins.** Links do not queue work; a burst of links only re-stages
  the panel.
- **Logs record the route only** (`[link] ask`, `[link] widget`), never the
  prompt or values, which may contain personal data.

## Contracts added

`packages/rpc/src/omq-link.ts` (pure, exported from `index.ts`, shared by bun
and the browser stub):

```ts
export const OMQ_SCHEME = "omq";
export type OmqLink =
  | { kind: "open" }                                                   // omq:// or omq://open
  | { kind: "ask"; prompt: string; connection: string | null }         // omq://ask?q=…&conn=…
  | { kind: "widget"; widgetId: string; values: Record<string, string> } // omq://widget/:id?name=…
  | { kind: "board"; boardId: string };                                // omq://board/:id
export const parseOmqLink = (raw: string): { ok: true; link: OmqLink } | { ok: false; reason: string };
export const askLink = (prompt: string, connectionName: string | null): string;
export const widgetLink = (widgetId: string, values?: Record<string, string>): string;
export const boardLink = (boardId: string): string;
```

`LauncherNavigateView` (`packages/rpc/src/schema.ts`) gains:

```ts
| { kind: "ask-draft"; prompt: string; connection: string | null }
| { kind: "widget-args"; widgetId: string; values: Record<string, string> }
| { kind: "notice"; message: string }
```

`connection` is the raw `conn` text (an id or a name); the renderer resolves it.

## UI and motion (mandatory)

Use `apps/app/src/mainview/lib/motion.ts` and `components/motion/`. Tokens:
`SPRING`, `SPRING_SNAPPY`, `SPRING_SOFT`, `FADE_IN` 160ms, `FADE_OUT` 110ms,
`DRAW`; `useMotionPreset()` for reduced motion. Respond on press,
interruptible springs, exit the way you entered, animate only
`transform`/`opacity`/`filter`, one primary motion per moment. Reduced
transparency → opaque; increased contrast → solid borders; focus rings always
visible; the staged state is announced in a polite live region ("From a link:
ask analytics “revenue by region”. Press Return to ask.").

| Moment             | Trigger                     | What moves                                                                                                                              | Token                          | Reduced motion |
| ------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------- |
| Summon from a link | `open-url` while hidden     | Existing `LauncherSurface` summon. The staged text is already in the input on the first frame (no typing effect).                       | existing surface tokens        | existing       |
| Staged ask         | `ask-draft`                 | A "From link" marker chip `Reveal`s at the left of the input next to the connection chip; the Ask row is selected (existing highlight). | `SPRING_SOFT`, `SPRING_SNAPPY` | Instant        |
| Marker clears      | User edits the input or Esc | Marker chip fades out; layout closes the gap.                                                                                           | `FADE_OUT`, `SPRING`           | Instant        |
| Staged widget args | `widget-args`               | Existing argument pills slide out (plan 006 motion) with link values pre-filled; rejected keys listed in the footer via `SwapText`.     | existing, `FADE_IN`            | Instant        |
| Notice             | `notice` / unknown link     | Footer status `SwapText` in muted ink ("That link isn't one oh-my-query understands."), 3s.                                             | `FADE_IN`                      | Crossfade      |
| Copy Link          | ⌘K → Copy Link              | Footer status `SwapText` "Copied link" with a `CheckDraw`.                                                                              | `FADE_IN`, `DRAW`              | Instant        |

Designed states: staged ask with a resolved connection, staged ask with an
unknown `conn` ("No connection named “x”" — the Ask row targets the active
connection and says so), staged ask with no AI configured (existing AI-setup
row), staged widget args with one rejected key, widget id not found, board id
not found, malformed link. Snapshot each.

## Scope

**In scope**

- `apps/app/electrobun.config.ts`: `app.urlSchemes: ["omq"]`.
- `packages/rpc/src/omq-link.ts` (create), `omq-link.test.ts` (create),
  `index.ts`, `schema.ts` (`LauncherNavigateView`).
- `apps/app/src/bun/link-router.ts` (create) + `link-router.test.ts`;
  `apps/app/src/bun/index.ts`; `apps/app/src/bun/launcher.ts` (queue
  navigation until the renderer is ready); `apps/app/src/bun/rpc.ts`
  (expose an `openBoardWindow(boardId)` used by both the RPC handler and the
  router).
- `apps/app/src/mainview/components/launcher/launcher-panel.tsx`,
  `views/root-view.tsx`, `views/use-root-arguments.ts`,
  `components/launcher/links/` (create): `staged-link.ts` (types + resolver),
  `link-values.ts` (+ `.test.ts`), `link-marker-chip.tsx`,
  `use-staged-link.ts`, browser tests.
- Copy Link: `views/catalog-actions.ts`, `views/use-catalog-menu.ts`,
  `components/widgets/widget-actions.ts`, `use-widget-menu.ts`; if plan 008
  landed, add "Copy Ask Link" to its `resultActions` for `surface: "ask"`.
- `apps/app/src/mainview/lib/browser-ipc-stub.ts`: a
  `globalThis.__omqOpenLink(url)` hook that runs `parseOmqLink` and emits the
  same `launcherNavigate` message, for e2e.
- `apps/app/e2e/link-flow.spec.ts` (create).

**Out of scope**

- Windows/Linux URL registration (Electrobun does not support it yet).
- `fileAssociations` (`.omq.json` double-click import — plan 015 follow-up).
- A link that runs an ask, a write, or a widget with link-supplied values
  without ↵, or any `run=1`-style override. Such a flag would be available to
  every link author, which defeats the rule.
- An App Intents / Shortcuts action provider (links are enough for v1).
- Links into settings or connection editing.

## Git workflow

- Branch `feat/launcher-017-links`. Commit only if authorized; do not push or
  open a PR unless told to.

## Steps

### Step 1: Parser and builders (`packages/rpc/src/omq-link.ts`)

Parse with `new URL(raw)` inside a try. Bun's WHATWG URL handles the
non-special scheme like this (verified with `bun -e`):
`omq://ask?q=a%20b` → `host "ask"`, `pathname ""`;
`omq://widget/abc-123?region=EU` → `host "widget"`, `pathname "/abc-123"`;
`OMQ://Ask?q=x` → `protocol "omq:"`, `host "Ask"` (host case is preserved, so
lower-case it). Rules:

- Reject `raw.length > 8192`, a protocol other than `omq:`, a username,
  password, port or fragment.
- `host` (lower-cased) is the route. Empty or `open` → `{ kind: "open" }`.
- `ask`: `q` required; trim; replace CR/LF/tab with a space; strip other C0/C1
  control characters and bidi overrides (U+202A–U+202E, U+2066–U+2069) so the
  input shows exactly what will be sent; 1–4,000 characters. `conn` optional,
  trimmed, 1–200 characters. Ignore other keys.
- `widget` / `board`: exactly one path segment, `/^[A-Za-z0-9-]{1,100}$/`.
  For `widget`, every query key must match
  `^[a-z][a-z0-9_]{0,31}(\.(from|to))?$` (the `Ident` rule plus range parts),
  at most 12 keys, each value ≤ 200 characters; duplicate keys rejected.
- Anything else → `{ ok: false, reason }` with a short human reason.

Builders percent-encode with `URLSearchParams` and are the inverse of the
parser (round-trip tests). `askLink` uses the connection **name**, so links
work on a colleague's machine where ids differ.

Tests: each route, case-insensitive route, encoded unicode and emoji prompts,
`+` vs `%20`, control and bidi characters stripped, 4,001-character prompt,
unknown route, extra path segments, `..` and `%2F` in ids, too many / bad
value keys, fragment and credentials rejected, builder round-trips.

### Step 2: Bun — register, route, queue

- `electrobun.config.ts`: add `urlSchemes: ["omq"]` under `app`.
- `link-router.ts`:
  ```ts
  createLinkRouter({
    launcher: () => LauncherController | null,
    openBoardWindow: (boardId: string) => Promise<"opened" | "missing">,
    log: (route: string) => void,
  }) => ({ handle(url: string): void; flush(): void })
  ```
  `handle` parses; before a launcher exists it keeps only the latest URL and
  `flush()` replays it. Mapping:
  - `open` → `launcher.show()`;
  - `ask` → `navigate({ kind: "ask-draft", prompt, connection })`;
  - `widget` with no values → `navigate({ kind: "widget-run", widgetId })`;
  - `widget` with values → `navigate({ kind: "widget-args", widgetId, values })`;
  - `board` → `openBoardWindow`; `"missing"` → `navigate({ kind: "notice", message: "That board no longer exists." })`;
  - parse failure → `navigate({ kind: "notice", message: "That link isn't one oh-my-query understands." })`.
- `launcher.ts`: while `!rendererReady`, `navigate` stores the latest view
  (and still shows the window); `markRendererReady` sends it. This also fixes
  tray "Settings…" right after launch.
- `index.ts`: create the router and call
  `Electrobun.events.on("open-url", (event) => router.handle(urlOf(event)))`
  as the **first statement of `main()`**, before any `await`; call
  `router.flush()` right after `createLauncher` succeeds. `urlOf` narrows the
  unknown payload with a type guard (`{ data: { url: string } }`), no cast.
  Keep `electrobun/main` the first import, and keep `link-router.ts` free of
  `@oh-my-query/core` (it may import `@oh-my-query/rpc`).
- `rpc.ts`: extract the `openBoard` handler body into
  `openBoardWindow(boardId)` returned from `createAppRpcs`, and use it in both
  places.

Tests (`link-router.test.ts`, fakes for launcher and board opener): each
mapping, queue-before-launcher keeps only the last URL, `flush` replays once,
the log callback never receives prompt text, missing board → notice.
Add a `launcher` test (or extract a tiny pure `pendingNavigation` helper) for
"navigate before ready is delivered once after ready".

### Step 3: Renderer — staging

- `launcher-panel.tsx` `handleNavigate`:
  - `"ask-draft"` → `stack.reset()`, `setQuery(prompt)`, set
    `stagedLink = { kind: "ask", connection, nonce }`;
  - `"widget-args"` → `stack.reset()`, `setQuery("")`,
    `stagedLink = { kind: "widget-args", widgetId, values, nonce }`;
  - `"notice"` → `stack.reset()`, flash the message in the root footer.
    Pass `stagedLink` and `onStagedLinkDone` to `RootView`.
- `use-staged-link.ts` (owned by `RootView`) applies a staged link **once per
  nonce**, during render via the "store the last applied nonce in state"
  pattern (as `use-ask-save.ts:31-36` does for `specFor`) — not in an effect —
  and only once connections and widgets have loaded (cold start delivers the
  link before they finish).
  - Ask: resolve `connection` against `state.connections` by exact id, else
    by case-insensitive name if exactly one matches. `askWith` becomes the
    resolved connection (falls back to the active one, with the "No connection
    named “x”" status). The input row shows `LinkMarkerChip` plus a chip for the
    target connection. On ↵, if the target is not the active connection,
    `await activate(target)` then `startAsk(prompt, { connectionId: target.id, database: null })`.
    Editing the input or Esc clears the staged state (and the marker).
  - Widget args: find the widget; missing → flash "That widget no longer
    exists." Otherwise `linkValues(widget.params, values)` and open the
    argument pills with them (`useRootArguments.open(widgetId, initial?)`
    gains the optional initial values). Rejected keys show in the footer:
    "Ignored from link: foo, bar."
- `link-values.ts` (pure): for each **editable** param (fixed params cannot be
  set from a link): `number` → `Number(raw)` must be finite; `dateRange` →
  a `RangePreset` value under `name`, or `name.from` + `name.to` as an
  `IsoRange`; `date`, `text`, `select` → the string. Validate with
  `paramValueSchema(def)` (for a `select` with `optionsSql`, accept the string;
  bun validates against live options when it runs). Return
  `{ values: ParamValues; rejected: string[] }`.

Tests: `link-values.test.ts` (each type, presets vs explicit range, NaN,
fixed param, unknown key, over-long text); browser tests on `RootView`/
`LauncherPanel` via `emitIpcMessage("launcherNavigate", …)` from
`src/mainview/test/ipc-mock.ts`:

- `ask-draft` fills the input, shows the marker and target chip, **does not
  call `ask`** (assert the IPC mock never saw it) until ↵, then calls `ask` with
  the resolved connection; an unknown `conn` falls back with the status text;
  editing clears the marker;
- `widget-run` opens and runs (existing behaviour);
- `widget-args` opens pills with the link values and does not call
  `runWidget` until ↵; a rejected key is listed;
- cold start: the message arrives before connections/widgets load and is
  applied once they do;
- `notice` flashes; both motion branches for the marker chip; snapshots of
  every designed state.

### Step 4: Copy Link

- Catalog ⌘K: widget → "Copy Link" (`widgetLink(id)`), board → "Copy Link"
  (`boardLink(id)`); widget run view ⌘K → "Copy Link with Inputs"
  (`widgetLink(id, values)` — serialize ranges as `name.from`/`name.to`,
  presets as their value). Use `copyText`; footer feedback "Copied link".
- If plan 008 landed: "Copy Ask Link" in the ask view's result menu
  (`askLink(prompt, connection.name)`).

### Step 5: Browser stub and e2e

`browser-ipc-stub.ts` exposes `globalThis.__omqOpenLink(url)`: it runs
`parseOmqLink` and emits the same `launcherNavigate` payloads the router would
(boards → `openBoard`, which the stub already emulates by opening
`#/board/:id`). `e2e/link-flow.spec.ts`: open
`omq://ask?q=revenue%20by%20region` → input shows the text, `__omqIpcLog` has
no `ask`; press Enter → `ask` logged. Open `omq://widget/<id>?region=EU` →
pills show "EU", no `runWidget` until Enter. Open `omq://nope` → notice.

## Test plan

Summarized from the steps: `packages/rpc/src/omq-link.test.ts`,
`apps/app/src/bun/link-router.test.ts`, the launcher queue test,
`components/launcher/links/link-values.test.ts`, browser tests for staging and
Copy Link, and `e2e/link-flow.spec.ts`. Model browser tests after
`components/launcher/launcher-panel.browser.test.tsx` (it already drives
`launcherNavigate`). Verification: `bun run --cwd packages/rpc test` and
`bun run --cwd apps/app test` → all pass.

## Done criteria

- [ ] `bun run check-types`, `bun run check`, rpc tests, app tests (both
      projects) and e2e pass; coverage ≥ 80%.
- [ ] `rg -n "urlSchemes" apps/app/electrobun.config.ts` shows `["omq"]`, and
      the packaged `Info.plist` contains `CFBundleURLSchemes` with `omq`
      (`plutil -p <app>/Contents/Info.plist`).
- [ ] Packaged build copied to `/Applications` (registration requires it):
      `open 'omq://ask?q=revenue%20by%20region&conn=analytics'` with the app
      **not running** summons the launcher with the text staged and the
      analytics chip; no network request to the AI provider happens before ↵
      (watch the bun log for `[ask]` lines); ↵ then asks.
- [ ] Same build, app running and hidden: `open 'omq://widget/<id>'` opens the
      run view and runs; `open 'omq://widget/<id>?region=EU'` stages pills and
      waits for ↵; `open 'omq://board/<id>'` opens the board window;
      `open 'omq://board/missing'` shows the notice.
- [ ] Copy Link on a widget, pasted into Terminal after `open`, reproduces it.
- [ ] Every row of the motion table is implemented with its token and its
      reduced-motion fallback, with a browser test per branch; recordings at 1×
      and 0.25× (`?slowmo=4`) attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of a link summon → staged
      marker → ↵ shows no frame over 16.7ms and only `transform`/`opacity`/`filter`
      animating.
- [ ] Reduce Motion, Reduce Transparency and Increase Contrast verified; VoiceOver
      announces the staged state; designed states snapshotted.
- [ ] `git status` shows changes only in the in-scope files.

## STOP conditions

- The `open-url` event does not arrive on cold start even when subscribed
  before the first `await` (the native handler fires before the bun module
  graph finishes). Report with logs; do not poll the clipboard or add a helper
  process.
- A packaged build in `/Applications` does not register the scheme, or the
  dev build and an installed build fight over it in a way that breaks
  development. Report; do not change the bundle identifier without the owner.
- Any request to auto-run an ask, or to run link-supplied widget values
  without ↵. That reverses the security rule above and needs the owner's
  explicit decision.
- Supporting links requires `@oh-my-query/core` in `index.ts`'s import graph
  ahead of `electrobun/main`. Restructure instead; never reorder that import.

## Maintenance notes

- Every new route must state, in `omq-link.ts`'s tests and this plan's threat
  model, whether it only stages or also runs, and why.
- If plan 019 (actions with writes) ever gets a link route, it must stage and
  show its confirm sheet; links never satisfy a write confirmation.
- Plan 015 follow-up: `fileAssociations` for `.omq.json` arrive through the
  same `open-url` event as `file://` URLs; route them to `previewImport` in
  `link-router.ts`.
- If Electrobun gains Windows/Linux URL registration, the parser and router are
  platform-neutral; only the config and manual checks change.
