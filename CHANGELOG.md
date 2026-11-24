# Changelog

All notable changes to DEADBOARD are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `npm run smoke`: a headless-Chrome smoke test of the built app (`npm run build` first).
  It proves on the real render path that the bench boots on WebGPU, that lazy chunks are
  *not* fetched at boot, and that LiveBoard Studio loads its chunks and renders when opened.
- **Linting gate**: added Biome (`biome.json`, `npm run lint`) for fast AST-based linting in CI
  (`.github/workflows/ci.yml`) alongside TypeScript checks. Configured with 0 errors and
  a tracked backlog of 137 approved warnings as `warn`, enforcing strict error rules like
  `noGlobalIsFinite` and `noGlobalIsNan`.
- **SPICE nominal branded types**: introduced nominal branded types (`SpiceNode`, `RailName`,
  `MnaIndex`) in `src/spice/types.ts` with brand constructors (`spiceNode()`, `railName()`,
  `isRailName()`, `mnaIndex()`), preventing accidental confusion between arbitrary string labels,
  SPICE net names, and power rail designations across board topology resolution and power tree detection.

### Changed

- **Bundle performance & lazy loading**: extracted KiCad parser (`src/io/kicad.ts`, lazy chunk
  `kicad-*.js` ~20.5 kB) and built-in board preset scenario geometries (`src/boards/presets.ts`, lazy chunk
  `presets-*.js` ~22.1 kB) into dynamic imports loaded strictly on demand via `src/boards/presetsMeta.ts`.
  Main bench bundle `app-*.js` dropped from 481.95 kB to 465.46 kB, reducing initial boot JavaScript by ~42.6 kB.
- **TypeScript hardening**: enabled `noImplicitOverride: true` in `tsconfig.json` and added explicit
  `override` keywords across derived SPICE device classes (`Resistor`, `Capacitor`, `Inductor`, `Diode`,
  `VSource`, `ISource`, `VCVS`, `VCCS`, `Mosfet`, `Bjt`, `Switch`, `BSource`) in `src/spice/devices.ts`.
  Included `scripts/` in `tsconfig.json` so all build, automation, and smoke scripts are statically verified
  during `npm run typecheck`.
- **Gerber export**: replaced the ~174-line inline Gerber generator in `src/ui/app.ts` with
  a dynamically loaded (`src/io/gerber.ts`, lazy chunk ~8.56 kB) industrial RS-274X exporter
  with Excellon drill generation (`.drl`), solder masks, silkscreens, edge cuts, and human-readable
  fabrication specifications (`FABRICATION-SPEC.txt`) packed into a downloadable ZIP archive.
- **Branding & links**: updated repository and site links from `tholtman1-del` to `merx666`
  in `src/ui/logo.ts` (`https://merx666.github.io/deadboard/`), promo showcases, `SECURITY.md`,
  `vite.config.ts`, `docs/SIMULATION_HANDOFF.md`, and starter-kit `mod.json`.
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

### Fixed

- **Biome & lint cleanup**: typed Playwright browser window globals (`window.deadboard`,
  `window.__dir`, `window.__pr`) in `scripts/videos/director.ts` and promo scripts, eliminating
  unsafe `(window as any)` casts, and resolved `noAssignInExpressions` assignments in `src/io/schematic.ts`.
- **Numerical precision & modern JS**: replaced loose global `isFinite` and `isNaN` with strict
  `Number.isFinite` and `Number.isNaN` throughout the SPICE solver (`devices.ts`, `engine.ts`,
  `netlist.ts`, `units.ts`, `board.ts`), board creator, and formatting utilities.
- **Accessibility (a11y)**: added explicit `type="button"` attributes to interactive hero buttons,
  `<pre role="img" aria-label="...">` to ASCII art displays in `index.html`, and `<title>`
  elements to SVG graphics (`public/favicon.svg` and schematic diagrams).
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
