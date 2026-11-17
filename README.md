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
