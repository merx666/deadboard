import { MultimeterTool } from '../src/ui/tools/multimeter';
import { createEsp32DevScenario } from '../src/boards/presets';
import type { ToolContext } from '../src/ui/tools/tool';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

const scenario = createEsp32DevScenario();
const board = scenario.board;

let renders = 0;
let audioPlayed: string[] = [];
let toasts: string[] = [];

const ctx: ToolContext = {
  board,
  requestRender: () => { renders++; },
  playAudio: (s) => { audioPlayed.push(s); },
  showToast: (m) => { toasts.push(m); }
};

const dmm = new MultimeterTool();
assert(dmm.id === 'dmm', 'Tool id must be dmm');

dmm.activate(ctx);
assert(dmm.mode === 'VDC', 'Default DMM mode must be DC Volts');

dmm.setMode('OHMS');
assert((dmm.mode as string) === 'OHMS', 'DMM mode must update to Ohms');
assert(renders > 0, 'Mode change must request canvas render');

dmm.placeProbe('red', [14.25, 33.0], 'F');
assert(dmm.probeRed !== null, 'Red probe must be positioned');
assert(dmm.probeRed.pos[0] === 14.25, 'Probe X coordinate must match');

dmm.deactivate();
assert(dmm.probeRed === null && dmm.probeBlack === null, 'Deactivation must lift probes');

console.log('tools.test.ts: WorkbenchTool interface & MultimeterTool controller — ok');
