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
- [Prawa autorskie i licencja](#prawa-autorskie-i-licencja)

---

## Kluczowe możliwości

- **Własne foldery i kategorie**: Twórz dowolne foldery z własną nazwą, ikoną emoji oraz kolorem akcentu.
- **Błyskawiczne filtrowanie**: Kliknij pigułkę folderu na górnym pasku. Od razu zobaczysz tylko wybrane czaty.
- **Przypisywanie jednym kliknięciem**: Kliknij ikonę folderu obok rozmowy. Następnie wybierz docelową kategorię z menu.
- **Kolorowe plakietki**: Każdy przypisany czat otrzymuje czytelną etykietę z ikoną i kolorem folderu.
- **Wskaźnik w otwartym czacie**: Pigułka w nagłówku aktywnej rozmowy pokazuje jej aktualny folder.
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
2. Wskaż pobrany katalog [messenger-folders](file:///home/grz3chu/messenger-folders).
3. Zatwierdź wybór folderu.
4. Przeglądarka od razu doda ikonę Messenger Folders do paska rozszerzeń.

### Krok 5: Otwórz Messengera

Przejdź na stronę [messenger.com](https://www.messenger.com) lub [facebook.com/messages](https://www.facebook.com/messages).
Rozszerzenie automatycznie doda pasek folderów nad listą Twoich rozmów.

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

Szczegółowy przewodnik ze zrzutami i poradami znajdziesz w dokumencie [docs/INSTALL_MOBILE.md](file:///home/grz3chu/messenger-folders/docs/INSTALL_MOBILE.md).

---

## Podręcznik użytkowania krok po kroku

### 1. Tworzenie nowego folderu

Możesz utworzyć folder na dwa proste sposoby:

**Sposób A (z poziomu paska Messengera):**
1. Kliknij przycisk `+` umieszczony na końcu paska folderów.
2. Wpisz nazwę folderu w otwartym oknie.
3. Wybierz ikonę emoji z siatki.
4. Wybierz kolor z gotowej palety lub wskaż własną barwę.
5. Kliknij przycisk **Utwórz folder**.

**Sposób B (z menu wtyczki na pasku przeglądarki):**
1. Kliknij ikonę wtyczki Messenger Folders na pasku zadań przeglądarki.
2. Kliknij przycisk **+ Dodaj folder**.
3. Uzupełnij nazwę, ikonę oraz kolor.
4. Kliknij przycisk **Zapisz**.

### 2. Przypisywanie rozmowy do folderu

1. Najedź kursorem myszy na wybrany czat na liście rozmów.
2. Kliknij małą ikonę folderu, która pojawi się z prawej strony wiersza.
3. Wyszukaj lub wybierz odpowiedni folder z listy rozwijanej.
4. Wtyczka natychmiast przypisze rozmowę i wyświetli kolorową plakietkę.

Możesz także przypisać otwarty czat:
1. Spójrz na nagłówek otwartej konwersacji u góry ekranu.
2. Kliknij pigułkę z napisem **Dodaj folder** lub nazwą bieżącego folderu.
3. Wybierz nową kategorię z menu.

### 3. Filtrowanie i przeglądanie wiadomości

1. Kliknij dowolną pigułkę folderu na górnym pasku (np. **Praca** lub **Ważne**).
2. Lista rozmów natychmiast ukryje pozostałe czaty i pokaże tylko pasujące pozycje.
3. Aby powrócić do pełnej listy, kliknij pierwszy folder **Wszystkie**.

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
│   ├── ui.js                  # Pasek folderów, plakietki, menu i okna modalne
│   ├── content.js             # Główny skrypt integrujący moduły na stronie
│   └── content.css            # Style interfejsu z obsługą motywu jasnego i ciemnego
├── popup/
│   ├── popup.html             # Okno podręczne rozszerzenia
│   ├── popup.css              # Style okna podręcznego
│   └── popup.js               # Logika zarządzania folderami i kopią zapasową
├── icons/                     # Ikony rozszerzenia w różnych formatach
├── tests/
│   └── test_storage_detector.js # Zestaw automatycznych testów jednostkowych
└── docs/
    ├── INSTALL_MOBILE.md      # Instrukcja uruchomienia na smartfonie
    └── ARCHITECTURE.md        # Szczegółowa dokumentacja techniczna
```

Szczegółowy opis architektury, przepływu danych i mechanizmu odporności na zmiany CSS znajdziesz w dokumencie [docs/ARCHITECTURE.md](file:///home/grz3chu/messenger-folders/docs/ARCHITECTURE.md).

---

## Prawa autorskie i licencja

Projekt Messenger Folders jest oprogramowaniem open-source.
Kod źródłowy udostępniamy na warunkach otwartej licencji [MIT](file:///home/grz3chu/messenger-folders/LICENSE).

Copyright (c) 2026 Filip Stankiewicz.
Możesz swobodnie używać, modyfikować i rozpowszechniać ten projekt zgodnie z licencją MIT.
