// Supplier parts database: PCBWay / LCSC / DigiKey / Mouser component library
// Comprehensive database of microcontrollers, power regulators, transistors, diodes, and ICs.
import type { Board } from '../types';

export interface ComponentPart {
  id: string;
  mpn: string;
  manufacturer: string;
  lcsc: string;
  pcbwayPart: string;
  namePl: string;
  nameEn: string;
  category: 'modules' | 'power' | 'transistors' | 'diodes' | 'interface' | 'passives';
  pkg: string;
  voltage: string;
  current: string;
  descPl: string;
  descEn: string;
  pins: Record<string, string>;
  defaultVal?: number;
  valKind?: 'R' | 'C' | 'L' | 'IC' | 'D' | 'Q' | 'SW' | 'F';
  footprintWidth: number; // mm
  footprintHeight: number; // mm
  padsCount: number;
  tags?: string[];
}

export const SUPPLIER_PARTS: ComponentPart[] = [
  // --- Microcontrollers & Modules ---
  {
    id: 'esp32-wroom-32d',
    mpn: 'ESP32-WROOM-32D',
    manufacturer: 'Espressif Systems',
    lcsc: 'C473012',
    pcbwayPart: 'PCBWAY-ESP32-WROOM32D',
    namePl: 'Moduł mikrokontrolera ESP32-WROOM-32D Wi-Fi + BT',
    nameEn: 'ESP32-WROOM-32D Wi-Fi + BT MCU Module',
    category: 'modules',
    pkg: 'Module-38 (18x25.5mm)',
    voltage: '3.0V – 3.6V (typ. 3.3V)',
    current: 'Standby: 15 mA, TX peak: 240 mA',
    descPl: 'Dwurdzeniowy 32-bitowy procesor Xtensa LX6 @ 240MHz, 520KB SRAM, 4MB SPI Flash, Wi-Fi 802.11 b/g/n i Bluetooth v4.2 BR/EDR + BLE. Standard w projektach IoT i automatyki.',
    descEn: 'Dual-core 32-bit Xtensa LX6 @ 240MHz, 520KB SRAM, 4MB SPI Flash, Wi-Fi and BLE. Industry standard for IoT.',
    pins: {
      '1': 'GND', '2': '3V3', '3': 'EN (CHIP_PU)', '4': 'SENSOR_VP', '5': 'SENSOR_VN',
      '6': 'IO34', '7': 'IO35', '8': 'IO32', '9': 'IO33', '10': 'IO25', '11': 'IO26',
      '12': 'IO27', '13': 'IO14', '14': 'IO12', '15': 'GND', '16': 'IO13', '23': 'IO15',
      '24': 'IO2', '25': 'IO0 (BOOT)', '26': 'IO4', '27': 'IO16', '28': 'IO17',
      '29': 'IO5', '30': 'IO18', '31': 'IO19', '33': 'IO21', '34': 'RXD0', '35': 'TXD0',
      '36': 'IO22', '37': 'IO23', '38': 'GND'
    },
    valKind: 'IC',
    footprintWidth: 18.0,
    footprintHeight: 25.5,
    padsCount: 38,
    tags: ['mcu', 'wifi', 'bluetooth', 'ble', 'espressif', 'esp32', 'wroom', 'iot', 'soc', '3.3v', '3v3', 'xtensa', 'dual-core', 'smd', 'module', 'modul', 'mikrokontroler']
  },
  {
    id: 'esp32-s3-wroom-1',
    mpn: 'ESP32-S3-WROOM-1',
    manufacturer: 'Espressif Systems',
    lcsc: 'C2913200',
    pcbwayPart: 'PCBWAY-ESP32-S3-WROOM',
    namePl: 'Moduł ESP32-S3 Dual-Core z akceleracją AI i USB OTG',
    nameEn: 'ESP32-S3 Dual-Core AI Acceleration & USB OTG Module',
    category: 'modules',
    pkg: 'Module-44 (18x25.5mm)',
    voltage: '3.0V – 3.6V (3.3V)',
    current: 'Typ. 20 mA, Max 310 mA',
    descPl: 'Dwurdzeniowy mikrokontroler Xtensa LX7 z instrukcjami wektorowymi do sieci neuronowych, natywnym interfejsem USB OTG Full-Speed oraz 44 wyprowadzeniami GPIO.',
    descEn: 'Dual-core Xtensa LX7 with vector instructions for AI/ML, native USB OTG, 44 GPIOs.',
    pins: { '1': 'GND', '2': '3V3', '3': 'EN', '19': 'USB_D-', '20': 'USB_D+', '44': 'GND' },
    valKind: 'IC',
    footprintWidth: 18.0,
    footprintHeight: 25.5,
    padsCount: 44,
    tags: ['mcu', 'wifi', 'bluetooth', 'ble', 'ble5', 'espressif', 'esp32', 'esp32s3', 's3', 'iot', 'soc', '3.3v', '3v3', 'xtensa', 'ai', 'vector', 'usb', 'otg', 'smd', 'module', 'modul', 'mikrokontroler']
  },
  {
    id: 'esp32-c3-wroom-02',
    mpn: 'ESP32-C3-WROOM-02',
    manufacturer: 'Espressif Systems',
    lcsc: 'C2934571',
    pcbwayPart: 'PCBWAY-ESP32-C3-WROOM-02',
    namePl: 'Moduł mikrokontrolera ESP32-C3-WROOM-02 RISC-V Wi-Fi + BLE5',
    nameEn: 'ESP32-C3-WROOM-02 RISC-V Wi-Fi + BLE5 MCU Module',
    category: 'modules',
    pkg: 'Module-18 (18x20mm)',
    voltage: '3.0V – 3.6V (typ. 3.3V)',
    current: 'Standby: 5 µA, Aktywny TX: 290 mA',
    descPl: 'Jednordzeniowy 32-bitowy procesor RISC-V RV32IMC @ 160MHz, 400KB SRAM, 4MB Flash, Wi-Fi 4 (802.11 b/g/n) i Bluetooth 5 (LE) / Mesh. Nowoczesny, energooszczędny następca ESP8266.',
    descEn: 'Single-core 32-bit RISC-V RV32IMC @ 160MHz, 400KB SRAM, 4MB Flash, Wi-Fi 4 and Bluetooth 5 (LE). Modern low-cost ESP8266 successor.',
    pins: {
      '1': 'GND', '2': '3V3', '3': 'EN (CHIP_EN)', '4': 'IO4', '5': 'IO5', '6': 'IO6',
      '7': 'IO7', '8': 'IO8', '9': 'IO9 (BOOT)', '10': 'IO10', '11': 'GND', '12': 'IO18',
      '13': 'IO19', '14': 'IO20 (U0RXD)', '15': 'IO21 (U0TXD)', '16': 'GND', '17': 'GND', '18': 'GND'
    },
    valKind: 'IC',
    footprintWidth: 18.0,
    footprintHeight: 20.0,
    padsCount: 18,
    tags: ['mcu', 'riscv', 'risc-v', 'wifi', 'bluetooth', 'ble', 'ble5', 'espressif', 'esp32', 'esp32c3', 'c3', 'iot', 'soc', '3.3v', '3v3', 'smd', 'module', 'modul', 'mikrokontroler']
  },
  {
    id: 'rp2040-pico',
    mpn: 'Raspberry Pi Pico (RP2040)',
    manufacturer: 'Raspberry Pi Foundation',
    lcsc: 'C2040',
    pcbwayPart: 'PCBWAY-RPI-PICO-RP2040',
    namePl: 'Moduł Raspberry Pi Pico / RP2040 Dual ARM Cortex-M0+',
    nameEn: 'Raspberry Pi Pico / RP2040 Dual ARM Cortex-M0+ Module',
    category: 'modules',
    pkg: 'DIP-40 / Castellated (21x51mm)',
    voltage: 'VSYS 1.8V – 5.5V, VBUS 5V, VDD 3.3V',
    current: 'Typ. 18 mA @ 133MHz',
    descPl: 'Flagowy układ mikrokontrolera z 2 rdzeniami Cortex-M0+ 133MHz, 264KB pamięci SRAM, 2MB Flash QSPI, przetwornicą impulsową buck-boost RT6150B oraz programowalnym PIO.',
    descEn: 'Dual Cortex-M0+ 133MHz MCU with 264KB SRAM, 2MB QSPI Flash, RT6150B buck-boost converter, PIO blocks.',
    pins: {
      '1': 'GP0', '2': 'GP1', '3': 'GND', '4': 'GP2', '5': 'GP3', '36': '3V3_OUT',
      '37': '3V3_EN', '38': 'GND', '39': 'VSYS', '40': 'VBUS'
    },
    valKind: 'IC',
    footprintWidth: 21.0,
    footprintHeight: 51.0,
    padsCount: 40,
    tags: ['mcu', 'arm', 'cortex-m0', 'raspberry', 'rpi', 'pico', 'rp2040', 'dual-core', 'pio', '3.3v', '3v3', '5v', 'dip', 'dip-40', 'tht', 'castellated', 'module', 'modul', 'mikrokontroler', 'plytka']
  },
  {
    id: 'rp2040',
    mpn: 'RP2040',
    manufacturer: 'Raspberry Pi',
    lcsc: 'C2040',
    pcbwayPart: 'PCBWAY-RP2040',
    namePl: 'Mikrokontroler RP2040 Dual ARM Cortex-M0+ QFN-56',
    nameEn: 'Raspberry Pi RP2040 Dual ARM Cortex-M0+ MCU QFN-56',
    category: 'modules',
    pkg: 'QFN-56',
    voltage: '3.3V',
    current: 'Typ. 20-50 mA, Max 100 mA',
    descPl: 'Dwurdzeniowy mikrokontroler ARM Cortex-M0+ @ 133MHz, 264KB SRAM, unikalne programowalne bloki we/wy PIO, wbudowane USB 1.1 i interfejs pamięci QSPI Flash.',
    descEn: 'Raspberry Pi RP2040 dual-core ARM Cortex-M0+ microcontroller with 264KB SRAM, Programmable I/O (PIO), USB 1.1 controller, and QSPI Flash interface in compact QFN-56.',
    pins: {
      '1': 'IO0', '2': 'IO1', '3': 'IO2', '4': 'IO3', '5': 'IO4', '6': 'IO5', '7': 'IO6', '8': 'IO7',
      '9': 'VDD_IO', '10': 'IO8', '11': 'IO9', '12': 'IO10', '13': 'IO11', '14': 'IO12', '15': 'IO13',
      '16': 'IO14', '17': 'IO15', '18': 'TESTEN', '19': 'VDD_CORE', '20': 'XIN', '21': 'XOUT', '22': 'IO16',
      '23': 'IO17', '24': 'IO18', '25': 'IO19', '26': 'IO20', '27': 'IO21', '28': 'IO22', '29': 'IO23',
      '30': 'IO24', '31': 'IO25', '32': 'USB_DM', '33': 'USB_DP', '34': 'USB_VDD', '35': 'IO26_ADC0',
      '36': 'IO27_ADC1', '37': 'IO28_ADC2', '38': 'IO29_ADC3', '39': 'ADC_AVDD', '40': 'VREFN', '41': 'VREFP',
      '42': 'VREG_VIN', '43': 'VREG_VOUT', '44': 'VDD_CORE', '45': 'VDD_IO', '46': 'QSPI_SD3', '47': 'QSPI_SCLK',
      '48': 'QSPI_SD0', '49': 'QSPI_SD2', '50': 'QSPI_SD1', '51': 'QSPI_SS_N', '52': 'VDD_CORE', '53': 'RUN',
      '54': 'SWCLK', '55': 'SWDIO', '56': 'VDD_CORE', '57': 'GND'
    },
    valKind: 'IC',
    footprintWidth: 7.0,
    footprintHeight: 7.0,
    padsCount: 57,
    tags: ['mcu', 'arm', 'cortex-m0', 'raspberry', 'rpi', 'rp2040', 'qfn', 'qfn-56', 'qfn56', 'dual-core', 'pio', '3.3v', '3v3', 'smd', 'module', 'modul', 'mikrokontroler', 'ic']
  },
  {
    id: 'bme280',
    mpn: 'BME280',
    manufacturer: 'Bosch Sensortec',
    lcsc: 'C92489',
    pcbwayPart: 'PCBWAY-BME280',
    namePl: 'Cyfrowy sensor temperatury, wilgotności i ciśnienia BME280 LGA-8',
    nameEn: 'Bosch BME280 Temperature, Humidity & Pressure Sensor LGA-8',
    category: 'modules',
    pkg: 'LGA-8',
    voltage: '1.8-3.6V',
    current: 'Pomiar: 3.6 µA, Standby: 0.2 µA, Sleep: 0.1 µA',
    descPl: 'Wysokiej precyzji cyfrowy czujnik środowiskowy mierzący temperaturę, wilgotność względną oraz ciśnienie barometryczne. Interfejsy cyfrowe I2C oraz SPI w miniaturowej obudowie LGA-8.',
    descEn: 'Bosch Sensortec BME280 combined digital humidity, pressure and temperature sensor. Ultra-compact LGA-8 package with I2C/SPI digital interfaces.',
    pins: { '1': 'GND', '2': 'CSB', '3': 'SDI', '4': 'SCK', '5': 'SDO', '6': 'VDDIO', '7': 'GND', '8': 'VDD' },
    valKind: 'IC',
    footprintWidth: 2.5,
    footprintHeight: 2.5,
    padsCount: 8,
    tags: ['sensor', 'czujnik', 'bme280', 'bosch', 'temperature', 'humidity', 'pressure', 'barometer', 'i2c', 'spi', 'lga-8', 'lga8', 'smd', 'iot', 'weather', '3.3v', '1.8v', 'module', 'modul', 'ic']
  },
  {
    id: 'rpi-zero-2w',
    mpn: 'Raspberry Pi Zero 2 W Subsystem',
    manufacturer: 'Raspberry Pi Ltd',
    lcsc: 'C514210',
    pcbwayPart: 'PCBWAY-RPI-ZERO2W',
    namePl: 'Podsystem Raspberry Pi Zero 2 W (RP3A0 SiP 64-bit)',
    nameEn: 'Raspberry Pi Zero 2 W Subsystem (RP3A0 64-bit SiP)',
    category: 'modules',
    pkg: 'Module (30x65mm)',
    voltage: '5V USB IN -> 3.3V / 1.8V / 1.2V',
    current: 'Idle: 100 mA, Full load: 450 mA',
    descPl: 'Czterordzeniowy 64-bitowy procesor Cortex-A53 1.0GHz z 512MB pamięci LPDDR2 w obudowie SiP, zintegrowanym przetwornikiem PAM2306 i szynami zasilania 3.3V/1.8V/1.2V.',
    descEn: 'Quad-core 64-bit Cortex-A53 1.0GHz SoC with 512MB RAM, dual PAM2306 buck converter for 3.3V/1.8V.',
    pins: { '1': '3V3', '2': '5V', '4': '5V', '6': 'GND', '9': 'GND', '40': 'GPIO21' },
    valKind: 'IC',
    footprintWidth: 30.0,
    footprintHeight: 65.0,
    padsCount: 40,
    tags: ['soc', 'arm', 'cortex-a53', 'raspberry', 'rpi', 'zero2w', 'linux', 'wifi', 'bluetooth', 'quad-core', 'module', 'modul', 'plytka', 'board', '5v', '3.3v']
  },
  {
    id: 'rpi-5-b5-pmic',
    mpn: 'Raspberry Pi 5 (B5) Power Subsystem',
    manufacturer: 'Raspberry Pi / Dialog DA9091',
    lcsc: 'C909100',
    pcbwayPart: 'PCBWAY-RPI5-PMIC-DA9091',
    namePl: 'Sekcja zasilania Raspberry Pi 5 (B5) z PMIC DA9091',
    nameEn: 'Raspberry Pi 5 (B5) Power Subsystem with DA9091 PMIC',
    category: 'modules',
    pkg: 'QFN-68 / Multi-rail',
    voltage: '5V USB-C PD -> 3.3V, 1.8V, 1.1V, 0.85V',
    current: 'Do 5.0 A na wejściu USB-PD',
    descPl: 'Zaawansowany układ zarządzania zasilaniem (PMIC) DA9091 dla SoC BCM2712 w Raspberry Pi 5. Zawiera 8 synchronicznych przetwornic buck oraz LDO dla szyn rdzenia, pamięci DDR4 i układu RP1.',
    descEn: 'Advanced PMIC DA9091 for BCM2712 SoC on Raspberry Pi 5, supplying 8 power rails with tight sequencing.',
    pins: { 'VIN': '5V_USB', 'OUT1': 'VDD_CORE (0.85V)', 'OUT2': 'DDR_1V1', 'OUT3': '3V3_SYS', 'OUT4': '1V8_AON', 'GND': 'GND' },
    valKind: 'IC',
    footprintWidth: 28.0,
    footprintHeight: 28.0,
    padsCount: 68,
    tags: ['pmic', 'power', 'regulator', 'buck', 'ldo', 'dialog', 'da9091', 'raspberry', 'rpi5', 'qfn', 'qfn-68', 'smd', 'przetwornica', 'zasilanie', '5v', '3.3v']
  },
  {
    id: 'atmega328p-arduino',
    mpn: 'ATMEGA328P-AU (Arduino Uno / Nano)',
    manufacturer: 'Microchip Technology',
    lcsc: 'C14877',
    pcbwayPart: 'PCBWAY-ATMEGA328P-AU',
    namePl: 'Mikrokontroler ATmega328P-AU 8-bit AVR 20MHz',
    nameEn: 'ATmega328P-AU 8-bit AVR 20MHz Microcontroller',
    category: 'modules',
    pkg: 'TQFP-32 (7x7mm)',
    voltage: '1.8V – 5.5V (typ. 5.0V)',
    current: 'Aktywny: 5.2 mA @ 16MHz 5V',
    descPl: 'Serce płytek Arduino Uno i Nano. 32KB pamięci Flash ISP, 2KB SRAM, 1KB EEPROM, 23 linie wejść/wyjść GPIO, 6 kanałów PWM i 8-kanałowy 10-bitowy przetwornik ADC.',
    descEn: 'Heart of Arduino Uno and Nano boards. 32KB ISP Flash, 2KB SRAM, 1KB EEPROM, 23 GPIOs, 6 PWM channels, 8ch 10-bit ADC.',
    pins: {
      '1': 'PD3', '2': 'PD4', '3': 'GND', '4': 'VCC', '5': 'GND', '6': 'VCC',
      '7': 'XTAL1', '8': 'XTAL2', '9': 'PD5', '10': 'PD6', '11': 'PD7', '12': 'PB0',
      '18': 'AVCC', '20': 'AREF', '21': 'GND', '29': 'RESET', '30': 'PD0 (RX)', '31': 'PD1 (TX)'
    },
    valKind: 'IC',
    footprintWidth: 9.0,
    footprintHeight: 9.0,
    padsCount: 32,
    tags: ['mcu', 'avr', 'arduino', 'uno', 'nano', 'atmega328p', 'atmega328', 'microchip', 'atmel', '5v', '5.0v', 'tqfp', 'tqfp-32', 'smd', 'mikrokontroler', 'ic']
  },
  {
    id: 'atmega328p-pu',
    mpn: 'ATMEGA328P-PU (Arduino Uno DIP-28)',
    manufacturer: 'Microchip Technology',
    lcsc: 'C14877',
    pcbwayPart: 'PCBWAY-ATMEGA328P-PU',
    namePl: 'Mikrokontroler ATmega328P-PU 8-bit AVR 20MHz DIP-28 (Arduino Uno)',
    nameEn: 'ATmega328P-PU 8-bit AVR 20MHz DIP-28 MCU (Arduino Uno)',
    category: 'modules',
    pkg: 'DIP-28 (Through-Hole)',
    voltage: '1.8V – 5.5V (typ. 5.0V)',
    current: 'Aktywny: 5.2 mA @ 16MHz 5V',
    descPl: 'Klasyczna przewlekana wersja DIP-28 mikrokontrolera ATmega328P, serce oryginalnego Arduino Uno R3. 32KB pamięci Flash, 2KB SRAM, 1KB EEPROM, wymienny w podstawce.',
    descEn: 'Through-hole DIP-28 version of ATmega328P MCU, heart of original Arduino Uno R3 socket. 32KB Flash, 2KB SRAM, 1KB EEPROM, 23 GPIOs.',
    pins: {
      '1': 'PC6 (RESET)', '2': 'PD0 (RXD)', '3': 'PD1 (TXD)', '4': 'PD2', '5': 'PD3', '6': 'PD4',
      '7': 'VCC', '8': 'GND', '9': 'PB6 (XTAL1)', '10': 'PB7 (XTAL2)', '11': 'PD5', '12': 'PD6',
      '13': 'PD7', '14': 'PB0', '15': 'PB1', '16': 'PB2', '17': 'PB3', '18': 'PB4',
      '19': 'PB5 (SCK)', '20': 'AVCC', '21': 'AREF', '22': 'GND', '23': 'PC0', '24': 'PC1',
      '25': 'PC2', '26': 'PC3', '27': 'PC4 (SDA)', '28': 'PC5 (SCL)'
    },
    valKind: 'IC',
    footprintWidth: 10.16,
    footprintHeight: 35.56,
    padsCount: 28,
    tags: ['mcu', 'avr', 'arduino', 'uno', 'atmega328p', 'atmega328', 'microchip', 'atmel', '5v', '5.0v', 'dip', 'dip-28', 'tht', 'through-hole', 'mikrokontroler', 'ic']
  },
  {
    id: 'stm32f103c8t6-bluepill',
    mpn: 'STM32F103C8T6 (Blue Pill Core)',
    manufacturer: 'STMicroelectronics',
    lcsc: 'C8734',
    pcbwayPart: 'PCBWAY-STM32F103C8T6',
    namePl: 'Mikrokontroler STM32F103C8T6 ARM Cortex-M3 72MHz (Blue Pill)',
    nameEn: 'STM32F103C8T6 ARM Cortex-M3 72MHz Microcontroller (Blue Pill)',
    category: 'modules',
    pkg: 'LQFP-48 (7x7mm)',
    voltage: '2.0V – 3.6V (typ. 3.3V)',
    current: '36 mA @ 72MHz',
    descPl: 'Popularny mikrokontroler 32-bitowy z rdzeniem ARM Cortex-M3 72MHz, 64KB Flash, 20KB SRAM, USB 2.0 Full Speed, 2x SPI, 2x I2C, 3x USART i dwoma 12-bitowymi ADC. Standard modułów "Blue Pill".',
    descEn: '32-bit ARM Cortex-M3 72MHz MCU with 64KB Flash, 20KB SRAM, native USB, standard for "Blue Pill" modules.',
    pins: { '1': 'VBAT', '7': 'NRST', '8': 'VSSA', '9': 'VDDA', '23': 'VSS', '24': 'VDD', '35': 'VSS', '36': 'VDD', '47': 'VSS', '48': 'VDD' },
    valKind: 'IC',
    footprintWidth: 9.0,
    footprintHeight: 9.0,
    padsCount: 48,
    tags: ['mcu', 'arm', 'cortex-m3', 'stm32', 'stm32f103', 'bluepill', 'blue pill', 'stmicroelectronics', '3.3v', '3v3', 'lqfp', 'lqfp-48', 'smd', 'mikrokontroler', 'ic']
  },

  // --- Power Management & Regulators ---
  {
    id: 'ams1117-33',
    mpn: 'AMS1117-3.3',
    manufacturer: 'Advanced Monolithic Systems',
    lcsc: 'C15849',
    pcbwayPart: 'PCBWAY-AMS1117-3.3',
    namePl: 'Liniowy stabilizator napięcia LDO 3.3V 1A',
    nameEn: 'Linear LDO Voltage Regulator 3.3V 1A',
    category: 'power',
    pkg: 'SOT-223',
    voltage: 'Vin max 15V, Vout 3.3V ±1.5%',
    current: 'Iout max 1.0 A, Dropout: 1.1V @ 800mA',
    descPl: 'Najpopularniejszy stabilizator LDO 3.3V w układach zasilania ESP32, Arduino i modułów radiowych. Wyposażony w zabezpieczenie termiczne i ograniczenie prądowe.',
    descEn: 'Ubiquitous 1A 3.3V LDO regulator used in ESP32, Arduino, and embedded boards. Thermal shutdown and current limiting built in.',
    pins: { '1': 'GND / ADJ', '2': 'VOUT (Tab)', '3': 'VIN' },
    valKind: 'IC',
    defaultVal: 3.3,
    footprintWidth: 6.5,
    footprintHeight: 7.0,
    padsCount: 4,
    tags: ['ldo', 'power', 'regulator', 'voltage', 'linear', '3.3v', '3v3', 'ams1117', 'sot-223', 'sot223', 'smd', 'stabilizator', 'przetwornica', 'zasilanie']
  },
  {
    id: 'ams1117-50',
    mpn: 'AMS1117-5.0',
    manufacturer: 'Advanced Monolithic Systems',
    lcsc: 'C347222',
    pcbwayPart: 'PCBWAY-AMS1117-5.0',
    namePl: 'Liniowy stabilizator napięcia LDO 5.0V 1A',
    nameEn: 'Linear LDO Voltage Regulator 5.0V 1A',
    category: 'power',
    pkg: 'SOT-223',
    voltage: 'Vin 6.5V – 15V, Vout 5.0V',
    current: 'Iout max 1.0 A',
    descPl: 'Stabilizator LDO 5.0V stosowany do zasilania mikrokontrolerów AVR i obwodów interfejsów 5V.',
    descEn: '5.0V 1A LDO regulator used for 5V logic and AVR circuits.',
    pins: { '1': 'GND', '2': 'VOUT (Tab)', '3': 'VIN' },
    valKind: 'IC',
    defaultVal: 5.0,
    footprintWidth: 6.5,
    footprintHeight: 7.0,
    padsCount: 4,
    tags: ['ldo', 'power', 'regulator', 'voltage', 'linear', '5v', '5.0v', 'ams1117', 'sot-223', 'sot223', 'smd', 'stabilizator', 'przetwornica', 'zasilanie']
  },
  {
    id: 'me6211c33m5g',
    mpn: 'ME6211C33M5G',
    manufacturer: 'MicrOne',
    lcsc: 'C2924976',
    pcbwayPart: 'PCBWAY-ME6211-3.3',
    namePl: 'Niskoszumny stabilizator LDO 3.3V 500mA z pinem EN',
    nameEn: 'Ultra-low Noise LDO 3.3V 500mA with Enable pin',
    category: 'power',
    pkg: 'SOT-23-5',
    voltage: 'Vin 2.0V – 6.0V, Vout 3.3V',
    current: '500 mA, Spadek napięcia (dropout): 100 mV @ 100mA',
    descPl: 'Kompaktowy LDO o niskim szumie i wysokim PSRR, dedykowany do zasilania układów RF i czujników analogowych.',
    descEn: 'Compact low-noise LDO with high PSRR for RF and sensitive analog circuits.',
    pins: { '1': 'VIN', '2': 'GND', '3': 'EN', '4': 'NC / BP', '5': 'VOUT' },
    valKind: 'IC',
    defaultVal: 3.3,
    footprintWidth: 3.0,
    footprintHeight: 3.0,
    padsCount: 5,
    tags: ['ldo', 'power', 'regulator', 'voltage', 'linear', 'low-noise', '3.3v', '3v3', 'microne', 'sot-23-5', 'sot23', 'smd', 'stabilizator', 'przetwornica', 'zasilanie']
  },
  {
    id: 'tps54302ddcr',
    mpn: 'TPS54302DDCR',
    manufacturer: 'Texas Instruments',
    lcsc: 'C969324',
    pcbwayPart: 'PCBWAY-TPS54302',
    namePl: 'Synchroniczna przetwornica DC-DC Step-Down 28V 3A 400kHz',
    nameEn: 'Synchronous Step-Down DC-DC Converter 28V 3A 400kHz',
    category: 'power',
    pkg: 'SOT-23-6 (Thin SOT)',
    voltage: 'Vin: 4.5V – 28V, Vout: 0.6V – 28V',
    current: 'Iout max 3.0 A ciągły',
    descPl: 'Wysokowydajna przetwornica impulsowa buck ze zintegrowanymi tranzystorami MOSFET 85mΩ / 40mΩ. Zapewnia sprawność do 95% przy redukcji napięcia 12V/24V do 5V lub 3.3V.',
    descEn: 'High efficiency 400kHz synchronous buck converter with internal FETs, 3A continuous output current.',
    pins: { '1': 'GND', '2': 'SW (Switch node)', '3': 'VIN', '4': 'FB (Feedback)', '5': 'EN', '6': 'BOOT' },
    valKind: 'IC',
    footprintWidth: 3.0,
    footprintHeight: 3.0,
    padsCount: 6,
    tags: ['buck', 'step-down', 'stepdown', 'dcdc', 'dc-dc', 'power', 'regulator', 'switching', 'ti', 'texas instruments', 'sot-23-6', 'sot23', 'smd', 'przetwornica', 'zasilanie']
  },
  {
    id: 'sy8208bqnc',
    mpn: 'SY8208BQNC',
    manufacturer: 'Silergy',
    lcsc: 'C78657',
    pcbwayPart: 'PCBWAY-SY8208B',
    namePl: 'Synchroniczny kontroler Buck 8A (główna szyna 3.3V/5V w laptopach)',
    nameEn: 'Synchronous Buck Regulator 8A (Laptop 3.3V/5V main rail)',
    category: 'power',
    pkg: 'QFN-10 (3x3mm)',
    voltage: 'Vin: 4.5V – 28V, Vout: 0.6V – 5.5V',
    current: '8.0 A ciągły prąd wyjściowy',
    descPl: 'Kluczowy układ w naprawach płyt głównych laptopów (Dell, Lenovo, ASUS, MNT Reform). Generuje szynę główną +3.3V lub +5V w trybie standby i S0.',
    descEn: 'Critical IC in laptop mainboard repairs, generating the primary 3.3V or 5V system rails in standby and S0 states.',
    pins: { '1': 'BOOT', '2': 'VIN', '3': 'LX (SW)', '4': 'GND', '5': 'FB', '6': 'EN', '7': 'PGOOD' },
    valKind: 'IC',
    footprintWidth: 3.0,
    footprintHeight: 3.0,
    padsCount: 10,
    tags: ['buck', 'step-down', 'stepdown', 'dcdc', 'dc-dc', 'power', 'regulator', 'switching', 'silergy', 'laptop', 'qfn', 'qfn-10', 'smd', 'przetwornica', 'zasilanie', '3.3v', '5v']
  },
  {
    id: 'tp4056',
    mpn: 'TP4056',
    manufacturer: 'NanJing Top Power ASIC Corp',
    lcsc: 'C16581',
    pcbwayPart: 'PCBWAY-TP4056',
    namePl: 'Kontroler ładowania akumulatorów Li-Ion 1A SOP-8-EP (CC/CV)',
    nameEn: 'TP4056 1A Standalone Linear Li-Ion Battery Charger SOP-8-EP (CC/CV)',
    category: 'power',
    pkg: 'SOP-8-EP (z padem termicznym)',
    voltage: 'Vin: 4.5V – 5.5V, Vbat: 4.2V ±1%',
    current: 'Prąd ładowania do 1000 mA (programowalny rezystorem RPROG)',
    descPl: 'Kompletna liniowa ładowarka CC/CV jednoogniwowych akumulatorów litowo-jonowych i litowo-polimerowych 3.7V/4.2V. Posiada piny sygnalizacyjne LED (CHRG, STDBY) oraz zabezpieczenie termiczne. LCSC C16581.',
    descEn: 'Complete constant-current/constant-voltage (CC/CV) linear charger for single cell lithium-ion 3.7V/4.2V batteries with thermal regulation, programmable charge current up to 1A. LCSC C16581.',
    pins: { '1': 'TEMP', '2': 'PROG', '3': 'GND', '4': 'VCC', '5': 'BAT', '6': 'STDBY', '7': 'CHRG', '8': 'CE', 'EP': 'GND' },
    valKind: 'IC',
    footprintWidth: 4.9,
    footprintHeight: 3.9,
    padsCount: 9,
    tags: ['charger', 'battery', 'li-ion', 'lipo', 'li-po', '4056', 'tp4056', 'ladowarka', 'ładowarka', 'ladowanie', 'ładowanie', 'akumulator', 'bateria', 'power', 'zasilanie', 'sop-8', 'smd', 'cc-cv', 'ic']
  },
  {
    id: 'drv8825',
    mpn: 'DRV8825',
    manufacturer: 'Texas Instruments',
    lcsc: 'C39243',
    pcbwayPart: 'PCBWAY-DRV8825',
    namePl: 'Sterownik silnika krokowego DRV8825 2.5A z mikrokrokiem 1/32 HTSSOP-28',
    nameEn: 'TI DRV8825 2.5A Stepper Motor Driver with 1/32 Microstepping HTSSOP-28',
    category: 'power',
    pkg: 'HTSSOP-28',
    voltage: '8.2-45V',
    current: 'Do 2.5A szczytowo na fazę (1.75A RMS)',
    descPl: 'Zintegrowany bipolarny sterownik silnika krokowego z wbudowanym przetwornikiem mikrokroków (do 1/32) oraz zabezpieczeniami nadprądowymi i termicznymi. Napięcie silnika od 8.2V do 45V, wyjście do 2.5A.',
    descEn: 'Integrated bipolar stepper motor driver with built-in indexer microstepping down to 1/32-step. Wide 8.2V to 45V motor supply range and up to 2.5A peak drive current.',
    pins: {
      '1': 'CP1', '2': 'CP2', '3': 'VCP', '4': 'VMA', '5': 'AOUT1', '6': 'ISENA', '7': 'AOUT2',
      '8': 'BOUT2', '9': 'ISENB', '10': 'BOUT1', '11': 'VMB', '12': 'AVDD', '13': 'GND', '14': 'V3P3OUT',
      '15': 'RESET#', '16': 'SLEEP#', '17': 'FAULT#', '18': 'HOMEn', '19': 'MODE0', '20': 'MODE1',
      '21': 'MODE2', '22': 'STEP', '23': 'ENABLE#', '24': 'DIR', '25': 'DECAY', '26': 'VREF',
      '27': 'GND', '28': 'GND', '29': 'PowerPAD_GND'
    },
    valKind: 'IC',
    footprintWidth: 6.4,
    footprintHeight: 9.7,
    padsCount: 29,
    tags: ['stepper', 'motor', 'driver', 'drv8825', 'ti', 'texas-instruments', 'htssop-28', 'htssop28', 'power', 'silnik', 'krokowy', 'sterownik', 'smd', 'ic', 'microstepping', 'cnc', '3d-printer']
  },

  // --- Transistors & MOSFETs ---
  {
    id: 'ao3400a',
    mpn: 'AO3400A',
    manufacturer: 'Alpha & Omega Semiconductor',
    lcsc: 'C20917',
    pcbwayPart: 'PCBWAY-AO3400A',
    namePl: 'Tranzystor N-MOSFET 30V 5.7A Rds=28mΩ',
    nameEn: 'N-Channel MOSFET 30V 5.7A Rds=28mΩ',
    category: 'transistors',
    pkg: 'SOT-23-3',
    voltage: 'Vds = 30V, Vgs max = ±12V',
    current: 'Id = 5.7 A, Rds(on) = 28 mΩ @ 4.5V',
    descPl: 'Bardzo popularny tranzystor polowy N do kluczowania obciążeń DC, załączania szyn zasilania i sterowania silnikami PWM.',
    descEn: 'Ultra-common N-channel power MOSFET for DC load switching, rail gating, and PWM driver circuits.',
    pins: { '1': 'Gate', '2': 'Source', '3': 'Drain' },
    valKind: 'Q',
    footprintWidth: 3.0,
    footprintHeight: 2.5,
    padsCount: 3,
    tags: ['mosfet', 'transistor', 'n-channel', 'n-mosfet', 'power', 'switch', 'alpha & omega', 'sot-23', 'sot23', 'smd', 'tranzystor']
  },
  {
    id: 'ao3401a',
    mpn: 'AO3401A',
    manufacturer: 'Alpha & Omega Semiconductor',
    lcsc: 'C15127',
    pcbwayPart: 'PCBWAY-AO3401A',
    namePl: 'Tranzystor P-MOSFET -30V -4.0A Rds=44mΩ',
    nameEn: 'P-Channel MOSFET -30V -4.0A Rds=44mΩ',
    category: 'transistors',
    pkg: 'SOT-23-3',
    voltage: 'Vds = -30V, Vgs max = ±12V',
    current: 'Id = -4.0 A, Rds(on) = 44 mΩ @ -4.5V',
    descPl: 'Tranzystor P-MOSFET do zabezpieczeń przed odwrotną polaryzacją zasilania oraz kluczy górnych (high-side load switches).',
    descEn: 'P-channel MOSFET for reverse-polarity protection and high-side power switching.',
    pins: { '1': 'Gate', '2': 'Source', '3': 'Drain' },
    valKind: 'Q',
    footprintWidth: 3.0,
    footprintHeight: 2.5,
    padsCount: 3,
    tags: ['mosfet', 'transistor', 'p-channel', 'p-mosfet', 'power', 'switch', 'reverse-polarity', 'alpha & omega', 'sot-23', 'sot23', 'smd', 'tranzystor']
  },
  {
    id: 'bss138',
    mpn: 'BSS138',
    manufacturer: 'onsemi',
    lcsc: 'C8061',
    pcbwayPart: 'PCBWAY-BSS138',
    namePl: 'Tranzystor N-MOSFET 50V 220mA (konwerter poziomów logicznych)',
    nameEn: 'N-Channel MOSFET 50V 220mA (Logic Level Shifter)',
    category: 'transistors',
    pkg: 'SOT-23-3',
    voltage: 'Vds = 50V, Vgs(th) = 0.8V – 1.5V',
    current: 'Id = 220 mA, Rds(on) = 3.5 Ω',
    descPl: 'Podstawowy element dwukierunkowych konwerterów poziomów 3.3V ↔ 5.0V dla magistrali I2C, SPI i UART.',
    descEn: 'Classic N-FET for bi-directional 3.3V to 5V level shifter circuits on I2C, SPI, and UART.',
    pins: { '1': 'Gate', '2': 'Source', '3': 'Drain' },
    valKind: 'Q',
    footprintWidth: 3.0,
    footprintHeight: 2.5,
    padsCount: 3,
    tags: ['mosfet', 'transistor', 'n-channel', 'n-mosfet', 'level-shifter', 'logic', 'onsemi', 'sot-23', 'sot23', 'smd', 'tranzystor', 'konwerter']
  },

  // --- Diodes & Protection ---
  {
    id: 'ss34',
    mpn: 'SS34',
    manufacturer: 'MDD / Yangzhou Yangjie',
    lcsc: 'C9313',
    pcbwayPart: 'PCBWAY-SS34',
    namePl: 'Dioda Schottky\'ego 40V 3A SMA Vf=0.45V',
    nameEn: 'Schottky Barrier Diode 40V 3A SMA Vf=0.45V',
    category: 'diodes',
    pkg: 'SMA (DO-214AC)',
    voltage: 'Vr = 40V, Vf = 0.45V @ 3A',
    current: 'If = 3.0 A ciągły, Ifsm = 80 A impuls',
    descPl: 'Dioda prostownicza Schottky\'ego o niskim spadku napięcia do sekcji zasilania DC, diod gaszących w przetwornicach oraz separacji akumulator/USB.',
    descEn: 'Low forward voltage drop Schottky diode for power supplies, buck freewheeling, and OR-ing circuits.',
    pins: { '1': 'Cathode (K)', '2': 'Anode (A)' },
    valKind: 'D',
    footprintWidth: 5.0,
    footprintHeight: 2.8,
    padsCount: 2,
    tags: ['diode', 'schottky', 'rectifier', 'power', 'sma', 'do-214ac', 'smd', 'dioda', 'prostownicza', '40v', '3a']
  },
  {
    id: 'usblc6-2sc6',
    mpn: 'USBLC6-2SC6',
    manufacturer: 'STMicroelectronics',
    lcsc: 'C8598',
    pcbwayPart: 'PCBWAY-USBLC6-2SC6',
    namePl: 'Zabezpieczenie ESD dla portów USB 2.0 High-Speed',
    nameEn: 'Very Low Capacitance ESD Protection for USB 2.0',
    category: 'diodes',
    pkg: 'SOT-23-6',
    voltage: 'Vbr = 6V, Vclamping = 11V @ 1A',
    current: 'Pojemność zaledwie 3.5 pF (I/O do masy)',
    descPl: 'Chroni linie USB D+ / D- oraz VBUS przed wyładowaniami elektrostatycznymi do ±15kV (powietrze) / ±8kV (styk). Częsta przyczyna awarii po burzy lub ładunku z ręki.',
    descEn: 'Protects USB D+/D- and VBUS lines from ESD strikes up to 15kV. Commonly damaged during static discharge events.',
    pins: { '1': 'I/O 1 (D+)', '2': 'GND', '3': 'I/O 2 (D-)', '4': 'I/O 2', '5': 'VBUS', '6': 'I/O 1' },
    valKind: 'IC',
    footprintWidth: 3.0,
    footprintHeight: 3.0,
    padsCount: 6,
    tags: ['diode', 'tvs', 'esd', 'protection', 'usb', 'stmicroelectronics', 'sot-23-6', 'sot23', 'smd', 'dioda', 'zabezpieczenie', 'ochrona']
  },
  {
    id: 'ws2812b',
    mpn: 'WS2812B',
    manufacturer: 'Worldsemi',
    lcsc: 'C114586',
    pcbwayPart: 'PCBWAY-WS2812B-5050',
    namePl: 'Inteligentna cyfrowa dioda LED RGB WS2812B SMD-5050',
    nameEn: 'Worldsemi WS2812B Addressable RGB LED 5050',
    category: 'diodes',
    pkg: 'SMD-5050',
    voltage: '5V',
    current: 'Max 60 mA (20 mA na kanał RGB), Standby: 1 mA',
    descPl: 'Cyfrowa, inteligentna dioda LED RGB 5050 z wbudowanym układem sterującym i protokołem 1-Wire (NeoPixel). Każdy piksel ma 256 poziomów jasności (16.7 mln barw).',
    descEn: 'Worldsemi WS2812B intelligent control LED light source with integrated RGB chip and driver in 5050 package. Single-wire cascade transmission (NeoPixel compatible).',
    pins: { '1': 'VDD', '2': 'DOUT', '3': 'VSS', '4': 'DIN' },
    valKind: 'D',
    footprintWidth: 5.0,
    footprintHeight: 5.0,
    padsCount: 4,
    tags: ['led', 'rgb', 'ws2812', 'ws2812b', 'neopixel', 'addressable', 'worldsemi', '5050', 'smd-5050', 'smd', 'diode', 'dioda', 'pwm', '5v', 'digital']
  },

  // --- Interface & Support ICs / Connectors ---
  {
    id: 'ch340c',
    mpn: 'CH340C',
    manufacturer: 'WCH',
    lcsc: 'C85023',
    pcbwayPart: 'PCBWAY-CH340C',
    namePl: 'Konwerter USB na UART z wbudowanym oscylatorem kwarcowym CH340C',
    nameEn: 'WCH CH340C USB to UART Converter with Internal Clock',
    category: 'interface',
    pkg: 'SOP-16',
    voltage: '5V/3.3V',
    current: 'Typ. 12 mA, Sleep: 0.15 mA',
    descPl: 'Ekonomiczny mostek USB-UART z wbudowanym oscylatorem kwarcowym eliminującym potrzebę zewnętrznego kwarcu 12MHz. Pełna obsługa prędkości od 50bps do 2Mbps, poziomy logiczne 5V/3.3V.',
    descEn: 'WCH CH340C USB-to-UART bridge converter with integrated clock generator (no external crystal required). Supports 50bps to 2Mbps baud rates, 5V and 3.3V operation.',
    pins: { '1': 'GND', '2': 'TXD', '3': 'RXD', '4': 'V3', '5': 'UD+', '6': 'UD-', '7': 'NC', '8': 'NC', '9': 'CTS#', '10': 'DSR#', '11': 'RI#', '12': 'DCD#', '13': 'DTR#', '14': 'RTS#', '15': 'NC', '16': 'VCC' },
    valKind: 'IC',
    footprintWidth: 6.0,
    footprintHeight: 10.0,
    padsCount: 16,
    tags: ['usb', 'uart', 'serial', 'bridge', 'converter', 'crystal', 'wch', 'ch340', 'ch340c', 'sop-16', 'smd', 'interface', 'interfejs', 'szeregowy', '5v', '3.3v', '3v3']
  },
  {
    id: 'ch340g',
    mpn: 'CH340G',
    manufacturer: 'WCH (Jiangsu Qinheng)',
    lcsc: 'C84683',
    pcbwayPart: 'PCBWAY-CH340G',
    namePl: 'Konwerter USB na UART CH340G z zewnętrznym rezonatorem',
    nameEn: 'USB to Serial UART Converter CH340G (External Crystal)',
    category: 'interface',
    pkg: 'SOP-16',
    voltage: '3.3V – 5.0V',
    current: 'Typ. 12 mA',
    descPl: 'Powszechny konwerter USB-UART na płytkach Arduino Nano V3, NodeMCU v2 i klonach Uno. Wymaga zewnętrznego kwarcu 12MHz na pinach XI/XO (LCSC C84683).',
    descEn: 'Ubiquitous USB to UART bridge used in Arduino Nano V3 and NodeMCU clones. Requires external 12MHz crystal on XI/XO pins (LCSC C84683).',
    pins: {
      '1': 'GND', '2': 'TXD', '3': 'RXD', '4': 'V3', '5': 'UD+', '6': 'UD-',
      '7': 'XI', '8': 'XO', '9': 'CTS#', '10': 'DSR#', '11': 'RI#', '12': 'DCD#',
      '13': 'DTR#', '14': 'RTS#', '16': 'VCC'
    },
    valKind: 'IC',
    footprintWidth: 6.0,
    footprintHeight: 10.0,
    padsCount: 16,
    tags: ['usb', 'uart', 'serial', 'bridge', 'converter', 'wch', 'ch340', 'ch340g', 'sop-16', 'smd', 'interface', 'interfejs', 'szeregowy']
  },
  {
    id: 'cp2102-gmr',
    mpn: 'CP2102-GMR',
    manufacturer: 'Silicon Labs',
    lcsc: 'C9924',
    pcbwayPart: 'PCBWAY-CP2102',
    namePl: 'Pojedynczy mostek USB na UART Full-Speed',
    nameEn: 'Single-Chip USB-to-UART Bridge Controller',
    category: 'interface',
    pkg: 'QFN-28 (5x5mm)',
    voltage: '3.0V – 3.6V (wbudowany regulator 3.3V z 5V)',
    current: '20 mA aktywny',
    descPl: 'Profesjonalny układ USB-UART o wysokiej stabilności transmisji, fabrycznie instalowany na oryginalnych modułach NodeMCU i ESP32 DevKit.',
    descEn: 'High reliability USB to UART controller installed on NodeMCU and genuine ESP32 DevKit modules.',
    pins: { '1': 'DCD', '3': 'GND', '4': 'D+', '5': 'D-', '6': 'VDD', '7': 'REGIN (5V)', '8': 'VBUS', '25': 'TXD', '26': 'RXD' },
    valKind: 'IC',
    footprintWidth: 5.0,
    footprintHeight: 5.0,
    padsCount: 28,
    tags: ['usb', 'uart', 'serial', 'bridge', 'converter', 'silicon labs', 'cp2102', 'qfn', 'qfn-28', 'smd', 'interface', 'interfejs', 'szeregowy']
  },
  {
    id: 'lm358dr',
    mpn: 'LM358DR',
    manufacturer: 'Texas Instruments',
    lcsc: 'C6186',
    pcbwayPart: 'PCBWAY-LM358',
    namePl: 'Podwójny wzmacniacz operacyjny ogólnego przeznaczenia (SOIC-8)',
    nameEn: 'Dual General Purpose Operational Amplifier (SOIC-8)',
    category: 'interface',
    pkg: 'SOIC-8',
    voltage: 'Pojedyncze 3V – 32V lub symetryczne ±1.5V – ±16V',
    current: '0.7 mA prąd spoczynkowy',
    descPl: 'Wzmacniacz operacyjny pracujący przy zasilaniu niesymetrycznym od 3V, stosowany do buforowania napięć odniesienia, komparatorów wyboru zasilania USB/DC jack w Arduino i wzmacniaczy boczników prądowych.',
    descEn: 'Dual op-amp operating down to 3V, used in Arduino auto-voltage selector circuits and current shunt amplifiers.',
    pins: { '1': 'OUT1', '2': 'IN1-', '3': 'IN1+', '4': 'GND / V-', '5': 'IN2+', '6': 'IN2-', '7': 'OUT2', '8': 'VCC / V+' },
    valKind: 'IC',
    footprintWidth: 5.0,
    footprintHeight: 6.0,
    padsCount: 8,
    tags: ['opamp', 'op-amp', 'amplifier', 'wzmacniacz', 'operacyjny', 'lm358', 'lm358dr', 'ti', 'texas instruments', 'soic-8', 'soic8', 'sop-8', 'smd', 'analog', 'comparator', 'ic']
  },
  {
    id: 'lm358p',
    mpn: 'LM358P',
    manufacturer: 'Texas Instruments',
    lcsc: 'C7442',
    pcbwayPart: 'PCBWAY-LM358P',
    namePl: 'Podwójny wzmacniacz operacyjny ogólnego przeznaczenia LM358P DIP-8',
    nameEn: 'LM358P Dual General-Purpose Operational Amplifier DIP-8',
    category: 'interface',
    pkg: 'DIP-8',
    voltage: '3.0V – 32V (pojedyncze) lub ±1.5V – ±16V (symetryczne)',
    current: '0.7 mA prąd spoczynkowy, wyjście do 40 mA',
    descPl: 'Powszechny podwójny wzmacniacz operacyjny w przewlekanej obudowie DIP-8. Szeroki zakres zasilania od 3V, idealny do płytek stykowych, komparatorów i układów audio. LCSC C7442.',
    descEn: 'Industry standard dual op-amp in DIP-8 package. Operates from single 3V to 32V supply, ideal for breadboards, sensor amplification, and comparators. LCSC C7442.',
    pins: { '1': 'OUT1', '2': 'IN1-', '3': 'IN1+', '4': 'GND / V-', '5': 'IN2+', '6': 'IN2-', '7': 'OUT2', '8': 'VCC / V+' },
    valKind: 'IC',
    footprintWidth: 9.5,
    footprintHeight: 6.5,
    padsCount: 8,
    tags: ['opamp', 'op-amp', 'amplifier', 'wzmacniacz', 'operacyjny', 'lm358', 'lm358p', 'dip', 'dip-8', 'tht', 'through-hole', 'ti', 'texas instruments', 'analog', 'comparator', 'ic']
  },
  {
    id: 'ne555p',
    mpn: 'NE555P',
    manufacturer: 'Texas Instruments',
    lcsc: 'C7593',
    pcbwayPart: 'PCBWAY-NE555P',
    namePl: 'Precyzyjny generator czasowy NE555P DIP-8 (Timer 555)',
    nameEn: 'NE555P Precision Timer DIP-8 (555 Timer IC)',
    category: 'interface',
    pkg: 'DIP-8',
    voltage: '4.5V – 16V',
    current: 'Spoczynkowy: 3 – 5 mA, Wyjście do 200 mA',
    descPl: 'Kultowy precyzyjny układ czasowy 555 w obudowie przewlekanej DIP-8. Może generować impulsy zegarowe (układ astabilny), pojedyncze opóźnienia (monostabilny) lub sterować PWM. LCSC C7593.',
    descEn: 'Legendary 555 timer IC in DIP-8 package. Operates in astable (oscillator/PWM), monostable (one-shot delay), and bistable modes with output drive up to 200mA. LCSC C7593.',
    pins: {
      '1': 'GND', '2': 'TRIG (Trigger)', '3': 'OUT', '4': 'RESET',
      '5': 'CONT (Control)', '6': 'THRES (Threshold)', '7': 'DISCH (Discharge)', '8': 'VCC'
    },
    valKind: 'IC',
    footprintWidth: 9.5,
    footprintHeight: 6.5,
    padsCount: 8,
    tags: ['timer', 'ne555', 'ne555p', '555', 'astable', 'monostable', 'oscillator', 'clock', 'generator', 'dip', 'dip-8', 'tht', 'through-hole', 'ti', 'texas instruments', 'czasowy', 'zegar', 'ic']
  },
  {
    id: 'w25q128jvsiq',
    mpn: 'W25Q128JVSIQ',
    manufacturer: 'Winbond Electronics',
    lcsc: 'C38214',
    pcbwayPart: 'PCBWAY-W25Q128',
    namePl: 'Pamięć Flash SPI 128Mbit (16MB) 133MHz',
    nameEn: '128M-bit (16MB) Serial Flash Memory 133MHz',
    category: 'interface',
    pkg: 'SOIC-8 (208mil)',
    voltage: '2.7V – 3.6V (typ. 3.3V)',
    current: 'Aktywny odczyt: 10 mA, Power-down: 1 µA',
    descPl: 'Szybka pamięć szeregowa SPI / QSPI stosowana jako nośnik firmware w Raspberry Pi Pico, ESP32, routerach i płytach głównych PC.',
    descEn: 'High-speed Quad-SPI serial Flash memory for firmware storage in RP2040, ESP32, and PC motherboards.',
    pins: { '1': '/CS', '2': 'DO (IO1)', '3': '/WP (IO2)', '4': 'GND', '5': 'DI (IO0)', '6': 'CLK', '7': '/HOLD (IO3)', '8': 'VCC' },
    valKind: 'IC',
    footprintWidth: 5.3,
    footprintHeight: 8.0,
    padsCount: 8,
    tags: ['flash', 'spi', 'qspi', 'memory', 'pamiec', 'pamięć', 'winbond', '16mb', 'soic-8', 'soic8', 'sop-8', 'smd', 'ic', '3.3v']
  },
  {
    id: 'usb-c-16p-tht-smd',
    mpn: 'TYPE-C-31-M-12',
    manufacturer: 'Korean Hroparts Elec',
    lcsc: 'C165948',
    pcbwayPart: 'PCBWAY-TYPE-C-16P',
    namePl: 'Gniazdo żeńskie USB-C 16-pin SMD z 4 nóżkami THT (USB 2.0 / PD)',
    nameEn: '16-Pin USB Type-C Receptacle SMD with 4 THT Shield Tabs (USB 2.0 / PD)',
    category: 'interface',
    pkg: 'USB-C-16P (SMD+THT)',
    voltage: '20V DC max',
    current: '3.0 A nominalny (do 5.0 A z rezystorami CC)',
    descPl: 'Wysokiej wytrzymałości gniazdo USB Type-C 16-pin do zasilania oraz danych USB 2.0. 4 przewlekane bolce montażowe chronią przed wyrwaniem gniazda z laminatu. LCSC C165948.',
    descEn: 'High-durability 16-pin USB Type-C female connector for power delivery and USB 2.0 data lines with 4 through-hole structural shield legs. LCSC C165948.',
    pins: {
      'A1/B12': 'GND', 'A4/B9': 'VBUS', 'A5': 'CC1', 'A6': 'D+', 'A7': 'D-', 'A8': 'SBU1',
      'B1/A12': 'GND', 'B4/A9': 'VBUS', 'B5': 'CC2', 'B6': 'D+', 'B7': 'D-', 'B8': 'SBU2',
      'SH1': 'SHIELD', 'SH2': 'SHIELD', 'SH3': 'SHIELD', 'SH4': 'SHIELD'
    },
    footprintWidth: 8.94,
    footprintHeight: 7.35,
    padsCount: 16,
    tags: ['usb', 'usb-c', 'usbc', 'type-c', 'typec', 'connector', 'receptacle', 'gniazdo', 'zlacze', 'złącze', 'port', 'interface', 'power', 'vbus', 'smd', 'tht']
  },

  // --- Passives ---
  {
    id: 'res-smd-0805-10k',
    mpn: 'RC0805JR-0710KL',
    manufacturer: 'YAGEO',
    lcsc: 'C17414',
    pcbwayPart: 'PCBWAY-0805-10K',
    namePl: 'Rezystor SMD 0805 10 kΩ 1/8W 5%',
    nameEn: 'SMD Resistor 0805 10 kΩ 1/8W 5%',
    category: 'passives',
    pkg: '0805 (2012 Metric)',
    voltage: 'Max 150V',
    current: 'P = 125 mW',
    descPl: 'Uniwersalny rezystor podciągający (pull-up) do magistral I2C, linii RESET i przycisków.',
    descEn: 'Standard pull-up resistor for I2C, reset lines, and pushbuttons.',
    pins: { '1': '1', '2': '2' },
    valKind: 'R',
    defaultVal: 10000,
    footprintWidth: 2.0,
    footprintHeight: 1.25,
    padsCount: 2,
    tags: ['resistor', 'pull-up', 'passive', '0805', 'smd', 'rezystor', 'opornik', '10k', '10kohm', 'yageo']
  },
  {
    id: 'cap-mlcc-0805-100n',
    mpn: 'CC0805KRX7R9BB104',
    manufacturer: 'YAGEO',
    lcsc: 'C49678',
    pcbwayPart: 'PCBWAY-0805-100NF',
    namePl: 'Kondensator ceramiczny MLCC 0805 100 nF 50V X7R',
    nameEn: 'Ceramic MLCC Capacitor 0805 100 nF 50V X7R',
    category: 'passives',
    pkg: '0805 (2012 Metric)',
    voltage: '50V',
    current: 'Low ESR',
    descPl: 'Kondensator odsprzęgający zasilanie każdego układu scalonego. Najczęstszy element ulegający zwarciu (MLCC crack/short) przy przepięciach lub ugięciu płyty.',
    descEn: 'Decoupling capacitor for digital ICs. Most frequent component shorting out (cracked ceramic dielectric) in repair benchmarks.',
    pins: { '1': '1', '2': '2' },
    valKind: 'C',
    defaultVal: 1e-7,
    footprintWidth: 2.0,
    footprintHeight: 1.25,
    padsCount: 2,
    tags: ['capacitor', 'mlcc', 'ceramic', 'decoupling', 'passive', '0805', 'smd', 'kondensator', 'pojemność', 'pojemnosc', '100n', '100nf', 'yageo']
  },
  {
    id: 'cap-mlcc-0805-10u',
    mpn: 'CL21A106KOQNNNE',
    manufacturer: 'Samsung Electro-Mechanics',
    lcsc: 'C15850',
    pcbwayPart: 'PCBWAY-0805-10UF',
    namePl: 'Kondensator ceramiczny MLCC 0805 10 µF 16V X5R',
    nameEn: 'Ceramic MLCC Capacitor 0805 10 µF 16V X5R',
    category: 'passives',
    pkg: '0805 (2012 Metric)',
    voltage: '16V',
    current: 'Low ESR',
    descPl: 'Kondensator filtrujący wyjście stabilizatorów LDO (AMS1117) i przetwornic DC-DC.',
    descEn: 'Filtering capacitor for LDO regulator outputs and buck converters.',
    pins: { '1': '1', '2': '2' },
    valKind: 'C',
    defaultVal: 1e-5,
    footprintWidth: 2.0,
    footprintHeight: 1.25,
    padsCount: 2,
    tags: ['capacitor', 'mlcc', 'ceramic', 'filter', 'passive', '0805', 'smd', 'kondensator', 'pojemność', 'pojemnosc', '10u', '10uf', 'samsung']
  },
  {
    id: 'fuse-smd-1206-1a',
    mpn: '0466001.NR',
    manufacturer: 'Littelfuse',
    lcsc: 'C1066',
    pcbwayPart: 'PCBWAY-FUSE-1A',
    namePl: 'Bezpiecznik szybki SMD 1206 1.0 A 32V',
    nameEn: 'Fast-Acting SMD Fuse 1206 1.0 A 32V',
    category: 'passives',
    pkg: '1206 (3216 Metric)',
    voltage: '32V DC',
    current: '1.0 A prąd znamionowy',
    descPl: 'Bezpiecznik chroniący wejście USB i szyny zasilania przed zwarciem. Przepala się, tworząc przerwę (open circuit), gdy prąd przekroczy 1 A.',
    descEn: 'Fast-acting fuse protecting USB and board rails from overcurrent. Blows open when current exceeds 1 A.',
    pins: { '1': '1', '2': '2' },
    valKind: 'F',
    defaultVal: 1.0,
    footprintWidth: 3.2,
    footprintHeight: 1.6,
    padsCount: 2,
    tags: ['fuse', 'fast-acting', 'overcurrent', 'protection', 'passive', '1206', 'smd', 'bezpiecznik', 'ochrona', '1a', 'littelfuse']
  }
];

