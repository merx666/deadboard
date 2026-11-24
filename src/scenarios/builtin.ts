import type { Board, LedColor, Objective, Scenario, ScenarioMeta } from '../types';
import { buildConnectivity } from '../connectivity';
import { lockFlag, topology } from '../crypto';
import { addBlob, cutTrace, removePart } from '../ops';
import { Builder } from './builder';
import { realisticScenarios } from './realistic';

async function finalize(id: string, meta: ScenarioMeta, b: Board, objectives: Objective[], flag: string, sabotage: (b: Board) => void): Promise<Scenario> {
  const lock = await lockFlag(flag, topology(b, buildConnectivity(b), id));
  sabotage(b);
  return { format: 'pcbfix/1', id, meta, board: b, objectives, lock };
}

const on = (ref: string, sw?: Record<string, boolean>): Objective => ({ type: 'led', ref, on: true, switches: sw });
const off = (ref: string, sw?: Record<string, boolean>): Objective => ({ type: 'led', ref, on: false, switches: sw });

/** Minimal 3-part coin-cell + resistor + LED board used across beginner lessons 2–4. */
function coinLedBoard(color: LedColor, label: string): Builder {
  const k = new Builder(58, 36);
  const bt = k.coin('BT1', 3, [16, 18]);
  const r1 = k.resistor('R1', 100, [38, 26]);
  const d1 = k.led('D1', color, [48, 14]);
  k.track('F', [k.pad(bt, '1'), [4, 30], [32.92, 30], k.pad(r1, '1')], 0.8, '+3V');
  k.track('F', [k.pad(r1, '2'), [49.27, 26], k.pad(d1, '2')], 0.8, 'LED_A');
  k.track('F', [k.pad(d1, '1'), [46.73, 6], [28, 6], k.pad(bt, '2')], 0.8, 'GND');
  k.text([29, 2.5], label, 1.4);
  return k;
}

function firstLight() {
  const k = new Builder(66, 36);
  const bt = k.coin('BT1', 3, [17, 18]);
  k.tactile('SW1', [40, 27]);
  const r1 = k.resistor('R1', 100, [52, 27]);
  const d1 = k.led('D1', 'red', [56, 11]);
  k.track('F', [k.pad(bt, '1'), [5, 32], [36.75, 32], [36.75, 29.25]], 0.8, '+3V');
  k.track('F', [[43.25, 29.25], [46.92, 29.25], k.pad(r1, '1')], 0.8, 'SW_OUT');
  const t3 = k.track('F', [k.pad(r1, '2'), [62, 27], [62, 11], k.pad(d1, '2')], 0.8, 'LED_A');
  k.track('F', [k.pad(d1, '1'), [54.73, 5], [29, 5], k.pad(bt, '2')], 0.8, 'GND');
  k.text([14, 2.2], 'FIRST LIGHT  rev A', 1.4);
  return finalize('builtin-first-light', {
    title: 'First Light',
    author: 'DEADBOARD',
    difficulty: 1,
    description: 'A tiny flashlight: coin cell, push button, resistor, red LED. Pressing SW1 should light D1 — but nothing happens. Find the fault, repair it, then run the test bench.',
    hints: [
      'Power OFF and use the multimeter (Ω mode) to check continuity from R1 to D1.',
      'Look closely along the long vertical trace on the right edge.',
      'Use the soldering iron on the gap to drop a solder blob across it — or bridge it with a jumper wire.',
    ],
    par: 1,
  }, k.b, [on('D1', { SW1: true }), off('D1', { SW1: false })], 'PCB{f1rst_l1ght_s0ld3r_br1dg3d}',
  (b) => cutTrace(b, b.traces.find((t) => t.id === t3[1])!, [62, 19], 0.9));
}

