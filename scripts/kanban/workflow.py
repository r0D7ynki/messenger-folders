"""
Przepływ pracy wykonawcy: `next --start` (karta → gałąź + in-progress) i `submit` (bramka → review).

Kopiowany do projektów razem z kanban.py (`sb init` / `sb upgrade`). Celowo nie importuje kanban.py:
dostaje obiekt tablicy (`Board`) i zwraca listy błędów — w kopii uruchamianej jako skrypt import
kanban.py dałby drugą klasę `KanbanError`, której `main()` by nie złapał. Tylko stdlib.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

try:  # w pakiecie swarmboard
    from .checks import (
        NO_BATCH,
        batch_decided,
        batch_of,
        budget_limit,
        dependency_cycle,
        reset_stages,
        test_first,
    )
    from .i18n import tr
except ImportError:  # kopia w projekcie — katalog skryptu jest już w sys.path (kanban.py)
    from checks import (  # type: ignore[no-redef]
        NO_BATCH,
        batch_decided,
        batch_of,
        budget_limit,
        dependency_cycle,
        reset_stages,
        test_first,
    )
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
    return commit_cards(board, [card], message)


def commit_cards(board: Any, cards: list[Any], message: str) -> str | None:
    """Commit samych plików kart (np. całej paczki jednym commitem); zwraca błąd albo None."""
    rels = [str(card.path.relative_to(board.root)) for card in cards]
    git_run(board.root, "add", "--", *rels)
    res = git_run(board.root, "commit", "-q", "-m", message, "--", *rels)
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
        if on_branch in ("review", "test", "done"):
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
    to = "test" if test_first(board.columns) else "review"  # test przed przeglądem (#29)
    card.move(to, tr("kanban.log.submitted"))
    card.save()
    failed = commit_card(board, card, f"chore(kanban): {card.id} → {to}")
    return [tr("kanban.start.commit_failed", error=failed)] if failed else []


def scope_base(board: Any, card: Any, main: str | None) -> str | None:
    """Baza gałęzi karty (`base:` z startu, np. gałąź niescalonej zależności), inaczej główna."""
    base = card.meta.get("base")
    if base and git_run(board.root, "rev-parse", "--verify", "-q", base).returncode == 0:
        return base
    return main


# Wartości metadanych (SB-066): bez nowej linii — inaczej dopisałaby klucze nagłówka (status)
META_VALUES = {
    "branch": re.compile(r"^[\w./-]+$"),
    "priority": re.compile(r"^[Pp]\d+$"),
    "batch": re.compile(r"^[\w.-]+$"),  # paczka kart (SB-064); pusta wartość = bez paczki
    "tested_by": re.compile(r"^[\w.@-]+$"),  # kto przetestował (#29)
    "question": re.compile(r"^\S.*$"),  # pytanie do właściciela — karta czeka na człowieka (#31)
    "depends": re.compile(r"^\[?\s*[\w-]+(\s*,\s*[\w-]+)*\s*\]?$"),  # ID kart (#34)
}


def checked_depends(board: Any, card: Any, value: str) -> tuple[str, list[str]]:
    """
    `depends` karty (#34): lista ID (`A,B` albo `[A, B]`) → `[A, B]`; błąd, gdy ID nie istnieje,
    karta zależy od siebie albo powstaje cykl zależności.
    """
    from_cards = [c for c in board.cards() if c.id != card.id]
    ids = list(dict.fromkeys(i for i in re.split(r"[\s,\[\]]+", value) if i))
    known = {c.id for c in from_cards}
    unknown = [i for i in ids if i not in known and i != card.id]
    if unknown:
        return value, [tr("kanban.set.depends_unknown", ids=", ".join(unknown))]
    normalized = f"[{', '.join(ids)}]"
    old = card.meta.get("depends", "[]")
    card.meta["depends"] = normalized
    cycle = (
        dependency_cycle([*from_cards, card]) if card.id not in ids else f"{card.id} -> {card.id}"
    )
    card.meta["depends"] = old
    return normalized, [tr("kanban.check.cycle", cycle=cycle)] if cycle else []


def followup_batch(source: Any) -> str:
    """
    Paczka karty z tematu (#31): `<paczka źródła>-followup` — ten sam moduł, ale bez dołączania
    do paczki w toku (start i `batch move` paczki źródła nie czekają na nową kartę); bez — `none`.
    """
    batch = batch_of(source)
    return f"{batch}-followup" if batch else NO_BATCH


def create_card(board: Any, args: Any) -> tuple[Any, list[str]]:
    """
    `new` (#31): z `--from <ID>` karta dziedziczy model, priorytet i paczkę karty źródłowej,
    rozmiar S, `source:` i wpis w Logu; bez — model claude, rozmiar M, priorytet P2.
    """
    source = board.card(args.source) if getattr(args, "source", None) else None
    meta = source.meta if source else {}
    model = args.model or meta.get("model") or "claude"
    size = args.size or ("S" if source else "M")
    depends = ",".join(filter(None, [source.id if source else "", getattr(args, "depends", "")]))
    if depends:  # walidacja przed utworzeniem — bez pustej karty po błędzie (#34)
        draft = type("Draft", (), {"id": "", "meta": {}})()
        _, errors = checked_depends(board, draft, depends)
        if errors:
            return None, errors
    card = board.create(args.title, model, size, args.priority or meta.get("priority") or "P2")
    if depends:
        card.meta["depends"] = checked_depends(board, card, depends)[0]
        card.save()
    if source:
        card.meta["batch"] = followup_batch(source)
        card.meta["source"] = f"{source.id} manual -"
        card.append_log(tr("kanban.log.created_from", card_id=source.id))
        card.save()
    return card, []


def set_meta(board: Any, card_id: str, key: str, value: str, reason: str = "") -> list[str]:
    """Zmiana metadanej karty z wpisem administracyjnym w Logu (bez bramek; także po done)."""
    if key not in META_VALUES:
        return [tr("kanban.set.bad_key", name=key, keys=", ".join(META_VALUES))]
    clearable = key in ("batch", "question", "depends")  # pusta = bez paczki / pytania / zależności
    if (value or not clearable) and not META_VALUES[key].match(value) or "\n" in reason:
        return [tr("kanban.set.bad_value", name=key, value=value)]
    card = board.card(card_id)
    old = card.meta.get(key, "")
    if key == "depends":
        value, errors = checked_depends(board, card, value)
        if errors:
            return errors
    card.meta[key] = value
    entry = tr("kanban.log.meta", name=key, old=old or "—", new=value or "—", reason=reason)
    card.append_log(entry.rstrip())
    card.save()
    return []


def files_outside_scope(board: Any, card: Any, base: str | None) -> list[str]:
    """
    Pliki zmienione na gałęzi karty (od rozwidlenia z bazą) spoza sekcji Files — poza plikiem
    samej karty; wpis zakończony `/` obejmuje katalog (SB-040). Ścieżki względem tablicy.
    Paczka (lista kart): zakres = suma sekcji Files i plików kart (SB-064).
    """
    cards = card if isinstance(card, list) else [card]
    if not base:
        return []
    res = git_run(board.root, "diff", "--name-only", "--relative", f"{base}...HEAD")
    if res.returncode != 0:
        return []
    allowed = {
        path for c in cards for path, _ in board.section_paths(c.section("Files"), any_name=True)
    }
    allowed |= {c.path.relative_to(board.root).as_posix() for c in cards}
    folders = tuple(a if a.endswith("/") else a + "/" for a in allowed)
    return [
        f for f in res.stdout.split("\n") if f and f not in allowed and not f.startswith(folders)
    ]


# --- Paczki kart (SB-064): wspólna gałąź, sesja, bramka i Dowód ---


def module_of(paths: list[str]) -> str:
    """Moduł karty do grupowania: najczęstszy katalog plików kodu z sekcji Files."""
    code = [p for p in paths if not p.startswith(("tests/", "docs/", "kanban/"))] or paths
    folders = [str(Path(p).parent) for p in code]
    return max(set(folders), key=folders.count) if folders else "."


BATCH_MAX = 4  # domyślnie: większa paczka to dłuższa sesja, więcej kontekstu i ryzyko rebase


def listed(value: Any) -> list:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("not a list")
    return value


def release_of(board: Any) -> tuple[dict[str, str], list[str]]:
    """
    Karta → wydanie (grupa wydania) z `kanban/releases/*.json`; różne wydania — różne paczki.
    Drugi element: nazwy uszkodzonych manifestów — plan ich nie zgaduje (granica wydania).
    """
    found: dict[str, str] = {}
    invalid: list[str] = []
    for path in sorted((board.root / "kanban" / "releases").glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, dict) or not isinstance(data.get("scope", {}), dict):
                raise ValueError("not an object")
            release = str(data.get("id") or path.stem)
            for card in listed(data.get("scope", {}).get("cards")):
                found.setdefault(str(card), release)
            for group in listed(data.get("release_groups")):
                if not isinstance(group, dict):
                    raise ValueError("group not an object")
                for card in listed(group.get("cards")):
                    found[str(card)] = f"{release}/{group.get('id')}"
        except (OSError, ValueError):
            invalid.append(path.name)
    return found, invalid


def code_paths(board: Any, card: Any) -> list[str]:
    paths = [p for p, _ in board.section_paths(card.section("Files"), any_name=True)]
    return [p for p in paths if not p.startswith(("tests/", "docs/", "kanban/"))]


def plan_batches(board: Any, model: str) -> dict[str, list[Any]] | None:
    """
    Propozycja paczek: karty modelu w backlog/ready bez decyzji o paczce (puste `batch:`; `none`
    to decyzja) z tego samego modułu i wydania, co najmniej 2 — planista przed ready (#29).
    Bez kart z niespełnioną zależnością spoza paczki (DAG) i najwyżej `batch_max` kart (SB-135).
    """
    cards = board.cards()
    done = {c.id for c in cards if c.status == "done"}
    limit = board.config.get("batch_max", BATCH_MAX)
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
        limit = BATCH_MAX
    releases, invalid = release_of(board)
    if invalid:  # a broken manifest would silently erase a release boundary
        print(tr("kanban.batch.release_invalid", files=", ".join(invalid)), file=sys.stderr)
        return None
    taken = {batch_of(c) for c in cards}  # existing batches keep their own names
    proposals: dict[str, list[Any]] = {}
    for (module, _), members in sorted(candidate_groups(board, cards, model, releases).items()):
        for chunk in pack(board, dag_closed(members, done), limit):
            name, n = module, 2
            while name in proposals or name in taken:
                name, n = f"{module}-{n}", n + 1
            proposals[name] = chunk
    return proposals


def pack(board: Any, members: list[Any], limit: int) -> list[list[Any]]:
    """
    Paczki po `limit` kart złożone z całych składowych zależności: karta i jej zależność w grupie
    zawsze trafiają razem, więc dwie paczki nigdy nie czekają na siebie nawzajem. Składowa
    większa niż limit nie jest proponowana (decyzja planisty); paczka ma co najmniej 2 karty.
    """
    by_id = {c.id: c for c in members}
    parent = {c.id: c.id for c in members}

    def root(card_id: str) -> str:
        while parent[card_id] != card_id:
            card_id = parent[card_id]
        return card_id

    for card in members:
        for dep in card.dependencies():
            if dep in by_id:
                parent[root(card.id)] = root(dep)
    components: dict[str, list[Any]] = {}
    for card in sorted(members, key=lambda c: (code_paths(board, c)[:1], c.id)):
        components.setdefault(root(card.id), []).append(card)
    chunks: list[list[Any]] = []
    current: list[Any] = []
    for component in components.values():
        if len(component) > limit:  # no silent gap: the planner decides such chains by hand
            ids = ", ".join(c.id for c in component)
            print(tr("kanban.batch.too_large", cards=ids, limit=limit), file=sys.stderr)
            continue
        if len(current) + len(component) > limit:
            chunks.append(current)
            current = []
        current += component
    chunks.append(current)
    return [chunk for chunk in chunks if len(chunk) > 1]


def candidate_groups(
    board: Any, cards: list[Any], model: str, releases: dict[str, str]
) -> dict[tuple[str, str], list]:
    """Karty bez decyzji o paczce pogrupowane po module i wydaniu (granice wydań, SB-135)."""
    groups: dict[tuple[str, str], list[Any]] = {}
    for card in cards:
        if card.meta.get("model") != model or card.status not in ("backlog", "ready"):
            continue
        if batch_decided(card):
            continue
        paths = [p for p, _ in board.section_paths(card.section("Files"), any_name=True)]
        groups.setdefault((slugify(module_of(paths)), releases.get(card.id, "")), []).append(card)
    return groups


def dag_closed(members: list[Any], done: set[str]) -> list[Any]:
    """Bez kart, których niespełniona zależność leży poza paczką — zatrzymałaby jej start."""
    while True:
        ids = {c.id for c in members}
        kept = [c for c in members if set(c.dependencies()) <= done | ids]
        if len(kept) == len(members):
            return kept
        members = kept


def batch_details(board: Any, cards: list[Any]) -> str:
    """Wspólne pliki kodu, profil modelu i szacowany budżet paczki (SB-135)."""
    seen: dict[str, int] = {}
    for card in cards:
        for path in set(code_paths(board, card)):
            seen[path] = seen.get(path, 0) + 1
    shared = ", ".join(sorted(p for p, n in seen.items() if n > 1)) or "—"
    profiles = sorted(
        {
            "/".join(
                str(c.meta.get(k))
                for k in ("implementation_model", "implementation_effort")
                if c.meta.get(k)
            )
            or str(c.meta.get("model") or "?")
            for c in cards
        }
    )
    budget = f"{sum(budget_limit(board.config, c) for c in cards):,}".replace(",", " ")
    return tr("kanban.batch.details", shared=shared, profile=", ".join(profiles), budget=budget)


def batch_start_errors(board: Any, ready: list[Any], cards: list[Any]) -> list[str]:
    """Bramka in-progress kart paczki; startują razem — zależność w paczce jest już w toku (Z39)."""
    ids = {c.id for c in ready}
    view = [
        type(c)(c.path, {**c.meta, "status": "in-progress"}, c.body) if c.id in ids else c
        for c in cards
    ]
    return [
        f"{c.id}: {e}"
        for c in ready
        for e in board.gate_errors(c, "in-progress", [c if k.id == c.id else k for k in view])
    ]


def batch_branch(name: str) -> str:
    return f"batch-{slugify(name)}"


def start_batch(board: Any, name: str, model: str) -> list[str]:
    """Karty ready paczki modelu → jedna gałąź `batch-<nazwa>` i in-progress, jeden commit."""
    cards = board.cards()
    if name.lower() == NO_BATCH:  # `none` = karty bez paczki, nie paczka (#29)
        return [tr("kanban.batch.none_name", none=NO_BATCH)]
    members = [c for c in cards if batch_of(c) == name and c.meta.get("model") == model]
    ready = [c for c in members if c.status == "ready"]
    if not ready:
        return [tr("kanban.batch.empty", batch=name, status="ready")]
    # Paczka startuje cała — karta jeszcze przed ready czeka razem z nią (#29)
    errors = [
        tr("kanban.batch.not_ready", card_id=c.id, status=c.status)
        for c in members
        if c.status == "backlog"
    ] + batch_start_errors(board, ready, cards)
    main = main_branch(board)
    if main is None:
        errors.append(tr("kanban.start.no_main_branch"))
    elif watcher_running_here(board):
        errors.append(tr("kanban.start.watcher_running"))
    elif git_run(board.root, "status", "--porcelain", "--untracked-files=no").stdout.strip():
        errors.append(tr("kanban.start.dirty"))
    if errors:
        return errors
    branch = batch_branch(name)
    exists = branch_exists(board.root, branch)
    res = git_run(board.root, *(["switch", branch] if exists else ["switch", "-c", branch, main]))
    if res.returncode != 0:
        return [tr("kanban.start.branch_failed", error=res.stderr.strip())]
    started = []
    for card in ready:
        card = board.card(card.id)  # treść z gałęzi paczki
        card.meta.update(branch=branch, executor=model, base=main)
        card.move("in-progress", tr("kanban.log.batch_started", batch=name, branch=branch))
        card.save()
        started.append(card)
    failed = commit_cards(board, started, f"chore(kanban): paczka {name} → in-progress ({branch})")
    return [tr("kanban.start.commit_failed", error=failed)] if failed else []


def submit_batch(board: Any, name: str) -> list[str]:
    """Paczka → review: kryteria i Dowód każdej karty, zakres = suma Files, JEDNA bramka."""
    cards = board.cards()
    batch = [c for c in cards if batch_of(c) == name and c.status == "in-progress"]
    refused = submit_refused(board, name, batch)
    if refused:
        return refused
    outside = files_outside_scope(board, batch, scope_base(board, batch[0], main_branch(board)))
    if outside and board.config.get("scope") == "strict":
        return [tr("kanban.submit.scope_outside", files=", ".join(outside))]
    errors = [f"{c.id}: {e}" for c in batch for e in board.review_errors(c, cards)]
    errors = errors or board.run_gate(tail_lines=20)
    to = "test" if test_first(board.columns) else "review"  # test przed przeglądem (#29)
    if errors:
        return errors
    for card in batch:
        if outside:
            card.append_log(tr("kanban.log.scope_outside", files=", ".join(outside)))
        card.move(to, tr("kanban.log.batch_submitted", batch=name, count=len(batch)))
        card.save()
    failed = commit_cards(board, batch, f"chore(kanban): paczka {name} → {to}")
    return [tr("kanban.start.commit_failed", error=failed)] if failed else []


def submit_refused(board: Any, name: str, batch: list[Any]) -> list[str]:
    """Warunki oddania paczki: karty w toku, na gałęzi paczki, czyste drzewo, bez watchera obok."""
    if not batch:
        return [tr("kanban.batch.empty", batch=name, status="in-progress")]
    current = git_run(board.root, "rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    wrong = [c.id for c in batch if c.meta.get("branch") != current]
    if wrong:
        return [tr("kanban.batch.wrong_branch", cards=", ".join(wrong), current=current)]
    if git_run(board.root, "status", "--porcelain").stdout.strip():
        return [tr("kanban.submit.uncommitted")]
    if watcher_running_here(board):
        return [tr("kanban.start.watcher_running")]
    return []


def move_batch(board: Any, name: str, to: str, reason: str = "", tested_by: str = "") -> list[str]:
    """
    Wszystkie karty paczki do kolumny — bramki kart, a bramka projektu RAZ dla całej paczki;
    `tested_by` — kto przetestował paczkę (test człowieka przed przeglądem, #29).
    """
    cards = board.cards()
    batch = [c for c in cards if batch_of(c) == name and c.status != to]
    if not batch:
        return [tr("kanban.batch.empty", batch=name, status="≠ " + to)]
    if tested_by and to not in ("review", "done"):  # podpis testu tylko przy wyjściu z testu
        return [tr("kanban.batch.tested_by_target", to=to)]
    if tested_by and not META_VALUES["tested_by"].match(tested_by):
        return [tr("kanban.set.bad_value", name="tested_by", value=tested_by)]
    for card in batch if tested_by else []:
        card.meta["tested_by"] = tested_by
    errors = [e for card in batch for e in batch_card_errors(board, card, cards, to, reason)]
    if not errors and to == "done":  # bramka projektu raz dla całej paczki
        errors = board.run_gate(tail_lines=8)
    if errors:
        return errors
    for card in batch:
        note = tr("kanban.log.batch_moved", batch=name, reason=reason.strip()).strip()
        card.move(to, reset_stages(card, board.columns, to, note))  # ruch w lewo — etapy od nowa
        card.save()
    return []


def batch_card_errors(board: Any, card: Any, cards: list[Any], to: str, reason: str) -> list[str]:
    """Bramka jednej karty paczki (bez bramki projektu) i wymagane powody."""
    errors = []
    if card.status == "done" and not reason.strip():
        errors.append(tr("kanban.error.reopen_reason", card_id=card.id))
    if to == "done" and card.meta.get("tested_by") == "skip" and not reason.strip():
        errors.append(tr("kanban.error.skip_test_reason", card_id=card.id))
    return errors + [f"{card.id}: {e}" for e in board.gate_errors(card, to, cards, run_gate=False)]


def add_batch_parser(sub: Any) -> None:
    """`kanban.py batch plan|start|submit|move` (polecenia paczek, SB-064)."""
    batch = sub.add_parser("batch", help=tr("kanban.cli.batch_help")).add_subparsers(
        dest="batch_cmd", required=True
    )
    plan = batch.add_parser("plan")
    plan.add_argument("model")
    plan.add_argument("--apply", action="store_true")
    start_cmd = batch.add_parser("start")
    start_cmd.add_argument("name")
    start_cmd.add_argument("model")
    batch.add_parser("submit").add_argument("name")
    move = batch.add_parser("move")
    move.add_argument("name")
    move.add_argument("to")
    move.add_argument("--reason", default="")
    move.add_argument("--tested-by", default="")


def batch_main(board: Any, args: Any) -> int:
    """Wykonanie polecenia paczki; kody wyjścia jak w kanban.py (0 ok, 1 bramka, 3 brak kart)."""
    if args.batch_cmd == "plan":
        groups = plan_batches(board, args.model)
        if groups is None:  # broken release manifest: a validation error, not "nothing to plan"
            return 1
        for name, cards in groups.items():
            print(tr("kanban.batch.proposal", batch=name, cards=", ".join(c.id for c in cards)))
            print(f"  {batch_details(board, cards)}")
            for card in cards if args.apply else []:
                set_meta(board, card.id, "batch", name, tr("kanban.batch.planned"))
        return 0 if groups else 3
    if args.batch_cmd == "start":
        errors = start_batch(board, args.name, args.model)
    elif args.batch_cmd == "submit":
        errors = submit_batch(board, args.name)
    else:
        errors = move_batch(board, args.name, args.to, args.reason, args.tested_by)
    for error in errors:
        print(f"  - {error}", file=sys.stderr)
    if not errors:
        print(tr("kanban.batch.done", batch=args.name, command=args.batch_cmd))
    return 1 if errors else 0
