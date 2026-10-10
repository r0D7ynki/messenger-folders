# Proces pracy agentów — Kanban, DoR, DoD

Uzupełnienie `AGENTS.md`. Opisuje tablicę, bramki jakości, role modeli i dalszy rozwój środowiska.

## Tablica

Każda karta to plik `kanban/tasks/MF-XXX.md`. Konfiguracja (kolumny, limity WIP, modele, DoD)
leży w `kanban/config.json`, a bramki egzekwuje `scripts/kanban/kanban.py`.

| Kolumna | Znaczenie | Kto przesuwa | Bramka przy wejściu |
|---|---|---|---|
| `backlog` | pomysł, znalezisko, niedoprecyzowane | każdy | — |
| `ready` | spełnia DoR, można brać | planista (zwykle `claude` lub człowiek) | **DoR** |
| `in-progress` | ktoś pracuje | wykonawca | DoR + limit WIP (3 łącznie, 1 na model) |
| `review` | czeka na przegląd | wykonawca | wszystkie kryteria odhaczone, Dowód wypełniony, limit 4 |
| `done` | scalone do gałęzi | **reviewer ≠ wykonawca** | **DoD** + `npm test` + `npm run check` |

Ruch w lewo (np. `review → in-progress` po uwagach) jest zawsze dozwolony.

## Definition of Ready (DoR)

Karta może trafić do `ready`, gdy (sprawdza skrypt):

- [ ] `model` jest znany, a `size` (S/M/L) nie przekracza limitu modelu (`deepseek` ≤ M)
- [ ] **Cel**: jedno zdanie
- [ ] **Kontekst**: dlaczego; odnośnik do linii kodu lub znaleziska
- [ ] **Pliki**: istniejące ścieżki (nowe oznaczone `(nowy)`) — to zarazem granica zakresu
- [ ] **Kryteria akceptacji**: co najmniej jedno `- [ ]`, sprawdzalne
- [ ] **Weryfikacja**: komendy lub kroki ręczne
- [ ] wszystkie `depends` są `done`

Dodatkowe DoR zależne od modelu: patrz `docs/agents/models/*.md`.

## Definition of Done (DoD)

Lista DoD jest **wklejana do karty przy jej utworzeniu**: część ogólna z `config.json → dod` plus
część modelowa z `config.json → models.<model>.dod`. Reviewer odhacza każdy punkt. Skrypt odrzuci
`done`, gdy którykolwiek punkt jest otwarty, gdy `reviewer` jest pusty lub równy `model`, albo gdy
testy lub `check` nie przechodzą.

## Role modeli — kto co robi

| Rola | Domyślnie | Dlaczego |
|---|---|---|
| Planista (backlog → ready) | `claude` | rozumienie całego repo, dobre rozpisywanie zakresu |
| Wykonawca S/M | `deepseek` | tani, szybki przy precyzyjnym zakresie |
| Wykonawca L, refaktoryzacje | `claude` | spójność zmian w wielu modułach |
| Wykonawca UI + weryfikacja E2E | `gemini` (Antigravity) | browser agent na żywym messenger.com |
| Reviewer | **inny model niż wykonawca** | krzyżowy przegląd łapie ślepe plamy pojedynczego modelu |
| Akceptacja scalenia, decyzje | `human` | uprawnienia, prywatność, push |

Rotacja reviewera: `deepseek` → przegląda `claude`; `claude` → przegląda `gemini` (przegląd UI) lub
`human`; `gemini` → przegląda `claude`.

## Cykl pracy wykonawcy (do wklejenia jako prompt startowy)

> Przeczytaj `AGENTS.md`. Uruchom `python3 scripts/kanban/kanban.py next <model>`, przeczytaj wskazaną kartę,
> przenieś ją do `in-progress`, utwórz gałąź `mf-XXX-opis`. Zmieniaj tylko pliki z sekcji Pliki.
> Gdy kryteria są spełnione, wypełnij Dowód i przenieś kartę do `review`. Nie przenoś do `done`.

## Rejestr decyzji

Decyzje wykraczające poza jedną kartę (nowe narzędzie, zależność, uprawnienie, zmiana procesu)
zapisuj w `docs/agents/DECYZJE.md` w formacie ADR-lite: data, decyzja, powód, alternatywy, status.

---

## Rozszerzenia procesu (do decyzji)

Kanban sprawdza się tu najlepiej jako baza: praca jest ciągła, zadania są małe, a wykonawców jest kilku
i pracują asynchronicznie. Inne metody warto **nałożyć** na Kanban zamiast go zastępować:

| Metoda | Co daje w tym projekcie | Kiedy użyć | Koszt |
|---|---|---|---|
| **Spec-driven development** (GitHub Spec Kit, OpenSpec) | `spec → plan → tasks` w plikach; spec staje się wspólnym kontekstem dla wszystkich modeli, a karty `MF-XXX` powstają z planu | zadania `L` i nowe funkcje (np. reguły automatycznego przypisywania) | średni: jedno CLI, katalog `docs/specs/` |
| **Planner / Executor / Reviewer** | rozdział ról między modele (opisany wyżej); każda karta przechodzi przez co najmniej dwa modele | zawsze — już wbudowane w pole `reviewer` | niski |
| **TDD krzyżowe** | jeden model pisze test, który nie przechodzi (karta A), drugi pisze implementację (karta B z `depends: [A]`); wykonawca nie może dopasować testu do swojego kodu | błędy bezpieczeństwa i logiki `storage` | niski |
| **Shape Up (light)** | „apetyt” zamiast estymaty: na funkcję ustala się budżet (np. 2 sesje agenta); po jego przekroczeniu zakres się tnie, a budżetu nie zwiększa | gdy funkcje rozrastają się bez końca | niski, ale wymaga dyscypliny człowieka |
| **Scrumban** | cotygodniowy przegląd tablicy i retro (co agenci robili źle → poprawka w `AGENTS.md`) | gdy kart przybywa szybciej, niż się kończą | niski |

**Rekomendacja:** Kanban + Planner/Executor/Reviewer (już działa) + TDD krzyżowe dla błędów.
Spec-driven dodać przy pierwszej dużej funkcji.

## Narzędzia jakości

Kod rozszerzenia **nie ma zależności**. Narzędzia są wyłącznie `devDependencies` i nie trafiają
do paczki rozszerzenia.

### Wdrożone

| Narzędzie | Gdzie działa | Co pilnuje |
|---|---|---|
| **ESLint** + **eslint-plugin-no-unsanitized** | `npm run lint`, pre-commit, CI | błędy JS; każde `innerHTML` / `insertAdjacentHTML` z dynamiczną treścią jest błędem, chyba że przechodzi przez `_escapeHtml` / `escapeHtml` |
| **ESLint bulk suppressions** | `eslint-suppressions.json` | 27 naruszeń istniejących w chwili wdrożenia (głównie `innerHTML` ze stałymi `ICONS`) — **nowe są blokowane**, stare do spłaty (MF-008) |
| **lefthook** | git hooki, instalowane przez `npm install` | pre-commit: ESLint na zmienionych plikach, składnia, manifest, karty; pre-push: testy |
| **GitHub Actions** (`verify.yml`) | każdy pull request i push do `master` | `npm ci && npm run verify` |
| **web-ext lint** (Mozilla) | `npm run lint:firefox`, **poza** `verify` | zgodność z Firefoksem; obecnie 2 błędy manifestu, istotne tylko przy wsparciu Firefoksa (MF-009) |
| **Prettier** | `npm run format`, pre-commit (sprawdzanie), CI | jeden format kodu dla wszystkich modeli (`printWidth` 120, bez przecinków końcowych); commit formatujący w `.git-blame-ignore-revs` |
| `scripts/kanban/kanban.py` | `npm run verify`, bramki kart | DoR, WIP, DoD; bramka `done` uruchamia testy, `check` i `lint` |

`npm run verify` = `check` + `format:check` + `lint` + `test` + `kanban check` — **jedna komenda DoD** dla ludzi,
agentów i CI.

Spłata wyjątków: po naprawie miejsca z `eslint-suppressions.json` uruchom
`npx eslint . --prune-suppressions` i zacommituj zmniejszony plik. Dopisywanie nowych wyjątków
(`--suppress-rule`) wymaga uzasadnienia w pull requeście.

### Następne kroki (do decyzji)

| Narzędzie | Po co | Karta |
|---|---|---|
| **node:test** + **c8** | wbudowany runner Node zamiast ręcznych skryptów + próg pokrycia w DoD | — |
| **Playwright** | E2E: rozszerzenie w Chromium na statycznej kopii DOM Messengera | MF-006 |
| **tsc --checkJs** | sprawdzanie typów na podstawie istniejącego JSDoc, bez migracji na TS | — |
| **Semgrep**, **gitleaks** | SAST i sekrety (agenci dostają klucze API) | — |
| **ast-grep** | własne reguły strukturalne w repo | — |
| **jscpd**, **stylelint** | duplikaty (`ui.js` ↔ `popup.js`), porządek w `content.css` (1700+ linii) | — |
| **markdownlint-cli2** + **lychee** | dokumentacja i martwe linki (`file:///home/grz3chu/...`, MF-003) | — |
| **commitlint** + **git-cliff** | Conventional Commits z `MF-XXX`, automatyczny CHANGELOG | — |

## GitHub Issues a karty Kanban

- **Issues** są wejściem z zewnątrz: błędy od użytkowników i propozycje (szablony w `.github/ISSUE_TEMPLATE/`).
- **Karty `kanban/tasks/`** są źródłem prawdy dla pracy ludzi i agentów — agent czyta plik, nie issue.
- Planista zamienia issue na kartę (`npm run kanban -- new "..."`), w Kontekście wpisuje `#numer`,
  a w issue link do karty. Pull request zamyka issue (`Closes #numer`) i przesuwa kartę.
