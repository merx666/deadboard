// Pre-made realistic modular boards: ESP32 DevKit V1, Raspberry Pi Pico, Arduino Uno R3, Raspberry Pi Zero 2 W
// Authentic dimensions, real-world footprints, high-accuracy pin headers, copper traces, and silkscreen markings.
// Solvable in SPICE, inspectable with DMM, oscilloscope, thermal camera, and exportable as mods.

import type { Component, ComponentKind, Pad, Scenario, V2 } from '../types';
import { Builder } from '../scenarios/builder';

export interface BoardPreset {
  id: string;
  titlePl: string;
  titleEn: string;
  descPl: string;
  descEn: string;
  category: 'mcu' | 'power' | 'iot';
  create: () => Scenario;
}

const thtPad = (name: string, at: V2, d = 1.8, shape: Pad['shape'] = 'circle', drill = 0.9): Pad => ({
  name,
  at,
  size: [d, d],
  shape,
  layers: 'FB',
  drill,
});

const smdPad = (name: string, at: V2, w = 1.2, h = 1.6, shape: Pad['shape'] = 'roundrect'): Pad => ({
  name,
  at,
  size: [w, h],
  shape,
  layers: 'F',
});

/** Helper to add multi-pin header strips with authentic 2.54mm pitch */
function addPinHeader(
  b: Builder,
  ref: string,
  at: V2,
  pinCount: number,
  pinNames: string[],
  direction: 'vertical' | 'horizontal',
  rows = 1,
  rowSpacing = 2.54
): Component {
  const pitch = 2.54;
  const pads: Pad[] = [];
  const pins: Record<string, string> = {};

  const totalLength = (pinCount - 1) * pitch;
  const startOffset = -totalLength / 2;

  for (let r = 0; r < rows; r++) {
    const rowOffset = rows === 1 ? 0 : (r - (rows - 1) / 2) * rowSpacing;
    for (let i = 0; i < pinCount; i++) {
      const idx = r * pinCount + i;
      const pinName = pinNames[idx] || (idx + 1).toString();
      const pos: V2 = direction === 'vertical'
        ? [rowOffset, startOffset + i * pitch]
        : [startOffset + i * pitch, rowOffset];
      pads.push(thtPad(pinName, pos, 1.8, idx === 0 ? 'rect' : 'circle', 0.9));
      pins[pinName] = pinName;
    }
  }

  const w = direction === 'vertical' ? (rows === 1 ? 2.54 : rows * rowSpacing) : pinCount * pitch;
  const h = direction === 'vertical' ? pinCount * pitch : (rows === 1 ? 2.54 : rows * rowSpacing);

  const comp: Component = {
    id: 'c' + (b.b.nextId++).toString(36),
    ref,
    kind: 'connector',
    value: 0,
    at,
    rot: 0,
    side: 'F',
    pads,
    pins,
    body: { shape: 'header', w, h, z: 8.5 },
    state: { populated: true, reversed: false, burnt: false, cold: [] }
  };
  b.b.components.push(comp);
  return comp;
}

/** Helper to add chip/IC with custom dimensions, metallic/epoxy color and pads */
function addChip(
  b: Builder,
  ref: string,
  at: V2,
  w: number,
  h: number,
  z: number,
  options: {
    kind?: ComponentKind;
    value?: number;
    color?: string;
    label?: string;
    shape?: Component['body']['shape'];
    pads?: Pad[];
    pins?: Record<string, string>;
  } = {}
): Component {
  const pads = options.pads || [
    thtPad('1', [-w * 0.42, -h * 0.42], 1.4, 'rect', 0.8),
    thtPad('2', [w * 0.42, -h * 0.42], 1.4, 'circle', 0.8),
    thtPad('3', [w * 0.42, h * 0.42], 1.4, 'circle', 0.8),
    thtPad('4', [-w * 0.42, h * 0.42], 1.4, 'circle', 0.8),
  ];
  const pins = options.pins || { '1': '1', '2': '2' };
  const comp: Component = {
    id: 'c' + (b.b.nextId++).toString(36),
    ref,
    kind: options.kind || 'ic',
    value: options.value ?? 0,
    label: options.label || ref,
    at,
    rot: 0,
    side: 'F',
    pads,
    pins,
    body: {
      shape: options.shape || 'chip',
      w,
      h,
      z,
      color: options.color || '#1a1c1e'
    },
    state: { populated: true, reversed: false, burnt: false, cold: [] }
  };
  b.b.components.push(comp);
  return comp;
}

/** Helper to draw meandered serpentine antenna traces */
function addSerpentineAntenna(
  b: Builder,
  startX: number,
  endX: number,
  bottomY: number,
  topY: number,
  cycles: number,
  net = 'ANTENNA'
) {
  const stepX = (endX - startX) / (cycles * 2);
  const pts: V2[] = [];
  pts.push([startX, bottomY]);

  for (let i = 0; i < cycles; i++) {
    const x1 = startX + (i * 2) * stepX;
    const x2 = startX + (i * 2 + 1) * stepX;
    const x3 = startX + (i * 2 + 2) * stepX;

    pts.push([x1, topY]);
    pts.push([x2, topY]);
    pts.push([x2, bottomY + 0.8]);
    pts.push([x3, bottomY + 0.8]);
  }
  pts.push([endX, bottomY]);
  b.track('F', pts, 0.65, net);
}

