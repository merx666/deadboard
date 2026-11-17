// Unit tests for DEADBOARD component parts catalog and smart search engine
import {
  SUPPLIER_PARTS,
  findPartById,
  searchSupplierParts,
  stripDiacritics,
  normalizeSearchTerm
} from '../src/parts/catalog';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Running deadboard catalog & parts search tests...');

// 1. Basic catalog integrity & rich tags
assert(Array.isArray(SUPPLIER_PARTS), 'SUPPLIER_PARTS must be an array');
assert(SUPPLIER_PARTS.length >= 25, `Expected at least 25 supplier parts, got ${SUPPLIER_PARTS.length}`);

const idSet = new Set<string>();
for (const part of SUPPLIER_PARTS) {
  assert(part.id && part.id.length > 0, `Part missing valid id: ${JSON.stringify(part)}`);
  assert(!idSet.has(part.id), `Duplicate part id: ${part.id}`);
  idSet.add(part.id);

  assert(part.mpn && part.mpn.length > 0, `Part ${part.id} missing mpn`);
  assert(part.manufacturer && part.manufacturer.length > 0, `Part ${part.id} missing manufacturer`);
  assert(part.lcsc && part.lcsc.startsWith('C'), `Part ${part.id} missing valid LCSC code: ${part.lcsc}`);
  assert(part.pcbwayPart && part.pcbwayPart.length > 0, `Part ${part.id} missing pcbwayPart`);
  assert(part.namePl && part.namePl.length > 0, `Part ${part.id} missing Polish name`);
  assert(part.nameEn && part.nameEn.length > 0, `Part ${part.id} missing English name`);
  assert(part.pkg && part.pkg.length > 0, `Part ${part.id} missing package info`);
  assert(part.voltage && part.voltage.length > 0, `Part ${part.id} missing voltage rating`);
  assert(part.current && part.current.length > 0, `Part ${part.id} missing current rating`);
  assert(part.descPl && part.descPl.length > 0, `Part ${part.id} missing Polish description`);
  assert(part.descEn && part.descEn.length > 0, `Part ${part.id} missing English description`);
  assert(part.footprintWidth > 0 && part.footprintHeight > 0, `Part ${part.id} has invalid footprint dimensions`);
  assert(part.padsCount > 0, `Part ${part.id} must have at least 1 pad`);
  assert(Object.keys(part.pins).length > 0, `Part ${part.id} must define pins`);

  // Rich tags check (Requirement 2)
  assert(Array.isArray(part.tags) && part.tags.length >= 3, `Part ${part.id} must have rich tags (minimum 3)`);
}

// 2. Part retrieval via findPartById & presence of required maker & industrial parts (Requirement 4)
const requiredParts = [
  'esp32-c3-wroom-02',
  'stm32f103c8t6-bluepill',
  'atmega328p-arduino',
  'atmega328p-pu',
  'ch340c',
  'ch340g',
  'ne555p',
  'lm358p',
  'lm358dr',
  'tp4056',
  'usb-c-16p-tht-smd'
];

for (const pid of requiredParts) {
  const p = findPartById(pid);
  assert(p !== undefined, `Required part ${pid} not found in catalog`);
}

assert(findPartById('non-existent-part-id-xyz') === undefined, 'findPartById returns undefined for unknown id');

// 3. Multi-token AND search (Requirement 1 & 3)
{
  const espWifi = searchSupplierParts('esp32 wifi');
  assert(espWifi.length >= 2, `Expected at least 2 ESP32 Wi-Fi parts, got ${espWifi.length}`);
  assert(espWifi.every((p) => p.mpn.includes('ESP32')), 'All parts in "esp32 wifi" must be ESP32');
  assert(espWifi.every((p) => p.tags?.includes('wifi')), 'All parts in "esp32 wifi" must have wifi tag');

  const picoVoltage = searchSupplierParts('pico 3.3v');
  assert(picoVoltage.length >= 1 && picoVoltage[0].id === 'rp2040-pico', 'Search "pico 3.3v" resolves RP2040 Pico');

  const cap100n = searchSupplierParts('100n capacitor');
  assert(cap100n.length === 1 && cap100n[0].id === 'cap-mlcc-0805-100n', 'Search "100n capacitor" finds 100nF MLCC');

  const smdDiode = searchSupplierParts('smd diode');
  assert(smdDiode.length >= 1, 'Search "smd diode" finds diodes');
  assert(smdDiode.some((p) => p.id === 'ss34'), 'Search "smd diode" includes SS34 Schottky');

  const riscRiscv = searchSupplierParts('risc-v wifi');
  assert(riscRiscv.length >= 1 && riscRiscv[0].id === 'esp32-c3-wroom-02', 'Search "risc-v wifi" finds ESP32-C3');
}

