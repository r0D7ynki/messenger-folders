# AGENTS — jak pracować w messenger-folders

Jedno źródło zasad dla **wszystkich agentów** (Claude Code, Antigravity/Gemini, DeepSeek przez
opencode/aider/Cline, Codex) i ludzi. Pliki `CLAUDE.md`, `.agent/rules/`, `.aider.conf.yml`
tylko tu odsyłają — **zmieniaj zasady wyłącznie w tym pliku**.

## Produkt w trzech zdaniach

Rozszerzenie Chromium (Manifest V3) dodające foldery do messenger.com i facebook.com/messages.
Działa w 100% lokalnie (`chrome.storage.local`), bez sieci i bez zależności npm w runtime.
Content script wstrzykuje UI w DOM Messengera, którego klasy CSS są losowe i często się zmieniają.

## Mapa kodu

| Plik | Rola |
|---|---|
| `src/storage.js` | dane: foldery, przypisania wątków, import/eksport JSON |
| `src/detector.js` | odnajdywanie wierszy czatów i punktów wstrzyknięcia w DOM Messengera |
| `src/ui.js` | pasek folderów, modale, dropdowny (największy plik — ~1900 linii) |
| `src/content.js` | koordynator: łączy storage, detector i UI, obserwuje DOM i URL |
| `background/background.js` | inicjalizacja danych przy instalacji |
| `popup/` | okno rozszerzenia: zarządzanie folderami, kopia zapasowa |
| `tests/` | testy jednostkowe w czystym Node z ręcznymi mockami DOM |

Szczegóły: `docs/ARCHITECTURE.md`.

## Twarde zasady

1. **Zero sieci.** Żadnych `fetch`, XHR, WebSocket, zewnętrznych skryptów, fontów ani analityki.
2. **Zero nowych uprawnień** w `manifest.json` i **zero zależności runtime** bez wpisu w
   `docs/agents/DECYZJE.md` zaakceptowanego przez człowieka.
3. **Bezpieczny DOM.** Nazwy folderów, ikony, kolory, nazwy rozmów i wszystko z importu JSON to dane
   niezaufane: do DOM przez `textContent` / `setAttribute` / `_escapeHtml`. `innerHTML` tylko dla
   stałych szablonów i ikon z `ICONS`. Kolor walidowany jako `#RRGGBB`.
4. **Nie zakładaj klas CSS Messengera.** Detekcja przez role ARIA, atrybuty, strukturę i linki
   `/t/<id>` — tak jak w `src/detector.js`.
5. **Kod i komentarze po polsku**, JSDoc nad metodami publicznymi. Format pilnuje Prettier
   (`.prettierrc.json`) — nie formatuj ręcznie i nie zmieniaj jego konfiguracji w zadaniach.
6. **Testy offline** w `tests/`, bez przeglądarki i bez sieci.
   **Nie dopisuj wyjątków** do `eslint-suppressions.json` — popraw kod. Po naprawie starego
   miejsca: `npx eslint . --prune-suppressions`.
7. **Gałęzie i pull requesty.** Praca na gałęziach `mf-XXX-krotki-opis` od `master`, zmiany
   trafiają przez pull request. Agent nigdy nie pushuje do `master` i nie scala — robi to opiekun
   repozytorium. Kontrybutorzy zewnętrzni pracują na forku.

## Komendy

```bash
npm run verify           # WSZYSTKO: składnia, manifest, format, ESLint, testy, karty — to samo co CI
npm test                 # testy jednostkowe
npm run check            # składnia wszystkich JS + poprawność manifest.json
npm run lint             # ESLint z no-unsanitized (bezpieczny DOM)
npm run format           # Prettier — formatuj TYLKO pliki, które zmieniasz w zadaniu
npm run board            # tablica Kanban (z swarmboard: `sb board`)
python3 scripts/kanban/kanban.py next <model> --start   # weź kartę: gałąź + in-progress (DoR + WIP)
python3 scripts/kanban/kanban.py submit MF-001          # oddaj: kryteria + Dowód + bramka → review
python3 scripts/kanban/kanban.py check                  # walidacja wszystkich kart
# --json przy board/check/next/submit; kody wyjścia: 0 ok, 1 bramka/walidacja, 2 użycie, 3 brak karty
```

Ręczny test w przeglądarce: `chrome://extensions` → Tryb dewelopera → Załaduj rozpakowane → ten
katalog → po każdej zmianie przycisk ↻ przy rozszerzeniu i odświeżenie karty Messengera.

## Proces pracy (Kanban) — pełny opis: `docs/agents/WORKFLOW.md`

Karty: `kanban/tasks/MF-XXX.md`. Kolumny: `backlog → ready → in-progress → review → done`.
Przesuwaj **tylko** przez `scripts/kanban/kanban.py` (`next --start`, `submit`, `move`) — skrypt
pilnuje bramek (DoR, WIP, kryteria + Dowód, DoD + bramka). **Nie edytuj ręcznie `status:`** w
nagłówku karty — każde przejście ma wpis w Logu.

1. Weź kartę: `python3 scripts/kanban/kanban.py next <twój-model> --start` — tworzy gałąź
   `<id>-<tytuł>` (od `master` albo gałęzi niescalonej zależności) i przesuwa kartę do
   `in-progress` przez bramkę. Pracuj tylko nad kartami ze swoim `model:`; nie bierz kart z `backlog`.
2. Drzewo robocze musi być czyste przed startem (start odmawia przy niezacommitowanych zmianach).
3. Zmieniaj **tylko pliki z sekcji Pliki**. Potrzebny inny plik → wpis w Logu, karta z powrotem do
   `ready`, stop.
4. Odhacz kryteria, wypełnij **Dowód** realnym wyjściem komend i kodem wyjścia bramki:
   `npm run verify > /tmp/verify.log 2>&1; echo "exit=$?"` + ostatnie linie logu.
5. Zacommituj pracę (tytuł z ID karty, np. `MF-012: …`, trailer agenta `Co-Authored-By: …`), potem
   `python3 scripts/kanban/kanban.py submit <ID>` — bramka projektu musi przejść, inaczej karta
   zostaje w `in-progress` z ostatnimi liniami wyjścia.
6. **Nie przenoś własnej karty do `done`.** Robi to reviewer — inny model albo człowiek niż
   **faktyczny wykonawca** (nie tylko inny niż pole `model:`). Reviewer odhacza DoD, wpisuje się
   w `reviewer:` i zostawia w Logu wpis z przeglądem.
7. **Po `done` karta jest zamknięta** — żadnych commitów ani wpisów pracy. Poprawki = nowa karta
   z odwołaniem do starej. Kart `done` nie usuwaj z tablicy.
8. Niejasność → pytanie w Logu karty, karta zostaje, koniec przebiegu.

**Limit subskrypcji** (szczegóły: `docs/agents/WORKFLOW.md`, „Oszczędzanie limitu”): jedna karta =
jeden wykonawca + jeden niezależny przegląd; bez cronów i heartbeatów; wyczerpana kwota → wpis w Logu
karty i stop; nowa sesja agenta na każdą kartę; eksploracja repo tylko dla kart `L`.

Identyfikatory modeli w kartach: `claude`, `gemini` (Antigravity), `deepseek`, `human`.