function tutColdJoint() {
  const k = coinLedBoard('green', 'TUTORIAL 2  COLD JOINT');
  return finalize('builtin-tut-cold-joint', {
    title: 'Cold Joint 101',
    author: 'DEADBOARD Academy',
    difficulty: 1,
    description: 'Beginner Tutorial 2: Only three parts — coin cell BT1, 100 Ω resistor R1, and green LED D1. Every trace on top is intact, yet no current flows and D1 is dark. Flip the board to inspect how through-hole parts are soldered underneath.',
    hints: [
      'Press F (or click Bottom) to flip the board and inspect the solder joints.',
      'Pad R1.1 on the bottom is dull and grainy — a cold solder joint that never bonded.',
      'Select the Soldering iron (3) and click pad R1.1 on the Bottom side to reflow it.',
    ],
    par: 1,
  }, k.b, [on('D1')], 'PCB{c0ld_j01nt_r3fl0w3d_ok}',
  (b) => { b.components.find((c) => c.ref === 'R1')!.state.cold = [0]; });
}

function tutSolderBridge() {
  const k = coinLedBoard('red', 'TUTORIAL 3  SOLDER BRIDGE');
  return finalize('builtin-tut-solder-bridge', {
    title: 'Solder Bridge 101',
    author: 'DEADBOARD Academy',
    difficulty: 1,
    description: 'Beginner Tutorial 3: The battery is delivering ~28 mA, yet red LED D1 is completely dark! Learn the difference between an open circuit and a short circuit, and clean up excess solder with Desolder wick.',
    hints: [
      'Look at the Bench supply: ~28 mA is flowing, so electricity is taking a shortcut around D1.',
      'Flip to the Bottom side (F) and look between D1\'s two closely spaced pads.',
      'Use Desolder wick (4) to click and remove the solder blob bridging D1\'s legs.',
    ],
    par: 1,
  }, k.b, [on('D1')], 'PCB{s0ld3r_br1dg3_w1ck3d_cl34n}',
  (b) => { addBlob(b, [48, 14], 'B', 1.05); });
}

function tutPolarity() {
  const k = coinLedBoard('yellow', 'TUTORIAL 4  POLARITY');
  return finalize('builtin-tut-polarity', {
    title: 'One-Way LED',
    author: 'DEADBOARD Academy',
    difficulty: 1,
    description: 'Beginner Tutorial 4: Resistors work either way round, but diodes and LEDs are one-way valves (Anode + to Cathode K). Use the silkscreen markings and Multimeter Diode mode to spot and fix a reversed LED.',
    hints: [
      'Compare the flat cathode rim of D1 with the white silkscreen K marking.',
      'Turn Power OFF, switch the Multimeter (2) to Diode mode, and probe across D1 both ways.',
      'Use Rotate 180° (5) and click D1 to orient its cathode with the K mark.',
    ],
    par: 1,
  }, k.b, [on('D1')], 'PCB{4n0d3_t0_c4th0d3_fl1pp3d}',
  (b) => { b.components.find((c) => c.ref === 'D1')!.state.reversed = true; });
}

function tutResistor() {
  const k = new Builder(58, 36);
  const j1 = k.header('J1', 5, [8, 18], 0, 'USB 5V');
  const r1 = k.resistor('R1', 150, [29, 26]);
  const d1 = k.led('D1', 'blue', [46, 18]);
  k.track('F', [k.pad(j1, '1'), [14, 16.73], [14, 26], k.pad(r1, '1')], 0.8, '+5V');
  k.track('F', [k.pad(r1, '2'), [47.27, 26], k.pad(d1, '2')], 0.8, 'LED_A');
  k.track('F', [k.pad(d1, '1'), [44.73, 8], [14, 8], [14, 19.27], k.pad(j1, '2')], 0.8, 'GND');
  k.text([29, 2.5], 'TUTORIAL 5  OHMS LAW', 1.4);
  return finalize('builtin-tut-resistor', {
    title: 'Resistor & Ohm\'s Law',
    author: 'DEADBOARD Academy',
    difficulty: 1,
    description: 'Beginner Tutorial 5: A 5 V USB supply feeds blue LED D1 through resistor R1. The design calls for R1 = 150 Ω (~12 mA), but someone fitted a 100 kΩ resistor from the wrong bin, starving D1 to 0.02 mA.',
    hints: [
      'Select R1 to read its colour bands in the Inspector: brown-black-yellow is 100 kΩ!',
      'By Ohm\'s Law, I = (5 V − 3 V) / 150 Ω ≈ 13 mA is needed to light the blue LED.',
      'In the Inspector (or Parts bin 8), set R1\'s resistance to 150 Ω and click Apply.',
    ],
    par: 1,
  }, k.b, [on('D1')], 'PCB{0hms_l4w_curr3nt_l1m1t3r}',
  (b) => { b.components.find((c) => c.ref === 'R1')!.value = 100000; });
}

