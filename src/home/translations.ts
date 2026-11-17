/**
 * Translations for the DEADBOARD landing page (index.html).
 */

export interface LandingTranslations {
  skip: string;
  nav: {
    bench: string;
    faults: string;
    boards: string;
    challenges: string;
    mods: string;
    openBench: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    lede: string;
    ctaPrimary: string;
    ctaTutorial: string;
    req: string;
    caption: string;
  };
  bootlog: {
    note: string;
  };
  bench: {
    eyebrow: string;
    title: string;
    lede: string;
    multimeter: { title: string; desc: string };
    supply: { title: string; desc: string };
    scope: { title: string; desc: string };
    thermal: { title: string; desc: string };
    rework: { title: string; desc: string };
    boardview: { title: string; desc: string };
  };
  faults: {
    eyebrow: string;
    title: string;
    lede: string;
    tags: string[];
  };
  boards: {
    eyebrow: string;
    title: string;
    lede1: string;
    lede2: string;
    honestEyebrow: string;
    honestTitle: string;
    honestDesc: string;
  };
  challenges: {
    eyebrow: string;
    title: string;
    lede: string;
  };
  final: {
    title: string;
    cta: string;
  };
  footer: {
    subtitle: string;
    openBench: string;
    makeMod: string;
    feedback: string;
  };
}

