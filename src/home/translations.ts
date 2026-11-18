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
    openBench: 'Uruchom Studio PCB',
  },
  hero: {
    eyebrow: '> studio projektowania & symulacji pcb',
    title: 'Zaprojektuj i Przetestuj Własną Płytkę PCB w Przeglądarce',
    lede: 'Interaktywne środowisko projektowe z symulacją SPICE w czasie rzeczywistym, biblioteką komponentów LCSC/PCBWay i podglądem 3D. Twórz unikalne obwody od zera, rozmieszczaj elementy z bazy dostawców lub badaj i diagnozuj gotowe projekty sprzętowe.',
    ctaPrimary: 'Uruchom Studio PCB (Stwórz Własną Płytkę)',
    ctaTutorial: 'Zobacz Gotowe Projekty (ESP32, Pico, Arduino)',
    req: 'Działa w Chrome, Edge 113+, Safari 26+ (WebGPU). Błyskawiczny start bez instalacji.',
    caption: 'Interaktywny model 3D otwartej płytki drukowanej w LiveBoard: swobodny obrót w 3D, inspekcja ścieżek, padów i elementów SMD/THT przed symulacją.',
  },
  bootlog: {
    note: 'Projekt płytki uruchamiający się w silniku symulacji LiveBoard. Analiza szyn zasilania, prądu rozruchu i stabilności sygnałów w czasie rzeczywistym.',
  },
  bench: {
    eyebrow: '> wirtualne laboratorium pomiarowe',
    title: 'Profesjonalne przyrządy badawcze i pomiarowe.',
    lede: 'Wszystkie narzędzia inżynierskie, po które sięga projektant i elektronik — z pełnymi prawami fizyki i realistycznymi ograniczeniami.',
    multimeter: {
      title: 'Multimetr cyfrowy',
      desc: 'Miernik o zakresie 6000 zliczeń: impedancja wejściowa 10 MΩ, rezystancja przejścia sond, test diody. Pomiar pojemności w układzie zawyża odczyt. Zakres 10 A działa wyłącznie w szeregu.',
    },
    supply: {
      title: 'Zasilacz laboratoryjny',
      desc: 'Rzeczywisty prąd rozruchu: czuwanie, uśpienie, praca. Ograniczenie prądowe (OCP) oraz wstrzykiwanie napięcia, by zbadać reakcję termiczną i odpowiedź dynamiczną obwodu.',
    },
    scope: {
      title: 'Oscyloskop cyfrowy',
      desc: 'Analiza narastania napięć zasilania i odpowiedzi impulsowej. Badanie kluczowania przetwornic DC-DC, tętnień szyn i generatorów zegarowych.',
    },
    thermal: {
      title: 'Kamera termowizyjna',
      desc: 'Prawdziwy obraz w podczerwieni: czysta cyna ma niską emisyjność. Zamrażacz w sprayu, alkohol izopropylowy (IPA) i podgląd rozkładu temperatur na powierzchni laminatu.',
    },
    rework: {
      title: 'Lutowanie i rework',
      desc: 'Kolba lutownicza, stacja hot-air, podgrzewacz dolny. Wymiana i lutowanie komponentów z bazy LCSC, rola topnika i odprowadzanie ciepła przez płaszczyzny miedzi.',
    },
    boardview: {
      title: 'Widok płytki (Boardview & 3D)',
      desc: 'Obie strony laminatu, rzut 2D lub pełny obrót 3D. Kliknij element, by zobaczyć bieg jego ścieżek i netlistę. Wyszukuj setki części jednym naciśnięciem klawisza.',
    },
  },
  faults: {
    eyebrow: '> testy odporności i usterki',
    title: 'Diagnostyka problemów i rzeczywiste awarie.',
    lede: 'Testuj niezawodność projektów PCB w warunkach granicznych lub rozwiązuj laboratoryjne zadania diagnostyczne. Usterki mają realną głębokość fizyczną i reagują na temperaturę oraz nacisk mechaniczny.',
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
    eyebrow: '> baza projektów i komponentów',
    title: 'Twórz własne płytki lub badaj otwarte projekty.',
    lede1: 'LiveBoard to kreator własnych płytek PCB zintegrowany z biblioteką części LCSC / PCBWay oraz importem projektów KiCad (.kicad_pcb) i boardview (.brd). Silnik automatycznie mapuje netlistę, przetwornice i szyny zasilania, a następnie symuluje zachowanie obwodu w SPICE.',
    lede2: 'Zaprojektowałeś płytkę? Spakuj projekt, schemat i listę elementów jako modyfikację, którą każdy może zainstalować lub wyeksportuj do fabrykacji.',
    honestEyebrow: '> rzetelna symulacja spice',
    honestTitle: 'Każda wartość ma inżynieryjne źródło.',
    honestDesc: 'Parametry elementów pochodzą bezpośrednio z not katalogowych producentów i modeli SPICE. Wszelkie przybliżenia są wyraźnie sygnalizowane, a symulator umożliwia kalibrację parametrów w oparciu o fizyczne pomiary laboratoryjne.',
  },
  challenges: {
    eyebrow: '> wyzwania inżynieryjne',
    title: 'Projektuj zagadki. Zablokuj flagę. Dziel się linkiem.',
    lede: 'Twórz wyzwania CTF oparte na elektronice: wprowadź celowe usterki i zablokuj flagę kryptograficzną na poprawnym stanie obwodu. Flaga szyfrowana jest topologią połączeń — odblokuje ją wyłącznie realna, poprawna naprawa.',
  },
  final: {
    title: 'Zaprojektuj swoją pierwszą płytkę PCB już teraz.',
    cta: 'Uruchom Studio PCB (Stwórz Własną Płytkę)',
  },
  footer: {
    subtitle: 'LiveBoard · PulsePCB Studio · Interaktywne Projektowanie i Symulacja PCB ·',
    openBench: 'Studio PCB',
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
    openBench: 'Launch PCB Studio',
  },
  hero: {
    eyebrow: '> pcb design & simulation studio',
    title: 'Design & Simulate Your Custom PCB in Real-Time',
    lede: 'Interactive CAD and simulation environment with real-time SPICE solver, LCSC/PCBWay supplier component catalog, and 3D board preview. Create unique circuits from scratch or inspect, diagnose, and mod open-hardware boards directly in your browser.',
    ctaPrimary: 'Launch PCB Studio (Create Custom Board)',
    ctaTutorial: 'View Pre-built Projects (ESP32, Pico, Arduino)',
    req: 'Runs in Chrome or Edge 113+, Safari 26+ (WebGPU). Instant start, zero install.',
    caption: 'Interactive 3D PCB model in LiveBoard: free 360° orbit, inspect traces, pads, and SMD/THT footprints with real-time SPICE simulation.',
  },
  bootlog: {
    note: 'Board design powering up in the LiveBoard SPICE simulation engine. Real-time rail sequencing, inrush current analysis, and signal stability verification.',
  },
  bench: {
    eyebrow: '> virtual measurement lab',
    title: 'Engineering instruments that obey the laws of physics.',
    lede: 'All the diagnostic instruments an engineer reaches for, with identical physics, bandwidth limits, and loading effects.',
    multimeter: {
      title: 'Digital Multimeter',
      desc: 'A 6000-count meter: 10 MΩ input impedance, probe lead resistance, diode test. Capacitance reads high in-circuit. The 10 A current range operates strictly in series.',
    },
    supply: {
      title: 'Bench Supply',
      desc: 'Realistic inrush and quiescent current: standby, sleep, active. Constant current limit (OCP) and voltage injection to locate thermal hotspots on shorted rails.',
    },
    scope: {
      title: 'Digital Oscilloscope',
      desc: 'Analyze power-up rise times and boot loops. Catch buck regulator switch nodes, ripple waveforms, and crystal oscillators.',
    },
    thermal: {
      title: 'Thermal Camera',
      desc: 'True infrared imaging: bare solder shows realistic emissivity. Freeze spray, isopropyl alcohol, and false-color thermal heatmap to pin down faults.',
    },
    rework: {
      title: 'Soldering & Rework',
      desc: 'Soldering iron, hot air rework station, bottom preheater. LCSC component fitting, flux effects, thermal mass heat-sinking, and lifted pad mechanics.',
    },
    boardview: {
      title: 'Boardview & 3D Viewer',
      desc: 'Top and bottom layers in 2D orthographic or full 3D orbital view. Inspect net routing, pads, and component metadata with instant search.',
    },
  },
  faults: {
    eyebrow: '> stress testing & faults',
    title: 'Realistic failure modes and hardware diagnostics.',
    lede: 'Evaluate circuit robustness under fault conditions or solve hardware CTF challenges. Faults exhibit realistic physical symptoms reacting to temperature and mechanical pressure.',
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
    eyebrow: '> design library & parts',
    title: 'Build custom boards or inspect open designs.',
    lede1: 'LiveBoard combines an interactive custom PCB designer with a rich LCSC / PCBWay parts catalog, plus KiCad (.kicad_pcb) and boardview (.brd) imports. The engine automatically extracts netlists, switching regulators, and power rails for full SPICE simulation.',
    lede2: 'Designed a new board? Package the layout, schematic, and BOM as a shareable mod or export for fabrication.',
    honestEyebrow: '> honest spice simulation',
    honestTitle: 'Every parameter is grounded in engineering.',
    honestDesc: 'Component values and characteristics stem directly from manufacturer datasheets and SPICE models. Any estimates are clearly flagged, and models can be calibrated against real physical bench measurements.',
  },
  challenges: {
    eyebrow: '> engineering challenges',
    title: 'Design challenges. Lock a flag. Share the link.',
    lede: 'Turn circuits into CTF puzzles: plant realistic faults and encrypt a flag tied to the exact circuit topology. Only a true, physically sound repair unlocks it.',
  },
  final: {
    title: 'Design your next custom PCB right now.',
    cta: 'Launch PCB Studio (Create Custom Board)',
  },
  footer: {
    subtitle: 'LiveBoard · PulsePCB Studio · Interactive PCB Design & Real-Time Simulation ·',
    openBench: 'PCB Studio',
    makeMod: 'Make a Mod',
    feedback: 'Feedback',
  },
};