function tutDivider() {
  const k = new Builder(58, 36);
  const j1 = k.header('J1', 5, [8, 18], 0, '5V IN');
  const r1 = k.resistor('R1', 10000, [28, 26]);
  const r2 = k.resistor('R2', 10000, [28, 12]);
  const tp1 = k.testpoint('TP1', [46, 19], 'VOUT');
  const tp2 = k.testpoint('TP2', [46, 6], 'GND');
  k.track('F', [k.pad(j1, '1'), [14, 16.73], [14, 26], k.pad(r1, '1')], 0.8, '+5V');
  k.track('F', [k.pad(r1, '2'), [38, 26], [38, 19], k.pad(tp1, '1')], 0.8, 'VOUT');
  k.track('F', [[38, 19], [38, 12], k.pad(r2, '2')], 0.8, 'VOUT');
  k.track('F', [k.pad(j1, '2'), [14, 19.27], [14, 6], k.pad(tp2, '1')], 0.8, 'GND');
  k.track('F', [[22.92, 6], k.pad(r2, '1')], 0.8, 'GND');
  k.text([29, 32.5], 'TUTORIAL 6  2.5V DIVIDER', 1.4);
  return finalize('builtin-tut-divider', {
    title: 'Voltage Divider 101',
    author: 'DEADBOARD Academy',
    difficulty: 1,
    description: 'Beginner Tutorial 6: Not every circuit lights an LED — many split a supply rail to create a reference voltage on a Test Point (TP1). Learn how two 10 kΩ resistors divide 5.0 V in half to 2.50 V, and populate the missing R2 footprint.',
    hints: [
      'Probe TP1 in V⎓ mode with Power ON: it reads 5.00 V instead of 2.50 V.',
      'Vout = 5 V × R2 / (R1 + R2). Since R2 is unpopulated (missing), nothing pulls VOUT down toward GND.',
      'Select the empty R2 footprint and fit a 10 kΩ resistor (matching R1) to get 2.50 V on TP1.',
    ],
    par: 1,
  }, k.b, [{ type: 'voltage', a: 'TP1', min: 2.3, max: 2.7 }], 'PCB{v0lt4g3_d1v1d3r_h4lf_r41l}',
  (b) => {
    const r = b.components.find((c) => c.ref === 'R2')!;
    removePart(r);
    r.value = 0;
  });
}

function bridgeTroll() {
  const k = new Builder(68, 40);
  const bt = k.coin('BT1', 3, [17, 20]);
  const sw = k.tactile('SW1', [40, 32]);
  const r1 = k.resistor('R1', 100, [52, 26]);
  const r2 = k.resistor('R2', 100, [52, 14]);
  const d1 = k.led('D1', 'red', [40, 26]);
  const d2 = k.led('D2', 'green', [40, 14]);
  k.track('F', [k.pad(bt, '1'), [5, 37], [36.75, 37], [36.75, 34.25]], 0.8, '+3V');
  k.track('F', [[43.25, 34.25], [62, 34.25], [62, 14]], 0.8, 'BUS');
  k.track('F', [[62, 26], k.pad(r1, '2')], 0.8, 'BUS');
  k.track('F', [[62, 14], k.pad(r2, '2')], 0.8, 'BUS');
  k.track('F', [k.pad(r1, '1'), k.pad(d1, '2')], 0.6);
  k.track('F', [k.pad(r2, '1'), k.pad(d2, '2')], 0.6);
  k.track('F', [k.pad(d1, '1'), [33, 26], [33, 14], k.pad(d2, '1')], 0.8, 'GND');
  k.track('F', [k.pad(bt, '2'), [33, 20]], 0.8, 'GND');
  k.text([52, 3], 'BRIDGE TROLL  2xLED', 1.4);
  void sw;
  return finalize('builtin-bridge-troll', {
    title: 'Bridge Troll',
    author: 'DEADBOARD',
    difficulty: 2,
    description: 'Two indicator LEDs share one button. Hand-soldered in a hurry: D1 stays dark and D2 never lights. There is more than one fault. Hint: the interesting side of a through-hole board is the bottom.',
    hints: [
      'Flip the board (F key or the Flip button) and look at the solder joints.',
      'One joint is dull and grainy — reflow it with the iron.',
      'A blob of solder is shorting the two legs of an LED. Use the desoldering wick.',
    ],
    par: 2,
  }, k.b, [on('D1', { SW1: true }), on('D2', { SW1: true }), off('D1', { SW1: false }), off('D2', { SW1: false })],
  'PCB{tr0ll_br1dg3_w1ck3d_4w4y}',
  (b) => {
    addBlob(b, [40, 14], 'B', 1.05);
    b.components.find((c) => c.ref === 'R1')!.state.cold = [0];
  });
}

