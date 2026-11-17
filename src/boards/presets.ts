// Pre-made realistic modular boards: ESP32, Raspberry Pi Pico, Arduino Uno, Raspberry Pi Zero
// Ready to inspect, probe with multimeter, scope, and thermal camera, and export as mods.

import type { Scenario } from '../types';
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

export function createEsp32DevScenario(): Scenario {
  const b = new Builder(84, 52);

  // DC / USB Input header
  const vin = b.header('J1', 5.0, [10, 26], 0, 'USB 5V');
  const fuse = b.fuse('F1', 1.0, [20, 36]);
  b.text([10, 20], 'USB IN 5V');

  // Input filter
  const c1 = b.resistor('C1', 0.05, [28, 36]); // C1 MLCC 10uF (represented with ESR in board)
  b.text([28, 41], '10uF / 16V');

  // U1: AMS1117-3.3 LDO (SOT-223)
  const u1 = b.resistor('U1_LDO', 0.01, [38, 36]);
  b.text([38, 43], 'AMS1117-3.3');

  // Output filter 3.3V
  const c2 = b.resistor('C2', 0.04, [48, 36]);
  b.text([48, 41], '10uF 3.3V');

  // U2: ESP32-WROOM-32D Core Module
  const esp = b.resistor('U2_ESP32', 220, [64, 26]);
  b.text([64, 10], 'ESP32-WROOM-32D', 1.8);
  b.text([64, 14], 'Wi-Fi + BLE Dual Core', 1.2);

  // Power LED (Red)
  const r1 = b.resistor('R1', 1000, [38, 16], 0, 7.62);
  const d1 = b.led('D1_PWR', 'red', [48, 16]);
  b.text([48, 10], 'PWR (Red)');

  // GPIO2 Status LED (Blue)
  const r2 = b.resistor('R2', 1000, [60, 42], 0, 7.62);
  const d2 = b.led('D2_IO2', 'blue', [72, 42]);
  b.text([72, 47], 'GPIO2 (Blue)');

  // EN (Reset) Tactile Switch
  const swEn = b.tactile('SW1_EN', [18, 14]);
  b.text([18, 8], 'EN / RST');

  // BOOT (GPIO0) Tactile Switch
  const swBoot = b.tactile('SW2_BOOT', [28, 14]);
  b.text([28, 8], 'BOOT (IO0)');

  // Test Points
  const tp5v = b.testpoint('TP_5V', [18, 44], '5V_VBUS');
  const tp3v3 = b.testpoint('TP_3V3', [48, 46], '3V3_REG');
  const tpRst = b.testpoint('TP_EN', [18, 22], 'EN_PULLUP');
  const tpGnd = b.testpoint('TP_GND', [10, 44], 'GND');

  // Copper traces routing
  // 5V bus
  b.track('F', [b.pad(vin, '1'), [14, 26], [14, 36], b.pad(fuse, '1')], 0.8, 'VBUS_5V');
  b.track('F', [b.pad(fuse, '2'), b.pad(c1, '1'), b.pad(u1, '1'), b.pad(tp5v, '1')], 0.8, 'VBUS_PROTECTED');

  // 3.3V bus
  b.track('F', [b.pad(u1, '2'), b.pad(c2, '1'), b.pad(tp3v3, '1'), [56, 36], b.pad(esp, '1')], 0.8, '3V3_SYSTEM');
  b.track('F', [b.pad(u1, '2'), [38, 26], [38, 16], b.pad(r1, '1')], 0.6, '3V3_SYSTEM');
  b.track('F', [b.pad(r1, '2'), b.pad(d1, '2')], 0.6, 'NET_LED_PWR');

  // Ground plane & tracks
  b.track('B', [b.pad(vin, '2'), b.pad(tpGnd, '1'), b.pad(c1, '2'), b.pad(u1, '2'), b.pad(c2, '2'), b.pad(d1, '1'), b.pad(esp, '2')], 1.2, 'GND');

  // Push buttons and GPIO2 LED
  b.track('F', [b.pad(swEn, '1'), b.pad(tpRst, '1')], 0.4, 'EN_PULLUP');
  b.track('B', [b.pad(swEn, '2'), b.pad(tpGnd, '1')], 0.6, 'GND');
  b.track('F', [b.pad(swBoot, '1'), b.pad(esp, '1')], 0.4, 'GPIO0');
  b.track('B', [b.pad(swBoot, '2'), b.pad(tpGnd, '1')], 0.6, 'GND');
  b.track('F', [b.pad(esp, '1'), b.pad(r2, '1')], 0.4, 'GPIO2');
  b.track('F', [b.pad(r2, '2'), b.pad(d2, '2')], 0.4, 'NET_LED_IO2');
  b.track('B', [b.pad(d2, '1'), b.pad(tpGnd, '1')], 0.6, 'GND');

  // Board outline silk
  b.text([42, 4], 'DEADBOARD · ESP32-WROOM-32D IoT DEVBOARD', 1.8);
  b.text([42, 49], 'PCBWAY / LCSC C473012 · 3.3V LDO · ANTENNA KEEP-OUT', 1.2);

  const board = b.b;
  board.color = '#124422'; // Classic green PCB

  return {
    format: 'pcbfix/1',
    id: 'preset-esp32-devkit',
    meta: {
      title: 'ESP32-WROOM-32D IoT DevBoard (3.3V / Wi-Fi)',
      author: 'DEADBOARD Studio',
      difficulty: 2,
      description: 'Płytka ewaluacyjna z modułem ESP32-WROOM-32D, stabilizatorem AMS1117-3.3V, zabezpieczeniem wejścia USB, przyciskami EN/BOOT oraz diodami PWR i GPIO2. Diagnozuj szynę 3.3V, tętnienia i zasilanie procesora.',
      hints: [
        'Sprawdź czy bezpiecznik F1 przewodzi 5V z wejścia USB do wejścia stabilizatora U1.',
        'Zmierz napięcie na punkcie testowym TP_3V3 (powinno wynosić 3.25V – 3.35V).',
        'Sprawdź prąd spoczynkowy modułu ESP32 na zasilaczu laboratoryjnym (~15-25 mA).'
      ],
      credits: 'Espressif Systems ESP32-WROOM-32D Hardware Design Guidelines',
      license: 'Apache-2.0'
    },
    board,
    objectives: [
      { type: 'voltage', a: '3V3_SYSTEM', min: 3.15, max: 3.45 },
      { type: 'led', ref: 'D1_PWR', on: true }
    ]
  };
}

