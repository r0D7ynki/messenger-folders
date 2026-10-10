# Rejestr decyzji (ADR-lite)

Format: `D-NNN` · data · status (`proponowana` / `przyjęta` / `odrzucona` / `zastąpiona`).

## D-001 · 2026-10-10 · przyjęta — Plikowy Kanban z bramkami DoR/DoD

**Decyzja:** zadania żyją jako `kanban/tasks/MF-XXX.md`, a bramki egzekwuje `tools/kanban.mjs`
(czysty Node, bez zależności). `AGENTS.md` jest jedynym źródłem zasad dla wszystkich modeli.
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

## D-004 · 2026-10-10 · przyjęta — web-ext lint poza `verify`

**Decyzja:** `web-ext lint` jest dostępny jako `npm run lint:firefox`, ale nie blokuje CI.
**Powód:** jego błędy (`ADDON_ID_REQUIRED`, `BACKGROUND_SERVICE_WORKER_NOFALLBACK`) dotyczą wyłącznie
Firefoksa, a rozszerzenie celuje w Chromium; ostrzeżenia o `innerHTML` dublują ESLint.
Wraca do `verify`, jeśli zapadnie decyzja o wsparciu Firefoksa (MF-009).

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
