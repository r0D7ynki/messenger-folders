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
# Opcjonalna kolumna `test` (SB-071, `"test_column": true`): test/akceptacja po przeglądzie kodu
ALL_COLUMNS = ["backlog", "ready", "in-progress", "review", "test", "done"]
# Test przed przeglądem (#29): `test` przed `review` w liście `columns` — paczka testowana, potem
# przeglądana; do `review` potrzebne `tested_by:`
TEST_FIRST = ["backlog", "ready", "in-progress", "test", "review", "done"]


def wip_units(cards: list[Any], status: str, card: Any, model: str | None = None) -> int:
    """
    Zajęte pozycje WIP w kolumnie (SB-064): paczka (`batch:`) liczy się raz, a paczka samej karty
    nie zajmuje drugiego miejsca. `model` — tylko praca ręczna tego modelu (bez kart roju).
    """
    units = {
        batch_of(c) or c.id
        for c in cards
        if c.status == status
        and (model is None or (c.meta.get("model") == model and not c.meta.get("worker")))
    }
    units.discard(batch_of(card) or card.id)
    return len(units)


def board_columns(config: dict) -> list[str]:
    """
    Kolumny tablicy: domyślne albo z kolumną `test` przed `done` — `"test_column": true` albo
    `"test"` w liście `columns` (tam właściciel jej szuka; SB-084).
    """
    listed = config.get("columns") if isinstance(config.get("columns"), list) else []
    if "test" in listed and "review" in listed and listed.index("test") < listed.index("review"):
        return TEST_FIRST
    return ALL_COLUMNS if config.get("test_column") is True or "test" in listed else COLUMNS


def test_first(columns: list[str]) -> bool:
    """Kolejność etapów in-progress → test → review (#29)."""
    return "test" in columns and columns.index("test") < columns.index("review")


def test_column_line(config: dict) -> str:
    """`sb doctor`: czy kolumna `test` jest włączona i jak ją włączyć."""
    if test_first(board_columns(config)):
        return f"✓ {tr('cli.doctor.test_first_on')}"
    if "test" in board_columns(config):
        return f"✓ {tr('cli.doctor.test_column_on')}"
    return f"· {tr('cli.doctor.test_column_off')}"


def column_warnings(config: dict) -> list[str]:
    """Lista `columns` niezgodna z `test_column` — widoczna kolumna różni się od opisanej."""
    listed = config.get("columns")
    if not isinstance(listed, list):
        return []
    if config.get("test_column") is True and "test" not in listed:
        return [tr("kanban.warn.columns_without_test")]
    if config.get("test_column") is False and "test" in listed:  # columns wygrywa — widoczna
        return [tr("kanban.warn.columns_with_test")]
    return []


# Znaczniki w sekcji Files: plik powstaje w zadaniu (`(new)`/`(nowy)`) albo znika — usunięty
# lub przeniesiony (`(removed)`/`(usunięty)`); takiego pliku DoR nie wymaga na dysku
NEW_FILE_MARKERS = ("(new)", "(nowy)")
REMOVED_FILE_MARKERS = ("(removed)", "(usunięty)")
PATH_MARKERS = NEW_FILE_MARKERS + REMOVED_FILE_MARKERS
# Przejście w Logu: `- RRRR-MM-DD GG:MM <z> → <do>` (Card.move); inne wpisy z „→” się nie liczą
_STATUS = "|".join(ALL_COLUMNS)
TRANSITION = re.compile(rf"^- \d{{4}}-\d\d-\d\d \d\d:\d\d ({_STATUS}) → ({_STATUS})(?![\w-])", re.M)
# Ciągłość Logu (SB-039) sprawdzana dla kart założonych od tego dnia (`transitions_since` w
# konfiguracji) — starsze karty mogą nie mieć pełnego Logu przejść
TRANSITIONS_SINCE = "2026-10-12"


# Wpisy roju dopisywane asynchronicznie (przegląd automatyczny, most) — nie są pracą po done
AUTOMATIC_KEYS = (
    "review.log",
    "bridge.log.merged",
    "bridge.log.failed",
    "bridge.log.requeued",
)
# Metadane zmieniane `kanban.py set` (także w done) — wpis „klucz: stara → nowa” nie jest pracą
META_KEYS = ("branch", "priority", "batch", "tested_by", "question")
MANUAL_META = re.compile(rf"^(?:{'|'.join(META_KEYS)}): .* → ")  # wartości ze spacjami (question)


def automatic_entry(line: str) -> bool:
    text = re.sub(r"^- \d{4}-\d\d-\d\d(?: \d\d:\d\d)? ", "", line)
    if MANUAL_META.match(text):
        return True
    prefixes = [tr(key).split("{")[0] for key in AUTOMATIC_KEYS]
    return any(prefix and text.startswith(prefix) for prefix in prefixes)


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


