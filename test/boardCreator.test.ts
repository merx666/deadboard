// Unit tests for Custom PCB Board Creator and Scenario Generation
import {
  buildCustomScenario,
  getFootprint,
  detectCollisions,
  getPartEstimatedCost,
  generateBomCsv,
  generateCplCsv,
  getResistorCode,
  type PlacedComponent,
  type FaultKind,
} from '../src/ui/boardCreator';
import { BOARD_PRESETS } from '../src/boards/presets';
import { simulateSpice } from '../src/spice/adapter';
import { buildConnectivity } from '../src/connectivity';

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error(m);
}

// 1. Test getFootprint for various part kinds
const rFp = getFootprint('res-smd-0805-10k', { id: '1', partId: 'res-smd-0805-10k', ref: 'R1', x: 10, y: 10, rotation: 0, name: 'R1' });
assert(rFp.padsCount === 2, 'Resistor footprint has 2 pads');
assert(rFp.w > 0 && rFp.h > 0, 'Resistor footprint has valid dimensions');

const espFp = getFootprint('esp32-wroom-32d', { id: '2', partId: 'esp32-wroom-32d', ref: 'U1', x: 20, y: 20, rotation: 0, name: 'U1' });
assert(espFp.padsCount === 38, 'ESP32 footprint has 38 pads');
assert(espFp.shape === 'chip', 'ESP32 footprint has chip shape');

// 2. Test building a custom blank board from scratch
const customComponents: PlacedComponent[] = [
  { id: 'c1', partId: 'generic-header-5v', ref: 'J1', x: 10, y: 25, rotation: 0, value: 5.0, name: 'USB 5V Header' },
  { id: 'c2', partId: 'res-smd-0805-10k', ref: 'R1', x: 25, y: 25, rotation: 0, value: 1000, name: '1k Resistor' },
  { id: 'c3', partId: 'generic-led', ref: 'D1', x: 40, y: 25, rotation: 0, value: 0, name: 'Red LED' },
  { id: 'c4', partId: 'cap-mlcc-0805-100n', ref: 'C1', x: 55, y: 25, rotation: 0, value: 1e-7, name: '100nF Decoupling' },
  { id: 'c5', partId: 'ams1117-33', ref: 'U1', x: 70, y: 25, rotation: 0, value: 3.3, name: 'AMS1117-3.3' },
];

const customSc = buildCustomScenario({
  presetId: 'custom-blank',
  width: 90,
  height: 50,
  color: '#0b2b40',
  placedComponents: customComponents,
  fault: 'none',
});

assert(customSc.board.w === 90, 'Custom board width matches');
assert(customSc.board.h === 50, 'Custom board height matches');
assert(customSc.board.color === '#0b2b40', 'Custom board color matches');
assert(customSc.board.components.length === 5, 'All 5 components placed on custom board');
assert(customSc.board.traces.length > 0, 'Custom board has routed copper traces');

// Verify components have valid pins and pads
const j1 = customSc.board.components.find((c) => c.ref === 'J1')!;
assert(j1.kind === 'battery' && j1.value === 5.0, 'J1 is a 5V power source');
assert(j1.pins['+'] && j1.pins['-'], 'J1 has + and - pin assignments');

const r1 = customSc.board.components.find((c) => c.ref === 'R1')!;
assert(r1.kind === 'resistor' && r1.value === 1000, 'R1 is a 1k resistor');

const d1 = customSc.board.components.find((c) => c.ref === 'D1')!;
assert(d1.kind === 'led', 'D1 is an LED');
assert(d1.pins['A'] && d1.pins['K'], 'D1 has A and K pins');

const c1 = customSc.board.components.find((c) => c.ref === 'C1')!;
assert(c1.kind === 'capacitor', 'C1 is a capacitor');

// Check connectivity & SPICE solvability of the generated custom board
const conn = buildConnectivity(customSc.board);
assert(conn.netNames.length > 0, 'Connectivity produces nets');
const spiceRes = simulateSpice(customSc.board, conn);
assert(spiceRes.V.length > 0, 'SPICE simulation completes on custom board');

// 3. Test Fault Injections on Custom Board
const faultsToTest: FaultKind[] = ['short-rail', 'cold-joint', 'reversed-diode', 'blown-fuse'];
for (const f of faultsToTest) {
  const faultSc = buildCustomScenario({
    presetId: 'custom-blank',
    width: 90,
    height: 50,
    color: '#124422',
    placedComponents: [
      { id: 'c1', partId: 'generic-header-5v', ref: 'J1', x: 10, y: 25, rotation: 0, value: 5.0, name: 'USB IN' },
      { id: 'c2', partId: 'fuse-smd-1206-1a', ref: 'F1', x: 20, y: 25, rotation: 0, value: 1.0, name: 'Fuse' },
      { id: 'c3', partId: 'cap-mlcc-0805-10u', ref: 'C1', x: 30, y: 25, rotation: 0, value: 1e-5, name: 'Cap' },
      { id: 'c4', partId: 'res-smd-0805-10k', ref: 'R1', x: 40, y: 25, rotation: 0, value: 1000, name: 'Resistor' },
      { id: 'c5', partId: 'generic-led', ref: 'D1', x: 50, y: 25, rotation: 0, value: 0, name: 'LED' },
    ],
    fault: f,
  });

  if (f === 'short-rail') {
    const cap = faultSc.board.components.find((c) => c.ref === 'C1')!;
    assert(cap.state.leak?.ohms === 0.2, 'Short-rail fault injects 0.2 ohm leak on cap');
  } else if (f === 'cold-joint') {
    const res = faultSc.board.components.find((c) => c.ref === 'R1')!;
    assert(res.state.cold.includes(0), 'Cold-joint fault injects cold solder joint on resistor');
  } else if (f === 'reversed-diode') {
    const led = faultSc.board.components.find((c) => c.ref === 'D1')!;
    assert(led.state.reversed === true, 'Reversed-diode fault reverses LED polarity');
  } else if (f === 'blown-fuse') {
    const fuse = faultSc.board.components.find((c) => c.ref === 'F1')!;
    assert(fuse.state.burnt === true, 'Blown-fuse fault burns fuse');
  }
}

