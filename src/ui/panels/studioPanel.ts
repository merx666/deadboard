import { buildConnectivity } from '../../connectivity';
import { lockFlag, packText, topology } from '../../crypto';
import { listFaults } from '../../faults';
import { serializeScenario } from '../../io/format';
import { BOTH_GAP, type Camera } from '../../render/camera';
import type { Board, Objective, Scenario } from '../../types';
import { icon } from '../icons';

export interface StudioPanelHost {
  getActiveScenario(): Scenario;
  getBoard(): Board;
  isAuthorMode(): boolean;
  getRefLockedHash(): string | null;
  getStudioFlagInput(): string;
  getBundledIds(): Set<string>;
  getSideBodyEl(): HTMLElement;
  getCamera(): Camera;

  esc(s: string): string;
  toast(msg: string, kind?: 'info' | 'success' | 'warn' | 'danger'): void;
  renderUI(): void;
  refreshScenarioSelect(): void;
  setStudioFlagInput(flag: string): void;
  setRefLockedHash(hash: string): void;
  setAuthorMode(on: boolean): void;
  setSelectedCompId(id: string | null): void;
  setActiveTab(tab: 'mission' | 'inspect' | 'studio'): void;
  exportBoardAsMod(): void;
}

export class StudioPanelController {
  constructor(private host: StudioPanelHost) {}

