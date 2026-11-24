// Lightweight metadata for realistic board presets (lazy loaded on demand)
import type { Scenario } from '../types';

export interface BoardPresetMeta {
  id: string;
  titlePl: string;
  titleEn: string;
  descPl: string;
  descEn: string;
  category: 'mcu' | 'power' | 'iot';
  difficulty: number;
  load: () => Promise<Scenario>;
}

export const BOARD_PRESET_METAS: BoardPresetMeta[] = [
  {
    id: 'preset-esp32-devkit',
    titlePl: 'ESP32 DevKit V1 (Wi-Fi + BLE / 3.3V LDO)',
    titleEn: 'ESP32 DevKit V1 (Wi-Fi + BLE / 3.3V LDO)',
    descPl: 'Oficjalna płytka ESP32 DevKit V1 z anteną meandrową PCB, ekranem RF ESP-WROOM-32, stabilizatorem AMS1117-3.3, portem USB i 30 pinami GPIO.',
    descEn: 'Authentic ESP32 DevKit V1 with serpentine PCB antenna, ESP-WROOM-32 RF shield, AMS1117-3.3 LDO, USB port, and 30 GPIO pins.',
    category: 'mcu',
    difficulty: 2,
    load: async () => (await import('./presets')).createEsp32DevScenario(),
  },
  {
    id: 'preset-arduino-uno',
    titlePl: 'Arduino Uno R3 (ATmega328P / 5V & 3.3V)',
    titleEn: 'Arduino Uno R3 (ATmega328P / 5V & 3.3V)',
    descPl: 'Klasyczna płyta Arduino Uno R3 z procesorem ATmega328P w podstawce DIP-28, gniazdem DC 9V, USB Type-B i kompletem złączy.',
    descEn: 'Classic Arduino Uno R3 with socketed DIP-28 ATmega328P, 9V DC jack, USB Type-B, and full headers.',
    category: 'mcu',
    difficulty: 2,
    load: async () => (await import('./presets')).createArduinoUnoScenario(),
  },
  {
    id: 'preset-rpi-pico',
    titlePl: 'Raspberry Pi Pico (RP2040 & RT6150B Buck-Boost)',
    titleEn: 'Raspberry Pi Pico (RP2040 & RT6150B Buck-Boost)',
    descPl: 'Dwurdzeniowy układ RP2040 z przetwornicą buck-boost, pamięcią QSPI Flash, 40 padami krawędziowymi i portem microUSB.',
    descEn: 'Dual-core RP2040 MCU with RT6150B buck-boost converter, QSPI Flash, 40 castellated pads, and microUSB.',
    category: 'mcu',
    difficulty: 3,
    load: async () => (await import('./presets')).createRaspberryPiPicoScenario(),
  },
  {
    id: 'preset-rpi-zero',
    titlePl: 'Raspberry Pi Zero 2 W (RP3A0 SiP / Wi-Fi)',
    titleEn: 'Raspberry Pi Zero 2 W (RP3A0 SiP / Wi-Fi)',
    descPl: 'Minikomputer z 64-bitowym 4-rdzeniowym procesorem RP3A0-AU, mini-HDMI, dwoma portami microUSB i złączem kamery CSI.',
    descEn: 'Single-board computer with quad-core 64-bit RP3A0-AU SiP, mini-HDMI, dual microUSB, and CSI camera port.',
    category: 'mcu',
    difficulty: 3,
    load: async () => (await import('./presets')).createRaspberryPiZeroScenario(),
  },
  {
    id: 'preset-dcdc-buck',
    titlePl: 'Przetwornica DC-DC Step-Down TPS54302 (12V → 3.3V 3A)',
    titleEn: 'TPS54302 Synchronous Step-Down DC-DC (12V → 3.3V 3A)',
    descPl: 'Wysokowydajny konwerter impulsowy 400kHz z pętlą sprzężenia zwrotnego i kondensatorem bootstrap.',
    descEn: 'High efficiency 400kHz synchronous buck regulator with FB voltage divider and bootstrap cap.',
    category: 'power',
    difficulty: 3,
    load: async () => (await import('./presets')).createDcDcBuckScenario(),
  },
];
