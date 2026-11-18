// Interactive 3D Motherboard Viewer for DEADBOARD homepage
// Renders open-hardware boards (ESP32, Pico, Arduino Uno, MNT Reform 2, Jetson Nano)
// with high-performance 360-degree free orbit, mouse drag, touch pinch zoom, and Top/Bottom inspection.
//
// IMPORTANT: This viewer uses a dedicated Canvas2D pipeline for the homepage hero section.
// WebGPU must NOT be initialized on this canvas — acquiring a 'webgpu' context prevents
// subsequent getContext('2d') calls from succeeding (browser limitation: one context type
// per canvas lifetime). The full WebGPU renderer is used only inside the app workbench
// (app.html) where it has its own dedicated canvas.

import { createEsp32DevScenario, createRaspberryPiPicoScenario, createArduinoUnoScenario, createRaspberryPiZeroScenario } from '../boards/presets';
import { Camera } from '../render/camera';
import { buildConnectivity, type Conn } from '../connectivity';
import { SUPPLIER_PARTS, type ComponentPart } from '../parts/catalog';
import type { Board, Component, Scenario } from '../types';

const safeRaf = (cb: FrameRequestCallback): number =>
  typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number);
const safeCaf = (id: number): void => {
  if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(id);
  else clearTimeout(id);
};

export interface HeroViewerOptions {
  onLoadingChange?: (loading: boolean, text?: string) => void;
}

export interface ComponentHudInfo {
  ref: string;
  label: string;
  kind: string;
  packageShape: string;
  pinCount: number;
  supplierPartId: string;
  mpn?: string;
  manufacturer?: string;
  value?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getComponentHudInfo(comp: Component): ComponentHudInfo {
  const ref = comp.ref;
  const label = comp.label || comp.ref;
  const kind = (comp.kind || 'generic').toUpperCase();
  const pinCount = comp.pads ? comp.pads.length : 0;

  // Package shape / footprint
  let packageShape = comp.footprint || comp.body?.shape || 'SMD';
  if (comp.body?.w && comp.body?.h && packageShape === comp.body.shape) {
    packageShape = `${comp.body.shape} (${comp.body.w.toFixed(1)}×${comp.body.h.toFixed(1)}mm)`;
  }

  // Lookup in SUPPLIER_PARTS
  const normRef = ref.toLowerCase();
  const normLabel = label.toLowerCase();
  let part: ComponentPart | undefined = SUPPLIER_PARTS.find((p) => {
    const pId = p.id.toLowerCase();
    const pMpn = p.mpn.toLowerCase();
    return normRef.includes(pId) || normLabel.includes(pId) || normRef.includes(pMpn) || normLabel.includes(pMpn);
  });

  if (!part) {
    if (normRef.includes('esp32') || normLabel.includes('esp32') || normRef.includes('wroom') || normLabel.includes('wroom')) {
      part = SUPPLIER_PARTS.find((p) => p.id === 'esp32-wroom-32d');
    } else if (normRef.includes('atmega') || normLabel.includes('atmega') || normLabel.includes('328p')) {
      part = SUPPLIER_PARTS.find((p) => p.id === 'atmega328p-pu');
    } else if (normRef.includes('rp2040') || normLabel.includes('rp2040')) {
      part = SUPPLIER_PARTS.find((p) => p.id === 'rp2040');
    } else if (normRef.includes('ams1117') || normLabel.includes('ams1117') || normLabel.includes('1117')) {
      part = SUPPLIER_PARTS.find((p) => p.id === 'ams1117-33' || p.id === 'ams1117-3.3');
    } else if (normRef.includes('ch340') || normLabel.includes('ch340')) {
      part = SUPPLIER_PARTS.find((p) => p.id === 'ch340c');
    } else if (normRef.includes('cp2102') || normLabel.includes('cp2102')) {
      part = SUPPLIER_PARTS.find((p) => p.id === 'cp2102');
    } else if (normRef.includes('bme280') || normLabel.includes('bme280')) {
      part = SUPPLIER_PARTS.find((p) => p.id === 'bme280');
    } else if (normRef.includes('ws2812') || normLabel.includes('ws2812')) {
      part = SUPPLIER_PARTS.find((p) => p.id === 'ws2812b');
    }
  }

  let supplierPartId = '—';
  let mpn: string | undefined = undefined;
  let manufacturer: string | undefined = undefined;
  if (part) {
    supplierPartId = part.lcsc ? `LCSC ${part.lcsc}` : (part.pcbwayPart || part.mpn);
    mpn = part.mpn;
    manufacturer = part.manufacturer;
  } else if (comp.kind === 'connector' && (normRef.includes('usb') || normLabel.includes('usb'))) {
    supplierPartId = 'Type-B / MicroUSB';
  }

  // Format value if known
  let valueStr: string | undefined;
  if (comp.value && comp.value > 0) {
    if (comp.kind === 'resistor') {
      const v = comp.value;
      valueStr = v >= 1e6 ? `${(v / 1e6).toFixed(1)} MΩ` : v >= 1e3 ? `${(v / 1e3).toFixed(1)} kΩ` : `${v} Ω`;
    } else if (comp.kind === 'capacitor') {
      const v = comp.value;
      valueStr = v >= 1e-6 ? `${(v * 1e6).toFixed(1)} µF` : v >= 1e-9 ? `${(v * 1e9).toFixed(1)} nF` : `${(v * 1e12).toFixed(1)} pF`;
    } else if (comp.kind === 'battery') {
      valueStr = `${comp.value} V`;
    }
  }

  return {
    ref,
    label,
    kind,
    packageShape,
    pinCount,
    supplierPartId,
    mpn,
    manufacturer,
    value: valueStr
  };
}

export class Hero3DViewer {
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private activeScenario: Scenario;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private autoOrbit = true;
  private autoOrbitSpeed = 0.35; // degrees per frame
  private rafId = 0;
  private lastTime = 0;
  private isVisible = true;
  private options: HeroViewerOptions;
  private container: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;
  private hudEl: HTMLElement | null = null;
  private hasInteracted = false;

  // Touch pinch tracking
  private touchStartDist = 0;
  private isPinching = false;

  // Interactive Hover & HUD state
  private hoveredComp: Component | null = null;
  private lastCursorX: number | null = null;
  private lastCursorY: number | null = null;
  private projectedComps: Array<{
    comp: Component;
    box: [number, number, number, number]; // [minX, minY, maxX, maxY] in CSS pixels
    center: [number, number];
    distSqToCamera: number;
  }> = [];

  // Cache expensive electrical connectivity graphs per board
  private connCache = new WeakMap<Board, Conn>();

  // Observers & abort controller for clean lifecycle
  private intersectionObserver: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private abortController = new AbortController();