  render() {
    const s = this.host.getActiveScenario();
    const board = this.host.getBoard();
    const leds = board.components.filter((c) => c.kind === 'led').map((c) => c.ref);
    const probes = board.components.map((c) => c.ref);
    const faulted = board.components
      .map((c) => ({ c, faults: listFaults(c) }))
      .filter((x) => x.faults.length);
    const sideBodyEl = this.host.getSideBodyEl();
    const authorMode = this.host.isAuthorMode();
    const refLockedHash = this.host.getRefLockedHash();
    const studioFlagInput = this.host.getStudioFlagInput();

    sideBodyEl.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>Scenario metadata</span>
          <span class="badge info">${refLockedHash ? `#${refLockedHash}` : s.lock ? 'Locked' : 'Draft'}</span>
        </div>
        <div class="muted">
          1. Build, repair, or import a working board.<br/>
          2. Define objectives and lock a reference flag.<br/>
          3. Inject faults, then export JSON or copy a share link.
        </div>
        <div class="field">
          <label>Title</label>
          <input type="text" id="st-title" value="${this.host.esc(s.meta.title)}" />
        </div>
        <div class="grid-2">
          <div class="field">
            <label>Author</label>
            <input type="text" id="st-author" value="${this.host.esc(s.meta.author)}" />
          </div>
          <div class="field">
            <label>Difficulty (1–5)</label>
            <input type="number" min="1" max="5" id="st-diff" value="${s.meta.difficulty}" />
          </div>
        </div>
        <div class="field">
          <label>Description</label>
          <textarea id="st-desc" rows="2">${this.host.esc(s.meta.description)}</textarea>
        </div>
        <div class="field">
          <label>Diagnostic notes (one per line)</label>
          <textarea id="st-hints" rows="2">${this.host.esc(s.meta.hints.join('\n'))}</textarea>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Objectives (${s.objectives.length})</div>
        ${s.objectives
          .map(
            (o, i) => `
          <div class="obj-row">
            <span class="mono">
              ${o.type === 'led' ? `LED ${o.ref} = ${o.on ? 'ON' : 'OFF'}` : `V(${o.a}) ∈ [${o.min}, ${o.max}] V`}
            </span>
            <button class="btn ghost icon sm" data-del-obj="${i}" title="Remove">${icon('x', 12)}</button>
          </div>
        `,
          )
          .join('')}
        <div class="row">
          <select class="grow" id="st-obj-ref">
            ${(leds.length ? leds : probes).map((r) => `<option value="${r}">${r}</option>`).join('')}
          </select>
          <button class="btn sm" id="st-add-led">Add LED on</button>
        </div>
        <div class="row">
          <input type="number" step="0.1" id="st-vmin" value="2.3" style="width:72px" placeholder="min V" />
          <input type="number" step="0.1" id="st-vmax" value="2.7" style="width:72px" placeholder="max V" />
          <button class="btn sm grow" id="st-add-v">Add V range</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Verification & fault mode</div>
        <div class="field">
          <label>CTF flag</label>
          <input type="text" id="st-flag" value="${this.host.esc(studioFlagInput)}" />
        </div>
        <button class="btn sm primary block" id="st-lock">${icon('lock', 13)}<span>Lock reference topology & flag</span></button>
        <button class="btn sm block ${authorMode ? 'warn' : ''}" id="st-author-mode">
          ${authorMode ? 'Fault injection active' : 'Enable fault injection'}
        </button>
      </div>

      <div class="card">
        <div class="card-title">Injected faults (${faulted.reduce((n, x) => n + x.faults.length, 0)})</div>
        ${
          faulted.length
            ? faulted
                .map(
                  ({ c, faults }) => `
          <button class="btn ghost sm block" data-goto-fault="${this.host.esc(c.id)}" style="display:block;text-align:left;height:auto;padding:4px 6px;white-space:normal;overflow-wrap:anywhere">
            <b class="mono">${this.host.esc(c.ref)}</b>
            ${faults.map((f) => `<div class="muted" style="font-size:11px">${this.host.esc(f.label)}</div>`).join('')}
          </button>
        `,
                )
                .join('')
            : `<div class="muted">None yet. Enable fault injection, select a part (Inspect tab) and inject a fault.</div>`
        }
      </div>

      <div class="card">
        <div class="card-title">Export</div>
        <div class="grid-2">
          <button class="btn sm primary" id="st-export-json">${icon('download', 13)}<span>Export JSON</span></button>
          <button class="btn sm" id="st-share-url">${icon('link', 13)}<span>Copy link</span></button>
          <button class="btn sm" id="st-export-mod" style="grid-column:span 2" title="A .zip others can install from Boards → Mods">${icon('box', 13)}<span>Export as mod (.zip)</span></button>
        </div>
      </div>
    `;

    const syncMeta = () => {
      s.meta.title =
        (sideBodyEl.querySelector('#st-title') as HTMLInputElement).value.trim() || 'Untitled';
      s.meta.author =
        (sideBodyEl.querySelector('#st-author') as HTMLInputElement).value.trim() || 'anonymous';
      s.meta.difficulty = Math.max(
        1,
        Math.min(
          5,
          Number((sideBodyEl.querySelector('#st-diff') as HTMLInputElement).value) || 2,
        ),
      );
      s.meta.description = (sideBodyEl.querySelector('#st-desc') as HTMLTextAreaElement).value;
      s.meta.hints = (sideBodyEl.querySelector('#st-hints') as HTMLTextAreaElement).value
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);
      this.host.refreshScenarioSelect();
    };

    ['#st-title', '#st-author', '#st-diff', '#st-desc', '#st-hints'].forEach((sel) => {
      sideBodyEl.querySelector(sel)?.addEventListener('change', syncMeta);
    });

    sideBodyEl.querySelectorAll<HTMLButtonElement>('[data-del-obj]').forEach((b) => {
      b.addEventListener('click', () => {
        s.objectives.splice(Number(b.dataset.delObj), 1);
        this.render();
      });
    });

    sideBodyEl.querySelector('#st-add-led')?.addEventListener('click', () => {
      const ref = (sideBodyEl.querySelector('#st-obj-ref') as HTMLSelectElement).value;
      if (ref) {
        s.objectives.push({ type: 'led', ref, on: true } satisfies Objective);
        this.render();
      }
    });

    sideBodyEl.querySelector('#st-add-v')?.addEventListener('click', () => {
      const ref = (sideBodyEl.querySelector('#st-obj-ref') as HTMLSelectElement).value;
      const min = Number((sideBodyEl.querySelector('#st-vmin') as HTMLInputElement).value);
      const max = Number((sideBodyEl.querySelector('#st-vmax') as HTMLInputElement).value);
      if (ref && Number.isFinite(min) && Number.isFinite(max)) {
        s.objectives.push({ type: 'voltage', a: ref, min, max } satisfies Objective);
        this.render();
      }
    });

    sideBodyEl.querySelector('#st-lock')?.addEventListener('click', async () => {
      syncMeta();
      const flag = (sideBodyEl.querySelector('#st-flag') as HTMLInputElement).value.trim();
      if (!flag) {
        this.host.toast('Enter a CTF flag first', 'danger');
        return;
      }
      this.host.setStudioFlagInput(flag);
      const bundledIds = this.host.getBundledIds();
      if (bundledIds.has(s.id)) {
        s.id = `custom-${s.meta.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 30)}-${Date.now().toString(36)}`;
      }
      const conn = buildConnectivity(board);
      const topo = topology(board, conn, s.id);
      s.lock = await lockFlag(flag, topo);
      this.host.setRefLockedHash(topo.slice(0, 6));
      this.host.setAuthorMode(true);
      this.host.toast(
        'Reference topology locked! Now sabotage the board and export/share.',
        'success',
      );
      this.host.renderUI();
    });

    sideBodyEl.querySelectorAll<HTMLButtonElement>('[data-goto-fault]').forEach((b) => {
      b.addEventListener('click', () => {
        const c = board.components.find((x) => x.id === b.dataset.gotoFault);
        if (!c) return;
        this.host.setSelectedCompId(c.id);
        this.host.setActiveTab('inspect');
        const camera = this.host.getCamera();
        if (camera.bothSides) {
          camera.focusAt(
            c.side === 'B' ? board.w * 2 + BOTH_GAP - c.at[0] : c.at[0],
            c.at[1],
            10,
          );
        } else {
          camera.focusAt(c.at[0], c.at[1], 10, c.side);
        }
        this.host.renderUI();
      });
    });

    sideBodyEl.querySelector('#st-author-mode')?.addEventListener('click', () => {
      this.host.setAuthorMode(!authorMode);
      this.host.renderUI();
    });

    sideBodyEl.querySelector('#st-export-json')?.addEventListener('click', () => {
      syncMeta();
      const out: Scenario = { ...s, board: structuredClone(board) };
      const blob = new Blob([serializeScenario(out)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${s.meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'puzzle'}.pcbfix.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.host.toast('Exported .pcbfix.json challenge!', 'success');
    });

    sideBodyEl.querySelector('#st-export-mod')?.addEventListener('click', () => {
      syncMeta();
      this.host.exportBoardAsMod();
    });

    sideBodyEl.querySelector('#st-share-url')?.addEventListener('click', async () => {
      syncMeta();
      const out: Scenario = { ...s, board: structuredClone(board) };
      const packed = await packText(serializeScenario(out));
      const shareUrl = `${window.location.origin}${window.location.pathname}#s=${packed}`;
      await navigator.clipboard?.writeText(shareUrl);
      this.host.toast('Shareable puzzle URL copied to clipboard!', 'success');
    });
  }
}
