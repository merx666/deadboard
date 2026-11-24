import { getLang, t as i18n, translateScenario } from '../../i18n';
import type { ModBoard } from '../../mods/mods';
import type { Scenario } from '../../types';
import type { VerifyResult } from '../../verify';
import { icon } from '../icons';
import { isTutorialScenario, TUTORIAL_SCENARIO_IDS } from '../tutorial';

const fmtDur = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export interface MissionPanelHost {
  getActiveScenario(): Scenario;
  getLastVerify(): VerifyResult | null;
  getMoves(): number;
  getHintsShown(): number;
  getSolvedIds(): Set<string>;
  getScenarios(): Scenario[];
  getRevealedFlag(): string | null;
  isTutorialOpen(): boolean;
  getSideBodyEl(): HTMLElement;
  getModBoards(): Map<Scenario, ModBoard>;
  getVideos(): Record<string, { approach: { seconds: number }; solution: { seconds: number } }>;

  esc(s: string): string;
  txt(s: string): string;
  toast(msg: string, kind?: 'info' | 'success' | 'warn' | 'danger'): void;
  runVerify(): Promise<void>;
  startTutorial(): void;
  openBoardCatalog(): void;
  openScenario(idx: number): Promise<void>;
  openSchematic(s: Scenario): Promise<void>;
  playVideo(scenarioId: string, which: 'approach' | 'solution'): void;
  setHintsShown(n: number): void;
}

export class MissionPanelController {
  constructor(private host: MissionPanelHost) {}

