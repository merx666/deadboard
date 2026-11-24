import { getLang } from '../../i18n';
import { icon } from '../icons';

export interface ShortcutsModalContext {
  getModalPos: () => [number, number];
  modalRootEl: HTMLElement;
  onClose: () => void;
}

export class ShortcutsModalController {
  constructor(private ctx: ShortcutsModalContext) {}

  render(): void {
    const isPl = getLang() === 'pl';
    const modalPos = this.ctx.getModalPos();
    this.ctx.modalRootEl.innerHTML = `
      <div class="modal-backdrop" id="sc-close-bg">
        <div class="modal" style="transform: translate3d(${modalPos[0]}px, ${modalPos[1]}px, 0); max-width: 680px;">
          <div class="modal-head" title="Drag to move window">
            <h2>${isPl ? 'Skróty Klawiszowe Warsztatu LiveBoard' : 'LiveBoard Bench Keyboard Shortcuts'}</h2>
            <button class="btn ghost icon sm" id="sc-close" title="Close">${icon('x', 14)}</button>
          </div>
          <div class="card" style="padding:16px;">
            <div class="shortcuts-grid">
              <div class="sc-card">
                <h4>${isPl ? 'Narzędzia Pomiary &amp; Rework' : 'Tools &amp; Rework'}</h4>
                <div class="sc-row"><span>${isPl ? 'Wybierz / Kursor' : 'Select'}</span><span class="sc-kbd">1</span></div>
                <div class="sc-row"><span>${isPl ? 'Multimetr cyfrowy' : 'Multimeter'}</span><span class="sc-kbd">2</span></div>
                <div class="sc-row"><span>${isPl ? 'Lutownica kolbowa' : 'Soldering iron'}</span><span class="sc-kbd">3</span></div>
                <div class="sc-row"><span>${isPl ? 'Plecionka rozlutownicza' : 'Desolder wick'}</span><span class="sc-kbd">4</span></div>
                <div class="sc-row"><span>${isPl ? 'Obróć o 180°' : 'Rotate 180°'}</span><span class="sc-kbd">5</span></div>
                <div class="sc-row"><span>${isPl ? 'Kynar / Zworka' : 'Jumper wire'}</span><span class="sc-kbd">6</span></div>
                <div class="sc-row"><span>${isPl ? 'Rylec do ścieżek' : 'Trace cutter'}</span><span class="sc-kbd">7</span></div>
                <div class="sc-row"><span>${isPl ? 'Magazyn części' : 'Parts bin'}</span><span class="sc-kbd">8</span></div>
                <div class="sc-row"><span>${isPl ? 'Zamrażacz w sprayu' : 'Freeze spray'}</span><span class="sc-kbd">9</span></div>
                <div class="sc-row"><span>${isPl ? 'Izopropanol (IPA)' : 'Isopropyl (IPA)'}</span><span class="sc-kbd">0</span></div>
                <div class="sc-row"><span>${isPl ? 'Gorące powietrze (Hot-Air)' : 'Hot air'}</span><span class="sc-kbd">H</span></div>
                <div class="sc-row"><span>${isPl ? 'Metoda kalafoniowa' : 'Rosin'}</span><span class="sc-kbd">R</span></div>
                <div class="sc-row"><span>${isPl ? 'Oscyloskop' : 'Oscilloscope'}</span><span class="sc-kbd">O</span></div>
                <div class="sc-row"><span>${isPl ? 'Docisk laminatu' : 'Flex / Press'}</span><span class="sc-kbd">B</span></div>
              </div>

              <div class="sc-card">
                <h4>${isPl ? 'Kamera &amp; Widok' : 'Camera &amp; View'}</h4>
                <div class="sc-row"><span>${isPl ? 'Przełącz 2D / 3D' : 'Switch 2D / 3D'}</span><span class="sc-kbd">Tab</span></div>
                <div class="sc-row"><span>${isPl ? 'Odwróć stronę (Top / Bottom)' : 'Flip board'}</span><span class="sc-kbd">F</span></div>
                <div class="sc-row"><span>${isPl ? 'Dopasuj do ekranu' : 'Fit board'}</span><span class="sc-kbd">C</span></div>
                <div class="sc-row"><span>${isPl ? 'Obrót w 3D' : 'Orbit (3D)'}</span><span class="sc-kbd">PPM / RMB</span></div>
                <div class="sc-row"><span>${isPl ? 'Przesuwanie widoku' : 'Pan screen'}</span><span class="sc-kbd">ŚPM / Spacja+LPM</span></div>
              </div>

              <div class="sc-card">
                <h4>${isPl ? 'Operacje Warsztatu' : 'Bench Actions'}</h4>
                <div class="sc-row"><span>${isPl ? 'Zasilanie płyty (Wł/Wył)' : 'Power On / Off'}</span><span class="sc-kbd">P</span></div>
                <div class="sc-row"><span>${isPl ? 'Cofnij ruch' : 'Undo'}</span><span class="sc-kbd">⌘Z / Ctrl+Z</span></div>
                <div class="sc-row"><span>${isPl ? 'Ponów ruch' : 'Redo'}</span><span class="sc-kbd">⇧⌘Z / Ctrl+Y</span></div>
                <div class="sc-row"><span>${isPl ? 'Przełącz język (PL/EN)' : 'Toggle Language'}</span><span class="sc-kbd">L</span></div>
                <div class="sc-row"><span>${isPl ? 'Kreator płytek i baza części' : 'Board creator &amp; parts'}</span><span class="sc-kbd">K</span></div>
                <div class="sc-row"><span>${isPl ? 'Okienko skrótów' : 'Shortcuts modal'}</span><span class="sc-kbd">?</span></div>
                <div class="sc-row"><span>${isPl ? 'Zamknij okno' : 'Close window'}</span><span class="sc-kbd">Esc</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.ctx.modalRootEl.querySelector('#sc-close')?.addEventListener('click', () => this.ctx.onClose());
    this.ctx.modalRootEl.querySelector('#sc-close-bg')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'sc-close-bg') {
        this.ctx.onClose();
      }
    });
  }
}
