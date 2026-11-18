# Specyfikacja Techniczna: Architektura TypeScript, Silnik Gerber, Autorouter A* i Dekompozycja Narzędzi

**Data:** 2026-11-18  
**Status:** Zatwierdzony (Approved)  
**Projekt:** LiveBoard (PulsePCB Studio)  
**Cel:** Równoległa realizacja zaawansowanych usprawnień architektonicznych i flagowych funkcji inżynieryjnych przy użyciu roju agentów (`/swarm`).

---

## 1. Przegląd i Cel Projektu (Overview & Goals)

LiveBoard to interaktywny symulator diagnostyki elektroniki i projektowania płytek PCB w przeglądarce. W ramach audytu zgodnego z wytycznymi `typescript-expert` zidentyfikowano potrzebę:
1. **Wyeliminowania długu technologicznego typów**: Przejście z luźnych typów prymitywnych na nominalne typy brandowane (`Ohms`, `Volts`, `Farads`, `NetId`) oraz unie dyskryminowane dla komponentów obwodu.
2. **Dodania przemysłowego silnika eksportu Gerber RS-274X + Excellon**: Umożliwienie bezpośredniego zamawiania fizycznych płytek PCB z przeglądarki w fabrykach takich jak JLCPCB, PCBWay czy Aisler.
3. **Wdrożenia silnika automatycznego trasowania ścieżek PCB (Autorouter A* 45°)**: Inteligentne łączenie padów z omijaniem przeszkód i automatycznym dodawaniem przelotek VIA.
4. **Dekompozycji monolitycznego pliku `src/ui/app.ts` (5 777 linii)**: Wyodrębnienie maszyn stanów instrumentów pomiarowych do dedykowanych klas narzędziowych w `src/ui/tools/`.

Prace realizowane są równolegle przez wyspecjalizowany rój 4 agentów pracujących w odizolowanych katalogach.

---

## 2. Granice Modułów i Podział Ról Roju (Swarm Architecture)

Każdy agent roju otrzymuje niezależny zakres odpowiedzialności bez konfliktów plików:

```
src/
├── types/
│   ├── units.ts                [@types-architect] Branded types i helpery wielkości fizycznych
│   ├── components.ts           [@types-architect] Dyskryminowane unie komponentów obwodu
│   └── index.ts                [@types-architect] Fasada zachowująca kompatybilność wsteczną
├── io/
│   └── gerber.ts               [@gerber-engine] Generator RS-274X, Excellon drill i archiwum ZIP
├── routing/
│   └── autorouter.ts           [@autorouter] Siatkowy A* 45°, omijanie padów i przelotki VIA
└── ui/
    └── tools/                  [@modular-ui] Zdekomponowane maszyny stanów narzędzi
        ├── tool.ts             Wspólny interfejs WorkbenchTool
        ├── multimeter.ts       Kontroler multimetru cyfrowego (DMM)
        ├── oscilloscope.ts     Kontroler 2-kanałowego oscyloskopu
        ├── thermal.ts          Kontroler kamery termowizyjnej i aerozoli
        └── rework.ts           Kontroler kolby lutowniczej i stacji hot-air
```

---

## 3. Szczegółowa Specyfikacja Modułów

### 3.1. `@types-architect`: System Typów Nominalnych i Unii Dyskryminowanych

#### Nowe typy brandowane (`src/types/units.ts`):
```typescript
export type Brand<K, T> = K & { readonly __brand: T };

export type Ohms = Brand<number, 'Ohms'>;
export type Farads = Brand<number, 'Farads'>;
export type Volts = Brand<number, 'Volts'>;
export type Amps = Brand<number, 'Amps'>;
export type Millimeters = Brand<number, 'Millimeters'>;
export type NetId = Brand<string, 'NetId'>;
export type ComponentId = Brand<string, 'ComponentId'>;

// Funkcje konstruujące z walidacją
export function ohms(val: number): Ohms { return val as Ohms; }
export function farads(val: number): Farads { return val as Farads; }
export function volts(val: number): Volts { return val as Volts; }
export function amps(val: number): Amps { return val as Amps; }
export function netId(val: string): NetId { return val as NetId; }
```

