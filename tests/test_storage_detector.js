/**
 * Testy jednostkowe dla modułów MessengerFoldersStorage i MessengerDOMDetector
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Walidacja pliku manifest.json
console.log('--- Test 1: Walidacja manifest.json ---');
const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestRaw);

assert.strictEqual(manifest.manifest_version, 3, 'Wersja manifestu powinna wynosić 3');
assert.ok(manifest.permissions.includes('storage'), 'Uprawnienia powinny zawierać "storage"');
assert.ok(
  manifest.host_permissions.includes('*://*.messenger.com/*'),
  'host_permissions powinno obejmować messenger.com'
);
assert.ok(
  manifest.host_permissions.includes('*://*.facebook.com/messages/*'),
  'host_permissions powinno obejmować facebook.com/messages'
);
assert.strictEqual(
  manifest.background.service_worker,
  'background/background.js',
  'Service worker powinien wskazywać na background/background.js'
);
assert.ok(manifest.content_scripts.length > 0, 'Powinny istnieć reguły content_scripts');
assert.ok(manifest.content_scripts[0].js.includes('src/storage.js'), 'content_scripts powinno ładować src/storage.js');
assert.ok(
  manifest.content_scripts[0].js.includes('src/detector.js'),
  'content_scripts powinno ładować src/detector.js'
);
assert.ok(manifest.content_scripts[0].js.includes('src/ui.js'), 'content_scripts powinno ładować src/ui.js');
assert.ok(manifest.content_scripts[0].js.includes('src/content.js'), 'content_scripts powinno ładować src/content.js');
assert.ok(
  manifest.content_scripts[0].css.includes('src/content.css'),
  'content_scripts powinno ładować src/content.css'
);
console.log('✓ manifest.json jest poprawny');

// 2. Testy MessengerFoldersStorage
console.log('\n--- Test 2: MessengerFoldersStorage ---');

// Mock chrome.storage.local
class MockStorageArea {
  constructor() {
    this.store = {};
  }
  get(keys, callback) {
    const result = {};
    if (typeof keys === 'string') {
      if (this.store[keys] !== undefined) result[keys] = JSON.parse(JSON.stringify(this.store[keys]));
    } else if (Array.isArray(keys)) {
      for (const k of keys) {
        if (this.store[k] !== undefined) result[k] = JSON.parse(JSON.stringify(this.store[k]));
      }
    } else if (keys === null) {
      Object.assign(result, JSON.parse(JSON.stringify(this.store)));
    }
    setTimeout(() => callback(result), 0);
  }
  set(items, callback) {
    for (const [k, v] of Object.entries(items)) {
      this.store[k] = JSON.parse(JSON.stringify(v));
    }
    setTimeout(() => callback && callback(), 0);
  }
  clear(callback) {
    this.store = {};
    setTimeout(() => callback && callback(), 0);
  }
}

// Podpięcie atrapy środowiska Chrome
const mockStorage = new MockStorageArea();
const mockListeners = [];
global.chrome = {
  runtime: { lastError: null },
  storage: {
    local: mockStorage,
    onChanged: {
      addListener(fn) {
        mockListeners.push(fn);
      }
    }
  }
};

const { MessengerFoldersStorage } = require('../src/storage.js');

async function runStorageTests() {
  const storage = new MessengerFoldersStorage();

  // Test init()
  const initState = await storage.init();
  assert.ok(Array.isArray(initState.folders), 'Foldery powinny być tablicą');
  assert.strictEqual(initState.folders.length, 6, 'Domyślnie powinno być 6 folderów');
  assert.strictEqual(initState.activeFolder, 'all', 'Domyślny aktywny folder to "all"');

  const folderIds = initState.folders.map((f) => f.id);
  assert.deepStrictEqual(
    folderIds,
    ['all', 'important', 'work', 'friends', 'groups', 'uncategorized'],
    'Lista domyślnych identyfikatorów folderów musi się zgadzać'
  );
  console.log('✓ storage.init() poprawnie konfiguruje domyślne foldery');

  // Test getFolders()
  const folders = await storage.getFolders();
  assert.strictEqual(folders.length, 6);
  console.log('✓ storage.getFolders() zwraca listę folderów');

  // Test saveFolder() - nowy folder
  const newFolder = await storage.saveFolder({ name: 'Projekty', icon: '🚀', color: '#ff0055' });
  assert.ok(newFolder.id.startsWith('folder_'), 'Nowy folder powinien otrzymać wygenerowany id');
  assert.strictEqual(newFolder.name, 'Projekty');
  assert.strictEqual(newFolder.icon, '🚀');
  assert.strictEqual(newFolder.color, '#ff0055');
  assert.strictEqual(newFolder.isSystem, false);

  const updatedFolders = await storage.getFolders();
  assert.strictEqual(updatedFolders.length, 7, 'Liczba folderów powinna wzrosnąć do 7');
  console.log('✓ storage.saveFolder() tworzy nowy folder użytkownika');

  // Test saveFolder() - aktualizacja istniejącego folderu
  const editedFolder = await storage.saveFolder({
    id: newFolder.id,
    name: 'Projekty 2026',
    icon: '🎯',
    color: '#00cc88'
  });
  assert.strictEqual(editedFolder.name, 'Projekty 2026');
  assert.strictEqual(editedFolder.icon, '🎯');
  console.log('✓ storage.saveFolder() aktualizuje istniejący folder');

  // Test setActiveFolder(), getActiveFolder() i getActiveFolderSync()
  await storage.setActiveFolder(newFolder.id);
  const active = await storage.getActiveFolder();
  assert.strictEqual(active, newFolder.id, 'Aktywny folder powinien zostać zaktualizowany');
  const activeSync = storage.getActiveFolderSync();
  assert.strictEqual(activeSync, newFolder.id, 'getActiveFolderSync powinien zwrócić aktywny folder synchronicznie');
  console.log('✓ storage.setActiveFolder(), getActiveFolder() i getActiveFolderSync() działają poprawnie');

  // Test assignThread()
  const assigned = await storage.assignThread('100012345', newFolder.id, {
    name: 'Jan Kowalski',
    avatar: 'https://scontent.xx.fbcdn.net/avatar.jpg'
  });
  assert.strictEqual(assigned.threadId, '100012345');
  assert.strictEqual(assigned.folderId, newFolder.id);
  assert.strictEqual(assigned.name, 'Jan Kowalski');
  assert.strictEqual(assigned.avatar, 'https://scontent.xx.fbcdn.net/avatar.jpg');
  console.log('✓ storage.assignThread() poprawnie przypisuje wątek do folderu');

  // Test getThreadFolder()
  const currentFolder = await storage.getThreadFolder('100012345');
  assert.strictEqual(currentFolder, newFolder.id);
  const unassignedFolder = await storage.getThreadFolder('non_existent');
  assert.strictEqual(unassignedFolder, 'uncategorized');
  console.log('✓ storage.getThreadFolder() zwraca właściwy folder lub uncategorized');

  // Test getThreadsInFolder()
  const inNewFolder = await storage.getThreadsInFolder(newFolder.id);
  assert.strictEqual(inNewFolder.length, 1);
  assert.strictEqual(inNewFolder[0].threadId, '100012345');

  const inAll = await storage.getThreadsInFolder('all');
  assert.strictEqual(inAll.length, 1);
  console.log('✓ storage.getThreadsInFolder() filtruje wątki według folderu');

  // Test getAllThreads() i getAllThreadsSync()
  const allThreads = await storage.getAllThreads();
  assert.ok(allThreads['100012345']);
  const allThreadsSync = storage.getAllThreadsSync();
  assert.ok(allThreadsSync['100012345'], 'getAllThreadsSync powinien zawierać przypisany wątek synchronicznie');
  console.log('✓ storage.getAllThreads() i getAllThreadsSync() zwracają mapę wszystkich wątków');

  // Test deleteFolder()
  // Blokada usuwania folderów systemowych:
  await assert.rejects(async () => {
    await storage.deleteFolder('all');
  }, /Nie można usunąć folderu systemowego/);
  await assert.rejects(async () => {
    await storage.deleteFolder('uncategorized');
  }, /Nie można usunąć folderu systemowego/);

  // Usunięcie utworzonego folderu użytkownika
  const deleted = await storage.deleteFolder(newFolder.id);
  assert.strictEqual(deleted, true);

  // Wątek powinien zostać przeniesiony do 'uncategorized'
  const folderAfterDelete = await storage.getThreadFolder('100012345');
  assert.strictEqual(folderAfterDelete, 'uncategorized', 'Wątek z usuniętego folderu powinien trafić do uncategorized');

  // Aktywny folder powinien zresetować się do 'all'
  const activeAfterDelete = await storage.getActiveFolder();
  assert.strictEqual(activeAfterDelete, 'all', 'Aktywny folder powinien zresetować się do "all"');
  console.log('✓ storage.deleteFolder() bezpiecznie usuwa folder i przenosi wątki');

  // Test removeThreadAssignment()
  const removed = await storage.removeThreadAssignment('100012345');
  assert.strictEqual(removed, true);
  const threadsAfterRemove = await storage.getAllThreads();
  assert.strictEqual(threadsAfterRemove['100012345'], undefined);
  console.log('✓ storage.removeThreadAssignment() usuwa przypisanie wątku');

  // Test exportData()
  const jsonExport = await storage.exportData();
  const parsedExport = JSON.parse(jsonExport);
  assert.strictEqual(parsedExport.version, 1);
  assert.ok(Array.isArray(parsedExport.folders));
  assert.ok(typeof parsedExport.threads === 'object');
  console.log('✓ storage.exportData() tworzy poprawny zrzut danych JSON');

  // Test importData()
  const customBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    folders: [
      { id: 'all', name: 'Wszystkie', icon: '💬', color: '#0084FF', isSystem: true },
      { id: 'custom1', name: 'Zlecenia', icon: '💼', color: '#112233', isSystem: false },
      { id: 'uncategorized', name: 'Inne', icon: '📁', color: '#6B7280', isSystem: true }
    ],
    threads: {
      999888: { folderId: 'custom1', name: 'Klient ABC' }
    },
    activeFolder: 'custom1'
  };

  await storage.importData(JSON.stringify(customBackup));
  const foldersAfterImport = await storage.getFolders();
  assert.ok(
    foldersAfterImport.some((f) => f.id === 'custom1'),
    'Zaimportowany folder powinien istnieć'
  );
  const activeAfterImport = await storage.getActiveFolder();
  assert.strictEqual(activeAfterImport, 'custom1', 'Aktywny folder powinien zostać zaktualizowany');
  const threadAfterImport = await storage.getThreadFolder('999888');
  assert.strictEqual(threadAfterImport, 'custom1');
  console.log('✓ storage.importData() poprawnie importuje dane i zachowuje foldery systemowe');

  // Test onChange()
  let notified = false;
  const unsubscribe = storage.onChange((payload) => {
    notified = true;
  });

  // Symulacja zdarzenia chrome.storage.onChanged
  for (const listener of mockListeners) {
    listener(
      {
        mf_active_folder: { oldValue: 'custom1', newValue: 'all' }
      },
      'local'
    );
  }
  assert.strictEqual(notified, true, 'Funkcja zwrotna onChange powinna zostać wywołana');
  unsubscribe();
  console.log('✓ storage.onChange() powiadamia o zmianach w magazynie danych');

  // --- Testy MF-002: Walidacja folderów przy imporcie JSON i zapisie ---
  console.log('\n--- Testy MF-002: Walidacja folderów (_normalizeFolder, saveFolder, importData) ---');

  // 1. Testy metody pomocniczej _normalizeFolder
  // Walidacja koloru:
  assert.strictEqual(
    storage._normalizeFolder({ id: 'f1', name: 'Test', color: 'red;background:url(x)' }).color,
    '#0084FF',
    'Złośliwy kolor CSS powinien zostać zastąpiony domyślnym #0084FF'
  );
  assert.strictEqual(
    storage._normalizeFolder({ id: 'f1', name: 'Test', color: '#123' }).color,
    '#0084FF',
    'Niepoprawny kolor 3-znakowy powinien zostać zastąpiony #0084FF'
  );
  assert.strictEqual(
    storage._normalizeFolder({ id: 'f1', name: 'Test', color: '#1122AA' }).color,
    '#1122AA',
    'Poprawny kolor 6-znakowy HEX powinien zostać zachowany'
  );

  // Walidacja ikony:
  assert.strictEqual(
    storage._normalizeFolder({ id: 'f1', name: 'Test', icon: '123456789' }).icon,
    '📁',
    'Ikona dłuższa niż 8 znaków powinna zostać zastąpiona 📁'
  );
  assert.strictEqual(
    storage._normalizeFolder({ id: 'f1', name: 'Test', icon: '<script>' }).icon,
    '📁',
    'Ikona zawierająca znak < powinna zostać zastąpiona 📁'
  );
  assert.strictEqual(
    storage._normalizeFolder({ id: 'f1', name: 'Test', icon: 'a>b' }).icon,
    '📁',
    'Ikona zawierająca znak > powinna zostać zastąpiona 📁'
  );
  assert.strictEqual(
    storage._normalizeFolder({ id: 'f1', name: 'Test', icon: '🎯' }).icon,
    '🎯',
    'Prawidłowa krótka ikona/emoji powinna zostać zachowana'
  );

  // Walidacja nazwy:
  const longName = 'A'.repeat(55);
  assert.strictEqual(
    storage._normalizeFolder({ id: 'f1', name: longName }).name,
    'A'.repeat(40),
    'Nazwa folderu powinna zostać przycięta do 40 znaków'
  );
  assert.strictEqual(
    storage._normalizeFolder({ id: 'f1', name: '   ' }),
    null,
    'Folder z pustą nazwą powinien zwrócić null'
  );

  // Walidacja id:
  assert.strictEqual(
    storage._normalizeFolder({ id: 'invalid id with spaces', name: 'Test' }),
    null,
    'Folder z niedozwolonymi znakami w id powinien zwrócić null'
  );
  assert.strictEqual(
    storage._normalizeFolder({ id: 'id/with/slashes', name: 'Test' }),
    null,
    'Folder z ukośnikiem w id powinien zwrócić null'
  );
  assert.strictEqual(
    storage._normalizeFolder({ id: 'a'.repeat(65), name: 'Test' }),
    null,
    'Folder ze zbyt długim id (>64 znaków) powinien zwrócić null'
  );
  assert.strictEqual(storage._normalizeFolder(null), null, 'Nieobiektowy folder powinien zwrócić null');
  console.log('✓ _normalizeFolder poprawnie weryfikuje i sanitizuje pola folderu');

  // 2. Testy saveFolder z niebezpiecznymi/nieprawidłowymi wartościami
  const sanitizedFolder = await storage.saveFolder({
    name: 'B'.repeat(60),
    icon: '<img onerror=alert(1)>',
    color: 'red;background:url(x)'
  });
  assert.strictEqual(sanitizedFolder.name, 'B'.repeat(40), 'saveFolder przycina nazwę do 40 znaków');
  assert.strictEqual(sanitizedFolder.icon, '📁', 'saveFolder zamienia niebezpieczną ikonę na 📁');
  assert.strictEqual(sanitizedFolder.color, '#0084FF', 'saveFolder zamienia złośliwy kolor na #0084FF');

  await assert.rejects(async () => {
    await storage.saveFolder({ id: 'invalid id!', name: 'Poprawna nazwa' });
  }, /Niepoprawne dane folderu\./);
  console.log('✓ saveFolder stosuje reguły normalizacji i odrzuca nieprawidłowe identyfikatory');

  // 3. Testy importData z pomijaniem nieprawidłowych folderów i nieobiektowych przypisań wątków
  const maliciousBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    folders: [
      { id: 'valid_1', name: 'X'.repeat(50), icon: 'icon_too_long_123', color: 'red;background:url(x)' },
      { id: 'bad id space', name: 'Zły ID ze spacją', icon: '📁', color: '#112233' },
      { id: 'bad/slash', name: 'Zły ID z ukośnikiem', icon: '📁', color: '#112233' },
      { id: 'bad_empty_name', name: '   ', icon: '📁', color: '#112233' },
      { id: 'valid_1', name: 'Duplikat ID', icon: '📁', color: '#112233' }
    ],
    threads: {
      t1: { folderId: 'valid_1', name: 'Poprawny wątek' },
      t2: 'niepoprawny string zamiast obiektu',
      t3: 12345,
      t4: null,
      t5: ['tablica', 'zamiast', 'obiektu']
    },
    activeFolder: 'valid_1'
  };

  await storage.importData(maliciousBackup);
  const importedList = await storage.getFolders();
  const validFolder = importedList.find((f) => f.id === 'valid_1');
  assert.ok(validFolder, 'Poprawny folder powinien zostać zaimportowany');
  assert.strictEqual(validFolder.name, 'X'.repeat(40), 'Zaimportowana nazwa powinna być przycięta do 40 znaków');
  assert.strictEqual(validFolder.icon, '📁', 'Zaimportowana zbyt długa ikona powinna być zastąpiona 📁');
  assert.strictEqual(validFolder.color, '#0084FF', 'Złośliwy kolor powinien być zastąpiony #0084FF');

  assert.strictEqual(
    importedList.some((f) => f.id === 'bad id space'),
    false,
    'Folder ze spacją w id powinien zostać pominięty'
  );
  assert.strictEqual(
    importedList.some((f) => f.id === 'bad/slash'),
    false,
    'Folder z ukośnikiem w id powinien zostać pominięty'
  );
  assert.strictEqual(
    importedList.some((f) => f.id === 'bad_empty_name'),
    false,
    'Folder z pustą nazwą powinien zostać pominięty'
  );
  assert.strictEqual(
    importedList.filter((f) => f.id === 'valid_1').length,
    1,
    'Zduplikowany folder powinien zostać zaimportowany tylko raz'
  );

  const threadsMap = await storage.getAllThreads();
  assert.ok(threadsMap.t1, 'Prawidłowe przypisanie wątku t1 powinno zostać zachowane');
  assert.strictEqual(threadsMap.t2, undefined, 'Nieobiektowe przypisanie string powinno zostać odrzucone');
  assert.strictEqual(threadsMap.t3, undefined, 'Nieobiektowe przypisanie number powinno zostać odrzucone');
  assert.strictEqual(threadsMap.t4, undefined, 'Nieobiektowe przypisanie null powinno zostać odrzucone');
  assert.strictEqual(threadsMap.t5, undefined, 'Nieobiektowe przypisanie array powinno zostać odrzucone');
  console.log('✓ importData pomija foldery z niepoprawnym id oraz nieobiektowe przypisania wątków');
}

// 3. Testy MessengerDOMDetector
console.log('\n--- Test 3: MessengerDOMDetector ---');
const MessengerDOMDetector = require('../src/detector.js');

/**
 * Sprawdza prosty selektor złożony (tag, .klasy, atrybuty z operatorami =, *= i flagą i) na elemencie mocka.
 * @param {object} element Element mocka.
 * @param {string} compound Selektor bez przecinków i kombinatorów.
 * @returns {boolean} Czy element pasuje.
 */
