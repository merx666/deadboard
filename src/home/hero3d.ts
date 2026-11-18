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
import type { Board, Scenario } from '../types';

const safeRaf = (cb: FrameRequestCallback): number =>
  typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number);
const safeCaf = (id: number): void => {
  if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(id);
  else clearTimeout(id);
};

export interface HeroViewerOptions {
  onLoadingChange?: (loading: boolean, text?: string) => void;
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
  private hasInteracted = false;

  // Touch pinch tracking
  private touchStartDist = 0;
  private isPinching = false;

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
    };

    // Mouse Controls
    c.addEventListener('mousedown', (e) => {
      e.preventDefault();
      c.focus();
      onDown(e.clientX, e.clientY);
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

    // Isometric 3D projection parameters from camera angles
    const yawRad = (this.camera.yaw * Math.PI) / 180;
    const pitchRad = (Math.max(10, Math.min(85, this.camera.pitch)) * Math.PI) / 180;
    const scale = (Math.min(w, h) / Math.max(b.w, b.h)) * (42 / Math.max(10, this.camera.orthoHalfH));

    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);
    const sinP = Math.sin(pitchRad);
    const cosP = Math.cos(pitchRad);

    const project = (x: number, y: number, z: number): [number, number] => {
      const cx = x - b.w / 2;
      const cy = y - b.h / 2;
      const rx = cx * cosY - cy * sinY;
      const ry = cx * sinY + cy * cosY;
      const px = rx * scale;
      const py = (ry * sinP - z * cosP) * scale;
      return [px, py];
    };

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
    const p10 = project(b.w, 0, 0);
    const p11 = project(b.w, b.h, 0);
    const p01 = project(0, b.h, 0);

    const p00Top = project(0, 0, b.thickness);
    const p10Top = project(b.w, 0, b.thickness);
    const p11Top = project(b.w, b.h, b.thickness);
    const p01Top = project(0, b.h, b.thickness);

    // Edge thickness side walls (FR-4 laminate)
    ctx.fillStyle = '#081a0e';
    ctx.beginPath();
    ctx.moveTo(p10[0], p10[1]);
    ctx.lineTo(p11[0], p11[1]);
    ctx.lineTo(p11Top[0], p11Top[1]);
    ctx.lineTo(p10Top[0], p10Top[1]);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0d2515';
    ctx.beginPath();
    ctx.moveTo(p01[0], p01[1]);
    ctx.lineTo(p11[0], p11[1]);
    ctx.lineTo(p11Top[0], p11Top[1]);
    ctx.lineTo(p01Top[0], p01Top[1]);
    ctx.closePath();
    ctx.fill();

    // Top Solder Mask Face
    ctx.beginPath();
    ctx.moveTo(p00Top[0], p00Top[1]);
    ctx.lineTo(p10Top[0], p10Top[1]);
    ctx.lineTo(p11Top[0], p11Top[1]);
    ctx.lineTo(p01Top[0], p01Top[1]);
    ctx.closePath();
    ctx.fillStyle = b.color || '#16191d';
    ctx.fill();

    // Solder mask edge border
    ctx.strokeStyle = b.color?.includes('005c') ? '#007bb8' : b.color?.includes('1532') ? '#2fe675' : '#32363b';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 3. Batched Copper Traces (with special golden glow for antenna traces)
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

    // Extra highlight pass for serpentine antenna traces
    ctx.beginPath();
    ctx.lineWidth = Math.max(1.6, 2.2 * (scale / 5));
    ctx.strokeStyle = 'rgba(255, 205, 70, 0.95)';
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

    // 4. Batched Solder Pads & Vias (ENIG Gold)
    ctx.fillStyle = '#e5be4a';
    const comps = b.components;
    for (let i = 0; i < comps.length; i++) {
      const comp = comps[i];
      const pads = comp.pads;
      for (let j = 0; j < pads.length; j++) {
        const p = pads[j];
        const pt = project(comp.at[0] + (p.at ? p.at[0] : 0), comp.at[1] + (p.at ? p.at[1] : 0), b.thickness + 0.08);
        const r = Math.max(1, (p.size ? p.size[0] : 1.2) * scale * 0.35);
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2);
        ctx.fill();
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

    // 7. Depth-Sorted Distinctive 3D Components
    const sorted = comps.slice().sort((c1, c2) => {
      const p1 = project(c1.at[0], c1.at[1], 0);
      const p2 = project(c2.at[0], c2.at[1], 0);
      return p1[1] - p2[1];
    });

    const zBase = b.thickness;

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
        const pB1 = project(bx + hw, by - hh, bz);
        const pB2 = project(bx + hw, by + hh, bz);
        const pB3 = project(bx - hw, by + hh, bz);

        const pT0 = project(bx - hw, by - hh, bz + bHeight);
        const pT1 = project(bx + hw, by - hh, bz + bHeight);
        const pT2 = project(bx + hw, by + hh, bz + bHeight);
        const pT3 = project(bx - hw, by + hh, bz + bHeight);

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
        // --- 1. Metallic RF Shield Can (ESP-WROOM-32 / Pi Zero RF) ---
        const pT0 = project(cx - cw / 2, cy - ch / 2, zBase + cz);
        const pT2 = project(cx + cw / 2, cy + ch / 2, zBase + cz);
        const metalGrad = ctx.createLinearGradient(pT0[0], pT0[1], pT2[0], pT2[1]);
        metalGrad.addColorStop(0, '#b0b8c4');
        metalGrad.addColorStop(0.35, '#e4e9f0');
        metalGrad.addColorStop(0.65, '#cbd2dc');
        metalGrad.addColorStop(1, '#9ca4b0');

        renderBox3D(cx, cy, zBase, cw, ch, cz, metalGrad, '#6e7683', '#565d68', '#d5dbe3');

        // Inner stamped indentation border
        const inW = cw * 0.88;
        const inH = ch * 0.88;
        const pi0 = project(cx - inW / 2, cy - inH / 2, zBase + cz + 0.02);
        const pi1 = project(cx + inW / 2, cy - inH / 2, zBase + cz + 0.02);
        const pi2 = project(cx + inW / 2, cy + inH / 2, zBase + cz + 0.02);
        const pi3 = project(cx - inW / 2, cy + inH / 2, zBase + cz + 0.02);
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
          const ptCenter = project(cx, cy, zBase + cz + 0.04);
          ctx.fillStyle = '#2f353d';
          ctx.textAlign = 'center';
          ctx.font = `bold ${Math.max(8, Math.floor(1.6 * scale))}px "JetBrains Mono", monospace`;
          ctx.fillText('ESP-WROOM-32', ptCenter[0], ptCenter[1] - 4 * (scale / 4));
          ctx.font = `${Math.max(6, Math.floor(1.0 * scale))}px "JetBrains Mono", monospace`;
          ctx.fillText('Espressif Systems', ptCenter[0], ptCenter[1] + 2 * (scale / 4));
          ctx.fillText('FCC ID: 2AC7Z', ptCenter[0], ptCenter[1] + 7 * (scale / 4));
        }
      } else if (isUsb) {
        // --- 2. USB Ports (Type-B or MicroUSB) ---
        if (cw >= 10 && ch >= 12) {
          // USB Type-B Metal Receptacle (Arduino Uno)
          const pT0 = project(cx - cw / 2, cy - ch / 2, zBase + cz);
          const pT2 = project(cx + cw / 2, cy + ch / 2, zBase + cz);
          const usbGrad = ctx.createLinearGradient(pT0[0], pT0[1], pT2[0], pT2[1]);
          usbGrad.addColorStop(0, '#c2c9d2');
          usbGrad.addColorStop(0.5, '#eaeff5');
          usbGrad.addColorStop(1, '#a6aeb8');
          renderBox3D(cx, cy, zBase, cw, ch, cz, usbGrad, '#707782', '#5b616b', '#dee3ea');

          // Dark interior port opening
          const portCenter = project(cx, cy + ch / 2, zBase + cz * 0.5);
          ctx.fillStyle = '#0a0b0d';
          ctx.beginPath();
          ctx.arc(portCenter[0], portCenter[1], 4 * (scale / 4), 0, Math.PI * 2);
          ctx.fill();
        } else {
          // MicroUSB / USB-C
          const pT0 = project(cx - cw / 2, cy - ch / 2, zBase + cz);
          const pT2 = project(cx + cw / 2, cy + ch / 2, zBase + cz);
          const usbGrad = ctx.createLinearGradient(pT0[0], pT0[1], pT2[0], pT2[1]);
          usbGrad.addColorStop(0, '#adb5bf');
          usbGrad.addColorStop(0.5, '#dfe5ec');
          usbGrad.addColorStop(1, '#979fa9');
          renderBox3D(cx, cy, zBase, cw, ch, cz, usbGrad, '#6b727d', '#535962', '#ccd3dc');

          // Dark port slot
          const slot = project(cx, cy - ch * 0.45, zBase + cz * 0.5);
          ctx.fillStyle = '#08090a';
          ctx.fillRect(slot[0] - 2.5 * scale * 0.4, slot[1] - 1.0 * scale * 0.4, 5 * scale * 0.4, 2 * scale * 0.4);
        }
      } else if (isDip) {
        // --- 3. ATmega328P DIP-28 Socketed Microcontroller ---
        // A. Socket base (height: 2.0mm)
        renderBox3D(cx, cy, zBase, cw + 1.2, ch + 1.0, 2.0, '#15171a', '#0d0e10', '#0a0b0d');

        // B. ATmega328P IC Package (height: 4.8mm)
        const pT0 = project(cx - cw / 2, cy - ch / 2, zBase + cz);
        const pT2 = project(cx + cw / 2, cy + ch / 2, zBase + cz);
        const icGrad = ctx.createLinearGradient(pT0[0], pT0[1], pT2[0], pT2[1]);
        icGrad.addColorStop(0, '#1c1e22');
        icGrad.addColorStop(1, '#111214');
        renderBox3D(cx, cy, zBase + 1.6, cw, ch, cz - 1.6, icGrad, '#141619', '#0d0e10', '#2d3138');

        // IC Pin 1 notch on left
        const notchPt = project(cx - cw / 2, cy, zBase + cz + 0.05);
        ctx.fillStyle = '#08090a';
        ctx.beginPath();
        ctx.arc(notchPt[0], notchPt[1], 1.4 * (scale / 4), -Math.PI / 2, Math.PI / 2);
        ctx.fill();

        // Laser text
        if (scale > 1.8) {
          const ptCenter = project(cx, cy, zBase + cz + 0.05);
          ctx.fillStyle = '#d0d5dc';
          ctx.textAlign = 'center';
          ctx.font = `bold ${Math.max(8, Math.floor(1.4 * scale))}px "JetBrains Mono", monospace`;
          ctx.fillText('ATMEGA328P-PU', ptCenter[0], ptCenter[1]);
        }
      } else if (isXtal) {
        // --- 4. Crystal Oscillator (HC-49 Can) ---
        const pT0 = project(cx - cw / 2, cy - ch / 2, zBase + cz);
        const pT2 = project(cx + cw / 2, cy + ch / 2, zBase + cz);
        const xtalGrad = ctx.createLinearGradient(pT0[0], pT0[1], pT2[0], pT2[1]);
        xtalGrad.addColorStop(0, '#bcc3cd');
        xtalGrad.addColorStop(0.3, '#f2f6fa');
        xtalGrad.addColorStop(0.7, '#cdd4dd');
        xtalGrad.addColorStop(1, '#9da4af');

        renderBox3D(cx, cy, zBase, cw, ch, cz, xtalGrad, '#6e7581', '#575c66', '#e0e5eb');
        if (scale > 2.0) {
          const pt = project(cx, cy, zBase + cz + 0.04);
          ctx.fillStyle = '#33383f';
          ctx.font = `${Math.max(7, Math.floor(1.0 * scale))}px "JetBrains Mono", monospace`;
          ctx.fillText('16.000', pt[0], pt[1]);
        }
      } else if (isDcJack) {
        // --- 5. DC Barrel Jack ---
        renderBox3D(cx, cy, zBase, cw, ch, cz, '#181a1d', '#101113', '#0c0d0f', '#2c3036');
        const jackFront = project(cx, cy + ch / 2, zBase + cz * 0.45);
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
        for (let j = 0; j < comp.pads.length; j++) {
          const pad = comp.pads[j];
          const px = cx + (pad.at ? pad.at[0] : 0);
          const py = cy + (pad.at ? pad.at[1] : 0);

          const pPinBase = project(px, py, zBase + 2.0);
          const pPinTop = project(px, py, zBase + 8.5);

          ctx.strokeStyle = '#e5be4a';
          ctx.lineWidth = Math.max(1.2, 1.8 * (scale / 5));
          ctx.beginPath();
          ctx.moveTo(pPinBase[0], pPinBase[1]);
          ctx.lineTo(pPinTop[0], pPinTop[1]);
          ctx.stroke();

          // Golden square tip reflection
          ctx.fillStyle = '#fff0a8';
          ctx.fillRect(pPinTop[0] - 1, pPinTop[1] - 1, 2, 2);
        }
      } else if (isSwitch) {
        // --- 7. Tactile Button Switch ---
        renderBox3D(cx, cy, zBase, cw, ch, 1.8, '#bcc2cb', '#7b828d', '#5f646d');
        // Round plunger button
        const btnCenter = project(cx, cy, zBase + cz);
        ctx.fillStyle = '#22252a';
        ctx.beginPath();
        ctx.arc(btnCenter[0], btnCenter[1], (cw * scale * 0.22), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4e5560';
        ctx.stroke();
      } else if (isRadial) {
        // --- 8. Radial Electrolytic Capacitor ---
        const radCenter = project(cx, cy, zBase + cz);
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
        const ledCenter = project(cx, cy, zBase + cz * 0.7);
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
        const bodyColor = isCap ? '#b08b5e' : (comp.body.color || '#1c1f24');
        renderBox3D(cx, cy, zBase, cw, ch, cz, bodyColor, '#131518', '#0c0d0f', '#3a4049');

        if (cw > 5 && scale > 2.0) {
          const pt = project(cx, cy, zBase + cz + 0.04);
          ctx.fillStyle = '#c5cbd4';
          ctx.textAlign = 'center';
          ctx.font = `${Math.max(7, Math.floor(1.0 * scale))}px "JetBrains Mono", monospace`;
          ctx.fillText(comp.ref, pt[0], pt[1]);
        }
      }
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
  }
}
