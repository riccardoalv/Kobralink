# Decisions

What was decided, and why. Decisions are made by consensus with the maintainer; "maintainer's rule" marks the ones the
maintainer set explicitly. How things work in detail is in the other guides; this page keeps the choices and the
reasons behind them.

- [Project](#project)
- [Printers](#printers)
- [Filament and Spoolman](#filament-and-spoolman)
- [Settings](#settings)
- [Releases](#releases)
- [Open questions](#open-questions)

## Project

- **Community fork** (maintainer's rule). The original project
  ([NatHacks/Kobralink](https://github.com/NatHacks/Kobralink)) stopped receiving commits after September 2026 and
  pull requests went unanswered. This fork continues it in the open; the original author is credited in the README, and
  fixes that also apply upstream are offered there as pull requests.
- **License stays GPL-3.0**, as the original.
- **Same conventions as the original** where they exist (no comments in the code, Biome, Bun, six locales), plus the
  practices of the maintainer's other project: Conventional Commits, squash-merged PRs, release-please, tests with every
  change, docs that follow the code.
- **Everything in English**: code, docs, commits, issues and PRs.

## Printers

- **No firmware change, ever.** Newer Anycubic printers (Kobra X, and likely the Kobra 4) verify signed firmware
  updates, so custom firmware is not possible; Kobralink only uses LAN mode.
- **The printer's real model is shown** (Home Assistant, Moonraker system info), taken from `info/report` and, as a
  fallback, from the stored printer. UI texts do not name a specific model.
- **A printer allows a single MQTT session.** Kobralink owns it while connected; tools that capture messages must stop
  Kobralink first.

## Filament and Spoolman

- **Printers without an ACE are first-class.** When `multiColorBox` reports no box, the printer is
  external-spool-only: the filament card shows an external spool slot (slot 0), and usage reported in `print/report`
  (`supplies_usage`) is attributed to it while printing, so the "sync while printing" setting works without an ACE.
- **The external spool form sends nothing to the printer.** Unlike the ACE slot form (type, color, feed), it only links
  a Spoolman spool and/or a local spool to slot 0.
- **Changing the spool mid-print splits the usage.** Pending usage is reported to the previous spool before the
  counters reset, and the new spool is only charged from that point on. Without this, a filament runout charged the
  whole print to one spool.
- **No automatic spool switch.** Without an ACE or RFID the printer cannot tell which roll is loaded, so the user picks
  the spool when changing rolls.

## Settings

- **A settings save only writes the keys it sends.** Each settings card saves its own section; the update schema has
  no defaults, so saving one card no longer resets the others (upstream issue #2).

## Releases

- **Images on GHCR** (`ghcr.io/riccardoalv/kobralink`), built by GitHub Actions with the repository token: `latest`
  and `sha-<commit>` on every push to `main`, `X.Y.Z` and `X.Y` on releases. No registry secrets are needed.
- **release-please computes versions and the changelog** from Conventional Commits, starting after upstream 0.3.6.
- **Desktop installers are not published by the fork yet.** The upstream `release.yml` stays untouched for now.

## Open questions

- Whether the fork publishes Electron installers, and how (the upstream `release.yml` also pushes to Docker Hub with
  secrets the fork does not have).
- A Kobra MQTT simulator that replays captured messages, so the whole bridge can be tested in CI without a printer.
- Automated tests for the web UI.
