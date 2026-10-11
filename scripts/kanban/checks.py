"""
Reguły kontroli kart tablicy (`kanban.py check` i bramki): ciągłość Logu przejść, ostrzeżenia,
ścieżki z sekcji Files, cykle zależności. Kopiowany do projektów razem z kanban.py; nie importuje
kanban.py (karty dostaje jako obiekty z `meta`, `status`, `section()`). Tylko stdlib.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

try:  # w pakiecie swarmboard
    from .i18n import tr
except ImportError:  # kopia w projekcie — katalog skryptu jest już w sys.path (kanban.py)
    from i18n import tr  # type: ignore[no-redef]

COLUMNS = ["backlog", "ready", "in-progress", "review", "done"]
# Znaczniki w sekcji Files: plik powstaje w zadaniu (`(new)`/`(nowy)`) albo znika — usunięty
# lub przeniesiony (`(removed)`/`(usunięty)`); takiego pliku DoR nie wymaga na dysku
NEW_FILE_MARKERS = ("(new)", "(nowy)")
REMOVED_FILE_MARKERS = ("(removed)", "(usunięty)")
PATH_MARKERS = NEW_FILE_MARKERS + REMOVED_FILE_MARKERS
# Przejście w Logu: `- RRRR-MM-DD GG:MM <z> → <do>` (Card.move); inne wpisy z „→” się nie liczą
TRANSITION = re.compile(
    rf"^- \d{{4}}-\d\d-\d\d \d\d:\d\d ({'|'.join(COLUMNS)}) → ({'|'.join(COLUMNS)})(?![\w-])",
    re.M,
)
# Ciągłość Logu (SB-039) sprawdzana dla kart założonych od tego dnia (`transitions_since` w
# konfiguracji) — starsze karty mogą nie mieć pełnego Logu przejść
TRANSITIONS_SINCE = "2026-10-12"


# Wpisy roju dopisywane asynchronicznie (przegląd automatyczny, most) — nie są pracą po done
AUTOMATIC_KEYS = ("review.log", "bridge.log.merged", "bridge.log.failed", "bridge.log.requeued")


def automatic_entry(line: str) -> bool:
    text = re.sub(r"^- \d{4}-\d\d-\d\d \d\d:\d\d ", "", line)
    return any(text.startswith(tr(key).split("{")[0]) for key in AUTOMATIC_KEYS)


def transition_errors(card: Any, since: str) -> list[str]:
    """
    Log przejść spójny ze statusem (SB-039): łańcuch od `backlog`, `z` każdego przejścia = `do`
    poprzedniego, ostatnie `do` = bieżący status. Ręczna zmiana `status:` łamie łańcuch.
    """
    if card.meta.get("created", "") < since:
        return []
    previous = "backlog"
    for frm, to in card.transitions():
        if frm != previous:
            return [tr("kanban.check.transition_chain", frm=frm, to=to, expected=previous)]
        previous = to
    if previous != card.status:
        return [tr("kanban.check.transition_status", status=card.status, last=previous)]
    return []


def warnings(card: Any, cards: list[Any]) -> list[str]:
    """Ostrzeżenia `check` — nie blokują (kod wyjścia 0)."""
    found = []
    ids = {c.id for c in cards}
    if card.status == "backlog":  # DoR (`move … ready`) odrzuca brak zależności (SB-050)
        found += [tr("kanban.warn.dep_missing", dep=d) for d in card.dependencies() if d not in ids]
    log = card.section("Log").splitlines()
    done_at = [i for i, line in enumerate(log) if TRANSITION.match(line) and "→ done" in line]
    if card.status == "done" and done_at:  # praca po done bez ponownego otwarcia (SB-041)
        after = [
            line
            for line in log[done_at[-1] + 1 :]
            if not TRANSITION.match(line) and not automatic_entry(line)
        ]
        if after:
            found.append(tr("kanban.warn.after_done", count=len(after)))
    return found


# Token w backtickach to ścieżka, gdy ma `/` albo jedno z tych rozszerzeń (`Board.cards` — nie)
FILE_EXTENSIONS = set(
    "py js mjs cjs ts tsx jsx json md toml yml yaml html css sh txt sql cfg ini lock csv xml svg "
    "png po env".split()
)


def section_paths(files_section: str, any_name: bool = False) -> list[tuple[str, bool]]:
    """
    Ścieżki z sekcji Files jako (ścieżka, może-nie-istnieć). Nowy plik oznacza znacznik
    `(new)`/`(nowy)`, usunięty albo przeniesiony — `(removed)`/`(usunięty)`; w tej samej linii.
    """
    paths = []
    for line in files_section.splitlines():
        may_be_absent = any(marker in line for marker in PATH_MARKERS)
        for ref in re.findall(r"`([^`]+)`", line):
            ref = ref.strip()
            for marker in PATH_MARKERS:
                ref = ref.removesuffix(marker).strip()
            path = re.sub(r":\d+(-\d+)?$", "", ref)
            extension = path.rsplit(".", 1)[-1].lower() if "." in path else ""
            if " " in path or ("/" not in path and extension not in FILE_EXTENSIONS):
                if not any_name or " " in path:  # zakres: także `Makefile`, `LICENSE`
                    continue  # polecenie, nazwa funkcji, atrybut
            paths.append((path, may_be_absent))
    return paths


def missing_files(root: Path, files_section: str) -> list[str]:
    """Ścieżki z sekcji Files, których brak na dysku (bez oznaczonych jako nowe/usunięte)."""
    return [
        path
        for path, may_be_absent in section_paths(files_section)
        if not may_be_absent and not (root / path).exists()
    ]


def dependency_cycle(cards: list[Any]) -> str | None:
    """Pierwszy cykl zależności między kartami jako `A -> B -> A` (A zależy od B) albo None."""
    graph = {c.id: c.dependencies() for c in cards if c.id}
    state: dict[str, int] = {}
    stack: list[str] = []

    def visit(node: str) -> str | None:
        state[node] = 1
        stack.append(node)
        for dep in graph.get(node, []):
            if state.get(dep) == 1:
                return " -> ".join(stack[stack.index(dep) :] + [dep])
            if dep in graph and not state.get(dep):
                found = visit(dep)
                if found:
                    return found
        stack.pop()
        state[node] = 2
        return None

    for node in graph:
        if not state.get(node):
            found = visit(node)
            if found:
                return found
    return None
