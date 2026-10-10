/**
 * Messenger Folders - Moduł interfejsu użytkownika (MessengerUI)
 * Zgodność ze standardem PN-ISO 24495-1 (Prosta Polszczyzna)
 * Tworzenie i obsługa komponentów wizualnych: pasków, plakietek, menu i okien dialogowych.
 */

(function (global) {
  'use strict';

  // Ikony wektorowe SVG używane w interfejsie
  const ICONS = {
    folder: `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
    plus: `<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`,
    search: `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
    check: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
    chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>`,
    unassign: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>`,
    palette: `<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.22 19.49 10.57 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-5 9c-.83 0-1.5-.67-1.5-1.5S6.17 9 7 9s1.5.67 1.5 1.5S7.83 12 7 12zm3-4c-.83 0-1.5-.67-1.5-1.5S9.17 5 10 5s1.5.67 1.5 1.5S10.83 8 10 8zm4 0c-.83 0-1.5-.67-1.5-1.5S13.17 5 14 5s1.5.67 1.5 1.5S14.83 8 14 8zm3 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
    users: `<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
    arrowBack: `<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`
  };

  // Domyślny zestaw emotikonów do wyboru
  const DEFAULT_EMOJIS = [
    '📁',
    '💼',
    '👥',
    '⭐',
    '💡',
    '🏷️',
    '🛒',
    '📌',
    '🎯',
    '🔒',
    '💬',
    '🚀',
    '❤️',
    '🔔',
    '🎮',
    '🏠',
    '📚',
    '🎨',
    '🛠️',
    '✈️',
    '🎵',
    '🔥',
    '💻',
    '🤝'
  ];

  // Domyślna paleta kolorów
  const DEFAULT_COLORS = [
    '#0084FF', // Messenger Blue
    '#00C6FF', // Jasny błękit
    '#00C853', // Szmaragdowy
    '#FFAB00', // Bursztynowy
    '#FF3B30', // Karminowy
    '#AF52DE', // Fioletowy
    '#5856D6', // Indygo
    '#FF2D55', // Malinowy
    '#FF9500', // Pomarańczowy
    '#64748B' // Grafitowy
  ];

  class MessengerUI {
    /**
     * Tworzy instancję interfejsu MessengerUI.
     * @param {Object} [options]
     * @param {Object} [options.storage] Opcjonalna instancja MessengerFoldersStorage
     * @param {Object} [options.detector] Opcjonalna instancja MessengerDOMDetector
     */
    constructor(options = {}) {
      this.storage = options.storage || null;
      this.detector = options.detector || null;
      this.activeDropdown = null;
      this.activeModal = null;
      this.toastTimeout = null;

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
            event.target.closest('.mf-folder-btn') ||
            event.target.closest('.mf-thread-badge') ||
            event.target.closest('.mf-header-pill');
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
     * Bezpieczne generowanie identyfikatora
     * @returns {string}
     */
    generateId() {
      return 'f_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
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
      onSelectFolder,
      onAddFolder,
      onEditFolder,
      onOpenSettings
    ) {
      if (typeof document === 'undefined') return null;

      // Obsługa domyślnych callbacków przy integracji ze storage
      const selectHandler =
        onSelectFolder ||
        (async (folderId) => {
          if (this.storage) {
            await this.storage.setActiveFolder(folderId);
          }
        });

      const addHandler =
        onAddFolder ||
        (() => {
          this.showFolderModal({
            onSave: async (newFolder) => {
              if (this.storage) {
                await this.storage.saveFolder(newFolder);
              }
            }
          });
        });

      const editHandler =
        onEditFolder ||
        ((folder) => {
          this.showFolderModal({
            folder,
            onSave: async (updated) => {
              if (this.storage) {
                await this.storage.saveFolder(updated);
              }
            },
            onDelete: async (folderId) => {
              if (this.storage) {
                await this.storage.deleteFolder(folderId);
              }
            }
          });
        });

      const settingsHandler =
        onOpenSettings ||
        (() => {
          this.showSettingsModal();
        });

      // Jeśli w parametrze `counts` przekazano obiekt mapy wątków z folderId (np. allThreads)
      let resolvedCounts = {};
      if (counts && typeof counts === 'object') {
        const firstVal = Object.values(counts)[0];
        if (firstVal && typeof firstVal === 'object' && 'folderId' in firstVal) {
          // Oblicz liczbę wątków dla każdego folderu
          for (const thread of Object.values(counts)) {
            const fId = thread.folderId || 'uncategorized';
            resolvedCounts[fId] = (resolvedCounts[fId] || 0) + 1;
          }
        } else {
          resolvedCounts = counts;
        }
      }

      // Sprawdzenie obecności folderu 'all'
      const hasAll = folders.some((f) => f.id === 'all');
      const folderList = hasAll
        ? [...folders]
        : [{ id: 'all', name: 'Wszystkie', icon: '💬', color: '#0084FF', isSystem: true }, ...folders];

      let bar = document.getElementById('mf-folder-bar');
      if (bar) {
        // Jeśli pasek już istnieje w DOM, sprawdzamy czy struktura folderów i rzędów jest zachowana
        const topBar = bar.querySelector('.mf-folder-top-bar');
        const pillsRow = bar.querySelector('.mf-folder-pills-row');
        const existingPills = bar.querySelectorAll('.mf-folder-pill');
        const existingIds = Array.from(existingPills).map((p) => p.dataset.folderId);
        const newIds = folderList.map((f) => f.id);
        const isSameStructure =
          Boolean(topBar && pillsRow) &&
          existingIds.length > 0 &&
          existingIds.length === newIds.length &&
          existingIds.every((id, idx) => id === newIds[idx]);

        if (isSameStructure) {
          // Zaktualizuj ikony i pozycję przycisków przewijania
          const btnL = pillsRow.querySelector('.mf-scroll-btn-left');
          if (btnL) {
            btnL.innerHTML = ICONS.chevronLeft;
            btnL.style.top = '3px';
            btnL.style.transform = 'none';
            btnL.style.left = '-8px';
          }
          const btnR = pillsRow.querySelector('.mf-scroll-btn-right');
          if (btnR) {
            btnR.innerHTML = ICONS.chevronRight;
            btnR.style.top = '3px';
            btnR.style.transform = 'none';
            btnR.style.right = '-8px';
          }

          // Zaktualizuj stan, nazwy, ikony, kolory i liczniki w istniejących elementach
          existingPills.forEach((pill) => {
            const fId = pill.dataset.folderId;
            const folderObj = folderList.find((f) => f.id === fId);
            const isActive = fId === activeFolderId;
            pill.classList.toggle('mf-active', isActive);
            pill.setAttribute('aria-selected', isActive ? 'true' : 'false');

            if (folderObj) {
              const iconEl = pill.querySelector('.mf-folder-icon');
              if (iconEl && iconEl.textContent !== (folderObj.icon || '📁')) {
                iconEl.textContent = folderObj.icon || '📁';
              }
              const nameEl = pill.querySelector('.mf-folder-name');
              if (nameEl && nameEl.textContent !== folderObj.name) {
                nameEl.textContent = folderObj.name;
              }
              if (folderObj.color) {
                pill.style.setProperty('--mf-folder-color', folderObj.color);
              }
              const countVal = resolvedCounts[fId] || 0;
              pill.title = `${folderObj.name} (${countVal} rozmów)`;
            }

            const count = resolvedCounts[fId] || 0;
            let countEl = pill.querySelector('.mf-folder-count');
            if (count > 0 || isActive) {
              if (!countEl) {
                countEl = document.createElement('span');
                countEl.className = 'mf-folder-count';
                pill.appendChild(countEl);
              }
              const countText = count > 99 ? '99+' : String(count);
              if (countEl.textContent !== countText) {
                countEl.textContent = countText;
              }
            } else if (countEl) {
              countEl.remove();
            }
          });

          // Zsynchronizuj widoczność pigułek z wpisaną frazą wyszukiwania
          const activeSearch = bar.querySelector('.mf-folder-search-input');
          if (activeSearch && activeSearch.value) {
            const query = activeSearch.value.trim().toLowerCase();
            existingPills.forEach((pill) => {
              const nameEl = pill.querySelector('.mf-folder-name');
              const iconEl = pill.querySelector('.mf-folder-icon');
              const name = nameEl ? (nameEl.textContent || '').trim().toLowerCase() : '';
              const icon = iconEl ? (iconEl.textContent || '').trim() : '';
              const match = !query || name.includes(query) || icon.includes(query);
              pill.classList.toggle('mf-pill-hidden', !match);
              if (!match) {
                pill.style.setProperty('display', 'none', 'important');
              } else {
                pill.style.removeProperty('display');
              }
            });
          }

          return bar; // Gotowe, zero resetu DOM!
        }
      } else {
        bar = document.createElement('div');
        bar.id = 'mf-folder-bar';
      }
      bar.setAttribute('data-mf-folder-bar', 'true');

      bar.innerHTML = '';

      // 1. Górny rząd: wyszukiwarka folderów i przycisk ustawień
      const topBar = document.createElement('div');
      topBar.className = 'mf-folder-top-bar';

      const searchBox = document.createElement('div');
      searchBox.className = 'mf-folder-search-box';

      const searchIcon = document.createElement('span');
      searchIcon.className = 'mf-folder-search-icon';
      searchIcon.innerHTML = ICONS.search;
      searchBox.appendChild(searchIcon);

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'mf-folder-search-input';
      searchInput.placeholder = 'Szukaj folderu...';
      searchInput.setAttribute('aria-label', 'Szukaj folderu');
      searchInput.autocomplete = 'off';
      searchInput.spellcheck = false;
      searchBox.appendChild(searchInput);

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'mf-folder-search-clear';
      clearBtn.title = 'Wyczyść szukanie';
      clearBtn.setAttribute('aria-label', 'Wyczyść szukanie');
      clearBtn.innerHTML = ICONS.close;
      searchBox.appendChild(clearBtn);

      topBar.appendChild(searchBox);

      // Przycisk ustawień przypięty obok wyszukiwarki folderów
      if (settingsHandler) {
        const settingsBtn = document.createElement('button');
        settingsBtn.type = 'button';
        settingsBtn.className = 'mf-folder-settings-btn';
        settingsBtn.title = 'Ustawienia folderów i kopia zapasowa';
        settingsBtn.setAttribute('aria-label', 'Ustawienia folderów');
        settingsBtn.innerHTML = ICONS.settings;
        settingsBtn.addEventListener('click', () => settingsHandler());
        topBar.appendChild(settingsBtn);
      }

      // 2. Dolny rząd: pigułki folderów i przewijanie
      const pillsRow = document.createElement('div');
      pillsRow.className = 'mf-folder-pills-row';

      // Przycisk przewijania w lewo
      const btnLeft = document.createElement('button');
      btnLeft.type = 'button';
      btnLeft.className = 'mf-scroll-btn mf-scroll-btn-left';
      btnLeft.setAttribute('aria-label', 'Przewiń foldery w lewo');
      btnLeft.innerHTML = ICONS.chevronLeft;
      btnLeft.style.top = '3px';
      btnLeft.style.transform = 'none';
      btnLeft.style.left = '-8px';

      // Kontener przewijalny z pigułkami
      const container = document.createElement('div');
      container.className = 'mf-folder-scroll-container';
      container.setAttribute('data-mf-scroll-container', 'true');

      // Przycisk przewijania w prawo
      const btnRight = document.createElement('button');
      btnRight.type = 'button';
      btnRight.className = 'mf-scroll-btn mf-scroll-btn-right';
      btnRight.setAttribute('aria-label', 'Przewiń foldery w prawo');
      btnRight.innerHTML = ICONS.chevronRight;
      btnRight.style.top = '3px';
      btnRight.style.transform = 'none';
      btnRight.style.right = '-8px';

      // Funkcja sprawdzająca konieczność pokazania strzałek przewijania
      const updateScrollButtons = () => {
        if (!container.clientWidth) return;
        const maxScroll = container.scrollWidth - container.clientWidth;
        btnLeft.classList.toggle('mf-visible', container.scrollLeft > 6);
        btnRight.classList.toggle('mf-visible', maxScroll > 6 && container.scrollLeft < maxScroll - 6);
      };

      // Dynamiczne filtrowanie pigułek w czasie rzeczywistym
      const applyFolderFilter = () => {
        const query = (searchInput.value || '').trim().toLowerCase();
        clearBtn.style.display = query ? 'flex' : 'none';
        const allPills = container.querySelectorAll('.mf-folder-pill');
        allPills.forEach((pill) => {
          const nameEl = pill.querySelector('.mf-folder-name');
          const iconEl = pill.querySelector('.mf-folder-icon');
          const name = nameEl ? (nameEl.textContent || '').trim().toLowerCase() : '';
          const icon = iconEl ? (iconEl.textContent || '').trim() : '';
          const match = !query || name.includes(query) || icon.includes(query);
          pill.classList.toggle('mf-pill-hidden', !match);
          if (!match) {
            pill.style.setProperty('display', 'none', 'important');
          } else {
            pill.style.removeProperty('display');
          }
        });
        updateScrollButtons();
      };

      searchInput.addEventListener('input', applyFolderFilter);
      searchInput.addEventListener('keyup', applyFolderFilter);
      searchInput.addEventListener('change', applyFolderFilter);
      searchInput.addEventListener('search', applyFolderFilter);

      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        applyFolderFilter();
        if (typeof searchInput.focus === 'function') {
          searchInput.focus();
        }
      });

      searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && searchInput.value) {
          event.stopPropagation();
          searchInput.value = '';
          applyFolderFilter();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          const firstVisiblePill = Array.from(container.querySelectorAll('.mf-folder-pill')).find(
            (p) => !p.classList.contains('mf-pill-hidden') && p.style.display !== 'none'
          );
          if (firstVisiblePill) {
            if (typeof firstVisiblePill.click === 'function') {
              firstVisiblePill.click();
            } else if (typeof firstVisiblePill.dispatchEvent === 'function') {
              firstVisiblePill.dispatchEvent({ type: 'click' });
            }
          }
        }
      });

      // Tworzenie pigułek folderów
      folderList.forEach((folder) => {
        const isActive = folder.id === activeFolderId;
        const count = resolvedCounts[folder.id] || 0;

        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `mf-folder-pill ${isActive ? 'mf-active' : ''}`;
        pill.dataset.folderId = folder.id;
        pill.setAttribute('data-mf-pill', 'true');
        pill.setAttribute('role', 'tab');
        pill.setAttribute('aria-selected', isActive ? 'true' : 'false');
        pill.title = `${folder.name} (${count} rozmów)`;

        // Stała szerokość pigułki w pasku
        pill.style.width = '110px';
        pill.style.minWidth = '110px';
        pill.style.maxWidth = '110px';

        // Kolor akcentu pigułki
        if (folder.color) {
          pill.style.setProperty('--mf-folder-color', folder.color);
        }

        // Ikona lub emoji
        const iconEl = document.createElement('span');
        iconEl.className = 'mf-folder-icon';
        iconEl.textContent = folder.icon || '📁';
        pill.appendChild(iconEl);

        // Nazwa folderu
        const nameEl = document.createElement('span');
        nameEl.className = 'mf-folder-name';
        nameEl.textContent = folder.name;
        pill.appendChild(nameEl);

        // Licznik czatów
        if (count > 0 || isActive) {
          const countEl = document.createElement('span');
          countEl.className = 'mf-folder-count';
          countEl.textContent = count > 99 ? '99+' : count;
          pill.appendChild(countEl);
        }

        // Wybór folderu z natychmiastową reakcją wizualną i filtrowaniem
        pill.addEventListener('click', () => {
          container.querySelectorAll('.mf-folder-pill').forEach((p) => {
            const isMatch = p === pill;
            p.classList.toggle('mf-active', isMatch);
            p.setAttribute('aria-selected', isMatch ? 'true' : 'false');
          });

          if (this.storage) {
            const currentThreads = this.storage._threads || {};
            this.filterChatRows(folder.id, currentThreads);
          }

          if (selectHandler) {
            selectHandler(folder.id);
          }
        });

        container.appendChild(pill);
      });

      if (searchInput.value) {
        applyFolderFilter();
      }

      // Przycisk dodawania nowego folderu na końcu listy pigułek
      if (addHandler) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'mf-folder-add-btn';
        addBtn.title = 'Dodaj nowy folder';
        addBtn.setAttribute('aria-label', 'Dodaj nowy folder');
        addBtn.innerHTML = ICONS.plus;
        addBtn.addEventListener('click', () => addHandler());
        container.appendChild(addBtn);
      }

      // Obsługa kliknięć w przyciski przewijania
      btnLeft.addEventListener('click', () => {
        container.scrollBy({ left: -180, behavior: 'smooth' });
      });

      btnRight.addEventListener('click', () => {
        container.scrollBy({ left: 180, behavior: 'smooth' });
      });

      // Płynne przewijanie kółkiem myszy w poziomie
      container.addEventListener(
        'wheel',
        (event) => {
          if (event.deltaY !== 0) {
            event.preventDefault();
            container.scrollLeft += event.deltaY * 0.8;
            updateScrollButtons();
          }
        },
        { passive: false }
      );

      container.addEventListener('scroll', updateScrollButtons, { passive: true });

      // Składanie struktury
      pillsRow.appendChild(btnLeft);
      pillsRow.appendChild(container);
      pillsRow.appendChild(btnRight);

      bar.appendChild(topBar);
      bar.appendChild(pillsRow);

      // Delegacja zdarzeń na pasku dla pewności obsługi kliknięć
      if (!bar._mfBoundDelegation && bar.addEventListener) {
        bar._mfBoundDelegation = true;
        bar.addEventListener('click', (event) => {
          const pill = event.target.closest ? event.target.closest('.mf-folder-pill') : null;
          if (pill) {
            const fId = pill.dataset.folderId;
            if (fId) {
              bar.querySelectorAll('.mf-folder-pill').forEach((p) => {
                const isMatch = p === pill;
                p.classList.toggle('mf-active', isMatch);
                p.setAttribute('aria-selected', isMatch ? 'true' : 'false');
              });
              if (this.storage) {
                const currentThreads = this.storage._threads || {};
                this.filterChatRows(fId, currentThreads);
              }
              if (selectHandler) selectHandler(fId);
            }
          }
        });
      }

      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(updateScrollButtons);
        setTimeout(updateScrollButtons, 100);
        setTimeout(updateScrollButtons, 500);
      }

      return bar;
    }

    /* ==========================================================================
       2. PLAKIETKA I PRZYCISK NA WIERSZU ROZMOWY (injectFolderBadge)
       ========================================================================== */

    /**
     * Obsługa wiersza rozmowy na liście czatów.
     * Zgodnie z życzeniem użytkownika nazwy folderów na czacie są usunięte.
     *
     * @param {HTMLElement} rowElement - Wiersz rozmowy na liście
     * @param {string} threadId - Identyfikator wątku
     * @param {Object|null} currentFolder - Aktualnie przypisany folder lub null
     * @param {Function} onAssign - Callback po kliknięciu przypisania: (targetEl, threadId)
     */
    injectFolderBadge(rowElement, threadId, currentFolder, onAssign) {
      if (!rowElement) return;

      // 1. Usunięcie plakietki i nazwy folderu z wiersza czatu (nie jest to potrzebne na liście)
      const badge = rowElement.querySelector('.mf-thread-badge');
      if (badge) {
        badge.remove();
      }

      // 2. Usunięcie przycisku folderu przy chacie (zarządzanie odbywa się w ustawieniach)
      const actionBtn = rowElement.querySelector('.mf-folder-btn');
      if (actionBtn) {
        actionBtn.remove();
      }

      // 3. Menu pod prawym przyciskiem myszy na wierszu rozmowy (szybkie przypisanie)
      rowElement.oncontextmenu = (event) => {
        if (!event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          if (onAssign) onAssign(badge || rowElement, threadId);
        }
      };
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
      if (!headerElement) return null;

      let pill = headerElement.querySelector('.mf-header-pill');
      const targetFolderId =
        currentFolder && currentFolder.id !== 'all' && currentFolder.id !== 'uncategorized' ? currentFolder.id : 'none';

      // Jeśli pigułka już istnieje i wyświetla właściwy folder, pomijamy mutacje DOM
      if (pill && pill.dataset.folderId === targetFolderId) {
        return pill;
      }

      if (!pill) {
        pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'mf-header-pill';
        headerElement.appendChild(pill);
      }
      pill.dataset.folderId = targetFolderId;

      if (currentFolder && currentFolder.id !== 'all' && currentFolder.id !== 'uncategorized') {
        pill.className = 'mf-header-pill mf-header-pill-assigned';
        const color = currentFolder.color || '#0084FF';
        pill.style.setProperty('--mf-folder-color', color);
        pill.style.setProperty('--mf-folder-tint', `${color}18`);
        pill.title = `Folder: ${currentFolder.name} (kliknij, aby zmienić)`;

        pill.innerHTML = `
          <span class="mf-header-pill-icon">${currentFolder.icon || '📁'}</span>
          <span class="mf-header-pill-title">${currentFolder.name}</span>
          <span class="mf-header-pill-chevron">${ICONS.chevronDown}</span>
        `;
      } else {
        pill.className = 'mf-header-pill';
        pill.style.removeProperty('--mf-folder-color');
        pill.style.removeProperty('--mf-folder-tint');
        pill.title = 'Przypisz tę rozmowę do folderu';

        pill.innerHTML = `
          <span class="mf-header-pill-icon">📁</span>
          <span class="mf-header-pill-title">Dodaj folder</span>
        `;
      }

      pill.onclick = (event) => {
        event.stopPropagation();
        if (onAssign) onAssign(pill, null);
      };

      return pill;
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
    showFolderModal({ folder = null, onSave, onDelete, onBack = null } = {}) {
      this.closeModal();

      const isEdit = Boolean(folder && folder.id);
      let selectedIcon = (folder && folder.icon) || '📁';
      let selectedColor = (folder && folder.color) || DEFAULT_COLORS[0];

      const overlay = document.createElement('div');
      overlay.className = 'mf-modal-overlay';
      overlay.setAttribute('data-mf-modal-overlay', 'true');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      const modal = document.createElement('div');
      modal.className = 'mf-modal';
      modal.setAttribute('data-mf-modal', 'true');

      // Nagłówek okna
      const header = document.createElement('div');
      header.className = 'mf-modal-header';

      const headerLeft = document.createElement('div');
      headerLeft.className = 'mf-modal-header-left';

      if (onBack) {
        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'mf-modal-back-btn';
        backBtn.title = 'Wróć do wszystkich folderów';
        backBtn.setAttribute('aria-label', 'Wróć do wszystkich folderów');
        backBtn.innerHTML = ICONS.arrowBack;
        backBtn.onclick = (e) => {
          e.stopPropagation();
          this.closeModal();
          onBack();
        };
        headerLeft.appendChild(backBtn);
      }

      const modalTitle = document.createElement('h2');
      modalTitle.className = 'mf-modal-title';
      modalTitle.textContent = isEdit ? 'Edytuj folder' : 'Nowy folder';
      headerLeft.appendChild(modalTitle);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'mf-modal-close-btn';
      closeBtn.setAttribute('aria-label', 'Zamknij okno');
      closeBtn.innerHTML = ICONS.close;
      closeBtn.onclick = () => this.closeModal();

      header.appendChild(headerLeft);
      header.appendChild(closeBtn);

      // Ciało okna z polami konfiguracji
      const body = document.createElement('div');
      body.className = 'mf-modal-body';

      // Pole nazwy
      const groupName = document.createElement('div');
      groupName.className = 'mf-modal-group';
      const nameLabel = document.createElement('label');
      nameLabel.className = 'mf-modal-label';
      nameLabel.setAttribute('for', 'mf-input-folder-name');
      nameLabel.textContent = 'Nazwa folderu';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.id = 'mf-input-folder-name';
      nameInput.className = 'mf-modal-input';
      nameInput.placeholder = 'np. Praca, Ważne, Znajomi';
      nameInput.maxLength = 32;
      nameInput.value = folder ? folder.name : '';
      nameInput.autocomplete = 'off';
      const nameHint = document.createElement('span');
      nameHint.className = 'mf-modal-hint';
      nameHint.textContent = 'Wpisz krótką, czytelną nazwę.';
      groupName.appendChild(nameLabel);
      groupName.appendChild(nameInput);
      groupName.appendChild(nameHint);

      // Wybór ikony / emotikona
      const groupIcon = document.createElement('div');
      groupIcon.className = 'mf-modal-group';
      groupIcon.innerHTML = `
        <label class="mf-modal-label">Ikona folderu</label>
        <div class="mf-emoji-grid" id="mf-emoji-picker"></div>
      `;

      const emojiContainer = groupIcon.querySelector('#mf-emoji-picker');
      DEFAULT_EMOJIS.forEach((emoji) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `mf-emoji-option ${emoji === selectedIcon ? 'mf-selected' : ''}`;
        item.textContent = emoji;
        item.addEventListener('click', () => {
          selectedIcon = emoji;
          emojiContainer.querySelectorAll('.mf-emoji-option').forEach((el) => el.classList.remove('mf-selected'));
          item.classList.add('mf-selected');
          updatePreview();
        });
        emojiContainer.appendChild(item);
      });

      // Wybór koloru
      const groupColor = document.createElement('div');
      groupColor.className = 'mf-modal-group';
      groupColor.innerHTML = `
        <label class="mf-modal-label">Kolor folderu</label>
        <div class="mf-color-grid" id="mf-color-picker"></div>
      `;

      const colorContainer = groupColor.querySelector('#mf-color-picker');
      DEFAULT_COLORS.forEach((hex) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `mf-color-option ${hex.toLowerCase() === selectedColor.toLowerCase() ? 'mf-selected' : ''}`;
        item.style.backgroundColor = hex;
        item.setAttribute('aria-label', `Wybierz kolor ${hex}`);
        item.addEventListener('click', () => {
          selectedColor = hex;
          colorContainer.querySelectorAll('.mf-color-option').forEach((el) => el.classList.remove('mf-selected'));
          item.classList.add('mf-selected');
          updatePreview();
        });
        colorContainer.appendChild(item);
      });

      // Własny próbnik koloru (native color input)
      const customColorWrapper = document.createElement('div');
      customColorWrapper.className = 'mf-color-custom-wrapper';
      customColorWrapper.title = 'Wybierz własny kolor z palety';
      customColorWrapper.innerHTML = `
        <span class="mf-color-custom-icon">${ICONS.palette}</span>
        <input type="color" class="mf-color-custom-input" value="${selectedColor}" />
      `;
      const customColorInput = customColorWrapper.querySelector('.mf-color-custom-input');
      customColorInput.addEventListener('input', (event) => {
        selectedColor = event.target.value;
        colorContainer.querySelectorAll('.mf-color-option').forEach((el) => el.classList.remove('mf-selected'));
        updatePreview();
      });
      colorContainer.appendChild(customColorWrapper);

      // Sekcja podglądu na żywo
      const groupPreview = document.createElement('div');
      groupPreview.className = 'mf-modal-group';
      const previewLabel = document.createElement('label');
      previewLabel.className = 'mf-modal-label';
      previewLabel.textContent = 'Podgląd pigułki';
      const previewBox = document.createElement('div');
      previewBox.className = 'mf-modal-preview-box';
      const livePill = document.createElement('div');
      livePill.id = 'mf-modal-live-pill';
      livePill.className = 'mf-folder-pill mf-active';
      const liveIcon = document.createElement('span');
      liveIcon.className = 'mf-folder-icon';
      liveIcon.textContent = selectedIcon;
      const liveName = document.createElement('span');
      liveName.className = 'mf-folder-name';
      const liveCount = document.createElement('span');
      liveCount.className = 'mf-folder-count';
      liveCount.textContent = '3';
      livePill.appendChild(liveIcon);
      livePill.appendChild(liveName);
      livePill.appendChild(liveCount);
      previewBox.appendChild(livePill);
      groupPreview.appendChild(previewLabel);
      groupPreview.appendChild(previewBox);

      body.appendChild(groupName);
      body.appendChild(groupIcon);
      body.appendChild(groupColor);
      body.appendChild(groupPreview);

      // Sekcja wyboru i wyszukiwania rozmów do tego folderu
      const savedThreads = this.storage ? this.storage._threads || {} : {};
      const detected = this.detector ? this.detector.scanChatList() : [];

      const threadsMap = new Map();
      for (const [tId, tData] of Object.entries(savedThreads)) {
        threadsMap.set(tId, {
          id: tId,
          name: tData.name || `Rozmowa ${tId}`,
          avatar: tData.avatar || '',
          folderId: tData.folderId || 'uncategorized'
        });
      }
      detected.forEach((item) => {
        if (!threadsMap.has(item.threadId)) {
          threadsMap.set(item.threadId, {
            id: item.threadId,
            name: item.name || `Rozmowa ${item.threadId}`,
            avatar: item.avatar || '',
            folderId: 'uncategorized'
          });
        } else {
          const existing = threadsMap.get(item.threadId);
          if (item.name && item.name !== `Rozmowa ${item.threadId}`) {
            existing.name = item.name;
          }
          if (item.avatar) {
            existing.avatar = item.avatar;
          }
        }
      });

      const assignedThreadIds = new Set();
      if (isEdit && folder && folder.id) {
        for (const [tId, t] of threadsMap.entries()) {
          if (t.folderId === folder.id) {
            assignedThreadIds.add(tId);
          }
        }
      }

      const groupThreads = document.createElement('div');
      groupThreads.className = 'mf-modal-group mf-modal-group-threads';

      const threadsHeader = document.createElement('div');
      threadsHeader.className = 'mf-modal-threads-header';
      const threadsLabel = document.createElement('label');
      threadsLabel.className = 'mf-modal-label';
      threadsLabel.textContent = 'Rozmowy w tym folderze';
      const threadsCountBadge = document.createElement('span');
      threadsCountBadge.className = 'mf-modal-threads-badge';
      threadsHeader.appendChild(threadsLabel);
      threadsHeader.appendChild(threadsCountBadge);

      const searchThreadsInput = document.createElement('input');
      searchThreadsInput.type = 'text';
      searchThreadsInput.className = 'mf-modal-input mf-modal-threads-search';
      searchThreadsInput.placeholder = 'Wyszukaj osoby lub czaty do dodania...';
      searchThreadsInput.autocomplete = 'off';

      const threadsListEl = document.createElement('div');
      threadsListEl.className = 'mf-modal-threads-picker';

      const threadList = Array.from(threadsMap.values());

      const updateThreadsBadge = () => {
        threadsCountBadge.textContent = `${assignedThreadIds.size} ${assignedThreadIds.size === 1 ? 'wybrana' : 'wybranych'}`;
      };

      const renderPickerList = (filterQuery = '') => {
        threadsListEl.innerHTML = '';
        const query = (filterQuery || '').toLowerCase().trim();

        const filtered = threadList.filter((t) => t.name.toLowerCase().includes(query));
        filtered.sort((a, b) => {
          const aAssigned = assignedThreadIds.has(a.id) ? 1 : 0;
          const bAssigned = assignedThreadIds.has(b.id) ? 1 : 0;
          if (aAssigned !== bAssigned) return bAssigned - aAssigned;
          return a.name.localeCompare(b.name);
        });

        if (filtered.length === 0) {
          const emptyEl = document.createElement('div');
          emptyEl.className = 'mf-picker-empty';
          emptyEl.textContent =
            threadList.length === 0
              ? 'Przewiń listę czatów na Messengerze, aby rozszerzenie odczytało kontakty.'
              : 'Nie znaleziono takich osób.';
          threadsListEl.appendChild(emptyEl);
          return;
        }

        filtered.forEach((thread) => {
          const isAssigned = assignedThreadIds.has(thread.id);
          const item = document.createElement('div');
          item.className = `mf-picker-item ${isAssigned ? 'mf-picker-item-assigned' : ''}`;

          const left = document.createElement('div');
          left.className = 'mf-picker-item-left';

          if (thread.avatar) {
            const img = document.createElement('img');
            img.className = 'mf-picker-avatar';
            img.src = thread.avatar;
            img.alt = '';
            left.appendChild(img);
          } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'mf-picker-avatar mf-picker-avatar-placeholder';
            placeholder.textContent = '👤';
            left.appendChild(placeholder);
          }

          const name = document.createElement('span');
          name.className = 'mf-picker-name';
          name.textContent = thread.name;
          name.title = thread.name;
          left.appendChild(name);

          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.className = `mf-picker-toggle-btn ${isAssigned ? 'mf-btn-in-folder' : 'mf-btn-add-folder'}`;
          toggleBtn.innerHTML = isAssigned
            ? `${ICONS.check} <span>W folderze</span>`
            : `${ICONS.plus} <span>Dodaj</span>`;

          const toggleAction = () => {
            if (assignedThreadIds.has(thread.id)) {
              assignedThreadIds.delete(thread.id);
            } else {
              assignedThreadIds.add(thread.id);
            }
            updateThreadsBadge();
            renderPickerList(searchThreadsInput.value);
          };

          toggleBtn.onclick = (e) => {
            e.stopPropagation();
            toggleAction();
          };

          item.onclick = () => {
            toggleAction();
          };

          item.appendChild(left);
          item.appendChild(toggleBtn);
          threadsListEl.appendChild(item);
        });
      };

      groupThreads.appendChild(threadsHeader);
      groupThreads.appendChild(searchThreadsInput);
      groupThreads.appendChild(threadsListEl);

      searchThreadsInput.addEventListener('input', (e) => renderPickerList(e.target.value));
      updateThreadsBadge();
      renderPickerList();

      body.appendChild(groupThreads);

      // Stopka okna z przyciskami akcji
      const footer = document.createElement('div');
      footer.className = 'mf-modal-footer';

      if (isEdit && onDelete && (!folder || !folder.isSystem)) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'mf-btn mf-btn-danger';
        deleteBtn.innerHTML = `${ICONS.trash} <span>Usuń</span>`;
        deleteBtn.title = 'Usuń ten folder';
        deleteBtn.addEventListener('click', () => {
          if (confirm(`Czy na pewno chcesz usunąć folder "${folder.name}"? Przypisane czaty nie zostaną usunięte.`)) {
            onDelete(folder.id);
            this.closeModal();
            this.showToast(`Usunięto folder "${folder.name}"`);
          }
        });
        footer.appendChild(deleteBtn);
      }

      const footerRight = document.createElement('div');
      footerRight.className = 'mf-modal-footer-right';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'mf-btn mf-btn-secondary';
      cancelBtn.textContent = 'Anuluj';
      cancelBtn.addEventListener('click', () => {
        this.closeModal();
        if (onBack) onBack();
      });

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'mf-btn mf-btn-primary';
      saveBtn.textContent = isEdit ? 'Zapisz zmiany' : 'Utwórz folder';

      footerRight.appendChild(cancelBtn);
      footerRight.appendChild(saveBtn);
      footer.appendChild(footerRight);

      // Składanie struktury okna
      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      this.activeModal = overlay;

      // Obsługa podglądu na żywo
      const updatePreview = () => {
        liveIcon.textContent = selectedIcon;
        const text = nameInput.value.trim() || 'Nazwa folderu';
        liveName.textContent = text;
        livePill.style.setProperty('--mf-folder-color', selectedColor);
      };

      nameInput.addEventListener('input', updatePreview);
      updatePreview();

      // Automatyczne ustawienie kursora w polu nazwy
      setTimeout(() => nameInput.focus(), 50);

      // Zapis formularza
      const handleSave = async () => {
        const trimmedName = nameInput.value.trim();
        if (!trimmedName) {
          nameInput.focus();
          nameInput.style.borderColor = 'var(--mf-danger)';
          return;
        }

        const targetFolderId = isEdit ? folder.id : this.generateId();
        const folderData = {
          id: targetFolderId,
          name: trimmedName,
          icon: selectedIcon,
          color: selectedColor
        };

        if (onSave) {
          onSave(folderData);
        }

        this.closeModal();
        this.showToast(isEdit ? 'Zapisano zmiany w folderze' : 'Utworzono nowy folder');

        if (this.storage) {
          (async () => {
            for (const tId of assignedThreadIds) {
              const tInfo = threadsMap.get(tId);
              await this.storage.assignThread(tId, targetFolderId, {
                name: tInfo ? tInfo.name : '',
                avatar: tInfo ? tInfo.avatar : ''
              });
            }

            if (isEdit) {
              for (const [tId, tData] of Object.entries(savedThreads)) {
                if (tData.folderId === targetFolderId && !assignedThreadIds.has(tId)) {
                  await this.storage.removeThreadAssignment(tId);
                }
              }
            }

            const currentActive = await this.storage.getActiveFolder();
            const currentThreads = await this.storage.getAllThreads();
            this.filterChatRows(currentActive, currentThreads);
            const currentFolders = await this.storage.getFolders();
            this.renderFolderBar(currentFolders, currentActive, currentThreads);
          })();
        }
      };

      saveBtn.addEventListener('click', handleSave);

      nameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleSave();
        }
      });

      header.querySelector('.mf-modal-close-btn').addEventListener('click', () => this.closeModal());
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          this.closeModal();
        }
      });
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

    /**
     * Otwiera okno dialogowe ustawień i zarządzania folderami bezpośrednio na stronie.
     * Umożliwia tworzenie, edycję, usuwanie folderów oraz operacje kopii zapasowej.
     * @param {Object} [options]
     */
    showSettingsModal(options = {}) {
      if (typeof document === 'undefined') return;
      this.closeModal();

      const overlay = document.createElement('div');
      overlay.className = 'mf-modal-overlay';
      overlay.setAttribute('data-mf-modal-overlay', 'true');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      const modal = document.createElement('div');
      modal.className = 'mf-modal mf-modal-wide';
      modal.setAttribute('data-mf-modal', 'true');

      const header = document.createElement('div');
      header.className = 'mf-modal-header';
      header.innerHTML = `
        <h2 class="mf-modal-title">Zarządzanie folderami i ustawienia</h2>
        <button type="button" class="mf-modal-close-btn" aria-label="Zamknij okno">
          ${ICONS.close}
        </button>
      `;

      const nav = document.createElement('div');
      nav.className = 'mf-settings-nav';
      nav.innerHTML = `
        <button type="button" class="mf-settings-nav-btn mf-active" data-tab="folders">
          <span>📁 Foldery</span>
        </button>
        <button type="button" class="mf-settings-nav-btn" data-tab="threads">
          <span>💬 Rozmowy</span>
        </button>
        <button type="button" class="mf-settings-nav-btn" data-tab="backup">
          <span>💾 Kopia zapasowa</span>
        </button>
      `;

      const body = document.createElement('div');
      body.className = 'mf-modal-body';

      const contentContainer = document.createElement('div');
      contentContainer.className = 'mf-settings-tab-content';

      const renderFoldersTab = () => {
        contentContainer.innerHTML = '';

        const folders = this.storage ? this.storage.getFoldersSync() : [];
        const threads = this.storage ? this.storage._threads || {} : {};

        const counts = {};
        for (const t of Object.values(threads)) {
          const fId = t.folderId || 'uncategorized';
          counts[fId] = (counts[fId] || 0) + 1;
        }

        const topActions = document.createElement('div');
        topActions.style.marginBottom = '12px';
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'mf-btn mf-btn-primary';
        addBtn.innerHTML = `${ICONS.plus}<span>Nowy folder</span>`;
        addBtn.onclick = () => {
          this.showFolderModal({
            onSave: async (newFolder) => {
              if (this.storage) await this.storage.saveFolder(newFolder);
              this.showSettingsModal(options);
            },
            onBack: () => {
              this.showSettingsModal(options);
            }
          });
        };
        topActions.appendChild(addBtn);
        contentContainer.appendChild(topActions);

        const list = document.createElement('div');
        list.className = 'mf-settings-folder-list';

        folders.forEach((folder) => {
          const count = counts[folder.id] || 0;
          const item = document.createElement('div');
          item.className = 'mf-settings-folder-item';

          const info = document.createElement('div');
          info.className = 'mf-settings-folder-info';

          const icon = document.createElement('span');
          icon.className = 'mf-settings-folder-icon';
          icon.textContent = folder.icon || '📁';

          const details = document.createElement('div');
          details.className = 'mf-settings-folder-details';

          const name = document.createElement('span');
          name.className = 'mf-settings-folder-name';
          name.textContent = folder.name;

          const countSpan = document.createElement('span');
          countSpan.className = 'mf-settings-folder-count';
          countSpan.textContent = `${count} ${count === 1 ? 'konwersacja' : 'konwersacji'}`;

          details.appendChild(name);
          details.appendChild(countSpan);
          info.appendChild(icon);
          info.appendChild(details);
          item.appendChild(info);

          const openEditModal = () => {
            this.showFolderModal({
              folder,
              onSave: async (updated) => {
                if (this.storage) await this.storage.saveFolder(updated);
                this.showSettingsModal(options);
              },
              onDelete: async (fId) => {
                if (this.storage) await this.storage.deleteFolder(fId);
                this.showSettingsModal(options);
              },
              onBack: () => {
                this.showSettingsModal(options);
              }
            });
          };

          if (folder.id !== 'all') {
            info.style.cursor = 'pointer';
            info.title = 'Kliknij, aby zarządzać osobami i edytować folder';
            info.onclick = openEditModal;
          }

          const actions = document.createElement('div');
          actions.className = 'mf-settings-folder-actions';

          if (folder.id !== 'all') {
            const peopleBtn = document.createElement('button');
            peopleBtn.type = 'button';
            peopleBtn.className = 'mf-settings-action-btn';
            peopleBtn.title = 'Dodaj lub usuń osoby z tego folderu';
            peopleBtn.innerHTML = ICONS.users;
            peopleBtn.onclick = openEditModal;
            actions.appendChild(peopleBtn);
          }

          if (folder.isSystem && folder.id === 'all') {
            const tag = document.createElement('span');
            tag.className = 'mf-settings-system-tag';
            tag.textContent = 'Domyślny';
            actions.appendChild(tag);
          } else {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'mf-settings-action-btn';
            editBtn.title = 'Edytuj folder';
            editBtn.innerHTML = ICONS.edit;
            editBtn.onclick = openEditModal;
            actions.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'mf-settings-action-btn mf-btn-delete';
            deleteBtn.title = 'Usuń';
            deleteBtn.innerHTML = ICONS.trash;
            deleteBtn.onclick = async () => {
              const confirmMsg =
                typeof confirm !== 'undefined' ? confirm(`Czy na pewno chcesz usunąć folder „${folder.name}”?`) : true;
              if (confirmMsg) {
                if (this.storage) await this.storage.deleteFolder(folder.id);
                this.showToast(`Usunięto folder „${folder.name}”.`);
                this.showSettingsModal(options);
              }
            };
            actions.appendChild(deleteBtn);
          }

          item.appendChild(actions);
          list.appendChild(item);
        });

        contentContainer.appendChild(list);
      };

      const renderBackupTab = () => {
        contentContainer.innerHTML = '';

        const backupBox = document.createElement('div');
        backupBox.className = 'mf-settings-backup-box';

        const desc = document.createElement('p');
        desc.className = 'mf-settings-backup-desc';
        desc.textContent =
          'Możesz zapisać wszystkie foldery oraz przypisania czatów do pliku JSON lub przywrócić je z pliku.';

        const actions = document.createElement('div');
        actions.className = 'mf-settings-backup-actions';

        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'mf-btn mf-btn-primary';
        exportBtn.textContent = 'Eksportuj do JSON';
        exportBtn.onclick = async () => {
          if (this.storage) {
            const jsonStr = await this.storage.exportData();
            if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
              const blob = new Blob([jsonStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `messenger-folders-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }
            this.showToast('Pomyślnie wyeksportowano dane.');
          }
        };

        const importBtn = document.createElement('button');
        importBtn.type = 'button';
        importBtn.className = 'mf-btn mf-btn-secondary';
        importBtn.textContent = 'Importuj z JSON';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.style.display = 'none';

        fileInput.onchange = async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          if (typeof FileReader !== 'undefined') {
            const reader = new FileReader();
            reader.onload = async (event) => {
              try {
                if (this.storage) {
                  await this.storage.importData(event.target.result);
                  this.showToast('Pomyślnie zaimportowano dane.');
                  this.showSettingsModal(options);
                }
              } catch (err) {
                if (typeof alert !== 'undefined') alert('Błąd importu: ' + err.message);
              }
            };
            reader.readAsText(file);
          }
        };

        importBtn.onclick = () => fileInput.click();

        actions.appendChild(exportBtn);
        actions.appendChild(importBtn);
        actions.appendChild(fileInput);

        backupBox.appendChild(desc);
        backupBox.appendChild(actions);
        contentContainer.appendChild(backupBox);
      };

      const renderThreadsTab = () => {
        contentContainer.innerHTML = '';

        const folders = this.storage ? this.storage.getFoldersSync() : [];
        const savedThreads = this.storage ? this.storage._threads || {} : {};
        const detected = this.detector ? this.detector.scanChatList() : [];

        // Łączymy wątki wykryte w bieżącej sesji oraz wątki zapisane w pamięci
        const threadsMap = new Map();

        // 1. Dodaj wątki zapisane w magazynie
        for (const [tId, tData] of Object.entries(savedThreads)) {
          threadsMap.set(tId, {
            id: tId,
            name: tData.name || `Rozmowa ${tId}`,
            avatar: tData.avatar || '',
            folderId: tData.folderId || 'uncategorized'
          });
        }

        // 2. Dodaj wątki aktualnie widoczne na stronie
        detected.forEach((item) => {
          if (!threadsMap.has(item.threadId)) {
            threadsMap.set(item.threadId, {
              id: item.threadId,
              name: item.name || `Rozmowa ${item.threadId}`,
              avatar: item.avatar || '',
              folderId: 'uncategorized'
            });
          } else {
            const existing = threadsMap.get(item.threadId);
            if (item.name && item.name !== `Rozmowa ${item.threadId}`) {
              existing.name = item.name;
            }
            if (item.avatar) {
              existing.avatar = item.avatar;
            }
          }
        });

        const threadList = Array.from(threadsMap.values());

        // Wyszukiwarka rozmów
        const searchBox = document.createElement('div');
        searchBox.className = 'mf-settings-threads-search-box';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'mf-modal-input';
        searchInput.placeholder = 'Filtruj rozmowy po nazwie...';
        searchBox.appendChild(searchInput);
        contentContainer.appendChild(searchBox);

        const listContainer = document.createElement('div');
        listContainer.className = 'mf-settings-threads-list';

        const renderThreadItems = (filterText = '') => {
          listContainer.innerHTML = '';
          const filterLower = filterText.toLowerCase().trim();
          const filtered = threadList.filter((t) => t.name.toLowerCase().includes(filterLower));

          if (filtered.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'mf-settings-empty';
            emptyEl.textContent =
              threadList.length === 0
                ? 'Nie wykryto jeszcze żadnych rozmów. Przewiń listę czatów na Messengerze, aby rozszerzenie mogło je odczytać.'
                : 'Brak rozmów pasujących do wyszukiwania.';
            listContainer.appendChild(emptyEl);
            return;
          }

          filtered.forEach((thread) => {
            const row = document.createElement('div');
            row.className = 'mf-settings-thread-item';

            const left = document.createElement('div');
            left.className = 'mf-settings-thread-left';

            if (thread.avatar) {
              const img = document.createElement('img');
              img.className = 'mf-settings-thread-avatar';
              img.src = thread.avatar;
              img.alt = '';
              left.appendChild(img);
            } else {
              const placeholder = document.createElement('div');
              placeholder.className = 'mf-settings-thread-avatar mf-settings-thread-avatar-placeholder';
              placeholder.textContent = '💬';
              left.appendChild(placeholder);
            }

            const title = document.createElement('span');
            title.className = 'mf-settings-thread-name';
            title.textContent = thread.name;
            title.title = thread.name;
            left.appendChild(title);

            const select = document.createElement('select');
            select.className = 'mf-settings-thread-select';

            const optNone = document.createElement('option');
            optNone.value = 'uncategorized';
            optNone.textContent = '📁 Brak folderu';
            if (!thread.folderId || thread.folderId === 'uncategorized') {
              optNone.selected = true;
            }
            select.appendChild(optNone);

            folders
              .filter((f) => f.id !== 'all' && f.id !== 'uncategorized')
              .forEach((f) => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `${f.icon || '📁'} ${f.name}`;
                if (f.id === thread.folderId) {
                  opt.selected = true;
                }
                select.appendChild(opt);
              });

            select.onchange = async () => {
              const newFId = select.value === 'uncategorized' ? null : select.value;
              thread.folderId = select.value;
              if (this.storage) {
                if (newFId) {
                  await this.storage.assignThread(thread.id, newFId, {
                    name: thread.name,
                    avatar: thread.avatar
                  });
                } else {
                  await this.storage.removeThreadAssignment(thread.id);
                }
                const currentActive = await this.storage.getActiveFolder();
                const currentThreads = await this.storage.getAllThreads();
                this.filterChatRows(currentActive, currentThreads);
                const currentFolders = await this.storage.getFolders();
                this.renderFolderBar(currentFolders, currentActive, currentThreads);
              }
              const targetFolder = folders.find((f) => f.id === select.value);
              this.showToast(
                targetFolder ? `Przypisano do folderu "${targetFolder.name}"` : 'Usunięto przypisanie do folderu'
              );
            };

            row.appendChild(left);
            row.appendChild(select);
            listContainer.appendChild(row);
          });
        };

        contentContainer.appendChild(listContainer);
        renderThreadItems();

        searchInput.oninput = (e) => renderThreadItems(e.target.value);
        setTimeout(() => searchInput.focus(), 50);
      };

      nav.querySelectorAll('.mf-settings-nav-btn').forEach((btn) => {
        btn.onclick = () => {
          nav.querySelectorAll('.mf-settings-nav-btn').forEach((b) => b.classList.remove('mf-active'));
          btn.classList.add('mf-active');
          if (btn.dataset.tab === 'folders') {
            renderFoldersTab();
          } else if (btn.dataset.tab === 'threads') {
            renderThreadsTab();
          } else {
            renderBackupTab();
          }
        };
      });

      renderFoldersTab();
      body.appendChild(contentContainer);

      const footer = document.createElement('div');
      footer.className = 'mf-modal-footer';
      footer.innerHTML = `
        <button type="button" class="mf-btn mf-btn-secondary" id="mf-btn-close-settings">Zamknij</button>
      `;

      const closeAction = () => this.closeModal();
      const closeBtn = header.querySelector('.mf-modal-close-btn');
      if (closeBtn) closeBtn.onclick = closeAction;
      const footerClose = footer.querySelector('#mf-btn-close-settings');
      if (footerClose) footerClose.onclick = closeAction;
      overlay.onclick = (e) => {
        if (e.target === overlay) closeAction();
      };

      modal.appendChild(header);
      modal.appendChild(nav);
      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);

      document.body.appendChild(overlay);
      this.activeModal = overlay;
    }

    /* ==========================================================================
       5. MENU ROZWIJANE WYBORU FOLDERU (showAssignDropdown)
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
      this.closeDropdown();

      const dropdown = document.createElement('div');
      dropdown.className = 'mf-dropdown-menu';
      dropdown.setAttribute('data-mf-dropdown', 'true');

      // 1. Nagłówek z wyszukiwarką
      const header = document.createElement('div');
      header.className = 'mf-dropdown-header';
      const dropdownTitle = document.createElement('div');
      dropdownTitle.className = 'mf-dropdown-title';
      dropdownTitle.textContent = 'Przypisz do folderu';
      const searchWrapper = document.createElement('div');
      searchWrapper.className = 'mf-dropdown-search-wrapper';
      const searchIcon = document.createElement('span');
      searchIcon.className = 'mf-dropdown-search-icon';
      searchIcon.innerHTML = ICONS.search;
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'mf-dropdown-search';
      searchInput.placeholder = 'Szukaj folderu...';
      searchWrapper.appendChild(searchIcon);
      searchWrapper.appendChild(searchInput);
      header.appendChild(dropdownTitle);
      header.appendChild(searchWrapper);

      // 2. Lista folderów
      const list = document.createElement('div');
      list.className = 'mf-dropdown-list';

      const renderList = (filterText = '') => {
        list.innerHTML = '';
        const searchLower = filterText.toLowerCase().trim();

        // Opcja usunięcia z folderu (brak folderu)
        const unassignItem = document.createElement('div');
        unassignItem.className = `mf-dropdown-item mf-dropdown-unassign ${!currentFolderId || currentFolderId === 'uncategorized' ? 'mf-selected' : ''}`;
        unassignItem.innerHTML = `
          <div class="mf-dropdown-item-left">
            <span class="mf-dropdown-item-icon">${ICONS.unassign}</span>
            <span class="mf-dropdown-item-name">Brak folderu (usuń przypisanie)</span>
          </div>
          <span class="mf-dropdown-item-check">${ICONS.check}</span>
        `;
        unassignItem.addEventListener('click', () => {
          if (onAssign) onAssign(threadId, null);
          this.closeDropdown();
          this.showToast('Usunięto rozmowę z folderu');
        });
        list.appendChild(unassignItem);

        // Filtrowanie folderów (pomijając 'all')
        const selectableFolders = folders.filter((f) => f.id !== 'all');
        const filtered = selectableFolders.filter((f) => f.name.toLowerCase().includes(searchLower));

        filtered.forEach((folder) => {
          const isSelected = folder.id === currentFolderId;
          const item = document.createElement('div');
          item.className = `mf-dropdown-item ${isSelected ? 'mf-selected' : ''}`;

          item.innerHTML = `
            <div class="mf-dropdown-item-left">
              <span class="mf-dropdown-item-dot" style="background-color: ${folder.color || '#0084FF'}"></span>
              <span class="mf-dropdown-item-icon">${folder.icon || '📁'}</span>
              <span class="mf-dropdown-item-name">${this._escapeHtml(folder.name)}</span>
            </div>
            <span class="mf-dropdown-item-check">${ICONS.check}</span>
          `;

          item.addEventListener('click', () => {
            if (onAssign) onAssign(threadId, folder.id);
            this.closeDropdown();
            this.showToast(`Przypisano do folderu "${folder.name}"`);
          });

          list.appendChild(item);
        });

        if (filtered.length === 0 && searchLower) {
          const empty = document.createElement('div');
          empty.style.padding = '12px 8px';
          empty.style.fontSize = '12px';
          empty.style.color = 'var(--mf-text-secondary)';
          empty.style.textAlign = 'center';
          empty.textContent = 'Nie znaleziono takiego folderu.';
          list.appendChild(empty);
        }
      };

      // 3. Stopka: Szybkie dodanie nowego folderu
      const footer = document.createElement('div');
      footer.className = 'mf-dropdown-footer';
      const newFolderBtn = document.createElement('button');
      newFolderBtn.type = 'button';
      newFolderBtn.className = 'mf-dropdown-new-folder-btn';
      newFolderBtn.innerHTML = `${ICONS.plus} <span>Utwórz nowy folder</span>`;
      newFolderBtn.addEventListener('click', () => {
        this.closeDropdown();
        if (onNewFolder) {
          onNewFolder();
        } else {
          this.showFolderModal({
            onSave: async (newFolder) => {
              if (this.storage) {
                await this.storage.saveFolder(newFolder);
                if (onAssign) onAssign(threadId, newFolder.id);
              } else {
                folders.push(newFolder);
                if (onAssign) onAssign(threadId, newFolder.id);
              }
            }
          });
        }
      });
      footer.appendChild(newFolderBtn);

      dropdown.appendChild(header);
      dropdown.appendChild(list);
      dropdown.appendChild(footer);
      document.body.appendChild(dropdown);
      this.activeDropdown = dropdown;

      renderList();

      searchInput.addEventListener('input', (e) => renderList(e.target.value));
      setTimeout(() => searchInput.focus(), 30);

      this._positionDropdown(dropdown, targetElement);
    }

    /**
     * Precyzyjne pozycjonowanie menu rozwijanego w obrębie okna przeglądarki.
     * @private
     */
    _positionDropdown(dropdown, targetElement) {
      if (!targetElement) return;

      const rect = targetElement.getBoundingClientRect();
      const menuWidth = dropdown.offsetWidth || 260;
      const menuHeight = dropdown.offsetHeight || 280;
      const margin = 8;

      let top = rect.bottom + margin;
      let left = rect.left;

      if (top + menuHeight > window.innerHeight) {
        top = Math.max(margin, rect.top - menuHeight - margin);
      }

      if (left + menuWidth > window.innerWidth) {
        left = Math.max(margin, window.innerWidth - menuWidth - margin);
      }

      if (left < margin) {
        left = margin;
      }

      dropdown.style.top = `${Math.round(top)}px`;
      dropdown.style.left = `${Math.round(left)}px`;
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
       6. FILTROWANIE WIERSZY ROZMÓW (filterChatRows)
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
      // Poprzednie wstrzykiwanie renderHeaderPill do [role="main"] header naruszało
      // wirtualne drzewo React 18 i blokowało ładowanie wiadomości w konwersacji.
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
       7. POWIADOMIENIA TOAST (showToast)
       ========================================================================== */

    /**
     * Wyświetla dyskretny dymek powiadomienia u dołu ekranu.
     *
     * @param {string} message - Tekst powiadomienia
     * @param {number} duration - Czas wyświetlania w milisekundach
     */
    showToast(message, duration = 2600) {
      if (typeof document === 'undefined') return;

      let toast = document.querySelector('.mf-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'mf-toast';
        document.body.appendChild(toast);
      }

      toast.textContent = message;
      toast.classList.add('mf-show');

      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }

      this.toastTimeout = setTimeout(() => {
        toast.classList.remove('mf-show');
      }, duration);
    }

    /**
     * Zabezpieczenie przed atakami XSS przy wstrzykiwaniu tekstu.
     * @private
     */
    _escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  // Eksport globalny i modułowy (z aliasem MessengerFoldersUI dla zachowania kompatybilności)
  if (typeof global !== 'undefined') {
    global.MessengerUI = MessengerUI;
    global.MessengerFoldersUI = MessengerUI;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessengerUI;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
