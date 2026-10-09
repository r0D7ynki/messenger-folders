/**
 * Messenger Folders - Skrypt tła (Background Service Worker)
 *
 * Odpowiada za cykl życia rozszerzenia oraz inicjalizację pamięci
 * podczas instalacji i aktualizacji wtyczki w przeglądarce.
 *
 * Zgodny ze standardem Manifest V3 oraz normą PN-ISO 24495-1.
 */

// Import modułu pamięci do środowiska Service Worker
try {
  importScripts('../src/storage.js');
} catch (importError) {
  console.warn('Nie udało się zaimportować src/storage.js przez importScripts:', importError);
}

// Domyślne foldery awaryjne (gdyby importScripts nie zadziałał)
const FALLBACK_DEFAULT_FOLDERS = [
  { id: 'all', name: 'Wszystkie', icon: '💬', color: '#0084FF', isSystem: true },
  { id: 'important', name: 'Ważne', icon: '⭐', color: '#FFB800', isSystem: false },
  { id: 'work', name: 'Praca', icon: '💼', color: '#10B981', isSystem: false },
  { id: 'friends', name: 'Znajomi', icon: '👥', color: '#8B5CF6', isSystem: false },
  { id: 'groups', name: 'Grupy', icon: '📢', color: '#EC4899', isSystem: false },
  { id: 'uncategorized', name: 'Inne', icon: '📁', color: '#6B7280', isSystem: true },
];

/**
 * Inicjalizuje magazyn danych rozszerzenia.
 */
async function initializeStorage() {
  try {
    if (typeof MessengerFoldersStorage !== 'undefined') {
      const storage = new MessengerFoldersStorage();
      await storage.init();
      console.log('Messenger Folders: Magazyn danych został pomyślnie zainicjalizowany.');
      return;
    }

    // Bezpośrednia inicjalizacja w chrome.storage.local
    if (chrome?.storage?.local) {
      chrome.storage.local.get(['mf_folders', 'mf_active_folder', 'mf_threads'], (items) => {
        const updates = {};
        if (!Array.isArray(items.mf_folders) || items.mf_folders.length === 0) {
          updates.mf_folders = FALLBACK_DEFAULT_FOLDERS;
        }
        if (typeof items.mf_active_folder !== 'string') {
          updates.mf_active_folder = 'all';
        }
        if (!items.mf_threads || typeof items.mf_threads !== 'object') {
          updates.mf_threads = {};
        }

        if (Object.keys(updates).length > 0) {
          chrome.storage.local.set(updates, () => {
            console.log('Messenger Folders: Domyślna konfiguracja została zapisana.');
          });
        }
      });
    }
  } catch (error) {
    console.error('Błąd podczas inicjalizacji danych rozszerzenia:', error);
  }
}

// Nasłuchiwanie zdarzenia instalacji i aktualizacji wtyczki
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`Messenger Folders: Uruchomiono zdarzenie onInstalled (${details.reason}).`);
  await initializeStorage();
});

// Nasłuchiwanie uruchomienia przeglądarki
chrome.runtime.onStartup.addListener(async () => {
  await initializeStorage();
});
