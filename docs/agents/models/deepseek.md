# Profil: DeepSeek (przez opencode / aider / Cline) — `model: deepseek`

**Mocne strony:** tani i szybki w dobrze określonych zadaniach, dobra jakość kodu w małym zakresie.
**Słabsze strony:** mniejsza dyscyplina zakresu w dużym repo, brak własnej weryfikacji w przeglądarce.
**Limit rozmiaru zadań:** `M` (skrypt odrzuci kartę `L` przy przejściu do `ready`).

## Do czego go używać
- Poprawki punktowe ze wskazaną linią (`src/ui.js:653`), walidacja danych, nowe testy jednostkowe.
- Mechaniczne zmiany w dokumentacji.

## Zasady dla DeepSeek
1. Przeczytaj kartę zadania w całości, potem **tylko** pliki z sekcji Pliki.
2. Nie refaktoryzuj „przy okazji”. Nie zmieniaj formatowania nietkniętych linii.
3. Po każdej zmianie: `npm test && npm run check`. Wklej ostatnie linie wyniku do Dowodu.
4. Nie przenoś zadania do `done`.

## Dodatkowe DoR
- Sekcja Pliki wskazuje konkretne linie lub funkcje; kryteria są sprawdzalne testem.

## Dodatkowe DoD (wstawiane automatycznie)
- Zmieniono wyłącznie pliki z sekcji Pliki.
- Wynik `npm test` wklejony dosłownie w Dowodzie.

## Uruchomienie
```bash
# opencode (czyta AGENTS.md automatycznie)
opencode            # wybierz provider deepseek, model deepseek-chat / deepseek-reasoner
# aider (czyta .aider.conf.yml z repo)
aider --model deepseek/deepseek-chat
```