function mockMatchesCompound(element, compound) {
  const tagMatch = compound.match(/^[a-z]+/i);
  if (tagMatch && tagMatch[0].toUpperCase() !== element.tagName) return false;
  const classes = (element.attrs.class || '').split(/\s+/);
  for (const [, className] of compound.replace(/\[[^\]]*\]/g, '').matchAll(/\.([\w-]+)/g)) {
    if (!classes.includes(className)) return false;
  }
  const attrRe = /\[([\w-]+)(?:(\*?=)"([^"]*)"(?:\s+(i))?)?\]/g;
  let m;
  while ((m = attrRe.exec(compound))) {
    const [, name, op, value, flag] = m;
    if (!(name in element.attrs)) return false;
    if (!op) continue;
    let actual = element.attrs[name];
    let expected = value;
    if (flag) {
      actual = actual.toLowerCase();
      expected = expected.toLowerCase();
    }
    if (op === '=' ? actual !== expected : !actual.includes(expected)) return false;
  }
  return true;
}

/**
 * Tworzy minimalny element DOM z querySelector(All), matches, closest i getAttribute.
 * @param {string} tag Nazwa tagu.
 * @param {Record<string, string>} attrs Atrybuty.
 * @param {object[]} [children] Elementy potomne.
 * @returns {object} Element mocka.
 */
