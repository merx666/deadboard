// Unit tests for realistic board presets (ESP32 DevKit V1, Arduino Uno R3, RPi Pico, RPi Zero 2 W)
import {
  BOARD_PRESETS,
  createEsp32DevScenario,
  createArduinoUnoScenario,
  createRaspberryPiPicoScenario,
  createRaspberryPiZeroScenario,
  createDcDcBuckScenario,
} from '../src/boards/presets';
import { buildConnectivity } from '../src/connectivity';
import { simulateSpice } from '../src/spice/adapter';

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error(m);
}

console.log('Running Board Presets validation tests...');

// 1. Verify BOARD_PRESETS registry
assert(BOARD_PRESETS.length === 5, 'Must have exactly 5 board presets');
const presetIds = BOARD_PRESETS.map((p) => p.id);
assert(presetIds.includes('preset-esp32-devkit'), 'Registry contains ESP32 DevKit preset');
assert(presetIds.includes('preset-arduino-uno'), 'Registry contains Arduino Uno preset');
assert(presetIds.includes('preset-rpi-pico'), 'Registry contains Raspberry Pi Pico preset');
assert(presetIds.includes('preset-rpi-zero'), 'Registry contains Raspberry Pi Zero 2 W preset');
assert(presetIds.includes('preset-dcdc-buck'), 'Registry contains TPS54302 Buck preset');

// 2. Validate ESP32 DevKit V1
const espSc = createEsp32DevScenario();
const espB = espSc.board;
assert(espB.w === 28.5 && espB.h === 51.5, 'ESP32 dimensions are authentic 28.5 x 51.5 mm');
assert(espB.color === '#14171a', 'ESP32 has sleek matte black solder mask');

// Verify Serpentine Antenna
const antennaTraces = espB.traces.filter((t) => t.net === 'ANTENNA');
assert(antennaTraces.length >= 8, 'ESP32 has golden meandered serpentine antenna traces at top');
const keepoutText = espB.texts.find((t) => t.text.includes('ANTENNA KEEP-OUT'));
assert(keepoutText !== undefined, 'ESP32 has antenna keepout silkscreen marking');

// Verify ESP-WROOM-32 RF Shield
const rfShield = espB.components.find((c) => c.ref === 'U2_ESP32');
assert(rfShield !== undefined, 'ESP-WROOM-32 RF shield component exists');
assert(rfShield.body.w === 18.0 && rfShield.body.h === 18.0, 'ESP-WROOM-32 shield is 18x18 mm');
assert(rfShield.body.color === '#c5cad1', 'ESP-WROOM-32 shield has metallic silver color');

// Verify MicroUSB and AMS1117-3.3
const espUsb = espB.components.find((c) => c.ref === 'J1_USB');
assert(espUsb !== undefined && espUsb.value === 5.0, 'ESP32 has 5V USB receptacle');
const espLdo = espB.components.find((c) => c.ref === 'U1_AMS1117');
assert(espLdo !== undefined, 'ESP32 has AMS1117-3.3 LDO regulator');

// Verify EN and BOOT tactile buttons
const swEn = espB.components.find((c) => c.ref === 'SW1_EN');
const swBoot = espB.components.find((c) => c.ref === 'SW2_BOOT');
assert(swEn !== undefined && swBoot !== undefined, 'ESP32 has both EN and BOOT push buttons');

// Verify Status LEDs
const dPwr = espB.components.find((c) => c.ref === 'D1_PWR');
const dIo2 = espB.components.find((c) => c.ref === 'D2_IO2');
assert(dPwr !== undefined && dPwr.color === 'red', 'ESP32 has Red PWR LED');
assert(dIo2 !== undefined && dIo2.color === 'blue', 'ESP32 has Blue GPIO2 LED');

// Verify Dual 15-pin 2.54mm Headers
const hLeft = espB.components.find((c) => c.ref === 'J_LEFT');
const hRight = espB.components.find((c) => c.ref === 'J_RIGHT');
assert(hLeft !== undefined && hLeft.pads.length === 15, 'Left header has 15 pins');
assert(hRight !== undefined && hRight.pads.length === 15, 'Right header has 15 pins');
assert(hLeft.body.shape === 'header' && hRight.body.shape === 'header', 'Headers have header body shape');

// 3. Validate Arduino Uno R3
const unoSc = createArduinoUnoScenario();
const unoB = unoSc.board;
assert(unoB.w === 68.6 && unoB.h === 53.4, 'Arduino Uno dimensions are authentic 68.6 x 53.4 mm');
assert(unoB.color === '#005c8a', 'Arduino Uno has authentic Italian blue solder mask');

// Verify USB Type-B and DC Barrel Jack
const unoUsbB = unoB.components.find((c) => c.ref === 'J1_USB_B');
assert(unoUsbB !== undefined && unoUsbB.body.w === 12.0, 'Arduino Uno has USB Type-B receptacle');
const unoDc = unoB.components.find((c) => c.ref === 'J2_DC');
assert(unoDc !== undefined && unoDc.value === 9.0, 'Arduino Uno has 2.1mm DC barrel jack');

