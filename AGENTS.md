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
npm run board            # tablica Kanban
python3 scripts/kanban/kanban.py next <model>        # moje następne zadanie
python3 scripts/kanban/kanban.py move MF-001 in-progress
python3 scripts/kanban/kanban.py check               # walidacja wszystkich kart
```

Ręczny test w przeglądarce: `chrome://extensions` → Tryb dewelopera → Załaduj rozpakowane → ten
katalog → po każdej zmianie przycisk ↻ przy rozszerzeniu i odświeżenie karty Messengera.

## Proces pracy (skrót — pełny opis: `docs/agents/WORKFLOW.md`)

Tablica to pliki `kanban/tasks/MF-XXX.md`. Kolumny: `backlog → ready → in-progress → review → done`.
Przesuwaj **tylko** przez `python3 scripts/kanban/kanban.py move` — skrypt pilnuje bramek.

1. Weź zadanie: `python3 scripts/kanban/kanban.py next <twój-model>`. Pracuj **tylko** nad zadaniami ze swoim
   `model:`. Nie bierz zadań z `backlog` — nie spełniają DoR.
2. `move <ID> in-progress`, utwórz gałąź `mf-XXX-...`.
3. Zmieniaj **tylko pliki z sekcji Pliki**. Potrzebujesz innego pliku → dopisz to w Logu, cofnij
   zadanie do `ready` i zatrzymaj się.
4. Odhacz kryteria akceptacji, wypełnij sekcję **Dowód** (wynik `npm run verify`, opis weryfikacji).
5. `move <ID> review`. **Nie przenoś własnego zadania do `done`** — robi to reviewer (inny model
   lub człowiek), który odhacza DoD i wpisuje się w `reviewer:`.
6. Coś niejasnego? Dopisz pytanie w Logu karty, zostaw zadanie w obecnej kolumnie, zakończ.

Identyfikatory modeli w kartach: `claude`, `gemini` (Antigravity), `deepseek`, `human`.
