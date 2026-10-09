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

  let isInitialized = false;

  /**
   * Główna funkcja uruchamiająca wtyczkę na stronie.
   */
  async function start() {
    try {
      await storage.init();

      const folders = await storage.getFolders();
      const activeFolder = await storage.getActiveFolder();
      const allThreads = await storage.getAllThreads();

      // Próba wstrzyknięcia paska folderów
      const tryInjectBar = () => {
        const existingBar = document.getElementById('mf-folder-bar');
        if (existingBar && document.body.contains(existingBar)) {
          return true; // Pasek już istnieje stabilnie w DOM
        }

        const bar = ui.renderFolderBar(folders, activeFolder, allThreads);
        const injected = detector.injectFolderBar(bar);
        if (injected) {
          console.log('Messenger Folders: Pasek folderów został wstrzyknięty.');
          ui.filterChatRows(activeFolder, allThreads);
        }
        return injected;
      };

      if (!tryInjectBar()) {
        // Ponawianie próby, dopóki strona nie załaduje struktury DOM
        const retryTimer = setInterval(() => {
          if (tryInjectBar()) {
            clearInterval(retryTimer);
          }
        }, 500);

        setTimeout(() => clearInterval(retryTimer), 15000);
      }

      // Podpięcie obserwatora dynamicznego ładowania listy czatów (virtual scrolling)
      detector.setupObserver(async () => {
        tryInjectBar();
        const currentActive = await storage.getActiveFolder();
        const currentThreads = await storage.getAllThreads();
        ui.filterChatRows(currentActive, currentThreads);
      }, { throttleMs: 250 });

      // Nasłuchiwanie zmian adresu URL (przełączanie czatów w aplikacji Single Page App)
      let lastUrl = window.location.href;
      setInterval(async () => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          const currentActive = await storage.getActiveFolder();
          const currentThreads = await storage.getAllThreads();
          ui.filterChatRows(currentActive, currentThreads);
        }
      }, 500);

      // Nasłuchiwanie zmian w konfiguracji i magazynie danych
      storage.onChange((payload) => {
        const { folders: updatedFolders, activeFolder: updatedActive, threads: updatedThreads } = payload;
        ui.renderFolderBar(updatedFolders, updatedActive, updatedThreads);
        ui.filterChatRows(updatedActive, updatedThreads);
      });

      isInitialized = true;
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