// ============================================================================
// 1. ESP32 DevKit V1 (51.5 x 28.5 mm)
// ============================================================================
export function createEsp32DevScenario(): Scenario {
  // Dimensions: 28.5 mm wide x 51.5 mm high
  const b = new Builder(28.5, 51.5);
  const board = b.b;
  board.color = '#14171a'; // Sleek matte black solder mask

  // --- 1. Golden Serpentine Meandered PCB Antenna at Top (y: 44.5 .. 50.2) ---
  addSerpentineAntenna(b, 5.0, 23.5, 45.2, 50.2, 4, 'ANTENNA');
  // Antenna feed trace
  b.track('F', [[5.0, 45.2], [5.0, 42.0], [8.0, 42.0]], 0.6, 'ANTENNA');
  // Antenna keepout silkscreen line & text
  b.b.silk.push({ a: [2.5, 44.2], b: [26.0, 44.2], w: 0.25, side: 'F' });
  b.text([14.25, 44.6], 'ANTENNA KEEP-OUT ZONE', 0.9);

  // --- 2. ESP-WROOM-32 Metal RF Shield Can (18 x 18 mm) ---
  const rfShield = addChip(b, 'U2_ESP32', [14.25, 33.0], 18.0, 18.0, 3.2, {
    kind: 'ic',
    value: 220,
    color: '#c5cad1', // Shiny metallic silver
    label: 'ESP-WROOM-32',
    pads: [
      thtPad('1', [-8.5, -8.5], 1.2, 'roundrect', 0.6), // GND
      thtPad('2', [8.5, -8.5], 1.2, 'roundrect', 0.6),  // 3V3
      thtPad('3', [8.5, 8.5], 1.2, 'roundrect', 0.6),   // GPIO
      thtPad('4', [-8.5, 8.5], 1.2, 'roundrect', 0.6),  // RF
    ],
    pins: { '1': '1', '2': '2' }
  });
  // Laser etched markings on shield
  b.text([14.25, 36.8], 'ESP-WROOM-32', 1.5);
  b.text([14.25, 34.6], 'Espressif Systems', 1.0);
  b.text([14.25, 32.6], 'FCC ID: 2AC7Z-ESPWROOM32', 0.75);
  b.text([14.25, 30.6], 'Wi-Fi + BT/BLE SoC', 0.85);

  // --- 3. MicroUSB / USB-C Receptacle at Bottom Center ---
  const usb = b.header('J1_USB', 5.0, [14.25, 3.2], 0, 'USB 5V (VBUS)');
  usb.body = { shape: 'header', w: 7.5, h: 5.6, z: 3.0 };
  const fuse = b.fuse('F1', 1.0, [10.5, 6.0]);
  b.text([14.25, 1.2], 'USB 5V', 0.9);

  // --- 4. CP2102 / CH340 USB-to-UART Bridge IC ---
  const uart = addChip(b, 'U3_CP2102', [14.25, 15.0], 5.0, 5.0, 0.9, {
    kind: 'ic',
    color: '#1a1b1d',
    label: 'CP2102',
    pads: [
      smdPad('1', [-2.2, 0]),
      smdPad('2', [2.2, 0]),
    ],
    pins: { '1': '1', '2': '2' }
  });
  b.text([14.25, 15.0], 'CP2102', 0.85);

  // --- 5. AMS1117-3.3 LDO Voltage Regulator (SOT-223) & Decoupling ---
  const ldo = b.resistor('U1_AMS1117', 0.01, [7.5, 16.5]);
  ldo.body = { shape: 'box', w: 6.5, h: 3.5, z: 1.8 };
  b.text([7.5, 19.0], 'AMS1117-3.3', 0.8);

  const c1 = b.resistor('C1_10U', 0.05, [7.5, 21.5]); // 10uF input MLCC
  c1.body = { shape: 'box', w: 2.0, h: 1.25, z: 0.9 };
  const c2 = b.resistor('C2_10U', 0.04, [7.5, 12.0]); // 10uF output MLCC
  c2.body = { shape: 'box', w: 2.0, h: 1.25, z: 0.9 };

  // --- 6. Tactile Push Buttons (EN / Reset & BOOT) ---
  const swEn = b.tactile('SW1_EN', [5.5, 4.5]);
  swEn.body = { shape: 'tactile', w: 4.0, h: 4.0, z: 3.5 };
  b.text([5.5, 7.2], 'EN', 1.0);

  const swBoot = b.tactile('SW2_BOOT', [23.0, 4.5]);
  swBoot.body = { shape: 'tactile', w: 4.0, h: 4.0, z: 3.5 };
  b.text([23.0, 7.2], 'BOOT', 1.0);

  // --- 7. Status LEDs (PWR Red & GPIO2 Blue) ---
  const r1 = b.resistor('R1_PWR', 1000, [10.5, 10.5]);
  r1.body = { shape: 'box', w: 2.0, h: 1.25, z: 0.8 };
  const d1 = b.led('D1_PWR', 'red', [10.5, 8.5]);
  d1.body = { shape: 'led', w: 2.5, h: 2.0, z: 1.5 };
  b.text([10.5, 7.2], 'PWR', 0.8);

  const r2 = b.resistor('R2_IO2', 1000, [18.0, 10.5]);
  r2.body = { shape: 'box', w: 2.0, h: 1.25, z: 0.8 };
  const d2 = b.led('D2_IO2', 'blue', [18.0, 8.5]);
  d2.body = { shape: 'led', w: 2.5, h: 2.0, z: 1.5 };
  b.text([18.0, 7.2], 'D2', 0.8);

  // --- 8. Test Points ---
  const tp5v = b.testpoint('TP_5V', [14.25, 7.8], '5V_VBUS');
  const tp3v3 = b.testpoint('TP_3V3', [10.5, 13.5], '3V3_REG');
  const tpEn = b.testpoint('TP_EN', [5.5, 9.5], 'EN_PULLUP');
  const tpGnd = b.testpoint('TP_GND', [14.25, 10.5], 'GND');

  // --- 9. Dual 15-Pin Headers on Left and Right Borders (2.54mm pitch) ---
  // Left border: 3V3, EN, D36/VP, D39/VN, D34, D35, D32, D33, D25, D26, D27, D14, D12, GND, D13 (top to bottom)
  const leftPinNames = [
    'D13', 'GND', 'D12', 'D14', 'D27', 'D26', 'D25', 'D33',
    'D32', 'D35', 'D34', 'D39/VN', 'D36/VP', 'EN', '3V3'
  ];
  const hLeft = addPinHeader(b, 'J_LEFT', [2.0, 25.72], 15, leftPinNames, 'vertical');

  // Right border: GND, D23, D22, TX0, RX0, D21, D19, D18, D5, D17, D16, D4, D2, D15, VIN (top to bottom)
  const rightPinNames = [
    'VIN', 'D15', 'D2', 'D4', 'D16', 'D17', 'D5', 'D18',
    'D19', 'D21', 'RX0', 'TX0', 'D22', 'D23', 'GND'
  ];
  const hRight = addPinHeader(b, 'J_RIGHT', [26.5, 25.72], 15, rightPinNames, 'vertical');

  // Silkscreen text along headers
  for (let i = 0; i < 15; i++) {
    const yPos = 25.72 - (14 * 2.54) / 2 + i * 2.54;
    b.text([4.2, yPos], leftPinNames[i], 0.72);
    b.text([24.3, yPos], rightPinNames[i], 0.72);
  }

  // --- 10. Copper Traces Routing ---
  // 5V rail from USB -> Fuse -> AMS1117 In -> VIN pin
  b.track('F', [b.pad(usb, '1'), [10.5, 3.2], b.pad(fuse, '1')], 0.8, 'VBUS_5V');
  b.track('F', [b.pad(fuse, '2'), b.pad(tp5v, '1'), [7.5, 7.8], b.pad(c1, '1'), b.pad(ldo, '1')], 0.8, 'VBUS_5V');
  b.track('F', [[10.5, 3.2], [26.5, 3.2], b.pad(hRight, 'VIN')], 0.8, 'VBUS_5V');

  // 3.3V rail from LDO Out -> C2 -> TP_3V3 -> ESP32 & Left 3V3 pin
  b.track('F', [b.pad(ldo, '2'), b.pad(c2, '1'), b.pad(tp3v3, '1'), [14.25, 13.5], b.pad(rfShield, '2')], 0.8, '3V3_SYSTEM');
  b.track('F', [b.pad(tp3v3, '1'), [2.0, 13.5], [2.0, 43.5], b.pad(hLeft, '3V3')], 0.8, '3V3_SYSTEM');
  b.track('F', [b.pad(ldo, '2'), b.pad(r1, '1')], 0.5, '3V3_SYSTEM');
  b.track('F', [b.pad(r1, '2'), b.pad(d1, '2')], 0.5, 'NET_LED_PWR');

  // Ground plane & tracks
  b.track('B', [
    b.pad(usb, '2'), b.pad(tpGnd, '1'), b.pad(c1, '2'), b.pad(c2, '2'),
    b.pad(d1, '1'), b.pad(d2, '1'), b.pad(rfShield, '1'),
    b.pad(hLeft, 'GND'), b.pad(hRight, 'GND'), b.pad(swEn, '2'), b.pad(swBoot, '2')
  ], 1.2, 'GND');

  // EN and BOOT buttons wiring
  b.track('F', [b.pad(swEn, '1'), b.pad(tpEn, '1'), b.pad(hLeft, 'EN')], 0.4, 'EN_PULLUP');
  b.track('F', [b.pad(swBoot, '1'), b.pad(rfShield, '1')], 0.4, 'GPIO0');

  // GPIO2 LED wiring
  b.track('F', [b.pad(hRight, 'D2'), [20.0, 13.02], b.pad(r2, '1')], 0.4, 'GPIO2');
  b.track('F', [b.pad(r2, '2'), b.pad(d2, '2')], 0.4, 'NET_LED_IO2');

  // UART to headers & RF
  b.track('F', [b.pad(uart, '1'), b.pad(hRight, 'TX0')], 0.4, 'UART0_TX');
  b.track('F', [b.pad(uart, '2'), b.pad(hRight, 'RX0')], 0.4, 'UART0_RX');

  // Silk text branding
  b.text([14.25, 23.5], 'ESP32 DEVKIT V1', 1.4);
  b.text([14.25, 21.8], 'DOIT.AM · NodeMCU-32S', 0.9);
  b.text([14.25, 20.2], '3.3V LDO · CP2102 UART', 0.8);

  return {
    format: 'pcbfix/1',
    id: 'preset-esp32-devkit',
    meta: {
      title: 'ESP32 DevKit V1 (Wi-Fi + BLE / 3.3V LDO)',
      author: 'DEADBOARD Studio',
      difficulty: 2,
      description: 'Oficjalna płytka ewaluacyjna ESP32 DevKit V1 z anteną meandrową PCB, metalowym ekranem RF ESP-WROOM-32, stabilizatorem AMS1117-3.3V, zabezpieczeniem wejścia USB, przyciskami EN/BOOT oraz 30 wyprowadzeniami GPIO.',
      hints: [
        'Sprawdź czy bezpiecznik F1 przewodzi napięcie 5V z wejścia USB do wejścia stabilizatora U1.',
        'Zmierz napięcie na punkcie testowym TP_3V3 (powinno wynosić 3.25V – 3.35V).',
        'Sprawdź czy dioda zasilania PWR (czerwona) świeci jasno.',
        'Sprawdź czy pin 3V3 oraz VIN na złączach brzegowych wyprowadzają prawidłowe napięcia.'
      ],
      credits: 'Espressif Systems ESP32 Hardware Design Guidelines',
      license: 'Apache-2.0'
    },
    board,
    objectives: [
      { type: 'voltage', a: '3V3_SYSTEM', min: 3.15, max: 3.45 },
      { type: 'led', ref: 'D1_PWR', on: true }
    ]
  };
}

