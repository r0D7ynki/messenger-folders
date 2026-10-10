#!/usr/bin/env node
/**
 * Messenger Folders - Plikowa tablica Kanban dla agentów
 *
 * Każde zadanie to plik kanban/tasks/<ID>.md z nagłówkiem (frontmatter).
 * Skrypt pilnuje bramek: DoR przy wejściu do `ready`, kryteriów akceptacji
 * przy wejściu do `review` i DoD (ogólnego + modelowego) przy wejściu do `done`
 * (wraz z `npm test`, `npm run check` i `npm run lint`).
 *
 * Użycie:
 *   node tools/kanban.mjs                         tablica
 *   node tools/kanban.mjs new "Tytuł" [--model deepseek] [--size S]
 *   node tools/kanban.mjs move MF-001 ready       przesunięcie z kontrolą bramki
 *   node tools/kanban.mjs check [MF-001]          walidacja bez przesuwania
 *   node tools/kanban.mjs next <model>            pierwsze zadanie `ready` dla modelu
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TASKS_DIR = path.join(ROOT, 'kanban', 'tasks');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'kanban', 'config.json'), 'utf8'));
const SIZE_ORDER = ['S', 'M', 'L'];

// --- Odczyt i zapis zadań ---

function parseTask(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${path.basename(file)}: brak nagłówka --- ... ---`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { file, meta, body: match[2] };
}

function writeTask(task) {
  const head = Object.entries(task.meta)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  fs.writeFileSync(task.file, `---\n${head}\n---\n${task.body}`);
}

function loadTasks() {
  if (!fs.existsSync(TASKS_DIR)) return [];
  return fs
    .readdirSync(TASKS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => parseTask(path.join(TASKS_DIR, f)));
}

function findTask(id) {
  const task = loadTasks().find((t) => t.meta.id === id);
  if (!task) fail(`Nie ma zadania ${id}.`);
  return task;
}

/** Zwraca treść sekcji `## Nazwa` (bez nagłówka) albo pusty napis. */
function section(body, name) {
  const re = new RegExp(`^## ${name}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  const m = body.match(re);
  if (!m) return '';
  // Komentarze HTML z szablonu nie liczą się jako treść
  return m[1].replace(/<!--[\s\S]*?-->/g, '').trim();
}

function checkboxes(text) {
  const items = [...text.matchAll(/^- \[( |x|X)\] (.+)$/gm)];
  return { total: items.length, open: items.filter((i) => i[1] === ' ').map((i) => i[2]) };
}

function listDeps(meta) {
  return (meta.depends || '')
    .replace(/[[\]]/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// --- Bramki ---

function checkDoR(task, all) {
  const errors = [];
  const { meta, body } = task;
  const model = config.models[meta.model];
  if (!model) errors.push(`model "${meta.model}" nie jest zdefiniowany w kanban/config.json`);
  if (!SIZE_ORDER.includes(meta.size)) errors.push(`size musi być jednym z ${SIZE_ORDER.join('/')}`);
  if (model && SIZE_ORDER.indexOf(meta.size) > SIZE_ORDER.indexOf(model.max_size)) {
    errors.push(`rozmiar ${meta.size} przekracza limit modelu ${meta.model} (${model.max_size}) — podziel zadanie`);
  }
  if (!section(body, 'Cel')) errors.push('pusta sekcja Cel');
  if (!section(body, 'Kontekst')) errors.push('pusta sekcja Kontekst');
  if (checkboxes(section(body, 'Kryteria akceptacji')).total === 0) {
    errors.push('brak kryteriów akceptacji w formie `- [ ] ...`');
  }
  const files = section(body, 'Pliki');
  if (!files) errors.push('pusta sekcja Pliki — agent musi wiedzieć, czego może dotykać');
  for (const ref of files.matchAll(/`([^`]+)`/g)) {
    // Tylko tokeny wyglądające na ścieżki; nazwy funkcji w backtickach pomijamy
    if (!/[/.]/.test(ref[1]) || ref[1].endsWith('(nowy)')) continue;
    const p = ref[1].replace(/:\d+(-\d+)?$/, '');
    if (!fs.existsSync(path.join(ROOT, p))) {
      errors.push(`plik ${p} z sekcji Pliki nie istnieje (oznacz nowe jako \`ścieżka (nowy)\`)`);
    }
  }
  if (!section(body, 'Weryfikacja')) errors.push('pusta sekcja Weryfikacja — jak sprawdzić, że działa');
  for (const dep of listDeps(meta)) {
    const d = all.find((t) => t.meta.id === dep);
    if (!d) errors.push(`zależność ${dep} nie istnieje`);
    else if (d.meta.status !== 'done') errors.push(`zależność ${dep} nie jest done (${d.meta.status})`);
  }
  return errors;
}

function checkWip(task, all) {
  const active = all.filter((t) => t.meta.status === 'in-progress' && t.meta.id !== task.meta.id);
  const errors = [];
  if (active.length >= config.wip['in-progress']) {
    errors.push(`limit WIP in-progress (${config.wip['in-progress']}) osiągnięty`);
  }
  if (active.filter((t) => t.meta.model === task.meta.model).length >= config.wip['in-progress-per-model']) {
    errors.push(`model ${task.meta.model} ma już zadanie w toku`);
  }
  return errors;
}

function checkReview(task, all) {
  const errors = [];
  const ac = checkboxes(section(task.body, 'Kryteria akceptacji'));
  ac.open.forEach((i) => errors.push(`niespełnione kryterium: ${i}`));
  if (!section(task.body, 'Dowód')) errors.push('pusta sekcja Dowód — wklej wynik testów / opis weryfikacji');
  if (all.filter((t) => t.meta.status === 'review').length >= config.wip.review) {
    errors.push(`limit WIP review (${config.wip.review}) osiągnięty — najpierw przejrzyj zaległe`);
  }
  return errors;
}

function checkDoD(task, { runTests }) {
  const errors = [];
  const dod = checkboxes(section(task.body, 'DoD'));
  if (dod.total === 0) errors.push('brak listy DoD');
  dod.open.forEach((i) => errors.push(`DoD niespełnione: ${i}`));
  if (task.meta.reviewer === task.meta.model) {
    errors.push('reviewer musi być innym modelem/osobą niż wykonawca');
  }
  if (!task.meta.reviewer) errors.push('brak pola reviewer');
  if (runTests && errors.length === 0) {
    for (const cmd of ['npm test --silent', 'npm run check --silent', 'npm run lint --silent']) {
      try {
        execSync(cmd, { cwd: ROOT, stdio: 'pipe' });
      } catch (e) {
        errors.push(
          `\`${cmd}\` nie przechodzi:\n${String(e.stdout || '')
            .split('\n')
            .slice(-8)
            .join('\n')}`
        );
      }
    }
  }
  return errors;
}

const GATES = {
  ready: (t, all) => checkDoR(t, all),
  'in-progress': (t, all) => [...checkDoR(t, all), ...checkWip(t, all)],
  review: (t, all) => checkReview(t, all),
  done: (t, all) => [
    ...checkReview(
      t,
      all.filter((x) => x !== t)
    ),
    ...checkDoD(t, { runTests: true })
  ]
};

// --- Komendy ---

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function board() {
  const all = loadTasks();
  for (const col of config.columns) {
    const items = all.filter((t) => t.meta.status === col);
    console.log(`\n■ ${col.toUpperCase()} (${items.length})`);
    for (const t of items) {
      const deps = listDeps(t.meta);
      console.log(
        `  ${t.meta.id}  [${t.meta.size}] ${t.meta.priority || ''} ${t.meta.model.padEnd(8)} ${t.meta.title}${deps.length ? `  ⇠ ${deps.join(',')}` : ''}`
      );
    }
  }
  console.log('');
}

function dodList(model) {
  const items = [...config.dod, ...((config.models[model] || {}).dod || [])];
  return items.map((i) => `- [ ] ${i}`).join('\n');
}

function newTask(title, opts) {
  if (!title) fail('Podaj tytuł: new "Tytuł" [--model m] [--size S|M|L]');
  const model = opts.model || 'claude';
  if (!config.models[model]) fail(`Nieznany model ${model}. Dostępne: ${Object.keys(config.models).join(', ')}`);
  const nums = loadTasks().map((t) => Number(t.meta.id.split('-')[1]) || 0);
  const id = `${config.prefix}-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
  const task = {
    file: path.join(TASKS_DIR, `${id}.md`),
    meta: {
      id,
      title,
      status: 'backlog',
      model,
      reviewer: '',
      size: opts.size || 'M',
      priority: opts.priority || 'P2',
      depends: '[]',
      created: new Date().toISOString().slice(0, 10)
    },
    body: `
## Cel
<!-- Jedno zdanie: co ma się zmienić dla użytkownika lub w kodzie. -->

## Kontekst
<!-- Dlaczego, skąd wiadomo (link do linii kodu, zgłoszenia, przeglądu). -->

## Pliki
<!-- Lista \`ścieżka\` lub \`ścieżka:linia\`, które wolno zmieniać. Nowe: \`ścieżka (nowy)\`. -->

## Kryteria akceptacji
- [ ]

## Weryfikacja
<!-- Komendy i kroki ręczne, które potwierdzą kryteria. -->

## Poza zakresem
<!-- Czego NIE robić w tym zadaniu. -->

## DoD
${dodList(model)}

## Dowód
<!-- Wypełnia wykonawca przed \`review\`: wynik testów, zrzut, opis. -->

## Log
`
  };
  fs.mkdirSync(TASKS_DIR, { recursive: true });
  writeTask(task);
  console.log(`✓ Utworzono ${path.relative(ROOT, task.file)}`);
}

