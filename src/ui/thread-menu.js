/**
 * Messenger Folders - Komponent menu wątku i plakietek (ThreadMenuComponent)
 * Menu rozwijane przypisywania (.mf-dropdown-menu), pozycjonowanie w oknie,
 * obsługa wiersza czatu (injectFolderBadge) oraz pigułka nagłówka (renderHeaderPill).
 */

(function (global) {
  'use strict';

  const Core =
    (typeof globalThis !== 'undefined' && globalThis.MessengerUICore) ||
    (typeof global !== 'undefined' && global.MessengerUICore) ||
    (typeof require === 'function' ? require('./core.js') : null);

  class ThreadMenuComponent {
    /**
     * @param {Object} [ui] Instancja fasady MessengerUI
     */
    constructor(ui) {
      this.ui = ui || null;
    }

    _escapeHtml(str) {
      if (this.ui && typeof this.ui._escapeHtml === 'function') {
        return this.ui._escapeHtml(str);
      }
      return Core ? Core.escapeHtml(str) : String(str || '');
    }

    _setIcon(el, iconName) {
      if (this.ui && typeof this.ui._setIcon === 'function') {
        this.ui._setIcon(el, iconName);
      } else if (Core) {
        Core.setIcon(el, iconName);
      }
    }

    _setButtonContent(btn, iconName, labelText) {
      if (this.ui && typeof this.ui._setButtonContent === 'function') {
        this.ui._setButtonContent(btn, iconName, labelText);
      } else if (Core) {
        Core.setButtonContent(btn, iconName, labelText);
      }
    }

    /**
     * Obsługa wiersza rozmowy na liście czatów.
     * Usuwa plakietki i przyciski, rejestruje contextmenu (prawy przycisk myszy).
     *
     * @param {HTMLElement} rowElement - Wiersz rozmowy na liście
     * @param {string} threadId - Identyfikator wątku
     * @param {Object|null} currentFolder - Aktualnie przypisany folder lub null
     * @param {Function} onAssign - Callback po kliknięciu przypisania: (targetEl, threadId)
     */
    injectFolderBadge(rowElement, threadId, currentFolder, onAssign) {
      if (!rowElement) return;

      // 1. Usunięcie starej plakietki z wiersza czatu
      const badge = rowElement.querySelector('.mf-thread-badge');
      if (badge) {
        badge.remove();
      }

      // 2. Usunięcie przycisku folderu przy chacie
      const actionBtn = rowElement.querySelector('.mf-folder-btn');
      if (actionBtn) {
        actionBtn.remove();
      }

      // 3. Menu pod prawym przyciskiem myszy na wierszu rozmowy
      rowElement.oncontextmenu = (event) => {
        if (!event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          if (onAssign) onAssign(badge || rowElement, threadId);
        }
      };
    }

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
          <span class="mf-header-pill-icon">${this._escapeHtml(currentFolder.icon || '📁')}</span>
          <span class="mf-header-pill-title">${this._escapeHtml(currentFolder.name)}</span>
          <span class="mf-header-pill-chevron"></span>
        `;
        this._setIcon(pill.querySelector('.mf-header-pill-chevron'), 'chevronDown');
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
      this._setIcon(searchIcon, 'search');
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
            <span class="mf-dropdown-item-icon"></span>
            <span class="mf-dropdown-item-name">Brak folderu (usuń przypisanie)</span>
          </div>
          <span class="mf-dropdown-item-check"></span>
        `;
        this._setIcon(unassignItem.querySelector('.mf-dropdown-item-icon'), 'unassign');
        this._setIcon(unassignItem.querySelector('.mf-dropdown-item-check'), 'check');
        unassignItem.addEventListener('click', () => {
          if (onAssign) onAssign(threadId, null);
          this.closeDropdown();
          if (this.ui && typeof this.ui.showToast === 'function') {
            this.ui.showToast('Usunięto rozmowę z folderu');
          }
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
              <span class="mf-dropdown-item-dot" style="background-color: ${this._escapeHtml(folder.color || '#0084FF')}"></span>
              <span class="mf-dropdown-item-icon">${this._escapeHtml(folder.icon || '📁')}</span>
              <span class="mf-dropdown-item-name">${this._escapeHtml(folder.name)}</span>
            </div>
            <span class="mf-dropdown-item-check"></span>
          `;
          this._setIcon(item.querySelector('.mf-dropdown-item-check'), 'check');

          item.addEventListener('click', () => {
            if (onAssign) onAssign(threadId, folder.id);
            this.closeDropdown();
            if (this.ui && typeof this.ui.showToast === 'function') {
              this.ui.showToast(`Przypisano do folderu "${folder.name}"`);
            }
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
      this._setButtonContent(newFolderBtn, 'plus', 'Utwórz nowy folder');
      newFolderBtn.addEventListener('click', () => {
        this.closeDropdown();
        if (onNewFolder) {
          onNewFolder();
        } else if (this.ui && typeof this.ui.showFolderModal === 'function') {
          this.ui.showFolderModal({
            onSave: async (newFolder) => {
              if (this.ui.storage) {
                await this.ui.storage.saveFolder(newFolder);
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

      if (this.ui) {
        this.ui.activeDropdown = dropdown;
      }

      renderList();

      searchInput.addEventListener('input', (e) => renderList(e.target.value));
      setTimeout(() => searchInput.focus(), 30);

      this.positionDropdown(dropdown, targetElement);
    }

    /**
     * Precyzyjne pozycjonowanie menu rozwijanego w obrębie okna przeglądarki.
     * @param {HTMLElement} dropdown
     * @param {HTMLElement} targetElement
     */
    positionDropdown(dropdown, targetElement) {
      if (!targetElement) return;

      const rect = targetElement.getBoundingClientRect();
      const menuWidth = dropdown.offsetWidth || 260;
      const menuHeight = dropdown.offsetHeight || 280;
      const margin = 8;

      let top = rect.bottom + margin;
      let left = rect.left;

      if (typeof window !== 'undefined') {
        if (top + menuHeight > window.innerHeight) {
          top = Math.max(margin, rect.top - menuHeight - margin);
        }

        if (left + menuWidth > window.innerWidth) {
          left = Math.max(margin, window.innerWidth - menuWidth - margin);
        }

        if (left < margin) {
          left = margin;
        }
      }

      dropdown.style.top = `${Math.round(top)}px`;
      dropdown.style.left = `${Math.round(left)}px`;
    }

    /**
     * Zamyka aktywne menu rozwijane.
     */
    closeDropdown() {
      if (this.ui && this.ui.activeDropdown) {
        this.ui.activeDropdown.remove();
        this.ui.activeDropdown = null;
      }
    }
  }

  // Eksport globalny i modułowy
  if (typeof globalThis !== 'undefined') {
    globalThis.ThreadMenuComponent = ThreadMenuComponent;
    globalThis.MessengerUIThreadMenu = ThreadMenuComponent;
  }
  if (typeof global !== 'undefined') {
    global.ThreadMenuComponent = ThreadMenuComponent;
    global.MessengerUIThreadMenu = ThreadMenuComponent;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThreadMenuComponent;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
