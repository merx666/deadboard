// DEADBOARD homepage: fonts, brand mark, icons, the power-up log, i18n, legacy share links.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './home.css';
import { markSvg } from '../ui/logo';
import { icon } from '../ui/icons';
import { getLang, setLang, onLangChange, type Lang } from '../i18n';
import { LANDING_PL, LANDING_EN } from './translations';
import { Hero3DViewer } from './hero3d';

// Share links made before the homepage existed pointed at "/#s=…": hand them to the app.
if (location.hash.startsWith('#s=')) location.replace(`./app.html${location.hash}`);

for (const el of document.querySelectorAll<HTMLElement>('[data-mark]')) el.innerHTML = markSvg(el.closest('.small') ? 18 : 24);
for (const el of document.querySelectorAll<HTMLElement>('[data-icon]')) el.innerHTML = icon(el.dataset.icon!, 18);
for (const el of document.querySelectorAll<HTMLElement>('[data-year]')) el.textContent = String(new Date().getFullYear());

// Language switcher setup on landing page
const nav = document.querySelector('.nav');
if (nav) {
  const langBtn = document.createElement('button');
  langBtn.className = 'btn ghost small lang-btn';
  langBtn.id = 'landing-lang-btn';
  langBtn.style.marginRight = '8px';
  langBtn.style.padding = '4px 10px';
  langBtn.style.fontWeight = '600';
  langBtn.style.fontSize = '13px';
  langBtn.innerHTML = getLang() === 'pl' ? '🇵🇱 PL' : '🇬🇧 EN';
  langBtn.title = getLang() === 'pl' ? 'Zmień język na angielski (EN)' : 'Switch language to Polish (PL)';
  langBtn.addEventListener('click', () => {
    setLang(getLang() === 'pl' ? 'en' : 'pl');
  });
  const openBtn = nav.querySelector('.btn.primary');
  if (openBtn) nav.insertBefore(langBtn, openBtn);
  else nav.appendChild(langBtn);
}

