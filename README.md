<div align="center">

<img src=".github/banner.webp" alt="oh-my-query" width="100%" />

# oh-my-query

A modern database client for querying with AI.

[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)
[![macOS](https://img.shields.io/badge/platform-macOS-000000.svg?style=flat&logo=apple&logoColor=white)](https://github.com)
[![Electrobun](https://img.shields.io/badge/Electrobun-1.16-FBF0DF.svg?style=flat&logo=bun&logoColor=black)](https://electrobun.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

</div>

<br />

> [!WARNING]
> This project is under active development. Features may change, break, or be incomplete. Use at your own risk.

<br />

oh-my-query is a native desktop database client with a built-in AI assistant. Connect to eight different database engines, explore schemas, write queries with schema-aware autocomplete, and let AI help when you want it — all in a keyboard-first interface designed for long debugging sessions.

<br />

## Features

### Multi-database engines, one client

Connect to **PostgreSQL**, **MySQL**, **SQLite**, **Microsoft SQL Server**, **DuckDB**, **ClickHouse**, **MongoDB**, and **Redis** — all from the same app. Browse schemas, inspect tables and columns, run queries, and jump between connections without juggling tools.

### Write any dialect, run anywhere

Powered by [polyglot-sql](https://github.com/polyglot-sql/polyglot-sql), queries are transpiled between dialects at execution time. Write PostgreSQL against a MySQL database if that's how your brain works. The built-in formatter is dialect-aware across 30+ SQL variants including BigQuery, Snowflake, DuckDB, ClickHouse, and Spark.

### AI that knows your schema

A chat assistant that sees your tables, columns, types, and relationships, then generates SQL you can drop straight into the editor. Works with **OpenAI**, **Anthropic**, **OpenRouter**, and **local models** via Ollama or any OpenAI-compatible endpoint.

### Smart editor

CodeMirror-powered SQL editor with schema-aware autocomplete, syntax highlighting, a syntax tree inspector, and multi-tab support with closed-tab restore. Every query tab is independent — run, format, and inspect results side by side.

### Results, not just rows

A virtualized results grid with keyboard navigation, multi-cell selection, row detail drawer, JSON document viewer, and CSV export. Built for pro users who live in the grid.

### Signature connection indicator

A Dynamic Island-style connection indicator lives in the titlebar, showing live connection status, query execution progress, and errors without stealing focus from your work.

### Native experience

Built with Electrobun. macOS vibrancy effects, `prefers-reduced-motion` respected throughout, dark mode by default, and iOS-style spring animations that stay out of your way.

<br />

## Keyboard Shortcuts

### Query & editor

| Shortcut          | Action                   |
| ----------------- | ------------------------ |
| `Cmd + Enter`     | Run query (or selection) |
| `Cmd + Shift + E` | Explain query            |
| `Cmd + Shift + F` | Format SQL               |
| `F5`              | Refresh schema           |

### Tabs

| Shortcut          | Action                 |
| ----------------- | ---------------------- |
| `Cmd + T`         | New query tab          |
| `Cmd + W`         | Close current tab      |
| `Cmd + Shift + T` | Reopen last closed tab |
| `Cmd + 1-9`       | Switch to tab          |

### Layout

| Shortcut          | Action                |
| ----------------- | --------------------- |
| `Cmd + B`         | Toggle schema sidebar |
| `Cmd + Shift + C` | Toggle AI chat        |
| `Cmd + Shift + 1` | Editor mode           |
| `Cmd + Shift + 2` | Split mode            |
| `Cmd + Shift + 3` | Chat mode             |

### Results grid

| Shortcut         | Action           |
| ---------------- | ---------------- |
| `Cmd + A`        | Select all       |
| `Arrows`         | Navigate cells   |
| `Shift + Arrows` | Extend selection |
| `Enter`          | Open row detail  |
| `Cmd + C`        | Copy selection   |

### Home & global

| Shortcut  | Action             |
| --------- | ------------------ |
| `Cmd + N` | New connection     |
| `Cmd + ,` | Settings           |
| `Cmd + /` | Show all shortcuts |

<br />

## Installation

### Homebrew (macOS, recommended)

```bash
brew install --cask victor-teles/tap/oh-my-query
```

### Manual download

Grab the latest installer from the [GitHub Releases](https://github.com/victor-teles/oh-my-query/releases) page.

- **macOS** — `.dmg` for Apple Silicon and Intel
- **Windows** — `.msi` installer or portable `.exe`

<br />

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.3.9+

### Getting started

```bash
# Install dependencies
bun install

# Start the renderer only (browser)
bun run dev:web

# Start the desktop app (Vite + Electrobun watcher)
bun run desktop:dev
```

The renderer runs at [localhost:3001](http://localhost:3001).

### Other commands

```bash
bun run build          # Build all apps
bun run check-types    # TypeScript across all workspaces
bun run check          # Lint + format check (Ultracite)
bun run fix            # Auto-fix lint/format
bun run --cwd apps/app test           # Vitest unit + hook tests
bun run --cwd apps/app test:coverage  # Vitest with the 40% gate
bun run --cwd apps/app e2e            # Playwright e2e against the Vite dev server
```

See [`TESTING.md`](TESTING.md) for the full story — coverage gates and fixture setup.

<br />

## Project Structure

```
oh-my-query/
├── apps/
│   └── app/                       # Electrobun desktop app
│       ├── src/
│       │   ├── mainview/          # React renderer
│       │   │   ├── routes/        # File-based routing (TanStack Router)
│       │   │   ├── components/    # UI components
│       │   │   ├── hooks/         # Shared React hooks
│       │   │   └── lib/           # Utilities, IPC bridge, AI providers
│       │   └── bun/               # Bun-side process (RPC handlers, window, menus)
│       └── electrobun.config.ts
├── packages/
│   ├── config/                    # Shared TypeScript config
│   ├── core/                      # Persistence, transpile, traits
│   ├── drivers/                   # SQL driver adapters
│   ├── drivers-redis/             # Redis driver
│   ├── env/                       # Type-safe environment variables
│   ├── rpc/                       # RPC schema shared across renderer + bun
│   └── vitest-visual/             # Visual testing utilities
├── turbo.json
└── package.json
```

<br />

## Tech Stack

**Frontend** — React 19, TanStack Router, TanStack Form, TanStack Table/Virtual, Tailwind CSS v4, shadcn/ui, CodeMirror 6, Motion, Recharts, Vercel AI SDK

**Desktop** — Electrobun, Bun runtime, TypeScript drivers for PostgreSQL/MySQL/SQLite/SQL Server/DuckDB/ClickHouse/MongoDB/Redis, polyglot-sql

**Tooling** — Turborepo, Bun, TypeScript 5, Vitest, Ultracite (Oxlint + Oxfmt)

<br />

## Contributing

Contributions are welcome. Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b my-feature`)
3. Make your changes
4. Run `bun run fix` to lint and format, then `bun run test`
5. Commit and open a pull request

<br />

## License

[MIT](LICENSE)
