# Development

How to work on Farol Print: setup, commands, tests, CI, commits and releases. The conventions are in
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
`bun run --filter @farolprint/web build`.

## Running it

`bun run dev:web` starts the API and the web UI. Open the URL Vite prints, create the first account and add a printer
by IP. Data goes to `FAROLPRINT_DATA_DIR` (default `data/`).

A printer accepts **a single MQTT session**: stop any other Farol Print connected to it (a server, the desktop app)
before connecting a development build to the same printer.

## Tests

Every change ships with tests that run in CI. This is a rule of the project, not a goal: a feature, a fix or a
refactor without tests for every case it introduces is not finished, whatever the layer. What "every case" means:

- **Shared schemas**: defaults, accepted and rejected inputs, every helper function.
- **API services**: every public method, with the success path, the error path and the edge cases (offline printer,
  printer busy, empty data, broken stored payloads). Prisma, the bridge and the network are replaced by small fakes.
- **API controllers**: every route, through a Nest testing module or by calling the controller with fakes.
- **Bridge**: every state transition and every event emitted, fed with anonymized MQTT payloads.
- **Migrations**: applied to a fresh SQLite database, checking the tables and columns they add.
- **i18n**: every locale has every key with the same placeholders as the base locale.
- **Web components**: every visible state (loading, empty, data, error, disabled) and every user action, with the API
  mocked. Route pages are tested through their components.

Tests are written in the same change as the code, never in a follow-up.

| Suite | Where | Run |
|---|---|---|
| Shared schemas | `packages/shared/test` | `cd packages/shared && bun test` |
| Protocol | `packages/kobra-protocol/test` | `cd packages/kobra-protocol && bun test` |
| Locale parity | `packages/i18n/test` | `cd packages/i18n && bun test` |
| API and bridge | `apps/api/test` | `cd apps/api && bun test` |
| Web UI | `apps/web/src/**/*.test.{ts,tsx}` (Vitest + Testing Library, happy-dom) | `cd apps/web && bun run test` |

- API service tests run against a real SQLite database: `test/helpers/db.ts` creates a temporary file, applies every
  migration with the same migrator as production and seeds printers, files and jobs. `apps/api/bunfig.toml` preloads
  `test/helpers/preload.ts`, which points `FAROLPRINT_DATA_DIR` at a temporary directory. Controllers are tested by
  calling them with fake services; `installI18n()` must be called in tests that check translated texts.
- Bridge tests build a `PrinterBridge` and feed it MQTT payloads (`info/report`, `print/report`,
  `multiColorBox/report`) shaped like the ones a real printer sends; the network, the database and Spoolman are replaced
  by small fakes. See `apps/api/test/spool-usage.test.ts`.
- Payloads in tests come from real printers and are **anonymized**: no MQTT credentials, device IDs, tokens, serial
  numbers or public IPs.
- Web tests render components with Testing Library in happy-dom; the locale is set to English in `src/test/setup.ts`.

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
| `docker-image.yml` | on `main`: builds and pushes `ghcr.io/riccardoalv/farolprint:latest` and `sha-<commit>` |
| `release-please.yml` | keeps the release PR up to date; on release, pushes the versioned image |

## Commits and releases

Commits and PR titles follow [Conventional Commits](https://www.conventionalcommits.org). PRs are squash-merged, so
the PR title becomes the commit on `main`. Types and scopes are listed in [CONTRIBUTING.md](../CONTRIBUTING.md).

Releases are made by [release-please](https://github.com/googleapis/release-please):

1. Every push to `main` updates a release PR with the next version and the changelog, from the commits since the last
   release (`feat` → minor, `fix` → patch; before 1.0.0, a breaking change bumps the minor).
2. The release PR bumps the version of every `package.json` and updates `CHANGELOG.md`.
3. Merging it tags the release (`vX.Y.Z`) and creates the GitHub release.
4. The same workflow builds the Docker image for amd64 and arm64 and pushes it to `ghcr.io/riccardoalv/farolprint`
   with the tags `X.Y.Z`, `X.Y` and `latest`.

The upstream `release.yml` (Docker Hub image and Electron installers) only runs on `v*` tags pushed by hand and needs
Docker Hub secrets this fork does not have; see [Decisions](decisions.md#releases).
