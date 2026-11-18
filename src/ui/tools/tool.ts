import type { Board, Side, V2 } from '../../types';

export type ToolKind =
  | 'inspect' | 'dmm' | 'scope' | 'thermal' | 'iron' | 'hotair'
  | 'jumper' | 'cut' | 'partsbin' | 'freeze' | 'ipa';

export interface ToolContext {
  board: Board;
  requestRender(): void;
  playAudio(effect: string): void;
  showToast(message: string, type?: 'info' | 'success' | 'warn' | 'error'): void;
}

export interface WorkbenchTool {
  readonly id: ToolKind;
  activate(context: ToolContext): void;
  deactivate(): void;
  onPointerDown?(pos: V2, side: Side): void;
  onPointerMove?(pos: V2, side: Side): void;
  onPointerUp?(pos: V2, side: Side): void;
}
