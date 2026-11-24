import { serializeScenario } from '../../io/format';
import { MOD_FORMAT, type ModBoard } from '../../mods/mods';
import { desktop, type ModLoadResult, modsFolderPath, removeInstalled } from '../../mods/sources';
import { writeZip } from '../../mods/zip';
import type { Board, Scenario } from '../../types';
import { icon } from '../icons';
import { BRAND } from '../logo';

export interface ModsModalContext {
  getModalPos: () => [number, number];
  modalRootEl: HTMLElement;
  getModResult: () => ModLoadResult;
  getModBoards: () => Map<Scenario, ModBoard>;
  getScenarios: () => Scenario[];
  getActiveScenario: () => Scenario;
  getBoard: () => Board;
  getBundledIds: () => Set<string>;
  openScenario: (idx: number) => Promise<void> | void;
  installModFile: (f: File) => Promise<number>;
  loadMods: () => Promise<void>;
  refreshScenarioSelect: () => void;
  openBoards: () => void;
  toast: (msg: string, kind?: 'info' | 'success' | 'danger') => void;
  esc: (s: string) => string;
  onClose: () => void;
  isSuppressModalBgClose: () => boolean;
  resetSuppressModalBgClose: () => void;
}

export class ModsModalController {
  constructor(private ctx: ModsModalContext) {}

  public open() {
    this.render();
  }

  /** Modding guide: on the website next to the bench; the desktop app opens the site in the browser. */
  private get moddingUrl() {
    return desktop ? `${BRAND.site}modding.html` : './modding.html';
  }

  /** Packs the open board (with its current faults, objectives and flag lock) as a ready-to-share mod. */
  public async exportBoardAsMod() {
    const s = this.ctx.getActiveScenario();
    const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'board';
    const boardId = slug(s.meta.title);
    const author = s.meta.author && s.meta.author !== 'anonymous' ? s.meta.author : 'your-name';
    const manifest = {
      format: MOD_FORMAT,
      id: `${slug(author)}-${boardId}`.slice(0, 64),
      name: s.meta.title,
      version: '1.0.0',
      author,
      description: s.meta.description.slice(0, 300),
      license: s.meta.license ?? 'CC-BY-4.0',
      boards: [{ id: boardId, file: `boards/${boardId}.pcbfix.json` }],
    };
    const out: Scenario = { ...s, board: structuredClone(this.ctx.getBoard()) };
    // a built-in board keeps the built-in's id and flag: give the copy its own id; the old lock can't
    // follow (it is derived from the id), so the author locks a flag of their own first
    let lockNote = '';
    if (this.ctx.getBundledIds().has(s.id)) {
      out.id = `${manifest.id}-${boardId}`.slice(0, 80);
      if (out.lock) { delete out.lock; lockNote = ' It has no flag: lock your own in the Author tab first if you want one.'; }
    }
    const te = new TextEncoder();
    const zip = await writeZip([
      ['mod.json', te.encode(JSON.stringify(manifest, null, 2) + '\n')],
      [`boards/${boardId}.pcbfix.json`, te.encode(serializeScenario(out))],
    ]);
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${manifest.id}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.ctx.toast(`Saved ${manifest.id}.zip: check the name, author and licence in mod.json before sharing.${lockNote}`, lockNote ? 'info' : 'success');
  }

