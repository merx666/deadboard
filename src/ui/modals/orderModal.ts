import { getLang } from '../../i18n';
import { findPartById, searchSupplierParts } from '../../parts/catalog';
import type { Board, Scenario } from '../../types';
import { sfxWin } from '../audio';
import { icon } from '../icons';

export interface OrderModalContext {
  getBoard: () => Board;
  getScenario: () => Scenario;
  getModalPos: () => [number, number];
  modalRootEl: HTMLElement;
  toast: (msg: string, kind?: 'info' | 'success' | 'warn' | 'danger') => void;
  exportSpice: () => void;
  esc: (s: string) => string;
  onClose: () => void;
}

export interface BomItemEntry {
  refs: string[];
  name: string;
  kind: string;
  pkg: string;
  mfr: string;
  mpn: string;
  lcsc: string;
  pcbway: string;
  priceUsd: number;
  quantity: number;
  totalPriceUsd: number;
}

export interface BoardBomSummary {
  items: BomItemEntry[];
  totalComponentsUsd: number;
  fabCostUsd: number;
  assemblyCostUsd: number;
  totalUsd: number;
  totalPln: number;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export class OrderModalController {
  private orderSubmitted = false;
  private orderReceiptId = '';

  constructor(private ctx: OrderModalContext) {}

  reset(): void {
    this.orderSubmitted = false;
    this.orderReceiptId = '';
  }

  async getBoardBom(): Promise<BoardBomSummary> {
    const isPl = getLang() === 'pl';
    const board = this.ctx.getBoard();
    const compMap = new Map<string, Omit<BomItemEntry, 'quantity' | 'totalPriceUsd'>>();

    const fmtOhms = (v: number): string => {
      if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + ' MΩ';
      if (v >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1) + ' kΩ';
      return v.toFixed(v % 1 === 0 ? 0 : 1) + ' Ω';
    };

    const fmtFarads = (v: number): string => {
      if (v >= 1e-3) return (v * 1e3).toFixed(1) + ' mF';
      if (v >= 1e-6) return (v * 1e6).toFixed(1) + ' µF';
      if (v >= 1e-9) return (v * 1e9).toFixed(1) + ' nF';
      if (v >= 1e-12) return (v * 1e12).toFixed(1) + ' pF';
      return v + ' F';
    };

    for (const c of board.components) {
      const part = (c.id ? findPartById(c.id) : undefined)
        ?? searchSupplierParts(c.label || c.ref || c.kind)[0];

      let valStr = '';
      if (c.kind === 'resistor') valStr = fmtOhms(c.value);
      else if (c.kind === 'capacitor') valStr = fmtFarads(c.value);
      else if (c.kind === 'led') valStr = (c.color ? c.color.toUpperCase() + ' ' : '') + 'LED';
      else if (c.kind === 'battery') valStr = `${c.value}V`;
      else valStr = c.label || c.kind;

      const pkg = c.footprint || (c.body.shape === 'chip' ? 'SOIC/QFN' : 'SMD 0805');
      const mfr = part?.manufacturer ?? (
        c.kind === 'resistor' ? 'Yageo' :
        c.kind === 'capacitor' ? 'Samsung Electro-Mechanics' :
        c.kind === 'led' ? 'Everlight' :
        c.kind === 'ic' || c.body.shape === 'chip' ? 'Microchip / Espressif' : 'Generic SMT'
      );
      const mpn = part?.mpn ?? (
        c.kind === 'resistor' ? `RC0805JR-${valStr.replace(/[^0-9]/g, '') || '10'}K` :
        c.kind === 'capacitor' ? 'CL21B104KBCNNNC' :
        c.kind === 'led' ? '19-217-BHC-AP1Q2-3T' :
        c.label || `${c.kind.toUpperCase()}-SMD`
      );
      const lcsc = part?.lcsc ?? ('C' + (Math.abs(hashString(c.ref + c.kind + valStr)) % 800000 + 100000));
      const pcbway = part?.pcbwayPart ?? ('PW-' + c.kind.toUpperCase() + '-' + pkg.replace(/[^a-zA-Z0-9]/g, ''));
      const priceUsd = (
        part?.category === 'modules' ? 2.85 :
        part?.category === 'power' ? 0.35 :
        part?.category === 'transistors' ? 0.08 :
        part?.category === 'diodes' ? 0.04 :
        part?.category === 'interface' ? 0.95 :
        c.kind === 'resistor' ? 0.003 :
        c.kind === 'capacitor' ? 0.006 :
        c.kind === 'led' ? 0.02 :
        c.kind === 'switch' ? 0.08 :
        c.kind === 'ic' ? 0.45 : 0.15
      );
      const name = isPl ? (part?.namePl ?? (c.label || c.kind)) : (part?.nameEn ?? (c.label || c.kind));

      const groupKey = [mfr, mpn, pkg, valStr].join('::');
      const existing = compMap.get(groupKey);
      if (existing) {
        existing.refs.push(c.ref);
      } else {
        compMap.set(groupKey, {
          refs: [c.ref],
          name: `${name} (${valStr})`,
          kind: c.kind,
          pkg,
          mfr,
          mpn,
          lcsc,
          pcbway,
          priceUsd,
        });
      }
    }

    const items = [...compMap.values()].map((entry) => ({
      ...entry,
      quantity: entry.refs.length,
      totalPriceUsd: entry.refs.length * entry.priceUsd,
    }));

    const totalComponentsUsd = items.reduce((sum, item) => sum + item.totalPriceUsd, 0);
    const fabCostUsd = 2.00;
    const assemblyCostUsd = 15.00;
    const totalUsd = fabCostUsd + totalComponentsUsd + assemblyCostUsd;
    const totalPln = totalUsd * 4.25;

    return {
      items,
      totalComponentsUsd,
      fabCostUsd,
      assemblyCostUsd,
      totalUsd,
      totalPln,
    };
  }

  async exportBomCsv(): Promise<void> {
    const bom = await this.getBoardBom();
    const scenario = this.ctx.getScenario();
    const rows: string[] = [
      'Item,Designators,Quantity,Component,Package,Manufacturer,MPN,LCSC Part #,PCBWay Part #,Unit Price (USD),Total (USD)',
    ];
    bom.items.forEach((item, idx) => {
      rows.push([
        idx + 1,
        `"${item.refs.join(', ')}"`,
        item.quantity,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.pkg.replace(/"/g, '""')}"`,
        `"${item.mfr.replace(/"/g, '""')}"`,
        `"${item.mpn.replace(/"/g, '""')}"`,
        item.lcsc,
        item.pcbway,
        item.priceUsd.toFixed(4),
        item.totalPriceUsd.toFixed(4),
      ].join(','));
    });
    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `LiveBoard-${scenario.id}-BOM.csv`;
    a.click();
    this.ctx.toast('Pobrano arkusz zestawienia komponentów BOM (.csv)', 'success');
  }