// Verify ATmega328P DIP-28 Socketed Microcontroller
const mcu = unoB.components.find((c) => c.ref === 'U3_ATMEGA328P');
assert(mcu !== undefined, 'ATmega328P component exists');
assert(mcu.pads.length === 28, 'ATmega328P has 28 pins (DIP-28)');
assert(mcu.body.w > 30, 'ATmega328P DIP-28 has length > 30 mm');

// Verify 16 MHz Crystal Oscillator
const y1 = unoB.components.find((c) => c.ref === 'Y1_16MHZ');
assert(y1 !== undefined, '16 MHz crystal oscillator exists');

// Verify Headers
const digHigh = unoB.components.find((c) => c.ref === 'J_DIG_HIGH');
const digLow = unoB.components.find((c) => c.ref === 'J_DIG_LOW');
const pwrHeader = unoB.components.find((c) => c.ref === 'J_PWR');
const analogHeader = unoB.components.find((c) => c.ref === 'J_ANALOG');
assert(digHigh !== undefined && digHigh.pads.length === 10, 'Digital High header has 10 pins');
assert(digLow !== undefined && digLow.pads.length === 8, 'Digital Low header has 8 pins');
assert(pwrHeader !== undefined && pwrHeader.pads.length === 8, 'Power header has 8 pins');
assert(analogHeader !== undefined && analogHeader.pads.length === 6, 'Analog header has 6 pins');

// 4. Validate Raspberry Pi Pico
const picoSc = createRaspberryPiPicoScenario();
const picoB = picoSc.board;
assert(picoB.w === 21.0 && picoB.h === 51.0, 'Pico dimensions are authentic 21.0 x 51.0 mm');
assert(picoB.color === '#15321f', 'Pico has official emerald green solder mask');

const rp2040 = picoB.components.find((c) => c.ref === 'U2_RP2040');
assert(rp2040 !== undefined && rp2040.body.w === 7.0, 'RP2040 QFN SoC exists');

const flash = picoB.components.find((c) => c.ref === 'U3_FLASH');
assert(flash !== undefined, 'QSPI Flash memory exists');

const swBootPico = picoB.components.find((c) => c.ref === 'SW_BOOTSEL');
assert(swBootPico !== undefined, 'BOOTSEL button exists');

const edgeL = picoB.components.find((c) => c.ref === 'J_EDGE_L');
const edgeR = picoB.components.find((c) => c.ref === 'J_EDGE_R');
assert(edgeL !== undefined && edgeL.pads.length === 20, 'Pico has 20 edge pads on left');
assert(edgeR !== undefined && edgeR.pads.length === 20, 'Pico has 20 edge pads on right');

const swd = picoB.components.find((c) => c.ref === 'J_SWD');
assert(swd !== undefined && swd.pads.length === 3, 'Pico has 3-pin SWD debug header');

// 5. Validate Raspberry Pi Zero 2 W
const zeroSc = createRaspberryPiZeroScenario();
const zeroB = zeroSc.board;
assert(zeroB.w === 65.0 && zeroB.h === 30.0, 'Pi Zero 2 W dimensions are authentic 65.0 x 30.0 mm');

const zeroSoc = zeroB.components.find((c) => c.ref === 'U1_RP3A0');
assert(zeroSoc !== undefined && zeroSoc.body.w === 12.0, 'Broadcom RP3A0-AU SiP exists (12x12 mm)');

const gpio40 = zeroB.components.find((c) => c.ref === 'J_GPIO40');
assert(gpio40 !== undefined && gpio40.pads.length === 40, '40-pin GPIO header footprint exists');

const hdmi = zeroB.components.find((c) => c.ref === 'J3_HDMI');
assert(hdmi !== undefined, 'Mini-HDMI connector exists');

const pwrIn = zeroB.components.find((c) => c.ref === 'J1_PWR_IN');
const otg = zeroB.components.find((c) => c.ref === 'J2_USB_OTG');
assert(pwrIn !== undefined && otg !== undefined, 'Dual microUSB ports exist');

const cam = zeroB.components.find((c) => c.ref === 'J4_CAMERA');
assert(cam !== undefined, 'CSI camera connector exists');

// 6. Validate TPS54302 Buck Converter
const buckSc = createDcDcBuckScenario();
assert(buckSc.board.w === 76 && buckSc.board.h === 44, 'Buck dimensions are 76 x 44 mm');

// 7. Test Connectivity and SPICE Solvability for all 5 presets
for (const preset of BOARD_PRESETS) {
  const sc = preset.create();
  const conn = buildConnectivity(sc.board);
  assert(conn.netNames.length > 0, `Preset ${preset.id} has nets`);
  const spice = simulateSpice(sc.board, conn);
  assert(spice.V.length > 0, `Preset ${preset.id} successfully solves in SPICE`);
}

console.log('Board Presets: ESP32 DevKit V1, Arduino Uno R3, RPi Pico, RPi Zero 2 W, and Buck SPICE — ok');