  constructor(canvas: HTMLCanvasElement, options: HeroViewerOptions = {}) {
    this.canvas = canvas;
    this.options = options;
    this.container = canvas.parentElement;
    this.hintEl = this.container?.querySelector('.hero-3d-hint') ?? null;

    this.camera = new Camera();
    this.camera.setMode('3d');

    // Default to ESP32 DevBoard preset: lightweight, 0ms load, immediate 60/120 FPS
    this.activeScenario = createEsp32DevScenario();
  }

  async init() {
    this.fitCanvas();
    this.updateCameraForBoard();

    // Setup interactive HUD tooltip container
    if (this.container && typeof document !== 'undefined') {
      let hud = this.container.querySelector<HTMLElement>('.hero-3d-hud');
      if (!hud && typeof document.createElement === 'function') {
        hud = document.createElement('div');
        hud.className = 'hero-3d-hud';
        hud.setAttribute('aria-live', 'polite');
        this.container.appendChild(hud);
      }
      this.hudEl = hud;
    }

    // Hero viewer uses Canvas2D exclusively — WebGPU must NOT be initialized on
    // this canvas because acquiring a 'webgpu' context prevents getContext('2d')
    // from ever succeeding (one context type per canvas lifetime).

    // Set accessibility attributes on canvas
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.setAttribute('role', 'region');
    this.canvas.setAttribute('aria-label', 'Interaktywny model 3D płyty drukowanej. Użyj myszy lub strzałek, aby obracać płytkę.');

    this.bindControls();
    this.setupObservers();
    this.startLoop();
  }

  isUndersideView(): boolean {
    const effectiveFlipT = (this.camera.side === 'B' && this.camera.flipT === 0) ? 1 : this.camera.flipT;
    return this.camera.side === 'B' || effectiveFlipT > 0.5 || (this.camera.pitch < -5 && Math.abs(this.camera.pitch) > 5);
  }

  findComponentAt(cssX: number, cssY: number): Component | null {
    let closestComp: Component | null = null;
    let minCenterDistSq = Infinity;

    for (let i = 0; i < this.projectedComps.length; i++) {
      const item = this.projectedComps[i];
      const [minX, minY, maxX, maxY] = item.box;
      const pad = 6; // small tolerance for easy hovering over SMD passives

      if (cssX >= minX - pad && cssX <= maxX + pad && cssY >= minY - pad && cssY <= maxY + pad) {
        const dx = cssX - item.center[0];
        const dy = cssY - item.center[1];
        const distSq = dx * dx + dy * dy;
        if (distSq < minCenterDistSq) {
          minCenterDistSq = distSq;
          closestComp = item.comp;
        }
      }
    }
    return closestComp;
  }

  setHoveredComponent(comp: Component | null) {
    if (this.hoveredComp === comp) return;
    this.hoveredComp = comp;

    if (this.hudEl) {
      if (comp) {
        const info = getComponentHudInfo(comp);
        this.hudEl.innerHTML = `
          <div class="hero-hud-header">
            <span class="hero-hud-ref">${escapeHtml(info.ref)}</span>
            <span class="hero-hud-kind">${escapeHtml(info.kind)}</span>
          </div>
          <div class="hero-hud-label">${escapeHtml(info.label)}</div>
          <div class="hero-hud-grid">
            <div class="hero-hud-item"><span class="hero-hud-k">Package:</span> <span class="hero-hud-v">${escapeHtml(info.packageShape)}</span></div>
            <div class="hero-hud-item"><span class="hero-hud-k">Pins:</span> <span class="hero-hud-v">${info.pinCount}</span></div>
            <div class="hero-hud-item"><span class="hero-hud-k">Part / LCSC:</span> <span class="hero-hud-v">${escapeHtml(info.supplierPartId)}</span></div>
            ${info.value ? `<div class="hero-hud-item"><span class="hero-hud-k">Value:</span> <span class="hero-hud-v">${escapeHtml(info.value)}</span></div>` : ''}
          </div>
        `;
        this.hudEl.classList.add('active');
      } else {
        this.hudEl.classList.remove('active');
      }
    }

    this.startLoop();
  }

  clearHover() {
    this.lastCursorX = null;
    this.lastCursorY = null;
    this.setHoveredComponent(null);
  }

  getHoveredComponent(): Component | null {
    return this.hoveredComp;
  }

