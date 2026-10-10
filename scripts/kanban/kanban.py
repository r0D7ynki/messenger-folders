#!/usr/bin/env python3
"""
Plikowa tablica Kanban dla agentów i ludzi (swarmboard). Komunikaty: locales/*.json (i18n.py).

Każda karta to plik kanban/tasks/<ID>.md z nagłówkiem (frontmatter) i sekcjami `## …`.
Skrypt pilnuje bramek: DoR przy wejściu do `ready`, DoR + WIP + gotowych zależności przy
`in-progress`, kryteriów akceptacji i sekcji Evidence przy `review`, DoD (ogólnego + modelowego)
i polecenia bramki projektu (`gate` w kanban/config.json) przy `done`.

Plik jest samowystarczalny (tylko biblioteka standardowa) — `swarmboard.py init` kopiuje go do
projektu (domyślnie scripts/kanban/kanban.py), żeby tablica działała bez swarmboard.
Most z rojem agentów (swarm_kanban.py) importuje ten moduł i używa tych samych bramek.

Użycie (z katalogu projektu albo z --root ŚCIEŻKA / KANBAN_ROOT):
  kanban.py                               tablica
  kanban.py new "Tytuł" [--model claude] [--size M] [--priority P2]
  kanban.py move FO-001 ready             przesunięcie z kontrolą bramki
  kanban.py check [FO-001]                walidacja bez przesuwania
  kanban.py next <model>                  pierwsza karta `ready` dla modelu
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

from i18n import tr

COLUMNS = ["backlog", "ready", "in-progress", "review", "done"]
SIZE_ORDER = ["S", "M", "L"]
# Zależność „zaplanowana” (wystarcza do ready) i „dostępna w kodzie” (wymagana do ręcznego startu).
# Kolejność wykonania zależnych kart pilnuje rój (DAG) albo ta bramka przy `in-progress`.
DEPS_PLANNED = {"ready", "in-progress", "review", "done"}
DEPS_AVAILABLE = {"review", "done"}

# Kanoniczne nagłówki sekcji → dawne polskie nagłówki (karty z messenger-folders nadal działają)
SECTION_ALIASES = {
    "Goal": ("Cel",),
    "Context": ("Kontekst",),
    "Files": ("Pliki",),
    "Acceptance criteria": ("Kryteria akceptacji",),
    "Verification": ("Weryfikacja",),
    "Out of scope": ("Poza zakresem",),
    "DoD": (),
    "Evidence": ("Dowód",),
    "Log": (),
}

# Znacznik nowego pliku w sekcji Files: `ścieżka (new)` albo `ścieżka (nowy)`
NEW_FILE_MARKERS = ("(new)", "(nowy)")
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
        self.config = json.loads(config_file.read_text(encoding="utf-8"))
        self.headings = self.config.get("headings", "en")
        if not isinstance(self.headings, str) or self.headings not in HEADINGS:
            raise KanbanError(
                tr("kanban.error.bad_headings", value=self.headings, allowed=", ".join(HEADINGS))
            )
        self.load_errors: dict[str, str] = {}  # plik → błąd; uzupełnia cards()

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
            except (KanbanError, UnicodeDecodeError) as e:
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
            errors.append(
                tr(
                    "kanban.dor.size_over_limit",
                    size=size,
                    model=meta["model"],
                    limit=model["max_size"],
                )
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
        active = [c for c in cards if c.status == "in-progress" and c.id != card.id]
        errors = []
        if "in-progress" in limits and len(active) >= limits["in-progress"]:
            errors.append(tr("kanban.wip.total", limit=limits["in-progress"]))
        per_model = limits.get("in-progress-per-model")
        manual = [c for c in active if not c.meta.get("worker")]
        if (
            per_model
            and sum(c.meta.get("model") == card.meta.get("model") for c in manual) >= per_model
        ):
            errors.append(tr("kanban.wip.per_model", model=card.meta.get("model"), limit=per_model))
        return errors

    def review_errors(self, card: Card, cards: list[Card], check_wip: bool = True) -> list[str]:
        errors = [
            tr("kanban.review.open_criterion", item=i)
            for i in card.checkboxes("Acceptance criteria")[1]
        ]
        if not card.section("Evidence"):
            errors.append(tr("kanban.review.no_evidence", section=self.heading("Evidence")))
        limit = self.config.get("wip", {}).get("review")
        if (
            check_wip
            and limit
            and sum(c.status == "review" and c.id != card.id for c in cards) >= limit
        ):
            errors.append(tr("kanban.review.wip", limit=limit))
        return errors

    def done_errors(self, card: Card, run_gate: bool) -> list[str]:
        total, open_items = card.checkboxes("DoD")
        errors = [tr("kanban.dod.missing")] if total == 0 else []
        errors += [tr("kanban.dod.open_item", item=i) for i in open_items]
        reviewer = card.meta.get("reviewer", "")
        if not reviewer:
            errors.append(tr("kanban.dod.no_reviewer"))
        elif reviewer == card.meta.get("model"):
            errors.append(tr("kanban.dod.self_review"))
        if run_gate and not errors:
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
                    tail = "\n".join(res.stdout.strip().splitlines()[-8:])
                    errors.append(
                        tr("kanban.dod.gate_failed", cmd=cmd, code=res.returncode, tail=tail)
                    )
        return errors

    def gate_errors(self, card: Card, to: str, cards: list[Card]) -> list[str]:
        """
        Błędy blokujące przejście karty do kolumny `to`. Skok o kilka kolumn przechodzi przez
        bramki wszystkich kolumn pośrednich; ruch w lewo — bez bramki.
        """
        if to not in COLUMNS:
            raise KanbanError(
                tr("kanban.error.unknown_column", column=to, columns=", ".join(COLUMNS))
            )
        start = COLUMNS.index(card.status) if card.status in COLUMNS else 0
        target = COLUMNS.index(to)
        errors: list[str] = []
        for column in COLUMNS[start + 1 : target + 1]:
            errors += [e for e in self._column_gate(card, column, cards) if e not in errors]
        return errors

    def _column_gate(self, card: Card, to: str, cards: list[Card]) -> list[str]:
        if to == "ready":
            return self.ready_errors(card, cards)
        if to == "in-progress":
            return (
                self.ready_errors(card, cards)
                + self.wip_errors(card, cards)
                + self._dependency_errors(card, cards, DEPS_AVAILABLE)
            )
        if to == "review":
            return self.review_errors(card, cards)
        if to == "done":
            others = [c for c in cards if c is not card]
            return self.review_errors(card, others, check_wip=False) + self.done_errors(card, True)
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
        numbers = [
            int(m.group(1))
            for c in self.cards()
            if (m := re.match(rf"^{re.escape(prefix)}-(\d+)$", c.id))
        ]
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
                "created": time.strftime("%Y-%m-%d"),
            },
            card_template(self.dod_checklist(model), self.headings),
        )
        self.tasks_dir.mkdir(parents=True, exist_ok=True)
        card.save()
        return card

    def move(self, card_id: str, to: str) -> list[str]:
        cards = self.cards()
        card = self.card(card_id, cards)
        errors = self.gate_errors(card, to, cards)
        if not errors:
            card.move(to)
            card.save()
        return errors

    def check(self, card_id: str | None = None) -> dict[str, list[str]]:
        """Walidacja kart bez przesuwania: {id: błędy} (z kartami nieczytelnymi i cyklami)."""
        cards = self.cards()
        targets = [self.card(card_id, cards)] if card_id else cards
        result: dict[str, list[str]] = {}
        if not card_id:
            for name, error in self.load_errors.items():
                result[name] = [error]
        cycle = dependency_cycle(cards)
        cycle_ids = set(cycle.split(" -> ")) if cycle else set()
        for c in targets:
            errors = [
                tr("kanban.check.missing_field", field=key)
                for key in ("id", "title", "status", "model", "size")
                if not c.meta.get(key)
            ]
            if c.status not in COLUMNS:
                errors.append(tr("kanban.check.unknown_status", status=c.status))
            if c.path.name != f"{c.id}.md":
                errors.append(tr("kanban.check.filename"))
            if c.status in ("ready", "in-progress"):
                errors += self.ready_errors(c, cards)
            if c.status == "done":
                errors += self.done_errors(c, run_gate=False)
            if c.id in cycle_ids:
                errors.append(tr("kanban.check.cycle", cycle=cycle))
            if sum(x.id == c.id for x in cards) > 1:
                errors.append(tr("kanban.check.duplicate_id", card_id=c.id))
            result[c.id or c.path.name] = errors
        return result

    def next_card(self, model: str) -> Card | None:
        ready = [c for c in self.cards() if c.status == "ready" and c.meta.get("model") == model]
        ready.sort(key=lambda c: (priority_rank(c.meta.get("priority", "")), c.id))
        return ready[0] if ready else None

    def print_board(self) -> None:
        cards = self.cards()
        for column in COLUMNS:
            items = [c for c in cards if c.status == column]
            print(f"\n■ {column.upper()} ({len(items)})")
            for c in items:
                deps = c.dependencies()
                extra = f"  ⇠ {','.join(deps)}" if deps else ""
                on_worker = c.meta.get("worker") and column == "in-progress"
                worker = f" @{c.meta['worker']}" if on_worker else ""
                print(
                    f"  {c.id}  [{c.meta.get('size', '?')}] {c.meta.get('priority', ''):<3} "
                    f"{c.meta.get('model', ''):<8} {c.meta.get('title', '')}{worker}{extra}"
                )
        print()


def priority_rank(priority: str) -> int:
    """P1 < P2 < … < P10 (liczbowo); brak albo inny zapis → na koniec."""
    m = re.fullmatch(r"[Pp](\d+)", priority.strip())
    return int(m.group(1)) if m else 99


# Token w backtickach to ścieżka, gdy ma `/` albo jedno z tych rozszerzeń (`Board.cards` — nie)
FILE_EXTENSIONS = {
    "py",
    "js",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    "jsx",
    "json",
    "md",
    "toml",
    "yml",
    "yaml",
    "html",
    "css",
    "sh",
    "txt",
    "sql",
    "cfg",
    "ini",
    "lock",
    "csv",
    "xml",
    "svg",
    "png",
    "po",
    "env",
}


def missing_files(root: Path, files_section: str) -> list[str]:
    """
    Ścieżki z sekcji Files, których brak na dysku. Nowy plik oznacza znacznik `(new)`/`(nowy)`
    w tej samej linii — w backtickach albo za nimi.
    """
    missing = []
    for line in files_section.splitlines():
        is_new = any(marker in line for marker in NEW_FILE_MARKERS)
        for ref in re.findall(r"`([^`]+)`", line):
            ref = ref.strip()
            for marker in NEW_FILE_MARKERS:
                ref = ref.removesuffix(marker).strip()
            path = re.sub(r":\d+(-\d+)?$", "", ref)
            extension = path.rsplit(".", 1)[-1].lower() if "." in path else ""
            if " " in path or ("/" not in path and extension not in FILE_EXTENSIONS):
                continue  # polecenie, nazwa funkcji, atrybut
            if not is_new and not (root / path).exists():
                missing.append(path)
    return missing


def dependency_cycle(cards: list[Card]) -> str | None:
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


def find_root(arg: str | None) -> Path:
    """--root > KANBAN_ROOT > katalog główny repo git z bieżącego katalogu > bieżący katalog."""
    if arg or os.getenv("KANBAN_ROOT"):
        return Path(arg or os.environ["KANBAN_ROOT"]).expanduser().resolve()
    res = subprocess.run(["git", "rev-parse", "--show-toplevel"], text=True, capture_output=True)
    return Path(res.stdout.strip()) if res.returncode == 0 else Path.cwd()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=tr("kanban.cli.description"))
    parser.add_argument("--root", help=tr("kanban.cli.root_help"))
    sub = parser.add_subparsers(dest="cmd")
    sub.add_parser("board", help=tr("kanban.cli.board_help"))
    p_new = sub.add_parser("new", help=tr("kanban.cli.new_help"))
    p_new.add_argument("title")
    p_new.add_argument("--model", default="claude")
    p_new.add_argument("--size", default="M", choices=SIZE_ORDER)
    p_new.add_argument("--priority", default="P2")
    p_move = sub.add_parser("move", help=tr("kanban.cli.move_help"))
    p_move.add_argument("id")
    p_move.add_argument("to", choices=COLUMNS)
    p_check = sub.add_parser("check", help=tr("kanban.cli.check_help"))
    p_check.add_argument("id", nargs="?")
    p_next = sub.add_parser("next", help=tr("kanban.cli.next_help"))
    p_next.add_argument("model")
    args = parser.parse_args(argv)

    try:
        board = Board(find_root(args.root))
        if args.cmd in (None, "board"):
            board.print_board()
        elif args.cmd == "new":
            card = board.create(args.title, args.model, args.size, args.priority)
            print(tr("kanban.cli.created", path=card.path.relative_to(board.root)))
        elif args.cmd == "move":
            frm = board.card(args.id).status
            errors = board.move(args.id, args.to)
            if errors:
                print(
                    tr("kanban.cli.cannot_move", card_id=args.id, frm=frm, to=args.to),
                    file=sys.stderr,
                )
                for e in errors:
                    print(f"  - {e}", file=sys.stderr)
                return 1
            print(f"✓ {args.id}: {frm} → {args.to}")
        elif args.cmd == "check":
            result = board.check(args.id)
            for card_id, errors in result.items():
                print(f"{'✗' if errors else '✓'} {card_id}")
                for e in errors:
                    print(f"  - {e}")
            return 1 if any(result.values()) else 0
        elif args.cmd == "next":
            card = board.next_card(args.model)
            print(
                card.path.relative_to(board.root)
                if card
                else tr("kanban.cli.no_ready", model=args.model)
            )
    except KanbanError as e:
        print(f"✗ {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
