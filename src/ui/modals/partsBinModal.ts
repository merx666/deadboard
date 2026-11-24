import { getLang } from '../../i18n';
import { fmtOhm, fmtSI, marking } from '../../model';
import { installPart } from '../../ops';
import { type ComponentPart, findPartById, searchSupplierParts } from '../../parts/catalog';
import type { Board, Component } from '../../types';
import { sfxSolder } from '../audio';
import { icon } from '../icons';

export interface PartsBinModalContext {
  getBoard: () => Board;
  getModalPos: () => [number, number];
  modalRootEl: HTMLElement;
  toast: (msg: string, kind?: 'info' | 'success' | 'warn' | 'danger') => void;
  esc: (s: string) => string;
  pushUndo: () => void;
  recompute: (rebuild?: boolean) => void;
  onClose: () => void;
  onPartReplaced: () => void;
  isSuppressModalBgClose: () => boolean;
  resetSuppressModalBgClose: () => void;
}

export class PartsBinModalController {
  private targetCompId: string | null = null;
  private search = '';
  private category = 'all';
  private filterCompatible = true;
  private selectedPartId: string | null = null;

  constructor(private ctx: PartsBinModalContext) {}

  open(targetComp: Component | null = null): void {
    this.targetCompId = targetComp?.id ?? null;
    this.category = this.getInitialCategoryForComp(targetComp);
    this.filterCompatible = !!targetComp;
    this.search = '';
    this.selectedPartId = null;
  }

  getInitialCategoryForComp(c: Component | null): string {
    if (!c) return 'all';
    switch (c.kind) {
      case 'resistor':
      case 'capacitor':
      case 'fuse':
      case 'switch':
        return 'passives';
      case 'diode':
      case 'led':
        return 'diodes';
      case 'ic':
        if (/^(u|reg|ldo|pwr|vr)/i.test(c.ref)) return 'power';
        if (/^(esp|mod|pico|mcu)/i.test(c.ref)) return 'modules';
        return 'all';
      default:
        return 'all';
    }
  }

  isPartCompatibleWith(part: ComponentPart, c: Component): boolean {
    const cPkg = c.footprint?.toLowerCase().trim();
    const pPkg = part.pkg.toLowerCase();
    const pkgMatch = cPkg ? pPkg.includes(cPkg) || cPkg.includes(pPkg.split(' ')[0]) : false;

    switch (c.kind) {
      case 'resistor':
        return part.valKind === 'R' || (part.category === 'passives' && !part.valKind);
      case 'capacitor':
        return part.valKind === 'C';
      case 'fuse':
        return part.valKind === 'F';
      case 'diode':
      case 'led':
        return part.valKind === 'D' || part.category === 'diodes';
      case 'ic':
        return (
          part.valKind === 'IC' ||
          part.category === 'power' ||
          part.category === 'modules' ||
          part.category === 'interface' ||
          part.category === 'transistors' ||
          pkgMatch
        );
      default:
        return true;
    }
  }

  replaceComponentWithPart(c: Component, part: ComponentPart): void {
    this.ctx.pushUndo();

    if (part.valKind === 'R') {
      c.kind = 'resistor';
      if (part.defaultVal !== undefined) c.value = part.defaultVal;
    } else if (part.valKind === 'C') {
      c.kind = 'capacitor';
      if (part.defaultVal !== undefined) c.value = part.defaultVal;
    } else if (part.valKind === 'D') {
      c.kind = 'diode';
    } else if (part.valKind === 'F') {
      c.kind = 'fuse';
      if (part.defaultVal !== undefined) c.value = part.defaultVal;
    } else if (part.valKind === 'SW') {
      c.kind = 'switch';
    } else if (
      part.valKind === 'IC' ||
      part.category === 'modules' ||
      part.category === 'power' ||
      part.category === 'interface' ||
      part.category === 'transistors'
    ) {
      c.kind = 'ic';
      if (part.defaultVal !== undefined) c.value = part.defaultVal;
    }

    c.label = `${part.mpn} (${part.lcsc})`;
    if (part.pkg) c.footprint = part.pkg;

    installPart(c, {
      ...(part.defaultVal !== undefined ? { value: part.defaultVal } : {}),
      reversed: c.state.reversed,
    });

    if (part.pins && Object.keys(part.pins).length > 0) {
      c.pins = { ...c.pins, ...part.pins };
    }

    sfxSolder();
    this.ctx.recompute(false);

    const isPl = getLang() === 'pl';
    this.ctx.toast(
      isPl
        ? `Zamontowano ${part.mpn} (${part.lcsc}) w ${c.ref}`
        : `Fitted ${part.mpn} (${part.lcsc}) at ${c.ref}`,
      'success'
    );

    this.ctx.onClose();
    this.ctx.onPartReplaced();
  }

