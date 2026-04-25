# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security reports.

Use GitHub's [private vulnerability reporting](https://github.com/victor-teles/oh-my-query/security/advisories/new) so we can triage privately. We aim to acknowledge within 72 hours and ship a fix on the next stable release once a mitigation is verified.

If you cannot use GitHub, email `security@ohmyquery.dev` (PGP key on request).

## Supported versions

We support the latest **stable** release and the latest **beta** release. Older versions are not patched — switch channels in **Settings → Updates** if you are on an older build.

| Channel | Supported | Source of truth                                                                             |
| ------- | --------- | ------------------------------------------------------------------------------------------- |
| Stable  | Yes       | [`updater-stable`](https://github.com/victor-teles/oh-my-query/releases/tag/updater-stable) |
| Beta    | Yes       | [`updater-beta`](https://github.com/victor-teles/oh-my-query/releases/tag/updater-beta)     |
| Nightly | Not yet   | Planned — tracked separately                                                                |

## Update path

The auto-update path is signed end-to-end. See [`docs/threat-model-updates.md`](docs/threat-model-updates.md) for the threat model, the trust anchors, and the key-rotation procedure.
