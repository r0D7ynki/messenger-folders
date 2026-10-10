/**
 * Messenger Folders - Skrypt zawartości (Content Script)
 *
 * Główny punkt wejścia wstrzykiwany na strony messenger.com i facebook.com.
 * Integruje moduły pamięci (Storage), detektora DOM (Detector) i interfejsu (UI).
 *
 * Zgodny ze standardem Manifest V3 oraz normą PN-ISO 24495-1.
 */

(async function () {
  'use strict';

  console.log('Messenger Folders: Inicjalizacja skryptu zawartości...');

  // Inicjalizacja instancji modułów
  const storage = new MessengerFoldersStorage();
  const detector = new MessengerDOMDetector();
  const ui = new MessengerFoldersUI({ storage, detector });

  /**
   * Główna funkcja uruchamiająca wtyczkę na stronie.
   */
  async function start() {
    try {
      await storage.init();

      let currentFolders = storage.getFoldersSync();
      let currentActiveFolder = storage.getActiveFolderSync();
      let currentThreads = storage.getAllThreadsSync();
      let lastUrl = window.location.href;

      /**
       * Renderuje pasek folderów na podstawie stanu pamięci podręcznej i wstrzykuje go w DOM.
       * @returns {boolean} Czy pasek został poprawnie wstrzyknięty lub jest już w DOM.
       */
      const renderAndInjectBar = () => {
        const bar = ui.renderFolderBar(
          currentFolders,
          currentActiveFolder,
          currentThreads,
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

      // Podpięcie obserwatora dynamicznego ładowania listy czatów (virtual scrolling)
      // Wykorzystuje pamięć podręczną — nie odpytuje storage przy mutacjach DOM
      detector.setupObserver(
        () => {
          // Wstrzyknij pasek tylko wtedy, gdy nie istnieje w DOM (np. po przebudowie kontenera przez aplikację)
          const barExists = document.getElementById('mf-folder-bar')?.isConnected;
          if (!barExists) {
            renderAndInjectBar();
          }

          // Sprawdzenie zmiany adresu URL przy przełączaniu wątków podczas mutacji DOM
          if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
          }

          ui.filterChatRows(currentActiveFolder, currentThreads);
        },
        { throttleMs: 250 }
      );

      // Obsługa nawigacji w aplikacji Single Page App (SPA) bez ciągłego odpytywania w pętli setInterval
      const handleNavigationChange = () => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          ui.filterChatRows(currentActiveFolder, currentThreads);
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
        renderAndInjectBar();
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