function renderLandingText(lang: Lang) {
  const dict = lang === 'pl' ? LANDING_PL : LANDING_EN;
  document.documentElement.lang = lang;

  const btn = document.querySelector<HTMLButtonElement>('#landing-lang-btn');
  if (btn) {
    btn.innerHTML = lang === 'pl' ? '🇵🇱 PL' : '🇬🇧 EN';
    btn.title = lang === 'pl' ? 'Zmień język na angielski (EN)' : 'Switch language to Polish (PL)';
  }

  // Skip link
  const skip = document.querySelector<HTMLAnchorElement>('.skip');
  if (skip) skip.textContent = dict.skip;

  // Nav links
  const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav nav a');
  if (navLinks.length >= 5) {
    navLinks[0].textContent = dict.nav.bench;
    navLinks[1].textContent = dict.nav.faults;
    navLinks[2].textContent = dict.nav.boards;
    navLinks[3].textContent = dict.nav.challenges;
    navLinks[4].textContent = dict.nav.mods;
  }
  const topCta = document.querySelector<HTMLAnchorElement>('.nav .btn.primary');
  if (topCta) topCta.textContent = dict.nav.openBench;

  // Hero
  const heroEyebrow = document.querySelector<HTMLElement>('.hero .eyebrow');
  if (heroEyebrow) heroEyebrow.textContent = dict.hero.eyebrow;

  const heroH1 = document.querySelector<HTMLHeadingElement>('.hero h1');
  if (heroH1) heroH1.textContent = dict.hero.title;

  const heroLede = document.querySelector<HTMLElement>('.hero .lede');
  if (heroLede) heroLede.textContent = dict.hero.lede;

  const ctaPrimary = document.querySelector<HTMLAnchorElement>('.hero .cta .btn.primary');
  if (ctaPrimary) ctaPrimary.innerHTML = `${dict.hero.ctaPrimary} <span aria-hidden="true">→</span>`;

  const ctaTut = document.querySelector<HTMLAnchorElement>('.hero .cta .btn.ghost');
  if (ctaTut) ctaTut.textContent = dict.hero.ctaTutorial;

  const heroReq = document.querySelector<HTMLElement>('.hero .req');
  if (heroReq) heroReq.textContent = dict.hero.req;

  const figcaption = document.querySelector<HTMLElement>('#hero-figcaption');
  if (figcaption) {
    figcaption.textContent = lang === 'pl'
      ? 'Interaktywny model 3D otwartej płytki drukowanej: swobodny obrót w 3D, inspekcja ścieżek, padów i elementów SMD/THT przed przystąpieniem do naprawy.'
      : 'Interactive 3D open-hardware circuit board: free 360° orbit, inspect traces, pads, and SMD/THT components before repair.';
  }

  const frameTitle = document.querySelector<HTMLElement>('#hero-frame-title');
  if (frameTitle) {
    frameTitle.textContent = lang === 'pl' ? 'deadboard — interaktywny stół 3D' : 'deadboard — 3D interactive bench';
  }

  const hintText = document.querySelector<HTMLElement>('#hero-3d-hint-text');
  if (hintText) {
    hintText.textContent = lang === 'pl'
      ? '🖱️ Przeciągnij myszą lub palcem, aby obracać płytkę 360° · Kółko myszy: zoom'
      : '🖱️ Drag with mouse or finger to orbit 360° · Mouse wheel: zoom';
  }

  const btnTop = document.querySelector<HTMLButtonElement>('#hero-btn-top');
  if (btnTop) btnTop.textContent = lang === 'pl' ? 'Góra (Top)' : 'Top';

  const btnBottom = document.querySelector<HTMLButtonElement>('#hero-btn-bottom');
  if (btnBottom) btnBottom.textContent = lang === 'pl' ? 'Spód (Bottom)' : 'Bottom';

  const btnReset = document.querySelector<HTMLButtonElement>('#hero-btn-reset');
  if (btnReset) btnReset.textContent = lang === 'pl' ? 'Reset' : 'Reset';

  // Bootlog note
  const termNote = document.querySelector<HTMLElement>('.bootlog .term-note');
  if (termNote) termNote.textContent = dict.bootlog.note;

  // Bench section
  const bench = document.querySelector<HTMLElement>('#bench');
  if (bench) {
    const bEye = bench.querySelector('.eyebrow');
    if (bEye) bEye.textContent = dict.bench.eyebrow;
    const bH2 = bench.querySelector('h2');
    if (bH2) bH2.textContent = dict.bench.title;
    const bLede = bench.querySelector('.section-lede');
    if (bLede) bLede.textContent = dict.bench.lede;

    const cards = bench.querySelectorAll('.card');
    if (cards.length >= 6) {
      const items = [
        dict.bench.multimeter,
        dict.bench.supply,
        dict.bench.scope,
        dict.bench.thermal,
        dict.bench.rework,
        dict.bench.boardview,
      ];
      cards.forEach((card, i) => {
        const it = items[i];
        if (!it) return;
        const h3 = card.querySelector('h3');
        if (h3) h3.textContent = it.title;
        const p = card.querySelector('p');
        if (p) p.textContent = it.desc;
      });
    }
  }

  // Faults section
  const faults = document.querySelector<HTMLElement>('#faults');
  if (faults) {
    const fEye = faults.querySelector('.eyebrow');
    if (fEye) fEye.textContent = dict.faults.eyebrow;
    const fH2 = faults.querySelector('h2');
    if (fH2) fH2.textContent = dict.faults.title;
    const fLede = faults.querySelector('.section-lede');
    if (fLede) fLede.textContent = dict.faults.lede;
    const tags = faults.querySelectorAll('.tags li');
    dict.faults.tags.forEach((tag, idx) => {
      if (tags[idx]) tags[idx].textContent = tag;
    });
  }

  // Boards section
  const boards = document.querySelector<HTMLElement>('#boards');
  if (boards) {
    const bEye = boards.querySelector('.eyebrow');
    if (bEye) bEye.textContent = dict.boards.eyebrow;
    const bH2 = boards.querySelector('h2');
    if (bH2) bH2.textContent = dict.boards.title;
    const ledes = boards.querySelectorAll('.section-lede');
    if (ledes[0]) ledes[0].textContent = dict.boards.lede1;
    if (ledes[1]) {
      ledes[1].innerHTML = `${dict.boards.lede2.replace(/<a.*<\/a>/, '')} <a href="./modding.html">${dict.nav.mods}</a>.`;
    }
    const honest = boards.querySelector('.honest');
    if (honest) {
      const hEye = honest.querySelector('.eyebrow');
      if (hEye) hEye.textContent = dict.boards.honestEyebrow;
      const h3 = honest.querySelector('h3');
      if (h3) h3.textContent = dict.boards.honestTitle;
      const p = honest.querySelector('p');
      if (p) p.textContent = dict.boards.honestDesc;
    }
  }

  // Challenges
  const challenges = document.querySelector<HTMLElement>('#challenges');
  if (challenges) {
    const cEye = challenges.querySelector('.eyebrow');
    if (cEye) cEye.textContent = dict.challenges.eyebrow;
    const cH2 = challenges.querySelector('h2');
    if (cH2) cH2.textContent = dict.challenges.title;
    const cLede = challenges.querySelector('.section-lede');
    if (cLede) cLede.textContent = dict.challenges.lede;
  }

  // Final CTA
  const finalSec = document.querySelector<HTMLElement>('.final');
  if (finalSec) {
    const fH2 = finalSec.querySelector('h2');
    if (fH2) fH2.textContent = dict.final.title;
    const fCta = finalSec.querySelector('.btn.primary');
    if (fCta) fCta.innerHTML = `${dict.final.cta} <span aria-hidden="true">→</span>`;
  }

  // Footer
  const foot = document.querySelector<HTMLElement>('.foot');
  if (foot) {
    const muted = foot.querySelector('.muted');
    if (muted) muted.innerHTML = `${dict.footer.subtitle} <span data-year>${new Date().getFullYear()}</span>`;
    const footLinks = foot.querySelectorAll('a');
    if (footLinks[0]) footLinks[0].textContent = dict.footer.openBench;
    if (footLinks[1]) footLinks[1].textContent = dict.footer.makeMod;
    if (footLinks[2]) footLinks[2].textContent = dict.footer.feedback;
  }
}