export function findPartById(id: string): ComponentPart | undefined {
  const normId = id.trim().toLowerCase();
  return SUPPLIER_PARTS.find((p) => p.id.toLowerCase() === normId);
}

/** Strips Polish and international diacritics into plain ASCII (e.g. "pojemność" -> "pojemnosc", "płytka" -> "plytka"). */
export function stripDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L');
}

/** Normalizes a search term (trimmed, lowercase, diacritics stripped). */
export function normalizeSearchTerm(term: string): string {
  return stripDiacritics(term.trim().toLowerCase());
}

interface SynonymGroup {
  stems: string[];
  terms: string[];
  valKinds?: Array<'R' | 'C' | 'L' | 'IC' | 'D' | 'Q' | 'SW' | 'F'>;
  categories?: Array<'modules' | 'power' | 'transistors' | 'diodes' | 'interface' | 'passives'>;
}

const SYNONYM_GROUPS: SynonymGroup[] = [
  {
    stems: ['kondensator', 'pojemnos', 'capacitor', 'capacit', 'mlcc'],
    terms: ['kondensator', 'pojemnosc', 'capacitor', 'mlcc', 'ceramic', 'decoupling'],
    valKinds: ['C'],
    categories: ['passives']
  },
  {
    stems: ['rezystor', 'opornik', 'resistor', 'resist'],
    terms: ['rezystor', 'opornik', 'resistor', 'pull-up'],
    valKinds: ['R'],
    categories: ['passives']
  },
  {
    stems: ['przetwornic', 'stabilizator', 'regulator', 'ldo', 'buck', 'stepdown', 'dcdc'],
    terms: ['przetwornica', 'stabilizator', 'regulator', 'ldo', 'buck', 'dcdc', 'step-down', 'linear', 'pmic', 'zasilanie'],
    categories: ['power']
  },
  {
    stems: ['tranzystor', 'transistor', 'mosfet', 'fet'],
    terms: ['tranzystor', 'transistor', 'mosfet', 'fet', 'n-mosfet', 'p-mosfet', 'n-channel', 'p-channel'],
    valKinds: ['Q'],
    categories: ['transistors']
  },
  {
    stems: ['diod', 'diode', 'schottky', 'tvs', 'esd'],
    terms: ['dioda', 'diode', 'schottky', 'tvs', 'esd', 'rectifier', 'ochrona', 'zabezpieczenie'],
    valKinds: ['D'],
    categories: ['diodes']
  },
  {
    stems: ['mikrokontroler', 'microcontroller', 'mcu', 'procesor', 'soc'],
    terms: ['mikrokontroler', 'mcu', 'microcontroller', 'soc', 'procesor', 'arm', 'avr', 'xtensa', 'riscv'],
    categories: ['modules']
  },
  {
    stems: ['plytk', 'board', 'modul', 'module'],
    terms: ['plytka', 'modul', 'module', 'board', 'pico', 'arduino'],
    categories: ['modules']
  },
  {
    stems: ['bezpiecznik', 'fuse'],
    terms: ['bezpiecznik', 'fuse', 'fast-acting', 'overcurrent'],
    valKinds: ['F'],
    categories: ['passives']
  },
  {
    stems: ['wzmacniacz', 'opamp', 'amplifier', 'operacyjn'],
    terms: ['wzmacniacz', 'opamp', 'op-amp', 'amplifier', 'operacyjny', 'lm358', 'comparator'],
    categories: ['interface']
  },
  {
    stems: ['czasow', 'zegar', 'timer', '555', 'astabiln'],
    terms: ['timer', 'czasowy', 'zegar', '555', 'ne555', 'astable', 'oscillator'],
    categories: ['interface']
  },
  {
    stems: ['ladowark', 'ladowan', 'charger', 'bater', 'battery', 'akumulator'],
    terms: ['ladowarka', 'charger', 'battery', 'bateria', 'akumulator', 'li-ion', 'lipo', 'tp4056', 'cc-cv'],
    categories: ['power']
  },
  {
    stems: ['zlacz', 'gniazd', 'connector', 'receptacle'],
    terms: ['zlacze', 'gniazdo', 'connector', 'receptacle', 'port', 'usb-c', 'usbc'],
    categories: ['interface']
  },
  {
    stems: ['pamiec', 'flash', 'memory'],
    terms: ['pamiec', 'flash', 'memory', 'spi', 'qspi', 'winbond'],
    categories: ['interface']
  },
  {
    stems: ['uart', 'usart', 'szeregow', 'serial', 'ch340', 'cp2102'],
    terms: ['uart', 'serial', 'szeregowy', 'ch340', 'cp2102', 'bridge', 'converter'],
    categories: ['interface']
  },
  {
    stems: ['wifi', 'bluetooth', 'ble', 'bezprzewodow'],
    terms: ['wifi', 'bluetooth', 'ble', 'wireless', 'espressif'],
    categories: ['modules']
  }
];

