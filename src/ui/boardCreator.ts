// Interactive Custom Board Builder & Supplier Parts Catalog (PCBWay / LCSC / DigiKey)
import { searchSupplierParts, type ComponentPart } from '../parts/catalog';
import { BOARD_PRESETS } from '../boards/presets';
import { Builder } from '../scenarios/builder';
import type { Scenario } from '../types';
import { getLang } from '../i18n';
import { writeZip } from '../mods/zip';
import { icon } from './icons';

export type FaultKind = 'none' | 'short-rail' | 'cold-joint' | 'reversed-diode' | 'blown-fuse';

export interface BoardCreatorOptions {
  onLoadScenario: (scenario: Scenario) => void;
  onClose: () => void;
  toast: (msg: string, kind?: 'info' | 'warn' | 'success') => void;
}

export class BoardCreatorModal {
  private el: HTMLElement;
  private opts: BoardCreatorOptions;
  private activeTab: 'builder' | 'catalog' = 'builder';
  private selectedPresetId: string = 'preset-esp32-devkit';
  private customWidth = 80;
  private customHeight = 50;
  private customColor = '#124422';
  private searchQuery = '';
  private selectedCategory = 'all';
  private injectFault: FaultKind = 'none';

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
  }

  show() {
    this.render();
    document.body.appendChild(this.el);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  close() {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.el.remove();
    this.opts.onClose();
  }

  private render() {
    const isPl = getLang() === 'pl';

    this.el.innerHTML = `
      <div class="modal" style="width: min(920px, 94vw); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;" role="dialog" aria-modal="true" aria-labelledby="creator-title">
        <!-- Header -->
        <div class="modal-head" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border);">
          <div class="row" style="gap: 10px; align-items: center;">
            <div style="color: var(--accent);">${icon('grid', 20)}</div>
            <div>
              <h2 id="creator-title" style="margin: 0; font-size: 17px; font-weight: 700;">
                ${isPl ? 'Kreator Płytek & Baza Komponentów PCBWay / LCSC' : 'Board Creator & PCBWay / LCSC Parts Database'}
              </h2>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
                ${isPl ? 'Projektuj obwody, wstrzykuj usterki do wyzwań i dobieraj części produkcyjne' : 'Design circuits, inject faults for challenges, and source production components'}
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
            ${icon('edit', 14)}<span>${isPl ? 'Kreator Obwodów i Modyfikacji' : 'Circuit & Mod Builder'}</span>
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
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Board preset selector -->
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text);">
            ${isPl ? '1. Wybierz szablon startowy płytki lub modułu:' : '1. Select starting board or module template:'}
          </label>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
            <div class="card preset-card ${this.selectedPresetId === 'custom-blank' ? 'active-preset' : ''}"
                 data-preset="custom-blank"
                 style="cursor: pointer; padding: 12px; border: 1px solid ${this.selectedPresetId === 'custom-blank' ? 'var(--accent)' : 'var(--border)'}; background: var(--surface);">
              <div style="font-weight: 700; color: var(--accent); font-size: 14px;">+ ${isPl ? 'Czysty laminat PCB' : 'Blank Prototyping PCB'}</div>
              <p style="font-size: 12px; color: var(--text-2); margin: 4px 0 0;">${isPl ? 'Pusta płytka o zadanych wymiarach z punktami lutowniczymi.' : 'Clean blank PCB board with custom dimensions.'}</p>
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

        <!-- Action buttons -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 6px;">
          <button class="btn primary" id="btn-load-bench" style="justify-content: center; font-size: 14px;">
            ${icon('check', 16)}<span>${isPl ? 'Załaduj na stół warsztatowy' : 'Load onto Workbench'}</span>
          </button>
          <button class="btn ghost" id="btn-export-json" style="justify-content: center;">
            ${icon('save', 16)}<span>${isPl ? 'Pobierz (.pcbfix.json)' : 'Download (.pcbfix.json)'}</span>
          </button>
          <button class="btn ghost" id="btn-export-mod" style="justify-content: center;">
            ${icon('share', 16)}<span>${isPl ? 'Eksportuj jako Mod (.zip)' : 'Export as Mod (.zip)'}</span>
          </button>
        </div>
      </div>
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
    }
  }

  private generateScenario(): Scenario {
    let sc: Scenario;

    if (this.selectedPresetId === 'custom-blank') {
      const b = new Builder(this.customWidth, this.customHeight);
      b.text([this.customWidth / 2, 4], 'CUSTOM PROTOTYPING BOARD', 1.8);
      b.text([this.customWidth / 2, this.customHeight - 4], 'DESIGNED WITH DEADBOARD STUDIO', 1.2);
      const board = b.b;
      board.color = this.customColor;

      sc = {
        format: 'pcbfix/1',
        id: `custom-board-${Date.now().toString(36)}`,
        meta: {
          title: `Custom Board (${this.customWidth}x${this.customHeight}mm)`,
          author: 'DEADBOARD Maker',
          difficulty: 1,
          description: 'Własny projekt płytki PCB przygotowany w warsztacie DEADBOARD.',
          hints: ['Użyj narzędzi lutownicy i magazynu części do obsadzenia elementów.'],
          license: 'CC0-1.0'
        },
        board,
        objectives: []
      };
    } else {
      const preset = BOARD_PRESETS.find((p) => p.id === this.selectedPresetId) ?? BOARD_PRESETS[0];
      sc = preset.create();
      sc.board.color = this.customColor;
    }

    // Apply intentional faults if requested
    this.applyFaults(sc);

    return sc;
  }

  private applyFaults(sc: Scenario) {
    if (this.injectFault === 'none') return;

    if (this.injectFault === 'short-rail') {
      const cap = sc.board.components.find((c) => c.ref.startsWith('C') || c.ref.includes('LDO'));
      if (cap) {
        cap.state.leak = { ohms: 0.2 };
        sc.meta.description += ' [Usterka: Zwarcie szyny zasilania!]';
      }
    } else if (this.injectFault === 'cold-joint') {
      const r = sc.board.components.find((c) => c.ref.startsWith('R') || c.ref.startsWith('F'));
      if (r) {
        r.state.cold = [0];
        sc.meta.description += ' [Usterka: Zimny lut na zasilaniu!]';
      }
    } else if (this.injectFault === 'reversed-diode') {
      const d = sc.board.components.find((c) => c.kind === 'led' || c.kind === 'diode');
      if (d) {
        d.state.reversed = true;
        sc.meta.description += ' [Usterka: Dioda wlutowana odwrotnie!]';
      }
    } else if (this.injectFault === 'blown-fuse') {
      const f = sc.board.components.find((c) => c.kind === 'fuse');
      if (f) {
        f.state.burnt = true;
        sc.meta.description += ' [Usterka: Przepalony bezpiecznik wejściowy!]';
      }
    }
  }

  private bindEvents(isPl: boolean) {
    // Backdrop click outside to close
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

    // Preset cards
    this.el.querySelectorAll('.preset-card').forEach((card) => {
      card.addEventListener('click', () => {
        const pId = card.getAttribute('data-preset');
        if (pId) {
          this.selectedPresetId = pId;
          this.render();
        }
      });
    });

    // Custom board inputs
    const inpW = this.el.querySelector('#inp-board-w') as HTMLInputElement | null;
    inpW?.addEventListener('change', () => { this.customWidth = Math.max(30, Math.min(250, Number(inpW.value) || 80)); });

    const inpH = this.el.querySelector('#inp-board-h') as HTMLInputElement | null;
    inpH?.addEventListener('change', () => { this.customHeight = Math.max(20, Math.min(200, Number(inpH.value) || 50)); });

    const inpColor = this.el.querySelector('#inp-board-color') as HTMLSelectElement | null;
    inpColor?.addEventListener('change', () => { this.customColor = inpColor.value; });

    const inpFault = this.el.querySelector('#inp-board-fault') as HTMLSelectElement | null;
    inpFault?.addEventListener('change', () => { this.injectFault = inpFault.value as FaultKind; });

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

      // Trigger zip export
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
        // Fallback to downloading json
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
