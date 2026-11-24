import type { Side, V2 } from '../../types';
import type { ToolContext, WorkbenchTool } from './tool';

export type DmmMode = 'VDC' | 'VAC' | 'OHMS' | 'DIODE' | 'CAP' | 'CURRENT';

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
    this.ctx = null;
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
    this.ctx?.requestRender();
  }
}