/** Produces electrical/engineering notation variations (e.g. 3v3 <-> 3.3v, 100n <-> 100nf). */
function getUnitEquivalents(token: string): string[] {
  const res: string[] = [];
  // 3v3 <-> 3.3v / 3.3
  const vMatch1 = token.match(/^(\d+)v(\d+)$/i);
  if (vMatch1) {
    res.push(`${vMatch1[1]}.${vMatch1[2]}v`);
    res.push(`${vMatch1[1]}.${vMatch1[2]}`);
  }
  const vMatch2 = token.match(/^(\d+)\.(\d+)v?$/i);
  if (vMatch2) {
    res.push(`${vMatch2[1]}v${vMatch2[2]}`);
    res.push(`${vMatch2[1]}.${vMatch2[2]}v`);
  }
  // 5v <-> 5.0v
  if (/^(\d+)v$/i.test(token)) {
    const num = token.replace(/v$/i, '');
    res.push(`${num}.0v`);
  }
  if (/^(\d+)\.0v$/i.test(token)) {
    const num = token.replace(/\.0v$/i, '');
    res.push(`${num}v`);
  }
  // 100n <-> 100nf
  if (/^(\d+)n$/i.test(token)) {
    const num = token.replace(/n$/i, '');
    res.push(`${num}nf`);
    res.push(`${num} n`);
    res.push(`${num} nf`);
  }
  if (/^(\d+)nf$/i.test(token)) {
    const num = token.replace(/nf$/i, '');
    res.push(`${num}n`);
    res.push(`${num} n`);
    res.push(`${num} nf`);
  }
  // 10u <-> 10uf
  if (/^(\d+)u$/i.test(token)) {
    const num = token.replace(/u$/i, '');
    res.push(`${num}uf`);
    res.push(`${num} µf`);
  }
  if (/^(\d+)uf$/i.test(token)) {
    const num = token.replace(/uf$/i, '');
    res.push(`${num}u`);
    res.push(`${num} µf`);
  }
  // 10k <-> 10kohm
  if (/^(\d+)k$/i.test(token)) {
    const num = token.replace(/k$/i, '');
    res.push(`${num}kohm`);
    res.push(`${num} k`);
  }
  return res;
}

