import { BOARD_PRESET_METAS, type BoardPresetMeta } from '../boards/presetsMeta';
import { BootController, type RequiredRail, requiredRails } from '../boot';
import { buildConnectivity, type Conn } from '../connectivity';
import { lockFlag, packText, topology, unpackText } from '../crypto';
import { type FaultClass, listFaults } from '../faults';
import { dist, transform4 } from '../geom';
import { getLang, t as i18n, setLang, translateScenario } from '../i18n';
import { FlexField, settleIntermittents, updateIntermittents } from '../intermittent';
import { serializeScenario } from '../io/format';
import { fmtOhm, fmtSI, marking, padWorld } from '../model';
import type { ModBoard } from '../mods/mods';
import { installMod, loadAllMods, type ModLoadResult } from '../mods/sources';
import { addBlob, addJumper, cutTrace, installPart, removeBlob, removeJumper, removePart, toggleCold } from '../ops';
import { netAt, type PickHit, pickAt } from '../pick';
import { BOTH_GAP, Camera } from '../render/camera';
import { type VizMode, WebGPURenderer } from '../render/webgpu';
import { cleanWithIpa, residueNear } from '../residue';
import { HOTAIR_H, IRON_G, PREHEAT_H, type ReworkEvent, ReworkMonitor } from '../rework';
import { Builder } from '../scenarios/builder';
import { builtinScenarios } from '../scenarios/builtin';
import { fmtHz, type ScopeSignal, sampleSignal, signalOn } from '../scope';
import { measureDiode, measureOhms, type Sim } from '../sim';
import { measureDiodeSpice, measureOhmsSpice } from '../spice/adapter';
import { boardToCircuit } from '../spice/board';
import { AMMETER_SHUNT, contactResistance, displayAmps, displayVolts, GENERIC_DMM, measureCapDmm, measureDiodeDmm, measureOhmsDmm, placementRng, type Reading } from '../spice/dmm';
import { writeSpice } from '../spice/netlist';
import { discoverPowerTree, type PowerTree, railVoltage } from '../spice/powertree';
import type { PowerStateName } from '../spice/sequencer';
import { apparentTemp, EMISSIVITY, ThermalModel } from '../thermal';
import type { Board, Component, Objective, Scenario, Side, V2 } from '../types';
import { runSolver, type Solver, type VerifyResult, verifyScenario } from '../verify';
import { setContinuityBeep, setSoundEnabled, sfxBeep, sfxBlow, sfxClick, sfxCut, sfxProbe, sfxRelay, sfxSolder, sfxWin, soundEnabled } from './audio';
import { type FeedbackContext, mountFeedbackForm } from './feedback';
import { icon } from './icons';
import { BRAND, markSvg } from './logo';
import { BoardsModalController } from './modals/boardsModal';
import { FeedbackModalController } from './modals/feedbackModal';
import { HelpModalController } from './modals/helpModal';
import { ModsModalController } from './modals/modsModal';
import { OrderModalController } from './modals/orderModal';
import { PartsBinModalController } from './modals/partsBinModal';
import { ReportModalController } from './modals/reportModal';
import { ShortcutsModalController } from './modals/shortcutsModal';
import { InspectPanelController } from './panels/inspectPanel';
import { splitLead, TOOL_SHORT, TOOL_TIP_PHONE, TouchGestures, touchCopy, wantsMobileLayout } from './touch';
import { getTutorialSteps, isTutorialScenario, nextTutorialScenarioId, TUTORIAL_SCENARIO_IDS, type TutorialStep } from './tutorial';

type ToolId = 'inspect' | 'dmm' | 'iron' | 'wick' | 'flip180' | 'jumper' | 'knife' | 'replace' | 'freeze' | 'ipa' | 'press' | 'hotair' | 'scope' | 'rosin';
type PanelTab = 'mission' | 'inspect' | 'studio';
type DmmMode = 'V' | 'OHM' | 'DIODE' | 'CAP' | 'AMP';

interface ProbePin {
  pos: V2;
  side: Side;
  net: number;
  label: string;
}

const TOOLS: { id: ToolId; key: string; ico: string; lbl: string; tip: string }[] = [
  { id: 'inspect', key: '1', ico: 'pointer', lbl: 'Select', tip: 'Select parts and nets, press switches' },
  { id: 'dmm', key: '2', ico: 'meter', lbl: 'Multimeter', tip: 'Left-click places red probe, right-click or Shift+click places black probe' },
  { id: 'iron', key: '3', ico: 'iron', lbl: 'Soldering iron', tip: 'Reflow joints, bridge gaps, solder parts' },
  { id: 'wick', key: '4', ico: 'eraser', lbl: 'Desolder wick', tip: 'Remove solder bridges, jumpers or parts' },
  { id: 'flip180', key: '5', ico: 'rotate', lbl: 'Rotate 180°', tip: 'Reverse part orientation' },
  { id: 'jumper', key: '6', ico: 'wire', lbl: 'Jumper wire', tip: 'Click start then end point; works across sides' },
  { id: 'knife', key: '7', ico: 'scissors', lbl: 'Trace cutter', tip: 'Cut a copper trace' },
  { id: 'replace', key: '8', ico: 'box', lbl: 'Parts bin', tip: 'Replace or change a component' },
  { id: 'freeze', key: '9', ico: 'snow', lbl: 'Freeze spray', tip: 'Frost an area: on a powered board the hot part defrosts first (Thermal view shows temperatures)' },
  { id: 'ipa', key: '0', ico: 'drop', lbl: 'Isopropyl', tip: 'Wet / scrub an area with IPA: evaporates first on the hottest part; dissolves liquid-damage residue' },
  { id: 'hotair', key: 'h', ico: 'wind', lbl: 'Hot air', tip: 'Realistic rework: 3 s of hot air (400 °C) over the spot; melt every joint of a part before lifting it with the wick' },
  { id: 'rosin', key: 'r', ico: 'rosin', lbl: 'Rosin', tip: 'Rosin method: coat an area white with rosin; on a powered board it melts clear first on the hottest part' },
  { id: 'scope', key: 'o', ico: 'scope', lbl: 'Oscilloscope', tip: 'Clip the scope probe (CH1) on a net: rail ramps and boot loops (Roll), switching nodes, ripple and clocks (Auto)' },
  { id: 'press', key: 'b', ico: 'hand', lbl: 'Press / flex', tip: 'Press on the board for 2.5 s: reveals cracked joints that open or close under flex' },
];

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function cloneBoard(b: Board): Board {
  return structuredClone(b);
}

function makeStarterBoard(): Scenario {
  const k = new Builder(60, 36);
  const bt = k.coin('BT1', 3, [15, 18]);
  const r1 = k.resistor('R1', 100, [36, 24]);
  const d1 = k.led('D1', 'green', [50, 18]);
  k.track('F', [k.pad(bt, '1'), [15, 24], k.pad(r1, '1')], 0.8, '+3V');
  k.track('F', [k.pad(r1, '2'), [50, 24], k.pad(d1, '2')], 0.8, 'LED_A');
  k.track('F', [k.pad(d1, '1'), [50, 8], [27, 8], k.pad(bt, '2')], 0.8, 'GND');
  k.text([34, 3.2], 'CUSTOM SANDBOX', 1.4);
  return {
    format: 'pcbfix/1',
    id: 'custom-' + Date.now().toString(36),
    meta: {
      title: 'Custom Sandbox Board',
      author: 'You',
      difficulty: 1,
      description: 'A clean, working board. In the Author tab: lock a flag, break the board, then export or share the challenge.',
      hints: [],
      par: 1,
    },
    board: k.b,
    objectives: [{ type: 'led', ref: 'D1', on: true }],
  };
}

function readInvertOrbitPref(): boolean {
  try {
    return localStorage.getItem('pcbfix_invert_orbit') === '1';
  } catch {
    return false;
  }
}

function readSolverPref(): Solver {
  try {
    const v = localStorage.getItem('pcbfix_solver');
    return v === 'spice' || v === 'spice-power' ? v : 'fast';
  } catch {
    return 'fast';
  }
}

export class PcbApp {
  private renderer!: WebGPURenderer;
  private camera = Object.assign(new Camera(), { invertOrbit: readInvertOrbitPref() });
  private canvas!: HTMLCanvasElement;

  private scenarios: Scenario[] = [];
  private activeScenario!: Scenario;
  private board!: Board;
  private conn!: Conn;
  private sim: Sim | null = null;

  private undoStack: Board[] = [];
  private redoStack: Board[] = [];
  private moves = 0;
  private solvedIds = new Set<string>(JSON.parse(localStorage.getItem('pcbfix_solved') ?? '[]'));

  private activeTool: ToolId = 'inspect';
  private activeTab: PanelTab = 'mission';
  private panelOpen = true;
  private powerOn = true;
  private ocpAmps = 0; // 0 = unlimited, 0.1 = 100mA, 0.5 = 500mA bench limit
  private solver: Solver = readSolverPref();
  /** Live thermal model of the current board (temperatures, frost, IPA film). */
  private thermal: ThermalModel | null = null;
  private thermalBoard: Board | null = null;
  /** PSU mode: normal board supply, or voltage injection onto the red probe's net. */
  private psuInject: { volts: number; amps: number } | null = null;
  private flex = new FlexField();
  /** Emulated power controller: steps the board through its power states (SPICE + PWR). */
  private boot = new BootController();
  /** Whether the current power-up follows the board's power states (else: plain supply). */
  private bootSequenced = false;
  private railCache: { conn: Conn; tree: PowerTree; byState: Map<PowerStateName, RequiredRail[]>; sequenced: boolean } | null = null;
  private psuClock = 0;
  private psuBoxEl!: HTMLElement;
  private scopeBoxEl!: HTMLElement;
  /** Oscilloscope CH1 probe, its roll-mode record (real simulated data) and display mode. */
  private scopeProbe: ProbePin | null = null;
  private scopeRoll: { t: number; v: number }[] = [];
  private scopeMode: 'auto' | 'roll' = 'auto';
  private scopePaused = false;
  private scopeSample = 0;
  /** Parts under a rosin coat (rosin method), checked for melting / smoke. */
  private rosinParts = new Set<Component>();
  private rework: ReworkMonitor | null = null;
  /** Rework: 'instant' (puzzle mode) or a physical process with iron temperature and flux. */
  private reworkMode: { realistic: boolean; ironTemp: number; flux: boolean } = { realistic: false, ironTemp: 350, flux: true };
  private preheatTemp = 0;
  private intermittentClock = 0;
  private vizMode: VizMode = 'realistic';
  private dmmMode: DmmMode = 'V';
  private dmmHold = false;
  private dmmHoldVal: { reading: string; sub: string } | null = null;
  private dmmRel = false;
  private dmmRelOffset: number | null = null;
  private currentDmmNumericVal: number | null = null;
  private diodeLitIds: string[] = [];
  private hintsShown = 0;

  private selectedNet = -1;
  private selectedCompId: string | null = null;
  private hovered: PickHit | null = null;
  private cursorWorld: V2 | null = null;
  private cursorSide: Side = 'F';

  private probeRed: ProbePin | null = null;
  private probeBlack: ProbePin | null = null;
  private jumperStart: { a: V2; la: Side } | null = null;

  private lastVerify: VerifyResult | null = null;
  private revealedFlag: string | null = null;
  private compSearch = '';
  private showHelp = false;
  private helpModal: HelpModalController | null = null;
  private showShortcuts = false;
  private shortcutsModal: ShortcutsModalController | null = null;
  private showReport = false;
  private reportModal: ReportModalController | null = null;
  private showFeedback = false;
  private feedbackModal: FeedbackModalController | null = null;
  private showBoards = false;
  private boardsModal: BoardsModalController | null = null;
  private showOrder = false;
  private orderModal: OrderModalController | null = null;
  private showMods = false;
  private modsModal: ModsModalController | null = null;
  private showPartsBin = false;
  private partsBinModal: PartsBinModalController | null = null;
  private inspectPanel: InspectPanelController | null = null;
  /** Ids of the boards that ship with LiveBoard (built-ins + demos): an author's copy needs its own id. */
  private bundledIds = new Set<string>();
  /** Mod boards in the list (stub before first open, full scenario after) → their mod. */
  private modBoards = new Map<Scenario, ModBoard>();
  private presetStubs = new Map<Scenario, BoardPresetMeta>();
  private openScenarioSeq = 0;
  private modResult: ModLoadResult = { mods: [], failed: [] };
  private schematicUrls = new Map<ModBoard, string>();
  private lastBeepKey = '';
  private tutorialOpen = localStorage.getItem('pcbfix_tut_dismissed') !== '1';
  private tutorialStep = 0;

  // Author Studio state
  private studioFlagInput = 'PCB{my_custom_pcb_ctf}';
  private authorMode = false;
  /** Fault class last chosen in the inspector's injection card. */
  private faultClass: FaultClass = 'cold-joint';
  private refLockedHash = '';

  // Pointer drag state
  private dragMode: 'none' | 'pan' | 'orbit' = 'none';
  private dragMoved = false;
  private lastPx = 0;
  private lastPy = 0;
  private downPx = 0;
  private downPy = 0;
  private spaceHeld = false;

