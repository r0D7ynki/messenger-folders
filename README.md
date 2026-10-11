# Messenger Folders

> Porządkuj rozmowy na Messengerze w przejrzyste, kolorowe foldery.

Messenger Folders to bezpłatne rozszerzenie do przeglądarek internetowych.
Narzędzie pomaga zapanować nad chaosem w wiadomościach na stronach [messenger.com](https://www.messenger.com) oraz [facebook.com/messages](https://www.facebook.com/messages).
Twórz własne kategorie, przypisuj czaty jednym kliknięciem i szybko filtruj ważne wiadomości.

Wtyczka działa w pełni lokalnie w Twojej przeglądarce.
Nie wysyła żadnych danych na zewnętrzne serwery.
Szanuje Twoją prywatność i chroni historię rozmów.

---

## Spis treści

- [Kluczowe możliwości](#kluczowe-możliwości)
- [Instalacja na komputerze](#instalacja-na-komputerze)
- [Instalacja na telefonie](#instalacja-na-telefonie)
- [Podręcznik użytkowania krok po kroku](#podręcznik-użytkowania-krok-po-kroku)
- [Prywatność i bezpieczeństwo](#prywatność-i-bezpieczeństwo)
- [Architektura techniczna](#architektura-techniczna)
- [Rozwój i współpraca](#rozwój-i-współpraca)
- [Prawa autorskie i licencja](#prawa-autorskie-i-licencja)

---

## Kluczowe możliwości

- **Własne foldery i kategorie**: Twórz dowolne foldery z własną nazwą, ikoną emoji oraz kolorem akcentu.
- **Wyszukiwarka folderów**: Szukaj folderów w czasie rzeczywistym dzięki wygodnemu polu wyszukiwania nad paskiem.
- **Błyskawiczne filtrowanie**: Kliknij pigułkę folderu na pasku. Od razu zobaczysz tylko wybrane czaty.
- **Dedykowane centrum ustawień**: Otwieraj okno zarządzania folderami przyciskiem przypiętym obok wyszukiwarki.
- **Czysty widok czatów**: Lista wiadomości pozostaje uporządkowana i czytelna bez zbędnych etykiet.
- **Wskaźnik w otwartym czacie**: Pigułka w nagłówku aktywnej rozmowy pokazuje jej aktualny folder.
- **Reguły automatycznego przypisywania**: Nowe rozmowy same trafiają do folderów według nazwy czatu lub identyfikatora wątku.
- **Kopia zapasowa JSON**: Eksportuj całą konfigurację do pliku. Bez trudu przenieś dane na inny komputer.
- **Wsparcie dla trybu ciemnego**: Interfejs automatycznie dopasowuje kolory do jasnego i ciemnego motywu Messengera.
- **Pełna zgodność z Manifest V3**: Rozszerzenie wykorzystuje najnowszy standard bezpieczeństwa i wydajności Chrome.

---

## Instalacja na komputerze

Rozszerzenie działa we wszystkich nowoczesnych przeglądarkach opartych na silniku Chromium:
Google Chrome, Brave, Microsoft Edge, Opera oraz Vivaldi.

### Krok 1: Pobierz pliki rozszerzenia

Sklonuj repozytorium na swój dysk za pomocą gita:

```bash
git clone https://github.com/r0D7ynki/messenger-folders.git
```

Możesz także pobrać archiwum ZIP ze strony repozytorium i rozpakować je w wybranym folderze.

### Krok 2: Otwórz stronę zarządzania rozszerzeniami

Wpisz odpowiedni adres w pasku przeglądarki i naciśnij klawisz Enter:

- **Google Chrome**: `chrome://extensions`
- **Brave Browser**: `brave://extensions`
- **Microsoft Edge**: `edge://extensions`
- **Opera**: `opera://extensions`

### Krok 3: Włącz tryb dewelopera

Znajdź przełącznik **Tryb dewelopera** (Developer mode) w prawym górnym rogu strony.
Przesuń suwak w pozycję aktywną.

### Krok 4: Wczytaj rozszerzenie

1. Kliknij przycisk **Załaduj rozpakowane** (Load unpacked) w lewym górnym rogu.
2. Wskaż pobrany katalog [messenger-folders](./).
3. Zatwierdź wybór folderu.
4. Przeglądarka od razu doda ikonę Messenger Folders do paska rozszerzeń.

### Krok 5: Otwórz Messengera

Przejdź na stronę [messenger.com](https://www.messenger.com) lub [facebook.com/messages](https://www.facebook.com/messages).
Rozszerzenie automatycznie doda pasek folderów bezpośrednio pod polem wyszukiwarki, na samej górze listy rozmów.

> [!TIP]
> Przypnij ikonę rozszerzenia na pasku przeglądarki.
> Kliknij ikonę puzzla obok paska adresu, a potem kliknij symbol pinezki przy Messenger Folders.

---

## Instalacja na telefonie

Możesz używać wtyczki także na smartfonie z systemem Android.
Wymaga to przeglądarki z obsługą rozszerzeń Chrome, na przykład **Kiwi Browser**.

Skrócona instrukcja:
1. Zainstaluj **Kiwi Browser** ze sklepu Google Play.
2. Otwórz stronę `kiwi://extensions` i włącz **Developer mode**.
3. Kliknij `+(from .zip/.crx/.user.js)` i wskaż pobrane archiwum wtyczki.
4. Otwórz stronę `messenger.com`.
5. Włącz opcję **Wersja na komputer** (Desktop site) w menu przeglądarki.

Szczegółowy przewodnik ze zrzutami i poradami znajdziesz w dokumencie [docs/INSTALL_MOBILE.md](docs/INSTALL_MOBILE.md).

---

## Podręcznik użytkowania krok po kroku

### 1. Tworzenie i zarządzanie folderami

Możesz zarządzać folderami na trzy wygodne sposoby:

**Sposób A (okno ustawień z poziomu paska Messengera):**
1. Kliknij przycisk zębatki `⚙️` na pasku folderów.
2. W otwartym oknie możesz przeglądać foldery, edytować je, usuwać oraz dodawać nowe.
3. W zakładce **Kopia zapasowa** możesz wyeksportować i zaimportować dane w formacie JSON.

**Sposób B (szybkie dodawanie z paska Messengera):**
1. Kliknij przycisk `+` umieszczony na końcu paska folderów.
2. Wpisz nazwę folderu w oknie dialogowym.
3. Wybierz ikonę emoji z siatki.
4. Wybierz kolor z gotowej palety lub wskaż własną barwę.
5. Kliknij przycisk **Utwórz folder**.

**Sposób C (z menu wtyczki na pasku przeglądarki):**
1. Kliknij ikonę wtyczki Messenger Folders na pasku zadań przeglądarki.
2. Kliknij przycisk **+ Nowy folder**.
3. Uzupełnij nazwę, ikonę oraz kolor.
4. Kliknij przycisk **Zapisz**.

### 2. Przypisywanie rozmowy do folderu

Rozmowę możesz przypisać na trzy proste sposoby:

1. **Menu pod prawym przyciskiem myszy**:
   - Kliknij prawym przyciskiem myszy na wiersz wybranej rozmowy.
   - Wybierz docelowy folder z menu.

2. **Pigułka w nagłówku aktywnego czatu**:
   - Otwórz wybraną rozmowę.
   - Kliknij pigułkę folderu w nagłówku u góry ekranu.
   - Wybierz nową kategorię.

3. **Zakładka „Rozmowy” w oknie ustawień**:
   - Kliknij ikonę ustawień `⚙️` obok pola wyszukiwarki folderów.
   - Przejdź do zakładki **💬 Rozmowy**.
   - Wybierz folder z listy rozwijanej obok nazwy wybranego czatu.

### 3. Filtrowanie i wyszukiwanie folderów

1. Wpisz nazwę w polu **Szukaj folderu...** nad paskiem, aby szybko odnaleźć poszukiwaną kategorię.
2. Kliknij dowolną pigułkę folderu na pasku (np. **Praca** lub **Ważne**).
3. Lista rozmów natychmiast ukryje pozostałe czaty i pokaże tylko pasujące pozycje.
4. Aby powrócić do pełnej listy wiadomości, kliknij folder **Wszystkie**.

### 4. Edycja i usuwanie folderu

1. Najedź kursorem na pigułkę folderu na pasku.
2. Kliknij małą ikonę ołówka obok nazwy folderu (lub kliknij prawym przyciskiem myszy).
3. Zmień nazwę, ikonę lub kolor w oknie edycji.
4. Jeśli chcesz usunąć folder, kliknij czerwony przycisk **Usuń**.
5. Wtyczka usunie kategorię, a przypisane czaty przeniesie bezpiecznie do folderu **Inne**.

### 5. Eksport i import kopii zapasowej

1. Kliknij ikonę rozszerzenia na pasku przeglądarki.
2. Przejdź do sekcji **Kopia zapasowa danych**.
3. Kliknij **Eksportuj do pliku**, aby pobrać plik `.json` z całą konfiguracją.
4. Na nowym urządzeniu kliknij **Importuj z pliku** i wskaż pobrany wcześniej plik.
5. Wtyczka natychmiast odtworzy Twoje foldery i wszystkie przypisania.

Kopia zapasowa nie obejmuje reguł automatycznego przypisywania. Po przeniesieniu danych na nowe
urządzenie utwórz reguły ponownie.

### 6. Reguły automatycznego przypisywania

Reguła sama przypisuje rozmowę do folderu, gdy nazwa czatu lub identyfikator wątku spełnia
podane warunki. Wtyczka sprawdza reguły przy otwarciu Messengera, podczas przewijania listy czatów
i po każdej zmianie reguł.

**Jak dodać regułę:**
1. Kliknij przycisk zębatki `⚙️` na pasku folderów.
2. Przejdź do zakładki **⚡ Reguły** i kliknij **Nowa reguła**.
3. Wpisz nazwę reguły i wybierz **Folder docelowy**.
4. Ustaw **Priorytet** i tryb dopasowania: wszystkie warunki muszą pasować albo wystarczy jeden.
5. Dodaj warunki. Każdy warunek ma pole (**Nazwa czatu** albo **ID wątku**), operator i wartość.
6. Sprawdź licznik **Liczba pasujących czatów** pod formularzem.
7. Kliknij **Zapisz regułę**.

Na liście reguł możesz regułę włączyć lub wyłączyć przełącznikiem, edytować ołówkiem albo usunąć.

**Operatory:**

| Operator | Znaczenie |
| :--- | :--- |
| Zawiera | Tekst zawiera wartość. Kilka wartości po przecinku oznacza „którakolwiek z nich”, np. `projekt, budowa`. |
| Zaczyna się od | Tekst zaczyna się od wartości. |
| Kończy się na | Tekst kończy się na wartości. |
| Dokładne | Tekst jest identyczny z wartością. |
| Wyrażenie (RegEx) | Tekst pasuje do wyrażenia regularnego, np. `^Zespół \d+$`. |

Wielkość liter nie ma znaczenia. W operatorach innych niż RegEx wtyczka pomija spacje na początku
i końcu wartości.

**Priorytet:** każda rozmowa trafia do folderu pierwszej pasującej reguły. Wtyczka sprawdza reguły
od najniższego priorytetu, więc reguła z priorytetem `0` wygrywa z regułą z priorytetem `5`.
Domyślny priorytet to `10`.

**Ręczne przypisania:** reguła domyślnie pomija rozmowy, które są już w folderze innym niż
**Inne**. Zaznacz **Nadpisuj wcześniejsze ręczne przypisania**, jeśli reguła ma przenosić także
takie rozmowy. Usunięcie lub wyłączenie reguły nie cofa przypisań, które już wykonała.

**Wyrażenia regularne i ich ograniczenia:**
- Wtyczka odrzuca wzorce dłuższe niż 250 znaków.
- Wtyczka odrzuca wzorce z zagnieżdżonymi powtórzeniami, np. `(a+)+` albo `(\d*)*`. Takie wzorce
  mogą zawiesić kartę przeglądarki.
- Odrzucony albo niepoprawny wzorzec nie zgłasza błędu. Nie pasuje wtedy do żadnej rozmowy.
  Licznik **Liczba pasujących czatów** pokaże `0`.
- Używaj prostych wzorców i unikaj powtórzeń grup z alternatywą, np. `(a|ab)*`.

---

## Prywatność i bezpieczeństwo

Projekt szanuje Twoją prywatność:
- Wszystkie foldery i przypisania czatów trafiają do pamięci podręcznej przeglądarki (`chrome.storage.local`).
- Wtyczka nie korzysta z żadnego zdalnego serwera ani bazy danych.
- Kod nie wysyła telemetrii, statystyk ani danych analitycznych.
- Wtyczka nie modyfikuje treści Twoich wiadomości tekstowych ani załączników.

---

## Architektura techniczna

Struktura plików projektu:

```text
messenger-folders/
├── manifest.json              # Konfiguracja wtyczki w standardzie Manifest V3
├── background/
│   └── background.js          # Skrypt tła zarządzający cyklem życia wtyczki
├── src/
│   ├── storage.js             # Pamięć lokalna i synchronizacja danych
│   ├── detector.js            # Wykrywanie elementów DOM i odporność na zmiany klas
│   ├── rules.js               # Silnik reguł automatycznego przypisywania
│   ├── ui.js                  # Fasada interfejsu łącząca moduły z katalogu ui/
│   ├── ui/
│   │   ├── core.js            # Stałe, ikony SVG, bezpieczny DOM i powiadomienia
│   │   ├── folder-bar.js      # Pasek folderów z wyszukiwarką i licznikami
│   │   ├── folder-modal.js    # Okno tworzenia i edycji folderu
│   │   ├── thread-menu.js     # Menu przypisania, plakietki i pigułka w nagłówku
│   │   └── settings-modal.js  # Okno ustawień z zakładkami i edytorem reguł
│   ├── content.js             # Główny skrypt integrujący moduły na stronie
│   └── content.css            # Style interfejsu z obsługą motywu jasnego i ciemnego
├── popup/
│   ├── popup.html             # Okno podręczne rozszerzenia
│   ├── popup.css              # Style okna podręcznego
│   └── popup.js               # Logika zarządzania folderami i kopią zapasową
├── icons/                     # Ikony rozszerzenia w różnych formatach
├── tests/
│   ├── test_storage_detector.js # Testy pamięci, detektora i koordynatora
│   ├── test_ui.js             # Testy warstwy interfejsu
│   ├── test_rules.js          # Testy silnika reguł
│   ├── fixtures/              # Statyczna kopia DOM Messengera dla testów E2E
│   └── e2e/                   # Testy E2E Playwright
└── docs/
    ├── INSTALL_MOBILE.md      # Instrukcja uruchomienia na smartfonie
    └── ARCHITECTURE.md        # Szczegółowa dokumentacja techniczna
```

Szczegółowy opis architektury, przepływu danych i mechanizmu odporności na zmiany CSS znajdziesz w dokumencie [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Rozwój i współpraca

Chcesz pomóc? Zacznij od [CONTRIBUTING.md](CONTRIBUTING.md): przygotowanie środowiska (`npm install`,
`npm run verify`), zgłaszanie błędów i zasady pull requestów.
Repozytorium jest przygotowane do pracy z agentami AI — zasady dla nich opisuje [AGENTS.md](AGENTS.md).

---

## Prawa autorskie i licencja

Projekt Messenger Folders jest oprogramowaniem open-source.
Kod źródłowy udostępniamy na warunkach otwartej licencji [MIT](LICENSE).

Copyright (c) 2026 Filip Stankiewicz.
Możesz swobodnie używać, modyfikować i rozpowszechniać ten projekt zgodnie z licencją MIT.
