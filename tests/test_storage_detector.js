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
assert.ok(manifest.host_permissions.includes('*://*.messenger.com/*'), 'host_permissions powinno obejmować messenger.com');
assert.ok(manifest.host_permissions.includes('*://*.facebook.com/messages/*'), 'host_permissions powinno obejmować facebook.com/messages');
assert.strictEqual(manifest.background.service_worker, 'background/background.js', 'Service worker powinien wskazywać na background/background.js');
assert.ok(manifest.content_scripts.length > 0, 'Powinny istnieć reguły content_scripts');
assert.ok(manifest.content_scripts[0].js.includes('src/storage.js'), 'content_scripts powinno ładować src/storage.js');
assert.ok(manifest.content_scripts[0].js.includes('src/detector.js'), 'content_scripts powinno ładować src/detector.js');
assert.ok(manifest.content_scripts[0].js.includes('src/ui.js'), 'content_scripts powinno ładować src/ui.js');
assert.ok(manifest.content_scripts[0].js.includes('src/content.js'), 'content_scripts powinno ładować src/content.js');
assert.ok(manifest.content_scripts[0].css.includes('src/content.css'), 'content_scripts powinno ładować src/content.css');
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
      },
    },
  },
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
  const editedFolder = await storage.saveFolder({ id: newFolder.id, name: 'Projekty 2026', icon: '🎯', color: '#00cc88' });
  assert.strictEqual(editedFolder.name, 'Projekty 2026');
  assert.strictEqual(editedFolder.icon, '🎯');
  console.log('✓ storage.saveFolder() aktualizuje istniejący folder');

  // Test setActiveFolder() i getActiveFolder()
  await storage.setActiveFolder(newFolder.id);
  const active = await storage.getActiveFolder();
  assert.strictEqual(active, newFolder.id, 'Aktywny folder powinien zostać zaktualizowany');
  console.log('✓ storage.setActiveFolder() i getActiveFolder() działają poprawnie');

  // Test assignThread()
  const assigned = await storage.assignThread('100012345', newFolder.id, {
    name: 'Jan Kowalski',
    avatar: 'https://example.com/avatar.jpg',
  });
  assert.strictEqual(assigned.threadId, '100012345');
  assert.strictEqual(assigned.folderId, newFolder.id);
  assert.strictEqual(assigned.name, 'Jan Kowalski');
  assert.strictEqual(assigned.avatar, 'https://example.com/avatar.jpg');
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

  // Test getAllThreads()
  const allThreads = await storage.getAllThreads();
  assert.ok(allThreads['100012345']);
  console.log('✓ storage.getAllThreads() zwraca mapę wszystkich wątków');

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
      { id: 'uncategorized', name: 'Inne', icon: '📁', color: '#6B7280', isSystem: true },
    ],
    threads: {
      '999888': { folderId: 'custom1', name: 'Klient ABC' },
    },
    activeFolder: 'custom1',
  };

  await storage.importData(JSON.stringify(customBackup));
  const foldersAfterImport = await storage.getFolders();
  assert.ok(foldersAfterImport.some((f) => f.id === 'custom1'), 'Zaimportowany folder powinien istnieć');
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
        mf_active_folder: { oldValue: 'custom1', newValue: 'all' },
      },
      'local'
    );
  }
  assert.strictEqual(notified, true, 'Funkcja zwrotna onChange powinna zostać wywołana');
  unsubscribe();
  console.log('✓ storage.onChange() powiadamia o zmianach w magazynie danych');
}

// 3. Testy MessengerDOMDetector
console.log('\n--- Test 3: MessengerDOMDetector ---');
const MessengerDOMDetector = require('../src/detector.js');

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
}

(async () => {
  await runStorageTests();
  runDetectorTests();
  console.log('\n=============================================');
  console.log('WSZYSTKIE TESTY ZAKOŃCZYŁY SIĘ POWODZENIEM! ✓');
  console.log('=============================================');
})();