def card_summary(card: Any) -> dict[str, object]:
    """Karta jako słownik dla `--json` (stabilne pola dla agentów)."""
    meta = card.meta
    return {
        "id": card.id,
        "title": meta.get("title", ""),
        "status": card.status,
        "model": meta.get("model", ""),
        "size": meta.get("size", ""),
        "priority": meta.get("priority", ""),
        "depends": card.dependencies(),
        "worker": meta.get("worker") or None,
        "branch": meta.get("branch") or None,
        "executor": meta.get("executor") or None,
        "batch": batch_of(card),
        "tested_by": meta.get("tested_by") or None,
        "human_review": needs_human(card),
        "human_test": needs_human_test(card),
        "question": card.meta.get("question") or None,
        "review_fail": meta.get("review_fail") or None,  # ✗ FAIL — decyzja człowieka (SB-081)
        "path": str(card.path),
    }


# Karta wymaga człowieka (SB-076): nagłówek `human_review: true` albo kryterium „(ręcznie)”
MANUAL_CRITERION = re.compile(r"^- \[[ xX]\] .*\((?:ręcznie|manual)\)", re.M | re.I)
NO_BATCH = "none"  # `batch: none` — świadoma decyzja w DoR: karta bez paczki (#29)
HUMAN_KEYS = ("human_review", "human_test")  # udział człowieka deklarowany w DoR z powodem (#29)


def batch_decided(card: Any) -> bool:
    """Planista zdecydował o paczce (nazwa albo `none`) — wymóg DoR i pominięcie w `batch plan`."""
    return bool(str(card.meta.get("batch") or "").strip())


def batch_of(card: Any) -> str | None:
    """Nazwa paczki karty; puste i `none` (bez względu na wielkość liter) — karta bez paczki."""
    value = str(card.meta.get("batch") or "").strip()
    return None if value.lower() in ("", NO_BATCH) else value


def human_flag(card: Any, key: str) -> tuple[bool, str]:
    """`human_review: true — powód` → (True, „powód”); brak albo `false` → (False, …)."""
    match = re.match(r"([A-Za-z0-9]*)[\s—–:,;._-]*(.*)", str(card.meta.get(key, "")).strip())
    word, reason = (match.group(1), match.group(2).strip()) if match else ("", "")
    reason = reason if re.search(r"[^\W\d_]", reason) else ""  # sama interpunkcja to nie powód
    return word.lower() in ("true", "yes", "1", "tak"), reason


def needs_human(card: Any) -> bool:
    """Decyzja człowieka wymagana przez kartę — rój nie przenosi jej sam do done."""
    if human_flag(card, "human_review")[0] or str(card.meta.get("question") or "").strip():
        return True  # `question:` — pytanie do właściciela (#31)
    return bool(MANUAL_CRITERION.search(card.section("Acceptance criteria")))


def needs_human_test(card: Any) -> bool:
    """Test w kolumnie `test` robi człowiek (`human_test: true — powód`); domyślnie agent (#29)."""
    return human_flag(card, "human_test")[0]


def dor_policy_errors(card: Any, config: dict) -> list[str]:
    """
    Decyzje planisty przy wejściu do `ready` (#29): paczka (`batch:` nazwa albo `none`) i powód
    udziału człowieka. Tylko przy przejściu — karty już dalej na tablicy zostają ważne.
    """
    errors = []
    if config.get("require_batch", True) and not batch_decided(card):
        errors.append(tr("kanban.dor.no_batch", none=NO_BATCH))
    for key in HUMAN_KEYS:
        flag, reason = human_flag(card, key)
        if flag and not reason:
            errors.append(tr("kanban.dor.human_without_reason", field=key))
    return errors


def human_marker(card: Any, column: str) -> str:
    """Oznaczenie na tablicy: 👤 (przegląd albo test człowieka); w review/test — czeka na niego."""
    if not needs_human(card) and not needs_human_test(card):
        return ""
    return tr("kanban.board.waits_human") if column in ("review", "test") else "👤"


def agent_marker(card: Any) -> str:
    """Kto realizuje kartę w toku (SB-073): worker roju (i model) albo wykonawca pracy ręcznej."""
    worker, executor = card.meta.get("worker"), card.meta.get("executor")
    if worker:
        return f"▶ @{worker}" + (f" ({executor})" if executor else "")
    return f"▶ {executor}" if executor else ""


def board_line(card: Any, column: str) -> str:
    """Linia karty w `board`: rozmiar, priorytet, model, tytuł, paczka, wykonawca, zależności."""
    meta = card.meta
    deps = card.dependencies()
    extra = f"  ⇠ {','.join(deps)}" if deps else ""
    batch = f"  [{batch_of(card)}]" if batch_of(card) else ""
    agent = f"  {agent_marker(card)}" if column == "in-progress" and agent_marker(card) else ""
    human = f"  {human_marker(card, column)}" if human_marker(card, column) else ""
    if column == "review" and meta.get("review_fail"):  # przegląd FAIL po limicie prób (SB-081)
        human += f"  {tr('kanban.board.review_fail')}"
    return (
        f"  {card.id}  [{meta.get('size', '?')}] {meta.get('priority', ''):<3} "
        f"{meta.get('model', ''):<8} {meta.get('title', '')}{batch}{human}{agent}{extra}"
    )
