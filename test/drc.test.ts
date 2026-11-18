// Unit tests for Design Rule Check (DRC) engine in Deadboard PCB Studio
import { checkDrc, buildCustomScenario, type PlacedComponent, type DrcResult } from '../src/ui/boardCreator';
import type { Board, Component, ComponentKind, Trace } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`DRC Test Failed: ${message}`);
  }
}

console.log('Running Deadboard DRC (Design Rule Check) test suite...');

// Helper to create a minimal valid Board adhering to Board interface
function createTestBoard(
  width = 100,
  height = 80,
  components: Component[] = [],
  traces: Trace[] = []
): Board {
  return {
    w: width,
    h: height,
    thickness: 1.6,
    color: '#0b2b40',
    components,
    traces,
    vias: [],
    blobs: [],
    jumpers: [],
    zones: [],
    silk: [],
    texts: [],
    nextId: 100,
  };
}

// Helper to create a typed Component
function createComp(opts: {
  id: string;
  ref: string;
  kind?: ComponentKind;
  at: [number, number];
  rot?: number;
  w?: number;
  h?: number;
  pins?: Record<string, string>;
  value?: number;
}): Component {
  return {
    id: opts.id,
    ref: opts.ref,
    kind: opts.kind || 'generic',
    value: opts.value ?? 0,
    at: opts.at,
    rot: opts.rot ?? 0,
    side: 'F',
    pads: [],
    pins: opts.pins || {},
    body: {
      shape: 'box',
      w: opts.w ?? 2.0,
      h: opts.h ?? 1.25,
      z: 1.0,
    },
    state: {
      populated: true,
      reversed: false,
      burnt: false,
      cold: [],
    },
  };
}

// -------------------------------------------------------------
// 1. Clean valid board passes DRC
// -------------------------------------------------------------
{
  const components: PlacedComponent[] = [
    { id: 'j1', partId: 'generic-header-5v', ref: 'J1', x: 10, y: 40, rotation: 0, value: 5.0, name: '5V In' },
    { id: 'r1', partId: 'res-smd-0805-10k', ref: 'R1', x: 25, y: 40, rotation: 0, value: 1000, name: '1k Res' },
    { id: 'd1', partId: 'generic-led', ref: 'D1', x: 40, y: 40, rotation: 0, value: 0, name: 'LED' },
    { id: 'c1', partId: 'cap-mlcc-0805-100n', ref: 'C1', x: 55, y: 40, rotation: 0, value: 1e-7, name: 'Cap' },
  ];

  const sc = buildCustomScenario({
    presetId: 'custom-blank',
    width: 100,
    height: 80,
    color: '#0b2b40',
    placedComponents: components,
    fault: 'none',
  });

  const res: DrcResult = checkDrc(sc.board);
  assert(res.passed === true, 'Properly routed custom board must pass DRC');
  assert(res.errors.length === 0, `Expected 0 errors, got: ${res.errors.join('; ')}`);
}

// -------------------------------------------------------------
// 2. Component Overlap / Collision Detection
// -------------------------------------------------------------
{
  // 2a. Direct overlap of two 0805 components
  const board = createTestBoard(
    100,
    80,
    [
      createComp({
        id: 'p1',
        kind: 'battery',
        ref: 'J1',
        at: [10, 40],
        w: 5,
        h: 8,
        pins: { '+': 'VCC', '-': 'GND' },
      }),
      createComp({
        id: 'r1',
        kind: 'resistor',
        ref: 'R1',
        at: [30, 40],
        w: 2.0,
        h: 1.25,
        pins: { 1: 'NET1', 2: 'NET2' },
      }),
      createComp({
        id: 'r2',
        kind: 'resistor',
        ref: 'R2',
        at: [30.1, 40.1], // Direct collision with R1
        w: 2.0,
        h: 1.25,
        pins: { 1: 'NET2', 2: 'GND' },
      }),
    ],
    [
      { id: 't1', net: 'VCC', layer: 'F', a: [10, 40], b: [20, 40], w: 0.5 },
      { id: 't2', net: 'GND', layer: 'F', a: [10, 40], b: [30, 40], w: 0.5 },
    ]
  );

  const res = checkDrc(board);
  assert(res.passed === false, 'Overlapping components must fail DRC');
  assert(
    res.errors.some((e) => e.includes('R1') && e.includes('R2')),
    'DRC error must mention both colliding components R1 and R2'
  );

  // 2b. Rotation-aware collision detection (90 degree rotation swaps w and h)
  const boardRot = createTestBoard(
    100,
    80,
    [
      createComp({
        id: 'p1',
        kind: 'battery',
        ref: 'J1',
        at: [10, 40],
        w: 5,
        h: 8,
        pins: { '+': 'VCC', '-': 'GND' },
      }),
      createComp({
        id: 'u1',
        kind: 'ic',
        ref: 'U1',
        at: [40, 40],
        rot: 90, // rot=90: effective w=12.0, effective h=20.0
        w: 20.0,
        h: 12.0,
        pins: { 1: 'VCC', 2: 'GND' },
      }),
      createComp({
        id: 'c1',
        kind: 'capacitor',
        ref: 'C1',
        at: [40, 47], // Y=47 is within U1 height range (40 - 10 to 40 + 10 = 30..50)
        w: 2.0,
        h: 1.25,
        pins: { 1: 'VCC', 2: 'GND' },
      }),
    ],
    [{ id: 't1', net: 'VCC', layer: 'F', a: [10, 40], b: [40, 40], w: 0.5 }]
  );

  const resRot = checkDrc(boardRot);
  assert(resRot.passed === false, 'Rotated component overlap must be detected by DRC');
  assert(
    resRot.errors.some((e) => e.includes('U1') && e.includes('C1')),
    'DRC error must report collision between U1 and C1'
  );

  // 2c. Adequate clearance (no collision)
  const boardClear = createTestBoard(
    100,
    80,
    [
      createComp({
        id: 'p1',
        kind: 'battery',
        ref: 'J1',
        at: [10, 40],
        w: 5,
        h: 8,
        pins: { '+': 'VCC', '-': 'GND' },
      }),
      createComp({
        id: 'r1',
        kind: 'resistor',
        ref: 'R1',
        at: [30, 40],
        w: 2.0,
        h: 1.25,
        pins: { 1: 'NET1', 2: 'GND' },
      }),
      createComp({
        id: 'r2',
        kind: 'resistor',
        ref: 'R2',
        at: [34, 40], // Distance 4mm > clearance requirement
        w: 2.0,
        h: 1.25,
        pins: { 1: 'NET1', 2: 'GND' },
      }),
    ],
    [{ id: 't1', net: 'GND', layer: 'F', a: [10, 40], b: [30, 40], w: 0.5 }]
  );

  const resClear = checkDrc(boardClear);
  assert(!resClear.errors.some((e) => e.includes('R1') && e.includes('R2')), 'Sufficiently separated components do not collide');
}

