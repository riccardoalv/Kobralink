# Contributing to Kobralink

Thanks for helping! The most valuable contributions are **printer support** (models, firmwares, accessories such as
the ACE) and **real printer data** (anonymized MQTT messages). See [Development](docs/development.md) to get started,
[Decisions](docs/decisions.md) for what was decided and why, and [`CLAUDE.md`](CLAUDE.md) for the conventions.

Everything in the project is in **English**: code, docs, commits, issues and PRs.

## Development setup

Requirements: [Bun](https://bun.sh) (version in `package.json` → `packageManager`) and git. Docker is only needed to
build the image.

```bash
bun install          # install dependencies (also installs the git hooks)
bun run dev:web      # API on :7100 + web UI with hot reload
bun run lint         # Biome
bun run format       # Biome formatter
bun run check-types  # TypeScript in every package
bun run test         # bun test in every package
bun run build        # build everything
```

Before pushing, run `bun run lint`, `bun run check-types` and `bun run test`: CI runs the same checks.

## Code style

| Language | Formatter | Linter | Config |
|---|---|---|---|
| TypeScript / React / JSON | Biome (4 spaces, width 120) | Biome | `biome.json` |

- No comments in the code.
- Every visible UI string goes through i18n and is added to all six locales in `packages/i18n/messages/`.
- Every `/api/v1` request body has a Zod schema in `packages/shared`.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org). They drive the changelog and version numbers (via
[release-please](https://github.com/googleapis/release-please)), so please follow them.

```
<type>(<optional scope>): <description>

[optional body]

[optional footer, e.g. BREAKING CHANGE: ..., Closes #12]
```

**Types**

| Type | Use for | Shows in changelog |
|---|---|---|
| `feat` | A new feature | ✅ |
| `fix` | A bug fix | ✅ |
| `perf` | A performance improvement | ✅ |
| `refactor` | Code change that neither fixes a bug nor adds a feature | |
| `docs` | Documentation only | |
| `test` | Adding or fixing tests | |
| `build` | Build system, dependencies, Docker | |
| `ci` | CI configuration | |
| `chore` | Anything else (tooling, housekeeping) | |
| `style` | Formatting only | |
| `revert` | Reverts a previous commit | |

**Scopes** (optional): `api`, `bridge`, `protocol`, `moonraker`, `spoolman`, `filament`, `detection`, `camera`,
`notifications`, `ha`, `settings`, `web`, `desktop`, `shared`, `i18n`, `docker`, `deps`, `docs`.

Add `!` after the type/scope (`feat(protocol)!: ...`) or a `BREAKING CHANGE:` footer for breaking changes.

**Examples**

```
feat(bridge): report the printer's real model
fix(spoolman): split usage when the spool changes mid-print
docs: explain the external spool slot
build(deps): bump mqtt to v5.15.0
```

The `commit-msg` hook checks this locally; CI checks every commit and the PR title.

## Pull requests

1. Fork and create a branch from `main`.
2. Keep PRs focused: one feature or fix per PR.
3. The **PR title** must follow Conventional Commits: PRs are **squash-merged**, so the title becomes the commit on
   `main`.
4. Fill in the PR template; describe how you tested (real printer with model and firmware, captured messages, unit
   tests).
5. CI must be green.

## Printer data and privacy

Never commit credentials, MQTT usernames or passwords, device IDs, the `/info` token, serial numbers or public IP
addresses. Anonymize captured MQTT messages before adding them to tests or attaching them to issues.