// 4. Punctuation & Separator normalization (Requirement 1 & 3)
{
  const espPunct = searchSupplierParts('esp-32');
  assert(espPunct.length >= 3, 'Search "esp-32" resolves ESP32 parts despite hyphen');

  const rpPunct = searchSupplierParts('rp-2040');
  assert(rpPunct.length >= 1 && rpPunct[0].id === 'rp2040-pico', 'Search "rp-2040" resolves RP2040 despite hyphen');

  const amsPunct = searchSupplierParts('ams-1117');
  assert(amsPunct.length >= 2, 'Search "ams-1117" resolves AMS1117-3.3 and AMS1117-5.0 despite hyphen');

  const amsPlain = searchSupplierParts('ams1117');
  assert(amsPlain.length >= 2, 'Search "ams1117" resolves AMS1117 parts');

  const ch340Punct = searchSupplierParts('ch-340');
  assert(ch340Punct.length >= 2, 'Search "ch-340" finds CH340C and CH340G');

  const usbcHyphen = searchSupplierParts('usb-c');
  const usbcPlain = searchSupplierParts('usbc');
  assert(usbcHyphen.length >= 1, 'Search "usb-c" finds USB-C connector');
  assert(usbcPlain.length >= 1, 'Search "usbc" finds USB-C connector');
}

