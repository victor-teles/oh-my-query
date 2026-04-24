# oh-my-query — Rust backend

Tauri v2 app binary plus the `app_lib` library crate that powers it. See the repo-level `CLAUDE.md` for overall architecture.

## Benchmarks

Performance-sensitive pure paths (`crypto`, `db::transpile`, `db::explain::parser`) are covered by Criterion benches under `benches/`. CI runs them through [CodSpeed](https://codspeed.io), which measures instruction counts rather than wall-clock time, so results are deterministic on shared GitHub runners.

### Run locally

```bash
# Full criterion run with HTML reports in target/criterion/
cargo bench --manifest-path apps/web/src-tauri/Cargo.toml

# Single bench target
cargo bench --manifest-path apps/web/src-tauri/Cargo.toml --bench transpile_bench

# Reproduce the CodSpeed CI run locally (requires cargo-codspeed)
cargo install cargo-codspeed
cargo codspeed build --manifest-path apps/web/src-tauri/Cargo.toml
cargo codspeed run --manifest-path apps/web/src-tauri/Cargo.toml
```

### Add a new bench

1. Create `benches/<name>_bench.rs`. Use `codspeed_criterion_compat` (drop-in for `criterion`):

   ```rust
   use codspeed_criterion_compat::{black_box, criterion_group, criterion_main, Criterion};

   fn bench_thing(c: &mut Criterion) {
       c.bench_function("thing", |b| b.iter(|| do_work(black_box(&input))));
   }

   criterion_group!(benches, bench_thing);
   criterion_main!(benches);
   ```

2. Register it in `Cargo.toml`:

   ```toml
   [[bench]]
   name = "<name>_bench"
   harness = false
   ```

3. Keep inputs deterministic and in-process (no network, no filesystem, no DB). Benches that need a private module should go through a `pub` re-export rather than exposing internals.

### Regression threshold

The "**fail CI on >10% regression**" threshold is configured in the **CodSpeed dashboard** (Project Settings → Performance), not in `.github/workflows/benchmarks.yml`. Change it there if the noise floor shifts.

The workflow is gated on changes under `apps/web/src-tauri/**`, so frontend-only PRs skip it entirely.
