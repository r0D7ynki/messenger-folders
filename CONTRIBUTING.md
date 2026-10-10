# Jak współtworzyć Messenger Folders

Dziękujemy za chęć pomocy! Ta strona wystarcza, żeby zacząć. Szczegóły procesu (Kanban,
Definition of Ready / Done, praca z agentami AI) są w [docs/agents/WORKFLOW.md](docs/agents/WORKFLOW.md),
a zasady techniczne w [AGENTS.md](AGENTS.md).

## Przygotowanie

Wymagany Node.js 20 lub nowszy.

```bash
git clone https://github.com/r0D7ynki/messenger-folders.git
cd messenger-folders
npm install          # narzędzia deweloperskie + git hooki (lefthook)
npm run verify       # wszystko powinno przejść
```

Rozszerzenie nie ma zależności w runtime — `npm install` instaluje wyłącznie narzędzia
(ESLint, lefthook, web-ext). Do przeglądarki ładujesz katalog repozytorium tak jak w README.

## Komendy

| Komenda | Co robi |
|---|---|
| `npm test` | testy jednostkowe (Node, bez przeglądarki i sieci) |
| `npm run check` | składnia wszystkich plików JS i poprawność `manifest.json` |
| `npm run lint` | ESLint z regułami bezpieczeństwa DOM (`no-unsanitized`) |
| `npm run verify` | wszystko powyżej + walidacja kart Kanban — **to samo uruchamia CI** |
| `npm run lint:firefox` | informacyjnie: zgodność z Firefoksem (`web-ext lint`) |
| `npm run board` | tablica zadań |

Git hooki: przed commitem ESLint na zmienionych plikach, składnia i karty; przed pushem testy.

## Zgłoszenia i zadania

- **Błąd** — formularz „Zgłoszenie błędu”. Nie wklejaj treści prywatnych rozmów.
- **Zadanie** — formularz „Zadanie” (pola = Definition of Ready). Opiekun przenosi je na kartę
  w `kanban/tasks/`, z której pracują ludzie i agenci AI.

## Pull request

1. Gałąź od `master`: `mf-XXX-krotki-opis` (numer karty) albo `fix-krotki-opis`.
2. Zmieniaj tylko to, czego dotyczy zadanie. Bez masowego formatowania przy okazji.
3. Uzupełnij checklistę Definition of Done w opisie pull requesta.
4. CI (`verify`) musi być zielone.

## Zasady, których pilnujemy

- **Zero sieci** — rozszerzenie nie wysyła żadnych danych.
- **Bezpieczny DOM** — nazwy folderów, rozmów i dane z importu wstawiamy przez `textContent`
  lub `_escapeHtml`; ESLint blokuje nowe niebezpieczne `innerHTML`.
- **Bez nowych uprawnień i zależności runtime** bez wcześniejszej dyskusji.
- Kod, komentarze i teksty UI po polsku.

## Praca z agentami AI

Repo jest przygotowane pod Claude Code (`CLAUDE.md`), Google Antigravity (`.agent/rules/`)
i aider/opencode, np. z DeepSeek (`.aider.conf.yml`, `AGENTS.md`). Wszystkie czytają `AGENTS.md`.
Zasada nadrzędna: **review robi inny model albo człowiek niż wykonawca.**
