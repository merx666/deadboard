import { ohms, farads, volts, amps, mm, netId, componentId, type Ohms, type Volts } from '../src/types/units';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

// Test basic branding and value preservation
{
  const r: Ohms = ohms(10000);
  assert(r === 10000, 'Ohms constructor must preserve numeric value');
  assert(typeof r === 'number', 'Branded type must remain a number at runtime');

  const v: Volts = volts(3.3);
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