// -------------------------------------------------------------
// 3. Board Edge Margin Violations (< 1.0mm margin)
// -------------------------------------------------------------
{
  const boardW = 50;
  const boardH = 40;

  // 3a. Left edge violation (minX < 1.0mm)
  // For body w=2.0, centered at x=1.5 -> minX = 1.5 - 1.0 = 0.5mm < 1.0mm
  const leftEdgeBoard = createTestBoard(boardW, boardH, [
    createComp({
      id: 'p1',
      kind: 'battery',
      ref: 'J1',
      at: [20, 20],
      w: 4,
      h: 4,
      pins: { '+': 'VCC', '-': 'GND' },
    }),
    createComp({
      id: 'r1',
      kind: 'resistor',
      ref: 'R1',
      at: [1.5, 20],
      w: 2.0,
      h: 1.25,
      pins: { 1: 'VCC', 2: 'GND' },
    }),
  ], [{ id: 't1', net: 'GND', layer: 'F', a: [20, 20], b: [1.5, 20], w: 0.5 }]);

  const resLeft = checkDrc(leftEdgeBoard);
  assert(resLeft.passed === false, 'Left edge violation must fail DRC');
  assert(
    resLeft.errors.some((e) => (e.includes('krawędzi') || e.includes('Edge')) && e.includes('R1')),
    'DRC error must report R1 near edge'
  );

  // 3b. Right edge violation (board.w - maxX < 1.0mm)
  // boardW = 50. For body w=2.0, centered at x=49.5 -> maxX = 50.5 -> outside/too close
  const rightEdgeBoard = createTestBoard(boardW, boardH, [
    createComp({
      id: 'p1',
      kind: 'battery',
      ref: 'J1',
      at: [20, 20],
      w: 4,
      h: 4,
      pins: { '+': 'VCC', '-': 'GND' },
    }),
    createComp({
      id: 'r2',
      kind: 'resistor',
      ref: 'R2',
      at: [49.5, 20],
      w: 2.0,
      h: 1.25,
      pins: { 1: 'VCC', 2: 'GND' },
    }),
  ], [{ id: 't1', net: 'GND', layer: 'F', a: [20, 20], b: [49.5, 20], w: 0.5 }]);

  const resRight = checkDrc(rightEdgeBoard);
  assert(resRight.passed === false, 'Right edge violation must fail DRC');
  assert(
    resRight.errors.some((e) => (e.includes('krawędzi') || e.includes('Edge')) && e.includes('R2')),
    'DRC error must report R2 near right edge'
  );

  // 3c. Top edge violation (minY < 1.0mm)
  const topEdgeBoard = createTestBoard(boardW, boardH, [
    createComp({
      id: 'p1',
      kind: 'battery',
      ref: 'J1',
      at: [20, 20],
      w: 4,
      h: 4,
      pins: { '+': 'VCC', '-': 'GND' },
    }),
    createComp({
      id: 'r3',
      kind: 'resistor',
      ref: 'R3',
      at: [20, 1.0], // h=1.25 -> minY = 1.0 - 0.625 = 0.375mm < 1.0mm
      w: 2.0,
      h: 1.25,
      pins: { 1: 'VCC', 2: 'GND' },
    }),
  ], [{ id: 't1', net: 'GND', layer: 'F', a: [20, 20], b: [20, 1.0], w: 0.5 }]);

  const resTop = checkDrc(topEdgeBoard);
  assert(resTop.passed === false, 'Top edge violation must fail DRC');
  assert(
    resTop.errors.some((e) => (e.includes('krawędzi') || e.includes('Edge')) && e.includes('R3')),
    'DRC error must report R3 near top edge'
  );

  // 3d. Bottom edge violation (board.h - maxY < 1.0mm)
  const bottomEdgeBoard = createTestBoard(boardW, boardH, [
    createComp({
      id: 'p1',
      kind: 'battery',
      ref: 'J1',
      at: [20, 20],
      w: 4,
      h: 4,
      pins: { '+': 'VCC', '-': 'GND' },
    }),
    createComp({
      id: 'r4',
      kind: 'resistor',
      ref: 'R4',
      at: [20, 39.5], // boardH=40, maxY = 39.5 + 0.625 = 40.125 > 39.0
      w: 2.0,
      h: 1.25,
      pins: { 1: 'VCC', 2: 'GND' },
    }),
  ], [{ id: 't1', net: 'GND', layer: 'F', a: [20, 20], b: [20, 39.5], w: 0.5 }]);

  const resBottom = checkDrc(bottomEdgeBoard);
  assert(resBottom.passed === false, 'Bottom edge violation must fail DRC');
  assert(
    resBottom.errors.some((e) => (e.includes('krawędzi') || e.includes('Edge')) && e.includes('R4')),
    'DRC error must report R4 near bottom edge'
  );
}