  // Floating window & sidepanel drag state
  private tutPos: V2 = [0, 0];
  private dmmPos: V2 = [0, 0];
  private modalPos: V2 = [0, 0];
  private sidepanelW = 340;
  private suppressModalBgClose = false;
  private winDrag: {
    target: 'tut' | 'dmm' | 'modal' | 'sidepanel';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null = null;

  // Touch / mobile (src/ui/touch.ts). The desktop layout is untouched unless `mobile`.
  /** Touch-only device: phone layout (tool strip, bottom sheets, stacked instruments) and touch wording. */
  private mobile = wantsMobileLayout();
  /** Touch gestures on the board (any layout): tap = tool, one finger pans (orbits in 3D), pinch zooms. */
  private gestures = new TouchGestures({
    tap: (x, y) => this.touchTap(x, y),
    pan: (dx, dy) => this.camera.panScreen(dx, dy, Math.max(1, this.canvas.clientHeight)),
    orbit: (dx, dy) => this.orbitBy(dx, dy),
    zoom: (f, x, y) => {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.camera.zoomAt(f, (x - r.left) * dpr, (y - r.top) * dpr, Math.max(1, r.width * dpr), Math.max(1, r.height * dpr), this.board.thickness);
    },
  }, () => (this.camera.mode === '3d' ? 'orbit' : 'pan'));
  /** Probe a touch tap places (no right-click on touch); auto = chosen by the meter, not the player. */
  private activeProbe: 'red' | 'black' = 'red';
  private activeProbeAuto = false;
  private tutCollapsed = false;
  private dmmSubFull = false;
  /** Panel notes (callouts) the player opened on the phone, by heading; they start folded. */
  private openNotes = new Set<string>();
  /** Tutorial step (scenario:index) whose explanation is open on the phone card. */
  private tutWhy = '';
  /** Canvas aspect the board was last fitted to (mobile: refit on first layout and on rotation). */
  private fitAspect = 0;
  private psuExpanded = false;
  private toolTipsShown = new Set<ToolId>();

  private lastFrameMs = performance.now();
  private rafId = 0;

  // DOM refs
  private layoutEl!: HTMLElement;
  private sideBodyEl!: HTMLElement;
  private dmmBoxEl!: HTMLElement;
  private tutBoxEl!: HTMLElement;
  private hudTopEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private modalRootEl!: HTMLElement;
  private dropOverlayEl!: HTMLElement;
  private fileInputEl!: HTMLInputElement;

  constructor(private mount: HTMLElement) {}

  async init() {
    this.scenarios = await builtinScenarios();
    await this.addDemoStubs();
    this.addPresetStubs();
    this.bundledIds = new Set(this.scenarios.map((s) => s.id));
    await this.loadMods();
    this.buildDom();

    try {
      this.renderer = await WebGPURenderer.create(this.canvas);
    } catch (err) {
      this.showWebGpuError(err instanceof Error ? err.message : String(err));
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.has('tutorial')) {
      localStorage.removeItem('pcbfix_tut_dismissed');
      this.tutorialOpen = true;
    }
    if (params.has('boards')) {
      this.showBoards = true;
    }
    if (params.has('feedback')) this.showFeedback = true;

    // Load from URL hash if present (#s=...)
    const loadedHash = await this.tryLoadFromHash();
    if (!loadedHash) {
      this.loadScenario(this.scenarios[0]);
    }

    this.bindEvents();
    if (this.showBoards || this.showFeedback) this.renderModal();
    void this.loadVideoIndex();
    if (params.has('automation')) this.exposeAutomation();

    if (params.get('action') === 'new-board' || params.has('new-board') || params.has('creator') || params.get('action') === 'order') {
      setTimeout(() => void this.openBoardCreator(), 50);
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  private async tryLoadFromHash(): Promise<boolean> {
    const h = window.location.hash;
    if (!h.startsWith('#s=')) return false;
    try {
      const json = await unpackText(h.slice(3));
      const { importScenarioOrPcb } = await import('../io/kicad');
      const sc = importScenarioOrPcb('shared.pcbfix.json', json);
      this.scenarios.push(sc);
      this.refreshScenarioSelect();
      this.loadScenario(sc);
      this.toast(`Loaded shared puzzle: ${sc.meta.title}`, 'success');
      return true;
    } catch (e) {
      this.toast(`Failed to decode shared URL: ${e instanceof Error ? e.message : String(e)}`, 'danger');
      return false;
    }
  }

  /** What the visitor can do about it, tuned to their browser (most reports come from Firefox). */
  private webGpuHelp(): string {
    const ua = navigator.userAgent;
    const ff = /Firefox\/(\d+)/.exec(ua);
    const general = 'LiveBoard renders the bench with WebGPU: use Chrome or Edge 113+, Safari 26+, or Firefox 141+ (Windows) / 145+ (Mac with Apple silicon).';
    // desktop build: the browser is built in, so only the GPU driver can be the problem
    if (/Electron\//.test(ua)) {
      if (/Linux/.test(ua)) return 'The desktop app renders with WebGPU on Vulkan. Install or update the Vulkan driver for your graphics card (vulkaninfo should list it), then restart LiveBoard.';
      return 'The desktop app renders with WebGPU, which needs a graphics card and driver that support DirectX 12 (Windows) or Metal (macOS). Update the graphics driver and restart LiveBoard.';
    }
    // phones and tablets
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      return 'On iPhone and iPad, WebGPU needs iOS / iPadOS 26 or later (Safari, and every other browser there). Update in Settings → General → Software Update. On iOS 18 it can be switched on in Settings → Apps → Safari → Advanced → Feature Flags → WebGPU.';
    }
    if (/Android/.test(ua)) {
      return ff
        ? 'Firefox for Android has no WebGPU yet: open LiveBoard in Chrome instead.'
        : 'On Android, WebGPU needs Chrome 121 or later on Android 12+ with a supported GPU (most Qualcomm Adreno and ARM Mali phones). Update Chrome from the Play Store and try again.';
    }
    // Chromium on Linux still enables WebGPU only for some GPU / driver combinations
    if (!ff && /Linux/.test(ua) && !/Android|CrOS/.test(ua)) {
      return 'On Linux, Chrome and Edge turn WebGPU on only for some graphics drivers. Open chrome://flags, enable "Unsafe WebGPU Support" and "Vulkan", and restart the browser; or use Firefox with dom.webgpu.enabled set to true in about:config. Make sure your Vulkan driver is installed (vulkaninfo should list your GPU).';
    }
    if (!ff) return general;
    const ver = Number(ff[1]);
    if (!('gpu' in navigator)) {
      if (/Windows/.test(ua) && ver < 141) return `Firefox ${ver} has no WebGPU yet: update Firefox (141+ enables it on Windows), or use Chrome / Edge.`;
      if (/Mac OS X/.test(ua) && ver < 145) return `Firefox ${ver} has no WebGPU yet on macOS: update Firefox (145+ enables it on Apple-silicon Macs), or use Chrome / Safari.`;
      return `Firefox ${ver} ships WebGPU switched off on this system (Linux and Intel Macs, for now). Use Chrome, or turn it on: open about:config, set dom.webgpu.enabled to true, and reload.`;
    }
    return 'Firefox has WebGPU, but did not offer it for this graphics card or driver. Update the graphics driver and make sure hardware acceleration is on (Settings → Performance), or use Chrome. about:support → WebGPU shows the reason.';
  }

  private showWebGpuError(msg: string) {
    this.mount.innerHTML = `
      <div class="webgpu-err">
        <div class="card">
          <div class="card-title lg">WebGPU is not available</div>
          <p class="text-2" style="margin:0">${this.esc(msg)}</p>
          <p class="muted" style="margin:0">${this.webGpuHelp()}</p>
        </div>
        <div class="card">
          <div class="card-title">Still stuck? Tell us</div>
          <div id="fb-host"></div>
        </div>
      </div>`;
    const host = this.mount.querySelector<HTMLElement>('#fb-host');
    if (host) mountFeedbackForm(host, () => ({ error: msg }), { kind: 'bug' });
  }

  private openFeedback(open = true) {
    this.showFeedback = open;
    if (open) { this.showHelp = false; this.showBoards = false; this.showMods = false; }
    this.modalPos = [0, 0];
    this.renderModal();
  }

  /** What a bug report needs to know about the current bench (no personal data). */
  private feedbackContext(): FeedbackContext {
    const sc = this.activeScenario;
    const cam = this.camera;
    return {
      board: sc ? `${sc.meta.title} (${sc.id})` : undefined,
      view: `${cam.mode.toUpperCase()}, ${cam.bothSides ? 'both sides' : cam.side === 'F' ? 'top' : 'bottom'}, ${this.vizMode}${this.powerOn ? ', power on' : ''}`,
      solver: this.solver,
      gpu: this.renderer?.adapterDescription,
    };
  }

  private getFeedbackModal(): FeedbackModalController {
    if (!this.feedbackModal) {
      this.feedbackModal = new FeedbackModalController({
        getModalPos: () => this.modalPos,
        modalRootEl: this.modalRootEl,
        getFeedbackContext: () => this.feedbackContext(),
        onClose: () => this.openFeedback(false),
        isSuppressModalBgClose: () => this.suppressModalBgClose,
        resetSuppressModalBgClose: () => { this.suppressModalBgClose = false; },
      });
    }
    return this.feedbackModal;
  }

  private buildDom() {
    const m = this.mobile;
    if (m) {
      document.body.classList.add('is-mobile');
      this.panelOpen = false;
      // installable to the home screen (full screen, no browser bars); desktop browsers get no install prompt
      if (!document.querySelector('link[rel="manifest"]')) {
        const l = document.createElement('link');
        l.rel = 'manifest';
        l.href = './app.webmanifest';
        document.head.append(l);
      }
    }
    this.mount.innerHTML = `
      <div class="layout${m ? ' mobile panel-collapsed' : ''}" id="layout">
        <header class="topbar">
          <div class="topbar-group">
            <a class="brand" href="./" title="${BRAND.name} — home">${markSvg(22)}</a>
            <span class="brand-name" title="${BRAND.descriptor}">${BRAND.name}</span>
            <span class="topbar-divider"></span>

            <!-- Primary PCB Creation / Studio Actions -->
            <button class="btn primary pcb-create-btn" id="btn-creator-main" title="${getLang() === 'pl' ? 'Nowy projekt PCB w edytorze CAD (K)' : 'Create custom PCB from scratch in CAD creator (K)'}">
              ${icon('plus', 14)}
              <span>${getLang() === 'pl' ? 'Nowy Projekt PCB' : 'New PCB Project'}</span>
            </button>
            <button class="btn ghost pcb-cad-btn" id="btn-creator-open" title="${getLang() === 'pl' ? 'Kreator Płytek CAD & Baza Komponentów (K)' : 'CAD Board Creator & Component Catalog (K)'}">
              ${icon('grid', 14)}
              <span>${getLang() === 'pl' ? 'Kreator CAD' : 'PCB Creator'}</span>
            </button>

            <!-- Order PCB Prototype / Fabrication -->
            <button class="btn success order-pcb-btn" id="btn-order-pcb" title="${getLang() === 'pl' ? 'Zamów fabrykację płytki PCB i montaż SMT' : 'Order PCB Fabrication & SMT Assembly'}" style="background: linear-gradient(135deg, #ff6b00 0%, #ff8800 100%); color: #fff; border: none; font-weight: 600; box-shadow: 0 2px 6px rgba(255,107,0,0.3);">
              ${icon('cart', 14)}
              <span>${getLang() === 'pl' ? 'Zamów Produkcję PCB' : 'Order PCB Prototype'}</span>
            </button>

            <span class="topbar-divider"></span>

            <!-- Secondary: Challenge Lab & Project Selector -->
            <button class="board-picker-btn" id="btn-boards" title="${getLang() === 'pl' ? 'Laboratorium wyzwań i baza projektów' : 'Challenge lab & project library'}">
              ${icon('box', 14)}
              <span class="bp-badge" id="bp-badge"></span>
              <span class="bp-title" id="bp-title"></span>
              <span class="bp-check" id="bp-check" hidden>${icon('check', 12)}</span>
              ${icon('chevronDown', 13)}
            </button>
            <select id="sc-select" title="Scenario" hidden></select>
            <button class="btn ghost icon" id="btn-new-board" title="${getLang() === 'pl' ? 'Nowy czysty laminat' : 'New blank board'}">${icon('plus')}</button>
            <button class="btn ghost icon" id="btn-import" title="${getLang() === 'pl' ? 'Importuj projekt (.kicad_pcb, .brd, .pcbfix.json, .zip)' : 'Import project (.kicad_pcb, .brd, .pcbfix.json, or .zip)'}">${icon('upload')}</button>
            <input type="file" id="file-input" accept=".brd,.json,.pcbfix.json,.kicad_pcb,.zip" hidden />
          </div>
          <div class="topbar-group">
            <div class="seg" id="seg-view" title="Camera (Tab)">
              <button data-view="2d">2D</button>
              <button data-view="3d">3D</button>
            </div>
            <button class="btn ghost icon" id="btn-invert-orbit">${icon('rotate')}</button>
            <div class="seg" id="seg-side" title="Board side (F)">
              <button data-side="F">Top</button>
              <button data-side="both">Both</button>
              <button data-side="B">Bottom</button>
            </div>
            <button class="btn ghost icon" id="btn-fit" title="Fit to view (C)">${icon('fit')}</button>
            <span class="topbar-divider"></span>
            <select id="viz-select" title="Display mode">
              <option value="realistic">Realistic</option>
              <option value="heatmap">Voltage map</option>
              <option value="thermal">Thermal</option>
              <option value="xray">X-ray</option>
            </select>
            <div class="bench-wrap">
              <button class="btn ghost" id="btn-bench" title="Bench setup: solver, supply, rework">${icon('meter', 14)}<span>Bench</span></button>
              <div class="bench-pop" id="bench-pop" hidden>
            <label class="bench-row"><span>Rework</span><select id="rework-mode" title="Rework: instant (puzzle) or physical process">
              <option value="instant">Rework: instant</option>
              <option value="r350f">Iron 350 °C + flux</option>
              <option value="r350">Iron 350 °C, dry</option>
              <option value="r400f">Iron 400 °C + flux</option>
            </select></label>
            <label class="bench-row"><span>Preheater</span><select id="preheat" title="Bottom preheater">
              <option value="0">No preheat</option>
              <option value="120">Preheat 120°</option>
              <option value="150">Preheat 150°</option>
            </select></label>
            <label class="bench-row"><span>Supply</span><select id="psu-mode" title="Bench supply: board supply, or voltage injection onto the red probe's net (board supply removed)">
              <option value="board">Board PSU</option>
              <option value="inject1">Inject 1 V·3 A</option>
              <option value="inject3">Inject 3.3 V·1 A</option>
            </select></label>
            <label class="bench-row"><span>Current limit</span><select id="ocp-select" title="Bench supply current limit (OCP)">
              <option value="0">No limit</option>
              <option value="0.1">100 mA</option>
              <option value="0.5">500 mA</option>
            </select></label>
            <label class="bench-row"><span>Solver</span><select id="solver-select" title="Circuit solver: fast piecewise-linear DC · SPICE (real device physics, realistic meter) · SPICE + PWR (adds the board's regulators from its power tree)">
              <option value="fast">Fast DC</option>
              <option value="spice">SPICE</option>
              <option value="spice-power">SPICE + PWR</option>
            </select></label>
            <button class="btn sm" id="btn-spice-export" title="Export SPICE netlist (.cir, ngspice compatible)">${icon('download', 13)}<span>Export SPICE netlist (.cir)</span></button>
              </div>
            </div>
            <button class="power" id="btn-power" title="Bench supply (P)"><span class="dot"></span>${m ? icon('power', 15) : ''}<span class="lbl">Power</span></button>
            <span class="topbar-divider"></span>
            <button class="btn ghost" id="btn-verify" title="Run test bench">${icon('play', 14)}<span>${getLang() === 'pl' ? 'Testy Symulacji' : 'Run Tests'}</span></button>
            <button class="btn ghost" id="btn-tutorial" title="Interactive beginner tutorial">${icon('book', 14)}<span>${getLang() === 'pl' ? 'Samouczek' : 'Tutorial'}</span></button>
            <button class="btn ghost lang-btn" id="btn-lang" title="${getLang() === 'pl' ? 'Zmień język na angielski (L)' : 'Switch language to Polish (L)'}">
              <span id="lang-btn-text">${getLang() === 'pl' ? '🇵🇱 PL' : '🇬🇧 EN'}</span>
            </button>
            <button class="btn ghost icon" id="btn-creator" title="${getLang() === 'pl' ? 'Kreator płytek i baza części PCBWay/LCSC (K)' : 'Board creator & parts catalog (K)'}">${icon('grid')}</button>
            <button class="btn ghost icon" id="btn-report" title="${getLang() === 'pl' ? 'Raport techniczny i protokół' : 'Engineering report'}">${icon('report')}</button>
            <button class="btn ghost icon" id="btn-shortcuts" title="${getLang() === 'pl' ? 'Skróty klawiszowe (?)' : 'Keyboard shortcuts (?'}">${icon('keyboard')}</button>
            <button class="btn ghost icon" id="btn-sound" title="Sound"></button>
            <button class="btn ghost icon" id="btn-feedback" title="Report a bug or suggest an idea">${icon('message')}</button>
            <button class="btn ghost icon" id="btn-help" title="Help">${icon('help')}</button>
            <button class="btn ghost icon" id="btn-panel-toggle" title="${m ? 'Mission, inspector and author' : 'Toggle panel'}">${icon(m ? 'flag' : 'sidebar')}</button>
            ${m ? `<button class="btn ghost icon" id="btn-more" title="View, bench and settings">${icon('more', 18)}</button>` : ''}
          </div>
        </header>

        ${m ? this.mobileDockHtml() : `<aside class="tooldock" id="tooldock">
          ${TOOLS.map((t) => {
            const tr = i18n().tools[t.id];
            const lbl = tr?.lbl ?? t.lbl;
            const tip = tr?.tip ?? t.tip;
            return `
            <button class="tool-btn ${t.id === this.activeTool ? 'active' : ''}" data-tool="${t.id}" data-tip="${this.esc(lbl)} · ${t.key}" aria-label="${this.esc(tip)}">
              ${icon(t.ico, 18)}
              <span class="key">${t.key}</span>
            </button>
          `;}).join('')}
          <div class="dock-spacer"></div>
          <div class="dock-sep"></div>
          <button class="tool-btn" id="btn-undo" data-tip="${this.esc(i18n().dock.undo)}">${icon('undo', 18)}</button>
          <button class="tool-btn" id="btn-redo" data-tip="${this.esc(i18n().dock.redo)}">${icon('redo', 18)}</button>
          <button class="tool-btn" id="btn-reset" data-tip="${this.esc(i18n().dock.reset)}">${icon('reset', 18)}</button>
        </aside>`}

        <main class="viewport" id="viewport">
          <canvas id="gpu-canvas"></canvas>
          <div class="hud-top-left"><div id="tut-box"></div></div>
          ${m ? `
          <div class="m-viewctl">
            <button class="m-vbtn" id="m-fit" title="Fit board">${icon('fit', 18)}</button>
            <button class="m-vbtn" id="m-mode" title="2D / 3D"></button>
            <button class="m-vbtn" id="m-flip" title="Top / Bottom side"></button>
          </div>
          <div class="m-hud"><div id="scope-box"></div><div id="psu-box"></div><div id="dmm-box"></div></div>` : `
          <div class="hud-bottom-left"><div id="dmm-box"></div></div>
          <div class="hud-bottom-right"><div id="scope-box"></div><div id="psu-box"></div></div>`}
          <div class="toast-stack" id="toasts"></div>
        </main>

        <aside class="sidepanel" id="sidepanel">
          <div class="sidepanel-resizer" id="sidepanel-resizer" title="Drag to resize panel"></div>
          <div class="tabs">
            <button class="tab active" data-tab="mission">${getLang() === 'pl' ? 'Laboratorium & Wyzwania' : 'Lab & Challenges'}</button>
            <button class="tab" data-tab="inspect">${getLang() === 'pl' ? 'Inspektor Elementu' : 'Inspector'}</button>
            <button class="tab" data-tab="studio">${getLang() === 'pl' ? 'Twórca Płytek CAD' : 'PCB Designer'}</button>
            ${m ? `<button class="btn ghost icon m-sheet-close" id="m-panel-close" title="Close">${icon('x', 16)}</button>` : ''}
          </div>
          <div class="panel-body" id="side-body"></div>
        </aside>

        <footer class="statusbar">
          <div class="sb-left" id="hud-top"></div>
          <div class="sb-right">
            <span class="sb-item"><span class="kbd">LMB</span>${getLang() === 'pl' ? 'Narzędzie / Przesuń' : 'Tool / Drag Pan'}</span>
            <span class="sb-item"><span class="kbd">RMB</span>${getLang() === 'pl' ? 'Obrót' : 'Orbit'}</span>
            <span class="sb-item"><span class="kbd">MMB</span>${getLang() === 'pl' ? 'Przesuń' : 'Pan'}</span>
            <span class="sb-item"><span class="kbd">F</span>${getLang() === 'pl' ? 'Druga strona' : 'Flip'}</span>
            <span class="sb-item"><span class="kbd">Tab</span>2D/3D</span>
            <span class="sb-item"><span class="kbd">L</span>${getLang() === 'pl' ? 'Język (PL)' : 'Language (EN)'}</span>
            <span class="sb-item"><span class="kbd">?</span>${getLang() === 'pl' ? 'Skróty' : 'Shortcuts'}</span>
          </div>
        </footer>
      </div>
      <div id="modal-root"></div>
      ${m ? this.mobileMoreHtml() + this.rotateHintHtml() : ''}
      <div class="drop-overlay" id="drop-overlay" style="display:none">${getLang() === 'pl' ? 'Upuść plik .brd, .kicad_pcb, .pcbfix.json lub mod .zip, aby zaimportować' : 'Drop a .brd, .kicad_pcb, .pcbfix.json, or mod .zip to import'}</div>
    `;

    this.layoutEl = this.mount.querySelector('#layout')!;
    this.canvas = this.mount.querySelector('#gpu-canvas')!;
    this.sideBodyEl = this.mount.querySelector('#side-body')!;
    this.dmmBoxEl = this.mount.querySelector('#dmm-box')!;
    this.psuBoxEl = this.mount.querySelector('#psu-box')!;
    this.scopeBoxEl = this.mount.querySelector('#scope-box')!;
    this.tutBoxEl = this.mount.querySelector('#tut-box')!;
    this.hudTopEl = this.mount.querySelector('#hud-top')!;
    this.toastEl = this.mount.querySelector('#toasts')!;
    this.modalRootEl = this.mount.querySelector('#modal-root')!;
    this.dropOverlayEl = this.mount.querySelector('#drop-overlay')!;
    this.fileInputEl = this.mount.querySelector('#file-input')!;
    if (m) this.fillMobileMore();
    this.refreshScenarioSelect();
  }

  /** Mobile tool strip: scrolling tools with labels, undo / redo pinned at the end (reset is in More). */
  private mobileDockHtml(): string {
    return `
        <aside class="tooldock" id="tooldock">
          <div class="tool-scroll">
            ${TOOLS.map((t) => {
              const tr = i18n().tools[t.id];
              const short = tr?.short ?? TOOL_SHORT[t.id] ?? t.lbl;
              const lbl = tr?.lbl ?? t.lbl;
              return `
              <button class="tool-btn ${t.id === this.activeTool ? 'active' : ''}" data-tool="${t.id}" aria-label="${this.esc(lbl)}">
                ${icon(t.ico, 20)}
                <span class="tool-lbl">${this.esc(short)}</span>
              </button>
            `;}).join('')}
          </div>
          <div class="tool-pinned">
            <button class="tool-btn" id="btn-undo" aria-label="${this.esc(i18n().dock.undo)}">${icon('undo', 20)}<span class="tool-lbl">${getLang() === 'pl' ? 'Cofnij' : 'Undo'}</span></button>
            <button class="tool-btn" id="btn-redo" aria-label="${this.esc(i18n().dock.redo)}">${icon('redo', 20)}<span class="tool-lbl">${getLang() === 'pl' ? 'Ponów' : 'Redo'}</span></button>
          </div>
        </aside>`;
  }

  /** Mobile "More" sheet: view, display and bench controls that live in the desktop top bar. */
  private mobileMoreHtml(): string {
    const row = (id: string, ico: string, label: string) => `<button class="m-row" data-proxy="${id}">${icon(ico, 16)}<span>${label}</span></button>`;
    return `
      <div class="m-more-bg" id="m-more" hidden>
        <div class="m-more" role="dialog" aria-label="View, bench and settings">
          <div class="m-more-head"><span>View &amp; bench</span><button class="btn ghost icon" id="m-more-close" title="Close">${icon('x', 16)}</button></div>
          <div class="m-more-body">
            <div class="m-sec"><div class="m-sec-t">View</div><div class="m-ctl" id="m-slot-view"></div><div class="m-ctl" id="m-slot-side"></div>
              <button class="m-row" data-proxy="#btn-invert-orbit">${icon('rotate', 16)}<span id="m-invert-lbl"></span></button></div>
            <div class="m-sec"><div class="m-sec-t">Display</div><div class="m-ctl" id="m-slot-viz"></div></div>
            <div class="m-sec"><div class="m-sec-t">Bench</div><div class="m-bench" id="m-slot-bench"></div></div>
            <div class="m-sec"><div class="m-sec-t">Board</div>
              ${row('#btn-tutorial', 'book', 'Tutorial')}
              ${row('#btn-reset', 'reset', 'Reset board')}
              ${row('#btn-new-board', 'plus', 'New blank board')}
              ${row('#btn-import', 'upload', 'Import a board or mod')}
            </div>
            <div class="m-sec"><div class="m-sec-t">App</div>
              <button class="m-row" data-proxy="#btn-sound"><span id="m-sound-ico"></span><span id="m-sound-lbl"></span></button>
              ${row('#btn-feedback', 'message', 'Feedback')}
              ${row('#btn-help', 'help', 'Help')}
            </div>
          </div>
        </div>
      </div>`;
  }

  /**
   * Phone in portrait: suggest landscape (shown by CSS only in portrait on a phone-sized screen,
   * so rotating hides it). "Keep portrait" is remembered.
   */
  private rotateHintHtml(): string {
    let ok = false;
    try { ok = localStorage.getItem('pcbfix_portrait_ok') === '1'; } catch { /* storage unavailable */ }
    if (ok) return '';
    return `
      <div class="m-rotate" id="m-rotate" role="dialog" aria-labelledby="m-rotate-t">
        <div class="m-rotate-card">
          <div class="m-rotate-ico">${icon('phone', 56)}</div>
          <div class="m-rotate-t" id="m-rotate-t">Turn your phone sideways</div>
          <p>The bench has more room in landscape: the board, tools and meter fit side by side.</p>
          <button class="btn" id="m-rotate-keep">Keep portrait</button>
        </div>
      </div>`;
  }

  /** Moves the desktop top-bar controls into the More sheet (their listeners move with them). */
  private fillMobileMore() {
    const q = (sel: string) => this.mount.querySelector<HTMLElement>(sel);
    q('#m-slot-view')?.append(q('#seg-view')!);
    q('#m-slot-side')?.append(q('#seg-side')!);
    q('#m-slot-viz')?.append(q('#viz-select')!);
    const pop = q('#bench-pop');
    if (pop) q('#m-slot-bench')?.append(...Array.from(pop.children));
    // the reset button lives in the More sheet on mobile; a hidden one keeps the proxy simple
    if (!q('#btn-reset')) {
      const b = document.createElement('button');
      b.id = 'btn-reset';
      b.hidden = true;
      q('#tooldock')?.append(b);
    }
  }

  /** Walkthrough videos per scenario id (videos/index.json, rendered by scripts/videos/record.ts). */
  private videos: Record<string, Record<'approach' | 'solution', { file: string; captions: string; poster: string; seconds: number }>> = {};

  private async loadVideoIndex() {
    try {
      const res = await fetch('./videos/index.json');
      if (res.ok) { this.videos = await res.json(); this.renderUI(); }
    } catch { /* videos are optional */ }
  }

  private playVideo(id: string, kind: 'approach' | 'solution') {
    const v = this.videos[id]?.[kind];
    if (!v) return;
    const box = document.createElement('div');
    box.className = 'video-backdrop';
    box.innerHTML = `
      <div class="video-panel" role="dialog" aria-label="${kind === 'approach' ? 'How to approach' : 'Solution'} walkthrough">
        <div class="video-head">
          <span>${this.esc(this.activeScenario.meta.title)} · ${kind === 'approach' ? 'How to approach' : 'Solution'}</span>
          <button class="btn ghost icon sm" data-close title="Close (Esc)">${icon('x', 14)}</button>
        </div>
        <video controls autoplay playsinline preload="metadata" poster="./videos/${v.poster}">
          <source src="./videos/${v.file}" type="video/mp4" />
          <track kind="captions" src="./videos/${v.captions}" srclang="en" label="English" />
        </video>
      </div>`;
    const close = () => { box.remove(); window.removeEventListener('keydown', onKey, true); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    box.addEventListener('click', (e) => { if (e.target === box || (e.target as HTMLElement).closest('[data-close]')) close(); });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(box);
  }

  /**
   * A mod board's schematic in a floating, movable, resizable window over the bench, so it can be read
   * while probing. PDFs use the browser's own viewer (zoom, search); images scroll and zoom on click.
   */
  private async openSchematic(s: Scenario) {
    const mb = this.modBoards.get(s);
    if (!mb?.schematic) return;
    document.querySelector('.schem-win')?.remove();
    let url = this.schematicUrls.get(mb);
    if (!url) {
      try {
        url = URL.createObjectURL(new Blob([(await mb.schematic.read()) as BlobPart], { type: mb.schematic.mime }));
        this.schematicUrls.set(mb, url);
      } catch (e) {
        this.toast(`Could not open the schematic: ${e instanceof Error ? e.message : e}`, 'danger');
        return;
      }
    }
    const pdf = mb.schematic.mime === 'application/pdf';
    const win = document.createElement('div');
    win.className = 'schem-win';
    win.setAttribute('role', 'dialog');
    win.innerHTML = `
      <div class="schem-head" title="Drag to move">
        <span>${icon('book', 13)} ${this.esc(s.meta.title)} · schematic</span>
        <button class="btn ghost icon sm" data-close title="Close">${icon('x', 14)}</button>
      </div>
      <div class="schem-body">${pdf
        ? `<iframe src="${url}" title="Schematic"></iframe>`
        : `<img src="${url}" alt="Schematic of ${this.esc(s.meta.title)}" title="Click to zoom" draggable="false" />`}</div>`;
    document.body.appendChild(win);
    win.querySelector('[data-close]')!.addEventListener('click', () => win.remove());
    const img = win.querySelector('img');
    img?.addEventListener('click', () => img.classList.toggle('zoom'));
    const head = win.querySelector<HTMLElement>('.schem-head')!;
    head.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const r = win.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      win.classList.add('dragging');
      head.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        win.style.left = `${Math.min(window.innerWidth - 80, Math.max(0, ev.clientX - dx))}px`;
        win.style.top = `${Math.min(window.innerHeight - 40, Math.max(0, ev.clientY - dy))}px`;
      };
      const up = () => { win.classList.remove('dragging'); head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
    });
  }

  /** Test / recording hook (only with ?automation): board geometry ↔ screen, camera control. */
  private exposeAutomation() {
    const find = (ref: string) => this.board.components.find((c) => c.ref === ref);
    const api = {
      ready: () => !!this.renderer && !!this.board,
      scenario: () => this.activeScenario.id,
      open: async (id: string) => { const i = this.scenarios.findIndex((x) => x.id === id); if (i < 0) return false; await this.openScenario(i); this.refreshScenarioSelect(); return true; },
      pads: (ref: string) => find(ref)?.pads.map((p) => ({ name: p.name, net: p.net ?? '' })) ?? [],
      part: (ref: string) => { const c = find(ref); return c && { x: c.at[0], y: c.at[1], side: c.side }; },
      pad: (ref: string, name: string) => {
        const c = find(ref), p = c?.pads.find((q) => q.name === name);
        if (!c || !p) return null;
        const w = padWorld(c, p).at;
        return { x: w[0], y: w[1], side: p.layers === 'B' ? 'B' : p.layers === 'F' ? 'F' : c.side };
      },
      focus: (x: number, y: number, halfH = 10, side?: Side) => { this.camera.bothSides = false; this.camera.focusAt(x, y, halfH, side); this.renderUI(); },
      fit: () => this.camera.fitBoard(this.board.w, this.board.h),
      side: () => this.camera.side,
      /** Board point (mm) → page pixel (CSS px), on the given side's copper surface. */
      toScreen: (x: number, y: number, side: Side = this.camera.side) => {
        const r = this.canvas.getBoundingClientRect();
        const { viewProj } = this.camera.matrices(this.canvas.width, this.canvas.height);
        const z = (side === 'F' ? 1 : -1) * this.board.thickness / 2;
        const [cx, cy, , cw] = transform4(viewProj, x, y, z, 1);
        return { x: r.left + ((cx / cw + 1) / 2) * r.width, y: r.top + ((1 - cy / cw) / 2) * r.height };
      },
    };
    (window as unknown as { deadboard: unknown; liveboard: unknown }).deadboard = api;
    (window as unknown as { deadboard: unknown; liveboard: unknown }).liveboard = api;
  }

  /** Demo boards listed in demos/index.json: shown in the list, fetched when opened. */
  private demoUrls = new Map<Scenario, string>();

  private addPresetStubs() {
    const isPl = getLang() === 'pl';
    for (const m of BOARD_PRESET_METAS) {
      const stub: Scenario = {
        format: 'pcbfix/1',
        id: m.id,
        solver: 'spice-power',
        objectives: [],
        meta: {
          title: isPl ? m.titlePl : m.titleEn,
          author: 'DEADBOARD Studio',
          difficulty: m.difficulty,
          description: isPl ? m.descPl : m.descEn,
          hints: [],
        },
        board: { w: 10, h: 10, thickness: 1.6, components: [], traces: [], vias: [], blobs: [], jumpers: [], zones: [], silk: [], texts: [], nextId: 1 },
      };
      this.presetStubs.set(stub, m);
      this.scenarios.push(stub);
    }
  }

  private async addDemoStubs() {
    try {
      const res = await fetch('./demos/index.json');
      if (!res.ok) return;
      const list = (await res.json()) as { id: string; file: string; title: string; difficulty: number; description: string; credits?: string; license?: string; source?: string }[];
      for (const d of list) {
        const stub: Scenario = {
          format: 'pcbfix/1', id: d.id, solver: 'spice-power', objectives: [],
          meta: { title: d.title, author: 'DEADBOARD', difficulty: d.difficulty, description: d.description, hints: [], credits: d.credits, license: d.license, source: d.source },
          board: new Builder(10, 10).b,
        };
        this.demoUrls.set(stub, `./demos/${d.file}`);
        this.scenarios.push(stub);
      }
    } catch { /* demos are optional */ }
  }

  /** Loads mods (desktop mods folder + installed .zips) and lists their boards. Never fails startup. */
  private async loadMods() {
    // drop the boards of a previous load (after install / remove), keeping any that is open
    const active = this.activeScenario;
    this.scenarios = this.scenarios.filter((s) => !this.modBoards.has(s) || s === active);
    for (const s of [...this.modBoards.keys()]) if (s !== active) this.modBoards.delete(s);
    for (const url of this.schematicUrls.values()) URL.revokeObjectURL(url);
    this.schematicUrls.clear();
    try {
      const builtin = new Set(this.scenarios.filter((s) => !this.modBoards.has(s)).map((s) => s.id));
      this.modResult = await loadAllMods((id) => builtin.has(id));
    } catch (e) {
      this.modResult = { mods: [], failed: [{ name: 'mods', origin: '', error: e instanceof Error ? e.message : String(e) }] };
    }
    for (const mod of this.modResult.mods) {
      for (const b of mod.boards) {
        if (active && this.modBoards.has(active) && active.id === b.stub.id) { this.modBoards.set(active, b); continue; }
        this.modBoards.set(b.stub, b);
        this.scenarios.push(b.stub);
      }
    }
  }

  /** Installs a mod .zip (web: kept in browser storage; desktop: in the app's storage too). */
  /** Returns the number of warnings, or -1 when the mod was not installed. */
  private async installModFile(f: File): Promise<number> {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const builtin = new Set(this.scenarios.filter((s) => !this.modBoards.has(s)).map((s) => s.id));
      const mod = await installMod(bytes, f.name, (id) => builtin.has(id));
      await this.loadMods();
      this.refreshScenarioSelect();
      const warn = mod.warnings.length ? ` (${mod.warnings.length} warning${mod.warnings.length > 1 ? 's' : ''}: see Mods)` : '';
      this.toast(`Installed mod "${mod.manifest.name}" v${mod.manifest.version}: ${mod.boards.length} board${mod.boards.length > 1 ? 's' : ''}${warn}`, mod.warnings.length ? 'info' : 'success');
      const first = this.scenarios.findIndex((s) => this.modBoards.get(s)?.mod.id === mod.manifest.id);
      if (first >= 0) await this.openScenario(first);
      return mod.warnings.length;
    } catch (err) {
      this.toast(`Mod not installed: ${err instanceof Error ? err.message : String(err)}`, 'danger');
      return -1;
    }
  }