// Power-up log: lines appear like a terminal as the block scrolls into view (static when reduced motion is on).
const log = document.querySelector<HTMLElement>('[data-bootlog] code');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (log && !reduce && 'IntersectionObserver' in window) {
  const lines = log.textContent!.split('\n');
  log.textContent = '';
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    let i = 0;
    const next = () => {
      if (i >= lines.length) { log.classList.add('done'); return; }
      const line = document.createElement('span');
      line.className = i === lines.length - 1 ? 'ok' : i === 0 ? 'cmd' : '';
      line.textContent = lines[i] + '\n';
      log.appendChild(line);
      i++;
      setTimeout(next, i === 1 ? 500 : 380);
    };
    next();
  }, { threshold: 0.4 });
  io.observe(log);
}

// Initialize 3D Interactive Hero Viewer
const heroCanvas = document.querySelector<HTMLCanvasElement>('#hero-3d-canvas');
const heroLoader = document.querySelector<HTMLElement>('#hero-3d-loader');
let heroViewer: Hero3DViewer | null = null;
if (heroCanvas) {
  heroViewer = new Hero3DViewer(heroCanvas, {
    onLoadingChange: (loading, text) => {
      if (heroLoader) {
        heroLoader.textContent = text || '';
        heroLoader.classList.toggle('active', loading);
      }
    }
  });
  void heroViewer.init();

  const btnOrbit = document.querySelector<HTMLButtonElement>('#hero-btn-orbit');
  btnOrbit?.addEventListener('click', () => {
    if (!heroViewer) return;
    const active = heroViewer.toggleAutoOrbit();
    btnOrbit.classList.toggle('active', active);
  });

  const btnTop = document.querySelector<HTMLButtonElement>('#hero-btn-top');
  btnTop?.addEventListener('click', () => {
    heroViewer?.setSide('F');
    btnOrbit?.classList.remove('active');
  });

  const btnBottom = document.querySelector<HTMLButtonElement>('#hero-btn-bottom');
  btnBottom?.addEventListener('click', () => {
    heroViewer?.setSide('B');
    btnOrbit?.classList.remove('active');
  });

  const btnReset = document.querySelector<HTMLButtonElement>('#hero-btn-reset');
  btnReset?.addEventListener('click', () => {
    heroViewer?.resetCamera();
    btnOrbit?.classList.add('active');
  });

  const selectBoard = document.querySelector<HTMLSelectElement>('#hero-board-select');
  selectBoard?.addEventListener('change', () => {
    if (heroViewer && selectBoard.value) {
      void heroViewer.loadDemoBoard(selectBoard.value);
    }
  });
}

// Initial render in default language (PL)
renderLandingText(getLang());
onLangChange((lang) => renderLandingText(lang));
