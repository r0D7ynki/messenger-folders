/**
 * Messenger Folders - Główny moduł fasady interfejsu użytkownika (MessengerUI)
 * Zgodność ze standardem PN-ISO 24495-1 (Prosta Polszczyzna).
 * Fasada integruje wyspecjalizowane komponenty z katalogu src/ui/:
 * - MessengerUICore (src/ui/core.js)
 * - FolderBarComponent (src/ui/folder-bar.js)
 * - FolderModalComponent (src/ui/folder-modal.js)
 * - ThreadMenuComponent (src/ui/thread-menu.js)
 * - SettingsModalComponent (src/ui/settings-modal.js)
 */

(function (global) {
  'use strict';

  // Rozwiązanie zależności modułów dla środowiska przeglądarki (globalThis) oraz testów Node (require)
  const _req =
    typeof globalThis !== 'undefined' && globalThis.require
      ? globalThis.require
      : typeof require === 'function'
        ? require
        : null;

  const Core =
    (typeof globalThis !== 'undefined' && globalThis.MessengerUICore) ||
    (typeof global !== 'undefined' && global.MessengerUICore) ||
    (_req ? _req('./ui/core.js') : null);

  const FolderBarComponent =
    (typeof globalThis !== 'undefined' && (globalThis.FolderBarComponent || globalThis.MessengerUIFolderBar)) ||
    (typeof global !== 'undefined' && (global.FolderBarComponent || global.MessengerUIFolderBar)) ||
    (_req ? _req('./ui/folder-bar.js') : null);

  const FolderModalComponent =
    (typeof globalThis !== 'undefined' && (globalThis.FolderModalComponent || globalThis.MessengerUIFolderModal)) ||
    (typeof global !== 'undefined' && (global.FolderModalComponent || global.MessengerUIFolderModal)) ||
    (_req ? _req('./ui/folder-modal.js') : null);

  const ThreadMenuComponent =
    (typeof globalThis !== 'undefined' && (globalThis.ThreadMenuComponent || globalThis.MessengerUIThreadMenu)) ||
    (typeof global !== 'undefined' && (global.ThreadMenuComponent || global.MessengerUIThreadMenu)) ||
    (_req ? _req('./ui/thread-menu.js') : null);

  const SettingsModalComponent =
    (typeof globalThis !== 'undefined' && (globalThis.SettingsModalComponent || globalThis.MessengerUISettingsModal)) ||
    (typeof global !== 'undefined' && (global.SettingsModalComponent || global.MessengerUISettingsModal)) ||
    (_req ? _req('./ui/settings-modal.js') : null);

  class MessengerUI {
    /**
     * Tworzy instancję fasady MessengerUI.
     * @param {Object} [options]
     * @param {Object} [options.storage] Opcjonalna instancja MessengerFoldersStorage
     * @param {Object} [options.detector] Opcjonalna instancja MessengerDOMDetector
     * @param {Object} [options.rulesEngine] Opcjonalna instancja silnika reguł (M4)
     */
    constructor(options = {}) {
      this.storage = options.storage || null;
      this.detector = options.detector || null;
      this.rulesEngine = options.rulesEngine || null;
      this.activeDropdown = null;
      this.activeModal = null;
      this.toastTimeout = null;

      // Inicjalizacja komponentów potomnych z referencją do fasady
      this.core = Core;
      this.folderBar = FolderBarComponent ? new FolderBarComponent(this) : null;
      this.folderModal = FolderModalComponent ? new FolderModalComponent(this) : null;
      this.threadMenu = ThreadMenuComponent ? new ThreadMenuComponent(this) : null;
      this.settingsModal = SettingsModalComponent ? new SettingsModalComponent(this) : null;

      // Obsługa globalnych zdarzeń zamykania (Escape i kliknięcie poza elementem)
      this._bindGlobalEvents();
    }

    /**
     * Podpina nasłuchiwanie zdarzeń zamykających okna dialogowe i menu.
     * @private
     */
    _bindGlobalEvents() {
      if (typeof document === 'undefined') return;

      // Obsługa klawisza Escape
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          if (this.activeDropdown) {
            this.closeDropdown();
          } else if (this.activeModal) {
            this.closeModal();
          }
        }
      });

      // Obsługa kliknięcia poza elementem (Click Outside)
      document.addEventListener('click', (event) => {
        if (this.activeDropdown) {
          const isInside =
            this.activeDropdown.contains(event.target) ||
            (event.target.closest && event.target.closest('.mf-folder-btn')) ||
            (event.target.closest && event.target.closest('.mf-thread-badge')) ||
            (event.target.closest && event.target.closest('.mf-header-pill'));
          if (!isInside) {
            this.closeDropdown();
          }
        }
      });

      // Zamykanie menu przy zmianie rozmiaru okna
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', () => {
          if (this.activeDropdown) {
            this.closeDropdown();
          }
        });
      }
    }

    /**
     * Bezpieczne generowanie identyfikatora folderu.
     * @returns {string}
     */
    generateId() {
      return Core ? Core.generateId() : 'f_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    }

    /* ==========================================================================
       1. PASEK FOLDERÓW (renderFolderBar)
       ========================================================================== */

    /**
     * Renderuje poziomy pasek folderów z przewijaniem i licznikami.
     *
     * @param {Array<Object>} folders - Lista folderów użytkownika
     * @param {string} activeFolderId - ID aktywnego folderu ('all' dla wszystkich)
     * @param {Object} counts - Mapa liczników lub obiekt z wątkami: { [folderId]: number }
     * @param {Object|Function} [unreadCounts] - Mapa liczników nieprzeczytanych wiadomości lub callback onSelectFolder
     * @param {Function} [onSelectFolder] - Callback po wyborze folderu (folderId)
     * @param {Function} [onAddFolder] - Callback po kliknięciu dodawania folderu
     * @param {Function} [onEditFolder] - Callback po kliknięciu edycji folderu (folder)
     * @param {Function} [onOpenSettings] - Callback po kliknięciu ustawień folderów
     * @returns {HTMLElement} Główny element paska #mf-folder-bar
     */
    renderFolderBar(
      folders = [],
      activeFolderId = 'all',
      counts = {},
      unreadCounts = {},
      onSelectFolder,
      onAddFolder,
      onEditFolder,
      onOpenSettings
    ) {
      if (this.folderBar) {
        return this.folderBar.render(
          folders,
          activeFolderId,
          counts,
          unreadCounts,
          onSelectFolder,
          onAddFolder,
          onEditFolder,
          onOpenSettings
        );
      }
      return null;
    }

    /**
     * Aktualizuje liczniki wątków oraz odznaki nieprzeczytanych wiadomości na pasku folderów.
     * @param {Object} counts - Mapa liczników wszystkich wątków
     * @param {Object} unreadCounts - Mapa liczników nieprzeczytanych wiadomości
     * @returns {HTMLElement|null}
     */
    updateFolderCounts(counts = {}, unreadCounts = {}) {
      if (this.folderBar && typeof this.folderBar.updateFolderCounts === 'function') {
        return this.folderBar.updateFolderCounts(counts, unreadCounts);
      }
      return null;
    }

    /* ==========================================================================
       2. PLAKIETKA I PRZYCISK NA WIERSZU ROZMOWY (injectFolderBadge)
       ========================================================================== */

    /**
     * Obsługa wiersza rozmowy na liście czatów.
     * Usuwa plakietki i nazwy folderów z wiersza, rejestruje menu prawego przycisku.
     *
     * @param {HTMLElement} rowElement - Wiersz rozmowy na liście
     * @param {string} threadId - Identyfikator wątku
     * @param {Object|null} currentFolder - Aktualnie przypisany folder lub null
     * @param {Function} onAssign - Callback po kliknięciu przypisania: (targetEl, threadId)
     */
    injectFolderBadge(rowElement, threadId, currentFolder, onAssign) {
      if (this.threadMenu) {
        this.threadMenu.injectFolderBadge(rowElement, threadId, currentFolder, onAssign);
      }
    }

    /* ==========================================================================
       3. PIGUŁKA W NAGŁÓWKU OTWARTEGO CZATU (renderHeaderPill)
       ========================================================================== */

    /**
     * Renderuje pigułkę informacyjną z folderem w nagłówku aktualnie otwartego czatu.
     *
     * @param {HTMLElement} headerElement - Kontener nagłówka czatu
     * @param {Object|null} currentFolder - Aktualnie przypisany folder lub null
     * @param {Function} onAssign - Callback kliknięcia przypisania
     * @returns {HTMLElement} Element pigułki
     */
    renderHeaderPill(headerElement, currentFolder, onAssign) {
      if (this.threadMenu) {
        return this.threadMenu.renderHeaderPill(headerElement, currentFolder, onAssign);
      }
      return null;
    }

    /* ==========================================================================
       4. OKNO MODALNE TWORZENIA / EDYCJI FOLDERU (showFolderModal)
       ========================================================================== */

    /**
     * Otwiera okno dialogowe tworzenia lub edycji folderu.
     *
     * @param {Object} options
     * @param {Object|null} options.folder - Obiekt folderu do edycji lub null dla nowego
     * @param {Function} options.onSave - Callback zapisu: ({ id, name, icon, color }) => void
     * @param {Function} [options.onDelete] - Callback usunięcia: (folderId) => void
     * @param {Function} [options.onBack] - Callback powrotu do poprzedniego widoku
     */
    showFolderModal(options = {}) {
      if (this.folderModal) {
        this.folderModal.show(options);
      }
    }

    /**
     * Zamyka aktywne okno modalne.
     */
    closeModal() {
      if (this.activeModal) {
        this.activeModal.remove();
        this.activeModal = null;
      }
    }

    /* ==========================================================================
       5. OKNO MODALNE USTAWIEŃ (showSettingsModal)
       ========================================================================== */

    /**
     * Otwiera okno dialogowe ustawień i zarządzania folderami bezpośrednio na stronie.
     * @param {Object} [options]
     */
    showSettingsModal(options = {}) {
      if (this.settingsModal) {
        this.settingsModal.show(options);
      }
    }

    /* ==========================================================================
       6. MENU ROZWIJANE WYBORU FOLDERU (showAssignDropdown)
       ========================================================================== */

    /**
     * Wyświetla menu przypisania rozmowy do folderu przy zadanym elemencie.
     *
     * @param {HTMLElement} targetElement - Element, przy którym wyświetlić menu
     * @param {string} threadId - Identyfikator wątku rozmowy
     * @param {Array<Object>} folders - Dostępne foldery
     * @param {string|null} currentFolderId - Aktualnie przypisany folder
     * @param {Function} onAssign - Callback: (threadId, newFolderId) => void
     * @param {Function} [onNewFolder] - Opcjonalny callback utworzenia nowego folderu
     */
    showAssignDropdown(targetElement, threadId, folders = [], currentFolderId = null, onAssign, onNewFolder) {
      if (this.threadMenu) {
        this.threadMenu.showAssignDropdown(targetElement, threadId, folders, currentFolderId, onAssign, onNewFolder);
      }
    }

    /**
     * Precyzyjne pozycjonowanie menu rozwijanego w obrębie okna przeglądarki.
     * @param {HTMLElement} dropdown
     * @param {HTMLElement} targetElement
     * @private
     */
    _positionDropdown(dropdown, targetElement) {
      if (this.threadMenu) {
        this.threadMenu.positionDropdown(dropdown, targetElement);
      }
    }

    /**
     * Zamyka aktywne menu rozwijane.
     */
    closeDropdown() {
      if (this.activeDropdown) {
        this.activeDropdown.remove();
        this.activeDropdown = null;
      }
    }

    /* ==========================================================================
       7. FILTROWANIE WIERSZY ROZMÓW (filterChatRows)
       ========================================================================== */

    /**
     * Filtruje wiersze czatów w widoku według aktywnego folderu i wstrzykuje plakietki.
     * Wykorzystywane przez skrypt content.js.
     *
     * @param {string} activeFolderId - ID aktywnego folderu
     * @param {Object} allThreads - Mapa przypisanych wątków: { [threadId]: threadData }
     */
    filterChatRows(activeFolderId = 'all', allThreads = {}) {
      if (!this.detector) return;

      const isNativeSearchActive = Boolean(
        this.detector.isMessengerSearchActive && this.detector.isMessengerSearchActive()
      );

      const detected = this.detector.scanChatList();
      const folders = this.storage ? this.storage.getFoldersSync() : [];

      detected.forEach((item) => {
        const { threadId, rowElement } = item;
        const threadData = allThreads[threadId];
        const folderId = threadData && threadData.folderId ? threadData.folderId : 'uncategorized';
        const currentFolder = folders.find((f) => f.id === folderId);

        // Wstrzyknięcie lub aktualizacja plakietki w wierszu
        this.injectFolderBadge(rowElement, threadId, currentFolder, (targetEl, thId) => {
          this.showAssignDropdown(targetEl, thId, folders, folderId, async (tId, newFolderId) => {
            if (this.storage) {
              if (newFolderId) {
                await this.storage.assignThread(tId, newFolderId, {
                  name: item.name,
                  avatar: item.avatar
                });
              } else {
                await this.storage.removeThreadAssignment(tId);
              }
              const currentActive = await this.storage.getActiveFolder();
              const currentThreads = await this.storage.getAllThreads();
              this.filterChatRows(currentActive, currentThreads);
              const currentFolders = await this.storage.getFolders();
              this.renderFolderBar(currentFolders, currentActive, currentThreads);
            }
          });
        });

        // Widoczność wiersza według aktywnego filtra (oraz gdy trwa natywne wyszukiwanie w Messengerze)
        const shouldBeVisible = isNativeSearchActive || activeFolderId === 'all' || folderId === activeFolderId;
        if (rowElement.classList) {
          rowElement.classList.toggle('mf-thread-hidden', !shouldBeVisible);
        }
        if (!shouldBeVisible) {
          if (rowElement.setAttribute) rowElement.setAttribute('data-mf-thread-hidden', 'true');
          if (rowElement.style?.setProperty) {
            rowElement.style.setProperty('display', 'none', 'important');
          } else if (rowElement.style) {
            rowElement.style.display = 'none';
          }
        } else {
          if (rowElement.removeAttribute) rowElement.removeAttribute('data-mf-thread-hidden');
          if (rowElement.style?.removeProperty) {
            rowElement.style.removeProperty('display');
          } else if (rowElement.style) {
            rowElement.style.display = '';
          }
        }
      });

      // Całkowity brak ingerencji w [role="main"] (obszar widoku wiadomości)!
      const doc = this.detector.doc || (typeof document !== 'undefined' ? document : null);
      if (doc) {
        const oldPill = doc.querySelector('.mf-header-pill');
        if (oldPill) {
          try {
            oldPill.remove();
          } catch (_) {
            // Bezpieczne wygaszenie błędów DOM
          }
        }
      }
    }

    /* ==========================================================================
       8. POWIADOMIENIA TOAST I NARZĘDZIA POMOCNICZE
       ========================================================================== */

    /**
     * Wyświetla dyskretny dymek powiadomienia u dołu ekranu.
     * @param {string} message - Tekst powiadomienia
     * @param {number} duration - Czas wyświetlania w milisekundach
     */
    showToast(message, duration = 2600) {
      if (Core) {
        Core.showToast(message, duration);
      }
    }

    /**
     * Zabezpieczenie przed atakami XSS przy wstrzykiwaniu tekstu.
     * @private
     */
    _escapeHtml(str) {
      return Core ? Core.escapeHtml(str) : String(str || '');
    }

    /**
     * Bezpiecznie tworzy element SVG dla wskazanej ikony z ICONS.
     * @private
     * @param {string} iconName
     * @returns {Element}
     */
    _createIcon(iconName) {
      return Core ? Core.createIcon(iconName) : document.createElement('span');
    }

    /**
     * Bezpiecznie wstawia ikonę SVG do elementu bez użycia innerHTML ze zmienną.
     * @private
     * @param {Element} el
     * @param {string} iconName
     */
    _setIcon(el, iconName) {
      if (Core) {
        Core.setIcon(el, iconName);
      } else if (el) {
        el.innerHTML = '';
        el.appendChild(this._createIcon(iconName));
      }
    }

    /**
     * Ustawia treść przycisku składającą się z opcjonalnej ikony i etykiety tekstowej.
     * @private
     * @param {Element} btn
     * @param {string} [iconName]
     * @param {string} [labelText]
     */
    _setButtonContent(btn, iconName, labelText) {
      if (Core) {
        Core.setButtonContent(btn, iconName, labelText);
      } else if (btn) {
        btn.innerHTML = '';
        if (iconName) btn.appendChild(this._createIcon(iconName));
        if (labelText) {
          const span = document.createElement('span');
          span.textContent = labelText;
          btn.appendChild(span);
        }
      }
    }
  }

  // Eksport globalny i modułowy (z aliasem MessengerFoldersUI dla zachowania 100% kompatybilności)
  if (typeof globalThis !== 'undefined') {
    globalThis.MessengerUI = MessengerUI;
    globalThis.MessengerFoldersUI = MessengerUI;
  }
  if (typeof global !== 'undefined') {
    global.MessengerUI = MessengerUI;
    global.MessengerFoldersUI = MessengerUI;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessengerUI;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
