# Tworzenie własnych płytek: Przewodnik po modyfikacjach DEADBOARD

**Modyfikacja (Mod)** dodaje nowe płytki do symulatora DEADBOARD: Twoje własne projekty z KiCada, przekonwertowane płyty open-hardware lub wyzwania naprawcze (CTF) stworzone na stole warsztatowym. Do każdej płytki możesz dołączyć **listę elementów (BOM)** z oznaczeniami PCBWay/LCSC oraz **schemat ideowy**, który gracze mogą otworzyć obok płytki podczas badania multimetrem.

Modyfikacje to zwykłe pliki: katalog (lub archiwum `.zip`) z małym plikiem konfiguracyjnym `mod.json` listującym Twoje płytki. Mody nie zawierają kodu wykonywalnego — instalacja modyfikacji innych osób w przeglądarce jest w 100% bezpieczna.

Nie musisz być programistą. Jeśli potrafisz wyeksportować plik z KiCada, skorzystać z naszego **Kreatora Płytek** na stole warsztatowym lub edytować kilka linijek tekstu, stworzysz własny mod.

---

## ⚡ Najszybsza metoda: Wbudowany Kreator i Eksport z Warsztatu

Każda płytka w DEADBOARD może stać się modyfikacją bez dotykania ręcznie plików JSON:

1. **Użyj Kreatora Płytek (klawisz K na warsztacie):**
   - Wybierz szablon bazowy (ESP32 DevKit, Raspberry Pi Pico RP2040, Arduino Uno R3, zasilacz Step-Down TPS54302 lub czysty laminat FR-4).
   - Dobierz komponenty z wbudowanej bazy dostawców **PCBWay / LCSC**.
   - Wstrzyknij usterki edukacyjne (zwarcie szyny 3.3V, zimny lut, odwrotna polaryzacja diody, spalony bezpiecznik).
   - Kliknij **Eksportuj jako Mod (.zip)**.
2. **Lub załaduj własny projekt:** Przeciągnij plik `.kicad_pcb` lub boardview `.brd` bezpośrednio na stół warsztatowy.
3. **Zmień płytkę w wyzwanie naprawcze (w zakładce Tworzenie / Studio):**
   - Wpisz tytuł, autora, poziom trudności (1-5) i opis zgłoszenia usterki od klienta.
   - Dodaj **cele naprawy (objectives)**, np. `"dioda D1 świeci po naciśnięciu SW1"` lub `"szyna 3.3V ma napięcie w zakresie 3.2V–3.4V"`.
   - Wpisz tajną **flagę CTF** (np. `PCB{moj_pierwszy_sukces}`) i kliknij **Zablokuj flagę kryptograficzną**: flaga jest szyfrowana stanem poprawnie działającego obwodu.
   - Wprowadź usterkę narzędziami warsztatu (rozlutuj ścieżkę skalpelem, stwórz zimny lut lub zrób zwarcie cyną).
4. Kliknij **Eksportuj jako mod (.zip)** i podziel się paczką ze społecznością!

---

## 📦 Struktura paczki modyfikacji

```
moj-mod/
├── mod.json                    ← główny plik manifestu (wymagany)
└── boards/
    ├── wzmacniacz.kicad_pcb     ← projekt płytki: .kicad_pcb, .brd lub .pcbfix.json
    ├── wzmacniacz-bom.csv       ← opcjonalnie: wartości części i oznaczenia PCBWay/LCSC
    ├── wzmacniacz-schemat.pdf   ← opcjonalnie: schemat otwierany obok płytki
    └── wzmacniacz-naprawa.pcbfix.json ← wyzwanie wyeksportowane z warsztatu
```

Plik `mod.json` musi znajdować się w katalogu głównym archiwum `.zip`.

---

## 📄 Format pliku mod.json

Kompletny przykład konfiguracji:

```json
{
  "format": "deadboard-mod/1",
  "id": "moj-mod-esp32",
  "name": "ESP32 IoT Diagnostic Pack",
  "version": "1.0.0",
  "author": "Jan Elektronik",
  "description": "Zestaw wyzwań serwisowych dla modułów IoT ESP32 oraz przetwornic impulsowych DC-DC.",
  "license": "CC-BY-4.0",
  "homepage": "https://github.com/merx666/deadboard",
  "boards": [
    {
      "id": "esp32-iot-repair",
      "file": "boards/esp32-iot-repair.pcbfix.json",
      "title": "ESP32 DevKit · Zwarcie szyny 3.3V",
      "description": "Moduł nie reaguje na zasilanie USB. Zasilacz laboratoryjny wykazuje zadziałanie zabezpieczenia nadprądowego OCP.",
      "difficulty": 2,
      "hints": [
        "Sprawdź temperaturę kondensatorów filtrujących kamerą termowizyjną.",
        "Zmierz rezystancję szyny 3.3V względem masy przy wyłączonym zasilaniu."
      ],
      "schematic": "boards/esp32-schematic.pdf",
      "solver": "spice-power"
    }
  ]
}
```

### Pola manifestu `mod.json`

| Pole | Wymagane | Opis |
| --- | --- | --- |
| `format` | tak | Zawsze `"deadboard-mod/1"`. |
| `id` | tak | Unikalny identyfikator moda (małe litery, cyfry, myślniki, np. `jan-esp32-boards`). Zainstalowanie moda o tym samym `id` **zastępuje** poprzednią wersję. |
| `name` | tak | Nazwa wyświetlana graczom w katalogu. |
| `license` | tak | Identyfikator licencji [SPDX](https://spdx.org/licenses/): `CC-BY-4.0`, `CC0-1.0`, `MIT`, `CERN-OHL-S-2.0` itp. |
| `version` | nie | Numer wersji (domyślnie `1.0.0`). |
| `author` | nie | Imię, nazwisko lub pseudonim autora. |
| `description` | nie | Krótki opis zawartości modyfikacji. |
| `homepage` | nie | Adres URL repozytorium GitHub, strony lub wątku forum. |
| `boards` | tak | Lista płytek zawartych w modzie (co najmniej jedna). |

### Parametry płytki w liście `boards`

| Pole | Wymagane | Opis |
| --- | --- | --- |
| `file` | tak | Ścieżka do pliku płytki w modzie: `.kicad_pcb`, `.brd` lub `.pcbfix.json`. |
| `id` | nie | Unikalny identyfikator płytki w obrębie moda. |
| `title` | zalecane | Tytuł widoczny na liście płytek w warsztacie. |
| `description` | nie | Opis usterki, problemu zgłoszonego przez klienta lub zadania. |
| `difficulty` | nie | Poziom trudności od 1 (początkujący) do 5 (ekspert). |
| `hints` | nie | Tablica wskazówek (do 10), odsłanianych kolejno przez gracza. |
| `bom` | nie | Plik CSV z listą części i wartościami (wspiera formaty KiCad, Altium, PCBWay, LCSC). |
| `schematic` | nie | Schemat ideowy otwierany obok stołu: plik `.pdf`, `.svg`, `.png` lub `.jpg`. |
| `solver` | nie | `"fast"` (szybka analiza węzłowa DC) lub `"spice-power"` (dla przetwornic i sekwencjonowania szyn). |

---

## 📑 Lista części BOM (Wartości i Numery PCBWay / LCSC)

Pliki boardview (`.brd`) oraz niektóre eksporty nie zawierają wartości rezystorów i kondensatorów. Dołączenie pliku BOM CSV uzupełnia te dane:

```csv
Reference,Value,Footprint,LCSC
R1,10k,0805,C17414
R2,150R,0805,C17410
C1-C4,100nF 50V X7R,0805,C49678
U1,AMS1117-3.3,SOT-223,C15849
```

Obsługiwane są separatory: przecinek (`,`), średnik (`;`) oraz tabulator (`\t`).

---

## 🛠️ Instalacja i Testowanie Modyfikacji

1. Otwórz warsztat i kliknij nazwę płytki u góry, by otworzyć katalog.
2. Kliknij **Modyfikacje**, a następnie **Zainstaluj mod (.zip)** i wskaż plik. Możesz też po prostu przeciągnąć archiwum `.zip` bezpośrednio na stół warsztatowy!
3. Nowa płytka pojawi się w sekcji **Modyfikacje Społeczności**.
4. Włącz zasilanie i kliknij **Uruchom testy**, aby sprawdzić czy cele naprawy działają poprawnie.

---

## 🔬 Otwarte Repozytorium i Współpraca

Kod źródłowy DEADBOARD oraz przykładowe modyfikacje są dostępne na GitHubie:  
👉 [https://github.com/merx666/deadboard](https://github.com/merx666/deadboard)
