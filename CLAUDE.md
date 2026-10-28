# CLAUDE.md

Guide for agents (and humans) working on Kobralink: a bridge that makes Anycubic Kobra printers in LAN mode
(Kobra X, Kobra 4) look like Moonraker printers, with a web dashboard, OrcaSlicer support, Spoolman, camera,
AI failure detection, notifications and Home Assistant discovery.

This is the community fork of [NatHacks/Kobralink](https://github.com/NatHacks/Kobralink). Read the
[README](README.md) for the product, [docs/decisions.md](docs/decisions.md) for what was decided and why, and
[docs/development.md](docs/development.md) for how to work on it.

## How we work

- **Decisions are made by consensus with the maintainer.** Raise questions and trade-offs instead of deciding alone;
  record what was agreed in [docs/decisions.md](docs/decisions.md) (and the README when users see it).
- **Every change ships with tests** that run in CI; run `bun run lint`, `bun run check-types` and `bun run test`
  before saying something is done.
- **Never commit or push** unless the maintainer asks.
- **Docs follow the code**: a change that users or contributors notice updates the guide in `docs/` it touches.
- **Everything is in English**: code, docs, commits, issues and PRs. UI strings go through i18n (seven locales).
- **Commits and PR titles follow Conventional Commits** ([CONTRIBUTING.md](CONTRIBUTING.md)); PRs are squash-merged.

## Principles

1. **No firmware change.** Kobralink only speaks the printer's own LAN protocol; it never modifies the printer.
2. **Printers without an ACE are first-class.** The external spool is a slot like any other for filament tracking.
3. **Never invent printer data.** Unknown fields stay empty; behavior is derived from what the printer reports.
4. **One printer failing never breaks the rest.** Each printer has its own bridge, MQTT session and Moonraker port.
5. **Small first.** When in doubt, leave it out and put it on the roadmap.

## Layout (Turborepo + Bun workspaces)

- `apps/api`: NestJS 11 (CJS, `module: NodeNext`), Prisma 7 + `@prisma/adapter-libsql` (works under Bun and Node:
  Electron runs `dist/main.js` under Node, dev and Docker run `bun src/main.ts`), Better Auth via
  `@thallesp/nestjs-better-auth`. Do not use `Bun.*` APIs in the API. The Prisma client is generated in
  `src/generated/prisma` (gitignored, `prisma generate` before `tsc`). Migrations are applied at boot by
  `src/prisma/migrator.ts`. `bun run --filter @kobralink/api bundle` produces `apps/api/bundle` (esbuild →
  `dist/server/main.js`, with `@libsql/client`/`express`/`qs` external and installed in `bundle/node_modules`, certs
  and migrations copied) for Electron.
- `apps/web`: Vite + React 19, file-based TanStack Router (`src/routes`, `routeTree.gen.ts` gitignored), TanStack
  Query, TanStack Store (`src/stores`), Tailwind v4, shadcn (`src/components/ui`, excluded from Biome). Dark theme only
  (`class="dark"` on `<html>` in `index.html`, no toggle). Primary = emerald, radius 1.5rem, Outfit font. Design: icon
  rail on the left, very rounded cards, the print card is accented while printing.
  `bun run --filter @kobralink/web generate` = `tsr generate` + Paraglide compile (`src/paraglide`, gitignored); run
  by `check-types`.
- `apps/desktop`: electron-vite. In dev it starts `apps/api/dist/main.js`; packaged (`dist:mac`) it embeds
  `apps/api/bundle` → `Resources/api` and `apps/web/dist` → `Resources/web` via `extraResources`. Local mode only (no
  remote bridge). The `electron` version is pinned (electron-builder requires it).
  `KOBRALINK_SHOT=/x.png [KOBRALINK_SHOT_LOGIN="mail|pwd|/path"] [KOBRALINK_URL=http://…]` captures the window and
  quits (smoke test); `KOBRALINK_URL` forces the bridge URL without spawning it.
- `packages/shared`: Zod schemas and types shared by the API and the web (`control.ts`, `state.ts`, `macros.ts`,
  `sse.ts`…). Every `/api/v1` body has its schema here, validated in the API by `ZodPipe` and typed in the web in
  `src/lib/api.ts`.
- `packages/kobra-protocol`: Kobra MQTT client (`mqtt-client.ts`), payload types, G-code parsing, upload.
- `packages/i18n`: inlang/Paraglide project, `messages/{fr,en,de,es,it,zh-cn,pt-br}.json` (base `fr`). The locale list is
  duplicated in `APP_LOCALES` (`packages/shared/src/settings.ts`); adding a language = the `/add-locale` skill. The
  package compiles its own runtime and messages for the API; the web recompiles the same messages in
  `apps/web/src/paraglide`.
- The three packages build with tsdown, ESM + CJS output. Packages must be built before `dev`/`check-types`/`test` of
  the apps (turbo `^build`).
- `infra/`: `Dockerfile` (+ `Dockerfile.dockerignore`), `docker-compose.yml`, `docker-compose.prod.yml`,
  `.env.example`. No Dockerfile at the root.
- `.github/workflows`: `ci.yml` (lint, types, tests, web build, Docker build), `commits.yml` (Conventional Commits),
  `docker-image.yml` (image to GHCR on every push to `main`), `release-please.yml` (release PR, tag, versioned image)
  and the upstream `release.yml` (Docker Hub + Electron builds on `v*` tags pushed by hand).

## Architecture

- One `PrinterBridge` (`apps/api/src/bridge/printer-bridge.ts`) per printer: MQTT session, live state (`LiveState` from
  `@kobralink/shared`), poll loop, commands. `BridgeRegistry` creates them from the `printer` table.
- Each printer has **its own Nest application** for Moonraker on `httpPort` (`moonraker.host.ts` →
  `MoonrakerAppModule.forPrinter`). No auth on it, on purpose. `moonraker.service.ts` maps `LiveState` to Klipper
  objects (`gcode_move.speed_factor` = mapping 1→0.5/2→1.0/3→1.3/4→1.5, `motion_report.live_velocity` always 0).
  `execGcodeScript` only interprets a small subset (PAUSE/RESUME/CANCEL, M104/M140, SET_HEATER_TEMPERATURE, a
  Kobralink macro name); everything else returns `ok` with no effect.
- The main API (:7100): `/api/auth/*` (Better Auth), `/api/v1/*` (protected), serves `apps/web/dist`. One Nest module
  per domain (`printers`, `core` = control, `filament`/`spools`/`spoolman`, `queue`, `macros`, `timelapse`,
  `detection`, `notifications`, `ha` = Home Assistant MQTT discovery, `stats`, `system`, `users`, `settings`,
  `schedule` = scheduled prints, `maintenance` = preventive maintenance tasks).
- Live UI state: SSE `/api/v1/printers/:id/events` → `usePrinterEvents` writes into the Query cache; `patchLiveState`
  does the local optimistic update before the MQTT confirmation.
- Print queue (`queue/queue.service.ts`): with `queueAutoStart`, the next file starts 15 s after a print finishes
  unless `queueBedClearConfirm` (default on) holds it until `POST queue/bed-clear`; `GET queue/status` exposes the
  hold. Scheduled prints (`schedule/`) fire a stored file at `startAt` and fall back to the front of the queue when
  the printer is busy. Maintenance tasks (`maintenance/`) are due by print hours, jobs or days since the last
  completion and notify once (`maintenance_due`).
- Costs: `stats/job-cost.ts` prices a job from the spool (or default) filament price plus `settings.costs` (energy
  per kWh × printer power, hourly machine rate). `GET /api/v1/stats/export.csv` exports one row per job. A cancelled
  or errored job keeps the printer error code, the last camera frame (`dataDir/failures/<jobId>.jpg`) and a user
  label (`failureReason`, `note`) editable with `PATCH history/:jobId`.
- Macros are lists of JSON actions (`macroActionSchema` in `packages/shared/src/macros.ts`), not G-code; run by
  `macro.service.ts` through the `PrinterBridge` methods.
- Camera: `bridge/camera.ts` (`CameraCache`) = one ffmpeg per printer (FLV → MJPEG 15 fps/640px), fanned out to
  `/api/v1/printers/:id/camera/{stream,snapshot}` (dashboard) and `/api/camera/{stream,snapshot}` (Moonraker,
  announced by `server/webcams/list`). Binary from `KOBRALINK_FFMPEG`, else `@ffmpeg-installer/ffmpeg` (external in the
  Electron bundle), else `ffmpeg` from the PATH. Stops after 60 s without consumers.
- AI failure detection: `apps/api/src/detection/` (Obico YOLOv2 ONNX model, ~200 MB, downloaded on demand to
  `dataDir/models/failure-detection.onnx`, `onnxruntime-node` inference on CPU, `jpeg-js` decoding, Obico's EWM
  algorithm in `prediction.ts`). Global opt-in (`settings.failureDetection`) + a switch per printer; one frame every
  `intervalSec` while printing, `alert_print_failure` event, `notify|pause|cancel` action. `onnxruntime-node` is
  external in the Electron bundle (binaries of other platforms removed).
- Filament without an ACE: when `multiColorBox` reports no box, `LiveState.externalSpoolOnly` is set, usage from
  `print/report` (`supplies_usage`) is attributed to slot 0, and the filament card shows an external spool slot.
  Changing the mapped spool reports pending usage to the previous spool first.
- i18n: UI in fr, en, de, es, it, zh-cn, pt-br. Every visible string goes through `m.xxx()` (Paraglide). Web:
  `import { m } from '@/lib/i18n'` (locale kept in localStorage, dayjs in sync); API: `import { m } from
  '../i18n/locale'` (locale per request through `AsyncLocalStorage`, read from `Accept-Language`, fallback `en`).
  Adding a key = adding it to **every** `messages/*.json`.

## Commands

`bun run dev` · `bun run dev:web` (API + web only) · `bun run dev:desktop` · `bun run build` · `bun run check-types`
· `bun run test` · `bun run lint` (biome check) · `bun run format` · `bun run db:migrate` (prisma migrate dev)
· `bun run db:generate` · `bun run db:studio` · `bun run version:set <x.y.z|major|minor|patch>` (bumps every
package.json; releases do it through release-please).

Tests use `bun test`: `packages/shared/test`, `packages/kobra-protocol/test` and `apps/api/test`. One file:
`cd apps/api && bun test test/spool-usage.test.ts` (or `bun test -t "test name"`). Husky hooks: pre-commit runs
`biome check --write` on staged files (4 spaces, width 120), commit-msg checks Conventional Commits, pre-push runs lint
and type-check.

No pnpm/npm: the lockfile is `bun.lock`, workspace scripts run through `bun run --filter <pkg> <script>`. Every
package.json script calls `bun`/`bunx` explicitly (Vite runs under `bunx --bun vite`).

## Rules that are easy to break

- **No comments in the code** (explicit request of the original author, kept in this fork).
- The certificates in `apps/api/certs/*` (Anycubic Slicer client certificate) are third-party material: do not modify
  them. They ship as is in the repo, the Docker image and the Electron bundle so users have nothing to provide; they
  cannot be generated (the printer's MQTT broker checks this exact certificate).
- **Never put real printer data in fixtures**: MQTT username/password, device ID, `/info` token, serial numbers and
  public IPs are anonymized first.
- **A printer allows a single MQTT session.** A second client (a test script, another bridge) is refused while
  Kobralink is connected.
