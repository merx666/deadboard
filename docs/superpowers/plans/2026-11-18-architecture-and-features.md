# Architecture and Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement branded physical types and discriminated component unions, an industrial Gerber RS-274X and Excellon drill exporter, a 45° A* PCB autorouter, and decompose monolithic workbench tools into modular controller classes.

**Architecture:** Decompose into 4 decoupled subsystems with clean interfaces: `src/types/` (units + components), `src/io/gerber.ts` (RS-274X + Excellon + zip archive), `src/routing/autorouter.ts` (2-layer cost grid A* with 45° bends and vias), and `src/ui/tools/` (isolated tool state machines implementing `WorkbenchTool`).

**Tech Stack:** TypeScript 5.6.3 (strict mode + noUncheckedIndexedAccess), Vite 5.4, Node.js, Canvas 2D API.

## Global Constraints
- Target TypeScript version: 5.6.3 (`strict: true`, `"noUncheckedIndexedAccess": true`).
- 100% test pass rate across all existing 25 test suites (`npm test`).
- Production build succeeds cleanly (`npm run build`).
- Zero breaking changes to existing presets (`ESP32`, `Arduino Uno`, `RPi Pico`, `RPi Zero 2 W`) and serialization.

---

### Task 1: Branded Physical Units and Nominal Types

**Files:**
- Create: `src/types/units.ts`
- Test: `test/units.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type Brand<K, T> = K & { readonly __brand: T };
  export type Ohms = Brand<number, 'Ohms'>;
  export type Farads = Brand<number, 'Farads'>;
  export type Volts = Brand<number, 'Volts'>;
  export type Amps = Brand<number, 'Amps'>;
  export type Millimeters = Brand<number, 'Millimeters'>;
  export type NetId = Brand<string, 'NetId'>;
  export type ComponentId = Brand<string, 'ComponentId'>;

  export function ohms(val: number): Ohms;
  export function farads(val: number): Farads;
  export function volts(val: number): Volts;
  export function amps(val: number): Amps;
  export function mm(val: number): Millimeters;
  export function netId(val: string): NetId;
  export function componentId(val: string): ComponentId;
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// test/units.test.ts
import { ohms, farads, volts, amps, mm, netId, componentId, type Ohms, type Volts } from '../src/types/units';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

// Test basic branding and value preservation
{
  const r = ohms(10000);
  assert(r === 10000, 'Ohms constructor must preserve numeric value');
  assert(typeof r === 'number', 'Branded type must remain a number at runtime');

  const v = volts(3.3);
  assert(v === 3.3, 'Volts constructor must preserve numeric value');

  const c = farads(10e-6);
  assert(c === 10e-6, 'Farads constructor must preserve numeric value');

  const i = amps(0.5);
  assert(i === 0.5, 'Amps constructor must preserve numeric value');

  const dist = mm(2.54);
  assert(dist === 2.54, 'Millimeters constructor must preserve numeric value');

  const net = netId('+3V3');
  assert(net === '+3V3', 'NetId constructor must preserve string value');

  const comp = componentId('U2_ESP32');
  assert(comp === 'U2_ESP32', 'ComponentId constructor must preserve string value');
}

console.log('units.test.ts: branded types & constructors — ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx test/units.test.ts`  
Expected: FAIL with "Cannot find module '../src/types/units'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/types/units.ts
export type Brand<K, T> = K & { readonly __brand: T };

export type Ohms = Brand<number, 'Ohms'>;
export type Farads = Brand<number, 'Farads'>;
export type Volts = Brand<number, 'Volts'>;
export type Amps = Brand<number, 'Amps'>;
export type Millimeters = Brand<number, 'Millimeters'>;
export type NetId = Brand<string, 'NetId'>;
export type ComponentId = Brand<string, 'ComponentId'>;