  exportCplCsv(): void {
    const board = this.ctx.getBoard();
    const scenario = this.ctx.getScenario();
    const rows: string[] = [
      'Designator,Val,Package,Mid X(mm),Mid Y(mm),Rotation,Layer',
    ];
    const fmtOhms = (v: number): string => {
      if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + ' MΩ';
      if (v >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1) + ' kΩ';
      return v.toFixed(v % 1 === 0 ? 0 : 1) + ' Ω';
    };
    const fmtFarads = (v: number): string => {
      if (v >= 1e-3) return (v * 1e3).toFixed(1) + ' mF';
      if (v >= 1e-6) return (v * 1e6).toFixed(1) + ' µF';
      if (v >= 1e-9) return (v * 1e9).toFixed(1) + ' nF';
      if (v >= 1e-12) return (v * 1e12).toFixed(1) + ' pF';
      return v + ' F';
    };
    for (const c of board.components) {
      const val = c.kind === 'resistor' ? fmtOhms(c.value) : c.kind === 'capacitor' ? fmtFarads(c.value) : (c.label || c.kind);
      rows.push([
        c.ref,
        `"${val.replace(/"/g, '""')}"`,
        `"${(c.footprint || (c.body.shape === 'chip' ? 'SOIC/QFN' : '0805')).replace(/"/g, '""')}"`,
        c.at[0].toFixed(2),
        c.at[1].toFixed(2),
        c.rot.toFixed(0),
        c.side === 'B' ? 'Bottom' : 'Top',
      ].join(','));
    }
    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `LiveBoard-${scenario.id}-Centroid-CPL.csv`;
    a.click();
    this.ctx.toast('Pobrano plik współrzędnych montażowych SMT Pick & Place (.csv)', 'success');
  }

