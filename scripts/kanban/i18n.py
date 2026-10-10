"""
Komunikaty aplikacji ze słowników zewnętrznych: locales/<język>.json (płaskie klucze z kropkami).

Język: jawny argument (np. `language` z konfiguracji) > SWARMBOARD_LANG > LC_ALL > LC_MESSAGES >
LANG > angielski. Brak klucza w wybranym języku → tekst angielski → sam klucz (widoczny błąd,
nie cisza). Teksty to szablony str.format: `"Karta {card_id} …"`; dosłowne klamry: `{{ }}`.

Moduł jest kopiowany do projektu razem z kanban.py (swarmboard.py init), więc używa wyłącznie
biblioteki standardowej i szuka słowników obok siebie.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

LOCALES_DIR = Path(__file__).resolve().parent / "locales"
DEFAULT_LANGUAGE = "en"
LANGUAGE_ENV_VARS = ("SWARMBOARD_LANG", "LC_ALL", "LC_MESSAGES", "LANG")


def available_languages() -> list[str]:
    return sorted(p.stem for p in LOCALES_DIR.glob("*.json"))


def detect_language(explicit: str | None = None) -> str:
    """Pierwszy obsługiwany język z: argumentu, zmiennych środowiska; inaczej angielski."""
    available = available_languages()
    for value in (explicit, *(os.getenv(name) for name in LANGUAGE_ENV_VARS)):
        if not value:
            continue
        code = value.split(".")[0].split("_")[0].split("-")[0].lower()  # pl_PL.UTF-8 → pl
        if code in available:
            return code
    return DEFAULT_LANGUAGE


def _load(language: str) -> dict[str, str]:
    path = LOCALES_DIR / f"{language}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


class Translator:
    def __init__(self, language: str):
        self.language = language
        self.messages = _load(language)
        self.fallback = _load(DEFAULT_LANGUAGE) if language != DEFAULT_LANGUAGE else {}

    def __call__(self, key: str, **kwargs: object) -> str:
        text = self.messages.get(key) or self.fallback.get(key) or key
        return text.format(**kwargs) if kwargs else text

    def subset(self, prefix: str) -> dict[str, str]:
        """Wszystkie teksty z danym prefiksem (np. `web.` dla panelu WWW), z uzupełnieniem z EN."""
        merged = {**self.fallback, **self.messages}
        return {k: v for k, v in merged.items() if k.startswith(prefix)}


_current: Translator | None = None


def set_language(language: str | None = None) -> str:
    """Ustawia język procesu (wykrywany, gdy None/pusty); zwraca wybrany kod."""
    global _current
    _current = Translator(detect_language(language))
    return _current.language


def translator() -> Translator:
    if _current is None:
        set_language()
    assert _current is not None
    return _current


def tr(key: str, **kwargs: object) -> str:
    """Tekst komunikatu w bieżącym języku."""
    return translator()(key, **kwargs)
