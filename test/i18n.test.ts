// Unit tests for DEADBOARD i18n localization and enhancements
import { getLang, setLang, t, translateScenario, DICT_PL, DICT_EN } from '../src/i18n';

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error(m);
}

// Default language should be Polish
setLang('pl');
assert(getLang() === 'pl', 'Default language must be Polish (pl)');
assert(t().nav.bench === 'Warsztat', 't() helper resolves nav.bench in Polish');

// Dictionary validation
const pl = DICT_PL;
const en = DICT_EN;

assert(pl.brand.name === 'DEADBOARD', 'Brand name must be DEADBOARD');
assert(pl.nav.bench === 'Warsztat', 'Polish nav bench translation');
assert(en.nav.bench === 'Bench', 'English nav bench translation');
assert(pl.nav.runTests === 'Uruchom testy', 'Polish run tests button');
assert(pl.tools.dmm.lbl === 'Multimetr cyfrowy', 'Polish DMM tool label');
assert(pl.tools.iron.lbl === 'Lutownica kolbowa', 'Polish Soldering Iron tool label');
assert(pl.tools.freeze.lbl === 'Zamrażacz w sprayu', 'Polish Freeze spray label');
assert(pl.tools.hotair.lbl === 'Gorące powietrze (Hot-Air)', 'Polish Hot air label');

// Scenario translation validation
const firstLightPl = translateScenario('builtin-first-light', 'First Light', 'A tiny flashlight...');
assert(firstLightPl.title === 'Pierwsze światło', 'First light Polish title');
assert(firstLightPl.description.includes('Minilatarka'), 'First light Polish description');

setLang('en');
assert(getLang() === 'en', 'Language switches to English');
const firstLightEn = translateScenario('builtin-first-light', 'First Light', 'A tiny flashlight...');
assert(firstLightEn.title === 'First Light', 'First light English title');

// Switch back to default Polish
setLang('pl');
assert(getLang() === 'pl', 'Switched back to Polish');

// Ensure all 14 tools have both PL and EN translations
const toolIds = ['inspect', 'dmm', 'iron', 'wick', 'flip180', 'jumper', 'knife', 'replace', 'freeze', 'ipa', 'hotair', 'rosin', 'scope', 'press'];
for (const id of toolIds) {
  assert(pl.tools[id], `Missing PL tool translation for ${id}`);
  assert(en.tools[id], `Missing EN tool translation for ${id}`);
  assert(pl.tools[id].lbl.length > 0, `Empty PL label for ${id}`);
  assert(pl.tools[id].tip.length > 0, `Empty PL tip for ${id}`);
}

// Tutorial translations validation
const { getTutorialSteps, getTutorialTopics, getBeginnerPrimerHtml } = await import('../src/ui/tutorial');
setLang('pl');
const tutPl = getTutorialSteps('builtin-first-light');
assert(tutPl && tutPl.length > 0, 'Tutorial steps in Polish must exist');
assert(tutPl[0].title === 'Anatomia płytki drukowanej (PCB)', `First tutorial step title in Polish: "${tutPl[0].title}"`);
assert(tutPl[0].concept.includes('Płytka PCB zastępuje luźne przewody'), 'Concept translated in Polish');
assert(getBeginnerPrimerHtml().includes('Podstawy diagnostyki PCB'), 'Beginner primer HTML in Polish');
assert(getTutorialTopics('builtin-first-light')?.[0] === 'Ścieżki i Pady', 'Topics in Polish');

setLang('en');
const tutEn = getTutorialSteps('builtin-first-light');
assert(tutEn && tutEn.length > 0, 'Tutorial steps in English must exist');
assert(tutEn[0].title === 'Anatomy of a PCB', `First tutorial step title in English: "${tutEn[0].title}"`);
assert(getBeginnerPrimerHtml().includes('PCB basics (start here)'), 'Beginner primer HTML in English');
assert(getTutorialTopics('builtin-first-light')?.[0] === 'Traces & Pads', 'Topics in English');
setLang('pl');

// Supplier parts catalog validation
const { SUPPLIER_PARTS, searchSupplierParts } = await import('../src/parts/catalog');
assert(SUPPLIER_PARTS.length >= 15, 'Supplier parts catalog must contain at least 15 components');
const espPart = searchSupplierParts('ESP32');
assert(espPart.length > 0 && espPart[0].lcsc.length > 0, 'ESP32 component found in catalog with LCSC code');
const picoPart = searchSupplierParts('RP2040');
assert(picoPart.length > 0, 'Raspberry Pi Pico (RP2040) found in catalog');
const arduinoPart = searchSupplierParts('ATmega328P');
assert(arduinoPart.length > 0, 'Arduino ATmega328P found in catalog');
const amsPart = searchSupplierParts('AMS1117');
assert(amsPart.length > 0 && amsPart[0].pkg === 'SOT-223', 'AMS1117 LDO found with SOT-223 package');

// Board presets validation
const { BOARD_PRESETS } = await import('../src/boards/presets');
assert(BOARD_PRESETS.length >= 4, 'Must have at least 4 board presets');
for (const preset of BOARD_PRESETS) {
  const sc = preset.create();
  assert(sc.board.components.length > 0, `Preset ${preset.id} must have components`);
  assert(sc.board.traces.length > 0, `Preset ${preset.id} must have copper traces`);
  assert(sc.objectives.length > 0, `Preset ${preset.id} must have objectives`);
  assert(sc.meta.title.length > 0, `Preset ${preset.id} must have title`);
}

// Custom board creation and scenario builder validation
const { buildCustomScenario, getFootprint } = await import('../src/ui/boardCreator');
const blankSc = buildCustomScenario({
  presetId: 'custom-blank',
  width: 90,
  height: 50,
  color: '#0b2b40',
  placedComponents: [
    { id: 'c1', partId: 'generic-header-5v', ref: 'J1', x: 10, y: 25, rotation: 0, value: 5.0, name: 'USB IN' },
    { id: 'c2', partId: 'res-smd-0805-10k', ref: 'R1', x: 25, y: 25, rotation: 0, value: 1000, name: 'Resistor' },
    { id: 'c3', partId: 'generic-led', ref: 'D1', x: 40, y: 25, rotation: 0, value: 0, name: 'LED' }
  ],
  fault: 'none',
});
assert(blankSc.board.w === 90 && blankSc.board.h === 50, 'Custom board dimensions match');
assert(blankSc.board.components.length === 3, 'All placed components exist on custom board');
assert(blankSc.board.traces.length > 0, 'Custom board copper traces routed');
assert(getFootprint('res-smd-0805-10k', { id: 'c2', partId: 'res-smd-0805-10k', ref: 'R1', x: 25, y: 25, rotation: 0, name: 'R1' }).padsCount === 2, 'Footprint pads count valid');

console.log('i18n: Polish (default) and English translations, scenario lookups, tutorials, supplier catalog, board presets, and board creator — ok');
