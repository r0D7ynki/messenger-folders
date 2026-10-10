# Profil: Gemini (Google Antigravity) — `model: gemini`

**Mocne strony:** wbudowany browser agent (klika i robi zrzuty na żywej stronie), multimodalność,
artefakty planu i walkthrough.
**Limit rozmiaru zadań:** `L`.

## Do czego go używać
- Zadania UI/CSS (`src/ui.js`, `src/content.css`, `popup/`), tryb ciemny, układ paska.
- Weryfikacja E2E zmian innych modeli na prawdziwym messenger.com („czy pasek się pojawia, czy
  filtrowanie działa po przewinięciu”).
- Diagnoza regresji detektora po zmianach DOM Messengera (zrzut + DOM).

## Dodatkowe DoR
- Kryteria akceptacji opisują **widoczny efekt** (co użytkownik zobaczy/kliknie), nie tylko kod.

## Dodatkowe DoD (wstawiane automatycznie)
- Zmiana UI zweryfikowana w przeglądarce agenta — zrzut lub opis w sekcji Dowód.
- Artefakty Antigravity streszczone w Dowodzie.

## Uwaga
Browser agent działa na koncie zalogowanym w jego profilu przeglądarki. Używaj konta testowego,
nie prywatnych rozmów — zrzuty ekranu mogą trafić do artefaktów.