export function ohms(val: number): Ohms { return val as Ohms; }
export function farads(val: number): Farads { return val as Farads; }
export function volts(val: number): Volts { return val as Volts; }
export function amps(val: number): Amps { return val as Amps; }
export function mm(val: number): Millimeters { return val as Millimeters; }
export function netId(val: string): NetId { return val as NetId; }
export function componentId(val: string): ComponentId { return val as ComponentId; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx test/units.test.ts`  
Expected: PASS with "units.test.ts: branded types & constructors — ok"

- [ ] **Step 5: Commit**

```bash
git add src/types/units.ts test/units.test.ts
git commit -m "feat(types): add branded physical units and domain identifiers"
```

---

### Task 2: Discriminated Component Unions

**Files:**
- Create: `src/types/components.ts`
- Modify: `src/types.ts`
- Test: `test/components.test.ts`

**Interfaces:**
- Consumes: `Ohms`, `Farads`, `Volts`, `Amps` from `src/types/units.ts`
- Produces: `TypedComponent`, `ResistorComponent`, `CapacitorComponent`, `DiodeComponent`, `LedComponent`, `IcComponent`, `SwitchComponent`, `BatteryComponent`, `FuseComponent`

- [ ] **Step 1: Write the failing test**

```typescript
// test/components.test.ts
import {
  type TypedComponent,
  type ResistorComponent,
  type LedComponent,
  isResistor,
  isLed,
  isIc
} from '../src/types/components';
import { ohms, volts } from '../src/types/units';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

const dummyResistor: ResistorComponent = {
  id: 'R1',
  ref: 'R1',
  kind: 'resistor',
  value: ohms(1000),
  rating: 0.25,
  tolerance: 0.05,
  at: [10, 10],
  rot: 0,
  side: 'F',
  pads: [],
  pins: { '1': '1', '2': '2' },
  body: { shape: 'box', w: 3.2, h: 1.6, z: 0.8 },
  state: { populated: true, reversed: false, burnt: false, cold: [] }
};

const dummyLed: LedComponent = {
  id: 'D1',
  ref: 'D1',
  kind: 'led',
  value: 0,
  color: 'blue',
  forwardDrop: volts(3.0),
  at: [20, 20],
  rot: 0,
  side: 'F',
  pads: [],
  pins: { 'A': '1', 'K': '2' },
  body: { shape: 'led', w: 3.2, h: 1.6, z: 1.5 },
  state: { populated: true, reversed: false, burnt: false, cold: [] }
};

assert(isResistor(dummyResistor), 'isResistor guard must identify resistor');
assert(!isResistor(dummyLed), 'isResistor guard must reject LED');
assert(isLed(dummyLed), 'isLed guard must identify LED');
assert(!isIc(dummyResistor), 'isIc guard must reject resistor');

console.log('components.test.ts: discriminated component unions & type guards — ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx test/components.test.ts`  
Expected: FAIL with "Cannot find module '../src/types/components'"

- [ ] **Step 3: Write implementation**

Create `src/types/components.ts`:
```typescript
import type { Ohms, Farads, Volts, Amps } from './units';
import type { Body, ComponentState, LedColor, Pad, Side, V2, Component } from '../types';

interface BaseComponent {
  id: string;
  ref: string;
  at: V2;
  rot: number;
  side: Side;
  pads: Pad[];
  pins: Record<string, string>;
  body: Body;
  state: ComponentState;
  label?: string;
  footprint?: string;
}

export interface ResistorComponent extends BaseComponent {
  kind: 'resistor';
  value: Ohms;
  rating?: number;
  tolerance?: number;
}

export interface CapacitorComponent extends BaseComponent {
  kind: 'capacitor';
  value: Farads;
  maxVoltage?: Volts;
}

export interface DiodeComponent extends BaseComponent {
  kind: 'diode';
  value: number;
  forwardDrop?: Volts;
  maxCurrent?: Amps;
}

export interface LedComponent extends BaseComponent {
  kind: 'led';
  value: number;
  color: LedColor;
  forwardDrop?: Volts;
}

export interface IcComponent extends BaseComponent {
  kind: 'ic';
  value: number;
  partNumber?: string;
}

export interface SwitchComponent extends BaseComponent {
  kind: 'switch';
  value: number;
  closed?: boolean;
}

export interface BatteryComponent extends BaseComponent {
  kind: 'battery';
  value: Volts;
  internalR?: Ohms;
}

export interface FuseComponent extends BaseComponent {
  kind: 'fuse';
  value: Amps;
}

export type TypedComponent =
  | ResistorComponent
  | CapacitorComponent
  | DiodeComponent
  | LedComponent
  | IcComponent
  | SwitchComponent
  | BatteryComponent
  | FuseComponent;

export function isResistor(c: Component | TypedComponent): c is ResistorComponent {
  return c.kind === 'resistor';
}

export function isCapacitor(c: Component | TypedComponent): c is CapacitorComponent {
  return c.kind === 'capacitor';
}

export function isLed(c: Component | TypedComponent): c is LedComponent {
  return c.kind === 'led';
}

export function isIc(c: Component | TypedComponent): c is IcComponent {
  return c.kind === 'ic';
}
```

Update `src/types.ts` to re-export the new types:
```typescript
export * from './types/units';
export * from './types/components';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx test/components.test.ts`  
Expected: PASS with "components.test.ts: discriminated component unions & type guards — ok"

- [ ] **Step 5: Commit**

```bash
git add src/types/components.ts src/types.ts test/components.test.ts
git commit -m "feat(types): add discriminated component unions and type guards"
```

---

### Task 3: Industrial Gerber RS-274X & Excellon Exporter

**Files:**
- Create: `src/io/gerber.ts`
- Test: `test/gerber.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface GerberFile {
    filename: string;
    content: string;
  }
  export interface GerberExportResult {
    files: GerberFile[];
    zipBuffer: Uint8Array;
  }
  export function exportGerberLayers(board: Board, projectName?: string): GerberFile[];
  export function createSimpleZip(files: GerberFile[]): Uint8Array;
  export function exportGerberZip(board: Board, projectName?: string): GerberExportResult;
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// test/gerber.test.ts
import { exportGerberLayers, createSimpleZip, exportGerberZip } from '../src/io/gerber';
import { createEsp32DevScenario } from '../src/boards/presets';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

const scenario = createEsp32DevScenario();
const board = scenario.board;

// 1. Verify layer generation
const layers = exportGerberLayers(board, 'ESP32_Test');
assert(layers.length >= 6, 'Must generate at least 6 standard manufacturing layers');

const filenames = layers.map(l => l.filename);
assert(filenames.some(f => f.endsWith('.gtl') || f.includes('F_Cu')), 'Must include Top Copper');
assert(filenames.some(f => f.endsWith('.gbl') || f.includes('B_Cu')), 'Must include Bottom Copper');
assert(filenames.some(f => f.endsWith('.gts') || f.includes('F_Mask')), 'Must include Top Solder Mask');
assert(filenames.some(f => f.endsWith('.gto') || f.includes('F_Silk')), 'Must include Top Silkscreen');
assert(filenames.some(f => f.endsWith('.gm1') || f.includes('Edge_Cuts')), 'Must include Edge Cuts');
assert(filenames.some(f => f.endsWith('.drl') || f.includes('Drill')), 'Must include Excellon Drill');

// 2. Verify Gerber RS-274X header format
const topCu = layers.find(l => l.filename.includes('F_Cu'))!;
assert(topCu.content.includes('%FSLAX44Y44*%'), 'Gerber must specify format specification 4.4');
assert(topCu.content.includes('%MOMM*%'), 'Gerber must specify metric millimetres');
assert(topCu.content.includes('M02*'), 'Gerber must end with M02* EOF');

// 3. Verify Excellon Drill file format
const drill = layers.find(l => l.filename.includes('Drill'))!;
assert(drill.content.includes('M48'), 'Drill file must start with header M48');
assert(drill.content.includes('METRIC'), 'Drill file must use metric units');
assert(drill.content.includes('M30'), 'Drill file must end with M30');

// 4. Verify ZIP creation
const zipResult = exportGerberZip(board, 'ESP32_Test');
assert(zipResult.zipBuffer.length > 100, 'ZIP archive must be non-empty');
assert(zipResult.zipBuffer[0] === 0x50 && zipResult.zipBuffer[1] === 0x4B, 'ZIP magic bytes (PK) must be valid');

console.log('gerber.test.ts: RS-274X layers, Excellon drill & ZIP archive — ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx test/gerber.test.ts`  
Expected: FAIL with "Cannot find module '../src/io/gerber'"

- [ ] **Step 3: Write implementation**

Create `src/io/gerber.ts`:
```typescript
import type { Board } from '../types';

export interface GerberFile {
  filename: string;
  content: string;
}

export interface GerberExportResult {
  files: GerberFile[];
  zipBuffer: Uint8Array;
}

// Convert millimetres to Gerber 4.4 integer string (e.g. 12.3456 mm -> "123456")
function toGerberCoord(mm: number): string {
  const scaled = Math.round(mm * 10000);
  return String(scaled);
}

function gerberHeader(): string {
  return [
    'G04 LiveBoard Gerber RS-274X Export*',
    '%FSLAX44Y44*%',
    '%MOMM*%',
    '%LPD*%',
    'G01*',
    'G75*',
    ''
  ].join('\n');
}

export function exportGerberLayers(board: Board, projectName = 'LiveBoard_PCB'): GerberFile[] {
  const files: GerberFile[] = [];

  // 1. Top Copper (F_Cu)
  let fCu = gerberHeader();
  fCu += '%ADD10C,0.2000*%\n'; // 0.2mm trace aperture
  fCu += '%ADD11C,1.4000*%\n'; // Pad aperture
  fCu += 'D10*\n';
  for (const t of board.traces) {
    if (t.layer === 'F') {
      fCu += `X${toGerberCoord(t.a[0])}Y${toGerberCoord(t.a[1])}D02*\n`;
      fCu += `X${toGerberCoord(t.b[0])}Y${toGerberCoord(t.b[1])}D01*\n`;
    }
  }
  fCu += 'D11*\n';
  for (const c of board.components) {
    for (const p of c.pads) {
      const px = c.at[0] + (p.at ? p.at[0] : 0);
      const py = c.at[1] + (p.at ? p.at[1] : 0);
      fCu += `X${toGerberCoord(px)}Y${toGerberCoord(py)}D03*\n`;
    }
  }
  fCu += 'M02*\n';
  files.push({ filename: `${projectName}-F_Cu.gtl`, content: fCu });

  // 2. Bottom Copper (B_Cu)
  let bCu = gerberHeader();
  bCu += '%ADD10C,0.2000*%\n';
  bCu += '%ADD11C,1.4000*%\n';
  bCu += 'D10*\n';
  for (const t of board.traces) {
    if (t.layer === 'B') {
      bCu += `X${toGerberCoord(t.a[0])}Y${toGerberCoord(t.a[1])}D02*\n`;
      bCu += `X${toGerberCoord(t.b[0])}Y${toGerberCoord(t.b[1])}D01*\n`;
    }
  }
  bCu += 'M02*\n';
  files.push({ filename: `${projectName}-B_Cu.gbl`, content: bCu });

  // 3. Top Solder Mask (F_Mask)
  let fMask = gerberHeader();
  fMask += '%ADD12C,1.5000*%\n'; // Pad clearance (+0.1mm)
  fMask += 'D12*\n';
  for (const c of board.components) {
    for (const p of c.pads) {
      const px = c.at[0] + (p.at ? p.at[0] : 0);
      const py = c.at[1] + (p.at ? p.at[1] : 0);
      fMask += `X${toGerberCoord(px)}Y${toGerberCoord(py)}D03*\n`;
    }
  }
  fMask += 'M02*\n';
  files.push({ filename: `${projectName}-F_Mask.gts`, content: fMask });

  // 4. Top Silkscreen (F_Silk)
  let fSilk = gerberHeader();
  fSilk += '%ADD13C,0.1500*%\n';
  fSilk += 'D13*\n';
  for (const s of board.silk) {
    if (s.side === 'F') {
      fSilk += `X${toGerberCoord(s.a[0])}Y${toGerberCoord(s.a[1])}D02*\n`;
      fSilk += `X${toGerberCoord(s.b[0])}Y${toGerberCoord(s.b[1])}D01*\n`;
    }
  }
  fSilk += 'M02*\n';
  files.push({ filename: `${projectName}-F_Silk.gto`, content: fSilk });

  // 5. Edge Cuts (Board Outline)
  let edge = gerberHeader();
  edge += '%ADD14C,0.1500*%\n';
  edge += 'D14*\n';
  edge += `X0Y0D02*\n`;
  edge += `X${toGerberCoord(board.w)}Y0D01*\n`;
  edge += `X${toGerberCoord(board.w)}Y${toGerberCoord(board.h)}D01*\n`;
  edge += `X0Y${toGerberCoord(board.h)}D01*\n`;
  edge += `X0Y0D01*\n`;
  edge += 'M02*\n';
  files.push({ filename: `${projectName}-Edge_Cuts.gm1`, content: edge });

  // 6. Excellon Drill File (.drl)
  let drill = 'M48\nMETRIC,TZ\n';
  drill += 'T01C0.800\n'; // 0.8mm standard via drill
  drill += '%\nG90\nT01\n';
  for (const v of board.vias) {
    drill += `X${Math.round(v.at[0] * 1000)}Y${Math.round(v.at[1] * 1000)}\n`;
  }
  drill += 'M30\n';
  files.push({ filename: `${projectName}-Drill.drl`, content: drill });

  return files;
}

// Lightweight standard ZIP container generator (RFC 1951 store mode)
export function createSimpleZip(files: GerberFile[]): Uint8Array {
  const fileEntries: { nameBuf: Uint8Array; dataBuf: Uint8Array; offset: number; crc: number }[] = [];
  let currentOffset = 0;
  const parts: Uint8Array[] = [];

  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[i] = c;
  }
  function calcCrc(buf: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      const b = buf[i] ?? 0;
      const idx = (crc ^ b) & 0xff;
      crc = (crc >>> 8) ^ (crcTable[idx] ?? 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const enc = new TextEncoder();

  // Write local file headers and data
  for (const f of files) {
    const nameBuf = enc.encode(f.filename);
    const dataBuf = enc.encode(f.content);
    const crc = calcCrc(dataBuf);
    const offset = currentOffset;

    const header = new Uint8Array(30 + nameBuf.length);
    const dv = new DataView(header.buffer);
    dv.setUint32(0, 0x04034b50, true); // Local file header signature
    dv.setUint16(4, 20, true);         // Version needed
    dv.setUint16(6, 0, true);          // General purpose bit flag
    dv.setUint16(8, 0, true);          // Compression method (0 = stored)
    dv.setUint16(10, 0, true);         // Last mod file time
    dv.setUint16(12, 0, true);         // Last mod file date
    dv.setUint32(14, crc, true);       // CRC-32
    dv.setUint32(18, dataBuf.length, true); // Compressed size
    dv.setUint32(22, dataBuf.length, true); // Uncompressed size
    dv.setUint16(26, nameBuf.length, true); // File name length
    dv.setUint16(28, 0, true);         // Extra field length
    header.set(nameBuf, 30);

    parts.push(header);
    parts.push(dataBuf);

    fileEntries.push({ nameBuf, dataBuf, offset, crc });
    currentOffset += header.length + dataBuf.length;
  }

  // Central directory
  const cdOffset = currentOffset;
  let cdSize = 0;
  for (const e of fileEntries) {
    const cd = new Uint8Array(46 + e.nameBuf.length);
    const dv = new DataView(cd.buffer);
    dv.setUint32(0, 0x02014b50, true); // Central directory signature
    dv.setUint16(4, 20, true);         // Version made by
    dv.setUint16(6, 20, true);         // Version needed
    dv.setUint16(8, 0, true);          // Flags
    dv.setUint16(10, 0, true);         // Compression
    dv.setUint16(12, 0, true);         // Mod time
    dv.setUint16(14, 0, true);         // Mod date
    dv.setUint32(16, e.crc, true);     // CRC-32
    dv.setUint32(20, e.dataBuf.length, true);
    dv.setUint32(24, e.dataBuf.length, true);
    dv.setUint16(28, e.nameBuf.length, true);
    dv.setUint16(30, 0, true);         // Extra
    dv.setUint16(32, 0, true);         // Comment length
    dv.setUint16(34, 0, true);         // Disk start
    dv.setUint16(36, 0, true);         // Internal attr
    dv.setUint32(38, 0, true);         // External attr
    dv.setUint32(42, e.offset, true);  // Local header offset
    cd.set(e.nameBuf, 46);

    parts.push(cd);
    cdSize += cd.length;
  }

  // End of central directory record (EOCD)
  const eocd = new Uint8Array(22);
  const dvEocd = new DataView(eocd.buffer);
  dvEocd.setUint32(0, 0x06054b50, true);
  dvEocd.setUint16(4, 0, true);
  dvEocd.setUint16(6, 0, true);
  dvEocd.setUint16(8, fileEntries.length, true);
  dvEocd.setUint16(10, fileEntries.length, true);
  dvEocd.setUint32(12, cdSize, true);
  dvEocd.setUint32(16, cdOffset, true);
  dvEocd.setUint16(20, 0, true);
  parts.push(eocd);

  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }
  return result;
}

export function exportGerberZip(board: Board, projectName = 'LiveBoard_PCB'): GerberExportResult {
  const files = exportGerberLayers(board, projectName);
  const zipBuffer = createSimpleZip(files);
  return { files, zipBuffer };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx test/gerber.test.ts`  
Expected: PASS with "gerber.test.ts: RS-274X layers, Excellon drill & ZIP archive — ok"

- [ ] **Step 5: Commit**

```bash
git add src/io/gerber.ts test/gerber.test.ts
git commit -m "feat(gerber): add industrial RS-274X, Excellon drill, and ZIP exporter"
```

---

### Task 4: 45° Grid A* PCB Autorouter

**Files:**
- Create: `src/routing/autorouter.ts`
- Test: `test/autorouter.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface RouteRequest {
    board: Board;
    net: string;
    from: V2;
    to: V2;
    fromLayer?: Side;
    toLayer?: Side;
    clearance?: number;
    traceWidth?: number;
  }
  export interface RouteResult {
    success: boolean;
    traces: Trace[];
    vias: Via[];
    cost: number;
    message?: string;
  }
  export function autorouteConnection(req: RouteRequest): RouteResult;
  export function autorouteNet(board: Board, net: string): RouteResult;
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// test/autorouter.test.ts
import { autorouteConnection, autorouteNet } from '../src/routing/autorouter';
import { createArduinoUnoScenario } from '../src/boards/presets';
import type { Board } from '../src/types';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

const uno = createArduinoUnoScenario();
const board = uno.board;

// 1. Straightforward route on free board area
const res1 = autorouteConnection({
  board,
  net: 'TEST_NET',
  from: [20, 20],
  to: [35, 30],
  fromLayer: 'F',
  toLayer: 'F'
});

assert(res1.success, 'Autorouter must find path in open space');
assert(res1.traces.length > 0, 'Autorouter must generate traces');
for (const t of res1.traces) {
  assert(t.net === 'TEST_NET', 'Traces must carry assigned net name');
  assert(t.layer === 'F', 'Single-layer route must stay on Top layer');
}

// 2. Route between pads
const res2 = autorouteConnection({
  board,
  net: 'GND',
  from: [10, 10],
  to: [50, 40]
});
assert(res2.success, 'Autorouter must route across the board');

console.log('autorouter.test.ts: 45-degree A* pathfinding & trace generation — ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx test/autorouter.test.ts`  
Expected: FAIL with "Cannot find module '../src/routing/autorouter'"

- [ ] **Step 3: Write implementation**

Create `src/routing/autorouter.ts`:
```typescript
import type { Board, Side, Trace, V2, Via } from '../types';

export interface RouteRequest {
  board: Board;
  net: string;
  from: V2;
  to: V2;
  fromLayer?: Side;
  toLayer?: Side;
  clearance?: number;
  traceWidth?: number;
}

export interface RouteResult {
  success: boolean;
  traces: Trace[];
  vias: Via[];
  cost: number;
  message?: string;
}

interface Node {
  gx: number;
  gy: number;
  layer: number; // 0 = F, 1 = B
  g: number;
  h: number;
  f: number;
  parent: Node | null;
  dirX: number;
  dirY: number;
}

export function autorouteConnection(req: RouteRequest): RouteResult {
  const gridStep = 0.5; // mm resolution
  const w = req.board.w;
  const h = req.board.h;
  const cols = Math.ceil(w / gridStep) + 1;
  const rows = Math.ceil(h / gridStep) + 1;

  const startGx = Math.max(0, Math.min(cols - 1, Math.round(req.from[0] / gridStep)));
  const startGy = Math.max(0, Math.min(rows - 1, Math.round(req.from[1] / gridStep)));
  const targetGx = Math.max(0, Math.min(cols - 1, Math.round(req.to[0] / gridStep)));
  const targetGy = Math.max(0, Math.min(rows - 1, Math.round(req.to[1] / gridStep)));

  const startLayer = req.fromLayer === 'B' ? 1 : 0;
  const targetLayer = req.toLayer === 'B' ? 1 : 0;

  // Build obstacle grid
  const obstacle = new Uint8Array(cols * rows * 2);
  const idx = (gx: number, gy: number, l: number) => (l * cols * rows) + (gy * cols) + gx;

  // Mark existing components with foreign nets as keepouts
  for (const c of req.board.components) {
    for (const p of c.pads) {
      if (p.net && p.net !== req.net) {
        const px = c.at[0] + (p.at ? p.at[0] : 0);
        const py = c.at[1] + (p.at ? p.at[1] : 0);
        const cgx = Math.round(px / gridStep);
        const cgy = Math.round(py / gridStep);
        const padRad = Math.ceil(((p.size ? p.size[0] : 1.2) * 0.5 + 0.3) / gridStep);
        for (let dx = -padRad; dx <= padRad; dx++) {
          for (let dy = -padRad; dy <= padRad; dy++) {
            const nx = cgx + dx;
            const ny = cgy + dy;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
              const obst0 = idx(nx, ny, 0);
              const obst1 = idx(nx, ny, 1);
              obstacle[obst0] = 1;
              if (p.layers !== 'F') obstacle[obst1] = 1;
            }
          }
        }
      }
    }
  }

  // Clear start and target points from obstacle map
  obstacle[idx(startGx, startGy, startLayer)] = 0;
  obstacle[idx(targetGx, targetGy, targetLayer)] = 0;

  // Heuristic: Octile distance + 45 deg angles
  function heuristic(gx: number, gy: number, layer: number): number {
    const dx = Math.abs(gx - targetGx);
    const dy = Math.abs(gy - targetGy);
    const octile = Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    const layerCost = layer !== targetLayer ? 8.0 : 0;
    return (octile * gridStep) + layerCost;
  }

  // A* Open and Closed lists
  const open: Node[] = [];
  const closed = new Uint8Array(cols * rows * 2);

  const startNode: Node = {
    gx: startGx,
    gy: startGy,
    layer: startLayer,
    g: 0,
    h: heuristic(startGx, startGy, startLayer),
    f: heuristic(startGx, startGy, startLayer),
    parent: null,
    dirX: 0,
    dirY: 0
  };
  open.push(startNode);

  // 8-directional movement offsets
  const directions = [
    [1, 0, 1.0], [-1, 0, 1.0], [0, 1, 1.0], [0, -1, 1.0],
    [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2]
  ];

  let targetNode: Node | null = null;
  let iterations = 0;
  const maxIterations = 20000;

  while (open.length > 0 && iterations++ < maxIterations) {
    // Pop lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      const cur = open[i];
      const best = open[bestIdx];
      if (cur && best && cur.f < best.f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0]!;

    if (current.gx === targetGx && current.gy === targetGy && current.layer === targetLayer) {
      targetNode = current;
      break;
    }

    const curIdx = idx(current.gx, current.gy, current.layer);
    closed[curIdx] = 1;

    // Explore 8 directions on same layer
    for (const [dx, dy, dist] of directions) {
      const ngx = current.gx + dx!;
      const ngy = current.gy + dy!;

      if (ngx < 0 || ngx >= cols || ngy < 0 || ngy >= rows) continue;
      const nIdx = idx(ngx, ngy, current.layer);
      if (closed[nIdx] || obstacle[nIdx]) continue;

      // Direction change penalty to avoid zigzagging
      const bendPenalty = (current.dirX !== 0 || current.dirY !== 0) && (current.dirX !== dx || current.dirY !== dy) ? 0.4 : 0;
      const tentG = current.g + dist! * gridStep + bendPenalty;

      let neighbor = open.find(n => n.gx === ngx && n.gy === ngy && n.layer === current.layer);
      if (!neighbor) {
        neighbor = {
          gx: ngx,
          gy: ngy,
          layer: current.layer,
          g: tentG,
          h: heuristic(ngx, ngy, current.layer),
          f: tentG + heuristic(ngx, ngy, current.layer),
          parent: current,
          dirX: dx!,
          dirY: dy!
        };
        open.push(neighbor);
      } else if (tentG < neighbor.g) {
        neighbor.g = tentG;
        neighbor.f = tentG + neighbor.h;
        neighbor.parent = current;
        neighbor.dirX = dx!;
        neighbor.dirY = dy!;
      }
    }

    // Try layer transition via VIA
    const otherLayer = current.layer === 0 ? 1 : 0;
    const viaIdx = idx(current.gx, current.gy, otherLayer);
    if (!closed[viaIdx] && !obstacle[viaIdx]) {
      const viaCost = current.g + 6.0; // VIA cost penalty
      let viaNeighbor = open.find(n => n.gx === current.gx && n.gy === current.gy && n.layer === otherLayer);
      if (!viaNeighbor) {
        viaNeighbor = {
          gx: current.gx,
          gy: current.gy,
          layer: otherLayer,
          g: viaCost,
          h: heuristic(current.gx, current.gy, otherLayer),
          f: viaCost + heuristic(current.gx, current.gy, otherLayer),
          parent: current,
          dirX: 0,
          dirY: 0
        };
        open.push(viaNeighbor);
      } else if (viaCost < viaNeighbor.g) {
        viaNeighbor.g = viaCost;
        viaNeighbor.f = viaCost + viaNeighbor.h;
        viaNeighbor.parent = current;
      }
    }
  }

  if (!targetNode) {
    return { success: false, traces: [], vias: [], cost: Infinity, message: 'No viable routing path found' };
  }

  // Trace back path
  const pathNodes: Node[] = [];
  let curr: Node | null = targetNode;
  while (curr) {
    pathNodes.push(curr);
    curr = curr.parent;
  }
  pathNodes.reverse();

  // Convert nodes to combined traces and vias
  const traces: Trace[] = [];
  const vias: Via[] = [];
  let nextId = 1000;

  let segStart = pathNodes[0]!;
  for (let i = 1; i < pathNodes.length; i++) {
    const prev = pathNodes[i - 1]!;
    const cur = pathNodes[i]!;

    if (cur.layer !== prev.layer) {
      // Create trace up to the via
      if (segStart !== prev) {
        traces.push({
          id: `rt_${nextId++}`,
          layer: segStart.layer === 0 ? 'F' : 'B',
          a: [segStart.gx * gridStep, segStart.gy * gridStep],
          b: [prev.gx * gridStep, prev.gy * gridStep],
          w: req.traceWidth || 0.4,
          net: req.net
        });
      }
      // Insert via
      vias.push({
        id: `via_${nextId++}`,
        at: [cur.gx * gridStep, cur.gy * gridStep],
        d: 1.0,
        drill: 0.6,
        net: req.net
      });
      segStart = cur;
    } else {
      // Check if direction changed
      const next = pathNodes[i + 1];
      const dirChanged = next && (next.gx - cur.gx !== cur.gx - prev.gx || next.gy - cur.gy !== cur.gy - prev.gy);
      if (dirChanged || !next) {
        traces.push({
          id: `rt_${nextId++}`,
          layer: cur.layer === 0 ? 'F' : 'B',
          a: [segStart.gx * gridStep, segStart.gy * gridStep],
          b: [cur.gx * gridStep, cur.gy * gridStep],
          w: req.traceWidth || 0.4,
          net: req.net
        });
        segStart = cur;
      }
    }
  }

  return { success: true, traces, vias, cost: targetNode.g };
}

export function autorouteNet(board: Board, net: string): RouteResult {
  const padPositions: V2[] = [];
  for (const c of board.components) {
    for (const p of c.pads) {
      if (p.net === net) {
        padPositions.push([c.at[0] + (p.at ? p.at[0] : 0), c.at[1] + (p.at ? p.at[1] : 0)]);
      }
    }
  }

  if (padPositions.length < 2) {
    return { success: false, traces: [], vias: [], cost: 0, message: 'Need at least 2 pads to route' };
  }

  const p0 = padPositions[0]!;
  const p1 = padPositions[1]!;
  return autorouteConnection({ board, net, from: p0, to: p1 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx test/autorouter.test.ts`  
Expected: PASS with "autorouter.test.ts: 45-degree A* pathfinding & trace generation — ok"

- [ ] **Step 5: Commit**

```bash
git add src/routing/autorouter.ts test/autorouter.test.ts
git commit -m "feat(routing): add 45-degree A* PCB autorouter with via placement"
```

---

### Task 5: Modular Workbench Tool Architecture & Multimeter Controller

**Files:**
- Create: `src/ui/tools/tool.ts`
- Create: `src/ui/tools/multimeter.ts`
- Test: `test/tools.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type ToolKind = 'inspect' | 'dmm' | 'scope' | 'thermal' | 'iron' | 'partsbin';
  export interface ToolContext {
    board: Board;
    requestRender(): void;
    playAudio(effect: string): void;
    showToast(message: string): void;
  }
  export interface WorkbenchTool {
    readonly id: ToolKind;
    activate(context: ToolContext): void;
    deactivate(): void;
  }
  export class MultimeterTool implements WorkbenchTool { ... }
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// test/tools.test.ts
import { MultimeterTool } from '../src/ui/tools/multimeter';
import { createEsp32DevScenario } from '../src/boards/presets';
import type { ToolContext } from '../src/ui/tools/tool';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

const scenario = createEsp32DevScenario();
const board = scenario.board;

let renders = 0;
let audioPlayed: string[] = [];
let toasts: string[] = [];

const ctx: ToolContext = {
  board,
  requestRender: () => { renders++; },
  playAudio: (s) => { audioPlayed.push(s); },
  showToast: (m) => { toasts.push(m); }
};

const dmm = new MultimeterTool();
assert(dmm.id === 'dmm', 'Tool id must be dmm');

dmm.activate(ctx);
assert(dmm.mode === 'VDC', 'Default DMM mode must be DC Volts');

dmm.setMode('OHMS');
assert(dmm.mode === 'OHMS', 'DMM mode must update to Ohms');
assert(renders > 0, 'Mode change must request canvas render');

dmm.placeProbe('red', [14.25, 33.0], 'F');
assert(dmm.probeRed !== null, 'Red probe must be positioned');
assert(dmm.probeRed.pos[0] === 14.25, 'Probe X coordinate must match');

dmm.deactivate();
assert(dmm.probeRed === null && dmm.probeBlack === null, 'Deactivation must lift probes');

console.log('tools.test.ts: WorkbenchTool interface & MultimeterTool controller — ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx test/tools.test.ts`  
Expected: FAIL with "Cannot find module '../src/ui/tools/multimeter'"

- [ ] **Step 3: Write implementation**

Create `src/ui/tools/tool.ts`:
```typescript
import type { Board, Side, V2 } from '../../types';

export type ToolKind =
  | 'inspect' | 'dmm' | 'scope' | 'thermal' | 'iron' | 'hotair'
  | 'jumper' | 'cut' | 'partsbin' | 'freeze' | 'ipa';

export interface ToolContext {
  board: Board;
  requestRender(): void;
  playAudio(effect: string): void;
  showToast(message: string, type?: 'info' | 'success' | 'warn' | 'error'): void;
}

export interface WorkbenchTool {
  readonly id: ToolKind;
  activate(context: ToolContext): void;
  deactivate(): void;
  onPointerDown?(pos: V2, side: Side): void;
  onPointerMove?(pos: V2, side: Side): void;
  onPointerUp?(pos: V2, side: Side): void;
}
```

Create `src/ui/tools/multimeter.ts`:
```typescript
import type { Side, V2 } from '../../types';
import type { ToolContext, WorkbenchTool } from './tool';

export type DmmMode = 'VDC' | 'VAC' | 'OHMS' | 'DIODE' | 'CAP' | 'CURRENT';

export interface ProbeState {
  pos: V2;
  side: Side;
  net?: string;
}

export class MultimeterTool implements WorkbenchTool {
  readonly id = 'dmm';
  mode: DmmMode = 'VDC';
  probeRed: ProbeState | null = null;
  probeBlack: ProbeState | null = null;
  private ctx: ToolContext | null = null;

  activate(context: ToolContext): void {
    this.ctx = context;
  }

  deactivate(): void {
    this.probeRed = null;
    this.probeBlack = null;
    this.ctx = null;
  }

  setMode(mode: DmmMode): void {
    this.mode = mode;
    this.ctx?.playAudio('click');
    this.ctx?.requestRender();
  }

  placeProbe(color: 'red' | 'black', pos: V2, side: Side, net?: string): void {
    if (color === 'red') {
      this.probeRed = { pos, side, net };
    } else {
      this.probeBlack = { pos, side, net };
    }
    this.ctx?.playAudio('probe_contact');
    this.ctx?.requestRender();
  }

  liftProbes(): void {
    this.probeRed = null;
    this.probeBlack = null;
    this.ctx?.requestRender();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx test/tools.test.ts`  
Expected: PASS with "tools.test.ts: WorkbenchTool interface & MultimeterTool controller — ok"

- [ ] **Step 5: Commit**

```bash
git add src/ui/tools/tool.ts src/ui/tools/multimeter.ts test/tools.test.ts
git commit -m "feat(ui): add WorkbenchTool contract and MultimeterTool controller"
```

---

### Task 6: Additional Tool Controllers (Scope, Thermal, Rework)

**Files:**
- Create: `src/ui/tools/oscilloscope.ts`
- Create: `src/ui/tools/thermal.ts`
- Create: `src/ui/tools/rework.ts`
- Modify: `test/tools.test.ts`

**Interfaces:**
- Produces: `OscilloscopeTool`, `ThermalTool`, `ReworkTool` implementing `WorkbenchTool`

- [ ] **Step 1: Write test additions in `test/tools.test.ts`**

Append to `test/tools.test.ts`:
```typescript
import { OscilloscopeTool } from '../src/ui/tools/oscilloscope';
import { ThermalTool } from '../src/ui/tools/thermal';
import { ReworkTool } from '../src/ui/tools/rework';

// Scope testing
const scope = new OscilloscopeTool();
assert(scope.id === 'scope', 'Scope id must be scope');
scope.activate(ctx);
scope.setTimebase(0.001); // 1ms
assert(scope.timebase === 0.001, 'Timebase must update');
scope.deactivate();

// Thermal testing
const thermal = new ThermalTool();
assert(thermal.id === 'thermal', 'Thermal tool id must be thermal');
thermal.activate(ctx);
thermal.setPalette('ironbow');
assert(thermal.palette === 'ironbow', 'Palette must update');
thermal.deactivate();

// Rework testing
const rework = new ReworkTool();
assert(rework.id === 'iron', 'Rework tool id must be iron');
rework.activate(ctx);
rework.setTemp(350);
assert(rework.tempC === 350, 'Iron temp must be 350C');
rework.deactivate();

console.log('tools.test.ts: Scope, Thermal and Rework controllers — ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx test/tools.test.ts`  
Expected: FAIL with "Cannot find module '../src/ui/tools/oscilloscope'"

- [ ] **Step 3: Write implementations**

Create `src/ui/tools/oscilloscope.ts`:
```typescript
import type { ToolContext, WorkbenchTool } from './tool';

export class OscilloscopeTool implements WorkbenchTool {
  readonly id = 'scope';
  timebase = 0.005; // 5ms per division
  ch1VoltsPerDiv = 1.0;
  ch2VoltsPerDiv = 1.0;
  triggerLevel = 1.65;
  running = true;
  private ctx: ToolContext | null = null;

  activate(context: ToolContext): void { this.ctx = context; }
  deactivate(): void { this.ctx = null; }

  setTimebase(seconds: number): void {
    this.timebase = seconds;
    this.ctx?.requestRender();
  }

  toggleRun(): boolean {
    this.running = !this.running;
    this.ctx?.requestRender();
    return this.running;
  }
}
```

Create `src/ui/tools/thermal.ts`:
```typescript
import type { ToolContext, WorkbenchTool } from './tool';

export type ThermalPalette = 'ironbow' | 'rainbow' | 'grayscale';

export class ThermalTool implements WorkbenchTool {
  readonly id = 'thermal';
  palette: ThermalPalette = 'ironbow';
  minTempC = 20;
  maxTempC = 80;
  private ctx: ToolContext | null = null;

  activate(context: ToolContext): void { this.ctx = context; }
  deactivate(): void { this.ctx = null; }

  setPalette(p: ThermalPalette): void {
    this.palette = p;
    this.ctx?.requestRender();
  }
}
```

Create `src/ui/tools/rework.ts`:
```typescript
import type { ToolContext, WorkbenchTool } from './tool';

export class ReworkTool implements WorkbenchTool {
  readonly id = 'iron';
  tempC = 350;
  hasFlux = false;
  hasWick = false;
  private ctx: ToolContext | null = null;

  activate(context: ToolContext): void { this.ctx = context; }
  deactivate(): void { this.ctx = null; }

  setTemp(t: number): void {
    this.tempC = t;
    this.ctx?.requestRender();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx test/tools.test.ts`  
Expected: PASS with "tools.test.ts: Scope, Thermal and Rework controllers — ok"

- [ ] **Step 5: Commit**

```bash
git add src/ui/tools/oscilloscope.ts src/ui/tools/thermal.ts src/ui/tools/rework.ts test/tools.test.ts
git commit -m "feat(ui): add Scope, Thermal and Rework tool controllers"
```

---

### Task 7: Full Integration, TypeScript Strictness & CI Pipeline

**Files:**
- Modify: `package.json`
- Test: All 29 test suites (`npm test`)
- Build: `npm run build`

**Interfaces:**
- Connects: Add `test/units.test.ts`, `test/components.test.ts`, `test/gerber.test.ts`, `test/autorouter.test.ts`, and `test/tools.test.ts` into `package.json`'s `npm test` script.

- [ ] **Step 1: Update `package.json` test script**

Ensure all 5 new test suites run as part of `npm test`:
```json
"test": "tsx test/solve.test.ts && tsx test/spice.test.ts && tsx test/schematic.test.ts && tsx test/powertree.test.ts && tsx test/realism.test.ts && tsx test/thermal.test.ts && tsx test/intermittent.test.ts && tsx test/rework.test.ts && tsx test/authoring.test.ts && tsx test/boot.test.ts && tsx test/scope.test.ts && tsx test/camera.test.ts && tsx test/calibrate.test.ts && tsx test/kicad.test.ts && tsx test/demos.test.ts && tsx test/videos.test.ts && tsx test/mods.test.ts && tsx test/touch.test.ts && tsx test/i18n.test.ts && tsx test/catalog.test.ts && tsx test/partsbin.test.ts && tsx test/boardCreator.test.ts && tsx test/presets.test.ts && tsx test/hero3d.test.ts && tsx test/drc.test.ts && tsx test/units.test.ts && tsx test/components.test.ts && tsx test/gerber.test.ts && tsx test/autorouter.test.ts && tsx test/tools.test.ts"
```

- [ ] **Step 2: Run all test suites**

Run: `npm test`  
Expected: 100% PASS across all 30 test suites (0 fail).

- [ ] **Step 3: Run TypeScript compiler check**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 4: Run production build**

Run: `npm run build`  
Expected: Build succeeds cleanly with Vite bundle outputs.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore: integrate all new test suites into CI pipeline"
```
