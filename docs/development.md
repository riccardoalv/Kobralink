# Development

How to work on Kobralink: setup, commands, tests, CI, commits and releases. The conventions are in
[CONTRIBUTING.md](../CONTRIBUTING.md) and [CLAUDE.md](../CLAUDE.md).

## Requirements

- [Bun](https://bun.sh), the version in `package.json` → `packageManager`
- git
- Docker, only to build the image
- An Anycubic Kobra printer in LAN mode, only to test against real hardware

`bun install` also installs the husky git hooks (`prepare` script).

## Commands

| Command | What it does |
|---|---|
| `bun run dev:web` | API on `:7100` + web UI with hot reload |
| `bun run dev` | Everything, desktop app included |
| `bun run build` | Build every package and app |
| `bun run lint` | Biome check |
| `bun run format` | Biome formatter |
| `bun run check-types` | TypeScript in every package (also generates routes and i18n) |
| `bun run test` | `bun test` in every package |
| `bun run db:migrate` | New Prisma migration (`prisma migrate dev`) |

Scripts of one workspace run with `bun run --filter <package> <script>`, for example
`bun run --filter @kobralink/web build`.

## Running it

`bun run dev:web` starts the API and the web UI. Open the URL Vite prints, create the first account and add a printer
by IP. Data goes to `KOBRALINK_DATA_DIR` (default `data/`).

A printer accepts **a single MQTT session**: stop any other Kobralink connected to it (a server, the desktop app)
before connecting a development build to the same printer.

## Tests

Every change ships with tests that run in CI.

| Suite | Where | Run |
|---|---|---|
| Shared schemas | `packages/shared/test` | `cd packages/shared && bun test` |
| Protocol | `packages/kobra-protocol/test` | `cd packages/kobra-protocol && bun test` |
| API and bridge | `apps/api/test` | `cd apps/api && bun test` |

- Bridge tests build a `PrinterBridge` and feed it MQTT payloads (`info/report`, `print/report`,
  `multiColorBox/report`) shaped like the ones a real printer sends; the network, the database and Spoolman are replaced
  by small fakes. See `apps/api/test/spool-usage.test.ts`.
- Payloads in tests come from real printers and are **anonymized**: no MQTT credentials, device IDs, tokens, serial
  numbers or public IPs.
- The web UI has no automated tests yet; `bun run check-types` and the web build cover it in CI.

## Style and hooks

| Language | Formatter | Linter |
|---|---|---|
| TypeScript / React / JSON | Biome | Biome |

Husky hooks:

| Hook | Runs |
|---|---|
| `pre-commit` | `biome check --write` on staged files |
| `commit-msg` | `scripts/check-commit-msg.sh` (Conventional Commits) |
| `pre-push` | `bun run lint` and `bun run check-types` |

## CI

GitHub Actions run on every push to `main` and on every pull request:

| Workflow | Checks |
|---|---|
| `ci.yml` | lint, type-check, tests with a coverage summary, web build, Docker image build |
| `commits.yml` | every commit message and the PR title follow Conventional Commits |
| `docker-image.yml` | on `main`: builds and pushes `ghcr.io/riccardoalv/kobralink:latest` and `sha-<commit>` |
| `release-please.yml` | keeps the release PR up to date; on release, pushes the versioned image |

## Commits and releases

Commits and PR titles follow [Conventional Commits](https://www.conventionalcommits.org). PRs are squash-merged, so
the PR title becomes the commit on `main`. Types and scopes are listed in [CONTRIBUTING.md](../CONTRIBUTING.md).

Releases are made by [release-please](https://github.com/googleapis/release-please):

1. Every push to `main` updates a release PR with the next version and the changelog, from the commits since the last
   release (`feat` → minor, `fix` → patch; before 1.0.0, a breaking change bumps the minor).
2. The release PR bumps the version of every `package.json` and updates `CHANGELOG.md`.
3. Merging it tags the release (`vX.Y.Z`) and creates the GitHub release.
4. The same workflow builds the Docker image for amd64 and arm64 and pushes it to `ghcr.io/riccardoalv/kobralink`
   with the tags `X.Y.Z`, `X.Y` and `latest`.

The upstream `release.yml` (Docker Hub image and Electron installers) only runs on `v*` tags pushed by hand and needs
Docker Hub secrets this fork does not have; see [Decisions](decisions.md#releases).
