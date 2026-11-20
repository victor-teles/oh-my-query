# Next opportunities after plans 001–007

Status: **PLANNED** (2026-11-19) as plans 008–020; see `README.md`. This is a discovery map, not an executable plan. Each item
the owner picks becomes its own numbered plan (008+).

Planned at commit `12b9e8c` on `feat/launcher-002-shell`. Plans 001–007 sit
uncommitted on top of it, and this map assumes them as the baseline: launcher,
connections, ask pipeline, result card, widgets, boards.

## 1. Should json-render (or something like it) come back?

### What the two libraries are (docs read 2026-11-19)

|                             | **ui-sdk.dev** (`@ui-sdk/react`, `@ui-sdk/core`, Vercel Labs, beta, Apache-2.0)                                                                                                                                                             | **json-render.dev** (`@json-render/core`, `@json-render/react`)                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What it is                  | Headless behaviour primitives (focus, keyboard, popups, drag) that coding agents write at dev time with `definePrimitive` / `createParts`. It also has an agent bridge (`createAgent`: `snapshot`, `act`, `query`) and WebMCP registration. | Runtime generative UI. The LLM emits a flat spec (`root` + `elements`) that is restricted to a zod catalog (`defineCatalog`), rendered through `defineRegistry` + `<Renderer>`. |
| Generates UI at runtime?    | **No**                                                                                                                                                                                                                                      | **Yes**. JSONL RFC 6902 patches (`useUIStream`, `createSpecStreamCompiler`).                                                                                                    |
| Data binding                | Component-local state only                                                                                                                                                                                                                  | JSON Pointer state: `$state`, `$bindState`, `repeat.statePath`, `$cond`, `$template`. State comes from `StateProvider` or an external `createStateStore`.                       |
| Actions                     | Slot handlers; `allow` callback gates agent actions                                                                                                                                                                                         | Named catalog actions with zod `params`, implemented by the host in `defineRegistry`. The model can only name pre-approved actions.                                             |
| External data sources / MCP | None (WebMCP is browser-side page control)                                                                                                                                                                                                  | **None.** The host fills state. Nothing in the docs fetches, refreshes or polls.                                                                                                |
| Fit for oh-my-query         | Not a generative-UI engine. Possibly useful later for agent-driven QA of our own UI, but nothing here needs it.                                                                                                                             | Possible renderer and streaming format for mini-apps. It does not supply the hard part.                                                                                         |

### Verdict

1. **Keep `CardSpec` for asks, widgets and boards.** A card is one query plus
   one view. It is deterministic, versioned, re-runnable, and drawn by our own
   components. A general tree buys nothing here and costs testability and the
   brand bar.
2. **The rejection reason in the plan index is out of date.** json-render can
   render a saved spec against fresh data when the spec holds only `$state`
   pointers and no `state` block. The old problem came from how we used it,
   not from the library.
3. **What mini-apps actually need is not a renderer. It is a Sources + Actions
   contract:**
   - **Source**: a named, typed, re-runnable data producer. Today the only one
     is a SQL template. Next would be an MCP tool call or an HTTP request, with
     params bound as values and never spliced in.
   - **Action**: a named, typed side effect, classified as `read` / `write` /
     `external`. `write` always needs a person to confirm, and no action runs
     from generation alone.
   - **Binding**: a view reads `sources.<name>.rows` and inputs write
     `inputs.<name>`. That maps directly onto json-render's `$state` /
     `$bindState` if we adopt it.
4. **Decision rule:** build Sources + Actions first, on our own spec, using
   `CardSpec` views as the leaf components. Bring json-render in only when a
   mini-app needs layout plus forms plus conditional visibility beyond a grid of
   cards. Run a one-day spike before adopting it: check the npm version and
   release cadence, React 19 compatibility, bundle size, whether a catalog can
   be limited to our components, and the doc inconsistencies the reader found
   (`text` vs `content`, `statePath` vs `$state`). If the spike fails, a
   ~300-line in-house `PanelSpec` (stack/grid of cards + inputs + action
   buttons) covers v1.

## 2. Opportunity map

