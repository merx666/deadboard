// LiveBoard Studio: Interactive Custom Board Builder & Supplier Parts Catalog (PCBWay / LCSC / DigiKey)
import { searchSupplierParts, SUPPLIER_PARTS, type ComponentPart } from '../parts/catalog';
import { BOARD_PRESETS } from '../boards/presets';
import { Builder } from '../scenarios/builder';
import type { Scenario, Component, Pad, V2, Board } from '../types';
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

export interface PartPricing {
  unitPriceUsd: number;
  lcsc: string;
  pcbway: string;
}

/** Footprint calculation preserving API compatibility with existing tests and builders */
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
  if (comp.ref.startsWith('R')) return { w: 2.0, h: 1.25, padsCount: 2, shape: 'box' };
  if (comp.ref.startsWith('C')) return { w: 2.0, h: 1.25, padsCount: 2, shape: 'box' };
  if (comp.ref.startsWith('LED')) return { w: 3.5, h: 3.5, padsCount: 2, shape: 'led' };
  if (comp.ref.startsWith('D')) return { w: 4.5, h: 2.5, padsCount: 2, shape: 'diode' };
  if (comp.ref.startsWith('J')) return { w: 5.0, h: 8.0, padsCount: 2, shape: 'header' };
  if (comp.ref.startsWith('SW')) return { w: 6.0, h: 6.0, padsCount: 4, shape: 'tactile' };
  if (comp.ref.startsWith('F')) return { w: 3.2, h: 1.6, padsCount: 2, shape: 'fuse' };
  if (comp.ref.startsWith('TP')) return { w: 2.5, h: 2.5, padsCount: 1, shape: 'pin' };
  if (comp.ref.startsWith('U')) return { w: 12.0, h: 16.0, padsCount: 8, shape: 'chip' };
  return { w: 8.0, h: 8.0, padsCount: 2, shape: 'box' };
}

/** Standard EIA 3-digit marking code for SMD resistors */
export function getResistorCode(val?: number): string {
  if (val === undefined || isNaN(val)) return '103';
  if (val === 0) return '000';
  if (val < 10) return `${val}R0`.replace('.', 'R');
  if (val < 100) return `${Math.round(val)}R`.replace('.0R', 'R');
  const str = Math.round(val).toString();
  const digits = str.substring(0, 2);
  const zeros = str.length - 2;
  return `${digits}${zeros}`;
}

/** Estimate component cost from parts catalog */
export function getPartEstimatedCost(partId: string, comp: PlacedComponent): PartPricing {
  const part = SUPPLIER_PARTS.find((p) => p.id === partId);
  const lcsc = part?.lcsc || 'C-GENERIC';
  const pcbway = part?.pcbwayPart || 'PCBWAY-GENERIC';
  const idLow = (partId + ' ' + comp.ref + ' ' + comp.name).toLowerCase();

  if (idLow.includes('esp32')) {
    return { unitPriceUsd: 2.85, lcsc, pcbway };
  }
  if (idLow.includes('pico') || idLow.includes('rp2040')) {
    return { unitPriceUsd: 3.90, lcsc, pcbway };
  }
  if (idLow.includes('zero 2 w') || idLow.includes('zero2w')) {
    return { unitPriceUsd: 15.00, lcsc, pcbway };
  }
  if (idLow.includes('atmega328p')) {
    return { unitPriceUsd: 2.20, lcsc, pcbway };
  }
  if (idLow.includes('stm32f103')) {
    return { unitPriceUsd: 1.95, lcsc, pcbway };
  }
  if (idLow.includes('ams1117') || idLow.includes('ldo')) {
    return { unitPriceUsd: 0.18, lcsc, pcbway };
  }
  if (idLow.includes('tps54302') || idLow.includes('buck') || idLow.includes('rt6150')) {
    return { unitPriceUsd: 0.65, lcsc, pcbway };
  }
  if (idLow.includes('w25q') || idLow.includes('flash')) {
    return { unitPriceUsd: 0.85, lcsc, pcbway };
  }
  if (idLow.includes('usb-c') || idLow.includes('type-c')) {
    return { unitPriceUsd: 0.32, lcsc, pcbway };
  }
  if (idLow.includes('ch340')) {
    return { unitPriceUsd: 0.48, lcsc, pcbway };
  }
  if (idLow.includes('tp4056')) {
    return { unitPriceUsd: 0.22, lcsc, pcbway };
  }
  if (idLow.includes('header')) {
    return { unitPriceUsd: 0.15, lcsc, pcbway };
  }
  if (idLow.includes('switch') || idLow.includes('tactile')) {
    return { unitPriceUsd: 0.10, lcsc, pcbway };
  }
  if (comp.ref.startsWith('R') || idLow.includes('resistor')) {
    return { unitPriceUsd: 0.02, lcsc, pcbway };
  }
  if (comp.ref.startsWith('C') || idLow.includes('capacitor') || idLow.includes('mlcc')) {
    return { unitPriceUsd: idLow.includes('10u') ? 0.05 : 0.02, lcsc, pcbway };
  }
  if (comp.ref.startsWith('LED') || idLow.includes('led')) {
    return { unitPriceUsd: 0.04, lcsc, pcbway };
  }
  if (comp.ref.startsWith('D') || idLow.includes('diode') || idLow.includes('ss34')) {
    return { unitPriceUsd: 0.08, lcsc, pcbway };
  }
  if (comp.ref.startsWith('F') || idLow.includes('fuse')) {
    return { unitPriceUsd: 0.12, lcsc, pcbway };
  }

  return { unitPriceUsd: 0.10, lcsc, pcbway };
}

/** Axis-aligned bounding box calculation accounting for 90/270 rotation */
export function getComponentBoundingBox(comp: PlacedComponent): { minX: number; maxX: number; minY: number; maxY: number; w: number; h: number } {
  const fp = getFootprint(comp.partId, comp);
  const isRotated = comp.rotation === 90 || comp.rotation === 270;
  const w = isRotated ? fp.h : fp.w;
  const h = isRotated ? fp.w : fp.h;
  return {
    minX: comp.x - w / 2,
    maxX: comp.x + w / 2,
    minY: comp.y - h / 2,
    maxY: comp.y + h / 2,
    w,
    h,
  };
}

/** Real-time collision detection across all placed PCB components */
export function detectCollisions(components: PlacedComponent[]): Set<string> {
  const colliding = new Set<string>();
  const boxes = components.map((c) => ({ id: c.id, box: getComponentBoundingBox(c) }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].box;
      const b = boxes[j].box;
      // Overlap condition with 0.4mm clearance tolerance
      if (a.minX < b.maxX - 0.4 && a.maxX > b.minX + 0.4 && a.minY < b.maxY - 0.4 && a.maxY > b.minY + 0.4) {
        colliding.add(boxes[i].id);
        colliding.add(boxes[j].id);
      }
    }
  }
  return colliding;
}

/** Snap coordinate to a specified grid pitch in mm (e.g. 0.5mm, 1.0mm, 2.54mm) */
export function snapToGrid(val: number, step: number): number {
  if (!step || step <= 0) return Math.round(val * 100) / 100;
  const snapped = Math.round(val / step) * step;
  return Math.round(snapped * 100) / 100;
}

export interface Airwire {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  net: string;
  color: string;
}

/** Calculate dynamic ratsnest airwires connecting pads that share nets across components */
export function calculateAirwires(board: Board): Airwire[] {
  const airwires: Airwire[] = [];
  const comps = board.components || [];
  if (comps.length < 2) return airwires;

  const netPads = new Map<string, Array<{ x: number; y: number; ref: string }>>();

  const addPad = (net: string, pos: V2, ref: string) => {
    const list = netPads.get(net) || [];
    list.push({ x: pos[0], y: pos[1], ref });
    netPads.set(net, list);
  };

  const pwr = comps.find((c) => c.kind === 'battery' || c.ref.startsWith('J'));

  for (const c of comps) {
    if (!c.pads) continue;
    for (const p of c.pads) {
      let r: V2 = [0, 0];
      try {
        r = rot(p.at, c.rot);
      } catch {
        r = [p.at[0], p.at[1]];
      }
      const worldPos: V2 = [c.at[0] + r[0], c.at[1] + r[1]];

      let net = p.net;
      if (!net) {
        if (c.pins?.['-'] === p.name || c.pins?.['K'] === p.name || (c === pwr && p.name === '2')) {
          net = 'GND';
        } else if (c.pins?.['+'] === p.name || (c === pwr && p.name === '1')) {
          net = 'VCC';
        } else if (p.name.toUpperCase().includes('GND')) {
          net = 'GND';
        } else if (
          p.name.toUpperCase().includes('VCC') ||
          p.name.toUpperCase().includes('3V3') ||
          p.name.toUpperCase().includes('5V')
        ) {
          net = 'VCC';
        } else if (c.kind === 'capacitor' && p.name === '2') {
          net = 'GND';
        } else if (c.kind === 'capacitor' && p.name === '1') {
          net = 'VCC';
        }
      }
      if (net) {
        addPad(net, worldPos, c.ref);
      }
    }
  }

  // Sequential signal interconnects between non-power components
  const otherComps = comps.filter((c) => c !== pwr);
  for (let i = 0; i + 1 < otherComps.length; i++) {
    const cA = otherComps[i];
    const cB = otherComps[i + 1];
    if (!cA.pads?.length || !cB.pads?.length) continue;
    const pA = cA.pads.find((p) => p.name === '2' || p.name === 'A') || cA.pads[cA.pads.length - 1];
    const pB = cB.pads.find((p) => p.name === '1') || cB.pads[0];
    if (pA && pB) {
      let rA: V2 = [0, 0];
      let rB: V2 = [0, 0];
      try {
        rA = rot(pA.at, cA.rot);
      } catch {
        rA = [pA.at[0], pA.at[1]];
      }
      try {
        rB = rot(pB.at, cB.rot);
      } catch {
        rB = [pB.at[0], pB.at[1]];
      }
      const posA: V2 = [cA.at[0] + rA[0], cA.at[1] + rA[1]];
      const posB: V2 = [cB.at[0] + rB[0], cB.at[1] + rB[1]];
      airwires.push({
        x1: posA[0],
        y1: posA[1],
        x2: posB[0],
        y2: posB[1],
        net: `NET_${cA.ref}_${cB.ref}`,
        color: '#fbbf24',
      });
    }
  }

  // Minimum Spanning Tree for each power / ground net
  for (const [net, pts] of netPads.entries()) {
    if (pts.length < 2) continue;

    const isGnd = net.toUpperCase().includes('GND');
    const isVcc =
      net.toUpperCase().includes('VCC') ||
      net.toUpperCase().includes('5V') ||
      net.toUpperCase().includes('3V3') ||
      net.toUpperCase().includes('VBUS');
    const color = isGnd ? '#38bdf8' : isVcc ? '#f87171' : '#fbbf24';

    const visited = new Set<number>([0]);
    while (visited.size < pts.length) {
      let bestDist = Infinity;
      let bestU = -1;
      let bestV = -1;

      for (const u of visited) {
        for (let v = 0; v < pts.length; v++) {
          if (!visited.has(v)) {
            const dx = pts[u].x - pts[v].x;
            const dy = pts[u].y - pts[v].y;
            const d = Math.hypot(dx, dy);
            if (d < bestDist) {
              bestDist = d;
              bestU = u;
              bestV = v;
            }
          }
        }
      }

      if (bestU >= 0 && bestV >= 0) {
        visited.add(bestV);
        airwires.push({
          x1: pts[bestU].x,
          y1: pts[bestU].y,
          x2: pts[bestV].x,
          y2: pts[bestV].y,
          net,
          color,
        });
      } else {
        break;
      }
    }
  }

  return airwires;
}

export interface DrcResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Design Rule Check (DRC) for PCB layout.
 * Verifies:
 * 1. Component overlap collisions (bounding box clearance < 0.4mm)
 * 2. Component edge clearance (< 1.0mm margin from PCB boundaries)
 * 3. Power and ground rail availability and routing
 */