function backwardsDay() {
  const k = new Builder(56, 40);
  const j1 = k.header('J1', 5, [6, 20], 0, 'USB 5V');
  const r1 = k.resistor('R1', 330, [24, 10]);
  const d1 = k.led('D1', 'yellow', [40, 10], 180);
  const r2 = k.resistor('R2', 150, [24, 24]);
  const d2 = k.led('D2', 'blue', [40, 24], 180);
  k.track('F', [k.pad(j1, '1'), [12, 18.73], [12, 10], k.pad(r1, '1')], 0.8, '+5V');
  k.track('F', [[12, 18.73], [16, 18.73]], 0.8, '+5V');
  k.via([16, 18.73], '+5V');
  k.track('B', [[16, 18.73], [16, 24], k.pad(r2, '1')], 0.8, '+5V');
  k.track('F', [k.pad(r1, '2'), k.pad(d1, '2')], 0.6);
  const blue = k.track('B', [k.pad(r2, '2'), k.pad(d2, '2')], 0.6, 'BLUE_A');
  k.track('F', [k.pad(d1, '1'), [48, 10], [48, 34]], 0.8, 'GND');
  k.track('F', [k.pad(d2, '1'), [44, 24], [44, 34]], 0.8, 'GND');
  k.track('F', [k.pad(j1, '2'), [6, 34], [48, 34]], 0.8, 'GND');
  k.text([30, 37.5], 'BACKWARDS DAY', 1.4);
  return finalize('builtin-backwards-day', {
    title: 'Backwards Day',
    author: 'DEADBOARD',
    difficulty: 3,
    description: 'A USB-powered status light with a yellow and a blue LED. The intern assembled it from the wrong reel and was not careful with orientation. Both LEDs must light when 5 V is applied.',
    hints: [
      'Read R1\'s colour bands, or measure it with power off. 330 Ω is what the design calls for.',
      'LEDs conduct one way only. Compare the cathode flat of each LED with the silkscreen mark.',
      'Not every trace lives on top. Flip the board and follow D2\'s anode.',
    ],
    par: 3,
  }, k.b, [on('D1'), on('D2')], 'PCB{p0l4r1ty_m4tt3rs_bl1nk}',
  (b) => {
    b.components.find((c) => c.ref === 'R1')!.value = 47000;
    b.components.find((c) => c.ref === 'D1')!.state.reversed = true;
    cutTrace(b, b.traces.find((t) => t.id === blue[0])!, [34, 24], 0.7);
  });
}