interface PartIndex {
  part: ComponentPart;
  index: number;
  normAll: string;
  alphaAll: string;
  normMpn: string;
  alphaMpn: string;
  normId: string;
  alphaId: string;
  normLcsc: string;
  normName: string;
  normTags: string[];
}

let cachedIndex: PartIndex[] | null = null;

function getPartIndex(): PartIndex[] {
  if (cachedIndex && cachedIndex.length === SUPPLIER_PARTS.length) {
    return cachedIndex;
  }
  cachedIndex = SUPPLIER_PARTS.map((p, index) => {
    const allFields = [
      p.id,
      p.mpn,
      p.manufacturer,
      p.lcsc,
      p.pcbwayPart,
      p.namePl,
      p.nameEn,
      p.category,
      p.pkg,
      p.voltage,
      p.current,
      p.descPl,
      p.descEn,
      p.valKind || '',
      ...(p.tags || []),
      ...Object.keys(p.pins),
      ...Object.values(p.pins)
    ];
    const normAll = stripDiacritics(allFields.join(' ').toLowerCase());
    const alphaAll = normAll.replace(/[^a-z0-9]/g, '');
    const normMpn = stripDiacritics(p.mpn.toLowerCase());
    const alphaMpn = normMpn.replace(/[^a-z0-9]/g, '');
    const normId = stripDiacritics(p.id.toLowerCase());
    const alphaId = normId.replace(/[^a-z0-9]/g, '');
    const normLcsc = p.lcsc.toLowerCase();
    const normName = stripDiacritics(`${p.namePl} ${p.nameEn}`.toLowerCase());
    const normTags = (p.tags || []).map((t) => stripDiacritics(t.toLowerCase()));

    return {
      part: p,
      index,
      normAll,
      alphaAll,
      normMpn,
      alphaMpn,
      normId,
      alphaId,
      normLcsc,
      normName,
      normTags
    };
  });
  return cachedIndex;
}