  private setupObservers() {
    // 1. IntersectionObserver: Pause rendering loop when scrolled out of viewport
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries.some((e) => e.isIntersecting);
          if (visible !== this.isVisible) {
            this.isVisible = visible;
            if (this.isVisible) {
              this.lastTime = performance.now();
              this.startLoop();
            } else if (this.rafId) {
              safeCaf(this.rafId);
              this.rafId = 0;
            }
          }
        },
        { threshold: 0.1 }
      );
      this.intersectionObserver.observe(this.canvas);
    }

    // 2. ResizeObserver: Update canvas buffer dimensions cleanly
    if ('ResizeObserver' in window && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.fitCanvas();
        this.render();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  private fitCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(300, Math.floor((rect.width || 800) * dpr));
    const h = Math.max(200, Math.floor((rect.height || 450) * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private updateCameraForBoard() {
    const b = this.activeScenario.board;
    this.camera.fitBoard(b.w, b.h);
    this.camera.pitch = 38;
    this.camera.yaw = -28;
  }

  private getConn(b: Board): Conn {
    let c = this.connCache.get(b);
    if (!c) {
      c = buildConnectivity(b);
      this.connCache.set(b, c);
    }
    return c;
  }

  async loadDemoBoard(id: string) {
    if (id === 'reform') {
      this.options.onLoadingChange?.(true, 'Wczytywanie MNT Reform 2 (3.4 MB)...');
      try {
        const res = await fetch('./demos/demo-mnt-reform2-mb30.pcbfix.json');
        if (res.ok) {
          const json = await res.json();
          this.activeScenario = json;
          this.getConn(this.activeScenario.board);
          this.updateCameraForBoard();
        }
      } catch (err) {
        console.warn('Could not load Reform 2 demo:', err);
      } finally {
        this.options.onLoadingChange?.(false);
      }
    } else if (id === 'jetson') {
      this.options.onLoadingChange?.(true, 'Wczytywanie Jetson Nano Baseboard...');
      try {
        const res = await fetch('./demos/demo-antmicro-jetson-nano-bb.pcbfix.json');
        if (res.ok) {
          const json = await res.json();
          this.activeScenario = json;
          this.getConn(this.activeScenario.board);
          this.updateCameraForBoard();
        }
      } catch (err) {
        console.warn('Could not load Jetson Nano demo:', err);
      } finally {
        this.options.onLoadingChange?.(false);
      }
    } else if (id === 'esp32') {
      this.activeScenario = createEsp32DevScenario();
      this.updateCameraForBoard();
    } else if (id === 'pico') {
      this.activeScenario = createRaspberryPiPicoScenario();
      this.updateCameraForBoard();
    } else if (id === 'arduino') {
      this.activeScenario = createArduinoUnoScenario();
      this.updateCameraForBoard();
    } else if (id === 'zero') {
      this.activeScenario = createRaspberryPiZeroScenario();
      this.updateCameraForBoard();
    }

    this.startLoop();
  }

  private dismissHint() {
    if (!this.hasInteracted) {
      this.hasInteracted = true;
      if (this.hintEl) {
        this.hintEl.style.transition = 'opacity 0.4s ease';
        this.hintEl.style.opacity = '0';
        setTimeout(() => this.hintEl?.remove(), 500);
      }
    }
  }

  private bindControls() {
    const c = this.canvas;
    const signal = this.abortController.signal;

    const onDown = (clientX: number, clientY: number) => {
      this.isDragging = true;
      this.autoOrbit = false;
      this.lastMouseX = clientX;
      this.lastMouseY = clientY;
      this.container?.classList.add('dragging');
      this.dismissHint();
      this.setHoveredComponent(null);
      this.startLoop();
    };

    const onMove = (clientX: number, clientY: number) => {
      if (!this.isDragging) return;
      const dx = clientX - this.lastMouseX;
      const dy = clientY - this.lastMouseY;
      this.lastMouseX = clientX;
      this.lastMouseY = clientY;

      // Orbit camera: dx turns yaw, dy turns pitch
      this.camera.orbit(dx * 0.75, dy * 0.75);
    };

    const onUp = () => {
      this.isDragging = false;
      this.container?.classList.remove('dragging');
      if (this.lastCursorX !== null && this.lastCursorY !== null) {
        const hovered = this.findComponentAt(this.lastCursorX, this.lastCursorY);
        this.setHoveredComponent(hovered);
      }
    };

    // Mouse Controls
    c.addEventListener('mousedown', (e) => {
      e.preventDefault();
      c.focus();
      onDown(e.clientX, e.clientY);
    }, { signal });

    c.addEventListener('mousemove', (e) => {
      if (this.isDragging) return;
      const rect = c.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;
      this.lastCursorX = cssX;
      this.lastCursorY = cssY;

      const hovered = this.findComponentAt(cssX, cssY);
      this.setHoveredComponent(hovered);
    }, { signal });

    c.addEventListener('mouseleave', () => {
      this.clearHover();
    }, { signal });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) onMove(e.clientX, e.clientY);
    }, { signal });

    window.addEventListener('mouseup', onUp, { signal });

    // Touch Controls with 2-finger pinch zoom
    c.addEventListener('touchstart', (e) => {
      this.dismissHint();
      if (e.touches.length === 1) {
        this.isPinching = false;
        onDown(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        this.isPinching = true;
        this.autoOrbit = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchStartDist = Math.hypot(dx, dy);
      }
    }, { passive: true, signal });

    c.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2 && this.isPinching) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (this.touchStartDist > 0) {
          const factor = this.touchStartDist / dist;
          this.camera.dist = Math.max(12, Math.min(300, this.camera.dist * factor));
          this.camera.orthoHalfH = Math.max(4, Math.min(120, this.camera.orthoHalfH * factor));
        }
        this.touchStartDist = dist;
      }
    }, { passive: true, signal });

    c.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        this.isDragging = false;
        this.isPinching = false;
        onUp();
      }
    }, { signal });

    // Zoom on wheel
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dismissHint();
      this.autoOrbit = false;
      const factor = e.deltaY < 0 ? 0.9 : 1.1;
      this.camera.dist = Math.max(12, Math.min(300, this.camera.dist * factor));
      this.camera.orthoHalfH = Math.max(4, Math.min(120, this.camera.orthoHalfH * factor));
      this.startLoop();
    }, { passive: false, signal });

    // Keyboard Accessibility (Arrows, +, -, Space, R)
    c.addEventListener('keydown', (e) => {
      this.dismissHint();
      let handled = false;
      if (e.key === 'ArrowLeft') { this.camera.orbit(-6, 0); handled = true; }
      else if (e.key === 'ArrowRight') { this.camera.orbit(6, 0); handled = true; }
      else if (e.key === 'ArrowUp') { this.camera.orbit(0, -5); handled = true; }
      else if (e.key === 'ArrowDown') { this.camera.orbit(0, 5); handled = true; }
      else if (e.key === '+' || e.key === '=') {
        this.camera.dist = Math.max(12, this.camera.dist * 0.9);
        this.camera.orthoHalfH = Math.max(4, this.camera.orthoHalfH * 0.9);
        handled = true;
      } else if (e.key === '-' || e.key === '_') {
        this.camera.dist = Math.min(300, this.camera.dist * 1.1);
        this.camera.orthoHalfH = Math.min(120, this.camera.orthoHalfH * 1.1);
        handled = true;
      } else if (e.key === ' ' || e.code === 'Space') {
        this.toggleAutoOrbit();
        handled = true;
      } else if (e.key.toLowerCase() === 'r') {
        this.resetCamera();
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        this.startLoop();
      }
    }, { signal });
  }

  setSide(side: 'F' | 'B') {
    this.dismissHint();
    this.autoOrbit = false;
    this.camera.setSide(side);
    this.startLoop();
  }

  toggleAutoOrbit(): boolean {
    this.dismissHint();
    this.autoOrbit = !this.autoOrbit;
    if (this.autoOrbit) this.startLoop();
    return this.autoOrbit;
  }

  resetCamera() {
    this.dismissHint();
    this.autoOrbit = true;
    this.updateCameraForBoard();
    this.startLoop();
  }

  private startLoop() {
    if (this.rafId || !this.isVisible) return;
    this.lastTime = performance.now();

    const tick = (now: number) => {
      if (!this.isVisible) {
        this.rafId = 0;
        return;
      }

      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      if (this.autoOrbit && !this.isDragging) {
        this.camera.orbit(this.autoOrbitSpeed, 0);
      }

      const prevPitch = this.camera.pitch;
      const prevYaw = this.camera.yaw;
      const prevFlipT = this.camera.flipT;

      this.camera.tick(dt);
      this.render();

      if (this.lastCursorX !== null && this.lastCursorY !== null && !this.isDragging) {
        const hovered = this.findComponentAt(this.lastCursorX, this.lastCursorY);
        if (hovered !== this.hoveredComp) {
          this.setHoveredComponent(hovered);
        }
      }

      const changed = Math.abs(this.camera.pitch - prevPitch) > 0.001 ||
                      Math.abs(this.camera.yaw - prevYaw) > 0.001 ||
                      Math.abs(this.camera.flipT - prevFlipT) > 0.0001;

      const isMoving = this.autoOrbit || this.isDragging || changed;

      if (isMoving) {
        this.rafId = safeRaf(tick);
      } else {
        // Sleep animation loop when completely idle to save 100% CPU/battery
        this.rafId = 0;
      }
    };

    this.rafId = safeRaf(tick);
  }

  private render() {
    const b = this.activeScenario.board;

    // All hero boards use the high-performance accelerated Canvas2D 3D renderer.
    // The WebGPU path is only available in the full app workbench (app.html).
    this.renderEnhanced3D(b);
  }

  private renderEnhanced3D(b: Board) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);

    const isViewingBottom = this.isUndersideView();
    const effectiveFlipT = (this.camera.side === 'B' && this.camera.flipT === 0) ? 1 : this.camera.flipT;
    const flipAngle = effectiveFlipT * Math.PI;

    // Pitch clamped to reasonable range
    const currentPitch = this.camera.pitch;
    const pitchRad = ((isViewingBottom ? Math.max(10, Math.min(85, Math.abs(currentPitch))) : Math.max(10, Math.min(85, currentPitch))) * Math.PI) / 180;
    const yawRad = (this.camera.yaw * Math.PI) / 180;
    const scale = (Math.min(w, h) / Math.max(b.w, b.h)) * (42 / Math.max(10, this.camera.orthoHalfH));

    const cosF = Math.cos(flipAngle);
    const sinF = Math.sin(flipAngle);
    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);
    const sinP = Math.sin(pitchRad);
    const cosP = Math.cos(pitchRad);

    const project = (x: number, y: number, z: number): [number, number] => {
      const cx = x - b.w / 2;
      const cy = y - b.h / 2;
      const cz = z - b.thickness / 2;
      const rx0 = cx * cosF + cz * sinF;
      const ry0 = cy;
      const rz0 = -cx * sinF + cz * cosF;
      const rx = rx0 * cosY - ry0 * sinY;
      const ry = rx0 * sinY + ry0 * cosY;
      const px = rx * scale;
      const py = (ry * sinP - rz0 * cosP) * scale;
      return [px, py];
    };

    // 3D View Vector towards camera
    const vx = sinY * cosP;
    const vy = -cosY * cosP;
    const vz = sinP;

    // Studio Key Light vector (top-left-front)
    const lx = -0.42;
    const ly = -0.52;
    const lz = 0.74;
    const lLen = Math.hypot(lx, ly, lz) || 1;
    const nlx = lx / lLen;
    const nly = ly / lLen;
    const nlz = lz / lLen;

    // Halfway vector between Light and View (Blinn-Phong)
    const hx = nlx + vx;
    const hy = nly + vy;
    const hz = nlz + vz;
    const hLen = Math.hypot(hx, hy, hz) || 1;
    const nhz = Math.max(0, hz / hLen);

    // Angle-dependent specular highlights
    const specMetal = Math.pow(nhz, 18);
    const specGold = Math.pow(nhz, 14);
    const specPos = Math.max(0.12, Math.min(0.88, 0.5 + (nlx - vx) * 0.35 + (nly - vy) * 0.2));

    // 1. Soft radial gradient contact shadow
    const shadowR = Math.max(b.w, b.h) * scale * 0.65;
    const shadowY = 36 * (scale / 4);
    const shadowGrad = ctx.createRadialGradient(0, shadowY, 0, 0, shadowY, shadowR);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.52)');
    shadowGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
    shadowGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.06)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, shadowY, (b.w * scale) * 0.58, (b.h * scale) * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw Board Laminate Body (3D FR-4 Box)
    const p00Bot = project(0, 0, 0);
    const p10Bot = project(b.w, 0, 0);
    const p11Bot = project(b.w, b.h, 0);
    const p01Bot = project(0, b.h, 0);

    const p00Top = project(0, 0, b.thickness);
    const p10Top = project(b.w, 0, b.thickness);
    const p11Top = project(b.w, b.h, b.thickness);
    const p01Top = project(0, b.h, b.thickness);

    // Edge thickness side walls (FR-4 laminate)
    ctx.fillStyle = '#081a0e';
    ctx.beginPath();
    ctx.moveTo(p10Bot[0], p10Bot[1]);
    ctx.lineTo(p11Bot[0], p11Bot[1]);
    ctx.lineTo(p11Top[0], p11Top[1]);
    ctx.lineTo(p10Top[0], p10Top[1]);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0d2515';
    ctx.beginPath();
    ctx.moveTo(p01Bot[0], p01Bot[1]);
    ctx.lineTo(p11Bot[0], p11Bot[1]);
    ctx.lineTo(p11Top[0], p11Top[1]);
    ctx.lineTo(p01Top[0], p01Top[1]);
    ctx.closePath();
    ctx.fill();

    // Solder Mask Face (Top or Bottom depending on side)
    const facePts = isViewingBottom
      ? [p00Bot, p10Bot, p11Bot, p01Bot]
      : [p00Top, p10Top, p11Top, p01Top];

    ctx.beginPath();
    ctx.moveTo(facePts[0][0], facePts[0][1]);
    ctx.lineTo(facePts[1][0], facePts[1][1]);
    ctx.lineTo(facePts[2][0], facePts[2][1]);
    ctx.lineTo(facePts[3][0], facePts[3][1]);
    ctx.closePath();
    ctx.fillStyle = b.color || '#16191d';
    ctx.fill();

    // Solder mask edge border
    ctx.strokeStyle = b.color?.includes('005c') ? '#007bb8' : b.color?.includes('1532') ? '#2fe675' : '#32363b';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (isViewingBottom) {
      // 3B. Batched Bottom Copper Traces
      ctx.lineWidth = Math.max(1.0, 1.4 * (scale / 5));
      ctx.strokeStyle = 'rgba(235, 185, 60, 0.85)'; // ENIG Gold / Copper
      ctx.beginPath();
      const traces = b.traces;
      for (let i = 0; i < traces.length; i++) {
        const t = traces[i];
        if (t.layer === 'B') {
          const a = project(t.a[0], t.a[1], -0.05);
          const ptB = project(t.b[0], t.b[1], -0.05);
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(ptB[0], ptB[1]);
        }
      }
      ctx.stroke();

      // 4B. Batched Bottom Solder Pads (Through-hole pins & bottom SMD pads)
      const comps = b.components;
      const padColor = specGold > 0.35 ? '#fff0a8' : (specGold > 0.15 ? '#f5d268' : '#e5be4a');
      ctx.fillStyle = padColor;
      for (let i = 0; i < comps.length; i++) {
        const comp = comps[i];
        const pads = comp.pads;
        for (let j = 0; j < pads.length; j++) {
          const p = pads[j];
          if (p.layers === 'B' || p.layers === 'FB') {
            const pt = project(comp.at[0] + (p.at ? p.at[0] : 0), comp.at[1] + (p.at ? p.at[1] : 0), -0.06);
            const r = Math.max(1.2, (p.size ? p.size[0] : 1.2) * scale * 0.35);
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2);
            ctx.fill();

            // Solder drill hole & tinned pin lead for THT
            if (p.layers === 'FB' || (p.drill && p.drill > 0)) {
              ctx.fillStyle = '#080a0d';
              ctx.beginPath();
              ctx.arc(pt[0], pt[1], r * 0.45, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = '#cbd5e1';
              ctx.beginPath();
              ctx.arc(pt[0], pt[1], r * 0.22, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = padColor;
            }
          }
        }
      }

      // 5B. Bottom Silkscreen Text Markings
      if (b.texts && scale > 1.2) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < b.texts.length; i++) {
          const t = b.texts[i];
          if (t.side === 'B') {
            const pt = project(t.at[0], t.at[1], -0.06);
            const fontSize = Math.max(7, Math.floor(t.size * scale * 0.85));
            ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
            ctx.fillStyle = '#e8edf2';
            ctx.fillText(t.text, pt[0], pt[1]);
          }
        }
      }

      // 6B. Bottom Silkscreen Lines
      if (b.silk && b.silk.length > 0) {
        ctx.strokeStyle = 'rgba(235, 240, 245, 0.85)';
        ctx.lineWidth = Math.max(0.8, 1.0 * (scale / 5));
        ctx.beginPath();
        for (let i = 0; i < b.silk.length; i++) {
          const sl = b.silk[i];
          if (sl.side === 'B') {
            const p1 = project(sl.a[0], sl.a[1], -0.06);
            const p2 = project(sl.b[0], sl.b[1], -0.06);
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
          }
        }
        ctx.stroke();
      }

      // Helpful bottom pinout/branding if board has no custom bottom silk text
      const hasBottomText = b.texts?.some((t) => t.side === 'B');
      if (!hasBottomText && scale > 1.4) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerPt = project(b.w / 2, b.h * 0.5, -0.06);
        ctx.fillStyle = 'rgba(220, 228, 238, 0.7)';
        ctx.font = `600 ${Math.max(8, Math.floor(1.6 * scale))}px "JetBrains Mono", monospace`;
        ctx.fillText('BOTTOM LAYER · REVERSE PINOUT', centerPt[0], centerPt[1] - 4 * (scale / 4));
        ctx.font = `${Math.max(6, Math.floor(1.0 * scale))}px "JetBrains Mono", monospace`;
        ctx.fillStyle = 'rgba(200, 210, 225, 0.55)';
        ctx.fillText('LEAD-FREE RoHS · DEADBOARD 3D', centerPt[0], centerPt[1] + 3 * (scale / 4));
      }
    } else {
      // 3. Batched Top Copper Traces (with special golden glow for antenna traces)
      ctx.lineWidth = Math.max(1.0, 1.4 * (scale / 5));
      ctx.strokeStyle = 'rgba(235, 185, 60, 0.78)'; // ENIG Gold
      ctx.beginPath();
      const traces = b.traces;
      for (let i = 0; i < traces.length; i++) {
        const t = traces[i];
        if (t.layer === 'F') {
          const a = project(t.a[0], t.a[1], b.thickness + 0.05);
          const ptB = project(t.b[0], t.b[1], b.thickness + 0.05);
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(ptB[0], ptB[1]);
        }
      }
      ctx.stroke();

      // Extra highlight pass for serpentine antenna traces with specular response
      ctx.beginPath();
      ctx.lineWidth = Math.max(1.6, 2.2 * (scale / 5));
      const antColor = specGold > 0.25 ? '#fff4b8' : 'rgba(255, 205, 70, 0.95)';
      ctx.strokeStyle = antColor;
      for (let i = 0; i < traces.length; i++) {
        const t = traces[i];
        if (t.layer === 'F' && (t.net === 'ANTENNA' || (b.h > 45 && t.a[1] > 44 && t.b[1] > 44))) {
          const a = project(t.a[0], t.a[1], b.thickness + 0.06);
          const ptB = project(t.b[0], t.b[1], b.thickness + 0.06);
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(ptB[0], ptB[1]);
        }
      }
      ctx.stroke();

      // 4. Batched Solder Pads & Vias (ENIG Gold with dynamic specular sheen)
      const padColor = specGold > 0.35 ? '#fff0a8' : (specGold > 0.15 ? '#f5d268' : '#e5be4a');
      ctx.fillStyle = padColor;
      const comps = b.components;
      for (let i = 0; i < comps.length; i++) {
        const comp = comps[i];
        const pads = comp.pads;
        for (let j = 0; j < pads.length; j++) {
          const p = pads[j];
          if (p.layers === 'F' || p.layers === 'FB') {
            const pt = project(comp.at[0] + (p.at ? p.at[0] : 0), comp.at[1] + (p.at ? p.at[1] : 0), b.thickness + 0.08);
            const r = Math.max(1, (p.size ? p.size[0] : 1.2) * scale * 0.35);
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 5. Silkscreen Text Markings (projected directly onto board face)
      if (b.texts && scale > 1.2) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < b.texts.length; i++) {
          const t = b.texts[i];
          if (t.side === 'F') {
            const pt = project(t.at[0], t.at[1], b.thickness + 0.06);
            const fontSize = Math.max(7, Math.floor(t.size * scale * 0.85));
            ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
            ctx.fillStyle = '#e8edf2';
            ctx.fillText(t.text, pt[0], pt[1]);
          }
        }
      }

      // 6. Silkscreen Lines
      if (b.silk && b.silk.length > 0) {
        ctx.strokeStyle = 'rgba(235, 240, 245, 0.85)';
        ctx.lineWidth = Math.max(0.8, 1.0 * (scale / 5));
        ctx.beginPath();
        for (let i = 0; i < b.silk.length; i++) {
          const sl = b.silk[i];
          if (sl.side === 'F') {
            const p1 = project(sl.a[0], sl.a[1], b.thickness + 0.06);
            const p2 = project(sl.b[0], sl.b[1], b.thickness + 0.06);
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
          }
        }
        ctx.stroke();
      }
    }

    // 7. Depth-Sorted Distinctive 3D Components
    const comps = b.components;
    const visibleComps = comps.filter((c) => {
      const compSide = c.side || 'F';
      return isViewingBottom ? (compSide === 'B') : (compSide !== 'B');
    });

    const sorted = visibleComps.slice().sort((c1, c2) => {
      const p1 = project(c1.at[0], c1.at[1], 0);
      const p2 = project(c2.at[0], c2.at[1], 0);
      return p1[1] - p2[1];
    });

    const zBase = isViewingBottom ? 0 : b.thickness;
    const zDir = isViewingBottom ? -1 : 1;

    for (let i = 0; i < sorted.length; i++) {
      const comp = sorted[i];
      const cx = comp.at[0];
      const cy = comp.at[1];
      const cw = comp.body.w || 4;
      const ch = comp.body.h || 4;
      const cz = comp.body.z || 1.5;

      const refUpper = comp.ref.toUpperCase();
      const isRfShield = refUpper.includes('WROOM') || refUpper.includes('ESP32') || refUpper.includes('RF') || (cw >= 14 && ch >= 14 && comp.body.shape === 'chip');
      const isUsb = refUpper.includes('USB') || comp.label?.toUpperCase().includes('USB') || (comp.body.shape === 'header' && refUpper.startsWith('J1'));
      const isDip = refUpper.includes('ATMEGA') || refUpper.includes('328P') || (cw >= 28 && comp.body.shape === 'chip');
      const isXtal = refUpper.startsWith('Y') || refUpper.includes('XTAL') || comp.label?.includes('MHZ');
      const isDcJack = refUpper.includes('DC') || comp.label?.includes('DC');
      const isHeader = comp.body.shape === 'header' && !isUsb && !isDcJack;
      const isSwitch = comp.kind === 'switch' || comp.body.shape === 'tactile';
      const isRadial = comp.body.shape === 'radial';
      const isLed = comp.kind === 'led';

      // 3D Box helper for arbitrary components
      const renderBox3D = (
        bx: number, by: number, bz: number,
        bw: number, bh: number, bHeight: number,
        topFill: string | CanvasGradient,
        sideFillX: string, sideFillY: string,
        strokeColor?: string
      ) => {
        const hw = bw / 2;
        const hh = bh / 2;
        const topZ = bz + bHeight * zDir;
        const pB1 = project(bx + hw, by - hh, bz);
        const pB2 = project(bx + hw, by + hh, bz);
        const pB3 = project(bx - hw, by + hh, bz);

        const pT0 = project(bx - hw, by - hh, topZ);
        const pT1 = project(bx + hw, by - hh, topZ);
        const pT2 = project(bx + hw, by + hh, topZ);
        const pT3 = project(bx - hw, by + hh, topZ);

        // Sides
        ctx.fillStyle = sideFillX;
        ctx.beginPath();
        ctx.moveTo(pB1[0], pB1[1]);
        ctx.lineTo(pB2[0], pB2[1]);
        ctx.lineTo(pT2[0], pT2[1]);
        ctx.lineTo(pT1[0], pT1[1]);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = sideFillY;
        ctx.beginPath();
        ctx.moveTo(pB3[0], pB3[1]);
        ctx.lineTo(pB2[0], pB2[1]);
        ctx.lineTo(pT2[0], pT2[1]);
        ctx.lineTo(pT3[0], pT3[1]);
        ctx.closePath();
        ctx.fill();

        // Top face
        ctx.beginPath();
        ctx.moveTo(pT0[0], pT0[1]);
        ctx.lineTo(pT1[0], pT1[1]);
        ctx.lineTo(pT2[0], pT2[1]);
        ctx.lineTo(pT3[0], pT3[1]);
        ctx.closePath();
        ctx.fillStyle = topFill;
        ctx.fill();

        if (strokeColor) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };

      if (isRfShield) {
        // --- 1. Metallic RF Shield Can (ESP-WROOM-32 / Pi Zero RF) with angle-dependent specular highlight ---
        const pT0 = project(cx - cw / 2, cy - ch / 2, zBase + cz * zDir);
        const pT2 = project(cx + cw / 2, cy + ch / 2, zBase + cz * zDir);
        const metalGrad = ctx.createLinearGradient(pT0[0], pT0[1], pT2[0], pT2[1]);
        const p1 = Math.max(0.05, Math.min(0.45, specPos - 0.18));
        const p2 = specPos;
        const p3 = Math.min(0.95, Math.max(0.55, specPos + 0.18));
        const hiAlpha = 0.45 + 0.5 * specMetal;
        metalGrad.addColorStop(0, '#9ca4b0');
        metalGrad.addColorStop(p1, '#cbd2dc');
        metalGrad.addColorStop(p2, `rgba(255, 255, 255, ${hiAlpha})`);
        metalGrad.addColorStop(p3, '#c2c9d2');
        metalGrad.addColorStop(1, '#8c94a0');

        renderBox3D(cx, cy, zBase, cw, ch, cz, metalGrad, '#6e7683', '#565d68', '#d5dbe3');

        // Inner stamped indentation border
        const inW = cw * 0.88;
        const inH = ch * 0.88;
        const pi0 = project(cx - inW / 2, cy - inH / 2, zBase + (cz + 0.02) * zDir);
        const pi1 = project(cx + inW / 2, cy - inH / 2, zBase + (cz + 0.02) * zDir);
        const pi2 = project(cx + inW / 2, cy + inH / 2, zBase + (cz + 0.02) * zDir);
        const pi3 = project(cx - inW / 2, cy + inH / 2, zBase + (cz + 0.02) * zDir);
        ctx.strokeStyle = '#7c8591';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(pi0[0], pi0[1]);
        ctx.lineTo(pi1[0], pi1[1]);
        ctx.lineTo(pi2[0], pi2[1]);
        ctx.lineTo(pi3[0], pi3[1]);
        ctx.closePath();
        ctx.stroke();

        // Laser etched text on shield top
        if (scale > 2.0) {
          const ptCenter = project(cx, cy, zBase + (cz + 0.04) * zDir);
          ctx.fillStyle = '#2f353d';
          ctx.textAlign = 'center';
          ctx.font = `bold ${Math.max(8, Math.floor(1.6 * scale))}px "JetBrains Mono", monospace`;
          ctx.fillText('ESP-WROOM-32', ptCenter[0], ptCenter[1] - 4 * (scale / 4));
          ctx.font = `${Math.max(6, Math.floor(1.0 * scale))}px "JetBrains Mono", monospace`;
          ctx.fillText('Espressif Systems', ptCenter[0], ptCenter[1] + 2 * (scale / 4));
          ctx.fillText('FCC ID: 2AC7Z', ptCenter[0], ptCenter[1] + 7 * (scale / 4));
        }
      } else if (isUsb) {
        // --- 2. USB Ports (Type-B or MicroUSB) with specular highlight ---
        if (cw >= 10 && ch >= 12) {
          // USB Type-B Metal Receptacle (Arduino Uno)
          const pT0 = project(cx - cw / 2, cy - ch / 2, zBase + cz * zDir);
          const pT2 = project(cx + cw / 2, cy + ch / 2, zBase + cz * zDir);
          const usbGrad = ctx.createLinearGradient(pT0[0], pT0[1], pT2[0], pT2[1]);
          const p1 = Math.max(0.05, Math.min(0.45, specPos - 0.2));
          const p2 = specPos;
          const p3 = Math.min(0.95, Math.max(0.55, specPos + 0.2));
          const usbAlpha = 0.45 + 0.5 * specMetal;
          usbGrad.addColorStop(0, '#a6aeb8');
          usbGrad.addColorStop(p1, '#c2c9d2');
          usbGrad.addColorStop(p2, `rgba(255, 255, 255, ${usbAlpha})`);
          usbGrad.addColorStop(p3, '#c2c9d2');
          usbGrad.addColorStop(1, '#979fa9');
          renderBox3D(cx, cy, zBase, cw, ch, cz, usbGrad, '#707782', '#5b616b', '#dee3ea');

          // Dark interior port opening
          const portCenter = project(cx, cy + ch / 2, zBase + cz * 0.5 * zDir);
          ctx.fillStyle = '#0a0b0d';
          ctx.beginPath();
          ctx.arc(portCenter[0], portCenter[1], 4 * (scale / 4), 0, Math.PI * 2);
          ctx.fill();
        } else {
          // MicroUSB / USB-C
          const pT0 = project(cx - cw / 2, cy - ch / 2, zBase + cz * zDir);
          const pT2 = project(cx + cw / 2, cy + ch / 2, zBase + cz * zDir);
          const usbGrad = ctx.createLinearGradient(pT0[0], pT0[1], pT2[0], pT2[1]);
          const p1 = Math.max(0.05, Math.min(0.45, specPos - 0.2));
          const p2 = specPos;
          const p3 = Math.min(0.95, Math.max(0.55, specPos + 0.2));
          const usbAlpha = 0.4 + 0.55 * specMetal;
          usbGrad.addColorStop(0, '#979fa9');
          usbGrad.addColorStop(p1, '#adb5bf');
          usbGrad.addColorStop(p2, `rgba(255, 255, 255, ${usbAlpha})`);
          usbGrad.addColorStop(p3, '#adb5bf');
          usbGrad.addColorStop(1, '#858d97');
          renderBox3D(cx, cy, zBase, cw, ch, cz, usbGrad, '#6b727d', '#535962', '#ccd3dc');

          // Dark port slot
          const slot = project(cx, cy - ch * 0.45, zBase + cz * 0.5 * zDir);
          ctx.fillStyle = '#08090a';
          ctx.fillRect(slot[0] - 2.5 * scale * 0.4, slot[1] - 1.0 * scale * 0.4, 5 * scale * 0.4, 2 * scale * 0.4);
        }
      } else if (isDip) {
        // --- 3. ATmega328P DIP-28 Socketed Microcontroller ---
        // A. Socket base (height: 2.0mm)
        renderBox3D(cx, cy, zBase, cw + 1.2, ch + 1.0, 2.0, '#15171a', '#0d0e10', '#0a0b0d');

        // B. ATmega328P IC Package (height: 4.8mm)
        const pT0 = project(cx - cw / 2, cy - ch / 2, zBase + cz * zDir);
        const pT2 = project(cx + cw / 2, cy + ch / 2, zBase + cz * zDir);
        const icGrad = ctx.createLinearGradient(pT0[0], pT0[1], pT2[0], pT2[1]);
        icGrad.addColorStop(0, '#1c1e22');
        icGrad.addColorStop(1, '#111214');
        renderBox3D(cx, cy, zBase + 1.6 * zDir, cw, ch, cz - 1.6, icGrad, '#141619', '#0d0e10', '#2d3138');

        // IC Pin 1 notch on left
        const notchPt = project(cx - cw / 2, cy, zBase + (cz + 0.05) * zDir);
        ctx.fillStyle = '#08090a';
        ctx.beginPath();
        ctx.arc(notchPt[0], notchPt[1], 1.4 * (scale / 4), -Math.PI / 2, Math.PI / 2);
        ctx.fill();

        // Laser text
        if (scale > 1.8) {
          const ptCenter = project(cx, cy, zBase + (cz + 0.05) * zDir);
          ctx.fillStyle = '#d0d5dc';
          ctx.textAlign = 'center';
          ctx.font = `bold ${Math.max(8, Math.floor(1.4 * scale))}px "JetBrains Mono", monospace`;
          ctx.fillText('ATMEGA328P-PU', ptCenter[0], ptCenter[1]);
        }
      } else if (isXtal) {
        // --- 4. Crystal Oscillator (HC-49 Can) with specular highlight ---
        const pT0 = project(cx - cw / 2, cy - ch / 2, zBase + cz * zDir);
        const pT2 = project(cx + cw / 2, cy + ch / 2, zBase + cz * zDir);
        const xtalGrad = ctx.createLinearGradient(pT0[0], pT0[1], pT2[0], pT2[1]);
        const p1 = Math.max(0.05, Math.min(0.45, specPos - 0.16));
        const p2 = specPos;
        const p3 = Math.min(0.95, Math.max(0.55, specPos + 0.16));
        const xtalAlpha = 0.5 + 0.48 * specMetal;
        xtalGrad.addColorStop(0, '#9da4af');
        xtalGrad.addColorStop(p1, '#bcc3cd');
        xtalGrad.addColorStop(p2, `rgba(255, 255, 255, ${xtalAlpha})`);
        xtalGrad.addColorStop(p3, '#cdd4dd');
        xtalGrad.addColorStop(1, '#888f9a');

        renderBox3D(cx, cy, zBase, cw, ch, cz, xtalGrad, '#6e7581', '#575c66', '#e0e5eb');
        if (scale > 2.0) {
          const pt = project(cx, cy, zBase + (cz + 0.04) * zDir);
          ctx.fillStyle = '#33383f';
          ctx.font = `${Math.max(7, Math.floor(1.0 * scale))}px "JetBrains Mono", monospace`;
          ctx.fillText('16.000', pt[0], pt[1]);
        }
      } else if (isDcJack) {
        // --- 5. DC Barrel Jack ---
        renderBox3D(cx, cy, zBase, cw, ch, cz, '#181a1d', '#101113', '#0c0d0f', '#2c3036');
        const jackFront = project(cx, cy + ch / 2, zBase + cz * 0.45 * zDir);
        ctx.fillStyle = '#0a0a0c';
        ctx.beginPath();
        ctx.arc(jackFront[0], jackFront[1], 4.2 * (scale / 4), 0, Math.PI * 2);
        ctx.fill();
        // Golden center pin
        ctx.fillStyle = '#f0cf65';
        ctx.beginPath();
        ctx.arc(jackFront[0], jackFront[1], 1.2 * (scale / 4), 0, Math.PI * 2);
        ctx.fill();
      } else if (isHeader) {
        // --- 6. Pin Header Strip with Golden Contacts ---
        // Black insulator plastic base
        renderBox3D(cx, cy, zBase, cw, ch, 2.5, '#16181b', '#0f1012', '#0a0b0d');

        // Golden square contact pins protruding from each pad
        const pinGoldColor = specGold > 0.3 ? '#fff5b8' : (specGold > 0.1 ? '#f5d268' : '#e5be4a');
        for (let j = 0; j < comp.pads.length; j++) {
          const pad = comp.pads[j];
          const px = cx + (pad.at ? pad.at[0] : 0);
          const py = cy + (pad.at ? pad.at[1] : 0);

          const pPinBase = project(px, py, zBase + 2.0 * zDir);
          const pPinTop = project(px, py, zBase + 8.5 * zDir);

          ctx.strokeStyle = pinGoldColor;
          ctx.lineWidth = Math.max(1.2, 1.8 * (scale / 5));
          ctx.beginPath();
          ctx.moveTo(pPinBase[0], pPinBase[1]);
          ctx.lineTo(pPinTop[0], pPinTop[1]);
          ctx.stroke();

          // Golden square tip reflection
          ctx.fillStyle = specGold > 0.2 ? '#ffffff' : '#fff0a8';
          ctx.fillRect(pPinTop[0] - 1, pPinTop[1] - 1, 2, 2);
        }
      } else if (isSwitch) {
        // --- 7. Tactile Button Switch ---
        renderBox3D(cx, cy, zBase, cw, ch, 1.8, '#bcc2cb', '#7b828d', '#5f646d');
        // Round plunger button
        const btnCenter = project(cx, cy, zBase + cz * zDir);
        ctx.fillStyle = '#22252a';
        ctx.beginPath();
        ctx.arc(btnCenter[0], btnCenter[1], (cw * scale * 0.22), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4e5560';
        ctx.stroke();
      } else if (isRadial) {
        // --- 8. Radial Electrolytic Capacitor ---
        const radCenter = project(cx, cy, zBase + cz * zDir);
        const radR = (cw / 2) * scale * 0.45;
        ctx.fillStyle = '#1e293b'; // Dark blue aluminum can
        ctx.beginPath();
        ctx.arc(radCenter[0], radCenter[1], radR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Safety vent score on top
        ctx.strokeStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(radCenter[0] - radR * 0.7, radCenter[1]);
        ctx.lineTo(radCenter[0] + radR * 0.7, radCenter[1]);
        ctx.moveTo(radCenter[0], radCenter[1] - radR * 0.7);
        ctx.lineTo(radCenter[0], radCenter[1] + radR * 0.7);
        ctx.stroke();
      } else if (isLed) {
        // --- 9. LED Dome ---
        const ledCenter = project(cx, cy, zBase + cz * 0.7 * zDir);
        const ledColor = comp.color === 'red' ? '#ff3344' : comp.color === 'blue' ? '#3388ff' : '#22dd55';
        ctx.fillStyle = ledColor;
        ctx.beginPath();
        ctx.arc(ledCenter[0], ledCenter[1], (cw * scale * 0.25), 0, Math.PI * 2);
        ctx.fill();
        // Inner bright core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ledCenter[0], ledCenter[1], (cw * scale * 0.08), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // --- 10. SMD ICs / Regulators / Passives ---
        const isCap = comp.kind === 'capacitor';
        const bodyColor = isCap ? '#b08b5e' : (comp.body?.color || '#1c1f24');
        renderBox3D(cx, cy, zBase, cw, ch, cz, bodyColor, '#131518', '#0c0d0f', '#3a4049');

        if (cw > 5 && scale > 2.0) {
          const pt = project(cx, cy, zBase + (cz + 0.04) * zDir);
          ctx.fillStyle = '#c5cbd4';
          ctx.textAlign = 'center';
          ctx.font = `${Math.max(7, Math.floor(1.0 * scale))}px "JetBrains Mono", monospace`;
          ctx.fillText(comp.ref, pt[0], pt[1]);
        }
      }
    }

    // 8. Update projected 2D component bounding boxes for interactive mouse hover / HUD
    this.projectedComps = [];
    const canvasRect = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / (canvasRect?.width || 800) || 1;

    for (let i = 0; i < comps.length; i++) {
      const comp = comps[i];
      const compSide = comp.side || 'F';
      const isVisible = isViewingBottom
        ? (compSide === 'B' || comp.pads.some((p) => p.layers === 'B' || p.layers === 'FB'))
        : (compSide !== 'B');
      if (!isVisible) continue;

      const cx = comp.at[0];
      const cy = comp.at[1];
      const hw = (comp.body?.w || 4) / 2;
      const hh = (comp.body?.h || 4) / 2;
      const cz = comp.body?.z || 1.5;
      const z0 = isViewingBottom ? 0 : b.thickness;
      const z1 = isViewingBottom ? -cz : b.thickness + cz;

      const corners = [
        project(cx - hw, cy - hh, z0),
        project(cx + hw, cy - hh, z0),
        project(cx + hw, cy + hh, z0),
        project(cx - hw, cy + hh, z0),
        project(cx - hw, cy - hh, z1),
        project(cx + hw, cy - hh, z1),
        project(cx + hw, cy + hh, z1),
        project(cx - hw, cy + hh, z1),
      ];

      let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity, cMaxY = -Infinity;
      for (let k = 0; k < corners.length; k++) {
        const [kpx, kpy] = corners[k];
        const screenX = (w / 2 + kpx) / dpr;
        const screenY = (h / 2 + kpy) / dpr;
        if (screenX < cMinX) cMinX = screenX;
        if (screenX > cMaxX) cMaxX = screenX;
        if (screenY < cMinY) cMinY = screenY;
        if (screenY > cMaxY) cMaxY = screenY;
      }

      const centerPt = project(cx, cy, (z0 + z1) / 2);
      const cssCenterX = (w / 2 + centerPt[0]) / dpr;
      const cssCenterY = (h / 2 + centerPt[1]) / dpr;

      this.projectedComps.push({
        comp,
        box: [cMinX, cMinY, cMaxX, cMaxY],
        center: [cssCenterX, cssCenterY],
        distSqToCamera: centerPt[0] * centerPt[0] + centerPt[1] * centerPt[1]
      });
    }

    // 9. Draw sleek 3D selection reticle & outline around hovered component
    if (this.hoveredComp) {
      const hc = this.hoveredComp;
      const cx = hc.at[0];
      const cy = hc.at[1];
      const hw = (hc.body?.w || 4) / 2 + 0.4;
      const hh = (hc.body?.h || 4) / 2 + 0.4;
      const cz = hc.body?.z || 1.5;
      const zTop = isViewingBottom ? -cz - 0.1 : b.thickness + cz + 0.1;

      const h0 = project(cx - hw, cy - hh, zTop);
      const h1 = project(cx + hw, cy - hh, zTop);
      const h2 = project(cx + hw, cy + hh, zTop);
      const h3 = project(cx - hw, cy + hh, zTop);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(h0[0], h0[1]);
      ctx.lineTo(h1[0], h1[1]);
      ctx.lineTo(h2[0], h2[1]);
      ctx.lineTo(h3[0], h3[1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 107, 0, 0.18)';
      ctx.fill();
      ctx.strokeStyle = '#ff6b00';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Corner reticles / brackets
      const corners = [h0, h1, h2, h3];
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 4; k++) {
        const pt = corners[k];
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  destroy() {
    if (this.rafId) {
      safeCaf(this.rafId);
      this.rafId = 0;
    }
    this.abortController.abort();
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.hudEl?.remove();
    this.hudEl = null;
  }
}
