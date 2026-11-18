import type { Board, Component, Pad, Side, V2 } from '../types';
import { DEG, rot } from '../geom';
import { padWorld } from '../model';
import { textStrokes } from '../render/font';

export interface GerberFile {
  filename: string;
  content: string;
}

export interface GerberExportResult {
  zipBuffer: Uint8Array;
  files: GerberFile[];
  filename: string;
}

/** Formats metric millimeter coordinate to Gerber 4.4 format (scaled by 10000). */
export function toGerberCoord(mm: number): string {
  if (!Number.isFinite(mm)) return '0';
  return Math.round(mm * 10000).toString();
}

/** Returns standard Gerber RS-274X header in metric millimeter mode. */
export function gerberHeader(): string {
  return [
    'G04 Gerber RS-274X deadboard exporter*',
    '%FSLAX44Y44*%',
    '%MOMM*%',
    '%LPD*%',
    'G01*',
    'G75*',
  ].join('\n');
}

class GerberBuilder {
  private apertures: Map<string, number> = new Map();
  private nextDCode = 10;
  private currentDCode: number | null = null;
  private commands: string[] = [];
  private macros: Set<string> = new Set();

  constructor() {
    // Standard baseline line aperture D10
    this.addCircle(0.15);
  }

  private getOrAddAperture(typeKey: string): number {
    let d = this.apertures.get(typeKey);
    if (d === undefined) {
      d = this.nextDCode++;
      this.apertures.set(typeKey, d);
    }
    return d;
  }

  addCircle(diam: number): number {
    const d = Math.max(0.01, diam);
    return this.getOrAddAperture(`C,${d.toFixed(4)}`);
  }

  addRect(w: number, h: number): number {
    const rw = Math.max(0.01, w);
    const rh = Math.max(0.01, h);
    return this.getOrAddAperture(`R,${rw.toFixed(4)}X${rh.toFixed(4)}`);
  }

  addObround(w: number, h: number): number {
    const rw = Math.max(0.01, w);
    const rh = Math.max(0.01, h);
    return this.getOrAddAperture(`O,${rw.toFixed(4)}X${rh.toFixed(4)}`);
  }

  addRotatedRect(w: number, h: number, angleDeg: number): number {
    const rw = Math.max(0.01, w);
    const rh = Math.max(0.01, h);
    this.macros.add('%AMROTRECT*\n21,1,$1,$2,0,0,$3*%');
    return this.getOrAddAperture(`ROTRECT,${rw.toFixed(4)}X${rh.toFixed(4)}X${angleDeg.toFixed(2)}`);
  }

  setAperture(dCode: number) {
    if (this.currentDCode !== dCode) {
      this.commands.push(`D${dCode}*`);
      this.currentDCode = dCode;
    }
  }

  drawTrace(x1: number, y1: number, x2: number, y2: number, width: number) {
    const d = this.addCircle(width);
    this.setAperture(d);
    this.commands.push(`X${toGerberCoord(x1)}Y${toGerberCoord(y1)}D02*`);
    this.commands.push(`X${toGerberCoord(x2)}Y${toGerberCoord(y2)}D01*`);
  }

  flashCircle(x: number, y: number, diam: number) {
    const d = this.addCircle(diam);
    this.setAperture(d);
    this.commands.push(`X${toGerberCoord(x)}Y${toGerberCoord(y)}D03*`);
  }

  flashPad(x: number, y: number, shape: string, size: [number, number], rotDeg: number, expansion = 0) {
    const w = size[0] + expansion;
    const h = size[1] + expansion;
    const ang = ((rotDeg % 360) + 360) % 360;

    let dCode: number;
    if (shape === 'circle') {
      dCode = this.addCircle(Math.max(w, h));
    } else if (shape === 'oval') {
      if (Math.abs(w - h) < 1e-4) {
        dCode = this.addCircle(w);
      } else if (Math.abs(ang) < 0.01 || Math.abs(ang - 180) < 0.01) {
        dCode = this.addObround(w, h);
      } else if (Math.abs(ang - 90) < 0.01 || Math.abs(ang - 270) < 0.01) {
        dCode = this.addObround(h, w);
      } else {
        dCode = this.addRotatedRect(w, h, ang);
      }
    } else {
      // rect or roundrect
      if (Math.abs(ang) < 0.01 || Math.abs(ang - 180) < 0.01) {
        dCode = this.addRect(w, h);
      } else if (Math.abs(ang - 90) < 0.01 || Math.abs(ang - 270) < 0.01) {
        dCode = this.addRect(h, w);
      } else {
        dCode = this.addRotatedRect(w, h, ang);
      }
    }
    this.setAperture(dCode);
    this.commands.push(`X${toGerberCoord(x)}Y${toGerberCoord(y)}D03*`);
  }