// ============================================================================
// 2. Arduino Uno R3 (68.6 x 53.4 mm)
// ============================================================================
export function createArduinoUnoScenario(): Scenario {
  // Dimensions: 68.6 mm wide x 53.4 mm high
  const b = new Builder(68.6, 53.4);
  const board = b.b;
  board.color = '#005c8a'; // Authentic Italian Arduino Uno blue

  // --- 1. USB Type-B Metal Receptacle (x: 8.5, y: 40.0) ---
  const usbB = b.header('J1_USB_B', 5.0, [8.5, 40.0], 0, 'USB Type-B');
  usbB.body = { shape: 'header', w: 12.0, h: 16.0, z: 11.0 };
  b.text([8.5, 49.5], 'USB TYPE-B', 1.0);

  // --- 2. 2.1mm DC Power Barrel Jack (x: 9.5, y: 12.0) ---
  const dcJack = b.header('J2_DC', 9.0, [9.5, 12.0], 0, 'DC 9V IN');
  dcJack.body = { shape: 'box', w: 9.0, h: 13.5, z: 11.0, color: '#16181b' };
  b.text([9.5, 2.8], '2.1mm DC 9V', 0.9);

  // Reverse polarity protection diode (1N4007 / M7)
  const dReverse = b.diode('D1_M7', [18.0, 15.0]);
  b.text([18.0, 18.5], '1N4007', 0.85);

  // --- 3. Power Regulation (5V LDO & 3.3V LDO) ---
  const ldo5v = b.resistor('U1_5V_LDO', 0.02, [24.0, 15.0]);
  ldo5v.body = { shape: 'box', w: 6.5, h: 3.5, z: 1.8 };
  b.text([24.0, 18.5], 'NCP1117-5V', 0.85);

  // Radial electrolytic filter capacitors
  const cIn = b.resistor('C1_47U', 0.1, [18.0, 8.5]);
  cIn.body = { shape: 'radial', w: 6.3, h: 6.3, z: 8.0, color: '#1b2d42' };
  const cOut5v = b.resistor('C2_47U', 0.1, [26.0, 8.5]);
  cOut5v.body = { shape: 'radial', w: 6.3, h: 6.3, z: 8.0, color: '#1b2d42' };

  // 3.3V LDO (LP2985-33)
  const ldo3v3 = b.resistor('U2_3V3', 0.04, [33.0, 15.0]);
  ldo3v3.body = { shape: 'box', w: 3.0, h: 2.8, z: 1.2 };
  b.text([33.0, 18.5], 'LP2985-33', 0.85);

  const cOut3v3 = b.resistor('C3_10U', 0.05, [33.0, 8.5]);
  cOut3v3.body = { shape: 'box', w: 2.0, h: 1.25, z: 0.9 };

  // --- 4. ATmega16U2 USB-Serial Chip ---
  const u16u2 = addChip(b, 'U4_16U2', [20.0, 36.0], 5.0, 5.0, 1.0, {
    kind: 'ic',
    color: '#1a1b1d',
    label: 'ATmega16U2'
  });
  b.text([20.0, 36.0], 'MEGA16U2', 0.75);

  // --- 5. ATmega328P DIP-28 Socketed Microcontroller in Center ---
  // DIP-28 package: length 35.56 mm, width 8.5 mm, 2 rows of 14 pins at 2.54mm pitch
  const dipPads: Pad[] = [];
  const dipPins: Record<string, string> = {};
  for (let i = 0; i < 14; i++) {
    // Bottom row: Pins 1 to 14 (x from -16.51 to +16.51)
    const px = -16.51 + i * 2.54;
    const pinNum = (i + 1).toString();
    dipPads.push(thtPad(pinNum, [px, -3.81], 1.6, i === 0 ? 'rect' : 'circle', 0.8));
    dipPins[pinNum] = pinNum;

    // Top row: Pins 28 down to 15
    const pinNumTop = (28 - i).toString();
    dipPads.push(thtPad(pinNumTop, [px, 3.81], 1.6, 'circle', 0.8));
    dipPins[pinNumTop] = pinNumTop;
  }

  const mcu = addChip(b, 'U3_ATMEGA328P', [48.0, 22.0], 35.56, 8.5, 4.8, {
    kind: 'ic',
    value: 250,
    color: '#15171a',
    label: 'ATMEGA328P-PU',
    pads: dipPads,
    pins: dipPins
  });
  b.text([48.0, 23.5], 'ATMEGA328P-PU', 1.4);
  b.text([48.0, 20.8], '8-bit AVR @ 16MHz DIP-28', 0.85);

  // 16 MHz Crystal Oscillator with Load Caps
  const y1 = addChip(b, 'Y1_16MHZ', [38.0, 22.0], 11.0, 4.8, 3.5, {
    kind: 'resistor',
    value: 1000000,
    color: '#c2c8d1',
    label: '16.000 MHz',
    shape: 'box'
  });
  b.text([38.0, 22.0], '16.000', 0.85);

  // --- 6. Tactile Reset Button near USB ---
  const swRst = b.tactile('SW_RST', [6.5, 26.5]);
  b.text([6.5, 22.5], 'RESET', 0.85);

  // --- 7. Status LEDs (ON, L / D13, TX, RX) ---
  const rPwr = b.resistor('R_PWR', 1000, [30.0, 30.0]);
  rPwr.body = { shape: 'box', w: 2.0, h: 1.25, z: 0.8 };
  const ledPwr = b.led('LED_ON', 'green', [30.0, 32.5]);
  ledPwr.body = { shape: 'led', w: 2.5, h: 2.0, z: 1.5 };
  b.text([30.0, 34.5], 'ON', 0.85);

  const r13 = b.resistor('R_D13', 1000, [30.0, 38.0]);
  r13.body = { shape: 'box', w: 2.0, h: 1.25, z: 0.8 };
  const led13 = b.led('LED_L', 'yellow', [30.0, 40.5]);
  led13.body = { shape: 'led', w: 2.5, h: 2.0, z: 1.5 };
  b.text([30.0, 42.5], 'L (D13)', 0.85);

  // --- 8. Arduino Standard Female Headers ---
  // A. Digital High Header (10 pins): SCL, SDA, AREF, GND, D13, D12, D11, D10, D9, D8
  const digHighNames = ['D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'GND', 'AREF', 'SDA', 'SCL'];
  addPinHeader(b, 'J_DIG_HIGH', [56.43, 51.0], 10, digHighNames, 'horizontal');

  // B. Digital Low Header (8 pins): D7, D6, D5, D4, D3, D2, TX->1, RX<-0
  const digLowNames = ['RX0', 'TX1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];
  addPinHeader(b, 'J_DIG_LOW', [30.89, 51.0], 8, digLowNames, 'horizontal');

  // C. Power Header (8 pins): NC, IOREF, RESET, 3V3, 5V, GND, GND, VIN
  const pwrNames = ['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND1', 'GND2', 'VIN'];
  addPinHeader(b, 'J_PWR', [30.89, 2.4], 8, pwrNames, 'horizontal');

  // D. Analog IN Header (6 pins): A0, A1, A2, A3, A4, A5
  const analogNames = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
  addPinHeader(b, 'J_ANALOG', [51.35, 2.4], 6, analogNames, 'horizontal');

  // Header silkscreen labels
  for (let i = 0; i < 10; i++) {
    const xPos = 56.43 - (9 * 2.54) / 2 + i * 2.54;
    b.text([xPos, 48.5], digHighNames[i], 0.7);
  }
  for (let i = 0; i < 8; i++) {
    const xPos = 30.89 - (7 * 2.54) / 2 + i * 2.54;
    b.text([xPos, 48.5], digLowNames[i], 0.7);
    b.text([xPos, 4.9], pwrNames[i], 0.7);
  }
  for (let i = 0; i < 6; i++) {
    const xPos = 51.35 - (5 * 2.54) / 2 + i * 2.54;
    b.text([xPos, 4.9], analogNames[i], 0.7);
  }

  // --- 9. Test Points ---
  const tpVin = b.testpoint('TP_VIN', [14.0, 15.0], 'VIN_9V');
  const tp5v = b.testpoint('TP_5V', [26.0, 18.5], '+5V');
  const tp3v3 = b.testpoint('TP_3V3', [33.0, 21.0], '+3V3');
  const tpGnd = b.testpoint('TP_GND', [14.0, 8.5], 'GND');

  // --- 10. Copper Traces Routing ---
  b.track('F', [b.pad(dcJack, '1'), b.pad(tpVin, '1'), b.pad(dReverse, '1')], 1.0, 'RAW_VIN');
  b.track('F', [b.pad(dReverse, '2'), b.pad(cIn, '1'), b.pad(ldo5v, '1')], 0.8, 'VREG_IN');
  b.track('F', [b.pad(ldo5v, '2'), b.pad(cOut5v, '1'), b.pad(tp5v, '1'), [33.0, 15.0], b.pad(ldo3v3, '1')], 0.8, '5V_SYS');
  b.track('F', [b.pad(tp5v, '1'), [48.0, 18.5], b.pad(mcu, '7')], 0.8, '5V_SYS'); // ATmega pin 7 = VCC
  b.track('F', [b.pad(ldo3v3, '2'), b.pad(cOut3v3, '1'), b.pad(tp3v3, '1')], 0.6, '3V3_SYS');

  // ATmega16U2 and 16MHz Crystal wiring
  b.track('F', [b.pad(u16u2, '1'), b.pad(usbB, '1')], 0.5, '5V_SYS');
  b.track('F', [b.pad(mcu, '9'), b.pad(y1, '1')], 0.4, 'XTAL1');
  b.track('F', [b.pad(mcu, '10'), b.pad(y1, '2')], 0.4, 'XTAL2');

  // LEDs wiring
  b.track('F', [b.pad(tp5v, '1'), [30.0, 26.0], b.pad(rPwr, '1')], 0.5, '5V_SYS');
  b.track('F', [b.pad(rPwr, '2'), b.pad(ledPwr, '2')], 0.5, 'NET_ON_LED');
  b.track('F', [b.pad(mcu, '19'), [48.0, 38.0], b.pad(r13, '1')], 0.5, 'PIN_D13');
  b.track('F', [b.pad(r13, '2'), b.pad(led13, '2')], 0.5, 'NET_L_LED');

  // Ground plane & tracks
  b.track('B', [
    b.pad(dcJack, '2'), b.pad(usbB, '2'), b.pad(tpGnd, '1'), b.pad(cIn, '2'),
    b.pad(ldo5v, '2'), b.pad(cOut5v, '2'), b.pad(cOut3v3, '2'),
    b.pad(ledPwr, '1'), b.pad(led13, '1'), b.pad(mcu, '8'), b.pad(swRst, '2')
  ], 1.2, 'GND');

  // Silk text branding
  b.text([48.0, 34.0], 'ARDUINO UNO R3', 2.0);
  b.text([48.0, 31.5], 'ATMEGA328P · MADE IN ITALY', 1.0);
  b.text([48.0, 11.5], 'DIGITAL (PWM ~) · ANALOG IN · POWER', 0.85);

  return {
    format: 'pcbfix/1',
    id: 'preset-arduino-uno',
    meta: {
      title: 'Arduino Uno R3 (ATmega328P / 5V & 3.3V)',
      author: 'DEADBOARD Studio',
      difficulty: 2,
      description: 'Klasyczna płyta deweloperska Arduino Uno R3 z procesorem ATmega328P w podstawce DIP-28, gniazdem zasilania DC 9V, gniazdem USB Type-B, stabilizatorami 5.0V i 3.3V oraz diodami ON i L (D13).',
      hints: [
        'Sprawdź czy dioda zabezpieczająca D1_M7 nie ma przerwy przy zasilaniu z gniazda DC.',
        'Zmierz napięcie wyjściowe stabilizatora 5V na punkcie testowym TP_5V (wymagane 4.85V – 5.15V).',
        'Sprawdź czy stabilizator 3.3V LP2985 generuje stabilne 3.30V na punkcie TP_3V3.',
        'Sprawdź czy dioda ON świeci po podłączeniu zasilania.'
      ],
      credits: 'Arduino LLC open-source hardware schematics',
      license: 'CC-BY-SA-4.0'
    },
    board,
    objectives: [
      { type: 'voltage', a: '5V_SYS', min: 4.80, max: 5.20 },
      { type: 'voltage', a: '3V3_SYS', min: 3.15, max: 3.45 },
      { type: 'led', ref: 'LED_ON', on: true }
    ]
  };
}

// ============================================================================
// 3. Raspberry Pi Pico (51 x 21 mm)
// ============================================================================
export function createRaspberryPiPicoScenario(): Scenario {
  // Dimensions: 21.0 mm wide x 51.0 mm high
  const b = new Builder(21.0, 51.0);
  const board = b.b;
  board.color = '#15321f'; // Official Raspberry Pi emerald green

  // --- 1. MicroUSB Port at Top Center ---
  const vbus = b.header('J1_USB', 5.0, [10.5, 49.0], 0, 'MicroUSB 5V');
  vbus.body = { shape: 'header', w: 7.5, h: 5.5, z: 3.0 };
  const dSchottky = b.diode('D1_SS34', [10.5, 43.5], 90);
  b.text([10.5, 46.5], 'VBUS', 0.85);

  // --- 2. RT6150B Buck-Boost Regulator & Inductor ---
  const uReg = b.resistor('U1_RT6150', 0.02, [7.5, 38.0]);
  uReg.body = { shape: 'box', w: 3.0, h: 3.0, z: 1.0 };
  b.text([7.5, 40.5], 'RT6150B', 0.75);

  const l1 = b.resistor('L1_2U2', 0.05, [13.5, 38.0]);
  l1.body = { shape: 'box', w: 4.0, h: 4.0, z: 2.0, color: '#25292e' };
  b.text([13.5, 40.5], '2.2uH', 0.75);

  const cOut = b.resistor('C_OUT', 0.03, [10.5, 34.0]);
  cOut.body = { shape: 'box', w: 2.0, h: 1.25, z: 0.9 };
  b.text([10.5, 35.5], '22uF', 0.75);

  // --- 3. RP2040 Dual ARM Cortex-M0+ SoC in Center ---
  const rp2040 = addChip(b, 'U2_RP2040', [10.5, 26.0], 7.0, 7.0, 1.0, {
    kind: 'ic',
    value: 180,
    color: '#1a1b1d',
    label: 'RP2040',
    pads: [
      smdPad('1', [-3.2, -3.2]),
      smdPad('2', [3.2, -3.2]),
      smdPad('3', [3.2, 3.2]),
      smdPad('4', [-3.2, 3.2]),
    ],
    pins: { '1': '1', '2': '2' }
  });
  b.text([10.5, 27.2], 'RP2040', 1.2);
  b.text([10.5, 24.8], 'Raspberry Pi', 0.75);

  // 12MHz Crystal Resonator
  const y1 = addChip(b, 'Y1_12MHZ', [10.5, 31.0], 3.2, 2.5, 0.9, {
    kind: 'resistor',
    value: 1000000,
    color: '#c2c8d1',
    label: '12.000 MHz',
    shape: 'box'
  });
  b.text([10.5, 31.0], '12MHz', 0.65);

  // --- 4. W25Q128 / W25Q16 QSPI Flash (SOIC-8) ---
  const flash = addChip(b, 'U3_FLASH', [10.5, 17.5], 5.0, 4.0, 1.2, {
    kind: 'ic',
    value: 400,
    color: '#15171a',
    label: 'W25Q128',
    pads: [
      smdPad('1', [-2.2, -1.8]),
      smdPad('2', [2.2, -1.8]),
      smdPad('3', [2.2, 1.8]),
      smdPad('4', [-2.2, 1.8]),
    ],
    pins: { '1': '1', '2': '2' }
  });
  b.text([10.5, 17.5], 'W25Q128', 0.85);

  // --- 5. BOOTSEL Switch ---
  const swBoot = b.tactile('SW_BOOTSEL', [6.0, 20.0]);
  swBoot.body = { shape: 'tactile', w: 3.5, h: 3.5, z: 2.2 };
  b.text([6.0, 22.5], 'BOOTSEL', 0.7);

  // --- 6. User LED (Green) on GP25 ---
  const rLed = b.resistor('R_LED', 470, [15.0, 41.5]);
  rLed.body = { shape: 'box', w: 1.6, h: 0.8, z: 0.6 };
  const led = b.led('LED_GP25', 'green', [15.0, 44.0]);
  led.body = { shape: 'led', w: 2.0, h: 1.6, z: 1.2 };
  b.text([15.0, 45.8], 'GP25', 0.75);

  // --- 7. 3-Pin SWD Debug Header at Bottom ---
  const swdNames = ['SWCLK', 'GND', 'SWDIO'];
  addPinHeader(b, 'J_SWD', [10.5, 2.5], 3, swdNames, 'horizontal');
  b.text([10.5, 4.5], 'DEBUG (SWD)', 0.75);

  // --- 8. 40 Castellated Edge Pads (20 per side, 2.54mm pitch) ---
  const leftEdgeNames = [
    'GP0', 'GP1', 'GND', 'GP2', 'GP3', 'GP4', 'GP5', 'GND',
    'GP6', 'GP7', 'GP8', 'GP9', 'GND', 'GP10', 'GP11', 'GP12',
    'GP13', 'GND', 'GP14', 'GP15'
  ];
  addPinHeader(b, 'J_EDGE_L', [1.2, 25.5], 20, leftEdgeNames, 'vertical');

  const rightEdgeNames = [
    'VBUS', 'VSYS', 'GND', '3V3_EN', '3V3', 'ADC_REF', 'GP28', 'AGND',
    'GP27', 'GP26', 'RUN', 'GP22', 'GND', 'GP21', 'GP20', 'GP19',
    'GP18', 'GND', 'GP17', 'GP16'
  ];
  addPinHeader(b, 'J_EDGE_R', [19.8, 25.5], 20, rightEdgeNames, 'vertical');

  // Silkscreen text along edge pads
  for (let i = 0; i < 20; i++) {
    const yPos = 25.5 - (19 * 2.54) / 2 + i * 2.54;
    b.text([3.2, yPos], leftEdgeNames[i], 0.6);
    b.text([17.8, yPos], rightEdgeNames[i], 0.6);
  }

  // --- 9. Test Points ---
  const tpVsys = b.testpoint('TP_VSYS', [10.5, 40.5], 'VSYS');
  const tp3v3 = b.testpoint('TP_3V3', [10.5, 32.5], '3V3_OUT');
  const tpGnd = b.testpoint('TP_GND', [6.0, 15.0], 'GND');

  // --- 10. Copper Traces Routing ---
  b.track('F', [b.pad(rp2040, '1'), b.pad(y1, '1')], 0.4, 'XTAL_IN');
  b.track('F', [b.pad(vbus, '1'), b.pad(dSchottky, '1')], 0.8, 'VBUS');
  b.track('F', [b.pad(dSchottky, '2'), b.pad(tpVsys, '1'), b.pad(uReg, '1')], 0.8, 'VSYS');
  b.track('F', [b.pad(uReg, '2'), b.pad(l1, '1')], 1.0, 'SW_NODE');
  b.track('F', [b.pad(l1, '2'), b.pad(cOut, '1'), b.pad(tp3v3, '1'), b.pad(rp2040, '1'), b.pad(flash, '1')], 0.8, '3V3_OUT');
  b.track('F', [b.pad(rp2040, '2'), b.pad(rLed, '1')], 0.5, 'GPIO25');
  b.track('F', [b.pad(rLed, '2'), b.pad(led, '2')], 0.5, 'NET_LED');
  b.track('F', [b.pad(swBoot, '1'), b.pad(flash, '1')], 0.4, 'QSPI_CS');

  b.track('B', [
    b.pad(vbus, '2'), b.pad(tpGnd, '1'), b.pad(cOut, '2'),
    b.pad(led, '1'), b.pad(flash, '2'), b.pad(swBoot, '2')
  ], 1.2, 'GND');

  // Silkscreen text branding
  b.text([10.5, 12.0], 'Raspberry Pi Pico', 1.4);
  b.text([10.5, 9.8], 'RP2040 Dual ARM M0+', 0.85);
  b.text([10.5, 8.0], '© 2020 RPi Ltd', 0.75);

  return {
    format: 'pcbfix/1',
    id: 'preset-rpi-pico',
    meta: {
      title: 'Raspberry Pi Pico (RP2040 & RT6150B Buck-Boost)',
      author: 'DEADBOARD Studio',
      difficulty: 3,
      description: 'Oficjalna architektura Raspberry Pi Pico: dwurdzeniowy mikrokontroler RP2040, przetwornica impulsowa buck-boost RT6150B, pamięć QSPI Flash W25Q128, dioda LED na GP25 oraz 40 padów krawędziowych (castellated).',
      hints: [
        'Przetwornica RT6150B generuje stabilne napięcie 3.30V dla układu RP2040 i pamięci Flash.',
        'Sprawdź napięcie wyjściowe 3V3_OUT na punkcie pomiarowym TP_3V3.',
        'Sprawdź czy dioda Schottky D1 zabezpieczająca wejście VBUS nie ma zwarcia lub przerwy.',
        'Zbadaj węzeł przełączający przetwornicy impulsowej oscyloskopem.'
      ],
      credits: 'Raspberry Pi (Trading) Ltd Hardware Design with RP2040',
      license: 'BSD-3-Clause'
    },
    board,
    objectives: [
      { type: 'voltage', a: '3V3_OUT', min: 3.20, max: 3.40 },
      { type: 'led', ref: 'LED_GP25', on: true }
    ]
  };
}

// ============================================================================
// 4. Raspberry Pi Zero 2 W (65 x 30 mm)
// ============================================================================
export function createRaspberryPiZeroScenario(): Scenario {
  // Dimensions: 65.0 mm wide x 30.0 mm high
  const b = new Builder(65.0, 30.0);
  const board = b.b;
  board.color = '#173c20'; // Classic Raspberry Pi dark green

  // --- 1. Dual MicroUSB Ports at Bottom Edge ---
  // Power In port at x = 54.0, y = 2.0
  const pwrUsb = b.header('J1_PWR_IN', 5.0, [54.0, 2.4], 0, 'PWR IN 5V');
  pwrUsb.body = { shape: 'header', w: 7.5, h: 5.5, z: 3.0 };
  b.text([54.0, 6.2], 'PWR IN', 0.8);

  // OTG Data port at x = 41.5, y = 2.0
  const otgUsb = b.header('J2_USB_OTG', 0, [41.5, 2.4], 0, 'USB OTG');
  otgUsb.body = { shape: 'header', w: 7.5, h: 5.5, z: 3.0 };
  b.text([41.5, 6.2], 'USB', 0.8);

  // --- 2. Mini-HDMI Connector at x = 12.5, y = 2.5 ---
  addChip(b, 'J3_HDMI', [12.5, 2.5], 11.0, 7.5, 3.2, {
    kind: 'connector',
    color: '#c5cad1',
    label: 'MINI-HDMI',
    shape: 'header'
  });
  b.text([12.5, 7.5], 'HDMI', 0.85);

  // --- 3. CSI Camera Connector at Right Edge (x = 63.5, y = 15.0) ---
  addChip(b, 'J4_CAMERA', [63.5, 15.0], 2.5, 16.0, 1.5, {
    kind: 'connector',
    color: '#e0e4e8',
    label: 'CAMERA CSI',
    shape: 'box'
  });
  b.text([61.0, 15.0], 'CAMERA', 0.8);

  // --- 4. MicroSD Card Socket at Left Edge (x = 2.0, y = 15.0) ---
  addChip(b, 'J5_SD', [2.5, 15.0], 12.0, 11.0, 1.5, {
    kind: 'connector',
    color: '#8c949e',
    label: 'MICROSD',
    shape: 'box'
  });
  b.text([4.5, 22.0], 'SD', 0.8);

  // --- 5. Broadcom RP3A0-AU System-in-Package (Quad-core A53 + 512MB RAM) ---
  const soc = addChip(b, 'U1_RP3A0', [36.0, 14.0], 12.0, 12.0, 1.2, {
    kind: 'ic',
    value: 300,
    color: '#1a1b1d',
    label: 'RP3A0-AU',
    pads: [
      smdPad('1', [-5.0, -5.0]),
      smdPad('2', [5.0, -5.0]),
      smdPad('3', [5.0, 5.0]),
      smdPad('4', [-5.0, 5.0]),
    ],
    pins: { '1': '1', '2': '2' }
  });
  b.text([36.0, 15.5], 'RP3A0-AU', 1.4);
  b.text([36.0, 13.5], 'Raspberry Pi 2021', 0.8);
  b.text([36.0, 11.8], 'Quad-Core 64-bit', 0.75);

  // --- 6. Metal Wi-Fi / Bluetooth RF Shield Can ---
  addChip(b, 'U2_WIFI_RF', [17.5, 15.0], 10.0, 9.0, 1.8, {
    kind: 'ic',
    color: '#c5cbd1',
    label: 'WIFI-BLE',
    shape: 'chip'
  });
  b.text([17.5, 15.0], 'Wi-Fi / BT', 0.85);

  // --- 7. Power Management & 3.3V LDO ---
  const pmic = b.resistor('U3_PMIC', 0.02, [28.0, 14.0]);
  pmic.body = { shape: 'box', w: 4.0, h: 4.0, z: 1.0 };
  b.text([28.0, 17.5], '3.3V REG', 0.75);

  const cIn = b.resistor('C1_IN', 0.04, [50.0, 7.5]);
  cIn.body = { shape: 'box', w: 2.0, h: 1.25, z: 0.8 };
  const cOut = b.resistor('C2_OUT', 0.03, [28.0, 8.5]);
  cOut.body = { shape: 'box', w: 2.0, h: 1.25, z: 0.8 };

  // Activity LED (Green)
  const rAct = b.resistor('R_ACT', 1000, [59.0, 8.5]);
  rAct.body = { shape: 'box', w: 1.6, h: 0.8, z: 0.6 };
  const ledAct = b.led('LED_ACT', 'green', [59.0, 6.0]);
  ledAct.body = { shape: 'led', w: 2.0, h: 1.5, z: 1.2 };
  b.text([59.0, 4.2], 'ACT', 0.75);

  // --- 8. 40-Pin GPIO Header Footprint (2 x 20 pins, 2.54mm pitch) ---
  const gpioPinNames: string[] = [];
  for (let i = 1; i <= 40; i++) gpioPinNames.push(`P${i}`);
  addPinHeader(b, 'J_GPIO40', [36.0, 26.27], 20, gpioPinNames, 'horizontal', 2, 2.54);
  b.text([36.0, 22.0], '40-PIN GPIO HEADER (2x20)', 0.9);
  b.text([11.0, 27.5], '1', 0.85); // Pin 1 indicator

  // --- 9. Test Points ---
  const tp5v = b.testpoint('TP_5V', [54.0, 8.5], '5V_VBUS');
  const tp3v3 = b.testpoint('TP_3V3', [28.0, 6.0], '3V3_SYS');
  const tpGnd = b.testpoint('TP_GND', [46.0, 6.0], 'GND');

  // --- 10. Copper Traces Routing ---
  b.track('F', [b.pad(pwrUsb, '1'), b.pad(tp5v, '1'), b.pad(cIn, '1'), [28.0, 8.5], b.pad(pmic, '1')], 0.8, '5V_SYS');
  b.track('F', [b.pad(pmic, '2'), b.pad(cOut, '1'), b.pad(tp3v3, '1'), [36.0, 8.5], b.pad(soc, '1')], 0.8, '3V3_SYS');
  b.track('F', [b.pad(pmic, '2'), [59.0, 11.0], b.pad(rAct, '1')], 0.5, '3V3_SYS');
  b.track('F', [b.pad(rAct, '2'), b.pad(ledAct, '2')], 0.5, 'NET_ACT_LED');

  b.track('B', [
    b.pad(pwrUsb, '2'), b.pad(otgUsb, '2'), b.pad(tpGnd, '1'),
    b.pad(cIn, '2'), b.pad(cOut, '2'), b.pad(ledAct, '1'), b.pad(soc, '2')
  ], 1.2, 'GND');

  // Silkscreen text branding
  b.text([36.0, 3.5], 'Raspberry Pi Zero 2 W v1.0', 1.4);

  return {
    format: 'pcbfix/1',
    id: 'preset-rpi-zero',
    meta: {
      title: 'Raspberry Pi Zero 2 W (RP3A0 SiP / Wi-Fi)',
      author: 'DEADBOARD Studio',
      difficulty: 3,
      description: 'Zminiaturyzowany komputer jednopłytkowy Raspberry Pi Zero 2 W z 64-bitowym 4-rdzeniowym procesorem Broadcom RP3A0-AU (Cortex-A53), modułem Wi-Fi/BT, portem mini-HDMI, dwoma portami microUSB, złączem kamery CSI i 40-pinowym złączem GPIO.',
      hints: [
        'Sprawdź czy gniazdo zasilania PWR IN dostarcza pełne 5.0V na punkt testowy TP_5V.',
        'Sprawdź czy stabilizator zasilania generuje 3.30V na punkcie TP_3V3.',
        'Zweryfikuj czy dioda aktywności ACT (zielona) świeci prawidłowo.'
      ],
      credits: 'Raspberry Pi (Trading) Ltd Hardware Design',
      license: 'BSD-3-Clause'
    },
    board,
    objectives: [
      { type: 'voltage', a: '5V_SYS', min: 4.80, max: 5.20 },
      { type: 'voltage', a: '3V3_SYS', min: 3.15, max: 3.45 },
      { type: 'led', ref: 'LED_ACT', on: true }
    ]
  };
}

// ============================================================================
// 5. TPS54302 Synchronous Buck Converter (12V -> 3.3V 3A)
// ============================================================================
export function createDcDcBuckScenario(): Scenario {
  const b = new Builder(76, 44);

  // 12V In Header
  const vin = b.header('J1_IN', 12.0, [10, 22], 0, '12V VIN');
  b.text([10, 15], '12V VIN');

  // Input MLCC caps
  const cIn = b.resistor('C_IN', 0.05, [20, 22]);
  b.text([20, 28], '10uF 25V');

  // U1: TPS54302 Synchronous Buck Converter (SOT-23-6)
  const uBuck = b.resistor('U1_TPS54302', 0.02, [32, 22]);
  b.text([32, 28], 'TPS54302 3A');

  // Bootstrap capacitor
  const cBoot = b.resistor('C_BOOT', 0.05, [32, 12]);
  b.text([32, 7], '100nF BOOT');

  // Inductor 4.7uH
  const l1 = b.resistor('L1_4U7', 0.04, [44, 22]);
  b.text([44, 15], '4.7uH 3A');

  // Feedback divider (for 3.3V out: Vref = 0.596V -> Rtop = 45.3k, Rbot = 10k)
  const rTop = b.resistor('R_TOP', 45300, [56, 14]);
  const rBot = b.resistor('R_BOT', 10000, [56, 30]);
  b.text([56, 8], '45.3k FB');
  b.text([56, 36], '10k FB');

  // Output Filter
  const cOut = b.resistor('C_OUT', 0.02, [66, 22]);
  b.text([66, 28], '22uF 6.3V');

  // Test Points
  const tpVin = b.testpoint('TP_VIN', [10, 32], '12V_IN');
  const tpSw = b.testpoint('TP_SW', [38, 22], 'SW_NODE');
  const tpFb = b.testpoint('TP_FB', [56, 22], 'V_FEEDBACK');
  const tpVout = b.testpoint('TP_VOUT', [66, 12], '3V3_OUT');
  const tpGnd = b.testpoint('TP_GND', [10, 8], 'GND');

  // Wiring
  b.track('F', [b.pad(vin, '1'), b.pad(tpVin, '1'), b.pad(cIn, '1'), b.pad(uBuck, '1')], 1.0, '12V_IN');
  b.track('F', [b.pad(uBuck, '2'), b.pad(tpSw, '1'), b.pad(l1, '1'), b.pad(cBoot, '1')], 1.2, 'SW_NODE');
  b.track('F', [b.pad(l1, '2'), b.pad(cOut, '1'), b.pad(tpVout, '1'), b.pad(rTop, '1')], 1.0, '3V3_OUT');
  b.track('F', [b.pad(rTop, '2'), b.pad(tpFb, '1'), b.pad(rBot, '1'), [50, 22], b.pad(uBuck, '1')], 0.4, 'FB_NODE');

  b.track('B', [b.pad(vin, '2'), b.pad(tpGnd, '1'), b.pad(cIn, '2'), b.pad(rBot, '2'), b.pad(cOut, '2')], 1.2, 'GND');

  b.text([38, 3], 'TPS54302 SYNCHRONOUS BUCK CONVERTER (12V → 3.3V 3A)', 1.5);
  b.text([38, 41], 'SWITCH NODE &middot; BOOTSTRAP CIRCUIT &middot; FEEDBACK LOOP', 1.1);

  const board = b.b;
  board.color = '#381622'; // Burgundy/purple PCB

  return {
    format: 'pcbfix/1',
    id: 'preset-dcdc-buck',
    meta: {
      title: 'Regulowana przetwornica Step-Down TPS54302 (12V → 3.3V 3A)',
      author: 'DEADBOARD Studio',
      difficulty: 3,
      description: 'Klasyczny układ przetwornicy impulsowej ze sprzężeniem zwrotnym FB, kondensatorem bootstrap i dławikiem 4.7µH. Zbadaj kluczowanie na węźle SW oscyloskopem.',
      hints: [
        'Węzeł przełączający TP_SW powinien wykazywać prostokątny przebieg kluczowania 400kHz.',
        'Sprawdź napięcie dzielnika sprzężenia zwrotnego na TP_FB (powinno wynosić 0.596V).',
        'Zbadaj tętnienia napięcia wyjściowego 3.3V w trybie Roll oscyloskopu.'
      ],
      credits: 'Texas Instruments TPS54302 Reference Design',
      license: 'TI-Reference'
    },
    board,
    objectives: [
      { type: 'voltage', a: '3V3_OUT', min: 3.20, max: 3.40 }
    ]
  };
}

export function createAutomotiveEcuScenario(): Scenario {
  const b = new Builder(100, 60);

  // 1. Terminal 30 (12V Battery Header)
  const j1 = b.header('J1_BAT', 12.0, [10, 30], 0, 'KL30 12V');
  b.text([10, 22], 'KL30 BAT 12V');

  // 2. Automotive Fuse (Blade Fuse 5A)
  const f1 = b.fuse('F1', 5.0, [22, 30], 0);
  b.text([22, 24], '5A BLADE');

  // 3. TVS / Reverse Protection Diode (SMBJ14A)
  // Cathode (pad 1) to +12V_PROT, Anode (pad 2) to GND
  const d1 = b.diode('D1_TVS', [22, 16], 90);
  b.text([22, 9], 'SMBJ14A TVS');

  // 4. Reservoir Capacitor (470uF 25V)
  const c1 = b.resistor('C1_RES', 0.05, [34, 16]);
  b.text([34, 9], '470uF 25V');

  // 5. Ignition Switch (Terminal 15)
  const swIgn = b.tactile('SW1_IGN', [34, 30]);
  b.text([34, 37], 'KL15 IGN');

  // 6. Automotive 5V LDO (TLE4275 / LM2940)
  const uLdo = b.resistor('U1_LDO', 0.02, [48, 30]);
  b.text([48, 24], 'TLE4275 5V');

  // 7. Power LED (Green) + Resistor (330 Ohm)
  const rPwr = b.resistor('R1_PWR', 330, [48, 40]);
  const dPwr = b.led('D2_PWR', 'green', [48, 48]);
  b.text([48, 54], 'ECU PWR');

  // 8. Protected 5V Sensor Rail LDO/Buffer
  const uSens = b.resistor('U2_SENS', 0.02, [62, 30]);
  b.text([62, 24], '5V SENSOR RAIL');

  // Sensor LED (Blue) + Resistor (330 Ohm)
  const rSens = b.resistor('R2_SENS', 330, [62, 40]);
  const dSens = b.led('D3_SENS', 'blue', [62, 48]);
  b.text([62, 54], 'SENS 5V');

  // 9. Analog Sensor Divider (MAP / Temp sensor input)
  const rTop = b.resistor('R3_MAP', 4700, [74, 18]);
  const rBot = b.resistor('R4_MAP', 2200, [74, 30]);
  b.text([74, 11], '4.7k PULLUP');
  b.text([74, 24], '2.2k MAP');

  // 10. Low-side Injector Power Switch & Inductive Flyback Diode
  const qInj = b.resistor('Q1_INJ', 0.05, [86, 30]);
  b.text([86, 24], 'INJ MOSFET');
  const dFly = b.diode('D4_FLY', [86, 16], 90);
  b.text([86, 9], 'UF4007 CLAMP');

  // Injector indicator LED (Yellow) + Resistor (470 Ohm)
  const rInj = b.resistor('R5_INJ', 470, [86, 40]);
  const dInj = b.led('D5_INJ', 'yellow', [86, 48]);
  b.text([86, 54], 'INJ ACTIVE');

  // Test Points
  const tpBat = b.testpoint('TP_BAT', [10, 42], 'KL30_12V');
  const tpIgn = b.testpoint('TP_IGN', [34, 46], 'KL15_IGN');
  const tp5v = b.testpoint('TP_5V', [48, 16], '5V_VCC');
  const tpSens = b.testpoint('TP_SENS', [62, 16], '5V_SENS');
  const tpMap = b.testpoint('TP_MAP', [74, 42], 'MAP_SIG');
  const tpInj = b.testpoint('TP_INJ', [86, 4], 'INJ_DRV');
  const tpGnd = b.testpoint('TP_GND', [10, 16], 'GND');

  // Top wiring (traces)
  b.track('F', [b.pad(j1, '1'), b.pad(tpBat, '1'), b.pad(f1, '1')], 1.5, '12V_BAT');
  b.track('F', [b.pad(f1, '2'), b.pad(d1, '1'), b.pad(c1, '1'), b.pad(swIgn, '1'), [34, 12], [86, 12], b.pad(dFly, '1')], 1.5, '12V_PROT');
  b.track('F', [b.pad(swIgn, '2'), b.pad(tpIgn, '1'), b.pad(uLdo, '1')], 1.2, 'KL15_IGN');
  b.track('F', [b.pad(uLdo, '2'), b.pad(tp5v, '1'), b.pad(rPwr, '1'), b.pad(uSens, '1'), b.pad(rTop, '1')], 1.0, '5V_VCC');
  b.track('F', [b.pad(rPwr, '2'), b.pad(dPwr, '2')], 0.6, 'PWR_LED');
  b.track('F', [b.pad(uSens, '2'), b.pad(tpSens, '1'), b.pad(rSens, '1')], 0.8, '5V_SENS');
  b.track('F', [b.pad(rSens, '2'), b.pad(dSens, '2')], 0.6, 'SENS_LED');
  b.track('F', [b.pad(rTop, '2'), b.pad(rBot, '1'), b.pad(tpMap, '1')], 0.5, 'MAP_SIG');
  b.track('F', [b.pad(qInj, '1'), b.pad(dFly, '2'), b.pad(tpInj, '1'), b.pad(rInj, '1')], 1.2, 'INJ_DRV');
  b.track('F', [b.pad(rInj, '2'), b.pad(dInj, '2')], 0.6, 'INJ_LED');

  // Bottom Ground Bus
  b.track('B', [
    b.pad(j1, '2'),
    b.pad(tpGnd, '1'),
    b.pad(d1, '2'),
    b.pad(c1, '2'),
    b.pad(dPwr, '1'),
    b.pad(dSens, '1'),
    b.pad(dInj, '1'),
    b.pad(rBot, '2'),
    b.pad(qInj, '2')
  ], 1.5, 'GND');

  // Silkscreen Titles
  b.text([50, 4], 'AUTOMOTIVE POWERTRAIN ECU (EDC DIESEL/GASOLINE BENCH)', 1.5);
  b.text([50, 58], 'KL30 BATTERY · KL15 IGNITION · 5V SENSORS · SOLENOID INJECTOR STAGE', 1.1);

  const board = b.b;
  board.color = '#1b3b2b'; // Dark automotive ECU green

  return {
    format: 'pcbfix/1',
    id: 'preset-automotive-ecu',
    meta: {
      title: 'Sterownik silnika ECU (Architektura EDC / 12V)',
      author: 'DEADBOARD Automotive Lab',
      difficulty: 3,
      description: 'Przemysłowy sterownik wtrysku i zasilania ECU: stałe zasilanie 12V (KL30), linia zapłonu (KL15), dioda zabezpieczająca TVS, bezpiecznik 5A, stabilizator 5V logiczny i referencyjny sensorów oraz stopień mocy wtryskiwacza z diodą gaszącą.',
      hints: [
        'Podłącz zasilanie 12V do J1_BAT i zbadaj obecność 12V na bezpieczniku F1 oraz diodzie TVS D1.',
        'Włącz zapłon naciskając przełącznik SW1_IGN (KL15), aby podać napięcie na stabilizator U1_LDO.',
        'Zweryfikuj obecność stabilnego 5.0V na TP_5V oraz 5V na szynie czujników TP_SENS.',
        'Sprawdź diodę gaszącą D4_FLY oraz stopień sterowania wtryskiwaczem na węźle INJ_DRV.'
      ],
      credits: 'Automotive Powertrain EDC Architecture Standard',
      license: 'Apache-2.0'
    },
    board,
    objectives: [
      { type: 'voltage', a: '5V_VCC', min: 4.80, max: 5.25 }
    ]
  };
}

export const BOARD_PRESETS: BoardPreset[] = [
  {
    id: 'preset-esp32-devkit',
    titlePl: 'ESP32 DevKit V1 (Wi-Fi + BLE / 3.3V LDO)',
    titleEn: 'ESP32 DevKit V1 (Wi-Fi + BLE / 3.3V LDO)',
    descPl: 'Oficjalna płytka ESP32 DevKit V1 z anteną meandrową PCB, ekranem RF ESP-WROOM-32, stabilizatorem AMS1117-3.3, portem USB i 30 pinami GPIO.',
    descEn: 'Authentic ESP32 DevKit V1 with serpentine PCB antenna, ESP-WROOM-32 RF shield, AMS1117-3.3 LDO, USB port, and 30 GPIO pins.',
    category: 'mcu',
    create: createEsp32DevScenario
  },
  {
    id: 'preset-arduino-uno',
    titlePl: 'Arduino Uno R3 (ATmega328P / 5V & 3.3V)',
    titleEn: 'Arduino Uno R3 (ATmega328P / 5V & 3.3V)',
    descPl: 'Klasyczna płyta Arduino Uno R3 z procesorem ATmega328P w podstawce DIP-28, gniazdem DC 9V, USB Type-B i kompletem złączy.',
    descEn: 'Classic Arduino Uno R3 with socketed DIP-28 ATmega328P, 9V DC jack, USB Type-B, and full headers.',
    category: 'mcu',
    create: createArduinoUnoScenario
  },
  {
    id: 'preset-rpi-pico',
    titlePl: 'Raspberry Pi Pico (RP2040 & RT6150B Buck-Boost)',
    titleEn: 'Raspberry Pi Pico (RP2040 & RT6150B Buck-Boost)',
    descPl: 'Dwurdzeniowy układ RP2040 z przetwornicą buck-boost, pamięcią QSPI Flash, 40 padami krawędziowymi i portem microUSB.',
    descEn: 'Dual-core RP2040 MCU with RT6150B buck-boost converter, QSPI Flash, 40 castellated pads, and microUSB.',
    category: 'mcu',
    create: createRaspberryPiPicoScenario
  },
  {
    id: 'preset-rpi-zero',
    titlePl: 'Raspberry Pi Zero 2 W (RP3A0 SiP / Wi-Fi)',
    titleEn: 'Raspberry Pi Zero 2 W (RP3A0 SiP / Wi-Fi)',
    descPl: 'Minikomputer z 64-bitowym 4-rdzeniowym procesorem RP3A0-AU, mini-HDMI, dwoma portami microUSB i złączem kamery CSI.',
    descEn: 'Single-board computer with quad-core 64-bit RP3A0-AU SiP, mini-HDMI, dual microUSB, and CSI camera port.',
    category: 'mcu',
    create: createRaspberryPiZeroScenario
  },
  {
    id: 'preset-dcdc-buck',
    titlePl: 'Przetwornica DC-DC Step-Down TPS54302 (12V → 3.3V 3A)',
    titleEn: 'TPS54302 Synchronous Step-Down DC-DC (12V → 3.3V 3A)',
    descPl: 'Wysokowydajny konwerter impulsowy 400kHz z pętlą sprzężenia zwrotnego i kondensatorem bootstrap.',
    descEn: 'High efficiency 400kHz synchronous buck regulator with FB voltage divider and bootstrap cap.',
    category: 'power',
    create: createDcDcBuckScenario
  },
  {
    id: 'preset-automotive-ecu',
    titlePl: 'Sterownik silnika ECU (Architektura EDC / 12V)',
    titleEn: 'Automotive Powertrain ECU (EDC Architecture / 12V)',
    descPl: 'Przemysłowy sterownik ECU ze stałym zasilaniem KL30 12V, linią zapłonu KL15, ochroną TVS, regulatorem 5V sensorów i sterowaniem wtryskiwaczem.',
    descEn: 'Industrial ECU board with KL30 12V battery, KL15 ignition switch, TVS protection, 5V sensor rail, and solenoid injector driver.',
    category: 'power',
    create: createAutomotiveEcuScenario
  }
];
