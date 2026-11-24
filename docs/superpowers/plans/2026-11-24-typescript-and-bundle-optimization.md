# TypeScript Hardening, Bundle Performance & Code Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate Vite bundle code-splitting leaks, lazy-load board presets, harden the TypeScript compiler configuration across all repository folders, introduce nominal branded types to the SPICE circuit boundary, and remediate high-noise Biome warnings.

**Architecture:** Convert static KiCad imports in `src/mods/mods.ts` to dynamic module resolution and separate preset metadata into `src/boards/presetsMeta.ts` to shrink critical-path JS payload by ~40 kB. Enforce `"noImplicitOverride": true` and expand `tsconfig.json` to cover `scripts/`. Define nominal `Brand<K, T>` types (`SpiceNode`, `RailName`, `MnaIndex`) at the PCB topology boundary and clean up Playwright window mock typing.

**Tech Stack:** TypeScript 5.9, Vite 5.4, Biome 2.6, WebGPU, Node.js 26.

**Spec:** [docs/superpowers/specs/2026-11-24-typescript-and-bundle-optimization-design.md](file:///Users/merx/rea/breadboard/docs/superpowers/specs/2026-11-24-typescript-and-bundle-optimization-design.md)

## Global Constraints

- Zero new runtime npm dependencies.
- Retain exact behavior of all CLI tools (`npm run spice`, `npm run schematic`, `npm run example-mod`, `npm run smoke`).
- Preserve the starter-kit mod byte-for-byte invariant (`public/examples/starter-kit.zip` matches `examples/mods/starter-kit/`).
- Must pass `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run smoke` on Node 26 + Vite 5.
- Simulation physics and MNA mathematical routines remain untouched.

## Review Focus

1. **Lazy KiCad Loading Failure:** An imported mod containing a `.kicad_pcb` or `.brd` board fails to load dynamically if dynamic import path resolution fails in `mods.ts`.
2. **Missing Preset Scenario Topology:** Clicking a preset stub in `src/ui/app.ts` does not instantiate the scenario geometry or renders an empty canvas.
3. **Mod Starter Kit Checksum Drift:** Rebuilding example mods causes salt drift if not verified with `test/mods.test.ts`.
4. **Scripts Typecheck Breakage:** Including `scripts/` in `tsconfig.json` triggers compile errors in non-standard node environments.
5. **SPICE Ground Sentinel Confusion:** Introducing `MnaIndex` or `SpiceNode` breaks string compatibility or matrix stamps expecting `-1` for ground.

---

### Task 1: Decouple KiCad Importer from `src/mods/mods.ts`

**Files:**
- Modify: `src/mods/mods.ts:8,185-195`
- Test: `test/mods.test.ts`

**Interfaces:**
- Consumes: `src/io/kicad.ts` (`importScenarioOrPcb`)
- Produces: Dynamic module resolution inside `loadModBoard()`, zero static import of `../io/kicad` in `mods.ts`.

- [ ] **Step 1: Write verification test for dynamic import isolation**
Ensure that `test/mods.test.ts` exercises `loadModBoard` with `.kicad_pcb` or `.brd` if present, and that `mods.ts` has no top-level static import of `../io/kicad`.

- [ ] **Step 2: Remove top-level static import in `src/mods/mods.ts`**
Remove `import { importScenarioOrPcb } from '../io/kicad';` from line 8.

- [ ] **Step 3: Add dynamic import inside `loadModBoard()` in `src/mods/mods.ts`**
Replace synchronous call `const sc = importScenarioOrPcb(...)` with:
```typescript
const { importScenarioOrPcb } = await import('../io/kicad');
const sc = importScenarioOrPcb(spec.file.split('/').pop()!, bytes);
```

- [ ] **Step 4: Run unit tests and verify build output**
Run: `npx tsx test/mods.test.ts && npm run build`
Expected: `MODS TESTS PASSED`, and Vite build output no longer displays the warning: `(!) /Users/merx/rea/breadboard/src/io/kicad.ts is dynamically imported... but also statically imported`.

- [ ] **Step 5: Commit**
```bash
git add src/mods/mods.ts
git commit -m "perf(mods): lazy-load KiCad importer on demand"
```

---

### Task 2: Implement Lazy Preset Scenario Stubs

**Files:**
- Create: `src/boards/presetsMeta.ts`
- Modify: `src/ui/app.ts:38,285-295`
- Test: `scripts/smoke/bench.ts`

**Interfaces:**
- Consumes: `src/boards/presets.ts`
- Produces: `BOARD_PRESET_METAS` in `presetsMeta.ts`, lazy scenario loader in `app.ts`.

- [ ] **Step 1: Create `src/boards/presetsMeta.ts`**
Define lightweight metadata for the 4 built-in preset boards (ESP32, Pico, Uno, Zero) containing `id`, `name`, `desc`, `tags`, and an async `load()` method returning the scenario:
```typescript
export interface BoardPresetMeta {
  id: string;
  name: string;
  desc: string;
  tags?: string[];
  load: () => Promise<import('../types/scenario').Scenario>;
}

export const BOARD_PRESET_METAS: BoardPresetMeta[] = [
  {
    id: 'esp32-wroom-32',
    name: 'ESP32-WROOM-32 DevKit',
    desc: 'Wi-Fi/BT SoC with 3.3V LDO regulator, USB-UART, and GPIO header.',
    tags: ['Microcontroller', 'Wi-Fi', 'LDO'],
    load: async () => (await import('./presets')).createEsp32DevScenario(),
  },
  {
    id: 'rp2040-pico',
    name: 'Raspberry Pi Pico',
    desc: 'Dual ARM Cortex-M0+ with RT6150 buck-boost regulator and USB.',
    tags: ['Microcontroller', 'Buck-Boost', 'RP2040'],
    load: async () => (await import('./presets')).createRaspberryPiPicoScenario(),
  },
  {
    id: 'arduino-uno-r3',
    name: 'Arduino Uno R3',
    desc: 'ATmega328P with LP2985 3.3V and NCP1117 5V linear regulators.',
    tags: ['Microcontroller', 'Classic', '5V/3.3V'],
    load: async () => (await import('./presets')).createArduinoUnoScenario(),
  },
  {
    id: 'rpi-zero-w',
    name: 'Raspberry Pi Zero W',
    desc: 'Broadcom BCM2835 with PAM2306 dual step-down DC-DC converter.',
    tags: ['SBC', 'Dual Buck', 'Linux'],
    load: async () => (await import('./presets')).createRaspberryPiZeroScenario(),
  },
];
```

- [ ] **Step 2: Update `src/ui/app.ts` to register preset stubs**
Replace eager `for (const p of BOARD_PRESETS) this.scenarios.push(p.create())` with registration of lightweight scenario stubs backed by `BOARD_PRESET_METAS`. When a stub scenario is opened in `loadScenario()`, trigger `meta.load()` to populate full geometry and components if not already instantiated.

- [ ] **Step 3: Run build and verify bundle separation**
Run: `npm run build && npm run smoke`
Expected: `dist/assets/presets-*.js` is isolated as a dynamic chunk (~22 kB), and headless Chrome smoke test passes cleanly.

- [ ] **Step 4: Commit**
```bash
git add src/boards/presetsMeta.ts src/ui/app.ts
git commit -m "perf(app): lazy-load board preset scenario geometries"
```

---

### Task 3: TypeScript Compiler Hardening & `noImplicitOverride`

**Files:**
- Modify: `tsconfig.json`
- Modify: `src/spice/devices.ts`
- Test: `npm run typecheck`

**Interfaces:**
- Consumes: TS 5.6+ compiler flags
- Produces: Uniform typecheck across `src`, `test`, `scripts` with enforced subclass `override` annotations.

- [ ] **Step 1: Add `override` to the 21 derived methods in `src/spice/devices.ts`**
Add the `override` keyword to:
- `Resistor.report()`
- `Capacitor.report()`, `initTran()`, `accept()`, `breakpoints()`
- `Inductor.report()`, `initTran()`, `accept()`, `breakpoints()`
- `Diode.report()`
- `Vdc.report()`
- `Idc.report()`
- `Bjt.report()`
- `Mosfet.report()`
- `OpAmp.report()`
- `Subcircuit.report()`

- [ ] **Step 2: Update `tsconfig.json`**
Add `"noImplicitOverride": true` to `compilerOptions` and expand `"include"` to `["src", "test", "scripts"]`.

- [ ] **Step 3: Verify with `tsc --noEmit`**
Run: `npm run typecheck`
Expected: 0 errors across all files in `src`, `test`, and `scripts`.

- [ ] **Step 4: Commit**
```bash
git add tsconfig.json src/spice/devices.ts
git commit -m "build(ts): include scripts in typecheck and enforce noImplicitOverride"
```

---

### Task 4: SPICE Nominal Branded Types (`SpiceNode`, `RailName`, `MnaIndex`)

**Files:**
- Modify: `src/spice/types.ts`
- Modify: `src/spice/board.ts`
- Modify: `src/spice/powertree.ts`
- Test: `test/spice.test.ts`, `test/powertree.test.ts`

**Interfaces:**
- Consumes: `src/types/units.ts` (`Brand<K, T>`)
- Produces: `SpiceNode`, `SPICE_GND`, `RailName`, `MnaIndex`, and conversion helpers `spiceNode()`, `railName()`, `mnaIndex()`.

- [ ] **Step 1: Write type unit test in `test/spice.test.ts`**
Verify nominal branding semantics: `SpiceNode` and `RailName` cannot be assigned to each other without conversion, and `SPICE_GND === '0'`.

- [ ] **Step 2: Add branded type definitions to `src/spice/types.ts`**
```typescript
import type { Brand } from '../types/units';

export type SpiceNode = Brand<string, 'SpiceNode'>;
export const SPICE_GND = '0' as SpiceNode;
export const spiceNode = (name: string): SpiceNode => name as SpiceNode;

export type RailName = Brand<string, 'RailName'>;
export const railName = (name: string): RailName => name as RailName;
export const isRailName = (name: string): name is RailName => name.length > 0 && name !== '0';

export type MnaIndex = Brand<number, 'MnaIndex'>;
export const mnaIndex = (idx: number): MnaIndex => idx as MnaIndex;
```

- [ ] **Step 3: Apply `SpiceNode` to `src/spice/board.ts` and `RailName` to `src/spice/powertree.ts`**
Use `SpiceNode` in return types of `padNode()`, `roleNode()`, and board-to-circuit node generation. Use `RailName` in `PowerRail` definition and `discoverPowerTree`.

- [ ] **Step 4: Run typecheck and tests**
Run: `npm run typecheck && npm test`
Expected: 0 type errors, all 30 tests pass.

- [ ] **Step 5: Commit**
```bash
git add src/spice/types.ts src/spice/board.ts src/spice/powertree.ts test/spice.test.ts
git commit -m "feat(spice): introduce nominal branded types for nodes and power rails"
```

---

### Task 5: Biome Warning Remediation & Ambient Window Typing

**Files:**
- Modify: `scripts/videos/director.ts`
- Modify: `scripts/promo/showcase.ts`
- Modify: `scripts/promo/stage.ts`
- Modify: `src/io/schematic.ts`
- Test: `npm run lint`

**Interfaces:**
- Consumes: Playwright browser environment
- Produces: Clean ambient typing for `window.deadboard`, `window.__dir`, `window.__pr` and clean loop assignments.

- [ ] **Step 1: Add ambient `declare global` interface in `scripts/videos/director.ts`**
Define typed signatures for `window.deadboard` so `(window as any)` is eliminated across Playwright automation scripts.

- [ ] **Step 2: Convert `while ((m = re.exec(str)))` assignments in `src/io/schematic.ts`**
Refactor assignments inside conditions into explicit hoisted statements or `str.matchAll(re)` to clear `lint/suspicious/noAssignInExpressions`.

- [ ] **Step 3: Run Biome lint**
Run: `npm run lint`
Expected: 0 errors, warning count reduced below 80.

- [ ] **Step 4: Commit**
```bash
git add scripts/videos/director.ts scripts/promo/showcase.ts scripts/promo/stage.ts src/io/schematic.ts
git commit -m "refactor(lint): type Playwright window globals and clear assignment in expressions"
```

---

### Task 6: Full Verification Gate & Performance Measurement

**Files:**
- Verify: Full codebase
- Output: Verification report

- [ ] **Step 1: Run comprehensive verification loop**
Run: `npm run typecheck && npm run lint && npm test && npm run build && npm run smoke && npm run example-mod && npx tsx test/mods.test.ts`
Expected: All suites exit 0.

- [ ] **Step 2: Inspect bundle sizes in `dist/assets/`**
Verify that:
1. `dist/assets/kicad-*.js` exists as a lazy chunk (~20 kB).
2. `dist/assets/presets-*.js` exists as a lazy chunk (~22 kB).
3. `dist/assets/app-*.js` dropped from 481.95 kB to <= 465 kB.
4. Total initial JS on `app.html` dropped by ~40 kB.

- [ ] **Step 3: Update CHANGELOG.md**
Document the performance gains, TS hardening, and Biome cleanup under `[Unreleased]`.

- [ ] **Step 4: Commit**
```bash
git add CHANGELOG.md
git commit -m "docs: changelog for bundle optimization and TypeScript hardening"
```
