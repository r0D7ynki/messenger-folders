#!/usr/bin/env python3
"""
Plikowa tablica Kanban dla agentów i ludzi (swarmboard). Komunikaty: locales/*.json (i18n.py).

Każda karta to plik kanban/tasks/<ID>.md z nagłówkiem (frontmatter) i sekcjami `## …`.
Skrypt pilnuje bramek: DoR przy wejściu do `ready`, DoR + WIP + gotowych zależności przy
`in-progress`, kryteriów akceptacji i sekcji Evidence przy `review`, DoD (ogólnego + modelowego)
i polecenia bramki projektu (`gate` w kanban/config.json) przy `done`.

Plik jest samowystarczalny (tylko biblioteka standardowa) — `sb init` kopiuje go do
projektu (domyślnie scripts/kanban/kanban.py), żeby tablica działała bez swarmboard.
Most z rojem (bridge.py w pakiecie swarmboard) importuje ten moduł i używa tych samych bramek.

Użycie (z katalogu projektu albo z --root ŚCIEŻKA / KANBAN_ROOT):
  kanban.py                               tablica
  kanban.py new "Tytuł" [--model claude] [--size M] [--priority P2]
  kanban.py move APP-001 ready             przesunięcie z kontrolą bramki
  kanban.py check [APP-001]                walidacja bez przesuwania
  kanban.py next <model> [--start]        karta `ready` dla modelu (--start: gałąź + in-progress)
  kanban.py submit APP-001                 kryteria + Evidence + bramka projektu → review
  --json (board, check, next, submit)     wyjście dla agentów
Kody wyjścia: 0 sukces, 1 bramka/walidacja, 2 błąd użycia, 3 brak karty do wzięcia.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

try:  # w pakiecie swarmboard
    from . import checks
    from .i18n import tr
except ImportError:  # kopia w projekcie (scripts/kanban/), bez pakietu
    # i18n.py leży obok; dopisujemy katalog jawnie, bo `python3 -I` go pomija
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import checks  # type: ignore[no-redef]
    from i18n import tr  # type: ignore[no-redef]

# Reguły kontroli kart w checks.py (limit rozmiaru pliku); nazwy zostają dostępne jak dotąd
COLUMNS, TRANSITION, TRANSITIONS_SINCE = checks.COLUMNS, checks.TRANSITION, checks.TRANSITIONS_SINCE
PATH_MARKERS, NEW_FILE_MARKERS = checks.PATH_MARKERS, checks.NEW_FILE_MARKERS
REMOVED_FILE_MARKERS, FILE_EXTENSIONS = checks.REMOVED_FILE_MARKERS, checks.FILE_EXTENSIONS
section_paths, missing_files = checks.section_paths, checks.missing_files
card_summary = checks.card_summary
dependency_cycle = checks.dependency_cycle

# ID karty: prefiks i numer (SB-035) — trafia do ścieżek worktree, raportów i refów gita
CARD_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_]*-\d+$")
PREFIX = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_]*$")
SIZE_ORDER = ["S", "M", "L"]
# Zależność „zaplanowana” (wystarcza do ready) i „dostępna w kodzie” (wymagana do ręcznego startu).
# Kolejność wykonania zależnych kart pilnuje rój (DAG) albo ta bramka przy `in-progress`.
DEPS_PLANNED = {"ready", "in-progress", "review", "test", "done"}
DEPS_AVAILABLE = {"review", "test", "done"}  # `test` — kod już scalony (SB-071)


def same_batch(card: Card, other: Card) -> bool:
    """Obie karty w tej samej paczce (`batch:`)."""
    return bool(checks.batch_of(card)) and checks.batch_of(card) == checks.batch_of(other)


# Kanoniczne nagłówki sekcji → polskie nagłówki (starsze polskie karty nadal działają)
SECTION_ALIASES = {
    "Goal": ("Cel",),
    "Context": ("Kontekst",),
    "Files": ("Pliki",),
    "Acceptance criteria": ("Kryteria akceptacji",),
    "Verification": ("Weryfikacja",),
    "Out of scope": ("Poza zakresem",),
    "DoD": (),
    "Evidence": ("Dowód",),
    "To report": ("Do zgłoszenia",),  # tematy spoza zakresu → nowe karty po scaleniu (#31)
    "Log": (),
}

# Sekcje nowej karty; podpowiedzi w komentarzach HTML pochodzą ze słownika (kanban.template.*)
TEMPLATE_SECTIONS = [
    ("Goal", "goal"),
    ("Context", "context"),
    ("Files", "files"),
    ("Acceptance criteria", None),
    ("Verification", "verification"),
    ("Out of scope", "out_of_scope"),
    ("DoD", None),
    ("Evidence", "evidence"),
    ("Log", None),
]


# Język nagłówków kart projektu (`headings` w kanban/config.json): kanoniczna nazwa → nagłówek.
# Odczyt zawsze przyjmuje oba języki; wybór dotyczy nowych kart, komunikatów bramek i promptu roju.
HEADINGS = {
    "en": {name: name for name in SECTION_ALIASES},
    "pl": {name: (aliases[0] if aliases else name) for name, aliases in SECTION_ALIASES.items()},
}


def card_template(dod_checklist: str, headings: str = "en") -> str:
    parts = []
    for name, hint in TEMPLATE_SECTIONS:
        heading = HEADINGS[headings][name]
        if name == "Acceptance criteria":
            content = "- [ ]"
        elif name == "DoD":
            content = dod_checklist
        elif hint:
            content = f"<!-- {tr('kanban.template.' + hint)} -->"
        else:
            content = ""
        parts.append(f"## {heading}\n{content}\n" if content else f"## {heading}\n")
    return "\n" + "\n".join(parts)


def wip_limit(wip: object, key: str) -> int | None:
    """
    Limit WIP (SB-034) — jedna interpretacja dla tablicy, mostu i panelu: tylko dodatnia liczba
    całkowita; 0, tekst („3”), wartość logiczna i brak = bez limitu (`check` ostrzega o błędnych).
    """
    limit = wip.get(key) if isinstance(wip, dict) else None
    return limit if isinstance(limit, int) and not isinstance(limit, bool) and limit > 0 else None


def wip_warnings(wip: object) -> list[str]:
    """Wartości `wip` w konfiguracji, które nie są limitem (np. "3", 0) — traktowane jak brak."""
    if not isinstance(wip, dict):
        return [] if wip is None else [tr("kanban.warn.wip_invalid", name="wip", value=wip)]
    return [
        tr("kanban.warn.wip_invalid", name=key, value=value)
        for key, value in wip.items()
        if wip_limit(wip, key) is None
    ]


class KanbanError(Exception):
    """Błąd użycia tablicy (brak karty, zła kolumna, błędny plik)."""


def timestamp() -> str:
    """Bieżący czas lokalny do wpisów w Logu karty."""
    return time.strftime("%Y-%m-%d %H:%M")


@dataclass
class Card:
    path: Path
    meta: dict[str, str]
    body: str

    @classmethod
    def load(cls, path: Path) -> Card:
        return cls.parse(path.read_text(encoding="utf-8"), path)

    @classmethod
    def parse(cls, raw: str, path: Path) -> Card:
        """Karta z tekstu pliku (np. `git show gałąź:kanban/tasks/ID.md`); BOM i CRLF dozwolone."""
        raw = raw.removeprefix("﻿").replace("\r\n", "\n")
        match = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
        if not match:
            raise KanbanError(tr("kanban.error.no_header", name=path.name))
        meta: dict[str, str] = {}
        for line in match.group(1).splitlines():
            kv = re.match(r"^(\w[\w-]*):\s*(.*)$", line)
            if kv:
                meta[kv.group(1)] = kv.group(2).strip()
        card_id = meta.get("id", "")
        if card_id and not CARD_ID.match(card_id):
            raise KanbanError(tr("kanban.error.bad_id", name=path.name, card_id=card_id))
        return cls(path, meta, match.group(2))

    def save(self) -> None:
        head = "\n".join(f"{k}: {v}" for k, v in self.meta.items())
        self.path.write_text(f"---\n{head}\n---\n{self.body}", encoding="utf-8")

    @property
    def id(self) -> str:
        return self.meta.get("id", "")

    @property
    def status(self) -> str:
        return self.meta.get("status", "")

    def section(self, name: str) -> str:
        """Treść sekcji `## name` (lub jej polskiego aliasu) bez nagłówka i komentarzy HTML."""
        names = "|".join(re.escape(n) for n in (name, *SECTION_ALIASES.get(name, ())))
        m = re.search(rf"^## (?:{names})[ \t]*\n(.*?)(?=^## |\Z)", self.body, re.S | re.M)
        return re.sub(r"<!--.*?-->", "", m.group(1), flags=re.S).strip() if m else ""

    def checkboxes(self, name: str) -> tuple[int, list[str]]:
        """(liczba pozycji `- [ ]`/`- [x]`, lista nieodhaczonych) w sekcji."""
        items = re.findall(r"^- \[( |x|X)\] (.+)$", self.section(name), re.M)
        return len(items), [text for mark, text in items if mark == " "]

    def dependencies(self) -> list[str]:
        raw = re.sub(r"[\[\]]", "", self.meta.get("depends", ""))
        return [d.strip() for d in raw.split(",") if d.strip()]

    def transitions(self) -> list[tuple[str, str]]:
        """Przejścia między kolumnami zapisane w Logu, w kolejności wpisów."""
        return TRANSITION.findall(self.section("Log"))

    def append_log(self, text: str) -> None:
        self.body = self.body.rstrip() + f"\n- {timestamp()} {text}\n"

    def move(self, to: str, note: str = "") -> None:
        """Zmiana kolumny BEZ bramki (bramki: Board.gate_errors) z wpisem w Logu."""
        frm = self.status
        self.meta["status"] = to
        self.append_log(f"{frm} → {to}" + (f" ({note})" if note else ""))


class Board:
    """Tablica projektu: <root>/kanban/config.json + <root>/kanban/tasks/*.md."""

    def __init__(self, root: Path):
        self.root = root
        self.tasks_dir = root / "kanban" / "tasks"
        config_file = root / "kanban" / "config.json"
        if not config_file.exists():
            raise KanbanError(tr("kanban.error.no_config", path=config_file))
        try:
            self.config = json.loads(config_file.read_text(encoding="utf-8"))
        except ValueError as e:
            raise KanbanError(tr("kanban.error.bad_config", path=config_file, error=e)) from e
        if not isinstance(self.config, dict):
            error = type(self.config).__name__
            raise KanbanError(tr("kanban.error.bad_config", path=config_file, error=error))
        self.headings = self.config.get("headings", "en")
        if not isinstance(self.headings, str) or self.headings not in HEADINGS:
            raise KanbanError(
                tr("kanban.error.bad_headings", value=self.headings, allowed=", ".join(HEADINGS))
            )
        self.load_errors: dict[str, str] = {}  # plik → błąd; uzupełnia cards()
        self.check_warnings: dict[str, list[str]] = {}  # karta → ostrzeżenia; uzupełnia check()

    @staticmethod
    def section_paths(files_section: str, any_name: bool = False) -> list[tuple[str, bool]]:
        """Ścieżki z sekcji Files (dla workflow.py, który nie importuje kanban.py)."""
        return section_paths(files_section, any_name)

    def heading(self, name: str) -> str:
        """Nagłówek sekcji w języku tablicy (`headings`), np. Files → Pliki."""
        return HEADINGS[self.headings][name]

    # --- Odczyt ---

    def cards(self) -> list[Card]:
        """Poprawne karty; uszkodzone pomija i zapisuje w load_errors (nie blokują reszty)."""
        self.load_errors = {}
        if not self.tasks_dir.exists():
            return []
        cards = []
        for path in sorted(self.tasks_dir.glob("*.md")):
            try:
                cards.append(Card.load(path))
            except (KanbanError, UnicodeDecodeError, OSError) as e:  # OSError: znikła, brak praw
                self.load_errors[path.name] = str(e)
        return cards

    def card(self, card_id: str, cards: list[Card] | None = None) -> Card:
        for c in cards if cards is not None else self.cards():
            if c.id == card_id:
                return c
        raise KanbanError(tr("kanban.error.no_card", card_id=card_id))

    # --- Bramki ---

    def _dependency_errors(self, card: Card, cards: list[Card], allowed: set[str]) -> list[str]:
        errors = []
        by_id = {c.id: c for c in cards}
        for dep in card.dependencies():
            if dep not in by_id:
                errors.append(tr("kanban.dep.missing", dep=dep))
            elif same_batch(card, by_id[dep]) and by_id[dep].status == "in-progress":
                continue  # paczka w toku: wspólna gałąź i bramka — kolejność w paczce (Z39)
            elif by_id[dep].status not in allowed:
                errors.append(
                    tr(
                        "kanban.dep.status",
                        dep=dep,
                        status=by_id[dep].status,
                        allowed="/".join(sorted(allowed)),
                    )
                )
        return errors

    def ready_errors(self, card: Card, cards: list[Card]) -> list[str]:
        """Definition of Ready: karta jest na tyle opisana, że agent może ją wziąć."""
        errors = []
        meta = card.meta
        model = self.config.get("models", {}).get(meta.get("model", ""))
        if not model:
            errors.append(tr("kanban.dor.unknown_model", model=meta.get("model")))
        size = meta.get("size", "")
        if size not in SIZE_ORDER:
            errors.append(tr("kanban.dor.bad_size", sizes="/".join(SIZE_ORDER)))
        elif model and SIZE_ORDER.index(size) > SIZE_ORDER.index(model.get("max_size", "L")):
            limit = model["max_size"]
            errors.append(
                tr("kanban.dor.size_over_limit", size=size, model=meta["model"], limit=limit)
            )
        for name in ("Goal", "Context"):
            if not card.section(name):
                errors.append(tr("kanban.dor.empty_section", section=self.heading(name)))
        if card.checkboxes("Acceptance criteria")[0] == 0:
            errors.append(tr("kanban.dor.no_criteria"))
        files = card.section("Files")
        if not files:
            errors.append(tr("kanban.dor.no_files", section=self.heading("Files")))
        for path in missing_files(self.root, files):
            errors.append(tr("kanban.dor.missing_file", path=path, section=self.heading("Files")))
        if not card.section("Verification"):
            errors.append(tr("kanban.dor.no_verification", section=self.heading("Verification")))
        errors += self._dependency_errors(card, cards, DEPS_PLANNED)
        return errors

    def wip_errors(self, card: Card, cards: list[Card]) -> list[str]:
        """
        Limit `in-progress` liczy wszystkie karty w toku (także rój). Limit na model dotyczy pracy
        ręcznej — karty roju (`worker:`) mają własny limit: liczbę workerów.
        """
        limits = self.config.get("wip", {})
        errors = []
        total = wip_limit(limits, "in-progress")
        if total and checks.wip_units(cards, "in-progress", card) >= total:
            errors.append(tr("kanban.wip.total", limit=total))
        per_model = wip_limit(limits, "in-progress-per-model")
        model = card.meta.get("model", "")
        if per_model and checks.wip_units(cards, "in-progress", card, model) >= per_model:
            errors.append(tr("kanban.wip.per_model", model=model, limit=per_model))
        return errors

    def review_errors(self, card: Card, cards: list[Card], check_wip: bool = True) -> list[str]:
        errors = [
            tr("kanban.review.open_criterion", item=i)
            for i in card.checkboxes("Acceptance criteria")[1]
        ]
        if not card.section("Evidence"):
            errors.append(tr("kanban.review.no_evidence", section=self.heading("Evidence")))
        limit = wip_limit(self.config.get("wip", {}), "review")
        if check_wip and limit and checks.wip_units(cards, "review", card) >= limit:
            errors.append(tr("kanban.review.wip", limit=limit))
        return errors

    def done_errors(self, card: Card, run_gate: bool, closed: bool = False) -> list[str]:
        total, open_items = card.checkboxes("DoD")
        errors = [tr("kanban.dod.missing")] if total == 0 else []
        errors += [tr("kanban.dod.open_item", item=i) for i in open_items]
        errors += self.reviewer_errors(card)
        # check karty w done: `tested_by` tylko po przejściu przez test (#28), ruch zawsze (SB-071)
        tested = not closed or any("test" in t for t in card.transitions())
        if "test" in self.columns and tested and not card.meta.get("tested_by"):
            errors.append(tr("kanban.dod.no_tested_by"))
        if run_gate and not errors:
            errors += self.run_gate(tail_lines=8)
        return errors

    def reviewer_errors(self, card: Card) -> list[str]:
        """Przegląd niezależny: reviewer wpisany i różny od `model:` i `executor:` (SB-046)."""
        reviewer = card.meta.get("reviewer", "")
        if not reviewer:
            return [tr("kanban.dod.no_reviewer")]
        if reviewer == card.meta.get("model"):
            return [tr("kanban.dod.self_review")]
        if reviewer == card.meta.get("executor"):
            return [tr("kanban.dod.self_review_executor", executor=reviewer)]
        return []

    @property
    def columns(self) -> list[str]:
        """Kolumny tablicy (z opcjonalną `test`, SB-071)."""
        return checks.board_columns(self.config)

    def transition_errors(self, card: Card) -> list[str]:
        since = str(self.config.get("transitions_since", TRANSITIONS_SINCE))
        return checks.transition_errors(card, since)

    def warnings(self, card: Card, cards: list[Card]) -> list[str]:
        return checks.warnings(card, cards)

    def run_gate(self, tail_lines: int) -> list[str]:
        """Wszystkie polecenia `gate` w katalogu projektu; każdy błąd z ostatnimi liniami."""
        if os.environ.get("SWARMBOARD_PACKAGE_RULES") == "1" and self.config.get("gate"):
            return [tr("kanban.dod.gate_blocked")]  # niezaufane repo — bez kodu z repo (SB-029)
        errors = []
        for cmd in self.config.get("gate", []):
            res = subprocess.run(
                cmd,
                shell=True,
                cwd=self.root,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
            )
            if res.returncode != 0:
                tail = "\n".join(res.stdout.strip().splitlines()[-tail_lines:])
                errors.append(tr("kanban.dod.gate_failed", cmd=cmd, code=res.returncode, tail=tail))
        return errors

    def gate_errors(
        self, card: Card, to: str, cards: list[Card], run_gate: bool = True
    ) -> list[str]:
        """Błędy przejścia do `to`: skok przez bramki kolumn pośrednich, w lewo — bez bramki."""
        columns = self.columns
        if to not in columns:
            raise KanbanError(
                tr("kanban.error.unknown_column", column=to, columns=", ".join(columns))
            )
        start = columns.index(card.status) if card.status in columns else 0
        errors: list[str] = []
        for column in columns[start + 1 : columns.index(to) + 1]:
            gate = self._column_gate(card, column, cards, run_gate, final=column == to)
            errors += [e for e in gate if e not in errors]
        return errors

    def _column_gate(
        self, card: Card, to: str, cards: list[Card], run_gate: bool, final: bool = True
    ) -> list[str]:
        if to == "ready":  # + paczka i powód udziału człowieka — tylko przy przejściu (#29)
            return self.ready_errors(card, cards) + checks.dor_policy_errors(card, self.config)
        if to == "in-progress":
            return (
                self.ready_errors(card, cards)
                + self.wip_errors(card, cards)
                + self._dependency_errors(card, cards, DEPS_AVAILABLE)
            )
        first = checks.test_first(self.columns)  # test przed przeglądem (#29)
        if to == "review":
            untested = first and not card.meta.get("tested_by")
            return self.review_errors(card, cards) + [tr("kanban.dod.no_tested_by")] * untested
        others = [c for c in cards if c is not card]
        if to == "test":  # przegląd zaliczony, miejsce w WIP testu (SB-071)
            limit = wip_limit(self.config.get("wip", {}), "test")
            # WIP testu tylko dla karty, która w `test` zostaje — nie przy przejściu do done
            full = final and limit and checks.wip_units(cards, "test", card) >= limit
            wip = [tr("kanban.test.wip", limit=limit)] if full else []
            reviewer = [] if first else self.reviewer_errors(card)  # test po przeglądzie — reviewer
            return self.review_errors(card, others, check_wip=False) + reviewer + wip
        if to == "done":
            return (
                self.review_errors(card, others, check_wip=False)
                + self.transition_errors(card)
                + self.done_errors(card, run_gate)
            )
        return []

    # --- Komendy ---

    def dod_checklist(self, model: str) -> str:
        models = self.config.get("models", {})
        items = self.config.get("dod", []) + models.get(model, {}).get("dod", [])
        return "\n".join(f"- [ ] {i}" for i in items)

    def create(
        self, title: str, model: str = "claude", size: str = "M", priority: str = "P2"
    ) -> Card:
        if model not in self.config.get("models", {}):
            raise KanbanError(
                tr(
                    "kanban.error.unknown_model",
                    model=model,
                    models=", ".join(self.config.get("models", {})),
                )
            )
        prefix = self.config["prefix"]
        if not PREFIX.match(str(prefix)):  # ID = prefiks-numer (CARD_ID); inaczej karta nieczytelna
            raise KanbanError(tr("kanban.error.bad_prefix", prefix=prefix))
        numbers = [
            int(m.group(1))
            for c in self.cards()
            if (m := re.match(rf"^{re.escape(prefix)}-(\d+)$", c.id))
        ]
        numbers += self.history_numbers(prefix)  # usunięte karty nie oddają ID (SB-049)
        card_id = f"{prefix}-{max(numbers, default=0) + 1:03d}"
        card = Card(
            self.tasks_dir / f"{card_id}.md",
            {
                "id": card_id,
                "title": title,
                "status": "backlog",
                "model": model,
                "reviewer": "",
                "size": size,
                "priority": priority,
                "depends": "[]",
                "batch": "",  # DoR: nazwa paczki albo `none` (#29)
                "created": time.strftime("%Y-%m-%d"),
            },
            card_template(self.dod_checklist(model), self.headings),
        )
        card.append_log(tr("kanban.log.created"))  # kiedy założona (SB-052)
        self.tasks_dir.mkdir(parents=True, exist_ok=True)
        card.save()
        return card

    def history_numbers(self, prefix: str) -> list[int]:
        """Numery kart z historii gita (wszystkie gałęzie) — także usuniętych z tablicy."""
        try:
            res = subprocess.run(
                ["git", "log", "--all", "--diff-filter=A", "--format=", "--name-only", "--", "."],
                cwd=self.root,
                text=True,
                capture_output=True,
            )
        except FileNotFoundError:  # brak gita
            return []
        pattern = rf"(?:^|/){re.escape(prefix)}-(\d+)\.md$"
        return [int(m.group(1)) for m in re.finditer(pattern, res.stdout, re.M)]

    def move(self, card_id: str, to: str, reason: str = "") -> list[str]:
        cards = self.cards()
        card = self.card(card_id, cards)
        reopen = card.status == "done" and to != "done"
        if reopen and not reason.strip():  # ponowne otwarcie tylko jawnie (SB-041)
            return [tr("kanban.error.reopen_reason", card_id=card_id)]
        skip = to == "done" and card.meta.get("tested_by") == "skip"
        if skip and not reason.strip():  # akceptacja bez testu — decyzja zapisana (SB-071)
            return [tr("kanban.error.skip_test_reason", card_id=card_id)]
        errors = self.gate_errors(card, to, cards)
        if not errors:
            note = tr("kanban.log.reopened", reason=reason.strip()) if reopen else reason.strip()
            card.move(to, checks.reset_stages(card, self.columns, to, note))  # #33
            card.save()
        return errors

    def check(self, card_id: str | None = None) -> dict[str, list[str]]:
        """Walidacja kart bez przesuwania: {id: błędy} (z kartami nieczytelnymi i cyklami)."""
        cards = self.cards()
        targets = [self.card(card_id, cards)] if card_id else cards
        result: dict[str, list[str]] = {}
        self.check_warnings = {}
        if not card_id:
            for name, error in self.load_errors.items():
                result[name] = [error]
        cycle = dependency_cycle(cards)
        config_warnings = wip_warnings(self.config.get("wip")) + checks.column_warnings(self.config)
        if config_warnings and not card_id:
            self.check_warnings["kanban/config.json"] = config_warnings
        for c in targets:
            result[c.id or c.path.name] = self.card_errors(c, cards, cycle)
            self.check_warnings[c.id or c.path.name] = self.warnings(c, cards)
        return result

    def card_errors(self, c: Card, cards: list[Card], cycle: str | None) -> list[str]:
        """Błędy jednej karty w `check` (cykl zależności liczony raz dla całej tablicy)."""
        errors = [
            tr("kanban.check.missing_field", field=key)
            for key in ("id", "title", "status", "model", "size")
            if not c.meta.get(key)
        ]
        if c.status not in self.columns:
            errors.append(tr("kanban.check.unknown_status", status=c.status))
        if c.path.name != f"{c.id}.md":
            errors.append(tr("kanban.check.filename"))
        if c.status in ("ready", "in-progress"):
            errors += self.ready_errors(c, cards)
        if c.status == "done":
            errors += self.done_errors(c, run_gate=False, closed=True)
        if cycle and c.id in cycle.split(" -> "):
            errors.append(tr("kanban.check.cycle", cycle=cycle))
        if sum(x.id == c.id for x in cards) > 1:
            errors.append(tr("kanban.check.duplicate_id", card_id=c.id))
        executor = c.meta.get("executor")
        if executor and executor != c.meta.get("model"):  # SB-046
            errors.append(
                tr("kanban.check.executor_mismatch", executor=executor, model=c.meta["model"])
            )
        return errors + self.transition_errors(c)

    def ready_cards(self, model: str, cards: list[Card] | None = None) -> list[Card]:
        """Karty `ready` modelu w kolejności priorytetu (P1 < P2 …), potem id."""
        pool = self.cards() if cards is None else cards
        ready = [c for c in pool if c.status == "ready" and c.meta.get("model") == model]
        return sorted(ready, key=priority_key)

    def next_card(self, model: str, cards: list[Card] | None = None) -> Card | None:
        ready = self.ready_cards(model, cards)
        return ready[0] if ready else None

    def print_board(self) -> None:
        cards = self.cards()
        for column in self.columns:
            items = [c for c in cards if c.status == column]
            print(f"\n■ {column.upper()} ({len(items)})")
            for c in items:
                print(checks.board_line(c, column))
        print()


def priority_key(card: Card) -> tuple[int, str]:
    """Kolejność kart w kolumnie: priorytet (P1 < P2 …), potem id."""
    return priority_rank(card.meta.get("priority", "")), card.id


def priority_rank(priority: str) -> int:
    """P1 < P2 < … < P10 (liczbowo); brak albo inny zapis → na koniec."""
    m = re.fullmatch(r"[Pp](\d+)", priority.strip())
    return int(m.group(1)) if m else 99


def print_json(data: object) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))


def find_root(arg: str | None) -> Path:
    """--root > KANBAN_ROOT > katalog główny repo git z bieżącego katalogu > bieżący katalog."""
    if arg or os.getenv("KANBAN_ROOT"):
        return Path(arg or os.environ["KANBAN_ROOT"]).expanduser().resolve()
    try:
        res = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"], text=True, capture_output=True
        )
    except FileNotFoundError:  # brak gita — tablica w bieżącym katalogu
        return Path.cwd()
    return Path(res.stdout.strip()) if res.returncode == 0 else Path.cwd()


# Kody wyjścia (stałe dla agentów): 0 sukces, 1 bramka/walidacja, 2 błąd użycia, 3 brak karty
EXIT_OK, EXIT_FAILED, EXIT_NOTHING = 0, 1, 3


def print_errors(header: str, errors: list[str]) -> None:
    print(header, file=sys.stderr)
    for e in errors:
        print(f"  - {e}", file=sys.stderr)


def cmd_board(board: Board, args: argparse.Namespace) -> int:
    if getattr(args, "json", False):
        cards = board.cards()
        columns = {
            col: [card_summary(c) for c in cards if c.status == col] for col in board.columns
        }
        print_json({"columns": columns, "unreadable": board.load_errors})
    else:
        board.print_board()
    return EXIT_OK


def cmd_new(board: Board, args: argparse.Namespace) -> int:
    card, errors = load_workflow().create_card(board, args)
    if errors:  # złe `--depends` (#34) — bez karty
        return print_errors(tr("kanban.cli.new_refused"), errors) or EXIT_FAILED
    print(tr("kanban.cli.created", path=card.path.relative_to(board.root)))
    return EXIT_OK


def cmd_move(board: Board, args: argparse.Namespace) -> int:
    frm = board.card(args.id).status
    errors = board.move(args.id, args.to, args.reason or "")
    if errors:
        print_errors(tr("kanban.cli.cannot_move", card_id=args.id, frm=frm, to=args.to), errors)
        return EXIT_FAILED
    print(f"✓ {args.id}: {frm} → {args.to}")
    return EXIT_OK


def cmd_set(board: Board, args: argparse.Namespace) -> int:
    errors = load_workflow().set_meta(board, args.id, args.key, args.value, args.reason or "")
    if errors:
        print_errors(tr("kanban.set.refused", card_id=args.id), errors)
        return EXIT_FAILED
    print(f"✓ {args.id}: {args.key} = {args.value}")
    return EXIT_OK


def cmd_check(board: Board, args: argparse.Namespace) -> int:
    result = board.check(args.id)
    warnings = {k: v for k, v in board.check_warnings.items() if v}
    ok = not any(result.values())
    if args.json:
        print_json({"ok": ok, "cards": result, "warnings": warnings})
    else:
        for card_id in [*(k for k in warnings if k not in result), *result]:
            errors = result.get(card_id, [])
            print(f"{'✗' if errors else '!' if warnings.get(card_id) else '✓'} {card_id}")
            for e in errors:
                print(f"  - {e}")
            for w in warnings.get(card_id, []):
                print(f"  ! {w}")
    return EXIT_OK if ok else EXIT_FAILED


def load_workflow():
    """workflow.py z pakietu albo leżący obok kopii w projekcie."""
    try:
        from . import workflow
    except ImportError:
        import workflow  # type: ignore[no-redef]
    return workflow


def cmd_next(board: Board, args: argparse.Namespace) -> int:
    if args.start:
        result = load_workflow().start(board, args.model)
    else:
        result = {
            "card": board.next_card(args.model),
            "branch": None,
            "base": None,
            "resumed": False,
            "errors": [],
        }
    card, errors = result["card"], result["errors"]
    if args.json:
        print_json({**result, "card": card_summary(card) if card else None})
    elif card is None:
        print(tr("kanban.cli.no_ready", model=args.model))
    elif errors:
        print_errors(tr("kanban.start.refused", card_id=card.id), errors)
    elif args.start:
        key = "kanban.start.resumed" if result["resumed"] else "kanban.start.started"
        print(tr(key, card_id=card.id, branch=result["branch"], base=result["base"]))
    else:
        print(card.path.relative_to(board.root))
    if card is None:
        return EXIT_NOTHING
    return EXIT_FAILED if errors else EXIT_OK


def cmd_submit(board: Board, args: argparse.Namespace) -> int:
    errors = load_workflow().submit(board, args.id)
    if args.json:
        print_json({"card": args.id, "status": board.card(args.id).status, "errors": errors})
    elif errors:
        print_errors(tr("kanban.submit.refused", card_id=args.id), errors)
    else:
        print(tr("kanban.submit.done", card_id=args.id))
    return EXIT_FAILED if errors else EXIT_OK


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=tr("kanban.cli.description"))
    parser.add_argument("--root", help=tr("kanban.cli.root_help"))
    sub = parser.add_subparsers(dest="cmd")
    p = sub.add_parser("board", help=tr("kanban.cli.board_help"))
    p.add_argument("--json", action="store_true", help=tr("kanban.cli.json_help"))
    p = sub.add_parser("new", help=tr("kanban.cli.new_help"))
    p.add_argument("title")
    p.add_argument("--model")  # domyślnie claude albo model karty z --from
    p.add_argument("--size", choices=SIZE_ORDER)
    p.add_argument("--priority")
    p.add_argument("--from", dest="source")  # temat z karty: model, priorytet, paczka (#31)
    p.add_argument("--depends", default="")  # ID kart po przecinku, walidacja jak `set` (#34)
    p = sub.add_parser("move", help=tr("kanban.cli.move_help"))
    p.add_argument("id")
    p.add_argument("to", choices=checks.ALL_COLUMNS)
    p.add_argument("--reason", help=tr("kanban.cli.reason_help"))
    p = sub.add_parser("set", help=tr("kanban.cli.set_help"))
    p.add_argument("id")
    p.add_argument("key")
    p.add_argument("value")
    p.add_argument("--reason", help=tr("kanban.cli.reason_help"))
    load_workflow().add_batch_parser(sub)  # paczki kart (SB-064)
    p = sub.add_parser("check", help=tr("kanban.cli.check_help"))
    p.add_argument("id", nargs="?")
    p.add_argument("--json", action="store_true", help=tr("kanban.cli.json_help"))
    p = sub.add_parser("next", help=tr("kanban.cli.next_help"))
    p.add_argument("model")
    p.add_argument("--start", action="store_true", help=tr("kanban.cli.start_help"))
    p.add_argument("--json", action="store_true", help=tr("kanban.cli.json_help"))
    p = sub.add_parser("submit", help=tr("kanban.cli.submit_help"))
    p.add_argument("id")
    p.add_argument("--json", action="store_true", help=tr("kanban.cli.json_help"))
    return parser


COMMANDS = {
    None: cmd_board,
    "board": cmd_board,
    "new": cmd_new,
    "move": cmd_move,
    "check": cmd_check,
    "set": cmd_set,
    "batch": lambda board, args: load_workflow().batch_main(board, args),
    "next": cmd_next,
    "submit": cmd_submit,
}


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return COMMANDS[args.cmd](Board(find_root(args.root)), args)
    except KanbanError as e:
        if getattr(args, "json", False):  # agent z --json dostaje JSON także przy błędzie
            print_json({"errors": [str(e)]})
        else:
            print(f"✗ {e}", file=sys.stderr)
        return EXIT_FAILED


if __name__ == "__main__":
    sys.exit(main())