function ghostShort() {
  const k = new Builder(64, 44);
  const j1 = k.header('J1', 5, [6, 22], 0, '5V IN');
  const f1 = k.fuse('F1', 0.5, [18, 12]);
  const r3 = k.resistor('R3', 470, [30, 22], 90);
  const d1 = k.led('D1', 'green', [30, 33], -90);
  const r1 = k.resistor('R1', 10000, [44, 20], 90);
  const r2 = k.resistor('R2', 10000, [44, 33], 90);
  const tp1 = k.testpoint('TP1', [52, 26.5], 'VOUT');
  const tp2 = k.testpoint('TP2', [56, 40], 'GND');
  k.track('F', [k.pad(j1, '1'), [11.65, 20.73], k.pad(f1, '1')], 0.8, '+5V_RAW');
  k.track('F', [k.pad(f1, '2'), [44, 12], k.pad(r1, '1')], 1.0, '+5V');
  k.track('F', [[30, 12], k.pad(r3, '1')], 0.8, '+5V');
  k.track('F', [k.pad(r3, '2'), k.pad(d1, '2')], 0.6);
  k.track('F', [k.pad(r1, '2'), k.pad(r2, '1')], 0.6, 'VOUT');
  k.track('F', [[44, 26.5], k.pad(tp1, '1')], 0.6, 'VOUT');
  k.track('F', [k.pad(j1, '2'), [10, 23.27], [10, 40], k.pad(tp2, '1')], 1.0, 'GND');
  k.track('F', [k.pad(d1, '1'), [30, 40]], 0.8, 'GND');
  k.track('F', [k.pad(r2, '2'), [44, 40]], 0.8, 'GND');
  k.text([36, 2.5], 'GHOST SHORT  5V REF', 1.4);
  return finalize('builtin-ghost-short', {
    title: 'Ghost Short',
    author: 'DEADBOARD',
    difficulty: 4,
    description: 'A 5 V reference board: power LED D1 plus a divider that must put 2.5 V (±0.2 V) on TP1. It came back from the field dead with a blown fuse and a missing part. Replace the fuse without finding the cause and it will just blow again.',
    hints: [
      'With power OFF, measure between TP2 (GND) and the + pin of J1. Should that be 0 Ω?',
      'Zoom in near J1: a hairline sliver of copper connects two different nets. Cut it with the knife.',
      'Vout = 5 V × R2 / (R1 + R2). R1 is 10 kΩ.',
    ],
    par: 3,
  }, k.b, [on('D1'), { type: 'voltage', a: 'TP1', min: 2.3, max: 2.7 }], 'PCB{gh0st_sl1v3r_exorc1s3d}',
  (b) => {
    b.traces.push({ id: 'sliver', layer: 'F', a: [8.5, 20.6], b: [8.5, 23.4], w: 0.15 });
    b.components.find((c) => c.ref === 'F1')!.state.burnt = true;
    const r = b.components.find((c) => c.ref === 'R2')!;
    removePart(r);
    r.value = 0;
  });
}