Each item lists value, rough effort (S ≤2d, M ≤1w, L >1w), what it builds on,
and the evidence that it is feasible.

### A. Deepen the ask flow (the signature moment)

| #   | Opportunity                                                                                                                                                                              | Value                                                                    | Effort | Builds on / evidence                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **Refine an answer.** Typing in the ask view ("by month", "only EU", "as a table") re-asks with the previous SQL and spec as context, and the card morphs in place instead of resetting. | Very high. It turns one-shot asks into a dialogue without a chat drawer. | M      | `runAsk` already takes `ModelMessage[]`; `ask-reducer.ts` needs a `refine` transition and the `AskEvent` contract stays the same. |
| A2  | **Result actions (⌘K on a card):** Copy SQL, Copy as CSV/TSV/Markdown, Copy chart as PNG, Save CSV…, Save as widget, Add to board.                                                       | High. Answers leave the app the way devs actually use them.              | S–M    | Electrobun `clipboardWriteText` / `clipboardWriteImage` exist; ⌘K menu pattern exists (`use-catalog-menu.ts`).                    |
| A3  | **Assumptions line.** Under the SQL: tables used, time column chosen, filters applied ("orders.created_at · excludes refunds"), each one clickable to refine (A1).                       | High for trust.                                                          | M      | Parse with `@polyglot-sql/sdk` (already bundled), no extra model call.                                                            |
| A4  | **Drill-down.** Clicking a bar, slice or table row asks "break down {segment}", which pre-fills a refine with a bound filter.                                                            | Medium–high                                                              | M      | Needs A1. `card-data.ts` already knows the x and group values.                                                                    |
| A5  | **Raw SQL mode.** A `>` prefix runs typed SQL read-only through the guard, and `inferCardSpec` draws the card. No AI and no key needed.                                                  | High for devs, and a no-AI path for first run.                           | S      | `assertReadOnly` and `infer-card-spec.ts` exist in `packages/agent`.                                                              |
| A6  | **Ask MongoDB and Redis.** Today they return "works with SQL databases for now".                                                                                                         | Medium                                                                   | L      | Needs per-engine guard and prompt. Drivers already honour `readOnly`.                                                             |

### B. Instant lookups (no AI)