function move(id, to) {
  if (!config.columns.includes(to)) fail(`Nieznana kolumna ${to}. Dostępne: ${config.columns.join(', ')}`);
  const all = loadTasks();
  const task = all.find((t) => t.meta.id === id) || findTask(id);
  const from = task.meta.status;
  const gate = GATES[to];
  // Powrót w lewo (np. review → in-progress) nie wymaga bramki
  const forward = config.columns.indexOf(to) > config.columns.indexOf(from);
  const errors = forward && gate ? gate(task, all) : [];
  if (errors.length) {
    console.error(`✗ ${id} nie może przejść ${from} → ${to}:`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  task.meta.status = to;
  const now = new Date();
  const stamp = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' ');
  task.body = task.body.replace(/\s*$/, `\n- ${stamp} ${from} → ${to}\n`);
  writeTask(task);
  console.log(`✓ ${id}: ${from} → ${to}`);
}

function check(id) {
  const all = loadTasks();
  const targets = id ? [findTask(id)] : all;
  let bad = 0;
  for (const t of targets) {
    const errors = [];
    for (const key of ['id', 'title', 'status', 'model', 'size']) {
      if (!t.meta[key]) errors.push(`brak pola ${key}`);
    }
    if (!config.columns.includes(t.meta.status)) errors.push(`nieznany status ${t.meta.status}`);
    if (path.basename(t.file) !== `${t.meta.id}.md`) errors.push('nazwa pliku ≠ id');
    // Zadanie poza backlogiem musi wciąż spełniać DoR (bez sprawdzania zależności dla done)
    if (['ready', 'in-progress'].includes(t.meta.status)) errors.push(...checkDoR(t, all));
    if (t.meta.status === 'done') errors.push(...checkDoD(t, { runTests: false }));
    if (errors.length) {
      bad++;
      console.log(`✗ ${t.meta.id || t.file} (${t.meta.status})`);
      errors.forEach((e) => console.log(`  - ${e}`));
    } else {
      console.log(`✓ ${t.meta.id} (${t.meta.status})`);
    }
  }
  process.exit(bad ? 1 : 0);
}

function next(model) {
  if (!model) fail('Podaj model: next <model>');
  const all = loadTasks();
  const prio = (t) => t.meta.priority || 'P9';
  const task = all
    .filter((t) => t.meta.status === 'ready' && t.meta.model === model)
    .sort((a, b) => prio(a).localeCompare(prio(b)) || a.meta.id.localeCompare(b.meta.id))[0];
  if (!task) {
    console.log(`Brak zadań ready dla ${model}.`);
    return;
  }
  console.log(path.relative(ROOT, task.file));
}

// --- Wejście ---

const [cmd, ...rest] = process.argv.slice(2);
const opts = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[++i];
  else args.push(rest[i]);
}

switch (cmd) {
  case undefined:
  case 'board':
    board();
    break;
  case 'new':
    newTask(args[0], opts);
    break;
  case 'move':
    move(args[0], args[1]);
    break;
  case 'check':
    check(args[0]);
    break;
  case 'next':
    next(args[0]);
    break;
  default:
    fail(`Nieznana komenda ${cmd}. Dostępne: board, new, move, check, next`);
}
