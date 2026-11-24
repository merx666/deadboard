# Design Document: TypeScript Hardening, Bundle Performance & Code Splitting

- **Date:** 2026-11-24
- **Author:** Antigravity Coordinator & Swarm Specialists (`ts-architect`, `perf-bundle`)
- **Reviewer:** Builder Check Reviewer Subagent
- **Status:** Approved by Builder Check (Pending User Sign-off)

---

## 1. Intent & The "Why"

DEADBOARD is an in-browser board-level electronics repair trainer powered by WebGPU and a real-time SPICE/MNA solver in a WebWorker. As the application grows with new features (such as industrial Gerber RS-274X export and modding systems), maintaining high runtime performance, fast page boot times on constrained mobile/desktop clients, and rigorous compile-time type safety is essential.

Recent profiling and auditing by the swarm identified three key opportunities for architectural improvement:
1. **Critical Path Payload Bloat:** A static import in `src/mods/mods.ts` dragged the ~20.5 kB KiCad parser into the initial `app.html` bundle, triggering a Vite code-splitting warning and negating lazy-loading in `src/ui/app.ts`. Additionally, all 4 full board presets (ESP32, Pico, Uno, Zero) were instantiated upfront during `init()`, forcing eager loading of ~73 kB of scenario topologies.
2. **TypeScript Integrity Across Repo:** `tsconfig.json` was restricted to `src` and `test`, leaving the automation, showcase, and smoke scripts in `scripts/` unmonitored by `tsc --noEmit`. Furthermore, strict override inheritance was not enforced.
3. **SPICE Domain Type Safety & Biome Hygiene:** Node identifiers, MNA indices, and power rail names were represented as primitive strings or numbers without nominal typing, creating potential for logical cross-talk. 137 Biome linter warnings existed in the repository backlog.

Addressing these issues improves initial bundle load times by ~40 kB (gzip ~13.5 kB), secures zero-defect type checking across the entire codebase, and establishes robust domain invariants without risky changes to simulation physics.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Eliminate Vite code-splitting leaks:** Ensure `src/io/kicad.ts` is purely dynamic and loaded on-demand only when a user drops or imports a KiCad/BRD board or mod.
- **Lazy-load board presets:** Separate preset metadata (`BOARD_PRESET_METAS`) from heavy scenario factory functions so that `presets.ts` is dynamically fetched only when selected.
- **Unified TypeScript compilation:** Expand `tsconfig.json` to include `scripts/` and enable `"noImplicitOverride": true` with proper `override` annotations across all derived SPICE device classes.
- **SPICE domain nominal typing (Surgical Scope):** Introduce branded types (`SpiceNode`, `RailName`, `MnaIndex`) using the existing `Brand<K, T>` pattern to prevent domain primitive confusion, with ergonomic conversion helpers (`spiceNode()`, `railName()`) ensuring zero disruption to existing synthetic test decks or solver stamp inner loops.
- **Reduce Biome warnings backlog:** Eliminate high-signal warnings (Playwright window mocks via proper ambient window declarations; clean up `noAssignInExpressions`).
- **Zero regressions:** Maintain 100% pass rate on all 30 test suites, strict typecheck, and headless-Chrome smoke tests.

### Non-Goals
- Global enablement of `noPropertyAccessFromIndexSignature`: The swarm verified this produces 138 syntax errors on standard DOM APIs (`dataset.*`) and untyped mod metadata; this is deferred to a future dedicated DOM typing pass.
- Rewriting the monolithic 5,600-line `PcbApp` class: That is scheduled for a subsequent batch. This design focuses strictly on bundle boundaries, type systems, and compiler guarantees.
- Changing simulation physics or solver mathematical formulas.

### Anti-Goals
- Intrusive refactoring of the 12 SPICE device stamp inner loops or matrix ground sentinel (`-1`).
- Breaking backwards compatibility with existing `.pcbfix.json` files, mods, or challenge salts.
- Adding complex runtime validation overhead in hot simulation loops.

---

## 3. Constraints

- Zero new runtime npm dependencies.
- Retain exact behavior of all CLI tools (`npm run spice`, `npm run schematic`, `npm run example-mod`, `npm run smoke`).
- Ensure starter-kit mod byte-for-byte invariant (`public/examples/starter-kit.zip` matches `examples/mods/starter-kit/`).
- Must pass `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run smoke` on Node 26 + Vite 5.

---

## 4. Approaches Considered

### Approach 1: Bundle Performance & Code-Splitting Only
Focus exclusively on `mods.ts` dynamic import and lazy preset stubs.
- *Pros:* Smallest diff, fast to ship.
- *Cons:* Leaves TypeScript compiler blind to `scripts/`, does not resolve `noImplicitOverride` omissions, leaves SPICE primitives unbranded.

### Approach 2: Type Safety Hardening & Biome Cleanup Only
Focus on `tsconfig.json`, `override` annotations, branded types, and typing Playwright window mocks.
- *Pros:* Elevates developer experience and codebase hygiene.
- *Cons:* Leaves the 40 kB bundle bloat and Vite code-splitting leak active in production.

