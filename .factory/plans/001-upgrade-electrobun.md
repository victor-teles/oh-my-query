# Plan 001: Run oh-my-query on the latest stable Electrobun

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 12b9e8c -- apps/app/package.json apps/app/electrobun.config.ts apps/app/tsconfig.json apps/app/src/bun apps/app/src/mainview/lib/ipc.ts apps/app/scripts .github/workflows bun.lock .gitignore apps/app/.gitignore`
> and `git status --short`. If `electrobun` is already on a 2.x version, compare
> it with the current latest stable and continue from the first unmet Done criterion.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH (major toolchain change: v2 builds through the new "Hutch" toolchain, which affects dev, build and release)
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `12b9e8c`, 2026-11-17 (clean tree)

## Why this matters

The launcher rewrite (plans 002–007) needs native features: a system-wide
hotkey (`GlobalShortcut`), a menu-bar `Tray`, hide/show/activate,
always-on-top and visible-on-all-workspaces windows, and frame control. The
Electrobun 2.x docs cover all of them, and the repo is on `1.16.0`. Upgrading
first, on the **current** app, before the rewrite starts, keeps upgrade
regressions separate from rewrite regressions. It also produces a releasable
build on the new toolchain, and leaves 002 with only product work.

The owner asked explicitly for Electrobun to be on the **latest** version.

## Target version

- Use the latest **stable** release: the npm dist-tag `latest`. At planning
  time this was `2.0.6`, and the `beta` tag was `2.0.7-beta.24`.
- Re-check at execution with `npm view electrobun dist-tags --json`, and use
  whatever `latest` says. **Never use a `beta`/prerelease build.**
- Pin the exact version (`"electrobun": "2.0.6"`, not a `^` range). In v2, the
  package version selects the whole toolchain: Hutch downloads the matching
  core, devkit and build-time runtime. Exact pinning makes the lockfile
  reproducible.

## Current state

- `apps/app/package.json`: `"electrobun": "^1.16.0"` is a **dependency**, but
  v2 expects it in `devDependencies`. `bun.lock` resolves `electrobun@1.16.0`.
  The relevant scripts are:
  ```json
  "bun:dev": "bun run scripts/copy-bun-assets.ts && ELECTROBUN_DEV_URL=http://localhost:3001 electrobun dev --watch",
  "desktop:build": "bun run scripts/copy-bun-assets.ts && vite build && electrobun build",
  ```
- `apps/app/electrobun.config.ts` uses these settings:
  - `app` { identifier `dev.ohmyquery.app`, name `oh-my-query`, version `0.0.10` };
  - `build.bun.external` (from `scripts/native-bun-assets.ts`);
  - `build.copy` (native bun assets plus `"dist/**/*": "views/mainview/"`);
  - `build.views.mainview.entrypoint: "dist/index.html"`;
  - `build.mac` { `bundleCEF: false`, `codesign` gated on
    `ELECTROBUN_DEVELOPER_ID`, `icons: "assets/icon.iconset"`, `notarize` gated
    on `ELECTROBUN_APPLEID` or `ELECTROBUN_APPLEAPIKEY` };
  - `build.linux` and `build.win` with `bundleCEF: false` and icons.

  There is no `build.mainProcess` and no `build.bun.entrypoint`; v1 defaulted
  to `src/bun/index.ts`.

- Bun-side imports use `"electrobun/bun"` in `src/bun/{index,window,menu,rpc}.ts`.
  The renderer uses `Electroview` from `"electrobun/view"` in
  `src/mainview/lib/ipc.ts`.
- `src/bun/updater.ts` is a stub. `checkForUpdate` and `installUpdate` return
  null and false, and the comment says Electrobun Updater integration is
  deferred. **So there is no in-app update path to bridge.** Existing 0.0.x
  users upgrade by installing the new DMG, and the v2 "bridge release" rules
  (which require v1.18.1+) do not apply.
- `apps/app/tsconfig.json` is standalone. It has no `extends`, sets
  `"types": ["bun", "vite/client"]`, and includes `electrobun.config.ts`.
  `check-types` runs `tsgo --noEmit`.
- `.github/workflows/release.yml` triggers on `v*` tags. It maps tags to a
  channel of `stable`, `beta` or `nightly`, and seds `version:` into
  `electrobun.config.ts`. Then:
  - **macOS** (`macos-latest`): imports the signing cert, runs `desktop:build`
    with `ELECTROBUN_DEVELOPER_ID`, `ELECTROBUN_APPLEID`,
    `ELECTROBUN_APPLEIDPASS` and `ELECTROBUN_TEAMID`, then expects
    `apps/app/build/stable-macos-${BUILD_ARCH}/oh-my-query.dmg`.
  - **Windows**: expects `apps/app/artifacts/stable-win-${arch}-*.zip`.
- `.github/workflows/ci.yml` runs `bun run build` (Vite only), tests,
  coverage, lint, typecheck and e2e. It does **not** run an Electrobun build.
- Dependencies are not installed in the planning checkout.

## What v2 changes (from the official "Migrating to v2" guide)

- `electrobun dev` and `electrobun build` still work, but they forward through
  **Hutch**. The first run downloads the core and devkit into `~/.hutch` and
  projects the SDK into the project's `.hutch/devkit/`.
- The guide recommends pointing TypeScript at the devkit with
  `"extends": "./.hutch/devkit/tsconfig.json"`.
- For the lowest-risk path from a v1 Bun app, the guide says to keep the main
  process on Bun explicitly:
  ```ts
  build: { mainProcess: "bun", bun: { entrypoint: "src/bun/index.ts", /* external… */ } }
  ```
  Cottontail is optional and **out of scope**.
- A config validator names every removed v1 field. The guide lists
  `build.targets`, `useAsar`, `asarUnpack`, `cefVersion`, `wgpuVersion`,
  `bunVersion`, `bunnyBun` and `locales`; this repo uses none of them. Treat
  `bundleCEF` as suspect until the validator accepts it.
- `electrobun/bun` is a deprecated alias of `electrobun/main`. Migrate the
  imports.
- Build environments are `dev`, `canary` and `stable`, selected with
  `--env=`. `buildFolder` defaults to `build` and `artifactFolder` to
  `artifacts`. macOS emits a DMG by default plus an `.app.tar.zst` update
  archive. The signing env var names are unchanged.
- The CI guidance installs Hutch with its official install script and runs
  `hutch electrobun build --env=…`. Hutch does not cross-compile, so each OS
  builds on a native runner.

## Commands you will need

| Purpose          | Command                                    | Expected                        |
| ---------------- | ------------------------------------------ | ------------------------------- |
| Latest stable    | `npm view electrobun dist-tags --json`     | read `latest`                   |
| Install          | `bun install`                              | exit 0, lockfile updated        |
| Sync toolchain   | `bunx electrobun sync` (run in `apps/app`) | `.hutch/devkit/` present        |
| Typecheck        | `bun run check-types`                      | exit 0                          |
| Lint             | `bun run check`                            | exit 0                          |
| Tests            | `bun run --cwd apps/app test`              | all pass                        |
| e2e              | `bun run --cwd apps/app e2e`               | all pass                        |
| Desktop dev      | `bun run --cwd apps/app desktop:dev`       | app window opens, RPC works     |
| Desktop build    | `bun run --cwd apps/app desktop:build`     | DMG produced (unsigned locally) |
| Postgres fixture | `bun run fixtures:up`                      | for the RPC smoke check         |

## Implementation rules relevant to this plan

- This is a **migration only**: no product or UI changes, and the current
  workspace app must behave as before.
- Strict TypeScript, no `any`. If the v2 types still need the `as never` on
  `BrowserWindow` options in `src/bun/index.ts`, keep it with a one-line why.
  Otherwise remove it.
- No code comments except for a non-obvious why. Formatting follows
  Oxfmt/Ultracite (`bun run fix`).
- Do not weaken CI checks to make the upgrade pass. Fix the root cause.
- Never print signing secrets. Refer to them by their env var or secret name.

## Scope

**In scope**

- `apps/app/package.json` (version, move the package to `devDependencies`,
  scripts if v2 needs flags such as `--env=dev`) and `bun.lock`.
- `apps/app/electrobun.config.ts`
- `apps/app/tsconfig.json`
- `apps/app/src/bun/{index,window,menu,rpc,updater}.ts`: imports and any API
  renames.
- `apps/app/src/mainview/lib/ipc.ts`: only if the `electrobun/view` API changed.
- `apps/app/scripts/{copy-bun-assets,native-bun-assets}.ts`: only if
  `build.copy` or `external` semantics changed.
- `apps/app/.gitignore`: add `.hutch/`, and `artifacts/` if it is missing.
- `.github/workflows/release.yml`: build invocation, Hutch install and cache,
  artifact paths, and the channel → env mapping.
- `.github/workflows/ci.yml`: only if `check-types` now needs the devkit, for
  example a `bunx electrobun sync` step before `check-types`.
- `CLAUDE.md`, the "Desktop runtime" bullets: Electrobun 2 and Hutch,
  `electrobun/main`, `.hutch/devkit`.
- `.factory/plans/002-launcher-shell.md`: update only its "Current state" line
  about the Electrobun version, if the installed `latest` differs from 2.0.6.

**Out of scope**

- Launcher, tray and global shortcut _usage_. Plan 002 builds them. This plan
  only proves they exist.
- Migrating to the Cottontail runtime.
- Implementing the Electrobun `Updater` or `release.baseUrl`. The updater stays
  a stub.
- Pushing tags or running the release workflow. That requires owner
  authorization.

## Git workflow

- Branch `chore/electrobun-2` from `main`.
- Commit only if authorized. Message style:
  `Upgrade Electrobun to 2.x (Hutch toolchain)`.
- Do not push, tag or open a PR unless instructed.

## Steps

### Step 1: Bump and sync

1. Read `latest` from npm.
2. In `apps/app`, run `bun remove electrobun && bun add -d electrobun@<latest>
--exact`.
3. Run `bun install`, then `bunx electrobun sync`. Confirm that `.hutch/devkit/`
   exists and that `~/.hutch` holds the paired toolchain.
4. Add `.hutch/` to `apps/app/.gitignore`.

**Evidence**:

- `grep '"electrobun"' apps/app/package.json` shows the exact `latest` version
  under `devDependencies`.
- `grep 'electrobun@' bun.lock` shows the same version.

### Step 2: Config migration

Edit `electrobun.config.ts`:

1. Add `build.mainProcess: "bun"` and `build.bun.entrypoint: "src/bun/index.ts"`,
   keeping `external`.
2. Keep `copy`, `views`, the icons, and the codesign/notarize gating.
3. Run the toolchain (`bunx electrobun build --env=dev`). For each field the
   validator rejects, delete it or rename it to its documented v2 equivalent.
   Record each change in the PR description.
4. Check whether `bundleCEF: false` still means "system WebView". If v2 changed
   the default renderer, keep the **system WKWebView** on macOS, because that
   is the current behavior and bundle size.

### Step 3: Code and types

1. Change `"electrobun/bun"` to `"electrobun/main"` throughout `src/bun`.
2. Make `apps/app/tsconfig.json` extend `./.hutch/devkit/tsconfig.json` while
   keeping this repo's options (`strict`, `verbatimModuleSyntax`, `paths`,
   `types`, `jsx`). Our options must still win where they overlap.
3. If `tsgo` cannot resolve the devkit tsconfig, or if extending it changes
   strictness, do not extend. Keep the standalone config and add a `paths` or
   `types` entry pointing at the devkit typings, and say so in the PR.
4. Fix the type errors the new typings expose. Pay attention to
   `BrowserWindow` options, `ApplicationMenu` events (`menu.ts`,
   `index.ts`), and `defineElectrobunRPC` / `Electroview.defineRPC` generics.
   Keep the exhaustive `RequestHandlers` map in `rpc.ts`.

**Evidence**: `bun run check-types` → exit 0. `rg -n "electrobun/bun" apps/app` → no matches.

### Step 4: Prove the launcher primitives exist

In the installed devkit typings, confirm that these exist and record their
exact signatures in the PR description:

- `GlobalShortcut` (register and unregister an accelerator, and a callback);
- `Tray` (title, image, menu, and click events);
- `BrowserWindow`: `show`, `hide`, `activate`, `isVisible`, `setAlwaysOnTop`,
  `setVisibleOnAllWorkspaces`, `setFrame`, `getFrame` and `center`, plus a
  blur or resign-key event;
- a way to get the screen under the cursor or the display bounds;
- a way to run without a Dock icon (an activation policy or an
  `LSUIElement`-style config).

Plan 002 consumes this list. If an item is missing, record "missing" and the
fallback (see STOP conditions). Do not build the feature.

### Step 5: Dev and local build smoke test

1. Run `desktop:dev`. The current workspace app opens. Connect to the fixture
   Postgres (`bun run fixtures:up`), run `select 1`, and see the result. That
   exercises RPC both ways. Then edit a renderer file and confirm that HMR or
   the reload still works through `ELECTROBUN_DEV_URL`.
2. Run `desktop:build` (stable env, unsigned locally). Note the output
   locations of the `.app`, the DMG and the update archive. Launch the built
   `.app`, confirm that the polyglot-sql WASM loads (format a query), and run
   a query.
3. **Rendering and motion parity.** Motion is mandatory for the rewrite, so
   the 2.x webview must composite as well as 1.16 did:
   - Run the existing Dynamic Island transitions (connect, run a query, error)
     and a `motion` layout animation.
   - Check the window's `transparent: true` vibrancy and the
     `backdrop-blur-xl backdrop-saturate-200` surfaces.
   - Record each once on 1.16 (before the bump) and once on 2.x (after), in
     both dev and the built app.
   - Capture a Safari Web Inspector Timelines trace on 2.x. Springs must hit
     60fps (no frames over 16.7ms on a ProMotion display at 60Hz, or note the
     refresh rate), and `backdrop-filter` must still blur the desktop behind a
     transparent window.
   - Attach the before/after recordings and the trace to the PR.

### Step 6: Release workflow

Update `.github/workflows/release.yml`:

1. **Toolchain.** Either install Hutch with the official installer, as in the
   Electrobun updates guide, or rely on `bunx electrobun` downloading it.
   Choose one and use it the same way in every job. Cache `~/.hutch` with
   `actions/cache`, keyed by OS, arch and the electrobun version.
2. **Channel.** Build with `--env=stable` for stable tags. For `beta` and
   `nightly` tags, use `--env=canary`. Keep the existing GitHub upload file
   names (`oh_my_query_${VERSION}_${ARCH_LABEL}.dmg`), so download links don't
   change.
3. **Artifact paths.** Replace the hard-coded
   `build/stable-macos-${BUILD_ARCH}/oh-my-query.dmg` and the Windows
   `artifacts/stable-win-*.zip` lookups with the paths observed in Step 5. Use
   a glob plus a clear error message, following the Windows job's style.
4. **Linux job.** Apply the same treatment.
5. **Signing env vars.** The names are unchanged. Verify that `codesign` and
   `notarize` gating still read them.

Validate the workflow without releasing:

- Run `actionlint` if it is available, or at least
  `bunx yaml-lint`/`yq` for syntax.
- Describe in the PR how to dry-run it, for example with a
  `workflow_dispatch` trigger on a fork, or a `v0.0.0-beta.1` tag on a fork.
  **Do not push a tag.**

### Step 7: CI and docs

1. If `check-types` needs `.hutch/devkit` in CI, add `bunx electrobun sync`
   (in `apps/app`) before the typecheck step in `ci.yml`, with the same cache.
2. Update the CLAUDE.md "Desktop runtime" bullets: Electrobun 2 via Hutch,
   imports from `electrobun/main`, the devkit tsconfig, and `.hutch/` being
   git-ignored.

## Test plan

- No new product behavior, so there are no new unit tests. The existing suites
  must pass unchanged: `bun run test` (turbo), `bun run --cwd apps/app test`,
  and `e2e`.
- If `ipc.ts` changes, its existing `ipc.test.ts` must still pass. Add a case
  for any new code path.
- The manual evidence (Steps 4–6) goes in the PR description: versions, the
  primitive signatures, dev and build smoke results, and output paths.

## Done criteria

- [ ] `apps/app/package.json` pins `electrobun` to the exact npm `latest` stable
      version, under `devDependencies`, and `bun.lock` matches.
- [ ] `rg -n "electrobun/bun" apps/app` → no matches.
- [ ] `bun run check-types`, `bun run check`, `bun run test`,
      `bun run --cwd apps/app test` and `e2e` all exit 0. Coverage is ≥80%.
- [ ] Desktop dev: the app opens, a fixture query runs, and the reload works.
- [ ] A local `desktop:build` produces a launchable `.app` and DMG. The built
      app runs a query and formats SQL (WASM present).
- [ ] Motion and rendering parity from Step 5.3: the before/after
      recordings and the 2.x Timelines trace are attached. Springs run at
      60fps, and backdrop blur still shows the desktop through the transparent
      window.
- [ ] `release.yml` uses the v2 toolchain, caches `~/.hutch`, maps channels to
      `stable`/`canary`, and finds artifacts at the verified paths. It passes
      syntax lint.
- [ ] The PR description lists the Step 4 primitive signatures, or "missing"
      plus a fallback.
- [ ] `.hutch/` is git-ignored, and `git status` shows no toolchain files.
- [ ] README index row updated.

## STOP conditions

- The 2.x webview drops frames on `motion` springs, or loses
  `backdrop-filter` vibrancy on transparent windows, compared with 1.16.
  Report the measurements before plan 002 starts, because the launcher's
  motion and material design depend on both.
- `GlobalShortcut` (or an equivalent system-wide hotkey) is missing from the
  latest stable 2.x on macOS. The launcher concept depends on it. Finish and
  land the upgrade anyway, then report it before plan 002 starts.
- Hutch cannot run in GitHub Actions macOS runners without credentials or
  network access we don't have, or it needs a paid or account-bound service.
  Report this; it is a distribution decision.
- The config validator rejects `bundleCEF: false`, and the only v2 path bundles
  CEF on macOS. That would grow the app by about 100MB+, a product trade-off
  the owner should decide.
- The native DB driver bundling (`build.bun.external`, the `build.copy` of
  `assets/bun/*`) cannot be expressed in v2 config.

## Maintenance notes

- Future Electrobun upgrades: bump the exact version, then run
  `bunx electrobun sync`. The `~/.hutch` cache key changes automatically
  with the version.
- The updater is still a stub. Wiring Electrobun's `Updater` later needs
  `release.baseUrl` and uploading the whole `artifacts/` folder unrenamed.
  That conflicts with today's renamed DMG uploads, so plan it as a separate
  change.
- Reviewers should scrutinize the release workflow diff and the
  tsconfig/devkit interplay.
