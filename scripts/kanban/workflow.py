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


def status_on_branch(board: Any, card: Any) -> str | None:
    """
    Status karty na jej niescalonej gałęzi (`<id>-<tytuł>`); None, gdy gałęzi nie ma albo jest już
    scalona do gałęzi głównej (np. karta ponownie otwarta po `done`).
    """
    branch = card_branch(card)
    main = main_branch(board)
    if not branch_exists(board.root, branch) or not main:
        return None
    if git_run(board.root, "merge-base", "--is-ancestor", branch, main).returncode == 0:
        return None
    rel = card.path.relative_to(board.root).as_posix()
    res = git_run(board.root, "show", f"refs/heads/{branch}:./{rel}")  # ./ — tablica w podkatalogu
    if res.returncode != 0:
        return None
    match = re.search(r"^status:\s*(\S+)", res.stdout, re.M)
    return match.group(1) if match else None


def pick_startable(board: Any, model: str, cards: list[Any]) -> tuple[Any, list[str]]:
    """Pierwsza karta `ready` modelu (wg priorytetu), która przechodzi bramkę in-progress."""
    first: tuple[Any, list[str]] = (None, [])
    for card in board.ready_cards(model, cards):
        errors = board.gate_errors(card, "in-progress", cards)
        # Gałąź karty bywa przed gałęzią główną (np. `review` czeka na scalenie) — SB-057
        on_branch = None if errors else status_on_branch(board, card)
        if on_branch in ("review", "done"):
            errors = [tr("kanban.start.branch_ahead", branch=card_branch(card), status=on_branch)]
        if not errors:
            return card, []
        if first[0] is None:
            first = (card, errors)
    return first


def watcher_running_here(board: Any) -> bool:
    """
    Watcher roju działa na tym repo, a tablica leży w jego głównym drzewie (SB-033) — ręczne
    `start`/`submit` przełączałyby gałąź i commitowały kartę w trakcie scalania roju.
    """
    try:
        import fcntl
    except ImportError:  # bez flock (Windows) — bez tej kontroli
        return False
    dirs = git_run(board.root, "rev-parse", "--git-dir", "--git-common-dir").stdout.splitlines()
    if len(dirs) != 2 or Path(board.root, dirs[0]).resolve() != Path(board.root, dirs[1]).resolve():
        return False  # osobny worktree — praca ręczna obok roju jest bezpieczna
    lock = Path(board.root, dirs[1], "swarm", "watcher.lock")
    if not lock.exists():
        return False
    with open(lock) as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_SH | fcntl.LOCK_NB)
        except OSError:
            return True
        fcntl.flock(handle, fcntl.LOCK_UN)
    return False


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
    if watcher_running_here(board):
        return {**result, "errors": [tr("kanban.start.watcher_running")]}
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
    card.meta["executor"] = model  # faktyczny wykonawca — bramka done porównuje z reviewerem
    card.meta["base"] = base  # baza gałęzi — zakres plików przy submit liczony od niej
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
    main = main_branch(board)
    if not branch and current == main:  # karta bez gałęzi (np. ręczny status) — SB-039
        return [tr("kanban.submit.on_main", branch=main)]
    if git_run(board.root, "status", "--porcelain").stdout.strip():
        return [tr("kanban.submit.uncommitted")]
    if watcher_running_here(board):
        return [tr("kanban.start.watcher_running")]
    outside = files_outside_scope(board, card, scope_base(board, card, main))
    if outside and board.config.get("scope") == "strict":
        return [tr("kanban.submit.scope_outside", files=", ".join(outside))]
    errors = board.review_errors(card, cards) or board.run_gate(tail_lines=20)
    if errors:
        return errors
    if outside:  # tryb domyślny: ostrzeżenie w Logu karty (SB-040)
        card.append_log(tr("kanban.log.scope_outside", files=", ".join(outside)))
    card.move("review", tr("kanban.log.submitted"))
    card.save()
    failed = commit_card(board, card, f"chore(kanban): {card.id} → review")
    return [tr("kanban.start.commit_failed", error=failed)] if failed else []


def scope_base(board: Any, card: Any, main: str | None) -> str | None:
    """Baza gałęzi karty (`base:` z startu, np. gałąź niescalonej zależności), inaczej główna."""
    base = card.meta.get("base")
    if base and git_run(board.root, "rev-parse", "--verify", "-q", base).returncode == 0:
        return base
    return main


# Wartości metadanych (SB-066): bez nowej linii — inaczej dopisałaby klucze nagłówka (status)
META_VALUES = {"branch": re.compile(r"^[\w./-]+$"), "priority": re.compile(r"^[Pp]\d+$")}


def set_meta(board: Any, card_id: str, key: str, value: str, reason: str = "") -> list[str]:
    """Zmiana metadanej karty z wpisem administracyjnym w Logu (bez bramek; także po done)."""
    if key not in META_VALUES:
        return [tr("kanban.set.bad_key", name=key, keys=", ".join(META_VALUES))]
    if not META_VALUES[key].match(value) or "\n" in reason:
        return [tr("kanban.set.bad_value", name=key, value=value)]
    card = board.card(card_id)
    old = card.meta.get(key, "")
    card.meta[key] = value
    entry = tr("kanban.log.meta", name=key, old=old or "—", new=value or "—", reason=reason)
    card.append_log(entry.rstrip())
    card.save()
    return []


def files_outside_scope(board: Any, card: Any, base: str | None) -> list[str]:
    """
    Pliki zmienione na gałęzi karty (od rozwidlenia z bazą) spoza sekcji Files — poza plikiem
    samej karty; wpis zakończony `/` obejmuje katalog (SB-040). Ścieżki względem tablicy.
    """
    if not base:
        return []
    res = git_run(board.root, "diff", "--name-only", "--relative", f"{base}...HEAD")
    if res.returncode != 0:
        return []
    allowed = {path for path, _ in board.section_paths(card.section("Files"), any_name=True)}
    allowed.add(card.path.relative_to(board.root).as_posix())
    folders = tuple(a if a.endswith("/") else a + "/" for a in allowed)
    return [
        f for f in res.stdout.split("\n") if f and f not in allowed and not f.startswith(folders)
    ]
