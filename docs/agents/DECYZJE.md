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

## D-002 · 2026-10-10 · proponowana — devDependencies dla narzędzi jakości

**Propozycja:** dopuścić `devDependencies` (ESLint, eslint-plugin-no-unsanitized, web-ext,
Prettier, lefthook) — patrz `WORKFLOW.md` → „Narzędzia open source CLI”, etap 1.
Runtime rozszerzenia nadal bez zależności. **Czeka na decyzję człowieka** (karta MF-007).