#### Unia dyskryminowana komponentów (`src/types/components.ts`):
```typescript
import type { Ohms, Farads, Volts, Amps, Brand } from './units';
import type { Body, ComponentState, LedColor, Pad, Side, V2 } from '../types';

interface BaseComponent {
  id: string;
  ref: string;
  at: V2;
  rot: number;
  side: Side;
  pads: Pad[];
  pins: Record<string, string>;
  body: Body;
  state: ComponentState;
  label?: string;
  footprint?: string;
}

export interface ResistorComponent extends BaseComponent {
  kind: 'resistor';
  value: Ohms;
  rating?: number; // Watts
  tolerance?: number; // np. 0.01 dla 1%
}

export interface CapacitorComponent extends BaseComponent {
  kind: 'capacitor';
  value: Farads;
  maxVoltage?: Volts;
  dielectric?: 'MLCC' | 'Tantalum' | 'Electrolytic';
}

export interface DiodeComponent extends BaseComponent {
  kind: 'diode';
  forwardDrop?: Volts;
  maxCurrent?: Amps;
}

export interface LedComponent extends BaseComponent {
  kind: 'led';
  color: LedColor;
  forwardDrop?: Volts;
}

export interface IcComponent extends BaseComponent {
  kind: 'ic';
  partNumber?: string;
  supplyPins?: { vcc?: string[]; gnd?: string[] };
}

export interface SwitchComponent extends BaseComponent {
  kind: 'switch';
  closed: boolean;
}

export interface BatteryComponent extends BaseComponent {
  kind: 'battery';
  value: Volts;
  internalR?: Ohms;
}

export interface FuseComponent extends BaseComponent {
  kind: 'fuse';
  value: Amps;
  blowTimeSeconds?: number;
}

export type TypedComponent =
  | ResistorComponent
  | CapacitorComponent
  | DiodeComponent
  | LedComponent
  | IcComponent
  | SwitchComponent
  | BatteryComponent
  | FuseComponent;
```

---

### 3.2. `@gerber-engine`: Generator Plików Fabrykacyjnych RS-274X + Excellon

Moduł `src/io/gerber.ts` eksportuje funkcję:
```typescript
export interface GerberZipOptions {
  boardName?: string;
  projectNumber?: string;
  company?: string;
}

export async function generateGerberZip(
  board: Board,
  options?: GerberZipOptions
): Promise<Uint8Array>;
```

#### Standard formatu:
1. **Jednostki**: Metryczne milimetry (`%MOMM*%`), format współrzędnych 4.4 (`%FSLAX44Y44*%`), zera wiodące usunięte (leading zeros omitted).
2. **Definicje apertur (`%ADD...*%`)**:
   - `C,size` — apertury okrągłe dla padów THT i zakończeń ścieżek.
   - `R,w,h` — apertury prostokątne dla padów SMD.
   - `O,w,h` — apertury owalne.
3. **Warstwy wyjściowe w archiwum ZIP**:
   - `project-F_Cu.gtl`: Górna warstwa miedzi.
   - `project-B_Cu.gbl`: Dolna warstwa miedzi.
   - `project-F_Mask.gts`: Górna maska lutownicza (+0.05mm clearance).
   - `project-B_Mask.gbs`: Dolna maska lutownicza.
   - `project-F_Silk.gto`: Górny sitodruk (oznaczenia referencyjne i linie obrysowe).
   - `project-Edge_Cuts.gm1`: Mechaniczny obrys płytki.
   - `project-Drill.drl`: Plik wierceń Excellon z tabelą narzędzi (`T01C...`).

---

### 3.3. `@autorouter`: Silnik Trasowania Ścieżek PCB A* (45°)