  fillPolygon(poly: V2[]) {
    if (poly.length < 3) return;
    this.commands.push('G36*');
    this.commands.push(`X${toGerberCoord(poly[0][0])}Y${toGerberCoord(poly[0][1])}D02*`);
    for (let i = 1; i < poly.length; i++) {
      this.commands.push(`X${toGerberCoord(poly[i][0])}Y${toGerberCoord(poly[i][1])}D01*`);
    }
    this.commands.push(`X${toGerberCoord(poly[0][0])}Y${toGerberCoord(poly[0][1])}D01*`);
    this.commands.push('G37*');
  }

  build(): string {
    const lines: string[] = [gerberHeader()];
    for (const macro of this.macros) {
      lines.push(macro);
    }
    for (const [key, dCode] of this.apertures) {
      lines.push(`%ADD${dCode}${key}*%`);
    }
    for (const cmd of this.commands) {
      lines.push(cmd);
    }
    lines.push('M02*');
    return lines.join('\n');
  }
}

function padHasLayer(c: Component, p: Pad, layer: Side): boolean {
  if (p.layers === 'FB') return true;
  if (p.layers === layer) return true;
  if (c.side === 'B' && p.layers === 'F' && layer === 'B') return true;
  return false;
}

function renderSilkText(
  builder: GerberBuilder,
  at: V2,
  text: string,
  size: number,
  rotDeg: number,
  side: Side
) {
  const segs = textStrokes(text, size);
  const rad = rotDeg * DEG;
  const cs = Math.cos(rad);
  const sn = Math.sin(rad);
  const mirX = side === 'B' ? -1 : 1;
  const penWidth = Math.max(0.12, size * 0.12);

  for (const s of segs) {
    const x0 = s.x0 * mirX, y0 = s.y0;
    const x1 = s.x1 * mirX, y1 = s.y1;
    const p0x = at[0] + x0 * cs - y0 * sn;
    const p0y = at[1] + x0 * sn + y0 * cs;
    const p1x = at[0] + x1 * cs - y1 * sn;
    const p1y = at[1] + x1 * sn + y1 * cs;
    builder.drawTrace(p0x, p0y, p1x, p1y, penWidth);
  }
}

function renderComponentSilk(builder: GerberBuilder, c: Component, side: Side) {
  if (c.body && c.body.shape !== 'none' && c.body.w > 0 && c.body.h > 0) {
    const bw = c.body.w / 2;
    const bh = c.body.h / 2;
    const off = c.body.off ?? [0, 0];
    const corners: V2[] = [
      [-bw + off[0], -bh + off[1]],
      [bw + off[0], -bh + off[1]],
      [bw + off[0], bh + off[1]],
      [-bw + off[0], bh + off[1]],
    ];
    const mirX = side === 'B' ? -1 : 1;
    const worldCorners = corners.map((p): V2 => {
      const rotated = rot([p[0] * mirX, p[1]], c.rot);
      return [c.at[0] + rotated[0], c.at[1] + rotated[1]];
    });
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      builder.drawTrace(
        worldCorners[i][0],
        worldCorners[i][1],
        worldCorners[next][0],
        worldCorners[next][1],
        0.15
      );
    }
  }

  if (c.ref) {
    renderSilkText(builder, c.at, c.ref, 1.2, c.rot, side);
  }
}

/** Generates standard Excellon format drill file. */
export function exportExcellonDrill(board: Board, projectName: string): string {
  interface Hole {
    x: number;
    y: number;
    diam: number;
  }
  const holes: Hole[] = [];

  for (const v of board.vias) {
    holes.push({ x: v.at[0], y: v.at[1], diam: v.drill || 0.4 });
  }

  for (const c of board.components) {
    for (const p of c.pads) {
      if (p.drill && p.drill > 0) {
        const { at } = padWorld(c, p);
        holes.push({ x: at[0], y: at[1], diam: p.drill });
      }
    }
  }

  // Group by tool diameter (in mm, 3 decimal places)
  const toolMap = new Map<string, Hole[]>();
  for (const h of holes) {
    const key = h.diam.toFixed(3);
    let list = toolMap.get(key);
    if (!list) {
      list = [];
      toolMap.set(key, list);
    }
    list.push(h);
  }

  const sortedDiams = Array.from(toolMap.keys()).sort((a, b) => parseFloat(a) - parseFloat(b));

  const lines: string[] = [
    'M48',
    `; DRILL file for ${projectName}`,
    '; Generated by deadboard Industrial Exporter',
    'METRIC,TZ',
  ];

  if (sortedDiams.length === 0) {
    lines.push('T01C0.800');
    lines.push('%');
    lines.push('G90');
    lines.push('G05');
    lines.push('T01');
  } else {
    const toolNumMap = new Map<string, string>();
    sortedDiams.forEach((dStr, idx) => {
      const tNum = `T${String(idx + 1).padStart(2, '0')}`;
      toolNumMap.set(dStr, tNum);
      lines.push(`${tNum}C${dStr}`);
    });

    lines.push('%');
    lines.push('G90');
    lines.push('G05');

    for (const dStr of sortedDiams) {
      const tNum = toolNumMap.get(dStr)!;
      lines.push(tNum);
      const holeList = toolMap.get(dStr)!;
      for (const h of holeList) {
        lines.push(`X${toGerberCoord(h.x)}Y${toGerberCoord(h.y)}`);
      }
    }
  }

  lines.push('M30');
  return lines.join('\n');
}

