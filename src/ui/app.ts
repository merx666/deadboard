import type { Board, Component, LedColor, Objective, Scenario, Side, V2 } from '../types';
import { FAULT_LABELS, applicableFaults, clearFault, injectFault, listFaults, needsSpice, rng, severityHint, type FaultClass } from '../faults';
import { dist, transform4 } from '../geom';
import { buildConnectivity, type Conn } from '../connectivity';
import { BAND_RGB, GOLD_RGB, KIND_NAMES, LED_COLORS, e12Values, fmtOhm, fmtSI, marking, padWorld, parseValue, resistorBands } from '../model';
import { addBlob, addJumper, cutTrace, installPart, removeBlob, removeJumper, removePart, toggleCold } from '../ops';
import { measureDiode, measureOhms, type Sim } from '../sim';
import { measureDiodeSpice, measureOhmsSpice } from '../spice/adapter';
import { AMMETER_SHUNT, GENERIC_DMM, contactResistance, displayAmps, displayVolts, measureCapDmm, measureDiodeDmm, measureOhmsDmm, placementRng, type Reading } from '../spice/dmm';
import { boardToCircuit } from '../spice/board';
import { writeSpice } from '../spice/netlist';
import { netAt, pickAt, type PickHit } from '../pick';
import { runSolver, verifyScenario, type Solver, type VerifyResult } from '../verify';
import { lockFlag, packText, topology, unpackText } from '../crypto';
import { serializeScenario } from '../io/format';
import { MOD_FORMAT, type ModBoard } from '../mods/mods';
import { desktop, installMod, loadAllMods, modsFolderPath, removeInstalled, type ModLoadResult } from '../mods/sources';
import { writeZip } from '../mods/zip';
import { builtinScenarios } from '../scenarios/builtin';
import { Builder } from '../scenarios/builder';
import { BOTH_GAP, Camera } from '../render/camera';
import { EMISSIVITY, ThermalModel, apparentTemp } from '../thermal';
import { FlexField, settleIntermittents, updateIntermittents } from '../intermittent';
import { BootController, requiredRails, type RequiredRail } from '../boot';
import { cleanWithIpa, residueNear } from '../residue';
import { discoverPowerTree, railVoltage, type PowerTree } from '../spice/powertree';
import { fmtHz, sampleSignal, signalOn, type ScopeSignal } from '../scope';
import type { PowerStateName } from '../spice/sequencer';
import { HOTAIR_H, IRON_G, PREHEAT_H, ReworkMonitor, type ReworkEvent } from '../rework';
import { WebGPURenderer, type VizMode } from '../render/webgpu';
import { setSoundEnabled, sfxBeep, sfxBlow, sfxClick, sfxCut, sfxSolder, sfxWin, soundEnabled, setContinuityBeep, sfxRelay, sfxProbe } from './audio';
import { icon } from './icons';
import { mountFeedbackForm, type FeedbackContext } from './feedback';
import { BRAND, markSvg } from './logo';
import { getBeginnerPrimerHtml, TUTORIAL_SCENARIO_IDS, getTutorialTopics, getTutorialSteps, isTutorialScenario, nextTutorialScenarioId, type TutorialStep } from './tutorial';
import { TOOL_SHORT, TOOL_TIP_PHONE, TouchGestures, splitLead, touchCopy, wantsMobileLayout } from './touch';
import { getLang, setLang, t as i18n, translateScenario } from '../i18n';
import { BOARD_PRESETS } from '../boards/presets';
import type { ComponentPart } from '../parts/catalog';

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
  private showShortcuts = false;
  private showReport = false;
  private showFeedback = false;
  private showBoards = false;
  private showOrder = false;
  private orderSubmitted = false;
  private orderReceiptId: string | null = null;
  private boardFilter: 'all' | 'tutorials' | 'challenges' | 'hardware' | 'mods' = 'all';
  private showMods = false;
  private showPartsBin = false;
  private partsBinTargetCompId: string | null = null;
  private partsBinSearch = '';
  private partsBinCategory = 'all';
  private partsBinFilterCompatible = true;
  private partsBinSelectedPartId: string | null = null;
  /** Ids of the boards that ship with LiveBoard (built-ins + demos): an author's copy needs its own id. */
  private bundledIds = new Set<string>();
  /** Mod boards in the list (stub before first open, full scenario after) → their mod. */
  private modBoards = new Map<Scenario, ModBoard>();
  private modResult: ModLoadResult = { mods: [], failed: [] };
  private schematicUrls = new Map<ModBoard, string>();
  private boardSearch = '';
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
    for (const p of BOARD_PRESETS) {
      this.scenarios.push(p.create());
    }
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

  private renderFeedbackModal() {
    this.modalRootEl.innerHTML = `
      <div class="modal-backdrop" id="fb-close-bg">
        <div class="modal" style="transform: translate3d(${this.modalPos[0]}px, ${this.modalPos[1]}px, 0)">
          <div class="modal-head" title="Drag to move window">
            <h2>Feedback</h2>
            <button class="btn ghost icon sm" id="fb-close" title="Close">${icon('x', 14)}</button>
          </div>
          <div class="card"><div id="fb-host"></div></div>
        </div>
      </div>`;
    mountFeedbackForm(this.modalRootEl.querySelector<HTMLElement>('#fb-host')!, () => this.feedbackContext());
    this.modalRootEl.querySelector('#fb-close')?.addEventListener('click', () => this.openFeedback(false));
    this.modalRootEl.querySelector('#fb-close-bg')?.addEventListener('click', (e) => {
      if (this.suppressModalBgClose) { this.suppressModalBgClose = false; return; }
      if ((e.target as HTMLElement).id === 'fb-close-bg') this.openFeedback(false);
    });
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
    let sc = this.scenarios[idx];
    const mb = this.modBoards.get(sc);
    if (mb && sc === mb.stub && !mb.stub.board.components.length) {
      this.toast(`Loading ${sc.meta.title}…`, 'info');
      try {
        const full = await mb.load();
        this.modBoards.delete(sc);
        this.modBoards.set(full, mb);
        this.scenarios[idx] = sc = full;
      } catch (err) {
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
        this.scenarios[idx] = sc = full;
      } catch (err) {
        this.toast(`Could not load the demo board: ${err instanceof Error ? err.message : err}`, 'danger');
        this.refreshScenarioSelect();
        return;
      }
    }
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
              <button class="btn ghost icon" id="sc-close" title="Remove probe">${icon('x', 14)}</button>
            </div>
          </div>
          <canvas class="scope-screen" id="sc-canvas" width="528" height="240"></canvas>
          <div class="psu-state" id="sc-meas"></div>
          <div class="psu-state muted" id="sc-note"></div>
        </div>`;
      this.scopeBoxEl.querySelector('#sc-auto')!.addEventListener('click', () => { this.scopeMode = 'auto'; this.renderScope(); });
      this.scopeBoxEl.querySelector('#sc-roll')!.addEventListener('click', () => { this.scopeMode = 'roll'; this.renderScope(); });
      this.scopeBoxEl.querySelector('#sc-close')!.addEventListener('click', () => { this.scopeProbe = null; this.renderScope(); });
    }
    this.scopeBoxEl.querySelector('#sc-auto')!.classList.toggle('on', this.scopeMode === 'auto');
    this.scopeBoxEl.querySelector('#sc-roll')!.classList.toggle('on', this.scopeMode === 'roll');
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

    q('#btn-order-pcb')?.addEventListener('click', openCreator);
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

    if (this.dmmMode === 'V') {
      if (!this.powerOn) {
        reading = '0.000 V';
        sub = 'Supply off — enable power to measure DC voltage';
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
            <button class="btn ghost icon" id="dmm-clr" title="Clear probes">${icon('x', 14)}</button>
          </div>
        </div>
        <div class="dmm-lcd">
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
      this.renderDmm();
      this.renderTutorial();
    });
    this.dmmBoxEl.querySelector('#dmm-ohm')!.addEventListener('click', () => {
      this.dmmMode = 'OHM';
      this.checkContinuityBeep();
      this.renderDmm();
      this.renderTutorial();
    });
    this.dmmBoxEl.querySelector('#dmm-diode')!.addEventListener('click', () => {
      this.dmmMode = 'DIODE';
      this.renderDmm();
      this.renderTutorial();
    });
    for (const [id, mode] of [['#dmm-cap', 'CAP'], ['#dmm-amp', 'AMP']] as const) {
      this.dmmBoxEl.querySelector(id)!.addEventListener('click', () => { this.dmmMode = mode; this.renderDmm(); this.renderTutorial(); });
    }
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
      this.renderDmm();
      this.renderTutorial();
    });
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

  private renderInspectTab() {
    const c = this.board.components.find((x) => x.id === this.selectedCompId) ?? null;

    if (!c) {
      const netName = this.selectedNet >= 0 ? this.conn.netNames[this.selectedNet] : null;
      const ni = this.selectedNet >= 0 ? this.sim?.nodeOfNet.get(this.selectedNet) : undefined;
      const v = ni !== undefined && this.sim?.source ? this.sim.V[ni] : null;
      const renderCompRows = () => {
        const q = this.compSearch.trim().toLowerCase();
        const filtered = q
          ? this.board.components.filter((comp) =>
              comp.ref.toLowerCase().includes(q)
              || KIND_NAMES[comp.kind].toLowerCase().includes(q)
              || (comp.label?.toLowerCase().includes(q) ?? false))
          : this.board.components;
        const shown = filtered.slice(0, 120);
        const rows = shown.map((comp) => `
          <button class="list-btn" data-pick-comp="${comp.id}">
            <span><b>${this.esc(comp.ref)}</b> · ${this.esc(KIND_NAMES[comp.kind])}</span>
            <span class="sub">${this.esc(marking(comp))}</span>
          </button>
        `).join('');
        const tail = filtered.length > 120
          ? `<div class="muted" style="padding-top:4px">Showing 120 of ${filtered.length} matches — refine search above</div>`
          : '';
        return (rows || `<div class="muted">No matching components.</div>`) + tail;
      };
      this.sideBodyEl.innerHTML = `
        <div class="card">
          <div class="card-title">Selection</div>
          ${netName ? `
            <dl class="kv">
              <dt>Net</dt><dd>${this.esc(netName)}</dd>
              <dt>Potential</dt><dd>${v !== null ? `${v.toFixed(3)} V` : this.powerOn ? 'Floating' : 'Unpowered'}</dd>
            </dl>
          ` : `<div class="muted">Select a component, pad, or trace in the viewport to inspect parameters and perform rework.</div>`}
        </div>
        <div class="card">
          <div class="card-title">Components (${this.board.components.length})</div>
          <input type="text" id="inp-comp-search" placeholder="Search ref or type (e.g. U2, C29, resistor)…" value="${this.esc(this.compSearch)}" style="width:100%;margin-bottom:8px" />
          <div class="stack" id="comp-list-box">${renderCompRows()}</div>
        </div>
      `;
      const bindCompClicks = () => {
        this.sideBodyEl.querySelectorAll<HTMLButtonElement>('[data-pick-comp]').forEach((b) => {
          b.addEventListener('click', () => {
            const id = b.dataset.pickComp!;
            this.selectedCompId = id;
            if (this.board.components.length > 100) {
              const picked = this.board.components.find((x) => x.id === id);
              if (picked) {
                if (this.camera.bothSides) {
                  const fx = picked.side === 'B' ? this.board.w * 2 + BOTH_GAP - picked.at[0] : picked.at[0];
                  this.camera.focusAt(fx, picked.at[1], 10);
                } else {
                  this.camera.focusAt(picked.at[0], picked.at[1], 10, picked.side);
                }
                this.renderUI();
                return;
              }
            }
            this.renderInspectTab();
          });
        });
      };
      bindCompClicks();
      const searchEl = this.sideBodyEl.querySelector<HTMLInputElement>('#inp-comp-search');
      const listBox = this.sideBodyEl.querySelector<HTMLElement>('#comp-list-box');
      searchEl?.addEventListener('input', () => {
        this.compSearch = searchEl.value;
        if (listBox) {
          listBox.innerHTML = renderCompRows();
          bindCompClicks();
        }
      });
      return;
    }

    const isPl = getLang() === 'pl';
    const cSim = this.powerOn && this.sim ? this.sim.comps.get(c.id) : undefined;
    const bands = c.kind === 'resistor' && c.state.populated && !c.state.burnt ? resistorBands(c.value) : null;
    const bandColorCss = (idx: number) => {
      const rgb = idx < 0 ? GOLD_RGB : BAND_RGB[idx];
      return `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`;
    };

    const e12 = e12Values(10, 1000000);

    this.sideBodyEl.innerHTML = `
      <div class="card">
        <div class="card-title">
          <button class="btn ghost sm" id="btn-comp-back" style="padding:0 4px">${icon('chevronLeft', 14)}<span>Components</span></button>
          <span class="badge info">${this.esc(c.ref)}</span>
        </div>
        <div class="card-title lg">${this.esc(KIND_NAMES[c.kind])}</div>
        <dl class="kv">
          <dt>State</dt><dd>${!c.state.populated ? 'Unpopulated' : c.state.burnt ? 'Damaged (open)' : 'Populated'}${c.state.reversed ? ' · Reversed' : ''}${c.state.cold.length ? ` · ${c.state.cold.length} cold joint` : ''}</dd>
          <dt>Value</dt><dd>${this.esc(marking(c))}</dd>
          ${bands ? `
            <dt>Color code</dt>
            <dd>
              <span class="res-bands">
                <span class="res-band" style="background:${bandColorCss(bands[0])}"></span>
                <span class="res-band" style="background:${bandColorCss(bands[1])}"></span>
                <span class="res-band" style="background:${bandColorCss(bands[2])}"></span>
                <span class="res-band" style="background:${bandColorCss(-1)}"></span>
              </span>
            </dd>
          ` : ''}
          ${cSim ? `
            <dt>Drop / current</dt><dd>${cSim.v.toFixed(3)} V · ${(cSim.i * 1000).toFixed(2)} mA</dd>
            <dt>Power / temp</dt><dd>${(cSim.p * 1000).toFixed(1)} mW · ${(25 + cSim.p * (c.kind === 'resistor' ? 185 : 130)).toFixed(0)} °C</dd>
          ` : ''}
        </dl>
        <div class="callout">
          <span class="h">Reference note</span>
          <span>${this.esc(
            c.kind === 'resistor'
              ? 'Read the 4 bands left-to-right toward the gold tolerance band: Digit 1, Digit 2, Multiplier (10^n). Example: Brown-Black-Red = 1-0 × 10² = 1 kΩ.'
              : c.kind === 'led'
                ? 'Look for the flat notch on the rim and the larger internal cathode anvil flag. Verify polarity in Diode mode (•◄|).'
                : c.kind === 'diode'
                  ? 'The silver/white band marks the Cathode (K). A healthy silicon diode drops ~0.6–0.7 V forward and reads OL reversed.'
                  : c.kind === 'switch'
                    ? '4-pin tactile switches pair two legs internally on each side (1-1 and 2-2). Pressing bridges side 1 to side 2.'
                    : c.kind === 'fuse'
                      ? 'Check for downstream shorts (Ω mode or 100 mA limit + Thermal view) before replacing a blown fuse.'
                      : 'Probe pads in V DC (Power ON) or Ω / Diode mode (Power OFF) to trace connectivity.'
          )}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${isPl ? 'Prace serwisowe' : 'Rework'}</div>
        <div class="row wrap">
          ${c.kind === 'switch' ? `<button class="btn sm primary" id="act-toggle-sw">${c.state.closed ? (isPl ? 'Zwolnij przełącznik' : 'Release switch') : (isPl ? 'Naciśnij przełącznik' : 'Press switch')}</button>` : ''}
          ${c.state.populated ? `<button class="btn sm" id="act-flip180">${isPl ? 'Obróć o 180°' : 'Rotate 180°'}</button>` : ''}
          ${c.state.cold.length ? `<button class="btn sm warn" id="act-reflow">${isPl ? 'Przetop luty' : 'Reflow joints'}</button>` : ''}
          ${c.state.populated ? `<button class="btn sm" id="act-desolder">${isPl ? 'Wylutuj element' : 'Remove part'}</button>` : ''}
          ${!c.state.populated || c.state.burnt ? `<button class="btn sm primary" id="act-fit">${isPl ? `Wlutuj nowy ${this.esc(KIND_NAMES[c.kind].toLowerCase())}` : `Fit new ${this.esc(KIND_NAMES[c.kind].toLowerCase())}`}</button>` : ''}
          <button class="btn sm" id="act-open-catalog" style="background:var(--accent-weak); border-color:var(--accent-line); color:var(--accent); font-weight:600;" title="${isPl ? 'Wybierz podzespół z bazy PCBWay / LCSC' : 'Pick from PCBWay / LCSC catalog'}">
            ${icon('box', 13)}
            <span>${isPl ? 'Wybierz z bazy PCBWay / LCSC' : 'Pick from Supplier Catalog'}</span>
          </button>
        </div>

        ${c.kind === 'resistor' ? `
          <div class="field">
            <label>Resistance (e.g. 100, 330, 4k7, 10k)</label>
            <div class="row">
              <input type="text" class="grow" id="inp-res-val" value="${c.value || 330}" />
              <button class="btn sm primary" id="act-install-res">Apply</button>
            </div>
            <select id="sel-e12" style="margin-top:2px">
              <option value="">Standard E12 value…</option>
              ${e12.map((v) => `<option value="${v}" ${Math.abs(v - c.value) < 0.01 ? 'selected' : ''}>${fmtOhm(v)}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        ${c.kind === 'led' ? `
          <div class="field">
            <label>LED emission color</label>
            <div class="row">
              <select class="grow" id="sel-led-col">
                ${LED_COLORS.map((col) => `<option value="${col}" ${c.color === col ? 'selected' : ''}>${col.toUpperCase()}</option>`).join('')}
              </select>
              <button class="btn sm primary" id="act-install-led">Apply</button>
            </div>
          </div>
        ` : ''}

        ${c.kind === 'fuse' ? `
          <div class="field">
            <label>Fuse current rating (A)</label>
            <div class="row">
              <input type="number" class="grow" step="0.1" min="0.05" id="inp-fuse-val" value="${c.value || 0.5}" />
              <button class="btn sm primary" id="act-install-fuse">Apply</button>
            </div>
          </div>
        ` : ''}

        ${c.kind === 'capacitor' ? `
          <div class="field">
            <label>Capacitance (e.g. 100n, 10u)</label>
            <div class="row">
              <input type="text" class="grow" id="inp-cap-val" value="${c.value ? fmtSI(c.value, 'F') : '100n'}" />
              <button class="btn sm primary" id="act-install-cap">Apply</button>
            </div>
          </div>
        ` : ''}
      </div>

      ${this.authorMode ? this.faultCardHtml(c) : ''}
    `;

    this.sideBodyEl.querySelector('#btn-comp-back')?.addEventListener('click', () => {
      this.selectedCompId = null;
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelector('#act-toggle-sw')?.addEventListener('click', () => {
      c.state.closed = !c.state.closed;
      sfxClick();
      this.recompute(false);
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelector('#act-flip180')?.addEventListener('click', () => {
      this.pushUndo();
      c.state.reversed = !c.state.reversed;
      sfxClick();
      this.recompute(false);
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelector('#act-reflow')?.addEventListener('click', () => {
      this.pushUndo();
      c.state.cold = [];
      sfxSolder();
      this.recompute(false);
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelector('#act-fit')?.addEventListener('click', () => {
      // a fresh part of the same type and value (value fields below change it)
      this.pushUndo();
      installPart(c, { ...(c.value > 0 && { value: c.value }) });
      sfxSolder();
      this.recompute(false);
      this.toast(`Fitted a new ${c.ref}`, 'success');
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelector('#act-desolder')?.addEventListener('click', () => {
      this.pushUndo();
      removePart(c);
      sfxSolder();
      this.recompute(false);
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelector('#act-open-catalog')?.addEventListener('click', () => {
      this.openPartsBin(c);
    });
    this.sideBodyEl.querySelector('#sel-e12')?.addEventListener('change', (e) => {
      const v = Number((e.target as HTMLSelectElement).value);
      if (v > 0) {
        this.pushUndo();
        installPart(c, { value: v, reversed: c.state.reversed });
        sfxSolder();
        this.recompute(false);
        this.renderInspectTab();
      }
    });
    this.sideBodyEl.querySelector('#act-install-res')?.addEventListener('click', () => {
      const raw = (this.sideBodyEl.querySelector('#inp-res-val') as HTMLInputElement).value;
      const v = parseValue(raw);
      if (!Number.isFinite(v) || v <= 0) { this.toast('Invalid resistor value', 'danger'); return; }
      this.pushUndo();
      installPart(c, { value: v, reversed: c.state.reversed });
      sfxSolder();
      this.recompute(false);
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelector('#act-install-led')?.addEventListener('click', () => {
      const col = (this.sideBodyEl.querySelector('#sel-led-col') as HTMLSelectElement).value as LedColor;
      this.pushUndo();
      installPart(c, { color: col, reversed: c.state.reversed });
      sfxSolder();
      this.recompute(false);
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelector('#act-install-fuse')?.addEventListener('click', () => {
      const v = Number((this.sideBodyEl.querySelector('#inp-fuse-val') as HTMLInputElement).value);
      if (!Number.isFinite(v) || v <= 0) { this.toast('Invalid fuse rating', 'danger'); return; }
      this.pushUndo();
      installPart(c, { value: v });
      sfxSolder();
      this.recompute(false);
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelector('#act-install-cap')?.addEventListener('click', () => {
      const raw = (this.sideBodyEl.querySelector('#inp-cap-val') as HTMLInputElement).value;
      const v = parseValue(raw);
      if (!Number.isFinite(v) || v <= 0) { this.toast('Invalid capacitance', 'danger'); return; }
      this.pushUndo();
      installPart(c, { value: v });
      sfxSolder();
      this.recompute(false);
      this.renderInspectTab();
    });

    this.sideBodyEl.querySelector('#sab-burn')?.addEventListener('click', () => {
      this.pushUndo();
      c.state.burnt = !c.state.burnt;
      this.recompute(true);
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelector('#sab-cold')?.addEventListener('click', () => {
      this.pushUndo();
      toggleCold(c, 0);
      this.recompute(true);
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelector('#sab-rev')?.addEventListener('click', () => {
      this.pushUndo();
      c.state.reversed = !c.state.reversed;
      this.recompute(true);
      this.renderInspectTab();
    });
    if (this.authorMode) this.bindFaultCard(c);
  }

  /** Author-mode fault injection for one part: every fault class that fits it, with severity. */
  private faultCardHtml(c: Component): string {
    const classes = applicableFaults(c);
    const cls = classes.includes(this.faultClass) ? this.faultClass : classes[0];
    const hint = cls ? severityHint(cls) : null;
    const jointFault = cls === 'cold-joint' || cls === 'thermal-open-joint' || cls === 'flex-open-joint' || cls === 'flex-close-joint' || cls === 'net-break';
    const faults = listFaults(c);
    const fastBlind = this.solver === 'fast' && (faults.some((f) => f.spiceOnly) || (cls && needsSpice(cls)));
    return `
      <div class="card">
        <div class="card-title">Fault injection · ${this.esc(c.ref)}</div>
        <div class="row wrap">
          <button class="btn sm warn" id="sab-burn">Toggle damage</button>
          <button class="btn sm warn" id="sab-cold">Toggle open joint</button>
          <button class="btn sm warn" id="sab-rev">Reverse 180°</button>
        </div>
        ${cls ? `
          <div class="field">
            <label>Fault class</label>
            <select id="sab-class">
              ${classes.map((k) => `<option value="${k}" ${k === cls ? 'selected' : ''}>${this.esc(FAULT_LABELS[k])}</option>`).join('')}
            </select>
          </div>
          <div class="grid-2">
            ${jointFault ? `
              <div class="field">
                <label>Pad</label>
                <select id="sab-pad">
                  <option value="">Random</option>
                  ${c.pads.map((p, i) => `<option value="${i}">${this.esc(p.name)}${p.net ? ` · ${this.esc(p.net)}` : ''}</option>`).join('')}
                </select>
              </div>
            ` : ''}
            ${hint ? `
              <div class="field">
                <label>${this.esc(hint.what)} (${this.esc(hint.unit)})</label>
                <input type="text" id="sab-sev" placeholder="random ${hint.unit === 'Ω' ? `${fmtSI(hint.min, 'Ω')} – ${fmtSI(hint.max, 'Ω')}` : `${hint.min}–${hint.max}`}" />
              </div>
            ` : ''}
          </div>
          <button class="btn sm warn block" id="sab-inject">Inject fault</button>
        ` : ''}
        ${faults.length ? `
          <div class="card-title" style="margin-top:6px">Faults on ${this.esc(c.ref)} (${faults.length})</div>
          ${faults.map((f) => `
            <div class="obj-row">
              <span class="mono">${this.esc(f.label)}${f.spiceOnly ? ' <span class="muted">· SPICE</span>' : ''}</span>
              <button class="btn ghost icon sm" data-clear-fault="${f.key}" title="Remove fault">${icon('x', 12)}</button>
            </div>
          `).join('')}
        ` : ''}
        ${fastBlind ? `<div class="callout"><span class="h">Fast DC solver</span><span>Leaks, drift and resistive joints only exist in SPICE (Fast DC treats a resistive joint as open). Switch Bench → Solver to SPICE to see their effect.</span></div>` : ''}
      </div>
    `;
  }

  private bindFaultCard(c: Component) {
    const q = <T extends HTMLElement>(s: string) => this.sideBodyEl.querySelector<T>(s);
    q<HTMLSelectElement>('#sab-class')?.addEventListener('change', (e) => {
      this.faultClass = (e.target as HTMLSelectElement).value as FaultClass;
      this.renderInspectTab();
    });
    q('#sab-inject')?.addEventListener('click', () => {
      const cls = (q<HTMLSelectElement>('#sab-class')?.value ?? '') as FaultClass;
      if (!applicableFaults(c).includes(cls)) return;
      const padRaw = q<HTMLSelectElement>('#sab-pad')?.value ?? '';
      const sevRaw = (q<HTMLInputElement>('#sab-sev')?.value ?? '').trim();
      let severity: number | undefined;
      if (sevRaw) {
        severity = severityHint(cls)?.unit === 'Ω' ? parseValue(sevRaw) : Number(sevRaw);
        if (!Number.isFinite(severity) || severity <= 0) { this.toast('Invalid severity', 'danger'); return; }
        if (cls === 'flex-open-joint' || cls === 'flex-close-joint') severity = Math.min(severity, 1);
      }
      this.pushUndo();
      const f = injectFault(c, cls, rng((Math.random() * 2 ** 32) >>> 0), { severity, ...(padRaw !== '' && { pad: Number(padRaw) }) });
      updateIntermittents(this.board, this.environment()); // a new intermittent takes its present state at once
      sfxClick();
      this.toast(f.describe, 'info');
      this.recompute(true);
      this.renderInspectTab();
    });
    this.sideBodyEl.querySelectorAll<HTMLButtonElement>('[data-clear-fault]').forEach((b) => {
      b.addEventListener('click', () => {
        this.pushUndo();
        clearFault(c, b.dataset.clearFault!);
        this.recompute(true);
        this.renderInspectTab();
      });
    });
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

    this.sideBodyEl.querySelector('#st-export-mod')?.addEventListener('click', () => { syncMeta(); void this.exportBoardAsMod(); });

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

  private classifyScenario(s: Scenario): 'tutorials' | 'challenges' | 'hardware' | 'mods' {
    if (this.modBoards.has(s)) return 'mods';
    if (isTutorialScenario(s.id)) return 'tutorials';
    if (s.solver === 'spice-power' || this.demoUrls.has(s) || s.board.components.length > 50) {
      return 'hardware';
    }
    return 'challenges';
  }

  /** Phone board list: one compact row per board (badge, title, two lines of description, status). */
  private phoneCatalogSection(title: string, solved: number, items: { s: Scenario; idx: number }[]): string {
    return `
      <section class="cat-sec">
        <div class="cat-sec-head"><h3>${this.esc(title)}</h3><span class="badge info">${solved}/${items.length}</span></div>
        <div class="m-cat-list">
          ${items.map(({ s, idx }) => {
            const isActive = s === this.activeScenario;
            const isSolved = this.solvedIds.has(s.id);
            const tutIdx = TUTORIAL_SCENARIO_IDS.indexOf(s.id as (typeof TUTORIAL_SCENARIO_IDS)[number]);
            const badge = tutIdx >= 0 ? `<span class="br-badge tut">${tutIdx + 1}</span>` : `<span class="br-badge" title="Difficulty ${s.meta.difficulty}/5">L${s.meta.difficulty}</span>`;
            const state = isSolved ? `<span class="br-state ok">${icon('check', 14)}</span>` : isActive ? `<span class="br-state on">Open</span>` : `<span class="br-state">${icon('chevronRight', 14)}</span>`;
            return `
              <button class="board-row ${isActive ? 'active' : ''} ${isSolved ? 'solved' : ''}" data-pick-board="${idx}">
                ${badge}
                <span class="br-main"><span class="br-title">${this.esc(s.meta.title)}</span><span class="br-desc">${this.esc(s.meta.description.replace(/^Beginner Tutorial \d+:\s*/, ''))}</span></span>
                ${state}
              </button>`;
          }).join('')}
        </div>
      </section>`;
  }

  private renderBoardsModal() {
    const isPl = getLang() === 'pl';
    type CatKey = 'tutorials' | 'challenges' | 'hardware' | 'mods';
    const counts: Record<CatKey, number> = { tutorials: 0, challenges: 0, hardware: 0, mods: 0 };
    for (const s of this.scenarios) counts[this.classifyScenario(s)]++;

    const sections: { key: CatKey; title: string; sub: string }[] = isPl ? [
      { key: 'tutorials', title: 'Samouczki dla początkujących', sub: 'Prowadzone krok po kroku płytki wyjaśniające podstawy elektroniki i napraw' },
      { key: 'challenges', title: 'Wyzwania serwisowe', sub: 'Zagadki diagnostyczne i lokalizowanie usterek w układach' },
      { key: 'hardware', title: 'Prawdziwy sprzęt & Open Source', sub: 'Pełne schematy z setkami elementów i boardview z silnikiem SPICE + PWR' },
      { key: 'mods', title: 'Modyfikacje społeczności', sub: 'Płytki z zainstalowanych modów. Zarządzaj nimi przyciskiem Mody' },
    ] : [
      { key: 'tutorials', title: 'Beginner Tutorials', sub: 'Guided step-by-step boards covering the core fundamentals' },
      { key: 'challenges', title: 'Repair Challenges', sub: 'Standalone fault-finding & multi-fault diagnostic puzzles' },
      { key: 'hardware', title: 'Real Hardware & Open Source', sub: 'Full multi-hundred-part schematics & boardviews on SPICE + PWR' },
      { key: 'mods', title: 'Community Mods', sub: 'Boards from mods you installed. Manage them with the Mods button' },
    ];

    const renderList = () => {
      const q = this.boardSearch.trim().toLowerCase();
      const blocks = sections
        .filter((sec) => this.boardFilter === 'all' || this.boardFilter === sec.key)
        .map((sec) => {
          const items = this.scenarios
            .map((s, idx) => ({ s, idx }))
            .filter(({ s }) => this.classifyScenario(s) === sec.key)
            .filter(({ s }) => {
              if (!q) return true;
              const topics = getTutorialTopics(s.id)?.join(' ') ?? '';
              const mod = this.modBoards.get(s)?.mod.name ?? '';
              return `${s.meta.title} ${s.meta.description} ${s.meta.author} ${topics} ${mod}`.toLowerCase().includes(q);
            });
          if (!items.length) return '';
          const solvedInSec = items.filter(({ s }) => this.solvedIds.has(s.id)).length;
          if (this.mobile) return this.phoneCatalogSection(sec.title, solvedInSec, items);
          return `
            <section class="cat-sec">
              <div class="cat-sec-head">
                <div>
                  <h3>${this.esc(sec.title)}</h3>
                  <p>${this.esc(sec.sub)}</p>
                </div>
                <span class="badge info">${solvedInSec}/${items.length} solved</span>
              </div>
              <div class="cat-grid">
                ${items.map(({ s, idx }) => {
                  const isActive = s === this.activeScenario;
                  const isSolved = this.solvedIds.has(s.id);
                  const tr = translateScenario(s.id, s.meta.title, s.meta.description);
                  const tutIdx = TUTORIAL_SCENARIO_IDS.indexOf(s.id as (typeof TUTORIAL_SCENARIO_IDS)[number]);
                  const topics = getTutorialTopics(s.id);
                  const chips: string[] = [];
                  const mb = this.modBoards.get(s);
                  if (mb) {
                    chips.push(mb.mod.name, `by ${mb.mod.author}`);
                    if (mb.schematic) chips.push('Schematic');
                    if (s.meta.license) chips.push(s.meta.license);
                  } else if (topics) {
                    chips.push(...topics);
                  } else {
                    if (s.board.components.length > 1) chips.push(`${s.board.components.length} parts`);
                    if (s.meta.par) chips.push(`Par ${s.meta.par}`);
                    if (s.solver === 'spice-power') chips.push('SPICE + PWR');
                    if (this.videos[s.id]) chips.push('Video guide');
                    if (s.meta.license) chips.push(s.meta.license);
                  }
                  const leftBadge = tutIdx >= 0
                    ? `<span class="badge info">Tutorial ${tutIdx + 1}</span>`
                    : `<span class="row"><span class="badge">L${s.meta.difficulty}</span><span class="lvl" title="Difficulty ${s.meta.difficulty}/5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= s.meta.difficulty ? 'on' : ''}"></i>`).join('')}</span></span>`;
                  const rightBadge = isSolved
                    ? `<span class="badge pass">${icon('check', 11)}<span>${getLang() === 'pl' ? 'Rozwiązane' : 'Solved'}</span></span>`
                    : isActive
                      ? `<span class="badge info">${getLang() === 'pl' ? 'Aktywna' : 'Active'}</span>`
                      : tutIdx >= 0
                        ? `<span class="badge">${getLang() === 'pl' ? 'Interaktywne' : 'Interactive'}</span>`
                        : '';
                  return `
                    <button class="board-card ${isActive ? 'active' : ''} ${isSolved ? 'solved' : ''}" data-pick-board="${idx}">
                      <div class="bc-top">
                        ${leftBadge}
                        ${rightBadge}
                      </div>
                      <div class="bc-title">${this.esc(tr.title)}</div>
                      <div class="bc-desc">${this.esc(tr.description)}</div>
                      ${chips.length ? `<div class="cat-chips">${chips.map((c) => `<span class="cat-chip">${this.esc(c)}</span>`).join('')}</div>` : ''}
                    </button>
                  `;
                }).join('')}
              </div>
            </section>
          `;
        })
        .join('');
      return blocks || `<div class="muted" style="padding:24px;text-align:center">No matching boards found.</div>`;
    };

    const filters: { id: 'all' | CatKey; label: string; count: number }[] = [
      { id: 'all', label: 'All', count: this.scenarios.length },
      { id: 'tutorials', label: 'Tutorials', count: counts.tutorials },
      { id: 'challenges', label: 'Challenges', count: counts.challenges },
      { id: 'hardware', label: this.mobile ? 'Hardware' : 'Real Hardware', count: counts.hardware },
      ...(counts.mods ? [{ id: 'mods' as const, label: 'Mods', count: counts.mods }] : []),
    ];

    this.modalRootEl.innerHTML = this.mobile ? `
      <div class="modal-backdrop" id="modal-close-bg">
        <div class="modal board-catalog m-cat">
          <div class="modal-head">
            <div class="row"><h2>Boards</h2><span class="badge info">${this.solvedIds.size}/${this.scenarios.length} solved</span></div>
            <button class="btn ghost icon sm" id="modal-close" title="Close">${icon('x', 14)}</button>
          </div>
          <div class="cat-toolbar">
            <div class="m-cat-filters">
              ${filters.map((f) => `<button class="${this.boardFilter === f.id ? 'on' : ''}" data-cat-filter="${f.id}">${this.esc(f.label)} <span>${f.count}</span></button>`).join('')}
            </div>
            <input type="text" id="cat-search" placeholder="Search boards" value="${this.esc(this.boardSearch)}" />
          </div>
          <div class="cat-body" id="cat-list">${renderList()}</div>
          <div class="m-cat-foot">
            <button class="btn sm" id="cat-new">${icon('plus', 13)}<span>Blank</span></button>
            <button class="btn sm" id="cat-import">${icon('upload', 13)}<span>Import</span></button>
            <button class="btn sm" id="cat-mods">${icon('box', 13)}<span>Mods${this.modResult.failed.length ? ' ⚠' : ''}</span></button>
          </div>
        </div>
      </div>
    ` : `
      <div class="modal-backdrop" id="modal-close-bg">
        <div class="modal board-catalog" style="transform: translate3d(${this.modalPos[0]}px, ${this.modalPos[1]}px, 0)">
          <div class="modal-head" title="Drag to move window">
            <div class="row">
              <h2>Boards &amp; Tutorials</h2>
              <span class="badge info">${this.solvedIds.size} / ${this.scenarios.length} solved</span>
            </div>
            <div class="row">
              <button class="btn sm" id="cat-creator" style="color:var(--accent);border-color:var(--accent);" title="${isPl ? 'Twórz własne płytki i dobieraj części PCBWay/LCSC' : 'Create custom boards and pick PCBWay/LCSC parts'}">${icon('grid', 13)}<span>${isPl ? 'Kreator Płytek' : 'Board Creator'}</span></button>
              <button class="btn sm" id="cat-new">${icon('plus', 13)}<span>${isPl ? 'Pusta płytka' : 'Blank board'}</span></button>
              <button class="btn sm" id="cat-import">${icon('upload', 13)}<span>${isPl ? 'Importuj' : 'Import'}</span></button>
              <button class="btn sm" id="cat-mods" title="Install, remove and make mods">${icon('box', 13)}<span>Mods${this.modResult.failed.length ? ' ⚠' : ''}</span></button>
              <button class="btn ghost icon sm" id="modal-close" title="Close (Esc)">${icon('x', 14)}</button>
            </div>
          </div>
          <div class="cat-toolbar">
            <div class="seg">
              ${filters.map((f) => `<button class="${this.boardFilter === f.id ? 'on' : ''}" data-cat-filter="${f.id}">${this.esc(f.label)} (${f.count})</button>`).join('')}
            </div>
            <input type="text" id="cat-search" class="grow" placeholder="Filter boards by name, symptom, or topic…" value="${this.esc(this.boardSearch)}" />
          </div>
          <div class="cat-body" id="cat-list">${renderList()}</div>
        </div>
      </div>
    `;

    const closeModal = () => {
      this.showBoards = false;
      this.renderModal();
    };
    const bindBoardPickers = () => {
      this.modalRootEl.querySelectorAll<HTMLButtonElement>('[data-pick-board]').forEach((b) => {
        b.addEventListener('click', () => {
          const idx = Number(b.dataset.pickBoard);
          closeModal();
          if (this.scenarios[idx]) void this.openScenario(idx);
        });
      });
    };
    bindBoardPickers();

    this.modalRootEl.querySelector('#modal-close')?.addEventListener('click', closeModal);
    this.modalRootEl.querySelector('#modal-close-bg')?.addEventListener('click', (e) => {
      if (this.suppressModalBgClose) {
        this.suppressModalBgClose = false;
        return;
      }
      if ((e.target as HTMLElement).id === 'modal-close-bg') closeModal();
    });
    this.modalRootEl.querySelector('#cat-creator')?.addEventListener('click', () => {
      closeModal();
      void this.openBoardCreator();
    });
    this.modalRootEl.querySelector('#cat-new')?.addEventListener('click', () => this.createBlankBoard());
    this.modalRootEl.querySelector('#cat-mods')?.addEventListener('click', () => {
      this.showBoards = false;
      this.showMods = true;
      this.renderModal();
    });
    this.modalRootEl.querySelector('#cat-import')?.addEventListener('click', () => {
      closeModal();
      this.fileInputEl.click();
    });
    this.modalRootEl.querySelectorAll<HTMLButtonElement>('[data-cat-filter]').forEach((b) => {
      b.addEventListener('click', () => {
        this.boardFilter = b.dataset.catFilter as 'all' | CatKey;
        this.renderBoardsModal();
      });
    });
    const searchEl = this.modalRootEl.querySelector<HTMLInputElement>('#cat-search');
    const listBox = this.modalRootEl.querySelector<HTMLElement>('#cat-list');
    searchEl?.addEventListener('input', () => {
      this.boardSearch = searchEl.value;
      if (listBox) {
        listBox.innerHTML = renderList();
        bindBoardPickers();
      }
    });
  }

  /** Modding guide: on the website next to the bench; the desktop app opens the site in the browser. */
  private get moddingUrl() {
    return desktop ? `${BRAND.site}modding.html` : './modding.html';
  }

  private renderModsModal() {
    const { mods, failed } = this.modResult;
    const boardIdx = (b: ModBoard) => this.scenarios.findIndex((s) => this.modBoards.get(s) === b);
    const modCards = mods.map((m) => {
      const mf = m.manifest;
      return `
        <div class="card mod-card">
          <div class="mod-head">
            <div>
              <div class="mod-name">${this.esc(mf.name)} <span class="muted mono">v${this.esc(mf.version)}</span></div>
              <div class="muted">by ${this.esc(mf.author)} · ${this.esc(mf.license)} · ${this.esc(m.source.origin)}${mf.homepage ? ` · <a href="${this.esc(mf.homepage)}" target="_blank" rel="noopener">homepage</a>` : ''}</div>
            </div>
            ${m.source.origin === 'Installed' ? `<button class="btn sm ghost" data-mod-remove="${this.esc(mf.id)}" title="Remove this mod">${icon('x', 12)}<span>Remove</span></button>` : ''}
          </div>
          ${mf.description ? `<p class="text-2" style="margin:0">${this.esc(mf.description)}</p>` : ''}
          <div class="mod-boards">
            ${m.boards.map((b) => `<button class="btn sm" data-mod-open="${boardIdx(b)}">${icon('play', 11)}<span>${this.esc(b.stub.meta.title)}</span>${b.schematic ? `<span class="muted">· schematic</span>` : ''}</button>`).join('')}
          </div>
          ${m.warnings.length ? `<details class="mod-warn"><summary>${m.warnings.length} warning${m.warnings.length > 1 ? 's' : ''}</summary><ul>${m.warnings.map((w) => `<li>${this.esc(w)}</li>`).join('')}</ul></details>` : ''}
        </div>`;
    }).join('');
    const failedCards = failed.map((f) => `
      <div class="card mod-card mod-failed">
        <div class="card-title" style="margin:0">${icon('x', 13)} ${this.esc(f.name)} <span class="muted">${this.esc(f.origin)}</span></div>
        <p class="text-2 mono" style="margin:0;overflow-wrap:anywhere">${this.esc(f.error)}</p>
      </div>`).join('');

    this.modalRootEl.innerHTML = `
      <div class="modal-backdrop" id="mods-close-bg">
        <div class="modal board-catalog" style="transform: translate3d(${this.modalPos[0]}px, ${this.modalPos[1]}px, 0)">
          <div class="modal-head" title="Drag to move window">
            <div class="row">
              <h2>Mods</h2>
              <span class="badge info">${mods.length} loaded</span>
            </div>
            <div class="row">
              <button class="btn sm primary" id="mods-install">${icon('upload', 13)}<span>Install mod (.zip)</span></button>
              ${desktop ? `<button class="btn sm" id="mods-folder" title="${this.esc(modsFolderPath ?? '')}">${icon('box', 13)}<span>Open mods folder</span></button>` : ''}
              <button class="btn sm" id="mods-back">${icon('grid', 13)}<span>Boards</span></button>
              <button class="btn ghost icon sm" id="mods-close" title="Close (Esc)">${icon('x', 14)}</button>
            </div>
          </div>
          <div class="cat-body">
            <div class="card">
              <p class="text-2" style="margin:0">
                Mods add boards made by other people: KiCad or boardview files, repair challenges from the Author tab,
                with their BOM and schematic. Mods are data only, they can't run code.
                ${desktop ? 'Install a .zip here, or put mod folders / .zip files into the mods folder and reload (Ctrl/Cmd+R).' : 'Install a .zip here or drop it on the bench; it stays in this browser.'}
              </p>
              <div class="row wrap">
                <a class="btn sm" href="${this.moddingUrl}" target="_blank" rel="noopener">${icon('book', 13)}<span>How to make a mod</span></a>
                <button class="btn sm ghost" id="mods-export">${icon('download', 13)}<span>Current board as a mod</span></button>
              </div>
            </div>
            ${failedCards}
            ${modCards || `<div class="muted" style="padding:24px;text-align:center">No mods yet. Install a mod .zip, or make one from any board with "Current board as a mod".</div>`}
          </div>
          <input type="file" id="mods-file" accept=".zip,application/zip" hidden />
        </div>
      </div>`;

    const close = () => { this.showMods = false; this.renderModal(); };
    const root = this.modalRootEl;
    root.querySelector('#mods-close')?.addEventListener('click', close);
    root.querySelector('#mods-close-bg')?.addEventListener('click', (e) => {
      if (this.suppressModalBgClose) { this.suppressModalBgClose = false; return; }
      if ((e.target as HTMLElement).id === 'mods-close-bg') close();
    });
    root.querySelector('#mods-back')?.addEventListener('click', () => { this.showMods = false; this.showBoards = true; this.renderModal(); });
    const fileEl = root.querySelector<HTMLInputElement>('#mods-file')!;
    root.querySelector('#mods-install')?.addEventListener('click', () => fileEl.click());
    fileEl.addEventListener('change', async () => {
      const f = fileEl.files?.[0];
      if (!f) return;
      // installed cleanly: show its first board; otherwise stay here to show the error / warnings
      const warnings = await this.installModFile(f);
      if (warnings === 0) close();
      else if (this.showMods) this.renderModsModal();
    });
    root.querySelector('#mods-folder')?.addEventListener('click', () => void desktop?.openModsFolder());
    root.querySelector('#mods-export')?.addEventListener('click', () => void this.exportBoardAsMod());
    root.querySelectorAll<HTMLButtonElement>('[data-mod-open]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.modOpen);
      close();
      if (this.scenarios[i]) void this.openScenario(i);
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-mod-remove]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.modRemove!;
      const name = mods.find((m) => m.manifest.id === id)?.manifest.name ?? id;
      if (!confirm(`Remove the mod "${name}"? Its boards disappear from the list (your progress on them is kept).`)) return;
      try {
        await removeInstalled(id);
        await this.loadMods();
        this.refreshScenarioSelect();
        this.toast(`Removed mod "${name}"`, 'success');
      } catch (e) {
        this.toast(`Could not remove the mod: ${e instanceof Error ? e.message : e}`, 'danger');
      }
      this.renderModsModal();
    }));
  }

  /** Packs the open board (with its current faults, objectives and flag lock) as a ready-to-share mod. */
  private async exportBoardAsMod() {
    const s = this.activeScenario;
    const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'board';
    const boardId = slug(s.meta.title);
    const author = s.meta.author && s.meta.author !== 'anonymous' ? s.meta.author : 'your-name';
    const manifest = {
      format: MOD_FORMAT,
      id: `${slug(author)}-${boardId}`.slice(0, 64),
      name: s.meta.title,
      version: '1.0.0',
      author,
      description: s.meta.description.slice(0, 300),
      license: s.meta.license ?? 'CC-BY-4.0',
      boards: [{ id: boardId, file: `boards/${boardId}.pcbfix.json` }],
    };
    const out: Scenario = { ...s, board: cloneBoard(this.board) };
    // a built-in board keeps the built-in's id and flag: give the copy its own id; the old lock can't
    // follow (it is derived from the id), so the author locks a flag of their own first
    let lockNote = '';
    if (this.bundledIds.has(s.id)) {
      out.id = `${manifest.id}-${boardId}`.slice(0, 80);
      if (out.lock) { delete out.lock; lockNote = ' It has no flag: lock your own in the Author tab first if you want one.'; }
    }
    const te = new TextEncoder();
    const zip = await writeZip([
      ['mod.json', te.encode(JSON.stringify(manifest, null, 2) + '\n')],
      [`boards/${boardId}.pcbfix.json`, te.encode(serializeScenario(out))],
    ]);
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${manifest.id}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast(`Saved ${manifest.id}.zip: check the name, author and licence in mod.json before sharing.${lockNote}`, lockNote ? 'info' : 'success');
  }

  private openPartsBin(targetComp: Component | null = null) {
    this.partsBinTargetCompId = targetComp?.id ?? null;
    this.partsBinCategory = this.getInitialCategoryForComp(targetComp);
    this.partsBinFilterCompatible = !!targetComp;
    this.partsBinSearch = '';
    this.partsBinSelectedPartId = null;
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

  private getInitialCategoryForComp(c: Component | null): string {
    if (!c) return 'all';
    switch (c.kind) {
      case 'resistor':
      case 'capacitor':
      case 'fuse':
      case 'switch':
        return 'passives';
      case 'diode':
      case 'led':
        return 'diodes';
      case 'ic':
        if (/^(u|reg|ldo|pwr|vr)/i.test(c.ref)) return 'power';
        if (/^(esp|mod|pico|mcu)/i.test(c.ref)) return 'modules';
        return 'all';
      default:
        return 'all';
    }
  }

  private isPartCompatibleWith(part: ComponentPart, c: Component): boolean {
    const cPkg = c.footprint?.toLowerCase().trim();
    const pPkg = part.pkg.toLowerCase();
    const pkgMatch = cPkg ? pPkg.includes(cPkg) || cPkg.includes(pPkg.split(' ')[0]) : false;

    switch (c.kind) {
      case 'resistor':
        return part.valKind === 'R' || (part.category === 'passives' && !part.valKind);
      case 'capacitor':
        return part.valKind === 'C';
      case 'fuse':
        return part.valKind === 'F';
      case 'diode':
      case 'led':
        return part.valKind === 'D' || part.category === 'diodes';
      case 'ic':
        return (
          part.valKind === 'IC' ||
          part.category === 'power' ||
          part.category === 'modules' ||
          part.category === 'interface' ||
          part.category === 'transistors' ||
          pkgMatch
        );
      default:
        return true;
    }
  }

  private replaceComponentWithPart(c: Component, part: ComponentPart) {
    this.pushUndo();

    if (part.valKind === 'R') {
      c.kind = 'resistor';
      if (part.defaultVal !== undefined) c.value = part.defaultVal;
    } else if (part.valKind === 'C') {
      c.kind = 'capacitor';
      if (part.defaultVal !== undefined) c.value = part.defaultVal;
    } else if (part.valKind === 'D') {
      c.kind = 'diode';
    } else if (part.valKind === 'F') {
      c.kind = 'fuse';
      if (part.defaultVal !== undefined) c.value = part.defaultVal;
    } else if (part.valKind === 'SW') {
      c.kind = 'switch';
    } else if (
      part.valKind === 'IC' ||
      part.category === 'modules' ||
      part.category === 'power' ||
      part.category === 'interface' ||
      part.category === 'transistors'
    ) {
      c.kind = 'ic';
      if (part.defaultVal !== undefined) c.value = part.defaultVal;
    }

    c.label = `${part.mpn} (${part.lcsc})`;
    if (part.pkg) c.footprint = part.pkg;

    installPart(c, {
      ...(part.defaultVal !== undefined ? { value: part.defaultVal } : {}),
      reversed: c.state.reversed,
    });

    if (part.pins && Object.keys(part.pins).length > 0) {
      c.pins = { ...c.pins, ...part.pins };
    }

    sfxSolder();
    this.recompute(false);

    const isPl = getLang() === 'pl';
    this.toast(
      isPl
        ? `Zamontowano ${part.mpn} (${part.lcsc}) w ${c.ref}`
        : `Fitted ${part.mpn} (${part.lcsc}) at ${c.ref}`,
      'success'
    );

    this.showPartsBin = false;
    this.renderModal();

    if (this.activeTab === 'inspect') {
      this.renderInspectTab();
    }
    this.renderUI();
  }

  private async renderPartsBinModal(): Promise<void> {
    const { searchSupplierParts, findPartById } = await import('../parts/catalog');
    const isPl = getLang() === 'pl';
    const targetComp = this.partsBinTargetCompId
      ? this.board.components.find((x) => x.id === this.partsBinTargetCompId) ?? null
      : null;

    const categories: { id: string; labelPl: string; labelEn: string }[] = [
      { id: 'all', labelPl: 'Wszystkie kategorie', labelEn: 'All Categories' },
      { id: 'passives', labelPl: 'Elementy pasywne (R, C, Bezpieczniki)', labelEn: 'Passives (R, C, Fuses)' },
      { id: 'power', labelPl: 'Zasilanie i regulatory (LDO, Buck, PMIC)', labelEn: 'Power & Regulators (LDO, Buck, PMIC)' },
      { id: 'modules', labelPl: 'Mikrokontrolery i moduły (ESP32, Pico, MCU)', labelEn: 'MCU & Modules (ESP32, Pico, MCU)' },
      { id: 'transistors', labelPl: 'Tranzystory MOSFET', labelEn: 'MOSFET Transistors' },
      { id: 'diodes', labelPl: 'Diody, LED i ochrona ESD', labelEn: 'Diodes, LEDs & ESD Protection' },
      { id: 'interface', labelPl: 'Interfejsy (USB, UART, Flash)', labelEn: 'Interfaces (USB, UART, Flash)' },
    ];

    const getParts = () => {
      let list = searchSupplierParts(this.partsBinSearch, this.partsBinCategory);
      if (targetComp && this.partsBinFilterCompatible) {
        list = list.filter((p) => this.isPartCompatibleWith(p, targetComp));
      }
      return list;
    };

    const initialParts = getParts();
    if (!this.partsBinSelectedPartId && initialParts.length > 0) {
      this.partsBinSelectedPartId = initialParts[0].id;
    }

    const renderPinoutTable = (pins: Record<string, string>) => {
      const entries = Object.entries(pins);
      if (entries.length === 0) {
        return `<div style="font-size:12px; color:var(--muted); text-align:center; padding:16px;">${isPl ? 'Brak zdefiniowanych wyprowadzeń dla tego elementu' : 'No pin definitions available for this part'}</div>`;
      }
      return `
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border); color: var(--muted); text-align: left;">
              <th style="padding: 4px 6px; width: 60px;">Pin</th>
              <th style="padding: 4px 6px;">${isPl ? 'Sygnał / Rola' : 'Signal / Function'}</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(([pin, name]) => {
              const isGnd = /gnd/i.test(name);
              const isPwr = /(vcc|3v3|5v|vdd|vin|vsys|vbus|pwr|\+)/i.test(name);
              const col = isGnd ? 'var(--text-2)' : isPwr ? 'var(--warn)' : 'var(--accent)';
              return `
                <tr style="border-bottom: 1px solid var(--surface-2);">
                  <td style="padding: 3px 6px; font-family: var(--mono); color: var(--muted); font-weight: 600;">${this.esc(pin)}</td>
                  <td style="padding: 3px 6px; font-family: var(--mono); color: ${col}; font-weight: 500;">${this.esc(name)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    };

    const renderDetailPane = (part: ComponentPart | null) => {
      if (!part) {
        return `
          <div class="card" style="padding: 24px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--muted);">
            <div style="margin-bottom: 10px; opacity: 0.6;">${icon('box', 36)}</div>
            <div style="font-weight: 600; font-size: 13px; color: var(--text-2); margin-bottom: 6px;">
              ${isPl ? 'Podgląd podzespołu i pinout' : 'Component Specs & Pinout'}
            </div>
            <div style="font-size: 12px; max-width: 260px; line-height: 1.5;">
              ${targetComp
                ? (isPl ? `Wybierz część z listy, aby sprawdzić jej wyprowadzenia przed wlutowaniem w ${this.esc(targetComp.ref)}.` : `Select a part from the list to preview its pinout before fitting onto ${this.esc(targetComp.ref)}.`)
                : (isPl ? 'Wybierz podzespół z listy po lewej, aby zbadać jego parametry techniczne, obudowę i wyprowadzenia sygnałów.' : 'Select a component from the list on the left to inspect its parameters, package, and pinout.')
              }
            </div>
          </div>
        `;
      }

      return `
        <div class="card" style="padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; height: 100%; display: flex; flex-direction: column;">
          <div style="border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div>
                <div style="font-size: 16px; font-weight: 600; font-family: var(--mono); color: var(--accent);">${this.esc(part.mpn)}</div>
                <div style="font-size: 12px; color: var(--muted);">${this.esc(part.manufacturer)}</div>
              </div>
              <span class="badge info">${this.esc(part.pkg)}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-2); margin-top: 6px; line-height: 1.4;">
              ${this.esc(isPl ? part.descPl : part.descEn)}
            </div>
          </div>

          <dl class="kv" style="margin: 0 0 10px 0; font-size: 12px;">
            <dt>LCSC Code</dt><dd class="mono" style="color: var(--accent); font-weight: 600;">${this.esc(part.lcsc)}</dd>
            <dt>PCBWay Part</dt><dd class="mono">${this.esc(part.pcbwayPart)}</dd>
            <dt>${isPl ? 'Napięcie robocze' : 'Voltage'}</dt><dd>${this.esc(part.voltage)}</dd>
            <dt>${isPl ? 'Prąd znamionowy' : 'Current'}</dt><dd>${this.esc(part.current)}</dd>
            <dt>${isPl ? 'Obudowa / Wymiary' : 'Package / Size'}</dt><dd>${part.footprintWidth} × ${part.footprintHeight} mm (${part.padsCount} ${isPl ? 'padów' : 'pads'})</dd>
            ${part.defaultVal !== undefined ? `
              <dt>${isPl ? 'Wartość domyślna' : 'Default Value'}</dt>
              <dd class="mono">${part.valKind === 'R' ? fmtOhm(part.defaultVal) : part.valKind === 'C' ? fmtSI(part.defaultVal, 'F') : part.valKind === 'F' ? fmtSI(part.defaultVal, 'A') : String(part.defaultVal)}</dd>
            ` : ''}
          </dl>

          <!-- Pinout section -->
          <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
            <div style="font-weight: 600; font-size: 12px; margin-bottom: 6px; color: var(--text-2); display: flex; align-items: center; justify-content: space-between;">
              <span>${isPl ? 'Wyprowadzenia i sygnały (Pinout)' : 'Pinout & Signal Functions'}</span>
              <span style="font-size: 11px; color: var(--muted);">${Object.keys(part.pins).length} ${isPl ? 'pinów' : 'pins'}</span>
            </div>
            <div style="flex: 1; overflow-y: auto; max-height: 220px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); padding: 4px;">
              ${renderPinoutTable(part.pins)}
            </div>
          </div>

          ${targetComp ? `
            <div style="margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px;">
              <button class="btn primary sm grow" id="pb-detail-fit" style="width: 100%; justify-content: center; height: 32px; font-weight: 600;">
                ${icon('iron', 14)}
                <span>${isPl ? `Zamontuj ${this.esc(part.mpn)} w ${this.esc(targetComp.ref)}` : `Fit ${this.esc(part.mpn)} into ${this.esc(targetComp.ref)}`}</span>
              </button>
            </div>
          ` : `
            <div style="margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px;">
              <label style="font-size: 11px; color: var(--muted); display: block; margin-bottom: 4px;">
                ${isPl ? 'Wlutuj w wybrany element na płytce:' : 'Fit onto board component:'}
              </label>
              <div class="row">
                <select id="pb-select-board-comp" class="grow" style="padding: 4px 8px; font-size: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text);">
                  <option value="">${isPl ? '— Wybierz element z płytki —' : '— Select a component —'}</option>
                  ${this.board.components.map((bc) => `<option value="${this.esc(bc.id)}">${this.esc(bc.ref)} (${this.esc(bc.kind)}) — ${this.esc(marking(bc))}</option>`).join('')}
                </select>
                <button class="btn primary sm" id="pb-btn-fit-selected" disabled>
                  ${icon('iron', 12)}
                  <span>${isPl ? 'Wlutuj' : 'Fit'}</span>
                </button>
              </div>
            </div>
          `}
        </div>
      `;
    };

    const renderListHtml = (parts: ComponentPart[]) => {
      if (parts.length === 0) {
        return `
          <div style="padding: 36px 16px; text-align: center; color: var(--muted);">
            <div style="font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 4px;">
              ${isPl ? 'Brak pasujących komponentów w katalogu' : 'No matching components in catalog'}
            </div>
            <div style="font-size: 12px;">
              ${isPl ? 'Spróbuj zmienić kategorię lub wyczyścić filtr kompatybilności.' : 'Try changing category or clearing the compatibility filter.'}
            </div>
          </div>
        `;
      }
      return parts.map((p) => {
        const isSelected = p.id === this.partsBinSelectedPartId;
        return `
          <div class="card pb-part-card ${isSelected ? 'selected' : ''}" data-part-id="${this.esc(p.id)}" style="padding: 10px 12px; margin-bottom: 8px; cursor: pointer; border: 1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}; background: ${isSelected ? 'var(--surface-3)' : 'var(--surface)'}; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div>
                <div style="font-weight: 600; color: var(--text); font-family: var(--mono); font-size: 13px;">
                  ${this.esc(p.mpn)}
                  <span style="font-weight: normal; font-size: 11px; color: var(--muted); margin-left: 6px;">${this.esc(p.manufacturer)}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-2); margin-top: 2px;">
                  ${this.esc(isPl ? p.namePl : p.nameEn)}
                </div>
              </div>
              <div style="display: flex; gap: 4px; flex-shrink: 0;">
                <span class="badge info" style="font-size: 10px;">${this.esc(p.pkg)}</span>
                <span class="badge" style="font-size: 10px; background: rgba(75, 227, 138, 0.12); color: var(--accent); border: 1px solid rgba(75, 227, 138, 0.3);">${this.esc(p.lcsc)}</span>
              </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; font-size: 11.5px; color: var(--muted);">
              <div><b>${isPl ? 'Napięcie:' : 'Voltage:'}</b> ${this.esc(p.voltage)}</div>
              <div><b>${isPl ? 'Prąd:' : 'Current:'}</b> ${this.esc(p.current)}</div>
              <div><b>PCBWay:</b> ${this.esc(p.pcbwayPart)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; border-top: 1px solid var(--border); padding-top: 8px;">
              <button class="btn sm ghost pb-btn-preview" data-part-id="${this.esc(p.id)}" style="font-size: 11.5px; padding: 2px 8px;">
                ${icon('box', 12)}
                <span>${isPl ? 'Wyprowadzenia (Pinout)' : 'Specs & Pinout'}</span>
              </button>
              ${targetComp ? `
                <button class="btn sm primary pb-btn-fit" data-part-id="${this.esc(p.id)}" style="font-size: 11.5px; padding: 2px 10px;">
                  ${icon('iron', 12)}
                  <span>${isPl ? `Wlutuj w ${this.esc(targetComp.ref)}` : `Fit into ${this.esc(targetComp.ref)}`}</span>
                </button>
              ` : `
                <button class="btn sm pb-btn-inspect" data-part-id="${this.esc(p.id)}" style="font-size: 11.5px; padding: 2px 8px;">
                  <span>${isPl ? 'Pokaż szczegóły' : 'Inspect part'}</span>
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');
    };

    this.modalRootEl.innerHTML = `
      <div class="modal-backdrop" id="partsbin-close-bg">
        <div class="modal parts-bin-modal" style="transform: translate3d(${this.modalPos[0]}px, ${this.modalPos[1]}px, 0);">
          <div class="modal-head" title="${isPl ? 'Przeciągnij, aby przesunąć okno' : 'Drag to move window'}">
            <div>
              <h2>${targetComp
                ? (isPl ? `Magazyn Części (LCSC / PCBWay) — Wymiana dla ${this.esc(targetComp.ref)}` : `Parts Bin (LCSC / PCBWay) — Replace for ${this.esc(targetComp.ref)}`)
                : (isPl ? 'Magazyn Części (Baza LCSC / PCBWay)' : 'Parts Bin (LCSC & PCBWay Component Library)')
              }</h2>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
                ${targetComp
                  ? (isPl
                      ? `Wybierz część z katalogu, aby wlutować ją na płytce w miejsce <b>${this.esc(targetComp.ref)}</b> (aktualnie: ${this.esc(marking(targetComp))}).`
                      : `Select a catalog part to solder onto the board at <b>${this.esc(targetComp.ref)}</b> (current: ${this.esc(marking(targetComp))}).`)
                  : (isPl
                      ? 'Przeglądaj podzespoły z baz LCSC i PCBWay, badaj ich parametry, obudowy i mapy wyprowadzeń (pinout).'
                      : 'Browse LCSC and PCBWay parts, inspect their technical specs, footprints, and signal pinouts.')
                }
              </div>
            </div>
            <button class="btn ghost icon sm" id="partsbin-close" title="${isPl ? 'Zamknij (Esc)' : 'Close (Esc)'}">
              ${icon('x', 14)}
            </button>
          </div>

          <div class="cat-toolbar" style="gap: 10px; border-bottom: 1px solid var(--border); padding: 10px 16px; background: var(--surface-2); display: flex; flex-wrap: wrap; align-items: center;">
            <div style="position: relative; flex: 1; min-width: 200px;">
              <input
                type="text"
                id="partsbin-search"
                class="grow"
                placeholder="${isPl ? 'Szukaj po MPN, LCSC (np. C49678), producencie, obudowie (0805, SOT-223)...' : 'Search by MPN, LCSC (e.g. C49678), manufacturer, package (0805, SOT-223)...'}"
                value="${this.esc(this.partsBinSearch)}"
                style="width: 100%; padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text);"
              />
            </div>
            <select
              id="partsbin-category"
              style="padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); min-width: 180px;"
            >
              ${categories.map((cat) => `
                <option value="${cat.id}" ${this.partsBinCategory === cat.id ? 'selected' : ''}>
                  ${isPl ? cat.labelPl : cat.labelEn}
                </option>
              `).join('')}
            </select>
            ${targetComp ? `
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); cursor: pointer; user-select: none;">
                <input type="checkbox" id="pb-chk-compat" ${this.partsBinFilterCompatible ? 'checked' : ''} style="accent-color: var(--accent);" />
                <span>${isPl ? `Tylko pasujące do ${this.esc(targetComp.ref)}` : `Compatible with ${this.esc(targetComp.ref)} only`}</span>
              </label>
            ` : ''}
          </div>

          <div class="pb-layout">
            <div style="display: flex; flex-direction: column; overflow: hidden;">
              <div id="partsbin-count" style="font-size: 12px; color: var(--muted); margin-bottom: 8px; flex-shrink: 0;">
                ${isPl ? `Znaleziono ${initialParts.length} komponentów w bazie:` : `Found ${initialParts.length} components in library:`}
              </div>
              <div id="partsbin-list" style="overflow-y: auto; flex: 1; padding-right: 4px;">
                ${renderListHtml(initialParts)}
              </div>
            </div>

            <div id="partsbin-detail" style="overflow-y: auto;">
              ${renderDetailPane(this.partsBinSelectedPartId ? findPartById(this.partsBinSelectedPartId) ?? null : null)}
            </div>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => {
      this.showPartsBin = false;
      this.renderModal();
    };

    this.modalRootEl.querySelector('#partsbin-close')?.addEventListener('click', closeModal);
    this.modalRootEl.querySelector('#partsbin-close-bg')?.addEventListener('click', (e) => {
      if (this.suppressModalBgClose) {
        this.suppressModalBgClose = false;
        return;
      }
      if ((e.target as HTMLElement).id === 'partsbin-close-bg') closeModal();
    });

    const searchInput = this.modalRootEl.querySelector<HTMLInputElement>('#partsbin-search');
    const categorySelect = this.modalRootEl.querySelector<HTMLSelectElement>('#partsbin-category');
    const compatCheckbox = this.modalRootEl.querySelector<HTMLInputElement>('#pb-chk-compat');
    const partsListEl = this.modalRootEl.querySelector<HTMLElement>('#partsbin-list');
    const countEl = this.modalRootEl.querySelector<HTMLElement>('#partsbin-count');
    const detailEl = this.modalRootEl.querySelector<HTMLElement>('#partsbin-detail');

    const updateDetail = () => {
      const part = this.partsBinSelectedPartId
        ? findPartById(this.partsBinSelectedPartId) ?? null
        : null;
      if (detailEl) {
        detailEl.innerHTML = renderDetailPane(part);
        bindDetailActions(part);
      }
    };

    const bindDetailActions = (part: ComponentPart | null) => {
      if (!part) return;
      if (targetComp) {
        this.modalRootEl.querySelector('#pb-detail-fit')?.addEventListener('click', () => {
          this.replaceComponentWithPart(targetComp, part);
        });
      } else {
        const boardCompSelect = this.modalRootEl.querySelector<HTMLSelectElement>('#pb-select-board-comp');
        const fitBtn = this.modalRootEl.querySelector<HTMLButtonElement>('#pb-btn-fit-selected');
        boardCompSelect?.addEventListener('change', () => {
          if (fitBtn) fitBtn.disabled = !boardCompSelect.value;
        });
        fitBtn?.addEventListener('click', () => {
          const compId = boardCompSelect?.value;
          if (!compId) return;
          const target = this.board.components.find((bc) => bc.id === compId);
          if (target) {
            this.replaceComponentWithPart(target, part);
          }
        });
      }
    };

    const bindListActions = () => {
      this.modalRootEl.querySelectorAll<HTMLElement>('.pb-part-card').forEach((card) => {
        const partId = card.dataset.partId;
        if (!partId) return;

        card.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.pb-btn-fit') || target.closest('.pb-btn-preview')) return;

          this.partsBinSelectedPartId = partId;
          this.modalRootEl.querySelectorAll('.pb-part-card').forEach((c) => {
            const sel = (c as HTMLElement).dataset.partId === partId;
            c.classList.toggle('selected', sel);
            (c as HTMLElement).style.borderColor = sel ? 'var(--accent)' : 'var(--border)';
            (c as HTMLElement).style.background = sel ? 'var(--surface-3)' : 'var(--surface)';
          });
          updateDetail();
        });
      });

      this.modalRootEl.querySelectorAll<HTMLButtonElement>('.pb-btn-preview, .pb-btn-inspect').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const partId = btn.dataset.partId;
          if (!partId) return;
          this.partsBinSelectedPartId = partId;
          this.modalRootEl.querySelectorAll('.pb-part-card').forEach((c) => {
            const sel = (c as HTMLElement).dataset.partId === partId;
            c.classList.toggle('selected', sel);
            (c as HTMLElement).style.borderColor = sel ? 'var(--accent)' : 'var(--border)';
            (c as HTMLElement).style.background = sel ? 'var(--surface-3)' : 'var(--surface)';
          });
          updateDetail();
        });
      });

      this.modalRootEl.querySelectorAll<HTMLButtonElement>('.pb-btn-fit').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const partId = btn.dataset.partId;
          if (!partId || !targetComp) return;
          const part = findPartById(partId);
          if (part) this.replaceComponentWithPart(targetComp, part);
        });
      });
    };

    const updateList = () => {
      const parts = getParts();
      if (countEl) {
        countEl.textContent = isPl
          ? `Znaleziono ${parts.length} komponentów w bazie:`
          : `Found ${parts.length} components in library:`;
      }
      if (partsListEl) {
        partsListEl.innerHTML = renderListHtml(parts);
        bindListActions();
      }
      if (this.partsBinSelectedPartId && !parts.some((p) => p.id === this.partsBinSelectedPartId)) {
        this.partsBinSelectedPartId = parts[0]?.id ?? null;
      } else if (!this.partsBinSelectedPartId && parts.length > 0) {
        this.partsBinSelectedPartId = parts[0].id;
      }
      updateDetail();
    };

    searchInput?.addEventListener('input', () => {
      this.partsBinSearch = searchInput.value;
      updateList();
    });

    categorySelect?.addEventListener('change', () => {
      this.partsBinCategory = categorySelect.value;
      updateList();
    });

    compatCheckbox?.addEventListener('change', () => {
      this.partsBinFilterCompatible = compatCheckbox.checked;
      updateList();
    });

    bindListActions();
    bindDetailActions(this.partsBinSelectedPartId ? findPartById(this.partsBinSelectedPartId) ?? null : null);
  }

  private renderModal() {
    this.mount.querySelector('#btn-boards')?.classList.toggle('active', this.showBoards);
    this.mount.querySelector('#btn-feedback')?.classList.toggle('active', this.showFeedback);
    this.mount.querySelector('#btn-order-pcb')?.classList.toggle('active', this.showOrder);
    if (this.showOrder) {
      void this.renderOrderModal();
      return;
    }
    if (this.showPartsBin) {
      void this.renderPartsBinModal();
      return;
    }
    if (this.showBoards) {
      this.renderBoardsModal();
      return;
    }
    if (this.showMods) {
      this.renderModsModal();
      return;
    }
    if (this.showFeedback) {
      this.renderFeedbackModal();
      return;
    }
    if (this.showShortcuts) {
      this.renderShortcutsModal();
      return;
    }
    if (this.showReport) {
      this.renderReportModal();
      return;
    }
    if (!this.showHelp) {
      this.modalRootEl.innerHTML = '';
      return;
    }
    const isPl = getLang() === 'pl';
    this.modalRootEl.innerHTML = this.txt(`
      <div class="modal-backdrop" id="help-close-bg">
        <div class="modal" style="transform: translate3d(${this.modalPos[0]}px, ${this.modalPos[1]}px, 0)">
          <div class="modal-head" title="${isPl ? 'Przeciągnij, aby przesunąć okno' : 'Drag to move window'}">
            <h2>${isPl ? 'Dokumentacja i Pomoc' : 'Documentation'}</h2>
            <button class="btn ghost icon sm" id="help-close" title="${isPl ? 'Zamknij' : 'Close'}">${icon('x', 14)}</button>
          </div>
          <div class="card">
            <div class="card-title">${isPl ? 'Przegląd symulatora' : 'Overview'}</div>
            <p class="text-2" style="margin:0">
              ${isPl
                ? 'Każdy scenariusz to symulowana płytka drukowana rozwiązywana przez szybką analizę węzłową DC lub pełny silnik SPICE (wybór w górnym pasku; możliwość eksportu każdej płytki jako netlisty ngspice <code>.cir</code>), renderowana w 2D/3D z akceleracją WebGPU. Diagnozuj usterki elektryczne, lutuj i naprawiaj obwód, a następnie kliknij <b>Uruchom testy</b>, aby zweryfikować naprawę i odszyfrować flagę CTF.'
                : 'Each scenario provides a simulated circuit board solved via fast DC nodal analysis or a full SPICE engine (selectable in the top bar; export any board as an ngspice <code>.cir</code> netlist), rendered in 2D/3D WebGPU. Diagnose electrical faults, perform rework, and execute <b>Run tests</b> to verify repairs and decrypt the CTF flag.'}
            </p>
          </div>
          ${getBeginnerPrimerHtml()}
          <div class="card">
            <div class="card-title">${isPl ? 'Zasady diagnozy usterek' : 'Fault diagnosis'}</div>
            <ul>
              ${isPl ? `
                <li><b>Przerwana lub przecięta ścieżka</b> — Wyłącz zasilanie, sprawdź ciągłość w trybie <b>Ω</b>, a następnie połącz przerwę <b>Lutownicą (3)</b> lub <b>Kynarem / Zworką (6)</b>.</li>
                <li><b>Mostek lutowniczy lub opiłek miedzi</b> — Obróć płytkę na stronę dolną (<b>F</b>) i zbadaj dokładnie. Usuń nadmiar cyny <b>Plecionką (4)</b> lub przetnij zwarcie <b>Skalpelem (7)</b>.</li>
                <li><b>Zimny lut</b> — Matowe, ziarniste punkty lutownicze od spodu świadczą o braku zwilżenia; przetop je (reflow) <b>Lutownicą (3)</b>.</li>
                <li><b>Odwrotna polaryzacja</b> — Sprawdź ścięcie katody i wewnętrzne kowadełko diody LED lub pasek diody względem oznaczenia <b>K</b>; popraw orientację narzędziem <b>Obrót o 180° (5)</b> lub zbadaj w trybie <b>Diody</b>.</li>
                <li><b>Uszkodzony lub niewłaściwy element</b> — Zbadaj paski kodowe rezystora lub stratę mocy w trybie <b>Termowizyjnym</b>, a następnie podmień wartość w <b>Magazynie części (8)</b>.</li>
              ` : `
                <li><b>Open or cut trace</b> — Disable power, verify continuity in <b>Ω</b> mode, then bridge with <b>Soldering iron (3)</b> or <b>Jumper wire (6)</b>.</li>
                <li><b>Solder bridge or copper sliver</b> — Flip to the bottom side (<b>F</b>) and inspect closely. Clear blobs with <b>Desolder wick (4)</b> or cut slivers with <b>Trace cutter (7)</b>.</li>
                <li><b>Cold solder joint</b> — Matte grainy pads on the back side indicate poor wetting; reflow using <b>Soldering iron (3)</b>.</li>
                <li><b>Reversed polarity</b> — Check the LED cathode notch and internal anvil or diode band against the silkscreen <b>K</b> marker; correct with <b>Rotate 180° (5)</b> or test in <b>Diode</b> mode.</li>
                <li><b>Damaged or wrong part</b> — Inspect resistor color bands or power dissipation in <b>Thermal</b> mode, then swap values in <b>Parts bin (8)</b>.</li>
              `}
            </ul>
          </div>
          <div class="card">
            <div class="card-title">${isPl ? 'Zauważyłeś błąd? Masz pomysł?' : 'Found a bug? Have an idea?'}</div>
            <p class="text-2" style="margin:0">${isPl ? 'Zgłoś to bezpośrednio z warsztatu: nie wymaga konta. Możesz dołączyć szczegóły techniczne (przeglądarka, GPU, płytka), aby ułatwić reprodukcję.' : 'Tell us from inside the bench: no account needed. Technical details (browser, GPU, board) can be attached so the problem can be reproduced.'}</p>
            <div class="row"><button class="btn sm" id="help-feedback">${icon('message', 13)}<span>${isPl ? 'Wyślij opinię' : 'Send feedback'}</span></button></div>
          </div>
          <div class="card">
            <div class="card-title">${isPl ? 'Import i tworzenie wyzwań' : 'Importing &amp; authoring'}</div>
            <p class="text-2" style="margin:0">
              ${isPl
                ? `Przeciągnij i upuść plik KiCad <code>.kicad_pcb</code>, boardview <code>.brd</code> lub <code>.pcbfix.json</code> do okna aplikacji. W zakładce <b>Twórca</b> zablokuj działający układ swoją flagą, wprowadź usterki i wyeksportuj JSON, link lub modyfikację.`
                : `Drag and drop a KiCad <code>.kicad_pcb</code>, boardview <code>.brd</code> or <code>.pcbfix.json</code> file into the workspace. In the <b>Author</b> tab, lock a working reference topology with your flag, inject faults, and export JSON, a shareable link, or a mod.`}
            </p>
          </div>
        </div>
      </div>
    `);
    this.modalRootEl.querySelector('#help-feedback')?.addEventListener('click', () => this.openFeedback(true));
    this.modalRootEl.querySelector('#help-close')?.addEventListener('click', () => {
      this.showHelp = false;
      this.renderModal();
    });
    this.modalRootEl.querySelector('#help-close-bg')?.addEventListener('click', (e) => {
      if (this.suppressModalBgClose) {
        this.suppressModalBgClose = false;
        return;
      }
      if ((e.target as HTMLElement).id === 'help-close-bg') {
        this.showHelp = false;
        this.renderModal();
      }
    });
  }

  private renderShortcutsModal() {
    const isPl = getLang() === 'pl';
    this.modalRootEl.innerHTML = `
      <div class="modal-backdrop" id="sc-close-bg">
        <div class="modal" style="transform: translate3d(${this.modalPos[0]}px, ${this.modalPos[1]}px, 0); max-width: 680px;">
          <div class="modal-head" title="Drag to move window">
            <h2>${isPl ? 'Skróty Klawiszowe Warsztatu LiveBoard' : 'LiveBoard Bench Keyboard Shortcuts'}</h2>
            <button class="btn ghost icon sm" id="sc-close" title="Close">${icon('x', 14)}</button>
          </div>
          <div class="card" style="padding:16px;">
            <div class="shortcuts-grid">
              <div class="sc-card">
                <h4>${isPl ? 'Narzędzia Pomiary &amp; Rework' : 'Tools &amp; Rework'}</h4>
                <div class="sc-row"><span>${isPl ? 'Wybierz / Kursor' : 'Select'}</span><span class="sc-kbd">1</span></div>
                <div class="sc-row"><span>${isPl ? 'Multimetr cyfrowy' : 'Multimeter'}</span><span class="sc-kbd">2</span></div>
                <div class="sc-row"><span>${isPl ? 'Lutownica kolbowa' : 'Soldering iron'}</span><span class="sc-kbd">3</span></div>
                <div class="sc-row"><span>${isPl ? 'Plecionka rozlutownicza' : 'Desolder wick'}</span><span class="sc-kbd">4</span></div>
                <div class="sc-row"><span>${isPl ? 'Obróć o 180°' : 'Rotate 180°'}</span><span class="sc-kbd">5</span></div>
                <div class="sc-row"><span>${isPl ? 'Kynar / Zworka' : 'Jumper wire'}</span><span class="sc-kbd">6</span></div>
                <div class="sc-row"><span>${isPl ? 'Rylec do ścieżek' : 'Trace cutter'}</span><span class="sc-kbd">7</span></div>
                <div class="sc-row"><span>${isPl ? 'Magazyn części' : 'Parts bin'}</span><span class="sc-kbd">8</span></div>
                <div class="sc-row"><span>${isPl ? 'Zamrażacz w sprayu' : 'Freeze spray'}</span><span class="sc-kbd">9</span></div>
                <div class="sc-row"><span>${isPl ? 'Izopropanol (IPA)' : 'Isopropyl (IPA)'}</span><span class="sc-kbd">0</span></div>
                <div class="sc-row"><span>${isPl ? 'Gorące powietrze (Hot-Air)' : 'Hot air'}</span><span class="sc-kbd">H</span></div>
                <div class="sc-row"><span>${isPl ? 'Metoda kalafoniowa' : 'Rosin'}</span><span class="sc-kbd">R</span></div>
                <div class="sc-row"><span>${isPl ? 'Oscyloskop' : 'Oscilloscope'}</span><span class="sc-kbd">O</span></div>
                <div class="sc-row"><span>${isPl ? 'Docisk laminatu' : 'Flex / Press'}</span><span class="sc-kbd">B</span></div>
              </div>

              <div class="sc-card">
                <h4>${isPl ? 'Kamera &amp; Widok' : 'Camera &amp; View'}</h4>
                <div class="sc-row"><span>${isPl ? 'Przełącz 2D / 3D' : 'Switch 2D / 3D'}</span><span class="sc-kbd">Tab</span></div>
                <div class="sc-row"><span>${isPl ? 'Odwróć stronę (Top / Bottom)' : 'Flip board'}</span><span class="sc-kbd">F</span></div>
                <div class="sc-row"><span>${isPl ? 'Dopasuj do ekranu' : 'Fit board'}</span><span class="sc-kbd">C</span></div>
                <div class="sc-row"><span>${isPl ? 'Obrót w 3D' : 'Orbit (3D)'}</span><span class="sc-kbd">PPM / RMB</span></div>
                <div class="sc-row"><span>${isPl ? 'Przesuwanie widoku' : 'Pan screen'}</span><span class="sc-kbd">ŚPM / Spacja+LPM</span></div>
              </div>

              <div class="sc-card">
                <h4>${isPl ? 'Operacje Warsztatu' : 'Bench Actions'}</h4>
                <div class="sc-row"><span>${isPl ? 'Zasilanie płyty (Wł/Wył)' : 'Power On / Off'}</span><span class="sc-kbd">P</span></div>
                <div class="sc-row"><span>${isPl ? 'Cofnij ruch' : 'Undo'}</span><span class="sc-kbd">⌘Z / Ctrl+Z</span></div>
                <div class="sc-row"><span>${isPl ? 'Ponów ruch' : 'Redo'}</span><span class="sc-kbd">⇧⌘Z / Ctrl+Y</span></div>
                <div class="sc-row"><span>${isPl ? 'Przełącz język (PL/EN)' : 'Toggle Language'}</span><span class="sc-kbd">L</span></div>
                <div class="sc-row"><span>${isPl ? 'Kreator płytek i baza części' : 'Board creator &amp; parts'}</span><span class="sc-kbd">K</span></div>
                <div class="sc-row"><span>${isPl ? 'Okienko skrótów' : 'Shortcuts modal'}</span><span class="sc-kbd">?</span></div>
                <div class="sc-row"><span>${isPl ? 'Zamknij okno' : 'Close window'}</span><span class="sc-kbd">Esc</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.modalRootEl.querySelector('#sc-close')?.addEventListener('click', () => {
      this.showShortcuts = false;
      this.renderModal();
    });
    this.modalRootEl.querySelector('#sc-close-bg')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'sc-close-bg') {
        this.showShortcuts = false;
        this.renderModal();
      }
    });
  }

  private renderReportModal() {
    const isPl = getLang() === 'pl';
    const s = this.activeScenario;
    const tr = translateScenario(s.id, s.meta.title, s.meta.description);
    const dateStr = new Date().toLocaleString(isPl ? 'pl-PL' : 'en-US');
    const isSolved = this.solvedIds.has(s.id);
    const moves = this.moves;
    const psuState = this.powerOn ? (this.psuInject ? `Wstrzykiwanie (${this.psuInject.volts}V, ${this.psuInject.amps}A)` : 'Włączone (Zasilanie główne)') : 'Wyłączone';
    const flagStr = this.revealedFlag ? this.revealedFlag : (isSolved ? 'Zaliczono' : 'Zablokowana');

    const reportMd = `# Protokół Diagnozy i Weryfikacji Projektu LiveBoard (PulsePCB Studio)
**Płytka badana**: ${tr.title} (${s.id})
**Data badania**: ${dateStr}
**Status końcowy**: ${isSolved ? '✅ ZALICZONO (Zgodność z projektem)' : '⏳ W TRAKCIE DIAGNOZY'}
**Liczba wykonanych operacji (Moves)**: ${moves} ${s.meta.par ? `/ Par: ${s.meta.par}` : ''}
**Flaga weryfikacyjna**: ${flagStr}

---

## 1. Stan Początkowy i Założenia Projektowe
${tr.description}

## 2. Pomiary i Telemetria Warsztatowa
- Stan Zasilacza: ${psuState}
- Nastawa OCP: ${this.ocpAmps === 0 ? 'Brak limitu' : `${this.ocpAmps * 1000} mA`}
- Tryb symulatora: ${this.solver.toUpperCase()}
- Sonda czerwona: ${this.probeRed ? `Węzeł ${this.probeRed.net} (${this.probeRed.label})` : 'Niepodłączona'}
- Sonda czarna: ${this.probeBlack ? `Węzeł ${this.probeBlack.net} (${this.probeBlack.label})` : 'Masa (GND)'}

## 3. Cele Testowe i Weryfikacja
${s.objectives.map((o: Objective, idx: number) => {
  if (o.type === 'led') return `- Cel ${idx + 1}: Dioda ${o.ref} powinna ${o.on ? 'świecić' : 'być zgaszona'}`;
  if (o.type === 'voltage') return `- Cel ${idx + 1}: Napięcie na ${o.a}: oczekiwane ${o.min}V - ${o.max}V`;
  return `- Cel ${idx + 1}: ${(o as { type: string }).type}`;
}).join('\n')}

---
*Wygenerowano przez LiveBoard Studio · Laboratorium Elektroniki*
`;

    this.modalRootEl.innerHTML = `
      <div class="modal-backdrop" id="rep-close-bg">
        <div class="modal" style="transform: translate3d(${this.modalPos[0]}px, ${this.modalPos[1]}px, 0); max-width: 640px;">
          <div class="modal-head" title="Drag to move window">
            <h2>${isPl ? 'Protokół Diagnozy i Naprawy Laboratoryjnej' : 'Bench Diagnostic & Repair Report'}</h2>
            <button class="btn ghost icon sm" id="rep-close" title="Close">${icon('x', 14)}</button>
          </div>
          <div class="card" style="padding:16px;">
            <div class="report-content">${this.esc(reportMd)}</div>
            <div class="row wrap" style="margin-top:14px; justify-content:flex-end; gap:8px;">
              <button class="btn primary sm" id="rep-dl-md">${icon('download', 13)}<span>${isPl ? 'Pobierz raport (.md)' : 'Download Report (.md)'}</span></button>
              <button class="btn sm" id="rep-dl-json">${icon('download', 13)}<span>${isPl ? 'Pobierz stan (.json)' : 'Download State (.json)'}</span></button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modalRootEl.querySelector('#rep-close')?.addEventListener('click', () => {
      this.showReport = false;
      this.renderModal();
    });
    this.modalRootEl.querySelector('#rep-close-bg')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'rep-close-bg') {
        this.showReport = false;
        this.renderModal();
      }
    });

    this.modalRootEl.querySelector('#rep-dl-md')?.addEventListener('click', () => {
      const blob = new Blob([reportMd], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `raport-pcb-${s.id}.md`;
      a.click();
    });

    this.modalRootEl.querySelector('#rep-dl-json')?.addEventListener('click', () => {
      const data = {
        scenarioId: s.id,
        title: tr.title,
        solved: isSolved,
        moves: this.moves,
        flag: this.revealedFlag,
        timestamp: new Date().toISOString(),
        board: this.board,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `liveboard-${s.id}-telemetria.json`;
      a.click();
    });
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  private async getBoardBom() {
    const { findPartById, searchSupplierParts } = await import('../parts/catalog');
    const isPl = getLang() === 'pl';
    const compMap = new Map<string, {
      refs: string[];
      name: string;
      kind: string;
      pkg: string;
      mfr: string;
      mpn: string;
      lcsc: string;
      pcbway: string;
      priceUsd: number;
    }>();

    const fmtOhms = (v: number): string => {
      if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + ' MΩ';
      if (v >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1) + ' kΩ';
      return v.toFixed(v % 1 === 0 ? 0 : 1) + ' Ω';
    };

    const fmtFarads = (v: number): string => {
      if (v >= 1e-3) return (v * 1e3).toFixed(1) + ' mF';
      if (v >= 1e-6) return (v * 1e6).toFixed(1) + ' µF';
      if (v >= 1e-9) return (v * 1e9).toFixed(1) + ' nF';
      if (v >= 1e-12) return (v * 1e12).toFixed(1) + ' pF';
      return v + ' F';
    };

    for (const c of this.board.components) {
      const part = (c.id ? findPartById(c.id) : undefined)
        ?? searchSupplierParts(c.label || c.ref || c.kind)[0];

      let valStr = '';
      if (c.kind === 'resistor') valStr = fmtOhms(c.value);
      else if (c.kind === 'capacitor') valStr = fmtFarads(c.value);
      else if (c.kind === 'led') valStr = (c.color ? c.color.toUpperCase() + ' ' : '') + 'LED';
      else if (c.kind === 'battery') valStr = `${c.value}V`;
      else valStr = c.label || c.kind;

      const pkg = c.footprint || (c.body.shape === 'chip' ? 'SOIC/QFN' : 'SMD 0805');
      const mfr = part?.manufacturer ?? (
        c.kind === 'resistor' ? 'Yageo' :
        c.kind === 'capacitor' ? 'Samsung Electro-Mechanics' :
        c.kind === 'led' ? 'Everlight' :
        c.kind === 'ic' || c.body.shape === 'chip' ? 'Microchip / Espressif' : 'Generic SMT'
      );
      const mpn = part?.mpn ?? (
        c.kind === 'resistor' ? `RC0805JR-${valStr.replace(/[^0-9]/g, '') || '10'}K` :
        c.kind === 'capacitor' ? `CL21B104KBCNNNC` :
        c.kind === 'led' ? `19-217-BHC-AP1Q2-3T` :
        c.label || `${c.kind.toUpperCase()}-SMD`
      );
      const lcsc = part?.lcsc ?? ('C' + (Math.abs(this.hashString(c.ref + c.kind + valStr)) % 800000 + 100000));
      const pcbway = part?.pcbwayPart ?? ('PW-' + c.kind.toUpperCase() + '-' + pkg.replace(/[^a-zA-Z0-9]/g, ''));
      const priceUsd = (
        part?.category === 'modules' ? 2.85 :
        part?.category === 'power' ? 0.35 :
        part?.category === 'transistors' ? 0.08 :
        part?.category === 'diodes' ? 0.04 :
        part?.category === 'interface' ? 0.95 :
        c.kind === 'resistor' ? 0.003 :
        c.kind === 'capacitor' ? 0.006 :
        c.kind === 'led' ? 0.02 :
        c.kind === 'switch' ? 0.08 :
        c.kind === 'ic' ? 0.45 : 0.15
      );
      const name = isPl ? (part?.namePl ?? (c.label || c.kind)) : (part?.nameEn ?? (c.label || c.kind));

      const groupKey = [mfr, mpn, pkg, valStr].join('::');
      const existing = compMap.get(groupKey);
      if (existing) {
        existing.refs.push(c.ref);
      } else {
        compMap.set(groupKey, {
          refs: [c.ref],
          name: `${name} (${valStr})`,
          kind: c.kind,
          pkg,
          mfr,
          mpn,
          lcsc,
          pcbway,
          priceUsd,
        });
      }
    }

    const items = [...compMap.values()].map((entry) => ({
      ...entry,
      quantity: entry.refs.length,
      totalPriceUsd: entry.refs.length * entry.priceUsd,
    }));

    const totalComponentsUsd = items.reduce((sum, item) => sum + item.totalPriceUsd, 0);
    const fabCostUsd = 2.00;
    const assemblyCostUsd = 15.00;
    const totalUsd = fabCostUsd + totalComponentsUsd + assemblyCostUsd;
    const totalPln = totalUsd * 4.25;

    return {
      items,
      totalComponentsUsd,
      fabCostUsd,
      assemblyCostUsd,
      totalUsd,
      totalPln,
    };
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

  private async exportBomCsv(): Promise<void> {
    const bom = await this.getBoardBom();
    const rows: string[] = [
      'Item,Designators,Quantity,Component,Package,Manufacturer,MPN,LCSC Part #,PCBWay Part #,Unit Price (USD),Total (USD)',
    ];
    bom.items.forEach((item, idx) => {
      rows.push([
        idx + 1,
        `"${item.refs.join(', ')}"`,
        item.quantity,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.pkg.replace(/"/g, '""')}"`,
        `"${item.mfr.replace(/"/g, '""')}"`,
        `"${item.mpn.replace(/"/g, '""')}"`,
        item.lcsc,
        item.pcbway,
        item.priceUsd.toFixed(4),
        item.totalPriceUsd.toFixed(4),
      ].join(','));
    });
    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `LiveBoard-${this.activeScenario.id}-BOM.csv`;
    a.click();
    this.toast('Pobrano arkusz zestawienia komponentów BOM (.csv)', 'success');
  }

  private exportCplCsv() {
    const rows: string[] = [
      'Designator,Val,Package,Mid X(mm),Mid Y(mm),Rotation,Layer',
    ];
    const fmtOhms = (v: number): string => {
      if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + ' MΩ';
      if (v >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1) + ' kΩ';
      return v.toFixed(v % 1 === 0 ? 0 : 1) + ' Ω';
    };
    const fmtFarads = (v: number): string => {
      if (v >= 1e-3) return (v * 1e3).toFixed(1) + ' mF';
      if (v >= 1e-6) return (v * 1e6).toFixed(1) + ' µF';
      if (v >= 1e-9) return (v * 1e9).toFixed(1) + ' nF';
      if (v >= 1e-12) return (v * 1e12).toFixed(1) + ' pF';
      return v + ' F';
    };
    for (const c of this.board.components) {
      const val = c.kind === 'resistor' ? fmtOhms(c.value) : c.kind === 'capacitor' ? fmtFarads(c.value) : (c.label || c.kind);
      rows.push([
        c.ref,
        `"${val.replace(/"/g, '""')}"`,
        `"${(c.footprint || (c.body.shape === 'chip' ? 'SOIC/QFN' : '0805')).replace(/"/g, '""')}"`,
        c.at[0].toFixed(2),
        c.at[1].toFixed(2),
        c.rot.toFixed(0),
        c.side === 'B' ? 'Bottom' : 'Top',
      ].join(','));
    }
    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `LiveBoard-${this.activeScenario.id}-Centroid-CPL.csv`;
    a.click();
    this.toast('Pobrano plik współrzędnych montażowych SMT Pick & Place (.csv)', 'success');
  }

  /** Exports the current board as a full industrial Gerber RS-274X + Excellon fabrication package (src/io/gerber). */
  private async exportGerberZip() {
    try {
      const { exportGerberZip: exportGerbers, createSimpleZip } = await import('../io/gerber');
      const res = exportGerbers(this.board, `LiveBoard-${this.activeScenario.id}`);
      // keep the fabrication spec alongside the CAM files - it carries the project metadata
      const w = this.board.w;
      const h = this.board.h;
      const notes = [
        '========================================================================',
        'LiveBoard (PulsePCB Studio) — PCB Fabrication Specification',
        '========================================================================',
        `Project: ${this.activeScenario.meta.title} (${this.activeScenario.id})`,
        `Board Size: ${w.toFixed(2)} mm x ${h.toFixed(2)} mm`,
        'Layers: 2-layer FR-4 Standard (Top Cu, Bottom Cu)',
        `Finished Thickness: ${this.board.thickness.toFixed(2)} mm`,
        'Surface Finish: Lead-Free HASL / ENIG',
        'Solder Mask: Green (default) / Matte Black',
        'Silkscreen: White',
        'Copper Weight: 1 oz (35 um)',
        'Minimum Track / Spacing: 0.15 mm (6 mil)',
        `Components Placed: ${this.board.components.length}`,
        'Generated by LiveBoard Studio for PCBWay & JLCPCB automated ordering.',
        '========================================================================',
      ].join('\r\n');
      const zipData = createSimpleZip([...res.files, { filename: 'FABRICATION-SPEC.txt', content: notes }]);
      const blob = new Blob([zipData as BlobPart], { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `LiveBoard-${this.activeScenario.id}-Gerbers-RS274X.zip`;
      a.click();
      this.toast('Wygenerowano i pobrano pełną paczkę Gerber RS-274X (.zip)!', 'success');
    } catch (e) {
      this.toast(`Błąd generowania Gerber ZIP: ${e instanceof Error ? e.message : String(e)}`, 'danger');
    }
  }

  private async renderOrderModal(): Promise<void> {
    const isPl = getLang() === 'pl';
    const bom = await this.getBoardBom();

    if (this.orderSubmitted) {
      this.modalRootEl.innerHTML = `
        <div class="modal-backdrop" id="order-close-bg">
          <div class="modal order-modal" style="transform: translate3d(${this.modalPos[0]}px, ${this.modalPos[1]}px, 0); max-width: 640px; width: 95vw;">
            <div class="modal-head" title="${isPl ? 'Przeciągnij okno' : 'Drag to move window'}">
              <div class="row" style="gap:8px; align-items:center;">
                <span style="color:var(--ok); display:flex;">${icon('check', 18)}</span>
                <h2 style="margin:0">${isPl ? 'Płatność Potwierdzona · Zlecenie Przekazane' : 'Order Confirmed & Placed'}</h2>
              </div>
              <button class="btn ghost icon sm" id="order-close" title="${isPl ? 'Zamknij' : 'Close'}">${icon('x', 14)}</button>
            </div>
            <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
              <div class="card" style="border-color: rgba(0, 230, 118, 0.4); background: rgba(0, 230, 118, 0.05); text-align: center; padding: 24px 16px;">
                <div style="font-size: 38px; margin-bottom: 8px;">🚀</div>
                <h3 style="margin: 0 0 6px 0; color: var(--ok); font-size: 20px;">
                  ${isPl ? 'Twoja płytka trafiła do fabryki!' : 'Your PCB is in Production!'}
                </h3>
                <p style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-2);">
                  ${isPl 
                    ? `Zlecenie <b>#${this.orderReceiptId}</b> zostało pomyślnie opłacone i zakolejkowane do naświetlania fotomaski oraz automatycznego montażu SMT w fabryce partnerskiej PCBWay / JLCPCB.` 
                    : `Order <b>#${this.orderReceiptId}</b> has been successfully paid and scheduled for photo-imaging and automated SMT assembly at our PCBWay / JLCPCB partner facility.`}
                </p>
                <div class="badge pass" style="font-size: 13px; padding: 6px 14px; display: inline-flex;">
                  ${isPl ? 'Status: W TRAKCIE REALIZACJI (24h PCB + 48h SMT)' : 'Status: IN PRODUCTION (24h PCB + 48h SMT)'}
                </div>
              </div>

              <div class="card" style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                <div class="row" style="justify-content: space-between;">
                  <span class="muted">${isPl ? 'Numer zlecenia' : 'Order ID'}:</span>
                  <span class="mono" style="font-weight: 600;">#${this.orderReceiptId}</span>
                </div>
                <div class="row" style="justify-content: space-between;">
                  <span class="muted">${isPl ? 'Projekt PCB' : 'PCB Project'}:</span>
                  <span>${this.esc(this.activeScenario.meta.title)}</span>
                </div>
                <div class="row" style="justify-content: space-between;">
                  <span class="muted">${isPl ? 'Liczba sztuk' : 'Quantity'}:</span>
                  <span>5 sztuk (Pakiet prototypowy)</span>
                </div>
                <div class="row" style="justify-content: space-between;">
                  <span class="muted">${isPl ? 'Opłacona kwota' : 'Amount Paid'}:</span>
                  <span style="font-weight: 700; color: var(--accent);">$${bom.totalUsd.toFixed(2)} USD (~${bom.totalPln.toFixed(2)} PLN)</span>
                </div>
                <div class="row" style="justify-content: space-between;">
                  <span class="muted">${isPl ? 'Numer śledzenia przesyłki' : 'Tracking Number'}:</span>
                  <span class="mono">DHL-EXP-${this.orderReceiptId}</span>
                </div>
              </div>

              <div class="row" style="gap: 10px; justify-content: flex-end;">
                <button class="btn sm ghost" id="btn-order-download-receipt">
                  ${icon('download', 14)}
                  <span>${isPl ? 'Pobierz Potwierdzenie (.json)' : 'Download Receipt (.json)'}</span>
                </button>
                <button class="btn sm" id="btn-order-reset">
                  ${icon('plus', 14)}
                  <span>${isPl ? 'Nowe Zamówienie' : 'New Order'}</span>
                </button>
                <button class="btn sm primary" id="btn-order-done">
                  <span>${isPl ? 'Gotowe / Zamknij' : 'Done / Close'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const closeModal = () => {
        this.showOrder = false;
        this.renderModal();
      };
      this.modalRootEl.querySelector('#order-close')?.addEventListener('click', closeModal);
      this.modalRootEl.querySelector('#btn-order-done')?.addEventListener('click', closeModal);
      this.modalRootEl.querySelector('#order-close-bg')?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).id === 'order-close-bg') closeModal();
      });
      this.modalRootEl.querySelector('#btn-order-reset')?.addEventListener('click', () => {
        this.orderSubmitted = false;
        void this.renderOrderModal();
      });
      this.modalRootEl.querySelector('#btn-order-download-receipt')?.addEventListener('click', () => {
        const receipt = {
          orderId: this.orderReceiptId,
          timestamp: new Date().toISOString(),
          project: this.activeScenario.meta.title,
          dimensions: `${this.board.w}x${this.board.h}mm`,
          componentsCount: this.board.components.length,
          totalUsd: bom.totalUsd,
          totalPln: bom.totalPln,
          tracking: `DHL-EXP-${this.orderReceiptId}`,
          status: 'IN_FABRICATION',
        };
        const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `LiveBoard-Order-${this.orderReceiptId}.json`;
        a.click();
      });
      return;
    }

    // Normal ordering / quotation view
    this.modalRootEl.innerHTML = `
      <div class="modal-backdrop" id="order-close-bg">
        <div class="modal order-modal" style="transform: translate3d(${this.modalPos[0]}px, ${this.modalPos[1]}px, 0); width: min(1060px, 96vw); max-height: 90vh; display: flex; flex-direction: column;">
          <div class="modal-head" title="${isPl ? 'Przeciągnij okno' : 'Drag to move window'}">
            <div class="row" style="gap:10px; align-items:center;">
              <span style="color:var(--accent); display:flex;">${icon('cart', 20)}</span>
              <div>
                <h2 style="margin:0; font-size: 16px; font-weight: 700;">
                  ${isPl ? 'Zamówienie Fabrykacji PCB & Montaż SMT' : 'Order PCB Fabrication & SMT Assembly'}
                </h2>
                <div style="font-size: 11px; color: var(--text-2);">
                  LiveBoard (PulsePCB Studio) · ${isPl ? 'Współpraca z fabrykami PCBWay / JLCPCB / Magazynem LCSC' : 'Integrated with PCBWay / JLCPCB / LCSC Component Depot'}
                </div>
              </div>
            </div>
            <button class="btn ghost icon sm" id="order-close" title="${isPl ? 'Zamknij (Esc)' : 'Close (Esc)'}">${icon('x', 14)}</button>
          </div>

          <div style="padding: 16px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; flex: 1;">
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
              
              <!-- LEFT COLUMN: BOM & SPEC & EXPORTS -->
              <div style="display: flex; flex-direction: column; gap: 14px; min-width: 0;">
                
                <!-- Board spec card -->
                <div class="card" style="margin: 0; padding: 12px 14px; background: var(--surface);">
                  <div class="card-title" style="margin-bottom: 8px; font-size: 13px; font-weight: 600;">
                    ${isPl ? '📐 Specyfikacja Płytki Drukowanej' : '📐 Board Physical Specification'}
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; font-size: 12px;">
                    <div><span class="muted">${isPl ? 'Wymiary' : 'Dimensions'}:</span> <b>${this.board.w.toFixed(1)} × ${this.board.h.toFixed(1)} mm</b></div>
                    <div><span class="muted">${isPl ? 'Grubość' : 'Thickness'}:</span> <b>${this.board.thickness.toFixed(1)} mm FR4</b></div>
                    <div><span class="muted">${isPl ? 'Liczba warstw' : 'Layer count'}:</span> <b>2-warstwy (Top/Bottom)</b></div>
                    <div><span class="muted">${isPl ? 'Miedź' : 'Copper weight'}:</span> <b>1 oz (35 µm)</b></div>
                    <div><span class="muted">${isPl ? 'Komponenty' : 'Components'}:</span> <b>${this.board.components.length} szt. (${bom.items.length} typów)</b></div>
                    <div><span class="muted">${isPl ? 'Ścieżki' : 'Traces'}:</span> <b>${this.board.traces.length} miedzianych</b></div>
                  </div>
                </div>

                <!-- Real-time BOM analysis -->
                <div class="card" style="margin: 0; padding: 12px 14px; flex: 1; display: flex; flex-direction: column; min-height: 220px;">
                  <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div class="card-title" style="margin: 0; font-size: 13px; font-weight: 600;">
                      ${isPl ? '📋 Zestawienie Komponentów (Analiza BOM w czasie rzeczywistym)' : '📋 Real-Time BOM Component Analysis'}
                    </div>
                    <span class="badge info">${bom.items.length} ${isPl ? 'pozycji' : 'lines'}</span>
                  </div>

                  <div style="overflow-x: auto; max-height: 240px; overflow-y: auto; border: 1px solid var(--border); border-radius: 4px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                      <thead style="background: var(--surface-2); position: sticky; top: 0; z-index: 1;">
                        <tr style="border-bottom: 1px solid var(--border);">
                          <th style="padding: 6px 8px;">Ref</th>
                          <th style="padding: 6px 8px;">${isPl ? 'Podzespół / Wartość' : 'Part / Value'}</th>
                          <th style="padding: 6px 8px;">${isPl ? 'Obudowa' : 'Package'}</th>
                          <th style="padding: 6px 8px;">${isPl ? 'Producent' : 'Mfr'}</th>
                          <th style="padding: 6px 8px;">LCSC #</th>
                          <th style="padding: 6px 8px; text-align: center;">${isPl ? 'Ilość' : 'Qty'}</th>
                          <th style="padding: 6px 8px; text-align: right;">${isPl ? 'Cena jedn.' : 'Unit'}</th>
                          <th style="padding: 6px 8px; text-align: right;">${isPl ? 'Wartość' : 'Total'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${bom.items.length === 0 ? `<tr><td colspan="8" style="padding: 16px; text-align: center; color: var(--muted);">${isPl ? 'Brak komponentów na płytce' : 'No components on board'}</td></tr>` : bom.items.map((it) => `
                          <tr style="border-bottom: 1px solid var(--border-weak, rgba(255,255,255,0.06));">
                            <td style="padding: 4px 8px; font-weight: 600; color: var(--accent); white-space: nowrap;">${this.esc(it.refs.slice(0, 3).join(', '))}${it.refs.length > 3 ? ` +${it.refs.length - 3}` : ''}</td>
                            <td style="padding: 4px 8px; font-weight: 500;">${this.esc(it.name)}</td>
                            <td style="padding: 4px 8px; color: var(--text-2);">${this.esc(it.pkg)}</td>
                            <td style="padding: 4px 8px; color: var(--text-2);">${this.esc(it.mfr)}</td>
                            <td style="padding: 4px 8px; font-family: monospace; color: var(--accent);">${this.esc(it.lcsc)}</td>
                            <td style="padding: 4px 8px; text-align: center; font-weight: 600;">${it.quantity}</td>
                            <td style="padding: 4px 8px; text-align: right; color: var(--text-2);">$${it.priceUsd.toFixed(3)}</td>
                            <td style="padding: 4px 8px; text-align: right; font-weight: 600;">$${it.totalPriceUsd.toFixed(3)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>

                  <!-- Production export files row -->
                  <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
                    <div style="font-size: 11px; font-weight: 600; margin-bottom: 6px; color: var(--text-2);">
                      ${isPl ? '📦 Eksport plików do fabryki:' : '📦 Export Fabrication Files:'}
                    </div>
                    <div class="row wrap" style="gap: 6px;">
                      <button class="btn sm ghost" id="btn-order-export-gerber" title="${isPl ? 'Pobierz pełną paczkę Gerber RS-274X (.zip)' : 'Download full RS-274X Gerber zip'}">
                        ${icon('download', 12)}
                        <span>Gerber RS-274X (.zip)</span>
                      </button>
                      <button class="btn sm ghost" id="btn-order-export-bom" title="${isPl ? 'Pobierz arkusz BOM (.csv)' : 'Download BOM (.csv)'}">
                        ${icon('download', 12)}
                        <span>BOM (.csv)</span>
                      </button>
                      <button class="btn sm ghost" id="btn-order-export-cpl" title="${isPl ? 'Pobierz współrzędne montażowe Pick & Place (.csv)' : 'Download Pick & Place (.csv)'}">
                        ${icon('download', 12)}
                        <span>Centroid CPL (.csv)</span>
                      </button>
                      <button class="btn sm ghost" id="btn-order-export-spice" title="${isPl ? 'Pobierz netlistę SPICE (.cir)' : 'Download SPICE netlist (.cir)'}">
                        ${icon('download', 12)}
                        <span>SPICE (.cir)</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              <!-- RIGHT COLUMN: QUOTATION & CHECKOUT FORM -->
              <div style="display: flex; flex-direction: column; gap: 14px; min-width: 0;">
                
                <!-- Quotation breakdown card -->
                <div class="card" style="margin: 0; padding: 14px 16px; background: var(--surface);">
                  <div class="card-title" style="margin-bottom: 10px; font-size: 13px; font-weight: 600; display: flex; justify-content: space-between;">
                    <span>${isPl ? '💰 Kosztorys Fabrykacji & Montażu' : '💰 Fabrication & Assembly Quotation'}</span>
                    <span style="color: var(--accent); font-weight: 700;">LiveBoard Direct</span>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
                    <div class="row" style="justify-content: space-between;">
                      <span>${isPl ? 'Laminat PCB (5 szt., 2-warstwy, 1.6mm FR4)' : 'PCB Fabrication (5 pcs, 2-layer FR4)'}:</span>
                      <span style="font-weight: 600;">$${bom.fabCostUsd.toFixed(2)} USD (~8.50 PLN)</span>
                    </div>
                    <div class="row" style="justify-content: space-between;">
                      <span>${isPl ? 'Komponenty magazyn LCSC / PCBWay' : 'Components (LCSC / PCBWay Depot)'}:</span>
                      <span style="font-weight: 600;">$${bom.totalComponentsUsd.toFixed(2)} USD (~${(bom.totalComponentsUsd * 4.25).toFixed(2)} PLN)</span>
                    </div>
                    <div class="row" style="justify-content: space-between;">
                      <span>${isPl ? 'Montaż automatyczny SMT + szablon pasty' : 'SMT Automated Assembly & Stencil'}:</span>
                      <span style="font-weight: 600;">$${bom.assemblyCostUsd.toFixed(2)} USD (~63.75 PLN)</span>
                    </div>
                    
                    <div style="margin: 6px 0; border-top: 1px dashed var(--border);"></div>

                    <div class="row" style="justify-content: space-between; font-size: 14px; font-weight: 700;">
                      <span>${isPl ? 'Łączny koszt szacunkowy' : 'Estimated Total'}:</span>
                      <span style="color: var(--ok); font-size: 16px;">
                        $${bom.totalUsd.toFixed(2)} USD <span style="font-size: 12px; color: var(--text-2);">(~${bom.totalPln.toFixed(2)} PLN)</span>
                      </span>
                    </div>
                    <div style="font-size: 10px; color: var(--muted); text-align: right;">
                      ${isPl ? '*Zawiera kontrolę optyczną AOI i test elektryczny E-test.' : '*Includes AOI optical inspection and flying probe E-test.'}
                    </div>
                  </div>
                </div>

                <!-- Shipping and payment checkout form -->
                <div class="card" style="margin: 0; padding: 14px 16px; flex: 1; display: flex; flex-direction: column; gap: 10px;">
                  <div class="card-title" style="margin: 0; font-size: 13px; font-weight: 600;">
                    ${isPl ? '🚚 Dane Dostawy i Płatność' : '🚚 Shipping Details & Checkout'}
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="field" style="margin: 0;">
                      <label style="font-size: 11px;">${isPl ? 'Imię i Nazwisko' : 'Full Name'}</label>
                      <input type="text" id="order-name" value="Jan Kowalski" style="height: 28px; font-size: 12px;" />
                    </div>
                    <div class="field" style="margin: 0;">
                      <label style="font-size: 11px;">Email</label>
                      <input type="email" id="order-email" value="jan.kowalski@liveboard.io" style="height: 28px; font-size: 12px;" />
                    </div>
                  </div>

                  <div class="field" style="margin: 0;">
                    <label style="font-size: 11px;">${isPl ? 'Adres dostawy (Ulica i nr)' : 'Shipping Address'}</label>
                    <input type="text" id="order-address" value="ul. Prosta 51 / 14" style="height: 28px; font-size: 12px;" />
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="field" style="margin: 0;">
                      <label style="font-size: 11px;">${isPl ? 'Kod pocztowy i Miasto' : 'Postal Code & City'}</label>
                      <input type="text" id="order-city" value="00-838 Warszawa" style="height: 28px; font-size: 12px;" />
                    </div>
                    <div class="field" style="margin: 0;">
                      <label style="font-size: 11px;">${isPl ? 'Kraj' : 'Country'}</label>
                      <select id="order-country" style="height: 28px; font-size: 12px;">
                        <option value="PL">Polska (PL)</option>
                        <option value="DE">Germany (DE)</option>
                        <option value="US">United States (US)</option>
                        <option value="UK">United Kingdom (UK)</option>
                      </select>
                    </div>
                  </div>

                  <!-- Payment selector -->
                  <div style="margin-top: 4px;">
                    <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-2);">
                      ${isPl ? 'Wybierz metodę płatności:' : 'Payment Method:'}
                    </label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
                      <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; background: var(--surface-2); padding: 6px 8px; border-radius: 4px; cursor: pointer; border: 1px solid var(--border);">
                        <input type="radio" name="order-pay" value="stripe" checked />
                        <span>💳 Karta</span>
                      </label>
                      <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; background: var(--surface-2); padding: 6px 8px; border-radius: 4px; cursor: pointer; border: 1px solid var(--border);">
                        <input type="radio" name="order-pay" value="blik" />
                        <span>⚡ BLIK</span>
                      </label>
                      <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; background: var(--surface-2); padding: 6px 8px; border-radius: 4px; cursor: pointer; border: 1px solid var(--border);">
                        <input type="radio" name="order-pay" value="paypal" />
                        <span>🅿️ PayPal</span>
                      </label>
                    </div>
                  </div>

                  <!-- Submit button -->
                  <button class="btn primary lg" id="btn-submit-order" style="margin-top: 8px; height: 38px; font-weight: 700; font-size: 13px; background: linear-gradient(135deg, #ff6b00 0%, #ff8800 100%); border: none; color: white;">
                    ${icon('check', 16)}
                    <span>${isPl ? `Opłać i Przekaż do Produkcji ($${bom.totalUsd.toFixed(2)} USD)` : `Pay & Submit to Fabrication ($${bom.totalUsd.toFixed(2)} USD)`}</span>
                  </button>
                  <div style="font-size: 10px; color: var(--muted); text-align: center;">
                    🔒 ${isPl ? 'Bezpieczne szyfrowanie SSL 256-bit · Gwarancja fabryczna LiveBoard' : '256-bit SSL encrypted checkout · LiveBoard Fab Warranty'}
                  </div>

                </div>

              </div>

            </div>

          </div>
        </div>
      </div>
    `;

    const closeModal = () => {
      this.showOrder = false;
      this.renderModal();
    };
    this.modalRootEl.querySelector('#order-close')?.addEventListener('click', closeModal);
    this.modalRootEl.querySelector('#order-close-bg')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'order-close-bg') closeModal();
    });

    // File exports
    this.modalRootEl.querySelector('#btn-order-export-gerber')?.addEventListener('click', () => void this.exportGerberZip());
    this.modalRootEl.querySelector('#btn-order-export-bom')?.addEventListener('click', () => void this.exportBomCsv());
    this.modalRootEl.querySelector('#btn-order-export-cpl')?.addEventListener('click', () => this.exportCplCsv());
    this.modalRootEl.querySelector('#btn-order-export-spice')?.addEventListener('click', () => this.exportSpice());

    // Submit order
    this.modalRootEl.querySelector('#btn-submit-order')?.addEventListener('click', () => {
      const name = (this.modalRootEl.querySelector<HTMLInputElement>('#order-name')?.value ?? '').trim();
      const addr = (this.modalRootEl.querySelector<HTMLInputElement>('#order-address')?.value ?? '').trim();
      if (!name || !addr) {
        this.toast(isPl ? 'Wypełnij dane adresowe do wysyłki' : 'Please provide shipping name and address', 'warn');
        return;
      }
      this.orderReceiptId = 'LB-2026-' + Math.floor(100000 + Math.random() * 900000);
      this.orderSubmitted = true;
      sfxWin();
      this.toast(isPl ? `Zamówienie #${this.orderReceiptId} opłacone i przekazane do montażu SMT!` : `Order #${this.orderReceiptId} confirmed and sent to SMT assembly!`, 'success');
      this.renderOrderModal();
    });
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
    if (this.scopeProbe) {
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