function mockElement(tag, attrs, children = []) {
  const element = {
    tagName: tag.toUpperCase(),
    attrs,
    children,
    parentElement: null,
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
    matches: (selector) => selector.split(/,(?![^[]*\])/).some((part) => mockMatchesCompound(element, part.trim())),
    closest: (selector) => {
      for (let node = element; node; node = node.parentElement) {
        if (node.matches(selector)) return node;
      }
      return null;
    },
    querySelectorAll: (selector) => {
      const found = [];
      const walk = (node) => {
        for (const child of node.children) {
          if (child.matches(selector)) found.push(child);
          walk(child);
        }
      };
      walk(element);
      return found;
    },
    querySelector: (selector) => element.querySelectorAll(selector)[0] || null
  };
  children.forEach((child) => (child.parentElement = element));
  return element;
}

function runDetectorTests() {
  const detector = new MessengerDOMDetector();

  // Testy wyodrębniania identyfikatora wątku z URL
  assert.strictEqual(detector.extractThreadIdFromUrl('https://www.messenger.com/t/123456789/'), '123456789');
  assert.strictEqual(detector.extractThreadIdFromUrl('https://www.messenger.com/e2ee/t/987654321'), '987654321');
  assert.strictEqual(detector.extractThreadIdFromUrl('https://www.facebook.com/messages/t/11223344'), '11223344');
  assert.strictEqual(detector.extractThreadIdFromUrl('https://www.facebook.com/messages/e2ee/t/556677'), '556677');
  assert.strictEqual(detector.extractThreadIdFromUrl('/t/my.contact.name?filter=all#msg'), 'my.contact.name');
  assert.strictEqual(detector.extractThreadIdFromUrl('/messages/t/user123'), 'user123');
  assert.strictEqual(detector.extractThreadIdFromUrl('/messages?selected_item_id=778899'), '778899');
  assert.strictEqual(detector.extractThreadIdFromUrl('https://www.messenger.com/messages/new'), null);
  assert.strictEqual(detector.extractThreadIdFromUrl(''), null);
  assert.strictEqual(detector.extractThreadIdFromUrl(null), null);
  console.log('✓ detector.extractThreadIdFromUrl() poprawnie rozpoznaje wszystkie wzorce URL');

  // Test _isTimeOrBadge
  assert.strictEqual(detector._isTimeOrBadge('12 min'), true);
  assert.strictEqual(detector._isTimeOrBadge('14:35'), true);
  assert.strictEqual(detector._isTimeOrBadge('Wczoraj'), true);
  assert.strictEqual(detector._isTimeOrBadge('3'), true);
  assert.strictEqual(detector._isTimeOrBadge('Jan Kowalski'), false);
  assert.strictEqual(detector._isTimeOrBadge('Zespół Projektowy'), false);
  console.log('✓ detector._isTimeOrBadge() poprawnie odróżnia nazwy od znaczników czasu');

  // Testy isThreadUnread (MF-019) na minimalnym mocku DOM
  const row = (...children) => mockElement('div', { role: 'row' }, children);
  assert.strictEqual(
    detector.isThreadUnread(
      row(
        mockElement('button', { 'aria-label': 'Oznacz jako nieprzeczytane' }),
        mockElement('span', { 'aria-label': '2 nieprzeczytane wiadomości' })
      )
    ),
    true,
    'Przycisk „Oznacz jako nieprzeczytane” nie może przesłonić prawdziwej odznaki'
  );
  assert.strictEqual(
    detector.isThreadUnread(
      row(
        mockElement('img', { class: 'chat-avatar', style: 'border: 2px solid rgb(0, 132, 255)' }),
        mockElement('div', { style: 'background: rgb(0, 132, 255)' })
      )
    ),
    true,
    'Awatar z niebieską ramką nie może przesłonić niebieskiej kropki'
  );
  assert.strictEqual(
    detector.isThreadUnread(
      row(
        mockElement('button', {
          class: 'mark-as-unread-btn',
          'data-testid': 'mark_as_unread_button',
          'aria-label': 'Oznacz jako nieprzeczytane'
        })
      )
    ),
    false,
    'Przycisk akcji z „unread” w klasie i data-testid nie oznacza nieprzeczytania'
  );
  assert.strictEqual(
    detector.isThreadUnread(row(mockElement('button', { 'aria-label': 'Oznacz wątek jako nieprzeczytany' }))),
    false,
    'Etykieta „Oznacz wątek jako nieprzeczytany” to akcja, nie stan'
  );
  assert.strictEqual(
    detector.isThreadUnread(
      row(mockElement('div', { style: 'border: 2px solid #0084FF' }, [mockElement('img', { src: 'a.png' })]))
    ),
    false,
    'Ramka wokół awatara nie jest kropką nieprzeczytania'
  );
  assert.strictEqual(
    detector.isThreadUnread(row(mockElement('span', { 'data-testid': 'unread_badge' }))),
    true,
    'Atrybut data-testid odznaki oznacza nieprzeczytanie'
  );
  assert.strictEqual(
    detector.isThreadUnread(row(mockElement('span', { class: 'chat-unread-badge' }))),
    false,
    'Sama klasa CSS nie jest podstawą detekcji'
  );
  assert.strictEqual(detector.isThreadUnread(row(mockElement('span', { 'data-unread': 'true' }))), true);
  assert.strictEqual(detector.isThreadUnread(row(mockElement('span', {}))), false);
  console.log('✓ detector.isThreadUnread() pomija akcje „Oznacz jako nieprzeczytane” i awatary, bez klas CSS');

  // Testy isThreadUnread (MF-014): po jednym przypadku na każdy krok heurystyki i wiersz przeczytany
  const threadLink = (attrs = {}, children = []) =>
    mockElement('a', { href: '/t/123/', role: 'link', ...attrs }, children);
  assert.strictEqual(
    detector.isThreadUnread(mockElement('div', { role: 'row', 'data-testid': 'unread_row' }, [threadLink()])),
    true,
    'Krok 1: data-testid z „unread” na samym wierszu'
  );
  assert.strictEqual(
    detector.isThreadUnread(row(threadLink({}, [mockElement('span', { 'aria-label': '1 unread message' })]))),
    true,
    'Krok 2: potomek z aria-label „unread”'
  );
  const labelledRow = mockElement('div', { role: 'row', 'aria-label': 'Jan Kowalski, nieprzeczytane' }, [threadLink()]);
  assert.strictEqual(detector.isThreadUnread(labelledRow), true, 'Krok 3: aria-label wiersza');
  const plainLink = threadLink({ 'aria-label': 'Anna Nowak — unread messages' });
  assert.strictEqual(detector.isThreadUnread(row(plainLink), plainLink), true, 'Krok 3: aria-label linku');
  const actionLink = threadLink({ 'aria-label': 'Mark as unread' });
  assert.strictEqual(detector.isThreadUnread(row(), actionLink), false, 'Krok 3: etykieta akcji „Mark as unread”');
  assert.strictEqual(
    detector.isThreadUnread(row(threadLink({}, [mockElement('span', { style: 'background-color: #0084FF' })]))),
    true,
    'Krok 4: niebieska kropka #0084FF'
  );
  assert.strictEqual(
    detector.isThreadUnread(mockElement('div', { role: 'row', 'data-unread': 'true' }, [threadLink()])),
    true,
    'Krok 5: data-unread="true" na wierszu'
  );
  const readRow = row(
    threadLink({ 'aria-label': 'Jan Kowalski' }, [
      mockElement('img', { src: 'avatar.jpg', style: 'border: 2px solid rgb(0, 132, 255)' }),
      mockElement('span', { dir: 'auto' }),
      mockElement('span', { 'data-unread': 'false' })
    ]),
    mockElement('div', { role: 'button', 'aria-label': 'Menu' })
  );
  assert.strictEqual(detector.isThreadUnread(readRow, readRow.children[0]), false, 'Wiersz przeczytany → false');
  assert.strictEqual(detector.isThreadUnread(null), false, 'Brak wiersza → false');
  console.log('✓ detector.isThreadUnread() ma test na każdy krok heurystyki i na wiersz przeczytany');
}

