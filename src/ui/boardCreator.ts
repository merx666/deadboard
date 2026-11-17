// Interactive Custom Board Builder & Supplier Parts Catalog (PCBWay / LCSC / DigiKey)
import { searchSupplierParts } from '../parts/catalog';
import { BOARD_PRESETS } from '../boards/presets';
import { Builder } from '../scenarios/builder';
import type { Scenario } from '../types';
import { getLang } from '../i18n';
import { writeZip } from '../mods/zip';
import { icon } from './icons';

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
  private injectFault: 'none' | 'short-rail' | 'cold-joint' | 'reversed-diode' | 'blown-fuse' = 'none';

  constructor(opts: BoardCreatorOptions) {
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'modal-backdrop';
    this.el.id = 'board-creator-modal';
  }

  show() {
    this.render();
    document.body.appendChild(this.el);
  }

  close() {
    this.el.remove();
    this.opts.onClose();
  }

  private render() {
    const isPl = getLang() === 'pl';

    this.el.innerHTML = `
      <div class="modal card" style="max-width: 900px; width: 95vw; max-height: 90vh; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px;">
        <div class="row" style="justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
          <div class="row" style="gap: 10px; align-items: center;">
            <div class="card-ic" style="width: 34px; height: 34px;">${icon('grid', 18)}</div>
            <div>
              <h2 style="font-size: 19px; margin: 0; font-family: var(--mono);">${isPl ? 'Kreator Własnych Płytek i Baza Części' : 'Custom Board Builder & Parts Catalog'}</h2>
              <p class="muted" style="margin: 2px 0 0; font-size: 13px;">${isPl ? 'Twórz nowe płytki, dobieraj części PCBWay / LCSC i eksportuj jako mody lub wyzwania' : 'Build custom boards, select PCBWay/LCSC parts, export as mods or challenges'}</p>
            </div>
          </div>
          <button class="btn ghost icon" id="btn-close-creator" title="${isPl ? 'Zamknij' : 'Close'}">${icon('x', 16)}</button>
        </div>

        <!-- Navigation Tabs -->
        <div class="row" style="gap: 8px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <button class="btn sm ${this.activeTab === 'builder' ? 'primary' : 'ghost'}" id="tab-btn-builder">
            ${icon('grid', 14)}<span>${isPl ? '1. Kreator Płytek i Modów' : '1. Board & Mod Builder'}</span>
          </button>
          <button class="btn sm ${this.activeTab === 'catalog' ? 'primary' : 'ghost'}" id="tab-btn-catalog">
            ${icon('tools', 14)}<span>${isPl ? '2. Baza Części (PCBWay / LCSC)' : '2. Parts Catalog (PCBWay / LCSC)'}</span>
          </button>
        </div>

        <div id="creator-tab-content">
          ${this.activeTab === 'builder' ? this.renderBuilderTab(isPl) : this.renderCatalogTab(isPl)}
        </div>
      </div>
    `;

    this.bindEvents(isPl);
  }

  private renderBuilderTab(isPl: boolean): string {
    return `
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <!-- Preset selector -->
        <div>
          <label style="font-weight: 600; font-size: 14px; display: block; margin-bottom: 8px;">
            ${isPl ? 'Wybierz szablon bazowy lub architekturę modułu:' : 'Choose base template or module architecture:'}
          </label>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
            ${BOARD_PRESETS.map((p) => `
              <div class="card preset-card ${this.selectedPresetId === p.id ? 'active' : ''}" data-preset="${p.id}"
                   style="cursor: pointer; padding: 14px; border: 1px solid ${this.selectedPresetId === p.id ? 'var(--accent)' : 'var(--border)'}; background: ${this.selectedPresetId === p.id ? 'var(--accent-weak)' : 'var(--surface)'}; border-radius: 8px;">
                <div style="font-weight: 700; font-size: 14px; color: ${this.selectedPresetId === p.id ? 'var(--accent)' : 'var(--text)'};">
                  ${isPl ? p.titlePl : p.titleEn}
                </div>
                <p style="margin: 6px 0 0; font-size: 12px; color: var(--text-2); line-height: 1.4;">
                  ${isPl ? p.descPl : p.descEn}
                </p>
              </div>
            `).join('')}
            <div class="card preset-card ${this.selectedPresetId === 'custom-blank' ? 'active' : ''}" data-preset="custom-blank"
                 style="cursor: pointer; padding: 14px; border: 1px solid ${this.selectedPresetId === 'custom-blank' ? 'var(--accent)' : 'var(--border)'}; background: ${this.selectedPresetId === 'custom-blank' ? 'var(--accent-weak)' : 'var(--surface)'}; border-radius: 8px;">
              <div style="font-weight: 700; font-size: 14px; color: ${this.selectedPresetId === 'custom-blank' ? 'var(--accent)' : 'var(--text)'};">
                ${isPl ? '✨ Nowa Pusta Płytka (Własne Wymiary)' : '✨ Custom Blank Prototyping Board'}
              </div>
              <p style="margin: 6px 0 0; font-size: 12px; color: var(--text-2); line-height: 1.4;">
                ${isPl ? 'Czysty laminat FR-4 o dowolnej szerokości i wysokości, gotowy na wstawianie komponentów z bazy.' : 'Empty FR-4 laminate with custom width/height ready for components from catalog.'}
              </p>
            </div>
          </div>
        </div>

        <!-- Custom board settings -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; background: var(--surface-2); padding: 14px; border-radius: 8px; border: 1px solid var(--border);">
          <div>
            <label style="font-size: 12px; color: var(--muted); display: block; margin-bottom: 4px;">${isPl ? 'Szerokość płytki (mm)' : 'Board Width (mm)'}</label>
            <input type="number" id="inp-board-w" value="${this.customWidth}" min="30" max="250" style="width: 100%; padding: 6px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);" />
          </div>
          <div>
            <label style="font-size: 12px; color: var(--muted); display: block; margin-bottom: 4px;">${isPl ? 'Wysokość płytki (mm)' : 'Board Height (mm)'}</label>
            <input type="number" id="inp-board-h" value="${this.customHeight}" min="20" max="200" style="width: 100%; padding: 6px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);" />
          </div>
          <div>
            <label style="font-size: 12px; color: var(--muted); display: block; margin-bottom: 4px;">${isPl ? 'Kolor maski lutowniczej' : 'Solder Mask Color'}</label>
            <select id="inp-board-color" style="width: 100%; padding: 6px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);">
              <option value="#124422" ${this.customColor === '#124422' ? 'selected' : ''}>${isPl ? 'Zielony klasyczny (FR-4)' : 'Classic Green (FR-4)'}</option>
              <option value="#0b2b40" ${this.customColor === '#0b2b40' ? 'selected' : ''}>${isPl ? 'Niebieski (Arduino Blue)' : 'Blue (Arduino Blue)'}</option>
              <option value="#18181a" ${this.customColor === '#18181a' ? 'selected' : ''}>${isPl ? 'Czarny mat (Matte Black)' : 'Matte Black'}</option>
              <option value="#401414" ${this.customColor === '#401414' ? 'selected' : ''}>${isPl ? 'Czerwony (Cherry Red)' : 'Cherry Red'}</option>
              <option value="#2c1638" ${this.customColor === '#2c1638' ? 'selected' : ''}>${isPl ? 'Fioletowy (Purple OSHPark)' : 'Purple (OSHPark)'}</option>
            </select>
          </div>
          <div>
            <label style="font-size: 12px; color: var(--muted); display: block; margin-bottom: 4px;">${isPl ? 'Wstrzyknij usterkę do wyzwania:' : 'Inject fault for challenge:'}</label>
            <select id="inp-board-fault" style="width: 100%; padding: 6px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);">
              <option value="none" ${this.injectFault === 'none' ? 'selected' : ''}>${isPl ? 'Brak (Płytka w pełni sprawna)' : 'None (Fully functional board)'}</option>
              <option value="short-rail" ${this.injectFault === 'short-rail' ? 'selected' : ''}>${isPl ? '⚡ Zwarcie szyny 3.3V do masy' : '⚡ 3.3V rail shorted to Ground'}</option>
              <option value="cold-joint" ${this.injectFault === 'cold-joint' ? 'selected' : ''}>${isPl ? '❄️ Zimny lut na zasilaniu (brak styku)' : '❄️ Cold solder joint on power pin'}</option>
              <option value="reversed-diode" ${this.injectFault === 'reversed-diode' ? 'selected' : ''}>${isPl ? '🔄 Odwrotnie wlutowana dioda' : '🔄 Reversed diode polarity'}</option>
              <option value="blown-fuse" ${this.injectFault === 'blown-fuse' ? 'selected' : ''}>${isPl ? '💥 Przepalony bezpiecznik wejściowy' : '💥 Blown input protection fuse'}</option>
            </select>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="row" style="gap: 12px; flex-wrap: wrap; margin-top: 8px;">
          <button class="btn primary" id="btn-load-bench" style="flex: 1; min-width: 220px; justify-content: center;">
            ${icon('power', 16)}<span>${isPl ? 'Otwórz natychmiast na stole warsztatowym' : 'Open immediately on the bench'}</span>
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

        <div style="font-size: 13px; color: var(--muted);">
          ${isPl ? `Znaleziono ${parts.length} komponentów z oznaczeniami PCBWay i LCSC:` : `Found ${parts.length} supplier components with PCBWay & LCSC part numbers:`}
        </div>

        <!-- Parts list -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; max-height: 480px; overflow-y: auto;">
          ${parts.map((p) => `
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
                <div><b>Napięcie/Parametry:</b> ${p.voltage}</div>
                <div><b>Prąd:</b> ${p.current}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
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
        id: 'custom-' + Date.now().toString(36),
        meta: {
          title: 'Własna Płytka Prototypowa',
          author: 'Twórca',
          difficulty: 1,
          description: 'Czysty laminat z wbudowanym polem prototypowym.',
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
      // Find capacitor or component connected to power rail and short it
      const cap = sc.board.components.find((c) => c.ref.startsWith('C') || c.ref.includes('LDO'));
      if (cap) {
        cap.state.leak = { ohms: 0.2 }; // Hard short 0.2 ohms to mass
        sc.meta.description += ' [Usterka: Zwarcie szyny zasilania!]';
      }
    } else if (this.injectFault === 'cold-joint') {
      const r = sc.board.components.find((c) => c.ref.startsWith('R') || c.ref.startsWith('F'));
      if (r) {
        r.state.cold = [0]; // Cold solder joint on pad 0
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
    const inpW = this.el.querySelector('#inp-board-w') as HTMLInputElement;
    if (inpW) inpW.addEventListener('change', () => { this.customWidth = Math.max(30, Math.min(250, Number(inpW.value) || 80)); });

    const inpH = this.el.querySelector('#inp-board-h') as HTMLInputElement;
    if (inpH) inpH.addEventListener('change', () => { this.customHeight = Math.max(20, Math.min(200, Number(inpH.value) || 50)); });

    const inpColor = this.el.querySelector('#inp-board-color') as HTMLSelectElement;
    if (inpColor) inpColor.addEventListener('change', () => { this.customColor = inpColor.value; });

    const inpFault = this.el.querySelector('#inp-board-fault') as HTMLSelectElement;
    if (inpFault) inpFault.addEventListener('change', () => { this.injectFault = inpFault.value as any; });

    // Catalog search & filter
    const catSearch = this.el.querySelector('#catalog-search') as HTMLInputElement;
    if (catSearch) {
      catSearch.addEventListener('input', () => {
        this.searchQuery = catSearch.value;
        const container = this.el.querySelector('#creator-tab-content');
        if (container) container.innerHTML = this.renderCatalogTab(isPl);
      });
    }

    const catSelect = this.el.querySelector('#catalog-category') as HTMLSelectElement;
    if (catSelect) {
      catSelect.addEventListener('change', () => {
        this.selectedCategory = catSelect.value;
        const container = this.el.querySelector('#creator-tab-content');
        if (container) container.innerHTML = this.renderCatalogTab(isPl);
      });
    }

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
      }
    });
  }
}
