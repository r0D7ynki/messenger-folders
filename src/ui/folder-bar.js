/**
 * Messenger Folders - Komponent paska folderów (FolderBarComponent)
 * Dwurzędowy pasek folderów (#mf-folder-bar), wyszukiwanie, scrollowanie, pigułki, in-place update.
 */

(function (global) {
  'use strict';

  const Core =
    (typeof globalThis !== 'undefined' && globalThis.MessengerUICore) ||
    (typeof global !== 'undefined' && global.MessengerUICore) ||
    (typeof require === 'function' ? require('./core.js') : null);

  class FolderBarComponent {
    /**
     * @param {Object} [ui] Instancja fasady MessengerUI
     */
    constructor(ui) {
      this.ui = ui || null;
    }

    /**
     * Pomocnik ustawiania ikony
     * @private
     */
    _setIcon(el, iconName) {
      if (this.ui && typeof this.ui._setIcon === 'function') {
        this.ui._setIcon(el, iconName);
      } else if (Core) {
        Core.setIcon(el, iconName);
      }
    }

    /**
     * Aktualizuje odznaki nieprzeczytanych wiadomości oraz liczbę wątków w danej pigułce.
     * @private
     * @param {HTMLElement} pill - Element pigułki .mf-folder-pill
     * @param {string} fId - Identyfikator folderu
     * @param {Object} resolvedCounts - Mapa łącznej liczby wątków
     * @param {Object} resolvedUnreadCounts - Mapa nieprzeczytanych wątków
     */
    _updatePillBadges(pill, fId, resolvedCounts, resolvedUnreadCounts) {
      const isActive = pill.classList.contains('mf-active');
      const countVal = resolvedCounts[fId] || 0;
      const unreadVal = Number(resolvedUnreadCounts && resolvedUnreadCounts[fId]) || 0;

      // 1. Odznaka nieprzeczytanych wiadomości (.mf-folder-unread-badge)
      let unreadBadge = pill.querySelector('.mf-folder-unread-badge');
      if (unreadVal > 0) {
        if (!unreadBadge) {
          unreadBadge = document.createElement('span');
          unreadBadge.className = 'mf-folder-unread-badge';
          const countEl = pill.querySelector('.mf-folder-count');
          if (countEl && typeof pill.insertBefore === 'function') {
            pill.insertBefore(unreadBadge, countEl);
          } else {
            pill.appendChild(unreadBadge);
          }
        }
        const unreadText = unreadVal > 99 ? '99+' : String(unreadVal);
        if (unreadBadge.textContent !== unreadText) {
          unreadBadge.textContent = unreadText;
        }
        unreadBadge.setAttribute('aria-label', `${unreadVal} nieprzeczytanych`);
      } else if (unreadBadge) {
        unreadBadge.remove();
      }

      // 2. Licznik wszystkich przypisanych wątków (.mf-folder-count)
      let countEl = pill.querySelector('.mf-folder-count');
      if (countVal > 0 || isActive) {
        if (!countEl) {
          countEl = document.createElement('span');
          countEl.className = 'mf-folder-count';
          pill.appendChild(countEl);
        }
        const countText = countVal > 99 ? '99+' : String(countVal);
        if (countEl.textContent !== countText) {
          countEl.textContent = countText;
        }
      } else if (countEl) {
        countEl.remove();
      }
    }

    /**
     * Aktualizuje liczniki wątków oraz odznaki nieprzeczytanych wiadomości w istniejącym pasku folderów.
     *
     * @param {Object} [counts] - Mapa wątków lub obiekt { [folderId]: number }
     * @param {Object} [unreadCounts] - Mapa nieprzeczytanych wątków: { [folderId]: number, all: number }
     * @returns {HTMLElement|null} Element paska #mf-folder-bar lub null
     */
    updateFolderCounts(counts = {}, unreadCounts = {}) {
      if (typeof document === 'undefined') return null;

      const bar = document.getElementById('mf-folder-bar');
      if (!bar) return null;

      let resolvedCounts = {};
      if (counts && typeof counts === 'object') {
        const firstVal = Object.values(counts)[0];
        if (firstVal && typeof firstVal === 'object' && 'folderId' in firstVal) {
          for (const thread of Object.values(counts)) {
            const fId = thread.folderId || 'uncategorized';
            resolvedCounts[fId] = (resolvedCounts[fId] || 0) + 1;
          }
        } else {
          resolvedCounts = counts;
        }
      }

      const resolvedUnread = unreadCounts && typeof unreadCounts === 'object' ? unreadCounts : {};
      const pills = bar.querySelectorAll('.mf-folder-pill');

      pills.forEach((pill) => {
        const fId = pill.dataset.folderId;
        if (!fId) return;

        this._updatePillBadges(pill, fId, resolvedCounts, resolvedUnread);

        // Aktualizacja atrybutu title pigułki
        const nameEl = pill.querySelector('.mf-folder-name');
        const folderName = nameEl ? (nameEl.textContent || '').trim() : '';
        const countVal = resolvedCounts[fId] || 0;
        const unreadVal = Number(resolvedUnread[fId]) || 0;
        if (folderName) {
          pill.title =
            unreadVal > 0
              ? `${folderName} (${countVal} rozmów, ${unreadVal} nieprzeczytanych)`
              : `${folderName} (${countVal} rozmów)`;
        }
      });

      return bar;
    }

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
    render(
      folders = [],
      activeFolderId = 'all',
      counts = {},
      unreadCounts = {},
      onSelectFolder,
      onAddFolder,
      onEditFolder,
      onOpenSettings
    ) {
      if (typeof document === 'undefined') return null;

      // Polimorficzna obsługa unreadCounts dla 100% kompatybilności wstecznej
      let resolvedUnreadCounts = {};
      let selectHandler = onSelectFolder;
      let addHandler = onAddFolder;
      let settingsHandler = onOpenSettings;

      if (typeof unreadCounts === 'function') {
        settingsHandler = onEditFolder;
        addHandler = onSelectFolder;
        selectHandler = unreadCounts;
        resolvedUnreadCounts = {};
      } else if (unreadCounts && typeof unreadCounts === 'object') {
        resolvedUnreadCounts = unreadCounts;
      }

      // Obsługa domyślnych callbacków przy integracji ze storage
      if (!selectHandler) {
        selectHandler = async (folderId) => {
          if (this.ui && this.ui.storage) {
            await this.ui.storage.setActiveFolder(folderId);
          }
        };
      }

      if (!addHandler) {
        addHandler = () => {
          if (this.ui && typeof this.ui.showFolderModal === 'function') {
            this.ui.showFolderModal({
              onSave: async (newFolder) => {
                if (this.ui.storage) {
                  await this.ui.storage.saveFolder(newFolder);
                }
              }
            });
          }
        };
      }

      if (!settingsHandler) {
        settingsHandler = () => {
          if (this.ui && typeof this.ui.showSettingsModal === 'function') {
            this.ui.showSettingsModal();
          }
        };
      }

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
            this._setIcon(btnL, 'chevronLeft');
            btnL.style.top = '3px';
            btnL.style.transform = 'none';
            btnL.style.left = '-8px';
          }
          const btnR = pillsRow.querySelector('.mf-scroll-btn-right');
          if (btnR) {
            this._setIcon(btnR, 'chevronRight');
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
              const unreadVal = Number(resolvedUnreadCounts[fId]) || 0;
              pill.title =
                unreadVal > 0
                  ? `${folderObj.name} (${countVal} rozmów, ${unreadVal} nieprzeczytanych)`
                  : `${folderObj.name} (${countVal} rozmów)`;
            }

            this._updatePillBadges(pill, fId, resolvedCounts, resolvedUnreadCounts);
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
      this._setIcon(searchIcon, 'search');
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
      this._setIcon(clearBtn, 'close');
      searchBox.appendChild(clearBtn);

      topBar.appendChild(searchBox);

      // Przycisk ustawień przypięty obok wyszukiwarki folderów
      if (settingsHandler) {
        const settingsBtn = document.createElement('button');
        settingsBtn.type = 'button';
        settingsBtn.className = 'mf-folder-settings-btn';
        settingsBtn.title = 'Ustawienia folderów i kopia zapasowa';
        settingsBtn.setAttribute('aria-label', 'Ustawienia folderów');
        this._setIcon(settingsBtn, 'settings');
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
      this._setIcon(btnLeft, 'chevronLeft');
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
      this._setIcon(btnRight, 'chevronRight');
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
        const unreadVal = Number(resolvedUnreadCounts[folder.id]) || 0;
        pill.title =
          unreadVal > 0
            ? `${folder.name} (${count} rozmów, ${unreadVal} nieprzeczytanych)`
            : `${folder.name} (${count} rozmów)`;

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

        // Aktualizacja/dodanie odznak (.mf-folder-unread-badge i .mf-folder-count)
        this._updatePillBadges(pill, folder.id, resolvedCounts, resolvedUnreadCounts);

        // Wybór folderu z natychmiastową reakcją wizualną i filtrowaniem
        pill.addEventListener('click', () => {
          container.querySelectorAll('.mf-folder-pill').forEach((p) => {
            const isMatch = p === pill;
            p.classList.toggle('mf-active', isMatch);
            p.setAttribute('aria-selected', isMatch ? 'true' : 'false');
          });

          if (this.ui && this.ui.storage) {
            const currentThreads = this.ui.storage._threads || {};
            if (typeof this.ui.filterChatRows === 'function') {
              this.ui.filterChatRows(folder.id, currentThreads);
            }
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
        this._setIcon(addBtn, 'plus');
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
              if (this.ui && this.ui.storage) {
                const currentThreads = this.ui.storage._threads || {};
                if (typeof this.ui.filterChatRows === 'function') {
                  this.ui.filterChatRows(fId, currentThreads);
                }
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
  }

  // Eksport globalny i modułowy
  if (typeof globalThis !== 'undefined') {
    globalThis.FolderBarComponent = FolderBarComponent;
    globalThis.MessengerUIFolderBar = FolderBarComponent;
  }
  if (typeof global !== 'undefined') {
    global.FolderBarComponent = FolderBarComponent;
    global.MessengerUIFolderBar = FolderBarComponent;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FolderBarComponent;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
