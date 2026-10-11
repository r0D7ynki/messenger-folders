/**
 * Messenger Folders - Skrypt zawartości (Content Script)
 *
 * Główny punkt wejścia wstrzykiwany na strony messenger.com i facebook.com.
 * Integruje moduły pamięci (Storage), detektora DOM (Detector),
 * silnika reguł (RulesEngine) i interfejsu (UI).
 *
 * Zgodny ze standardem Manifest V3 oraz normą PN-ISO 24495-1.
 */

(async function () {
  'use strict';

  console.log('Messenger Folders: Inicjalizacja skryptu zawartości...');

  // Inicjalizacja instancji modułów
  const storage = new MessengerFoldersStorage();
  const detector = new MessengerDOMDetector();
  const rulesEngine = typeof MessengerRulesEngine !== 'undefined' ? new MessengerRulesEngine({ storage }) : null;
  const ui = new MessengerFoldersUI({ storage, detector, rulesEngine });

  // Stan podręczny w pamięci (Memory Cache)
  let currentFolders = [];
  let currentActiveFolder = 'all';
  let currentThreads = {};
  let currentUnreadCounts = { all: 0 };
  let lastUrl = typeof window !== 'undefined' ? window.location.href : '';

  /**
   * Oblicza liczbę nieprzeczytanych wątków dla poszczególnych folderów
   * oraz łączną liczbę nieprzeczytanych wątków dla folderu 'all'.
   *
   * @param {Array<Object>} detectedThreads - Lista wątków zwrócona przez detector.scanChatList()
   * @param {Object} threadsMap - Mapa przypisanych wątków z magazynu: { [threadId]: { folderId, ... } }
   * @param {Array<Object>} folders - Lista skonfigurowanych folderów użytkownika i systemowych
   * @returns {Object} Mapa z liczbami nieprzeczytanych: { all: number, [folderId]: number }
   */
  function calculateUnreadCounts(detectedThreads = [], threadsMap = {}, folders = []) {
    const counts = { all: 0 };

    // Inicjalizacja liczników wartością bazową 0 dla wszystkich skonfigurowanych folderów
    if (Array.isArray(folders)) {
      for (const f of folders) {
        if (f && f.id) {
          counts[f.id] = 0;
        }
      }
    }
    if (!('uncategorized' in counts)) {
      counts.uncategorized = 0;
    }

    if (!Array.isArray(detectedThreads) || detectedThreads.length === 0) {
      return counts;
    }

    const safeThreadsMap = threadsMap && typeof threadsMap === 'object' ? threadsMap : {};
    const countedThreadIds = new Set();

    for (const thread of detectedThreads) {
      if (!thread || !thread.threadId || !thread.isUnread) {
        continue;
      }

      const cleanThreadId = String(thread.threadId).trim();
      if (countedThreadIds.has(cleanThreadId)) {
        continue;
      }
      countedThreadIds.add(cleanThreadId);

      // Suma dla folderu 'all' sumuje wszystkie wykryte nieprzeczytane wątki
      counts.all = (counts.all || 0) + 1;

      // Zliczenie dla konkretnego folderu
      const threadData = safeThreadsMap[cleanThreadId];
      const folderId = threadData && threadData.folderId ? threadData.folderId : 'uncategorized';
      counts[folderId] = (counts[folderId] || 0) + 1;
    }

    return counts;
  }

  // Eksport pomocniczy dla testów jednostkowych i środowiska E2E
  if (typeof globalThis !== 'undefined') {
    globalThis.calculateUnreadCounts = calculateUnreadCounts;
  }

  // Zarządzanie stanem nieblokującej ewaluacji reguł
  let isEvaluatingRules = false;
  let hasPendingEvaluation = false;
  const MAX_EVALUATED_CACHE = 1000;
  const evaluatedCache = new Set(); // Klucze memoizacji: `${threadId}:${name}:${rulesVersion}`

  /**
   * Dodaje klucz do pamięci podręcznej z ograniczeniem do MAX_EVALUATED_CACHE wpisów (FIFO).
   *
   * @param {string} key
   */
  function addToEvaluatedCache(key) {
    while (evaluatedCache.size >= MAX_EVALUATED_CACHE) {
      const oldestKey = evaluatedCache.values().next().value;
      if (oldestKey === undefined) break;
      evaluatedCache.delete(oldestKey);
    }
    evaluatedCache.add(key);
  }

  /**
   * Wykonuje nieblokujące dopasowanie wykrytych wątków do aktywnych reguł
   * i zapisuje nowe przypisania w pojedynczej operacji wsadowej (batch write).
   *
   * @param {Array<Object>} detectedThreads - Lista wątków zwrócona przez detector.scanChatList()
   */
  async function evaluateRulesNonBlocking(detectedThreads) {
    if (!rulesEngine || !detectedThreads || detectedThreads.length === 0) {
      return;
    }

    // Blokada współbieżności (Mutex / Gate)
    if (isEvaluatingRules) {
      hasPendingEvaluation = true;
      return;
    }

    isEvaluatingRules = true;
    try {
      const rules = (await rulesEngine.getRules()) || [];
      const enabledRules = rules.filter((r) => r.enabled);

      if (enabledRules.length === 0) {
        return;
      }

      const folders = storage.getFoldersSync();
      const existingThreads = storage.getAllThreadsSync();
      const rulesVersion = rules.map((r) => `${r.id}_${r.priority}_${r.enabled}`).join('|');

      // Wyselekcjonuj kandydatów wymagających ewaluacji
      const candidates = detectedThreads.filter((t) => {
        if (!t || !t.threadId) return false;
        const cacheKey = `${t.threadId}:${t.name || ''}:${rulesVersion}`;
        if (evaluatedCache.has(cacheKey)) {
          return false;
        }

        const existing = existingThreads[t.threadId];
        const isManuallyAssigned =
          existing && existing.folderId && existing.folderId !== 'uncategorized' && !existing.autoAssigned;

        // Jeśli wątek jest przypisany ręcznie, pomijamy go, chyba że reguła zezwala na nadpisanie
        if (isManuallyAssigned && !enabledRules.some((r) => r.overwriteManual)) {
          addToEvaluatedCache(cacheKey);
          return false;
        }
        return true;
      });

      if (candidates.length === 0) {
        return;
      }

      const CHUNK_SIZE = 20;
      const newAssignments = [];

      // Przetwarzanie w porcjach z oddawaniem sterowania do pętli zdarzeń (60 FPS)
      for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
        const chunk = candidates.slice(i, i + CHUNK_SIZE);
        // Świeży stan po każdym oddaniu sterowania — użytkownik mógł w tym czasie przypisać wątek ręcznie
        const threadsNow = i === 0 ? existingThreads : storage.getAllThreadsSync();

        for (const thread of chunk) {
          const cacheKey = `${thread.threadId}:${thread.name || ''}:${rulesVersion}`;
          addToEvaluatedCache(cacheKey);

          const existing = threadsNow[thread.threadId];
          const isManuallyAssigned =
            existing && existing.folderId && existing.folderId !== 'uncategorized' && !existing.autoAssigned;

          const threadToEval = {
            ...thread,
            folderId: existing?.folderId,
            isManual: Boolean(isManuallyAssigned)
          };

          const matchedFolderId = rulesEngine.evaluateThread(threadToEval, enabledRules, folders);
          if (matchedFolderId) {
            if (!existing || existing.folderId !== matchedFolderId) {
              newAssignments.push({
                threadId: thread.threadId,
                folderId: matchedFolderId,
                expectedFolderId: existing?.folderId || null,
                metadata: {
                  name: thread.name || '',
                  avatar: thread.avatar || ''
                }
              });
            }
          }
        }

        // Oddanie kontroli przeglądarce przed kolejną porcją
        if (i + CHUNK_SIZE < candidates.length) {
          await new Promise((resolve) => {
            if (typeof requestIdleCallback !== 'undefined') {
              requestIdleCallback(resolve, { timeout: 40 });
            } else {
              setTimeout(resolve, 0);
            }
          });
        }
      }

      // Pojedynczy zapis wsadowy (Single-Batch Write) przez publiczne API storage;
      // wątki, których folder zmienił się w trakcie ewaluacji, są pomijane
      const applied = await storage.applyAutoAssignments(newAssignments);
      if (applied.length > 0) {
        console.log(`Messenger Folders: Automatycznie przypisano ${applied.length} wątków.`);

        // Natychmiastowe odświeżenie interfejsu i aktywnego filtra z pamięci podręcznej
        currentActiveFolder = storage.getActiveFolderSync();
        currentThreads = storage.getAllThreadsSync();
        currentFolders = storage.getFoldersSync();
        currentUnreadCounts = calculateUnreadCounts(detector.scanChatList(), currentThreads, currentFolders);
        ui.filterChatRows(currentActiveFolder, currentThreads);
        if (typeof ui.updateFolderCounts === 'function') {
          ui.updateFolderCounts(currentThreads, currentUnreadCounts);
        } else {
          ui.renderFolderBar(currentFolders, currentActiveFolder, currentThreads, currentUnreadCounts);
        }
      }
    } catch (err) {
      console.error('Błąd podczas ewaluacji reguł automatycznych:', err);
    } finally {
      isEvaluatingRules = false;
      if (hasPendingEvaluation) {
        hasPendingEvaluation = false;
        const freshThreads = detector.scanChatList();
        evaluateRulesNonBlocking(freshThreads);
      }
    }
  }

  // Powiązanie callbacku zmian reguł z interfejsu użytkownika
  ui.onRulesChanged = async () => {
    evaluatedCache.clear();
    const scanned = detector.scanChatList();
    await evaluateRulesNonBlocking(scanned);
  };

  // Nasłuchiwanie bezpośrednich zmian mf_rules w chrome.storage.local
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName === 'local' && changes.mf_rules) {
        evaluatedCache.clear();
        const scanned = detector.scanChatList();
        await evaluateRulesNonBlocking(scanned);
      }
    });
  }

  /**
   * Główna funkcja uruchamiająca wtyczkę na stronie.
   */
  async function start() {
    try {
      await storage.init();

      currentFolders = storage.getFoldersSync();
      currentActiveFolder = storage.getActiveFolderSync();
      currentThreads = storage.getAllThreadsSync();
      lastUrl = window.location.href;

      /**
       * Renderuje pasek folderów na podstawie stanu pamięci podręcznej i wstrzykuje go w DOM.
       * @returns {boolean} Czy pasek został poprawnie wstrzyknięty lub jest już w DOM.
       */
      const renderAndInjectBar = () => {
        const detected = detector.scanChatList();
        currentUnreadCounts = calculateUnreadCounts(detected, currentThreads, currentFolders);

        const bar = ui.renderFolderBar(
          currentFolders,
          currentActiveFolder,
          currentThreads,
          currentUnreadCounts,
          async (folderId) => {
            currentActiveFolder = folderId;
            await storage.setActiveFolder(folderId);
            ui.filterChatRows(folderId, currentThreads);
          },
          () => {
            ui.showFolderModal({
              onSave: async (newFolder) => {
                await storage.saveFolder(newFolder);
                await storage.setActiveFolder(newFolder.id);
                currentFolders = storage.getFoldersSync();
                currentActiveFolder = newFolder.id;
                currentThreads = storage.getAllThreadsSync();
                renderAndInjectBar();
                ui.filterChatRows(newFolder.id, currentThreads);
              }
            });
          },
          (folder) => {
            ui.showFolderModal({
              folder,
              onSave: async (updated) => {
                await storage.saveFolder(updated);
                currentFolders = storage.getFoldersSync();
                currentActiveFolder = storage.getActiveFolderSync();
                currentThreads = storage.getAllThreadsSync();
                renderAndInjectBar();
                ui.filterChatRows(currentActiveFolder, currentThreads);
              },
              onDelete: async (fId) => {
                await storage.deleteFolder(fId);
                currentFolders = storage.getFoldersSync();
                currentActiveFolder = 'all';
                currentThreads = storage.getAllThreadsSync();
                renderAndInjectBar();
                ui.filterChatRows('all', currentThreads);
              }
            });
          },
          () => {
            ui.showSettingsModal();
          }
        );

        const injected = detector.injectFolderBar(bar);
        if (injected) {
          ui.filterChatRows(currentActiveFolder, currentThreads);
        }
        return injected;
      };

      if (!renderAndInjectBar()) {
        // Ponawianie próby przy starcie, dopóki strona nie załaduje struktury DOM
        const retryTimer = setInterval(() => {
          if (renderAndInjectBar()) {
            clearInterval(retryTimer);
          }
        }, 500);

        setTimeout(() => clearInterval(retryTimer), 15000);
      }

      // Wstępna ewaluacja reguł oraz przeliczenie liczników dla wątków obecnych w drzewie DOM (Cold Start)
      const initialDetected = detector.scanChatList();
      if (initialDetected && initialDetected.length > 0) {
        currentUnreadCounts = calculateUnreadCounts(initialDetected, currentThreads, currentFolders);
        if (typeof ui.updateFolderCounts === 'function') {
          ui.updateFolderCounts(currentThreads, currentUnreadCounts);
        }
        await evaluateRulesNonBlocking(initialDetected);
      }

      // Podpięcie obserwatora dynamicznego ładowania listy czatów (virtual scrolling)
      // Wykorzystuje pamięć podręczną — nie odpytuje storage przy mutacjach DOM
      detector.setupObserver(
        async (threads) => {
          // Reaktywne przeliczenie liczników nieprzeczytanych z wykrytych wątków
          currentUnreadCounts = calculateUnreadCounts(threads, currentThreads, currentFolders);

          // Wstrzyknij pasek tylko wtedy, gdy nie istnieje w DOM (np. po przebudowie kontenera przez aplikację)
          const barExists = document.getElementById('mf-folder-bar')?.isConnected;
          if (!barExists) {
            renderAndInjectBar();
          } else if (typeof ui.updateFolderCounts === 'function') {
            ui.updateFolderCounts(currentThreads, currentUnreadCounts);
          }

          // Sprawdzenie zmiany adresu URL przy przełączaniu wątków podczas mutacji DOM
          if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
          }

          await evaluateRulesNonBlocking(threads);
          ui.filterChatRows(currentActiveFolder, currentThreads);
        },
        { throttleMs: 250 }
      );

      // Obsługa nawigacji w aplikacji Single Page App (SPA) bez ciągłego odpytywania w pętli setInterval
      const handleNavigationChange = async () => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          const scanned = detector.scanChatList();
          currentUnreadCounts = calculateUnreadCounts(scanned, currentThreads, currentFolders);
          if (typeof ui.updateFolderCounts === 'function') {
            ui.updateFolderCounts(currentThreads, currentUnreadCounts);
          }
          ui.filterChatRows(currentActiveFolder, currentThreads);
          await evaluateRulesNonBlocking(scanned);
        }
      };

      if (typeof window.navigation !== 'undefined' && window.navigation.addEventListener) {
        window.navigation.addEventListener('currententrychange', handleNavigationChange);
      }
      window.addEventListener('popstate', handleNavigationChange);

      // Nasłuchiwanie zmian w konfiguracji i magazynie danych (aktualizacja pamięci podręcznej)
      storage.onChange((payload) => {
        const { folders: updatedFolders, activeFolder: updatedActive, threads: updatedThreads } = payload;
        currentFolders = updatedFolders;
        currentActiveFolder = updatedActive;
        currentThreads = updatedThreads;
        const scanned = detector.scanChatList();
        currentUnreadCounts = calculateUnreadCounts(scanned, currentThreads, currentFolders);
        renderAndInjectBar();
        if (typeof ui.updateFolderCounts === 'function') {
          ui.updateFolderCounts(currentThreads, currentUnreadCounts);
        }
        ui.filterChatRows(updatedActive, updatedThreads);
      });

      console.log('Messenger Folders: Gotowy do działania.');
    } catch (error) {
      console.error('Błąd podczas uruchamiania Messenger Folders:', error);
    }
  }

  // Uruchomienie po załadowaniu drzewa DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