// 5. Polish synonyms and stem matching (Requirement 1 & 3)
{
  // "kondensator" & "pojemność"
  const capsPl = searchSupplierParts('kondensator');
  assert(capsPl.length >= 2, 'Search "kondensator" finds MLCC capacitors');
  assert(capsPl.some((p) => p.id === 'cap-mlcc-0805-100n'), 'Search "kondensator" includes 100n cap');
  assert(capsPl.some((p) => p.id === 'cap-mlcc-0805-10u'), 'Search "kondensator" includes 10u cap');

  const capsPlInflected = searchSupplierParts('kondensatory');
  assert(capsPlInflected.length >= 2, 'Search "kondensatory" (inflected) finds capacitors');

  const capsCapacity = searchSupplierParts('pojemność');
  assert(capsCapacity.length >= 2, 'Search "pojemność" finds capacitors');

  const capsCapacityAscii = searchSupplierParts('pojemnosc');
  assert(capsCapacityAscii.length >= 2, 'Search "pojemnosc" (without diacritics) finds capacitors');

  // "rezystor" & "opornik"
  const resPl = searchSupplierParts('rezystor');
  assert(resPl.length >= 1 && resPl.some((p) => p.id === 'res-smd-0805-10k'), 'Search "rezystor" finds 10k resistor');

  const resPlInflected = searchSupplierParts('rezystory');
  assert(resPlInflected.length >= 1, 'Search "rezystory" finds resistors');

  const resOpornik = searchSupplierParts('opornik');
  assert(resOpornik.length >= 1 && resOpornik.some((p) => p.id === 'res-smd-0805-10k'), 'Search "opornik" finds resistor');

  // "przetwornica" & "stabilizator"
  const przetwPl = searchSupplierParts('przetwornica');
  assert(przetwPl.length >= 3, 'Search "przetwornica" finds power converters/regulators');
  assert(przetwPl.some((p) => p.id === 'tps54302ddcr'), 'Search "przetwornica" includes TPS54302 buck');
  assert(przetwPl.some((p) => p.id === 'ams1117-33'), 'Search "przetwornica" includes AMS1117 LDO');

  const stabPl = searchSupplierParts('stabilizator');
  assert(stabPl.length >= 2, 'Search "stabilizator" finds LDO voltage regulators');

  // "tranzystor"
  const tranzPl = searchSupplierParts('tranzystor');
  assert(tranzPl.length >= 3, 'Search "tranzystor" finds MOSFETs');
  assert(tranzPl.some((p) => p.id === 'ao3400a'), 'Search "tranzystor" includes AO3400A');
  assert(tranzPl.some((p) => p.id === 'ao3401a'), 'Search "tranzystor" includes AO3401A');
  assert(tranzPl.some((p) => p.id === 'bss138'), 'Search "tranzystor" includes BSS138');

  // "dioda"
  const diodaPl = searchSupplierParts('dioda');
  assert(diodaPl.length >= 2, 'Search "dioda" finds diodes');

  // "mikrokontroler"
  const mcuPl = searchSupplierParts('mikrokontroler');
  assert(mcuPl.length >= 4, 'Search "mikrokontroler" finds MCUs');
  assert(mcuPl.some((p) => p.id === 'atmega328p-arduino'), 'Search "mikrokontroler" includes ATmega328P');
  assert(mcuPl.some((p) => p.id === 'stm32f103c8t6-bluepill'), 'Search "mikrokontroler" includes STM32');

  // "plytka" / "płytka"
  const plytkaPl = searchSupplierParts('plytka');
  const plytkaDiacr = searchSupplierParts('płytka');
  assert(plytkaPl.length >= 1, 'Search "plytka" finds boards');
  assert(plytkaDiacr.length >= 1, 'Search "płytka" finds boards');

  // "bezpiecznik"
  const bezpPl = searchSupplierParts('bezpiecznik');
  assert(bezpPl.length >= 1 && bezpPl[0].id === 'fuse-smd-1206-1a', 'Search "bezpiecznik" finds Littelfuse 1206');

  // "wzmacniacz"
  const wzmPl = searchSupplierParts('wzmacniacz');
  assert(wzmPl.length >= 2, 'Search "wzmacniacz" finds LM358 op-amps');

  // "czasowy" / "zegar"
  const czasPl = searchSupplierParts('czasowy');
  assert(czasPl.length >= 1 && czasPl.some((p) => p.id === 'ne555p'), 'Search "czasowy" finds NE555');

  // "ladowarka" / "ładowarka"
  const ladPl = searchSupplierParts('ladowarka');
  const ladDiacr = searchSupplierParts('ładowarka');
  assert(ladPl.length >= 1 && ladPl.some((p) => p.id === 'tp4056'), 'Search "ladowarka" finds TP4056');
  assert(ladDiacr.length >= 1 && ladDiacr.some((p) => p.id === 'tp4056'), 'Search "ładowarka" finds TP4056');

  // "zlacze" / "złącze" / "gniazdo"
  const zlaczePl = searchSupplierParts('zlacze');
  const gniazdoPl = searchSupplierParts('gniazdo');
  assert(zlaczePl.length >= 1 && zlaczePl.some((p) => p.id === 'usb-c-16p-tht-smd'), 'Search "zlacze" finds USB-C');
  assert(gniazdoPl.length >= 1 && gniazdoPl.some((p) => p.id === 'usb-c-16p-tht-smd'), 'Search "gniazdo" finds USB-C');
}

// 6. Specific package & footprint filters (Requirement 1 & 3)
{
  const sot223 = searchSupplierParts('sot-223');
  assert(sot223.length >= 2, 'Search "sot-223" finds AMS1117 parts');

  const sot223Plain = searchSupplierParts('sot223');
  assert(sot223Plain.length >= 2, 'Search "sot223" finds AMS1117 parts');

  const qfnParts = searchSupplierParts('qfn');
  assert(qfnParts.length >= 2, 'Search "qfn" finds QFN parts');

  const dipParts = searchSupplierParts('dip');
  assert(dipParts.length >= 3, 'Search "dip" finds DIP-packaged parts (Pico, ATmega328P-PU, NE555, LM358P)');
  assert(dipParts.some((p) => p.id === 'ne555p'), 'Search "dip" includes NE555P');
  assert(dipParts.some((p) => p.id === 'atmega328p-pu'), 'Search "dip" includes ATmega328P-PU');

  const size0805 = searchSupplierParts('0805');
  assert(size0805.length >= 3, 'Search "0805" finds 0805 passives');

  const size1206 = searchSupplierParts('1206');
  assert(size1206.length >= 1 && size1206[0].id === 'fuse-smd-1206-1a', 'Search "1206" finds 1206 fuse');

  const soic8 = searchSupplierParts('soic-8');
  assert(soic8.length >= 2, 'Search "soic-8" finds SOIC-8 ICs');

  const thtParts = searchSupplierParts('tht');
  assert(thtParts.length >= 3, 'Search "tht" finds through-hole parts');

  const smdParts = searchSupplierParts('smd');
  assert(smdParts.length >= 15, 'Search "smd" finds surface-mount parts');
}

