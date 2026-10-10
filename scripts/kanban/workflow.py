"""
Przepływ pracy wykonawcy: `next --start` (karta → gałąź + in-progress) i `submit` (bramka → review).

Kopiowany do projektów razem z kanban.py (`sb init` / `sb upgrade`). Celowo nie importuje kanban.py:
dostaje obiekt tablicy (`Board`) i zwraca listy błędów — w kopii uruchamianej jako skrypt import
kanban.py dałby drugą klasę `KanbanError`, której `main()` by nie złapał. Tylko stdlib.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Any

try:  # w pakiecie swarmboard
    from .i18n import tr
except ImportError:  # kopia w projekcie — katalog skryptu jest już w sys.path (kanban.py)
    from i18n import tr  # type: ignore[no-redef]


def git_run(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(["git", *args], cwd=root, text=True, capture_output=True)
    except FileNotFoundError:
        return subprocess.CompletedProcess(["git", *args], 127, "", "git: not found")


def slugify(title: str) -> str:
    """Tytuł karty → fragment nazwy gałęzi (ASCII, małe litery, myślniki, ≤ 40 znaków)."""
    table = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")
    slug = re.sub(r"[^a-z0-9]+", "-", title.translate(table).lower()).strip("-")
    return slug[:40].rstrip("-") or "card"


def card_branch(card: Any) -> str:
    return f"{card.id.lower()}-{slugify(card.meta.get('title', ''))}"


def branch_exists(root: Path, name: str) -> bool:
    return git_run(root, "rev-parse", "--verify", "-q", f"refs/heads/{name}").returncode == 0


def main_branch(board: Any) -> str | None:
    """
    Gałąź główna pracy ręcznej: `main_branch` w kanban/config.json > domyślna gałąź remote
    (origin/HEAD) > main albo master. None, gdy nie da się ustalić — bez zgadywania z HEAD.
    """
    configured = board.config.get("main_branch")
    if configured:
        return str(configured)
    remote = git_run(board.root, "symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD")
    if remote.returncode == 0 and remote.stdout.strip():
        name = remote.stdout.strip().removeprefix("origin/")
        if branch_exists(board.root, name):
            return name
    for name in ("main", "master"):
        if branch_exists(board.root, name):
            return name
    return None


def start_base(board: Any, card: Any, cards: list[Any], main: str) -> str:
    """
    Baza gałęzi karty: najnowsza niescalona gałąź zależności w `review` (Z15), inaczej gałąź
    główna. Gałąź zależności już scalona do gałęzi głównej jest pomijana (byłaby przestarzała).
    """
    by_id = {c.id: c for c in cards}
    for dep in card.dependencies():
        if not by_id.get(dep) or by_id[dep].status != "review":
            continue
        refs = git_run(
            board.root,
            "for-each-ref",
            "--sort=-committerdate",
            "--format=%(refname:short)",
            f"refs/heads/{dep.lower()}-*",
        ).stdout.split()
        for ref in refs:
            merged = git_run(board.root, "merge-base", "--is-ancestor", ref, main).returncode == 0
            if not merged:
                return ref
    return main


def commit_card(board: Any, card: Any, message: str) -> str | None:
    """Commit samego pliku karty; zwraca błąd albo None."""
    rel = str(card.path.relative_to(board.root))
    git_run(board.root, "add", "--", rel)
    res = git_run(board.root, "commit", "-q", "-m", message, "--", rel)
    return None if res.returncode == 0 else (res.stderr or res.stdout).strip()


def pick_startable(board: Any, model: str, cards: list[Any]) -> tuple[Any, list[str]]:
    """Pierwsza karta `ready` modelu (wg priorytetu), która przechodzi bramkę in-progress."""
    first: tuple[Any, list[str]] = (None, [])
    for card in board.ready_cards(model, cards):
        errors = board.gate_errors(card, "in-progress", cards)
        if not errors:
            return card, []
        if first[0] is None:
            first = (card, errors)
    return first


def start(board: Any, model: str) -> dict[str, Any]:
    """
    Najwyższa karta `ready` modelu, która przechodzi bramkę in-progress (DoR + WIP + zależności):
    gałąź `<id>-<tytuł>` (istniejąca — wznowiona), `in-progress`, wpis w Logu, commit karty.
    """
    result: dict[str, Any] = {"card": None, "branch": None, "base": None, "resumed": False}
    cards = board.cards()
    card, errors = pick_startable(board, model, cards)
    result["card"] = card
    if card is None or errors:
        return {**result, "errors": errors}
    main = main_branch(board)
    if main is None:
        return {**result, "errors": [tr("kanban.start.no_main_branch")]}
    if git_run(board.root, "status", "--porcelain", "--untracked-files=no").stdout.strip():
        return {**result, "errors": [tr("kanban.start.dirty")]}
    branch = card_branch(card)
    resumed = branch_exists(board.root, branch)
    base = branch if resumed else start_base(board, card, cards, main)
    command = ["switch", branch] if resumed else ["switch", "-c", branch, base]
    res = git_run(board.root, *command)
    if res.returncode != 0:
        error = tr("kanban.start.branch_failed", error=res.stderr.strip())
        return {**result, "branch": branch, "base": base, "errors": [error]}
    card = board.card(card.id)  # treść karty z gałęzi, na którą przełączono
    card.meta["branch"] = branch
    note = "kanban.log.resumed" if resumed else "kanban.log.started"
    card.move("in-progress", tr(note, branch=branch, base=base))
    card.save()
    failed = commit_card(board, card, f"chore(kanban): {card.id} → in-progress ({branch})")
    errors = [tr("kanban.start.commit_failed", error=failed)] if failed else []
    result.update(card=card, branch=branch, base=base, resumed=resumed)
    return {**result, "errors": errors}


def submit(board: Any, card_id: str) -> list[str]:
    """
    Oddanie karty: musi być `in-progress`, na swojej gałęzi, z zacommitowaną pracą (czyste drzewo),
    z odhaczonymi kryteriami i Evidence; bramka projektu musi przejść → `review` + commit karty.
    """
    cards = board.cards()
    card = board.card(card_id, cards)
    if card.status != "in-progress":
        return [tr("kanban.submit.not_in_progress", card_id=card_id, status=card.status)]
    if not board.config.get("gate"):
        return [tr("kanban.submit.no_gate")]
    branch = card.meta.get("branch")
    current = git_run(board.root, "rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    if branch and current != branch:
        return [tr("kanban.submit.wrong_branch", branch=branch, current=current)]
    if git_run(board.root, "status", "--porcelain").stdout.strip():
        return [tr("kanban.submit.uncommitted")]
    errors = board.review_errors(card, cards) or board.run_gate(tail_lines=20)
    if errors:
        return errors
    card.move("review", tr("kanban.log.submitted"))
    card.save()
    failed = commit_card(board, card, f"chore(kanban): {card.id} → review")
    return [tr("kanban.start.commit_failed", error=failed)] if failed else []