export const LANDING_PL: LandingTranslations = {
  skip: 'Przejdź do treści',
  nav: {
    bench: 'Warsztat',
    faults: 'Usterki',
    boards: 'Płytki',
    challenges: 'Wyzwania',
    mods: 'Modyfikacje',
    openBench: 'Otwórz warsztat',
  },
  hero: {
    eyebrow: '> trenażer naprawy elektroniki',
    title: 'Przywróć martwe płyty do życia.',
    lede: 'DEADBOARD to profesjonalny stół warsztatowy w Twojej przeglądarce. Diagnozuj rzeczywiste płyty open-hardware multimetrem, mierz prąd rozruchu z zasilacza laboratoryjnego, badaj oscyloskopem węzły przetwornic, lokalizuj zwarcia kamerą termowizyjną i lutuj kolbą podlegającą prawom fizyki.',
    ctaPrimary: 'Otwórz warsztat →',
    ctaTutorial: 'Naucz się podstaw · 5 min',
    req: 'Działa w Chrome, Edge 113+, Safari 26+ (WebGPU). Bez instalacji.',
    caption: 'Płyta główna laptopa MNT Reform 2 (otwarty sprzęt, 530 części), naprawiona i sprawna: kluczowanie przetwornicy 3.3 V na oscyloskopie, pobór 16.2 mA z szyny 30 V na zasilaczu.',
  },
  bootlog: {
    note: 'To płyta z powyższej ilustracji, uruchamiająca się na stole pomiarowym. Zablokowana szyna zatrzymuje sekwencję, a zwarcie powoduje ciągłą pętlę restartu (boot-loop).',
  },
  bench: {
    eyebrow: '> stół warsztatowy',
    title: 'Przyrządy, które zachowują się jak prawdziwe przyrządy.',
    lede: 'Wszystkie narzędzia, po które sięga technik serwisu — z tymi samymi ograniczeniami i cechami fizycznymi.',
    multimeter: {
      title: 'Multimetr cyfrowy',
      desc: 'Miernik o zakresie 6000 zliczeń: impedancja wejściowa 10 MΩ, rezystancja przejścia sond, test diody. Pomiar pojemności w układzie zawyża odczyt. Zakres 10 A działa wyłącznie w szeregu.',
    },
    supply: {
      title: 'Zasilacz laboratoryjny',
      desc: 'Rzeczywisty prąd rozruchu: czuwanie, uśpienie, praca. Ograniczenie prądowe (OCP) oraz wstrzykiwanie napięcia, by rozgrzać zwarty element na szynie.',
    },
    scope: {
      title: 'Oscyloskop cyfrowy',
      desc: 'Analiza narastania napięć zasilania i pętli boot-loop. Badanie kluczowania przetwornic DC-DC, tętnień szyn i generatorów zegarowych.',
    },
    thermal: {
      title: 'Kamera termowizyjna',
      desc: 'Prawdziwy obraz w podczerwieni: czysta cyna ma niską emisyjność. Zamrażacz w sprayu, alkohol izopropylowy (IPA) i metoda kalafoniowa do precyzyjnej lokalizacji zwarć.',
    },
    rework: {
      title: 'Lutowanie i rework',
      desc: 'Kolba lutownicza, stacja hot-air, podgrzewacz dolny. Rola topnika, odprowadzanie ciepła przez płaszczyzny masy i ryzyko zerwania przegrzanych padów.',
    },
    boardview: {
      title: 'Widok płytki (Boardview)',
      desc: 'Obie strony laminatu, rzut 2D lub pełny obrót 3D. Kliknij element, by zobaczyć bieg jego połączeń. Wyszukuj setki części jednym naciśnięciem klawisza.',
    },
  },
  faults: {
    eyebrow: '> usterki laboratoryjne',
    title: 'Płyty psują się tak, jak w rzeczywistości.',
    lede: 'Nie chodzi o proste "brakuje części, znajdź ją". Usterki mają realną głębokość i objawy fizyczne. Niektóre ujawniają się dopiero po nagrzaniu lub dociśnięciu laminatu.',
    tags: [
      'zwarty kondensator MLCC',
      'upływność kondensatora',
      'osad po zalaniu cieczą',
      'utleniona miedź',
      'przebity układ scalony',
      'uszkodzony stabilizator LDO',
      'rozjechana rezystancja',
      'oporowy zimny lut',
      'przerwa po nagrzaniu',
      'przewodzi tylko po dociśnięciu',
      'upływność termiczna',
      'zerwany pad lutowniczy',
      'pęknięcie od szoku termicznego',
      'odwrotna polaryzacja',
    ],
  },
  boards: {
    eyebrow: '> prawdziwe płyty',
    title: 'Dowolna płytka. Bez sztywnego skryptowania.',
    lede1: 'Importuj pliki boardview (.brd) lub projekty KiCad (.kicad_pcb). DEADBOARD samodzielnie odnajduje strukturę szyn zasilania, przetwornice i stany zasilania z netlisty, a następnie symuluje całą płytkę w silniku SPICE. W każdej chwili możesz wyeksportować netlistę zgodną z ngspice.',
    lede2: 'Stworzyłeś własną płytkę? Spakuj projekt, schemat i listę elementów jako modyfikację, którą każdy może zainstalować jednym kliknięciem.',
    honestEyebrow: '> rzetelna symulacja',
    honestTitle: 'Każda liczba ma swoje źródło.',
    honestDesc: 'Wartości parametrów pochodzą z danych projektowych, not katalogowych i założeń inżynieryjnych. Tam, gdzie danych brakuje, wartości są jasno oznaczone jako szacunki, a syntetyzowane przebiegi są wyraźnie sygnalizowane na oscyloskopie.',
  },
  challenges: {
    eyebrow: '> wyzwania naprawcze',
    title: 'Zepsuj obwód. Zablokuj flagę. Podziel się linkiem.',
    lede: 'Zacznij od działającej płyty, wprowadź usterki i zablokuj flagę kryptograficzną na poprawnym stanie obwodu. Flaga jest szyfrowana topologią połączeń — odblokuje ją wyłącznie realna, poprawna naprawa.',
  },
  final: {
    title: 'Na stole czeka martwa płyta.',
    cta: 'Otwórz stół warsztatowy →',
  },
  footer: {
    subtitle: 'Trenażer naprawy elektroniki na poziomie komponentów ·',
    openBench: 'Otwórz warsztat',
    makeMod: 'Stwórz modyfikację',
    feedback: 'Zgłoś opinię',
  },
};