  render() {
    const s = this.host.getActiveScenario();
    const isPl = getLang() === 'pl';
    const tr = translateScenario(s.id, s.meta.title, s.meta.description);
    const hints = i18n().scenarios[s.id]?.hints ?? s.meta.hints;
    const v = this.host.getLastVerify();
    const inTutTrack = isTutorialScenario(s.id);
    const sideBodyEl = this.host.getSideBodyEl();
    const moves = this.host.getMoves();
    const solvedIds = this.host.getSolvedIds();
    const scenarios = this.host.getScenarios();
    const revealedFlag = this.host.getRevealedFlag();
    const hintsShown = this.host.getHintsShown();
    const modBoards = this.host.getModBoards();
    const videos = this.host.getVideos();
    const tutorialOpen = this.host.isTutorialOpen();

    sideBodyEl.innerHTML = `
      <div class="card">
        <div class="card-title lg">
          <span>${this.host.esc(tr.title)}</span>
          <span class="badge info">${moves}${s.meta.par ? ` / ${s.meta.par}` : ''} ${isPl ? 'ruchów' : 'moves'}</span>
        </div>
        <div class="row" style="justify-content:space-between">
          <span class="muted">${isPl ? 'Autor' : 'By'}: ${this.host.esc(s.meta.author)}</span>
          <span class="lvl" title="Difficulty ${s.meta.difficulty}/5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= s.meta.difficulty ? 'on' : ''}"></i>`).join('')}</span>
        </div>
        <div class="text-2">${this.host.esc(this.host.txt(tr.description))}</div>
        ${
          s.meta.credits
            ? `
          <div class="credits">
            <span>${this.host.esc(s.meta.credits)}</span>
            <span class="mono">${s.meta.license ? `Licence: ${this.host.esc(s.meta.license)}` : ''}${s.meta.source ? ` · <a href="${this.host.esc(s.meta.source.split(' @ ')[0])}" target="_blank" rel="noopener">source${s.meta.source.includes(' @ ') ? ` @ ${this.host.esc(s.meta.source.split(' @ ')[1])}` : ''}</a>` : ''}</span>
          </div>
        `
            : ''
        }
        ${
          modBoards.get(s)?.schematic
            ? `
          <div class="row wrap" style="margin-top:8px">
            <button class="btn sm" id="open-schematic">${icon('book', 12)}<span>${isPl ? 'Schemat ideowy' : 'Schematic'}</span></button>
            <span class="muted">from the mod "${this.host.esc(modBoards.get(s)!.mod.name)}"</span>
          </div>
        `
            : ''
        }
        ${
          videos[s.id]
            ? `
          <div class="walkthrough">
            <span class="walk-title">${isPl ? 'Wideo instruktażowe' : 'Walkthrough'}</span>
            <div class="row wrap">
              <button class="btn sm primary" id="vid-approach">${icon('play', 12)}<span>${isPl ? 'Jak podejść do problemu' : 'How to approach'} · ${fmtDur(videos[s.id].approach.seconds)}</span></button>
              <button class="btn sm" id="vid-solution">${isPl ? 'Pokaż rozwiązanie' : 'Show solution'}</button>
            </div>
          </div>
        `
            : ''
        }
        ${
          !tutorialOpen && inTutTrack
            ? `
          <button class="btn sm block" id="btn-start-tut">${icon('book', 13)}<span>${isPl ? 'Uruchom interaktywny samouczek' : 'Start interactive beginner tutorial'}</span></button>
        `
            : ''
        }
        ${
          !inTutTrack
            ? `
          <button class="btn sm block" id="btn-open-catalog">${icon('grid', 13)}<span>${isPl ? 'Przeglądaj wszystkie płytki i zadania' : 'Browse all boards &amp; tutorials'}</span></button>
        `
            : ''
        }
      </div>

      ${
        inTutTrack
          ? `
        <div class="card">
          <div class="card-title">
            <span>${isPl ? 'Ścieżka dla początkujących' : 'Beginner tutorial track'}</span>
            <div class="row">
              <span class="badge info">${TUTORIAL_SCENARIO_IDS.filter((id) => solvedIds.has(id)).length}/${TUTORIAL_SCENARIO_IDS.length}</span>
              <button class="btn sm" id="btn-open-catalog">${isPl ? 'Wszystkie płytki' : 'All boards'}</button>
            </div>
          </div>
          <div class="stack">
            ${TUTORIAL_SCENARIO_IDS.map((id, idx) => {
              const scIdx = scenarios.findIndex((x) => x.id === id);
              const scItem = scIdx >= 0 ? scenarios[scIdx] : null;
              if (!scItem) return '';
              const isCur = id === s.id;
              const isDone = solvedIds.has(id);
              const scTr = translateScenario(scItem.id, scItem.meta.title, scItem.meta.description);
              return `
                <button class="list-btn" data-open-sc="${scIdx}" style="${isCur ? 'background:var(--accent-weak);border:1px solid var(--accent-line)' : ''}">
                  <span><b>${idx + 1}.</b> ${this.host.esc(scTr.title)}</span>
                  ${isDone ? `<span class="badge pass">${isPl ? 'Zrobione' : 'Done'}</span>` : isCur ? `<span class="badge info">${isPl ? 'Aktywna' : 'Active'}</span>` : `<span class="sub">L1</span>`}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `
          : ''
      }

      ${
        revealedFlag
          ? `
        <div class="flag-box">
          <div class="card-title" style="color:var(--accent)">
            <span class="row">${icon('flag', 14)}<span>${isPl ? 'Flaga odblokowana!' : 'Flag unlocked'}</span></span>
            <button class="btn sm" id="btn-copy-flag">${icon('copy', 13)}<span>${isPl ? 'Kopiuj' : 'Copy'}</span></button>
          </div>
          <div class="flag-code" id="flag-txt">${this.host.esc(revealedFlag)}</div>
        </div>
      `
          : ''
      }

      <div class="card">
        <div class="card-title">
          <span>${isPl ? 'Cele testowe' : 'Objectives'}</span>
          <button class="btn sm primary" id="btn-panel-verify">${icon('play', 12)}<span>${isPl ? 'Uruchom testy' : 'Run tests'}</span></button>
        </div>
        ${s.objectives.length === 0 ? `<div class="muted">${isPl ? 'Brak zdefiniowanych celów.' : 'No objectives defined.'}</div>` : ''}
        ${(v
          ? v.results
          : s.objectives.map((o) => ({
              objective: o,
              label:
                o.type === 'led'
                  ? `${o.ref} ${isPl ? (o.on ? 'musi ŚWIECIĆ' : 'musi być ZGASZONA') : `must be ${o.on ? 'ON' : 'OFF'}`}`
                  : `V(${o.a}${o.b ? `−${o.b}` : ''}) ∈ [${o.min}, ${o.max}] V`,
              passed: false,
              detail: isPl ? 'Uruchom testy, aby sprawdzić' : 'Run tests to verify',
            }))
        )
          .map(
            (r) => `
          <div class="obj-row ${v ? (r.passed ? 'pass' : 'fail') : ''}">
            <div>
              <div class="t">${this.host.esc(r.label)}</div>
              <div class="d">${this.host.esc(r.detail)}</div>
            </div>
            ${v ? `<span class="badge ${r.passed ? 'pass' : 'fail'}">${r.passed ? (isPl ? 'Zaliczono' : 'Pass') : isPl ? 'Błąd' : 'Fail'}</span>` : ''}
          </div>
        `,
          )
          .join('')}
        ${
          v && v.overloads.length > 0
            ? `
          <div class="obj-row fail">
            <div>
              <div class="t">${isPl ? 'Przeciążenie termiczne / prądowe' : 'Thermal / current overload'}</div>
              <div class="d">${v.overloads.map((o) => `${this.host.esc(o.ref)}: ${this.host.esc(o.msg)}`).join('; ')}</div>
            </div>
            <span class="badge fail">${isPl ? 'Usterka' : 'Fault'}</span>
          </div>
        `
            : ''
        }
      </div>

      ${
        hints && hints.length > 0
          ? `
        <div class="card">
          <div class="card-title">
            <span>${isPl ? 'Wskazówki' : 'Notes'} (${hintsShown}/${hints.length})</span>
            ${hintsShown < hints.length ? `<button class="btn sm" id="btn-next-hint">${isPl ? 'Odkryj wskazówkę' : 'Reveal note'}</button>` : ''}
          </div>
          ${hints
            .slice(0, hintsShown)
            .map(
              (h, i) => `
            <div class="hint-item"><b>${i + 1}.</b> ${this.host.esc(this.host.txt(h))}</div>
          `,
            )
            .join('')}
          ${hintsShown === 0 ? `<div class="muted">${isPl ? 'Dostępne są progresywne wskazówki laboratoryjne.' : 'Progressive diagnostic notes are available if needed.'}</div>` : ''}
        </div>
      `
          : ''
      }
    `;

    sideBodyEl.querySelector('#btn-panel-verify')?.addEventListener('click', () => void this.host.runVerify());
    sideBodyEl.querySelector('#btn-start-tut')?.addEventListener('click', () => this.host.startTutorial());
    sideBodyEl.querySelector('#btn-open-catalog')?.addEventListener('click', () => this.host.openBoardCatalog());
    sideBodyEl.querySelectorAll<HTMLButtonElement>('[data-open-sc]').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.openSc);
        if (scenarios[idx]) void this.host.openScenario(idx);
      });
    });
    sideBodyEl.querySelector('#open-schematic')?.addEventListener('click', () => void this.host.openSchematic(s));
    sideBodyEl.querySelector('#vid-approach')?.addEventListener('click', () => this.host.playVideo(s.id, 'approach'));
    const sol = sideBodyEl.querySelector<HTMLButtonElement>('#vid-solution');
    sol?.addEventListener('click', () => {
      if (sol.dataset.armed) {
        this.host.playVideo(s.id, 'solution');
        return;
      }
      sol.dataset.armed = '1';
      sol.classList.add('warn');
      sol.textContent = `Spoilers ahead — play solution (${fmtDur(videos[s.id].solution.seconds)})`;
    });
    sideBodyEl.querySelector('#btn-next-hint')?.addEventListener('click', () => {
      this.host.setHintsShown(Math.min(hints.length, hintsShown + 1));
      this.render();
    });
    sideBodyEl.querySelector('#btn-copy-flag')?.addEventListener('click', async () => {
      if (revealedFlag) {
        await navigator.clipboard?.writeText(revealedFlag);
        this.host.toast('Flag copied to clipboard', 'success');
      }
    });
  }
}
