/**
 * Messenger Folders - Moduł pamięci podręcznej i synchronizacji danych (Storage)
 *
 * Moduł zarządza folderami i przypisaniami wątków w chrome.storage.local.
 * Automatycznie synchronizuje stan między kartami i oknami przeglądarki.
 *
 * Zgodny z zasadami Prostej Polszczyzny oraz normą PN-ISO 24495-1.
 */

(function (global) {
  'use strict';

  // Klucze używane w chrome.storage.local
  const STORAGE_KEYS = {
    FOLDERS: 'mf_folders',
    ACTIVE_FOLDER: 'mf_active_folder',
    THREADS: 'mf_threads'
  };

  // Domyślna lista folderów startowych
  const DEFAULT_FOLDERS = [
    { id: 'all', name: 'Wszystkie', icon: '💬', color: '#0084FF', isSystem: true },
    { id: 'important', name: 'Ważne', icon: '⭐', color: '#FFB800', isSystem: false },
    { id: 'work', name: 'Praca', icon: '💼', color: '#10B981', isSystem: false },
    { id: 'friends', name: 'Znajomi', icon: '👥', color: '#8B5CF6', isSystem: false },
    { id: 'groups', name: 'Grupy', icon: '📢', color: '#EC4899', isSystem: false },
    { id: 'uncategorized', name: 'Inne', icon: '📁', color: '#6B7280', isSystem: true }
  ];

  class MessengerFoldersStorage {
    /**
     * Tworzy instancję modułu pamięci.
     * @param {Object} [storageArea] Opcjonalny adapter pamięci (domyślnie chrome.storage.local).
     */
    constructor(storageArea = null) {
      this._storage = storageArea || (typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null);
      this._folders = [];
      this._activeFolder = 'all';
      this._threads = {};
      this._listeners = new Set();
      this._isInitialized = false;
      this._onChangedBound = this._handleStorageChanged.bind(this);

      // Podpięcie nasłuchiwania zewnętrznych zmian
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(this._onChangedBound);
      }
    }

    /**
     * Sprawdza, czy interfejs chrome.storage jest dostępny.
     * @private
     */
    _ensureStorageAvailable() {
      if (!this._storage) {
        throw new Error('Pamięć rozszerzenia (chrome.storage.local) jest niedostępna.');
      }
    }

    /**
     * Pobiera wartości z pamięci rozszerzenia w sposób asynchroniczny.
     * @private
     * @param {string|string[]} keys Klucz lub tablica kluczy.
     * @returns {Promise<Object>} Pobrane dane.
     */
    _get(keys) {
      this._ensureStorageAvailable();
      return new Promise((resolve, reject) => {
        try {
          this._storage.get(keys, (items) => {
            if (chrome?.runtime?.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(items || {});
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    }

    /**
     * Zapisuje wartości w pamięci rozszerzenia w sposób asynchroniczny.
     * @private
     * @param {Object} items Obiekt z danymi do zapisu.
     * @returns {Promise<void>}
     */
    _set(items) {
      this._ensureStorageAvailable();
      return new Promise((resolve, reject) => {
        try {
          this._storage.set(items, () => {
            if (chrome?.runtime?.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    }

    /**
     * Obsługuje zdarzenie chrome.storage.onChanged.
     * Aktualizuje pamięć podręczną i powiadamia zarejestrowanych odbiorców.
     * @private
     */
    _handleStorageChanged(changes, areaName) {
      if (areaName !== 'local') return;

      let hasRelevantChanges = false;

      if (changes[STORAGE_KEYS.FOLDERS]) {
        this._folders = changes[STORAGE_KEYS.FOLDERS].newValue || [];
        hasRelevantChanges = true;
      }

      if (changes[STORAGE_KEYS.ACTIVE_FOLDER]) {
        this._activeFolder = changes[STORAGE_KEYS.ACTIVE_FOLDER].newValue || 'all';
        hasRelevantChanges = true;
      }

      if (changes[STORAGE_KEYS.THREADS]) {
        this._threads = changes[STORAGE_KEYS.THREADS].newValue || {};
        hasRelevantChanges = true;
      }

      if (hasRelevantChanges) {
        const payload = {
          changes,
          folders: this._folders,
          activeFolder: this._activeFolder,
          threads: this._threads
        };
        for (const listener of this._listeners) {
          try {
            listener(payload);
          } catch (listenerError) {
            console.error('Błąd w funkcji zwrotnej nasłuchującej zmian pamięci:', listenerError);
          }
        }
      }
    }

    /**
     * Inicjalizuje magazyn danych.
     * Tworzy domyślne foldery, jeśli pamięć jest pusta.
     * @returns {Promise<{ folders: Array, activeFolder: string, threads: Object }>}
     */
    async init() {
      const stored = await this._get([STORAGE_KEYS.FOLDERS, STORAGE_KEYS.ACTIVE_FOLDER, STORAGE_KEYS.THREADS]);

      const updates = {};

      if (!Array.isArray(stored[STORAGE_KEYS.FOLDERS]) || stored[STORAGE_KEYS.FOLDERS].length === 0) {
        updates[STORAGE_KEYS.FOLDERS] = DEFAULT_FOLDERS.map((f) => ({ ...f }));
        this._folders = updates[STORAGE_KEYS.FOLDERS];
      } else {
        this._folders = stored[STORAGE_KEYS.FOLDERS];
      }

      if (typeof stored[STORAGE_KEYS.ACTIVE_FOLDER] !== 'string') {
        updates[STORAGE_KEYS.ACTIVE_FOLDER] = 'all';
        this._activeFolder = 'all';
      } else {
        this._activeFolder = stored[STORAGE_KEYS.ACTIVE_FOLDER];
      }

      if (!stored[STORAGE_KEYS.THREADS] || typeof stored[STORAGE_KEYS.THREADS] !== 'object') {
        updates[STORAGE_KEYS.THREADS] = {};
        this._threads = {};
      } else {
        this._threads = stored[STORAGE_KEYS.THREADS];
      }

      if (Object.keys(updates).length > 0) {
        await this._set(updates);
      }

      this._isInitialized = true;
      return {
        folders: this.getFoldersSync(),
        activeFolder: this._activeFolder,
        threads: { ...this._threads }
      };
    }

    /**
     * Zwraca listę folderów z pamięci podręcznej bez oczekiwania na Promise.
     * @returns {Array<Object>}
     */
    getFoldersSync() {
      return this._folders.map((folder) => ({ ...folder }));
    }

    /**
     * Pobiera listę wszystkich folderów.
     * @returns {Promise<Array<Object>>}
     */
    async getFolders() {
      if (!this._isInitialized) {
        await this.init();
      }
      return this.getFoldersSync();
    }

    /**
     * Normalizuje i weryfikuje dane folderu.
     * Zwraca znormalizowany obiekt folderu lub null, jeśli dane są niepoprawne.
     * @param {Object} folder Obiekt folderu do normalizacji.
     * @param {Object} [fallback] Wartości zastępcze dla brakujących pól.
     * @returns {Object|null}
     * @private
     */
    _normalizeFolder(folder, fallback = {}) {
      if (!folder || typeof folder !== 'object') {
        return null;
      }

      // Identyfikator: dopuszczalny tylko bezpieczny alfabet /^[a-z0-9_-]{1,64}$/i
      const rawId = typeof folder.id === 'string' && folder.id.trim() ? folder.id.trim() : fallback.id || '';
      if (!rawId || !/^[a-z0-9_-]{1,64}$/i.test(rawId)) {
        return null;
      }

      // Nazwa: niepusta, przycinana do maksymalnie 40 znaków
      const rawName = typeof folder.name === 'string' && folder.name.trim() ? folder.name.trim() : fallback.name || '';
      if (!rawName) {
        return null;
      }
      const safeName = rawName.slice(0, 40);

      // Kolor: poprawny format HEX #RRGGBB, inaczej domyślny #0084FF
      const rawColor = typeof folder.color === 'string' ? folder.color.trim() : '';
      const safeColor = /^#[0-9a-fA-F]{6}$/.test(rawColor)
        ? rawColor
        : fallback.color && /^#[0-9a-fA-F]{6}$/.test(fallback.color)
          ? fallback.color
          : '#0084FF';

      // Ikona: do 8 znaków, bez znaków < lub >, inaczej domyślna 📁
      const rawIcon = typeof folder.icon === 'string' ? folder.icon.trim() : '';
      const safeIcon =
        rawIcon && rawIcon.length <= 8 && !/[<>]/.test(rawIcon)
          ? rawIcon
          : fallback.icon && fallback.icon.length <= 8 && !/[<>]/.test(fallback.icon)
            ? fallback.icon
            : '📁';

      return {
        id: rawId,
        name: safeName,
        icon: safeIcon,
        color: safeColor,
        isSystem: Boolean(folder.isSystem ?? fallback.isSystem ?? false)
      };
    }

    /**
     * Zapisuje nowy folder lub aktualizuje istniejący.
     * @param {Object} folder Dane folderu.
     * @param {string} [folder.id] Identyfikator folderu (jeśli brak, zostanie wygenerowany).
     * @param {string} folder.name Nazwa folderu.
     * @param {string} [folder.icon] Ikona lub emoji folderu.
     * @param {string} [folder.color] Kolor wyróżnienia w formacie HEX.
     * @returns {Promise<Object>} Zapisany obiekt folderu.
     */
    async saveFolder({ id, name, icon, color }) {
      if (!this._isInitialized) {
        await this.init();
      }

      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new Error('Nazwa folderu nie może być pusta.');
      }

      const folders = [...this._folders];
      const existing = id ? folders.find((f) => f.id === (typeof id === 'string' ? id.trim() : '')) : null;

      const generatedId =
        id && typeof id === 'string' && id.trim()
          ? id.trim()
          : `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const normalized = this._normalizeFolder({ id: generatedId, name, icon, color }, existing || {});
      if (!normalized) {
        throw new Error('Niepoprawne dane folderu.');
      }

      if (id) {
        const index = folders.findIndex((f) => f.id === normalized.id);
        if (index >= 0) {
          const existing = folders[index];
          // Folder główny 'all' zachowuje swoją stałą nazwę
          folders[index] = {
            ...existing,
            name: existing.id === 'all' ? existing.name : normalized.name,
            icon: normalized.icon,
            color: normalized.color
          };
          this._folders = folders;
          await this._set({ [STORAGE_KEYS.FOLDERS]: folders });
          return { ...folders[index] };
        }
      }

      // Utworzenie nowego folderu użytkownika
      const newFolder = {
        ...normalized,
        isSystem: false
      };

      folders.push(newFolder);
      this._folders = folders;
      await this._set({ [STORAGE_KEYS.FOLDERS]: folders });
      return { ...newFolder };
    }

    /**
     * Usuwa folder o podanym identyfikatorze.
     * Nie pozwala na usunięcie folderów systemowych.
     * Wątki z usuwanego folderu przenosi do folderu 'uncategorized'.
     * @param {string} folderId Identyfikator folderu do usunięcia.
     * @returns {Promise<boolean>} Informacja, czy folder został usunięty.
     */
    async deleteFolder(folderId) {
      if (!this._isInitialized) {
        await this.init();
      }

      const target = this._folders.find((f) => f.id === folderId);
      if (!target) {
        return false;
      }

      if (target.isSystem || folderId === 'all' || folderId === 'uncategorized') {
        throw new Error('Nie można usunąć folderu systemowego.');
      }

      const updatedFolders = this._folders.filter((f) => f.id !== folderId);
      const updatedThreads = { ...this._threads };
      let threadsChanged = false;

      // Przeniesienie przypisanych wątków do 'uncategorized'
      for (const [threadId, threadData] of Object.entries(updatedThreads)) {
        if (threadData.folderId === folderId) {
          updatedThreads[threadId] = {
            ...threadData,
            folderId: 'uncategorized',
            updatedAt: Date.now()
          };
          threadsChanged = true;
        }
      }

      const payload = {
        [STORAGE_KEYS.FOLDERS]: updatedFolders
      };

      if (threadsChanged) {
        payload[STORAGE_KEYS.THREADS] = updatedThreads;
        this._threads = updatedThreads;
      }

      if (this._activeFolder === folderId) {
        payload[STORAGE_KEYS.ACTIVE_FOLDER] = 'all';
        this._activeFolder = 'all';
      }

      this._folders = updatedFolders;
      await this._set(payload);
      return true;
    }

    /**
     * Zwraca aktywny folder z pamięci podręcznej bez oczekiwania na Promise.
     * @returns {string}
     */
    getActiveFolderSync() {
      return this._activeFolder;
    }

    /**
     * Pobiera aktywny folder filtrowania.
     * @returns {Promise<string>}
     */
    async getActiveFolder() {
      if (!this._isInitialized) {
        await this.init();
      }
      return this.getActiveFolderSync();
    }

    /**
     * Ustawia aktywny folder filtrowania.
     * @param {string} folderId Identyfikator folderu.
     * @returns {Promise<string>}
     */
    async setActiveFolder(folderId) {
      if (!this._isInitialized) {
        await this.init();
      }

      const exists = this._folders.some((f) => f.id === folderId);
      if (!exists && folderId !== 'all') {
        throw new Error(`Folder o identyfikatorze "${folderId}" nie istnieje.`);
      }

      this._activeFolder = folderId;
      await this._set({ [STORAGE_KEYS.ACTIVE_FOLDER]: folderId });
      return this._activeFolder;
    }

    /**
     * Przypisuje wątek do wybranego folderu.
     * @param {string} threadId Identyfikator wątku Messenger.
     * @param {string} folderId Identyfikator docelowego folderu.
     * @param {Object} [metadata] Dodatkowe dane wątku (nazwa, awatar).
     * @returns {Promise<Object>} Zapisane dane wątku.
     */
    async assignThread(threadId, folderId, metadata = {}) {
      if (!this._isInitialized) {
        await this.init();
      }

      if (!threadId || typeof threadId !== 'string') {
        throw new Error('Identyfikator wątku jest wymagany.');
      }

      if (!folderId || typeof folderId !== 'string') {
        throw new Error('Identyfikator folderu jest wymagany.');
      }

      const cleanThreadId = String(threadId).trim();
      const existing = this._threads[cleanThreadId] || {};

      const updatedRecord = {
        ...existing,
        folderId,
        name: (metadata && metadata.name) || existing.name || '',
        avatar: (metadata && metadata.avatar) || existing.avatar || '',
        assignedAt: existing.assignedAt || Date.now(),
        updatedAt: Date.now()
      };

      // Zapis opcjonalnych dodatkowych pól z metadata
      if (metadata && typeof metadata === 'object') {
        for (const [key, value] of Object.entries(metadata)) {
          if (!['folderId', 'name', 'avatar', 'assignedAt', 'updatedAt'].includes(key)) {
            updatedRecord[key] = value;
          }
        }
      }

      const updatedThreads = {
        ...this._threads,
        [cleanThreadId]: updatedRecord
      };

      this._threads = updatedThreads;
      await this._set({ [STORAGE_KEYS.THREADS]: updatedThreads });
      return { threadId: cleanThreadId, ...updatedRecord };
    }

    /**
     * Usuwa przypisanie wątku do folderu (przypisuje do 'uncategorized').
     * @param {string} threadId Identyfikator wątku.
     * @returns {Promise<boolean>}
     */
    async removeThreadAssignment(threadId) {
      if (!this._isInitialized) {
        await this.init();
      }

      const cleanThreadId = String(threadId).trim();
      if (!this._threads[cleanThreadId]) {
        return false;
      }

      const updatedThreads = { ...this._threads };
      delete updatedThreads[cleanThreadId];

      this._threads = updatedThreads;
      await this._set({ [STORAGE_KEYS.THREADS]: updatedThreads });
      return true;
    }

    /**
     * Pobiera identyfikator folderu, do którego przypisany jest wątek.
     * @param {string} threadId Identyfikator wątku.
     * @returns {Promise<string>} Identyfikator folderu (domyślnie 'uncategorized').
     */
    async getThreadFolder(threadId) {
      if (!this._isInitialized) {
        await this.init();
      }

      const cleanThreadId = String(threadId).trim();
      const thread = this._threads[cleanThreadId];
      return thread && thread.folderId ? thread.folderId : 'uncategorized';
    }

    /**
     * Pobiera listę wątków znajdujących się w danym folderze.
     * @param {string} folderId Identyfikator folderu.
     * @returns {Promise<Array<Object>>} Tablica wątków z identyfikatorami.
     */
    async getThreadsInFolder(folderId) {
      if (!this._isInitialized) {
        await this.init();
      }

      const results = [];

      for (const [threadId, data] of Object.entries(this._threads)) {
        if (folderId === 'all') {
          results.push({ threadId, ...data });
        } else if (data.folderId === folderId) {
          results.push({ threadId, ...data });
        }
      }

      return results;
    }

    /**
     * Zwraca mapę wszystkich wątków z pamięci podręcznej bez oczekiwania na Promise.
     * @returns {Object} Mapa wątków klucz-wartość.
     */
    getAllThreadsSync() {
      return { ...this._threads };
    }

    /**
     * Pobiera wszystkie zarejestrowane wątki.
     * @returns {Promise<Object>} Mapa wątków klucz-wartość.
     */
    async getAllThreads() {
      if (!this._isInitialized) {
        await this.init();
      }
      return this.getAllThreadsSync();
    }

    /**
     * Eksportuje dane wtyczki do formatu JSON.
     * @returns {Promise<string>} Tekst w formacie JSON z zapisaną konfiguracją.
     */
    async exportData() {
      if (!this._isInitialized) {
        await this.init();
      }

      const bundle = {
        version: 1,
        exportedAt: new Date().toISOString(),
        folders: this.getFoldersSync(),
        threads: { ...this._threads },
        activeFolder: this._activeFolder
      };

      return JSON.stringify(bundle, null, 2);
    }

    /**
     * Importuje dane konfiguracji z tekstu JSON.
     * Sprawdza poprawność struktury danych przed zapisem.
     * @param {string|Object} jsonData Dane w formacie JSON lub obiekt.
     * @returns {Promise<boolean>} Sukces operacji.
     */
    async importData(jsonData) {
      if (!this._isInitialized) {
        await this.init();
      }

      let parsed;
      if (typeof jsonData === 'string') {
        try {
          parsed = JSON.parse(jsonData);
        } catch (err) {
          throw new Error('Niepoprawny format JSON w danych importu.', { cause: err });
        }
      } else if (jsonData && typeof jsonData === 'object') {
        parsed = jsonData;
      } else {
        throw new Error('Brak danych do zaimportowania.');
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Dane importu muszą być obiektem.');
      }

      if (!Array.isArray(parsed.folders)) {
        throw new Error('Dane importu nie zawierają poprawnej listy folderów.');
      }

      const systemFolderIds = new Set(DEFAULT_FOLDERS.map((f) => f.id));
      const importedFolders = [];
      const seenIds = new Set();

      for (const rawFolder of parsed.folders) {
        const normalized = this._normalizeFolder(rawFolder);
        if (!normalized) {
          continue;
        }
        if (seenIds.has(normalized.id)) {
          continue;
        }
        seenIds.add(normalized.id);
        normalized.isSystem = systemFolderIds.has(normalized.id);
        importedFolders.push(normalized);
      }

      // Upewnienie się, że wszystkie foldery systemowe zawsze istnieją
      for (const defaultFolder of DEFAULT_FOLDERS) {
        const found = importedFolders.find((f) => f.id === defaultFolder.id);
        if (!found) {
          importedFolders.unshift({ ...defaultFolder });
          seenIds.add(defaultFolder.id);
        }
      }

      const rawThreads =
        parsed.threads && typeof parsed.threads === 'object' && !Array.isArray(parsed.threads) ? parsed.threads : {};
      const importedThreads = {};

      for (const [threadId, threadData] of Object.entries(rawThreads)) {
        if (threadData && typeof threadData === 'object' && !Array.isArray(threadData)) {
          importedThreads[threadId] = threadData;
        }
      }

      const activeFolder =
        typeof parsed.activeFolder === 'string' && importedFolders.some((f) => f.id === parsed.activeFolder)
          ? parsed.activeFolder
          : 'all';

      const payload = {
        [STORAGE_KEYS.FOLDERS]: importedFolders,
        [STORAGE_KEYS.THREADS]: importedThreads,
        [STORAGE_KEYS.ACTIVE_FOLDER]: activeFolder
      };

      await this._set(payload);

      this._folders = importedFolders;
      this._threads = importedThreads;
      this._activeFolder = activeFolder;

      return true;
    }

    /**
     * Rejestruje funkcję nasłuchującą zmian w magazynie danych.
     * @param {Function} callback Funkcja wywoływana przy zmianie danych.
     * @returns {Function} Funkcja wyrejestrowująca nasłuchiwanie.
     */
    onChange(callback) {
      if (typeof callback !== 'function') {
        throw new Error('Parametr callback musi być funkcją.');
      }
      this._listeners.add(callback);
      return () => {
        this._listeners.delete(callback);
      };
    }
  }

  // Udostępnienie klasy w zasięgu globalnym oraz jako moduł CommonJS
  if (typeof global !== 'undefined') {
    global.MessengerFoldersStorage = MessengerFoldersStorage;
    global.DEFAULT_FOLDERS = DEFAULT_FOLDERS;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      MessengerFoldersStorage,
      DEFAULT_FOLDERS,
      STORAGE_KEYS
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
