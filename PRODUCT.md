## Design Context

### Users

**Primary**: Backend and full-stack developers who live in terminals and IDEs and treat oh-my-query as a daily driver alongside their editor. They're keyboard-first, spend long sessions debugging and exploring data, and care about how the tool _feels_ over long stretches — not just first-run impressions.

**Context of use**: A macOS menu-bar app built with Electrobun. A global hotkey summons one translucent launcher panel over whatever the user is doing (usually a code editor or a terminal), and it goes away with Esc. From there they ask a question of PostgreSQL, MySQL, SQL Server, SQLite, DuckDB, ClickHouse, MongoDB, or Redis and read the answer as a chart, a KPI, or a table. Answers they want again become widgets with typed inputs. Widgets they want to watch go on boards: separate windows that stay open beside their work and refresh on a schedule.

**Job to be done**: "Let me ask my database a question without leaving what I'm doing, trust the answer, and keep the answers I need again within one keystroke or on a board in the corner of my screen."

### Brand Personality

- **Three words**: _warm · craft · trustworthy_
- **Voice**: Quiet confidence. No marketing language, no hype, no "✨ AI-powered." Talks to the user like a senior colleague who respects their time.
- **Emotional goal**: A tool you're genuinely happy to sit inside for a 3-hour debugging session. The kind of care you feel in Things 3, Postico, or Linear — where someone clearly sweated the small details.

### Aesthetic Direction

- **Lineage**: Refined & native-calm. Positive references: **TablePlus, Postico, Things 3, Linear, Arc**. The goal is to belong on that shelf.
- **Anti-references**:
  - **DBeaver / phpMyAdmin / pgAdmin** — bureaucratic grey panels, icon-heavy toolbars, default widget look, zero personality.
  - **Generic AI-app UI** — purple/cyan gradients, neon accents on dark, sparkle icons, chatbot drawer bolted onto an admin UI.
- **Theme**: Dark-first with a warm amber accent, to be refined rather than replaced. Light mode exists but dark is the hero surface. Current palette (`oklch` warm neutrals, amber primary `~0.92 0.052 66°`) is the starting point, not a placeholder.
- **Typography direction**: The current `-apple-system` stack is a placeholder and the single biggest gap. Pair a distinctive display/UI face with a refined mono for SQL and data. Avoid Inter, IBM Plex, Space Grotesk, Fraunces, Instrument Sans. Look for something with craft character that still reads as native.
- **Motion**: iOS-like springs (already in use). Purposeful, never decorative. Must degrade cleanly under `prefers-reduced-motion`.
- **Signature moment**: The **launcher's ask flow** is the "wait, what was that?": one panel that morphs from question to streaming SQL to running to a chart card. Invest here first. Its states, transitions, and at-a-glance legibility should be the thing users screenshot.

### Design Principles

1. **Warmth is structural, not decorative.** The amber and vibrancy are there because they make long sessions feel cared-for — not because dark mode needs "pop." Every warm touch should reinforce trust.
2. **Native-calm, not native-cosplay.** Feel like a first-party Mac app: keyboard-first, quiet chrome, real vibrancy, deliberate motion. Don't imitate macOS widgets — inherit the discipline, not the skin.
3. **The AI disappears into the editor.** No chatbot drawer aesthetic, no sparkle iconography. AI output should feel like a colleague paste-ing SQL into your editor, not a product feature demanding attention.
4. **Density with breathing room.** Pro users want information; calm users want space. Resolve this with tight typographic rhythm and varied spacing — not by wrapping everything in cards or hiding data behind disclosure.
5. **Every interactive surface is reachable by keyboard and visible to AT.** Focus rings are a feature. Contrast hits WCAG AA everywhere — including the translucent launcher panel, board tiles, and muted labels. Motion respects `prefers-reduced-motion` fully.
6. **Make the launcher's ask flow the signature.** When something wants to be distinctive, put the effort here first. It's the single most memorable surface in the app.
