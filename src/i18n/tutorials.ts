// Polish translations for all DEADBOARD tutorial steps, topics, and beginner primer

export const TUTORIAL_TOPICS_PL: Record<string, string[]> = {
  'builtin-first-light': ['Ścieżki i Pady', 'Miernik V⎓ i Ω', 'Mostkowanie ścieżki'],
  'builtin-tut-cold-joint': ['Druga strona (F)', 'Zimny lut', 'Reflow kolbą'],
  'builtin-tut-solder-bridge': ['Zwarcie a rozwarcie', 'Prąd zasilacza', 'Plecionka rozlutownicza'],
  'builtin-tut-polarity': ['Anoda i katoda', 'Test diody', 'Obrót o 180°'],
  'builtin-tut-resistor': ['Prawo Ohma', 'Kod paskowy', 'Magazyn części'],
  'builtin-tut-divider': ['Punkty pomiarowe', 'Puste pole (DNP)', 'Dzielnik napięcia'],
};

export const BEGINNER_PRIMER_HTML_PL = `
  <div class="card">
    <div class="card-title">Podstawy diagnostyki PCB (Zacznij tutaj)</div>
    <ul>
      <li><b>Laminat i sitodruk</b> — Sztywna zielona płytka (FR-4) izoluje obwody; białe napisy (<code>R1</code>, <code>D1</code>, <code>K</code>, <code>+</code>) to oznaczenia sitodruku wskazujące polaryzację i położenie elementów.</li>
      <li><b>Ścieżki miedziane, pady i przelotki</b> — Płaskie miedziane linie przewodzą prąd po stronie <b>Wierzchniej (Top)</b> i <b>Spodniej (Bottom)</b>. Złocone pierścienie to <b>pady</b>, do których przylutowane są nóżki; małe otworki to <b>przelotki (vias)</b> łączące warstwy.</li>
      <li><b>Podstawowe elementy</b> — <b>Baterie/Złącza</b> podają napięcie stałe DC; <b>Rezystory</b> ograniczają prąd (paski kodują omy); <b>Diody i LED</b> przewodzą tylko w jednym kierunku (wcięcie/pasek oznacza Katodę <code>K</code>); <b>Bezpieczniki</b> przepalają się przy zwarciu.</li>
      <li><b>Złota zasada 3 kroków</b> — (1) Inspekcja wizualna góry i spodu (klawisz <code>F</code>): szukaj przerw, zimnych lutów i mostków cynowych. (2) Przy <b>włączonym zasilaniu</b> mierz napięcia w trybie <b>V⎓</b> lub użyj <b>kamery termowizyjnej</b>. (3) <b>Zawsze wyłączaj zasilanie</b> przed pomiarem rezystancji (<b>Ω</b>) i testem diody!</li>
    </ul>
  </div>
`;

export interface StepTextPL {
  title: string;
  concept: string;
  task: string;
  phone?: string;
  quickActionLabel?: string;
  targetLabel?: string;
}

