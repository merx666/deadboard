// Interactive 3D Motherboard Viewer for DEADBOARD homepage
// Renders open-hardware boards (ESP32, Pico, Arduino Uno, MNT Reform 2, Jetson Nano)
// with high-performance 360-degree free orbit, mouse drag, touch pinch zoom, and Top/Bottom inspection.

import { createEsp32DevScenario, createRaspberryPiPicoScenario, createArduinoUnoScenario } from '../boards/presets';
import { Camera } from '../render/camera';
import { WebGPURenderer, type RenderSceneState } from '../render/webgpu';
import { buildConnectivity, type Conn } from '../connectivity';
import type { Board, Scenario } from '../types';

export interface HeroViewerOptions {
  onLoadingChange?: (loading: boolean, text?: string) => void;
}

export class Hero3DViewer {
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private renderer: WebGPURenderer | null = null;
  private activeScenario: Scenario;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private autoOrbit = true;
  private autoOrbitSpeed = 0.35; // degrees per frame
  private rafId = 0;
  private lastTime = 0;
  private isVisible = true;
  private webGpuAvailable = false;
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

    // Check WebGPU availability
    if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu) {
      try {
        this.renderer = await WebGPURenderer.create(this.canvas);
        this.webGpuAvailable = true;
      } catch (e) {
        console.warn('WebGPU unavailable on this system, using accelerated Canvas2D 3D fallback:', e);
        this.webGpuAvailable = false;
      }
    } else {
      this.webGpuAvailable = false;
    }

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
              cancelAnimationFrame(this.rafId);
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
        this.rafId = requestAnimationFrame(tick);
      } else {
        // Sleep animation loop when completely idle to save 100% CPU/battery
        this.rafId = 0;
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private render() {
    const b = this.activeScenario.board;

    if (this.webGpuAvailable && this.renderer) {
      try {
        const conn = this.getConn(b);
        const scene: RenderSceneState = {
          board: b,
          conn,
          sim: null,
          powerOn: false,
          vizMode: 'realistic',
          selectedNet: -1,
          selectedCompId: null,
          hovered: null,
          probeRed: null,
          probeBlack: null,
          activeTool: 'inspect',
          jumperDraft: null,
          cursorWorld: null,
        };
        this.renderer.render(this.camera, scene);
        return;
      } catch (err) {
        console.warn('WebGPU render fallback to Canvas2D:', err);
        this.webGpuAvailable = false;
      }
    }

    // High-performance Canvas2D Isometric 3D fallback
    this.renderCanvasFallback(b);
  }

  private renderCanvasFallback(b: Board) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);

    // Isometric 3D projection parameters from camera angles
    const yawRad = (this.camera.yaw * Math.PI) / 180;
    const pitchRad = (Math.max(10, this.camera.pitch) * Math.PI) / 180;
    const scale = (Math.min(w, h) / Math.max(b.w, b.h)) * (40 / Math.max(10, this.camera.orthoHalfH));

    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);
    const sinP = Math.sin(pitchRad);

    const project = (x: number, y: number, z: number): [number, number] => {
      const cx = x - b.w / 2;
      const cy = y - b.h / 2;
      const rx = cx * cosY - cy * sinY;
      const ry = cx * sinY + cy * cosY;
      const px = rx * scale;
      const py = (ry * sinP - z * Math.cos(pitchRad)) * scale;
      return [px, py];
    };

    // 1. Soft hardware-accelerated radial gradient shadow (replaces slow ctx.filter blur)
    const shadowR = (b.w * scale) * 0.55;
    const shadowY = 40 * (scale / 4);
    const shadowGrad = ctx.createRadialGradient(0, shadowY, 0, 0, shadowY, shadowR);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    shadowGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.15)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, shadowY, shadowR, (b.h * scale) * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw Board Laminate Body (3D Box)
    const p10 = project(b.w, 0, 0);
    const p11 = project(b.w, b.h, 0);
    const p01 = project(0, b.h, 0);

    const p00Top = project(0, 0, b.thickness);
    const p10Top = project(b.w, 0, b.thickness);
    const p11Top = project(b.w, b.h, b.thickness);
    const p01Top = project(0, b.h, b.thickness);

    // Edge thickness sides
    ctx.fillStyle = '#0a2312';
    ctx.beginPath();
    ctx.moveTo(p10[0], p10[1]);
    ctx.lineTo(p11[0], p11[1]);
    ctx.lineTo(p11Top[0], p11Top[1]);
    ctx.lineTo(p10Top[0], p10Top[1]);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f321a';
    ctx.beginPath();
    ctx.moveTo(p01[0], p01[1]);
    ctx.lineTo(p11[0], p11[1]);
    ctx.lineTo(p11Top[0], p11Top[1]);
    ctx.lineTo(p01Top[0], p01Top[1]);
    ctx.closePath();
    ctx.fill();

    // Top FR-4 Solder Mask Face
    ctx.beginPath();
    ctx.moveTo(p00Top[0], p00Top[1]);
    ctx.lineTo(p10Top[0], p10Top[1]);
    ctx.lineTo(p11Top[0], p11Top[1]);
    ctx.lineTo(p01Top[0], p01Top[1]);
    ctx.closePath();
    ctx.fillStyle = b.color || '#164223';
    ctx.fill();
    ctx.strokeStyle = '#2fe675';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 3. Batched Copper Traces (single draw call instead of thousands)
    ctx.beginPath();
    ctx.lineWidth = Math.max(0.9, 1.3 * (scale / 5));
    ctx.strokeStyle = 'rgba(235, 185, 60, 0.72)'; // Gold/copper traces
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

    // 4. Batched Solder Pads & Vias (ENIG gold)
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

    // 5. Depth-Sorted Components (back to front painter's algorithm)
    const sorted = comps.slice().sort((c1, c2) => {
      const p1 = project(c1.at[0], c1.at[1], 0);
      const p2 = project(c2.at[0], c2.at[1], 0);
      return p1[1] - p2[1];
    });

    const showText = scale > 2.2;
    if (showText) {
      ctx.font = `${Math.max(9, Math.floor(2.2 * scale))}px JetBrains Mono, monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
    }

    const zBase = b.thickness + 0.15;
    for (let i = 0; i < sorted.length; i++) {
      const comp = sorted[i];
      const cCenter = project(comp.at[0], comp.at[1], zBase);
      const cw = (comp.body.w || 4) * scale;
      const ch = (comp.body.h || 4) * scale;
      const cz = (comp.body.z || 1.5) * scale * 0.45;

      // Component body shading
      ctx.fillStyle = comp.kind === 'led'
        ? (comp.color === 'red' ? '#ff3344' : comp.color === 'blue' ? '#3388ff' : '#22dd55')
        : comp.kind === 'ic' || comp.kind === 'switch' ? '#1c1e22' : '#283038';

      ctx.beginPath();
      ctx.ellipse(cCenter[0], cCenter[1] - cz, cw * 0.45, ch * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4e5b68';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Silkscreen Ref Label for larger components
      if (showText && (cw > 14 || comp.kind === 'ic' || comp.kind === 'switch')) {
        ctx.fillText(comp.ref, cCenter[0], cCenter[1] - cz - 4);
      }
    }

    ctx.restore();
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.abortController.abort();
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
  }
}
