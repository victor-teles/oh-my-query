# oh-my-query — 4-Year Roadmap

> A native, AI-powered database client for backend and full-stack developers.
> Lineage: TablePlus, Postico, Things 3, Linear, Arc. **Warm · Craft · Trustworthy.**

**Document status:** Draft v1.0
**Horizon:** Q1 2026 Q3 → Q16 2030 Q2 (16 quarters)
**Owner:** Victor Teles (@victor-teles)
**Scope:** Features, UX, UI, community & ecosystem, technical debt & infra.
**Explicitly out of scope:** Monetization, pricing, and licensing tiers.

---

## Table of Contents

1. [Vision & Guiding Principles](#vision--guiding-principles)
2. [Where We Are Today (Q0 baseline)](#where-we-are-today-q0-baseline)
3. [Four-Year Thematic Arc](#four-year-thematic-arc)
4. [Year 1 — Foundation & Polish (Q1–Q4)](#year-1--foundation--polish-q1q4)
5. [Year 2 — Intelligence & Insight (Q5–Q8)](#year-2--intelligence--insight-q5q8)
6. [Year 3 — Collaboration & Scale (Q9–Q12)](#year-3--collaboration--scale-q9q12)
7. [Year 4 — Platform & Ecosystem (Q13–Q16)](#year-4--platform--ecosystem-q13q16)
8. [Cross-Cutting Tracks](#cross-cutting-tracks)
9. [Design System Evolution](#design-system-evolution)
10. [Community & Ecosystem Track](#community--ecosystem-track)
11. [Technical Debt & Infra Track](#technical-debt--infra-track)
12. [Success Metrics (non-revenue)](#success-metrics-non-revenue)
13. [Appendix — Feature Backlog (not yet scheduled)](#appendix--feature-backlog-not-yet-scheduled)

---

## Vision & Guiding Principles

oh-my-query should be the **"Things 3 of database clients"**: a tool a backend engineer is genuinely happy to live inside for a three-hour debugging session, paired with an AI that behaves like a senior colleague — quiet, precise, and never in the way.

Every decision on this roadmap is checked against six principles:

1. **Warmth is structural, not decorative.** Amber + vibrancy exist to make long sessions feel cared-for.
2. **Native-calm, not native-cosplay.** Inherit macOS discipline. Don't imitate macOS widgets.
3. **The AI disappears into the editor.** No chatbot drawer aesthetic. AI output lands in the editor like a colleague pasted it.
4. **Density with breathing room.** Pro-user density resolved through typographic rhythm — not cards-on-cards.
5. **Keyboard + AT are non-negotiable.** WCAG AA everywhere. `prefers-reduced-motion` fully respected.
6. **Invest in the signature moments.** The Dynamic Island connection indicator is the "wait, what was that?" — every year gets at least one new signature moment.

---

## Where We Are Today (Q0 baseline)

Current capabilities, as of the snapshot this roadmap plans against:

- macOS-native desktop app (Tauri v2, React 19, Rust).
- Connections: PostgreSQL, MySQL, SQLite, MongoDB, Redis.
- CodeMirror SQL editor with schema-aware autocomplete, syntax tree inspector, multi-tab.
- Dialect-agnostic SQL transpilation and formatting via `polyglot-sql` (30+ dialects).
- AI assistant with schema grounding — OpenAI, Anthropic, OpenRouter, Ollama.
- Dynamic Island-style connection indicator in the titlebar. Vibrancy, dark-first, spring motion.
- Homebrew cask + DMG distribution. MIT licensed.

Gaps known today: no Windows/Linux build, placeholder typography (`-apple-system`), no collaboration surface, AI is chat-shaped, results view is not yet a true grid at scale, no formal plugin/extension API, no test harness or release automation, no public docs site beyond the README.

---

## Four-Year Thematic Arc

| Year   | Theme                  | One-liner                                                    | Signature moment                                                |
| ------ | ---------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| **Y1** | Foundation & Polish    | Make the current experience feel finished.                   | A custom typography system + a real results grid.               |
| **Y2** | Intelligence & Insight | Move beyond "AI writes SQL" → "AI helps me think in data."   | Notebooks + the AI explain-plan pane.                           |
| **Y3** | Collaboration & Scale  | From a solo tool to a team tool, without losing native calm. | End-to-end encrypted shared connections + Windows/Linux parity. |
| **Y4** | Platform & Ecosystem   | Become the thing people build on top of.                     | Plugin marketplace + agentic workflows.                         |

Each year ends on a "signature moment" release — a visible, quotable upgrade a user would screenshot.

---

## Year 1 — Foundation & Polish (Q1–Q4)

**Intent.** Close the gaps that make the app feel "promising" instead of "finished." Fix the typography. Make the results grid world-class. Expand database coverage to cover the rest of the top-10 engines. Land a credible AI workflow that isn't shaped like a chatbot.

### Q1 — Grid, Typography, Foundations (Year 1 · Jul–Sep 2026)

**Features**

- **Results grid v2.** Virtualized rendering, sticky headers, frozen columns, cell overflow/detail popover, multi-row selection, column auto-sizing, column pinning, copy-as (CSV / JSON / SQL `INSERT` / Markdown).
- **Schema browser v2.** Tree view with fuzzy find, favorites, last-used, quick-peek (hover → column types, indexes, row estimate).
- **Connection manager refresh.** Per-connection color, emoji, nickname. Per-connection "environment tag" (dev / staging / prod) with a prod-confirmation modal on destructive statements.

**UX**

- **Command palette (`Cmd+K`).** Every action — run, open, connect, search, format, insert AI suggestion — reachable in three keystrokes.
- **Empty states with purpose.** Welcome, no-results, no-connections, error — each with a single concrete CTA.

**UI**

- **Typography system.** Adopt a distinctive display/UI face + a refined mono (candidates: Söhne / Söhne Mono, Söhne Schmal, Berkeley Mono, JetBrains Mono, MonoLisa). The `-apple-system` placeholder era ends in Q1.
- **Color tokens audit.** Re-verify every `oklch` token against WCAG AA on both vibrancy-on and vibrancy-off. Document in a CSS variable reference.
- **Focus ring pass.** Every interactive surface gets a consistent, visible, always-animated focus ring.

**Infra**

- **Test harness.** Vitest for unit/hooks, Playwright for Tauri e2e, `cargo test` + `cargo nextest` for Rust. Coverage gate at 40 % (ratchet up each quarter).
- **Release channels.** Stable, Beta, Nightly — with auto-update via Tauri's updater and signed artifacts.

**Community**

- Public issue templates, `good-first-issue` labeling sweep, first CONTRIBUTING.md.

---

### Q2 — Database Coverage & Query Plan (Year 1 · Oct–Dec 2026)

**Features**

- **New engines.** ClickHouse, DuckDB (in-process + file-based), Microsoft SQL Server. ClickHouse is already hinted at in the design doc — close that loop.
- **EXPLAIN / Query plan view.** A dedicated tab that visualizes the plan tree for PG/MySQL/ClickHouse/DuckDB with cost annotations and hot-path highlighting.
- **AI explain-plan.** Given the raw plan, the assistant narrates what's happening, flags sequential scans and bad index usage, and drafts a candidate index.
- **Query history.** Every executed statement, searchable, with filters (connection, dialect, runtime, errored-only). Stored locally and encrypted.

**UX**

- **Run configurations.** Per-tab limits (`LIMIT 100` sandbox by default), timeout, role/schema override. Visible as a compact strip above the editor — not a modal.
- **Destructive-query guard.** `DELETE`/`UPDATE` without `WHERE` triggers a typed-confirmation dialog. Toggleable per connection.

**UI**

- **Dynamic Island, v2.** New states: running, streaming, errored, planning (AI), reconnecting. Each with a distinct motion signature.
- **Plan-view aesthetic pass.** Avoid the "graphviz screenshot" look — warm, hierarchical, Linear-like.

**Infra**

- **Rust workspace split.** `oh-my-query-core`, `oh-my-query-drivers-*` (pg, mysql, sqlite, mongo, redis, clickhouse, duckdb, mssql). Prep for plugin surface in Y4.
- **Benchmark suite.** Baseline numbers for cold connect, first-row latency, 1M-row streaming.

**Community**

- Public roadmap (this document!) on the website, sourced from GitHub issues.
- Launch a small Discord — support + feedback, not a marketing channel.

---

### Q3 — AI That Doesn't Look Like AI (Year 1 · Jan–Mar 2027)

**Features**

- **Inline AI (the "colleague pasted it" principle).** Highlight a block → "tighten this," "add index hint," "convert to CTE," "translate to PostgreSQL," "explain this join." No drawer. No sparkles. Changes land as a review-diff ghost text the user accepts with `Tab` or edits inline.
- **Schema RAG v2.** Indexes not just tables/columns but: foreign-key graph, sample values (with opt-in PII scrubbing), comments, recently-successful queries, and the user's own saved snippets.
- **AI error doctor.** When a query fails, the assistant proposes the minimum fix with a rationale, not a rewrite.
- **Multi-provider routing.** "Fast / smart / local" selector per action. Ollama stays first-class.

**UX**

- **AI audit log.** Every AI suggestion is logged with: prompt, schema context sent, tokens, model, latency, accepted/rejected. Private to the user. Essential for trust.
- **Prompt library.** User-authored reusable prompts with variables. Share-as-a-file, not a cloud service.

**UI**

- Retire the "AI chat panel" as the primary surface. The chat still exists (`Cmd+Shift+C`), but it's now a scratchpad, not the main interaction. **Editor-first.**

**Infra**

- **PII redaction layer** in the Rust-side schema context builder. Opt-in at connection creation.
- **Local model acceleration.** Apple Silicon MLX backend for Ollama models where supported.

**Community**

- First public changelog, RSS-feed'd. Tone: Linear-style quiet confidence.

---

### Q4 — Data Navigation at Scale (Year 1 · Apr–Jun 2027)

**Features**

- **Streaming results.** Unbounded result sets rendered as they arrive, up to 10M+ rows, without blocking the UI. Progressive column stats in the header.
- **Filter / sort / group on client.** Excel-level ergonomics over the streamed buffer, with an "apply server-side" promotion when the user has changed enough to warrant a re-query.
- **Pivot view.** A native pivot/crosstab against the current result set.
- **Saved queries v1.** Local-first (git-backed folder the user chooses). Tags, descriptions, parameter definitions.
- **Import/export.** CSV, JSON, NDJSON, Parquet, Arrow. Direct table-to-table copy across connections.

**UX**

- **Tab groups + session persistence.** Close the app at 1 AM, reopen it at 9 AM with every tab, every cursor position, every unsaved draft right where they were.
- **Quick-switcher (`Cmd+P`).** Files/queries/tables/connections — one switcher, scored by recency + frecency.

**UI**

- **Light mode parity.** No longer a second-class citizen. Dedicated amber-on-warm-paper palette that isn't just "dark inverted."
- **Signature moment release.** Y1 wraps with a public "1.0 — Foundation" milestone post + video.

**Infra**

- **Crash + telemetry opt-in.** Privacy-first (Sentry self-hosted or equivalent). Defaults off. Everything toggleable from Settings.
- **i18n scaffolding.** No translations yet, but every string lives behind a translation key.

**Community**

- First external contributor onboarding doc.
- Translation infrastructure (crowdin-style) readied, not opened.

---

## Year 2 — Intelligence & Insight (Q5–Q8)

**Intent.** Stop being "a query tool that happens to have AI." Become the place people **think** about their data. Notebooks, dashboards, migrations, schema diffs — with the AI as a quiet co-author.

### Q5 — Notebooks (Year 2 · Jul–Sep 2027)

**Features**

- **SQL notebooks.** `.omq` files: markdown cells, SQL cells, result cells, chart cells. Results pinned to the cell, re-runnable. Parametrized cells with inputs at the top.
- **Cells share context.** `Cell 2` references `Cell 1`'s result by name. A light "data frame in memory" runtime on the Rust side.
- **Scheduled notebooks (local).** "Run this notebook every Monday 9 AM while the app is open." Local-only — no cloud scheduler this year.

**UX**

- Notebooks live as first-class tabs, not in a drawer. They swap with the query editor by tab type.
- Cell-level keyboard shortcuts inspired by Jupyter + Observable — reviewed for `prefers-reduced-motion` and screen readers.

**UI**

- **Result charts.** Sparkline-first. Given a result set, the app picks the most honest chart (line / bar / scatter / sparkline / single-value) before asking. User can override.
- **Typography for long-form.** Notebook prose uses a reading-optimized size/line-height different from the editor chrome. One family, two moods.

**Infra**

- Notebook file format spec (open, forkable). Published.

---

### Q6 — Dashboards & Exploration (Year 2 · Oct–Dec 2027)

**Features**

- **Dashboards.** Pin any chart cell from a notebook to a dashboard. Dashboards are collections of pinned, auto-refreshing cells — not a separate BI tool.
- **Natural-language exploration.** "Show me signups by country, last 30 days, excluding our own domain." The AI writes the SQL, picks the chart, pins nothing — the user decides.
- **Semantic layer (lite).** Users can tag tables/columns with business meaning (`users.signed_up_at = primary_signup_timestamp`). The AI uses these aliases instead of raw column names.

**UX**

- **Ghost charts.** While a query streams, a placeholder chart pre-computes itself from partial data and fills in. Signature motion moment.

**UI**

- **Chart aesthetic system.** A deliberate palette (amber-primary + 6 semantic hues in `oklch`). No rainbow defaults. Readable at 12px. Honest axes.

**Infra**

- Benchmark the client-side aggregation path — it needs to handle a 1M-row group-by in under 500ms on an M1.

---

### Q7 — Migrations & Schema Diff (Year 2 · Jan–Mar 2028)

**Features**

- **Schema diff.** Pick two connections or two points in time — see a structured diff (tables, columns, indexes, FKs, triggers, views).
- **Migration generator.** Turn a diff into a reviewable migration file in the user's flavor (`sqlx migrate`, Prisma, Flyway, Liquibase, Alembic, Rails, Laravel, Atlas).
- **AI migration review.** Before generating, the assistant flags risky patterns (non-null-without-default on a huge table, blocking index creation without `CONCURRENTLY`, column rename vs drop+add).

**UX**

- Migrations are **never** auto-applied. Two gates: review, then paste-to-terminal or "apply to this connection" with environment-tag guard from Y1.

**UI**

- **Diff view aesthetic.** Pair programming vibe — three-column (left DB / right DB / generated migration), side-by-side, color-coded with amber and a restrained red/green.

**Infra**

- Shared diff engine in Rust, exposed to the plugin layer landing in Y4.

---

### Q8 — Trust & Observability (Year 2 · Apr–Jun 2028)

**Features**

- **Query profiler.** Inline timings per pipeline stage, memory, bytes read, rows per phase. Works on PG, MySQL, ClickHouse, DuckDB where the engine supports it.
- **Slow query board.** A per-connection view of the top-N slowest statements run in the app, with one-click "ask AI to optimize."
- **Row-level data masking.** Mask columns matching patterns (`*_email`, `*_ssn`, custom regex) in the UI, in exports, and in the AI context. Per-connection defaults.
- **Secret scanning.** Detect and warn on queries that hardcode obvious secrets before they hit history.

**UX**

- "**Why is this slow?**" button. One click → EXPLAIN + profiler + AI narrative + top-3 candidate fixes, each with a runnable SQL snippet.

**UI**

- **Y2 signature moment.** The "Insight" tab — a dedicated panel that consolidates EXPLAIN, profiler, row-count estimate, and AI narrative into one Linear-quality surface.

**Infra**

- Open-source the `oh-my-query-schema-rag` crate separately. It's useful beyond this app.

---

## Year 3 — Collaboration & Scale (Q9–Q12)

**Intent.** Go from "a tool Victor and his peers love" to "a tool a whole backend team uses" — without the app turning into SaaS. Local-first stays the north star. Sharing is E2EE and offline-capable.

### Q9 — Windows & Linux (Year 3 · Jul–Sep 2028)

**Features**

- **Windows 10/11 build.** MSI installer, WinGet package.
- **Linux builds.** AppImage, `.deb`, `.rpm`, Flatpak, Snap.
- **Platform-native chrome** on Windows (Mica + custom title bar), GNOME/KDE on Linux.

**UX**

- **Keyboard map review.** `Cmd` → `Ctrl` translations, platform-correct menu conventions, WSL connection helpers.

**UI**

- A light, principled port of the vibrancy/warmth aesthetic to Windows and GTK/KDE. Not a reskin — a re-derivation.

**Infra**

- Cross-platform CI matrix. Signed builds on all three OSes. Auto-update parity.
- Platform-specific e2e coverage added to the Playwright suite.

**Community**

- Three localized translations land (target: pt-BR, ja-JP, de-DE).

---

### Q10 — Secure Sharing (Year 3 · Oct–Dec 2028)

**Features**

- **Shared saved queries & notebooks (E2EE).** A workspace is a folder the user chooses — Dropbox, iCloud, a git repo, or a local folder. Encryption keys never leave the device.
- **Connection handoff.** Share a "connection template" (host, port, default db, SSH config) **without** secrets. The receiver supplies their own credentials. No plaintext secret ever touches the disk in plaintext.
- **Git-backed query library.** Queries as files. PRs for queries. Branch-per-experiment. The app is a great git client for `.sql` and `.omq` files.

**UX**

- Approvals: any query tagged `[danger]` in a shared library requires a second pair of eyes before it can be run against a prod-tagged connection.

**UI**

- Presence indicator in the titlebar: "Ana is viewing this notebook." Opt-in, low-key, never a popover.

**Infra**

- Audit log (local, exportable) for shared-workspace actions.

---

### Q11 — SSH, VPN, Bastion, Cloud Auth (Year 3 · Jan–Mar 2029)

**Features**

- **First-class SSH tunneling.** Multi-hop, jump hosts, ControlMaster reuse, reads `~/.ssh/config`.
- **Cloud-auth providers.** AWS RDS IAM auth, GCP Cloud SQL IAM, Azure AD, Supabase service-role flows, Neon branches, PlanetScale branches.
- **Teleport / Tailscale / Boundary detection** with zero-config passthrough when present.
- **Connection profiles via `mise` / `direnv` / `.env`.** Reads secrets from whatever the user already trusts.

**UX**

- Re-auth nudges inside the Dynamic Island, not as modals. "Your IAM token refreshes in 2 min." Silent when it succeeds.

**UI**

- New Dynamic Island states: tunnel-connecting, tunnel-up, cloud-refreshing-token.

**Infra**

- All credential material goes through the OS keychain (macOS Keychain, Windows Credential Manager, Secret Service on Linux). Never disk-plaintext.

---

### Q12 — Data at 10× Scale (Year 3 · Apr–Jun 2029)

**Features**

- **Result-set streaming v2.** 100M+ rows, windowed aggregation, out-of-core sorts backed by DuckDB.
- **Row-level inline edits** with optimistic updates and a revertible "pending changes" bar. Commits as a single transaction on save.
- **Live mode.** Subscribe to a query — it re-executes on an interval or on PostgreSQL NOTIFY / MySQL binlog / MongoDB change streams / Redis keyspace notifications.

**UX**

- "**Live**" toggle beside the Run button. Visible, reversible, never automatic.

**UI**

- **Y3 signature moment.** The Live Mode ambient state — the results grid gently breathes when fresh rows land. `prefers-reduced-motion` replaces it with a subtle text counter.

**Infra**

- End of Y3: coverage ≥ 70 % across TS + Rust, p95 cold-open under 400ms, p95 first-row latency under 120ms on local PG.

---

## Year 4 — Platform & Ecosystem (Q13–Q16)

**Intent.** Let the community extend oh-my-query — new data sources, new visualizations, new workflows — without forking it. The app becomes a platform. The AI becomes agentic, but carefully.

### Q13 — Plugin API (Year 4 · Jul–Sep 2029)

**Features**

- **Driver plugin API.** Ship a Rust + TS plugin surface so community drivers (Cassandra, Elasticsearch, OpenSearch, Cockroach, TimescaleDB, Pinecone, Qdrant, Kafka, Firestore, DynamoDB) can land without core changes.
- **View plugins.** Custom result-set renderers (e.g., "render as GeoJSON on a Mapbox tile," "render as a Mermaid diagram," "render this vector column as UMAP").
- **Command plugins.** Extend the `Cmd+K` palette with user-defined commands.
- **Signed plugin distribution.** Plugins are signed, sandboxed (capability-based permissions — file, network, model).

**UX**

- Plugins are installed from a URL, a local folder, or the marketplace (Q15). Each install asks for permissions in plain English.

**UI**

- A plugin detail page that reads like a product, not a settings row.

**Infra**

- Publish the plugin API spec (Rust crate + TS types).

---

### Q14 — Agentic Workflows (Year 4 · Oct–Dec 2029)

**Features**

- **Named agents.** "Daily digest agent" — runs at a time, executes a notebook, emails (via user's configured SMTP/Gmail/Outlook) a rendered summary.
- **Triage agent.** Given a Sentry/Linear error, drafts the query most likely to diagnose it.
- **Migration agent.** From a natural-language change ("add a `team_id` column to `projects`, backfill from `users.team_id`"), produces a reviewable migration + backfill + rollback.
- **Agents are first-class objects.** They have a name, a schedule, a permission set, a log, a kill switch. Never invisible.

**UX**

- **Two gates before any agent writes anything** to a prod-tagged connection. Agents **never** execute destructive SQL without an explicit, per-run human approval.

**UI**

- An "Agents" panel that feels like a mission-control board — calm, not anxious. Linear-level quality bar.

**Infra**

- Structured agent run artifacts: prompt, tool calls, SQL produced, outputs, user decisions. Stored locally, redactable, exportable.

---

### Q15 — Marketplace & Themes (Year 4 · Jan–Mar 2030)

**Features**

- **Plugin marketplace.** Browsable, searchable, signed. Free and open — reviews, not rankings.
- **Theme marketplace.** Full color+typography themes, authored as a single `.omq-theme.json`. The amber default ships as one theme among many, but remains opinionated.
- **MCP integration.** Ship oh-my-query as an MCP server so external AI tools (Claude Code, Cursor, your editor) can ask it for schema context, run a read-only query, or open a tab with a pre-written SQL.

**UX**

- **In-app discovery without noise.** Marketplace is a tab, not a popup, not a "for you" feed. You go there when you want to. It never goes to you.

**UI**

- **Y4 signature moment part 1.** Themes with deliberate typography pairings authored by external designers. At least three curated "house themes" at launch.

**Infra**

- Moderation tooling, plugin review pipeline, security disclosure process, a clear deprecation policy.

---

### Q16 — Long-Term Support & Polish (Year 4 · Apr–Jun 2030)

**Features**

- **LTS v2.0 release.** Consolidate four years of work into a numbered long-support release with a 24-month security-fix promise.
- **Offline-first AI.** A carefully picked local model bundle (optional, opt-in) that does schema explanation, inline edits, and error-doctor without network.
- **Data lineage viewer.** Click a column anywhere, see every saved query, notebook cell, and dashboard that uses it. Across connections.
- **Accessibility certification.** Commission an external WCAG 2.2 AA audit. Publish the report. Fix everything it finds.

**UX**

- A long-form onboarding tour that doubles as a product manifesto. The app teaches its principles by using them.

**UI**

- **Y4 signature moment part 2.** Redesigned connection screen + welcome — the thing a first-time user sees is the best thing in the app.

**Infra**

- Formal governance model published (benevolent maintainership + core contributor council).
- Five-year sustainability plan published alongside — not in scope for this document.

---

## Cross-Cutting Tracks

These run as always-on streams alongside the quarterly roadmap. Budget: ~20 % of each quarter.

### AI Track

- **Q1–Q2:** Cheaper/faster routing layer; Anthropic/OpenAI parity tests.
- **Q3:** Inline AI becomes primary. Chat becomes secondary.
- **Q5–Q6:** Notebooks-aware AI (cell-aware context, cross-cell reasoning).
- **Q7:** Migration + diff reasoning.
- **Q9:** Prompt caching for schema context (huge win on large DBs).
- **Q11:** IAM-aware AI — it knows which tables the current role can read.
- **Q14:** Agents, with a strict human-in-the-loop posture.
- **Q16:** Local-only mode.

### Performance Track

- **Q1:** Grid virtualization.
- **Q4:** Streaming results to 10M rows.
- **Q8:** Query profiler; p95 targets formalized.
- **Q12:** Out-of-core joins via DuckDB; 100M-row scale.
- **Q16:** Full benchmark regression suite in CI with alerting.

### Accessibility Track

- **Q1:** Focus rings, color tokens audit, keyboard map documented.
- **Q5:** Screen reader pass on editor + grid (VoiceOver, NVDA).
- **Q9:** Cross-platform AT parity (Narrator, Orca).
- **Q16:** External WCAG 2.2 AA audit + published report.

### Privacy Track

- **Q3:** PII redaction in schema context.
- **Q4:** Telemetry, opt-in only, documented.
- **Q8:** Data masking at the UI + export layer.
- **Q11:** All credential material via OS keychain.
- **Q14:** Agent-action audit log.

---

## Design System Evolution

Design is not a separate feature; it lives inside every quarter. But the system itself evolves on its own track.

| Milestone                  | Quarter | Outcome                                                        |
| -------------------------- | ------- | -------------------------------------------------------------- |
| Typography v1              | Q1      | Distinctive UI face + refined mono; retire `-apple-system`.    |
| Color tokens audit         | Q1      | Every `oklch` token AA-verified on vibrancy on/off.            |
| Motion language v1         | Q2      | Documented spring set, documented reduced-motion replacements. |
| Chart aesthetic system     | Q6      | Semantic palette + honest-axis defaults.                       |
| Light mode parity          | Q4      | Dedicated amber-on-warm-paper palette.                         |
| Cross-platform aesthetic   | Q9      | Windows Mica + GTK/KDE re-derivations (not reskins).           |
| Theme authoring spec       | Q15     | `.omq-theme.json` open spec, three curated house themes.       |
| Storybook / component site | Q3      | Public docs for the component library.                         |
| Design tokens package      | Q13     | Publishable `@oh-my-query/tokens` — used by plugin authors.    |

Reference anchors (do revisit each year): **TablePlus, Postico, Things 3, Linear, Arc.** Anti-references (do **not** drift toward): DBeaver, pgAdmin, generic "AI product" UI — purple/cyan gradients, sparkles, chatbot drawer bolted onto admin screens.

---

## Community & Ecosystem Track

### Year 1 — Invite

- CONTRIBUTING.md, issue templates, `good-first-issue` sweep. _(Q1)_
- Public roadmap on the website. _(Q2)_
- Public changelog, RSS-feed'd, Linear-toned. _(Q3)_
- Contributor onboarding doc + translation scaffolding. _(Q4)_

### Year 2 — Teach

- Docs site (Starlight or Nextra), with runnable examples. _(Q5)_
- Notebook file format spec published. _(Q5)_
- Cookbook: "10 ways to use the AI without feeling like you're using AI." _(Q6)_
- `oh-my-query-schema-rag` open-sourced as its own crate. _(Q8)_

### Year 3 — Include

- Windows + Linux on day one; three language localizations. _(Q9)_
- Public Discord graduates from "support channel" to community (office hours, showcases). _(Q10)_
- Monthly "Query Club" stream — real-world debugging walk-throughs. _(Q11–Q12)_
- First community contributor summit (online). _(Q12)_

### Year 4 — Empower

- Plugin API docs, plugin starter templates, plugin dev CLI. _(Q13)_
- Marketplace launch with curated seed plugins. _(Q15)_
- Published governance model + RFC process. _(Q16)_
- External WCAG audit report published. _(Q16)_

### Ecosystem integrations (opportunistic, not scheduled)

- First-class Supabase / Neon / PlanetScale / Turso detection and branch-aware connections.
- `dbt` project import — read `dbt` models, open them as notebooks.
- Prisma / Drizzle schema import.
- ORMs: generate TypeScript types from a selected query (Kysely, Drizzle, Prisma flavor).
- Editor bridges: a VSCode extension that opens queries in oh-my-query; a JetBrains action; a Zed extension.

---

## Technical Debt & Infra Track

Scheduled explicitly so it never gets crowded out by features.

### Testing & Quality

- **Q1:** Vitest + Playwright + `cargo nextest` harness. 40 % coverage gate.
- **Q2:** Benchmark suite (cold open, first-row, 1M-row streaming).
- **Q5:** Snapshot test coverage for every route.
- **Q8:** Coverage gate ratcheted to 60 %.
- **Q12:** Coverage gate to 70 %; benchmark regression CI with alerting.
- **Q16:** LTS-readiness audit; fuzz testing for SQL dialect transpilation.

### Build, Release, Tooling

- **Q1:** Signed stable / beta / nightly channels.
- **Q2:** Rust workspace split into `core` + `drivers-*`.
- **Q4:** Crash reporting (opt-in, self-hosted).
- **Q9:** Cross-platform CI matrix (macOS × Windows × Linux).
- **Q13:** Signed plugin distribution infrastructure.
- **Q15:** Marketplace CDN + review queue.

### Security

- **Q1:** Threat model written. Public.
- **Q3:** PII redaction layer. Secret scanning in query history.
- **Q8:** Data masking in exports and AI context.
- **Q10:** E2EE sharing, formal cryptographic review.
- **Q11:** OS keychain integration across platforms.
- **Q13:** Plugin sandbox review (capability model).
- **Q15:** Responsible disclosure process documented.
- **Q16:** External security audit.

### Architecture

- **Q2:** Rust workspace split.
- **Q4:** Extract `oh-my-query-core` as reusable crate.
- **Q6:** Client-side data frame runtime formalized.
- **Q8:** `schema-rag` crate extracted.
- **Q13:** Plugin API spec frozen.
- **Q16:** LTS architecture review — anything that couldn't survive two more years gets rewritten.

### Documentation

- **Q2:** Public roadmap.
- **Q3:** Changelog.
- **Q5:** Docs site.
- **Q9:** Translations (3 languages).
- **Q13:** Plugin author guide.
- **Q16:** Principles & governance published.

---

## Success Metrics (non-revenue)

The roadmap is evaluated on four honest metrics — none of them are vanity numbers.

1. **Daily driver rate.** % of active users who open the app ≥ 4 days a week. **Target: ≥ 60 % by end of Y2.**
2. **Time-to-first-query** from cold install. **Target: < 90 seconds by end of Y1.** Measured by the onboarding flow.
3. **AI acceptance rate.** % of AI suggestions accepted without further edit. **Target: ≥ 35 % by end of Y2.** (A useful signal, not a chase-higher number — too high suggests users are rubber-stamping.)
4. **Accessibility pass rate.** % of routes clean against an automated AT/a11y sweep. **Target: 100 % by end of Y4**, backed by the external audit.

Secondary health signals (tracked, not targeted): crash-free session rate, p95 cold open, p95 first-row latency, plugin install counts, contributor count, mean time-to-first-contribution.

---

## Appendix — Feature Backlog (not yet scheduled)

Items worth doing, not yet slotted. Reviewed at each quarterly planning cycle.

**Query ergonomics** — Query linting with project rules. Parameterized snippets with typed inputs. Per-schema aliases. Shared query templates via git submodule.

**Exploration** — Saved-session snapshots. "Reproduce this crash" bundles (query + schema snapshot + AI transcript). Visual query builder (not a replacement — a ladder for newcomers).

**Data shape** — ERD auto-layout, interactive. GraphQL endpoint inspector. Automatic PK/FK discovery via pg_stats / information_schema heuristics. JSON column schema inference.

**AI surface area** — Voice queries via Whisper (desktop-local). "Explain this data like I'm a PM" mode. Teach-mode assistant that narrates its reasoning for junior developers.

**Integrations** — Datadog / Grafana "open in oh-my-query" protocol handler. Slack unfurls for `.omq` files. GitHub action to lint `.sql` in PRs using the same engine as the app.

**Exotic data sources** — S3 / R2 Parquet browsing via DuckDB. Kafka consumer tab. gRPC reflection client (adjacent but not core — may be a plugin).

**Delight** — Per-connection Dock tile tint. App-wide "Focus mode" (hide everything but the current editor + result). Deep-work timers. Mechanical-keyboard-aware haptics on supported devices.

---

_This roadmap is a living document. It will be revised at the end of each quarter in a public post-mortem. Nothing in the later years is a commitment — Y3 and Y4 items exist to make sure Y1 and Y2 decisions point somewhere coherent._
