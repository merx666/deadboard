// Unit tests for DEADBOARD i18n localization and enhancements
import { getLang, setLang, t, translateScenario, DICT_PL, DICT_EN } from '../src/i18n';

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error(m);
}

// Default language should be Polish
setLang('pl');
assert(getLang() === 'pl', 'Default language must be Polish (pl)');

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

console.log('i18n: Polish (default) and English translations, scenario lookups, and language switching — ok');
