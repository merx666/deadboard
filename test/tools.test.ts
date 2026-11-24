import { createEsp32DevScenario } from '../src/boards/presets';
import { MultimeterTool } from '../src/ui/tools/multimeter';
import { OscilloscopeTool } from '../src/ui/tools/oscilloscope';
import { ReworkTool } from '../src/ui/tools/rework';
import { ThermalTool } from '../src/ui/tools/thermal';
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

assert(!dmm.hold, 'Hold must initially be false');
dmm.toggleHold();
assert(dmm.hold, 'Hold must be enabled after toggle');
dmm.toggleHold();
assert(!dmm.hold, 'Hold must be disabled after second toggle');

assert(!dmm.rel, 'Rel must initially be false');
dmm.toggleRel(0.25);
assert(dmm.rel && dmm.relOffset === 0.25, 'Rel must be enabled with given offset');
dmm.toggleRel();
assert(!dmm.rel && dmm.relOffset === null, 'Rel must clear on second toggle');

dmm.deactivate();
assert(dmm.probeRed === null && dmm.probeBlack === null, 'Deactivation must lift probes');
assert(!dmm.hold && !dmm.rel, 'Deactivation must reset hold and rel');

// Scope testing
const scope = new OscilloscopeTool();
assert(scope.id === 'scope', 'Scope id must be scope');
scope.activate(ctx);
assert(scope.running, 'Scope must be running by default');
scope.toggleRun();
assert(!scope.running, 'Scope must pause on toggleRun');
scope.toggleRun();
assert(scope.running, 'Scope must resume on second toggleRun');
scope.setTimebase(0.001); // 1ms
assert(scope.timebase === 0.001, 'Timebase must update');
scope.deactivate();

// Thermal testing
const thermal = new ThermalTool();
assert(thermal.id === 'thermal', 'Thermal tool id must be thermal');
thermal.activate(ctx);
thermal.setPalette('ironbow');
assert(thermal.palette === 'ironbow', 'Palette must update');
thermal.deactivate();

// Rework testing
const rework = new ReworkTool();
assert(rework.id === 'iron', 'Rework tool id must be iron');
rework.activate(ctx);
rework.setTemp(350);
assert(rework.tempC === 350, 'Iron temp must be 350C');
rework.deactivate();

import { buildConnectivity } from '../src/connectivity';
import type { FaultClass } from '../src/faults';
import { Camera } from '../src/render/camera';
// Inspect panel testing
import { InspectPanelController } from '../src/ui/panels/inspectPanel';

const mockEl = {
  innerHTML: '',
  querySelector: () => null,
  querySelectorAll: () => [],
} as unknown as HTMLElement;

let selectedCompId: string | null = null;
let compSearch = '';
let faultClass: FaultClass = 'cold-joint';

const inspectPanel = new InspectPanelController({
  getBoard: () => board,
  getConn: () => buildConnectivity(board),
  getSim: () => null,
  isPowerOn: () => false,
  getSelectedCompId: () => selectedCompId,
  getSelectedNet: () => -1,
  getCompSearch: () => compSearch,
  isAuthorMode: () => true,
  getFaultClass: () => faultClass,
  getSolver: () => 'fast',
  getCamera: () => new Camera(),
  getSideBodyEl: () => mockEl,
  esc: (s) => s,
  toast: () => {},
  pushUndo: () => {},
  recompute: () => {},
  renderUI: () => {},
  openPartsBin: () => {},
  environment: () => ({ partTemp: () => undefined, flexAt: () => 0 }),
  setSelectedCompId: (id) => { selectedCompId = id; },
  setCompSearch: (q) => { compSearch = q; },
  setFaultClass: (cls) => { faultClass = cls; },
});

inspectPanel.render();
assert(mockEl.innerHTML.includes('Components'), 'InspectPanel should render component list when no part selected');

const testComp = board.components[0];
const faultHtml = inspectPanel.faultCardHtml(testComp);
assert(faultHtml.includes('Fault injection'), 'Fault card HTML should contain fault injection header');
assert(faultHtml.includes('sab-class'), 'Fault card HTML should contain class selector');

console.log('tools.test.ts: Scope, Thermal and Rework controllers, and InspectPanel — ok');
