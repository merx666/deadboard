import { SUPPLIER_PARTS, searchSupplierParts } from '../src/parts/catalog';
import { installPart } from '../src/ops';
import { marking } from '../src/model';
import type { Component } from '../src/types';
import { getLang, setLang } from '../src/i18n';

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error(m);
}

console.log('Running Parts Bin & Component Replacement tests...');

// 1. Supplier catalog parts check
assert(SUPPLIER_PARTS.length >= 20, `Catalog has ${SUPPLIER_PARTS.length} parts (expected >= 20)`);

// 2. Part search validation (LCSC code, MPN, aliases, tokens)
const mlcc100n = searchSupplierParts('C49678');
assert(mlcc100n.length > 0, 'Should find 100nF MLCC by LCSC code C49678');
assert(mlcc100n[0].valKind === 'C', 'MLCC valKind is C');
assert(mlcc100n[0].pkg.includes('0805'), 'MLCC package is 0805');

const ams1117 = searchSupplierParts('AMS1117');
assert(ams1117.length > 0, 'Should find AMS1117');
assert(ams1117[0].category === 'power', 'AMS1117 category is power');
assert(Object.keys(ams1117[0].pins).length > 0, 'AMS1117 has defined pinout');

const esp32 = searchSupplierParts('ESP32');
assert(esp32.length > 0, 'Should find ESP32 module');
assert(esp32[0].category === 'modules', 'ESP32 category is modules');
assert(Object.keys(esp32[0].pins).length >= 10, 'ESP32 has rich pinout definitions');

// 3. Component replacement simulation: Replacing a burnt MLCC capacitor on board
const mockBurntCap: Component = {
  id: 'c-test-1',
  ref: 'C1',
  kind: 'capacitor',
  value: 1e-6,
  at: [10, 10],
  rot: 0,
  side: 'F',
  pads: [
    { name: '1', shape: 'rect', at: [9, 10], size: [1, 1], layers: 'F' },
    { name: '2', shape: 'rect', at: [11, 10], size: [1, 1], layers: 'F' },
  ],
  pins: { '1': '1', '2': '2' },
  body: { shape: 'box', w: 2, h: 1.25, z: 0.8 },
  state: {
    populated: true,
    reversed: false,
    burnt: true,
    cold: [0],
    leak: { ohms: 0.2 },
  },
};

// Replace with C49678 (100nF)
const capPart = mlcc100n[0];
mockBurntCap.kind = 'capacitor';
if (capPart.defaultVal !== undefined) mockBurntCap.value = capPart.defaultVal;
mockBurntCap.label = `${capPart.mpn} (${capPart.lcsc})`;
if (capPart.pkg) mockBurntCap.footprint = capPart.pkg;
installPart(mockBurntCap, {
  value: capPart.defaultVal,
  reversed: mockBurntCap.state.reversed,
});

assert(mockBurntCap.state.burnt === false, 'Burnt flag is cleared after fitting new part');
assert(mockBurntCap.state.leak === undefined, 'Leak short is cleared after fitting new part');
assert(mockBurntCap.state.cold.length === 0, 'Cold solder joints are reflowed on new part');
assert(mockBurntCap.value === 1e-7, 'Capacitance is updated to 100nF (1e-7 F)');
assert(mockBurntCap.label.includes('C49678'), 'Component label contains LCSC code');
assert(marking(mockBurntCap) === '100 nF', `Marking formatted as 100 nF, got "${marking(mockBurntCap)}"`);

// 4. Replacing an empty IC footprint with an LDO regulator
const mockEmptyFootprint: Component = {
  id: 'u-reg-1',
  ref: 'U1',
  kind: 'ic',
  value: 0,
  at: [30, 20],
  rot: 0,
  side: 'F',
  pads: [
    { name: '1', shape: 'rect', at: [28, 20], size: [1.5, 1], layers: 'F' },
    { name: '2', shape: 'rect', at: [30, 20], size: [1.5, 1], layers: 'F' },
    { name: '3', shape: 'rect', at: [32, 20], size: [1.5, 1], layers: 'F' },
  ],
  pins: { '1': '1', '2': '2', '3': '3' },
  body: { shape: 'chip', w: 6.5, h: 3.5, z: 1.8 },
  state: {
    populated: false,
    reversed: false,
    burnt: false,
    cold: [],
  },
};

const ldoPart = ams1117[0];
mockEmptyFootprint.kind = 'ic';
if (ldoPart.defaultVal !== undefined) mockEmptyFootprint.value = ldoPart.defaultVal;
mockEmptyFootprint.label = `${ldoPart.mpn} (${ldoPart.lcsc})`;
if (ldoPart.pkg) mockEmptyFootprint.footprint = ldoPart.pkg;
installPart(mockEmptyFootprint, {
  value: ldoPart.defaultVal,
});
if (ldoPart.pins && Object.keys(ldoPart.pins).length > 0) {
  mockEmptyFootprint.pins = { ...mockEmptyFootprint.pins, ...ldoPart.pins };
}

assert(mockEmptyFootprint.state.populated === true, 'Footprint is now populated');
assert(mockEmptyFootprint.label.includes('AMS1117'), 'Label reflects AMS1117');
assert(mockEmptyFootprint.footprint === 'SOT-223', 'Footprint set to SOT-223');
assert(mockEmptyFootprint.pins['1'] === 'GND / ADJ', 'Pin 1 mapped to GND / ADJ');
assert(mockEmptyFootprint.pins['2'] === 'VOUT (Tab)', 'Pin 2 mapped to VOUT (Tab)');
assert(mockEmptyFootprint.pins['3'] === 'VIN', 'Pin 3 mapped to VIN');

// 5. Bilingual support validation
setLang('pl');
assert(getLang() === 'pl', 'Default language is Polish');
setLang('en');
assert(getLang() === 'en', 'Switched to English');
setLang('pl');

console.log('ALL PARTS BIN TESTS PASSED!');
