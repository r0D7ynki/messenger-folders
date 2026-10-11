# TEST_READY: Messenger Folders Test Suite & Harness

**Data wygenerowania:** 2026-10-10  
**Status zestawu testowego:** GOTOWY (100% testów przechodzi, bramka jakości zielona)  
**Karta Kanban:** `MF-006` (Milestone `M_E2E`)

---

## 1. Architektura Testów i Środowisko Uruchomieniowe

Projekt **Messenger Folders** posiada dwupoziomowy system testów automatycznych:
1. **Testy jednostkowe i integracyjne modułów logicznych** (Node.js test runner)
2. **Testy End-to-End (E2E) w przeglądarce Chromium** (@playwright/test runner)

Wszystkie testy działają w **100% lokalnie i w trybie offline**, bez wysyłania jakichkolwiek zapytań do zewnętrznej sieci (zgodnie z `AGENTS.md` oraz specyfikacją `TEST_INFRA.md`).

---

## 2. Podsumowanie Poziomów Testów (Test Tiers) i Liczby Przypadków

| Poziom / Tier | Opis i Zakres | Narzędzie | Pliki testowe | Liczba testów | Status |
|---|---|---|---|:---:|:---:|
| **Unit: Storage & Detector** | Walidacja manifestu, operacje CRUD magazynu `chrome.storage.local`, normalizacja folderów, heurystyki detektora URL i wątków | Node.js | `tests/test_storage_detector.js` | 19 | PASS ✓ |
| **Unit: UI & DOM** | Inicjalizacja fasady UI, renderowanie paska folderów, plakietki, modale, wyszukiwarka folderów, filtrowanie wątków z natywnym wyszukiwaniem | Node.js | `tests/test_ui.js` | 11 | PASS ✓ |
| **E2E Tier 1** | Autoiniekcja paska folderów (`#mf-folder-bar`) pod wyszukiwarką na żywym drzewie DOM | Playwright | `tests/e2e/messenger-folders.spec.js` (E2E-01) | 1 | PASS ✓ |
| **E2E Tier 2** | Pełny przepływ modalu tworzenia folderu (nazwa, ikona, kolor, live preview, zapis) oraz przełączanie aktywnego folderu | Playwright | `tests/e2e/messenger-folders.spec.js` (E2E-02, E2E-03) | 2 | PASS ✓ |
| **E2E Tier 3** | Przypisywanie wątków czatu do folderu przez menu kontekstowe oraz filtrowanie widoczności listy rozmów | Playwright | `tests/e2e/messenger-folders.spec.js` (E2E-04, E2E-05) | 2 | PASS ✓ |
| **E2E Tier 4** | Realistyczne scenariusze: persystencja stanu po `page.reload()`, koegzystencja z wyszukiwarką Messengera, usuwanie folderu z obsługą dialogu | Playwright | `tests/e2e/messenger-folders.spec.js` (E2E-06, E2E-07, E2E-08) | 3 | PASS ✓ |
| **E2E Tier 5** | Weryfikacja nadrzędnych reguł architektonicznych: zero zapytań sieciowych (`externalRequests.length === 0`) | Playwright | `tests/e2e/messenger-folders.spec.js` (E2E-09) | 1 | PASS ✓ |
| **RAZEM** | **Wszystkie testy projektu** | | | **39** | **100% PASS** |

---

## 3. Scenariusze E2E w Playwright (`tests/e2e/messenger-folders.spec.js`)

- **E2E-01**: Auto-injection of folder bar (`#mf-folder-bar`) — weryfikacja struktury paska, wyszukiwarki, przycisku ustawień, domyślnych pigułek i selekcji `all`.
- **E2E-02**: Folder creation modal flow — otwarcie modalu, wprowadzenie nazwy, wybór emoji i koloru, podgląd na żywo, zapis, toast i pigułka na pasku.
- **E2E-03**: Switching active folder pills — klikanie pigułek `work` i `all`, zmiana klas `.mf-active` oraz stanu `mf_active_folder` w storage.
- **E2E-04**: Chat assignment via context menu — prawy przycisk myszy na wierszu czatu, menu rozwijane, wybór folderu, zapis w `mf_threads` i aktualizacja licznika.
- **E2E-05**: Chat list filtering by active folder — weryfikacja widoczności przypisanego wątku oraz ukrywania nieprzypisanych wątków klasą `.mf-thread-hidden`.
- **E2E-06**: State persistence across page reload — odświeżenie strony (`page.reload()`) i weryfikacja zachowania aktywnego folderu oraz reguł filtrowania.
- **E2E-07**: Coexistence with Messenger native search — wpisanie frazy do natywnej wyszukiwarki Messengera zawiesza ukrywanie wątków; wyczyszczenie przywraca filtr.
- **E2E-08**: Folder deletion and cleanup (handle dialog accept) — utworzenie folderu użytkownika, obsługa dialogu `confirm()`, usunięcie z ustawień, reset do `all` i migracja wątków do `uncategorized`.
- **E2E-09**: Zero network requests verification — śledzenie ruchu sieciowego kontekstu przeglądarki i asercja zerowej liczby żądań zewnętrznych.

---

## 4. Polecenia Wykonawcze i Bramki Jakościowe

### Uruchomienie testów E2E:
```bash
npm run test:e2e
```
*Wynik:* 9 passed w ~6.1 s.

### Uruchomienie testów jednostkowych:
```bash
npm test
```
*Wynik:* 30 passed w ~0.3 s.

### Główna bramka weryfikacji projektu:
```bash
npm run verify
```
*Sekwencja bramki:*
1. `npm run check` (składnia JS i walidacja `manifest.json`)
2. `npm run format:check` (walidacja Prettier)
3. `npm run lint` (ESLint flat config z pluginem `no-unsanitized`)
4. `npm test` (testy jednostkowe i integracyjne)
5. `python3 scripts/kanban/kanban.py check` (integralność tablicy i kart zadań)

*Wynik bramki:* Kod wyjścia `0` (sukces).
