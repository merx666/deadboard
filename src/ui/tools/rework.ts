import type { ToolContext, WorkbenchTool } from './tool';

export class ReworkTool implements WorkbenchTool {
  readonly id = 'iron';
  tempC = 350;
  hasFlux = false;
  hasWick = false;
  private ctx: ToolContext | null = null;

  activate(context: ToolContext): void { this.ctx = context; }
  deactivate(): void { this.ctx = null; }

  setTemp(t: number): void {
    this.tempC = t;
    this.ctx?.requestRender();
  }
}
