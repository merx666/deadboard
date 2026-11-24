import type { Conn } from '../../connectivity';
import {
  applicableFaults,
  clearFault,
  FAULT_LABELS,
  type FaultClass,
  injectFault,
  listFaults,
  needsSpice,
  rng,
  severityHint,
} from '../../faults';
import { getLang } from '../../i18n';
import { updateIntermittents } from '../../intermittent';
import {
  BAND_RGB,
  e12Values,
  fmtOhm,
  fmtSI,
  GOLD_RGB,
  KIND_NAMES,
  LED_COLORS,
  marking,
  parseValue,
  resistorBands,
} from '../../model';
import { installPart, removePart, toggleCold } from '../../ops';
import { BOTH_GAP, type Camera } from '../../render/camera';
import type { Sim } from '../../sim';
import type { Board, Component, LedColor } from '../../types';
import type { Solver } from '../../verify';
import { sfxClick, sfxSolder } from '../audio';
import { icon } from '../icons';

export interface InspectPanelHost {
  getBoard(): Board;
  getConn(): Conn;
  getSim(): Sim | null;
  isPowerOn(): boolean;
  getSelectedCompId(): string | null;
  getSelectedNet(): number;
  getCompSearch(): string;
  isAuthorMode(): boolean;
  getFaultClass(): FaultClass;
  getSolver(): Solver;
  getCamera(): Camera;
  getSideBodyEl(): HTMLElement;

  esc(s: string): string;
  toast(msg: string, kind?: 'info' | 'success' | 'warn' | 'danger'): void;
  pushUndo(): void;
  recompute(full?: boolean): void;
  renderUI(): void;
  openPartsBin(c: Component | null): void;
  environment(): { partTemp: (id: string) => number | undefined; flexAt: (x: number, y: number) => number };
  setSelectedCompId(id: string | null): void;
  setCompSearch(q: string): void;
  setFaultClass(cls: FaultClass): void;
}

export class InspectPanelController {
  constructor(private host: InspectPanelHost) {}

