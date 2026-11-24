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

// Min/Max/Avg tracking & cycling
assert(dmm.minMaxMode === 'LIVE', 'Default Min/Max mode must be LIVE');
assert(dmm.cycleMinMax() === 'MIN', 'First cycle must be MIN');
assert(dmm.cycleMinMax() === 'MAX', 'Second cycle must be MAX');
assert(dmm.cycleMinMax() === 'AVG', 'Third cycle must be AVG');
assert(dmm.cycleMinMax() === 'LIVE', 'Fourth cycle must wrap to LIVE');
assert(dmm.cycleMode() === 'MIN', 'cycleMode alias should cycle to MIN');
assert(dmm.cycleMinMaxMode() === 'MAX', 'cycleMinMaxMode alias should cycle to MAX');
dmm.setMinMaxMode('LIVE');
assert(dmm.minMaxMode === 'LIVE', 'setMinMaxMode should set LIVE');

// Tracking with probes placed vs lifted
dmm.liftProbes();
dmm.recordValue(4.5);
assert(dmm.min === null && (dmm.count as number) === 0, 'Values should not track without probes placed');

dmm.placeProbe('red', [14.25, 33.0], 'F');
dmm.recordValue(3.3);
assert(dmm.min === 3.3 && (dmm.max as number | null) === 3.3 && dmm.avg === 3.3 && (dmm.count as number) === 1, 'Single sample min/max/avg must equal sample');

dmm.recordValue(5.0);
assert(dmm.min === 3.3 && (dmm.max as number | null) === 5.0 && Math.abs((dmm.avg ?? 0) - 4.15) < 1e-4 && (dmm.count as number) === 2, 'Two samples min/max/avg correct');

dmm.recordValue(1.2);
assert(dmm.min === 1.2 && (dmm.max as number | null) === 5.0 && Math.abs((dmm.avg ?? 0) - 3.16666) < 1e-3 && (dmm.count as number) === 3, 'Three samples min/max/avg correct');

assert(dmm.getDisplayedValue(2.0) === 2.0, 'In LIVE mode getDisplayedValue returns live value');
dmm.setMinMaxMode('MIN');
assert(dmm.getDisplayedValue(2.0) === 1.2, 'In MIN mode getDisplayedValue returns min');
dmm.setMinMaxMode('MAX');
assert(dmm.getDisplayedValue(2.0) === 5.0, 'In MAX mode getDisplayedValue returns max');
dmm.setMinMaxMode('AVG');
assert(Math.abs((dmm.getDisplayedValue(2.0) ?? 0) - 3.16666) < 1e-3, 'In AVG mode getDisplayedValue returns avg');

dmm.liftProbes();
assert(dmm.min === null && dmm.max === null && dmm.avg === null && dmm.count === 0, 'Lifting probes must reset min/max/avg tracking');

dmm.placeProbe('red', [14.25, 33.0], 'F');
dmm.recordValue(2.5);
dmm.setMinMaxMode('MAX');
dmm.deactivate();
assert(dmm.probeRed === null && dmm.probeBlack === null, 'Deactivation must lift probes');
assert(!dmm.hold && !dmm.rel, 'Deactivation must reset hold and rel');
assert(dmm.minMaxMode === 'LIVE', 'Deactivation must reset minMaxMode to LIVE');
assert(dmm.min === null && dmm.max === null && dmm.avg === null, 'Deactivation must reset min/max/avg');

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

// Mission panel testing
import { MissionPanelController } from '../src/ui/panels/missionPanel';
import { StudioPanelController } from '../src/ui/panels/studioPanel';

const missionPanel = new MissionPanelController({
  getActiveScenario: () => scenario,
  getLastVerify: () => null,
  getMoves: () => 3,
  getHintsShown: () => 1,
  getSolvedIds: () => new Set<string>(),
  getScenarios: () => [scenario],
  getRevealedFlag: () => null,
  isTutorialOpen: () => false,
  getSideBodyEl: () => mockEl,
  getModBoards: () => new Map(),
  getVideos: () => ({}),
  esc: (s) => s,
  txt: (s) => s,
  toast: () => {},
  runVerify: async () => {},
  startTutorial: () => {},
  openBoardCatalog: () => {},
  openScenario: async () => {},
  openSchematic: async () => {},
  playVideo: () => {},
  setHintsShown: () => {},
});
missionPanel.render();
assert(mockEl.innerHTML.includes('card-title'), 'MissionPanel should render card-title header');

// Studio panel testing
const studioPanel = new StudioPanelController({
  getActiveScenario: () => scenario,
  getBoard: () => board,
  isAuthorMode: () => true,
  getRefLockedHash: () => null,
  getStudioFlagInput: () => 'FLAG{test}',
  getBundledIds: () => new Set<string>(),
  getSideBodyEl: () => mockEl,
  getCamera: () => new Camera(),
  esc: (s) => s,
  toast: () => {},
  renderUI: () => {},
  refreshScenarioSelect: () => {},
  setStudioFlagInput: () => {},
  setRefLockedHash: () => {},
  setAuthorMode: () => {},
  setSelectedCompId: () => {},
  setActiveTab: () => {},
  exportBoardAsMod: () => {},
});
studioPanel.render();
assert(mockEl.innerHTML.includes('Scenario metadata'), 'StudioPanel should render scenario metadata card');

console.log('tools.test.ts: Scope, Thermal and Rework controllers, and UI Panels — ok');