// -------------------------------------------------------------
// 4. Power & Ground Integrity Checks
// -------------------------------------------------------------
{
  // 4a. Empty board
  const emptyBoard = createTestBoard(50, 50, [], []);
  const resEmpty = checkDrc(emptyBoard);
  assert(resEmpty.warnings.length > 0, 'Empty board must produce a warning');

  // 4b. Board with no power source and no power trace
  const noPowerBoard = createTestBoard(
    60,
    40,
    [
      createComp({
        id: 'r1',
        kind: 'resistor',
        ref: 'R1',
        at: [20, 20],
        w: 2.0,
        h: 1.25,
        pins: { 1: 'SIGNAL_A', 2: 'GND' },
      }),
    ],
    [{ id: 't1', net: 'GND', layer: 'F', a: [20, 20], b: [30, 20], w: 0.5 }]
  );

  const resNoPower = checkDrc(noPowerBoard);
  assert(resNoPower.passed === false, 'Board without power source must fail DRC');
  assert(
    resNoPower.errors.some((e) => e.includes('zasilania') || e.includes('power')),
    'DRC error must report missing power connection'
  );

  // 4c. Board with no ground connection
  const noGndBoard = createTestBoard(
    60,
    40,
    [
      createComp({
        id: 'p1',
        kind: 'battery',
        ref: 'J1',
        at: [15, 20],
        w: 4,
        h: 4,
        pins: { '+': 'VCC' }, // No '-' pin
      }),
      createComp({
        id: 'r1',
        kind: 'resistor',
        ref: 'R1',
        at: [30, 20],
        w: 2.0,
        h: 1.25,
        pins: { 1: 'VCC', 2: 'SIG' },
      }),
    ],
    [{ id: 't1', net: 'VCC', layer: 'F', a: [15, 20], b: [30, 20], w: 0.5 }]
  );

  const resNoGnd = checkDrc(noGndBoard);
  assert(resNoGnd.passed === false, 'Board without ground reference must fail DRC');
  assert(
    resNoGnd.errors.some((e) => e.includes('GND') || e.includes('masy') || e.includes('ground')),
    'DRC error must report missing ground connection'
  );
}

// -------------------------------------------------------------
// 5. Multiple simultaneous DRC violations
// -------------------------------------------------------------
{
  const multiViolationBoard = createTestBoard(
    40,
    30,
    [
      // Overlapping R1 and R2
      createComp({
        id: 'r1',
        kind: 'resistor',
        ref: 'R1',
        at: [20, 15],
        w: 2.0,
        h: 1.25,
        pins: { 1: 'NET1', 2: 'NET2' },
      }),
      createComp({
        id: 'r2',
        kind: 'resistor',
        ref: 'R2',
        at: [20.2, 15.1],
        w: 2.0,
        h: 1.25,
        pins: { 1: 'NET2', 2: 'NET3' },
      }),
      // C1 violating left edge margin (< 1.0mm)
      createComp({
        id: 'c1',
        kind: 'capacitor',
        ref: 'C1',
        at: [1.2, 15], // minX = 1.2 - 1.0 = 0.2 < 1.0mm
        w: 2.0,
        h: 1.25,
        pins: { 1: 'NET3', 2: 'NET4' },
      }),
    ],
    []
  );

  const multiRes = checkDrc(multiViolationBoard);
  assert(multiRes.passed === false, 'Multi-violation board must fail DRC');
  assert(multiRes.errors.length >= 3, `Expected at least 3 errors (collision, edge, power/gnd), got ${multiRes.errors.length}`);
}

console.log('Deadboard DRC test suite: all collision, edge clearance, and net integrity checks PASSED cleanly!');