Moduł `src/routing/autorouter.ts` eksportuje:
```typescript
export interface RouteRequest {
  board: Board;
  net: string;
  fromPad: { pos: V2; layer: Side };
  toPad: { pos: V2; layer: Side };
  traceWidth?: number; // Domyślnie 0.4 mm
  clearance?: number;  // Domyślnie 0.25 mm
}

export interface RouteResult {
  success: boolean;
  traces: Trace[];
  vias: Via[];
  cost: number;
  message?: string;
}

export function autorouteConnection(req: RouteRequest): RouteResult;
export function autorouteAllRatsnest(board: Board): {
  successCount: number;
  failedCount: number;
  newTraces: Trace[];
  newVias: Via[];
};
```

#### Szczegóły implementacji A*:
1. **Siatka przestrzenna**: Krok siatki 0.25 mm mapowany na rozmiary płytki `[0..w] x [0..h]` dla warstwy `F` (indeks 0) i `B` (indeks 1).
2. **Koszty heurystyki**:
   - Dystans ortogonalny: koszt 1.0.
   - Dystans ukośny 45°: koszt 1.414.
   - Zmiana kierunku (zaokrąglanie trasy): kara +0.5.
   - Zmiana warstwy (przelotka VIA): kara +8.0.
   - Pola przeszkód (obce pady i ścieżki): koszt `Infinity`.
3. **Uproszczenie ścieżek (Collinear Path Simplification)**: Odcinki leżące w jednej linii o tym samym kącie są łączone w pojedyncze obiekty `Trace`.

---

### 3.4. `@modular-ui`: Dekompozycja Maszyn Stanów Narzędzi

Wspólny interfejs w `src/ui/tools/tool.ts`:
```typescript
export type ToolKind =
  | 'inspect' | 'dmm' | 'scope' | 'thermal' | 'iron' | 'hotair'
  | 'jumper' | 'cut' | 'partsbin' | 'freeze' | 'ipa';

export interface ToolContext {
  board: Board;
  camera: Camera;
  sim: Sim | null;
  requestRender(): void;
  playAudio(effect: string): void;
  showToast(message: string, type?: 'info' | 'success' | 'warn' | 'error'): void;
}

export interface WorkbenchTool {
  readonly id: ToolKind;
  activate(context: ToolContext): void;
  deactivate(): void;
  onPointerDown(pos: V2, side: Side, event: MouseEvent | TouchEvent): void;
  onPointerMove(pos: V2, side: Side, event: MouseEvent | TouchEvent): void;
  onPointerUp(pos: V2, side: Side, event: MouseEvent | TouchEvent): void;
  onKeyDown?(event: KeyboardEvent): boolean;
  renderOverlay?(ctx: CanvasRenderingContext2D): void;
}
```

Każde narzędzie (`MultimeterTool`, `OscilloscopeTool`, `ThermalTool`, `ReworkTool`) stanowi autonomiczną klasę implementującą `WorkbenchTool`, co usuwa z `src/ui/app.ts` tysiące linii kodu i izoluje ich cykle życia.

---

## 4. Strategia Testowania i Weryfikacji Jakościowej

1. **`test/units.test.ts`**: Testy typów brandowanych i unii dyskryminowanych, walidacji wartości i kompatybilności z istniejącymi scenariuszami.
2. **`test/gerber.test.ts`**: Testy zgodności generowanych plików z formatem RS-274X, apertur, formatu wierceń Excellon i poprawności struktury ZIP.
3. **`test/autorouter.test.ts`**: Testy trasowania prostego, omijania przeszkód w kątach 45°, minimalizacji zagięć oraz poprawnego wstawiania przelotek VIA.
4. **`test/tools.test.ts`**: Testy jednostkowe kontrolerów narzędzi (zmiana trybów multimetru, triggery oscyloskopu, symulacja temperatury).
5. **Wymóg 100% Pass Rate**: Wszystkie 25 istniejących zestawów testowych + 4 nowe muszą przejść pomyślnie (`npm test`), a build produkcyjny (`npm run build`) musi zakończyć się na 0 błędów.
