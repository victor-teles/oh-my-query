# Testing

Every PR runs three test pipelines, each gated at 40% line coverage. The gate is intentionally low for Q1 — it ratchets to 60% by Q8 and 70% by Q12 (see `ROADMAP.md`).

## Quick reference

```bash
# Frontend unit tests + coverage gate (40% lines/statements/funcs, 35% branches)
bun run --cwd apps/web test
bun run --cwd apps/web test:coverage

# Frontend e2e (Playwright against the Vite dev server)
bun run --cwd apps/web e2e
bun run --cwd apps/web e2e:ui          # interactive runner
bun run --cwd apps/web e2e:headed      # watch a real browser

# Rust (nextest + llvm-cov gate)
cargo nextest run --manifest-path apps/web/src-tauri/Cargo.toml
cargo llvm-cov nextest --manifest-path apps/web/src-tauri/Cargo.toml --html

# Bring up DB fixtures (Postgres)
bun run fixtures:up
bun run fixtures:down
```

## Frontend (Vitest)

- Runner: Vitest 3 with two projects defined in `apps/web/vite.config.ts` — a jsdom unit project (default) and a Playwright-driven Storybook project for visual regression.
- Setup: `apps/web/src/test/setup.ts` clears Tauri IPC mocks and `localStorage` after each test.
- Mocking Tauri: use `mockTauri()` from `apps/web/src/test/tauri-mock.ts`. Pass an object whose keys are command names and whose values are handlers.
- Colocation: tests live next to source as `*.test.ts(x)`.
- Coverage: provider `v8`, report at `apps/web/coverage/index.html` after `test:coverage`. Thresholds live in the same `vite.config.ts`. Routes, the AI elements/chat trees, the titlebar, the command palette, and shadcn primitives are excluded — those surfaces are covered by Storybook visual regression and by the Playwright e2e tests below.

## E2E (Playwright)

- Config: `apps/web/playwright.config.ts`.
- The runner starts `bun run dev` (Vite at port 3001) automatically.
- Specs live in `apps/web/e2e/`. The current smoke set covers app boot and the connection-add flow.
- IPC: e2e runs in pure browser mode (`isTauri()` returns `false`), exercising the surface that does not need the Rust backend. For flows that _do_ need IPC, `apps/web/e2e/_setup/install-tauri-mock.ts` exposes a Playwright-side equivalent of the unit-test `mockTauri()` helper — call it from `page.beforeEach` to install command stubs before navigation.
- The full Tauri WebDriver path (driving the real desktop binary) is **deferred**. Tauri v2's WebDriver is not Playwright-native; when a flow genuinely requires the Rust process we will spike it as a separate effort. Until then, Rust correctness is covered by the nextest job, frontend correctness by Vitest, and the integration seam by these mocked e2e flows.

## Rust (nextest + llvm-cov)

- Tests are colocated as `#[cfg(test)] mod tests` in each module. Run them with `cargo nextest run --manifest-path apps/web/src-tauri/Cargo.toml`.
- Profiles live in `apps/web/src-tauri/.config/nextest.toml`: `default` for local runs, `ci` for CI (one retry, terse output).
- Coverage: `cargo llvm-cov nextest` wraps nextest. CI uses `--fail-under-lines 40` to enforce the gate; pass `--html` locally to inspect uncovered lines.
- Tooling: install once with `cargo install cargo-nextest cargo-llvm-cov` (or, in CI, via `taiki-e/install-action`).
- Excluded from coverage (Tauri/integration-only paths whose unit-level surface is empty): `commands.rs`, `config.rs`, `lib.rs`, `main.rs`, the trait/error/type modules under `db/`, every driver wrapper (`postgres`/`mysql`/`sqlite`/`mongodb_driver`/`pool`/`version`), the `execute/` paths that need a live database (`clickhouse`/`mod`/`mongodb`/`mssql`/`sql`), and the `explain/` driver-specific submodules (`clickhouse`/`duckdb`/`mod`/`mysql`/`postgres` — the cross-driver `parser.rs` is kept). The gate applies to the unit-testable surface; integration-only code lives behind a future `OMQ_INTEGRATION=1` track.

## Coverage gate

| Stack  | Threshold (Q1)           | Where it lives                                         |
| ------ | ------------------------ | ------------------------------------------------------ |
| Vitest | 40% lines / 35% branches | `apps/web/vite.config.ts` (`test.coverage.thresholds`) |
| Rust   | 40% lines                | CI step (`--fail-under-lines 40` flag)                 |

A failing PR shows the failing percentages in the `Frontend` and `Rust / test + coverage` job logs. To see what dropped: open the Vitest HTML report (`apps/web/coverage/index.html`) or run `cargo llvm-cov nextest --html` and open the printed path.

The ratchet plan: 60% by Q8 (mid-Year-2), 70% by Q12 (end-Year-3). Bump the thresholds in the same step where you ship the work that earned the headroom — never lower the gate to make a PR green.

## Fixtures

`infra/docker-compose.yaml` exposes ClickHouse, MariaDB, MongoDB, and Postgres. SQLite is file-based — point the app at `infra/fs/volumes/sqlite/oh-my-query.sqlite` (or any path you choose) when adding a connection.

The Postgres fixture seeds `users` and `orders` from `infra/fs/volumes/postgres/init.sql`. Bring it up with `bun run fixtures:up`; tear it down with `bun run fixtures:down`.

When new Rust integration tests need a live database, gate them on `OMQ_INTEGRATION=1` so the standard `cargo nextest run` stays fast and offline.
