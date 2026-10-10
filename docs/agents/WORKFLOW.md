# Proces pracy agentów — Kanban, DoR, DoD

Uzupełnienie `AGENTS.md`. Opisuje tablicę, bramki jakości, role modeli i dalszy rozwój środowiska.

## Tablica

Każda karta to plik `kanban/tasks/MF-XXX.md`. Konfiguracja (kolumny, limity WIP, modele, DoD)
leży w `kanban/config.json`, a bramki egzekwuje `tools/kanban.mjs`.

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

> Przeczytaj `AGENTS.md`. Uruchom `node tools/kanban.mjs next <model>`, przeczytaj wskazaną kartę,
> przenieś ją do `in-progress`, utwórz gałąź `mf-XXX-opis`. Zmieniaj tylko pliki z sekcji Pliki.
> Gdy kryteria są spełnione, wypełnij Dowód i przenieś kartę do `review`. Nie przenoś do `done`.

## Rejestr decyzji

Decyzje wykraczające poza jedną kartę (nowe narzędzie, zależność, uprawnienie, zmiana procesu)
zapisuj w `docs/agents/DECYZJE.md` w formacie ADR-lite: data, decyzja, powód, alternatywy, status.

---

## Rozszerzenia procesu (propozycje — do decyzji)

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

## Narzędzia open source CLI (propozycje — do decyzji)

Obecnie projekt **nie ma żadnych zależności** (`npm test` i `npm run check` to czysty Node).
Poniższe narzędzia byłyby wyłącznie `devDependencies` lub binarkami, nigdy nie trafiłyby do
rozszerzenia. Kolejność odpowiada stosunkowi korzyści do kosztu.

### Etap 1 — największy zysk od razu

| Narzędzie | Po co tutaj | Co by złapało w obecnym kodzie |
|---|---|---|
| **ESLint** (flat config) + **eslint-plugin-no-unsanitized** (Mozilla) | lint JS; plugin oznacza każde `innerHTML`/`insertAdjacentHTML` z interpolacją | XSS w `src/ui.js:653` (MF-001) i podobne miejsca |
| **web-ext lint** (Mozilla) | walidacja manifestu i paczki rozszerzenia, niebezpieczne wzorce | błędy manifestu przed publikacją |
| **Prettier** albo **Biome** | jeden format kodu dla wszystkich modeli — koniec diffów, w których model przy okazji przeformatował plik | — (Biome = lint + format w jednej binarce Rust; prostszy, ale nie ma odpowiednika `no-unsanitized`) |
| **lefthook** | git hooki: `check` + lint + testy przed commitem, niezależnie od tego, który agent commituje | wymusza DoD lokalnie |
| **tsc --checkJs** (TypeScript tylko jako checker, z JSDoc) | typy bez migracji na TS; JSDoc w kodzie już jest | rozjazdy kształtu `folder`/`thread` między `storage` a `ui` |

### Etap 2 — testy i bezpieczeństwo

| Narzędzie | Po co |
|---|---|
| **node:test** + **c8** | wbudowany runner Node zamiast ręcznych skryptów + pokrycie kodu w DoD (np. ≥ 70% dla `storage.js`) |
| **Playwright** | E2E: ładuje rozszerzenie do Chromium i testuje na statycznej kopii DOM Messengera (fixture) — wykrywa regresje detektora bez logowania |
| **Semgrep** (reguły OSS) | SAST: wzorce XSS, `postMessage` bez sprawdzenia origin |
| **gitleaks** | sekrety w historii (istotne, gdy agenci dostają klucze API do DeepSeek/Gemini) |
| **ast-grep** | własne reguły strukturalne zapisane w repo, np. „zakaz `innerHTML = \`...${x}...\`` poza `ICONS`” — czytelne dla każdego modelu |

### Etap 3 — porządek i utrzymanie

| Narzędzie | Po co |
|---|---|
| **jscpd** | duplikaty — `src/ui.js` (1900 linii) i `popup/popup.js` mają podobne renderowanie folderów |
| **knip** | martwy kod i nieużywane eksporty (po przejściu na moduły) |
| **markdownlint-cli2** + **lychee** | dokumentacja; lychee złapie zepsute linki `file:///home/grz3chu/...` (MF-003) |
| **commitlint** + **git-cliff** | Conventional Commits z `MF-XXX` w treści, automatyczny CHANGELOG |
| **stylelint** | `content.css` ma 1700+ linii; wykrywa duplikaty selektorów i `!important` |

Proponowany docelowy `npm run verify` (jedna komenda DoD dla wszystkich agentów):

```bash
npm run check && npm run lint && npm run typecheck && npm test && npx web-ext lint
```

Wdrożenie etapu 1 to osobna karta (propozycja: MF-007) z decyzją w `DECYZJE.md`, bo łamie obecną
zasadę braku zależności.
