# Changelog

All notable changes to DEADBOARD are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Tests**: `npm test` now runs the whole suite through Node's built-in test runner
  (`node --test`) instead of 30 chained `tsx` processes — tests run in parallel, each file
  in an isolated child process, with summary reporting and easy single-suite filtering.
  Added `npm run test:watch` for development.
- **Performance**: the bench app's initial JavaScript payload drops from ~703 kB to ~558 kB
  (−20%; gzip 223 kB → 184 kB) by lazy-loading the heavyweight modules on first use:
  LiveBoard Studio (`boardCreator`), the supplier parts catalog, and the KiCad/BRD importers.
- **CI**: a new pull-request workflow runs typecheck + tests + build on every PR (and every
  non-main branch push) before anything can land on `main`; the GitHub Pages deploy then
  only re-runs the same checks for main itself.

### Added

- `npm run smoke`: a headless-Chrome smoke test of the built app (`npm run build` first).
  It proves on the real render path that the bench boots on WebGPU, that lazy chunks are
  *not* fetched at boot, and that LiveBoard Studio loads its chunks and renders when opened.

### Fixed

- LiveBoard Studio: a stray `}` in the LED footprint SVG (`y="-0.6}"` on the cathode pad
  rect) produced `<rect> attribute y: Expected length` console errors in Chrome.

## [0.1.0] — 2026-11-16

Initial public release: a board-level repair trainer that puts broken boards on a virtual
bench — DMM with continuity buzzer, bench supply with OCP and voltage injection, oscilloscope,
thermal camera, rework station (iron, hot-air, wick, scalpel, kynar) — with the circuit
answered by a real SPICE/MNA solver in a WebWorker, importable KiCad/BRD/pcbfix boards,
open-hardware demo boards (MNT Reform 2, Antmicro Jetson Nano), cryptographic challenge
flags, repair protocol reports, and full Polish/English i18n (desktop + touch).

[Unreleased]: https://github.com/merx666/deadboard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/merx666/deadboard/releases/tag/v0.1.0