function dieselEcu() {
  const k = new Builder(100, 60);
  k.b.color = '#1b3b2b';

  // 1. KL30 Battery Power Terminal Header (5.0V regulated test harness supply)
  const j1 = k.header('J1_BAT', 5.0, [10, 30], 0, 'KL30 5V');

  // 2. Automotive Blade Fuse 1.0A
  const f1 = k.fuse('F1', 1.0, [22, 30], 0);

  // 3. TVS Overvoltage & Reverse Protection Diode (SMBJ14A)
  // Cathode (pad 1) at [22, 10.92] on 5V_PROT, Anode (pad 2) at [22, 21.08] on GND
  const d1 = k.diode('D1_TVS', [22, 16], 90);

  // 4. Reservoir Filter Capacitor (470uF 25V)
  const c1 = k.resistor('C1_RES', 10e6, [34, 16]);

  // 5. Ignition Switch (Terminal 15)
  const swIgn = k.tactile('SW1_IGN', [34, 30]);
  swIgn.state.closed = true;

  // 6. Automotive 5V Logic Stage (TLE4275)
  const uLdo = k.resistor('U1_LDO', 0.05, [48, 30]);
  const rPwr = k.resistor('R1_PWR', 330, [48, 40]);
  const dPwr = k.led('D2_PWR', 'green', [48, 48]);

  // 7. Protected 5V Sensor Rail Tracking Buffer & 10uF Decoupling Capacitor
  const uSens = k.resistor('U2_SENS', 0.5, [62, 30]);
  const rSens = k.resistor('R2_SENS', 330, [62, 40]);
  const dSens = k.led('D3_SENS', 'blue', [62, 48]);
  const cSens = k.resistor('C2_SENS', 10e6, [62, 22]);

  // 8. Analog MAP Sensor Reference Voltage Divider
  const rTop = k.resistor('R3_MAP', 4700, [74, 18]);
  const rBot = k.resistor('R4_MAP', 2200, [74, 30]);

  // Test Points
  const tpBat = k.testpoint('TP_BAT', [10, 42], 'KL30_5V');
  const tpIgn = k.testpoint('TP_IGN', [34, 46], 'KL15_IGN');
  const tp5v = k.testpoint('TP_5V', [48, 16], '5V_VCC');
  const tpSens = k.testpoint('TP_SENS', [62, 16], '5V_SENS');
  const tpMap = k.testpoint('TP_MAP', [74, 42], 'MAP_SIG');
  const tpGnd = k.testpoint('TP_GND', [10, 16], 'GND');

  // Silkscreen text
  k.text([50, 4], 'AUTOMOTIVE POWERTRAIN ECU (EDC DIESEL BENCH)', 1.5);
  k.text([50, 58], 'KL30 BAT 5V · F1 FUSE · KL15 IGN · 5V VCC LOGIC · 5V SENS RAIL · MAP SENSOR', 0.95);
  k.text([10, 22], 'KL30 5V', 0.9);
  k.text([22, 24], '1A BLADE', 0.9);
  k.text([22, 9], 'SMBJ14A TVS', 0.8);
  k.text([34, 9], '470uF 25V', 0.8);
  k.text([34, 37], 'KL15 IGN', 0.9);
  k.text([48, 24], 'TLE4275 5V', 0.9);
  k.text([48, 54], 'ECU PWR', 0.9);
  k.text([62, 37], '5V SENSOR RAIL', 0.8);
  k.text([62, 54], 'SENS 5V', 0.9);
  k.text([62, 25], '10uF SENS CAP', 0.8);
  k.text([74, 11], '4.7k PULLUP', 0.8);
  k.text([74, 37], '2.2k MAP', 0.8);

  // Front copper routing
  k.track('F', [k.pad(j1, '1'), [6, 28.73], [6, 42], k.pad(tpBat, '1')], 1.5, '5V_BAT');
  k.track('F', [[6, 28.73], [15.65, 28.73], k.pad(f1, '1')], 1.5, '5V_BAT');

  k.track('F', [k.pad(f1, '2'), [28.35, 27.75], k.pad(swIgn, '1')], 1.5, '5V_PROT');
  k.track('F', [[28.35, 27.75], [28.92, 20], k.pad(c1, '1')], 1.2, '5V_PROT');
  k.track('F', [k.pad(c1, '1'), [22, 16], k.pad(d1, '1')], 1.2, '5V_PROT');

  k.track('F', [k.pad(swIgn, '2'), [37.25, 30], k.pad(uLdo, '1')], 1.2, 'KL15_IGN');
  k.track('F', [k.pad(swIgn, '2'), [34, 27.75], k.pad(tpIgn, '1')], 1.0, 'KL15_IGN');

  k.track('F', [k.pad(uLdo, '2'), [48, 30], k.pad(tp5v, '1')], 1.0, '5V_VCC');
  k.track('F', [k.pad(uLdo, '2'), [53.08, 36], [42.92, 36], k.pad(rPwr, '1')], 0.8, '5V_VCC');
  k.track('F', [k.pad(uLdo, '2'), k.pad(uSens, '1')], 1.0, '5V_VCC');

  k.track('F', [k.pad(rPwr, '2'), [49.27, 40], k.pad(dPwr, '2')], 0.6, 'PWR_LED');

  k.track('F', [k.pad(uSens, '2'), [62, 30], k.pad(tpSens, '1')], 1.0, '5V_SENS');
  k.track('F', [k.pad(uSens, '2'), [67.08, 36], [56.92, 36], k.pad(rSens, '1')], 0.8, '5V_SENS');
  k.track('F', [k.pad(tpSens, '1'), [56.92, 16], k.pad(cSens, '1')], 0.8, '5V_SENS');
  k.track('F', [k.pad(tpSens, '1'), [62, 12], [68.92, 12], k.pad(rTop, '1')], 0.8, '5V_SENS');

  k.track('F', [k.pad(rSens, '2'), [63.27, 40], k.pad(dSens, '2')], 0.6, 'SENS_LED');

  k.track('F', [k.pad(rTop, '2'), [84, 18], [84, 26], [68.92, 26], k.pad(rBot, '1')], 0.6, 'MAP_SIG');
  k.track('F', [[68.92, 26], [68.92, 42], k.pad(tpMap, '1')], 0.6, 'MAP_SIG');

  // Bottom copper routing (GND bus and test tracks)
  k.track('B', [
    k.pad(j1, '2'), [4, 31.27], [4, 6], [10, 6], k.pad(tpGnd, '1')
  ], 1.2, 'GND');
  k.track('B', [[10, 6], [18, 6], [18, 21.08], k.pad(d1, '2')], 1.2, 'GND');
  k.track('B', [[10, 6], [39.08, 6], k.pad(c1, '2')], 1.2, 'GND');
  k.track('B', [[39.08, 6], [67.08, 6], k.pad(cSens, '2')], 1.2, 'GND');
  k.track('B', [[67.08, 6], [88, 6], [88, 30], k.pad(rBot, '2')], 1.2, 'GND');
  k.track('B', [[88, 6], [94, 6], [94, 54], [60.73, 54], k.pad(dSens, '1')], 1.2, 'GND');
  k.track('B', [[60.73, 54], [46.73, 54], k.pad(dPwr, '1')], 1.2, 'GND');

  // Target pads on Back for authentic MLCC short-circuit solder bridge
  k.track('B', [k.pad(cSens, '1'), [60.8, 22]], 0.8, '5V_SENS');
  k.track('B', [k.pad(cSens, '2'), [63.2, 22]], 0.8, 'GND');

  return finalize(
    'builtin-diesel-ecu',
    {
      title: 'Diesel ECU: No 5V Sensor Supply',
      author: 'DEADBOARD Automotive Lab',
      difficulty: 4,
      description:
        'A Common Rail diesel powertrain ECU (Bosch EDC architecture). Vehicle diagnostics report DTC P0641 / P0651 (Sensor Reference Voltage A/B Circuit Open/Short). The engine cranks but will not start. The 5V logic rail powers the microcontroller, but the protected 5V sensor reference rail feeding the rail pressure and MAP sensors is dead. Find the short, repair the sensor rail, and restore both 5V logic and sensor supplies.',
      hints: [
        'Turn power ON and measure TP_5V (Logic 5V) and TP_SENS (Sensor 5V) with the multimeter in V⎓ mode: TP_5V is alive (~5.0 V), but TP_SENS reads 0.0 V!',
        'Turn power OFF and switch the multimeter to Resistance (Ω) mode. Probe between TP_SENS and TP_GND: it reads ~0 Ω, revealing a short-circuit to ground.',
        'Inspect sensor rail filter capacitor C2_SENS and the solder pads on the bottom layer. Remove the short with desoldering wick, replace damaged parts, and ensure fuse F1 is intact.',
      ],
      par: 3,
    },
    k.b,
    [
      { type: 'voltage', a: 'TP_5V', min: 4.80, max: 5.25 },
      { type: 'voltage', a: 'TP_SENS', min: 4.80, max: 5.25 },
      { type: 'led', ref: 'D2_PWR', on: true },
      { type: 'led', ref: 'D3_SENS', on: true },
    ],
    'PCB{d13s3l_3cu_5v_s3ns0r_r41l_r3st0r3d}',
    (b) => {
      b.components.find((c) => c.ref === 'F1')!.state.burnt = true;
      addBlob(b, [62, 22], 'B', 1.6);
      b.components.find((c) => c.ref === 'C2_SENS')!.state.burnt = true;
    },
  );
}

export async function builtinScenarios(): Promise<Scenario[]> {
  const [base, extra] = await Promise.all([
    Promise.all([
      firstLight(),
      tutColdJoint(),
      tutSolderBridge(),
      tutPolarity(),
      tutResistor(),
      tutDivider(),
      bridgeTroll(),
      backwardsDay(),
      ghostShort(),
      dieselEcu(),
    ]),
    realisticScenarios(),
  ]);
  return [...base, ...extra];
}