  async render(): Promise<void> {
    const isPl = getLang() === 'pl';
    const board = this.ctx.getBoard();
    const targetComp = this.targetCompId
      ? board.components.find((x) => x.id === this.targetCompId) ?? null
      : null;

    const categories: { id: string; labelPl: string; labelEn: string }[] = [
      { id: 'all', labelPl: 'Wszystkie kategorie', labelEn: 'All Categories' },
      { id: 'passives', labelPl: 'Elementy pasywne (R, C, Bezpieczniki)', labelEn: 'Passives (R, C, Fuses)' },
      { id: 'power', labelPl: 'Zasilanie i regulatory (LDO, Buck, PMIC)', labelEn: 'Power & Regulators (LDO, Buck, PMIC)' },
      { id: 'modules', labelPl: 'Mikrokontrolery i moduły (ESP32, Pico, MCU)', labelEn: 'MCU & Modules (ESP32, Pico, MCU)' },
      { id: 'transistors', labelPl: 'Tranzystory MOSFET', labelEn: 'MOSFET Transistors' },
      { id: 'diodes', labelPl: 'Diody, LED i ochrona ESD', labelEn: 'Diodes, LEDs & ESD Protection' },
      { id: 'interface', labelPl: 'Interfejsy (USB, UART, Flash)', labelEn: 'Interfaces (USB, UART, Flash)' },
    ];

    const getParts = () => {
      let list = searchSupplierParts(this.search, this.category);
      if (targetComp && this.filterCompatible) {
        list = list.filter((p) => this.isPartCompatibleWith(p, targetComp));
      }
      return list;
    };

    const initialParts = getParts();
    if (!this.selectedPartId && initialParts.length > 0) {
      this.selectedPartId = initialParts[0].id;
    }

    const renderPinoutTable = (pins: Record<string, string>) => {
      const entries = Object.entries(pins);
      if (entries.length === 0) {
        return `<div style="font-size:12px; color:var(--muted); text-align:center; padding:16px;">${isPl ? 'Brak zdefiniowanych wyprowadzeń dla tego elementu' : 'No pin definitions available for this part'}</div>`;
      }
      return `
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border); color: var(--muted); text-align: left;">
              <th style="padding: 4px 6px; width: 60px;">Pin</th>
              <th style="padding: 4px 6px;">${isPl ? 'Sygnał / Rola' : 'Signal / Function'}</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(([pin, name]) => {
              const isGnd = /gnd/i.test(name);
              const isPwr = /(vcc|3v3|5v|vdd|vin|vsys|vbus|pwr|\+)/i.test(name);
              const col = isGnd ? 'var(--text-2)' : isPwr ? 'var(--warn)' : 'var(--accent)';
              return `
                <tr style="border-bottom: 1px solid var(--surface-2);">
                  <td style="padding: 3px 6px; font-family: var(--mono); color: var(--muted); font-weight: 600;">${this.ctx.esc(pin)}</td>
                  <td style="padding: 3px 6px; font-family: var(--mono); color: ${col}; font-weight: 500;">${this.ctx.esc(name)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    };

    const renderDetailPane = (part: ComponentPart | null) => {
      if (!part) {
        return `
          <div class="card" style="padding: 24px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--muted);">
            <div style="margin-bottom: 10px; opacity: 0.6;">${icon('box', 36)}</div>
            <div style="font-weight: 600; font-size: 13px; color: var(--text-2); margin-bottom: 6px;">
              ${isPl ? 'Podgląd podzespołu i pinout' : 'Component Specs & Pinout'}
            </div>
            <div style="font-size: 12px; max-width: 260px; line-height: 1.5;">
              ${targetComp
                ? (isPl ? `Wybierz część z listy, aby sprawdzić jej wyprowadzenia przed wlutowaniem w ${this.ctx.esc(targetComp.ref)}.` : `Select a part from the list to preview its pinout before fitting onto ${this.ctx.esc(targetComp.ref)}.`)
                : (isPl ? 'Wybierz podzespół z listy po lewej, aby zbadać jego parametry techniczne, obudowę i wyprowadzenia sygnałów.' : 'Select a component from the list on the left to inspect its parameters, package, and pinout.')
              }
            </div>
          </div>
        `;
      }

      return `
        <div class="card" style="padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; height: 100%; display: flex; flex-direction: column;">
          <div style="border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div>
                <div style="font-size: 16px; font-weight: 600; font-family: var(--mono); color: var(--accent);">${this.ctx.esc(part.mpn)}</div>
                <div style="font-size: 12px; color: var(--muted);">${this.ctx.esc(part.manufacturer)}</div>
              </div>
              <span class="badge info">${this.ctx.esc(part.pkg)}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-2); margin-top: 6px; line-height: 1.4;">
              ${this.ctx.esc(isPl ? part.descPl : part.descEn)}
            </div>
          </div>

          <dl class="kv" style="margin: 0 0 10px 0; font-size: 12px;">
            <dt>LCSC Code</dt><dd class="mono" style="color: var(--accent); font-weight: 600;">${this.ctx.esc(part.lcsc)}</dd>
            <dt>PCBWay Part</dt><dd class="mono">${this.ctx.esc(part.pcbwayPart)}</dd>
            <dt>${isPl ? 'Napięcie robocze' : 'Voltage'}</dt><dd>${this.ctx.esc(part.voltage)}</dd>
            <dt>${isPl ? 'Prąd znamionowy' : 'Current'}</dt><dd>${this.ctx.esc(part.current)}</dd>
            <dt>${isPl ? 'Obudowa / Wymiary' : 'Package / Size'}</dt><dd>${part.footprintWidth} × ${part.footprintHeight} mm (${part.padsCount} ${isPl ? 'padów' : 'pads'})</dd>
            ${part.defaultVal !== undefined ? `
              <dt>${isPl ? 'Wartość domyślna' : 'Default Value'}</dt>
              <dd class="mono">${part.valKind === 'R' ? fmtOhm(part.defaultVal) : part.valKind === 'C' ? fmtSI(part.defaultVal, 'F') : part.valKind === 'F' ? fmtSI(part.defaultVal, 'A') : String(part.defaultVal)}</dd>
            ` : ''}
          </dl>

          <!-- Pinout section -->
          <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
            <div style="font-weight: 600; font-size: 12px; margin-bottom: 6px; color: var(--text-2); display: flex; align-items: center; justify-content: space-between;">
              <span>${isPl ? 'Wyprowadzenia i sygnały (Pinout)' : 'Pinout & Signal Functions'}</span>
              <span style="font-size: 11px; color: var(--muted);">${Object.keys(part.pins).length} ${isPl ? 'pinów' : 'pins'}</span>
            </div>
            <div style="flex: 1; overflow-y: auto; max-height: 220px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); padding: 4px;">
              ${renderPinoutTable(part.pins)}
            </div>
          </div>

          ${targetComp ? `
            <div style="margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px;">
              <button class="btn primary sm grow" id="pb-detail-fit" style="width: 100%; justify-content: center; height: 32px; font-weight: 600;">
                ${icon('iron', 14)}
                <span>${isPl ? `Zamontuj ${this.ctx.esc(part.mpn)} w ${this.ctx.esc(targetComp.ref)}` : `Fit ${this.ctx.esc(part.mpn)} into ${this.ctx.esc(targetComp.ref)}`}</span>
              </button>
            </div>
          ` : `
            <div style="margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px;">
              <label style="font-size: 11px; color: var(--muted); display: block; margin-bottom: 4px;">
                ${isPl ? 'Wlutuj w wybrany element na płytce:' : 'Fit onto board component:'}
              </label>
              <div class="row">
                <select id="pb-select-board-comp" class="grow" style="padding: 4px 8px; font-size: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text);">
                  <option value="">${isPl ? '— Wybierz element z płytki —' : '— Select a component —'}</option>
                  ${board.components.map((bc) => `<option value="${this.ctx.esc(bc.id)}">${this.ctx.esc(bc.ref)} (${this.ctx.esc(bc.kind)}) — ${this.ctx.esc(marking(bc))}</option>`).join('')}
                </select>
                <button class="btn primary sm" id="pb-btn-fit-selected" disabled>
                  ${icon('iron', 12)}
                  <span>${isPl ? 'Wlutuj' : 'Fit'}</span>
                </button>
              </div>
            </div>
          `}
        </div>
      `;
    };

    const renderListHtml = (parts: ComponentPart[]) => {
      if (parts.length === 0) {
        return `
          <div style="padding: 36px 16px; text-align: center; color: var(--muted);">
            <div style="font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 4px;">
              ${isPl ? 'Brak pasujących komponentów w katalogu' : 'No matching components in catalog'}
            </div>
            <div style="font-size: 12px;">
              ${isPl ? 'Spróbuj zmienić kategorię lub wyczyścić filtr kompatybilności.' : 'Try changing category or clearing the compatibility filter.'}
            </div>
          </div>
        `;
      }
      return parts.map((p) => {
        const isSelected = p.id === this.selectedPartId;
        return `
          <div class="card pb-part-card ${isSelected ? 'selected' : ''}" data-part-id="${this.ctx.esc(p.id)}" style="padding: 10px 12px; margin-bottom: 8px; cursor: pointer; border: 1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}; background: ${isSelected ? 'var(--surface-3)' : 'var(--surface)'}; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div>
                <div style="font-weight: 600; color: var(--text); font-family: var(--mono); font-size: 13px;">
                  ${this.ctx.esc(p.mpn)}
                  <span style="font-weight: normal; font-size: 11px; color: var(--muted); margin-left: 6px;">${this.ctx.esc(p.manufacturer)}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-2); margin-top: 2px;">
                  ${this.ctx.esc(isPl ? p.namePl : p.nameEn)}
                </div>
              </div>
              <div style="display: flex; gap: 4px; flex-shrink: 0;">
                <span class="badge info" style="font-size: 10px;">${this.ctx.esc(p.pkg)}</span>
                <span class="badge" style="font-size: 10px; background: rgba(75, 227, 138, 0.12); color: var(--accent); border: 1px solid rgba(75, 227, 138, 0.3);">${this.ctx.esc(p.lcsc)}</span>
              </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; font-size: 11.5px; color: var(--muted);">
              <div><b>${isPl ? 'Napięcie:' : 'Voltage:'}</b> ${this.ctx.esc(p.voltage)}</div>
              <div><b>${isPl ? 'Prąd:' : 'Current:'}</b> ${this.ctx.esc(p.current)}</div>
              <div><b>PCBWay:</b> ${this.ctx.esc(p.pcbwayPart)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; border-top: 1px solid var(--border); padding-top: 8px;">
              <button class="btn sm ghost pb-btn-preview" data-part-id="${this.ctx.esc(p.id)}" style="font-size: 11.5px; padding: 2px 8px;">
                ${icon('box', 12)}
                <span>${isPl ? 'Wyprowadzenia (Pinout)' : 'Specs & Pinout'}</span>
              </button>
              ${targetComp ? `
                <button class="btn sm primary pb-btn-fit" data-part-id="${this.ctx.esc(p.id)}" style="font-size: 11.5px; padding: 2px 10px;">
                  ${icon('iron', 12)}
                  <span>${isPl ? `Wlutuj w ${this.ctx.esc(targetComp.ref)}` : `Fit into ${this.ctx.esc(targetComp.ref)}`}</span>
                </button>
              ` : `
                <button class="btn sm pb-btn-inspect" data-part-id="${this.ctx.esc(p.id)}" style="font-size: 11.5px; padding: 2px 8px;">
                  <span>${isPl ? 'Pokaż szczegóły' : 'Inspect part'}</span>
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');
    };

    const modalPos = this.ctx.getModalPos();
    this.ctx.modalRootEl.innerHTML = `
      <div class="modal-backdrop" id="partsbin-close-bg">
        <div class="modal parts-bin-modal" style="transform: translate3d(${modalPos[0]}px, ${modalPos[1]}px, 0);">
          <div class="modal-head" title="${isPl ? 'Przeciągnij, aby przesunąć okno' : 'Drag to move window'}">
            <div>
              <h2>${targetComp
                ? (isPl ? `Magazyn Części (LCSC / PCBWay) — Wymiana dla ${this.ctx.esc(targetComp.ref)}` : `Parts Bin (LCSC / PCBWay) — Replace for ${this.ctx.esc(targetComp.ref)}`)
                : (isPl ? 'Magazyn Części (Baza LCSC / PCBWay)' : 'Parts Bin (LCSC & PCBWay Component Library)')
              }</h2>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
                ${targetComp
                  ? (isPl
                      ? `Wybierz część z katalogu, aby wlutować ją na płytce w miejsce <b>${this.ctx.esc(targetComp.ref)}</b> (aktualnie: ${this.ctx.esc(marking(targetComp))}).`
                      : `Select a catalog part to solder onto the board at <b>${this.ctx.esc(targetComp.ref)}</b> (current: ${this.ctx.esc(marking(targetComp))}).`)
                  : (isPl
                      ? 'Przeglądaj podzespoły z baz LCSC i PCBWay, badaj ich parametry, obudowy i mapy wyprowadzeń (pinout).'
                      : 'Browse LCSC and PCBWay parts, inspect their technical specs, footprints, and signal pinouts.')
                }
              </div>
            </div>
            <button class="btn ghost icon sm" id="partsbin-close" title="${isPl ? 'Zamknij (Esc)' : 'Close (Esc)'}">
              ${icon('x', 14)}
            </button>
          </div>

          <div class="cat-toolbar" style="gap: 10px; border-bottom: 1px solid var(--border); padding: 10px 16px; background: var(--surface-2); display: flex; flex-wrap: wrap; align-items: center;">
            <div style="position: relative; flex: 1; min-width: 200px;">
              <input
                type="text"
                id="partsbin-search"
                class="grow"
                placeholder="${isPl ? 'Szukaj po MPN, LCSC (np. C49678), producencie, obudowie (0805, SOT-223)...' : 'Search by MPN, LCSC (e.g. C49678), manufacturer, package (0805, SOT-223)...'}"
                value="${this.ctx.esc(this.search)}"
                style="width: 100%; padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text);"
              />
            </div>
            <select
              id="partsbin-category"
              style="padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); min-width: 180px;"
            >
              ${categories.map((cat) => `
                <option value="${cat.id}" ${this.category === cat.id ? 'selected' : ''}>
                  ${isPl ? cat.labelPl : cat.labelEn}
                </option>
              `).join('')}
            </select>
            ${targetComp ? `
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); cursor: pointer; user-select: none;">
                <input type="checkbox" id="pb-chk-compat" ${this.filterCompatible ? 'checked' : ''} style="accent-color: var(--accent);" />
                <span>${isPl ? `Tylko pasujące do ${this.ctx.esc(targetComp.ref)}` : `Compatible with ${this.ctx.esc(targetComp.ref)} only`}</span>
              </label>
            ` : ''}
          </div>

          <div class="pb-layout">
            <div style="display: flex; flex-direction: column; overflow: hidden;">
              <div id="partsbin-count" style="font-size: 12px; color: var(--muted); margin-bottom: 8px; flex-shrink: 0;">
                ${isPl ? `Znaleziono ${initialParts.length} komponentów w bazie:` : `Found ${initialParts.length} components in library:`}
              </div>
              <div id="partsbin-list" style="overflow-y: auto; flex: 1; padding-right: 4px;">
                ${renderListHtml(initialParts)}
              </div>
            </div>

            <div id="partsbin-detail" style="overflow-y: auto;">
              ${renderDetailPane(this.selectedPartId ? findPartById(this.selectedPartId) ?? null : null)}
            </div>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => this.ctx.onClose();

    this.ctx.modalRootEl.querySelector('#partsbin-close')?.addEventListener('click', closeModal);
    this.ctx.modalRootEl.querySelector('#partsbin-close-bg')?.addEventListener('click', (e) => {
      if (this.ctx.isSuppressModalBgClose()) {
        this.ctx.resetSuppressModalBgClose();
        return;
      }
      if ((e.target as HTMLElement).id === 'partsbin-close-bg') closeModal();
    });

    const searchInput = this.ctx.modalRootEl.querySelector<HTMLInputElement>('#partsbin-search');
    const categorySelect = this.ctx.modalRootEl.querySelector<HTMLSelectElement>('#partsbin-category');
    const compatCheckbox = this.ctx.modalRootEl.querySelector<HTMLInputElement>('#pb-chk-compat');
    const partsListEl = this.ctx.modalRootEl.querySelector<HTMLElement>('#partsbin-list');
    const countEl = this.ctx.modalRootEl.querySelector<HTMLElement>('#partsbin-count');
    const detailEl = this.ctx.modalRootEl.querySelector<HTMLElement>('#partsbin-detail');

    const updateDetail = () => {
      const part = this.selectedPartId ? findPartById(this.selectedPartId) ?? null : null;
      if (detailEl) {
        detailEl.innerHTML = renderDetailPane(part);
        bindDetailActions(part);
      }
    };

    const bindDetailActions = (part: ComponentPart | null) => {
      if (!part) return;
      if (targetComp) {
        this.ctx.modalRootEl.querySelector('#pb-detail-fit')?.addEventListener('click', () => {
          this.replaceComponentWithPart(targetComp, part);
        });
      } else {
        const boardCompSelect = this.ctx.modalRootEl.querySelector<HTMLSelectElement>('#pb-select-board-comp');
        const fitBtn = this.ctx.modalRootEl.querySelector<HTMLButtonElement>('#pb-btn-fit-selected');
        boardCompSelect?.addEventListener('change', () => {
          if (fitBtn) fitBtn.disabled = !boardCompSelect.value;
        });
        fitBtn?.addEventListener('click', () => {
          const compId = boardCompSelect?.value;
          if (!compId) return;
          const target = board.components.find((bc) => bc.id === compId);
          if (target) {
            this.replaceComponentWithPart(target, part);
          }
        });
      }
    };

    const bindListActions = () => {
      this.ctx.modalRootEl.querySelectorAll<HTMLElement>('.pb-part-card').forEach((card) => {
        const partId = card.dataset.partId;
        if (!partId) return;

        card.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.pb-btn-fit') || target.closest('.pb-btn-preview')) return;

          this.selectedPartId = partId;
          this.ctx.modalRootEl.querySelectorAll('.pb-part-card').forEach((c) => {
            const sel = (c as HTMLElement).dataset.partId === partId;
            c.classList.toggle('selected', sel);
            (c as HTMLElement).style.borderColor = sel ? 'var(--accent)' : 'var(--border)';
            (c as HTMLElement).style.background = sel ? 'var(--surface-3)' : 'var(--surface)';
          });
          updateDetail();
        });
      });

      this.ctx.modalRootEl.querySelectorAll<HTMLButtonElement>('.pb-btn-preview, .pb-btn-inspect').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const partId = btn.dataset.partId;
          if (!partId) return;
          this.selectedPartId = partId;
          this.ctx.modalRootEl.querySelectorAll('.pb-part-card').forEach((c) => {
            const sel = (c as HTMLElement).dataset.partId === partId;
            c.classList.toggle('selected', sel);
            (c as HTMLElement).style.borderColor = sel ? 'var(--accent)' : 'var(--border)';
            (c as HTMLElement).style.background = sel ? 'var(--surface-3)' : 'var(--surface)';
          });
          updateDetail();
        });
      });

      this.ctx.modalRootEl.querySelectorAll<HTMLButtonElement>('.pb-btn-fit').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const partId = btn.dataset.partId;
          if (!partId || !targetComp) return;
          const part = findPartById(partId);
          if (part) this.replaceComponentWithPart(targetComp, part);
        });
      });
    };

    const updateList = () => {
      const parts = getParts();
      if (countEl) {
        countEl.textContent = isPl
          ? `Znaleziono ${parts.length} komponentów w bazie:`
          : `Found ${parts.length} components in library:`;
      }
      if (partsListEl) {
        partsListEl.innerHTML = renderListHtml(parts);
        bindListActions();
      }
      if (this.selectedPartId && !parts.some((p) => p.id === this.selectedPartId)) {
        this.selectedPartId = parts[0]?.id ?? null;
      } else if (!this.selectedPartId && parts.length > 0) {
        this.selectedPartId = parts[0].id;
      }
      updateDetail();
    };

    searchInput?.addEventListener('input', () => {
      this.search = searchInput.value;
      updateList();
    });

    categorySelect?.addEventListener('change', () => {
      this.category = categorySelect.value;
      updateList();
    });

    compatCheckbox?.addEventListener('change', () => {
      this.filterCompatible = compatCheckbox.checked;
      updateList();
    });

    bindListActions();
    bindDetailActions(this.selectedPartId ? findPartById(this.selectedPartId) ?? null : null);
  }
}
