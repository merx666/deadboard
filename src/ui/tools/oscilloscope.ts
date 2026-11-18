import type { ToolContext, WorkbenchTool } from './tool';

export class OscilloscopeTool implements WorkbenchTool {
  readonly id = 'scope';
  timebase = 0.005; // 5ms per division
  ch1VoltsPerDiv = 1.0;
  ch2VoltsPerDiv = 1.0;
  triggerLevel = 1.65;
  running = true;
  private ctx: ToolContext | null = null;

  activate(context: ToolContext): void { this.ctx = context; }
  deactivate(): void { this.ctx = null; }

  setTimebase(seconds: number): void {
    this.timebase = seconds;
    this.ctx?.requestRender();
  }

  toggleRun(): boolean {
    this.running = !this.running;
    this.ctx?.requestRender();
    return this.running;
  }
}