| #   | Opportunity                                                                                                                                                                      | Value                                                                                    | Effort | Builds on                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| B1  | **Schema peek.** `#orders` shows columns, types, indexes, row estimate, and ↵ previews 50 rows.                                                                                  | High. It is the Raycast "quick look" for a database.                                     | S–M    | `getSchema`, `schema-cache.ts`.                                                  |
| B2  | **ID/email lookup.** Paste a UUID, numeric id or email and get "Found in users (1), orders (12)…", searched across columns whose names and types fit. Clipboard-aware on summon. | Very high for backend devs debugging. It is the most "launcher-native" database feature. | M      | Schema cache plus bounded read-only probes with `LIMIT` and a per-table timeout. |
| B3  | **`@connection` chip** in the input switches connection inline (as in the demo's `analytics` chip).                                                                              | Medium                                                                                   | S      | `ConnectionsProvider`.                                                           |
| B4  | **History view.** Search all past asks, not only the 5 recents.                                                                                                                  | Medium                                                                                   | S      | `recent-asks.enc` and `listRecentAsks`.                                          |

### C. Watching data (widgets and boards beyond open windows)

| #   | Opportunity                                                                                                                                         | Value                                           | Effort | Builds on / evidence                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Menu-bar KPI.** Pin a KPI widget, and its formatted value shows as the tray title, refreshed on its interval.                                     | High delight, very on-brand (iStat-style).      | S–M    | `Tray.setTitle` exists in Electrobun 2 types; `runWidget` exists. Needs a bun-side scheduler.                                 |
| C2  | **Alerts.** A widget condition (`value < 50`, `rows > 0`, `changed`) sends a native notification, and clicking it opens the widget in the launcher. | High. "Trust the answer" becomes "it tells me". | M      | `Utils.showNotification` exists. It shares C1's scheduler. Today refresh runs only in open board windows (`useBoardRefresh`). |
| C3  | **Change since last look.** Widgets and tiles show the delta vs the previous run, with a sparkline of the last N values.                            | Medium                                          | M      | Store a small run log per widget in bun.                                                                                      |
| C4  | **Export/import boards and widgets** as JSON (SQL + specs + params, never credentials or data), keyed by connection name.                           | Medium. Teams share dashboards.                 | S–M    | `Widget` / `Board` zod schemas validate imports at the edge.                                                                  |

### D. Extensibility (where the json-render question lands)

| #   | Opportunity                                                                                                                                                                                                                                                                    | Value                                                             | Effort | Builds on                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **oh-my-query as an MCP server** (stdio, opt-in). It exposes `list_connections`, `describe_schema`, `ask` (read-only), `run_widget`, `list_widgets`, so Claude Code, Cursor and others query your databases through our guard and encrypted credentials, never seeing secrets. | Very high leverage at low cost. The app becomes the safe gateway. | M      | `runAsk` is a pure generator over ports; widget runs are read-only and validated. Needs per-connection opt-in and an audit log.                                                           |
| D2  | **Sources: MCP and HTTP as widget data.** A widget's source can be an MCP tool call (Stripe, GitHub, Linear, PostHog) or an HTTP GET with JSONPath → tabular rows → the same `CardSpec`. Boards can mix Postgres and Stripe.                                                   | High. The first real step toward "mini software".                 | L      | Generalize `Widget.sql` into `Widget.source` (a discriminated union) with a version bump. Needs an MCP client in bun (AI SDK v6 MCP client) and per-server credentials in `.enc` storage. |
| D3  | **Actions.** Typed side effects on rows: "Open in Stripe", "Copy id", "Run MCP tool `refund` with `{{row.charge_id}}`". `write` actions always show a confirm sheet with the exact call.                                                                                       | High, and high risk.                                              | L      | Needs D2. This is where the read-only promise ends, so it needs its own threat model (`/factory secure`).                                                                                 |
| D4  | **Mini-apps (panels).** A saved, generated composition: inputs + several sources + card views + actions, opened from the launcher or as a board-like window. Generation streams the spec, and runs never call the AI (same rule as widgets).                                   | Very high, and the vision the owner described.                    | XL     | Needs D2 and D3. The renderer is json-render or an in-house `PanelSpec`, per section 1's decision rule.                                                                                   |
| D5  | **URL scheme and Shortcuts.** `omq://ask?q=…&conn=…`, `omq://widget/:id`, so Raycast, Alfred, Shortcuts and scripts can drive the launcher.                                                                                                                                    | Medium                                                            | S      | `urlSchemes` exists in `ElectrobunConfig`.                                                                                                                                                |

### E. Craft debts to fold in (from validation notes 001–007)

Recordings, Timelines traces and the accessibility-toggle checks are still open
on every UI plan, and keyboard focus on boards is unconfirmed. None of the work
above should start before those owner checks are closed, or each new plan
inherits unverified ground.

## 3. Recommended sequencing

1. **Quick wins that sharpen the signature (1–2 weeks):** A5 raw SQL, A2 result
   actions, B1 schema peek, B3 `@connection` chip.
2. **The moat (2–3 weeks):** A1 refine (+ A3 assumptions), B2 ID lookup.
3. **Watching (1–2 weeks):** one bun-side scheduler shared by C1 menu-bar KPI and
   C2 alerts.
4. **Platform (3–6 weeks):** D1 MCP server, then D2 Sources, then D3 Actions
   (with a security plan), then D4 mini-apps with the json-render spike as its
   first step.

D1 can move earlier: it is independent of the UI work and reuses the existing
pipeline almost unchanged.

## 4. Open decisions for the owner

1. Which band to turn into numbered plans first (recommended: 1 and 2 together,
   as plans 008–010).
2. Whether mini-apps (D4) may ever perform writes. The answer decides whether
   D3 exists at all, and whether "read-only by construction" stays a product
   promise.
3. Whether D1 (MCP server) fits the product, given it exposes database access
   to other agents on the machine.
