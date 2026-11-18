/**
 * Internationalization (i18n) module for LiveBoard (PulsePCB).
 * Supports Polish (pl - default) and English (en).
 * Stored in localStorage ('liveboard_lang' / 'deadboard_lang') with instant runtime reactivity.
 */

export type Lang = 'pl' | 'en';

const STORAGE_KEY = 'liveboard_lang';

export function getInitialLang(): Lang {
  if (typeof window === 'undefined') return 'pl';
  const urlParam = new URLSearchParams(window.location.search).get('lang');
  if (urlParam === 'en' || urlParam === 'pl') return urlParam;
  const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('deadboard_lang');
  if (stored === 'en' || stored === 'pl') return stored;
  return 'pl'; // Default to Polish as requested
}

let currentLang: Lang = getInitialLang();
const listeners = new Set<(lang: Lang) => void>();

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang) {
  if (currentLang === lang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  } catch {
    // Ignore localStorage restrictions
  }
  for (const fn of listeners) {
    try {
      fn(lang);
    } catch (e) {
      console.error('i18n listener error', e);
    }
  }
}

export function onLangChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface I18nDict {
  brand: {
    name: string;
    descriptor: string;
  };
  nav: {
    home: string;
    browseBoards: string;
    newBoard: string;
    importBoard: string;
    view2D: string;
    view3D: string;
    invertOrbit: string;
    top: string;
    both: string;
    bottom: string;
    fit: string;
    realistic: string;
    heatmap: string;
    thermal: string;
    xray: string;
    bench: string;
    power: string;
    runTests: string;
    tutorial: string;
    sound: string;
    feedback: string;
    help: string;
    shortcuts: string;
    togglePanel: string;
    report: string;
  };
  bench: {
    rework: string;
    reworkInstant: string;
    rework350f: string;
    rework350: string;
    rework400f: string;
    preheater: string;
    noPreheat: string;
    preheat120: string;
    preheat150: string;
    supply: string;
    boardPsu: string;
    inject1: string;
    inject3: string;
    currentLimit: string;
    noLimit: string;
    limit100: string;
    limit500: string;
    solver: string;
    solverFast: string;
    solverSpice: string;
    solverSpicePower: string;
    exportSpice: string;
  };
  tools: Record<string, { lbl: string; short: string; tip: string; phoneTip: string }>;
  dock: {
    undo: string;
    redo: string;
    reset: string;
  };
  tabs: {
    mission: string;
    inspect: string;
    author: string;
    videos: string;
    mods: string;
  };
  statusbar: {
    lmb: string;
    rmb: string;
    mmb: string;
    flip: string;
    tab: string;
    probes: string;
    powerState: string;
  };
  scenarios: Record<string, { title: string; description: string; hints?: string[] }>;
  categories: {
    beginner: string;
    training: string;
    demos: string;
    mods: string;
    solved: string;
    active: string;
    parts: string;
    par: string;
  };
  report: {
    title: string;
    boardName: string;
    date: string;
    status: string;
    solved: string;
    unsolved: string;
    findings: string;
    stepsTaken: string;
    measurements: string;
    downloadMd: string;
    downloadJson: string;
    close: string;
  };
  shortcuts: {
    title: string;
    toolsHeading: string;
    navigationHeading: string;
    actionsHeading: string;
    close: string;
  };
}

