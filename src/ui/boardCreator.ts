// Interactive Custom Board Builder & Supplier Parts Catalog (PCBWay / LCSC / DigiKey)
import { searchSupplierParts, SUPPLIER_PARTS, type ComponentPart } from '../parts/catalog';
import { BOARD_PRESETS } from '../boards/presets';
import { Builder } from '../scenarios/builder';
import type { Scenario, Component, Pad, V2 } from '../types';
import { rot } from '../geom';
import { getLang } from '../i18n';
import { writeZip } from '../mods/zip';
import { icon } from './icons';

export type FaultKind = 'none' | 'short-rail' | 'cold-joint' | 'reversed-diode' | 'blown-fuse';

export interface PlacedComponent {
  id: string;
  partId: string;
  ref: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  value?: number;
  name: string;
}

export interface BoardCreatorOptions {
  onLoadScenario: (scenario: Scenario) => void;
  onClose: () => void;
  toast: (msg: string, kind?: 'info' | 'warn' | 'success') => void;
}

export interface BuildCustomScenarioOptions {
  presetId: string;
  width: number;
  height: number;
  color: string;
  placedComponents: PlacedComponent[];
  fault?: FaultKind;
}

export function getFootprint(partId: string, comp: PlacedComponent): { w: number; h: number; padsCount: number; shape: string } {
  const part = SUPPLIER_PARTS.find((p) => p.id === partId);
  if (part) {
    return {
      w: part.footprintWidth || 10,
      h: part.footprintHeight || 10,
      padsCount: part.padsCount || 2,
      shape: part.valKind === 'IC' || part.category === 'modules' ? 'chip' : (part.valKind === 'R' || part.valKind === 'C' ? 'box' : 'chip')
    };
  }
  if (comp.ref.startsWith('R')) return { w: 3.2, h: 1.6, padsCount: 2, shape: 'box' };
  if (comp.ref.startsWith('C')) return { w: 2.0, h: 1.25, padsCount: 2, shape: 'box' };
  if (comp.ref.startsWith('LED')) return { w: 3.5, h: 3.5, padsCount: 2, shape: 'led' };
  if (comp.ref.startsWith('D')) return { w: 4.5, h: 2.5, padsCount: 2, shape: 'diode' };
  if (comp.ref.startsWith('J')) return { w: 5.0, h: 8.0, padsCount: 2, shape: 'header' };
  if (comp.ref.startsWith('SW')) return { w: 6.0, h: 6.0, padsCount: 4, shape: 'tactile' };
  if (comp.ref.startsWith('F')) return { w: 4.0, h: 2.0, padsCount: 2, shape: 'fuse' };
  if (comp.ref.startsWith('TP')) return { w: 2.5, h: 2.5, padsCount: 1, shape: 'pin' };
  if (comp.ref.startsWith('U')) return { w: 12.0, h: 16.0, padsCount: 8, shape: 'chip' };
  return { w: 8.0, h: 8.0, padsCount: 2, shape: 'box' };
}

function safePadPos(c: Component, name: string): V2 | null {
  const p = c.pads.find((q) => q.name === name) || c.pads[0];
  if (!p) return null;
  try {
    const r = rot(p.at, c.rot);
    return [c.at[0] + r[0], c.at[1] + r[1]];
  } catch {
    return null;
  }
}

function routeCustomBoardTraces(b: Builder, comps: Component[]) {
  if (comps.length < 2) return;

  const pwr = comps.find((c) => c.kind === 'battery');
  if (pwr) {
    const pwrPos = safePadPos(pwr, '+') || safePadPos(pwr, '1');
    const gndPos = safePadPos(pwr, '-') || safePadPos(pwr, '2');

    const gndPoints: V2[] = [];
    if (gndPos) gndPoints.push(gndPos);

    const otherComps = comps.filter((c) => c !== pwr);
    if (otherComps.length > 0 && pwrPos) {
      const firstPad = safePadPos(otherComps[0], '1');
      if (firstPad) {
        b.track('F', [pwrPos, firstPad], 0.8, 'VBUS_5V');
      }
    }

    for (let i = 0; i + 1 < otherComps.length; i++) {
      const pA = safePadPos(otherComps[i], '2');
      const pB = safePadPos(otherComps[i + 1], '1');
      if (pA && pB) {
        b.track('F', [pA, pB], 0.6, `NET_${otherComps[i].ref}_${otherComps[i + 1].ref}`);
      }
    }

    for (const c of otherComps) {
      const gndPadName = c.pins['-'] || c.pins['K'] || (c.pads.some((p) => p.name === '2') ? '2' : undefined);
      if (gndPadName) {
        const pt = safePadPos(c, gndPadName);
        if (pt) gndPoints.push(pt);
      }
    }

    if (gndPoints.length >= 2) {
      for (let i = 0; i + 1 < gndPoints.length; i++) {
        b.track('B', [gndPoints[i], gndPoints[i + 1]], 1.0, 'GND');
      }
    }
  } else {
    for (let i = 0; i + 1 < comps.length; i++) {
      const pA = safePadPos(comps[i], '2');
      const pB = safePadPos(comps[i + 1], '1');
      if (pA && pB) {
        b.track('F', [pA, pB], 0.6, `NET_${comps[i].ref}_${comps[i + 1].ref}`);
      }
    }
  }
}

export function buildComponentFromPlaced(comp: PlacedComponent, b: Builder): Component {
  const part = SUPPLIER_PARTS.find((p) => p.id === comp.partId);

  if (part) {
    if (part.valKind === 'R') {
      return b.resistor(comp.ref, comp.value ?? part.defaultVal ?? 10000, [comp.x, comp.y], comp.rotation);
    }
    if (part.valKind === 'C') {
      const c = b.resistor(comp.ref, 0.05, [comp.x, comp.y], comp.rotation);
      c.kind = 'capacitor';
      c.value = comp.value ?? part.defaultVal ?? 1e-7;
      c.body = { shape: 'box', w: part.footprintWidth || 2.0, h: part.footprintHeight || 1.25, z: 0.8, color: '#78350f' };
      return c;
    }
    if (part.valKind === 'D' || part.category === 'diodes') {
      if (comp.ref.startsWith('LED') || part.namePl.includes('LED') || part.nameEn.includes('LED')) {
        return b.led(comp.ref, 'red', [comp.x, comp.y], comp.rotation);
      }
      return b.diode(comp.ref, [comp.x, comp.y], comp.rotation);
    }
    if (part.valKind === 'F') {
      return b.fuse(comp.ref, comp.value ?? part.defaultVal ?? 1.0, [comp.x, comp.y], comp.rotation);
    }
    if (part.valKind === 'IC' || part.category === 'modules' || part.category === 'power' || part.category === 'interface') {
      if (part.id.includes('ams1117') || comp.ref.includes('LDO')) {
        const c = b.resistor(comp.ref, 0.02, [comp.x, comp.y], comp.rotation);
        c.label = part.mpn;
        c.body = { shape: 'chip', w: part.footprintWidth || 6.5, h: part.footprintHeight || 7, z: 1.8, color: '#1e293b' };
        return c;
      }

      // Generic IC / MCU Module
      const w = part.footprintWidth || 18;
      const h = part.footprintHeight || 25;
      const padsCount = part.padsCount || 8;
      const half = Math.ceil(padsCount / 2);
      const padSpacing = Math.max(1.0, (h - 3) / Math.max(1, half - 1));
      const pads: Pad[] = [];
      for (let i = 0; i < half; i++) {
        const py = (h / 2 - 1.5) - i * padSpacing;
        pads.push({ name: String(i + 1), at: [-w / 2, py], size: [1.6, 0.8], shape: 'rect', layers: 'F' });
      }
      for (let i = 0; i < padsCount - half; i++) {
        const py = -(h / 2 - 1.5) + i * padSpacing;
        pads.push({ name: String(half + i + 1), at: [w / 2, py], size: [1.6, 0.8], shape: 'rect', layers: 'F' });
      }
      const pins: Record<string, string> = {};
      if (part.pins && Object.keys(part.pins).length > 0) {
        Object.assign(pins, part.pins);
      } else {
        for (let i = 1; i <= padsCount; i++) pins[String(i)] = String(i);
      }
      const compObj: Component = {
        id: 'c' + (b.b.nextId++).toString(36),
        ref: comp.ref,
        kind: 'ic',
        value: comp.value || 0,
        label: part.mpn,
        at: [comp.x, comp.y],
        rot: comp.rotation,
        side: 'F',
        pads,
        pins,
        body: { shape: 'chip', w, h, z: 2.5, color: '#1e293b' },
        state: { populated: true, reversed: false, burnt: false, cold: [] },
      };
      b.b.components.push(compObj);
      return compObj;
    }
  }

  // Fallback based on ref prefix
  if (comp.ref.startsWith('R')) {
    return b.resistor(comp.ref, comp.value ?? 10000, [comp.x, comp.y], comp.rotation);
  }
  if (comp.ref.startsWith('C')) {
    const c = b.resistor(comp.ref, 0.05, [comp.x, comp.y], comp.rotation);
    c.kind = 'capacitor';
    c.value = comp.value ?? 1e-7;
    c.body = { shape: 'box', w: 2.0, h: 1.25, z: 0.8, color: '#78350f' };
    return c;
  }
  if (comp.ref.startsWith('LED') || (comp.ref.startsWith('D') && comp.name.toLowerCase().includes('led'))) {
    return b.led(comp.ref, 'red', [comp.x, comp.y], comp.rotation);
  }
  if (comp.ref.startsWith('D')) {
    return b.diode(comp.ref, [comp.x, comp.y], comp.rotation);
  }
  if (comp.ref.startsWith('J') || comp.partId.includes('header')) {
    return b.header(comp.ref, comp.value ?? 5.0, [comp.x, comp.y], comp.rotation, comp.name || 'DC IN 5V');
  }
  if (comp.ref.startsWith('SW')) {
    return b.tactile(comp.ref, [comp.x, comp.y]);
  }
  if (comp.ref.startsWith('F')) {
    return b.fuse(comp.ref, comp.value ?? 1.0, [comp.x, comp.y], comp.rotation);
  }
  if (comp.ref.startsWith('TP')) {
    return b.testpoint(comp.ref, [comp.x, comp.y], comp.name);
  }

  // Generic fallback
  return b.resistor(comp.ref, 1000, [comp.x, comp.y], comp.rotation);
}

