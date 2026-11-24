import type { BoardPresetMeta } from '../../boards/presetsMeta';
import { getLang, translateScenario } from '../../i18n';
import type { ModBoard } from '../../mods/mods';
import type { Scenario } from '../../types';
import { icon } from '../icons';
import { getTutorialTopics, isTutorialScenario, TUTORIAL_SCENARIO_IDS } from '../tutorial';

export type CatKey = 'tutorials' | 'challenges' | 'hardware' | 'mods';

export interface BoardsModalContext {
  getModalPos: () => [number, number];
  modalRootEl: HTMLElement;
  isMobile: () => boolean;
  getScenarios: () => Scenario[];
  getActiveScenario: () => Scenario;
  getSolvedIds: () => Set<string>;
  getModBoards: () => Map<Scenario, ModBoard>;
  getPresetStubs: () => Map<Scenario, BoardPresetMeta>;
  getDemoUrls: () => Map<Scenario, string>;
  hasVideo: (id: string) => boolean;
  getModFailedCount: () => number;
  openScenario: (idx: number) => Promise<void> | void;
  openBoardCreator: () => Promise<void> | void;
  createBlankBoard: () => void;
  openMods: () => void;
  importBoard: () => void;
  esc: (s: string) => string;
  onClose: () => void;
  isSuppressModalBgClose: () => boolean;
  resetSuppressModalBgClose: () => void;
}

export class BoardsModalController {
  private filter: 'all' | CatKey = 'all';
  private search = '';

  constructor(private ctx: BoardsModalContext) {}

  public open() {
    this.render();
  }

  public classifyScenario(s: Scenario): CatKey {
    if (this.ctx.getModBoards().has(s)) return 'mods';
    if (isTutorialScenario(s.id)) return 'tutorials';
    if (this.ctx.getPresetStubs().has(s) || s.solver === 'spice-power' || this.ctx.getDemoUrls().has(s) || s.board.components.length > 50) {
      return 'hardware';
    }
    return 'challenges';
  }

  /** Phone board list: one compact row per board (badge, title, two lines of description, status). */
  private phoneCatalogSection(title: string, solved: number, items: { s: Scenario; idx: number }[]): string {
    return `
      <section class="cat-sec">
        <div class="cat-sec-head"><h3>${this.ctx.esc(title)}</h3><span class="badge info">${solved}/${items.length}</span></div>
        <div class="m-cat-list">
          ${items.map(({ s, idx }) => {
            const isActive = s === this.ctx.getActiveScenario();
            const isSolved = this.ctx.getSolvedIds().has(s.id);
            const tutIdx = TUTORIAL_SCENARIO_IDS.indexOf(s.id as (typeof TUTORIAL_SCENARIO_IDS)[number]);
            const badge = tutIdx >= 0 ? `<span class="br-badge tut">${tutIdx + 1}</span>` : `<span class="br-badge" title="Difficulty ${s.meta.difficulty}/5">L${s.meta.difficulty}</span>`;
            const state = isSolved ? `<span class="br-state ok">${icon('check', 14)}</span>` : isActive ? `<span class="br-state on">Open</span>` : `<span class="br-state">${icon('chevronRight', 14)}</span>`;
            return `
              <button class="board-row ${isActive ? 'active' : ''} ${isSolved ? 'solved' : ''}" data-pick-board="${idx}">
                ${badge}
                <span class="br-main"><span class="br-title">${this.ctx.esc(s.meta.title)}</span><span class="br-desc">${this.ctx.esc(s.meta.description.replace(/^Beginner Tutorial \d+:\s*/, ''))}</span></span>
                ${state}
              </button>`;
          }).join('')}
        </div>
      </section>`;
  }