export const LANDING_EN: LandingTranslations = {
  skip: 'Skip to content',
  nav: {
    bench: 'Bench',
    faults: 'Faults',
    boards: 'Boards',
    challenges: 'Challenges',
    mods: 'Mods',
    openBench: 'Open the bench',
  },
  hero: {
    eyebrow: '> board-level repair trainer',
    title: 'Bring dead boards back.',
    lede: 'DEADBOARD is a repair bench in your browser. Probe a real open-hardware board with a multimeter, read boot current off the bench supply, scope the switch nodes, find the short with a thermal camera, then fix it with an iron that obeys physics.',
    ctaPrimary: 'Open the bench →',
    ctaTutorial: 'Learn the basics · 5 min',
    req: 'Runs in Chrome or Edge 113+, Safari 26+ (WebGPU). Nothing to install.',
    caption: 'MNT Reform 2 laptop mainboard (open hardware, 530 parts), repaired and running: the 3.3 V converter switching on the scope, 16.2 mA from 30 V on the supply.',
  },
  bootlog: {
    note: "That's the board above, powering up on the bench (its rail names carry no power states, so every converter starts at S0). A stuck rail stalls the sequence. A short makes it loop.",
  },
  bench: {
    eyebrow: '> the bench',
    title: 'Instruments that behave like instruments.',
    lede: 'Every tool a technician reaches for, with the same quirks and the same limits.',
    multimeter: {
      title: 'Multimeter',
      desc: 'A 6000-count meter, not an ideal probe: 10 MΩ input, contact resistance, diode test. Capacitance reads high in circuit. The 10 A input only works in series.',
    },
    supply: {
      title: 'Bench supply',
      desc: 'Boot current you can read: standby, sleep, running. Current limit, and voltage injection to make the culprit on a shorted rail heat up.',
    },
    scope: {
      title: 'Oscilloscope',
      desc: 'Roll through power-up ramps and boot loops. Catch a switch node, its ripple, or a clock that never started.',
    },
    thermal: {
      title: 'Thermal camera',
      desc: 'IR that reads like IR: bare solder looks cold. Freeze spray, isopropyl and the rosin method to pin the hot part.',
    },
    rework: {
      title: 'Rework',
      desc: 'Iron, hot air, preheater. Flux matters, ground pads fight back, and pads lift if you cook them.',
    },
    boardview: {
      title: 'Boardview',
      desc: 'Both sides, 2D or a full 3D orbit. Click a part to see where its nets go. Search hundreds of parts in a keystroke.',
    },
  },
  faults: {
    eyebrow: '> the faults',
    title: 'Boards fail the way real boards fail.',
    lede: 'Not "part missing, find it". Faults come with realistic severity and realistic symptoms. Some only show up when the board is warm, or when you press on it.',
    tags: [
      'dead-short MLCC',
      'leaky capacitor',
      'liquid residue',
      'corroded copper',
      'chip shorted inside',
      'dead regulator',
      'drifted resistor',
      'resistive cold joint',
      'opens when warm',
      'works only when pressed',
      'leaks when warm',
      'lifted pad',
      'cracked by thermal shock',
      'reversed part',
    ],
  },
  boards: {
    eyebrow: '> real boards',
    title: 'Any board. No per-board scripting.',
    lede1: 'Import a boardview (.brd) or a KiCad layout. DEADBOARD finds the power tree, the regulators and the power states from the netlist and its net names, then simulates the whole board with a SPICE engine. Export it as an ngspice netlist whenever you like.',
    lede2: 'Made something? Package your boards, their BOM and schematic as a mod that anyone can install.',
    honestEyebrow: '> honest simulation',
    honestTitle: 'Every number has a source.',
    honestDesc: 'Values come from the board data, datasheets and design intent. Where none exist, the estimate is labelled as an estimate, and synthesized waveforms say so on the scope. Measured a real board? Feed the readings back and DEADBOARD calibrates its model against your bench.',
  },
  challenges: {
    eyebrow: '> challenges',
    title: 'Break it. Lock a flag. Share the link.',
    lede: "Start from a working board, plant faults, and lock a flag to the repaired circuit. The flag is encrypted with the board's topology, so only a real repair unlocks it. There's no peeking and no shortcut. Share it as a file or a single link.",
  },
  final: {
    title: "There's a dead board on the bench.",
    cta: 'Open the bench →',
  },
  footer: {
    subtitle: 'Board-level repair trainer ·',
    openBench: 'Open the bench',
    makeMod: 'Make a mod',
    feedback: 'Feedback',
  },
};
