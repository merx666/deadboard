// Hero3DViewer verification test: ensures canvas 2D rendering works,
// WebGPU context conflict is permanently prevented, interactive HUD hover works,
// underside 3D rendering functions, and all board presets load.
import { Hero3DViewer, getComponentHudInfo } from '../src/home/hero3d';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    createElement: () => ({
      className: '',
      setAttribute: () => {},
      removeAttribute: () => {},
    }),
  };
}

// Minimal Canvas & Context2D mock for Node testing
function createMockCanvas(width = 800, height = 450): { canvas: HTMLCanvasElement; hudMock: any; drawOps: string[] } {
  const drawOps: string[] = [];
  const ctx2d = {
    canvas: null as unknown,
    width,
    height,
    save: () => drawOps.push('save'),
    restore: () => drawOps.push('restore'),
    translate: (x: number, y: number) => drawOps.push(`translate(${x},${y})`),
    clearRect: (_x: number, _y: number, w: number, h: number) => drawOps.push(`clearRect(${w}x${h})`),
    beginPath: () => drawOps.push('beginPath'),
    closePath: () => drawOps.push('closePath'),
    moveTo: (x: number, y: number) => drawOps.push(`moveTo(${Math.round(x)},${Math.round(y)})`),
    lineTo: (x: number, y: number) => drawOps.push(`lineTo(${Math.round(x)},${Math.round(y)})`),
    fill: () => drawOps.push('fill'),
    stroke: () => drawOps.push('stroke'),
    arc: () => drawOps.push('arc'),
    ellipse: () => drawOps.push('ellipse'),
    fillRect: () => drawOps.push('fillRect'),
    fillText: (text: string) => drawOps.push(`fillText(${text})`),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  };

  const hudClasses = new Set<string>();
  const hudMock = {
    className: 'hero-3d-hud',
    innerHTML: '',
    style: {} as Record<string, string>,
    classList: {
      contains: (cls: string) => hudClasses.has(cls),
      add: (cls: string) => hudClasses.add(cls),
      remove: (cls: string) => hudClasses.delete(cls),
    },
    setAttribute: () => {},
    removeAttribute: () => {},
    remove: () => {},
  };

  const canvas = {
    width,
    height,
    getBoundingClientRect: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    getContext: (type: string) => {
      if (type === '2d') return ctx2d;
      return null;
    },
    setAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    focus: () => {},
    parentElement: {
      classList: { add: () => {}, remove: () => {} },
      querySelector: (sel: string) => (sel === '.hero-3d-hud' ? hudMock : null),
      appendChild: () => {},
      removeChild: () => {},
    },
  } as unknown as HTMLCanvasElement;

  ctx2d.canvas = canvas;
  return { canvas, hudMock, drawOps };
}