  public render() {
    const { mods, failed } = this.ctx.getModResult();
    const scenarios = this.ctx.getScenarios();
    const modBoards = this.ctx.getModBoards();
    const modalPos = this.ctx.getModalPos();

    const boardIdx = (b: ModBoard) => scenarios.findIndex((s) => modBoards.get(s) === b);
    const modCards = mods.map((m) => {
      const mf = m.manifest;
      return `
        <div class="card mod-card">
          <div class="mod-head">
            <div>
              <div class="mod-name">${this.ctx.esc(mf.name)} <span class="muted mono">v${this.ctx.esc(mf.version)}</span></div>
              <div class="muted">by ${this.ctx.esc(mf.author)} · ${this.ctx.esc(mf.license)} · ${this.ctx.esc(m.source.origin)}${mf.homepage ? ` · <a href="${this.ctx.esc(mf.homepage)}" target="_blank" rel="noopener">homepage</a>` : ''}</div>
            </div>
            ${m.source.origin === 'Installed' ? `<button class="btn sm ghost" data-mod-remove="${this.ctx.esc(mf.id)}" title="Remove this mod">${icon('x', 12)}<span>Remove</span></button>` : ''}
          </div>
          ${mf.description ? `<p class="text-2" style="margin:0">${this.ctx.esc(mf.description)}</p>` : ''}
          <div class="mod-boards">
            ${m.boards.map((b) => `<button class="btn sm" data-mod-open="${boardIdx(b)}">${icon('play', 11)}<span>${this.ctx.esc(b.stub.meta.title)}</span>${b.schematic ? `<span class="muted">· schematic</span>` : ''}</button>`).join('')}
          </div>
          ${m.warnings.length ? `<details class="mod-warn"><summary>${m.warnings.length} warning${m.warnings.length > 1 ? 's' : ''}</summary><ul>${m.warnings.map((w) => `<li>${this.ctx.esc(w)}</li>`).join('')}</ul></details>` : ''}
        </div>`;
    }).join('');

    const failedCards = failed.map((f) => `
      <div class="card mod-card mod-failed">
        <div class="card-title" style="margin:0">${icon('x', 13)} ${this.ctx.esc(f.name)} <span class="muted">${this.ctx.esc(f.origin)}</span></div>
        <p class="text-2 mono" style="margin:0;overflow-wrap:anywhere">${this.ctx.esc(f.error)}</p>
      </div>`).join('');

    this.ctx.modalRootEl.innerHTML = `
      <div class="modal-backdrop" id="mods-close-bg">
        <div class="modal board-catalog" style="transform: translate3d(${modalPos[0]}px, ${modalPos[1]}px, 0)">
          <div class="modal-head" title="Drag to move window">
            <div class="row">
              <h2>Mods</h2>
              <span class="badge info">${mods.length} loaded</span>
            </div>
            <div class="row">
              <button class="btn sm primary" id="mods-install">${icon('upload', 13)}<span>Install mod (.zip)</span></button>
              ${desktop ? `<button class="btn sm" id="mods-folder" title="${this.ctx.esc(modsFolderPath ?? '')}">${icon('box', 13)}<span>Open mods folder</span></button>` : ''}
              <button class="btn sm" id="mods-back">${icon('grid', 13)}<span>Boards</span></button>
              <button class="btn ghost icon sm" id="mods-close" title="Close (Esc)">${icon('x', 14)}</button>
            </div>
          </div>
          <div class="cat-body">
            <div class="card">
              <p class="text-2" style="margin:0">
                Mods add boards made by other people: KiCad or boardview files, repair challenges from the Author tab,
                with their BOM and schematic. Mods are data only, they can't run code.
                ${desktop ? 'Install a .zip here, or put mod folders / .zip files into the mods folder and reload (Ctrl/Cmd+R).' : 'Install a .zip here or drop it on the bench; it stays in this browser.'}
              </p>
              <div class="row wrap">
                <a class="btn sm" href="${this.moddingUrl}" target="_blank" rel="noopener">${icon('book', 13)}<span>How to make a mod</span></a>
                <button class="btn sm ghost" id="mods-export">${icon('download', 13)}<span>Current board as a mod</span></button>
              </div>
            </div>
            ${failedCards}
            ${modCards || `<div class="muted" style="padding:24px;text-align:center">No mods yet. Install a mod .zip, or make one from any board with "Current board as a mod".</div>`}
          </div>
          <input type="file" id="mods-file" accept=".zip,application/zip" hidden />
        </div>
      </div>`;

    const close = () => this.ctx.onClose();
    const root = this.ctx.modalRootEl;
    root.querySelector('#mods-close')?.addEventListener('click', close);
    root.querySelector('#mods-close-bg')?.addEventListener('click', (e) => {
      if (this.ctx.isSuppressModalBgClose()) {
        this.ctx.resetSuppressModalBgClose();
        return;
      }
      if ((e.target as HTMLElement).id === 'mods-close-bg') close();
    });
    root.querySelector('#mods-back')?.addEventListener('click', () => {
      this.ctx.openBoards();
    });
    const fileEl = root.querySelector<HTMLInputElement>('#mods-file')!;
    root.querySelector('#mods-install')?.addEventListener('click', () => fileEl.click());
    fileEl.addEventListener('change', async () => {
      const f = fileEl.files?.[0];
      if (!f) return;
      // installed cleanly: show its first board; otherwise stay here to show the error / warnings
      const warnings = await this.ctx.installModFile(f);
      if (warnings === 0) close();
      else this.render();
    });
    root.querySelector('#mods-folder')?.addEventListener('click', () => void desktop?.openModsFolder());
    root.querySelector('#mods-export')?.addEventListener('click', () => void this.exportBoardAsMod());
    root.querySelectorAll<HTMLButtonElement>('[data-mod-open]').forEach((b) => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.modOpen);
        close();
        if (scenarios[i]) void this.ctx.openScenario(i);
      });
    });
    root.querySelectorAll<HTMLButtonElement>('[data-mod-remove]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.dataset.modRemove!;
        const name = mods.find((m) => m.manifest.id === id)?.manifest.name ?? id;
        if (!confirm(`Remove the mod "${name}"? Its boards disappear from the list (your progress on them is kept).`)) return;
        try {
          await removeInstalled(id);
          await this.ctx.loadMods();
          this.ctx.refreshScenarioSelect();
          this.ctx.toast(`Removed mod "${name}"`, 'success');
        } catch (e) {
          this.ctx.toast(`Could not remove the mod: ${e instanceof Error ? e.message : e}`, 'danger');
        }
        this.render();
      });
    });
  }
}