/**
 * Ładuje src/content.js w osobnym kontekście vm z atrapami modułów.
 * document.readyState === 'loading', więc start() nie rusza — testujemy funkcje i callbacki modułu.
 * @param {Object} [overrides] Dodatkowe lub podmienione obiekty globalne piaskownicy.
 * @returns {Object} Kontekst piaskownicy po wykonaniu content.js.
 */
function loadContentScript(overrides = {}) {
  const vm = require('vm');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'content.js'), 'utf8');
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    MessengerFoldersStorage: class {},
    MessengerDOMDetector: class {},
    MessengerFoldersUI: class {},
    window: { location: { href: 'https://www.messenger.com/' } },
    document: { readyState: 'loading', addEventListener() {} },
    ...overrides
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

/**
 * Zwraca calculateUnreadCounts z content.js załadowanego w piaskownicy.
 * @returns {Function} calculateUnreadCounts z content.js.
 */
function loadCalculateUnreadCounts() {
  const sandbox = loadContentScript();
  assert.strictEqual(typeof sandbox.calculateUnreadCounts, 'function', 'content.js eksportuje calculateUnreadCounts');
  return sandbox.calculateUnreadCounts;
}

function runUnreadCountsTests() {
  const calculateUnreadCounts = loadCalculateUnreadCounts();
  const folders = [{ id: 'all' }, { id: 'work' }, { id: 'friends' }];
  const threadsMap = { t1: { folderId: 'work' }, t2: { folderId: 'work' }, t3: { folderId: 'friends' } };
  const detected = [
    { threadId: 't1', isUnread: true },
    { threadId: 't2', isUnread: true },
    { threadId: 't3', isUnread: false },
    { threadId: 't4', isUnread: true },
    { threadId: 't1', isUnread: true },
    { threadId: ' t2 ', isUnread: true }
  ];
  const counts = calculateUnreadCounts(detected, threadsMap, folders);
  assert.strictEqual(counts.all, 3, "Suma dla 'all' to liczba unikalnych nieprzeczytanych wątków");
  assert.strictEqual(counts.work, 2, 'Ten sam wątek dwa razy w DOM liczony raz');
  assert.strictEqual(counts.friends, 0, 'Przeczytany wątek nie zwiększa licznika folderu');
  assert.strictEqual(counts.uncategorized, 1, 'Wątek nieprzypisany trafia do uncategorized');
  assert.strictEqual(
    counts.all,
    counts.work + counts.friends + counts.uncategorized,
    "Suma 'all' równa sumie folderów"
  );

  const empty = calculateUnreadCounts([], threadsMap, folders);
  assert.deepStrictEqual(
    { ...empty },
    { all: 0, work: 0, friends: 0, uncategorized: 0 },
    'Brak wątków → same zera, także dla uncategorized'
  );
  assert.strictEqual(calculateUnreadCounts(null, null, null).all, 0, 'Niepoprawne wejście → 0');
  console.log("✓ calculateUnreadCounts(): suma dla 'all', nieprzypisane → uncategorized, duplikaty liczone raz");
}

