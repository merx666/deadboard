<p align="center">
  <img src="docs/brand/deadboard-lockup.svg" alt="DEADBOARD — bring dead boards back" width="520">
</p>

<p align="center">
  <b>Trenażer naprawy elektroniki na poziomie komponentów · Board-level repair trainer.</b><br>
  Diagnozuj i naprawiaj symulowane płytki drukowane na realistycznym stole warsztatowym w przeglądarce.
</p>

<p align="center">
  <img src="docs/media/deadboard-showcase.gif" alt="Diagnoza zwarcia linii 3.3 V na płycie MNT Reform 2, lokalizacja kamerą termowizyjną i wymiana kondensatora" width="880">
</p>

<p align="center">
  <b><a href="./app.html">▶ Uruchom warsztat w przeglądarce</a></b> ·
  <a href="https://github.com/merx666/deadboard">Repozytorium GitHub</a> ·
  <a href="./rea-analysis/REA_ANALYSIS_REPORT.md">Raport Inżynierii Wstecznej REA</a>
</p>

---

## 🇵🇱 O Projekcie (Polski — domyślny)

**DEADBOARD** kładzie uszkodzoną płytkę drukowaną na Twoim stole warsztatowym i oddaje w Twoje ręce pełen zestaw przyrządów pomiarowych technika elektronika. 
Mierzysz, analizujesz schemat ideowy, wykonujesz rework i weryfikujesz naprawę. Obwód jest rozwiązywany przez rzeczywisty silnik symulacji typu **SPICE / MNA**, więc mierniki wskazują prawdziwe stany fizyczne obwodu, a nie z góry oskryptowane odpowiedzi.

### 🛠️ Główne Funkcje i Przyrządy
- **Prawdziwe przyrządy laboratoryjne**:
  - **Multimetr cyfrowy**: 6000 zliczeń, napięcie DC (V), rezystancja (Ω), test diody, pojemność (nF/µF), amperomierz w szeregu (10 A).
  - **Akustyczny brzęczyk ciągłości (Buzzer)**: autentyczny sygnał piezoelektryczny 2.7 kHz przy rezystancji poniżej 30 Ω i zwartych złączach półprzewodnikowych.
  - **Zasilacz laboratoryjny**: odczyt prądu rozruchu (standby, sleep, boot loop), nastawa limitu prądowego OCP oraz wstrzykiwanie napięcia (Voltage Injection: 1 V / 3.3 V) na zwarte linie zasilania.
  - **Oscyloskop cyfrowy**: tryb Roll do badania ramp zasilania, kluczowania przetwornic DC-DC, tętnień szyn i generatorów zegarowych.
  - **Kamera termowizyjna**: fizyczny model promieniowania IR, emisyjność lutowia, zamrażacz w sprayu, alkohol izopropylowy (IPA) i metoda kalafoniowa.
- **Realistyczny Rework i Lutowanie**:
  - Kolba lutownicza (temperatura grota, topnik, pojemność cieplna pól masowych).
  - Stacja gorącego powietrza (Hot-Air 400 °C).
  - Plecionka rozlutownicza (zbieranie mostków cynowych).
  - Skalpel / rylec do przecinania ścieżek oraz przewód kynar do kładzenia zworek.
- **Prawdziwe płyty open-hardware**:
  - Płyta główna laptopa **MNT Reform 2** (530 elementów).
  - Płyta bazowa modułu **Antmicro Jetson Nano** (392 elementy).
  - Import projektów KiCad (`.kicad_pcb`), OpenBoardView (`.brd`) lub wyzwań (`.pcbfix.json`).
- **Weryfikacja kryptograficzna**:
  - Każde wyzwanie zawiera zaszyfrowaną flagę CTF (`PCB{...}`), której klucz deszyfrujący zależy od matematycznej topologii poprawnie naprawionej płytki.
- **Ulepszenia i Standard Anti-AI-Slop**:
  - Pełne wsparcie dla języka polskiego i angielskiego z natychmiastowym przełączaniem (klawisz `L` lub przycisk w nagłówku).
  - Interaktywne okno skrótów klawiszowych (klawisz `?`).
  - Generator protokołów naprawy laboratoryjnej (eksport do Markdown `.md` i `.json`).
  - Kompletny raport inżynierii wstecznej wykonany narzędziem **REA (Reverse Engineer Anything)** w folderze `rea-analysis/`.

---

## 🇬🇧 English Overview

DEADBOARD puts a broken circuit board on your bench and gives you the exact tools an electronics repair technician uses.
The circuit runs on a SPICE-style simulator in a WebWorker, so meters reflect true electronic physics and Kirchhoff's laws.

