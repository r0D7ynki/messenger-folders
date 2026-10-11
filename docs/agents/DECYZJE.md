# Rejestr decyzji (ADR-lite)

Format: `D-NNN` · data · status (`proponowana` / `przyjęta` / `odrzucona` / `zastąpiona`).

## D-001 · 2026-10-10 · przyjęta — Plikowy Kanban z bramkami DoR/DoD

**Decyzja:** zadania żyją jako `kanban/tasks/MF-XXX.md`, a bramki egzekwuje `scripts/kanban/kanban.py`
(ze swarmboard; pierwotnie `tools/kanban.mjs`, zmigrowane w D-007). `AGENTS.md` jest jedynym źródłem zasad dla wszystkich modeli.
**Powód:** każdy agent (Claude Code, Antigravity, opencode/aider z DeepSeek) umie czytać i edytować
pliki; zewnętrzna tablica (GitHub Projects, Linear) wymagałaby osobnej integracji dla każdego
narzędzia. Historia kart jest w gicie.
**Alternatywy:** GitHub Issues + Projects (dobre dla zespołu ludzi, gorsze offline i dla agentów
bez `gh`); Backlog.md (gotowe CLI, ale bez bramek per model).

## D-002 · 2026-10-10 · przyjęta — devDependencies dla narzędzi jakości

**Decyzja:** dopuszczamy `devDependencies` (ESLint, eslint-plugin-no-unsanitized, web-ext,
lefthook). Runtime rozszerzenia nadal bez zależności. Uzgodnione z autorem repozytorium.
**Powód:** automatyczne pilnowanie bezpiecznego DOM i jednej komendy DoD jest ważniejsze dla pracy
kilku agentów niż brak `node_modules` u kontrybutora.

## D-003 · 2026-10-10 · przyjęta — istniejące naruszenia ESLint jako bulk suppressions

**Decyzja:** 27 naruszeń z chwili wdrożenia zapisane w `eslint-suppressions.json`; nowe naruszenia
są błędem. Spłata kartą MF-008.
**Powód:** włączenie reguł jako `error` bez poprawiania 1900-liniowego `ui.js` w tym samym pull
requeście. Narzędzia i zmiany kodu w osobnych PR.
**Alternatywy:** reguły jako `warn` (nikt nie czyta ostrzeżeń); poprawienie wszystkiego od razu
(duży, ryzykowny diff w UI bez testów E2E).

## D-004 · 2026-10-10 · przyjęta — Wsparcie Firefoksa (Gecko MV3) i web-ext lint w `verify`

**Decyzja:** rozszerzenie oficjalnie wspiera przeglądarkę Mozilla Firefox w standardzie Manifest V3 (Gecko MV3). W `manifest.json` dodano sekcję `browser_specific_settings.gecko` z ID (`messenger-folders@local`), minimalną wersją (`strict_min_version: "109.0"`) i deklaracją `data_collection_permissions: { required: ["none"] }` oraz fallback `background.scripts: ["background/background.js"]` dla silnika Gecko. Polecenie `npm run lint:firefox` (`web-ext lint`) zostało włączone do głównego łańcucha weryfikacji projektu `npm run verify` w `package.json`.
**Powód:** realizacja zadania MF-009 i wymagania R1. Kod źródłowy używa uniwersalnego API `chrome.*`, w pełni wspieranego przez Firefoksa, a konfiguracja Gecko MV3 eliminuje błędy `ADDON_ID_REQUIRED` i `BACKGROUND_SERVICE_WORKER_NOFALLBACK`. Włączenie `web-ext lint` do `verify` trwale zapobiega regresjom kompatybilności wieloplatformowej w CI.

## D-005 · 2026-10-10 · przyjęta — Issues jako wejście, karty jako źródło prawdy

**Decyzja:** zgłoszenia z zewnątrz przez GitHub Issues (szablony z polami DoR), praca agentów
i ludzi według kart `kanban/tasks/`. Szczegóły: `WORKFLOW.md` → „GitHub Issues a karty Kanban”.

## D-006 · 2026-10-10 · przyjęta — Prettier i jednorazowe przeformatowanie
 
**Decyzja:** Prettier (`printWidth` 120, `trailingComma` none, pojedyncze cudzysłowy) dla kodu;
Markdown, karty i dokumentacja poza formatowaniem. Przeformatowanie w osobnym pull requeście
i osobnym commicie wpisanym do `.git-blame-ignore-revs`.
**Powód:** różne modele formatują inaczej — bez wspólnego formatera diffy zadań puchną od zmian
stylu. Ustawienia dobrane pomiarem: najmniej zmienionych linii (~1390 z ~8800) przy zgodności
z dotychczasowym stylem.
**Alternatywy:** Biome (szybszy, lint + format w jednym, ale bez odpowiednika `no-unsanitized`);
`printWidth` 100 (~1715 zmienionych linii).

## D-007 · 2026-10-10 · przyjęta — Migracja tablicy Kanban na swarmboard (scripts/kanban/kanban.py)

**Decyzja:** zastąpienie prototypowego `tools/kanban.mjs` narzędziem `scripts/kanban/kanban.py`
ze swarmboard v0.3.0 (`kanban.py`, `i18n.py`, słowniki `locales/`). Usunięcie `tools/kanban.mjs`
oraz nieużywanych reguł dla `tools/` z `eslint.config.js`. Konfiguracja tablicy w `kanban/config.json`
używa `"headings": "pl"`, `"tool_dir": "scripts/kanban"`, `"gate": ["npm run verify"]`
i `"swarmboard_version": "0.3.0"`.
**Powód:** ujednolicenie silnika tablicy z ekosystemem swarmboard (obsługa roju, niezależny reviewer,
wielojęzyczność, lepsza diagnostyka przez `sb doctor`).


## D-008 · 2026-10-11 · przyjęta — Koniec trybu zespołowego Antigravity, tablica jako jedyne źródło stanu

**Decyzja:** praca toczy się wyłącznie na kartach `kanban/tasks/` (swarmboard). Nie używamy trybu
zespołowego Antigravity (`/teamwork-preview`: sentinel, orkiestrator, roje subagentów, crony).
Jedna karta = jeden wykonawca + jeden niezależny przegląd; zasady oszczędzania limitu w
`docs/agents/WORKFLOW.md`. Stan zespołu (`.agents/teamwork/`) zarchiwizowano poza repo.
**Powód:** tryb zespołowy wyczerpał tygodniowy limit subskrypcji; około 3/4 tokenów poszło na
koordynację i weryfikację. Stan pracy był w dwóch miejscach (tablica i `.agents/`), karty zmieniano
ręcznie, a Gemini przyjmował pracę Gemini (audyt swarmboard 2026-10-11).
**Alternatywy:** „Lean Swarm” Antigravity (1–2 subagentów) — nadal koordynacja i crony poza tablicą;
rój swarmboard (`sb swarm`) — możliwy później, decyzja właściciela.
