# Poradnik instalacji Messenger Folders na smartfonie (Android)

> Zainstaluj i uruchom wtyczkę Messenger Folders na swoim telefonie z systemem Android.

Standardowa aplikacja mobilna Google Chrome nie pozwala na instalowanie rozszerzeń.
Możesz jednak skorzystać z bezpłatnej przeglądarki **Kiwi Browser**.
Kiwi Browser bazuje na silniku Chromium i w pełni obsługuje wtyczki do przeglądarek.
Dzięki temu uporządkujesz swoje wiadomości w foldery również na smartfonie lub tablecie.

---

## Spis treści

- [Wymagania wstępne](#wymagania-wstępne)
- [Instrukcja instalacji krok po kroku](#instrukcja-instalacji-krok-po-kroku)
  - [Krok 1: Zainstaluj Kiwi Browser](#krok-1-zainstaluj-kiwi-browser)
  - [Krok 2: Pobierz pliki wtyczki](#krok-2-pobierz-pliki-wtyczki)
  - [Krok 3: Otwórz stronę rozszerzeń w Kiwi](#krok-3-otwórz-stronę-rozszerzeń-w-kiwi)
  - [Krok 4: Włącz tryb dewelopera](#krok-4-włącz-tryb-dewelopera)
  - [Krok 5: Wgraj rozszerzenie do przeglądarki](#krok-5-wgraj-rozszerzenie-do-przeglądarki)
  - [Krok 6: Otwórz Messengera w widoku komputerowym](#krok-6-otwórz-messengera-w-widoku-komputerowym)
  - [Krok 7: Zarządzaj folderami na telefonie](#krok-7-zarządzaj-folderami-na-telefonie)
- [Przydatne wskazówki na ekranie telefonu](#przydatne-wskazówki-na-ekranie-telefonu)
- [Rozwiązywanie problemów (Troubleshooting)](#rozwiązywanie-problemów-troubleshooting)

---

## Wymagania wstępne

Zanim zaczniesz, przygotuj:
- Smartfon lub tablet z systemem Android w wersji 7.0 lub nowszej.
- Dostęp do sklepu Google Play oraz aktywne połączenie z internetem.
- Około 50 MB wolnego miejsca w pamięci urządzenia.

---

## Instrukcja instalacji krok po kroku

### Krok 1: Zainstaluj Kiwi Browser

1. Otwórz sklep **Google Play** na swoim urządzeniu.
2. Wpisz w wyszukiwarce frazę `Kiwi Browser`.
3. Dotknij przycisku **Zainstaluj**.
4. Po ukończeniu pobierania otwórz przeglądarkę Kiwi.

### Krok 2: Pobierz pliki wtyczki

1. Otwórz w Kiwi Browser stronę repozytorium GitHub:  
   `https://github.com/r0D7ynki/messenger-folders`
2. Dotknij zielonego przycisku **Code**.
3. Wybierz opcję **Download ZIP**.
4. Przeglądarka zapisze plik archiwum w katalogu `Pobrane` (Downloads) Twojego telefonu.

> [!TIP]
> Możesz także rozpakować plik ZIP dowolnym menedżerem plików w telefonie.
> Rozpakowany katalog zawiera plik [manifest.json](file:///home/grz3chu/messenger-folders/manifest.json) oraz kod źródłowy.

### Krok 3: Otwórz stronę rozszerzeń w Kiwi

1. Dotknij ikony menu z trzema pionowymi kropkami w prawym górnym rogu Kiwi Browser.
2. Wybierz z menu pozycję **Rozszerzenia** (Extensions).
3. Możesz też wpisać adres `kiwi://extensions` bezpośrednio w pasku adresu i zatwierdzić.

### Krok 4: Włącz tryb dewelopera

1. Spójrz w prawy górny róg otwartej karty rozszerzeń.
2. Znajdź przełącznik **Developer mode** (Tryb programisty).
3. Przesuń suwak w prawo, aby aktywować tryb.
4. Na ekranie pojawią się dodatkowe przyciski techniczne.

### Krok 5: Wgraj rozszerzenie do przeglądarki

1. Dotknij przycisku **+(from .zip/.crx/.user.js)** na górnym pasku.
2. Otwórz menedżer plików systemowych Androida.
3. Wskaż pobrany wcześniej plik `messenger-folders.zip` lub rozpakowany katalog.
4. Kiwi Browser natychmiast zainstaluje wtyczkę.
5. Na liście rozszerzeń zobaczysz kafelek **Messenger Folders**.
6. Sprawdź, czy niebieski przełącznik przy kafelku pozostaje aktywny.

### Krok 6: Otwórz Messengera w widoku komputerowym

To najważniejszy krok całej konfiguracji.
Messenger w widoku mobilnym wymusza instalację aplikacji i ukrywa elementy interfejsu.
Wtyczka potrzebuje pełnego widoku komputerowego do wstrzyknięcia paska folderów.

1. Wpisz w pasku adresu adres `https://www.messenger.com` i przejdź na stronę.
2. Dotknij ikony menu z trzema kropkami w prawym górnym rogu Kiwi Browser.
3. Zaznacz pole wyboru **Wersja na komputer** (Desktop site).
4. Przeglądarka przeładuje stronę w trybie pełnego ekranu komputera.
5. Zaloguj się na swoje konto na Facebooku lub Messengerze.

> [!IMPORTANT]
> Zawsze włączaj opcję **Wersja na komputer**.
> Bez tej opcji strona mobilna nie załaduje elementów potrzebnych do działania wtyczki.

### Krok 7: Zarządzaj folderami na telefonie

1. Spójrz na lewą stronę ekranu nad listą ostatnich wiadomości.
2. Zobaczysz tam poziomy pasek z pigułkami folderów.
3. Przesuwaj pasek palcem w lewo i prawo, aby przeglądać foldery.
4. Dotknij wybranego folderu, aby od razu wyświetlić przypisane do niego rozmowy.
5. Aby otworzyć panel konfiguracji, dotknij menu Kiwi (trzy kropki) i wybierz **Messenger Folders** na samym dole menu.

---

## Przydatne wskazówki na ekranie telefonu

- **Dodaj skrót do ekranu głównego**:
  Dotknij menu z trzema kropkami w Kiwi Browser i wybierz **Dodaj do ekranu głównego**.
  Utworzysz bezpośrednią ikonę, która uruchamia Messengera z Twoimi folderami jak zwykłą aplikację.
- **Obróć telefon poziomo (tryb horyzontalny)**:
  W widoku poziomym zyskujesz znacznie więcej miejsca na listę czatów i otwarte okno rozmowy.
- **Dopasuj powiększenie strony**:
  Jeśli tekst jest za mały, dotknij menu Kiwi, wybierz **Ustawienia** -> **Dostępność** i dopasuj skalowanie tekstu.

---

## Rozwiązywanie problemów (Troubleshooting)

### Problem 1: Nie widzę paska folderów nad listą rozmów

**Przyczyna**: Strona uruchomiła się w widoku mobilnym albo drzewo strony jeszcze się ładuje.  
**Rozwiązanie**:
1. Dotknij menu z trzema kropkami w Kiwi Browser.
2. Sprawdź, czy opcja **Wersja na komputer** ma zaznaczony ptaszek.
3. Jeśli nie, zaznacz tę opcję i odśwież stronę.
4. Poczekaj 2–3 sekundy na załadowanie elementów przez wtyczkę.

### Problem 2: Strona przekierowuje do sklepu Google Play lub aplikacji mobilnej

**Przyczyna**: System Android próbuje przechwycić link i otworzyć oficjalną aplikację Messenger.  
**Rozwiązanie**:
1. Wpisz w pasku adresu dokładny adres `https://www.messenger.com/login`.
2. Zanim zatwierdzisz adres, upewnij się, że nowa karta ma już zaznaczoną opcję **Wersja na komputer**.
3. W ustawieniach telefonu (Aplikacje -> Messenger -> Otwieraj domyślnie) wyłącz automatyczne otwieranie linków w aplikacji.

### Problem 3: Rozszerzenie nie chce wgrać się z pliku ZIP

**Przyczyna**: Niektóre menedżery plików w Androidzie blokują przesyłanie archiwów do przeglądarki.  
**Rozwiązanie**:
1. Zainstaluj darmowy menedżer plików (np. Google Files lub Total Commander).
2. Rozpakuj plik ZIP do wybranego katalogu w pamięci telefonu.
3. W Kiwi Browser otwórz `kiwi://extensions` i użyj opcji wczytania rozpakowanego katalogu.

### Problem 4: Przy każdym uruchomieniu muszę ponownie włączać wersję na komputer

**Przyczyna**: Kiwi domyślnie otwiera nowe karty w trybie mobilnym.  
**Rozwiązanie**:
1. Otwórz menu Kiwi (trzy kropki) -> **Ustawienia** (Settings).
2. Przejdź do sekcji **Ustawienia witryn** (Site settings).
3. Znajdź pozycję **Wersja na komputer** (Desktop site).
4. Dodaj wyjątek dla domeny `messenger.com` lub włącz tę opcję na stałe.

### Problem 5: Kopia zapasowa JSON nie chce się zaimportować

**Przyczyna**: Przeglądarka nie ma uprawnień do odczytu plików w pamięci urządzenia.  
**Rozwiązanie**:
1. Otwórz ustawienia systemowe telefonu -> **Aplikacje** -> **Kiwi Browser** -> **Uprawnienia**.
2. Przyznaj przeglądarce uprawnienie **Pamięć** lub **Pliki i multimedia**.
3. Otwórz ponownie panel wtyczki i wskaż poprawny plik kopii z rozszerzeniem `.json`.
