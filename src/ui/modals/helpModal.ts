import { getLang } from '../../i18n';
import { icon } from '../icons';
import { getBeginnerPrimerHtml } from '../tutorial';

export interface HelpModalContext {
  getModalPos: () => [number, number];
  modalRootEl: HTMLElement;
  txt: (html: string) => string;
  onOpenFeedback: () => void;
  onClose: () => void;
  isSuppressModalBgClose: () => boolean;
  resetSuppressModalBgClose: () => void;
}

export class HelpModalController {
  constructor(private ctx: HelpModalContext) {}

  render(): void {
    const isPl = getLang() === 'pl';
    const modalPos = this.ctx.getModalPos();
    this.ctx.modalRootEl.innerHTML = this.ctx.txt(`
      <div class="modal-backdrop" id="help-close-bg">
        <div class="modal" style="transform: translate3d(${modalPos[0]}px, ${modalPos[1]}px, 0)">
          <div class="modal-head" title="${isPl ? 'Przeciągnij, aby przesunąć okno' : 'Drag to move window'}">
            <h2>${isPl ? 'Dokumentacja i Pomoc' : 'Documentation'}</h2>
            <button class="btn ghost icon sm" id="help-close" title="${isPl ? 'Zamknij' : 'Close'}">${icon('x', 14)}</button>
          </div>
          <div class="card">
            <div class="card-title">${isPl ? 'Przegląd symulatora' : 'Overview'}</div>
            <p class="text-2" style="margin:0">
              ${isPl
                ? 'Każdy scenariusz to symulowana płytka drukowana rozwiązywana przez szybką analizę węzłową DC lub pełny silnik SPICE (wybór w górnym pasku; możliwość eksportu każdej płytki jako netlisty ngspice <code>.cir</code>), renderowana w 2D/3D z akceleracją WebGPU. Diagnozuj usterki elektryczne, lutuj i naprawiaj obwód, a następnie kliknij <b>Uruchom testy</b>, aby zweryfikować naprawę i odszyfrować flagę CTF.'
                : 'Each scenario provides a simulated circuit board solved via fast DC nodal analysis or a full SPICE engine (selectable in the top bar; export any board as an ngspice <code>.cir</code> netlist), rendered in 2D/3D WebGPU. Diagnose electrical faults, perform rework, and execute <b>Run tests</b> to verify repairs and decrypt the CTF flag.'}
            </p>
          </div>
          ${getBeginnerPrimerHtml()}
          <div class="card">
            <div class="card-title">${isPl ? 'Zasady diagnozy usterek' : 'Fault diagnosis'}</div>
            <ul>
              ${isPl ? `
                <li><b>Przerwana lub przecięta ścieżka</b> — Wyłącz zasilanie, sprawdź ciągłość w trybie <b>Ω</b>, a następnie połącz przerwę <b>Lutownicą (3)</b> lub <b>Kynarem / Zworką (6)</b>.</li>
                <li><b>Mostek lutowniczy lub opiłek miedzi</b> — Obróć płytkę na stronę dolną (<b>F</b>) i zbadaj dokładnie. Usuń nadmiar cyny <b>Plecionką (4)</b> lub przetnij zwarcie <b>Skalpelem (7)</b>.</li>
                <li><b>Zimny lut</b> — Matowe, ziarniste punkty lutownicze od spodu świadczą o braku zwilżenia; przetop je (reflow) <b>Lutownicą (3)</b>.</li>
                <li><b>Odwrotna polaryzacja</b> — Sprawdź ścięcie katody i wewnętrzne kowadełko diody LED lub pasek diody względem oznaczenia <b>K</b>; popraw orientację narzędziem <b>Obrót o 180° (5)</b> lub zbadaj w trybie <b>Diody</b>.</li>
                <li><b>Uszkodzony lub niewłaściwy element</b> — Zbadaj paski kodowe rezystora lub stratę mocy w trybie <b>Termowizyjnym</b>, a następnie podmień wartość w <b>Magazynie części (8)</b>.</li>
              ` : `
                <li><b>Open or cut trace</b> — Disable power, verify continuity in <b>Ω</b> mode, then bridge with <b>Soldering iron (3)</b> or <b>Jumper wire (6)</b>.</li>
                <li><b>Solder bridge or copper sliver</b> — Flip to the bottom side (<b>F</b>) and inspect closely. Clear blobs with <b>Desolder wick (4)</b> or cut slivers with <b>Trace cutter (7)</b>.</li>
                <li><b>Cold solder joint</b> — Matte grainy pads on the back side indicate poor wetting; reflow using <b>Soldering iron (3)</b>.</li>
                <li><b>Reversed polarity</b> — Check the LED cathode notch and internal anvil or diode band against the silkscreen <b>K</b> marker; correct with <b>Rotate 180° (5)</b> or test in <b>Diode</b> mode.</li>
                <li><b>Damaged or wrong part</b> — Inspect resistor color bands or power dissipation in <b>Thermal</b> mode, then swap values in <b>Parts bin (8)</b>.</li>
              `}
            </ul>
          </div>
          <div class="card">
            <div class="card-title">${isPl ? 'Zauważyłeś błąd? Masz pomysł?' : 'Found a bug? Have an idea?'}</div>
            <p class="text-2" style="margin:0">${isPl ? 'Zgłoś to bezpośrednio z warsztatu: nie wymaga konta. Możesz dołączyć szczegóły techniczne (przeglądarka, GPU, płytka), aby ułatwić reprodukcję.' : 'Tell us from inside the bench: no account needed. Technical details (browser, GPU, board) can be attached so the problem can be reproduced.'}</p>
            <div class="row"><button class="btn sm" id="help-feedback">${icon('message', 13)}<span>${isPl ? 'Wyślij opinię' : 'Send feedback'}</span></button></div>
          </div>
          <div class="card">
            <div class="card-title">${isPl ? 'Import i tworzenie wyzwań' : 'Importing &amp; authoring'}</div>
            <p class="text-2" style="margin:0">
              ${isPl
                ? `Przeciągnij i upuść plik KiCad <code>.kicad_pcb</code>, boardview <code>.brd</code> lub <code>.pcbfix.json</code> do okna aplikacji. W zakładce <b>Twórca</b> zablokuj działający układ swoją flagą, wprowadź usterki i wyeksportuj JSON, link lub modyfikację.`
                : `Drag and drop a KiCad <code>.kicad_pcb</code>, boardview <code>.brd</code> or <code>.pcbfix.json</code> file into the workspace. In the <b>Author</b> tab, lock a working reference topology with your flag, inject faults, and export JSON, a shareable link, or a mod.`}
            </p>
          </div>
        </div>
      </div>
    `);
    this.ctx.modalRootEl.querySelector('#help-feedback')?.addEventListener('click', () => this.ctx.onOpenFeedback());
    this.ctx.modalRootEl.querySelector('#help-close')?.addEventListener('click', () => this.ctx.onClose());
    this.ctx.modalRootEl.querySelector('#help-close-bg')?.addEventListener('click', (e) => {
      if (this.ctx.isSuppressModalBgClose()) {
        this.ctx.resetSuppressModalBgClose();
        return;
      }
      if ((e.target as HTMLElement).id === 'help-close-bg') {
        this.ctx.onClose();
      }
    });
  }
}