function matchToken(idx: PartIndex, rawToken: string): boolean {
  const normT = normalizeSearchTerm(rawToken);
  if (!normT) return true;
  const alphaT = normT.replace(/[^a-z0-9]/g, '');
  const p = idx.part;

  // 1. Direct normalized substring match
  if (idx.normAll.includes(normT)) {
    return true;
  }

  // 2. Alphanumeric match ignoring punctuation & hyphens (e.g. "esp-32" vs "esp32", "sot-223" vs "sot223")
  if (alphaT.length >= 2 && idx.alphaAll.includes(alphaT)) {
    return true;
  }

  // 3. Electrical unit conversions (e.g. 3v3 <-> 3.3v, 100n <-> 100nf)
  const unitVariants = getUnitEquivalents(normT);
  for (const v of unitVariants) {
    if (idx.normAll.includes(v)) return true;
    const alphaV = v.replace(/[^a-z0-9]/g, '');
    if (alphaV.length >= 2 && idx.alphaAll.includes(alphaV)) return true;
  }

  // 4. Package and mounting filter shorthands
  if (normT === 'tht' || normT === 'through-hole') {
    if (
      p.pkg.toLowerCase().includes('tht') ||
      p.pkg.toLowerCase().includes('dip') ||
      p.pkg.toLowerCase().includes('through-hole') ||
      p.tags?.some((t) => t.toLowerCase() === 'tht' || t.toLowerCase() === 'through-hole')
    ) {
      return true;
    }
  }
  if (normT === 'smd' || normT === 'smt') {
    if (
      p.tags?.some((t) => t.toLowerCase() === 'smd' || t.toLowerCase() === 'smt') ||
      /smd|sot|qfn|soic|sop|tqfp|lqfp|0805|1206|sma/i.test(p.pkg)
    ) {
      return true;
    }
  }
  if (normT === 'dip') {
    if (p.pkg.toLowerCase().includes('dip') || p.tags?.some((t) => t.toLowerCase().includes('dip'))) {
      return true;
    }
  }

  // 5. Polish / English stem & synonym matching
  for (const group of SYNONYM_GROUPS) {
    const matchesStem = group.stems.some(
      (stem) => normT.startsWith(stem) || (normT.length >= 4 && stem.startsWith(normT))
    );
    if (!matchesStem) continue;

    // Check if the component matches this synonym group
    if (group.categories && group.categories.includes(p.category)) {
      return true;
    }
    if (group.valKinds && p.valKind && group.valKinds.includes(p.valKind)) {
      return true;
    }
    if (group.terms.some((term) => idx.normAll.includes(term) || p.tags?.includes(term))) {
      return true;
    }
  }

  return false;
}

