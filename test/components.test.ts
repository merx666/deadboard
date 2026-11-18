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

const dummyUnion: TypedComponent = dummyResistor;
assert(isResistor(dummyUnion), 'isResistor guard must identify resistor on union');
assert(isResistor(dummyResistor), 'isResistor guard must identify resistor');
assert(!isResistor(dummyLed), 'isResistor guard must reject LED');
assert(isLed(dummyLed), 'isLed guard must identify LED');
assert(!isIc(dummyResistor), 'isIc guard must reject resistor');

console.log('components.test.ts: discriminated component unions & type guards — ok');