export function applyFaultsToScenario(sc: Scenario, fault: FaultKind) {
  if (fault === 'none') return;

  if (fault === 'short-rail') {
    const cap = sc.board.components.find(
      (c) => c.ref.startsWith('C') || c.ref.includes('LDO') || c.kind === 'capacitor'
    );
    if (cap) {
      cap.state.leak = { ohms: 0.2 };
      sc.meta.description += ' [Usterka: Zwarcie szyny zasilania!]';
    }
  } else if (fault === 'cold-joint') {
    const r =
      sc.board.components.find((c) => c.kind === 'resistor' || c.ref.startsWith('R')) ??
      sc.board.components.find((c) => c.ref.startsWith('F') || c.kind === 'fuse');
    if (r) {
      r.state.cold = [0];
      sc.meta.description += ' [Usterka: Zimny lut na zasilaniu!]';
    }
  } else if (fault === 'reversed-diode') {
    const d = sc.board.components.find(
      (c) => c.kind === 'led' || c.kind === 'diode' || c.ref.startsWith('D')
    );
    if (d) {
      d.state.reversed = true;
      sc.meta.description += ' [Usterka: Dioda wlutowana odwrotnie!]';
    }
  } else if (fault === 'blown-fuse') {
    const f = sc.board.components.find(
      (c) => c.kind === 'fuse' || c.ref.startsWith('F')
    );
    if (f) {
      f.state.burnt = true;
      sc.meta.description += ' [Usterka: Przepalony bezpiecznik wejściowy!]';
    }
  }
}

export function buildCustomScenario(opts: BuildCustomScenarioOptions): Scenario {
  const { presetId, width, height, color, placedComponents, fault = 'none' } = opts;
  let sc: Scenario;

  if (presetId === 'custom-blank') {
    const b = new Builder(width, height);
    b.b.color = color;
    b.text([width / 2, 4], 'CUSTOM PROTOTYPING BOARD', 1.8);
    b.text([width / 2, height - 4], `DEADBOARD STUDIO · ${width}x${height}mm`, 1.2);

    const createdComps: Component[] = [];
    for (const comp of placedComponents) {
      const c = buildComponentFromPlaced(comp, b);
      createdComps.push(c);
      // Silkscreen ref des
      const fp = getFootprint(comp.partId, comp);
      const silkY = Math.max(2, comp.y - (fp.h / 2 + 1.8));
      b.text([comp.x, silkY], comp.ref, 1.2);
    }

    // Connect traces
    routeCustomBoardTraces(b, createdComps);

    sc = {
      format: 'pcbfix/1',
      id: `custom-board-${Date.now().toString(36)}`,
      meta: {
        title: `Custom Board (${width}x${height}mm)`,
        author: 'DEADBOARD Maker',
        difficulty: 1,
        description: 'Własny projekt płytki PCB przygotowany w warsztacie DEADBOARD.',
        hints: ['Użyj narzędzi lutownicy, multimetru i oscyloskopu do testowania obwodu.'],
        license: 'CC0-1.0',
      },
      board: b.b,
      objectives: [],
    };
  } else {
    const preset = BOARD_PRESETS.find((p) => p.id === presetId) ?? BOARD_PRESETS[0];
    sc = preset.create();
    sc.board.w = width;
    sc.board.h = height;
    sc.board.color = color;

    // Update existing components or add newly placed ones
    const existingRefs = new Set(sc.board.components.map((c) => c.ref));
    const placedMap = new Map(placedComponents.map((p) => [p.ref, p]));

    // 1. Update positions of existing components
    for (const c of sc.board.components) {
      const placed = placedMap.get(c.ref) ?? placedComponents.find((p) => p.id === c.id);
      if (placed) {
        c.at = [placed.x, placed.y];
        c.rot = placed.rotation;
        if (placed.value !== undefined) c.value = placed.value;
      }
    }

    // 2. Remove components that the user deleted from placedComponents
    const activePlacedIds = new Set(placedComponents.map((p) => p.id));
    const activePlacedRefs = new Set(placedComponents.map((p) => p.ref));
    sc.board.components = sc.board.components.filter(
      (c) => activePlacedIds.has(c.id) || activePlacedRefs.has(c.ref)
    );

    // 3. Add components that were newly added to placedComponents
    const bWrapper = new Builder(width, height);
    bWrapper.b = sc.board;
    for (const placed of placedComponents) {
      if (!existingRefs.has(placed.ref) && !sc.board.components.some((c) => c.id === placed.id)) {
        buildComponentFromPlaced(placed, bWrapper);
      }
    }
  }

  // Apply fault if requested
  applyFaultsToScenario(sc, fault);

  return sc;
}

export class BoardCreatorModal {
  private el: HTMLElement;
  private opts: BoardCreatorOptions;
  private activeTab: 'builder' | 'catalog' = 'builder';
  private selectedPresetId: string = 'preset-esp32-devkit';
  private customWidth = 84;
  private customHeight = 52;
  private customColor = '#124422';
  private searchQuery = '';
  private selectedCategory = 'all';
  private injectFault: FaultKind = 'none';
  private placedComponents: PlacedComponent[] = [];
  private selectedCompId: string | null = null;