export function checkDrc(board: Board): DrcResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const comps = board.components || [];

  // 1. Overlapping components
  const boxes = comps.map((c) => {
    const isRot = Math.abs(Math.sin((c.rot * Math.PI) / 180)) > 0.7;
    const bw = c.body?.w && c.body.w > 0 ? c.body.w : 2.0;
    const bh = c.body?.h && c.body.h > 0 ? c.body.h : 1.25;
    const w = isRot ? bh : bw;
    const h = isRot ? bw : bh;
    return {
      id: c.id,
      ref: c.ref,
      minX: c.at[0] - w / 2,
      maxX: c.at[0] + w / 2,
      minY: c.at[1] - h / 2,
      maxY: c.at[1] + h / 2,
      w,
      h,
    };
  });

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (
        a.minX < b.maxX - 0.4 &&
        a.maxX > b.minX + 0.4 &&
        a.minY < b.maxY - 0.4 &&
        a.maxY > b.minY + 0.4
      ) {
        errors.push(
          `Kolizja komponentów: ${a.ref} oraz ${b.ref} nakładają się na siebie (Component collision: ${a.ref} and ${b.ref} overlap)`
        );
      }
    }
  }

  // 2. Components placed too close to board edges (< 1.0 mm margin)
  const edgeMargin = 1.0;
  for (const b of boxes) {
    if (
      b.minX < edgeMargin ||
      b.minY < edgeMargin ||
      board.w - b.maxX < edgeMargin ||
      board.h - b.maxY < edgeMargin
    ) {
      errors.push(
        `Naruszenie marginesu krawędzi: Komponent ${b.ref} znajduje się zbyt blisko krawędzi płytki (< ${edgeMargin}mm) (Edge clearance violation: ${b.ref} is within ${edgeMargin}mm of board edge)`
      );
    }
  }

  // 3. Missing power or ground connection
  if (comps.length === 0) {
    warnings.push('Płytka nie zawiera żadnych komponentów (Board has no components)');
  } else {
    const hasPowerComponent = comps.some(
      (c) =>
        c.kind === 'battery' ||
        c.ref.startsWith('J') ||
        c.ref.toUpperCase().includes('USB') ||
        c.ref.toUpperCase().includes('DC') ||
        c.pins?.['+'] !== undefined
    );
    const hasPowerTrace = (board.traces || []).some(
      (t) =>
        t.net &&
        (t.net.toUpperCase().includes('VCC') ||
          t.net.toUpperCase().includes('VBUS') ||
          t.net.toUpperCase().includes('5V') ||
          t.net.toUpperCase().includes('3.3V') ||
          t.net.toUpperCase().includes('3V3') ||
          t.net.toUpperCase().includes('PWR'))
    );

    if (!hasPowerComponent && !hasPowerTrace) {
      errors.push(
        'Brak źródła zasilania (VCC / VBUS / 5V) na płytce (Missing power connection: board has no power source or VCC net)'
      );
    }

    const hasGroundTrace = (board.traces || []).some(
      (t) => t.net && (t.net.toUpperCase() === 'GND' || t.net.toUpperCase().includes('GND'))
    );
    const hasGroundPin = comps.some(
      (c) =>
        c.pins?.['-'] !== undefined ||
        c.pins?.['K'] !== undefined ||
        Object.keys(c.pins || {}).some((k) => k.toUpperCase().includes('GND'))
    );

    if (!hasGroundTrace && !hasGroundPin) {
      errors.push(
        'Brak masy (GND): brak sieci masy na płytce (Missing ground connection: board has no GND reference or return path)'
      );
    } else if (hasPowerComponent && comps.length > 1 && !hasGroundTrace) {
      warnings.push(
        'Brak poprowadzonej ścieżki masy (GND) pomiędzy komponentami (Ground net is not routed between components)'
      );
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/** Generate standard Bill of Materials (BOM) CSV ready for PCBWay and JLCPCB */
export function generateBomCsv(components: PlacedComponent[]): string {
  const lines = ['Item,Designator,Quantity,Part Number,Manufacturer,LCSC Part,PCBWay Part,Unit Price ($),Total ($)'];
  const grouped = new Map<string, { comp: PlacedComponent; refs: string[]; count: number }>();
  for (const c of components) {
    const key = c.partId + '_' + (c.value ?? 0);
    const existing = grouped.get(key);
    if (existing) {
      existing.refs.push(c.ref);
      existing.count++;
    } else {
      grouped.set(key, { comp: c, refs: [c.ref], count: 1 });
    }
  }

  let item = 1;
  for (const g of grouped.values()) {
    const part = SUPPLIER_PARTS.find((p) => p.id === g.comp.partId);
    const pricing = getPartEstimatedCost(g.comp.partId, g.comp);
    const mpn = part?.mpn || g.comp.name || g.comp.ref;
    const mfr = part?.manufacturer || 'Generic';
    const total = (pricing.unitPriceUsd * g.count).toFixed(2);
    lines.push(`${item++},"${g.refs.join(' ')}",${g.count},"${mpn}","${mfr}","${pricing.lcsc}","${pricing.pcbway}",$${pricing.unitPriceUsd.toFixed(2)},$${total}`);
  }
  return lines.join('\n');
}

/** Generate Pick-and-Place (CPL / Centroid) CSV ready for SMT automated assembly */
export function generateCplCsv(components: PlacedComponent[]): string {
  const lines = ['Designator,Mid X,Mid Y,Layer,Rotation'];
  for (const c of components) {
    lines.push(`"${c.ref}",${c.x.toFixed(2)},${c.y.toFixed(2)},Top,${c.rotation}`);
  }
  return lines.join('\n');
}

// ==========================================
// REALISTIC VECTOR SVG COMPONENT RENDERERS
// ==========================================

function renderEsp32Svg(w: number, h: number): { body: string; pads: string } {
  const antHeight = 5.8;
  const antTop = -h / 2;
  const shieldTop = antTop + antHeight + 0.4;
  const shieldBottom = h / 2 - 1.2;
  const shieldHeight = shieldBottom - shieldTop;

  const body = `
    <!-- Antenna Substrate -->
    <rect x="${-w / 2}" y="${antTop}" width="${w}" height="${antHeight}" rx="0.5" fill="#090d16" stroke="#1e293b" stroke-width="0.25" />
    <!-- Serpentine MIFA Antenna Trace (Gold) -->
    <path d="M ${-w / 2 + 2.4} ${antTop + 4.8} H ${w / 2 - 2.4} V ${antTop + 3.6} H ${-w / 2 + 3.8} V ${antTop + 2.4} H ${w / 2 - 2.4} V ${antTop + 1.2} H ${-w / 2 + 2.4}"
          fill="none" stroke="#f59e0b" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round" />
    <line x1="${-w / 2 + 2.4}" y1="${antTop + 4.8}" x2="${-w / 2 + 2.4}" y2="${antTop + 5.6}" stroke="#f59e0b" stroke-width="0.5" />
    <line x1="${-w / 2 + 5.4}" y1="${antTop + 4.8}" x2="${-w / 2 + 5.4}" y2="${antTop + 5.6}" stroke="#f59e0b" stroke-width="0.5" />
    <line x1="${-w / 2 + 0.8}" y1="${antTop + antHeight}" x2="${w / 2 - 0.8}" y2="${antTop + antHeight}" stroke="#e0e0e0" stroke-width="0.2" stroke-dasharray="1.2,0.8" />
    
    <!-- Metal RF Shield Can -->
    <rect x="${-w / 2 + 0.4}" y="${shieldTop}" width="${w - 0.8}" height="${shieldHeight}" rx="0.8" fill="#94a3b8" stroke="#64748b" stroke-width="0.3" />
    <!-- Shield Bevel Highlight -->
    <rect x="${-w / 2 + 0.8}" y="${shieldTop + 0.4}" width="${w - 1.6}" height="${shieldHeight - 0.8}" rx="0.6" fill="#cbd5e1" opacity="0.6" />
    <!-- Laser Markings -->
    <text x="0" y="${shieldTop + 3.8}" font-size="1.2" text-anchor="middle" fill="#0f172a" font-family="monospace" font-weight="900" letter-spacing="0.2">ESP32-WROOM-32</text>
    <text x="0" y="${shieldTop + 5.8}" font-size="0.8" text-anchor="middle" fill="#334155" font-family="monospace">FCC ID: 2AC7Z-ESPWROOM32</text>
    <text x="0" y="${shieldTop + 7.5}" font-size="0.75" text-anchor="middle" fill="#475569" font-family="monospace">Wi-Fi + BLE 4.2 · ESPRESSIF</text>
    <!-- Shield Ground Dimples -->
    <circle cx="${-w / 2 + 1.2}" cy="${shieldTop + 1.2}" r="0.3" fill="#64748b" />
    <circle cx="${w / 2 - 1.2}" cy="${shieldTop + 1.2}" r="0.3" fill="#64748b" />
    <circle cx="${-w / 2 + 1.2}" cy="${shieldBottom - 1.2}" r="0.3" fill="#64748b" />
    <circle cx="${w / 2 - 1.2}" cy="${shieldBottom - 1.2}" r="0.3" fill="#64748b" />
    <!-- Pin 1 Marker -->
    <circle cx="${-w / 2 + 1.2}" cy="${shieldTop + 2.5}" r="0.4" fill="#f59e0b" stroke="#ffffff" stroke-width="0.15" />
  `;

  // 38 castellated pads
  let pads = '';
  const leftCount = 14;
  const leftStart = shieldTop + 1.0;
  const leftEnd = shieldBottom - 0.5;
  const leftStep = (leftEnd - leftStart) / (leftCount - 1);
  for (let i = 0; i < leftCount; i++) {
    const py = leftStart + i * leftStep;
    pads += `<rect x="${-w / 2 - 0.8}" y="${py - 0.35}" width="1.0" height="0.7" rx="0.15" fill="#f59e0b" stroke="#d97706" stroke-width="0.1" />`;
    pads += `<rect x="${w / 2 - 0.2}" y="${py - 0.35}" width="1.0" height="0.7" rx="0.15" fill="#f59e0b" stroke="#d97706" stroke-width="0.1" />`;
  }
  const botCount = 10;
  const botStart = -w / 2 + 2.2;
  const botEnd = w / 2 - 2.2;
  const botStep = (botEnd - botStart) / (botCount - 1);
  for (let i = 0; i < botCount; i++) {
    const px = botStart + i * botStep;
    pads += `<rect x="${px - 0.35}" y="${h / 2 - 0.2}" width="0.7" height="1.0" rx="0.15" fill="#f59e0b" stroke="#d97706" stroke-width="0.1" />`;
  }

  return { body, pads };
}

function renderDip28Svg(w: number, h: number): { body: string; pads: string } {
  const bodyW = 7.6;
  const bodyH = h - 1.0;
  const body = `
    <!-- Socket Silkscreen Outline -->
    <rect x="${-w / 2 - 0.6}" y="${-h / 2 - 0.6}" width="${w + 1.2}" height="${h + 1.2}" rx="0.6" fill="none" stroke="#e0e0e0" stroke-width="0.25" />
    <path d="M -1.8 ${-h / 2 - 0.6} A 1.8 1.8 0 0 0 1.8 ${-h / 2 - 0.6}" fill="none" stroke="#e0e0e0" stroke-width="0.25" />
    <!-- IC Body (Black Textured Plastic) -->
    <rect x="${-bodyW / 2}" y="${-bodyH / 2}" width="${bodyW}" height="${bodyH}" rx="0.4" fill="#18181b" stroke="#27272a" stroke-width="0.3" />
    <!-- Orientation Notch at top -->
    <path d="M -1.6 ${-bodyH / 2} A 1.6 1.6 0 0 0 1.6 ${-bodyH / 2}" fill="#090d16" stroke="#27272a" stroke-width="0.2" />
    <!-- Pin 1 Dot -->
    <circle cx="${-bodyW / 2 + 1.2}" cy="${-bodyH / 2 + 2.0}" r="0.5" fill="#090d16" stroke="#3f3f46" stroke-width="0.15" />
    <!-- Laser Inscription -->
    <text x="0" y="-3" font-size="1.3" text-anchor="middle" fill="#e4e4e7" font-family="monospace" font-weight="bold" transform="rotate(-90, 0, -3)">ATMEGA328P-PU</text>
    <text x="0" y="7" font-size="0.9" text-anchor="middle" fill="#a1a1aa" font-family="monospace" transform="rotate(-90, 0, 7)">2134 PH · ARDUINO</text>
  `;

  let pads = '';
  const pinCountPerSide = 14;
  const pitch = 2.54;
  const totalSpan = (pinCountPerSide - 1) * pitch;
  const startY = -totalSpan / 2;

  for (let i = 0; i < pinCountPerSide; i++) {
    const py = startY + i * pitch;
    pads += `
      <rect x="${-w / 2}" y="${py - 0.35}" width="1.6" height="0.7" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />
      <circle cx="${-w / 2}" cy="${py}" r="0.9" fill="#c88b32" stroke="#f59e0b" stroke-width="0.2" />
      <circle cx="${-w / 2}" cy="${py}" r="0.4" fill="#070709" />
      <rect x="${w / 2 - 1.6}" y="${py - 0.35}" width="1.6" height="0.7" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />
      <circle cx="${w / 2}" cy="${py}" r="0.9" fill="#c88b32" stroke="#f59e0b" stroke-width="0.2" />
      <circle cx="${w / 2}" cy="${py}" r="0.4" fill="#070709" />
    `;
  }
  return { body, pads };
}

function renderPicoSvg(w: number, h: number): { body: string; pads: string } {
  const body = `
    <!-- Pico PCB Body (Raspberry Green) -->
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="1.8" fill="#15803d" stroke="#166534" stroke-width="0.4" />
    <!-- White Silkscreen Margin -->
    <rect x="${-w / 2 + 1.2}" y="${-h / 2 + 1.2}" width="${w - 2.4}" height="${h - 2.4}" rx="1.0" fill="none" stroke="#e0e0e0" stroke-width="0.25" stroke-dasharray="2,1" />
    <!-- 4 Corner Mounting Holes (2.1mm) -->
    <circle cx="${-w / 2 + 2.5}" cy="${-h / 2 + 2.5}" r="1.1" fill="#070709" stroke="#f59e0b" stroke-width="0.3" />
    <circle cx="${w / 2 - 2.5}" cy="${-h / 2 + 2.5}" r="1.1" fill="#070709" stroke="#f59e0b" stroke-width="0.3" />
    <circle cx="${-w / 2 + 2.5}" cy="${h / 2 - 2.5}" r="1.1" fill="#070709" stroke="#f59e0b" stroke-width="0.3" />
    <circle cx="${w / 2 - 2.5}" cy="${h / 2 - 2.5}" r="1.1" fill="#070709" stroke="#f59e0b" stroke-width="0.3" />

    <!-- MicroUSB Port at Top -->
    <rect x="-3.8" y="${-h / 2 - 1.2}" width="7.6" height="5.2" rx="0.8" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.3" />
    <rect x="-2.6" y="${-h / 2 - 1.2}" width="5.2" height="2.2" rx="0.5" fill="#0f172a" />

    <!-- RP2040 QFN in Center (Diamond 45° orientation) -->
    <g transform="translate(0, 3.5) rotate(45)">
      <rect x="-3.5" y="-3.5" width="7" height="7" rx="0.4" fill="#0f172a" stroke="#334155" stroke-width="0.25" />
      <circle cx="-2.4" cy="-2.4" r="0.4" fill="#64748b" />
      <text x="0" y="0.9" font-size="1.5" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-weight="900">RP2040</text>
    </g>

    <!-- BOOTSEL Pushbutton -->
    <rect x="-6.5" y="-9.5" width="3.2" height="3.2" rx="0.4" fill="#cbd5e1" stroke="#64748b" stroke-width="0.2" />
    <circle cx="-4.9" cy="-7.9" r="1.0" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.2" />
    <text x="-4.9" y="-5.4" font-size="0.8" text-anchor="middle" fill="#ffffff" font-family="monospace">BOOT</text>

    <!-- 12MHz Crystal -->
    <rect x="3.2" y="-9.5" width="3.2" height="2.5" rx="0.3" fill="#94a3b8" stroke="#64748b" stroke-width="0.2" />
    <text x="4.8" y="-7.8" font-size="0.75" text-anchor="middle" fill="#0f172a" font-family="monospace" font-weight="bold">12M</text>

    <!-- Flash Memory IC (SOIC-8) -->
    <rect x="-2.5" y="12.5" width="5" height="4.5" rx="0.3" fill="#18181b" stroke="#334155" stroke-width="0.2" />
    <text x="0" y="15.2" font-size="0.8" text-anchor="middle" fill="#94a3b8" font-family="monospace">W25Q16</text>

    <!-- Silkscreen Branding -->
    <text x="0" y="${-h / 2 + 8.5}" font-size="1.3" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="bold">Raspberry Pi Pico</text>
    <text x="0" y="${h / 2 - 5.5}" font-size="0.95" text-anchor="middle" fill="#d1fae5" font-family="monospace">RP2040 · 2020</text>
  `;

  let pads = '';
  const pinsPerSide = 20;
  const pitch = 2.54;
  const totalSpan = (pinsPerSide - 1) * pitch;
  const startY = -totalSpan / 2;

  for (let i = 0; i < pinsPerSide; i++) {
    const py = startY + i * pitch;
    pads += `
      <rect x="${-w / 2 - 0.2}" y="${py - 0.6}" width="1.6" height="1.2" rx="0.2" fill="#f59e0b" stroke="#d97706" stroke-width="0.1" />
      <circle cx="${-w / 2}" cy="${py}" r="0.5" fill="#070709" />
      <rect x="${w / 2 - 1.4}" y="${py - 0.6}" width="1.6" height="1.2" rx="0.2" fill="#f59e0b" stroke="#d97706" stroke-width="0.1" />
      <circle cx="${w / 2}" cy="${py}" r="0.5" fill="#070709" />
    `;
  }

  return { body, pads };
}

function renderUsbCSvg(w: number, h: number): { body: string; pads: string } {
  const body = `
    <!-- Metal Shield -->
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="0.8" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.3" />
    <!-- Structural mounting tabs -->
    <rect x="${-w / 2 - 1.0}" y="${-h / 2 + 1.5}" width="1.1" height="2.2" rx="0.2" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.15" />
    <rect x="${w / 2 - 0.1}" y="${-h / 2 + 1.5}" width="1.1" height="2.2" rx="0.2" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.15" />
    <!-- Receptacle Pill Hole -->
    <rect x="${-w / 2 + 1.2}" y="${-h / 2 + 0.6}" width="${w - 2.4}" height="3.2" rx="1.6" fill="#070709" stroke="#475569" stroke-width="0.25" />
    <!-- Center Contact Tongue -->
    <rect x="${-w / 2 + 2.2}" y="${-h / 2 + 1.8}" width="${w - 4.4}" height="0.8" rx="0.2" fill="#1e293b" />
    <line x1="${-w / 2 + 2.7}" y1="${-h / 2 + 2.2}" x2="${w / 2 - 2.7}" y2="${-h / 2 + 2.2}" stroke="#f59e0b" stroke-width="0.3" stroke-dasharray="0.35,0.25" />
    <text x="0" y="${h / 2 - 1.0}" font-size="0.85" text-anchor="middle" fill="#334155" font-family="monospace" font-weight="bold">USB-C</text>
  `;
  let pads = `
    <rect x="${-w / 2 - 1.2}" y="${-h / 2 + 1.4}" width="1.4" height="2.4" rx="0.3" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
    <rect x="${w / 2 - 0.2}" y="${-h / 2 + 1.4}" width="1.4" height="2.4" rx="0.3" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
  `;
  const pinCount = 12;
  const startX = -w / 2 + 1.8;
  const step = (w - 3.6) / (pinCount - 1);
  for (let i = 0; i < pinCount; i++) {
    const px = startX + i * step;
    pads += `<rect x="${px - 0.18}" y="${h / 2 - 0.4}" width="0.36" height="0.9" rx="0.1" fill="#f59e0b" />`;
  }
  return { body, pads };
}

function renderUsbBSvg(w: number, h: number): { body: string; pads: string } {
  const body = `
    <!-- Metal Shield Body (Square USB-B Receptacle) -->
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="0.8" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.3" />
    <!-- Solder side wings -->
    <rect x="${-w / 2 - 1.2}" y="-1.5" width="1.3" height="3.0" rx="0.2" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.15" />
    <rect x="${w / 2 - 0.1}" y="-1.5" width="1.3" height="3.0" rx="0.2" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.15" />
    <!-- Opening Chamber -->
    <rect x="${-w / 2 + 1.5}" y="${-h / 2 + 1.5}" width="${w - 3.0}" height="${h - 3.0}" rx="0.5" fill="#090d16" stroke="#475569" stroke-width="0.25" />
    <!-- Central Plastic Tongue with 4 Contacts -->
    <rect x="-2.2" y="-2.2" width="4.4" height="4.4" rx="0.3" fill="#1e293b" />
    <circle cx="-1.1" cy="-1.1" r="0.35" fill="#f59e0b" />
    <circle cx="1.1" cy="-1.1" r="0.35" fill="#f59e0b" />
    <circle cx="-1.1" cy="1.1" r="0.35" fill="#f59e0b" />
    <circle cx="1.1" cy="1.1" r="0.35" fill="#f59e0b" />
    <text x="0" y="${h / 2 - 0.6}" font-size="0.9" text-anchor="middle" fill="#334155" font-family="monospace" font-weight="bold">USB-B</text>
  `;
  const pads = `
    <circle cx="${-w / 2 - 0.5}" cy="0" r="1.1" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
    <circle cx="${-w / 2 - 0.5}" cy="0" r="0.6" fill="#070709" />
    <circle cx="${w / 2 + 0.5}" cy="0" r="1.1" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
    <circle cx="${w / 2 + 0.5}" cy="0" r="0.6" fill="#070709" />
  `;
  return { body, pads };
}

function renderDcJackSvg(w: number, h: number): { body: string; pads: string } {
  const body = `
    <!-- DC Barrel Jack Housing (Black Plastic) -->
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="0.8" fill="#18181b" stroke="#334155" stroke-width="0.3" />
    <!-- Front Circular Jack Opening -->
    <circle cx="0" cy="${-h / 2 + 4.5}" r="3.2" fill="#090d16" stroke="#475569" stroke-width="0.3" />
    <!-- Central 2.1mm Brass Pin -->
    <circle cx="0" cy="${-h / 2 + 4.5}" r="1.05" fill="#f59e0b" stroke="#d97706" stroke-width="0.2" />
    <path d="M 2.4 ${-h / 2 + 3.0} Q 1.8 ${-h / 2 + 4.5} 2.4 ${-h / 2 + 6.0}" fill="none" stroke="#cbd5e1" stroke-width="0.4" />
    <text x="0" y="${h / 2 - 1.5}" font-size="0.9" text-anchor="middle" fill="#64748b" font-family="monospace" font-weight="bold">2.1mm DC</text>
  `;
  const pads = `
    <circle cx="0" cy="${h / 2 - 1.0}" r="1.1" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
    <circle cx="0" cy="${h / 2 - 1.0}" r="0.5" fill="#070709" />
    <circle cx="${-w / 2 + 1.2}" cy="1.0" r="1.1" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
    <circle cx="${-w / 2 + 1.2}" cy="1.0" r="0.5" fill="#070709" />
    <circle cx="${w / 2 - 1.2}" cy="1.0" r="1.1" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
    <circle cx="${w / 2 - 1.2}" cy="1.0" r="0.5" fill="#070709" />
  `;
  return { body, pads };
}

function renderTactileSwitchSvg(w: number, h: number): { body: string; pads: string } {
  const body = `
    <!-- Silver Base Plate -->
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="0.6" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.3" />
    <!-- Corner Rivets -->
    <circle cx="${-w / 2 + 0.8}" cy="${-h / 2 + 0.8}" r="0.35" fill="#64748b" />
    <circle cx="${w / 2 - 0.8}" cy="${-h / 2 + 0.8}" r="0.35" fill="#64748b" />
    <circle cx="${-w / 2 + 0.8}" cy="${h / 2 - 0.8}" r="0.35" fill="#64748b" />
    <circle cx="${w / 2 - 0.8}" cy="${h / 2 - 0.8}" r="0.35" fill="#64748b" />
    <!-- Actuator Well -->
    <circle cx="0" cy="0" r="${w / 3.0}" fill="#475569" stroke="#334155" stroke-width="0.2" />
    <!-- Central Button Actuator -->
    <circle cx="0" cy="0" r="${w / 4.2}" fill="#0284c7" stroke="#38bdf8" stroke-width="0.25" />
    <circle cx="-0.3" cy="-0.3" r="${w / 8.0}" fill="#7dd3fc" opacity="0.6" />
  `;
  const pads = `
    <!-- 4 Solder Legs -->
    <rect x="${-w / 2 - 1.0}" y="${-h / 2 + 0.6}" width="1.2" height="1.0" rx="0.2" fill="#f59e0b" stroke="#d97706" stroke-width="0.1" />
    <rect x="${-w / 2 - 1.0}" y="${h / 2 - 1.6}" width="1.2" height="1.0" rx="0.2" fill="#f59e0b" stroke="#d97706" stroke-width="0.1" />
    <rect x="${w / 2 - 0.2}" y="${-h / 2 + 0.6}" width="1.2" height="1.0" rx="0.2" fill="#f59e0b" stroke="#d97706" stroke-width="0.1" />
    <rect x="${w / 2 - 0.2}" y="${h / 2 - 1.6}" width="1.2" height="1.0" rx="0.2" fill="#f59e0b" stroke="#d97706" stroke-width="0.1" />
  `;
  return { body, pads };
}

function renderResistor0805Svg(w: number, h: number, val?: number): { body: string; pads: string } {
  const code = getResistorCode(val);
  const termW = 0.45;
  const body = `
    <!-- Black Ceramic Resistor Body -->
    <rect x="${-w / 2 + termW}" y="${-h / 2}" width="${w - termW * 2}" height="${h}" rx="0.1" fill="#18181b" stroke="#27272a" stroke-width="0.1" />
    <!-- White Silkscreen EIA-96 / 3-digit Code -->
    <text x="0" y="0.32" text-anchor="middle" font-size="0.65" fill="#f8fafc" font-family="monospace" font-weight="900" letter-spacing="-0.05">${code}</text>
  `;
  const pads = `
    <!-- Silver End Termination Caps & Solder Pads -->
    <rect x="${-w / 2 - 0.35}" y="${-h / 2 - 0.15}" width="${termW + 0.4}" height="${h + 0.3}" rx="0.15" fill="#c88b32" stroke="#f59e0b" stroke-width="0.1" />
    <rect x="${-w / 2}" y="${-h / 2}" width="${termW}" height="${h}" rx="0.1" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />
    <rect x="${w / 2 - termW - 0.05}" y="${-h / 2 - 0.15}" width="${termW + 0.4}" height="${h + 0.3}" rx="0.15" fill="#c88b32" stroke="#f59e0b" stroke-width="0.1" />
    <rect x="${w / 2 - termW}" y="${-h / 2}" width="${termW}" height="${h}" rx="0.1" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />
  `;
  return { body, pads };
}

function renderCapacitor0805Svg(w: number, h: number): { body: string; pads: string } {
  const termW = 0.45;
  const body = `
    <!-- Tan / Caramel MLCC Ceramic Body -->
    <rect x="${-w / 2 + termW}" y="${-h / 2}" width="${w - termW * 2}" height="${h}" rx="0.1" fill="#b45309" stroke="#78350f" stroke-width="0.1" />
    <!-- Ceramic shine highlight -->
    <rect x="${-w / 2 + termW}" y="${-h / 2 + 0.15}" width="${w - termW * 2}" height="${h * 0.25}" rx="0.05" fill="#d97706" opacity="0.6" />
  `;
  const pads = `
    <!-- Silver End Termination Caps & Solder Pads -->
    <rect x="${-w / 2 - 0.35}" y="${-h / 2 - 0.15}" width="${termW + 0.4}" height="${h + 0.3}" rx="0.15" fill="#c88b32" stroke="#f59e0b" stroke-width="0.1" />
    <rect x="${-w / 2}" y="${-h / 2}" width="${termW}" height="${h}" rx="0.1" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />
    <rect x="${w / 2 - termW - 0.05}" y="${-h / 2 - 0.15}" width="${termW + 0.4}" height="${h + 0.3}" rx="0.15" fill="#c88b32" stroke="#f59e0b" stroke-width="0.1" />
    <rect x="${w / 2 - termW}" y="${-h / 2}" width="${termW}" height="${h}" rx="0.1" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />
  `;
  return { body, pads };
}

function renderLedSvg(w: number, h: number, name: string): { body: string; pads: string } {
  let color = '#ef4444';
  let glow = '#f87171';
  const nameLow = name.toLowerCase();
  if (nameLow.includes('green') || nameLow.includes('zielon')) {
    color = '#22c55e';
    glow = '#4ade80';
  } else if (nameLow.includes('blue') || nameLow.includes('niebiesk')) {
    color = '#3b82f6';
    glow = '#60a5fa';
  } else if (nameLow.includes('yellow') || nameLow.includes('żółt')) {
    color = '#eab308';
    glow = '#facc15';
  }

  const radius = Math.min(w, h) / 2;
  const body = `
    <!-- Cathode Silk Notch Line -->
    <line x1="${-radius - 0.5}" y1="${-radius}" x2="${-radius - 0.5}" y2="${radius}" stroke="#22c55e" stroke-width="0.3" />
    <!-- Colored Lens Dome with Flat Cathode Side -->
    <path d="M ${-radius * 0.7} ${-radius} A ${radius} ${radius} 0 1 1 ${-radius * 0.7} ${radius} Z" fill="${color}" stroke="${glow}" stroke-width="0.25" opacity="0.9" />
    <!-- Lens Highlight -->
    <circle cx="0.4" cy="-0.4" r="${radius * 0.35}" fill="#ffffff" opacity="0.5" />
    <!-- Internal Leadframe Anvil & Post -->
    <path d="M ${-radius * 0.4} -0.5 L 0 0 L ${-radius * 0.4} 0.5 Z" fill="#e2e8f0" opacity="0.7" />
  `;
  const pads = `
    <!-- Cathode Square Pad (Pin 1) -->
    <rect x="${-w / 2 - 0.8}" y="-0.6" width="1.0" height="1.2" rx="0.1" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
    <!-- Anode Round Pad (Pin 2) -->
    <circle cx="${w / 2 + 0.3}" cy="0" r="0.6" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
    <circle cx="${w / 2 + 0.3}" cy="0" r="0.25" fill="#070709" />
  `;
  return { body, pads };
}

function renderDiodeSvg(w: number, h: number): { body: string; pads: string } {
  const body = `
    <!-- Diode Body -->
    <rect x="${-w * 0.35}" y="${-h * 0.4}" width="${w * 0.7}" height="${h * 0.8}" rx="0.2" fill="#111827" stroke="#374151" stroke-width="0.2" />
    <!-- White Cathode Line -->
    <line x1="${w * 0.18}" y1="${-h * 0.4}" x2="${w * 0.18}" y2="${h * 0.4}" stroke="#ffffff" stroke-width="0.5" />
  `;
  const pads = `
    <rect x="${-w / 2}" y="${-h * 0.45}" width="${w * 0.25}" height="${h * 0.9}" rx="0.15" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
    <rect x="${w / 2 - w * 0.25}" y="${-h * 0.45}" width="${w * 0.25}" height="${h * 0.9}" rx="0.15" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
  `;
  return { body, pads };
}

function renderSot223Svg(_w: number, h: number): { body: string; pads: string } {
  const bodyW = 6.5;
  const bodyH = 3.5;
  const body = `
    <!-- SOT-223 Plastic Package -->
    <rect x="${-bodyW / 2}" y="${-bodyH / 2}" width="${bodyW}" height="${bodyH}" rx="0.3" fill="#18181b" stroke="#334155" stroke-width="0.2" />
    <!-- Laser Engraved Part Marking -->
    <text x="0" y="0.5" font-size="0.9" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-weight="bold">AMS1117-3.3</text>
  `;
  const pads = `
    <!-- Large Heatsink Tab on Top (VOUT) -->
    <rect x="-1.75" y="${-h / 2 + 0.2}" width="3.5" height="1.8" rx="0.2" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
    <rect x="-1.5" y="${-bodyH / 2 - 0.8}" width="3.0" height="0.9" rx="0.1" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />

    <!-- 3 Bottom Leads (GND, VOUT, VIN) -->
    <rect x="-2.7" y="${bodyH / 2}" width="0.8" height="1.0" rx="0.1" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />
    <rect x="-2.85" y="${h / 2 - 1.8}" width="1.1" height="1.6" rx="0.2" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />

    <rect x="-0.4" y="${bodyH / 2}" width="0.8" height="1.0" rx="0.1" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />
    <rect x="-0.55" y="${h / 2 - 1.8}" width="1.1" height="1.6" rx="0.2" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />

    <rect x="1.9" y="${bodyH / 2}" width="0.8" height="1.0" rx="0.1" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />
    <rect x="1.75" y="${h / 2 - 1.8}" width="1.1" height="1.6" rx="0.2" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
  `;
  return { body, pads };
}

function renderHeaderSvg(w: number, h: number, padsCount: number, isFemale = false): { body: string; pads: string } {
  const pinCount = Math.max(2, padsCount);
  const isVertical = h >= w;
  let body = '';
  let pads = '';

  if (isVertical) {
    const pitch = (h - 1.0) / (pinCount - 1);
    const startY = -(h - 1.0) / 2;
    for (let i = 0; i < pinCount; i++) {
      const py = startY + i * pitch;
      body += `
        <!-- Black Plastic Insulator Block -->
        <rect x="${-w / 2}" y="${py - pitch / 2 + 0.1}" width="${w}" height="${pitch - 0.2}" rx="0.2" fill="#111827" stroke="#1f2937" stroke-width="0.15" />
      `;
      if (isFemale) {
        body += `<rect x="-0.6" y="${py - 0.6}" width="1.2" height="1.2" rx="0.1" fill="#070709" stroke="#374151" stroke-width="0.1" />`;
      } else {
        body += `<rect x="-0.4" y="${py - 0.4}" width="0.8" height="0.8" fill="#fbbf24" stroke="#d97706" stroke-width="0.1" />`;
      }
      pads += `
        <circle cx="0" cy="${py}" r="0.9" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
        <circle cx="0" cy="${py}" r="0.4" fill="#070709" />
      `;
    }
  } else {
    const pitch = (w - 1.0) / (pinCount - 1);
    const startX = -(w - 1.0) / 2;
    for (let i = 0; i < pinCount; i++) {
      const px = startX + i * pitch;
      body += `
        <rect x="${px - pitch / 2 + 0.1}" y="${-h / 2}" width="${pitch - 0.2}" height="${h}" rx="0.2" fill="#111827" stroke="#1f2937" stroke-width="0.15" />
      `;
      if (isFemale) {
        body += `<rect x="${px - 0.6}" y="-0.6" width="1.2" height="1.2" rx="0.1" fill="#070709" stroke="#374151" stroke-width="0.1" />`;
      } else {
        body += `<rect x="${px - 0.4}" y="-0.4" width="0.8" height="0.8" fill="#fbbf24" stroke="#d97706" stroke-width="0.1" />`;
      }
      pads += `
        <circle cx="${px}" cy="0" r="0.9" fill="#c88b32" stroke="#f59e0b" stroke-width="0.15" />
        <circle cx="${px}" cy="0" r="0.4" fill="#070709" />
      `;
    }
  }

  return { body, pads };
}

function renderFuseSvg(w: number, h: number): { body: string; pads: string } {
  const termW = 0.5;
  const body = `
    <!-- Polyfuse Green Polymer Body -->
    <rect x="${-w / 2 + termW}" y="${-h / 2}" width="${w - termW * 2}" height="${h}" rx="0.1" fill="#047857" stroke="#065f46" stroke-width="0.15" />
    <line x1="${-w / 2 + termW + 0.5}" y1="0" x2="${w / 2 - termW - 0.5}" y2="0" stroke="#a7f3d0" stroke-width="0.3" stroke-dasharray="0.5,0.3" />
  `;
  const pads = `
    <rect x="${-w / 2 - 0.35}" y="${-h / 2 - 0.1}" width="${termW + 0.4}" height="${h + 0.2}" rx="0.15" fill="#c88b32" stroke="#f59e0b" stroke-width="0.1" />
    <rect x="${-w / 2}" y="${-h / 2}" width="${termW}" height="${h}" rx="0.1" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />
    <rect x="${w / 2 - termW - 0.05}" y="${-h / 2 - 0.1}" width="${termW + 0.4}" height="${h + 0.2}" rx="0.15" fill="#c88b32" stroke="#f59e0b" stroke-width="0.1" />
    <rect x="${w / 2 - termW}" y="${-h / 2}" width="${termW}" height="${h}" rx="0.1" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.1" />
  `;
  return { body, pads };
}

function renderGenericChipSvg(w: number, h: number, padsCount: number, label: string): { body: string; pads: string } {
  const body = `
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="0.5" fill="#18181b" stroke="#334155" stroke-width="0.25" />
    <circle cx="${-w / 2 + 1.2}" cy="${-h / 2 + 1.2}" r="0.4" fill="#64748b" />
    <text x="0" y="0.5" font-size="${Math.max(0.8, Math.min(1.4, w * 0.15))}" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-weight="bold">${label.substring(0, 10)}</text>
  `;
  let pads = '';
  const half = Math.ceil(padsCount / 2);
  const spacing = (h - 2) / Math.max(1, half - 1);
  for (let i = 0; i < half; i++) {
    const py = (h / 2 - 1) - i * spacing;
    pads += `<rect x="${-w / 2 - 0.8}" y="${py - 0.35}" width="0.9" height="0.7" rx="0.1" fill="#c88b32" stroke="#f59e0b" stroke-width="0.1" />`;
  }
  for (let i = 0; i < padsCount - half; i++) {
    const py = -(h / 2 - 1) + i * spacing;
    pads += `<rect x="${w / 2 - 0.1}" y="${py - 0.35}" width="0.9" height="0.7" rx="0.1" fill="#c88b32" stroke="#f59e0b" stroke-width="0.1" />`;
  }
  return { body, pads };
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
    b.text([width / 2, 4], 'LIVEBOARD CUSTOM PROTOTYPE', 1.8);
    b.text([width / 2, height - 4], `LIVEBOARD STUDIO · ${width}x${height}mm`, 1.2);

    const createdComps: Component[] = [];
    for (const comp of placedComponents) {
      const c = buildComponentFromPlaced(comp, b);
      createdComps.push(c);
      const fp = getFootprint(comp.partId, comp);
      const silkY = Math.max(2, comp.y - (fp.h / 2 + 1.8));
      b.text([comp.x, silkY], comp.ref, 1.2);
    }

    routeCustomBoardTraces(b, createdComps);

    sc = {
      format: 'pcbfix/1',
      id: `custom-board-${Date.now().toString(36)}`,
      meta: {
        title: `Custom Board (${width}x${height}mm)`,
        author: 'LiveBoard Maker',
        difficulty: 1,
        description: 'Własny projekt płytki PCB przygotowany w warsztacie LiveBoard Studio.',
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

    const existingRefs = new Set(sc.board.components.map((c) => c.ref));
    const placedMap = new Map(placedComponents.map((p) => [p.ref, p]));

    for (const c of sc.board.components) {
      const placed = placedMap.get(c.ref) ?? placedComponents.find((p) => p.id === c.id);
      if (placed) {
        c.at = [placed.x, placed.y];
        c.rot = placed.rotation;
        if (placed.value !== undefined) c.value = placed.value;
      }
    }

    const activePlacedIds = new Set(placedComponents.map((p) => p.id));
    const activePlacedRefs = new Set(placedComponents.map((p) => p.ref));
    sc.board.components = sc.board.components.filter(
      (c) => activePlacedIds.has(c.id) || activePlacedRefs.has(c.ref)
    );

    const bWrapper = new Builder(width, height);
    bWrapper.b = sc.board;
    for (const placed of placedComponents) {
      if (!existingRefs.has(placed.ref) && !sc.board.components.some((c) => c.id === placed.id)) {
        buildComponentFromPlaced(placed, bWrapper);
      }
    }
  }

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
  private customColor = '#0f2e1a';
  private gridStep = 1.0;
  private searchQuery = '';
  private selectedCategory = 'all';
  private injectFault: FaultKind = 'none';
  private placedComponents: PlacedComponent[] = [];
  private selectedCompId: string | null = null;
  private collidingCompIds: Set<string> = new Set();

  private onWindowMouseMove?: (e: MouseEvent) => void;
  private onWindowMouseUp?: () => void;

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      const orderModal = this.el.querySelector('#pcb-order-modal');
      if (orderModal) {
        orderModal.remove();
        return;
      }
      this.close();
      return;
    }

    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA') {
      return;
    }

    if (this.selectedCompId) {
      const isPl = getLang() === 'pl';
      const comp = this.placedComponents.find((c) => c.id === this.selectedCompId);
      if (!comp) return;

      const step = this.gridStep > 0 ? this.gridStep : 1.0;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        this.rotateSelectedComponent(isPl);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.deleteComponent(comp.id, isPl);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        comp.x = Math.max(2, Math.round((comp.x - step) * 100) / 100);
        this.onComponentNudge(comp, isPl);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        comp.x = Math.min(this.customWidth - 2, Math.round((comp.x + step) * 100) / 100);
        this.onComponentNudge(comp, isPl);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        comp.y = Math.min(this.customHeight - 2, Math.round((comp.y + step) * 100) / 100);
        this.onComponentNudge(comp, isPl);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        comp.y = Math.max(2, Math.round((comp.y - step) * 100) / 100);
        this.onComponentNudge(comp, isPl);
      }
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
      this.customColor = '#0f2e1a';
      this.placedComponents = [];
      this.selectedCompId = null;
      this.collidingCompIds.clear();
      return;
    }

    const preset = BOARD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const sc = preset.create();
    this.customWidth = sc.board.w;
    this.customHeight = sc.board.h;
    this.customColor = sc.board.color || '#0f2e1a';
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
    this.collidingCompIds = detectCollisions(this.placedComponents);
  }

  private findPartIdForComp(c: Component): string {
    const refUpper = c.ref.toUpperCase();
    if (refUpper.includes('ESP32')) return 'esp32-wroom-32d';
    if (refUpper.includes('RP2040') || refUpper.includes('PICO')) return 'rp2040-pico';
    if (refUpper.includes('ATMEGA') || refUpper.includes('328P')) return 'atmega328p-pu';
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
    let x = Math.round(margin + col * (availW / Math.max(1, cols - 1 || 1)));
    let y = Math.round(margin + (row * 12) % availH);
    if (this.gridStep > 0) {
      x = snapToGrid(x, this.gridStep);
      y = snapToGrid(y, this.gridStep);
    }
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
    this.collidingCompIds = detectCollisions(this.placedComponents);

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
      case 'usb-c':
        partId = 'usb-c-16p-tht-smd';
        prefix = 'J';
        name = isPl ? 'Gniazdo USB-C 16-pin' : 'USB-C 16-Pin Receptacle';
        value = 5.0;
        break;
      case 'switch':
        partId = 'generic-switch';
        prefix = 'SW';
        name = isPl ? 'Przycisk Tactile 6x6mm' : 'Tactile Pushbutton 6x6mm';
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
    this.collidingCompIds = detectCollisions(this.placedComponents);

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

    this.collidingCompIds = detectCollisions(this.placedComponents);

    const rowEl = this.el.querySelector(`.placed-comp-row[data-comp-id="${compId}"]`);
    rowEl?.remove();

    const svgEl = this.el.querySelector(`#pcb-svg-preview [data-comp-id="${compId}"]`);
    svgEl?.remove();

    this.updateTabBadge(isPl);
    this.updateEstimatorBox(isPl);
    this.updateCanvasToolbar(isPl);
    this.updateAirwiresLayer();
    this.updateDrcBadge(isPl);

    const countBadge = this.el.querySelector('#placed-comps-count');
    if (countBadge) countBadge.textContent = String(this.placedComponents.length);

    const listEl = this.el.querySelector('#placed-comps-list');
    if (listEl && this.placedComponents.length === 0) {
      listEl.innerHTML = `
        <div id="empty-comps-msg" style="padding: 24px 12px; text-align: center; color: var(--muted); border: 1px dashed var(--border); border-radius: 6px; font-size: 12px;">
          ${isPl ? 'Brak komponentów na płytce. Skorzystaj z paska szybkiego dodawania lub wybierz części z bazy PCBWay / LCSC!' : 'No components placed yet. Use the Quick Add bar below or select components from the PCBWay / LCSC catalog!'}
        </div>
      `;
    }

    this.opts.toast(isPl ? `Usunięto ${deleted.ref}` : `Removed ${deleted.ref}`, 'info');
  }

  private rotateSelectedComponent(isPl: boolean) {
    if (!this.selectedCompId) return;
    const comp = this.placedComponents.find((c) => c.id === this.selectedCompId);
    if (!comp) return;

    comp.rotation = (((comp.rotation + 90) % 360) as 0 | 90 | 180 | 270);
    this.collidingCompIds = detectCollisions(this.placedComponents);
    this.updateComponentSvgTransform(comp);
    this.updateSelectionAndCollision(isPl);
    this.updateAirwiresLayer();
    this.updateDrcBadge(isPl);

    const selRot = this.el.querySelector(`.sel-comp-rot[data-comp-id="${comp.id}"]`) as HTMLSelectElement | null;
    if (selRot) selRot.value = String(comp.rotation);

    this.opts.toast(
      isPl ? `Obrócono ${comp.ref} o 90° (kąt: ${comp.rotation}°)` : `Rotated ${comp.ref} by 90° (${comp.rotation}°)`,
      'info'
    );
  }

  private onComponentNudge(comp: PlacedComponent, isPl: boolean) {
    this.collidingCompIds = detectCollisions(this.placedComponents);
    this.updateComponentSvgTransform(comp);
    this.updateSelectionAndCollision(isPl);
    this.updateAirwiresLayer();
    this.updateDrcBadge(isPl);

    const inpX = this.el.querySelector(`.inp-comp-x[data-comp-id="${comp.id}"]`) as HTMLInputElement | null;
    if (inpX && document.activeElement !== inpX) inpX.value = String(comp.x);
    const inpY = this.el.querySelector(`.inp-comp-y[data-comp-id="${comp.id}"]`) as HTMLInputElement | null;
    if (inpY && document.activeElement !== inpY) inpY.value = String(comp.y);

    const hoverInfo = this.el.querySelector('#preview-hover-info');
    if (hoverInfo) hoverInfo.textContent = `${comp.ref}: X=${comp.x} mm, Y=${comp.y} mm`;
  }

  private updateTabBadge(isPl: boolean) {
    const tabBtn = this.el.querySelector('#tab-btn-builder');
    if (tabBtn) {
      const count = this.placedComponents.length;
      const countStr = count > 0 ? ` (${count})` : '';
      tabBtn.innerHTML = `${icon('grid', 14)}<span>${isPl ? 'Kreator Obwodów & CAD' : 'Circuit & CAD Builder'}${countStr}</span>`;
    }
  }

  private updateComponentSvgTransform(comp: PlacedComponent) {
    const compEl = this.el.querySelector(`#pcb-svg-preview [data-comp-id="${comp.id}"]`);
    if (compEl) {
      const ySvg = this.customHeight - comp.y;
      compEl.setAttribute('transform', `translate(${comp.x}, ${ySvg}) rotate(${comp.rotation})`);
    }
  }

  private updateSelectionAndCollision(isPl: boolean) {
    this.el.querySelectorAll('#pcb-svg-preview .preview-comp').forEach((g) => {
      const id = g.getAttribute('data-comp-id');
      const isSel = id === this.selectedCompId;
      const isCol = id ? this.collidingCompIds.has(id) : false;
      const ring = g.querySelector('.selection-ring');
      if (ring) {
        if (isCol) {
          ring.setAttribute('stroke', '#ef4444');
          ring.setAttribute('fill', 'rgba(239, 68, 68, 0.15)');
          ring.setAttribute('stroke-width', '0.6');
          ring.setAttribute('stroke-dasharray', '1.2,0.8');
        } else if (isSel) {
          ring.setAttribute('stroke', '#38bdf8');
          ring.setAttribute('fill', 'rgba(56, 189, 248, 0.08)');
          ring.setAttribute('stroke-width', '0.5');
          ring.setAttribute('stroke-dasharray', '1.2,0.8');
        } else {
          ring.setAttribute('stroke', 'none');
          ring.setAttribute('fill', 'none');
        }
      }
    });

    this.el.querySelectorAll('.placed-comp-row').forEach((row) => {
      const id = row.getAttribute('data-comp-id');
      const isSel = id === this.selectedCompId;
      const isCol = id ? this.collidingCompIds.has(id) : false;
      const htmlRow = row as HTMLElement;

      if (isCol) {
        htmlRow.style.borderColor = '#ef4444';
        htmlRow.style.background = 'rgba(239, 68, 68, 0.08)';
      } else if (isSel) {
        htmlRow.style.borderColor = 'var(--accent)';
        htmlRow.style.background = 'rgba(56, 189, 248, 0.08)';
        htmlRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        htmlRow.style.borderColor = 'var(--border)';
        htmlRow.style.background = 'var(--surface)';
      }
    });

    this.updateCanvasToolbar(isPl);
    this.updateEstimatorBox(isPl);
  }

  private updateCanvasToolbar(isPl: boolean) {
    const toolbar = this.el.querySelector('#canvas-quick-toolbar');
    if (!toolbar) return;

    if (!this.selectedCompId) {
      toolbar.innerHTML = `
        <span style="color: var(--muted); font-size: 11px;">
          ${isPl ? '🖱️ Kliknij komponent na płytce, aby go edytować lub przeciągaj myszą · Skróty: R (obrót), Del (usuń), Strzałki (nudge 1mm)' : '🖱️ Click component on PCB to edit or drag with mouse · Keys: R (rotate), Del (delete), Arrows (nudge 1mm)'}
        </span>
      `;
      return;
    }

    const comp = this.placedComponents.find((c) => c.id === this.selectedCompId);
    if (!comp) return;

    const isCol = this.collidingCompIds.has(comp.id);
    toolbar.innerHTML = `
      <div class="row" style="gap: 8px; align-items: center; overflow: hidden;">
        <span class="badge" style="font-family: var(--mono); font-weight: 700; background: #0284c7; color: #fff;">${comp.ref}</span>
        <span style="font-weight: 600; font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">${comp.name}</span>
        <span style="color: var(--muted); font-family: var(--mono); font-size: 11px;">[${comp.x}, ${comp.y} mm · ${comp.rotation}°]</span>
        ${isCol ? `<span style="color: #ef4444; font-weight: 700; font-size: 11px;">⚠️ ${isPl ? 'Kolizja na laminacie!' : 'Collision on PCB!'}</span>` : ''}
      </div>
      <div class="row" style="gap: 6px; align-items: center;">
        <button type="button" class="btn sm ghost" id="btn-quick-rot" title="${isPl ? 'Obróć o 90° (Klawisz R)' : 'Rotate 90° (Key R)'}" style="padding: 2px 8px; font-size: 11px;">
          ${icon('rotate', 12)}<span>90°</span>
        </button>
        <button type="button" class="btn sm ghost" id="btn-quick-del" title="${isPl ? 'Usuń (Klawisz Del)' : 'Delete (Key Del)'}" style="padding: 2px 8px; font-size: 11px; color: #ef4444;">
          ${icon('x', 12)}<span>${isPl ? 'Usuń' : 'Delete'}</span>
        </button>
      </div>
    `;

    toolbar.querySelector('#btn-quick-rot')?.addEventListener('click', () => this.rotateSelectedComponent(isPl));
    toolbar.querySelector('#btn-quick-del')?.addEventListener('click', () => {
      if (this.selectedCompId) this.deleteComponent(this.selectedCompId, isPl);
    });
  }

  private calculateBomCost(): number {
    return this.placedComponents.reduce((acc, c) => acc + getPartEstimatedCost(c.partId, c).unitPriceUsd, 0);
  }

  private updateEstimatorBox(isPl: boolean) {
    const bomCost = this.calculateBomCost();
    const fabCost = 2.00;
    const totalCost = fabCost + bomCost;

    const totalEl = this.el.querySelector('#estimator-total-price');
    if (totalEl) totalEl.textContent = `$${totalCost.toFixed(2)} USD`;

    const bomEl = this.el.querySelector('#estimator-bom-price');
    if (bomEl) bomEl.textContent = `$${bomCost.toFixed(2)}`;

    const dfmEl = this.el.querySelector('#estimator-dfm-status');
    if (dfmEl) {
      const colCount = this.collidingCompIds.size;
      if (colCount > 0) {
        dfmEl.textContent = isPl ? `⚠️ ${colCount} kolizji (DFM Warning)` : `⚠️ ${colCount} collisions (DFM Warning)`;
        (dfmEl as HTMLElement).style.color = '#ef4444';
      } else {
        dfmEl.textContent = isPl ? '✓ Bez kolizji (DFM Pass)' : '✓ Zero collisions (DFM Pass)';
        (dfmEl as HTMLElement).style.color = '#34d399';
      }
    }
  }

  private updateDrcBadge(isPl: boolean) {
    const sc = this.generateScenario();
    const drc = checkDrc(sc.board);

    const badge = this.el.querySelector('#canvas-drc-badge') as HTMLElement | null;
    if (badge) {
      if (drc.passed) {
        badge.className = 'badge success';
        badge.style.background = 'rgba(16, 185, 129, 0.15)';
        badge.style.color = '#34d399';
        badge.style.border = '1px solid #10b981';
        badge.textContent = isPl ? '✓ DRC Zgodny' : '✓ DRC Passed';
        badge.title = isPl
          ? 'Wszystkie reguły projektowe spełnione (brak kolizji, zachowane marginesy krawędzi, zasilanie i masa podłączone)'
          : 'All design rules passed (no collisions, valid edge margins, power and ground connected)';
      } else {
        badge.className = 'badge danger';
        badge.style.background = 'rgba(239, 68, 68, 0.15)';
        badge.style.color = '#ef4444';
        badge.style.border = '1px solid #ef4444';
        const errCount = drc.errors.length;
        badge.textContent = isPl
          ? `⚠️ ${errCount} ${errCount === 1 ? 'błąd' : errCount < 5 ? 'błędy' : 'błędów'} DRC`
          : `⚠️ ${errCount} DRC ${errCount === 1 ? 'error' : 'errors'}`;
        badge.title = drc.errors.join('\n');
      }
    }

    const dfmEl = this.el.querySelector('#estimator-dfm-status');
    if (dfmEl) {
      if (drc.passed) {
        dfmEl.textContent = isPl ? '✓ DRC Zgodny (0 błędów)' : '✓ DRC Passed (0 errors)';
        (dfmEl as HTMLElement).style.color = '#34d399';
      } else {
        const colCount = this.collidingCompIds.size;
        dfmEl.textContent = isPl
          ? (colCount > 0 ? `⚠️ ${colCount} kolizji (DRC Warning)` : `⚠️ ${drc.errors.length} błędów DRC`)
          : (colCount > 0 ? `⚠️ ${colCount} collisions (DRC Warning)` : `⚠️ ${drc.errors.length} DRC errors`);
        (dfmEl as HTMLElement).style.color = '#ef4444';
      }
    }
  }

  private renderAirwiresSvg(): string {
    const sc = this.generateScenario();
    const wires = calculateAirwires(sc.board);
    return wires
      .map((w) => {
        const y1 = this.customHeight - w.y1;
        const y2 = this.customHeight - w.y2;
        return `<line class="airwire" x1="${w.x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${w.x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${w.color}" stroke-width="0.35" stroke-dasharray="0.8,0.8" opacity="0.8" style="pointer-events: none;" />`;
      })
      .join('');
  }

  private updateAirwiresLayer() {
    const layer = this.el.querySelector('#svg-airwires-layer');
    if (layer) {
      layer.innerHTML = this.renderAirwiresSvg();
    }
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

    const boardGrid = svg.querySelector('#svg-board-grid');
    if (boardGrid) {
      boardGrid.setAttribute('width', String(this.customWidth));
      boardGrid.setAttribute('height', String(this.customHeight));
    }

    // Grid snap pattern and layer
    const snapPattern = svg.querySelector('#pcb-grid-snap');
    const snapGridLayer = svg.querySelector('#svg-snap-grid-layer') as SVGElement | null;
    if (snapPattern) {
      const step = this.gridStep > 0 ? this.gridStep : 10;
      snapPattern.setAttribute('width', String(step));
      snapPattern.setAttribute('height', String(step));
      const dot = snapPattern.querySelector('circle');
      if (dot) {
        dot.setAttribute('cx', String(step / 2));
        dot.setAttribute('cy', String(step / 2));
        dot.setAttribute('r', String(Math.min(0.2, Math.max(0.08, step * 0.1))));
      }
    }
    if (snapGridLayer) {
      snapGridLayer.setAttribute('width', String(this.customWidth));
      snapGridLayer.setAttribute('height', String(this.customHeight));
      snapGridLayer.style.display = this.gridStep > 0 ? 'block' : 'none';
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
      this.collidingCompIds = detectCollisions(this.placedComponents);
      compsLayer.innerHTML = this.placedComponents.map((c) => this.renderComponentSvg(c)).join('');
    }

    this.updateAirwiresLayer();

    const dimText = this.el.querySelector('#preview-dim-text');
    if (dimText) dimText.textContent = `${this.customWidth} × ${this.customHeight} mm`;

    const areaEl = this.el.querySelector('#estimator-area-text');
    if (areaEl) areaEl.textContent = `${this.customWidth} × ${this.customHeight} mm (${((this.customWidth * this.customHeight) / 100).toFixed(1)} cm²)`;

    this.updateDrcBadge(getLang() === 'pl');
  }

  private renderComponentSvg(comp: PlacedComponent): string {
    const fp = getFootprint(comp.partId, comp);
    const ySvg = this.customHeight - comp.y;
    const w = fp.w;
    const h = fp.h;
    const idLow = (comp.partId + ' ' + comp.ref + ' ' + comp.name).toLowerCase();
    const isSelected = this.selectedCompId === comp.id;
    const isColliding = this.collidingCompIds.has(comp.id);

    let bodySvg = '';
    let padsSvg = '';

    if (idLow.includes('esp32')) {
      const res = renderEsp32Svg(w, h);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (idLow.includes('pico') || idLow.includes('rp2040')) {
      const res = renderPicoSvg(w, h);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (idLow.includes('atmega328p-pu') || idLow.includes('dip-28') || (idLow.includes('atmega') && !idLow.includes('tqfp'))) {
      const res = renderDip28Svg(w, h);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (idLow.includes('usb-c') || idLow.includes('type-c')) {
      const res = renderUsbCSvg(w, h);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (idLow.includes('usb-b')) {
      const res = renderUsbBSvg(w, h);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (idLow.includes('dc-jack') || idLow.includes('barrel') || idLow.includes('jack') || idLow.includes('dc in')) {
      const res = renderDcJackSvg(w, h);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (idLow.includes('ams1117') || idLow.includes('sot-223') || comp.ref.includes('LDO')) {
      const res = renderSot223Svg(w, h);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (comp.ref.startsWith('SW') || idLow.includes('switch') || idLow.includes('tactile') || idLow.includes('przycisk')) {
      const res = renderTactileSwitchSvg(w, h);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (comp.ref.startsWith('J') || idLow.includes('header') || idLow.includes('złącze') || idLow.includes('zlacze')) {
      const isFemale = idLow.includes('female') || idLow.includes('żeńsk') || idLow.includes('zensk');
      const res = renderHeaderSvg(w, h, fp.padsCount, isFemale);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (comp.ref.startsWith('LED') || idLow.includes('led')) {
      const res = renderLedSvg(w, h, comp.name);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (comp.ref.startsWith('D') || idLow.includes('diode') || idLow.includes('ss34') || idLow.includes('dioda')) {
      const res = renderDiodeSvg(w, h);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (comp.ref.startsWith('C') || idLow.includes('capacitor') || idLow.includes('kondensator') || idLow.includes('mlcc')) {
      const res = renderCapacitor0805Svg(w, h);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (comp.ref.startsWith('R') || idLow.includes('resistor') || idLow.includes('rezystor') || idLow.includes('opornik')) {
      const res = renderResistor0805Svg(w, h, comp.value);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (comp.ref.startsWith('F') || idLow.includes('fuse') || idLow.includes('bezpiecznik')) {
      const res = renderFuseSvg(w, h);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else if (fp.shape === 'chip') {
      const res = renderGenericChipSvg(w, h, fp.padsCount, comp.name || comp.ref);
      bodySvg = res.body;
      padsSvg = res.pads;
    } else {
      const res = renderResistor0805Svg(w, h, comp.value);
      bodySvg = res.body;
      padsSvg = res.pads;
    }

    let ringStroke = 'none';
    let ringFill = 'none';
    let ringDash = '';
    let ringWidth = 0.5;

    if (isColliding) {
      ringStroke = '#ef4444';
      ringFill = 'rgba(239, 68, 68, 0.15)';
      ringDash = '1.2,0.8';
      ringWidth = 0.6;
    } else if (isSelected) {
      ringStroke = '#38bdf8';
      ringFill = 'rgba(56, 189, 248, 0.08)';
      ringDash = '1.2,0.8';
      ringWidth = 0.5;
    }

    const selectionRing = `
      <rect class="selection-ring" x="${-w / 2 - 0.8}" y="${-h / 2 - 0.8}" width="${w + 1.6}" height="${h + 1.6}" rx="0.5"
            fill="${ringFill}" stroke="${ringStroke}" stroke-width="${ringWidth}" stroke-dasharray="${ringDash}" />
      ${isColliding ? `<text x="${w / 2 + 1.2}" y="${-h / 2 + 1.0}" font-size="2.6" text-anchor="start">⚠️</text>` : ''}
    `;

    const fontSize = Math.max(1.1, Math.min(1.8, Math.max(w, h) * 0.22));

    return `
      <g class="preview-comp ${isColliding ? 'colliding-comp' : ''}" data-comp-id="${comp.id}" transform="translate(${comp.x}, ${ySvg}) rotate(${comp.rotation})" style="cursor: move;">
        ${padsSvg}
        ${bodySvg}
        ${selectionRing}
        <text x="0" y="${-h / 2 - 0.7}" text-anchor="middle" font-size="${fontSize}" fill="#f8fafc" font-family="monospace" font-weight="bold">${comp.ref}</text>
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
    const isCol = this.collidingCompIds.has(c.id);
    const borderColor = isCol ? '#ef4444' : (isSelected ? 'var(--accent)' : 'var(--border)');
    const bg = isCol ? 'rgba(239, 68, 68, 0.08)' : (isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--surface)');

    return `
      <div class="card placed-comp-row ${isSelected ? 'active-comp' : ''}" data-comp-id="${c.id}"
           style="padding: 8px 10px; background: ${bg}; border: 1px solid ${borderColor}; border-radius: 6px; display: flex; flex-direction: column; gap: 6px;">
        <div class="row" style="justify-content: space-between; align-items: center;">
          <div class="row" style="gap: 8px; align-items: center; overflow: hidden;">
            <span class="badge" style="font-family: var(--mono); font-weight: 700; font-size: 11px; background: var(--bg); border: 1px solid var(--border); color: ${isCol ? '#ef4444' : 'var(--accent)'}; min-width: 28px; text-align: center;">${c.ref}</span>
            <span style="font-size: 12px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;" title="${c.name}">${c.name}</span>
            ${isCol ? `<span title="Kolizja na płytce" style="font-size: 12px;">⚠️</span>` : ''}
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
    this.updateEstimatorBox(isPl);
    this.updateCanvasToolbar(isPl);
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
          this.updateSelectionAndCollision(isPl);
        }
      });
    });

    listEl.querySelectorAll('.inp-comp-x').forEach((inp) => {
      inp.addEventListener('input', () => {
        const compId = inp.getAttribute('data-comp-id');
        const comp = this.placedComponents.find((c) => c.id === compId);
        if (comp) {
          comp.x = Math.max(0, Math.min(this.customWidth, Number((inp as HTMLInputElement).value) || 0));
          this.onComponentNudge(comp, isPl);
        }
      });
    });

    listEl.querySelectorAll('.inp-comp-y').forEach((inp) => {
      inp.addEventListener('input', () => {
        const compId = inp.getAttribute('data-comp-id');
        const comp = this.placedComponents.find((c) => c.id === compId);
        if (comp) {
          comp.y = Math.max(0, Math.min(this.customHeight, Number((inp as HTMLInputElement).value) || 0));
          this.onComponentNudge(comp, isPl);
        }
      });
    });

    listEl.querySelectorAll('.sel-comp-rot').forEach((sel) => {
      sel.addEventListener('change', () => {
        const compId = sel.getAttribute('data-comp-id');
        const comp = this.placedComponents.find((c) => c.id === compId);
        if (comp) {
          comp.rotation = (Number((sel as HTMLSelectElement).value) || 0) as 0 | 90 | 180 | 270;
          this.collidingCompIds = detectCollisions(this.placedComponents);
          this.updateComponentSvgTransform(comp);
          this.updateSelectionAndCollision(isPl);
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
    const isPl = getLang() === 'pl';

    svg.addEventListener('mousedown', (e: MouseEvent) => {
      const compG = (e.target as Element).closest('.preview-comp') as SVGElement | null;
      if (!compG) {
        this.selectedCompId = null;
        this.updateSelectionAndCollision(isPl);
        return;
      }
      const compId = compG.getAttribute('data-comp-id');
      if (!compId) return;
      const comp = this.placedComponents.find((c) => c.id === compId);
      if (!comp) return;

      isDragging = true;
      dragCompId = compId;
      this.selectedCompId = compId;
      this.updateSelectionAndCollision(isPl);

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
          if (c) {
            const isCol = this.collidingCompIds.has(c.id);
            hoverInfo.textContent = `${c.ref} (${c.name}): [${c.x}, ${c.y}] mm${isCol ? ' ⚠️' : ''}`;
          }
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

      let newX = initialX + dx;
      let newY = initialY - dy;

      if (this.gridStep > 0) {
        newX = snapToGrid(newX, this.gridStep);
        newY = snapToGrid(newY, this.gridStep);
      } else {
        newX = Math.round(newX * 10) / 10;
        newY = Math.round(newY * 10) / 10;
      }

      newX = Math.max(2, Math.min(this.customWidth - 2, newX));
      newY = Math.max(2, Math.min(this.customHeight - 2, newY));

      if (newX !== comp.x || newY !== comp.y) {
        comp.x = newX;
        comp.y = newY;
        this.updateComponentSvgTransform(comp);
        this.collidingCompIds = detectCollisions(this.placedComponents);
        this.updateSelectionAndCollision(isPl);
        this.updateAirwiresLayer();
        this.updateDrcBadge(isPl);

        const inpX = this.el.querySelector(`.inp-comp-x[data-comp-id="${comp.id}"]`) as HTMLInputElement | null;
        if (inpX && document.activeElement !== inpX) inpX.value = String(comp.x);
        const inpY = this.el.querySelector(`.inp-comp-y[data-comp-id="${comp.id}"]`) as HTMLInputElement | null;
        if (inpY && document.activeElement !== inpY) inpY.value = String(comp.y);

        if (hoverInfo) {
          const isCol = this.collidingCompIds.has(comp.id);
          hoverInfo.textContent = `${comp.ref}: X=${comp.x} mm, Y=${comp.y} mm${isCol ? ' ⚠️' : ''}`;
        }
      }
    };

    this.onWindowMouseUp = () => {
      isDragging = false;
      dragCompId = null;
    };

    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
  }

  private openOrderModal(isPl: boolean) {
    const sc = this.generateScenario();
    const bomCost = this.calculateBomCost();
    const fabCost = 2.00;
    const totalCost = fabCost + bomCost;

    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.id = 'pcb-order-modal';
    modalBackdrop.style.cssText = 'z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.78); backdrop-filter: blur(4px);';

    const colorNames: Record<string, string> = {
      '#0f2e1a': isPl ? 'Zielony klasyczny (FR4 Green)' : 'Classic Green FR4',
      '#0e1828': isPl ? 'Niebieski (Arduino Blue)' : 'Arduino Blue',
      '#18181e': isPl ? 'Czarny matowy (Matte Black)' : 'Matte Black',
      '#450a0a': isPl ? 'Czerwony (SparkFun Red)' : 'SparkFun Red',
      '#2e1038': isPl ? 'Fioletowy (OSH Park Purple)' : 'OSH Park Purple',
      '#e2e8f0': isPl ? 'Biały (Pure White)' : 'Pure White',
    };
    const colorStr = colorNames[this.customColor] || this.customColor;

    modalBackdrop.innerHTML = `
      <div class="modal" style="width: min(720px, 94vw); max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(16, 185, 129, 0.4); box-shadow: 0 16px 40px rgba(0,0,0,0.85); background: #0c0e14;" role="dialog" aria-modal="true">
        <!-- Modal Head -->
        <div class="modal-head" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--border); background: #131722;">
          <div class="row" style="gap: 10px; align-items: center;">
            <div style="color: #10b981;">${icon('box', 22)}</div>
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #34d399;">
                ${isPl ? 'Zamówienie Prototypu PCB & Montażu SMT' : 'Order PCB Prototype & SMT Assembly'}
              </h3>
              <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
                LiveBoard Pro · ${isPl ? 'Zintegrowana wycena fabrykacji PCBWay & JLCPCB' : 'Integrated PCBWay & JLCPCB Prototype Quotation'}
              </div>
            </div>
          </div>
          <button class="btn ghost icon sm" id="btn-close-order" title="Zamknij (Esc)">
            ${icon('x', 14)}
          </button>
        </div>

        <!-- Body -->
        <div style="padding: 18px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; flex: 1;">
          <!-- Specifications Summary -->
          <div style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 12px 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; font-size: 12px;">
            <div><b>${isPl ? 'Wymiary laminatu:' : 'Dimensions:'}</b> ${this.customWidth} × ${this.customHeight} mm</div>
            <div><b>${isPl ? 'Ilość sztuk:' : 'Quantity:'}</b> 5 pcs (${isPl ? 'seria prototypowa' : 'prototype batch'})</div>
            <div><b>${isPl ? 'Struktura warstw:' : 'Layer stackup:'}</b> 2-Layer FR4 (1.6mm, 1oz Cu)</div>
            <div><b>${isPl ? 'Soldermaska:' : 'Solder mask:'}</b> ${colorStr}</div>
            <div><b>${isPl ? 'Fabrykacja PCB:' : 'PCB Fabrication:'}</b> <span style="color: #34d399; font-weight: bold;">$2.00</span></div>
            <div><b>${isPl ? 'Elementy SMT (BOM):' : 'BOM Components:'}</b> <span style="color: #34d399; font-weight: bold;">$${bomCost.toFixed(2)}</span> (${this.placedComponents.length} szt.)</div>
          </div>

          <!-- Total Callout -->
          <div class="row" style="justify-content: space-between; align-items: center; background: #131722; padding: 12px 18px; border-radius: 8px; border: 1px solid var(--border);">
            <div>
              <div style="font-size: 12px; color: var(--muted);">${isPl ? 'Całkowity szacowany koszt zamówienia:' : 'Total estimated order cost:'}</div>
              <div style="font-size: 20px; font-weight: 800; color: #34d399; font-family: var(--mono);">$${totalCost.toFixed(2)} USD <span style="font-size: 13px; color: var(--muted); font-weight: 400;">(~${(totalCost * 4.05).toFixed(2)} PLN)</span></div>
            </div>
            <span class="badge info" style="font-size: 11px;">${this.collidingCompIds.size === 0 ? '✓ DFM Passed' : `⚠️ ${this.collidingCompIds.size} DFM Warnings`}</span>
          </div>

          <!-- Production Package Checklist -->
          <div>
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--text);">
              📁 ${isPl ? 'Wygenerowany pakiet produkcyjny:' : 'Generated Production Files:'}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; font-family: var(--mono); color: var(--text-2);">
              <div style="background: var(--surface); padding: 8px; border-radius: 6px; border: 1px solid var(--border);">✓ Gerber RS-274X (Top/Bottom, Silk, Mask, Edge)</div>
              <div style="background: var(--surface); padding: 8px; border-radius: 6px; border: 1px solid var(--border);">✓ Excellon Drill File (.drl)</div>
              <div style="background: var(--surface); padding: 8px; border-radius: 6px; border: 1px solid var(--border);">✓ Pick and Place CPL Centroid (.csv)</div>
              <div style="background: var(--surface); padding: 8px; border-radius: 6px; border: 1px solid var(--border);">✓ Bill of Materials BOM LCSC/PCBWay (.csv)</div>
            </div>
          </div>

          <!-- Placed Components Summary Table -->
          <div>
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--text);">
              📋 ${isPl ? 'Zestawienie komponentów do montażu SMT:' : 'SMT Component Placement Table:'}
            </div>
            <div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; background: #070709;">
              <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; font-family: var(--mono);">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border); background: #131722; color: var(--muted);">
                    <th style="padding: 6px 10px;">Ref</th>
                    <th style="padding: 6px 10px;">Part / MPN</th>
                    <th style="padding: 6px 10px;">LCSC / PCBWay</th>
                    <th style="padding: 6px 10px; text-align: right;">Cena/szt</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.placedComponents.map((c) => {
                    const pricing = getPartEstimatedCost(c.partId, c);
                    return `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 5px 10px; color: var(--accent); font-weight: bold;">${c.ref}</td>
                        <td style="padding: 5px 10px; color: var(--text);">${c.name}</td>
                        <td style="padding: 5px 10px; color: var(--muted);">${pricing.lcsc}</td>
                        <td style="padding: 5px 10px; text-align: right; color: #34d399;">$${pricing.unitPriceUsd.toFixed(2)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div style="padding: 14px 20px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #131722; flex-wrap: wrap; gap: 10px;">
          <div class="row" style="gap: 8px;">
            <button type="button" class="btn sm ghost" id="btn-order-copy-bom">
              ${icon('copy', 14)}<span>${isPl ? 'Kopiuj BOM (CSV)' : 'Copy BOM CSV'}</span>
            </button>
            <button type="button" class="btn sm ghost" id="btn-order-copy-cpl">
              ${icon('copy', 14)}<span>${isPl ? 'Kopiuj CPL (CSV)' : 'Copy CPL CSV'}</span>
            </button>
            <button type="button" class="btn sm ghost" id="btn-order-download-pkg">
              ${icon('download', 14)}<span>${isPl ? 'Pobierz Paczkę ZIP' : 'Download ZIP Package'}</span>
            </button>
          </div>
          <button type="button" class="btn primary" id="btn-order-checkout-demo" style="background: #059669; border-color: #10b981; font-weight: 700;">
            ${icon('check', 16)}<span>${isPl ? 'Złóż zapytanie PCBWay / JLCPCB' : 'Submit PCBWay / JLCPCB Request'}</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modalBackdrop);

    const closeBtn = modalBackdrop.querySelector('#btn-close-order');
    closeBtn?.addEventListener('click', () => modalBackdrop.remove());

    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) modalBackdrop.remove();
    });

    modalBackdrop.querySelector('#btn-order-copy-bom')?.addEventListener('click', () => {
      const csv = generateBomCsv(this.placedComponents);
      navigator.clipboard?.writeText(csv);
      this.opts.toast(isPl ? 'Skopiowano zestawienie BOM (CSV) do schowka!' : 'Copied BOM (CSV) to clipboard!', 'success');
    });

    modalBackdrop.querySelector('#btn-order-copy-cpl')?.addEventListener('click', () => {
      const csv = generateCplCsv(this.placedComponents);
      navigator.clipboard?.writeText(csv);
      this.opts.toast(isPl ? 'Skopiowano plik CPL (Centroid Pick & Place) do schowka!' : 'Copied CPL (Centroid) to clipboard!', 'success');
    });

    modalBackdrop.querySelector('#btn-order-download-pkg')?.addEventListener('click', async () => {
      await this.downloadProductionZip(sc, isPl);
    });

    modalBackdrop.querySelector('#btn-order-checkout-demo')?.addEventListener('click', () => {
      modalBackdrop.remove();
      this.opts.toast(
        isPl
          ? `Zapytanie produkcyjne dla "${sc.meta.title}" (5 szt.) zostało przesłane do API fabrykacji!`
          : `Prototype production request for "${sc.meta.title}" submitted to fabrication API!`,
        'success'
      );
    });
  }

  private async downloadProductionZip(sc: Scenario, isPl: boolean) {
    const bomCsv = generateBomCsv(this.placedComponents);
    const cplCsv = generateCplCsv(this.placedComponents);
    const enc = new TextEncoder();

    const readme = `LiveBoard Studio - PCB Production Package
Project: ${sc.meta.title}
Board Dimensions: ${this.customWidth} x ${this.customHeight} mm
Layers: 2
Thickness: 1.6mm FR4
Solder Mask: ${this.customColor}
Silkscreen: White (#e0e0e0)
Quantity: 5 pcs prototype batch

Files included:
- bom.csv: Bill of Materials with LCSC and PCBWay part numbers
- cpl.csv: Component Centroid Placement list for SMT pick & place
- board.pcbfix.json: Complete circuit simulation data
Ready for upload to PCBWay or JLCPCB.
`;

    try {
      const zipBytes = await writeZip([
        ['README.txt', enc.encode(readme)],
        ['production/bom.csv', enc.encode(bomCsv)],
        ['production/cpl.csv', enc.encode(cplCsv)],
        ['board.pcbfix.json', enc.encode(JSON.stringify(sc, null, 2))],
      ]);
      const blob = new Blob([zipBytes as BlobPart], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sc.id}-pcb-production.zip`;
      a.click();
      URL.revokeObjectURL(url);
      this.opts.toast(isPl ? 'Pobrano paczkę produkcyjną (.zip)!' : 'Downloaded production package (.zip)!', 'success');
    } catch {
      const blob = new Blob([JSON.stringify(sc, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sc.id}.pcbfix.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.opts.toast(isPl ? 'Pobrano plik projektu .pcbfix.json' : 'Downloaded project file .pcbfix.json', 'success');
    }
  }

  private render() {
    const isPl = getLang() === 'pl';

    this.el.innerHTML = `
      <div class="modal" style="width: min(1000px, 96vw); max-height: 92vh; display: flex; flex-direction: column; overflow: hidden;" role="dialog" aria-modal="true" aria-labelledby="creator-title">
        <!-- Header -->
        <div class="modal-head" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border);">
          <div class="row" style="gap: 10px; align-items: center;">
            <div style="color: var(--accent);">${icon('grid', 20)}</div>
            <div>
              <h2 id="creator-title" style="margin: 0; font-size: 17px; font-weight: 700;">
                ${isPl ? 'LiveBoard Studio · Kreator Płytek PCB & Baza Komponentów' : 'LiveBoard Studio · Custom PCB Creator & Parts Database'}
              </h2>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
                ${isPl ? 'Projektuj obwody, rozmieszczaj części na laminacie, sprawdzaj kolizje DFM, wyceniaj produkcję i eksportuj' : 'Design circuits, place parts interactively on PCB, check DFM collisions, estimate cost, and export'}
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
            ${icon('grid', 14)}<span>${isPl ? 'Kreator Obwodów & CAD' : 'Circuit & CAD Builder'}${this.placedComponents.length ? ` (${this.placedComponents.length})` : ''}</span>
          </button>
          <button class="btn sm ${this.activeTab === 'catalog' ? 'primary' : 'ghost'}" id="tab-btn-catalog">
            ${icon('search', 14)}<span>${isPl ? 'Katalog Części (PCBWay / LCSC / DigiKey)' : 'Parts Catalog (PCBWay / LCSC)'}</span>
          </button>
        </div>

        <!-- Tab Content Body -->
        <div id="creator-tab-content" style="padding: 18px; overflow-y: auto; flex: 1;">
          ${this.activeTab === 'builder' ? this.renderBuilderTab(isPl) : this.renderCatalogTab(isPl)}
        </div>
      </div>
    `;

    this.bindEvents(isPl);
    if (this.activeTab === 'builder') {
      this.updateDrcBadge(isPl);
    }
  }

  private renderBuilderTab(isPl: boolean): string {
    const bomCost = this.calculateBomCost();
    const fabCost = 2.00;
    const totalCost = fabCost + bomCost;
    const colCount = this.collidingCompIds.size;

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
            <label for="inp-board-color" style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px;">${isPl ? 'Kolor soldermaski (OLED CAD)' : 'Solder Mask Color (OLED CAD)'}</label>
            <select id="inp-board-color" style="width: 100%; padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);">
              <option value="#0f2e1a" ${this.customColor === '#0f2e1a' ? 'selected' : ''}>Zielony klasyczny (Classic Green)</option>
              <option value="#0e1828" ${this.customColor === '#0e1828' ? 'selected' : ''}>Niebieski (Arduino Blue)</option>
              <option value="#18181e" ${this.customColor === '#18181e' ? 'selected' : ''}>Czarny matowy (Matte Black)</option>
              <option value="#450a0a" ${this.customColor === '#450a0a' ? 'selected' : ''}>Czerwony (SparkFun Red)</option>
              <option value="#2e1038" ${this.customColor === '#2e1038' ? 'selected' : ''}>Fioletowy (OSH Park Purple)</option>
              <option value="#e2e8f0" ${this.customColor === '#e2e8f0' ? 'selected' : ''}>Biały (Pure White)</option>
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

        <!-- 2 & 3. Interactive CAD Preview & Placed Components Section -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; align-items: start;">
          <!-- Left Column: CAD Preview & Quick Add -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="row" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <span style="font-size: 13px; font-weight: 600; color: var(--text);">
                ${isPl ? '2. Wektorowy podgląd CAD płytki (OLED):' : '2. Vector CAD Board Canvas (OLED):'}
              </span>
              <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
                <!-- Grid Step Selector Toggle -->
                <div class="row" style="gap: 4px; align-items: center; background: #0c0e14; padding: 2px 6px; border-radius: 6px; border: 1px solid var(--border); font-size: 11px;">
                  <span style="color: var(--muted); font-weight: 600;">${isPl ? 'Siatka:' : 'Grid:'}</span>
                  <div id="grid-step-group" class="row" style="gap: 2px;">
                    <button type="button" class="btn xs ${this.gridStep === 0 ? 'primary' : 'ghost'} btn-grid-step" data-step="0" style="padding: 1px 6px; font-size: 10px;">${isPl ? 'Wył' : 'Off'}</button>
                    <button type="button" class="btn xs ${this.gridStep === 0.5 ? 'primary' : 'ghost'} btn-grid-step" data-step="0.5" style="padding: 1px 6px; font-size: 10px;">0.5mm</button>
                    <button type="button" class="btn xs ${this.gridStep === 1.0 ? 'primary' : 'ghost'} btn-grid-step" data-step="1.0" style="padding: 1px 6px; font-size: 10px;">1.0mm</button>
                    <button type="button" class="btn xs ${this.gridStep === 2.54 ? 'primary' : 'ghost'} btn-grid-step" data-step="2.54" style="padding: 1px 6px; font-size: 10px;">2.54mm</button>
                  </div>
                </div>
                <!-- DRC Status Badge -->
                <span id="canvas-drc-badge" class="badge" style="font-size: 11px; padding: 2px 8px; font-weight: 700; cursor: default;"></span>
                <span id="preview-dim-text" style="font-size: 11px; color: var(--muted); font-family: var(--mono);">
                  ${this.customWidth} × ${this.customHeight} mm
                </span>
              </div>
            </div>

            <!-- Canvas Quick HUD Toolbar -->
            <div id="canvas-quick-toolbar" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: #131722; border-radius: 6px; border: 1px solid var(--border); min-height: 32px;">
              <span style="color: var(--muted); font-size: 11px;">
                ${isPl ? '🖱️ Kliknij komponent na płytce, aby go edytować lub przeciągaj myszą · Skróty: R (obrót), Del (usuń), Strzałki (nudge 1mm)' : '🖱️ Click component on PCB to edit or drag with mouse · Keys: R (rotate), Del (delete), Arrows (nudge 1mm)'}
              </span>
            </div>

            <!-- SVG Container (Dark OLED CAD Canvas) -->
            <div id="pcb-preview-container" style="background: #070709; border-radius: 8px; border: 1px solid #1c1e26; padding: 10px; display: flex; justify-content: center; align-items: center; min-height: 240px; max-height: 320px; overflow: hidden; position: relative; box-shadow: inset 0 2px 10px rgba(0,0,0,0.8);">
              ${this.renderSvgPreview()}
            </div>

            <!-- Live drag hint & hover info -->
            <div class="row" style="justify-content: space-between; align-items: center; font-size: 11px; color: var(--muted); min-height: 18px;">
              <span>${isPl ? '🖱️ Precyzyjne pozycjonowanie z detekcją kolizji DFM' : '🖱️ Precision placement with real-time DFM collision detection'}</span>
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
                <button type="button" class="btn sm ghost btn-quick-add" data-kind="usb-c" title="${isPl ? 'Dodaj gniazdo USB-C 16-pin' : 'Add USB-C 16-pin connector'}">
                  + USB-C
                </button>
                <button type="button" class="btn sm ghost btn-quick-add" data-kind="switch" title="${isPl ? 'Dodaj przycisk tact 6x6mm' : 'Add tact switch 6x6mm'}">
                  + Przycisk
                </button>
                <button type="button" class="btn sm ghost btn-quick-add" data-kind="fuse" title="${isPl ? 'Dodaj bezpiecznik 1A' : 'Add 1A polyfuse'}">
                  + Fuse 1A
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
            <div id="placed-comps-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 440px; overflow-y: auto; padding-right: 4px;">
              ${this.renderPlacedComponentsRowsHtml(isPl)}
            </div>
          </div>
        </div>

        <!-- 4. PCB Production & Cost Estimator Box (LiveBoard Pro) -->
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 78, 59, 0.12) 100%); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
          <div class="row" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div class="row" style="gap: 10px; align-items: center;">
              <span style="font-size: 20px;">⚡</span>
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #10b981;">
                  ${isPl ? 'Wycena Produkcji Prototypu PCB & Montażu SMT' : 'Instant PCB Prototype & SMT Assembly Estimate'}
                </div>
                <div style="font-size: 11px; color: var(--muted);">
                  ${isPl ? 'Kalkulacja w czasie rzeczywistym na podstawie katalogu fabrykacji PCBWay & LCSC' : 'Real-time calculation based on PCBWay & LCSC fabrication database'}
                </div>
              </div>
            </div>
            <div class="row" style="gap: 12px; align-items: center;">
              <div style="text-align: right;">
                <div style="font-size: 11px; color: var(--muted);">${isPl ? 'Szacowany koszt 5 sztuk:' : 'Est. cost for 5 pcs:'}</div>
                <div style="font-size: 18px; font-weight: 800; color: #34d399; font-family: var(--mono);" id="estimator-total-price">
                  $${totalCost.toFixed(2)} USD
                </div>
              </div>
              <button type="button" class="btn primary sm" id="btn-open-order-modal" style="background: #059669; border-color: #10b981; font-weight: 700; padding: 6px 14px;">
                ${icon('box', 14)}<span>${isPl ? 'Zamów Prototyp PCB (PCBWay / JLCPCB)' : 'Order PCB Prototype (PCBWay / JLCPCB)'}</span>
              </button>
              <button type="button" class="btn ghost sm" id="btn-copy-bom-quick" title="${isPl ? 'Kopiuj zestawienie BOM (CSV)' : 'Copy BOM CSV'}">
                ${icon('copy', 14)}<span>BOM CSV</span>
              </button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; font-size: 11px; font-family: var(--mono); color: var(--text-2); background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px;">
            <div><b>${isPl ? 'Laminat FR4 2-warstwowy:' : '2-layer FR4 PCB:'}</b> <span style="color: #34d399;">$2.00</span> (5 szt. 1.6mm)</div>
            <div><b>${isPl ? 'Elementy SMT (BOM):' : 'SMT Components (BOM):'}</b> <span style="color: #34d399;" id="estimator-bom-price">$${bomCost.toFixed(2)}</span> (${this.placedComponents.length} szt.)</div>
            <div><b>${isPl ? 'Wymiary laminatu:' : 'Board dimensions:'}</b> <span id="estimator-area-text">${this.customWidth} × ${this.customHeight} mm (${((this.customWidth * this.customHeight) / 100).toFixed(1)} cm²)</span></div>
            <div><b>${isPl ? 'Status DFM / CPL:' : 'DFM / CPL Status:'}</b> <span id="estimator-dfm-status" style="color: ${colCount > 0 ? '#ef4444' : '#34d399'}; font-weight: bold;">${colCount > 0 ? (isPl ? `⚠️ ${colCount} kolizji (DFM Warning)` : `⚠️ ${colCount} collisions (DFM Warning)`) : (isPl ? '✓ Bez kolizji (DFM Pass)' : '✓ Zero collisions (DFM Pass)')}</span></div>
          </div>
        </div>

        <!-- Action buttons -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 4px;">
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
           style="width: 100%; max-height: 300px; filter: drop-shadow(0 6px 16px rgba(0,0,0,0.6));"
           xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Dark OLED CAD Grid -->
          <pattern id="pcb-grid-minor" width="2" height="2" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.12" fill="#1c1e26" />
          </pattern>
          <pattern id="pcb-grid-major" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="url(#pcb-grid-minor)" />
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#222634" stroke-width="0.25" />
          </pattern>
          <!-- Dynamic Snap Grid Pattern -->
          <pattern id="pcb-grid-snap" width="${this.gridStep || 10}" height="${this.gridStep || 10}" patternUnits="userSpaceOnUse">
            <circle cx="${(this.gridStep || 10) / 2}" cy="${(this.gridStep || 10) / 2}" r="${Math.min(0.2, Math.max(0.08, (this.gridStep || 10) * 0.1))}" fill="#38bdf8" opacity="0.45" />
          </pattern>
        </defs>

        <!-- Board Solder Mask Base -->
        <rect id="svg-board-rect" x="0" y="0" width="${this.customWidth}" height="${this.customHeight}" rx="2" ry="2" fill="${this.customColor}" stroke="#334155" stroke-width="0.5" />
        <rect id="svg-board-grid" x="0" y="0" width="${this.customWidth}" height="${this.customHeight}" fill="url(#pcb-grid-major)" />
        <rect id="svg-snap-grid-layer" x="0" y="0" width="${this.customWidth}" height="${this.customHeight}" fill="url(#pcb-grid-snap)" style="display: ${this.gridStep > 0 ? 'block' : 'none'}; pointer-events: none;" />

        <!-- Silkscreen edge guideline -->
        <rect id="svg-silk-outline" x="1.5" y="1.5" width="${Math.max(1, this.customWidth - 3)}" height="${Math.max(1, this.customHeight - 3)}" rx="1" ry="1" fill="none" stroke="rgba(224,224,224,0.35)" stroke-width="0.25" stroke-dasharray="2,2" />

        <!-- Mounting holes (Gold annular ring + dark drill hole) -->
        <circle cx="3.5" cy="3.5" r="1.6" fill="#c88b32" stroke="#f59e0b" stroke-width="0.2" />
        <circle cx="3.5" cy="3.5" r="1.0" fill="#070709" />
        <circle id="svg-hole-tr" cx="${this.customWidth - 3.5}" cy="3.5" r="1.6" fill="#c88b32" stroke="#f59e0b" stroke-width="0.2" />
        <circle cx="${this.customWidth - 3.5}" cy="3.5" r="1.0" fill="#070709" />
        <circle id="svg-hole-bl" cx="3.5" cy="${this.customHeight - 3.5}" r="1.6" fill="#c88b32" stroke="#f59e0b" stroke-width="0.2" />
        <circle cx="3.5" cy="${this.customHeight - 3.5}" r="1.0" fill="#070709" />
        <circle id="svg-hole-br" cx="${this.customWidth - 3.5}" cy="${this.customHeight - 3.5}" r="1.6" fill="#c88b32" stroke="#f59e0b" stroke-width="0.2" />
        <circle cx="${this.customWidth - 3.5}" cy="${this.customHeight - 3.5}" r="1.0" fill="#070709" />

        <!-- Silkscreen Branding Title -->
        <text id="svg-board-title" x="${this.customWidth / 2}" y="3.8" text-anchor="middle" font-size="1.8" fill="#e0e0e0" font-family="monospace" font-weight="bold">LIVEBOARD · CUSTOM PCB</text>

        <!-- Dynamic Airwires (Ratsnest) Layer -->
        <g id="svg-airwires-layer">
          ${this.renderAirwiresSvg()}
        </g>

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
        <!-- Filters bar (Retains focus when typing) -->
        <div class="row" style="gap: 10px; flex-wrap: wrap;">
          <input type="text" id="catalog-search" placeholder="${isPl ? 'Szukaj po symbolu (np. ESP32, AMS1117, RP2040, C15849, USB-C)...' : 'Search part number (e.g. ESP32, AMS1117, RP2040, C15849, USB-C)...'}"
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
      this.collidingCompIds.clear();
      this.updatePreviewAndComponentsList(isPl);
      this.opts.toast(isPl ? 'Wyczyszczono wszystkie komponenty z płytki.' : 'Cleared all components from board.', 'info');
    });

    const listEl = this.el.querySelector('#placed-comps-list');
    if (listEl) this.bindComponentRowEvents(listEl, isPl);

    this.el.querySelectorAll('.btn-grid-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = Number(btn.getAttribute('data-step')) || 0;
        this.gridStep = step;
        this.el.querySelectorAll('.btn-grid-step').forEach((b) => {
          const s = Number(b.getAttribute('data-step')) || 0;
          if (s === step) {
            b.className = 'btn xs primary btn-grid-step';
          } else {
            b.className = 'btn xs ghost btn-grid-step';
          }
        });
        this.updateSvgPreview();
        this.opts.toast(
          isPl
            ? (step > 0 ? `Włączono przyciąganie do siatki: ${step} mm` : 'Wyłączono przyciąganie do siatki')
            : (step > 0 ? `Grid snap enabled: ${step} mm` : 'Grid snap disabled'),
          'info'
        );
      });
    });

    this.bindSvgInteractions();
    this.updateCanvasToolbar(isPl);

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

    // PCB Production Estimator buttons
    this.el.querySelector('#btn-open-order-modal')?.addEventListener('click', () => {
      this.openOrderModal(isPl);
    });

    this.el.querySelector('#btn-copy-bom-quick')?.addEventListener('click', () => {
      const csv = generateBomCsv(this.placedComponents);
      navigator.clipboard?.writeText(csv);
      this.opts.toast(isPl ? 'Skopiowano zestawienie BOM (CSV) do schowka!' : 'Copied BOM (CSV) to clipboard!', 'success');
    });

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