  render() {
    const board = this.host.getBoard();
    const conn = this.host.getConn();
    const sim = this.host.getSim();
    const powerOn = this.host.isPowerOn();
    const selectedCompId = this.host.getSelectedCompId();
    const selectedNet = this.host.getSelectedNet();
    const sideBodyEl = this.host.getSideBodyEl();
    const c = board.components.find((x) => x.id === selectedCompId) ?? null;

    if (!c) {
      const netName = selectedNet >= 0 ? conn.netNames[selectedNet] : null;
      const ni = selectedNet >= 0 ? sim?.nodeOfNet.get(selectedNet) : undefined;
      const v = ni !== undefined && sim?.source ? sim.V[ni] : null;
      const renderCompRows = () => {
        const q = this.host.getCompSearch().trim().toLowerCase();
        const filtered = q
          ? board.components.filter(
              (comp) =>
                comp.ref.toLowerCase().includes(q) ||
                KIND_NAMES[comp.kind].toLowerCase().includes(q) ||
                (comp.label?.toLowerCase().includes(q) ?? false),
            )
          : board.components;
        const shown = filtered.slice(0, 120);
        const rows = shown
          .map(
            (comp) => `
          <button class="list-btn" data-pick-comp="${comp.id}">
            <span><b>${this.host.esc(comp.ref)}</b> · ${this.host.esc(KIND_NAMES[comp.kind])}</span>
            <span class="sub">${this.host.esc(marking(comp))}</span>
          </button>
        `,
          )
          .join('');
        const tail =
          filtered.length > 120
            ? `<div class="muted" style="padding-top:4px">Showing 120 of ${filtered.length} matches — refine search above</div>`
            : '';
        return (rows || `<div class="muted">No matching components.</div>`) + tail;
      };

      sideBodyEl.innerHTML = `
        <div class="card">
          <div class="card-title">Selection</div>
          ${
            netName
              ? `
            <dl class="kv">
              <dt>Net</dt><dd>${this.host.esc(netName)}</dd>
              <dt>Potential</dt><dd>${v !== null ? `${v.toFixed(3)} V` : powerOn ? 'Floating' : 'Unpowered'}</dd>
            </dl>
          `
              : `<div class="muted">Select a component, pad, or trace in the viewport to inspect parameters and perform rework.</div>`
          }
        </div>
        <div class="card">
          <div class="card-title">Components (${board.components.length})</div>
          <input type="text" id="inp-comp-search" placeholder="Search ref or type (e.g. U2, C29, resistor)…" value="${this.host.esc(this.host.getCompSearch())}" style="width:100%;margin-bottom:8px" />
          <div class="stack" id="comp-list-box">${renderCompRows()}</div>
        </div>
      `;

      const bindCompClicks = () => {
        sideBodyEl.querySelectorAll<HTMLButtonElement>('[data-pick-comp]').forEach((b) => {
          b.addEventListener('click', () => {
            const id = b.dataset.pickComp!;
            this.host.setSelectedCompId(id);
            if (board.components.length > 100) {
              const picked = board.components.find((x) => x.id === id);
              if (picked) {
                const camera = this.host.getCamera();
                if (camera.bothSides) {
                  const fx = picked.side === 'B' ? board.w * 2 + BOTH_GAP - picked.at[0] : picked.at[0];
                  camera.focusAt(fx, picked.at[1], 10);
                } else {
                  camera.focusAt(picked.at[0], picked.at[1], 10, picked.side);
                }
                this.host.renderUI();
                return;
              }
            }
            this.render();
          });
        });
      };
      bindCompClicks();

      const searchEl = sideBodyEl.querySelector<HTMLInputElement>('#inp-comp-search');
      const listBox = sideBodyEl.querySelector<HTMLElement>('#comp-list-box');
      searchEl?.addEventListener('input', () => {
        this.host.setCompSearch(searchEl.value);
        if (listBox) {
          listBox.innerHTML = renderCompRows();
          bindCompClicks();
        }
      });
      return;
    }

    const isPl = getLang() === 'pl';
    const cSim = powerOn && sim ? sim.comps.get(c.id) : undefined;
    const bands = c.kind === 'resistor' && c.state.populated && !c.state.burnt ? resistorBands(c.value) : null;
    const bandColorCss = (idx: number) => {
      const rgb = idx < 0 ? GOLD_RGB : BAND_RGB[idx];
      return `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`;
    };

    const e12 = e12Values(10, 1000000);

    sideBodyEl.innerHTML = `
      <div class="card">
        <div class="card-title">
          <button class="btn ghost sm" id="btn-comp-back" style="padding:0 4px">${icon('chevronLeft', 14)}<span>Components</span></button>
          <span class="badge info">${this.host.esc(c.ref)}</span>
        </div>
        <div class="card-title lg">${this.host.esc(KIND_NAMES[c.kind])}</div>
        <dl class="kv">
          <dt>State</dt><dd>${!c.state.populated ? 'Unpopulated' : c.state.burnt ? 'Damaged (open)' : 'Populated'}${c.state.reversed ? ' · Reversed' : ''}${c.state.cold.length ? ` · ${c.state.cold.length} cold joint` : ''}</dd>
          <dt>Value</dt><dd>${this.host.esc(marking(c))}</dd>
          ${
            bands
              ? `
            <dt>Color code</dt>
            <dd>
              <span class="res-bands">
                <span class="res-band" style="background:${bandColorCss(bands[0])}"></span>
                <span class="res-band" style="background:${bandColorCss(bands[1])}"></span>
                <span class="res-band" style="background:${bandColorCss(bands[2])}"></span>
                <span class="res-band" style="background:${bandColorCss(-1)}"></span>
              </span>
            </dd>
          `
              : ''
          }
          ${
            cSim
              ? `
            <dt>Drop / current</dt><dd>${cSim.v.toFixed(3)} V · ${(cSim.i * 1000).toFixed(2)} mA</dd>
            <dt>Power / temp</dt><dd>${(cSim.p * 1000).toFixed(1)} mW · ${(25 + cSim.p * (c.kind === 'resistor' ? 185 : 130)).toFixed(0)} °C</dd>
          `
              : ''
          }
        </dl>
        <div class="callout">
          <span class="h">Reference note</span>
          <span>${this.host.esc(
            c.kind === 'resistor'
              ? 'Read the 4 bands left-to-right toward the gold tolerance band: Digit 1, Digit 2, Multiplier (10^n). Example: Brown-Black-Red = 1-0 × 10² = 1 kΩ.'
              : c.kind === 'led'
                ? 'Look for the flat notch on the rim and the larger internal cathode anvil flag. Verify polarity in Diode mode (•◄|).'
                : c.kind === 'diode'
                  ? 'The silver/white band marks the Cathode (K). A healthy silicon diode drops ~0.6–0.7 V forward and reads OL reversed.'
                  : c.kind === 'switch'
                    ? '4-pin tactile switches pair two legs internally on each side (1-1 and 2-2). Pressing bridges side 1 to side 2.'
                    : c.kind === 'fuse'
                      ? 'Check for downstream shorts (Ω mode or 100 mA limit + Thermal view) before replacing a blown fuse.'
                      : 'Probe pads in V DC (Power ON) or Ω / Diode mode (Power OFF) to trace connectivity.',
          )}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${isPl ? 'Prace serwisowe' : 'Rework'}</div>
        <div class="row wrap">
          ${c.kind === 'switch' ? `<button class="btn sm primary" id="act-toggle-sw">${c.state.closed ? (isPl ? 'Zwolnij przełącznik' : 'Release switch') : (isPl ? 'Naciśnij przełącznik' : 'Press switch')}</button>` : ''}
          ${c.state.populated ? `<button class="btn sm" id="act-flip180">${isPl ? 'Obróć o 180°' : 'Rotate 180°'}</button>` : ''}
          ${c.state.cold.length ? `<button class="btn sm warn" id="act-reflow">${isPl ? 'Przetop luty' : 'Reflow joints'}</button>` : ''}
          ${c.state.populated ? `<button class="btn sm" id="act-desolder">${isPl ? 'Wylutuj element' : 'Remove part'}</button>` : ''}
          ${!c.state.populated || c.state.burnt ? `<button class="btn sm primary" id="act-fit">${isPl ? `Wlutuj nowy ${this.host.esc(KIND_NAMES[c.kind].toLowerCase())}` : `Fit new ${this.host.esc(KIND_NAMES[c.kind].toLowerCase())}`}</button>` : ''}
          <button class="btn sm" id="act-open-catalog" style="background:var(--accent-weak); border-color:var(--accent-line); color:var(--accent); font-weight:600;" title="${isPl ? 'Wybierz podzespół z bazy PCBWay / LCSC' : 'Pick from PCBWay / LCSC catalog'}">
            ${icon('box', 13)}
            <span>${isPl ? 'Wybierz z bazy PCBWay / LCSC' : 'Pick from Supplier Catalog'}</span>
          </button>
        </div>

        ${
          c.kind === 'resistor'
            ? `
          <div class="field">
            <label>Resistance (e.g. 100, 330, 4k7, 10k)</label>
            <div class="row">
              <input type="text" class="grow" id="inp-res-val" value="${c.value || 330}" />
              <button class="btn sm primary" id="act-install-res">Apply</button>
            </div>
            <select id="sel-e12" style="margin-top:2px">
              <option value="">Standard E12 value…</option>
              ${e12.map((v) => `<option value="${v}" ${Math.abs(v - c.value) < 0.01 ? 'selected' : ''}>${fmtOhm(v)}</option>`).join('')}
            </select>
          </div>
        `
            : ''
        }

        ${
          c.kind === 'led'
            ? `
          <div class="field">
            <label>LED emission color</label>
            <div class="row">
              <select class="grow" id="sel-led-col">
                ${LED_COLORS.map((col) => `<option value="${col}" ${c.color === col ? 'selected' : ''}>${col.toUpperCase()}</option>`).join('')}
              </select>
              <button class="btn sm primary" id="act-install-led">Apply</button>
            </div>
          </div>
        `
            : ''
        }

        ${
          c.kind === 'fuse'
            ? `
          <div class="field">
            <label>Fuse current rating (A)</label>
            <div class="row">
              <input type="number" class="grow" step="0.1" min="0.05" id="inp-fuse-val" value="${c.value || 0.5}" />
              <button class="btn sm primary" id="act-install-fuse">Apply</button>
            </div>
          </div>
        `
            : ''
        }

        ${
          c.kind === 'capacitor'
            ? `
          <div class="field">
            <label>Capacitance (e.g. 100n, 10u)</label>
            <div class="row">
              <input type="text" class="grow" id="inp-cap-val" value="${c.value ? fmtSI(c.value, 'F') : '100n'}" />
              <button class="btn sm primary" id="act-install-cap">Apply</button>
            </div>
          </div>
        `
            : ''
        }
      </div>

      ${this.host.isAuthorMode() ? this.faultCardHtml(c) : ''}
    `;

    sideBodyEl.querySelector('#btn-comp-back')?.addEventListener('click', () => {
      this.host.setSelectedCompId(null);
      this.render();
    });
    sideBodyEl.querySelector('#act-toggle-sw')?.addEventListener('click', () => {
      c.state.closed = !c.state.closed;
      sfxClick();
      this.host.recompute(false);
      this.render();
    });
    sideBodyEl.querySelector('#act-flip180')?.addEventListener('click', () => {
      this.host.pushUndo();
      c.state.reversed = !c.state.reversed;
      sfxClick();
      this.host.recompute(false);
      this.render();
    });
    sideBodyEl.querySelector('#act-reflow')?.addEventListener('click', () => {
      this.host.pushUndo();
      c.state.cold = [];
      sfxSolder();
      this.host.recompute(false);
      this.render();
    });
    sideBodyEl.querySelector('#act-fit')?.addEventListener('click', () => {
      this.host.pushUndo();
      installPart(c, { ...(c.value > 0 && { value: c.value }) });
      sfxSolder();
      this.host.recompute(false);
      this.host.toast(`Fitted a new ${c.ref}`, 'success');
      this.render();
    });
    sideBodyEl.querySelector('#act-desolder')?.addEventListener('click', () => {
      this.host.pushUndo();
      removePart(c);
      sfxSolder();
      this.host.recompute(false);
      this.render();
    });
    sideBodyEl.querySelector('#act-open-catalog')?.addEventListener('click', () => {
      this.host.openPartsBin(c);
    });
    sideBodyEl.querySelector('#sel-e12')?.addEventListener('change', (e) => {
      const v = Number((e.target as HTMLSelectElement).value);
      if (v > 0) {
        this.host.pushUndo();
        installPart(c, { value: v, reversed: c.state.reversed });
        sfxSolder();
        this.host.recompute(false);
        this.render();
      }
    });
    sideBodyEl.querySelector('#act-install-res')?.addEventListener('click', () => {
      const raw = (sideBodyEl.querySelector('#inp-res-val') as HTMLInputElement).value;
      const v = parseValue(raw);
      if (!Number.isFinite(v) || v <= 0) {
        this.host.toast('Invalid resistor value', 'danger');
        return;
      }
      this.host.pushUndo();
      installPart(c, { value: v, reversed: c.state.reversed });
      sfxSolder();
      this.host.recompute(false);
      this.render();
    });
    sideBodyEl.querySelector('#act-install-led')?.addEventListener('click', () => {
      const col = (sideBodyEl.querySelector('#sel-led-col') as HTMLSelectElement).value as LedColor;
      this.host.pushUndo();
      installPart(c, { color: col, reversed: c.state.reversed });
      sfxSolder();
      this.host.recompute(false);
      this.render();
    });
    sideBodyEl.querySelector('#act-install-fuse')?.addEventListener('click', () => {
      const v = Number((sideBodyEl.querySelector('#inp-fuse-val') as HTMLInputElement).value);
      if (!Number.isFinite(v) || v <= 0) {
        this.host.toast('Invalid fuse rating', 'danger');
        return;
      }
      this.host.pushUndo();
      installPart(c, { value: v });
      sfxSolder();
      this.host.recompute(false);
      this.render();
    });
    sideBodyEl.querySelector('#act-install-cap')?.addEventListener('click', () => {
      const raw = (sideBodyEl.querySelector('#inp-cap-val') as HTMLInputElement).value;
      const v = parseValue(raw);
      if (!Number.isFinite(v) || v <= 0) {
        this.host.toast('Invalid capacitance', 'danger');
        return;
      }
      this.host.pushUndo();
      installPart(c, { value: v });
      sfxSolder();
      this.host.recompute(false);
      this.render();
    });

    sideBodyEl.querySelector('#sab-burn')?.addEventListener('click', () => {
      this.host.pushUndo();
      c.state.burnt = !c.state.burnt;
      this.host.recompute(true);
      this.render();
    });
    sideBodyEl.querySelector('#sab-cold')?.addEventListener('click', () => {
      this.host.pushUndo();
      toggleCold(c, 0);
      this.host.recompute(true);
      this.render();
    });
    sideBodyEl.querySelector('#sab-rev')?.addEventListener('click', () => {
      this.host.pushUndo();
      c.state.reversed = !c.state.reversed;
      this.host.recompute(true);
      this.render();
    });
    if (this.host.isAuthorMode()) this.bindFaultCard(c);
  }