  private onWindowMouseMove?: (e: MouseEvent) => void;
  private onWindowMouseUp?: () => void;

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close();
    }
  };

  constructor(opts: BoardCreatorOptions) {
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'modal-backdrop';
    this.el.id = 'board-creator-modal';
    this.loadPreset(this.selectedPresetId);
  }

  show() {
    this.render();
    document.body.appendChild(this.el);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  close() {
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.onWindowMouseMove) window.removeEventListener('mousemove', this.onWindowMouseMove);
    if (this.onWindowMouseUp) window.removeEventListener('mouseup', this.onWindowMouseUp);
    this.el.remove();
    this.opts.onClose();
  }

  private loadPreset(presetId: string) {
    this.selectedPresetId = presetId;
    if (presetId === 'custom-blank') {
      this.customWidth = 80;
      this.customHeight = 50;
      this.customColor = '#124422';
      this.placedComponents = [];
      this.selectedCompId = null;
      return;
    }

    const preset = BOARD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const sc = preset.create();
    this.customWidth = sc.board.w;
    this.customHeight = sc.board.h;
    this.customColor = sc.board.color || '#124422';
    this.placedComponents = sc.board.components.map((c) => ({
      id: c.id,
      partId: this.findPartIdForComp(c),
      ref: c.ref,
      x: Math.round(c.at[0] * 10) / 10,
      y: Math.round(c.at[1] * 10) / 10,
      rotation: (((c.rot % 360) + 360) % 360) as 0 | 90 | 180 | 270,
      value: c.value,
      name: c.label || c.ref,
    }));
    this.selectedCompId = null;
  }

  private findPartIdForComp(c: Component): string {
    const refUpper = c.ref.toUpperCase();
    if (refUpper.includes('ESP32')) return 'esp32-wroom-32d';
    if (refUpper.includes('RP2040') || refUpper.includes('PICO')) return 'rp2040-pico';
    if (refUpper.includes('ATMEGA') || refUpper.includes('328P')) return 'atmega328p-arduino';
    if (refUpper.includes('STM32') || refUpper.includes('BLUEPILL')) return 'stm32f103c8t6-bluepill';
    if (refUpper.includes('LDO') || refUpper.includes('1117')) return 'ams1117-33';
    if (refUpper.includes('RT6150') || refUpper.includes('TPS54302') || refUpper.includes('BUCK')) return 'tps54302ddcr';
    if (refUpper.includes('FLASH') || refUpper.includes('W25Q')) return 'w25q128jvsiq';
    if (c.kind === 'resistor') {
      if (refUpper.startsWith('C')) return 'cap-mlcc-0805-10u';
      return 'res-smd-0805-10k';
    }
    if (c.kind === 'capacitor') return 'cap-mlcc-0805-100n';
    if (c.kind === 'led') return 'generic-led';
    if (c.kind === 'diode') return 'ss34';
    if (c.kind === 'fuse') return 'fuse-smd-1206-1a';
    if (c.kind === 'battery') return 'generic-header-5v';
    if (c.kind === 'switch') return 'generic-switch';
    if (c.kind === 'testpoint') return 'generic-testpoint';
    return 'generic';
  }

  private generateNextRef(prefix: string): string {
    let maxNum = 0;
    for (const c of this.placedComponents) {
      if (c.ref.startsWith(prefix)) {
        const numStr = c.ref.replace(prefix, '').match(/^\d+/)?.[0];
        if (numStr) {
          const num = parseInt(numStr, 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    return `${prefix}${maxNum + 1}`;
  }

  private calculateNextPosition(): { x: number; y: number } {
    const margin = 12;
    const availW = Math.max(10, this.customWidth - margin * 2);
    const availH = Math.max(10, this.customHeight - margin * 2);
    const cols = Math.max(1, Math.floor(availW / 14));
    const count = this.placedComponents.length;
    const col = count % cols;
    const row = Math.floor(count / cols);
    const x = Math.round(margin + col * (availW / Math.max(1, cols - 1 || 1)));
    const y = Math.round(margin + (row * 12) % availH);
    return {
      x: Math.max(margin, Math.min(this.customWidth - margin, x)),
      y: Math.max(margin, Math.min(this.customHeight - margin, y)),
    };
  }

  private addPartToBoard(partId: string, isPl: boolean) {
    const part = SUPPLIER_PARTS.find((p) => p.id === partId);
    if (!part) return;

    let prefix = 'U';
    if (part.valKind === 'R') prefix = 'R';
    else if (part.valKind === 'C') prefix = 'C';
    else if (part.valKind === 'L') prefix = 'L';
    else if (part.valKind === 'D') {
      prefix = part.category === 'diodes' && (part.namePl.includes('LED') || part.nameEn.includes('LED')) ? 'LED' : 'D';
    } else if (part.valKind === 'Q') prefix = 'Q';
    else if (part.valKind === 'SW') prefix = 'SW';
    else if (part.valKind === 'F') prefix = 'F';
    else if (part.category === 'modules' || part.category === 'interface' || part.category === 'power') prefix = 'U';

    const ref = this.generateNextRef(prefix);
    const { x, y } = this.calculateNextPosition();

    const comp: PlacedComponent = {
      id: 'c_' + Math.random().toString(36).substring(2, 9),
      partId: part.id,
      ref,
      x,
      y,
      rotation: 0,
      value: part.defaultVal,
      name: isPl ? part.namePl : part.nameEn,
    };

    this.placedComponents.push(comp);
    this.selectedCompId = comp.id;

    this.opts.toast(
      isPl ? `Dodano ${ref} (${part.mpn}) do płytki!` : `Added ${ref} (${part.mpn}) to board!`,
      'success'
    );

    this.updateTabBadge(isPl);
    if (this.activeTab === 'builder') {
      this.updatePreviewAndComponentsList(isPl);
    }
  }

  private handleQuickAdd(kind: string, isPl: boolean) {
    let partId = 'generic';
    let prefix = 'U';
    let name = '';
    let value: number | undefined;

    switch (kind) {
      case 'resistor':
        partId = 'res-smd-0805-10k';
        prefix = 'R';
        name = isPl ? 'Rezystor 10kΩ (0805)' : '10kΩ Resistor (0805)';
        value = 10000;
        break;
      case 'capacitor':
        partId = 'cap-mlcc-0805-100n';
        prefix = 'C';
        name = isPl ? 'Kondensator 100nF (0805)' : '100nF MLCC Capacitor (0805)';
        value = 1e-7;
        break;
      case 'capacitor-bulk':
        partId = 'cap-mlcc-0805-10u';
        prefix = 'C';
        name = isPl ? 'Kondensator 10µF (0805)' : '10µF Filter Capacitor (0805)';
        value = 1e-5;
        break;
      case 'led':
        partId = 'generic-led';
        prefix = 'D';
        name = isPl ? 'Dioda LED Czerwona' : 'Red LED';
        value = 0;
        break;
      case 'diode':
        partId = 'ss34';
        prefix = 'D';
        name = isPl ? 'Dioda Schottky SS34' : 'SS34 Schottky Diode';
        value = 0.7;
        break;
      case 'ldo':
        partId = 'ams1117-33';
        prefix = 'U';
        name = 'AMS1117-3.3 (SOT-223)';
        value = 3.3;
        break;
      case 'fuse':
        partId = 'fuse-smd-1206-1a';
        prefix = 'F';
        name = isPl ? 'Bezpiecznik 1A (1206)' : '1A Polyfuse (1206)';
        value = 1.0;
        break;
      case 'header':
        partId = 'generic-header-5v';
        prefix = 'J';
        name = isPl ? 'Złącze Zasilania USB 5V' : 'USB 5V Power Header';
        value = 5.0;
        break;
      default:
        partId = 'res-smd-0805-10k';
        prefix = 'R';
        name = 'Generic Part';
    }

    const ref = this.generateNextRef(prefix);
    const { x, y } = this.calculateNextPosition();

    const comp: PlacedComponent = {
      id: 'c_' + Math.random().toString(36).substring(2, 9),
      partId,
      ref,
      x,
      y,
      rotation: 0,
      value,
      name,
    };

    this.placedComponents.push(comp);
    this.selectedCompId = comp.id;

    this.opts.toast(
      isPl ? `Dodano ${ref} (${name})!` : `Added ${ref} (${name})!`,
      'success'
    );

    this.updateTabBadge(isPl);
    this.updatePreviewAndComponentsList(isPl);
  }

  private deleteComponent(compId: string, isPl: boolean) {
    const idx = this.placedComponents.findIndex((c) => c.id === compId);
    if (idx === -1) return;
    const [deleted] = this.placedComponents.splice(idx, 1);
    if (this.selectedCompId === compId) this.selectedCompId = null;

    // Remove row from DOM
    const rowEl = this.el.querySelector(`.placed-comp-row[data-comp-id="${compId}"]`);
    rowEl?.remove();

    // Remove SVG element
    const svgEl = this.el.querySelector(`#pcb-svg-preview [data-comp-id="${compId}"]`);
    svgEl?.remove();

    // Update count badge
    const countBadge = this.el.querySelector('#placed-comps-count');
    if (countBadge) countBadge.textContent = String(this.placedComponents.length);

    // If empty now, show empty message
    const listEl = this.el.querySelector('#placed-comps-list');
    if (listEl && this.placedComponents.length === 0) {
      listEl.innerHTML = `
        <div id="empty-comps-msg" style="padding: 24px 12px; text-align: center; color: var(--muted); border: 1px dashed var(--border); border-radius: 6px; font-size: 12px;">
          ${isPl ? 'Brak komponentów na płytce. Skorzystaj z paska szybkiego dodawania lub wybierz części z bazy PCBWay / LCSC!' : 'No components placed yet. Use the Quick Add bar below or select components from the PCBWay / LCSC catalog!'}
        </div>
      `;
    }

    this.updateTabBadge(isPl);
    this.opts.toast(isPl ? `Usunięto ${deleted.ref}` : `Removed ${deleted.ref}`, 'info');
  }

  private updateTabBadge(isPl: boolean) {
    const tabBtn = this.el.querySelector('#tab-btn-builder');
    if (tabBtn) {
      const count = this.placedComponents.length;
      const countStr = count > 0 ? ` (${count})` : '';
      tabBtn.innerHTML = `${icon('grid', 14)}<span>${isPl ? 'Kreator Obwodów i Modyfikacji' : 'Circuit & Mod Builder'}${countStr}</span>`;
    }
  }

  private updateComponentSvgTransform(comp: PlacedComponent) {
    const compEl = this.el.querySelector(`#pcb-svg-preview [data-comp-id="${comp.id}"]`);
    if (compEl) {
      const ySvg = this.customHeight - comp.y;
      compEl.setAttribute('transform', `translate(${comp.x}, ${ySvg}) rotate(${comp.rotation})`);
    }
  }

  private highlightSelectedComponent() {
    this.el.querySelectorAll('#pcb-svg-preview .preview-comp').forEach((g) => {
      const id = g.getAttribute('data-comp-id');
      const isSel = id === this.selectedCompId;
      const ring = g.querySelector('.selection-ring');
      if (ring) {
        ring.setAttribute('stroke', isSel ? '#38bdf8' : 'none');
      }
    });

    this.el.querySelectorAll('.placed-comp-row').forEach((row) => {
      const id = row.getAttribute('data-comp-id');
      const isSel = id === this.selectedCompId;
      if (isSel) {
        row.classList.add('active-comp');
        (row as HTMLElement).style.borderColor = 'var(--accent)';
        (row as HTMLElement).style.background = 'rgba(56, 189, 248, 0.08)';
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        row.classList.remove('active-comp');
        (row as HTMLElement).style.borderColor = 'var(--border)';
        (row as HTMLElement).style.background = 'var(--surface)';
      }
    });
  }

  private updateSvgPreview() {
    const svg = this.el.querySelector('#pcb-svg-preview') as SVGSVGElement | null;
    if (!svg) return;

    svg.setAttribute('viewBox', `0 0 ${this.customWidth} ${this.customHeight}`);

    const boardRect = svg.querySelector('#svg-board-rect');
    if (boardRect) {
      boardRect.setAttribute('width', String(this.customWidth));
      boardRect.setAttribute('height', String(this.customHeight));
      boardRect.setAttribute('fill', this.customColor);
    }

    const silkOutline = svg.querySelector('#svg-silk-outline');
    if (silkOutline) {
      silkOutline.setAttribute('width', String(Math.max(1, this.customWidth - 3)));
      silkOutline.setAttribute('height', String(Math.max(1, this.customHeight - 3)));
    }

    const holeTopR = svg.querySelector('#svg-hole-tr');
    if (holeTopR) holeTopR.setAttribute('cx', String(this.customWidth - 3.5));
    const holeBotL = svg.querySelector('#svg-hole-bl');
    if (holeBotL) holeBotL.setAttribute('cy', String(this.customHeight - 3.5));
    const holeBotR = svg.querySelector('#svg-hole-br');
    if (holeBotR) {
      holeBotR.setAttribute('cx', String(this.customWidth - 3.5));
      holeBotR.setAttribute('cy', String(this.customHeight - 3.5));
    }

    const titleText = svg.querySelector('#svg-board-title');
    if (titleText) titleText.setAttribute('x', String(this.customWidth / 2));

    const compsLayer = svg.querySelector('#svg-components-layer');
    if (compsLayer) {
      compsLayer.innerHTML = this.placedComponents.map((c) => this.renderComponentSvg(c)).join('');
    }

    const dimText = this.el.querySelector('#preview-dim-text');
    if (dimText) dimText.textContent = `${this.customWidth} × ${this.customHeight} mm`;
  }

  private renderComponentSvg(comp: PlacedComponent): string {
    const fp = getFootprint(comp.partId, comp);
    const isSelected = this.selectedCompId === comp.id;
    const ySvg = this.customHeight - comp.y;
    const w = fp.w;
    const h = fp.h;

    let bodySvg = '';
    let padsSvg = '';

    if (fp.shape === 'chip') {
      bodySvg = `
        <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="0.5" fill="#1e293b" stroke="#475569" stroke-width="0.3" />
        <circle cx="${-w / 2 + 1}" cy="${-h / 2 + 1}" r="0.4" fill="#94a3b8" />
      `;
      const half = Math.ceil(fp.padsCount / 2);
      const spacing = (h - 2) / Math.max(1, half - 1);
      for (let i = 0; i < half; i++) {
        const py = (h / 2 - 1) - i * spacing;
        padsSvg += `<rect x="${-w / 2 - 0.7}" y="${py - 0.35}" width="0.9" height="0.7" rx="0.1" fill="#f59e0b" stroke="#fbbf24" stroke-width="0.1" />`;
      }
      for (let i = 0; i < fp.padsCount - half; i++) {
        const py = -(h / 2 - 1) + i * spacing;
        padsSvg += `<rect x="${w / 2 - 0.2}" y="${py - 0.35}" width="0.9" height="0.7" rx="0.1" fill="#f59e0b" stroke="#fbbf24" stroke-width="0.1" />`;
      }
    } else if (fp.shape === 'led') {
      bodySvg = `
        <circle cx="0" cy="0" r="${w / 2}" fill="#ef4444" stroke="#f87171" stroke-width="0.3" opacity="0.9" />
        <circle cx="-0.4" cy="-0.4" r="${w / 4}" fill="#fca5a5" opacity="0.6" />
      `;
      padsSvg = `
        <rect x="${-w / 2 - 0.8}" y="-0.5" width="0.9" height="1.0" rx="0.1" fill="#f59e0b" />
        <circle cx="${w / 2 + 0.4}" cy="0" r="0.5" fill="#f59e0b" />
      `;
    } else if (fp.shape === 'diode') {
      bodySvg = `
        <rect x="${-w * 0.35}" y="${-h * 0.4}" width="${w * 0.7}" height="${h * 0.8}" rx="0.2" fill="#111827" stroke="#374151" stroke-width="0.2" />
        <line x1="${w * 0.15}" y1="${-h * 0.4}" x2="${w * 0.15}" y2="${h * 0.4}" stroke="#ffffff" stroke-width="0.4" />
      `;
      padsSvg = `
        <rect x="${-w / 2}" y="${-h * 0.4}" width="${w * 0.25}" height="${h * 0.8}" rx="0.1" fill="#f59e0b" />
        <rect x="${w / 2 - w * 0.25}" y="${-h * 0.4}" width="${w * 0.25}" height="${h * 0.8}" rx="0.1" fill="#f59e0b" />
      `;
    } else if (fp.shape === 'header') {
      bodySvg = `
        <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="0.4" fill="#1f2937" stroke="#9ca3af" stroke-width="0.2" />
      `;
      padsSvg = `
        <circle cx="0" cy="${-h / 4}" r="1.0" fill="#f59e0b" stroke="#000" stroke-width="0.3" />
        <circle cx="0" cy="${h / 4}" r="1.0" fill="#f59e0b" stroke="#000" stroke-width="0.3" />
      `;
    } else if (fp.shape === 'tactile') {
      bodySvg = `
        <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="0.4" fill="#334155" stroke="#64748b" stroke-width="0.3" />
        <circle cx="0" cy="0" r="${w / 3.5}" fill="#0f172a" stroke="#cbd5e1" stroke-width="0.2" />
      `;
      padsSvg = `
        <circle cx="${-w / 2}" cy="${-h / 2}" r="0.8" fill="#f59e0b" />
        <circle cx="${-w / 2}" cy="${h / 2}" r="0.8" fill="#f59e0b" />
        <circle cx="${w / 2}" cy="${-h / 2}" r="0.8" fill="#f59e0b" />
        <circle cx="${w / 2}" cy="${h / 2}" r="0.8" fill="#f59e0b" />
      `;
    } else if (fp.shape === 'pin') {
      bodySvg = `
        <circle cx="0" cy="0" r="${w / 2}" fill="#f59e0b" stroke="#fbbf24" stroke-width="0.2" />
        <circle cx="0" cy="0" r="${w / 4}" fill="#0f172a" />
      `;
    } else {
      const bodyColor = comp.ref.startsWith('C') ? '#78350f' : (comp.ref.startsWith('F') ? '#1e1b4b' : '#0f172a');
      bodySvg = `
        <rect x="${-w * 0.35}" y="${-h * 0.4}" width="${w * 0.7}" height="${h * 0.8}" rx="0.15" fill="${bodyColor}" stroke="#475569" stroke-width="0.15" />
      `;
      padsSvg = `
        <rect x="${-w / 2}" y="${-h * 0.45}" width="${w * 0.25}" height="${h * 0.9}" rx="0.1" fill="#f59e0b" />
        <rect x="${w / 2 - w * 0.25}" y="${-h * 0.45}" width="${w * 0.25}" height="${h * 0.9}" rx="0.1" fill="#f59e0b" />
      `;
    }

    const ringStroke = isSelected ? '#38bdf8' : 'none';
    const selectionRing = `
      <rect class="selection-ring" x="${-w / 2 - 0.8}" y="${-h / 2 - 0.8}" width="${w + 1.6}" height="${h + 1.6}" rx="0.4" fill="none" stroke="${ringStroke}" stroke-width="0.5" stroke-dasharray="1.2,0.8" />
    `;

    const fontSize = Math.max(1.1, Math.min(1.8, Math.max(w, h) * 0.25));

    return `
      <g class="preview-comp" data-comp-id="${comp.id}" transform="translate(${comp.x}, ${ySvg}) rotate(${comp.rotation})" style="cursor: move;">
        ${padsSvg}
        ${bodySvg}
        ${selectionRing}
        <text x="0" y="${-h / 2 - 0.6}" text-anchor="middle" font-size="${fontSize}" fill="#ffffff" font-family="monospace" font-weight="bold">${comp.ref}</text>
      </g>
    `;
  }

  private renderPlacedComponentsRowsHtml(isPl: boolean): string {
    if (this.placedComponents.length === 0) {
      return `
        <div id="empty-comps-msg" style="padding: 24px 12px; text-align: center; color: var(--muted); border: 1px dashed var(--border); border-radius: 6px; font-size: 12px;">
          ${isPl ? 'Brak komponentów na płytce. Skorzystaj z paska szybkiego dodawania lub wybierz części z bazy PCBWay / LCSC!' : 'No components placed yet. Use the Quick Add bar below or select components from the PCBWay / LCSC catalog!'}
        </div>
      `;
    }

    return this.placedComponents.map((c) => this.renderComponentRowHtml(c, isPl)).join('');
  }

  private renderComponentRowHtml(c: PlacedComponent, isPl: boolean): string {
    const isSelected = this.selectedCompId === c.id;
    return `
      <div class="card placed-comp-row ${isSelected ? 'active-comp' : ''}" data-comp-id="${c.id}"
           style="padding: 8px 10px; background: ${isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--surface)'}; border: 1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}; border-radius: 6px; display: flex; flex-direction: column; gap: 6px;">
        <div class="row" style="justify-content: space-between; align-items: center;">
          <div class="row" style="gap: 8px; align-items: center; overflow: hidden;">
            <span class="badge" style="font-family: var(--mono); font-weight: 700; font-size: 11px; background: var(--bg); border: 1px solid var(--border); color: var(--accent); min-width: 28px; text-align: center;">${c.ref}</span>
            <span style="font-size: 12px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;" title="${c.name}">${c.name}</span>
          </div>
          <button type="button" class="btn ghost icon sm btn-del-comp" data-comp-id="${c.id}" title="${isPl ? 'Usuń element' : 'Delete component'}" style="color: var(--danger, #ef4444); padding: 2px;">
            ${icon('x', 14)}
          </button>
        </div>
        <div class="row" style="gap: 8px; align-items: center; font-size: 11px; color: var(--muted); flex-wrap: wrap;">
          <label style="display: flex; align-items: center; gap: 3px;">
            <span>X:</span>
            <input type="number" class="inp-comp-x" data-comp-id="${c.id}" value="${c.x}" min="2" max="${this.customWidth - 2}" step="1"
                   style="width: 50px; padding: 2px 4px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text); font-family: var(--mono); font-size: 11px;" />
            <span>mm</span>
          </label>
          <label style="display: flex; align-items: center; gap: 3px;">
            <span>Y:</span>
            <input type="number" class="inp-comp-y" data-comp-id="${c.id}" value="${c.y}" min="2" max="${this.customHeight - 2}" step="1"
                   style="width: 50px; padding: 2px 4px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text); font-family: var(--mono); font-size: 11px;" />
            <span>mm</span>
          </label>
          <label style="display: flex; align-items: center; gap: 3px;">
            <span>${isPl ? 'Kąt:' : 'Rot:'}</span>
            <select class="sel-comp-rot" data-comp-id="${c.id}"
                    style="padding: 2px 4px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text); font-family: var(--mono); font-size: 11px;">
              <option value="0" ${c.rotation === 0 ? 'selected' : ''}>0°</option>
              <option value="90" ${c.rotation === 90 ? 'selected' : ''}>90°</option>
              <option value="180" ${c.rotation === 180 ? 'selected' : ''}>180°</option>
              <option value="270" ${c.rotation === 270 ? 'selected' : ''}>270°</option>
            </select>
          </label>
        </div>
      </div>
    `;
  }

  private updatePreviewAndComponentsList(isPl: boolean) {
    const countBadge = this.el.querySelector('#placed-comps-count');
    if (countBadge) countBadge.textContent = String(this.placedComponents.length);

    this.updateSvgPreview();
    this.renderPlacedComponentsRows(isPl);
    this.updateTabBadge(isPl);
  }

  private renderPlacedComponentsRows(isPl: boolean) {
    const listEl = this.el.querySelector('#placed-comps-list');
    if (!listEl) return;
    listEl.innerHTML = this.renderPlacedComponentsRowsHtml(isPl);
    this.bindComponentRowEvents(listEl, isPl);
  }

  private bindComponentRowEvents(listEl: Element, isPl: boolean) {
    listEl.querySelectorAll('.btn-del-comp').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const compId = btn.getAttribute('data-comp-id');
        if (compId) this.deleteComponent(compId, isPl);
      });
    });

    listEl.querySelectorAll('.placed-comp-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.closest('button')) {
          return;
        }
        const compId = row.getAttribute('data-comp-id');
        if (compId) {
          this.selectedCompId = compId;
          this.highlightSelectedComponent();
        }
      });
    });

    listEl.querySelectorAll('.inp-comp-x').forEach((inp) => {
      inp.addEventListener('input', () => {
        const compId = inp.getAttribute('data-comp-id');
        const comp = this.placedComponents.find((c) => c.id === compId);
        if (comp) {
          comp.x = Math.max(0, Math.min(this.customWidth, Number((inp as HTMLInputElement).value) || 0));
          this.updateComponentSvgTransform(comp);
        }
      });
    });

    listEl.querySelectorAll('.inp-comp-y').forEach((inp) => {
      inp.addEventListener('input', () => {
        const compId = inp.getAttribute('data-comp-id');
        const comp = this.placedComponents.find((c) => c.id === compId);
        if (comp) {
          comp.y = Math.max(0, Math.min(this.customHeight, Number((inp as HTMLInputElement).value) || 0));
          this.updateComponentSvgTransform(comp);
        }
      });
    });

    listEl.querySelectorAll('.sel-comp-rot').forEach((sel) => {
      sel.addEventListener('change', () => {
        const compId = sel.getAttribute('data-comp-id');
        const comp = this.placedComponents.find((c) => c.id === compId);
        if (comp) {
          comp.rotation = (Number((sel as HTMLSelectElement).value) || 0) as 0 | 90 | 180 | 270;
          this.updateComponentSvgTransform(comp);
        }
      });
    });
  }

  private bindSvgInteractions() {
    const svg = this.el.querySelector('#pcb-svg-preview') as SVGSVGElement | null;
    if (!svg) return;

    let isDragging = false;
    let dragCompId: string | null = null;
    let startClientX = 0;
    let startClientY = 0;
    let initialX = 0;
    let initialY = 0;

    const hoverInfo = this.el.querySelector('#preview-hover-info');

    svg.addEventListener('mousedown', (e: MouseEvent) => {
      const compG = (e.target as Element).closest('.preview-comp') as SVGElement | null;
      if (!compG) {
        this.selectedCompId = null;
        this.highlightSelectedComponent();
        return;
      }
      const compId = compG.getAttribute('data-comp-id');
      if (!compId) return;
      const comp = this.placedComponents.find((c) => c.id === compId);
      if (!comp) return;

      isDragging = true;
      dragCompId = compId;
      this.selectedCompId = compId;
      this.highlightSelectedComponent();

      startClientX = e.clientX;
      startClientY = e.clientY;
      initialX = comp.x;
      initialY = comp.y;
      e.preventDefault();
    });

    this.onWindowMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragCompId) {
        const compG = (e.target as Element).closest?.('.preview-comp') as SVGElement | null;
        if (compG && hoverInfo) {
          const id = compG.getAttribute('data-comp-id');
          const c = this.placedComponents.find((p) => p.id === id);
          if (c) hoverInfo.textContent = `${c.ref} (${c.name}): [${c.x}, ${c.y}] mm`;
        } else if (hoverInfo && hoverInfo.textContent) {
          hoverInfo.textContent = '';
        }
        return;
      }

      const comp = this.placedComponents.find((c) => c.id === dragCompId);
      if (!comp) return;

      const rect = svg.getBoundingClientRect();
      const scaleX = this.customWidth / (rect.width || 1);
      const scaleY = this.customHeight / (rect.height || 1);

      const dx = (e.clientX - startClientX) * scaleX;
      const dy = (e.clientY - startClientY) * scaleY;

      const newX = Math.round(Math.max(2, Math.min(this.customWidth - 2, initialX + dx)));
      const newY = Math.round(Math.max(2, Math.min(this.customHeight - 2, initialY - dy)));

      if (newX !== comp.x || newY !== comp.y) {
        comp.x = newX;
        comp.y = newY;
        this.updateComponentSvgTransform(comp);

        const inpX = this.el.querySelector(`.inp-comp-x[data-comp-id="${comp.id}"]`) as HTMLInputElement | null;
        if (inpX && document.activeElement !== inpX) inpX.value = String(comp.x);
        const inpY = this.el.querySelector(`.inp-comp-y[data-comp-id="${comp.id}"]`) as HTMLInputElement | null;
        if (inpY && document.activeElement !== inpY) inpY.value = String(comp.y);

        if (hoverInfo) hoverInfo.textContent = `${comp.ref}: X=${comp.x} mm, Y=${comp.y} mm`;
      }
    };

    this.onWindowMouseUp = () => {
      isDragging = false;
      dragCompId = null;
    };

    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
  }

  private render() {
    const isPl = getLang() === 'pl';

    this.el.innerHTML = `
      <div class="modal" style="width: min(960px, 95vw); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;" role="dialog" aria-modal="true" aria-labelledby="creator-title">
        <!-- Header -->
        <div class="modal-head" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border);">
          <div class="row" style="gap: 10px; align-items: center;">
            <div style="color: var(--accent);">${icon('grid', 20)}</div>
            <div>
              <h2 id="creator-title" style="margin: 0; font-size: 17px; font-weight: 700;">
                ${isPl ? 'Kreator Płytek & Baza Komponentów PCBWay / LCSC' : 'Board Creator & PCBWay / LCSC Parts Database'}
              </h2>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
                ${isPl ? 'Projektuj obwody, rozmieszczaj części na laminacie, wstrzykuj usterki i eksportuj' : 'Design circuits, place parts interactively on PCB, inject faults, and export'}
              </div>
            </div>
          </div>
          <button class="btn ghost icon sm" id="btn-close-creator" title="Zamknij (Esc)" aria-label="Zamknij">
            ${icon('x', 14)}
          </button>
        </div>

        <!-- Navigation Tabs -->
        <div class="cat-toolbar" style="padding: 10px 18px; border-bottom: 1px solid var(--border); display: flex; gap: 8px;">
          <button class="btn sm ${this.activeTab === 'builder' ? 'primary' : 'ghost'}" id="tab-btn-builder">
            ${icon('grid', 14)}<span>${isPl ? 'Kreator Obwodów i Modyfikacji' : 'Circuit & Mod Builder'}${this.placedComponents.length ? ` (${this.placedComponents.length})` : ''}</span>
          </button>
          <button class="btn sm ${this.activeTab === 'catalog' ? 'primary' : 'ghost'}" id="tab-btn-catalog">
            ${icon('search', 14)}<span>${isPl ? 'Baza Części (PCBWay / LCSC / DigiKey)' : 'Parts Catalog (PCBWay / LCSC)'}</span>
          </button>
        </div>

        <!-- Tab Content Body -->
        <div id="creator-tab-content" style="padding: 18px; overflow-y: auto; flex: 1;">
          ${this.activeTab === 'builder' ? this.renderBuilderTab(isPl) : this.renderCatalogTab(isPl)}
        </div>
      </div>
    `;

    this.bindEvents(isPl);
  }

  private renderBuilderTab(isPl: boolean): string {
    return `
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <!-- 1. Board preset selector -->
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text);">
            ${isPl ? '1. Wybierz szablon startowy płytki lub modułu:' : '1. Select starting board or module template:'}
          </label>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
            <div class="card preset-card ${this.selectedPresetId === 'custom-blank' ? 'active-preset' : ''}"
                 data-preset="custom-blank"
                 style="cursor: pointer; padding: 12px; border: 1px solid ${this.selectedPresetId === 'custom-blank' ? 'var(--accent)' : 'var(--border)'}; background: var(--surface);">
              <div style="font-weight: 700; color: var(--accent); font-size: 14px;">+ ${isPl ? 'Czysty laminat PCB' : 'Blank Prototyping PCB'}</div>
              <p style="font-size: 12px; color: var(--text-2); margin: 4px 0 0;">${isPl ? 'Pusta płytka o zadanych wymiarach. Rozmieszczaj własne części od zera.' : 'Clean blank PCB board with custom dimensions. Place custom parts from scratch.'}</p>
            </div>
            ${BOARD_PRESETS.map((p) => `
              <div class="card preset-card ${this.selectedPresetId === p.id ? 'active-preset' : ''}"
                   data-preset="${p.id}"
                   style="cursor: pointer; padding: 12px; border: 1px solid ${this.selectedPresetId === p.id ? 'var(--accent)' : 'var(--border)'}; background: var(--surface);">
                <div style="font-weight: 700; color: var(--text); font-size: 14px;">${isPl ? p.titlePl : p.titleEn}</div>
                <p style="font-size: 12px; color: var(--text-2); margin: 4px 0 0;">${isPl ? p.descPl : p.descEn}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Board specifications -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; background: var(--surface); padding: 14px; border-radius: 8px; border: 1px solid var(--border);">
          <div>
            <label for="inp-board-w" style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px;">${isPl ? 'Szerokość płytki (mm)' : 'Board Width (mm)'}</label>
            <input type="number" id="inp-board-w" value="${this.customWidth}" min="30" max="250"
                   style="width: 100%; padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);" />
          </div>
          <div>
            <label for="inp-board-h" style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px;">${isPl ? 'Wysokość płytki (mm)' : 'Board Height (mm)'}</label>
            <input type="number" id="inp-board-h" value="${this.customHeight}" min="20" max="200"
                   style="width: 100%; padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);" />
          </div>
          <div>
            <label for="inp-board-color" style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px;">${isPl ? 'Kolor soldermaski' : 'Solder Mask Color'}</label>
            <select id="inp-board-color" style="width: 100%; padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);">
              <option value="#124422" ${this.customColor === '#124422' ? 'selected' : ''}>Zielony (Classic Green)</option>
              <option value="#0b2b40" ${this.customColor === '#0b2b40' ? 'selected' : ''}>Niebieski (Arduino Blue)</option>
              <option value="#40121a" ${this.customColor === '#40121a' ? 'selected' : ''}>Czerwony (SparkFun Red)</option>
              <option value="#301538" ${this.customColor === '#301538' ? 'selected' : ''}>Fioletowy (OSH Park Purple)</option>
              <option value="#16181b" ${this.customColor === '#16181b' ? 'selected' : ''}>Czarny matowy (Matte Black)</option>
            </select>
          </div>
          <div>
            <label for="inp-board-fault" style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px;">${isPl ? 'Wstrzyknij usterkę (do wyzwań)' : 'Inject Fault (Challenge Mode)'}</label>
            <select id="inp-board-fault" style="width: 100%; padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);">
              <option value="none" ${this.injectFault === 'none' ? 'selected' : ''}>${isPl ? 'Brak (Sprawna płyta)' : 'None (Working board)'}</option>
              <option value="short-rail" ${this.injectFault === 'short-rail' ? 'selected' : ''}>${isPl ? 'Zwarcie szyny zasilania (MLCC 0.2Ω)' : 'Power Rail Short (MLCC 0.2Ω)'}</option>
              <option value="cold-joint" ${this.injectFault === 'cold-joint' ? 'selected' : ''}>${isPl ? 'Zimny lut na rezystorze/zasilaniu' : 'Cold solder joint on resistor'}</option>
              <option value="reversed-diode" ${this.injectFault === 'reversed-diode' ? 'selected' : ''}>${isPl ? 'Odwrotnie wlutowana dioda' : 'Reversed diode polarity'}</option>
              <option value="blown-fuse" ${this.injectFault === 'blown-fuse' ? 'selected' : ''}>${isPl ? 'Przepalony bezpiecznik zasilania' : 'Blown input fuse'}</option>
            </select>
          </div>
        </div>

        <!-- 2 & 3. Interactive Preview & Placed Components Section -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; align-items: start;">
          <!-- Left Column: CAD Preview & Quick Add -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="row" style="justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: var(--text);">
                ${isPl ? '2. Interaktywny podgląd płytki CAD:' : '2. Interactive CAD Board Preview:'}
              </span>
              <span id="preview-dim-text" style="font-size: 11px; color: var(--muted); font-family: var(--mono);">
                ${this.customWidth} × ${this.customHeight} mm
              </span>
            </div>

            <!-- SVG Container -->
            <div id="pcb-preview-container" style="background: #090d16; border-radius: 8px; border: 1px solid var(--border); padding: 10px; display: flex; justify-content: center; align-items: center; min-height: 220px; max-height: 300px; overflow: hidden; position: relative; box-shadow: inset 0 2px 6px rgba(0,0,0,0.6);">
              ${this.renderSvgPreview()}
            </div>

            <!-- Live drag hint & hover info -->
            <div class="row" style="justify-content: space-between; align-items: center; font-size: 11px; color: var(--muted); min-height: 18px;">
              <span>${isPl ? '🖱️ Przeciągaj elementy myszą po laminacie' : '🖱️ Drag components with mouse to reposition'}</span>
              <span id="preview-hover-info" style="font-family: var(--mono); color: var(--accent); font-weight: 600;"></span>
            </div>

            <!-- Quick Add Bar -->
            <div style="background: var(--surface); padding: 12px; border-radius: 8px; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px;">
              <div style="font-size: 12px; font-weight: 600; color: var(--text);">
                ⚡ ${isPl ? 'Szybkie dodawanie popularnych elementów:' : 'Quick Add Popular Components:'}
              </div>
              <div class="row" style="gap: 6px; flex-wrap: wrap;">
                <button type="button" class="btn sm ghost btn-quick-add" data-kind="resistor" title="${isPl ? 'Dodaj rezystor SMD 0805 10kΩ' : 'Add SMD 0805 10kΩ resistor'}">
                  + R 10kΩ
                </button>
                <button type="button" class="btn sm ghost btn-quick-add" data-kind="capacitor" title="${isPl ? 'Dodaj kondensator 100nF' : 'Add 100nF MLCC capacitor'}">
                  + C 100nF
                </button>
                <button type="button" class="btn sm ghost btn-quick-add" data-kind="capacitor-bulk" title="${isPl ? 'Dodaj kondensator filtrujący 10µF' : 'Add 10µF filter capacitor'}">
                  + C 10µF
                </button>
                <button type="button" class="btn sm ghost btn-quick-add" data-kind="led" title="${isPl ? 'Dodaj diodę LED (Czerwona)' : 'Add indicator LED (Red)'}">
                  + LED
                </button>
                <button type="button" class="btn sm ghost btn-quick-add" data-kind="diode" title="${isPl ? 'Dodaj diodę Schottky SS34' : 'Add SS34 Schottky diode'}">
                  + D Schottky
                </button>
                <button type="button" class="btn sm ghost btn-quick-add" data-kind="ldo" title="${isPl ? 'Dodaj stabilizator AMS1117-3.3' : 'Add AMS1117-3.3 LDO'}">
                  + LDO 3.3V
                </button>
                <button type="button" class="btn sm ghost btn-quick-add" data-kind="fuse" title="${isPl ? 'Dodaj bezpiecznik 1A' : 'Add 1A polyfuse'}">
                  + Fuse 1A
                </button>
                <button type="button" class="btn sm ghost btn-quick-add" data-kind="header" title="${isPl ? 'Dodaj złącze zasilania USB 5V' : 'Add USB 5V header'}">
                  + USB 5V
                </button>
                <button type="button" class="btn sm primary" id="btn-browse-catalog-quick" style="margin-left: auto;">
                  ${icon('search', 14)}<span>${isPl ? 'Katalog Części...' : 'Parts Catalog...'}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Right Column: Placed Components List -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div class="row" style="justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: var(--text);">
                ${isPl ? '3. Rozmieszczone komponenty:' : '3. Placed Components:'}
                <span id="placed-comps-count" class="badge info" style="margin-left: 6px; font-size: 11px;">${this.placedComponents.length}</span>
              </span>
              <button type="button" class="btn ghost sm" id="btn-clear-components" style="font-size: 11px; padding: 2px 8px; color: var(--muted);">
                ${icon('x', 12)}<span>${isPl ? 'Wyczyść listę' : 'Clear all'}</span>
              </button>
            </div>

            <!-- Scrollable Components list -->
            <div id="placed-comps-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 420px; overflow-y: auto; padding-right: 4px;">
              ${this.renderPlacedComponentsRowsHtml(isPl)}
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 6px;">
          <button class="btn primary" id="btn-load-bench" style="justify-content: center; font-size: 14px;">
            ${icon('check', 16)}<span>${isPl ? 'Załaduj na stół warsztatowy' : 'Load onto Workbench'}</span>
          </button>
          <button class="btn ghost" id="btn-export-json" style="justify-content: center;">
            ${icon('download', 16)}<span>${isPl ? 'Pobierz (.pcbfix.json)' : 'Download (.pcbfix.json)'}</span>
          </button>
          <button class="btn ghost" id="btn-export-mod" style="justify-content: center;">
            ${icon('box', 16)}<span>${isPl ? 'Eksportuj jako Mod (.zip)' : 'Export as Mod (.zip)'}</span>
          </button>
        </div>
      </div>
    `;
  }

  private renderSvgPreview(): string {
    return `
      <svg id="pcb-svg-preview" viewBox="0 0 ${this.customWidth} ${this.customHeight}"
           style="width: 100%; max-height: 280px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));"
           xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pcb-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="0.4" fill="rgba(255,255,255,0.12)" />
          </pattern>
        </defs>

        <!-- Board Solder Mask Base -->
        <rect id="svg-board-rect" x="0" y="0" width="${this.customWidth}" height="${this.customHeight}" rx="2" ry="2" fill="${this.customColor}" stroke="#334155" stroke-width="0.5" />
        <rect x="0" y="0" width="${this.customWidth}" height="${this.customHeight}" fill="url(#pcb-grid)" />

        <!-- Silkscreen edge guideline -->
        <rect id="svg-silk-outline" x="1.5" y="1.5" width="${Math.max(1, this.customWidth - 3)}" height="${Math.max(1, this.customHeight - 3)}" rx="1" ry="1" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="0.25" stroke-dasharray="2,2" />

        <!-- Mounting holes -->
        <circle cx="3.5" cy="3.5" r="1.4" fill="#090d16" stroke="rgba(255,255,255,0.3)" stroke-width="0.3" />
        <circle id="svg-hole-tr" cx="${this.customWidth - 3.5}" cy="3.5" r="1.4" fill="#090d16" stroke="rgba(255,255,255,0.3)" stroke-width="0.3" />
        <circle id="svg-hole-bl" cx="3.5" cy="${this.customHeight - 3.5}" r="1.4" fill="#090d16" stroke="rgba(255,255,255,0.3)" stroke-width="0.3" />
        <circle id="svg-hole-br" cx="${this.customWidth - 3.5}" cy="${this.customHeight - 3.5}" r="1.4" fill="#090d16" stroke="rgba(255,255,255,0.3)" stroke-width="0.3" />

        <!-- Silkscreen Branding Title -->
        <text id="svg-board-title" x="${this.customWidth / 2}" y="3.8" text-anchor="middle" font-size="1.8" fill="rgba(255,255,255,0.7)" font-family="monospace" font-weight="bold">DEADBOARD · CUSTOM PCB</text>

        <!-- Components Layer -->
        <g id="svg-components-layer">
          ${this.placedComponents.map((c) => this.renderComponentSvg(c)).join('')}
        </g>
      </svg>
    `;
  }

  private renderPartsCards(parts: ComponentPart[], isPl: boolean): string {
    if (!parts.length) {
      return `
        <div style="grid-column: 1 / -1; padding: 32px 16px; text-align: center; color: var(--muted); background: var(--surface); border: 1px dashed var(--border); border-radius: 8px;">
          ${isPl ? 'Nie znaleziono komponentów pasujących do podanych kryteriów.' : 'No components found matching search criteria.'}
        </div>
      `;
    }

    return parts.map((p) => `
      <div class="card" style="padding: 12px; display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--border); background: var(--surface);">
        <div class="row" style="justify-content: space-between; align-items: flex-start;">
          <div>
            <span style="font-weight: 700; font-family: var(--mono); color: var(--accent); font-size: 14px;">${p.mpn}</span>
            <div style="font-size: 11px; color: var(--muted);">${p.manufacturer}</div>
          </div>
          <span class="badge info" style="font-size: 11px;">${p.pkg}</span>
        </div>
        <div style="font-size: 13px; font-weight: 600; color: var(--text);">
          ${isPl ? p.namePl : p.nameEn}
        </div>
        <p style="font-size: 12px; color: var(--text-2); margin: 0; line-height: 1.35; flex: 1;">
          ${isPl ? p.descPl : p.descEn}
        </p>
        <div style="font-size: 11px; font-family: var(--mono); color: var(--muted); display: grid; gap: 2px; margin-top: 4px; background: var(--bg); padding: 6px 8px; border-radius: 4px;">
          <div><b>LCSC:</b> ${p.lcsc} · <b>PCBWay:</b> ${p.pcbwayPart}</div>
          <div><b>${isPl ? 'Parametry:' : 'Params:'}</b> ${p.voltage}</div>
          <div><b>${isPl ? 'Prąd:' : 'Current:'}</b> ${p.current}</div>
        </div>
        <button type="button" class="btn sm primary btn-add-part" data-part-id="${p.id}" style="margin-top: 8px; justify-content: center;">
          ${icon('plus', 14)}<span>${isPl ? 'Dodaj do płytki' : 'Add to Board'}</span>
        </button>
      </div>
    `).join('');
  }

  private renderCatalogTab(isPl: boolean): string {
    const parts = searchSupplierParts(this.searchQuery, this.selectedCategory);

    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Filters bar -->
        <div class="row" style="gap: 10px; flex-wrap: wrap;">
          <input type="text" id="catalog-search" placeholder="${isPl ? 'Szukaj po symbolu (np. ESP32, AMS1117, RP2040, C15849)...' : 'Search part number (e.g. ESP32, AMS1117, RP2040, C15849)...'}"
                 value="${this.searchQuery}" style="flex: 1; min-width: 200px; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);" />
          <select id="catalog-category" style="padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);">
            <option value="all" ${this.selectedCategory === 'all' ? 'selected' : ''}>${isPl ? 'Wszystkie kategorie' : 'All Categories'}</option>
            <option value="modules" ${this.selectedCategory === 'modules' ? 'selected' : ''}>${isPl ? 'Moduły MCU (ESP32, Pico, Arduino)' : 'MCU Modules (ESP32, Pico, Arduino)'}</option>
            <option value="power" ${this.selectedCategory === 'power' ? 'selected' : ''}>${isPl ? 'Zasilanie i regulatory (LDO, Buck)' : 'Power Regulators (LDO, Buck)'}</option>
            <option value="transistors" ${this.selectedCategory === 'transistors' ? 'selected' : ''}>${isPl ? 'Tranzystory MOSFET' : 'MOSFET Transistors'}</option>
            <option value="diodes" ${this.selectedCategory === 'diodes' ? 'selected' : ''}>${isPl ? 'Diody i ochrona ESD' : 'Diodes & ESD Protection'}</option>
            <option value="interface" ${this.selectedCategory === 'interface' ? 'selected' : ''}>${isPl ? 'Układy interfejsowe i Flash' : 'Interface ICs & Flash'}</option>
            <option value="passives" ${this.selectedCategory === 'passives' ? 'selected' : ''}>${isPl ? 'Elementy pasywne (R, C, Bezpieczniki)' : 'Passives (R, C, Fuses)'}</option>
          </select>
        </div>

        <div id="catalog-parts-count" style="font-size: 13px; color: var(--muted);">
          ${isPl ? `Znaleziono ${parts.length} komponentów z oznaczeniami PCBWay i LCSC:` : `Found ${parts.length} supplier components with PCBWay & LCSC part numbers:`}
        </div>

        <!-- Parts list -->
        <div id="catalog-parts-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; max-height: 480px; overflow-y: auto;">
          ${this.renderPartsCards(parts, isPl)}
        </div>
      </div>
    `;
  }

  private updateCatalogGrid(isPl: boolean) {
    const parts = searchSupplierParts(this.searchQuery, this.selectedCategory);
    const countEl = this.el.querySelector('#catalog-parts-count');
    if (countEl) {
      countEl.textContent = isPl
        ? `Znaleziono ${parts.length} komponentów z oznaczeniami PCBWay i LCSC:`
        : `Found ${parts.length} supplier components with PCBWay & LCSC part numbers:`;
    }
    const gridEl = this.el.querySelector('#catalog-parts-grid');
    if (gridEl) {
      gridEl.innerHTML = this.renderPartsCards(parts, isPl);
      this.bindCatalogAddButtons(isPl);
    }
  }

  private bindCatalogAddButtons(isPl: boolean) {
    this.el.querySelectorAll('.btn-add-part').forEach((btn) => {
      btn.addEventListener('click', () => {
        const partId = btn.getAttribute('data-part-id');
        if (partId) this.addPartToBoard(partId, isPl);
      });
    });
  }

  private generateScenario(): Scenario {
    return buildCustomScenario({
      presetId: this.selectedPresetId,
      width: this.customWidth,
      height: this.customHeight,
      color: this.customColor,
      placedComponents: this.placedComponents,
      fault: this.injectFault,
    });
  }

  private bindEvents(isPl: boolean) {
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });

    this.el.querySelector('#btn-close-creator')?.addEventListener('click', () => this.close());

    this.el.querySelector('#tab-btn-builder')?.addEventListener('click', () => {
      this.activeTab = 'builder';
      this.render();
    });

    this.el.querySelector('#tab-btn-catalog')?.addEventListener('click', () => {
      this.activeTab = 'catalog';
      this.render();
    });

    this.el.querySelectorAll('.preset-card').forEach((card) => {
      card.addEventListener('click', () => {
        const pId = card.getAttribute('data-preset');
        if (pId) {
          this.loadPreset(pId);
          this.render();
        }
      });
    });

    // Custom board inputs with live preview updates
    const inpW = this.el.querySelector('#inp-board-w') as HTMLInputElement | null;
    inpW?.addEventListener('input', () => {
      this.customWidth = Math.max(30, Math.min(250, Number(inpW.value) || 80));
      this.updateSvgPreview();
    });

    const inpH = this.el.querySelector('#inp-board-h') as HTMLInputElement | null;
    inpH?.addEventListener('input', () => {
      this.customHeight = Math.max(20, Math.min(200, Number(inpH.value) || 50));
      this.updateSvgPreview();
    });

    const inpColor = this.el.querySelector('#inp-board-color') as HTMLSelectElement | null;
    inpColor?.addEventListener('change', () => {
      this.customColor = inpColor.value;
      this.updateSvgPreview();
    });

    const inpFault = this.el.querySelector('#inp-board-fault') as HTMLSelectElement | null;
    inpFault?.addEventListener('change', () => {
      this.injectFault = inpFault.value as FaultKind;
    });

    // Quick add buttons
    this.el.querySelectorAll('.btn-quick-add').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.getAttribute('data-kind');
        if (kind) this.handleQuickAdd(kind, isPl);
      });
    });

    this.el.querySelector('#btn-browse-catalog-quick')?.addEventListener('click', () => {
      this.activeTab = 'catalog';
      this.render();
    });

    this.el.querySelector('#btn-clear-components')?.addEventListener('click', () => {
      if (this.placedComponents.length === 0) return;
      this.placedComponents = [];
      this.selectedCompId = null;
      this.updatePreviewAndComponentsList(isPl);
      this.opts.toast(isPl ? 'Wyczyszczono wszystkie komponenty z płytki.' : 'Cleared all components from board.', 'info');
    });

    // Placed components list events
    const listEl = this.el.querySelector('#placed-comps-list');
    if (listEl) this.bindComponentRowEvents(listEl, isPl);

    // SVG Dragging & Tooltip Interactions
    this.bindSvgInteractions();

    // Catalog search & filter with retained focus
    const catSearch = this.el.querySelector('#catalog-search') as HTMLInputElement | null;
    catSearch?.addEventListener('input', () => {
      this.searchQuery = catSearch.value;
      this.updateCatalogGrid(isPl);
    });

    const catSelect = this.el.querySelector('#catalog-category') as HTMLSelectElement | null;
    catSelect?.addEventListener('change', () => {
      this.selectedCategory = catSelect.value;
      this.updateCatalogGrid(isPl);
    });

    this.bindCatalogAddButtons(isPl);

    // Action: Load on Bench
    this.el.querySelector('#btn-load-bench')?.addEventListener('click', () => {
      const sc = this.generateScenario();
      this.opts.onLoadScenario(sc);
      this.opts.toast(isPl ? `Płytka "${sc.meta.title}" załadowana na stół warsztatowy!` : `Loaded "${sc.meta.title}" on the bench!`, 'success');
      this.close();
    });

    // Action: Export JSON
    this.el.querySelector('#btn-export-json')?.addEventListener('click', () => {
      const sc = this.generateScenario();
      const blob = new Blob([JSON.stringify(sc, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sc.id}.pcbfix.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.opts.toast(isPl ? `Pobrano plik ${sc.id}.pcbfix.json` : `Downloaded ${sc.id}.pcbfix.json`, 'success');
    });

    // Action: Export Mod
    this.el.querySelector('#btn-export-mod')?.addEventListener('click', async () => {
      const sc = this.generateScenario();
      const manifest = {
        name: sc.meta.title,
        id: sc.id,
        author: sc.meta.author,
        version: '1.0.0',
        license: sc.meta.license || 'Apache-2.0',
        boards: [
          {
            id: sc.id,
            file: `boards/${sc.id}.pcbfix.json`,
            title: sc.meta.title,
            description: sc.meta.description
          }
        ]
      };
      const jsonText = JSON.stringify(sc, null, 2);
      const manifestText = JSON.stringify(manifest, null, 2);

      try {
        const zipBytes = await writeZip([
          ['mod.json', new TextEncoder().encode(manifestText)],
          [`boards/${sc.id}.pcbfix.json`, new TextEncoder().encode(jsonText)]
        ]);
        const blob = new Blob([zipBytes as BlobPart], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sc.id}-mod.zip`;
        a.click();
        URL.revokeObjectURL(url);
        this.opts.toast(isPl ? `Pobrano paczkę moda ${sc.id}-mod.zip!` : `Exported mod ${sc.id}-mod.zip!`, 'success');
      } catch {
        const blob = new Blob([jsonText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sc.id}.pcbfix.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.opts.toast(isPl ? `Pobrano plik ${sc.id}.pcbfix.json` : `Downloaded ${sc.id}.pcbfix.json`, 'success');
      }
    });
  }
}