/** Computes relevance score for ranking matching items. Higher is better. */
function calculateScore(idx: PartIndex, tokens: string[]): number {
  let score = 0;
  for (const rawToken of tokens) {
    const normT = normalizeSearchTerm(rawToken);
    if (!normT) continue;
    const alphaT = normT.replace(/[^a-z0-9]/g, '');

    // MPN or LCSC exact/prefix match (top priority)
    if (idx.normMpn === normT || idx.normLcsc === normT) score += 100;
    else if (idx.normMpn.includes(normT) || (alphaT.length >= 2 && idx.alphaMpn.includes(alphaT))) score += 50;

    // ID match
    if (idx.normId === normT || idx.alphaId === alphaT) score += 45;
    else if (idx.normId.includes(normT) || (alphaT.length >= 2 && idx.alphaId.includes(alphaT))) score += 35;

    // Name match
    if (idx.normName.includes(normT)) score += 30;

    // Tags match
    if (idx.normTags.some((t) => t === normT || (alphaT.length >= 2 && t.replace(/[^a-z0-9]/g, '') === alphaT))) {
      score += 25;
    } else if (idx.normTags.some((t) => t.includes(normT))) {
      score += 15;
    }

    // Package match
    if (idx.part.pkg.toLowerCase().includes(normT)) score += 10;
  }
  return score;
}