export const DICT_PL: I18nDict = {
  brand: {
    name: 'LiveBoard',
    descriptor: 'PulsePCB Studio — Interaktywne Projektowanie i Symulacja Własnych Płytek PCB',
  },
  nav: {
    home: 'Strona główna LiveBoard',
    browseBoards: 'Przeglądaj projekty i wyzwania',
    newBoard: 'Nowy projekt PCB',
    importBoard: 'Importuj .brd, .kicad_pcb, .pcbfix.json lub mod .zip',
    view2D: 'Widok 2D',
    view3D: 'Widok 3D',
    invertOrbit: 'Odwróć obrót kamery',
    top: 'Góra (Top)',
    both: 'Obie strony',
    bottom: 'Dół (Bottom)',
    fit: 'Dopasuj do widoku (C)',
    realistic: 'Realistyczny',
    heatmap: 'Mapa napięć',
    thermal: 'Kamera termowizyjna',
    xray: 'Rentgen (X-ray)',
    bench: 'Warsztat',
    power: 'Zasilanie',
    runTests: 'Uruchom testy',
    tutorial: 'Samouczek',
    sound: 'Dźwięk',
    feedback: 'Zgłoś uwagę lub pomysł',
    help: 'Pomoc i skróty',
    shortcuts: 'Skróty klawiszowe (?)',
    togglePanel: 'Przełącz panel boczny',
    report: 'Protokół naprawy',
  },
  bench: {
    rework: 'Lutowanie',
    reworkInstant: 'Lutowanie: natychmiastowe',
    rework350f: 'Grot 350 °C + topnik',
    rework350: 'Grot 350 °C, na sucho',
    rework400f: 'Grot 400 °C + topnik',
    preheater: 'Podgrzewacz',
    noPreheat: 'Bez podgrzewacza',
    preheat120: 'Podgrzewacz 120 °C',
    preheat150: 'Podgrzewacz 150 °C',
    supply: 'Zasilacz',
    boardPsu: 'Zasilanie płyty',
    inject1: 'Wstrzyknij 1 V · 3 A',
    inject3: 'Wstrzyknij 3.3 V · 1 A',
    currentLimit: 'Limit prądu (OCP)',
    noLimit: 'Bez limitu',
    limit100: '100 mA',
    limit500: '500 mA',
    solver: 'Silnik symulacji',
    solverFast: 'Szybki DC',
    solverSpice: 'SPICE (fizyka elementów)',
    solverSpicePower: 'SPICE + PWR (drzewo zasilania)',
    exportSpice: 'Eksportuj netlistę SPICE (.cir)',
  },
  tools: {
    inspect: {
      lbl: 'Wybierz',
      short: 'Kursor',
      tip: 'Zaznaczaj elementy i ścieżki, naciskaj przyciski',
      phoneTip: 'Dotknij, aby wybrać element lub nacisnąć przycisk.',
    },
    dmm: {
      lbl: 'Multimetr cyfrowy',
      short: 'Miernik',
      tip: 'LPM umieszcza czerwoną sondę, PPM lub Shift+LPM umieszcza czarną sondę',
      phoneTip: 'Dotknij padu, by przyłożyć sondę. Dotknij znacznika, by zmienić czerwoną/czarną.',
    },
    iron: {
      lbl: 'Lutownica kolbowa',
      short: 'Lutownica',
      tip: 'Poprawiaj luty (reflow), stawiaj mostki, lutuj elementy',
      phoneTip: 'Dotknij punktu, aby przetopić lut lub zmostkować przerwę.',
    },
    wick: {
      lbl: 'Plecionka rozlutownicza',
      short: 'Plecionka',
      tip: 'Usuwaj mostki lutownicze, zworki i wylutowuj elementy',
      phoneTip: 'Dotknij mostka cynowego lub zworki, aby usunąć nadmiar cyny.',
    },
    flip180: {
      lbl: 'Obróć o 180°',
      short: 'Obrót',
      tip: 'Zmień orientację / polaryzację elementu',
      phoneTip: 'Dotknij elementu, aby odwrócić jego polaryzację.',
    },
    jumper: {
      lbl: 'Kynar / Zworka',
      short: 'Kynar',
      tip: 'Kliknij punkt początkowy, a potem końcowy; działa też między stronami',
      phoneTip: 'Dotknij początku i końca, by połączyć punkty zworką.',
    },
    knife: {
      lbl: 'Rylec / Skalpel',
      short: 'Skalpel',
      tip: 'Przetnij ścieżkę miedzianą',
      phoneTip: 'Dotknij ścieżki miedzianej, aby ją przeciąć.',
    },
    replace: {
      lbl: 'Magazyn części',
      short: 'Części',
      tip: 'Wymień lub wstaw element w Inspektorze',
      phoneTip: 'Dotknij elementu, by dobrać nową część w Inspektorze.',
    },
    freeze: {
      lbl: 'Zamrażacz w sprayu',
      short: 'Zamrażacz',
      tip: 'Zamroź obszar: przy włączonym zasilaniu zwarty element odtaje pierwszy (widok termiczny pokazuje temperatury)',
      phoneTip: 'Dotknij, by pokryć szronem: grzejący się element odtaje najszybciej.',
    },
    ipa: {
      lbl: 'Izopropanol (IPA)',
      short: 'IPA',
      tip: 'Zwilż / przemyj obszar alkoholem IPA: odparowuje najszybciej na gorącym elemencie; rozpuszcza ślady korozji',
      phoneTip: 'Dotknij, by nanieść IPA: odparowuje w miejscu przegrzania. Zmywa osady.',
    },
    hotair: {
      lbl: 'Gorące powietrze (Hot-Air)',
      short: 'Hot-Air',
      tip: '3 s nadmuchu 400 °C nad wybranym punktem; rozgrzej wszystkie pady przed podniesieniem części',
      phoneTip: 'Dotknij, by podgrzać obszar nadmuchem 400 °C.',
    },
    rosin: {
      lbl: 'Kalafonia',
      short: 'Kalafonia',
      tip: 'Metoda kalafoniowa: pokryj obszar białą warstwą kalafonii; topi się na przezroczysto w miejscu zwarcia',
      phoneTip: 'Dotknij, by nanieść kalafonię: topi się na gorącym elemencie.',
    },
    scope: {
      lbl: 'Oscyloskop cyfrowy',
      short: 'Oscyloskop',
      tip: 'Podłącz sondę (CH1) do linii: zbocza zasilania i boot-loopy (Roll), klucze przetwornic, tętnienia i zegary (Auto)',
      phoneTip: 'Dotknij linii, by przypiąć sondę oscyloskopu.',
    },
    press: {
      lbl: 'Nacisk / Zginanie laminatu',
      short: 'Nacisk',
      tip: 'Dociskaj płytkę przez 2.5 s: ujawnia pęknięte luty i przelotki, które przewodzą lub rozłączają się pod naprężeniem',
      phoneTip: 'Dotknij, by ugiąć płytkę i wykryć pęknięte połączenia.',
    },
  },
  dock: {
    undo: 'Cofnij · ⌘Z',
    redo: 'Ponów · ⇧⌘Z',
    reset: 'Resetuj płytkę do stanu początkowego',
  },
  tabs: {
    mission: 'Laboratorium & Wyzwania',
    inspect: 'Inspektor Elementu',
    author: 'Twórca Płytek',
    videos: 'Wideo Poradniki',
    mods: 'Modyfikacje i Rozszerzenia',
  },
  statusbar: {
    lmb: 'LPM: Narzędzie / Przesuwanie',
    rmb: 'PPM: Obrót 3D',
    mmb: 'ŚPM: Przesuwanie',
    flip: 'F: Druga strona',
    tab: 'Tab: 2D / 3D',
    probes: 'Sondy',
    powerState: 'Zasilanie',
  },
  scenarios: {
    'builtin-first-light': {
      title: 'Pierwsze światło',
      description: 'Minilatarka: bateria guzikowa, przycisk, rezystor, czerwona dioda LED. Wciśnięcie SW1 powinno zaświecić D1 — lecz nic się nie dzieje. Znajdź usterkę, napraw ją i uruchom testy bench.',
      hints: [
        'Wyłącz zasilanie i użyj multimetru (tryb Ω), aby sprawdzić ciągłość od R1 do D1.',
        'Przyjrzyj się uważnie długiej pionowej ścieżce przy prawej krawędzi płytki.',
        'Użyj lutownicy na przerwie w ścieżce, aby postawić mostek cynowy — lub połącz ją kynarem.',
      ],
    },
    'builtin-tut-cold-joint': {
      title: 'Zimny lut 101',
      description: 'Samouczek 2: Tylko trzy elementy — bateria BT1, rezystor 100 Ω R1 i zielona dioda D1. Wszystkie ścieżki na górze są całe, a prąd nie płynie. Odwróć płytkę na stronę Bottom, aby sprawdzić luty elementów przewlekanych.',
      hints: [
        'Naciśnij F (lub kliknij Dół), aby odwrócić płytkę i obejrzeć punkty lutownicze.',
        'Pad R1.1 od spodu jest matowy i ziarnisty — to zimny lut, który nie złapał kontaktu.',
        'Wybierz Lutownicę (3) i kliknij pad R1.1 od spodu płytki, aby go przetopić (reflow).',
      ],
    },
    'builtin-tut-solder-bridge': {
      title: 'Mostek lutowniczy 101',
      description: 'Samouczek 3: Bateria dostarcza ~28 mA, a czerwona dioda D1 w ogóle nie świeci! Poznaj różnicę między przerwą w obwodzie a zwarciem i zbierz nadmiar cyny za pomocą plecionki rozlutowniczej.',
      hints: [
        'Zauważ prąd zasilania: 28 mA oznacza, że prąd płynie, omijając diodę LED.',
        'Sprawdź piny diody D1 — między anodą a katodą zlała się cyna.',
        'Wybierz Plecionkę rozlutowniczą (4) i kliknij zlane wyprowadzenia, aby usunąć mostek.',
      ],
    },
    'builtin-tut-polarity': {
      title: 'Polaryzacja diody LED',
      description: 'Samouczek 4: Układ zmontowany poprawnie, lecz dioda D1 nie świeci. Diody przewodzą prąd tylko w jednym kierunku (od anody do katody). Sprawdź spadek napięcia testem diody w multimetrze i obróć element.',
      hints: [
        'Włącz multimetr w tryb diody (•◄|) i przyłóż sondy do D1.',
        'Wskaźnik pokazuje "OL", a w przeciwnym kierunku spadek ~1.9 V? Dioda jest wlutowana odwrotnie.',
        'Użyj narzędzia Obrót o 180° (5) i kliknij diodę D1.',
      ],
    },
    'builtin-tut-resistor': {
      title: 'Rezystor i prawo Ohma',
      description: 'Samouczek 5: Dioda świeci ledwo zauważalnym blaskiem, a prąd wynosi ułamki miliampera. Ktoś wlutował rezystor o błędnej wartości. Zmierz rezystancję multimetrem i wymień część na właściwą.',
      hints: [
        'Wyłącz zasilanie i zmierz rezystancję R1 multimetrem w trybie Ω.',
        'Zamiast 100 Ω na płytce siedzi 10 kΩ! Dioda nie dostaje wystarczającego prądu.',
        'Wybierz Magazyn części (8), kliknij R1 i wstaw rezystor 100 Ω.',
      ],
    },
    'builtin-tut-divider': {
      title: 'Dzielnik napięcia 101',
      description: 'Samouczek 6: Dwa rezystory dzielą napięcie zasilania. Punkt pomiarowy TP1 powinien mieć dokładnie 1.5 V, ale miernik pokazuje 0 V. Sprawdź puste pole lutownicze i zamontuj brakujący element.',
      hints: [
        'Zmierz napięcie na punkcie TP1 względem masy GND.',
        'Zauważ puste miejsce na rezystor R2 na płytce.',
        'Użyj Magazynu części (8) i wlutuj brakujący rezystor.',
      ],
    },
    'builtin-bridge-troll': {
      title: 'Troll na mostku',
      description: 'Płytka logiczna z kilkoma liniami sygnałowymi. Jedna z linii utknęła w stanie niskim z powodu złośliwego mostka lutowniczego ukrytego pod elementem SMD.',
      hints: [
        'Mierz napięcia na poszczególnych liniach za pomocą multimetru.',
        'Przełącz na widok Rentgen (X-ray) lub obróć płytkę, by dojrzeć mostek.',
        'Użyj plecionki lub gorącego powietrza, aby usunąć zwarcie.',
      ],
    },
    'builtin-backwards-day': {
      title: 'Odwrotny dzień',
      description: 'Urządzenie po nieudanym montażu: kondensator tantalowy i dioda zabezpieczająca zostały wlutowane odwrotnie, powodując zwarcie szyny głównej.',
      hints: [
        'Zasilacz natychmiast odcina prąd przy włączeniu (OCP).',
        'Użyj kamery termowizyjnej lub zamrażacza, aby namierzyć grzejący się element.',
        'Obróć odwrotnie spolaryzowane elementy o 180°.',
      ],
    },
    'builtin-ghost-short': {
      title: 'Widmowe zwarcie',
      description: 'Szyna 3.3V ma rezystancję zaledwie 0.8 Ω do masy. Żaden element nie wygląda na uszkodzony z zewnątrz. Wykorzystaj wstrzykiwanie napięcia (Voltage Injection) i termowizję, aby znaleźć winowajcę.',
      hints: [
        'Ustaw zasilacz w tryb wstrzykiwania (Inject 1V·3A) na zwartą szynę.',
        'Obserwuj płytkę w widoku termowizyjnym (Thermal). Zwarty kondensator MLCC rozgrzeje się pierwszy.',
        'Usuń uszkodzony kondensator i wstaw sprawny element.',
      ],
    },
    'builtin-smoke-test': {
      title: 'Próba dymna',
      description: 'Szyna zabezpieczona bezpiecznikiem 5V (F1) i diodą szeregową 1N4007 (D1). Bezpiecznik jest przepalony, a linia martwa. Użyj ograniczenia prądowego OCP (100 mA) przed wstawieniem nowego bezpiecznika!',
      hints: [
        'Włącz limit prądu (100 mA) lub wyłącz zasilanie i zmierz rezystancję od TP1 do masy TP2.',
        'Sprawdź diodę D1 testem diody przy wyłączonym zasilaniu.',
        'Usuń mostek cynowy z tyłu płytki, obróć D1 zgodnie z oznaczeniem i wymień bezpiecznik F1.',
      ],
    },
    'builtin-sagging-rail': {
      title: 'Zapadnięta linia zasilania',
      description: 'Przetwornica step-down powinna dawać stabilne 3.3V, ale linia zapada się pod obciążeniem do 1.9V. Oscyloskop ujawnia brak poprawnego kluczowania dławika.',
      hints: [
        'Podłącz sondę oscyloskopu do pinu SW przetwornicy impulsowej.',
        'Zbadaj rezystory w pętli sprzężenia zwrotnego (Feedback).',
        'Sprawdź przelotki masy i dławik wyjściowy.',
      ],
    },
    'demo-mnt-reform2-mb30': {
      title: 'MNT Reform 2 · zwarcie linii 3.3 V',
      description: 'Płyta główna laptopa open-hardware MNT Reform 2 (530 części). Po podłączeniu zasilania szyna 3.3 V jest całkowicie martwa. Znajdź zwarty kondensator filtrujący i przywróć laptop do życia.',
      hints: [
        'Zlokalizuj szynę +3V3 na schemacie ideowym.',
        'Wstrzyknij 1 V do linii i zlokalizuj zwarty kondensator MLCC kamerą termowizyjną.',
        'Wymień uszkodzony element i sprawdź prąd rozruchu.',
      ],
    },
    'demo-antmicro-jetson-nano-bb': {
      title: 'Antmicro Jetson · brak 3.3 V, niestabilne 5 V',
      description: 'Płyta bazowa dla modułu Nvidia Jetson Nano (392 części). Przetwornice zasilania nie startują poprawnie z powodu uszkodzonego rezystora w dzielniku napięcia Enable.',
      hints: [
        'Przeanalizuj sekwencję zasilania Power Tree.',
        'Sprawdź sygnały Power Good oraz piny Enable przetwornic.',
        'Wymień uszkodzony element dzielnika, aby odblokować start przetwornicy.',
      ],
    },
  },
  categories: {
    beginner: 'Dla początkujących',
    training: 'Płytki szkoleniowe',
    demos: 'Dema Open-Hardware',
    mods: 'Modyfikacje społeczności',
    solved: 'Rozwiązane',
    active: 'Aktywne',
    parts: 'części',
    par: 'Ruchów',
  },
  report: {
    title: 'Protokół Diagnozy i Naprawy Laboratoryjnej',
    boardName: 'Nazwa płytki',
    date: 'Data badania',
    status: 'Status weryfikacji',
    solved: 'NAPRAWIONO (Zaliczono cel testowy)',
    unsolved: 'W TRAKCIE DIAGNOZY',
    findings: 'Obserwacje pomiarowe',
    stepsTaken: 'Wykonane operacje naprawcze',
    measurements: 'Pomiary kontrolne',
    downloadMd: 'Pobierz raport (.md)',
    downloadJson: 'Pobierz dane telemetryczne (.json)',
    close: 'Zamknij',
  },
  shortcuts: {
    title: 'Skróty Klawiszowe Warsztatu LiveBoard',
    toolsHeading: 'Wybór Narzędzi',
    navigationHeading: 'Sterowanie Widokiem i Kamerą',
    actionsHeading: 'Operacje Warsztatowe',
    close: 'Zamknij (Esc)',
  },
};