- **Real bench instruments**: 6000-count DMM with audible piezo continuity buzzer (< 30 Ω), bench supply with OCP current limit & voltage injection, oscilloscope (Roll & Auto), thermal camera, freeze spray, isopropyl alcohol, and rosin flux method.
- **Physical rework**: Soldering iron, hot-air station, desoldering wick, scalpel trace cutter, and kynar jumper wires.
- **Cryptographic flags**: Zero-knowledge challenge verification using SHA-256 / HMAC topological board hashes (`crypto.ts`).
- **Bilingual**: Polish (default) and English with instant runtime toggle (`L` key).
- **Repair report generator**: Export diagnostic bench reports in Markdown and JSON.

---

## 🏛️ Architektura Systemu / System Architecture

> Schemat architektury zaprojektowany zgodnie ze standardem edytorialnym **[diagram-design](https://github.com/cathrynlavery/diagram-design)** — minimalistyczna struktura, 1px hairline borders, czytelny podział subgrafów i zdyscyplinowany akcent LiveBoard (`#ff6b00`).

```mermaid
flowchart TD
  %% Diagram Design System (cathrynlavery/diagram-design)
  %% Editorial monochromatic palette with single flame-orange (#ff6b00) accent

  subgraph UI ["<b>Workbench & UI Controllers</b> · <i>src/ui/</i>"]
    PcbApp["<b>PcbApp Host</b><br/><code>app.ts</code> · 60/120Hz RAF Loop & Undo Stack"]
    Tools["<b>Bench Instruments</b><br/>6000-count DMM · Roll Scope · Lab PSU · Rework Iron"]
    Modals["<b>Modular Modal Controllers</b><br/>OrderModal · PartsBinModal · ReportModal · ShortcutsModal · HelpModal"]
    Creator["<b>CAD Board Creator</b><br/>Interactive DRC & 45° Autorouter"]
  end

  subgraph Engine ["<b>Simulation & Multi-Physics Solvers</b> · <i>src/sim.ts & src/spice/</i>"]
    FastSim["<b>Fast MNA Solver</b><br/>BFS Net Disconnection & Matrix Nodal Engine"]
    SpiceEngine["<b>Non-Linear SPICE Engine</b><br/>Newton-Raphson · Transient Rails · Power Tree"]
    Thermal["<b>2D Thermal & Flex Field</b><br/>Joule Heating · Emissivity · Freeze Spray · IPA Drying"]
    Intermittent["<b>Intermittent Strain Model</b><br/>Thermal Hysteresis & Mechanical Micro-cracks"]
  end

  subgraph Render ["<b>Hardware-Accelerated Viewport</b> · <i>src/render/</i>"]
    WebGPU["<b>WebGPU Graphics Pipeline</b><br/>Custom Shaders · Copper Traces · Soldermask · Thermal IR"]
    Camera["<b>Orbit & Projection Camera</b><br/>Dual-Side 2D/3D Transform Matrix"]
  end

  subgraph CAM ["<b>Industrial Hardware & CAM Pipeline</b> · <i>src/io/ & src/parts/</i>"]
    GerberGen["<b>Industrial CAM Exporter</b><br/>RS-274X Gerber & Excellon Drill ZIP Archive"]
    BOM["<b>BOM & SMT Centroid CPL</b><br/>Real-Time Parts Catalog & Supplier Quotation"]
    Importers["<b>EDA Importers</b><br/>KiCad (.kicad_pcb) & OpenBoardView (.brd)"]
  end

  subgraph Security ["<b>Verification & Modding Core</b> · <i>src/crypto.ts & src/mods/</i>"]
    Crypto["<b>Topological Cryptographic Verifier</b><br/>SHA-256 / HMAC Graph Hash & CTF Flag Decryption"]
    ModEngine["<b>Sandboxed Mod Runtime</b><br/>Isolated ZIP Packages & Community Boards"]
  end

  %% Data Flow & Interconnections
  Tools -->|User actions & probe telemetry| PcbApp
  Modals -->|Order checkout & part swaps| PcbApp
  Creator -->|Custom PCB layout netlist| PcbApp
  
  PcbApp -->|Solve request & state deltas| FastSim
  PcbApp -->|Transient rails & non-linear devices| SpiceEngine
  PcbApp -->|Dynamic heat dissipation I²R| Thermal
  
  FastSim -->|Nodal voltages & currents| Tools
  SpiceEngine -->|Oscilloscope signals & bus ripples| Tools
  Thermal -->|IR temperature distribution| WebGPU
  Intermittent -->|Flex open/short transitions| FastSim

  PcbApp -->|Geometry & mesh buffers| WebGPU
  Camera -->|View matrix & projection| WebGPU

  PcbApp -->|Topological board graph| Crypto
  Crypto -->|Unlock challenge flag PCB{...}| PcbApp

  PcbApp -->|Board design data| GerberGen
  PcbApp -->|Component BOM list| BOM
  Importers -->|Imported circuit board| PcbApp
  ModEngine -->|Community scenarios| PcbApp

  %% Style Classes (diagram-design editorial specs)
  classDef default fill:#0f172a,stroke:#334155,stroke-width:1px,color:#f8fafc;
  classDef focal fill:#18181b,stroke:#ff6b00,stroke-width:1.5px,color:#ffffff;
  classDef accent fill:#111827,stroke:#38bdf8,stroke-width:1px,color:#e2e8f0;
  classDef sub fill:#090d16,stroke:#1e293b,stroke-width:1px,color:#94a3b8;

  class PcbApp focal;
  class FastSim,SpiceEngine,WebGPU accent;
  class UI,Engine,Render,CAM,Security sub;
```

### 🧩 Podsystemy i Odpowiedzialności / Subsystems & Responsibilities

1. **Workbench & UI Controllers** (`src/ui/`):
   - `PcbApp`: Główny orkiestrator stołu warsztatowego, pętla animacji 60/120 Hz (`requestAnimationFrame`), stos cofania operacji (Undo/Redo).
   - Zdekomponowane kontrolery modalne: `OrderModalController` (fabrykacja i BOM), `PartsBinModalController` (magazyn podzespołów LCSC), `ReportModalController` (protokoły badań), `ShortcutsModalController`, `HelpModalController`, `BoardCreatorModal`.
   - Wirtualne przyrządy pomiarowe: multimetr cyfrowy 6000 zliczeń, oscyloskop w trybie Roll/Auto, zasilacz laboratoryjny z wstrzykiwaniem napięcia oraz zestaw kolb lutowniczych.
2. **Simulation & Multi-Physics Solvers** (`src/sim.ts`, `src/spice/`, `src/thermal.ts`):
   - **Fast MNA Solver**: Szybka analiza węzłowa BFS z automatyczną detekcją i izolacją odłączonych gałęzi oraz otwartych przełączników (0.000 V na pływających szynach).
   - **SPICE Engine**: Pełny silnik nieliniowy rozwiązujący stany nieustalone (transient), tętnienia przetwornic DC-DC, sekwencjonowanie szyn zasilania (`powertree.ts`).
   - **2D Thermal & Flex Field**: Model fizyczny nagrzewania Joule'a ($I^2 R$), chłodzenia konwekcyjnego, emisyjności IR lutowia, parowania IPA i kalafonii oraz mikropęknięć zmęczeniowych laminatu pod wpływem naprężeń zginających (`intermittent.ts`).
3. **Hardware-Accelerated Viewport** (`src/render/`):
   - Pipeline **WebGPU** renderujący dwustronnie laminat, miedź, soldermaskę, sitodruk i mapę ciepła w czasie rzeczywistym.
4. **Industrial Hardware & CAM Pipeline** (`src/io/`, `src/parts/`):
   - Generator pełnej paczki produkcyjnej Gerber RS-274X oraz Excellon CNC drill (`.zip`).
   - Ekstrakcja współrzędnych montażowych SMT Centroid CPL (`.csv`) i wycena BOM oparta o katalog komponentów LCSC / PCBWay.
   - Dwukierunkowy import projektów KiCad (`.kicad_pcb`) oraz OpenBoardView (`.brd`).
5. **Verification & Modding Core** (`src/crypto.ts`, `src/mods/`):
   - Deterministyczna weryfikacja kryptograficzna topologii płytki z użyciem funkcji skrótu SHA-256 / HMAC i deszyfracja flag CTF (`PCB{...}`).
   - Piaskownica dla modyfikacji społecznościowych z obsługą archiwów ZIP i izolacją środowiska.

---

## 🚀 Uruchomienie lokalne / Run Locally

Wymagania: Node.js 20+ oraz przeglądarka ze wsparciem WebGPU (Chrome/Edge 113+, Safari 26+).

```bash
# Instalacja zależności
npm install

# Serwer deweloperski (http://localhost:5173)
npm run dev

# Uruchomienie zestawu testów symulatora i fizyki (19 test suites)
npm test

# Budowanie wersji produkcyjnej do folderu dist/
npm run build
```

---

## 🔬 Raport Inżynierii Wstecznej REA

Szczegółowy raport analizy statycznej, dekompozycji pakietu WebGPU i solvera SPICE, wygenerowany narzędziem REA, znajduje się w:
👉 [`rea-analysis/REA_ANALYSIS_REPORT.md`](./rea-analysis/REA_ANALYSIS_REPORT.md)

---

## 📜 Licencja / Licence

DEADBOARD jest udostępniany na licencji [Apache License 2.0](LICENSE). Płytki demonstracyjne w `public/demos/` zachowują licencje swoich projektów źródłowych (CERN-OHL-S-2.0 oraz Apache-2.0); zobacz [NOTICE](NOTICE) i [public/demos/NOTICE.txt](public/demos/NOTICE.txt).