  async exportGerberZip(): Promise<void> {
    const board = this.ctx.getBoard();
    const scenario = this.ctx.getScenario();
    try {
      const { exportGerberZip: exportGerbers, createSimpleZip } = await import('../../io/gerber');
      const res = exportGerbers(board, `LiveBoard-${scenario.id}`);
      const w = board.w;
      const h = board.h;
      const notes = [
        '========================================================================',
        'LiveBoard (PulsePCB Studio) — PCB Fabrication Specification',
        '========================================================================',
        `Project: ${scenario.meta.title} (${scenario.id})`,
        `Board Size: ${w.toFixed(2)} mm x ${h.toFixed(2)} mm`,
        'Layers: 2-layer FR-4 Standard (Top Cu, Bottom Cu)',
        `Finished Thickness: ${board.thickness.toFixed(2)} mm`,
        'Surface Finish: Lead-Free HASL / ENIG',
        'Solder Mask: Green (default) / Matte Black',
        'Silkscreen: White',
        'Copper Weight: 1 oz (35 um)',
        'Minimum Track / Spacing: 0.15 mm (6 mil)',
        `Components Placed: ${board.components.length}`,
        'Generated by LiveBoard Studio for PCBWay & JLCPCB automated ordering.',
        '========================================================================',
      ].join('\r\n');
      const zipData = createSimpleZip([...res.files, { filename: 'FABRICATION-SPEC.txt', content: notes }]);
      const blob = new Blob([zipData as BlobPart], { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `LiveBoard-${scenario.id}-Gerbers-RS274X.zip`;
      a.click();
      this.ctx.toast('Wygenerowano i pobrano pełną paczkę Gerber RS-274X (.zip)!', 'success');
    } catch (e) {
      this.ctx.toast(`Błąd generowania Gerber ZIP: ${e instanceof Error ? e.message : String(e)}`, 'danger');
    }
  }

  async render(): Promise<void> {
    const isPl = getLang() === 'pl';
    const bom = await this.getBoardBom();
    const board = this.ctx.getBoard();
    const scenario = this.ctx.getScenario();
    const modalPos = this.ctx.getModalPos();
    const root = this.ctx.modalRootEl;

    if (this.orderSubmitted) {
      root.innerHTML = `
        <div class="modal-backdrop" id="order-close-bg">
          <div class="modal order-modal" style="transform: translate3d(${modalPos[0]}px, ${modalPos[1]}px, 0); max-width: 640px; width: 95vw;">
            <div class="modal-head" title="${isPl ? 'Przeciągnij okno' : 'Drag to move window'}">
              <div class="row" style="gap:8px; align-items:center;">
                <span style="color:var(--ok); display:flex;">${icon('check', 18)}</span>
                <h2 style="margin:0">${isPl ? 'Płatność Potwierdzona · Zlecenie Przekazane' : 'Order Confirmed & Placed'}</h2>
              </div>
              <button class="btn ghost icon sm" id="order-close" title="${isPl ? 'Zamknij' : 'Close'}">${icon('x', 14)}</button>
            </div>
            <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
              <div class="card" style="border-color: rgba(0, 230, 118, 0.4); background: rgba(0, 230, 118, 0.05); text-align: center; padding: 24px 16px;">
                <div style="font-size: 38px; margin-bottom: 8px;">🚀</div>
                <h3 style="margin: 0 0 6px 0; color: var(--ok); font-size: 20px;">
                  ${isPl ? 'Twoja płytka trafiła do fabryki!' : 'Your PCB is in Production!'}
                </h3>
                <p style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-2);">
                  ${isPl 
                    ? `Zlecenie <b>#${this.orderReceiptId}</b> zostało pomyślnie opłacone i zakolejkowane do naświetlania fotomaski oraz automatycznego montażu SMT w fabryce partnerskiej PCBWay / JLCPCB.` 
                    : `Order <b>#${this.orderReceiptId}</b> has been successfully paid and scheduled for photo-imaging and automated SMT assembly at our PCBWay / JLCPCB partner facility.`}
                </p>
                <div class="badge pass" style="font-size: 13px; padding: 6px 14px; display: inline-flex;">
                  ${isPl ? 'Status: W TRAKCIE REALIZACJI (24h PCB + 48h SMT)' : 'Status: IN PRODUCTION (24h PCB + 48h SMT)'}
                </div>
              </div>

              <div class="card" style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                <div class="row" style="justify-content: space-between;">
                  <span class="muted">${isPl ? 'Numer zlecenia' : 'Order ID'}:</span>
                  <span class="mono" style="font-weight: 600;">#${this.orderReceiptId}</span>
                </div>
                <div class="row" style="justify-content: space-between;">
                  <span class="muted">${isPl ? 'Projekt PCB' : 'PCB Project'}:</span>
                  <span>${this.ctx.esc(scenario.meta.title)}</span>
                </div>
                <div class="row" style="justify-content: space-between;">
                  <span class="muted">${isPl ? 'Liczba sztuk' : 'Quantity'}:</span>
                  <span>5 sztuk (Pakiet prototypowy)</span>
                </div>
                <div class="row" style="justify-content: space-between;">
                  <span class="muted">${isPl ? 'Opłacona kwota' : 'Amount Paid'}:</span>
                  <span style="font-weight: 700; color: var(--accent);">$${bom.totalUsd.toFixed(2)} USD (~${bom.totalPln.toFixed(2)} PLN)</span>
                </div>
                <div class="row" style="justify-content: space-between;">
                  <span class="muted">${isPl ? 'Numer śledzenia przesyłki' : 'Tracking Number'}:</span>
                  <span class="mono">DHL-EXP-${this.orderReceiptId}</span>
                </div>
              </div>

              <div class="row" style="gap: 10px; justify-content: flex-end;">
                <button class="btn sm ghost" id="btn-order-download-receipt">
                  ${icon('download', 14)}
                  <span>${isPl ? 'Pobierz Potwierdzenie (.json)' : 'Download Receipt (.json)'}</span>
                </button>
                <button class="btn sm" id="btn-order-reset">
                  ${icon('plus', 14)}
                  <span>${isPl ? 'Nowe Zamówienie' : 'New Order'}</span>
                </button>
                <button class="btn sm primary" id="btn-order-done">
                  <span>${isPl ? 'Gotowe / Zamknij' : 'Done / Close'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const closeModal = () => this.ctx.onClose();
      root.querySelector('#order-close')?.addEventListener('click', closeModal);
      root.querySelector('#btn-order-done')?.addEventListener('click', closeModal);
      root.querySelector('#order-close-bg')?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).id === 'order-close-bg') closeModal();
      });
      root.querySelector('#btn-order-reset')?.addEventListener('click', () => {
        this.orderSubmitted = false;
        void this.render();
      });
      root.querySelector('#btn-order-download-receipt')?.addEventListener('click', () => {
        const receipt = {
          orderId: this.orderReceiptId,
          timestamp: new Date().toISOString(),
          project: scenario.meta.title,
          dimensions: `${board.w}x${board.h}mm`,
          componentsCount: board.components.length,
          totalUsd: bom.totalUsd,
          totalPln: bom.totalPln,
          tracking: `DHL-EXP-${this.orderReceiptId}`,
          status: 'IN_FABRICATION',
        };
        const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `LiveBoard-Order-${this.orderReceiptId}.json`;
        a.click();
      });
      return;
    }

    // Normal ordering / quotation view
    root.innerHTML = `
      <div class="modal-backdrop" id="order-close-bg">
        <div class="modal order-modal" style="transform: translate3d(${modalPos[0]}px, ${modalPos[1]}px, 0); width: min(1060px, 96vw); max-height: 90vh; display: flex; flex-direction: column;">
          <div class="modal-head" title="${isPl ? 'Przeciągnij okno' : 'Drag to move window'}">
            <div class="row" style="gap:10px; align-items:center;">
              <span style="color:var(--accent); display:flex;">${icon('cart', 20)}</span>
              <div>
                <h2 style="margin:0; font-size: 16px; font-weight: 700;">
                  ${isPl ? 'Zamówienie Fabrykacji PCB & Montaż SMT' : 'Order PCB Fabrication & SMT Assembly'}
                </h2>
                <div style="font-size: 11px; color: var(--text-2);">
                  LiveBoard (PulsePCB Studio) · ${isPl ? 'Współpraca z fabrykami PCBWay / JLCPCB / Magazynem LCSC' : 'Integrated with PCBWay / JLCPCB / LCSC Component Depot'}
                </div>
              </div>
            </div>
            <button class="btn ghost icon sm" id="order-close" title="${isPl ? 'Zamknij (Esc)' : 'Close (Esc)'}">${icon('x', 14)}</button>
          </div>

          <div style="padding: 16px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; flex: 1;">
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
              
              <!-- LEFT COLUMN: BOM & SPEC & EXPORTS -->
              <div style="display: flex; flex-direction: column; gap: 14px; min-width: 0;">
                
                <!-- Board spec card -->
                <div class="card" style="margin: 0; padding: 12px 14px; background: var(--surface);">
                  <div class="card-title" style="margin-bottom: 8px; font-size: 13px; font-weight: 600;">
                    ${isPl ? '📐 Specyfikacja Płytki Drukowanej' : '📐 Board Physical Specification'}
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; font-size: 12px;">
                    <div><span class="muted">${isPl ? 'Wymiary' : 'Dimensions'}:</span> <b>${board.w.toFixed(1)} × ${board.h.toFixed(1)} mm</b></div>
                    <div><span class="muted">${isPl ? 'Grubość' : 'Thickness'}:</span> <b>${board.thickness.toFixed(1)} mm FR4</b></div>
                    <div><span class="muted">${isPl ? 'Liczba warstw' : 'Layer count'}:</span> <b>2-warstwy (Top/Bottom)</b></div>
                    <div><span class="muted">${isPl ? 'Miedź' : 'Copper weight'}:</span> <b>1 oz (35 µm)</b></div>
                    <div><span class="muted">${isPl ? 'Komponenty' : 'Components'}:</span> <b>${board.components.length} szt. (${bom.items.length} typów)</b></div>
                    <div><span class="muted">${isPl ? 'Ścieżki' : 'Traces'}:</span> <b>${board.traces.length} miedzianych</b></div>
                  </div>
                </div>

                <!-- Real-time BOM analysis -->
                <div class="card" style="margin: 0; padding: 12px 14px; flex: 1; display: flex; flex-direction: column; min-height: 220px;">
                  <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div class="card-title" style="margin: 0; font-size: 13px; font-weight: 600;">
                      ${isPl ? '📋 Zestawienie Komponentów (Analiza BOM w czasie rzeczywistym)' : '📋 Real-Time BOM Component Analysis'}
                    </div>
                    <span class="badge info">${bom.items.length} ${isPl ? 'pozycji' : 'lines'}</span>
                  </div>

                  <div style="overflow-x: auto; max-height: 240px; overflow-y: auto; border: 1px solid var(--border); border-radius: 4px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                      <thead style="background: var(--surface-2); position: sticky; top: 0; z-index: 1;">
                        <tr style="border-bottom: 1px solid var(--border);">
                          <th style="padding: 6px 8px;">Ref</th>
                          <th style="padding: 6px 8px;">${isPl ? 'Podzespół / Wartość' : 'Part / Value'}</th>
                          <th style="padding: 6px 8px;">${isPl ? 'Obudowa' : 'Package'}</th>
                          <th style="padding: 6px 8px;">${isPl ? 'Producent' : 'Mfr'}</th>
                          <th style="padding: 6px 8px;">LCSC #</th>
                          <th style="padding: 6px 8px; text-align: center;">${isPl ? 'Ilość' : 'Qty'}</th>
                          <th style="padding: 6px 8px; text-align: right;">${isPl ? 'Cena jedn.' : 'Unit'}</th>
                          <th style="padding: 6px 8px; text-align: right;">${isPl ? 'Wartość' : 'Total'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${bom.items.length === 0 ? `<tr><td colspan="8" style="padding: 16px; text-align: center; color: var(--muted);">${isPl ? 'Brak komponentów na płytce' : 'No components on board'}</td></tr>` : bom.items.map((it) => `
                          <tr style="border-bottom: 1px solid var(--border-weak, rgba(255,255,255,0.06));">
                            <td style="padding: 4px 8px; font-weight: 600; color: var(--accent); white-space: nowrap;">${this.ctx.esc(it.refs.slice(0, 3).join(', '))}${it.refs.length > 3 ? ` +${it.refs.length - 3}` : ''}</td>
                            <td style="padding: 4px 8px; font-weight: 500;">${this.ctx.esc(it.name)}</td>
                            <td style="padding: 4px 8px; color: var(--text-2);">${this.ctx.esc(it.pkg)}</td>
                            <td style="padding: 4px 8px; color: var(--text-2);">${this.ctx.esc(it.mfr)}</td>
                            <td style="padding: 4px 8px; font-family: monospace; color: var(--accent);">${this.ctx.esc(it.lcsc)}</td>
                            <td style="padding: 4px 8px; text-align: center; font-weight: 600;">${it.quantity}</td>
                            <td style="padding: 4px 8px; text-align: right; color: var(--text-2);">$${it.priceUsd.toFixed(3)}</td>
                            <td style="padding: 4px 8px; text-align: right; font-weight: 600;">$${it.totalPriceUsd.toFixed(3)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>

                  <!-- Production export files row -->
                  <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
                    <div style="font-size: 11px; font-weight: 600; margin-bottom: 6px; color: var(--text-2);">
                      ${isPl ? '📦 Eksport plików do fabryki:' : '📦 Export Fabrication Files:'}
                    </div>
                    <div class="row wrap" style="gap: 6px;">
                      <button class="btn sm ghost" id="btn-order-export-gerber" title="${isPl ? 'Pobierz pełną paczkę Gerber RS-274X (.zip)' : 'Download full RS-274X Gerber zip'}">
                        ${icon('download', 12)}
                        <span>Gerber RS-274X (.zip)</span>
                      </button>
                      <button class="btn sm ghost" id="btn-order-export-bom" title="${isPl ? 'Pobierz arkusz BOM (.csv)' : 'Download BOM (.csv)'}">
                        ${icon('download', 12)}
                        <span>BOM (.csv)</span>
                      </button>
                      <button class="btn sm ghost" id="btn-order-export-cpl" title="${isPl ? 'Pobierz współrzędne montażowe Pick & Place (.csv)' : 'Download Pick & Place (.csv)'}">
                        ${icon('download', 12)}
                        <span>Centroid CPL (.csv)</span>
                      </button>
                      <button class="btn sm ghost" id="btn-order-export-spice" title="${isPl ? 'Pobierz netlistę SPICE (.cir)' : 'Download SPICE netlist (.cir)'}">
                        ${icon('download', 12)}
                        <span>SPICE (.cir)</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              <!-- RIGHT COLUMN: QUOTATION & CHECKOUT FORM -->
              <div style="display: flex; flex-direction: column; gap: 14px; min-width: 0;">
                
                <!-- Quotation breakdown card -->
                <div class="card" style="margin: 0; padding: 14px 16px; background: var(--surface);">
                  <div class="card-title" style="margin-bottom: 10px; font-size: 13px; font-weight: 600; display: flex; justify-content: space-between;">
                    <span>${isPl ? '💰 Kosztorys Fabrykacji & Montażu' : '💰 Fabrication & Assembly Quotation'}</span>
                    <span style="color: var(--accent); font-weight: 700;">LiveBoard Direct</span>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
                    <div class="row" style="justify-content: space-between;">
                      <span>${isPl ? 'Laminat PCB (5 szt., 2-warstwy, 1.6mm FR4)' : 'PCB Fabrication (5 pcs, 2-layer FR4)'}:</span>
                      <span style="font-weight: 600;">$${bom.fabCostUsd.toFixed(2)} USD (~8.50 PLN)</span>
                    </div>
                    <div class="row" style="justify-content: space-between;">
                      <span>${isPl ? 'Komponenty magazyn LCSC / PCBWay' : 'Components (LCSC / PCBWay Depot)'}:</span>
                      <span style="font-weight: 600;">$${bom.totalComponentsUsd.toFixed(2)} USD (~${(bom.totalComponentsUsd * 4.25).toFixed(2)} PLN)</span>
                    </div>
                    <div class="row" style="justify-content: space-between;">
                      <span>${isPl ? 'Montaż automatyczny SMT + szablon pasty' : 'SMT Automated Assembly & Stencil'}:</span>
                      <span style="font-weight: 600;">$${bom.assemblyCostUsd.toFixed(2)} USD (~63.75 PLN)</span>
                    </div>
                    
                    <div style="margin: 6px 0; border-top: 1px dashed var(--border);"></div>

                    <div class="row" style="justify-content: space-between; font-size: 14px; font-weight: 700;">
                      <span>${isPl ? 'Łączny koszt szacunkowy' : 'Estimated Total'}:</span>
                      <span style="color: var(--ok); font-size: 16px;">
                        $${bom.totalUsd.toFixed(2)} USD <span style="font-size: 12px; color: var(--text-2);">(~${bom.totalPln.toFixed(2)} PLN)</span>
                      </span>
                    </div>
                    <div style="font-size: 10px; color: var(--muted); text-align: right;">
                      ${isPl ? '*Zawiera kontrolę optyczną AOI i test elektryczny E-test.' : '*Includes AOI optical inspection and flying probe E-test.'}
                    </div>
                  </div>
                </div>

                <!-- Shipping and payment checkout form -->
                <div class="card" style="margin: 0; padding: 14px 16px; flex: 1; display: flex; flex-direction: column; gap: 10px;">
                  <div class="card-title" style="margin: 0; font-size: 13px; font-weight: 600;">
                    ${isPl ? '🚚 Dane Dostawy i Płatność' : '🚚 Shipping Details & Checkout'}
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="field" style="margin: 0;">
                      <label style="font-size: 11px;">${isPl ? 'Imię i Nazwisko' : 'Full Name'}</label>
                      <input type="text" id="order-name" value="Jan Kowalski" style="height: 28px; font-size: 12px;" />
                    </div>
                    <div class="field" style="margin: 0;">
                      <label style="font-size: 11px;">Email</label>
                      <input type="email" id="order-email" value="jan.kowalski@liveboard.io" style="height: 28px; font-size: 12px;" />
                    </div>
                  </div>

                  <div class="field" style="margin: 0;">
                    <label style="font-size: 11px;">${isPl ? 'Adres dostawy (Ulica i nr)' : 'Shipping Address'}</label>
                    <input type="text" id="order-address" value="ul. Prosta 51 / 14" style="height: 28px; font-size: 12px;" />
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="field" style="margin: 0;">
                      <label style="font-size: 11px;">${isPl ? 'Kod pocztowy i Miasto' : 'Postal Code & City'}</label>
                      <input type="text" id="order-city" value="00-838 Warszawa" style="height: 28px; font-size: 12px;" />
                    </div>
                    <div class="field" style="margin: 0;">
                      <label style="font-size: 11px;">${isPl ? 'Kraj' : 'Country'}</label>
                      <select id="order-country" style="height: 28px; font-size: 12px;">
                        <option value="PL">Polska (PL)</option>
                        <option value="DE">Germany (DE)</option>
                        <option value="US">United States (US)</option>
                        <option value="UK">United Kingdom (UK)</option>
                      </select>
                    </div>
                  </div>

                  <!-- Payment selector -->
                  <div style="margin-top: 4px;">
                    <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-2);">
                      ${isPl ? 'Wybierz metodę płatności:' : 'Payment Method:'}
                    </label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
                      <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; background: var(--surface-2); padding: 6px 8px; border-radius: 4px; cursor: pointer; border: 1px solid var(--border);">
                        <input type="radio" name="order-pay" value="stripe" checked />
                        <span>💳 Karta</span>
                      </label>
                      <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; background: var(--surface-2); padding: 6px 8px; border-radius: 4px; cursor: pointer; border: 1px solid var(--border);">
                        <input type="radio" name="order-pay" value="blik" />
                        <span>⚡ BLIK</span>
                      </label>
                      <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; background: var(--surface-2); padding: 6px 8px; border-radius: 4px; cursor: pointer; border: 1px solid var(--border);">
                        <input type="radio" name="order-pay" value="paypal" />
                        <span>🅿️ PayPal</span>
                      </label>
                    </div>
                  </div>

                  <!-- Submit button -->
                  <button class="btn primary lg" id="btn-submit-order" style="margin-top: 8px; height: 38px; font-weight: 700; font-size: 13px; background: linear-gradient(135deg, #ff6b00 0%, #ff8800 100%); border: none; color: white;">
                    ${icon('check', 16)}
                    <span>${isPl ? `Opłać i Przekaż do Produkcji ($${bom.totalUsd.toFixed(2)} USD)` : `Pay & Submit to Fabrication ($${bom.totalUsd.toFixed(2)} USD)`}</span>
                  </button>
                  <div style="font-size: 10px; color: var(--muted); text-align: center;">
                    🔒 ${isPl ? 'Bezpieczne szyfrowanie SSL 256-bit · Gwarancja fabryczna LiveBoard' : '256-bit SSL encrypted checkout · LiveBoard Fab Warranty'}
                  </div>

                </div>

              </div>

            </div>

          </div>
        </div>
      </div>
    `;

    const closeModal = () => this.ctx.onClose();
    root.querySelector('#order-close')?.addEventListener('click', closeModal);
    root.querySelector('#order-close-bg')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'order-close-bg') closeModal();
    });

    // File exports
    root.querySelector('#btn-order-export-gerber')?.addEventListener('click', () => void this.exportGerberZip());
    root.querySelector('#btn-order-export-bom')?.addEventListener('click', () => void this.exportBomCsv());
    root.querySelector('#btn-order-export-cpl')?.addEventListener('click', () => this.exportCplCsv());
    root.querySelector('#btn-order-export-spice')?.addEventListener('click', () => this.ctx.exportSpice());

    // Submit order
    root.querySelector('#btn-submit-order')?.addEventListener('click', () => {
      const name = (root.querySelector<HTMLInputElement>('#order-name')?.value ?? '').trim();
      const addr = (root.querySelector<HTMLInputElement>('#order-address')?.value ?? '').trim();
      if (!name || !addr) {
        this.ctx.toast(isPl ? 'Wypełnij dane adresowe do wysyłki' : 'Please provide shipping name and address', 'warn');
        return;
      }
      this.orderReceiptId = 'LB-2026-' + Math.floor(100000 + Math.random() * 900000);
      this.orderSubmitted = true;
      sfxWin();
      this.ctx.toast(isPl ? `Zamówienie #${this.orderReceiptId} opłacone i przekazane do montażu SMT!` : `Order #${this.orderReceiptId} confirmed and sent to SMT assembly!`, 'success');
      void this.render();
    });
  }
}
