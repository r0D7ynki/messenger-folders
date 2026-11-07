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

  /**
   * Zwraca widoczne pigułki folderów — pomija te ukryte filtrem wyszukiwania.
   * @param {HTMLElement} container - Kontener pigułek (role="tablist")
   * @returns {Array<HTMLElement>} Pigułki dostępne dla nawigacji klawiaturą
   */
  function visibleFolderPills(container) {
    return Array.from(container.querySelectorAll('.mf-folder-pill')).filter(
      (pill) => !pill.classList.contains('mf-pill-hidden') && pill.style.display !== 'none'
    );
  }

  /**
   * Ustawia roving tabindex (wzorzec WAI-ARIA Tabs): dokładnie jedna pigułka ma
   * tabindex="0", pozostałe "-1".
   *
   * Jedynym źródłem prawdy o bieżącym przystanku Tab jest atrybut `tabindex="0"` w DOM, a nie
   * stan zapamiętany w domknięciu — dzięki temu aktualizacja liczników, filtrowanie wyszukiwarką
   * i odświeżenie paska nie rozjeżdżają przystanku Tab z pigułką wskazaną strzałkami.
   * Kolejność wyboru pigułki: pigułka preferowana (np. z fokusem), potem dotychczasowy przystanek
   * Tab z DOM, potem pigułka aktywna, na końcu pierwsza widoczna.
   * @param {HTMLElement} container - Kontener pigułek (role="tablist")
   * @param {HTMLElement} [preferredPill] - Pigułka, która ma przejąć przystanek Tab
   * @returns {HTMLElement|null} Pigułka z tabindex="0"
   */
  function applyRovingTabindex(container, preferredPill) {
    if (!container || typeof container.querySelectorAll !== 'function') return null;

    const allPills = Array.from(container.querySelectorAll('.mf-folder-pill'));
    if (!allPills.length) return null;

    // Jedno przejście po pigułkach: pula widocznych (pomijamy ukryte filtrem) i bieżący przystanek Tab
    const isVisible = (pill) => !pill.classList.contains('mf-pill-hidden') && pill.style.display !== 'none';
    const visiblePills = allPills.filter(isVisible);
    const pool = visiblePills.length ? visiblePills : allPills;
    const inPool = (pill) => Boolean(pill) && pool.indexOf(pill) !== -1;

    let target = inPool(preferredPill) ? preferredPill : null;
    if (!target) target = pool.find((pill) => pill.getAttribute('tabindex') === '0') || null;
    if (!target) target = pool.find((pill) => pill.classList.contains('mf-active')) || null;
    if (!target) target = pool[0];

    allPills.forEach((pill) => {
      const tabindex = pill === target ? '0' : '-1';
      if (pill.getAttribute('tabindex') !== tabindex) {
        pill.setAttribute('tabindex', tabindex);
      }
    });
    return target;
  }

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
     * @param {Object} [counts] - Mapa wątków { [threadId]: { folderId } } lub liczniki { [folderId]: number }
     * @param {Object} [unreadCounts] - Mapa nieprzeczytanych wątków: { [folderId]: number, all: number }
     * @returns {HTMLElement|null} Element paska #mf-folder-bar lub null
     */
    updateFolderCounts(counts = {}, unreadCounts = {}) {
      if (typeof document === 'undefined') return null;

      const bar = document.getElementById('mf-folder-bar');
      if (!bar) return null;

      // Każdy wpis rozpoznawany osobno: liczba to licznik folderu, obiekt to rekord wątku
      const resolvedCounts = {};
      if (counts && typeof counts === 'object') {
        for (const [key, value] of Object.entries(counts)) {
          if (value && typeof value === 'object') {
            const fId = value.folderId || 'uncategorized';
            resolvedCounts[fId] = (resolvedCounts[fId] || 0) + 1;
          } else if (typeof value === 'number' && Number.isFinite(value)) {
            resolvedCounts[key] = (resolvedCounts[key] || 0) + value;
          }
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

      // Roving tabindex: po aktualizacji liczników nadal dokładnie jedna pigułka ma tabindex="0",
      // a przystanek Tab zostaje tam, gdzie wskazał go użytkownik (źródło prawdy: tabindex w DOM)
      applyRovingTabindex(bar.querySelector('.mf-folder-scroll-container'));

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
          // Folder aktywny przed tą aktualizacją — zmiana wyboru przenosi przystanek Tab na nową pigułkę
          const previousActive = Array.from(existingPills).find((p) => p.classList.contains('mf-active'));
          const previousActiveId = previousActive ? previousActive.dataset.folderId : null;

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

          // Roving tabindex po aktualizacji w miejscu: kontener to tablist, jedna pigułka na Tab.
          // Zmiana aktywnego folderu (spoza kliknięcia pigułki) przenosi przystanek Tab na nową
          // pigułkę aktywną; w pozostałych przypadkach zostaje on tam, gdzie wskazał go użytkownik
          // (źródło prawdy: atrybut tabindex="0" w DOM, nie stan domknięcia).
          const scrollContainer = pillsRow.querySelector('.mf-folder-scroll-container');
          if (scrollContainer) {
            scrollContainer.setAttribute('role', 'tablist');
            scrollContainer.setAttribute('aria-label', 'Foldery rozmów');
            scrollContainer.setAttribute('aria-orientation', 'horizontal');
            const selectionChanged = previousActiveId !== activeFolderId;
            const preferredPill = selectionChanged
              ? Array.from(existingPills).find((pill) => pill.dataset.folderId === activeFolderId) || null
              : null;
            applyRovingTabindex(scrollContainer, preferredPill);
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

      // Kontener przewijalny z pigułkami — wzorzec WAI-ARIA Tabs (role="tablist")
      const container = document.createElement('div');
      container.className = 'mf-folder-scroll-container';
      container.setAttribute('data-mf-scroll-container', 'true');
      container.setAttribute('role', 'tablist');
      container.setAttribute('aria-label', 'Foldery rozmów');
      container.setAttribute('aria-orientation', 'horizontal');

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

      // Przenosi fokus i przystanek Tab na pigułkę — bez zmiany aktywnego folderu
      // (manualna aktywacja: folder zmienia dopiero Enter/Spacja/kliknięcie).
      const focusPill = (pill) => {
        if (!pill) return;
        applyRovingTabindex(container, pill);
        if (typeof pill.focus === 'function') pill.focus();
        if (typeof pill.scrollIntoView === 'function') {
          pill.scrollIntoView({ inline: 'nearest', block: 'nearest' });
        }
      };

      // Strzałki, Home i End przenoszą fokus między widocznymi pigułkami, z zawijaniem.
      // Reagujemy wyłącznie na zdarzenia pochodzące z pigułki: klawisze na innym elemencie
      // (np. przycisku „Dodaj nowy folder”) nie mogą kraść fokusu ani blokować domyślnej akcji.
      container.addEventListener('keydown', (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

        const targetPill = event.target;
        if (!targetPill || !targetPill.classList || !targetPill.classList.contains('mf-folder-pill')) {
          return;
        }

        const pills = visibleFolderPills(container);
        const currentIdx = pills.indexOf(targetPill);
        if (currentIdx === -1) return;

        let nextIdx = null;
        if (event.key === 'ArrowRight') {
          nextIdx = (currentIdx + 1) % pills.length;
        } else if (event.key === 'ArrowLeft') {
          nextIdx = (currentIdx - 1 + pills.length) % pills.length;
        } else if (event.key === 'Home') {
          nextIdx = 0;
        } else if (event.key === 'End') {
          nextIdx = pills.length - 1;
        }
        if (nextIdx === null) return;

        event.preventDefault();
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        focusPill(pills[nextIdx]);
      });

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
        // Przystanek Tab nie może zostać na pigułce ukrytej filtrem — jeśli nią był,
        // applyRovingTabindex przenosi go na pigułkę aktywną (albo pierwszą widoczną)
        applyRovingTabindex(container);
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
          const firstVisiblePill = visibleFolderPills(container)[0];
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
        // Roving tabindex: tylko pigułka aktywna jest przystankiem Tab (applyRovingTabindex na końcu)
        pill.setAttribute('tabindex', isActive ? '0' : '-1');
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

        // Fokus z klawiatury lub myszy przenosi przystanek Tab na tę pigułkę
        pill.addEventListener('focus', () => {
          applyRovingTabindex(container, pill);
        });

        // Wybór folderu z natychmiastową reakcją wizualną i filtrowaniem
        pill.addEventListener('click', () => {
          container.querySelectorAll('.mf-folder-pill').forEach((p) => {
            const isMatch = p === pill;
            p.classList.toggle('mf-active', isMatch);
            p.setAttribute('aria-selected', isMatch ? 'true' : 'false');
          });
          applyRovingTabindex(container, pill);

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

      // Dokładnie jedna pigułka (aktywna) jest przystankiem Tab
      applyRovingTabindex(container);

      if (searchInput.value) {
        applyFolderFilter();
      }

      // Przycisk dodawania nowego folderu — rodzeństwo tablisty w rzędzie pigułek,
      // nigdy wewnątrz role="tablist" (tablist zawiera wyłącznie role="tab")
      let addBtn = null;
      if (addHandler) {
        addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'mf-folder-add-btn';
        addBtn.title = 'Dodaj nowy folder';
        addBtn.setAttribute('aria-label', 'Dodaj nowy folder');
        this._setIcon(addBtn, 'plus');
        addBtn.addEventListener('click', () => addHandler());
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
      if (addBtn) pillsRow.appendChild(addBtn);
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
              // Przystanek Tab podąża za klikniętą (aktywną) pigułką
              applyRovingTabindex(bar.querySelector('.mf-folder-scroll-container'), pill);
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
