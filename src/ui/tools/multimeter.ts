import type { Side, V2 } from '../../types';
import type { ToolContext, WorkbenchTool } from './tool';

export type DmmMode = 'VDC' | 'VAC' | 'OHMS' | 'DIODE' | 'CAP' | 'CURRENT';
export type DmmMinMaxMode = 'LIVE' | 'MIN' | 'MAX' | 'AVG';

export interface ProbeState {
  pos: V2;
  side: Side;
  net?: string;
}

export class MultimeterTool implements WorkbenchTool {
  readonly id = 'dmm';
  mode: DmmMode = 'VDC';
  probeRed: ProbeState | null = null;
  probeBlack: ProbeState | null = null;
  hold = false;
  rel = false;
  relOffset: number | null = null;
  minMaxMode: DmmMinMaxMode = 'LIVE';
  min: number | null = null;
  max: number | null = null;
  avg: number | null = null;
  count: number = 0;
  private sum = 0;
  private ctx: ToolContext | null = null;

  activate(context: ToolContext): void {
    this.ctx = context;
  }

  deactivate(): void {
    this.probeRed = null;
    this.probeBlack = null;
    this.hold = false;
    this.rel = false;
    this.relOffset = null;
    this.minMaxMode = 'LIVE';
    this.resetMinMax();
    this.ctx = null;
  }

  cycleMinMax(): DmmMinMaxMode {
    const modes: DmmMinMaxMode[] = ['LIVE', 'MIN', 'MAX', 'AVG'];
    const nextIdx = (modes.indexOf(this.minMaxMode) + 1) % modes.length;
    this.minMaxMode = modes[nextIdx];
    this.ctx?.playAudio('click');
    this.ctx?.requestRender();
    return this.minMaxMode;
  }

  cycleMinMaxMode(): DmmMinMaxMode {
    return this.cycleMinMax();
  }

  cycleMode(): DmmMinMaxMode {
    return this.cycleMinMax();
  }

  setMinMaxMode(mode: DmmMinMaxMode): void {
    this.minMaxMode = mode;
    this.ctx?.playAudio('click');
    this.ctx?.requestRender();
  }

  resetMinMax(): void {
    this.min = null;
    this.max = null;
    this.avg = null;
    this.count = 0;
    this.sum = 0;
  }

  recordValue(val: number): void {
    if (!Number.isFinite(val)) return;
    if (this.probeRed === null && this.probeBlack === null) return;
    if (this.min === null || val < this.min) this.min = val;
    if (this.max === null || val > this.max) this.max = val;
    this.count++;
    this.sum += val;
    this.avg = this.sum / this.count;
  }

  trackValue(val: number): void {
    this.recordValue(val);
  }

  addReading(val: number): void {
    this.recordValue(val);
  }

  getDisplayedValue(liveVal: number | null = null): number | null {
    switch (this.minMaxMode) {
      case 'MIN':
        return this.min;
      case 'MAX':
        return this.max;
      case 'AVG':
        return this.avg;
      case 'LIVE':
      default:
        return liveVal;
    }
  }

  toggleHold(): boolean {
    this.hold = !this.hold;
    this.ctx?.playAudio('click');
    this.ctx?.requestRender();
    return this.hold;
  }

  toggleRel(offset?: number): boolean {
    if (this.rel) {
      this.rel = false;
      this.relOffset = null;
    } else {
      this.rel = true;
      this.relOffset = offset ?? 0;
    }
    this.ctx?.playAudio('click');
    this.ctx?.requestRender();
    return this.rel;
  }

  setMode(mode: DmmMode): void {
    this.mode = mode;
    this.resetMinMax();
    this.ctx?.playAudio('click');
    this.ctx?.requestRender();
  }

  placeProbe(color: 'red' | 'black', pos: V2, side: Side, net?: string): void {
    if (color === 'red') {
      this.probeRed = { pos, side, net };
    } else {
      this.probeBlack = { pos, side, net };
    }
    this.ctx?.playAudio('probe_contact');
    this.ctx?.requestRender();
  }

  liftProbes(): void {
    this.probeRed = null;
    this.probeBlack = null;
    this.resetMinMax();
    this.ctx?.requestRender();
  }
}