/** Generates standard manufacturing layers for a PCB design. */
export function exportGerberLayers(board: Board, projectName = 'board'): GerberFile[] {
  const safeProject = projectName?.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'board';
  const files: GerberFile[] = [];

  // 1. Top Copper (F_Cu, .gtl)
  const fCu = new GerberBuilder();
  for (const t of board.traces) {
    if (t.layer === 'F') {
      fCu.drawTrace(t.a[0], t.a[1], t.b[0], t.b[1], t.w || 0.25);
    }
  }
  for (const v of board.vias) {
    if (!v.side || v.side === 'F') {
      fCu.flashCircle(v.at[0], v.at[1], v.d || 0.8);
    }
  }
  for (const b of board.blobs) {
    if (b.layer === 'F') {
      fCu.flashCircle(b.at[0], b.at[1], b.r * 2);
    }
  }
  for (const c of board.components) {
    for (const p of c.pads) {
      if (padHasLayer(c, p, 'F')) {
        const { at, rot: pRot } = padWorld(c, p);
        fCu.flashPad(at[0], at[1], p.shape, p.size, pRot);
      }
    }
  }
  for (const z of board.zones) {
    if (z.layer === 'F') {
      fCu.fillPolygon(z.poly);
    }
  }
  files.push({
    filename: `${safeProject}-F_Cu.gtl`,
    content: fCu.build(),
  });

  // 2. Bottom Copper (B_Cu, .gbl)
  const bCu = new GerberBuilder();
  for (const t of board.traces) {
    if (t.layer === 'B') {
      bCu.drawTrace(t.a[0], t.a[1], t.b[0], t.b[1], t.w || 0.25);
    }
  }
  for (const v of board.vias) {
    if (!v.side || v.side === 'B') {
      bCu.flashCircle(v.at[0], v.at[1], v.d || 0.8);
    }
  }
  for (const b of board.blobs) {
    if (b.layer === 'B') {
      bCu.flashCircle(b.at[0], b.at[1], b.r * 2);
    }
  }
  for (const c of board.components) {
    for (const p of c.pads) {
      if (padHasLayer(c, p, 'B')) {
        const { at, rot: pRot } = padWorld(c, p);
        bCu.flashPad(at[0], at[1], p.shape, p.size, pRot);
      }
    }
  }
  for (const z of board.zones) {
    if (z.layer === 'B') {
      bCu.fillPolygon(z.poly);
    }
  }
  files.push({
    filename: `${safeProject}-B_Cu.gbl`,
    content: bCu.build(),
  });

  // 3. Top Solder Mask (F_Mask, .gts)
  const fMask = new GerberBuilder();
  for (const c of board.components) {
    for (const p of c.pads) {
      if (padHasLayer(c, p, 'F')) {
        const { at, rot: pRot } = padWorld(c, p);
        fMask.flashPad(at[0], at[1], p.shape, p.size, pRot, 0.1);
      }
    }
  }
  files.push({
    filename: `${safeProject}-F_Mask.gts`,
    content: fMask.build(),
  });

  // 4. Bottom Solder Mask (B_Mask, .gbs)
  const bMask = new GerberBuilder();
  for (const c of board.components) {
    for (const p of c.pads) {
      if (padHasLayer(c, p, 'B')) {
        const { at, rot: pRot } = padWorld(c, p);
        bMask.flashPad(at[0], at[1], p.shape, p.size, pRot, 0.1);
      }
    }
  }
  files.push({
    filename: `${safeProject}-B_Mask.gbs`,
    content: bMask.build(),
  });

  // 5. Top Silkscreen (F_Silk, .gto)
  const fSilk = new GerberBuilder();
  for (const s of board.silk) {
    if (s.side === 'F') {
      fSilk.drawTrace(s.a[0], s.a[1], s.b[0], s.b[1], s.w || 0.15);
    }
  }
  for (const t of board.texts) {
    if (t.side === 'F') {
      renderSilkText(fSilk, t.at, t.text, t.size, t.rot ?? 0, 'F');
    }
  }
  for (const c of board.components) {
    if (c.side === 'F') {
      renderComponentSilk(fSilk, c, 'F');
    }
  }
  files.push({
    filename: `${safeProject}-F_Silk.gto`,
    content: fSilk.build(),
  });

  // 6. Bottom Silkscreen (B_Silk, .gbo)
  const bSilk = new GerberBuilder();
  for (const s of board.silk) {
    if (s.side === 'B') {
      bSilk.drawTrace(s.a[0], s.a[1], s.b[0], s.b[1], s.w || 0.15);
    }
  }
  for (const t of board.texts) {
    if (t.side === 'B') {
      renderSilkText(bSilk, t.at, t.text, t.size, t.rot ?? 0, 'B');
    }
  }
  for (const c of board.components) {
    if (c.side === 'B') {
      renderComponentSilk(bSilk, c, 'B');
    }
  }
  files.push({
    filename: `${safeProject}-B_Silk.gbo`,
    content: bSilk.build(),
  });

  // 7. Edge Cuts (Edge_Cuts, .gm1)
  const edgeCuts = new GerberBuilder();
  const w = board.w;
  const h = board.h;
  edgeCuts.drawTrace(0, 0, w, 0, 0.15);
  edgeCuts.drawTrace(w, 0, w, h, 0.15);
  edgeCuts.drawTrace(w, h, 0, h, 0.15);
  edgeCuts.drawTrace(0, h, 0, 0, 0.15);
  files.push({
    filename: `${safeProject}-Edge_Cuts.gm1`,
    content: edgeCuts.build(),
  });

  // 8. Excellon Drill (Drill, .drl)
  const drillContent = exportExcellonDrill(board, safeProject);
  files.push({
    filename: `${safeProject}-Drill.drl`,
    content: drillContent,
  });

  return files;
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

/** Computes IEEE 802.3 CRC-32 checksum. */
export function crc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Synchronously creates a standard RFC 1951 STORE-method ZIP archive. */
export function createSimpleZip(files: GerberFile[]): Uint8Array {
  const enc = new TextEncoder();
  const fileEntries = files.map((f) => {
    const data = enc.encode(f.content);
    const nameBytes = enc.encode(f.filename);
    const crc = crc32(data);
    return {
      filename: f.filename,
      nameBytes,
      data,
      crc,
      size: data.length,
    };
  });

  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  let totalSize = 0;
  for (const f of fileEntries) {
    totalSize += 30 + f.nameBytes.length + f.size;
  }
  let cdSize = 0;
  for (const f of fileEntries) {
    cdSize += 46 + f.nameBytes.length;
  }
  totalSize += cdSize + 22;

  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  let offset = 0;
  const offsets: number[] = [];

  for (const f of fileEntries) {
    offsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x0800, true); // UTF-8
    view.setUint16(offset + 8, 0, true); // STORE
    view.setUint16(offset + 10, dosTime, true);
    view.setUint16(offset + 12, dosDate, true);
    view.setUint32(offset + 14, f.crc, true);
    view.setUint32(offset + 18, f.size, true);
    view.setUint32(offset + 22, f.size, true);
    view.setUint16(offset + 26, f.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true);
    buf.set(f.nameBytes, offset + 30);
    buf.set(f.data, offset + 30 + f.nameBytes.length);
    offset += 30 + f.nameBytes.length + f.size;
  }

  const cdStart = offset;
  for (let i = 0; i < fileEntries.length; i++) {
    const f = fileEntries[i];
    const localOffset = offsets[i];
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true); // UTF-8
    view.setUint16(offset + 10, dosTime, true);
    view.setUint16(offset + 12, dosDate, true);
    view.setUint16(offset + 14, 0, true);
    view.setUint32(offset + 16, f.crc, true);
    view.setUint32(offset + 20, f.size, true);
    view.setUint32(offset + 24, f.size, true);
    view.setUint16(offset + 28, f.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, 0, true);
    view.setUint32(offset + 42, localOffset, true);
    buf.set(f.nameBytes, offset + 46);
    offset += 46 + f.nameBytes.length;
  }

  // End of Central Directory (EOCD)
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, fileEntries.length, true);
  view.setUint16(offset + 10, fileEntries.length, true);
  view.setUint32(offset + 12, cdSize, true);
  view.setUint32(offset + 16, cdStart, true);
  view.setUint16(offset + 20, 0, true);

  return buf;
}

/** Exports all Gerber RS-274X manufacturing layers and drill file packed into a ZIP archive. */
export function exportGerberZip(board: Board, projectName = 'board'): GerberExportResult {
  const safeProject = projectName?.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'board';
  const files = exportGerberLayers(board, safeProject);
  const zipBuffer = createSimpleZip(files);
  return {
    zipBuffer,
    files,
    filename: `${safeProject}_gerbers.zip`,
  };
}