export const DICT_EN: I18nDict = {
  brand: {
    name: 'LiveBoard',
    descriptor: 'PulsePCB Prototyping & Circuit Simulation Studio',
  },
  nav: {
    home: 'LiveBoard home',
    browseBoards: 'Browse all boards & challenge lab',
    newBoard: 'New blank PCB project',
    importBoard: 'Import .brd, .kicad_pcb, .pcbfix.json, or a mod .zip',
    view2D: '2D view',
    view3D: '3D view',
    invertOrbit: 'Invert orbit direction',
    top: 'Top side',
    both: 'Both sides',
    bottom: 'Bottom side',
    fit: 'Fit to view (C)',
    realistic: 'Realistic',
    heatmap: 'Voltage map',
    thermal: 'Thermal camera',
    xray: 'X-ray',
    bench: 'Bench',
    power: 'Power',
    runTests: 'Run tests',
    tutorial: 'Tutorial',
    sound: 'Sound',
    feedback: 'Report a bug or suggest an idea',
    help: 'Help',
    shortcuts: 'Keyboard shortcuts (?)',
    togglePanel: 'Toggle panel',
    report: 'Repair report',
  },
  bench: {
    rework: 'Rework',
    reworkInstant: 'Rework: instant',
    rework350f: 'Iron 350 °C + flux',
    rework350: 'Iron 350 °C, dry',
    rework400f: 'Iron 400 °C + flux',
    preheater: 'Preheater',
    noPreheat: 'No preheat',
    preheat120: 'Preheat 120°',
    preheat150: 'Preheat 150°',
    supply: 'Supply',
    boardPsu: 'Board PSU',
    inject1: 'Inject 1 V·3 A',
    inject3: 'Inject 3.3 V·1 A',
    currentLimit: 'Current limit',
    noLimit: 'No limit',
    limit100: '100 mA',
    limit500: '500 mA',
    solver: 'Solver',
    solverFast: 'Fast DC',
    solverSpice: 'SPICE',
    solverSpicePower: 'SPICE + PWR',
    exportSpice: 'Export SPICE netlist (.cir)',
  },
  tools: {
    inspect: {
      lbl: 'Select',
      short: 'Select',
      tip: 'Select parts and nets, press switches',
      phoneTip: 'Tap to select parts or press switches.',
    },
    dmm: {
      lbl: 'Multimeter',
      short: 'Meter',
      tip: 'Left-click places red probe, right-click or Shift+click places black probe',
      phoneTip: 'Tap pads to probe. Tap a probe tag on the meter to switch red / black.',
    },
    iron: {
      lbl: 'Soldering iron',
      short: 'Iron',
      tip: 'Reflow joints, bridge gaps, solder parts',
      phoneTip: 'Tap a joint to reflow it, or a gap to bridge it.',
    },
    wick: {
      lbl: 'Desolder wick',
      short: 'Wick',
      tip: 'Remove solder bridges, jumpers or parts',
      phoneTip: 'Tap a solder bridge, jumper or part to remove it.',
    },
    flip180: {
      lbl: 'Rotate 180°',
      short: 'Rotate',
      tip: 'Reverse part orientation',
      phoneTip: 'Tap a part to turn it round.',
    },
    jumper: {
      lbl: 'Jumper wire',
      short: 'Jumper',
      tip: 'Click start then end point; works across sides',
      phoneTip: 'Tap the start, then the end (works across sides).',
    },
    knife: {
      lbl: 'Trace cutter',
      short: 'Cutter',
      tip: 'Cut a copper trace',
      phoneTip: 'Tap a copper trace to cut it.',
    },
    replace: {
      lbl: 'Parts bin',
      short: 'Parts',
      tip: 'Replace or change a component',
      phoneTip: 'Tap a part to swap or fit one in the Inspector.',
    },
    freeze: {
      lbl: 'Freeze spray',
      short: 'Freeze',
      tip: 'Frost an area: on a powered board the hot part defrosts first (Thermal view shows temperatures)',
      phoneTip: 'Tap to frost an area: the hot part defrosts first.',
    },
    ipa: {
      lbl: 'Isopropyl',
      short: 'IPA',
      tip: 'Wet / scrub an area with IPA: evaporates first on the hottest part; dissolves liquid-damage residue',
      phoneTip: 'Tap to wet an area: the hottest part dries first. Cleans residue.',
    },
    hotair: {
      lbl: 'Hot air',
      short: 'Hot air',
      tip: 'Realistic rework: 3 s of hot air (400 °C) over the spot; melt every joint of a part before lifting it with the wick',
      phoneTip: 'Tap for 3 s of 400 °C hot air.',
    },
    rosin: {
      lbl: 'Rosin',
      short: 'Rosin',
      tip: 'Rosin method: coat an area white with rosin; on a powered board it melts clear first on the hottest part',
      phoneTip: 'Tap to coat with rosin: it melts first on a hot part.',
    },
    scope: {
      lbl: 'Oscilloscope',
      short: 'Scope',
      tip: 'Clip the scope probe (CH1) on a net: rail ramps and boot loops (Roll), switching nodes, ripple and clocks (Auto)',
      phoneTip: 'Tap a net to clip the scope probe on.',
    },
    press: {
      lbl: 'Press / flex',
      short: 'Press',
      tip: 'Press on the board for 2.5 s: reveals cracked joints that open or close under flex',
      phoneTip: 'Tap to press the board and find cracked joints.',
    },
  },
  dock: {
    undo: 'Undo · ⌘Z',
    redo: 'Redo · ⇧⌘Z',
    reset: 'Reset board',
  },
  tabs: {
    mission: 'Lab & Challenges',
    inspect: 'Inspector',
    author: 'PCB Designer',
    videos: 'Video Guides',
    mods: 'Mods & Packages',
  },
  statusbar: {
    lmb: 'LMB Tool / Drag Pan',
    rmb: 'RMB Orbit',
    mmb: 'MMB Pan',
    flip: 'F Flip',
    tab: 'Tab 2D/3D',
    probes: 'Probes',
    powerState: 'Power',
  },
  scenarios: {
    'builtin-first-light': {
      title: 'First Light',
      description: 'A tiny flashlight: coin cell, push button, resistor, red LED. Pressing SW1 should light D1 — but nothing happens. Find the fault, repair it, then run the test bench.',
    },
    'builtin-tut-cold-joint': {
      title: 'Cold Joint 101',
      description: 'Beginner Tutorial 2: Only three parts — coin cell BT1, 100 Ω resistor R1, and green LED D1. Every trace on top is intact, yet no current flows and D1 is dark. Flip the board to inspect how through-hole parts are soldered underneath.',
    },
    'builtin-tut-solder-bridge': {
      title: 'Solder Bridge 101',
      description: 'Beginner Tutorial 3: The battery is delivering ~28 mA, yet red LED D1 is completely dark! Learn the difference between an open circuit and a short circuit, and clean up excess solder with Desolder wick.',
    },
    'builtin-tut-polarity': {
      title: 'One-Way LED',
      description: 'Beginner Tutorial 4: The parts are all in place, but D1 stays dark. LEDs only conduct one way: from Anode (+) to Cathode (-). Measure diode drop with the meter and rotate D1 to face the right way.',
    },
    'builtin-tut-resistor': {
      title: 'Resistor & Ohm\'s Law',
      description: 'Beginner Tutorial 5: D1 lights, but it is so dim you can barely see it. The resistor is the wrong value: measure it, decode its color bands, and replace it with a 100 Ω part from the bin.',
    },
    'builtin-tut-divider': {
      title: 'Voltage Divider 101',
      description: 'Beginner Tutorial 6: Two resistors split a voltage rail. Test point TP1 should read 1.5 V, but reads 0 V. Inspect the empty footprint and populate R2 from the parts bin.',
    },
    'builtin-bridge-troll': {
      title: 'Bridge Troll',
      description: 'A logic board with multiple signals. One signal line is pinned low due to a sneaky solder bridge under an SMD component.',
    },
    'builtin-backwards-day': {
      title: 'Backwards Day',
      description: 'Assembly gone wrong: a tantalum capacitor and protection diode were soldered backwards, causing the main rail to short out.',
    },
    'builtin-ghost-short': {
      title: 'Ghost Short',
      description: 'The 3.3V rail reads only 0.8 Ω to ground. Nothing looks visibly damaged. Use voltage injection and thermal imaging to find the hot part.',
    },
    'builtin-smoke-test': {
      title: 'Smoke Test',
      description: 'A 5V protected rail with a fuse (F1) and series diode (D1). The fuse is blown and the rail is dead. Use OCP current limit before replacing the fuse!',
    },
    'builtin-sagging-rail': {
      title: 'The Sagging Rail',
      description: 'The buck converter should provide a stable 3.3V, but drops to 1.9V under load. Scope reveals missing switching pulses on the inductor.',
    },
    'demo-mnt-reform2-mb30': {
      title: 'MNT Reform 2 · dead 3.3 V rail',
      description: 'Open-hardware laptop mainboard (530 parts). The 3.3 V rail is completely dead on arrival. Locate the shorted decoupling cap and revive the board.',
    },
    'demo-antmicro-jetson-nano-bb': {
      title: 'Antmicro baseboard · no 3.3 V, flaky 5 V',
      description: 'Nvidia Jetson Nano carrier baseboard (392 parts). Regulators fail to start up due to a blown divider resistor on the Enable pin.',
    },
  },
  categories: {
    beginner: 'Beginner',
    training: 'Training boards',
    demos: 'Open-hardware demos',
    mods: 'Community mods',
    solved: 'Solved',
    active: 'Active',
    parts: 'parts',
    par: 'Par',
  },
  report: {
    title: 'Bench Diagnostic & Repair Report',
    boardName: 'Target Board',
    date: 'Date of Analysis',
    status: 'Verification Status',
    solved: 'REPAIRED (Objective passed)',
    unsolved: 'IN PROGRESS (Faults remaining)',
    findings: 'Diagnostic Findings',
    stepsTaken: 'Repair Actions Taken',
    measurements: 'Bench Measurements',
    downloadMd: 'Download Report (.md)',
    downloadJson: 'Download Telemetry (.json)',
    close: 'Close',
  },
  shortcuts: {
    title: 'LiveBoard Studio Keyboard Shortcuts',
    toolsHeading: 'Tool Selection',
    navigationHeading: 'Navigation & Camera',
    actionsHeading: 'Bench Actions',
    close: 'Close (Esc)',
  },
};

export function t(): I18nDict {
  return currentLang === 'pl' ? DICT_PL : DICT_EN;
}

/** Helper to translate scenario title & description based on id */
export function translateScenario(id: string, defaultTitle: string, defaultDesc: string): { title: string; description: string } {
  const dict = t();
  const sc = dict.scenarios[id];
  if (sc) {
    return {
      title: sc.title || defaultTitle,
      description: sc.description || defaultDesc,
    };
  }
  return { title: defaultTitle, description: defaultDesc };
}
