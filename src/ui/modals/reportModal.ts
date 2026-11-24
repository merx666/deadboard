import type { Board, Objective, Scenario } from '../../types';
import { getLang, translateScenario } from '../../i18n';
import { icon } from '../icons';

export interface ReportModalContext {
  getScenario: () => Scenario;
  getBoard: () => Board;
  getModalPos: () => [number, number];
  modalRootEl: HTMLElement;
  isSolved: () => boolean;
  getMoves: () => number;
  isPowerOn: () => boolean;
  getPsuInject: () => { volts: number; amps: number } | null;
  getRevealedFlag: () => string | null;
  getOcpAmps: () => number;
  getSolver: () => string;
  getProbeRed: () => { net: string | number; label: string } | null;
  getProbeBlack: () => { net: string | number; label: string } | null;
  esc: (s: string) => string;
  onClose: () => void;
}

export class ReportModalController {
  constructor(private ctx: ReportModalContext) {}

  render(): void {
    const isPl = getLang() === 'pl';
    const s = this.ctx.getScenario();
    const board = this.ctx.getBoard();
    const tr = translateScenario(s.id, s.meta.title, s.meta.description);
    const dateStr = new Date().toLocaleString(isPl ? 'pl-PL' : 'en-US');
    const isSolved = this.ctx.isSolved();
    const moves = this.ctx.getMoves();
    const powerOn = this.ctx.isPowerOn();
    const psuInject = this.ctx.getPsuInject();
    const psuState = powerOn ? (psuInject ? `Wstrzykiwanie (${psuInject.volts}V, ${psuInject.amps}A)` : 'Włączone (Zasilanie główne)') : 'Wyłączone';
    const revealedFlag = this.ctx.getRevealedFlag();
    const flagStr = revealedFlag ? revealedFlag : (isSolved ? 'Zaliczono' : 'Zablokowana');
    const ocpAmps = this.ctx.getOcpAmps();
    const solver = this.ctx.getSolver();
    const probeRed = this.ctx.getProbeRed();
    const probeBlack = this.ctx.getProbeBlack();

    const reportMd = `# Protokół Diagnozy i Weryfikacji Projektu LiveBoard (PulsePCB Studio)
**Płytka badana**: ${tr.title} (${s.id})
**Data badania**: ${dateStr}
**Status końcowy**: ${isSolved ? '✅ ZALICZONO (Zgodność z projektem)' : '⏳ W TRAKCIE DIAGNOZY'}
**Liczba wykonanych operacji (Moves)**: ${moves} ${s.meta.par ? `/ Par: ${s.meta.par}` : ''}
**Flaga weryfikacyjna**: ${flagStr}

---

## 1. Stan Początkowy i Założenia Projektowe
${tr.description}

## 2. Pomiary i Telemetria Warsztatowa
- Stan Zasilacza: ${psuState}
- Nastawa OCP: ${ocpAmps === 0 ? 'Brak limitu' : `${ocpAmps * 1000} mA`}
- Tryb symulatora: ${solver.toUpperCase()}
- Sonda czerwona: ${probeRed ? `Węzeł ${probeRed.net} (${probeRed.label})` : 'Niepodłączona'}
- Sonda czarna: ${probeBlack ? `Węzeł ${probeBlack.net} (${probeBlack.label})` : 'Masa (GND)'}

## 3. Cele Testowe i Weryfikacja
${s.objectives.map((o: Objective, idx: number) => {
  if (o.type === 'led') return `- Cel ${idx + 1}: Dioda ${o.ref} powinna ${o.on ? 'świecić' : 'być zgaszona'}`;
  if (o.type === 'voltage') return `- Cel ${idx + 1}: Napięcie na ${o.a}: oczekiwane ${o.min}V - ${o.max}V`;
  return `- Cel ${idx + 1}: ${(o as { type: string }).type}`;
}).join('\n')}

---
*Wygenerowano przez LiveBoard Studio · Laboratorium Elektroniki*
`;

    const modalPos = this.ctx.getModalPos();
    this.ctx.modalRootEl.innerHTML = `
      <div class="modal-backdrop" id="rep-close-bg">
        <div class="modal" style="transform: translate3d(${modalPos[0]}px, ${modalPos[1]}px, 0); max-width: 640px;">
          <div class="modal-head" title="Drag to move window">
            <h2>${isPl ? 'Protokół Diagnozy i Naprawy Laboratoryjnej' : 'Bench Diagnostic & Repair Report'}</h2>
            <button class="btn ghost icon sm" id="rep-close" title="Close">${icon('x', 14)}</button>
          </div>
          <div class="card" style="padding:16px;">
            <div class="report-content">${this.ctx.esc(reportMd)}</div>
            <div class="row wrap" style="margin-top:14px; justify-content:flex-end; gap:8px;">
              <button class="btn primary sm" id="rep-dl-md">${icon('download', 13)}<span>${isPl ? 'Pobierz raport (.md)' : 'Download Report (.md)'}</span></button>
              <button class="btn sm" id="rep-dl-json">${icon('download', 13)}<span>${isPl ? 'Pobierz stan (.json)' : 'Download State (.json)'}</span></button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.ctx.modalRootEl.querySelector('#rep-close')?.addEventListener('click', () => this.ctx.onClose());
    this.ctx.modalRootEl.querySelector('#rep-close-bg')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'rep-close-bg') {
        this.ctx.onClose();
      }
    });

    this.ctx.modalRootEl.querySelector('#rep-dl-md')?.addEventListener('click', () => {
      const blob = new Blob([reportMd], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `raport-pcb-${s.id}.md`;
      a.click();
    });

    this.ctx.modalRootEl.querySelector('#rep-dl-json')?.addEventListener('click', () => {
      const data = {
        scenarioId: s.id,
        title: tr.title,
        solved: isSolved,
        moves,
        flag: revealedFlag,
        timestamp: new Date().toISOString(),
        board,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `liveboard-${s.id}-telemetria.json`;
      a.click();
    });
  }
}
