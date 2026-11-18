import type { ToolContext, WorkbenchTool } from './tool';

export type ThermalPalette = 'ironbow' | 'rainbow' | 'grayscale';

export class ThermalTool implements WorkbenchTool {
  readonly id = 'thermal';
  palette: ThermalPalette = 'ironbow';
  minTempC = 20;
  maxTempC = 80;
  private ctx: ToolContext | null = null;

  activate(context: ToolContext): void { this.ctx = context; }
  deactivate(): void { this.ctx = null; }

  setPalette(p: ThermalPalette): void {
    this.palette = p;
    this.ctx?.requestRender();
  }
}
