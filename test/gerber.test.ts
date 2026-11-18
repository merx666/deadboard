import { exportGerberLayers, createSimpleZip, exportGerberZip } from '../src/io/gerber';
import { createEsp32DevScenario } from '../src/boards/presets';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

const scenario = createEsp32DevScenario();
const board = scenario.board;

// 1. Verify layer generation
const layers = exportGerberLayers(board, 'ESP32_Test');
assert(layers.length >= 6, 'Must generate at least 6 standard manufacturing layers');

const filenames = layers.map(l => l.filename);
assert(filenames.some(f => f.endsWith('.gtl') || f.includes('F_Cu')), 'Must include Top Copper');
assert(filenames.some(f => f.endsWith('.gbl') || f.includes('B_Cu')), 'Must include Bottom Copper');
assert(filenames.some(f => f.endsWith('.gts') || f.includes('F_Mask')), 'Must include Top Solder Mask');
assert(filenames.some(f => f.endsWith('.gto') || f.includes('F_Silk')), 'Must include Top Silkscreen');
assert(filenames.some(f => f.endsWith('.gm1') || f.includes('Edge_Cuts')), 'Must include Edge Cuts');
assert(filenames.some(f => f.endsWith('.drl') || f.includes('Drill')), 'Must include Excellon Drill');

// 2. Verify Gerber RS-274X header format
const topCu = layers.find(l => l.filename.includes('F_Cu'))!;
assert(topCu.content.includes('%FSLAX44Y44*%'), 'Gerber must specify format specification 4.4');
assert(topCu.content.includes('%MOMM*%'), 'Gerber must specify metric millimetres');
assert(topCu.content.includes('M02*'), 'Gerber must end with M02* EOF');

// 3. Verify Excellon Drill file format
const drill = layers.find(l => l.filename.includes('Drill'))!;
assert(drill.content.includes('M48'), 'Drill file must start with header M48');
assert(drill.content.includes('METRIC'), 'Drill file must use metric units');
assert(drill.content.includes('M30'), 'Drill file must end with M30');

// 4. Verify ZIP creation
const directZip = createSimpleZip(layers);
assert(directZip.length > 100 && directZip[0] === 0x50, 'Direct createSimpleZip must produce valid zip');

const zipResult = exportGerberZip(board, 'ESP32_Test');
assert(zipResult.zipBuffer.length > 100, 'ZIP archive must be non-empty');
assert(zipResult.zipBuffer[0] === 0x50 && zipResult.zipBuffer[1] === 0x4B, 'ZIP magic bytes (PK) must be valid');

console.log('gerber.test.ts: RS-274X layers, Excellon drill & ZIP archive — ok');