// 4. Test Modifying a Preset Board
const presetId = 'preset-esp32-devkit';
const basePreset = BOARD_PRESETS.find((p) => p.id === presetId)!;
const baseSc = basePreset.create();
const originalCount = baseSc.board.components.length;

// Delete first component, move second component, add a new component
const modifiedPlaced: PlacedComponent[] = baseSc.board.components.slice(1).map((c) => ({
  id: c.id,
  partId: 'generic',
  ref: c.ref,
  x: c.at[0] + 5,
  y: c.at[1] + 5,
  rotation: 90 as const,
  value: c.value,
  name: c.label || c.ref,
}));

// Add a new part from catalog
modifiedPlaced.push({
  id: 'new-c99',
  partId: 'cap-mlcc-0805-100n',
  ref: 'C99',
  x: 50,
  y: 10,
  rotation: 180 as const,
  value: 1e-7,
  name: 'Extra 100nF Cap',
});

const updatedPresetSc = buildCustomScenario({
  presetId,
  width: 100,
  height: 60,
  color: '#301538',
  placedComponents: modifiedPlaced,
  fault: 'none',
});

assert(updatedPresetSc.board.w === 100, 'Updated preset width is 100mm');
assert(updatedPresetSc.board.h === 60, 'Updated preset height is 60mm');
assert(updatedPresetSc.board.color === '#301538', 'Updated preset color is OSH Park purple');
assert(updatedPresetSc.board.components.length === originalCount, 'Deleted 1, added 1 -> total component count matches');

const c99 = updatedPresetSc.board.components.find((c) => c.ref === 'C99');
assert(c99 !== undefined, 'Newly added component C99 exists on board');
assert(c99.at[0] === 50 && c99.at[1] === 10, 'C99 placed at [50, 10]');
assert(c99.rot === 180, 'C99 has rotation 180');

// 5. Test EIA 3-digit resistor code calculation
assert(getResistorCode(10000) === '103', '10k ohm resistor has code 103');
assert(getResistorCode(1000) === '102', '1k ohm resistor has code 102');
assert(getResistorCode(100000) === '104', '100k ohm resistor has code 104');
assert(getResistorCode(0) === '000', '0 ohm jumper has code 000');

// 6. Test DFM collision detection
const noOverlap: PlacedComponent[] = [
  { id: 'p1', partId: 'res-smd-0805-10k', ref: 'R1', x: 10, y: 10, rotation: 0, name: 'R1' },
  { id: 'p2', partId: 'res-smd-0805-10k', ref: 'R2', x: 30, y: 30, rotation: 0, name: 'R2' },
];
assert(detectCollisions(noOverlap).size === 0, 'Separated components do not collide');

const overlapping: PlacedComponent[] = [
  { id: 'p1', partId: 'res-smd-0805-10k', ref: 'R1', x: 20, y: 20, rotation: 0, name: 'R1' },
  { id: 'p2', partId: 'cap-mlcc-0805-100n', ref: 'C1', x: 20.5, y: 20.2, rotation: 0, name: 'C1' },
];
const colSet = detectCollisions(overlapping);
assert(colSet.has('p1') && colSet.has('p2'), 'Overlapping components detected as colliding');

// 7. Test component pricing estimation
const espPricing = getPartEstimatedCost('esp32-wroom-32d', { id: 'e1', partId: 'esp32-wroom-32d', ref: 'U1', x: 0, y: 0, rotation: 0, name: 'ESP32' });
assert(espPricing.unitPriceUsd > 2.0 && espPricing.unitPriceUsd < 5.0, 'ESP32 has realistic unit price');
assert(espPricing.lcsc === 'C473012', 'ESP32 has valid LCSC part number');

const rPricing = getPartEstimatedCost('res-smd-0805-10k', { id: 'r1', partId: 'res-smd-0805-10k', ref: 'R1', x: 0, y: 0, rotation: 0, name: 'R1' });
assert(rPricing.unitPriceUsd <= 0.05, '0805 Resistor has penny unit price');

// 8. Test BOM and CPL CSV export generation
const bomCsv = generateBomCsv(customComponents);
assert(bomCsv.includes('Item,Designator,Quantity,Part Number'), 'BOM CSV header valid');
assert(bomCsv.includes('J1') && bomCsv.includes('R1') && bomCsv.includes('D1'), 'BOM CSV includes component designators');

const cplCsv = generateCplCsv(customComponents);
assert(cplCsv.includes('Designator,Mid X,Mid Y,Layer,Rotation'), 'CPL CSV header valid');
assert(cplCsv.includes('"J1",10.00,25.00,Top,0'), 'CPL CSV contains J1 placement coordinates');

console.log('BoardCreator: custom blank PCB generation, component footprints, trace routing, fault injection, preset customization, collision detection, and production estimator — ok');