/**
 * Searches the supplier component library with intelligent multi-token matching,
 * punctuation normalization, Polish/English stem resolution, and category/tag filtering.
 */
export function searchSupplierParts(query: string, category?: string, tag?: string): ComponentPart[] {
  const normCategory = category && category !== 'all' ? category.toLowerCase().trim() : undefined;
  const normTag = tag && tag !== 'all' ? normalizeSearchTerm(tag) : undefined;

  const rawQuery = (query || '').trim();
  const tokens = rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];

  const index = getPartIndex();

  const matched = index.filter((idx) => {
    const p = idx.part;

    // 1. Category filter
    if (normCategory && p.category.toLowerCase() !== normCategory) {
      return false;
    }

    // 2. Tag filter
    if (normTag) {
      const hasTag = (p.tags || []).some((t) => {
        const nt = normalizeSearchTerm(t);
        return nt === normTag || nt.includes(normTag);
      });
      if (!hasTag) return false;
    }

    // 3. Multi-token AND search (all tokens must match)
    if (tokens.length === 0) {
      return true;
    }

    return tokens.every((token) => matchToken(idx, token));
  });

  // If search query was provided, rank by relevance score
  if (tokens.length > 0) {
    matched.sort((a, b) => {
      const scoreDiff = calculateScore(b, tokens) - calculateScore(a, tokens);
      if (scoreDiff !== 0) return scoreDiff;
      return a.index - b.index;
    });
  }

  return matched.map((r) => r.part);
}

