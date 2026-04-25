# Releasing oh-my-query

The release pipeline ships **two channels** today: `stable` (default) and `beta`. Each channel has its own signed updater feed published to a rolling GitHub Release tag (`updater-stable`, `updater-beta`). The desktop app reads the feed for the channel the user picked in **Settings → Updates**.

A `nightly` channel is wired in the UI but disabled — adding it is a follow-up.

## One-time setup (maintainer)

You only need to do this once per repository.

### 1. Generate the Tauri updater keypair

The private key signs every release. The public key is embedded in the app at build time and verifies updates on the user's machine.

```bash
bunx @tauri-apps/cli signer generate -- -w ~/.tauri/oh-my-query.key
```

Store the private key somewhere durable (1Password, a hardware token — _never_ on a developer laptop's disk-only). Copy the public key string into `apps/web/src-tauri/tauri.conf.json` under `plugins.updater.pubkey`, replacing the `REPLACE_WITH_TAURI_UPDATER_PUBKEY` placeholder.

### 2. Add GitHub Actions secrets

In **Settings → Secrets and variables → Actions**, add:

| Secret                               | Required for            | Notes                                                |
| ------------------------------------ | ----------------------- | ---------------------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | every build             | Contents of the file from step 1.                    |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | every build             | Passphrase you set in step 1.                        |
| `APPLE_CERTIFICATE`                  | macOS notarization      | Base64 of the Developer ID Application `.p12`.       |
| `APPLE_CERTIFICATE_PASSWORD`         | macOS notarization      | The `.p12` passphrase.                               |
| `APPLE_SIGNING_IDENTITY`             | macOS notarization      | E.g. `Developer ID Application: Your Name (TEAMID)`. |
| `APPLE_ID`                           | macOS notarization      | App Store Connect Apple ID.                          |
| `APPLE_PASSWORD`                     | macOS notarization      | App-specific password (not your Apple ID password).  |
| `APPLE_TEAM_ID`                      | macOS notarization      | 10-char team ID.                                     |
| `WINDOWS_CERTIFICATE`                | Windows signing _(opt)_ | Base64 `.pfx`. Leave empty until ready.              |
| `WINDOWS_CERTIFICATE_PASSWORD`       | Windows signing _(opt)_ | `.pfx` passphrase.                                   |
| `HOMEBREW_TAP_TOKEN`                 | Homebrew cask dispatch  | Already in use; keep as-is.                          |

### 3. Enable Windows signing (when you have a cert)

Set the **repository variable** `WINDOWS_SIGNING_ENABLED=true` (Settings → Variables → Actions). The `Sign Windows artifact` step in `release.yml` is a no-op until both the variable and the secrets above are present. Until then, Windows artifacts ship unsigned and the workflow logs a warning in the run summary.

### 4. Seed the rolling appcast tags

The first release per channel will create `updater-stable` / `updater-beta` automatically — no manual step needed.

## Cutting a release

### Stable

```bash
git checkout main && git pull
git tag v0.1.0
git push origin v0.1.0
```

The `Release` workflow:

1. Parses the tag → channel `stable`.
2. Bumps `tauri.conf.json` and `Cargo.toml` on `main` and pushes the bump commit.
3. Builds + signs + notarizes macOS (arm64, x64) and Windows (x64, arm64).
4. Generates `latest.json`, force-recreates the `updater-stable` rolling tag at the current commit, and uploads the appcast as a release asset.
5. Dispatches the Homebrew tap update.

### Beta

```bash
git checkout main && git pull   # or any branch you want to ship to beta
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

Same workflow as stable, except:

- No version-bump commit on `main` (beta versions live only on the tag).
- The release is marked `prerelease: true`.
- The appcast publishes to `updater-beta`.

Promote a beta to stable by tagging `v0.1.0` on the same commit.

## Rolling back a bad release

Two layers of defense — pick the cheapest one that solves your case.

1. **Stop telling clients about the update** (fast, reversible)

   ```bash
   gh release delete-asset updater-stable latest.json --yes
   ```

   The desktop app falls back to "no update available" until the next signed release publishes.

2. **Yank the release entirely** (irreversible for users who already updated)
   ```bash
   gh release delete v0.1.0 --yes --cleanup-tag
   gh release delete-asset updater-stable latest.json --yes
   ```
   Users on a corrupted version can still re-download the previous good build from its release page.

## Key rotation

If the updater private key is ever exposed:

1. Generate a fresh keypair (step 1 above).
2. Ship a release that **embeds the new public key** _and_ is signed with the **old private key** — every active user's app verifies it with the still-trusted old pubkey, then upgrades to a build that trusts only the new key going forward.
3. Rotate `TAURI_SIGNING_PRIVATE_KEY` in GitHub Secrets to the new key.
4. Ship a follow-up release signed with the new key to confirm the chain.
5. Revoke / destroy the old private key.

Do not skip the bridging release — clients on the compromised key cannot verify anything signed with the new key directly.

See [`docs/threat-model-updates.md`](docs/threat-model-updates.md) for the rationale and the threat-by-threat coverage.