### Approach 3: Full Package (Bundle Perf + Type Safety Hardening) [CHOSEN]
Synergize both tracks: remove bundle leaks, isolate presets chunk, extend `tsconfig.json` across all folders, enforce `noImplicitOverride`, add branded types to SPICE, and clean up high-noise Biome warnings.
- *Why Chosen:* Both tracks touched orthogonal files and were independently audited and verified by swarm specialists `@ts-architect` and `@perf-bundle`. Combining them produces a cohesive, high-impact release without conflicting edits.

---

## 5. Detailed Architecture & Implementation Decisions

### Part A: Bundle Decoupling & Preset Lazy-Loading
1. **Dynamic KiCad Import in `src/mods/mods.ts`:**
   - Remove top-level `import { importScenarioOrPcb } from '../io/kicad'`.
   - In `loadModBoard()`, dynamically resolve via:
     ```typescript
     const { importScenarioOrPcb } = await import('../io/kicad');
     ```
   - This isolates `src/io/kicad.ts` into a dedicated lazy chunk (`dist/assets/kicad-*.js`, ~20.5 kB), eliminating Vite's bundle warning completely.

2. **Presets Metadata & Lazy Scenario Instantiation:**
   - Create `src/boards/presetsMeta.ts`: defines lightweight descriptors (`id`, `name`, `desc`, `tags`) for ESP32, Raspberry Pi Pico, Arduino Uno R3, and Raspberry Pi Zero W.
   - Update `src/ui/app.ts`: replace eager `for (const p of BOARD_PRESETS) this.scenarios.push(p.create())` with lightweight stubs registered in scenario selection. When a user selects a preset, dynamically import `../boards/presets` and instantiate `scenario.create()` on demand.

### Part B: TypeScript Compiler Hardening
1. **`tsconfig.json` Updates:**
   - Expand `"include"` to `["src", "test", "scripts"]`.
   - Add `"noImplicitOverride": true` to `"compilerOptions"`.
2. **Explicit `override` in `src/spice/devices.ts`:**
   - Add `override` keyword to the 21 derived methods identified across `Resistor`, `Capacitor`, `Inductor`, `Diode`, `Vdc`, `Idc`, `Bjt`, `Mosfet`, `OpAmp`, and `Subcircuit` (`report()`, `initTran()`, `accept()`, `breakpoints()`).

### Part C: Branded Types in SPICE Domain (Resolved per Builder Check)
1. **Branding Primitives in `src/spice/types.ts`:**
   - Introduce nominal branding:
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
2. **Scope Boundaries & Ground Sentinels:**
   - **`MnaIndex`:** Used in `src/spice/types.ts` and index mapping signatures (e.g. `MnaMap.get()`). Inner device stamp loops (`Device.n1`, `Device.n2`) and matrix solving retain primitive `number` with `-1` as ground to prevent any overhead or solver regressions.
   - **`SpiceNode`:** Scoped to board topology node resolution in `src/spice/board.ts` (`padNode()`, `roleNode()`, `boardToCircuit()`). General `Circuit.nodes` / `Element.n` remains compatible with standard string netlists.
   - **`RailName`:** Used in `src/spice/powertree.ts` for detected power rail definitions, with `railName()` and `isRailName()` helper conversions.

### Part D: Biome Warning Remediation
1. **Playwright `window` Declarations:**
   - In `scripts/videos/director.ts`, `scripts/promo/showcase.ts`, and `scripts/promo/stage.ts`, introduce standard TypeScript ambient definitions for custom browser properties (`deadboard`, `__dir`, `__pr`) instead of casting through `(window as any)`.
2. **Assignment in Expressions:**
   - Convert `while ((m = re.exec(str)))` constructs to modern `for (const m of str.matchAll(re))` or hoisted loop variable declarations.
   - Separate chained comma operators in array/reduce operations.

---

## 6. Verification & Quality Gates

To be considered ready for merge, the changes must satisfy:
1. `npm run typecheck` (`tsc --noEmit`): Exit code 0, 0 errors across `src`, `test`, and `scripts`.
2. `npm run lint` (`biome lint .`): Exit code 0, with significant reduction of warnings (target < 80 warnings, 0 errors).
3. `npm test`: All 30 test suites passing.
4. `npm run build`: Exit code 0, no Vite dynamic/static import warnings, bundle size reduction verified in `dist/assets/`.
5. `npm run smoke`: Headless Chrome passes on WebGPU, lazy chunk resolution confirmed.
6. `npm run example-mod` & `npx tsx test/mods.test.ts`: Mod archive binary invariant preserved.

---

## 7. Choices Left to the Builder

- Exact chunk naming and splitting boundaries configured by Vite rollup options (default automatic chunking is sufficient).
- Minor internal helper names inside `src/boards/presetsMeta.ts`.