/**
 * Testy MF-021: wsadowe auto-przypisania przez publiczne API storage.
 */
async function runAutoAssignmentTests() {
  console.log('\n--- Test 5: Auto-przypisania reguł (MF-021) ---');

  // 1. applyAutoAssignments aktualizuje pamięć podręczną synchronicznie, jeszcze przed zapisem
  const autoStorage = new MessengerFoldersStorage(new MockStorageArea());
  await autoStorage.init();
  await autoStorage.assignThread('t_manual', 'friends');

  const pending = autoStorage.applyAutoAssignments([
    { threadId: 't_new', folderId: 'work', expectedFolderId: null, metadata: { name: 'Projekt A' } },
    // Wątek zmienił folder od ewaluacji (oczekiwano braku folderu) — przypisanie pominięte
    { threadId: 't_manual', folderId: 'work', expectedFolderId: null, metadata: { name: 'Projekt B' } }
  ]);
  const syncThreads = autoStorage.getAllThreadsSync();
  assert.strictEqual(syncThreads.t_new.folderId, 'work', 'Auto-przypisanie widoczne od razu w getAllThreadsSync()');
  assert.strictEqual(syncThreads.t_new.autoAssigned, true, 'Auto-przypisanie oznaczone autoAssigned');
  assert.strictEqual(syncThreads.t_manual.folderId, 'friends', 'Ręczne przypisanie nie zostaje nadpisane');

  const applied = await pending;
  assert.deepStrictEqual(applied, ['t_new'], 'Zwraca tylko faktycznie przypisane wątki');
  assert.strictEqual(autoStorage._storage.store.mf_threads.t_new.folderId, 'work', 'Przypisanie trafia do pamięci');
  assert.strictEqual(autoStorage._storage.store.mf_threads.t_manual.folderId, 'friends');
  assert.deepStrictEqual(await autoStorage.applyAutoAssignments([]), [], 'Pusta lista → brak zapisu');

  // Ręczne assignThread tuż po zapisie wsadowym nie gubi auto-przypisań (świeża pamięć podręczna)
  await autoStorage.assignThread('t_other', 'groups');
  assert.strictEqual(autoStorage._storage.store.mf_threads.t_new.folderId, 'work');
  console.log('✓ storage.applyAutoAssignments() aktualizuje pamięć podręczną przed zapisem i pomija zmienione wątki');

  // 2. content.js: ręczne przypisanie między porcjami ewaluacji nie jest nadpisane regułą
  const { MessengerRulesEngine } = require('../src/rules.js');
  const realEngine = new MessengerRulesEngine({ storageArea: {} });
  const rules = [
    {
      id: 'r1',
      name: 'Projekty',
      enabled: true,
      priority: 10,
      folderId: 'work',
      matchMode: 'all',
      overwriteManual: false,
      conditions: [{ field: 'name', operator: 'contains', value: 'Projekt' }]
    }
  ];

  const evalStorage = new MessengerFoldersStorage(new MockStorageArea());
  await evalStorage.init();
  const detected = Array.from({ length: 25 }, (_, i) => ({ threadId: `t${i}`, name: `Projekt ${i}` }));

  let yields = 0;
  const uiStub = { filterChatRows() {}, updateFolderCounts() {} };
  loadContentScript({
    MessengerFoldersStorage: function () {
      return evalStorage;
    },
    MessengerDOMDetector: function () {
      return { scanChatList: () => detected };
    },
    MessengerFoldersUI: function () {
      return uiStub;
    },
    MessengerRulesEngine: function () {
      return {
        getRules: async () => rules,
        evaluateThread: (thread, r, folders) => realEngine.evaluateThread(thread, r, folders)
      };
    },
    // Użytkownik przypisuje ręcznie wątek już ocenione (t3) i jeszcze nieocenione (t22) między porcjami
    requestIdleCallback: (resolve) => {
      yields++;
      evalStorage
        .assignThread('t3', 'friends')
        .then(() => evalStorage.assignThread('t22', 'groups'))
        .then(resolve);
    }
  });

  // content.js podpina onRulesChanged do obiektu UI — wywołanie uruchamia ewaluację reguł
  assert.strictEqual(typeof uiStub.onRulesChanged, 'function', 'content.js podpina ui.onRulesChanged');
  await uiStub.onRulesChanged();

  const stored = evalStorage._storage.store.mf_threads;
  assert.strictEqual(stored.t3.folderId, 'friends', 'Zapisane ręczne przypisanie t3 nie jest nadpisane regułą');
  assert.strictEqual(stored.t22.folderId, 'groups', 'Zapisane ręczne przypisanie t22 nie jest nadpisane regułą');

  const after = evalStorage.getAllThreadsSync();
  assert.ok(yields >= 1, 'Ewaluacja 25 wątków oddaje sterowanie między porcjami');
  assert.strictEqual(after.t3.folderId, 'friends', 'Wątek oceniony przed ręcznym przypisaniem nie jest nadpisany');
  assert.strictEqual(after.t3.autoAssigned, undefined, 'Ręczne przypisanie t3 nie jest oznaczone jako automatyczne');
  assert.strictEqual(after.t22.folderId, 'groups', 'Wątek oceniany po ręcznym przypisaniu nie jest nadpisany');
  assert.strictEqual(after.t0.folderId, 'work', 'Pozostałe wątki przypisane regułą');
  assert.strictEqual(after.t24.folderId, 'work');
  assert.strictEqual(after.t0.autoAssigned, true);
  console.log(
    '✓ content.js: ręczne przypisanie między porcjami ewaluacji nie jest nadpisane regułą bez overwriteManual'
  );
}

(async () => {
  await runStorageTests();
  await runAutoAssignmentTests();
  runDetectorTests();
  runUnreadCountsTests();
  console.log('\n=============================================');
  console.log('WSZYSTKIE TESTY ZAKOŃCZYŁY SIĘ POWODZENIEM! ✓');
  console.log('=============================================');
})();
