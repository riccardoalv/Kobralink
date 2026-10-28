# Testing FarolPrint

FarolPrint is young and has run on few printers so far. Thank you for trying it with yours. This page explains how to
try it safely, what to look at, and how to tell us what went wrong.

## What we need most

People with printers or setups we have not seen much yet:

- **Kobra 4** and **Kobra X**, with and without an ACE
- **Kobra 3**, **Kobra S1** and other models with LAN mode
- Setups with **Spoolman**, **Home Assistant** or several printers

## Is it safe?

- FarolPrint **never changes the printer's firmware**. It talks to the printer through its own LAN mode, like the
  Anycubic slicer does.
- LAN mode turns off the Anycubic cloud on the printer while it is on (app and cloud printing).
- A printer accepts **a single MQTT session**: while FarolPrint is connected, no other LAN tool can connect.
- Commands (pause, cancel, temperatures, starting a print) are only sent when you ask for them.

## Setting up

1. On the printer: **Settings → LAN mode** on.
2. Start FarolPrint as in the [README](../README.md#install-in-production-docker-compose).
3. Open `http://<host>:7100`, create the first account and add the printer by its IP.
4. Optional: connect OrcaSlicer (Moonraker host `http://<host>:7125`) and Spoolman (Settings → Integrations).

## What to look at

- **Connection:** does the printer show as online? Does it reconnect after a restart of the printer or of FarolPrint?
- **States:** idle, printing, paused (also filament runout), finished, cancelled from the printer screen. Is each one
  shown right?
- **Printing from OrcaSlicer:** does *Print* upload and start the job? Are progress and time remaining right?
- **Filament:** with an ACE, are the slots right? Without an ACE, does the external spool slot show up? With Spoolman,
  is the right spool charged, and the right amount, also when you change the spool mid-print?
- **Camera, timelapses, AI detection, notifications:** do they work and stay quiet when nothing happens?
- **Settings:** after saving any card and reloading, are the other cards still as you left them?

## Capturing MQTT messages

Printer support work needs the messages the printer sends. A printer accepts one MQTT session, so stop FarolPrint
first, capture for a minute or two (during a print is best), then start it again. The `info/report`, `print/report` and
`multiColorBox/report` payloads matter most.

Anonymize before sharing: remove the MQTT username and password, the device ID (`did`, `deviceId`), the `/info` token,
serial numbers, upload URLs with secrets (`fileUploadurl`, `rtspUrl`) and public IPs.

## Reporting

- Open a [tester report](https://github.com/riccardoalv/farolprint/issues/new?template=tester_report.yml) with what
  worked and what did not.
- One problem per [bug report](https://github.com/riccardoalv/farolprint/issues/new?template=bug_report.yml) for the
  big ones.
- A [printer support](https://github.com/riccardoalv/farolprint/issues/new?template=printer_support.yml) issue for a
  model or accessory that does not work yet.