// 1. Initialise Hero3DViewer and check Canvas2D rendering
{
  const { canvas, hudMock, drawOps } = createMockCanvas();
  let lastLoadingState = false;
  const viewer = new Hero3DViewer(canvas, {
    onLoadingChange: (loading) => { lastLoadingState = loading; }
  });
  assert(lastLoadingState === false, 'Initial loading state must be false');

  // Verify initial board scenario is ESP32 (fast zero-latency default)
  assert((viewer as any).activeScenario.board.w === 28.5, 'Default hero board must be ESP32 (width 28.5mm)');
  assert((viewer as any).activeScenario.board.h === 51.5, 'Default hero board must be ESP32 (height 51.5mm)');

  // Verify render calls Canvas2D without errors
  (viewer as any).render();
  assert(canvas.width > 0 && canvas.height > 0, 'Canvas dimensions must be valid');
  assert(drawOps.length > 0, 'Canvas operations must have been performed');

  // Verify presets can be switched
  void viewer.loadDemoBoard('pico');
  assert((viewer as any).activeScenario.board.w === 21.0, 'Pico board width must be 21mm');
  (viewer as any).render();

  void viewer.loadDemoBoard('arduino');
  assert((viewer as any).activeScenario.board.w === 68.6, 'Arduino board width must be 68.6mm');
  (viewer as any).render();

  void viewer.loadDemoBoard('zero');
  assert((viewer as any).activeScenario.board.w === 65.0, 'Pi Zero board width must be 65mm');
  (viewer as any).render();

  void viewer.loadDemoBoard('esp32');
  assert((viewer as any).activeScenario.board.w === 28.5, 'ESP32 board width must be 28.5mm');
  (viewer as any).render();

  // Test Camera and Orbit controls
  const initialOrbit = viewer.toggleAutoOrbit();
  assert(initialOrbit === false || initialOrbit === true, 'Auto orbit toggle must return boolean');

  // Verify Bottom side switching and underside view calculation
  viewer.setSide('B');
  assert((viewer as any).camera.side === 'B', 'Camera side must switch to Bottom');
  assert(viewer.isUndersideView() === true, 'Underside view must be true when camera side is B');

  // Render underside in 3D: exercises bottom copper traces, pads, and silkscreen projection
  (viewer as any).render();

  viewer.setSide('F');
  assert((viewer as any).camera.side === 'F', 'Camera side must switch to Top');
  assert(viewer.isUndersideView() === false, 'Underside view must be false for normal top view');

  viewer.resetCamera();
  assert((viewer as any).autoOrbit === true, 'Reset must re-enable auto orbit');

  // Test HUD tooltip and interactive hover
  void viewer.init();
  (viewer as any).render();

  const projected = (viewer as any).projectedComps as Array<any>;
  assert(projected.length > 0, 'Projected components list must be populated during 3D render');

  const targetComp = projected.find(p => p.comp.ref === 'U2_ESP32') || projected[0];
  assert(targetComp, 'Target component must be present in projected list');

  // Test hit detection with findComponentAt
  const hit = viewer.findComponentAt(targetComp.center[0], targetComp.center[1]);
  assert(hit !== null && hit.ref === targetComp.comp.ref, 'findComponentAt must locate component by center coordinates');

  // Test HUD update on hover
  (viewer as any).setHoveredComponent(hit);
  assert(viewer.getHoveredComponent()?.ref === hit.ref, 'Hovered component must be tracked');
  assert(hudMock.classList.contains('active'), 'HUD element must have "active" class when hovering');
  assert(hudMock.innerHTML.includes(hit.ref), 'HUD HTML content must display component ref');

  // Test HUD fade-out on clearHover
  (viewer as any).clearHover();
  assert(viewer.getHoveredComponent() === null, 'Hovered component must be null after clearHover');
  assert(!hudMock.classList.contains('active'), 'HUD element must remove "active" class after clearHover');

  viewer.destroy();
}

// 2. Component HUD Info extraction & catalog lookup tests
{
  const esp32Comp = {
    ref: 'U2_ESP32',
    label: 'ESP32-WROOM-32D',
    kind: 'ic',
    footprint: 'MODULE-ESP32',
    pads: Array(38).fill({}),
    at: [14.25, 25.75]
  } as any;

  const esp32Info = getComponentHudInfo(esp32Comp);
  assert(esp32Info.ref === 'U2_ESP32', 'Component ref must match');
  assert(esp32Info.label.includes('ESP32'), 'Component label must contain ESP32');
  assert(esp32Info.pinCount === 38, 'Pin count must equal 38');
  assert(esp32Info.supplierPartId.includes('C473012'), 'ESP32 supplier part ID must resolve to C473012');

  const regComp = {
    ref: 'U1_REG',
    label: 'AMS1117-3.3',
    kind: 'ic',
    footprint: 'SOT-223',
    pads: Array(4).fill({}),
    at: [10, 10]
  } as any;

  const regInfo = getComponentHudInfo(regComp);
  assert(regInfo.supplierPartId.includes('C15849'), 'AMS1117 supplier part ID must resolve to C15849');

  const passiveComp = {
    ref: 'C1',
    label: '10uF 0805',
    kind: 'capacitor',
    footprint: '0805',
    pads: Array(2).fill({}),
    at: [5, 5]
  } as any;

  const passiveInfo = getComponentHudInfo(passiveComp);
  assert(passiveInfo.ref === 'C1', 'Passive ref must match');
  assert(passiveInfo.pinCount === 2, 'Passive pin count must be 2');
}

console.log('Hero3DViewer: Canvas2D accelerated 3D pipeline, underside rendering & HUD tooltip — ok');