// ==========================================
// BILL OF MATERIALS (BOM) PRODUCTION EXPORTS
// ==========================================

export interface BomItem {
  comment?: string;
  designator: string;
  quantity: number;
  footprint: string;
  lcsc: string;
  mpn: string;
  description: string;
  // JLCPCB SMT / PCBWay assembly column aliases
  'Comment/Designator': string;
  'Quantity': number;
  'Footprint/Package': string;
  'LCSC Part #': string;
  'MPN': string;
  'Description': string;
}

function formatBomOhms(v: number): string {
  if (v >= 1e6) {
    const val = v / 1e6;
    return (val % 1 === 0 ? val.toString() : val.toFixed(1)) + 'M';
  }
  if (v >= 1e3) {
    const val = v / 1e3;
    return (val % 1 === 0 ? val.toString() : val.toFixed(1)) + 'k';
  }
  return (v % 1 === 0 ? v.toString() : v.toFixed(1)) + 'R';
}

function formatBomFarads(v: number): string {
  const round = (n: number) => {
    const s = n.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  };
  if (v >= 1e-3) return round(v * 1e3) + 'mF';
  if (v >= 1e-6) return round(v * 1e6) + 'uF';
  if (v >= 1e-9) return round(v * 1e9) + 'nF';
  if (v >= 1e-12) return round(v * 1e12) + 'pF';
  return v + 'F';
}

function escapeBomCsv(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates aggregated Bill of Materials items grouped by component type,
 * package, and manufacturer part number for SMT assembly.
 */
export function generateBomItems(board: Board): BomItem[] {
  if (!board || !board.components || board.components.length === 0) {
    return [];
  }

  const groups = new Map<string, {
    refs: string[];
    footprint: string;
    lcsc: string;
    mpn: string;
    description: string;
    comment: string;
  }>();

  for (const c of board.components) {
    let part: ComponentPart | undefined;
    if (c.id) part = findPartById(c.id);
    if (!part && (c as any).partId) part = findPartById((c as any).partId);
    if (!part && c.label) part = findPartById(c.label) ?? searchSupplierParts(c.label)[0];
    if (!part && c.ref) part = findPartById(c.ref);

    let valStr = '';
    if (c.kind === 'resistor') valStr = formatBomOhms(c.value);
    else if (c.kind === 'capacitor') valStr = formatBomFarads(c.value);
    else if (c.kind === 'led') valStr = (c.color ? c.color.toUpperCase() + ' ' : '') + 'LED';
    else if (c.kind === 'battery') valStr = `${c.value}V`;
    else valStr = c.label || c.kind;

    if (!part) {
      if (c.kind === 'resistor') {
        part = searchSupplierParts(valStr, 'passives')[0];
      } else if (c.kind === 'capacitor') {
        part = searchSupplierParts(valStr, 'passives')[0];
      } else if (c.kind === 'led' || c.kind === 'diode') {
        part = searchSupplierParts(c.label || c.color || c.kind, 'diodes')[0];
      } else if (c.kind === 'ic' && c.label) {
        part = searchSupplierParts(c.label)[0];
      }
    }

    const pkg = c.footprint || part?.pkg || (c.body?.shape === 'chip' ? 'SOIC-8' : (c.kind === 'resistor' || c.kind === 'capacitor') ? '0805' : 'SMD');
    const mpn = part?.mpn ?? (
      c.kind === 'resistor' ? `RC0805JR-${valStr || '10k'}` :
      c.kind === 'capacitor' ? `CL21B-${valStr || '100nF'}` :
      c.kind === 'led' ? '19-217-BHC-AP1Q2-3T' :
      c.label || `${c.kind.toUpperCase()}-SMD`
    );
    const lcsc = part?.lcsc ?? '';
    const desc = part?.nameEn ?? part?.descEn ?? (c.label || `${c.kind} ${valStr}`.trim());
    const comment = c.label || valStr || mpn;

    const groupKey = [mpn, lcsc, pkg, desc].join('::');
    const existing = groups.get(groupKey);
    if (existing) {
      existing.refs.push(c.ref);
    } else {
      groups.set(groupKey, {
        refs: [c.ref],
        footprint: pkg,
        lcsc,
        mpn,
        description: desc,
        comment,
      });
    }
  }

  const items: BomItem[] = [];
  for (const entry of groups.values()) {
    entry.refs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const designatorStr = entry.refs.join(', ');
    const count = entry.refs.length;
    items.push({
      comment: entry.comment,
      designator: designatorStr,
      quantity: count,
      footprint: entry.footprint,
      lcsc: entry.lcsc,
      mpn: entry.mpn,
      description: entry.description,
      'Comment/Designator': designatorStr,
      'Quantity': count,
      'Footprint/Package': entry.footprint,
      'LCSC Part #': entry.lcsc,
      'MPN': entry.mpn,
      'Description': entry.description,
    });
  }

  items.sort((a, b) => a.designator.localeCompare(b.designator, undefined, { numeric: true }));
  return items;
}

/**
 * Exports production-ready Bill of Materials (BOM) in CSV format
 * formatted for JLCPCB SMT / PCBWay assembly.
 */
export function exportBomCsv(board: Board): string {
  const items = generateBomItems(board);
  const header = 'Comment/Designator,Quantity,Footprint/Package,LCSC Part #,MPN,Description';
  const rows: string[] = [header];
  for (const item of items) {
    rows.push([
      escapeBomCsv(item.designator),
      item.quantity,
      escapeBomCsv(item.footprint),
      escapeBomCsv(item.lcsc),
      escapeBomCsv(item.mpn),
      escapeBomCsv(item.description),
    ].join(','));
  }
  return rows.join('\n');
}

/**
 * Exports production-ready Bill of Materials (BOM) in JSON format.
 */
export function exportBomJson(board: Board): string {
  const items = generateBomItems(board);
  return JSON.stringify(items, null, 2);
}