  /** Opens a scenario, fetching a demo board on first use. */
  private async openScenario(idx: number) {
    const seq = ++this.openScenarioSeq;
    let sc = this.scenarios[idx];
    const meta = this.presetStubs.get(sc);
    if (meta) {
      this.toast(`Loading ${sc.meta.title}…`, 'info');
      try {
        const full = await meta.load();
        this.presetStubs.delete(sc);
        this.scenarios[idx] = full;
        if (seq !== this.openScenarioSeq) return;
        sc = full;
      } catch (err) {
        if (seq !== this.openScenarioSeq) return;
        this.toast(`Could not load preset board: ${err instanceof Error ? err.message : err}`, 'danger');
        this.refreshScenarioSelect();
        return;
      }
    }
    const mb = this.modBoards.get(sc);
    if (mb && sc === mb.stub && !mb.stub.board.components.length) {
      this.toast(`Loading ${sc.meta.title}…`, 'info');
      try {
        const full = await mb.load();
        this.modBoards.delete(sc);
        this.modBoards.set(full, mb);
        this.scenarios[idx] = full;
        if (seq !== this.openScenarioSeq) return;
        sc = full;
      } catch (err) {
        if (seq !== this.openScenarioSeq) return;
        this.toast(`Could not load ${sc.meta.title} (mod "${mb.mod.name}"): ${err instanceof Error ? err.message : err}`, 'danger');
        return;
      }
    }
    const url = this.demoUrls.get(sc);
    if (url) {
      this.toast(`Loading ${sc.meta.title}…`, 'info');
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { importScenarioOrPcb } = await import('../io/kicad');
        const full = importScenarioOrPcb('demo.pcbfix.json', await res.text());
        this.demoUrls.delete(sc);
        this.scenarios[idx] = full;
        if (seq !== this.openScenarioSeq) return;
        sc = full;
      } catch (err) {
        if (seq !== this.openScenarioSeq) return;
        this.toast(`Could not load the demo board: ${err instanceof Error ? err.message : err}`, 'danger');
        this.refreshScenarioSelect();
        return;
      }
    }
    if (seq !== this.openScenarioSeq) return;
    this.loadScenario(sc);
  }

  private refreshScenarioSelect() {
    const sel = this.mount.querySelector<HTMLSelectElement>('#sc-select')!;
    const isPl = getLang() === 'pl';
    const renderOpt = (s: Scenario, i: number) => {
      const tr = translateScenario(s.id, s.meta.title, s.meta.description);
      const solved = this.solvedIds.has(s.id) ? (isPl ? ' — rozwiązane' : ' — solved') : '';
      return `<option value="${i}">${this.esc(tr.title)} · L${s.meta.difficulty}${solved}</option>`;
    };
    const tuts: string[] = [];
    const main: string[] = [];
    this.scenarios.forEach((s, i) => {
      (isTutorialScenario(s.id) ? tuts : main).push(renderOpt(s, i));
    });
    sel.innerHTML =
      (tuts.length ? `<optgroup label="${isPl ? 'Samouczki' : 'Beginner Tutorials'}">${tuts.join('')}</optgroup>` : '') +
      (main.length ? `<optgroup label="${isPl ? 'Zadania naprawcze' : 'Repair Challenges'}">${main.join('')}</optgroup>` : '');
    const idx = this.scenarios.indexOf(this.activeScenario);
    if (idx >= 0) sel.value = String(idx);

    const s = this.activeScenario;
    const badge = this.mount.querySelector<HTMLElement>('#bp-badge');
    const title = this.mount.querySelector<HTMLElement>('#bp-title');
    const chk = this.mount.querySelector<HTMLElement>('#bp-check');
    if (s && badge && title && chk) {
      const tutIdx = TUTORIAL_SCENARIO_IDS.indexOf(s.id as (typeof TUTORIAL_SCENARIO_IDS)[number]);
      badge.textContent = tutIdx >= 0 ? `T${tutIdx + 1}` : `L${s.meta.difficulty}`;
      badge.classList.toggle('tut', tutIdx >= 0);
      title.textContent = translateScenario(s.id, s.meta.title, s.meta.description).title;
      chk.hidden = !this.solvedIds.has(s.id);
    }
    if (this.showBoards) this.renderModal();
  }

  private loadScenario(sc: Scenario) {
    this.activeScenario = sc;
    this.board = cloneBoard(sc.board);
    this.undoStack = [];
    this.redoStack = [];
    this.moves = 0;
    this.hintsShown = 0;
    this.selectedNet = -1;
    this.selectedCompId = null;
    this.probeRed = null;
    this.probeBlack = null;
    this.jumperStart = null;
    this.lastVerify = null;
    this.revealedFlag = null;
    this.compSearch = '';
    this.powerOn = true;
    this.boot.powerOff(); // a new board powers up from scratch
    if (sc.solver && sc.solver !== this.solver) {
      this.solver = sc.solver; // for this board only: the saved preference is left alone
      if (sc.solver === 'spice-power') this.toast('This board runs on Solver: SPICE + PWR (regulator models and power states).', 'info');
    }
    this.authorMode = false;
    this.tutorialStep = 0;
    if (isTutorialScenario(sc.id)) {
      if (localStorage.getItem('pcbfix_tut_dismissed') !== '1') this.tutorialOpen = true;
    } else {
      this.tutorialOpen = false;
    }
    if (this.mobile) {
      // phone: a new board opens on its mission, unless the tutorial card is there to guide
      this.activeTab = 'mission';
      this.panelOpen = !this.tutorialOpen;
      this.tutCollapsed = false;
      this.activeProbe = 'red';
      this.activeProbeAuto = false;
    }
    this.camera.setSide('F');
    this.camera.bothSides = this.board.components.length > 500;
    this.cursorWorld = null;
    this.cursorSide = 'F';
    this.camera.fitBoard(this.board.w, this.board.h);
    this.recompute(true);
    this.refreshScenarioSelect();
    this.renderUI();
  }

  /** Opens the interactive step-by-step guide when the active board is a tutorial scenario. */
  private startTutorial() {
    if (!isTutorialScenario(this.activeScenario.id)) return; // never swap the user's board
    localStorage.removeItem('pcbfix_tut_dismissed');
    this.tutorialOpen = true;
    this.tutorialStep = 0;
    this.renderUI();
  }

  private pushUndo() {
    this.undoStack.push(cloneBoard(this.board));
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack.length = 0;
    this.moves++;
  }

  private undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(cloneBoard(this.board));
    this.board = prev;
    this.jumperStart = null;
    this.recompute(false);
    this.renderUI();
  }

  private redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneBoard(this.board));
    this.board = next;
    this.jumperStart = null;
    this.recompute(false);
    this.renderUI();
  }

  private recompute(silentOverloads = false) {
    if (this.thermalBoard !== this.board) settleIntermittents(this.board); // resting state for a newly loaded board
    this.conn = buildConnectivity(this.board);
    this.refreshProbes(); // probe nets must be current before the SPICE meter load is placed
    if (this.powerOn && this.boot.state === 'OFF') this.startBoot();
    if (this.powerOn) {
      this.sim = this.solve();
      this.applySim(silentOverloads);
    } else {
      this.sim = null;
    }
    this.refreshProbes();
    this.updateThermalPower();
  }

  /** Consequences of a fresh solve: parts that overloaded burn out (then re-solve). */
  private applySim(silentOverloads: boolean) {
    if (!this.sim) return;
    {
      let anyBlew = false;
      for (const c of this.board.components) {
        const r = this.sim.comps.get(c.id);
        if (r?.over && !c.state.burnt) {
          c.state.burnt = true;
          anyBlew = true;
          this.renderer?.spawnSmoke(c.at[0], c.at[1], c.side, this.board.thickness, 'burn');
          if (!silentOverloads) {
            this.toast(`${c.ref} ${r.overMsg ?? 'overloaded and burned out!'}`, 'danger');
          }
        } else if (!silentOverloads && c.kind === 'battery' && r && r.i > 5) {
          this.toast(`Short circuit on ${c.ref} (${r.i.toFixed(1)} A)! Turn Power OFF or enable PSU OCP 100 mA.`, 'danger');
        }
      }
      if (anyBlew) {
        if (!silentOverloads) sfxBlow();
        this.sim = this.solve();
      }
    }
  }

  private solveWorker: Worker | null | undefined;
  /** Id of the background solve in flight (0 = none). */
  private pendingSolve = 0;
  private solveSeq = 0;

  /**
   * Re-solves in a worker (power-up transitions); the controller pauses until it lands.
   * Falls back to a synchronous solve where workers are unavailable.
   */
  private recomputeAsync() {
    if (this.solveWorker === undefined) {
      try {
        this.solveWorker = new Worker(new URL('../spice/solveWorker.ts', import.meta.url), { type: 'module' });
        this.solveWorker.onmessage = (e: MessageEvent<{ id: number; sim?: Sim; error?: string }>) => this.onWorkerSolve(e.data);
        this.solveWorker.onerror = () => { this.solveWorker = null; if (this.pendingSolve) { this.pendingSolve = 0; this.recompute(true); } };
      } catch { this.solveWorker = null; }
    }
    if (!this.solveWorker || this.psuInject) { this.recompute(true); return; }
    const id = ++this.solveSeq;
    this.pendingSolve = id;
    const opts = {
      ...(this.ocpAmps > 0 && { currentLimit: this.ocpAmps }),
      ...(this.bootSequenced && this.boot.state !== 'OFF' && { powerState: this.boot.state, loadScale: this.activeScenario.calibration?.loadScale }),
      meters: this.solver !== 'fast' && this.dmmMode === 'V' && this.probeRed && this.probeRed.net >= 0 ? [[this.probeRed.net, this.probeBlack?.net ?? -1] as [number, number]] : [],
    };
    this.solveWorker.postMessage({ id, board: this.board, solver: this.solver, opts });
    this.solveFor = this.conn;
  }
  private solveFor: Conn | null = null;

  private onWorkerSolve(d: { id: number; sim?: Sim; error?: string }) {
    if (d.id !== this.pendingSolve) return; // superseded
    this.pendingSolve = 0;
    // the board changed meanwhile (a synchronous solve already ran): result is stale
    if (this.solveFor !== this.conn || !this.powerOn) return;
    if (!d.sim) { this.recompute(true); return; }
    this.sim = d.sim;
    this.applySim(true);
    this.refreshProbes();
    this.updateThermalPower();
    this.renderTopHud();
    this.renderDmm();
  }

  private onReworkEvents(evs: ReworkEvent[]) {
    let changed = false;
    for (const e of evs) {
      if (e.kind === 'molten') continue;
      changed = true;
      const bad = e.kind === 'pad-lifted' || e.kind === 'part-overheated' || e.kind === 'mlcc-cracked' || e.kind === 'part-displaced' || e.kind === 'dull-joint';
      this.toast(e.detail, bad ? 'danger' : 'success');
      if (e.kind === 'reflowed') sfxSolder();
    }
    if (changed) { this.recompute(true); this.renderUI(); }
  }

  private updateThermalPower() {
    if (this.thermalBoard !== this.board || !this.thermal) {
      this.thermal = new ThermalModel(this.board);
      this.thermalBoard = this.board;
      this.rework = new ReworkMonitor(this.board, this.thermal);
    }
    const p = new Map<string, number>();
    if (this.powerOn && this.sim?.source) for (const c of this.board.components) {
      const cs = this.sim.comps.get(c.id);
      if (cs && cs.p > 0 && c.kind !== 'battery') p.set(c.id, cs.p);
    }
    this.thermal.setPower(p);
  }

  /** Runs the selected solver. In SPICE mode the DMM's 10 MΩ input loads the probed net. */
  private solve(): Sim {
    const meters: [number, number][] =
      this.solver !== 'fast' && this.dmmMode === 'V' && this.probeRed && this.probeRed.net >= 0
        ? [[this.probeRed.net, this.probeBlack?.net ?? -1]]
        : [];
    if (this.psuInject && this.probeRed && this.probeRed.net >= 0) {
      // injection replaces the board supply; always a SPICE solve (needs current limiting)
      return runSolver(this.solver === 'fast' ? 'spice' : this.solver, this.board, this.conn, {
        inject: { net: this.probeRed.net, volts: this.psuInject.volts, amps: this.psuInject.amps },
      } as Parameters<typeof runSolver>[3]);
    }
    return runSolver(this.solver, this.board, this.conn, {
      ...(this.ocpAmps > 0 && { currentLimit: this.ocpAmps }),
      ...(this.bootSequenced && this.boot.state !== 'OFF' && { powerState: this.boot.state, loadScale: this.activeScenario.calibration?.loadScale }),
      meters,
    });
  }

  // ---------- Bench power supply & power-up sequence ----------

  /** Rails the controller waits for, per state (cached per connectivity snapshot). */
  private rails(): { conn: Conn; tree: PowerTree; byState: Map<PowerStateName, RequiredRail[]>; sequenced: boolean } {
    if (this.railCache?.conn !== this.conn) {
      const tree = discoverPowerTree(this.board, this.conn);
      const byState = new Map<PowerStateName, RequiredRail[]>();
      for (const s of ['G3H', 'S5', 'S4', 'S3', 'S0', 'S0SW'] as PowerStateName[]) byState.set(s, requiredRails(tree, s));
      this.railCache = { conn: this.conn, tree, byState, sequenced: tree.sources.some((s) => ['buck', 'boost', 'ldo', 'load-switch'].includes(s.kind)) };
    }
    return this.railCache;
  }

  private startBoot() {
    // Power states only mean something with regulator models and a board that has a power tree.
    this.bootSequenced = this.solver === 'spice-power' && !this.psuInject && this.rails().sequenced;
    this.boot = this.bootSequenced ? new BootController() : new BootController(['G3H']);
    this.boot.powerOn();
  }

  /** Required rails of `state` that are not within 10 % of their voltage in the present solve. */
  private missingRails(state: PowerStateName): string[] {
    const sim = this.sim;
    if (!sim?.source) return ['supply'];
    const out: string[] = [];
    for (const r of this.rails().byState.get(state) ?? []) {
      const k = sim.nodeOfNet.get(this.conn.netNames.indexOf(r.rail));
      const v = k === undefined ? 0 : sim.V[k];
      if (Math.abs(v - r.v) > 0.1 * r.v) out.push(r.rail);
    }
    return out;
  }

  /** Bench-supply output: set voltage and the current it delivers. */
  private supplyReading(): { volts: number; amps: number; cc: boolean } {
    const sim = this.sim;
    if (!this.powerOn || !sim?.source) return { volts: 0, amps: 0, cc: false };
    const inj = (sim as { injected?: { v: number; i: number } }).injected;
    if (inj) return { volts: inj.v, amps: Math.max(0, inj.i), cc: !!sim.ccLimited };
    let amps = 0, volts = 0;
    for (const c of this.board.components) {
      if (c.kind !== 'battery') continue;
      const r = sim.comps.get(c.id);
      amps += Math.max(0, r?.i ?? 0);
      volts = Math.max(volts, r?.v ?? 0);
    }
    return { volts, amps, cc: !!sim.ccLimited };
  }

  private renderPsu() {
    if (!this.powerOn && !this.boot.history.length) { this.psuBoxEl.innerHTML = ''; return; }
    if (!this.psuBoxEl.querySelector('.psu-card')) {
      this.psuBoxEl.innerHTML = `
        <div class="psu-card">
          <div class="psu-head"><span>Bench supply</span><span class="muted" id="psu-mode"></span></div>
          <div class="psu-lcd">
            <div class="v" id="psu-v"></div><div class="a" id="psu-a"></div>
            <div class="l">VOLTS</div><div class="l r">AMPS</div>
          </div>
          <canvas class="psu-chart" id="psu-chart" width="528" height="128"></canvas>
          <div class="psu-state" id="psu-state"></div>
        </div>`;
      if (this.mobile) {
        this.psuBoxEl.classList.toggle('expanded', this.psuExpanded);
        this.psuBoxEl.querySelector('.psu-head')?.addEventListener('click', () => {
          this.psuExpanded = !this.psuExpanded;
          this.psuBoxEl.classList.toggle('expanded', this.psuExpanded);
        });
      }
    }
    const rd = this.supplyReading();
    const amps = this.powerOn ? this.boot.amps : 0;
    const q = (id: string) => this.psuBoxEl.querySelector<HTMLElement>(id)!;
    q('#psu-v').textContent = `${rd.volts.toFixed(2)} V`;
    q('#psu-a').textContent = amps >= 1 ? `${amps.toFixed(3)} A` : `${(amps * 1000).toFixed(1)} mA`;
    q('#psu-mode').textContent = this.psuInject ? 'injection' : rd.cc ? 'CC limit' : this.ocpAmps > 0 ? `OCP ${this.ocpAmps} A` : 'CV';
    const st = q('#psu-state');
    const b = this.boot;
    let txt = '', warn = false;
    if (!this.powerOn) txt = 'Output off';
    else if (!this.bootSequenced) txt = this.solver === 'spice-power' ? 'No power states found on this board' : 'Board powered (power-up sequence needs Solver: SPICE + PWR)';
    else if (b.state === 'S0SW') txt = [...this.rails().byState.values()].some((r) => r.length)
      ? 'Running (S0) — all sequenced rails up'
      : 'Running (S0) — rail names carry no power states: the controller enables everything, check the rails yourself';
    else if (b.failures > 0) { warn = true; txt = `Boot loop: attempt ${b.failures + 1} · stuck in ${b.state}${b.blockedBy.length ? ` · waiting for ${b.blockedBy.slice(0, 2).join(', ')}${b.blockedBy.length > 2 ? '…' : ''}` : ''}`; }
    else txt = b.state === 'G3H' ? 'Standby (G3H) — always-on rails only' : `Powering up: ${b.state}`;
    st.textContent = this.mobile && !this.psuExpanded && !warn ? txt.split(/ — | \(/)[0] : txt;
    st.classList.toggle('warn', warn);
    this.drawPsuChart(q('#psu-chart') as unknown as HTMLCanvasElement);
  }

  /** Solved voltage at the scope probe (undefined: no contact or no supply). */
  private probedVolts(): number | undefined {
    const p = this.scopeProbe;
    if (!p || p.net < 0 || !this.powerOn || !this.sim?.source) return this.powerOn ? undefined : 0;
    const k = this.sim.nodeOfNet.get(p.net);
    return k === undefined ? undefined : this.sim.V[k];
  }

  /** Highest powered supply rail of any chip on `net` (a clock only runs while its driver has power). */
  private clockSupplyFor(net: number): number {
    const sim = this.sim;
    if (!sim?.source || net < 0) return 0;
    let best = 0;
    for (const i of this.conn.netItems[net] ?? []) {
      const it = this.conn.items[i];
      if (it.kind !== 'pad' || it.comp?.kind !== 'ic') continue;
      const idx = this.conn.padItem.get(it.comp) ?? [];
      it.comp.pads.forEach((p, pi) => {
        const nom = p.net ? railVoltage(p.net) : null;
        if (!nom || nom > 5.5) return;
        const k = sim.nodeOfNet.get(this.conn.net[idx[pi]]);
        const v = k === undefined ? 0 : sim.V[k];
        if (Math.abs(v - nom) <= 0.15 * nom) best = Math.max(best, nom);
      });
    }
    return best;
  }

  private scopeSignal(): ScopeSignal | null {
    const p = this.scopeProbe;
    if (!p || p.net < 0) return null;
    const v = this.probedVolts();
    if (v === undefined) return null;
    const tree = this.solver === 'spice-power' ? this.rails().tree : null;
    const volt = (name: string) => {
      const n = this.conn.netNames.indexOf(name);
      const k = n >= 0 ? this.sim?.nodeOfNet.get(n) : undefined;
      return k === undefined ? undefined : this.sim!.V[k];
    };
    return signalOn(this.conn.netNames[p.net], v, tree, volt, this.clockSupplyFor(p.net));
  }

  private renderScope() {
    if (!this.scopeProbe) { this.scopeBoxEl.innerHTML = ''; return; }
    if (!this.scopeBoxEl.querySelector('.psu-card')) {
      this.scopeBoxEl.innerHTML = `
        <div class="psu-card scope-card">
          <div class="psu-head">
            <span>Oscilloscope · CH1</span>
            <div class="row">
              <div class="seg"><button id="sc-auto">Auto</button><button id="sc-roll">Roll</button></div>
              <div class="seg"><button class="${this.scopePaused ? 'on warn' : ''}" id="sc-pause" title="Run / Stop (Freeze waveform - S)">${this.scopePaused ? 'STOP' : 'RUN'}</button></div>
              <button class="btn ghost icon" id="sc-close" title="Remove probe">${icon('x', 14)}</button>
            </div>
          </div>
          <canvas class="scope-screen" id="sc-canvas" width="528" height="240"></canvas>
          <div class="psu-state" id="sc-meas"></div>
          <div class="psu-state muted" id="sc-note"></div>
        </div>`;
      this.scopeBoxEl.querySelector('#sc-auto')!.addEventListener('click', () => { this.scopeMode = 'auto'; this.renderScope(); });
      this.scopeBoxEl.querySelector('#sc-roll')!.addEventListener('click', () => { this.scopeMode = 'roll'; this.renderScope(); });
      this.scopeBoxEl.querySelector('#sc-pause')!.addEventListener('click', () => {
        this.scopePaused = !this.scopePaused;
        sfxClick();
        this.renderScope();
      });
      this.scopeBoxEl.querySelector('#sc-close')!.addEventListener('click', () => { this.scopeProbe = null; this.renderScope(); });
    }
    this.scopeBoxEl.querySelector('#sc-auto')!.classList.toggle('on', this.scopeMode === 'auto');
    this.scopeBoxEl.querySelector('#sc-roll')!.classList.toggle('on', this.scopeMode === 'roll');
    const pauseBtn = this.scopeBoxEl.querySelector('#sc-pause');
    if (pauseBtn) {
      pauseBtn.classList.toggle('warn', this.scopePaused);
      pauseBtn.classList.toggle('on', this.scopePaused);
      pauseBtn.textContent = this.scopePaused ? 'STOP' : 'RUN';
    }
    const cv = this.scopeBoxEl.querySelector<HTMLCanvasElement>('#sc-canvas')!;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.fillStyle = '#0b0f0c';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,200,140,0.14)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 10; k++) { const x = (W * k) / 10; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let k = 1; k < 8; k++) { const y = (H * k) / 8; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const sig = this.scopeSignal();
    const meas = this.scopeBoxEl.querySelector<HTMLElement>('#sc-meas')!;
    const note = this.scopeBoxEl.querySelector<HTMLElement>('#sc-note')!;
    const label = this.scopeProbe.label;
    let ys: Float64Array, timeDiv: string;
    if (this.scopeMode === 'roll' || !sig || sig.kind === 'dc') {
      // roll: the probed net over the last 10 s, from successive solves (real simulated data)
      const t1 = performance.now() / 1000;
      const pts = this.scopeRoll.filter((s) => s.t >= t1 - 10);
      ys = Float64Array.from(pts.map((s) => s.v));
      timeDiv = '1 s/div · roll';
      note.textContent = sig ? `${sig.note}${this.scopeMode === 'auto' && sig.kind === 'dc' ? ' — showing the last 10 s' : ''}` : this.powerOn ? `${label}: probe not on a powered net` : 'Supply off';
      this.drawTrace(ctx, W, H, ys, pts.map((s) => (s.t - (t1 - 10)) / 10));
    } else {
      const span = 3 / sig.freq;
      ys = sampleSignal(sig, (performance.now() / 1000) % 1e-3, span, 600, Math.floor(performance.now() / 100));
      const perDiv = span / 10;
      timeDiv = `${perDiv >= 1e-3 ? `${+(perDiv * 1e3).toPrecision(3)} ms` : perDiv >= 1e-6 ? `${+(perDiv * 1e6).toPrecision(3)} µs` : `${+(perDiv * 1e9).toPrecision(3)} ns`}/div`;
      note.textContent = sig.note;
      this.drawTrace(ctx, W, H, ys, null);
    }
    let lo = Infinity, hi = -Infinity, sum = 0;
    for (const y of ys) { lo = Math.min(lo, y); hi = Math.max(hi, y); sum += y; }
    const avg = ys.length ? sum / ys.length : 0;
    meas.textContent = ys.length
      ? `${label} · ${timeDiv} · avg ${avg.toFixed(3)} V · p-p ${(hi - lo).toFixed(3)} V${sig && sig.freq && this.scopeMode === 'auto' ? ` · f ${fmtHz(sig.freq)}` : ''}`
      : `${label} · ${timeDiv}`;
  }

  /** Auto-ranged trace: picks a V/div from a 1-2-5 sequence so the signal fills the screen. */
  private drawTrace(ctx: CanvasRenderingContext2D, W: number, H: number, ys: Float64Array, xs: number[] | null) {
    if (ys.length < 2) return;
    let lo = Infinity, hi = -Infinity;
    for (const y of ys) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const steps = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
    const span = Math.max(hi - lo, Math.abs(hi) * 0.05, 0.004);
    const vdiv = steps.find((s) => s * 7 >= span) ?? 10;
    const mid = (hi + lo) / 2;
    const yOf = (v: number) => H / 2 - ((v - mid) / (vdiv * 8)) * H;
    ctx.strokeStyle = '#f5d547';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ys.forEach((v, i) => {
      const x = (xs ? xs[i] : i / (ys.length - 1)) * W, y = yOf(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = 'rgba(245,213,71,0.8)';
    ctx.font = '18px ui-monospace, monospace';
    ctx.fillText(`${vdiv >= 1 ? `${vdiv} V` : `${vdiv * 1000} mV`}/div`, 8, 22);
    ctx.fillText(`${mid.toFixed(3)} V`, W - 110, 22);
    if (this.scopePaused) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.fillText('STOP', W - 175, 22);
    }
  }

  /** Current vs time, last 10 s; the y range follows the data (auto-ranging like a scope). */
  private drawPsuChart(cv: HTMLCanvasElement) {
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = cv.width, H = cv.height, h = this.boot.history;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, W, H);
    if (h.length < 2) return;
    const t1 = h[h.length - 1].t, t0 = t1 - 10;
    const peak = Math.max(0.01, ...h.filter((s) => s.t >= t0).map((s) => s.amps));
    // full scale: next 1-2-5 step above the peak (any magnitude)
    const want = peak * 1.1, mag = 10 ** Math.floor(Math.log10(want));
    const top = [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= want)!;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 4; k++) { const y = (H * k) / 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '18px ui-monospace, monospace';
    ctx.fillText(top >= 1 ? `${+top.toPrecision(3)} A` : `${+(top * 1000).toPrecision(3)} mA`, 8, 20);
    ctx.fillText('−10 s', 8, H - 8);
    ctx.strokeStyle = '#ffa657';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    for (const s of h) {
      if (s.t < t0) continue;
      const x = ((s.t - t0) / 10) * W, y = H - (s.amps / top) * (H - 6) - 3;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private meterCache = new WeakMap<Conn, Map<string, Reading>>();
  /** Realistic meter reading (SPICE solvers), memoised per connectivity snapshot and probe pair. */
  private meter(mode: 'OHM' | 'DIODE' | 'CAP', a: number, b: number): Reading {
    let m = this.meterCache.get(this.conn);
    if (!m) this.meterCache.set(this.conn, (m = new Map()));
    const pr = this.probeRed?.pos, pb = this.probeBlack?.pos;
    const seed = `${a}-${b}-${pr?.map((v) => v.toFixed(1))}-${pb?.map((v) => v.toFixed(1))}`;
    const key = `${mode}|${seed}`;
    let r = m.get(key);
    if (!r) {
      r = mode === 'OHM' ? measureOhmsDmm(this.board, this.conn, a, b, { seed }) : mode === 'CAP' ? measureCapDmm(this.board, this.conn, a, b, { seed }) : measureDiodeDmm(this.board, this.conn, a, b, { seed });
      m.set(key, r);
    }
    return r;
  }

  /** Whether this board's capacitor values are importer placeholders (boardviews carry none). */
  private capValuesGuessed(): boolean {
    return this.board.components.some((c) => c.kind === 'capacitor' && c.valueGuessed);
  }

  /** Meter in series between the probes: a SPICE solve with the 10 A shunt in place (memoised). */
  private ammeterReading(a: number, b: number): Reading {
    let m = this.meterCache.get(this.conn);
    if (!m) this.meterCache.set(this.conn, (m = new Map()));
    const key = `AMP|${a}|${b}|${this.boot.state}|${this.ocpAmps}`;
    let r = m.get(key);
    if (!r) {
      const rnd = placementRng('amp', a, b);
      const ohms = AMMETER_SHUNT + GENERIC_DMM.leadOhms + contactResistance(GENERIC_DMM, rnd) + contactResistance(GENERIC_DMM, rnd);
      const s = runSolver(this.solver === 'fast' ? 'spice' : this.solver, this.board, this.conn, {
        ...(this.ocpAmps > 0 && { currentLimit: this.ocpAmps }),
        ...(this.bootSequenced && this.boot.state !== 'OFF' && { powerState: this.boot.state, loadScale: this.activeScenario.calibration?.loadScale }),
        ammeter: { a, b, ohms },
      }) as Sim & { ammeterAmps?: number };
      r = s.source ? displayAmps(s.ammeterAmps ?? 0, GENERIC_DMM, rnd) : { text: '0.0 mA', value: 0, sub: 'no supply' };
      m.set(key, r);
    }
    return r;
  }

  private ohms(a: number, b: number): number {
    return this.solver !== 'fast' ? measureOhmsSpice(this.board, this.conn, a, b) : measureOhms(this.board, this.conn, a, b);
  }

  private diodeTest(a: number, b: number) {
    return this.solver !== 'fast' ? measureDiodeSpice(this.board, this.conn, a, b) : measureDiode(this.board, this.conn, a, b);
  }

  private exportSpice() {
    const conn = buildConnectivity(this.board);
    const title = this.activeScenario.meta.title;
    const nl = boardToCircuit(this.board, conn, {
      title,
      infer: this.activeScenario.meta.author === 'Boardview (.brd)',
      comments: [`Exported from LiveBoard scenario "${title}" with its current faults and repairs.`],
    });
    const blob = new Blob([writeSpice(nl.circuit)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'board'}.cir`;
    a.click();
    URL.revokeObjectURL(url);
    const stubs = nl.report.filter((r) => r.source === 'stub').length;
    this.toast(`Exported SPICE netlist: ${nl.circuit.elements.length} elements${stubs ? `, ${stubs} unmodelled parts as hi-Z stubs` : ''}.`, 'success');
  }

  private refreshProbes() {
    // Re-resolve net indices on probe positions after board edits
    for (const p of [this.probeRed, this.probeBlack, this.scopeProbe]) {
      if (!p) continue;
      const hit = netAt(this.board, this.conn, p.pos, p.side, true);
      if (hit) {
        p.net = hit.net;
        p.label = hit.label;
      } else {
        p.net = -1;
        p.label = 'No contact';
      }
    }
  }

  private async runVerify() {
    this.recompute(false);
    const res = await verifyScenario(this.activeScenario, this.board, this.solver);
    this.lastVerify = res;
    if (res.flag) {
      this.revealedFlag = res.flag;
      this.solvedIds.add(this.activeScenario.id);
      localStorage.setItem('pcbfix_solved', JSON.stringify([...this.solvedIds]));
      this.refreshScenarioSelect();
      sfxWin();
      this.toast(`Flag captured: ${res.flag}`, 'success');
    } else if (res.allPassed && res.topologyMismatch) {
      this.toast('Checks pass, but the circuit is not the reference design — a fault is still hiding in there.', 'warn');
    } else if (res.allPassed && !this.activeScenario.lock) {
      sfxWin();
      this.toast('All checks green. The board is alive.', 'success');
    } else {
      sfxClick();
      this.toast('Bench checks failed — details in the Overview tab.', 'warn');
    }
    this.activeTab = 'mission';
    this.panelOpen = true;
    this.renderUI();
  }

  private bindEvents() {
    const q = (id: string) => this.mount.querySelector(id)!;

    q('#btn-boards').addEventListener('click', () => {
      this.showBoards = !this.showBoards;
      if (this.showBoards) { this.showHelp = false; this.showFeedback = false; }
      this.modalPos = [0, 0];
      this.renderModal();
    });

    q('#sc-select').addEventListener('change', (e) => {
      const idx = Number((e.target as HTMLSelectElement).value);
      if (this.scenarios[idx]) void this.openScenario(idx);
    });

    q('#btn-new-board').addEventListener('click', () => this.createBlankBoard());

    q('#btn-import').addEventListener('click', () => this.fileInputEl.click());
    this.fileInputEl.addEventListener('change', async () => {
      const f = this.fileInputEl.files?.[0];
      if (f) await this.handleFile(f);
      this.fileInputEl.value = '';
    });

    this.mount.querySelectorAll<HTMLButtonElement>('#seg-view button').forEach((b) => {
      b.addEventListener('click', () => {
        const nextMode = b.dataset.view as '2d' | '3d';
        this.camera.setMode(nextMode);
        this.renderUI();
      });
    });
    this.mount.querySelectorAll<HTMLButtonElement>('#seg-side button').forEach((b) => {
      b.addEventListener('click', () => {
        const s = b.dataset.side!;
        const wasBoth = this.camera.bothSides;
        if (s === 'both') {
          if (this.camera.mode === '3d') this.camera.setMode('2d'); // side-by-side is a 2D boardview layout
          this.camera.setSide('F');
          this.camera.bothSides = true;
          this.camera.fitBoard(this.board.w, this.board.h);
        } else {
          this.camera.bothSides = false;
          this.camera.setSide(s as Side);
          if (wasBoth) this.camera.fitBoard(this.board.w, this.board.h);
        }
        this.renderUI();
      });
    });
    q('#btn-fit').addEventListener('click', () => {
      this.camera.fitBoard(this.board.w, this.board.h);
    });
    q('#viz-select').addEventListener('change', (e) => {
      this.vizMode = (e.target as HTMLSelectElement).value as VizMode;
      this.renderUI();
    });
    q('#btn-bench').addEventListener('click', (e) => {
      e.stopPropagation();
      const pop = q('#bench-pop') as HTMLElement;
      pop.hidden = !pop.hidden;
      q('#btn-bench').classList.toggle('active', !pop.hidden);
    });
    document.addEventListener('pointerdown', (e) => {
      const pop = this.mount.querySelector('#bench-pop') as HTMLElement | null;
      if (pop && !pop.hidden && !(e.target as HTMLElement).closest('.bench-wrap')) { pop.hidden = true; q('#btn-bench').classList.remove('active'); }
    });
    q('#rework-mode').addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value;
      this.reworkMode = v === 'instant' ? { ...this.reworkMode, realistic: false } : { realistic: true, ironTemp: v.startsWith('r400') ? 400 : 350, flux: v.endsWith('f') };
      if (this.reworkMode.realistic) this.toast('Realistic rework: joints melt, pads lift and parts crack from the actual heat you apply. Watch the Thermal view.', 'info');
    });
    q('#preheat').addEventListener('change', (e) => {
      this.preheatTemp = Number((e.target as HTMLSelectElement).value) || 0;
      if (!this.preheatTemp && this.thermal) this.thermal.sources = this.thermal.sources.filter((x) => x.kind !== 'preheat');
    });
    q('#psu-mode').addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value;
      this.psuInject = v === 'inject1' ? { volts: 1, amps: 3 } : v === 'inject3' ? { volts: 3.3, amps: 1 } : null;
      if (this.psuInject) this.toast('Voltage injection: place the red probe on the shorted rail, then power on. The faulty part heats up — use Thermal view, freeze spray or IPA.', 'info');
      this.recompute(true);
      this.renderUI();
    });
    q('#ocp-select').addEventListener('change', (e) => {
      this.ocpAmps = Number((e.target as HTMLSelectElement).value) || 0;
      this.recompute(false);
      this.renderUI();
    });
    q('#solver-select').addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value;
      this.solver = v === 'spice' || v === 'spice-power' ? v : 'fast';
      try { localStorage.setItem('pcbfix_solver', this.solver); } catch { /* storage unavailable */ }
      this.boot.powerOff(); // power up again under the new model
      this.recompute(false);
      this.renderUI();
    });
    q('#btn-spice-export').addEventListener('click', () => this.exportSpice());
    q('#btn-power').addEventListener('click', () => this.togglePower());
    q('#btn-verify').addEventListener('click', () => void this.runVerify());
    q('#btn-tutorial').addEventListener('click', () => {
      if (this.tutorialOpen && isTutorialScenario(this.activeScenario.id)) {
        this.tutorialOpen = false;
        localStorage.setItem('pcbfix_tut_dismissed', '1');
        this.renderUI();
      } else {
        this.startTutorial();
      }
    });
    q('#btn-invert-orbit').addEventListener('click', () => {
      this.camera.invertOrbit = !this.camera.invertOrbit;
      try { localStorage.setItem('pcbfix_invert_orbit', this.camera.invertOrbit ? '1' : '0'); } catch { /* storage unavailable */ }
      this.updateTopButtons();
    });
    q('#btn-lang')?.addEventListener('click', () => {
      setLang(getLang() === 'pl' ? 'en' : 'pl');
      this.toast(getLang() === 'pl' ? 'Zmieniono język na Polski 🇵🇱' : 'Language set to English 🇬🇧', 'info');
      this.buildDom();
      this.bindEvents();
      this.renderUI();
    });
    q('#btn-shortcuts')?.addEventListener('click', () => {
      this.showShortcuts = !this.showShortcuts;
      if (this.showShortcuts) { this.showBoards = false; this.showFeedback = false; this.showHelp = false; this.showReport = false; }
      this.modalPos = [0, 0];
      this.renderModal();
    });
    const openCreator = () => void this.openBoardCreator();
    q('#btn-creator-main')?.addEventListener('click', openCreator);
    q('#btn-creator-open')?.addEventListener('click', openCreator);
    q('#btn-creator')?.addEventListener('click', openCreator);

    q('#btn-order-pcb')?.addEventListener('click', () => {
      this.showOrder = true;
      this.modalPos = [0, 0];
      this.renderModal();
    });
    q('#btn-report')?.addEventListener('click', () => {
      this.showReport = !this.showReport;
      if (this.showReport) { this.showBoards = false; this.showFeedback = false; this.showHelp = false; this.showShortcuts = false; }
      this.modalPos = [0, 0];
      this.renderModal();
    });
    q('#btn-sound').addEventListener('click', () => {
      setSoundEnabled(!soundEnabled);
      this.renderUI();
    });
    q('#btn-feedback').addEventListener('click', () => this.openFeedback(!this.showFeedback));
    q('#btn-help').addEventListener('click', () => {
      this.showHelp = !this.showHelp;
      if (this.showHelp) { this.showBoards = false; this.showFeedback = false; }
      this.modalPos = [0, 0];
      this.renderModal();
    });
    q('#btn-panel-toggle').addEventListener('click', () => {
      this.panelOpen = !this.panelOpen;
      this.layoutEl.classList.toggle('panel-collapsed', !this.panelOpen);
    });

    this.mount.querySelectorAll<HTMLButtonElement>('.tool-btn[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tool as ToolId;
        this.setTool(t);
        if (t === 'replace') {
          const selected = this.selectedCompId ? this.board.components.find((x) => x.id === this.selectedCompId) ?? null : null;
          this.openPartsBin(selected);
        }
        if (this.mobile && this.panelOpen) this.setPanel(false); // back to the board
      });
    });
    if (this.mobile) this.bindMobile();

    q('#btn-undo').addEventListener('click', () => this.undo());
    q('#btn-redo').addEventListener('click', () => this.redo());
    q('#btn-reset').addEventListener('click', () => this.loadScenario(this.activeScenario));

    this.mount.querySelectorAll<HTMLButtonElement>('.tab[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab as PanelTab;
        this.renderUI();
      });
    });

    // Pointer controls (canvas + draggable floating windows & panel resizer)
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.mount.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => { if (this.gestures.has(e.pointerId)) this.gestures.cancel(e.pointerId); });
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceHeld = false;
    });

    // Drag-and-drop file upload
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropOverlayEl.style.display = 'flex';
    });
    window.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null) this.dropOverlayEl.style.display = 'none';
    });
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.dropOverlayEl.style.display = 'none';
      const f = e.dataTransfer?.files?.[0];
      if (f) await this.handleFile(f);
    });
  }

  /** Mobile-only controls: More sheet, floating view buttons, sheet close. */
  private bindMobile() {
    const q = (sel: string) => this.mount.querySelector<HTMLElement>(sel);
    const more = q('#m-more')!;
    q('#btn-more')?.addEventListener('click', () => { more.hidden = !more.hidden; this.updateTopButtons(); });
    q('#m-more-close')?.addEventListener('click', () => { more.hidden = true; });
    more.addEventListener('click', (e) => { if (e.target === more) more.hidden = true; });
    more.querySelectorAll<HTMLButtonElement>('[data-proxy]').forEach((b) => b.addEventListener('click', () => {
      const sel = b.dataset.proxy!;
      // these open something else (a modal, a file picker, a fresh board): close the sheet first
      if (sel !== '#btn-sound' && sel !== '#btn-invert-orbit') more.hidden = true;
      q(sel)?.click();
      this.updateTopButtons();
    }));
    q('#m-fit')?.addEventListener('click', () => this.camera.fitBoard(this.board.w, this.board.h));
    q('#m-mode')?.addEventListener('click', () => {
      this.camera.setMode(this.camera.mode === '2d' ? '3d' : '2d');
      this.renderUI();
    });
    q('#m-flip')?.addEventListener('click', () => this.flipSide());
    q('#m-panel-close')?.addEventListener('click', () => this.setPanel(false));
    // panel notes fold to their heading; a tap opens / closes one (remembered across re-renders)
    this.sideBodyEl.addEventListener('click', (e) => {
      const c = (e.target as HTMLElement).closest<HTMLElement>('.callout');
      const h = c?.querySelector('.h')?.textContent;
      if (!c || !h || (e.target as HTMLElement).closest('a, button, input, select, textarea')) return;
      if (this.openNotes.has(h)) this.openNotes.delete(h); else this.openNotes.add(h);
      c.classList.toggle('open', this.openNotes.has(h));
    });
    q('#m-rotate-keep')?.addEventListener('click', () => {
      try { localStorage.setItem('pcbfix_portrait_ok', '1'); } catch { /* storage unavailable */ }
      q('#m-rotate')?.remove();
    });
    // iOS Safari zooms the page on a pinch outside the canvas: the board has its own pinch zoom
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  /**
   * Phones change shape (first layout, rotation): the camera only learns the canvas aspect when it
   * renders, so a fit made before that frames a portrait screen as if it were landscape.
   */
  private refitOnShapeChange() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w < 2 || h < 2) return;
    const a = w / h;
    if (this.fitAspect && Math.abs(a / this.fitAspect - 1) < 0.08) return;
    this.fitAspect = a;
    this.camera.matrices(w, h); // updates the aspect the fit uses
    this.camera.fitBoard(this.board.w, this.board.h);
  }

  /** Opens / closes the side panel (the bottom sheet on mobile). */
  private setPanel(open: boolean) {
    this.panelOpen = open;
    this.layoutEl.classList.toggle('panel-collapsed', !open);
  }

  /** F key / mobile flip button: the other face (leaving the side-by-side view for the bottom). */
  private flipSide() {
    if (this.camera.bothSides) {
      this.camera.bothSides = false;
      this.camera.setSide('B');
      this.camera.fitBoard(this.board.w, this.board.h);
    } else {
      this.camera.flip();
    }
    this.renderUI();
  }

  /** Mouse wording → touch wording on the mobile layout. */
  private txt(s: string): string {
    return this.mobile ? touchCopy(s) : s;
  }

  private async handleFile(f: File) {
    if (/\.zip$/i.test(f.name)) { await this.installModFile(f); return; }
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const { importScenarioOrPcb } = await import('../io/kicad');
      const sc = importScenarioOrPcb(f.name, bytes);
      this.scenarios.push(sc);
      this.loadScenario(sc);
      this.toast(`Loaded ${sc.meta.title} (${sc.board.components.length} parts, ${sc.board.traces.length} traces)`, 'success');
    } catch (err) {
      this.toast(`Import error: ${err instanceof Error ? err.message : String(err)}`, 'danger');
    }
  }

  private setTool(t: ToolId) {
    if (this.mobile && t !== this.activeTool && !this.toolTipsShown.has(t)) {
      this.toolTipsShown.add(t);
      const tool = TOOLS.find((x) => x.id === t);
      if (tool && t !== 'inspect') this.toast(`${tool.lbl}: ${TOOL_TIP_PHONE[t] ?? tool.tip}`, 'info');
    }
    this.activeTool = t;
    if (t !== 'jumper') this.jumperStart = null;
    this.mount.querySelectorAll<HTMLButtonElement>('.tool-btn[data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === t);
    });
    this.renderDmm();
    this.renderTopHud();
    this.renderTutorial();
  }

  private togglePower() {
    this.powerOn = !this.powerOn;
    if (!this.powerOn) {
      this.boot.powerOff();
      setContinuityBeep(false);
    }
    sfxRelay(this.powerOn);
    this.recompute(false);
    this.renderUI();
  }

  private canvasPt(e: PointerEvent | WheelEvent): { sx: number; sy: number; w: number; h: number } {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return {
      sx: (e.clientX - rect.left) * dpr,
      sy: (e.clientY - rect.top) * dpr,
      w: Math.max(1, rect.width * dpr),
      h: Math.max(1, rect.height * dpr),
    };
  }

  private onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'touch' && e.target === this.canvas) {
      e.preventDefault();
      this.hovered = null;
      this.gestures.down(e.pointerId, e.clientX, e.clientY);
      return;
    }
    if (e.button === 0) {
      const target = e.target as HTMLElement | null;
      if (target && !this.mobile) { // the mobile layout has fixed windows
        if (target.closest('#sidepanel-resizer')) {
          this.winDrag = { target: 'sidepanel', startX: e.clientX, startY: e.clientY, origX: this.sidepanelW, origY: 0 };
          document.body.classList.add('resizing-panel');
          e.preventDefault();
          return;
        }
        if (!target.closest('button, select, input, a')) {
          if (target.closest('.tut-head')) {
            this.winDrag = { target: 'tut', startX: e.clientX, startY: e.clientY, origX: this.tutPos[0], origY: this.tutPos[1] };
            document.body.classList.add('dragging-win');
            e.preventDefault();
            return;
          }
          if (target.closest('.dmm-head')) {
            this.winDrag = { target: 'dmm', startX: e.clientX, startY: e.clientY, origX: this.dmmPos[0], origY: this.dmmPos[1] };
            document.body.classList.add('dragging-win');
            e.preventDefault();
            return;
          }
          if (target.closest('.modal-head')) {
            this.winDrag = { target: 'modal', startX: e.clientX, startY: e.clientY, origX: this.modalPos[0], origY: this.modalPos[1] };
            this.suppressModalBgClose = false;
            document.body.classList.add('dragging-win');
            e.preventDefault();
            return;
          }
        }
      }
    }

    if (e.target !== this.canvas) return;
    const { sx, sy, w, h } = this.canvasPt(e);
    this.downPx = e.clientX;
    this.downPy = e.clientY;
    this.lastPx = e.clientX;
    this.lastPy = e.clientY;
    this.dragMoved = false;

    if (e.button === 0 || e.button === 1) {
      this.dragMode = 'pan';
      return;
    }
    if (e.button === 2) {
      this.dragMode = 'orbit';
      return;
    }

    void sx; void sy; void w; void h;
  }

  private onPointerMove(e: PointerEvent) {
    if (e.pointerType === 'touch' && this.gestures.has(e.pointerId)) {
      this.gestures.move(e.pointerId, e.clientX, e.clientY);
      return;
    }
    if (this.winDrag) {
      const dx = e.clientX - this.winDrag.startX;
      const dy = e.clientY - this.winDrag.startY;
      if (this.winDrag.target === 'sidepanel') {
        this.sidepanelW = Math.max(240, Math.min(640, this.winDrag.origX - dx));
        this.layoutEl.style.setProperty('--sidepanel-w', `${this.sidepanelW}px`);
      } else {
        const nx = Math.round(this.winDrag.origX + dx);
        const ny = Math.round(this.winDrag.origY + dy);
        if (this.winDrag.target === 'tut') {
          this.tutPos = [nx, ny];
          const card = this.tutBoxEl.querySelector<HTMLElement>('.tut-card');
          if (card) card.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
        } else if (this.winDrag.target === 'dmm') {
          this.dmmPos = [nx, ny];
          const card = this.dmmBoxEl.querySelector<HTMLElement>('.dmm-card');
          if (card) card.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
        } else if (this.winDrag.target === 'modal') {
          if (Math.hypot(dx, dy) > 4) this.suppressModalBgClose = true;
          this.modalPos = [nx, ny];
          const modal = this.modalRootEl.querySelector<HTMLElement>('.modal');
          if (modal) modal.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
        }
      }
      return;
    }

    if (this.dragMode !== 'none') {
      const dx = e.clientX - this.lastPx;
      const dy = e.clientY - this.lastPy;
      if (Math.hypot(e.clientX - this.downPx, e.clientY - this.downPy) > 4) this.dragMoved = true;
      this.lastPx = e.clientX;
      this.lastPy = e.clientY;

      if (this.dragMode === 'pan') {
        if (this.dragMoved) {
          this.canvas.classList.add('panning');
          this.camera.panScreen(dx, dy, Math.max(1, this.canvas.clientHeight));
        }
      } else if (this.dragMode === 'orbit') {
        if (this.dragMoved) this.orbitBy(dx, dy);
      }
      return;
    }

    if (e.target !== this.canvas) return;
    const { sx, sy, w, h } = this.canvasPt(e);
    const resolved = this.resolveBoardPt(this.camera.screenToBoard(sx, sy, w, h, this.board.thickness));
    this.cursorWorld = resolved?.pt ?? null;
    this.cursorSide = resolved?.side ?? this.camera.side;
    this.hovered = resolved ? pickAt(this.board, resolved.pt, resolved.side, this.vizMode === 'xray') : null;
    this.renderTopHud();
  }

  private orbitBy(dx: number, dy: number) {
    const prevMode = this.camera.mode, prevSide = this.camera.side;
    this.camera.orbit(dx, dy);
    this.updateTopButtons();
    if (this.camera.side !== prevSide) this.renderTopHud(); // orbited over to the other face
    if (this.camera.mode !== prevMode) this.renderTutorial();
  }

  /** A touch tap on the board: the active tool at that point (the meter places the active probe). */
  private touchTap(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const raw = this.camera.screenToBoard((x - r.left) * dpr, (y - r.top) * dpr, Math.max(1, r.width * dpr), Math.max(1, r.height * dpr), this.board.thickness);
    const resolved = this.resolveBoardPt(raw);
    if (!resolved) return;
    this.cursorWorld = resolved.pt;
    this.cursorSide = resolved.side;
    if (this.activeTool !== 'dmm') { this.applyToolAt(resolved.pt, resolved.side); return; }
    const which = this.activeProbe;
    if (this.mobile) {
      // two-probe modes: after the red probe the meter offers the black one, then back to red
      if (which === 'red' && this.dmmMode !== 'V' && !this.probeBlack) { this.activeProbe = 'black'; this.activeProbeAuto = true; }
      else if (which === 'black' && this.activeProbeAuto) { this.activeProbe = 'red'; this.activeProbeAuto = false; }
    }
    this.placeProbe(which, resolved.pt, resolved.side);
  }

  private onPointerUp(e: PointerEvent) {
    if (e.pointerType === 'touch' && this.gestures.has(e.pointerId)) {
      this.gestures.up(e.pointerId, e.clientX, e.clientY);
      return;
    }
    if (this.winDrag) {
      this.winDrag = null;
      document.body.classList.remove('dragging-win', 'resizing-panel');
      return;
    }

    const wasDrag = this.dragMoved;
    const mode = this.dragMode;
    this.dragMode = 'none';
    this.dragMoved = false;
    this.canvas.classList.remove('panning');

    if (e.target !== this.canvas) return;
    const { sx, sy, w, h } = this.canvasPt(e);
    const resolved = this.resolveBoardPt(this.camera.screenToBoard(sx, sy, w, h, this.board.thickness));
    if (!resolved) return;
    const { pt, side } = resolved;

    // Quick right-click in DMM places black probe
    if (e.button === 2 && mode === 'orbit' && !wasDrag) {
      if (this.activeTool === 'dmm') {
        this.placeProbe('black', pt, side);
      }
      return;
    }

    if (e.button === 0 && !wasDrag && !this.spaceHeld && (mode === 'none' || mode === 'pan')) {
      if (this.activeTool === 'dmm' && e.shiftKey) {
        this.placeProbe('black', pt, side);
      } else {
        this.applyToolAt(pt, side);
      }
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const { sx, sy, w, h } = this.canvasPt(e);
    const factor = Math.pow(1.0015, e.deltaY);
    this.camera.zoomAt(factor, sx, sy, w, h, this.board.thickness);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && (this.showBoards || this.showHelp || this.showFeedback || this.showMods || this.showShortcuts || this.showReport || this.showPartsBin)) {
      this.showBoards = false;
      this.showHelp = false;
      this.showFeedback = false;
      this.showMods = false;
      this.showShortcuts = false;
      this.showReport = false;
      this.showPartsBin = false;
      this.renderModal();
      return;
    }
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (e.code === 'Space') {
      if (!e.repeat) {
        this.spaceHeld = true;
        e.preventDefault();
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'l') {
      setLang(getLang() === 'pl' ? 'en' : 'pl');
      this.toast(getLang() === 'pl' ? 'Język: Polski 🇵🇱' : 'Language: English 🇬🇧', 'info');
      this.buildDom();
      this.bindEvents();
      this.renderUI();
      return;
    }
    if (k === 'k') {
      void this.openBoardCreator();
      return;
    }
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      this.showShortcuts = !this.showShortcuts;
      if (this.showShortcuts) { this.showBoards = false; this.showFeedback = false; this.showHelp = false; this.showReport = false; }
      this.modalPos = [0, 0];
      this.renderModal();
      return;
    }
    if (k === 'f') {
      this.flipSide();
      return;
    }
    if (k === 'c') { this.camera.fitBoard(this.board.w, this.board.h); return; }
    if (k === 'p') { this.togglePower(); return; }
    if (k === 'd') {
      this.toggleDmmHold();
      return;
    }
    if (k === 'u') {
      this.toggleDmmRel(this.currentDmmNumericVal);
      return;
    }
    if (k === 's') {
      if (this.scopeProbe) {
        this.scopePaused = !this.scopePaused;
        sfxClick();
        this.toast(this.scopePaused ? 'Oscilloscope STOP (waveform frozen)' : 'Oscilloscope RUN (live capture)', 'info');
        this.renderScope();
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextMode = this.camera.mode === '2d' ? '3d' : '2d';
      this.camera.setMode(nextMode);
      this.renderUI();
      return;
    }
    const t = TOOLS.find((x) => x.key === e.key);
    if (t) {
      this.setTool(t.id);
      if (t.id === 'replace') {
        const selected = this.selectedCompId ? this.board.components.find((x) => x.id === this.selectedCompId) ?? null : null;
        this.openPartsBin(selected);
      }
    }
  }

  private resolveBoardPt(raw: V2 | null): { pt: V2; side: Side } | null {
    if (!raw) return null;
    if (this.camera.bothSides) {
      if (raw[0] > this.board.w + BOTH_GAP * 0.5) {
        return {
          pt: [this.board.w * 2 + BOTH_GAP - raw[0], raw[1]],
          side: 'B',
        };
      }
      return { pt: raw, side: 'F' };
    }
    return { pt: raw, side: this.camera.side };
  }

  private placeProbe(which: 'red' | 'black', pt: V2, side: Side) {
    const hit = netAt(this.board, this.conn, pt, side, this.vizMode === 'xray');
    const pin: ProbePin = hit
      ? { pos: hit.snap, side, net: hit.net, label: hit.label }
      : { pos: pt, side, net: -1, label: 'Open / No copper' };
    if (which === 'red') this.probeRed = pin;
    else this.probeBlack = pin;
    if (this.powerOn && (this.psuInject || (this.solver !== 'fast' && this.dmmMode === 'V'))) { this.sim = this.solve(); this.updateThermalPower(); }
    sfxProbe();
    sfxClick();
    this.checkContinuityBeep();
    this.renderDmm();
    this.renderTutorial();
  }

  private checkContinuityBeep() {
    if ((this.dmmMode !== 'OHM' && this.dmmMode !== 'DIODE') || !this.probeRed || !this.probeBlack) {
      setContinuityBeep(false);
      return;
    }
    if (this.probeRed.net < 0 || this.probeBlack.net < 0) {
      setContinuityBeep(false);
      return;
    }
    const real = this.solver !== 'fast';
    let isCont = false;
    if (this.dmmMode === 'OHM') {
      const r = real ? this.meter('OHM', this.probeRed.net, this.probeBlack.net).value ?? Infinity : this.ohms(this.probeRed.net, this.probeBlack.net);
      isCont = r < (real ? 30 : 5);
      const key = `${this.probeRed.net}-${this.probeBlack.net}-${r.toFixed(1)}`;
      if (isCont && key !== this.lastBeepKey) {
        this.lastBeepKey = key;
        sfxBeep();
      }
    } else if (this.dmmMode === 'DIODE') {
      const dd = real ? this.meter('DIODE', this.probeRed.net, this.probeBlack.net) : null;
      const res = this.diodeTest(this.probeRed.net, this.probeBlack.net);
      isCont = (dd ? (dd.value !== null && dd.value < 0.05) : (res.volts < 0.05));
    }
    setContinuityBeep(isCont);
  }

  private applyToolAt(pt: V2, side: Side) {
    const xray = this.vizMode === 'xray';
    const hit = pickAt(this.board, pt, side, xray);

    if (this.activeTool === 'dmm') {
      this.placeProbe('red', pt, side);
      return;
    }
    if (this.activeTool === 'rosin') {
      if (!this.thermal) this.updateThermalPower();
      this.thermal!.applyRosin(pt[0], pt[1], 6);
      for (const c of this.board.components) if (Math.hypot(c.at[0] - pt[0], c.at[1] - pt[1]) <= 6 + Math.max(c.body.w, c.body.h) / 2) this.rosinParts.add(c);
      sfxClick();
      this.toast('Rosin film applied — on a powered board it melts clear first where a part runs hot.', 'info');
      return;
    }
    if (this.activeTool === 'scope') {
      const hit = netAt(this.board, this.conn, pt, side, this.vizMode === 'xray');
      this.scopeProbe = { pos: [pt[0], pt[1]], side, net: hit?.net ?? -1, label: hit?.label ?? 'No contact' };
      this.scopeRoll = [];
      sfxClick();
      this.renderScope();
      return;
    }
    if (this.activeTool === 'press') {
      this.flex.press(pt[0], pt[1], { duration: 2.5 });
      sfxClick();
      this.toast('Pressing on the board…', 'info');
      return;
    }
    if (this.activeTool === 'freeze' || this.activeTool === 'ipa') {
      if (!this.thermal) this.updateThermalPower();
      if (this.activeTool === 'freeze') {
        this.thermal!.freezeSpray(pt[0], pt[1], 5);
        sfxClick();
        this.toast('Freeze spray applied — watch which part defrosts first.', 'info');
        return;
      }
      this.thermal!.applyIpa(pt[0], pt[1], 6);
      sfxClick();
      // scrubbing with IPA also dissolves liquid-damage residue (and the leak it forms)
      if (residueNear(this.board, pt[0], pt[1], 3)) this.pushUndo();
      const { cleaned, cleared } = cleanWithIpa(this.board, pt[0], pt[1], 3);
      if (cleaned.length) {
        this.recompute(true);
        this.renderUI();
        this.toast(cleared.length ? `Residue scrubbed off ${cleared.join(', ')} — the board is clean there.` : `Scrubbing residue on ${cleaned.join(', ')}… it is thinning, keep cleaning.`, cleared.length ? 'success' : 'info');
      } else this.toast('Isopropyl applied — the hottest part dries first.', 'info');
      return;
    }

    if (this.activeTool === 'inspect') {
      if (!hit) {
        this.selectedNet = -1;
        this.selectedCompId = null;
        this.renderUI();
        return;
      }
      if (hit.kind === 'comp' || hit.kind === 'pad') {
        const c = hit.comp;
        this.selectedCompId = c.id;
        // Toggle tactile switch directly on body click
        if (hit.kind === 'comp' && c.kind === 'switch') {
          c.state.closed = !c.state.closed;
          sfxClick();
          this.recompute(false);
          this.renderUI();
          return;
        }
        if (hit.kind === 'pad') {
          const idx = this.conn.padItem.get(c)?.[hit.padIndex];
          this.selectedNet = idx !== undefined ? this.conn.net[idx] : -1;
        }
        this.activeTab = 'inspect';
        if (this.mobile) this.panelOpen = true; // no hover on touch: the inspector says what was tapped
        this.renderUI();
        return;
      }
      const n = netAt(this.board, this.conn, pt, side, xray);
      this.selectedNet = n ? n.net : -1;
      this.selectedCompId = null;
      this.renderUI();
      return;
    }

    if (this.activeTool === 'iron' && this.reworkMode.realistic && hit?.kind === 'pad' && hit.comp.state.populated) {
      // physical process: 1.5 s of tip contact; the monitor decides what the joint does
      if (!this.thermal) this.updateThermalPower();
      this.pushUndo();
      const g = this.reworkMode.flux ? IRON_G.flux : IRON_G.dry;
      if (this.reworkMode.flux) this.rework!.applyFlux(hit.pos[0], hit.pos[1], 2);
      this.thermal!.addSource({ kind: 'iron', x: hit.pos[0], y: hit.pos[1], temp: this.reworkMode.ironTemp, g, pmax: 60, until: this.thermal!.time + 1.5, partId: hit.comp.id });
      this.renderer.spawnSmoke(hit.pos[0], hit.pos[1], side, this.board.thickness, 'flux');
      return;
    }
    if (this.activeTool === 'hotair') {
      if (!this.thermal) this.updateThermalPower();
      this.thermal!.addSource({ kind: 'hotair', x: pt[0], y: pt[1], r: 4, temp: 400, h: HOTAIR_H.normal, until: this.thermal!.time + 3 });
      sfxClick();
      return;
    }
    if (this.activeTool === 'iron') {
      if (hit?.kind === 'pad') {
        const c = hit.comp;
        if (!c.state.populated) {
          this.selectedCompId = c.id;
          this.activeTab = 'inspect';
          if (this.mobile) this.panelOpen = true;
          this.toast(`${c.ref} footprint is empty — pick a replacement in Inspector!`, 'info');
          this.renderUI();
          return;
        }
        // a cold joint, or a cracked one (intermittent) even while it happens to conduct
        if (c.state.cold.includes(hit.padIndex) || c.state.intermittent?.some((f) => f.pad === hit.padIndex && f.kind !== 'thermal-leak')) {
          this.pushUndo();
          toggleCold(c, hit.padIndex);
          this.renderer.spawnSmoke(hit.pos[0], hit.pos[1], side, this.board.thickness, 'flux');
          sfxSolder();
          this.recompute(false);
          this.toast(`Reflowed cold solder joint on ${c.ref} pad ${c.pads[hit.padIndex].name}`, 'success');
          this.renderUI();
          return;
        }
      }
      if (hit?.kind === 'comp') {
        const c = hit.comp;
        if (!c.state.populated || c.state.burnt) {
          this.pushUndo();
          installPart(c, {
            value: c.value > 0 ? c.value : c.kind === 'resistor' ? 1000 : c.kind === 'fuse' ? 0.5 : c.value,
          });
          this.renderer.spawnSmoke(c.at[0], c.at[1], side, this.board.thickness, 'flux');
          sfxSolder();
          this.recompute(false);
          this.toast(`Soldered fresh ${c.ref} (${marking(c)})`, 'success');
          this.renderUI();
          return;
        }
        if (c.state.cold.length > 0) {
          this.pushUndo();
          c.state.cold = [];
          this.renderer.spawnSmoke(c.at[0], c.at[1], side, this.board.thickness, 'flux');
          sfxSolder();
          this.recompute(false);
          this.toast(`Reflowed all cold joints on ${c.ref}`, 'success');
          this.renderUI();
          return;
        }
      }
      // Drop a solder blob at pt (bridges small trace cuts / adjacent pads!)
      this.pushUndo();
      addBlob(this.board, pt, side, 0.75);
      this.renderer.spawnSmoke(pt[0], pt[1], side, this.board.thickness, 'flux');
      sfxSolder();
      this.recompute(false);
      this.renderUI();
      return;
    }

    if (this.activeTool === 'wick') {
      if (hit?.kind === 'blob') {
        this.pushUndo();
        removeBlob(this.board, hit.blob);
        this.renderer.spawnSmoke(hit.pos[0], hit.pos[1], side, this.board.thickness, 'flux');
        sfxSolder();
        this.recompute(false);
        this.toast('Wicked away solder bridge', 'success');
        this.renderUI();
        return;
      }
      if (hit?.kind === 'jumper') {
        this.pushUndo();
        removeJumper(this.board, hit.jumper);
        sfxCut();
        this.recompute(false);
        this.toast('Removed jumper wire', 'info');
        this.renderUI();
        return;
      }
      if (hit?.kind === 'comp' || hit?.kind === 'pad') {
        const c = hit.comp;
        if (c.state.populated && this.reworkMode.realistic && !this.rework?.isMolten(c)) {
          this.toast(`${c.ref}: joints are not molten — heat the part with hot air first (preheat helps on plane-heavy boards).`, 'info');
          return;
        }
        if (c.state.populated) {
          this.pushUndo();
          removePart(c);
          sfxSolder();
          this.recompute(false);
          this.toast(`Desoldered ${c.ref}`, 'info');
          this.renderUI();
        }
      }
      return;
    }

    if (this.activeTool === 'flip180') {
      const c = hit?.kind === 'comp' || hit?.kind === 'pad' ? hit.comp : null;
      if (c && c.state.populated) {
        this.pushUndo();
        c.state.reversed = !c.state.reversed;
        sfxClick();
        this.recompute(false);
        this.toast(`Flipped ${c.ref} 180°`, 'info');
        this.renderUI();
      }
      return;
    }

    if (this.activeTool === 'jumper') {
      const n = netAt(this.board, this.conn, pt, side, xray);
      const snap = n ? n.snap : pt;
      if (!this.jumperStart) {
        this.jumperStart = { a: snap, la: side };
        sfxClick();
        this.toast('Jumper start set — click destination (you can flip board F first!)', 'info');
        return;
      }
      if (dist(this.jumperStart.a, snap) < 0.3 && this.jumperStart.la === side) {
        this.jumperStart = null;
        return;
      }
      this.pushUndo();
      addJumper(this.board, this.jumperStart.a, this.jumperStart.la, snap, side);
      this.jumperStart = null;
      sfxSolder();
      this.recompute(false);
      this.renderUI();
      return;
    }

    if (this.activeTool === 'knife') {
      if (hit?.kind === 'trace') {
        this.pushUndo();
        cutTrace(this.board, hit.trace, pt, 0.7);
        sfxCut();
        this.recompute(false);
        this.toast('Cut copper trace', 'info');
        this.renderUI();
      } else if (hit?.kind === 'blob') {
        this.pushUndo();
        removeBlob(this.board, hit.blob);
        sfxCut();
        this.recompute(false);
        this.renderUI();
      } else if (hit?.kind === 'jumper') {
        this.pushUndo();
        removeJumper(this.board, hit.jumper);
        sfxCut();
        this.recompute(false);
        this.renderUI();
      }
      return;
    }

    if (this.activeTool === 'replace') {
      const c = hit?.kind === 'comp' || hit?.kind === 'pad' ? hit.comp : null;
      if (c) {
        this.selectedCompId = c.id;
        this.activeTab = 'inspect';
        this.panelOpen = true;
        this.layoutEl.classList.remove('panel-collapsed');
        this.renderUI();
        this.openPartsBin(c);
      } else {
        this.openPartsBin(null);
      }
      return;
    }
  }

  private toast(msg: string, kind: 'info' | 'success' | 'warn' | 'danger' = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    const text = this.txt(msg);
    const { lead, rest } = this.mobile ? splitLead(text) : { lead: text, rest: '' };
    if (!rest) el.textContent = text;
    else {
      // phone: the first sentence; "More" shows the rest and keeps the toast up longer
      const t = document.createElement('span');
      t.className = 'toast-txt';
      t.textContent = lead;
      const more = document.createElement('button');
      more.className = 'toast-more';
      more.textContent = 'More';
      more.addEventListener('click', () => { t.textContent = text; more.remove(); clearTimeout(timer); timer = setTimeout(() => el.remove(), 9000); });
      el.classList.add('has-more');
      el.append(t, more);
    }
    this.toastEl.appendChild(el);
    let timer = setTimeout(() => el.remove(), rest ? 6000 : 4500);
  }

  private updateTopButtons() {
    this.mount.querySelectorAll<HTMLButtonElement>('#seg-view button').forEach((b) => {
      b.classList.toggle('on', b.dataset.view === this.camera.mode);
    });
    this.mount.querySelectorAll<HTMLButtonElement>('#seg-side button').forEach((b) => {
      const activeKey = this.camera.bothSides ? 'both' : this.camera.side;
      b.classList.toggle('on', b.dataset.side === activeKey);
    });

    const pBtn = this.mount.querySelector('#btn-power')!;
    pBtn.classList.toggle('on', this.powerOn);
    pBtn.querySelector('.lbl')!.textContent = this.powerOn ? 'Power on' : 'Power off';

    const oBtn = this.mount.querySelector<HTMLElement>('#btn-invert-orbit')!;
    oBtn.classList.toggle('active', this.camera.invertOrbit);
    oBtn.title = this.camera.invertOrbit
      ? '3D orbit: inverted (drag moves the camera). Click for grab-and-turn.'
      : '3D orbit: grab-and-turn (board follows the drag). Click to invert.';

    const sBtn = this.mount.querySelector('#btn-sound')!;
    sBtn.innerHTML = icon(soundEnabled ? 'volume' : 'mute');

    const tBtn = this.mount.querySelector('#btn-tutorial')!;
    const tutBoard = isTutorialScenario(this.activeScenario.id);
    (tBtn as HTMLElement).hidden = !tutBoard; // shown only on tutorial boards
    tBtn.classList.toggle('active', this.tutorialOpen && tutBoard);

    if (this.mobile) {
      const set = (sel: string, html: string) => { const el = this.mount.querySelector<HTMLElement>(sel); if (el) el.innerHTML = html; };
      set('#m-mode', `<b>${this.camera.mode.toUpperCase()}</b>`);
      set('#m-flip', `${icon('layers', 16)}<b>${this.camera.bothSides ? 'BOTH' : this.camera.side === 'F' ? 'TOP' : 'BOT'}</b>`);
      set('#m-invert-lbl', this.camera.invertOrbit ? '3D drag moves the camera (tap: board follows)' : '3D drag turns the board (tap: camera moves)');
      set('#m-sound-ico', icon(soundEnabled ? 'volume' : 'mute', 16));
      set('#m-sound-lbl', soundEnabled ? 'Sound on' : 'Sound off');
      const tutRow = this.mount.querySelector<HTMLElement>('[data-proxy="#btn-tutorial"]');
      if (tutRow) tutRow.hidden = !tutBoard;
    }
    (this.mount.querySelector('#viz-select') as HTMLSelectElement).value = this.vizMode;
    (this.mount.querySelector('#ocp-select') as HTMLSelectElement).value = String(this.ocpAmps);
    (this.mount.querySelector('#solver-select') as HTMLSelectElement).value = this.solver;
  }

  private renderTopHud() {
    const coord = this.cursorWorld ? `${this.cursorWorld[0].toFixed(2)}, ${this.cursorWorld[1].toFixed(2)}` : '—';

    let psuItem = '';
    if (this.powerOn && this.sim?.source) {
      let totalI = 0;
      for (const c of this.board.components) {
        if (c.kind === 'battery') totalI += Math.max(0, this.sim.comps.get(c.id)?.i ?? 0);
      }
      const iStr = totalI >= 1 ? `${totalI.toFixed(2)} A` : `${(totalI * 1000).toFixed(1)} mA`;
      const cc = !!this.sim.ccLimited;
      psuItem = `<span class="sb-item ${cc ? 'warn' : ''}">Supply <span class="v">${iStr}${cc ? ' · CC' : ''}</span></span>`;
    }

    let hoverTxt = '';
    if (this.hovered) {
      if (this.hovered.kind === 'pad') {
        const c = this.hovered.comp;
        const p = c.pads[this.hovered.padIndex];
        const cold = c.state.cold.includes(this.hovered.padIndex) ? ' · cold joint' : '';
        // IR spot reading off bare metal: low emissivity, reads near room temperature
        const t = this.vizMode === 'thermal' ? this.thermal?.partTemp(c.id) : undefined;
        const ir = t !== undefined ? ` · IR ${apparentTemp(t, EMISSIVITY.metal).toFixed(0)} °C (bare metal, ε ${EMISSIVITY.metal})` : '';
        hoverTxt = `${c.ref}.${p.name}${cold}${ir}`;
      } else if (this.hovered.kind === 'comp') {
        const c = this.hovered.comp;
        const cSim = this.powerOn && this.sim ? this.sim.comps.get(c.id) : undefined;
        const temp = this.thermal?.partTemp(c.id) ?? 25 + (cSim ? cSim.p * (c.kind === 'resistor' ? 185 : c.kind === 'fuse' ? 240 : 130) : 0);
        const eps = c.kind === 'connector' ? EMISSIVITY.shell : EMISSIVITY.package;
        const tempStr = this.vizMode === 'thermal' ? ` · IR ${apparentTemp(temp, eps).toFixed(0)} °C` : '';
        hoverTxt = `${c.ref} · ${marking(c)}${tempStr}`;
      } else if (this.hovered.kind === 'trace') {
        hoverTxt = `Trace · ${this.hovered.trace.net ?? 'unnamed net'}`;
      } else if (this.hovered.kind === 'blob') {
        hoverTxt = 'Solder blob';
      } else if (this.hovered.kind === 'via') {
        hoverTxt = `Via · ${this.hovered.via.net ?? 'unnamed net'}`;
      } else if (this.hovered.kind === 'jumper') {
        hoverTxt = 'Jumper wire';
      }
    }
    const sideLabel = this.camera.bothSides
      ? `Both (${this.cursorSide === 'F' ? 'Top' : 'Bottom'})`
      : this.camera.side === 'F' ? 'Top' : 'Bottom';
    let pinCount = 0;
    for (const c of this.board.components) pinCount += c.pads.length;
    this.hudTopEl.innerHTML = `
      <span class="sb-item"><span class="sb-dot ${this.powerOn ? 'ok' : ''}"></span>${this.powerOn ? 'Powered' : 'Unpowered'}</span>
      ${psuItem}
      <span class="sb-item"><span class="v">${this.board.components.length} Comp · ${pinCount} Pins · ${this.conn.netCount} Nets</span></span>
      <span class="sb-item">Side <span class="v">${sideLabel}</span></span>
      <span class="sb-item">Cursor <span class="v">${coord} mm</span></span>
      ${hoverTxt ? `<span class="sb-item"><span class="v">${this.esc(hoverTxt)}</span></span>` : ''}
      ${this.authorMode ? `<span class="sb-item warn"><span class="sb-dot warn"></span>Author mode</span>` : ''}
    `;
  }

  private renderDmm() {
    const visible = this.activeTool === 'dmm' || this.probeRed !== null || this.probeBlack !== null;
    this.diodeLitIds = [];
    if (!visible) {
      this.dmmBoxEl.innerHTML = '';
      return;
    }
    let reading = '— . —';
    let sub = 'Place Red (+) and Black (−) probes';
    let numVal: number | null = null;

    if (this.dmmMode === 'V') {
      if (!this.powerOn) {
        reading = '0.000 V';
        sub = 'Supply off — enable power to measure DC voltage';
        numVal = 0;
      } else if (this.probeRed && this.probeRed.net >= 0 && this.sim?.source) {
        const niA = this.sim.nodeOfNet.get(this.probeRed.net);
        const va = niA !== undefined ? this.sim.V[niA] : null;
        let vb: number | null = 0;
        if (this.probeBlack) {
          if (this.probeBlack.net < 0) vb = null;
          else {
            const niB = this.sim.nodeOfNet.get(this.probeBlack.net);
            vb = niB !== undefined ? this.sim.V[niB] : null;
          }
        }
        if (va !== null && vb !== null) {
          const dv = va - vb;
          numVal = dv;
          if (this.solver !== 'fast') {
            const pr = this.probeRed.pos, pb = this.probeBlack?.pos;
            const d = displayVolts(dv, undefined, placementRng('V', pr[0].toFixed(1), pr[1].toFixed(1), pb?.[0].toFixed(1) ?? '', pb?.[1].toFixed(1) ?? ''));
            reading = `${(d.value ?? 0) >= 0 && d.text !== 'OL' ? '+' : ''}${d.text}`;
          } else reading = `${dv >= 0 ? '+' : ''}${dv.toFixed(3)} V`;
          sub = this.probeBlack ? 'Differential (Red − Black)' : 'Referenced to supply GND';
        } else {
          reading = 'FLOAT';
          sub = 'Floating node (open circuit)';
        }
      }
    } else if (this.dmmMode === 'CAP') {
      if (this.powerOn) {
        reading = 'ERR';
        sub = 'Disable power before measuring capacitance';
      } else if (this.probeRed && this.probeBlack) {
        const rd = this.meter('CAP', this.probeRed.net, this.probeBlack.net);
        reading = rd.text;
        numVal = rd.value ?? null;
        sub = rd.sub ?? (rd.value !== null ? `Capacitance across the probes${this.capValuesGuessed() ? ' (board data has no cap values: placeholder values)' : ''}` : '');
      } else {
        reading = '0.000 nF';
        sub = 'Place both probes across the part (power off)';
      }
    } else if (this.dmmMode === 'AMP') {
      if (!this.powerOn) {
        reading = '0.0 mA';
        sub = 'Supply off — the meter reads current only while powered';
      } else if (this.probeRed && this.probeBlack && this.probeRed.net >= 0 && this.probeBlack.net >= 0) {
        const rd = this.ammeterReading(this.probeRed.net, this.probeBlack.net);
        reading = rd.text;
        numVal = rd.value ?? null;
        sub = rd.sub ?? (this.probeRed.net === this.probeBlack.net ? 'Probes on one net: the copper carries the current, not the meter' : 'Meter in series (10 A input): lift a fuse / link and probe its pads to read the branch current');
      } else {
        reading = '0.0 mA';
        sub = 'Put the meter in series: probes on both pads of a removed fuse / 0 Ω link';
      }
    } else if (this.dmmMode === 'OHM') {
      if (this.powerOn) {
        reading = 'ERR';
        sub = 'Disable power before measuring resistance';
      } else if (this.probeRed && this.probeBlack) {
        if (this.probeRed.net < 0 || this.probeBlack.net < 0) {
          reading = 'OL';
          sub = 'Open circuit (probe not on copper)';
        } else {
          const rd = this.solver !== 'fast' ? this.meter('OHM', this.probeRed.net, this.probeBlack.net) : null;
          const r = rd ? rd.value ?? Infinity : this.ohms(this.probeRed.net, this.probeBlack.net);
          numVal = Number.isFinite(r) ? r : null;
          if (rd) {
            reading = rd.text;
            sub = rd.value === null ? (rd.sub ?? 'Open circuit (OL)') : rd.beep ? `Continuity beep (< 30 Ω) · ${rd.range} range` : `In-circuit resistance · ${rd.range} range`;
          } else if (!Number.isFinite(r)) {
            reading = 'OL';
            sub = 'Open circuit (no continuity)';
          } else {
            reading = r < 0.05 ? '0.0 Ω' : fmtOhm(r);
            sub = r < 5 ? 'Continuity (< 5 Ω)' : 'In-circuit resistance';
          }
        }
      }
    } else {
      // DIODE TEST MODE
      if (this.powerOn) {
        reading = 'ERR';
        sub = 'Disable power before diode test';
      } else if (this.probeRed && this.probeBlack) {
        if (this.probeRed.net < 0 || this.probeBlack.net < 0) {
          reading = 'OL';
          sub = 'Open or reverse-biased (> 3.3 V)';
        } else {
          const res = this.diodeTest(this.probeRed.net, this.probeBlack.net);
          this.diodeLitIds = res.litIds;
          const dd = this.solver !== 'fast' ? this.meter('DIODE', this.probeRed.net, this.probeBlack.net) : null;
          numVal = Number.isFinite(res.volts) ? res.volts : null;
          if (dd) {
            reading = dd.text;
            sub = dd.value === null ? 'Open or reverse-biased (OL)' : dd.value < 0.05 ? 'Shorted junction' : dd.value < 0.3 ? 'Low drop: Schottky / partial short' : 'Forward junction drop (ESD / body diode / PN)';
          } else if (!Number.isFinite(res.volts)) {
            reading = 'OL';
            sub = 'Open or reverse-biased (> 3.3 V)';
          } else if (res.volts < 0.05) {
            reading = `${res.volts.toFixed(3)} V`;
            sub = 'Shorted junction';
          } else {
            reading = `${res.volts.toFixed(3)} V`;
            sub = res.litIds.length > 0 ? 'Forward drop (LED illuminated)' : 'Forward junction drop';
          }
        }
      }
    }

    this.currentDmmNumericVal = numVal;

    if (this.dmmRel && this.dmmRelOffset !== null && numVal !== null) {
      const delta = numVal - this.dmmRelOffset;
      if (this.dmmMode === 'V' || this.dmmMode === 'DIODE') {
        reading = `${delta >= 0 ? '+' : ''}${delta.toFixed(3)} V`;
      } else if (this.dmmMode === 'OHM') {
        reading = Math.abs(delta) < 0.05 ? '0.0 Ω' : fmtOhm(Math.abs(delta));
      } else if (this.dmmMode === 'CAP') {
        reading = fmtSI(Math.max(0, delta), 'F');
      } else if (this.dmmMode === 'AMP') {
        reading = `${(delta * 1000).toFixed(1)} mA`;
      }
      sub = `Δ Rel (${this.dmmRelOffset.toFixed(3)} ref) · ${sub}`;
    }

    if (this.dmmHold) {
      if (!this.dmmHoldVal) {
        this.dmmHoldVal = { reading, sub };
      }
      reading = this.dmmHoldVal.reading;
      sub = this.dmmHoldVal.sub;
    } else {
      this.dmmHoldVal = null;
    }

    this.dmmBoxEl.innerHTML = `
      <div class="dmm-card${this.mobile && this.dmmSubFull ? ' full' : ''}" style="transform: translate3d(${this.dmmPos[0]}px, ${this.dmmPos[1]}px, 0)">
        <div class="dmm-head" title="Drag to move window">
          <span>Multimeter</span>
          <div class="row">
            <div class="seg">
              <button class="${this.dmmMode === 'V' ? 'on' : ''}" id="dmm-v" title="DC voltage">V⎓</button>
              <button class="${this.dmmMode === 'OHM' ? 'on' : ''}" id="dmm-ohm" title="Resistance / continuity">Ω</button>
              <button class="${this.dmmMode === 'DIODE' ? 'on' : ''}" id="dmm-diode" title="Diode test">Diode</button>
              <button class="${this.dmmMode === 'CAP' ? 'on' : ''}" id="dmm-cap" title="Capacitance (power off)">F</button>
              <button class="${this.dmmMode === 'AMP' ? 'on' : ''}" id="dmm-amp" title="Current, 10 A input (meter in series)">A</button>
            </div>
            <div class="seg">
              <button class="${this.dmmHold ? 'on' : ''}" id="dmm-hold" title="Hold reading (D)">HOLD</button>
              <button class="${this.dmmRel ? 'on' : ''}" id="dmm-rel" title="Relative zero offset (U)">REL Δ</button>
            </div>
            <button class="btn ghost icon" id="dmm-clr" title="Clear probes">${icon('x', 14)}</button>
          </div>
        </div>
        <div class="dmm-lcd">
          ${(this.dmmHold || this.dmmRel) ? `
          <div class="dmm-annunciators">
            ${this.dmmHold ? '<span class="dmm-badge hold">HOLD</span>' : ''}
            ${this.dmmRel ? '<span class="dmm-badge rel">Δ REL</span>' : ''}
          </div>` : ''}
          <div class="dmm-val">${this.esc(reading)}</div>
          <div class="dmm-sub">${this.esc(sub)}</div>
        </div>
        ${this.mobile ? `
        <div class="dmm-probes m-probes">
          <button class="probe-tag red ${this.activeProbe === 'red' ? 'armed' : ''}" id="probe-red">${this.esc(this.probeRed?.label ?? (this.activeProbe === 'red' ? 'Tap the board' : 'Red probe'))}</button>
          <button class="probe-tag blk ${this.activeProbe === 'black' ? 'armed' : ''}" id="probe-blk">${this.esc(this.probeBlack?.label ?? (this.activeProbe === 'black' ? 'Tap the board' : this.dmmMode === 'V' ? 'Supply GND' : 'Black probe'))}</button>
        </div>` : `
        <div class="dmm-probes">
          <div class="probe-tag red" title="${this.esc(this.probeRed?.label ?? '')}">${this.esc(this.probeRed?.label ?? 'Click to place')}</div>
          <div class="probe-tag blk" title="${this.esc(this.probeBlack?.label ?? '')}">${this.esc(this.probeBlack?.label ?? (this.dmmMode === 'V' ? 'Supply GND' : 'Right-click'))}</div>
        </div>`}
      </div>
    `;

    this.dmmBoxEl.querySelector('#dmm-v')!.addEventListener('click', () => {
      this.dmmMode = 'V';
      this.dmmHold = false;
      this.dmmHoldVal = null;
      this.dmmRel = false;
      this.dmmRelOffset = null;
      this.renderDmm();
      this.renderTutorial();
    });
    this.dmmBoxEl.querySelector('#dmm-ohm')!.addEventListener('click', () => {
      this.dmmMode = 'OHM';
      this.dmmHold = false;
      this.dmmHoldVal = null;
      this.dmmRel = false;
      this.dmmRelOffset = null;
      this.checkContinuityBeep();
      this.renderDmm();
      this.renderTutorial();
    });
    this.dmmBoxEl.querySelector('#dmm-diode')!.addEventListener('click', () => {
      this.dmmMode = 'DIODE';
      this.dmmHold = false;
      this.dmmHoldVal = null;
      this.dmmRel = false;
      this.dmmRelOffset = null;
      this.renderDmm();
      this.renderTutorial();
    });
    for (const [id, mode] of [['#dmm-cap', 'CAP'], ['#dmm-amp', 'AMP']] as const) {
      this.dmmBoxEl.querySelector(id)!.addEventListener('click', () => {
        this.dmmMode = mode;
        this.dmmHold = false;
        this.dmmHoldVal = null;
        this.dmmRel = false;
        this.dmmRelOffset = null;
        this.renderDmm();
        this.renderTutorial();
      });
    }
    this.dmmBoxEl.querySelector('#dmm-hold')?.addEventListener('click', () => this.toggleDmmHold());
    this.dmmBoxEl.querySelector('#dmm-rel')?.addEventListener('click', () => this.toggleDmmRel(numVal));
    if (this.mobile) this.dmmBoxEl.querySelector('.dmm-lcd')?.addEventListener('click', () => { this.dmmSubFull = !this.dmmSubFull; this.renderDmm(); });
    for (const [id, which] of [['#probe-red', 'red'], ['#probe-blk', 'black']] as const) {
      this.dmmBoxEl.querySelector(id)?.addEventListener('click', () => {
        this.activeProbe = which;
        this.activeProbeAuto = false;
        this.renderDmm();
      });
    }
    this.dmmBoxEl.querySelector('#dmm-clr')!.addEventListener('click', () => {
      this.probeRed = null;
      this.probeBlack = null;
      this.activeProbe = 'red';
      this.activeProbeAuto = false;
      this.dmmHold = false;
      this.dmmHoldVal = null;
      this.renderDmm();
      this.renderTutorial();
    });
  }

  private toggleDmmHold() {
    this.dmmHold = !this.dmmHold;
    if (!this.dmmHold) this.dmmHoldVal = null;
    sfxClick();
    this.toast(this.dmmHold ? 'DMM Data Hold (zamrożono odczyt)' : 'DMM Data Hold released', 'info');
    this.renderDmm();
  }

  private toggleDmmRel(val?: number | null) {
    if (this.dmmRel) {
      this.dmmRel = false;
      this.dmmRelOffset = null;
      this.toast('DMM Relative offset wyzerowany', 'info');
    } else if (val !== null && val !== undefined && Number.isFinite(val)) {
      this.dmmRel = true;
      this.dmmRelOffset = val;
      const refStr = this.dmmMode === 'OHM' ? fmtOhm(val) : val.toFixed(3);
      this.toast(`DMM Relative reference: ${refStr} (Null/Zero)`, 'info');
    } else {
      this.toast('Przyłóż sondy, aby ustalić punkt zerowy (Rel)', 'info');
      return;
    }
    sfxClick();
    this.renderDmm();
  }

  private renderUI() {
    if (this.mobile) this.layoutEl.classList.toggle('panel-collapsed', !this.panelOpen);
    this.updateTopButtons();
    this.renderTopHud();
    this.renderDmm();
    this.renderTutorial();
    this.mount.querySelectorAll<HTMLButtonElement>('.tab[data-tab]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === this.activeTab);
    });
    this.renderSideBody();
  }

  /**
   * Tutorial card on a phone: the step title and a short task (`TutorialStep.phone`) first; the
   * explanation waits behind "Why?" so the card leaves the board visible.
   */
  private phoneTutorialHtml(step: TutorialStep, idx: number, total: number, tutIdx: number, done: boolean, pct: number, isLast: boolean, nextPrimary: boolean, nextId: string | null): string {
    const why = this.tutWhy === `${this.activeScenario.id}:${idx}`;
    const task = step.phone ?? this.txt(step.task);
    return `
      <div class="tut-card m-tut${this.tutCollapsed ? ' collapsed' : ''}">
        <div class="tut-head" title="Tap to fold / unfold">
          <span class="tut-step">${icon(this.tutCollapsed ? 'chevronDown' : 'book', 13)}<span>${tutIdx >= 0 ? `Lesson ${tutIdx + 1} · ` : ''}${idx + 1}/${total}${this.tutCollapsed ? ` · ${this.esc(step.title)}` : ''}</span></span>
          <button class="btn ghost icon sm" id="tut-close" title="Close tutorial">${icon('x', 13)}</button>
        </div>
        <div class="tut-prog"><i style="width:${pct}%"></i></div>
        <div class="tut-body">
          <div class="tut-title"><span>${this.esc(step.title)}</span><span class="row">${done ? `<span class="badge pass">${icon('check', 11)}<span>Done</span></span>` : ''}<button class="btn sm ghost ${why ? 'active' : ''}" id="tut-why">${icon('help', 12)}<span>${why ? 'Hide' : 'Why?'}</span></button></span></div>
          ${why ? `<div class="tut-concept">${this.esc(this.txt(step.concept))}</div>` : ''}
          <div class="tut-goal ${done ? 'done' : ''}"><div class="tut-goal-txt">${this.esc(task)}</div></div>
          ${step.target || step.quickAction ? `<div class="row wrap">
            ${step.target ? `<button class="btn sm" id="tut-focus">${icon('target', 12)}<span>Locate</span></button>` : ''}
            ${step.quickAction ? `<button class="btn sm" id="tut-quick">${this.esc(this.txt(step.quickAction.label))}</button>` : ''}
          </div>` : ''}
        </div>
        <div class="tut-foot">
          <button class="btn sm ghost" id="tut-prev" ${idx === 0 ? 'disabled' : ''}>${icon('chevronLeft', 13)}<span>Back</span></button>
          <div class="row">
            <button class="btn sm ${nextPrimary ? 'primary' : ''}" id="tut-next"><span>${isLast ? (done ? 'Finish' : 'Done') : 'Next'}</span>${isLast ? '' : icon('chevronRight', 13)}</button>
            ${isLast && done && nextId ? `<button class="btn sm primary" id="tut-next-board"><span>Next lesson</span>${icon('chevronRight', 13)}</button>` : ''}
          </div>
        </div>
      </div>`;
  }

  private renderTutorial() {
    const steps = getTutorialSteps(this.activeScenario.id);
    if (!this.tutorialOpen || !steps) {
      this.tutBoxEl.innerHTML = '';
      return;
    }
    const total = steps.length;
    const idx = Math.max(0, Math.min(total - 1, this.tutorialStep));
    const step = steps[idx];
    const done = step.isDone({
      scenarioId: this.activeScenario.id,
      board: this.board,
      conn: this.conn,
      cameraMode: this.camera.mode,
      cameraSide: this.camera.side,
      vizMode: this.vizMode,
      powerOn: this.powerOn,
      activeTool: this.activeTool,
      selectedCompId: this.selectedCompId,
      dmmMode: this.dmmMode,
      probeRed: this.probeRed,
      probeBlack: this.probeBlack,
      revealedFlag: this.revealedFlag,
    });
    const pct = Math.round(((idx + 1) / total) * 100);
    const isLast = idx === total - 1;
    const tutIdx = TUTORIAL_SCENARIO_IDS.indexOf(this.activeScenario.id as (typeof TUTORIAL_SCENARIO_IDS)[number]);
    const nextId = nextTutorialScenarioId(this.activeScenario.id);
    const nextPrimary = isLast ? !(done && nextId) : done;

    this.tutBoxEl.innerHTML = this.mobile ? this.phoneTutorialHtml(step, idx, total, tutIdx, done, pct, isLast, nextPrimary, nextId) : `
      <div class="tut-card${this.mobile && this.tutCollapsed ? ' collapsed' : ''}" style="transform: translate3d(${this.tutPos[0]}px, ${this.tutPos[1]}px, 0)">
        <div class="tut-head" title="${this.mobile ? 'Tap to fold / unfold' : 'Drag to move window'}">
          <span class="tut-step">${icon(this.mobile ? (this.tutCollapsed ? 'chevronDown' : 'book') : 'book', 13)}<span>Tutorial ${tutIdx >= 0 ? `${tutIdx + 1}/${TUTORIAL_SCENARIO_IDS.length} · ` : ''}Step ${idx + 1} / ${total}${this.mobile && this.tutCollapsed ? ` · ${this.esc(step.title)}` : ''}</span></span>
          <button class="btn ghost icon sm" id="tut-close" title="Close tutorial">${icon('x', 13)}</button>
        </div>
        <div class="tut-prog"><i style="width:${pct}%"></i></div>
        <div class="tut-body">
          <div class="tut-title">${this.esc(this.txt(step.title))}</div>
          <div class="tut-concept">${this.esc(this.txt(step.concept))}</div>
          <div class="tut-goal ${done ? 'done' : ''}">
            <div class="tut-goal-head">
              <span>${done ? 'Step complete' : 'Your turn'}</span>
              ${done ? `<span class="badge pass">${icon('check', 11)}<span>Done</span></span>` : ''}
            </div>
            <div class="tut-goal-txt">${this.esc(this.txt(step.task))}</div>
            ${step.target || step.quickAction ? `
              <div class="row wrap" style="margin-top:2px">
                ${step.target ? `<button class="btn sm" id="tut-focus">${icon('target', 12)}<span>Locate on board</span></button>` : ''}
                ${step.quickAction ? `<button class="btn sm" id="tut-quick">${this.esc(this.txt(step.quickAction.label))}</button>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
        <div class="tut-foot">
          <button class="btn sm ghost" id="tut-prev" ${idx === 0 ? 'disabled' : ''}>${icon('chevronLeft', 13)}<span>Back</span></button>
          <div class="row">
            <button class="btn sm ${nextPrimary ? 'primary' : ''}" id="tut-next">
              <span>${isLast ? (done ? 'Finish' : 'Done') : 'Next step'}</span>${isLast ? '' : icon('chevronRight', 13)}
            </button>
            ${isLast && done && nextId ? `
              <button class="btn sm primary" id="tut-next-board">
                <span>Next tutorial</span>${icon('chevronRight', 13)}
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    if (this.mobile) {
      this.tutBoxEl.querySelector('#tut-why')?.addEventListener('click', () => {
        const key = `${this.activeScenario.id}:${idx}`;
        this.tutWhy = this.tutWhy === key ? '' : key;
        this.renderTutorial();
      });
      this.tutBoxEl.querySelector('.tut-head')?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        this.tutCollapsed = !this.tutCollapsed;
        this.renderTutorial();
      });
    }
    this.tutBoxEl.querySelector('#tut-close')?.addEventListener('click', () => {
      this.tutorialOpen = false;
      localStorage.setItem('pcbfix_tut_dismissed', '1');
      this.renderUI();
    });
    this.tutBoxEl.querySelector('#tut-prev')?.addEventListener('click', () => {
      this.tutorialStep = Math.max(0, idx - 1);
      this.renderTutorial();
    });
    this.tutBoxEl.querySelector('#tut-next')?.addEventListener('click', () => {
      if (isLast) {
        this.tutorialOpen = false;
        localStorage.setItem('pcbfix_tut_dismissed', '1');
        this.renderUI();
      } else {
        this.tutorialStep = Math.min(total - 1, idx + 1);
        this.renderTutorial();
      }
    });
    this.tutBoxEl.querySelector('#tut-next-board')?.addEventListener('click', () => {
      if (!nextId) return;
      const nextIdx = this.scenarios.findIndex((s) => s.id === nextId);
      if (nextIdx >= 0) {
        localStorage.removeItem('pcbfix_tut_dismissed');
        this.tutorialOpen = true;
        this.tutorialStep = 0;
        void this.openScenario(nextIdx);
      }
    });
    this.tutBoxEl.querySelector('#tut-focus')?.addEventListener('click', () => {
      if (!step.target) return;
      this.camera.focusAt(step.target.pos[0], step.target.pos[1], step.target.zoomHalfH, step.target.side);
      this.updateTopButtons();
      this.renderTopHud();
    });
    this.tutBoxEl.querySelector('#tut-quick')?.addEventListener('click', () => {
      const qa = step.quickAction?.id;
      if (!qa) return;
      const setDmm = (powerOn: boolean, dmmMode: DmmMode) => {
        this.powerOn = powerOn;
        this.dmmMode = dmmMode;
        this.setTool('dmm');
        this.recompute(false);
        this.renderUI();
      };
      const flipTo = (side: Side) => {
        this.camera.bothSides = false;
        this.camera.setSide(side);
        this.renderUI();
      };
      const actions: Record<string, () => void> = {
        'view-3d': () => { this.camera.setMode('3d'); this.renderUI(); },
        'viz-heatmap': () => { this.vizMode = 'heatmap'; this.renderUI(); },
        'flip-bottom': () => flipTo('B'),
        'flip-top': () => flipTo('F'),
        'tool-inspect': () => this.setTool('inspect'),
        'tool-dmm': () => this.setTool('dmm'),
        'tool-iron': () => this.setTool('iron'),
        'tool-wick': () => this.setTool('wick'),
        'tool-flip180': () => this.setTool('flip180'),
        'tool-replace': () => this.setTool('replace'),
        'prep-ohm': () => setDmm(false, 'OHM'),
        'prep-diode': () => setDmm(false, 'DIODE'),
        'prep-volt': () => setDmm(true, 'V'),
        'power-on': () => { if (!this.powerOn) this.togglePower(); },
        'run-verify': () => { void this.runVerify(); },
      };
      actions[qa]?.();
    });
  }

  private renderSideBody() {
    if (this.activeTab === 'mission') this.renderMissionTab();
    else if (this.activeTab === 'inspect') this.renderInspectTab();
    else this.renderStudioTab();
    if (this.mobile) {
      this.sideBodyEl.querySelectorAll<HTMLElement>('.callout').forEach((c) => {
        c.classList.toggle('open', this.openNotes.has(c.querySelector('.h')?.textContent ?? ''));
      });
    }
  }

  private renderMissionTab() {
    const s = this.activeScenario;
    const isPl = getLang() === 'pl';
    const tr = translateScenario(s.id, s.meta.title, s.meta.description);
    const hints = i18n().scenarios[s.id]?.hints ?? s.meta.hints;
    const v = this.lastVerify;
    const inTutTrack = isTutorialScenario(s.id);

    this.sideBodyEl.innerHTML = `
      <div class="card">
        <div class="card-title lg">
          <span>${this.esc(tr.title)}</span>
          <span class="badge info">${this.moves}${s.meta.par ? ` / ${s.meta.par}` : ''} ${isPl ? 'ruchów' : 'moves'}</span>
        </div>
        <div class="row" style="justify-content:space-between">
          <span class="muted">${isPl ? 'Autor' : 'By'}: ${this.esc(s.meta.author)}</span>
          <span class="lvl" title="Difficulty ${s.meta.difficulty}/5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= s.meta.difficulty ? 'on' : ''}"></i>`).join('')}</span>
        </div>
        <div class="text-2">${this.esc(this.txt(tr.description))}</div>
        ${s.meta.credits ? `
          <div class="credits">
            <span>${this.esc(s.meta.credits)}</span>
            <span class="mono">${s.meta.license ? `Licence: ${this.esc(s.meta.license)}` : ''}${s.meta.source ? ` · <a href="${this.esc(s.meta.source.split(' @ ')[0])}" target="_blank" rel="noopener">source${s.meta.source.includes(' @ ') ? ` @ ${this.esc(s.meta.source.split(' @ ')[1])}` : ''}</a>` : ''}</span>
          </div>
        ` : ''}
        ${this.modBoards.get(s)?.schematic ? `
          <div class="row wrap" style="margin-top:8px">
            <button class="btn sm" id="open-schematic">${icon('book', 12)}<span>${isPl ? 'Schemat ideowy' : 'Schematic'}</span></button>
            <span class="muted">from the mod "${this.esc(this.modBoards.get(s)!.mod.name)}"</span>
          </div>
        ` : ''}
        ${this.videos[s.id] ? `
          <div class="walkthrough">
            <span class="walk-title">${isPl ? 'Wideo instruktażowe' : 'Walkthrough'}</span>
            <div class="row wrap">
              <button class="btn sm primary" id="vid-approach">${icon('play', 12)}<span>${isPl ? 'Jak podejść do problemu' : 'How to approach'} · ${fmtDur(this.videos[s.id].approach.seconds)}</span></button>
              <button class="btn sm" id="vid-solution">${isPl ? 'Pokaż rozwiązanie' : 'Show solution'}</button>
            </div>
          </div>
        ` : ''}
        ${!this.tutorialOpen && inTutTrack ? `
          <button class="btn sm block" id="btn-start-tut">${icon('book', 13)}<span>${isPl ? 'Uruchom interaktywny samouczek' : 'Start interactive beginner tutorial'}</span></button>
        ` : ''}
        ${!inTutTrack ? `
          <button class="btn sm block" id="btn-open-catalog">${icon('grid', 13)}<span>${isPl ? 'Przeglądaj wszystkie płytki i zadania' : 'Browse all boards &amp; tutorials'}</span></button>
        ` : ''}
      </div>

      ${inTutTrack ? `
        <div class="card">
          <div class="card-title">
            <span>${isPl ? 'Ścieżka dla początkujących' : 'Beginner tutorial track'}</span>
            <div class="row">
              <span class="badge info">${TUTORIAL_SCENARIO_IDS.filter((id) => this.solvedIds.has(id)).length}/${TUTORIAL_SCENARIO_IDS.length}</span>
              <button class="btn sm" id="btn-open-catalog">${isPl ? 'Wszystkie płytki' : 'All boards'}</button>
            </div>
          </div>
          <div class="stack">
            ${TUTORIAL_SCENARIO_IDS.map((id, idx) => {
              const scIdx = this.scenarios.findIndex((x) => x.id === id);
              const scItem = scIdx >= 0 ? this.scenarios[scIdx] : null;
              if (!scItem) return '';
              const isCur = id === s.id;
              const isDone = this.solvedIds.has(id);
              const scTr = translateScenario(scItem.id, scItem.meta.title, scItem.meta.description);
              return `
                <button class="list-btn" data-open-sc="${scIdx}" style="${isCur ? 'background:var(--accent-weak);border:1px solid var(--accent-line)' : ''}">
                  <span><b>${idx + 1}.</b> ${this.esc(scTr.title)}</span>
                  ${isDone ? `<span class="badge pass">${isPl ? 'Zrobione' : 'Done'}</span>` : isCur ? `<span class="badge info">${isPl ? 'Aktywna' : 'Active'}</span>` : `<span class="sub">L1</span>`}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${this.revealedFlag ? `
        <div class="flag-box">
          <div class="card-title" style="color:var(--accent)">
            <span class="row">${icon('flag', 14)}<span>${isPl ? 'Flaga odblokowana!' : 'Flag unlocked'}</span></span>
            <button class="btn sm" id="btn-copy-flag">${icon('copy', 13)}<span>${isPl ? 'Kopiuj' : 'Copy'}</span></button>
          </div>
          <div class="flag-code" id="flag-txt">${this.esc(this.revealedFlag)}</div>
        </div>
      ` : ''}

      <div class="card">
        <div class="card-title">
          <span>${isPl ? 'Cele testowe' : 'Objectives'}</span>
          <button class="btn sm primary" id="btn-panel-verify">${icon('play', 12)}<span>${isPl ? 'Uruchom testy' : 'Run tests'}</span></button>
        </div>
        ${s.objectives.length === 0 ? `<div class="muted">${isPl ? 'Brak zdefiniowanych celów.' : 'No objectives defined.'}</div>` : ''}
        ${(v ? v.results : s.objectives.map((o) => ({
          objective: o,
          label: o.type === 'led' ? `${o.ref} ${isPl ? (o.on ? 'musi ŚWIECIĆ' : 'musi być ZGASZONA') : `must be ${o.on ? 'ON' : 'OFF'}`}` : `V(${o.a}${o.b ? `−${o.b}` : ''}) ∈ [${o.min}, ${o.max}] V`,
          passed: false,
          detail: isPl ? 'Uruchom testy, aby sprawdzić' : 'Run tests to verify',
        }))).map((r) => `
          <div class="obj-row ${v ? (r.passed ? 'pass' : 'fail') : ''}">
            <div>
              <div class="t">${this.esc(r.label)}</div>
              <div class="d">${this.esc(r.detail)}</div>
            </div>
            ${v ? `<span class="badge ${r.passed ? 'pass' : 'fail'}">${r.passed ? (isPl ? 'Zaliczono' : 'Pass') : (isPl ? 'Błąd' : 'Fail')}</span>` : ''}
          </div>
        `).join('')}
        ${v && v.overloads.length > 0 ? `
          <div class="obj-row fail">
            <div>
              <div class="t">${isPl ? 'Przeciążenie termiczne / prądowe' : 'Thermal / current overload'}</div>
              <div class="d">${v.overloads.map((o) => `${this.esc(o.ref)}: ${this.esc(o.msg)}`).join('; ')}</div>
            </div>
            <span class="badge fail">${isPl ? 'Usterka' : 'Fault'}</span>
          </div>
        ` : ''}
      </div>

      ${hints && hints.length > 0 ? `
        <div class="card">
          <div class="card-title">
            <span>${isPl ? 'Wskazówki' : 'Notes'} (${this.hintsShown}/${hints.length})</span>
            ${this.hintsShown < hints.length ? `<button class="btn sm" id="btn-next-hint">${isPl ? 'Odkryj wskazówkę' : 'Reveal note'}</button>` : ''}
          </div>
          ${hints.slice(0, this.hintsShown).map((h, i) => `
            <div class="hint-item"><b>${i + 1}.</b> ${this.esc(this.txt(h))}</div>
          `).join('')}
          ${this.hintsShown === 0 ? `<div class="muted">${isPl ? 'Dostępne są progresywne wskazówki laboratoryjne.' : 'Progressive diagnostic notes are available if needed.'}</div>` : ''}
        </div>
      ` : ''}
    `;

    this.sideBodyEl.querySelector('#btn-panel-verify')?.addEventListener('click', () => void this.runVerify());
    this.sideBodyEl.querySelector('#btn-start-tut')?.addEventListener('click', () => this.startTutorial());
    this.sideBodyEl.querySelector('#btn-open-catalog')?.addEventListener('click', () => this.openBoardCatalog());
    this.sideBodyEl.querySelectorAll<HTMLButtonElement>('[data-open-sc]').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.openSc);
        if (this.scenarios[idx]) void this.openScenario(idx);
      });
    });
    this.sideBodyEl.querySelector('#open-schematic')?.addEventListener('click', () => void this.openSchematic(s));
    this.sideBodyEl.querySelector('#vid-approach')?.addEventListener('click', () => this.playVideo(s.id, 'approach'));
    const sol = this.sideBodyEl.querySelector<HTMLButtonElement>('#vid-solution');
    sol?.addEventListener('click', () => {
      // solutions spoil the challenge: a second, deliberate click plays it
      if (sol.dataset.armed) { this.playVideo(s.id, 'solution'); return; }
      sol.dataset.armed = '1';
      sol.classList.add('warn');
      sol.textContent = `Spoilers ahead — play solution (${fmtDur(this.videos[s.id].solution.seconds)})`;
    });
    this.sideBodyEl.querySelector('#btn-next-hint')?.addEventListener('click', () => {
      this.hintsShown = Math.min(hints.length, this.hintsShown + 1);
      this.renderMissionTab();
    });
    this.sideBodyEl.querySelector('#btn-copy-flag')?.addEventListener('click', async () => {
      if (this.revealedFlag) {
        await navigator.clipboard?.writeText(this.revealedFlag);
        this.toast('Flag copied to clipboard', 'success');
      }
    });
  }

  private getInspectPanel(): InspectPanelController {
    if (!this.inspectPanel) {
      this.inspectPanel = new InspectPanelController({
        getBoard: () => this.board,
        getConn: () => this.conn,
        getSim: () => this.sim,
        isPowerOn: () => this.powerOn,
        getSelectedCompId: () => this.selectedCompId,
        getSelectedNet: () => this.selectedNet,
        getCompSearch: () => this.compSearch,
        isAuthorMode: () => this.authorMode,
        getFaultClass: () => this.faultClass,
        getSolver: () => this.solver,
        getCamera: () => this.camera,
        getSideBodyEl: () => this.sideBodyEl,

        esc: (s) => this.esc(s),
        toast: (msg, kind) => this.toast(msg, kind),
        pushUndo: () => this.pushUndo(),
        recompute: (full) => this.recompute(full),
        renderUI: () => this.renderUI(),
        openPartsBin: (c) => this.openPartsBin(c),
        environment: () => this.environment(),
        setSelectedCompId: (id) => {
          this.selectedCompId = id;
        },
        setCompSearch: (q) => {
          this.compSearch = q;
        },
        setFaultClass: (cls) => {
          this.faultClass = cls;
        },
      });
    }
    return this.inspectPanel;
  }

  private renderInspectTab() {
    this.getInspectPanel().render();
  }

  private environment() {
    const th = this.thermal;
    return { partTemp: (id: string) => th?.partTemp(id), flexAt: (x: number, y: number) => this.flex.at(x, y) };
  }

  private renderStudioTab() {
    const s = this.activeScenario;
    const leds = this.board.components.filter((c) => c.kind === 'led').map((c) => c.ref);
    const probes = this.board.components.map((c) => c.ref);
    const faulted = this.board.components.map((c) => ({ c, faults: listFaults(c) })).filter((x) => x.faults.length);

    this.sideBodyEl.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>Scenario metadata</span>
          <span class="badge info">${this.refLockedHash ? `#${this.refLockedHash}` : s.lock ? 'Locked' : 'Draft'}</span>
        </div>
        <div class="muted">
          1. Build, repair, or import a working board.<br/>
          2. Define objectives and lock a reference flag.<br/>
          3. Inject faults, then export JSON or copy a share link.
        </div>
        <div class="field">
          <label>Title</label>
          <input type="text" id="st-title" value="${this.esc(s.meta.title)}" />
        </div>
        <div class="grid-2">
          <div class="field">
            <label>Author</label>
            <input type="text" id="st-author" value="${this.esc(s.meta.author)}" />
          </div>
          <div class="field">
            <label>Difficulty (1–5)</label>
            <input type="number" min="1" max="5" id="st-diff" value="${s.meta.difficulty}" />
          </div>
        </div>
        <div class="field">
          <label>Description</label>
          <textarea id="st-desc" rows="2">${this.esc(s.meta.description)}</textarea>
        </div>
        <div class="field">
          <label>Diagnostic notes (one per line)</label>
          <textarea id="st-hints" rows="2">${this.esc(s.meta.hints.join('\n'))}</textarea>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Objectives (${s.objectives.length})</div>
        ${s.objectives.map((o, i) => `
          <div class="obj-row">
            <span class="mono">
              ${o.type === 'led' ? `LED ${o.ref} = ${o.on ? 'ON' : 'OFF'}` : `V(${o.a}) ∈ [${o.min}, ${o.max}] V`}
            </span>
            <button class="btn ghost icon sm" data-del-obj="${i}" title="Remove">${icon('x', 12)}</button>
          </div>
        `).join('')}
        <div class="row">
          <select class="grow" id="st-obj-ref">
            ${(leds.length ? leds : probes).map((r) => `<option value="${r}">${r}</option>`).join('')}
          </select>
          <button class="btn sm" id="st-add-led">Add LED on</button>
        </div>
        <div class="row">
          <input type="number" step="0.1" id="st-vmin" value="2.3" style="width:72px" placeholder="min V" />
          <input type="number" step="0.1" id="st-vmax" value="2.7" style="width:72px" placeholder="max V" />
          <button class="btn sm grow" id="st-add-v">Add V range</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Verification & fault mode</div>
        <div class="field">
          <label>CTF flag</label>
          <input type="text" id="st-flag" value="${this.esc(this.studioFlagInput)}" />
        </div>
        <button class="btn sm primary block" id="st-lock">${icon('lock', 13)}<span>Lock reference topology & flag</span></button>
        <button class="btn sm block ${this.authorMode ? 'warn' : ''}" id="st-author-mode">
          ${this.authorMode ? 'Fault injection active' : 'Enable fault injection'}
        </button>
      </div>

      <div class="card">
        <div class="card-title">Injected faults (${faulted.reduce((n, x) => n + x.faults.length, 0)})</div>
        ${faulted.length ? faulted.map(({ c, faults }) => `
          <button class="btn ghost sm block" data-goto-fault="${this.esc(c.id)}" style="display:block;text-align:left;height:auto;padding:4px 6px;white-space:normal;overflow-wrap:anywhere">
            <b class="mono">${this.esc(c.ref)}</b>
            ${faults.map((f) => `<div class="muted" style="font-size:11px">${this.esc(f.label)}</div>`).join('')}
          </button>
        `).join('') : `<div class="muted">None yet. Enable fault injection, select a part (Inspect tab) and inject a fault.</div>`}
      </div>

      <div class="card">
        <div class="card-title">Export</div>
        <div class="grid-2">
          <button class="btn sm primary" id="st-export-json">${icon('download', 13)}<span>Export JSON</span></button>
          <button class="btn sm" id="st-share-url">${icon('link', 13)}<span>Copy link</span></button>
          <button class="btn sm" id="st-export-mod" style="grid-column:span 2" title="A .zip others can install from Boards → Mods">${icon('box', 13)}<span>Export as mod (.zip)</span></button>
        </div>
      </div>
    `;

    const syncMeta = () => {
      s.meta.title = (this.sideBodyEl.querySelector('#st-title') as HTMLInputElement).value.trim() || 'Untitled';
      s.meta.author = (this.sideBodyEl.querySelector('#st-author') as HTMLInputElement).value.trim() || 'anonymous';
      s.meta.difficulty = Math.max(1, Math.min(5, Number((this.sideBodyEl.querySelector('#st-diff') as HTMLInputElement).value) || 2));
      s.meta.description = (this.sideBodyEl.querySelector('#st-desc') as HTMLTextAreaElement).value;
      s.meta.hints = (this.sideBodyEl.querySelector('#st-hints') as HTMLTextAreaElement).value.split('\n').map((x) => x.trim()).filter(Boolean);
      this.refreshScenarioSelect();
    };

    ['#st-title', '#st-author', '#st-diff', '#st-desc', '#st-hints'].forEach((sel) => {
      this.sideBodyEl.querySelector(sel)?.addEventListener('change', syncMeta);
    });

    this.sideBodyEl.querySelectorAll<HTMLButtonElement>('[data-del-obj]').forEach((b) => {
      b.addEventListener('click', () => {
        s.objectives.splice(Number(b.dataset.delObj), 1);
        this.renderStudioTab();
      });
    });

    this.sideBodyEl.querySelector('#st-add-led')?.addEventListener('click', () => {
      const ref = (this.sideBodyEl.querySelector('#st-obj-ref') as HTMLSelectElement).value;
      if (ref) {
        s.objectives.push({ type: 'led', ref, on: true } satisfies Objective);
        this.renderStudioTab();
      }
    });

    this.sideBodyEl.querySelector('#st-add-v')?.addEventListener('click', () => {
      const ref = (this.sideBodyEl.querySelector('#st-obj-ref') as HTMLSelectElement).value;
      const min = Number((this.sideBodyEl.querySelector('#st-vmin') as HTMLInputElement).value);
      const max = Number((this.sideBodyEl.querySelector('#st-vmax') as HTMLInputElement).value);
      if (ref && Number.isFinite(min) && Number.isFinite(max)) {
        s.objectives.push({ type: 'voltage', a: ref, min, max } satisfies Objective);
        this.renderStudioTab();
      }
    });

    this.sideBodyEl.querySelector('#st-lock')?.addEventListener('click', async () => {
      syncMeta();
      const flag = (this.sideBodyEl.querySelector('#st-flag') as HTMLInputElement).value.trim();
      if (!flag) { this.toast('Enter a CTF flag first', 'danger'); return; }
      this.studioFlagInput = flag;
      // a built-in board locked with a new flag becomes the author's own challenge: give it its own id
      // (the flag lock is derived from the id, and a copy with a built-in id would clash when shared)
      if (this.bundledIds.has(s.id)) s.id = `custom-${s.meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}-${Date.now().toString(36)}`;
      const conn = buildConnectivity(this.board);
      const topo = topology(this.board, conn, s.id);
      s.lock = await lockFlag(flag, topo);
      this.refLockedHash = topo.slice(0, 6);
      this.authorMode = true;
      this.toast('Reference topology locked! Now sabotage the board and export/share.', 'success');
      this.renderUI();
    });

    this.sideBodyEl.querySelectorAll<HTMLButtonElement>('[data-goto-fault]').forEach((b) => {
      b.addEventListener('click', () => {
        const c = this.board.components.find((x) => x.id === b.dataset.gotoFault);
        if (!c) return;
        this.selectedCompId = c.id;
        this.activeTab = 'inspect';
        if (this.camera.bothSides) this.camera.focusAt(c.side === 'B' ? this.board.w * 2 + BOTH_GAP - c.at[0] : c.at[0], c.at[1], 10);
        else this.camera.focusAt(c.at[0], c.at[1], 10, c.side);
        this.renderUI();
      });
    });

    this.sideBodyEl.querySelector('#st-author-mode')?.addEventListener('click', () => {
      this.authorMode = !this.authorMode;
      this.renderUI();
    });

    this.sideBodyEl.querySelector('#st-export-json')?.addEventListener('click', () => {
      syncMeta();
      const out: Scenario = { ...s, board: cloneBoard(this.board) };
      const blob = new Blob([serializeScenario(out)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${s.meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'puzzle'}.pcbfix.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast('Exported .pcbfix.json challenge!', 'success');
    });

    this.sideBodyEl.querySelector('#st-export-mod')?.addEventListener('click', () => { syncMeta(); void this.getModsModal().exportBoardAsMod(); });

    this.sideBodyEl.querySelector('#st-share-url')?.addEventListener('click', async () => {
      syncMeta();
      const out: Scenario = { ...s, board: cloneBoard(this.board) };
      const packed = await packText(serializeScenario(out));
      const shareUrl = `${window.location.origin}${window.location.pathname}#s=${packed}`;
      await navigator.clipboard?.writeText(shareUrl);
      this.toast('Shareable puzzle URL copied to clipboard!', 'success');
    });
  }

  private createBlankBoard() {
    const sc = makeStarterBoard();
    this.scenarios.push(sc);
    this.loadScenario(sc);
    this.activeTab = 'studio';
    this.showBoards = false;
    this.renderModal();
    this.renderUI();
    this.toast('Blank board ready. Lock a flag in the Author tab, then break it.', 'info');
  }

  private openBoardCatalog() {
    this.showBoards = true;
    this.showHelp = false;
    this.showFeedback = false;
    this.modalPos = [0, 0];
    this.renderModal();
  }

  private getBoardsModal(): BoardsModalController {
    if (!this.boardsModal) {
      this.boardsModal = new BoardsModalController({
        getModalPos: () => this.modalPos,
        modalRootEl: this.modalRootEl,
        isMobile: () => this.mobile,
        getScenarios: () => this.scenarios,
        getActiveScenario: () => this.activeScenario,
        getSolvedIds: () => this.solvedIds,
        getModBoards: () => this.modBoards,
        getPresetStubs: () => this.presetStubs,
        getDemoUrls: () => this.demoUrls,
        hasVideo: (id) => Boolean(this.videos[id]),
        getModFailedCount: () => this.modResult.failed.length,
        openScenario: (idx) => this.openScenario(idx),
        openBoardCreator: () => this.openBoardCreator(),
        createBlankBoard: () => this.createBlankBoard(),
        openMods: () => {
          this.showBoards = false;
          this.showMods = true;
          this.renderModal();
        },
        importBoard: () => this.fileInputEl.click(),
        esc: (s) => this.esc(s),
        onClose: () => {
          this.showBoards = false;
          this.renderModal();
        },
        isSuppressModalBgClose: () => this.suppressModalBgClose,
        resetSuppressModalBgClose: () => { this.suppressModalBgClose = false; },
      });
    }
    return this.boardsModal;
  }

  private getModsModal(): ModsModalController {
    if (!this.modsModal) {
      this.modsModal = new ModsModalController({
        getModalPos: () => this.modalPos,
        modalRootEl: this.modalRootEl,
        getModResult: () => this.modResult,
        getModBoards: () => this.modBoards,
        getScenarios: () => this.scenarios,
        getActiveScenario: () => this.activeScenario,
        getBoard: () => this.board,
        getBundledIds: () => this.bundledIds,
        openScenario: (idx) => this.openScenario(idx),
        installModFile: (f) => this.installModFile(f),
        loadMods: () => this.loadMods(),
        refreshScenarioSelect: () => this.refreshScenarioSelect(),
        openBoards: () => {
          this.showMods = false;
          this.showBoards = true;
          this.renderModal();
        },
        toast: (msg, kind) => this.toast(msg, kind),
        esc: (s) => this.esc(s),
        onClose: () => {
          this.showMods = false;
          this.renderModal();
        },
        isSuppressModalBgClose: () => this.suppressModalBgClose,
        resetSuppressModalBgClose: () => { this.suppressModalBgClose = false; },
      });
    }
    return this.modsModal;
  }

  private getPartsBinModal(): PartsBinModalController {
    if (!this.partsBinModal) {
      this.partsBinModal = new PartsBinModalController({
        getBoard: () => this.board,
        getModalPos: () => this.modalPos,
        modalRootEl: this.modalRootEl,
        toast: (msg, kind) => this.toast(msg, kind),
        esc: (s) => this.esc(s),
        pushUndo: () => this.pushUndo(),
        recompute: (rebuild) => this.recompute(rebuild),
        onClose: () => {
          this.showPartsBin = false;
          this.renderModal();
        },
        onPartReplaced: () => {
          if (this.activeTab === 'inspect') this.renderInspectTab();
          this.renderUI();
        },
        isSuppressModalBgClose: () => this.suppressModalBgClose,
        resetSuppressModalBgClose: () => { this.suppressModalBgClose = false; },
      });
    }
    return this.partsBinModal;
  }

  private openPartsBin(targetComp: Component | null = null) {
    this.getPartsBinModal().open(targetComp);
    this.showPartsBin = true;
    this.showBoards = false;
    this.showHelp = false;
    this.showFeedback = false;
    this.showMods = false;
    this.showShortcuts = false;
    this.showReport = false;
    this.modalPos = [0, 0];
    this.renderModal();
  }

  private renderModal() {
    this.mount.querySelector('#btn-boards')?.classList.toggle('active', this.showBoards);
    this.mount.querySelector('#btn-feedback')?.classList.toggle('active', this.showFeedback);
    this.mount.querySelector('#btn-order-pcb')?.classList.toggle('active', this.showOrder);
    if (this.showOrder) {
      void this.getOrderModal().render();
      return;
    }
    if (this.showPartsBin) {
      void this.getPartsBinModal().render();
      return;
    }
    if (this.showBoards) {
      this.getBoardsModal().render();
      return;
    }
    if (this.showMods) {
      this.getModsModal().render();
      return;
    }
    if (this.showFeedback) {
      this.getFeedbackModal().render();
      return;
    }
    if (this.showShortcuts) {
      this.getShortcutsModal().render();
      return;
    }
    if (this.showReport) {
      this.getReportModal().render();
      return;
    }
    if (!this.showHelp) {
      this.modalRootEl.innerHTML = '';
      return;
    }
    this.getHelpModal().render();
  }

  private getHelpModal(): HelpModalController {
    if (!this.helpModal) {
      this.helpModal = new HelpModalController({
        getModalPos: () => this.modalPos,
        modalRootEl: this.modalRootEl,
        txt: (html) => this.txt(html),
        onOpenFeedback: () => this.openFeedback(true),
        onClose: () => {
          this.showHelp = false;
          this.renderModal();
        },
        isSuppressModalBgClose: () => this.suppressModalBgClose,
        resetSuppressModalBgClose: () => { this.suppressModalBgClose = false; },
      });
    }
    return this.helpModal;
  }

  private getShortcutsModal(): ShortcutsModalController {
    if (!this.shortcutsModal) {
      this.shortcutsModal = new ShortcutsModalController({
        getModalPos: () => this.modalPos,
        modalRootEl: this.modalRootEl,
        onClose: () => {
          this.showShortcuts = false;
          this.renderModal();
        },
      });
    }
    return this.shortcutsModal;
  }

  private getReportModal(): ReportModalController {
    if (!this.reportModal) {
      this.reportModal = new ReportModalController({
        getScenario: () => this.activeScenario,
        getBoard: () => this.board,
        getModalPos: () => this.modalPos,
        modalRootEl: this.modalRootEl,
        isSolved: () => this.solvedIds.has(this.activeScenario.id),
        getMoves: () => this.moves,
        isPowerOn: () => this.powerOn,
        getPsuInject: () => this.psuInject ? { volts: this.psuInject.volts, amps: this.psuInject.amps } : null,
        getRevealedFlag: () => this.revealedFlag,
        getOcpAmps: () => this.ocpAmps,
        getSolver: () => this.solver,
        getProbeRed: () => this.probeRed ? { net: this.probeRed.net, label: this.probeRed.label } : null,
        getProbeBlack: () => this.probeBlack ? { net: this.probeBlack.net, label: this.probeBlack.label } : null,
        esc: (s) => this.esc(s),
        onClose: () => {
          this.showReport = false;
          this.renderModal();
        },
      });
    }
    return this.reportModal;
  }



  /** LiveBoard Studio (board creator + supplier catalog) is a heavyweight module: only load it when opened. */
  private async openBoardCreator(): Promise<void> {
    const { BoardCreatorModal } = await import('./boardCreator');
    new BoardCreatorModal({
      onLoadScenario: (sc) => {
        this.scenarios.push(sc);
        this.refreshScenarioSelect();
        this.loadScenario(sc);
      },
      onClose: () => {},
      toast: (msg, kind) => this.toast(msg, kind),
    }).show();
  }

  private getOrderModal(): OrderModalController {
    if (!this.orderModal) {
      this.orderModal = new OrderModalController({
        getBoard: () => this.board,
        getScenario: () => this.activeScenario,
        getModalPos: () => this.modalPos,
        modalRootEl: this.modalRootEl,
        toast: (msg, kind) => this.toast(msg, kind),
        exportSpice: () => this.exportSpice(),
        esc: (s) => this.esc(s),
        onClose: () => {
          this.showOrder = false;
          this.renderModal();
        },
      });
    }
    return this.orderModal;
  }


  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.lastFrameMs) / 1000);
    this.lastFrameMs = now;
    // thermal state evolves in real time (heating while powered, cooling, frost melting, IPA drying)
    if (this.thermal && this.preheatTemp > 0 && !this.thermal.sources.some((x) => x.kind === 'preheat')) {
      this.thermal.addSource({ kind: 'preheat', temp: this.preheatTemp, h: PREHEAT_H, until: this.thermal.time + 1 });
    }
    this.thermal?.step(dt);
    this.flex.advance(dt);
    if (this.mobile) this.refitOnShapeChange();
    if (this.rework && this.reworkMode.realistic) {
      const evs = this.rework.update(dt);
      if (evs.length) this.onReworkEvents(evs);
    }
    // intermittent faults follow temperature and flex; re-solve when one switches
    this.intermittentClock += dt;
    if (this.intermittentClock >= 0.2) {
      this.intermittentClock = 0;
      const changed = updateIntermittents(this.board, this.environment());
      // rosin melting on a hot part gives off a wisp of smoke
      for (const c of this.rosinParts) {
        const s = this.thermal?.partSurface(c.id);
        if (!s || s.rosin <= 0.02) { this.rosinParts.delete(c); continue; }
        if (s.melted > 0.02) this.renderer?.spawnSmoke(c.at[0], c.at[1], c.side, this.board.thickness, 'flux');
      }
      if (changed.length) { this.recompute(true); this.renderDmm(); }
    }
    // bench supply: the power controller advances the board's power state; the meter averages
    if (this.powerOn || this.boot.history.length) {
      // the controller waits while the solve for its present state is still running
      if (this.powerOn && !this.pendingSolve && this.boot.tick(dt, this.supplyReading().amps, (s) => this.missingRails(s))) {
        this.recomputeAsync();
      }
      this.psuClock += dt;
      if (this.psuClock >= 0.1) { this.psuClock = 0; this.renderPsu(); if (this.scopeProbe) this.renderScope(); }
    }
    if (this.scopeProbe && !this.scopePaused) {
      this.scopeSample += dt;
      if (this.scopeSample >= 0.03) {
        this.scopeSample = 0;
        const t = performance.now() / 1000;
        this.scopeRoll.push({ t, v: this.probedVolts() ?? 0 });
        while (this.scopeRoll.length && this.scopeRoll[0].t < t - 12) this.scopeRoll.shift();
      }
      if (!this.powerOn && !this.boot.history.length) { this.psuClock += dt; if (this.psuClock >= 0.1) { this.psuClock = 0; this.renderScope(); } }
    }
    this.camera.tick(dt);
    const tutSteps = this.tutorialOpen ? getTutorialSteps(this.activeScenario.id) : null;
    const tutStep = tutSteps ? tutSteps[Math.max(0, Math.min(tutSteps.length - 1, this.tutorialStep))] : null;
    this.renderer.render(this.camera, {
      board: this.board,
      conn: this.conn,
      sim: this.sim,
      thermal: this.thermal,
      powerOn: this.powerOn,
      vizMode: this.vizMode,
      selectedNet: this.selectedNet,
      selectedCompId: this.selectedCompId,
      hovered: this.hovered,
      probeRed: this.probeRed,
      probeBlack: this.probeBlack,
      diodeLitIds: this.diodeLitIds,
      jumperDraft: this.jumperStart && this.cursorWorld
        ? { a: this.jumperStart.a, la: this.jumperStart.la, b: this.cursorWorld, lb: this.cursorSide }
        : null,
      cursorWorld: this.cursorWorld,
      cursorSide: this.cursorSide,
      activeTool: this.activeTool,
      tutorialTarget: tutStep?.target
        ? { pos: tutStep.target.pos, side: tutStep.target.side, radius: tutStep.target.radius }
        : null,
    });
    this.rafId = requestAnimationFrame(this.loop);
  };

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.renderer?.destroy();
  }
}