  public render() {
    const isPl = getLang() === 'pl';
    const isMobile = this.ctx.isMobile();
    const scenarios = this.ctx.getScenarios();
    const solvedIds = this.ctx.getSolvedIds();
    const modBoards = this.ctx.getModBoards();
    const modalPos = this.ctx.getModalPos();

    const counts: Record<CatKey, number> = { tutorials: 0, challenges: 0, hardware: 0, mods: 0 };
    for (const s of scenarios) counts[this.classifyScenario(s)]++;

    const sections: { key: CatKey; title: string; sub: string }[] = isPl ? [
      { key: 'tutorials', title: 'Samouczki dla początkujących', sub: 'Prowadzone krok po kroku płytki wyjaśniające podstawy elektroniki i napraw' },
      { key: 'challenges', title: 'Wyzwania serwisowe', sub: 'Zagadki diagnostyczne i lokalizowanie usterek w układach' },
      { key: 'hardware', title: 'Prawdziwy sprzęt & Open Source', sub: 'Pełne schematy z setkami elementów i boardview z silnikiem SPICE + PWR' },
      { key: 'mods', title: 'Modyfikacje społeczności', sub: 'Płytki z zainstalowanych modów. Zarządzaj nimi przyciskiem Mody' },
    ] : [
      { key: 'tutorials', title: 'Beginner Tutorials', sub: 'Guided step-by-step boards covering the core fundamentals' },
      { key: 'challenges', title: 'Repair Challenges', sub: 'Standalone fault-finding & multi-fault diagnostic puzzles' },
      { key: 'hardware', title: 'Real Hardware & Open Source', sub: 'Full multi-hundred-part schematics & boardviews on SPICE + PWR' },
      { key: 'mods', title: 'Community Mods', sub: 'Boards from mods you installed. Manage them with the Mods button' },
    ];

    const renderList = () => {
      const q = this.search.trim().toLowerCase();
      const blocks = sections
        .filter((sec) => this.filter === 'all' || this.filter === sec.key)
        .map((sec) => {
          const items = scenarios
            .map((s, idx) => ({ s, idx }))
            .filter(({ s }) => this.classifyScenario(s) === sec.key)
            .filter(({ s }) => {
              if (!q) return true;
              const topics = getTutorialTopics(s.id)?.join(' ') ?? '';
              const mod = modBoards.get(s)?.mod.name ?? '';
              return `${s.meta.title} ${s.meta.description} ${s.meta.author} ${topics} ${mod}`.toLowerCase().includes(q);
            });
          if (!items.length) return '';
          const solvedInSec = items.filter(({ s }) => solvedIds.has(s.id)).length;
          if (isMobile) return this.phoneCatalogSection(sec.title, solvedInSec, items);
          return `
            <section class="cat-sec">
              <div class="cat-sec-head">
                <div>
                  <h3>${this.ctx.esc(sec.title)}</h3>
                  <p>${this.ctx.esc(sec.sub)}</p>
                </div>
                <span class="badge info">${solvedInSec}/${items.length} solved</span>
              </div>
              <div class="cat-grid">
                ${items.map(({ s, idx }) => {
                  const isActive = s === this.ctx.getActiveScenario();
                  const isSolved = solvedIds.has(s.id);
                  const tr = translateScenario(s.id, s.meta.title, s.meta.description);
                  const tutIdx = TUTORIAL_SCENARIO_IDS.indexOf(s.id as (typeof TUTORIAL_SCENARIO_IDS)[number]);
                  const topics = getTutorialTopics(s.id);
                  const chips: string[] = [];
                  const mb = modBoards.get(s);
                  if (mb) {
                    chips.push(mb.mod.name, `by ${mb.mod.author}`);
                    if (mb.schematic) chips.push('Schematic');
                    if (s.meta.license) chips.push(s.meta.license);
                  } else if (topics) {
                    chips.push(...topics);
                  } else {
                    if (s.board.components.length > 1) chips.push(`${s.board.components.length} parts`);
                    if (s.meta.par) chips.push(`Par ${s.meta.par}`);
                    if (s.solver === 'spice-power') chips.push('SPICE + PWR');
                    if (this.ctx.hasVideo(s.id)) chips.push('Video guide');
                    if (s.meta.license) chips.push(s.meta.license);
                  }
                  const leftBadge = tutIdx >= 0
                    ? `<span class="badge info">Tutorial ${tutIdx + 1}</span>`
                    : `<span class="row"><span class="badge">L${s.meta.difficulty}</span><span class="lvl" title="Difficulty ${s.meta.difficulty}/5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= s.meta.difficulty ? 'on' : ''}"></i>`).join('')}</span></span>`;
                  const rightBadge = isSolved
                    ? `<span class="badge pass">${icon('check', 11)}<span>${getLang() === 'pl' ? 'Rozwiązane' : 'Solved'}</span></span>`
                    : isActive
                      ? `<span class="badge info">${getLang() === 'pl' ? 'Aktywna' : 'Active'}</span>`
                      : tutIdx >= 0
                        ? `<span class="badge">${getLang() === 'pl' ? 'Interaktywne' : 'Interactive'}</span>`
                        : '';
                  return `
                    <button class="board-card ${isActive ? 'active' : ''} ${isSolved ? 'solved' : ''}" data-pick-board="${idx}">
                      <div class="bc-top">
                        ${leftBadge}
                        ${rightBadge}
                      </div>
                      <div class="bc-title">${this.ctx.esc(tr.title)}</div>
                      <div class="bc-desc">${this.ctx.esc(tr.description)}</div>
                      ${chips.length ? `<div class="cat-chips">${chips.map((c) => `<span class="cat-chip">${this.ctx.esc(c)}</span>`).join('')}</div>` : ''}
                    </button>
                  `;
                }).join('')}
              </div>
            </section>
          `;
        })
        .join('');
      return blocks || `<div class="muted" style="padding:24px;text-align:center">No matching boards found.</div>`;
    };

    const filters: { id: 'all' | CatKey; label: string; count: number }[] = [
      { id: 'all', label: 'All', count: scenarios.length },
      { id: 'tutorials', label: 'Tutorials', count: counts.tutorials },
      { id: 'challenges', label: 'Challenges', count: counts.challenges },
      { id: 'hardware', label: isMobile ? 'Hardware' : 'Real Hardware', count: counts.hardware },
      ...(counts.mods ? [{ id: 'mods' as const, label: 'Mods', count: counts.mods }] : []),
    ];

    const modFailedCount = this.ctx.getModFailedCount();

    this.ctx.modalRootEl.innerHTML = isMobile ? `
      <div class="modal-backdrop" id="modal-close-bg">
        <div class="modal board-catalog m-cat">
          <div class="modal-head">
            <div class="row"><h2>Boards</h2><span class="badge info">${solvedIds.size}/${scenarios.length} solved</span></div>
            <button class="btn ghost icon sm" id="modal-close" title="Close">${icon('x', 14)}</button>
          </div>
          <div class="cat-toolbar">
            <div class="m-cat-filters">
              ${filters.map((f) => `<button class="${this.filter === f.id ? 'on' : ''}" data-cat-filter="${f.id}">${this.ctx.esc(f.label)} <span>${f.count}</span></button>`).join('')}
            </div>
            <input type="text" id="cat-search" placeholder="Search boards" value="${this.ctx.esc(this.search)}" />
          </div>
          <div class="cat-body" id="cat-list">${renderList()}</div>
          <div class="m-cat-foot">
            <button class="btn sm" id="cat-new">${icon('plus', 13)}<span>Blank</span></button>
            <button class="btn sm" id="cat-import">${icon('upload', 13)}<span>Import</span></button>
            <button class="btn sm" id="cat-mods">${icon('box', 13)}<span>Mods${modFailedCount ? ' ⚠' : ''}</span></button>
          </div>
        </div>
      </div>
    ` : `
      <div class="modal-backdrop" id="modal-close-bg">
        <div class="modal board-catalog" style="transform: translate3d(${modalPos[0]}px, ${modalPos[1]}px, 0)">
          <div class="modal-head" title="Drag to move window">
            <div class="row">
              <h2>Boards &amp; Tutorials</h2>
              <span class="badge info">${solvedIds.size} / ${scenarios.length} solved</span>
            </div>
            <div class="row">
              <button class="btn sm" id="cat-creator" style="color:var(--accent);border-color:var(--accent);" title="${isPl ? 'Twórz własne płytki i dobieraj części PCBWay/LCSC' : 'Create custom boards and pick PCBWay/LCSC parts'}">${icon('grid', 13)}<span>${isPl ? 'Kreator Płytek' : 'Board Creator'}</span></button>
              <button class="btn sm" id="cat-new">${icon('plus', 13)}<span>${isPl ? 'Pusta płytka' : 'Blank board'}</span></button>
              <button class="btn sm" id="cat-import">${icon('upload', 13)}<span>${isPl ? 'Importuj' : 'Import'}</span></button>
              <button class="btn sm" id="cat-mods" title="Install, remove and make mods">${icon('box', 13)}<span>Mods${modFailedCount ? ' ⚠' : ''}</span></button>
              <button class="btn ghost icon sm" id="modal-close" title="Close (Esc)">${icon('x', 14)}</button>
            </div>
          </div>
          <div class="cat-toolbar">
            <div class="seg">
              ${filters.map((f) => `<button class="${this.filter === f.id ? 'on' : ''}" data-cat-filter="${f.id}">${this.ctx.esc(f.label)} (${f.count})</button>`).join('')}
            </div>
            <input type="text" id="cat-search" class="grow" placeholder="Filter boards by name, symptom, or topic…" value="${this.ctx.esc(this.search)}" />
          </div>
          <div class="cat-body" id="cat-list">${renderList()}</div>
        </div>
      </div>
    `;

    const closeModal = () => this.ctx.onClose();

    const bindBoardPickers = () => {
      this.ctx.modalRootEl.querySelectorAll<HTMLButtonElement>('[data-pick-board]').forEach((b) => {
        b.addEventListener('click', () => {
          const idx = Number(b.dataset.pickBoard);
          closeModal();
          if (scenarios[idx]) void this.ctx.openScenario(idx);
        });
      });
    };
    bindBoardPickers();

    this.ctx.modalRootEl.querySelector('#modal-close')?.addEventListener('click', closeModal);
    this.ctx.modalRootEl.querySelector('#modal-close-bg')?.addEventListener('click', (e) => {
      if (this.ctx.isSuppressModalBgClose()) {
        this.ctx.resetSuppressModalBgClose();
        return;
      }
      if ((e.target as HTMLElement).id === 'modal-close-bg') closeModal();
    });
    this.ctx.modalRootEl.querySelector('#cat-creator')?.addEventListener('click', () => {
      closeModal();
      void this.ctx.openBoardCreator();
    });
    this.ctx.modalRootEl.querySelector('#cat-new')?.addEventListener('click', () => this.ctx.createBlankBoard());
    this.ctx.modalRootEl.querySelector('#cat-mods')?.addEventListener('click', () => {
      this.ctx.openMods();
    });
    this.ctx.modalRootEl.querySelector('#cat-import')?.addEventListener('click', () => {
      closeModal();
      this.ctx.importBoard();
    });
    this.ctx.modalRootEl.querySelectorAll<HTMLButtonElement>('[data-cat-filter]').forEach((b) => {
      b.addEventListener('click', () => {
        this.filter = b.dataset.catFilter as 'all' | CatKey;
        this.render();
      });
    });
    const searchEl = this.ctx.modalRootEl.querySelector<HTMLInputElement>('#cat-search');
    const listBox = this.ctx.modalRootEl.querySelector<HTMLElement>('#cat-list');
    searchEl?.addEventListener('input', () => {
      this.search = searchEl.value;
      if (listBox) {
        listBox.innerHTML = renderList();
        bindBoardPickers();
      }
    });
  }
}
