// Interactive 3D Motherboard Viewer for DEADBOARD homepage
// Renders open-hardware boards (MNT Reform 2, ESP32, Pico, Arduino Uno, Jetson Nano)
// with 360-degree free orbit, mouse drag, touch controls, zoom, and Top/Bottom inspection.

import { createEsp32DevScenario, createRaspberryPiPicoScenario, createArduinoUnoScenario } from '../boards/presets';
import { Camera } from '../render/camera';
import { WebGPURenderer, type RenderSceneState } from '../render/webgpu';
import { buildConnectivity } from '../connectivity';
import type { Board, Scenario } from '../types';

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
  private webGpuAvailable = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.camera = new Camera();
    this.camera.setMode('3d');

    // Default to ESP32 DevBoard preset (lightweight, immediately available, stunning in 3D)
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
        console.warn('WebGPU hero preview fallback to Canvas2D/WebGL:', e);
        this.webGpuAvailable = false;
      }
    } else {
      this.webGpuAvailable = false;
    }

    this.bindControls();
    this.startLoop();

    // Pre-load demo MNT Reform 2 if available
    void this.loadDemoBoard('reform');
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
    // Initial isometric perspective
    this.camera.pitch = 38;
    this.camera.yaw = -28;
  }

  async loadDemoBoard(id: string) {
    if (id === 'reform') {
      try {
        const res = await fetch('./demos/demo-mnt-reform2-mb30.pcbfix.json');
        if (res.ok) {
          const json = await res.json();
          this.activeScenario = json;
          this.updateCameraForBoard();
          return;
        }
      } catch {
        // Fallback to builtin
      }
    } else if (id === 'jetson') {
      try {
        const res = await fetch('./demos/demo-antmicro-jetson-nano-bb.pcbfix.json');
        if (res.ok) {
          const json = await res.json();
          this.activeScenario = json;
          this.updateCameraForBoard();
          return;
        }
      } catch {
        // Fallback
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
  }

  private bindControls() {
    const c = this.canvas;

    const onDown = (clientX: number, clientY: number) => {
      this.isDragging = true;
      this.autoOrbit = false;
      this.lastMouseX = clientX;
      this.lastMouseY = clientY;
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
    };

    c.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onDown(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) onMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', onUp);

    // Touch controls
    c.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        onDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    c.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    c.addEventListener('touchend', onUp);

    // Zoom on wheel
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.autoOrbit = false;
      const factor = e.deltaY < 0 ? 0.9 : 1.1;
      this.camera.dist = Math.max(15, Math.min(250, this.camera.dist * factor));
      this.camera.orthoHalfH = Math.max(5, Math.min(100, this.camera.orthoHalfH * factor));
    }, { passive: false });

    // Window resize
    window.addEventListener('resize', () => this.fitCanvas());
  }

  setSide(side: 'F' | 'B') {
    this.autoOrbit = false;
    this.camera.setSide(side);
  }

  toggleAutoOrbit(): boolean {
    this.autoOrbit = !this.autoOrbit;
    return this.autoOrbit;
  }

  resetCamera() {
    this.autoOrbit = true;
    this.updateCameraForBoard();
  }

  private startLoop() {
    const tick = () => {
      if (this.autoOrbit && !this.isDragging) {
        this.camera.orbit(this.autoOrbitSpeed, 0);
      }
      this.camera.tick(0.016);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private render() {
    const b = this.activeScenario.board;

    if (this.webGpuAvailable && this.renderer) {
      try {
        const conn = buildConnectivity(b);
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
        // Fall back to Canvas2D rendering
        this.webGpuAvailable = false;
      }
    }

    // High fidelity Canvas2D Isometric 3D fallback
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
      // Rotate by yaw around Z
      const rx = cx * cosY - cy * sinY;
      const ry = cx * sinY + cy * cosY;
      // Tilt by pitch
      const px = rx * scale;
      const py = (ry * sinP - z * Math.cos(pitchRad)) * scale;
      return [px, py];
    };

    // Draw Board Laminate Body (3D Box)
    const p10 = project(b.w, 0, 0);
    const p11 = project(b.w, b.h, 0);
    const p01 = project(0, b.h, 0);

    const p00Top = project(0, 0, b.thickness);
    const p10Top = project(b.w, 0, b.thickness);
    const p11Top = project(b.w, b.h, b.thickness);
    const p01Top = project(0, b.h, b.thickness);

    // Board substrate shadow
    ctx.beginPath();
    ctx.ellipse(0, 40 * (scale / 4), (b.w * scale) * 0.55, (b.h * scale) * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.filter = 'blur(16px)';
    ctx.fill();
    ctx.filter = 'none';

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

    // Render Traces
    ctx.lineWidth = Math.max(1, 1.4 * (scale / 5));
    ctx.strokeStyle = 'rgba(235, 180, 50, 0.7)'; // Gold/copper traces
    for (const t of b.traces) {
      if (t.layer === 'F') {
        const a = project(t.a[0], t.a[1], b.thickness + 0.1);
        const ptB = project(t.b[0], t.b[1], b.thickness + 0.1);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(ptB[0], ptB[1]);
        ctx.stroke();
      }
    }

    // Render Components in 3D
    for (const comp of b.components) {
      const zBase = b.thickness + 0.2;
      const cCenter = project(comp.at[0], comp.at[1], zBase);
      const cw = (comp.body.w || 4) * scale;
      const ch = (comp.body.h || 4) * scale;
      const cz = (comp.body.z || 1.5) * scale * 0.4;

      // Component body
      ctx.fillStyle = comp.kind === 'led'
        ? (comp.color === 'red' ? '#ff3344' : comp.color === 'blue' ? '#3388ff' : '#22dd55')
        : comp.kind === 'ic' || comp.kind === 'switch' ? '#1c1e22' : '#283038';

      ctx.beginPath();
      ctx.ellipse(cCenter[0], cCenter[1] - cz, cw * 0.4, ch * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#44505c';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Silkscreen Ref Label
      if (scale > 3) {
        ctx.font = `${Math.max(9, Math.floor(2.2 * scale))}px JetBrains Mono, monospace`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(comp.ref, cCenter[0], cCenter[1] - cz - 4);
      }
    }

    ctx.restore();
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