export function createRaspberryPiPicoScenario(): Scenario {
  const b = new Builder(86, 46);

  // USB VBUS In
  const vbus = b.header('J1', 5.0, [10, 23], 0, 'VBUS 5V');
  const dSchottky = b.diode('D1_SS34', [20, 23]);
  b.text([10, 16], 'USB VBUS');

  // U1: RT6150B Buck-Boost Regulator
  const uReg = b.resistor('U1_RT6150', 0.02, [32, 23]);
  b.text([32, 29], 'RT6150B Buck-Boost');

  // Inductor 2.2uH
  const l1 = b.resistor('L1', 0.05, [42, 23]);
  b.text([42, 17], '2.2uH IND');

  // Filter capacitors
  const cOut = b.resistor('C_OUT', 0.03, [50, 23]);
  b.text([50, 29], '22uF 3.3V');

  // U2: RP2040 Dual Cortex-M0+ SoC
  const rp2040 = b.resistor('U2_RP2040', 180, [66, 23]);
  b.text([66, 12], 'RP2040 MCU', 1.8);
  b.text([66, 15], 'Dual ARM Cortex-M0+', 1.1);

  // QSPI Flash W25Q16
  const flash = b.resistor('U3_FLASH', 400, [66, 36]);
  b.text([66, 41], 'W25Q16 QSPI Flash (2MB)');

  // User LED (Green) on GP25
  const rLed = b.resistor('R_LED', 470, [78, 14]);
  const led = b.led('LED_GP25', 'green', [78, 23]);
  b.text([78, 29], 'GP25 LED');

  // BOOTSEL Switch
  const swBoot = b.tactile('SW_BOOTSEL', [32, 36]);
  b.text([32, 42], 'BOOTSEL');

  // Test Points
  const tpVsys = b.testpoint('TP_VSYS', [20, 34], 'VSYS');
  const tp3v3 = b.testpoint('TP_3V3', [50, 14], '3V3_OUT');
  const tpGnd = b.testpoint('TP_GND', [10, 34], 'GND');

  // Wiring
  b.track('F', [b.pad(vbus, '1'), b.pad(dSchottky, '1')], 0.8, 'VBUS');
  b.track('F', [b.pad(dSchottky, '2'), b.pad(tpVsys, '1'), b.pad(uReg, '1')], 0.8, 'VSYS');
  b.track('F', [b.pad(uReg, '2'), b.pad(l1, '1')], 1.0, 'SW_NODE');
  b.track('F', [b.pad(l1, '2'), b.pad(cOut, '1'), b.pad(tp3v3, '1'), b.pad(rp2040, '1'), b.pad(flash, '1')], 0.8, '3V3_OUT');
  b.track('F', [b.pad(rp2040, '2'), b.pad(rLed, '1')], 0.5, 'GPIO25');
  b.track('F', [b.pad(rLed, '2'), b.pad(led, '2')], 0.5, 'NET_LED');
  b.track('F', [b.pad(swBoot, '1'), b.pad(flash, '1')], 0.4, 'QSPI_CS');

  b.track('B', [b.pad(vbus, '2'), b.pad(tpGnd, '1'), b.pad(cOut, '2'), b.pad(led, '1'), b.pad(flash, '2'), b.pad(swBoot, '2')], 1.2, 'GND');

  b.text([43, 4], 'RASPBERRY PI PICO / RP2040 SUBSYSTEM', 1.8);
  b.text([43, 43], 'RT6150B BUCK-BOOST · W25Q16 FLASH · 133MHz', 1.1);

  const board = b.b;
  board.color = '#15321f';

  return {
    format: 'pcbfix/1',
    id: 'preset-rpi-pico',
    meta: {
      title: 'Raspberry Pi Pico (RP2040 & RT6150B Buck-Boost)',
      author: 'DEADBOARD Studio',
      difficulty: 3,
      description: 'Oficjalna architektura zasilania i mikrokontrolera Raspberry Pi Pico. Zawiera przetwornicę buck-boost RT6150B, układ RP2040, pamięć QSPI Flash W25Q16 oraz diodę LED na GP25.',
      hints: [
        'Przetwornica RT6150B pracuje w trybie impulsowym — zbadaj węzeł przełączania oscyloskopem.',
        'Sprawdź czy napięcie 3V3_OUT na punkcie TP_3V3 osiąga stabilne 3.30V.',
        'Upewnij się, że dioda Schottky D1 zabezpieczająca wejście nie ma zwarcia ani przerwy.'
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

export function createArduinoUnoScenario(): Scenario {
  const b = new Builder(82, 54);

  // Power Input: 9V DC Jack or 5V USB
  const dcJack = b.header('J1_DC', 9.0, [10, 38], 0, 'DC 9V IN');
  b.text([10, 46], 'DC 9V JACK');

  const dReverse = b.diode('D1_M7', [20, 38]);
  b.text([20, 44], '1N4007 (M7)');

  // U1: NCP1117ST50 5V LDO
  const ldo5v = b.resistor('U1_5V_LDO', 0.02, [32, 38]);
  b.text([32, 45], 'NCP1117 5V');

  // Filter Caps
  const cIn = b.resistor('C1_47U', 0.1, [26, 38]);
  const cOut5v = b.resistor('C2_47U', 0.1, [38, 38]);

  // U2: LP2985-33 3.3V LDO
  const ldo3v3 = b.resistor('U2_3V3', 0.04, [32, 22]);
  b.text([32, 16], 'LP2985 3.3V');

  // U3: ATmega328P-AU Core Microcontroller
  const mcu = b.resistor('U3_ATMEGA328P', 250, [58, 28]);
  b.text([58, 14], 'ATMEGA328P-AU', 1.8);
  b.text([58, 18], '8-bit AVR @ 16MHz', 1.1);

  // 16MHz Resonator
  const y1 = b.resistor('Y1_16MHZ', 1000000, [58, 42]);
  b.text([58, 47], '16.000 MHz XTAL');

  // Power LED (Green)
  const rPwr = b.resistor('R_PWR', 1000, [46, 12]);
  const ledPwr = b.led('LED_ON', 'green', [54, 12]);
  b.text([54, 7], 'ON (Green)');

  // D13 User LED (Yellow)
  const r13 = b.resistor('R_D13', 1000, [68, 12]);
  const led13 = b.led('LED_L', 'yellow', [76, 12]);
  b.text([76, 7], 'L (D13)');

  // Reset Switch
  const swRst = b.tactile('SW_RST', [16, 16]);
  b.text([16, 10], 'RESET');

  // Test Points
  const tp5v = b.testpoint('TP_5V', [38, 48], '+5V');
  const tp3v3 = b.testpoint('TP_3V3', [32, 28], '+3V3');
  const tpVin = b.testpoint('TP_VIN', [14, 48], 'VIN_9V');
  const tpGnd = b.testpoint('TP_GND', [10, 24], 'GND');

  // Wiring
  b.track('F', [b.pad(dcJack, '1'), b.pad(tpVin, '1'), b.pad(dReverse, '1')], 1.0, 'RAW_VIN');
  b.track('F', [b.pad(dReverse, '2'), b.pad(cIn, '1'), b.pad(ldo5v, '1')], 0.8, 'VREG_IN');
  b.track('F', [b.pad(ldo5v, '2'), b.pad(cOut5v, '1'), b.pad(tp5v, '1'), [46, 38], b.pad(mcu, '1')], 0.8, '5V_SYS');
  b.track('F', [b.pad(ldo5v, '2'), [32, 30], b.pad(ldo3v3, '1')], 0.6, '5V_SYS');
  b.track('F', [b.pad(ldo3v3, '2'), b.pad(tp3v3, '1')], 0.6, '3V3_SYS');

  b.track('F', [b.pad(ldo5v, '2'), [46, 20], b.pad(rPwr, '1')], 0.5, '5V_SYS');
  b.track('F', [b.pad(rPwr, '2'), b.pad(ledPwr, '2')], 0.5, 'NET_ON_LED');

  b.track('F', [b.pad(mcu, '2'), b.pad(r13, '1')], 0.5, 'PIN_D13');
  b.track('F', [b.pad(r13, '2'), b.pad(led13, '2')], 0.5, 'NET_L_LED');

  // Crystal and reset
  b.track('F', [b.pad(mcu, '1'), b.pad(y1, '1')], 0.4, 'XTAL1');
  b.track('F', [b.pad(mcu, '2'), b.pad(y1, '2')], 0.4, 'XTAL2');
  b.track('F', [b.pad(swRst, '1'), b.pad(mcu, '1')], 0.4, 'RESET_PULLUP');
  b.track('B', [b.pad(swRst, '2'), b.pad(tpGnd, '1')], 0.6, 'GND');

  b.track('B', [b.pad(dcJack, '2'), b.pad(tpGnd, '1'), b.pad(cIn, '2'), b.pad(ldo5v, '2'), b.pad(cOut5v, '2'), b.pad(ledPwr, '1'), b.pad(led13, '1'), b.pad(mcu, '2')], 1.2, 'GND');

  b.text([41, 4], 'ARDUINO UNO R3 ARCHITECTURE', 1.8);
  b.text([41, 51], 'ATMEGA328P · 5V / 3.3V LDO · REVERSE DIODE PROTECTION', 1.1);

  const board = b.b;
  board.color = '#0b2b40'; // Classic Arduino blue

  return {
    format: 'pcbfix/1',
    id: 'preset-arduino-uno',
    meta: {
      title: 'Arduino Uno R3 Core Architecture (5V / 3.3V / ATmega328P)',
      author: 'DEADBOARD Studio',
      difficulty: 2,
      description: 'Klasyczna płyta Arduino Uno R3 z procesorem ATmega328P, diodą zabezpieczającą przed pomyłką biegunowości zasilacza 9V, stabilizatorami 5.0V i 3.3V oraz diodami ON i L (D13).',
      hints: [
        'Sprawdź czy dioda zabezpieczająca D1_M7 nie ma przerwy przy zasilaniu z gniazda DC.',
        'Zmierz napięcie wyjściowe stabilizatora 5V na TP_5V (wymagane 4.85V – 5.15V).',
        'Sprawdź czy stabilizator 3.3V LP2985 generuje stabilne 3.3V na punkcie TP_3V3.'
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

export const BOARD_PRESETS: BoardPreset[] = [
  {
    id: 'preset-esp32-devkit',
    titlePl: 'ESP32-WROOM-32D IoT DevBoard (3.3V LDO / Wi-Fi)',
    titleEn: 'ESP32-WROOM-32D IoT DevBoard (3.3V LDO / Wi-Fi)',
    descPl: 'Płyta deweloperska z procesorem ESP32, stabilizatorem AMS1117-3.3, przyciskami EN/BOOT i diodami.',
    descEn: 'ESP32 development board with AMS1117-3.3 LDO, EN/BOOT tactile switches and indicator LEDs.',
    category: 'mcu',
    create: createEsp32DevScenario
  },
  {
    id: 'preset-rpi-pico',
    titlePl: 'Raspberry Pi Pico (RP2040 & RT6150B Buck-Boost)',
    titleEn: 'Raspberry Pi Pico (RP2040 & RT6150B Buck-Boost)',
    descPl: 'Dwurdzeniowy układ RP2040 z przetwornicą buck-boost, pamięcią QSPI Flash i diodą GP25.',
    descEn: 'Dual-core RP2040 MCU with RT6150B buck-boost converter, QSPI Flash, and GP25 LED.',
    category: 'mcu',
    create: createRaspberryPiPicoScenario
  },
  {
    id: 'preset-arduino-uno',
    titlePl: 'Arduino Uno R3 Core (ATmega328P / 5V & 3.3V)',
    titleEn: 'Arduino Uno R3 Core (ATmega328P / 5V & 3.3V)',
    descPl: 'Architektura Arduino Uno z procesorem ATmega328P, zasilaczem DC 9V, podwójnym LDO i diodami ON/L.',
    descEn: 'Arduino Uno R3 architecture with ATmega328P MCU, 9V DC in, dual LDOs, and ON/L LEDs.',
    category: 'mcu',
    create: createArduinoUnoScenario
  },
  {
    id: 'preset-dcdc-buck',
    titlePl: 'Przetwornica DC-DC Step-Down TPS54302 (12V → 3.3V 3A)',
    titleEn: 'TPS54302 Synchronous Step-Down DC-DC (12V → 3.3V 3A)',
    descPl: 'Wysokowydajny konwerter impulsowy 400kHz z pętlą sprzężenia zwrotnego i kondensatorem bootstrap.',
    descEn: 'High efficiency 400kHz synchronous buck regulator with FB voltage divider and bootstrap cap.',
    category: 'power',
    create: createDcDcBuckScenario
  }
];
