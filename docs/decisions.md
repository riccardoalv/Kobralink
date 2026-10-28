# Decisions

What was decided, and why. Decisions are made by consensus with the maintainer; "maintainer's rule" marks the ones the
maintainer set explicitly. How things work in detail is in the other guides; this page keeps the choices and the
reasons behind them.

- [Project](#project)
- [Printers](#printers)
- [Filament and Spoolman](#filament-and-spoolman)
- [Settings](#settings)
- [Single-printer workflow](#single-printer-workflow)
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

- **Tests for everything, always** (maintainer's rule, October 2026). Every change, in every layer, ships with tests
  for every case it introduces; nothing is merged with "tests later". The expected coverage per layer is listed in
  [development.md](development.md#tests). After the single-printer workflow landed with partial coverage, the missing
  tests were added before any new feature.

## Printers

- **No firmware change, ever.** Newer Anycubic printers (Kobra X, and likely the Kobra 4) verify signed firmware
  updates, so custom firmware is not possible; Kobralink only uses LAN mode.
- **The printer's real model is shown** (Home Assistant, Moonraker system info), taken from `info/report` and, as a
  fallback, from the stored printer. UI texts do not name a specific model.
- **A printer allows a single MQTT session.** Kobralink owns it while connected; tools that capture messages must stop
  Kobralink first.
- **A file is uploaded to the printer once.** With the "Dialog after upload" setting, an OrcaSlicer upload pushes the
  file to the printer and opens the dialog in the dashboard; confirming the dialog reuses that upload (same name, MD5
  and size as the last one) instead of sending the file again, so the print starts right away. The upload is forgotten
  when the file is deleted from the printer.

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

## Single-printer workflow

Features added for people running one printer first; the multi-printer versions (fleet queue, batch actions) come
later and build on these.

- **Bed-clear confirmation before the next queued job** (maintainer's rule). With auto-start on, the next file waits
  until the user confirms the bed is empty (`queueBedClearConfirm`, on by default); the old 15 s auto-start stays
  available by turning the confirmation off, for printers with an ejector. The hold is dropped as soon as the printer
  starts printing by any other means.
- **Scheduled starts reuse the print dialog.** A scheduled print stores the same options as an immediate one
  (excluded objects, slot mapping, leveling, timelapse, detection). If the printer is busy or offline at the time, the
  file goes to the front of the queue instead of being lost, and a notification says so.
- **Maintenance is per printer and fully user-defined.** A task has up to three intervals (print hours, number of
  prints, days) and is due when any is reached; suggestions are offered but nothing is created by default. Usage is
  computed from the print history since the last completion, so it needs no new counters. A due task notifies once
  until it is completed.
- **Cost per print = filament + energy + machine time.** Filament comes from the spool price (or the default price
  per kg), energy from a global price per kWh × the printer's average power, machine time from an hourly rate. All
  three are global settings, zero by default; the cost is only shown once at least one source is set.
- **Failures keep their evidence.** A cancelled or errored job records the printer error code and message, the last
  camera frame if the stream was running (best effort, no ffmpeg start), and a user-chosen reason from a fixed list
  (spaghetti, adhesion, clog, runout, layer shift, power loss, cancelled on purpose, other) plus a note. Statistics
  count failures by reason and the CSV export carries them.
- **Brazilian Portuguese (`pt-br`) is the seventh locale.** French stays the base locale and the fallback when the
  browser language matches none.

## Releases

- **Images on GHCR** (`ghcr.io/riccardoalv/kobralink`), built by GitHub Actions with the repository token: `latest`
  and `sha-<commit>` on every push to `main`, `X.Y.Z` and `X.Y` on releases. No registry secrets are needed.
- **release-please computes versions and the changelog** from Conventional Commits, starting after upstream 0.3.6.
- **Desktop installers are not published by the fork yet.** The upstream `release.yml` stays untouched for now.

## Open questions

- Whether the fork publishes Electron installers, and how (the upstream `release.yml` also pushes to Docker Hub with
  secrets the fork does not have).
- A Kobra MQTT simulator that replays captured messages, so the whole bridge can be tested in CI without a printer.

