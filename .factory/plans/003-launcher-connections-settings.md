# Plan 003: Manage connections and AI settings from inside the launcher

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- apps/app packages/core packages/rpc`
> and `git status --short`. Plan 002 must be merged. Confirm that
> `apps/app/src/mainview/components/launcher/` exists and that `LauncherView` is a
> discriminated union.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `.factory/plans/002-launcher-shell.md`
- **Category**: direction
- **Planned at**: commit `12b9e8c`, 2026-11-17 (clean tree; assumes 002 landed)

## Why this matters

A database launcher with no way to add a database is useless. After plan 002,
the old home screen, connection dialogs and settings page are gone. This plan
brings connection CRUD, the active-connection choice and the AI provider setup
back as launcher views. It also moves the AI API key out of a plaintext JSON
file and out of the webview. Plan 004 then reads the key on the bun side.

## Current state

- `packages/core/src/persistence.ts`: `DatabaseConnection` includes `id`, `name`,
  `type`, `host`, `port`, `database`, `username`, `password`, `createdAt`,
  `pinned`, `lastConnectedAt`, `color?`, `emoji?`, `environment?`, `piiRedaction?`,
  `customPiiPatterns?` and `runConfig?`. `saveConnections` writes the whole list
  encrypted with `encryptLine` (`packages/core/src/crypto.ts:147`). `decryptLine`
  is at `:168`.
- `packages/core/src/config.ts`: `getConfig()` and `saveConfig()` read and write
  `~/.config/oh-my-query/oh-my-query.json` as **plaintext JSON**.
  `AppConfig.ai` holds `{ provider, apiKey, model?, baseUrl? }`, so the API key
  is stored unencrypted today.
- `apps/app/src/mainview/lib/ai-settings.ts`: provider union
  `"openai" | "anthropic" | "google" | "openrouter" | "local"`. It calls
  `getConfig`/`saveConfig` over IPC, which means the renderer handles the raw key.
  The default model list is stale (for example `claude-sonnet-4-20250514`).
- `apps/app/src/mainview/components/connection-form/index.tsx` exports
  `ConnectionForm({ connection?, onSuccess? })`, with sections for server fields,
  appearance (color, emoji) and AI context (PII). It is built on
  `use-connection-form.ts` and `lib.ts`. It has a browser test
  (`connection-form.browser.test.tsx`, 10.6K) and unit tests (`lib.test.ts`).
  The form was designed for a dialog, so check its layout inside a 760px panel.
- `lib/connections.ts`, `lib/connection-appearance.ts` and
  `hooks/use-connection-lifecycle.ts` cover connect and disconnect. 002 may have
  deleted the hook. If so, recreate only what this plan needs.
- RPC already has `testConnection`, `connectToDatabase`,
  `disconnectFromDatabase`, `listConnectionDatabases`, `getConnections`,
  `saveConnections`, `getConfig`, `saveConfig` and `resetSecrets`.

## Commands you will need

| Purpose                | Command                            | Expected                        |
| ---------------------- | ---------------------------------- | ------------------------------- |
| Typecheck              | `bun run check-types`              | exit 0                          |
| Lint                   | `bun run check`                    | exit 0                          |
| App tests              | `bun run --cwd apps/app test`      | all pass                        |
| Core tests             | `bun run --cwd packages/core test` | all pass                        |
| e2e                    | `bun run --cwd apps/app e2e`       | all pass                        |
| Local Postgres fixture | `bun run fixtures:up`              | container up (for manual check) |

## Implementation rules relevant to this plan

- Follow the same TypeScript, React, test and comment rules as plan 002. In
  short: strict types, no `any`, one component per file, ≤~150 lines and ≤~6
  props, hooks own the logic, and tests sit next to each unit.
- Validate at the boundary. The bun-side handlers validate payloads with zod
  (`zod` is in the root catalog). The renderer trusts typed RPC responses.
- Never send the stored API key back to the renderer. The renderer receives
  `{ provider, model, baseUrl, hasKey: boolean, keyHint: "…a1b2" }`.
- Never log credential values.

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

### Motion moments in this plan

| Moment                       | Trigger                     | What moves                                                                                                                                                               | Token                        | Reduced motion             |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | -------------------------- |
| **Chip handoff** (signature) | A connection becomes active | The row's emoji and name travel into the input chip via the shared `layoutId="active-connection"`. The chip's width morphs via `layout`.                                 | `SPRING`                     | Crossfade                  |
| Connecting                   | `↵` on a row                | The trailing spinner is replaced by a check that draws in (`pathLength 0→1`, 220ms). It fades after 900ms.                                                               | `SPRING_SNAPPY`, `FADE_OUT`  | Static icon swap           |
| Connect failure              | Error                       | The row's subtitle `<SwapText>`s to the error, with a destructive tint. No shake.                                                                                        | `FADE_IN`                    | Instant                    |
| Actions menu                 | `⌘K` on a row               | The popover scales 0.96→1 with opacity, with its `transform-origin` at the row's trailing edge. Exit mirrors it.                                                         | `SPRING_SNAPPY` / `FADE_OUT` | Crossfade                  |
| Two-step delete              | First `↵` on Delete         | The row tints destructive, and a 3s **linear** hairline drains (`scaleX`, an honest timer). The label `<SwapText>`s to "Press ↵ again to delete". On timeout it reverts. | Linear, `FADE_IN`            | Static hairline, text only |
| Row removal                  | Delete confirmed            | The row fades out, then its siblings close the gap via `layout`.                                                                                                         | `FADE_OUT`, then `SPRING`    | Instant                    |
| Pin/Unpin                    | Action                      | The row moves to its new sorted position via `layout`. The pin glyph scales in.                                                                                          | `SPRING`                     | Instant                    |
| Edit view                    | Edit, or Add Connection     | Standard push and pop from plan 002                                                                                                                                      | `SPRING`                     | Crossfade                  |
| Field validation             | Blur or submit              | The error text `<Reveal>`s under the field, and the border tints. Siblings shift via `layout`. No shake.                                                                 | `FADE_IN`, `SPRING_SOFT`     | Instant                    |
| Test result                  | Test                        | An inline result row `<Reveal>`s, and the latency number `<SwapText>`s.                                                                                                  | `FADE_IN`                    | Instant                    |
| Save                         | `⌘↵`                        | The button label `<SwapText>`s to "Saved" with a check draw-in. It pops back to the list after 450ms, and the saved row is selected there.                               | `FADE_IN`, `SPRING`          | Instant pop                |
| API key field                | Replace / Clear             | The masked `•••• a1b2` crossfades to the input, and focus moves into it.                                                                                                 | `FADE_IN`                    | Instant                    |
| First-run empty state        | Root with no connections    | One `<Reveal>` of the line, with the "Add Connection" row pre-selected (pill visible). It plays once per session.                                                        | `FADE_IN`                    | Instant                    |

## Scope

**In scope**

- `packages/core/src/config.ts`, plus a new `packages/core/src/ai-config.ts` and
  its test. `AiSettings` is stored encrypted: the key goes through
  `encryptLine`/`decryptLine` and lives in a separate `ai.enc` file next to the
  config (add `aiConfigPath()` to `paths.ts`). Migrate on read: if
  `oh-my-query.json` still contains `ai.apiKey`, encrypt it into `ai.enc` and
  strip it from the plaintext file.
- `packages/rpc/src/schema.ts`: add `getAiSettings` (returns the redacted shape),
  `saveAiSettings` (params `{ provider, model?, baseUrl?, apiKey?: string }`,
  where an omitted `apiKey` keeps the existing key), `clearAiKey`,
  `testAiSettings` (one tiny completion that returns `{ ok, latencyMs, message }`),
  and `setActiveConnection` / `getActiveConnection` (the active connection id
  and database, persisted as `AppConfig.activeConnection`). Remove the generic
  `getConfig`/`saveConfig` requests from the renderer surface if nothing else
  needs them.
- `apps/app/src/bun/rpc.ts`: the handlers. `testAiSettings` may call the AI SDK
  from bun. Add `ai` and `@ai-sdk/*` to the bun-side imports. Plan 004 will
  move them into `packages/agent`.
- `apps/app/src/mainview/components/launcher/views/` (create):
  `connections-view.tsx`, `connection-edit-view.tsx` and `settings-view.tsx`,
  each with tests.
- `apps/app/src/mainview/components/connection-form/*`: layout adaptation only.
- `apps/app/src/mainview/lib/ai-settings*.ts`: shrink to provider metadata
  (labels, default models, whether `baseUrl` is needed) or delete. Update the
  default models to current ones and check them with each provider's docs.
- `apps/app/e2e/connection-flow.spec.ts` (recreate).

**Out of scope**

- The agent pipeline (plan 004).
- Redis/Mongo browsing UIs. Those connections can be added, but their ask
  support is decided in plan 004.
- The configurable hotkey recorder UI. A read-only display of the current
  hotkey in Settings is fine.

## Git workflow

- Branch `feat/launcher-003-connections`. Commit only if authorized.

## Steps

### Step 1: Encrypted AI settings in core

`packages/core/src/ai-config.ts` exports `getAiSettings()`, which returns the
decrypted `AiSettings | null` (bun-only), and `saveAiSettings(next)`, which
merges and keeps the existing key when `apiKey` is undefined. It also exports
`clearAiKey()` and `redactAiSettings(s)`, which return
`{ provider, model, baseUrl, hasKey, keyHint }`. `keyHint` is the last 4 chars
only, or `null` when the key is shorter than 12 chars. Write atomically, using
the same approach as `persistence.ts`'s `atomicWrite`.

Tests cover the round trip, keep-key-on-omit, the plaintext migration (the
plaintext file loses `apiKey`), redaction, and a corrupt file (which surfaces a
`CryptoError` instead of returning silent null). Model the tests after
`packages/core/src/persistence.test.ts`, which already isolates the home dir.

### Step 2: RPC and bun handlers

Add the schema entries listed in Scope and implement them in `rpc.ts`. Do the
zod validation here. `testAiSettings` builds the provider model, runs
`generateText` with a 1-token prompt and a 10s abort, and maps errors to
messages, reusing `lib/ai-errors.ts`'s classification logic. Plan 004 moves that
logic into `packages/agent`; for now, copy only what you need into bun.

### Step 3: Root list shows connections

The root view's "Connections" section lists saved connections. Each row shows
the emoji or color dot, the name, a muted `type · host/database`, and the
environment badge (`prod` gets a warm red tint). Pinned connections sort first,
then most recent. `↵` makes a row active: it calls `setActiveConnection`, then
`connectToDatabase`, and shows a spinner in the row. When the connection is
up, the input's chip shows its name, matching the "analytics" chip in the
reference. `⌘K` on a row opens an actions list with Edit, Test, Pin/Unpin,
Disconnect and Delete. Delete asks for confirmation inline: a second `↵` within
3s confirms. No modal.

An "Add Connection" command is always present.

### Step 4: Connection edit view

`connection-edit-view.tsx` hosts `ConnectionForm` inside the panel. The panel
grows to fit, up to the 720px max, and scrolls internally beyond that. `⌘↵`
saves, Esc pops back. A "Test" button shows latency or the error inline. Adapt
the form's spacing to the panel. Do not fork the form logic.

### Step 5: Settings view

`settings-view.tsx` has these sections:

- **AI**: a provider select, model (free text with suggestions), base URL
  (local/openai-compatible only), and the API key field. The key field shows
  `•••• a1b2` when one is set, with Replace and Clear actions. "Test" calls
  `testAiSettings`.
- **Launcher**: the current hotkey (read-only) and theme (system/dark/light).
- **About**: version and update channel. Reuse the
  `getUpdateChannel`/`setUpdateChannel`/`checkForUpdate` RPCs, which already
  exist.

### Step 6: First-run

If there are no connections, the root view leads with a calm empty state: one
line of copy and the "Add Connection" row selected. If there is no AI key, the
input placeholder becomes "Search…" and pressing `↵` on free text shows an
inline row, "Set up an AI provider to ask questions →", which opens Settings.
Do not use toasts. Do not show a restore notification (the owner prefers silent
recovery).

## Test plan

- Core: `ai-config.test.ts` (cases in Step 1).
- Renderer browser tests: connections view (sorting, activate flow with mocked
  ipc, actions list, two-step delete), edit view (save via `⌘↵`, Esc), and
  settings view (redacted key display; Replace sends `apiKey`; untouched key
  sends none). Add snapshots of the empty state, the populated list, and
  settings with and without a key.
- e2e `connection-flow.spec.ts`: in browser-stub mode, add a connection
  through the form and see it listed and selectable. Extend
  `createBrowserRequestStub` in `lib/ipc.ts` with in-memory handlers for the
  new RPCs.

## Done criteria

- [ ] `rg -n "apiKey" apps/app/src/mainview` shows only the write path (the
      settings form submit), never a read of a stored key.
- [ ] After migration, `~/.config/oh-my-query/oh-my-query.json` contains no
      `apiKey` (covered by a core test).
- [ ] Check-types, check, the app tests, the core tests and e2e exit 0.
      Coverage is ≥80%.
- [ ] Manual check in desktop dev: add the fixture Postgres connection, make it
      active, see the chip update, and pass Settings → Test with a real key.
- [ ] Every row of "Motion moments in this plan" is implemented with its token and its
      reduced-motion fallback, with a browser test per branch. Recordings at 1× and 0.25×
      (`?slowmo=4`) are attached to the PR.
- [ ] A Safari Web Inspector Timelines capture of activate a connection → chip handoff → `⌘K` actions → two-step delete → push edit view → save shows no frame
      over 16.7ms, and only `transform`/`opacity`/`filter` animate.
- [ ] Reduced Motion, Reduce Transparency and Increase Contrast are each verified on this
      plan's surfaces, along with designed empty, loading, populated and error states (snapshots).

## STOP conditions

- `ConnectionForm` cannot fit the panel without rewriting its logic. Report
  this and propose a launcher-native form, because that adds scope.
- Plan 002 did not land, or `LauncherView` has a different shape. Reconcile
  with the owner of 002 first.

## Maintenance notes

- Plan 004's agent reads `getAiSettings()` from core on the bun side. Never add
  a path that returns the raw key over RPC.
- `AppConfig.activeConnection` is the default ask target. Plan 006's widgets
  store their own connection id and do not use it.