  /** Author-mode fault injection for one part: every fault class that fits it, with severity. */
  faultCardHtml(c: Component): string {
    const classes = applicableFaults(c);
    const faultClass = this.host.getFaultClass();
    const cls = classes.includes(faultClass) ? faultClass : classes[0];
    const hint = cls ? severityHint(cls) : null;
    const jointFault =
      cls === 'cold-joint' ||
      cls === 'thermal-open-joint' ||
      cls === 'flex-open-joint' ||
      cls === 'flex-close-joint' ||
      cls === 'net-break';
    const faults = listFaults(c);
    const fastBlind =
      this.host.getSolver() === 'fast' && (faults.some((f) => f.spiceOnly) || (cls && needsSpice(cls)));

    return `
      <div class="card">
        <div class="card-title">Fault injection · ${this.host.esc(c.ref)}</div>
        <div class="row wrap">
          <button class="btn sm warn" id="sab-burn">Toggle damage</button>
          <button class="btn sm warn" id="sab-cold">Toggle open joint</button>
          <button class="btn sm warn" id="sab-rev">Reverse 180°</button>
        </div>
        ${
          cls
            ? `
          <div class="field">
            <label>Fault class</label>
            <select id="sab-class">
              ${classes.map((k) => `<option value="${k}" ${k === cls ? 'selected' : ''}>${this.host.esc(FAULT_LABELS[k])}</option>`).join('')}
            </select>
          </div>
          <div class="grid-2">
            ${
              jointFault
                ? `
              <div class="field">
                <label>Pad</label>
                <select id="sab-pad">
                  <option value="">Random</option>
                  ${c.pads.map((p, i) => `<option value="${i}">${this.host.esc(p.name)}${p.net ? ` · ${this.host.esc(p.net)}` : ''}</option>`).join('')}
                </select>
              </div>
            `
                : ''
            }
            ${
              hint
                ? `
              <div class="field">
                <label>${this.host.esc(hint.what)} (${this.host.esc(hint.unit)})</label>
                <input type="text" id="sab-sev" placeholder="random ${hint.unit === 'Ω' ? `${fmtSI(hint.min, 'Ω')} – ${fmtSI(hint.max, 'Ω')}` : `${hint.min}–${hint.max}`}" />
              </div>
            `
                : ''
            }
          </div>
          <button class="btn sm warn block" id="sab-inject">Inject fault</button>
        `
            : ''
        }
        ${
          faults.length
            ? `
          <div class="card-title" style="margin-top:6px">Faults on ${this.host.esc(c.ref)} (${faults.length})</div>
          ${faults
            .map(
              (f) => `
            <div class="obj-row">
              <span class="mono">${this.host.esc(f.label)}${f.spiceOnly ? ' <span class="muted">· SPICE</span>' : ''}</span>
              <button class="btn ghost icon sm" data-clear-fault="${f.key}" title="Remove fault">${icon('x', 12)}</button>
            </div>
          `,
            )
            .join('')}
        `
            : ''
        }
        ${fastBlind ? `<div class="callout"><span class="h">Fast DC solver</span><span>Leaks, drift and resistive joints only exist in SPICE (Fast DC treats a resistive joint as open). Switch Bench → Solver to SPICE to see their effect.</span></div>` : ''}
      </div>
    `;
  }

