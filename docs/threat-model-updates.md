# Threat Model — Auto-update path

This document covers the trust model for oh-my-query's in-app updater. It complements [`SECURITY.md`](../SECURITY.md) and [`RELEASING.md`](../RELEASING.md).

## Asset under protection

The user's machine. The updater downloads code that the OS will execute with the user's privileges, so any compromise here is a remote-code-execution path.

## Trust anchors

Two pieces of secret state are load-bearing. Compromise of either invalidates the model.

1. **Tauri updater public key** — embedded in the binary at build time (`tauri.conf.json` → `plugins.updater.pubkey`). Verifies that every downloaded archive was signed by the matching private key.
2. **HTTPS to `github.com`** — the appcast (`latest.json`) is fetched over TLS. We rely on the OS trust store to bind the channel URL to the right server.

We deliberately do _not_ rely on:

- The integrity of the GitHub Release body.
- Code-signing certificates on macOS / Windows for update verification (those are for OS gatekeeper UX, not for telling the updater whether the bytes are trustworthy).

## Threats considered

| #   | Threat                                       | Mitigation                                                                                                                                                                                                | Residual risk                                                                                  |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Tampered archive in transit / at rest        | Tauri verifies the `minisign` signature against the embedded pubkey before installing. Mismatch aborts the install.                                                                                       | None as long as the private key is uncompromised.                                              |
| 2   | Malicious `latest.json` (URL points at evil) | The signature in step 1 is computed over the binary, not the JSON. Even a fully attacker-controlled `latest.json` cannot get evil bytes installed unless it points at a binary signed by our private key. | Attacker can withhold updates (DoS) or downgrade — see #3.                                     |
| 3   | Downgrade attack (older signed version)      | Tauri compares versions and only installs newer ones than the running build.                                                                                                                              | An attacker who controls the appcast cannot push 0.1.0 to a 0.2.0 user, but can withhold news. |
| 4   | Channel-confusion (beta user fed stable URL) | Channel preference is stored locally and resolved at runtime in `update_channel.rs` → builds the per-channel URL each time. The endpoint never comes from the network.                                    | None.                                                                                          |
| 5   | Updater private-key compromise               | See "Key rotation" in `RELEASING.md`. Bridging release signs with old key + embeds new pubkey, then a clean release signs with new key.                                                                   | Window between detection and rotation. Mitigate with hardware token + access auditing.         |
| 6   | MITM on appcast fetch                        | TLS to `github.com`. Pinned by the OS trust store.                                                                                                                                                        | Trust-store compromise (out of scope).                                                         |
| 7   | Repo / release compromise                    | Attacker gains write to the repo and to GH Secrets → can push a real signed malicious release. Detection: branch protection + protected tags + secret-scanning.                                           | Catastrophic but contained: only one release window. Rotate the key and ship a clean version.  |
| 8   | Supply-chain on `tauri-plugin-updater` crate | We pin a major version; Rust dep audit runs in CI (`cargo deny`/`cargo audit` — _follow-up_).                                                                                                             | Same as any Rust dep — typical supply-chain risk.                                              |
| 9   | User running an old, unpatched build         | The "Check for updates" button in Settings is the user-driven escape hatch. Future: optional auto-check on launch, gated by a setting.                                                                    | User who never opens Settings can stay on a vulnerable version indefinitely.                   |

## Out of scope

- Local privilege escalation _after_ the update has been installed (an OS problem).
- Side-channel attacks on the signing machine (use a hardware-backed key).
- Telemetry / phone-home — there is none.

## Operational invariants (reviewer checklist)

When changing anything in the updater path, confirm:

- [ ] `pubkey` in `tauri.conf.json` is non-empty in CI builds (the workflow fails the build if `TAURI_SIGNING_PRIVATE_KEY` is missing — the matching pubkey is what proves we used it).
- [ ] The appcast URL is built from the locally-stored channel value, never from a server-supplied value.
- [ ] No code path bypasses `Update::download_and_install` — that's where signature verification happens.
- [ ] `latest.json` references binaries on the same release tag they were built for (the workflow constructs URLs from the resolved channel + version).