// 7. Category and Tag filtering
{
  const modulesOnly = searchSupplierParts('', 'modules');
  assert(modulesOnly.every((p) => p.category === 'modules'), 'Category "modules" filters strictly');
  assert(modulesOnly.length >= 6, `Expected at least 6 modules, got ${modulesOnly.length}`);

  const powerOnly = searchSupplierParts('', 'power');
  assert(powerOnly.every((p) => p.category === 'power'), 'Category "power" filters strictly');

  const passivesOnly = searchSupplierParts('', 'passives');
  assert(passivesOnly.every((p) => p.category === 'passives'), 'Category "passives" filters strictly');

  const wifiTagged = searchSupplierParts('', undefined, 'wifi');
  assert(wifiTagged.length >= 3, 'Tag "wifi" filters to Wi-Fi devices');
  assert(wifiTagged.every((p) => p.tags?.includes('wifi')), 'All wifi-tagged parts have "wifi" in tags');

  // Combined query + category + tag
  const filtered = searchSupplierParts('3.3v', 'modules', 'wifi');
  assert(filtered.length >= 2, 'Combined search resolves 3.3V Wi-Fi modules');
  assert(filtered.every((p) => p.category === 'modules'), 'Filtered parts have category "modules"');
}

// 8. LCSC & Manufacturer code exact lookups
{
  assert(searchSupplierParts('C8734').some((p) => p.id === 'stm32f103c8t6-bluepill'), 'LCSC C8734 finds STM32F103');
  assert(searchSupplierParts('C14877').some((p) => p.id === 'atmega328p-arduino'), 'LCSC C14877 finds ATmega328P');
  assert(searchSupplierParts('C84683').some((p) => p.id === 'ch340g'), 'LCSC C84683 finds CH340G');
  assert(searchSupplierParts('C7593').some((p) => p.id === 'ne555p'), 'LCSC C7593 finds NE555P');
  assert(searchSupplierParts('C7442').some((p) => p.id === 'lm358p'), 'LCSC C7442 finds LM358P');
  assert(searchSupplierParts('C16581').some((p) => p.id === 'tp4056'), 'LCSC C16581 finds TP4056');
  assert(searchSupplierParts('C165948').some((p) => p.id === 'usb-c-16p-tht-smd'), 'LCSC C165948 finds USB-C receptacle');
  assert(searchSupplierParts('C15849').some((p) => p.id === 'ams1117-33'), 'LCSC C15849 finds AMS1117-3.3');
}

// 9. Utility functions
{
  assert(stripDiacritics('zażółć gęślą jaźń') === 'zazolc gesla jazn', 'stripDiacritics handles all Polish letters');
  assert(normalizeSearchTerm('  PŁYTKA-100  ') === 'plytka-100', 'normalizeSearchTerm strips spaces and diacritics');
}

// 10. Whitespace, casing, and unit conversions
{
  assert(searchSupplierParts('').length === SUPPLIER_PARTS.length, 'Empty search returns full catalog');
  assert(searchSupplierParts('   ').length === SUPPLIER_PARTS.length, 'Whitespace-only search returns full catalog');

  const mixedCase = searchSupplierParts('   EsP-32   wIfI   ');
  assert(mixedCase.length >= 2, 'Mixed-case search with extra whitespace resolves correctly');

  // Voltage conversions (3v3 <-> 3.3v, 5v <-> 5.0v)
  const v33 = searchSupplierParts('ams1117 3v3');
  assert(v33.length >= 1 && v33[0].id === 'ams1117-33', 'Notation "3v3" matches AMS1117-3.3');

  const v50 = searchSupplierParts('ams1117 5v');
  assert(v50.length >= 1 && v50[0].id === 'ams1117-50', 'Notation "5v" matches AMS1117-5.0');

  // Capacitance units (100n <-> 100nf, 10u <-> 10uf)
  const cap100nf = searchSupplierParts('100nf');
  assert(cap100nf.some((p) => p.id === 'cap-mlcc-0805-100n'), 'Notation "100nf" matches 100n cap');

  const cap10u = searchSupplierParts('10u');
  assert(cap10u.some((p) => p.id === 'cap-mlcc-0805-10u'), 'Notation "10u" matches 10u cap');

  const cap10uf = searchSupplierParts('10uf');
  assert(cap10uf.some((p) => p.id === 'cap-mlcc-0805-10u'), 'Notation "10uf" matches 10u cap');
}