export const TUTORIAL_STEPS_PL: Record<string, StepTextPL[]> = {
  'builtin-first-light': [
    {
      title: 'Anatomia płytki drukowanej (PCB)',
      concept:
        'Płytka PCB zastępuje luźne przewody. Laminat z włókna szklanego izoluje obwody, a miedziane ścieżki przewodzą prąd między elementami. Złocone otwory to pady, przez które przechodzą nóżki elementów przylutowane od spodu.',
      task: 'Przełącz widok na 3D w górnym pasku (lub naciśnij Tab) i odwróć płytkę na Spód (F), aby zobaczyć jak wyglądają luty od spodu.',
      phone: 'Dotknij 3D, a następnie odwróć na Spód (przyciski u góry po prawej).',
      quickActionLabel: 'Przełącz na widok 3D',
      targetLabel: 'Cała płytka',
    },
    {
      title: 'Zamknięty obwód prądowy',
      concept:
        'Prąd elektryczny płynie jak woda w rurach: bateria (BT1) wypycha prąd z bieguna dodatniego (+3V), przez elementy obwodu, z powrotem do Masy (GND, 0 V). Jeśli w obwodzie nastąpi choć jedna przerwa, prąd nie płynie i nic nie działa.',
      task: 'Wybierz tryb Wyświetlania: Mapa napięć w górnym pasku, aby pokolorować ścieżki według ich potencjału — lub wybierz BT1 narzędziem Wybierz (1).',
      phone: 'Więcej ⋯ → Widok → Mapa napięć. Lub dotknij BT1 narzędziem Wybierz.',
      quickActionLabel: 'Włącz Mapę napięć',
      targetLabel: 'Bateria pastylkowa BT1',
    },
    {
      title: 'Przełączniki, rezystory i diody LED',
      concept:
        'Obwód za baterią BT1 ma 3 elementy: SW1 to przycisk zwierający obwód po naciśnięciu. R1 (100 Ω) to rezystor ograniczający prąd diody, chroniący ją przed spaleniem. D1 to dioda LED, która świeci, gdy prąd płynie od Anody (+) do Katody (K).',
      task: 'Upewnij się, że jesteś po stronie Wierzchniej z narzędziem Wybierz (1), a następnie kliknij bezpośrednio przycisk SW1, aby go zewrzeć.',
      phone: 'Po stronie Wierzchniej dotknij przycisk SW1 narzędziem Wybierz.',
      quickActionLabel: 'Narzędzie Wybierz (1)',
      targetLabel: 'Przycisk SW1',
    },
    {
      title: 'Pomiar napięcia stałego (V⎓)',
      concept:
        'Na mapie napięć widać, że +3V dociera do BT1 → SW1 → R1, lecz dioda D1 nie świeci. Multimetr mierzy różnicę potencjałów (napięcie w woltach) przy włączonym zasilaniu. Jeden punkt na 3.000 V, a kolejny na 0.000 V precyzyjnie wskazuje miejsce przerwy.',
      task: 'Wybierz Multimetr (2) w lewym doku (tryb V⎓, Zasilanie włączone), a następnie kliknij lewym przyciskiem myszy pad R1.2 (prawa nóżka R1) lub D1.2.',
      phone: 'Wybierz Miernik (V⎓, zasilanie wł.) i dotknij pad R1.2 lub D1.2.',
      quickActionLabel: 'Multimetr cyfrowy (2)',
      targetLabel: 'Pad R1.2',
    },
    {
      title: 'Lokalizacja przerwanej ścieżki (Ω)',
      concept:
        'Aby sprawdzić, czy dwa pady są połączone miedzią, przełącz Multimetr na pomiar Rezystancji (Ω). Złota zasada: ZAWSZE wyłączaj Zasilanie przed pomiarem omomierzem! Ciągła ścieżka daje wynik bliski 0.0 Ω i dźwięk buzzera; przerwa daje OL (Open Loop).',
      task: 'Wyłącz Zasilanie (P), kliknij Ω na multimetrze, kliknij lewym przyciskiem R1.2 (czerwona sonda), a prawym lub Shift+klik D1.2 (czarna sonda).',
      phone: 'Wyłącz zasilanie, miernik na Ω: dotknij R1.2 (czerwona), potem D1.2 (czarna).',
      quickActionLabel: 'Wyłącz zasilanie + tryb Ω',
      targetLabel: 'Pad D1.2 (Anoda +)',
    },
    {
      title: 'Zlokalizuj przerwę w ścieżce',
      concept:
        'Multimetr wskazał OL pomiędzy R1.2 a D1.2 — miedziana ścieżka łącząca te elementy została mechanicznie przerwana. Śledź złotą ścieżkę biegnącą w dół prawej krawędzi płytki.',
      task: 'Kliknij Zlokalizuj na płytce poniżej, aby przybliżyć uszkodzoną ścieżkę na pozycji 62, 19 mm, i wybierz Lutownicę (3).',
      phone: 'Dotknij Zlokalizuj na płytce, a następnie wybierz Lutownicę.',
      quickActionLabel: 'Lutownica kolbowa (3)',
      targetLabel: 'Przerwana ścieżka',
    },
    {
      title: 'Naprawa mostkiem lutowniczym',
      concept:
        'Lutownica nanosi stop lutowniczy na miedź. Nałożenie kropli cyny na przerwę w ścieżce łączy oba końce i przywraca ciągłość elektryczną.',
      task: 'Wybierz Lutownicę (3) i kliknij bezpośrednio przerwę w ścieżce na pozycji 62, 19 mm, aby zalać ją cyną.',
      phone: 'Lutownicą dotknij przerwę na ścieżce, aby ją zmostkować.',
      quickActionLabel: 'Zmostkuj przerwę lutem',
      targetLabel: 'Mostek lutowniczy na przerwie',
    },
    {
      title: 'Włącz zasilanie i zdobądź flagę',
      concept:
        'Gdy naprawa zamknie obwód miedziany, włączenie zasilacza laboratoryjnego zasili obwód i zaświeci diodę D1 po naciśnięciu SW1. Uruchom testy automatycznie weryfikuje wszystkie cele naprawy.',
      task: 'Włącz Zasilanie (P), zobacz jak dioda D1 świeci, a następnie kliknij Uruchom testy w górnym pasku, aby odebrać flagę CTF.',
      phone: 'Włącz zasilanie, by zapalić D1, a potem dotknij ▶, by odebrać flagę.',
      quickActionLabel: 'Włącz zasilanie',
      targetLabel: 'Dioda LED D1',
    },
  ],
  'builtin-tut-cold-joint': [
    {
      title: 'Dwuwarstwowe płytki THT',
      concept:
        'W montażu przewlekanym (THT) elementy leżą na Górze, a ich nóżki przechodzą na Spód, gdzie cyna trzyma je i tworzy styk elektryczny. Wadliwy punkt lutowniczy ("zimny lut") z góry wygląda na połączony, lecz od spodu nie przewodzi prądu.',
      task: 'Odwróć płytkę na Spód (naciśnij F lub kliknij Spód w górnym pasku), aby obejrzeć punkty lutownicze.',
      phone: 'Odwróć na Spód (przycisk u góry po prawej), by obejrzeć luty.',
      quickActionLabel: 'Odwróć na Spód (F)',
      targetLabel: 'Punkty lutownicze od spodu',
    },
    {
      title: 'Rozpoznawanie zimnego lutu',
      concept:
        'Prawidłowy punkt lutowniczy to gładki, błyszczący stożek. Zimny lut jest matowy, szary i ziarnisty, ponieważ cyna nie zwilżyła poprawnie nóżki i padu. Pomiar Ω na R1 (od R1.1 do R1.2) wykazuje OL zamiast 100 Ω!',
      task: 'Wyłącz zasilanie (P), przełącz Multimetr (2) na Ω i przyłóż sondy do R1.1 (lewy klik) i R1.2 (prawy klik) od spodu.',
      phone: 'Wyłącz zasilanie, miernik na Ω: dotknij R1.1 (czerwona), potem R1.2 (czarna).',
      quickActionLabel: 'Wyłącz zasilanie + tryb Ω',
      targetLabel: 'Zimny lut R1.1',
    },
    {
      title: 'Przelutowanie (reflow) zimnego lutu',
      concept:
        'Dotknięcie zimnego lutu grotem rozgrzanej lutownicy topi cynę, umożliwiając topnikowi usunięcie tlenków i utworzenie trwałego, błyszczącego połączenia metalurgicznego.',
      task: 'Wybierz Lutownicę (3) i kliknij pad R1.1 na pozycji 32.92, 26 mm od spodu, aby zreflować matowy lut.',
      phone: 'Lutownicą dotknij matowy pad R1.1, aby go przelutować.',
      quickActionLabel: 'Lutownica kolbowa (3)',
      targetLabel: 'Przelutuj R1.1',
    },
    {
      title: 'Włącz zasilanie i odbierz flagę',
      concept:
        'Gdy nóżka R1.1 została prawidłowo zlutowana z padem, prąd z baterii BT1 płynie bez przeszkód i zapala zieloną diodę D1.',
      task: 'Odwróć płytkę na Wierzch (F), włącz Zasilanie (P) i zobacz świecącą diodę D1, po czym kliknij Uruchom testy, by odebrać flagę.',
      phone: 'Odwróć na Wierzch, włącz zasilanie, a potem dotknij ▶.',
      quickActionLabel: 'Włącz zasilanie',
      targetLabel: 'Zielona dioda LED D1',
    },
  ],
  'builtin-tut-solder-bridge': [
    {
      title: 'Zwarcie a rozwarcie w obwodzie',
      concept:
        'W rozwartym obwodzie prąd wynosi 0.0 mA. Spójrz na Zasilacz: z baterii wypływa aż ~28 mA, a dioda D1 jest ciemna! Oznacza to zwarcie (short circuit) — prąd omija diodę D1 i ucieka bezpośrednio do Masy.',
      task: 'Odwróć płytkę na Spód (klawisz F lub kliknij Spód) i zbadaj przestrzeń między dwoma bliskimi padami diody D1.',
      phone: 'Odwróć na Spód i spójrz między dwa pady diody D1.',
      quickActionLabel: 'Odwróć na Spód (F)',
      targetLabel: 'Spodnie pady diody D1',
    },
    {
      title: 'Potwierdź zwarcie w trybie Ω',
      concept:
        'Gdy nadmiar cyny zmostkuje dwa pady, multimetr w trybie Ω wskazuje ~0.0 Ω i piszczy brzęczykiem ciągłości. Zawsze wyłączaj zasilanie przed pomiarem omomierzem!',
      task: 'Wyłącz Zasilanie (P), włącz tryb Ω w Multimetrze (2) i zbadaj pady D1.1 (lewy klik) oraz D1.2 (prawy klik) od spodu.',
      phone: 'Wyłącz zasilanie, miernik na Ω: dotknij D1.1 (czerwona), potem D1.2 (czarna).',
      quickActionLabel: 'Wyłącz zasilanie + tryb Ω',
      targetLabel: 'Zwarte pady D1',
    },
    {
      title: 'Usuń mostek cynowy plecionką',
      concept:
        'Plecionka rozlutownicza to miedziana taśma nasączona topnikiem. Przyłożona do kropli cyny z gorącym grotem wciąga stop dzięki zjawisku kapilarnemu i rozdziela pady.',
      task: 'Wybierz Plecionkę rozlutowniczą (4) w lewym doku i kliknij kroplę cyny łączącą nóżki D1 na pozycji 48, 14 mm od spodu.',
      phone: 'Plecionką dotknij kroplę cyny między nóżkami D1.',
      quickActionLabel: 'Plecionka rozlutownicza (4)',
      targetLabel: 'Mostek cynowy na D1',
    },
    {
      title: 'Włącz zasilanie i odbierz flagę',
      concept:
        'Po usunięciu mostka prąd nie może już omijać diody — płynie przez strukturę półprzewodnikową LED zgodnie z projektem (~10 mA).',
      task: 'Odwróć na Wierzch (F), włącz Zasilanie (P), zobacz czerwoną diodę D1 i kliknij Uruchom testy, by odebrać flagę.',
      phone: 'Odwróć na Wierzch, włącz zasilanie, by zapalić D1, i dotknij ▶.',
      quickActionLabel: 'Włącz zasilanie',
      targetLabel: 'Czerwona dioda LED D1',
    },
  ],
  'builtin-tut-polarity': [
    {
      title: 'Elementy spolaryzowane (Biegunowość)',
      concept:
        'Rezystory działają w obie strony, lecz diody i LED to zawory jednokierunkowe: prąd płynie wyłącznie od Anody (+) do Katody (K). Ścięcie obudowy, kwadratowy pad oraz litera K na sitodruku oznaczają Katodę.',
      task: 'Narzędziem Wybierz (1) kliknij diodę LED D1 na pozycji 48, 14 mm — zauważ, że ścięta krawędź katody leży po złej stronie!',
      phone: 'Dotknij diodę D1 narzędziem Wybierz: ścięty brzeg katody jest po złej stronie.',
      quickActionLabel: 'Narzędzie Wybierz (1)',
      targetLabel: 'Orientacja diody LED D1',
    },
    {
      title: 'Test polaryzacji w trybie Diody',
      concept:
        'Przy wyłączonym zasilaniu tryb testu diody w Multimetrze podaje niewielki prąd pomiarowy z czerwonej (+) do czarnej (−) sondy. Sprawna żółta dioda LED lekko zaświeci i wskaże spadek ~2.0 V w kierunku przewodzenia, a w kierunku zaporowym wskaże OL.',
      task: 'Wyłącz Zasilanie (P), przełącz Multimetr (2) na Test diody i przyłóż sondy do D1.1 i D1.2 (zamień czerwoną z czarną!).',
      phone: 'Wyłącz zasilanie, miernik na Test diody: zbadaj D1.1 i D1.2, a potem zamień.',
      quickActionLabel: 'Wyłącz zasilanie + Test diody',
      targetLabel: 'Pomiar złącza diody D1',
    },
    {
      title: 'Obróć odwrotną diodę o 180°',
      concept:
        'Gdy element spolaryzowany został wlutowany odwrotnie, wylutowanie i obrót o 180° dopasowuje Katodę do oznaczenia K na płytce, przywracając prawidłowe przewodzenie.',
      task: 'Wybierz narzędzie Obróć o 180° (5) w lewym doku i kliknij diodę D1, aby obrócić ją we właściwą stronę.',
      phone: 'Narzędziem Obróć dotknij D1, aby obrócić ją prawidłowo.',
      quickActionLabel: 'Obróć o 180° (5)',
      targetLabel: 'Obróć D1 o 180°',
    },
    {
      title: 'Włącz zasilanie i odbierz flagę',
      concept:
        'Gdy dioda D1 jest poprawnie zorientowana od Anody (+) do Katody (K), prąd przepływa swobodnie przez strukturę półprzewodnikową.',
      task: 'Włącz Zasilanie (P), zobacz jak żółta dioda D1 świeci, po czym kliknij Uruchom testy, by odebrać flagę.',
      phone: 'Włącz zasilanie, by zapalić D1, a potem dotknij ▶.',
      quickActionLabel: 'Włącz zasilanie',
      targetLabel: 'Żółta dioda LED D1',
    },
  ],
  'builtin-tut-resistor': [
    {
      title: 'Dlaczego diody LED wymagają rezystora',
      concept:
        'Dioda LED wymusza stały spadek napięcia (~3.0 V dla niebieskiej). Podłączona wprost do szyny USB 5 V uległaby natychmiastowemu spaleniu przez lawinowy prąd. Rezystor ogranicza prąd zgodnie z Prawem Ohma: I = (Vzas − Vled) / R.',
      task: 'Kliknij rezystor R1 narzędziem Wybierz (1), aby obejrzeć jego paski barwne w prawym panelu Inspektora.',
      phone: 'Dotknij R1 narzędziem Wybierz i odczytaj kod paskowy.',
      quickActionLabel: 'Narzędzie Wybierz (1)',
      targetLabel: 'Rezystor R1',
    },
    {
      title: 'Odczytaj paski i zmierz rezystancję (Ω)',
      concept:
        'Odczyt 4 pasków w stronę paska złotego: Brązowy (1) – Czarny (0) – Żółty (×10 000) = aż 100 kΩ! Przy 100 kΩ prąd wynosi zaledwie (5 − 3) / 100 000 = 0.02 mA — zdecydowanie za mało, by zapalić diodę. Zmierz to omomierzem przy wyłączonym zasilaniu.',
      task: 'Wyłącz Zasilanie (P), przełącz Multimetr (2) na Ω i przyłóż sondy do R1.1 (lewy klik) oraz R1.2 (prawy klik).',
      phone: 'Wyłącz zasilanie, miernik na Ω: dotknij R1.1 (czerwona), potem R1.2 (czarna).',
      quickActionLabel: 'Wyłącz zasilanie + tryb Ω',
      targetLabel: 'Zmierz R1 (Ω)',
    },
    {
      title: 'Wstaw rezystor 150 Ω',
      concept:
        'Aby dać niebieskiej diodzie optymalny prąd ~12–13 mA, Prawo Ohma wskazuje R = (5 V − 3 V) / 0.013 A ≈ 150 Ω (Brązowy-Zielony-Brązowy-Złoty). Użyj Magazynu części (8), aby wymienić R1.',
      task: 'Kliknij R1 narzędziem Magazyn części (8), wpisz 150 (lub wybierz 150 Ω w szeregu E12) w Inspektorze i kliknij Zastosuj.',
      phone: 'Dotknij R1 Magazynem części, wpisz 150 w Inspektorze i dotknij Zastosuj.',
      quickActionLabel: 'Magazyn części (8)',
      targetLabel: 'Wymień R1 na 150 Ω',
    },
    {
      title: 'Włącz zasilanie i odbierz flagę',
      concept:
        'Z rezystorem R1 = 150 Ω przez niebieską diodę D1 płynie bezpieczny prąd ~12 mA, nie przekraczając jej limitu 30 mA.',
      task: 'Włącz Zasilanie (P), zobacz błękitne światło diody D1 i kliknij Uruchom testy, by odebrać flagę CTF.',
      phone: 'Włącz zasilanie, by zaświecić D1, a potem dotknij ▶.',
      quickActionLabel: 'Włącz zasilanie',
      targetLabel: 'Niebieska dioda LED D1',
    },
  ],
  'builtin-tut-divider': [
    {
      title: 'Czym jest dzielnik napięcia?',
      concept:
        'Wiele obwodów tworzy precyzyjne napięcie odniesienia na Punkcie pomiarowym (TP1). Dwa rezystory połączone szeregowo (R1 do +5V, R2 do GND) dzielą napięcie według wzoru: Vout = Vin × R2 / (R1 + R2). Zmierzmy najpierw TP1.',
      task: 'Przy włączonym Zasilaniu (P) wybierz Multimetr (2) w trybie V⎓ i kliknij lewym przyciskiem Punkt pomiarowy TP1 na pozycji 46, 19 mm.',
      phone: 'Włącz zasilanie, miernik na V⎓: dotknij punkt pomiarowy TP1.',
      quickActionLabel: 'Włącz zasilanie + tryb V⎓',
      targetLabel: 'Punkt pomiarowy TP1',
    },
    {
      title: 'Znajdź brakujący rezystor',
      concept:
        'TP1 wskazuje +5.000 V zamiast oczekiwanego +2.500 V! Spójrz na pole R2 na pozycji 28, 12 mm: pad jest pusty (nieobsadzony, DNP). Bez R2 ściągającego Vout do Masy, R1 podaje całe 5 V wprost na TP1.',
      task: 'Wybierz Magazyn części (8) i kliknij puste pole lutownicze R2 na pozycji 28, 12 mm, aby otworzyć opcje montażu.',
      phone: 'Narzędziem Magazyn części dotknij puste pole R2.',
      quickActionLabel: 'Magazyn części (8)',
      targetLabel: 'Puste pole lutownicze R2',
    },
    {
      title: 'Zamontuj rezystor 10 kΩ w polu R2',
      concept:
        'R1 ma wartość 10 kΩ (Brązowy-Czarny-Pomarańczowy). Wlutowanie identycznego rezystora 10 kΩ w miejscu R2 da Vout = 5 V × 10k / (10k + 10k) = 2.50 V — dokładnie w wymaganym przedziale [2.30 V, 2.70 V].',
      task: 'W Inspektorze dla R2 wpisz 10k (lub wybierz 10 kΩ z typoszeregu E12) i kliknij Zastosuj.',
      phone: 'W Inspektorze wpisz 10k dla R2 i dotknij Zastosuj.',
      quickActionLabel: 'Magazyn części (8)',
      targetLabel: 'Wlutuj 10 kΩ w R2',
    },
    {
      title: 'Weryfikacja 2.50 V i zdobycie flagi',
      concept:
        'Spójrz na odczyt multimetru na TP1: wskazuje dokładnie +2.500 V! Opanowałeś fundamentalne umiejętności: ścieżki, zimne luty, mostki, biegunowość, prawo Ohma i dzielniki napięcia.',
      task: 'Kliknij Uruchom testy w górnym pasku, aby potwierdzić prawidłowe napięcie V(TP1) i odblokować ostatnią flagę samouczka.',
      phone: 'Dotknij ▶, by sprawdzić V(TP1) i zdobyć ostatnią flagę samouczka.',
      quickActionLabel: 'Uruchom testy',
      targetLabel: 'TP1 = 2.50 V',
    },
  ],
};