  private bindFaultCard(c: Component) {
    const sideBodyEl = this.host.getSideBodyEl();
    const q = <T extends HTMLElement>(s: string) => sideBodyEl.querySelector<T>(s);
    q<HTMLSelectElement>('#sab-class')?.addEventListener('change', (e) => {
      this.host.setFaultClass((e.target as HTMLSelectElement).value as FaultClass);
      this.render();
    });
    q('#sab-inject')?.addEventListener('click', () => {
      const cls = (q<HTMLSelectElement>('#sab-class')?.value ?? '') as FaultClass;
      if (!applicableFaults(c).includes(cls)) return;
      const padRaw = q<HTMLSelectElement>('#sab-pad')?.value ?? '';
      const sevRaw = (q<HTMLInputElement>('#sab-sev')?.value ?? '').trim();
      let severity: number | undefined;
      if (sevRaw) {
        severity = severityHint(cls)?.unit === 'Ω' ? parseValue(sevRaw) : Number(sevRaw);
        if (!Number.isFinite(severity) || severity <= 0) {
          this.host.toast('Invalid severity', 'danger');
          return;
        }
        if (cls === 'flex-open-joint' || cls === 'flex-close-joint') severity = Math.min(severity, 1);
      }
      this.host.pushUndo();
      const f = injectFault(c, cls, rng((Math.random() * 2 ** 32) >>> 0), {
        severity,
        ...(padRaw !== '' && { pad: Number(padRaw) }),
      });
      updateIntermittents(this.host.getBoard(), this.host.environment());
      sfxClick();
      this.host.toast(f.describe, 'info');
      this.host.recompute(true);
      this.render();
    });
    sideBodyEl.querySelectorAll<HTMLButtonElement>('[data-clear-fault]').forEach((b) => {
      b.addEventListener('click', () => {
        this.host.pushUndo();
        clearFault(c, b.dataset.clearFault!);
        this.host.recompute(true);
        this.render();
      });
    });
  }
}