// 11. Explicit verification of 8 required maker & industrial parts (Requirement 4)
{
  // 1. ESP32-C3-WROOM-02 (RISC-V Wi-Fi + BLE5)
  const c3 = findPartById('esp32-c3-wroom-02');
  assert(c3 && c3.mpn === 'ESP32-C3-WROOM-02', 'ESP32-C3-WROOM-02 present');
  assert(c3.tags?.includes('riscv') && c3.tags?.includes('ble5'), 'ESP32-C3 tags include riscv and ble5');

  // 2. STM32F103C8T6 "Blue Pill" ARM Cortex-M3 (LCSC C8734)
  const stm32 = findPartById('stm32f103c8t6-bluepill');
  assert(stm32 && stm32.lcsc === 'C8734', 'STM32F103C8T6 present with LCSC C8734');
  assert(searchSupplierParts('Blue Pill').some((p) => p.id === 'stm32f103c8t6-bluepill'), 'Found via "Blue Pill"');

  // 3. ATmega328P-PU & AU (Arduino Uno MCU, LCSC C14877)
  const atmegaAu = findPartById('atmega328p-arduino');
  const atmegaPu = findPartById('atmega328p-pu');
  assert(atmegaAu && atmegaAu.lcsc === 'C14877', 'ATmega328P-AU present');
  assert(atmegaPu && atmegaPu.pkg.includes('DIP-28'), 'ATmega328P-PU DIP-28 present');

  // 4. CH340C / CH340G USB to UART converter (LCSC C84683)
  const ch340c = findPartById('ch340c');
  const ch340g = findPartById('ch340g');
  assert(ch340c && ch340g && ch340g.lcsc === 'C84683', 'CH340C and CH340G present with LCSC C84683');

  // 5. NE555 Precision Timer (LCSC C7593)
  const ne555 = findPartById('ne555p');
  assert(ne555 && ne555.lcsc === 'C7593', 'NE555P present with LCSC C7593');
  assert(searchSupplierParts('timer 555').some((p) => p.id === 'ne555p'), 'Found via "timer 555"');

  // 6. LM358 Dual Op-Amp (LCSC C7442)
  const lm358p = findPartById('lm358p');
  assert(lm358p && lm358p.lcsc === 'C7442', 'LM358P present with LCSC C7442');
  assert(searchSupplierParts('op-amp').some((p) => p.id === 'lm358p'), 'Found via "op-amp"');

  // 7. TP4056 1A Li-Ion Battery Charger IC (LCSC C16581)
  const tp4056 = findPartById('tp4056');
  assert(tp4056 && tp4056.lcsc === 'C16581', 'TP4056 present with LCSC C16581');
  assert(searchSupplierParts('bateria li-ion').some((p) => p.id === 'tp4056'), 'Found via "bateria li-ion"');

  // 8. USB-C 16-pin Receptacle (TYPE-C-31-M-12, LCSC C165948)
  const usbc = findPartById('usb-c-16p-tht-smd');
  assert(usbc && usbc.mpn === 'TYPE-C-31-M-12' && usbc.lcsc === 'C165948', 'USB-C receptacle present with LCSC C165948');
  assert(searchSupplierParts('type-c receptacle').some((p) => p.id === 'usb-c-16p-tht-smd'), 'Found via "type-c receptacle"');
}

console.log(`ALL CATALOG TESTS PASSED (${SUPPLIER_PARTS.length} parts tested with multi-token, alias, stem, package, and category filtering)`);
