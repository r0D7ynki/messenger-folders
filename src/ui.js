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
    chevronLeft: `<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`,
    chevronRight: `<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>`,
    unassign: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>`,
    palette: `<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.22 19.49 10.57 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-5 9c-.83 0-1.5-.67-1.5-1.5S6.17 9 7 9s1.5.67 1.5 1.5S7.83 12 7 12zm3-4c-.83 0-1.5-.67-1.5-1.5S9.17 5 10 5s1.5.67 1.5 1.5S10.83 8 10 8zm4 0c-.83 0-1.5-.67-1.5-1.5S13.17 5 14 5s1.5.67 1.5 1.5S14.83 8 14 8zm3 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`
  };

  // Domyślny zestaw emotikonów do wyboru
  const DEFAULT_EMOJIS = [
    '📁', '💼', '👥', '⭐', '💡', '🏷️', '🛒', '📌',
    '🎯', '🔒', '💬', '🚀', '❤️', '🔔', '🎮', '🏠',
    '📚', '🎨', '🛠️', '✈️', '🎵', '🔥', '💻', '🤝'
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
    '#64748B'  // Grafitowy
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
          const isInside = this.activeDropdown.contains(event.target) ||
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
     * @returns {HTMLElement} Główny element paska #mf-folder-bar
     */
    renderFolderBar(folders = [], activeFolderId = 'all', counts = {}, onSelectFolder, onAddFolder, onEditFolder) {
      if (typeof document === 'undefined') return null;

      // Obsługa domyślnych callbacków przy integracji ze storage
      const selectHandler = onSelectFolder || (async (folderId) => {
        if (this.storage) {
          await this.storage.setActiveFolder(folderId);
        }
      });

      const addHandler = onAddFolder || (() => {
        this.showFolderModal({
          onSave: async (newFolder) => {
            if (this.storage) {
              await this.storage.saveFolder(newFolder);
            }
          }
        });
      });

      const editHandler = onEditFolder || ((folder) => {
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

      // Jeśli w parametrze `counts` przekazano obiekt mapy wątków z folderId (np. allThreads)
      let resolvedCounts = {};
      if (counts && typeof counts === 'object') {
        const firstVal = Object.values(counts)[0];
        if (firstVal && typeof firstVal === 'object' && ('folderId' in firstVal)) {
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
      const hasAll = folders.some(f => f.id === 'all');
      const folderList = hasAll ? [...folders] : [
        { id: 'all', name: 'Wszystkie', icon: '💬', color: '#0084FF', isSystem: true },
        ...folders
      ];

      let bar = document.getElementById('mf-folder-bar');
      if (bar) {
        // Jeśli pasek już istnieje w DOM, sprawdzamy czy struktura folderów jest identyczna
        const existingPills = bar.querySelectorAll('.mf-folder-pill');
        const existingIds = Array.from(existingPills).map(p => p.dataset.folderId);
        const newIds = folderList.map(f => f.id);
        const isSameStructure = existingIds.length > 0 &&
          existingIds.length === newIds.length &&
          existingIds.every((id, idx) => id === newIds[idx]);

        if (isSameStructure) {
          // Zaktualizuj TYLKO klasy i liczniki w istniejących elementach (zero niszczenia DOM, zero skakania!)
          existingPills.forEach(pill => {
            const fId = pill.dataset.folderId;
            const isActive = fId === activeFolderId;
            pill.classList.toggle('mf-active', isActive);
            pill.setAttribute('aria-selected', isActive ? 'true' : 'false');

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
          return bar; // Gotowe, zero resetu DOM!
        }
      } else {
        bar = document.createElement('div');
        bar.id = 'mf-folder-bar';
      }
      bar.setAttribute('data-mf-folder-bar', 'true');

      bar.innerHTML = '';

      // Przycisk przewijania w lewo
      const btnLeft = document.createElement('button');
      btnLeft.type = 'button';
      btnLeft.className = 'mf-scroll-btn mf-scroll-btn-left';
      btnLeft.setAttribute('aria-label', 'Przewiń foldery w lewo');
      btnLeft.innerHTML = ICONS.chevronLeft;

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

        // Przycisk edycji dla folderów innych niż 'all'
        if (folder.id !== 'all' && editHandler) {
          const editBtn = document.createElement('span');
          editBtn.className = 'mf-pill-edit-icon';
          editBtn.title = 'Edytuj ten folder';
          editBtn.innerHTML = ICONS.edit;
          editBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            editHandler(folder);
          });
          pill.appendChild(editBtn);

          // Kliknięcie prawym przyciskiem myszy również otwiera edycję
          pill.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            editHandler(folder);
          });
        }

        // Wybór folderu
        pill.addEventListener('click', () => {
          if (selectHandler) {
            selectHandler(folder.id);
          }
        });

        container.appendChild(pill);
      });

      // Przycisk dodawania nowego folderu na końcu listy
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

      // Funkcja sprawdzająca konieczność pokazania strzałek przewijania
      const updateScrollButtons = () => {
        if (!container.clientWidth) return;
        const maxScroll = container.scrollWidth - container.clientWidth;
        btnLeft.classList.toggle('mf-visible', container.scrollLeft > 6);
        btnRight.classList.toggle('mf-visible', maxScroll > 6 && container.scrollLeft < maxScroll - 6);
      };

      // Obsługa kliknięć w przyciski przewijania
      btnLeft.addEventListener('click', () => {
        container.scrollBy({ left: -180, behavior: 'smooth' });
      });

      btnRight.addEventListener('click', () => {
        container.scrollBy({ left: 180, behavior: 'smooth' });
      });

      // Płynne przewijanie kółkiem myszy w poziomie
      container.addEventListener('wheel', (event) => {
        if (event.deltaY !== 0) {
          event.preventDefault();
          container.scrollLeft += event.deltaY * 0.8;
          updateScrollButtons();
        }
      }, { passive: false });

      container.addEventListener('scroll', updateScrollButtons, { passive: true });

      // Składanie struktury
      bar.appendChild(btnLeft);
      bar.appendChild(container);
      bar.appendChild(btnRight);

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
     * Wstrzykuje lub aktualizuje plakietkę folderu oraz przycisk akcji w wierszu rozmowy.
     *
     * @param {HTMLElement} rowElement - Wiersz rozmowy na liście
     * @param {string} threadId - Identyfikator wątku
     * @param {Object|null} currentFolder - Aktualnie przypisany folder lub null
     * @param {Function} onAssign - Callback po kliknięciu przypisania: (targetEl, threadId)
     */
    injectFolderBadge(rowElement, threadId, currentFolder, onAssign) {
      if (!rowElement) return;

      // 1. Obsługa plakietki folderu
      let badge = rowElement.querySelector('.mf-thread-badge');

      if (currentFolder && currentFolder.id !== 'all' && currentFolder.id !== 'uncategorized') {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'mf-thread-badge';
          badge.setAttribute('data-mf-badge', 'true');

          const titleElement = rowElement.querySelector('[role="heading"], span[dir="auto"], strong') || rowElement;
          titleElement.appendChild(badge);
        }

        const color = currentFolder.color || '#0084FF';
        if (badge.dataset.folderId !== currentFolder.id) {
          badge.dataset.folderId = currentFolder.id;
          badge.style.backgroundColor = `${color}20`;
          badge.style.color = color;
          badge.style.borderColor = `${color}45`;
          badge.title = `Folder: ${currentFolder.name} (kliknij, aby zmienić)`;

          badge.innerHTML = `
            <span class="mf-thread-badge-icon">${currentFolder.icon || '📁'}</span>
            <span class="mf-thread-badge-text">${currentFolder.name}</span>
          `;
        }

        badge.onclick = (event) => {
          event.stopPropagation();
          event.preventDefault();
          if (onAssign) onAssign(badge, threadId);
        };
      } else if (badge) {
        badge.remove();
      }

      // 2. Obsługa przycisku folderu w wierszu (pojawia się przy najechaniu)
      let actionBtn = rowElement.querySelector('.mf-folder-btn');
      if (!actionBtn) {
        actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'mf-folder-btn';
        actionBtn.setAttribute('data-mf-btn', 'true');
        actionBtn.title = currentFolder ? 'Zmień folder rozmowy' : 'Przypisz do folderu';
        actionBtn.setAttribute('aria-label', actionBtn.title);
        actionBtn.innerHTML = ICONS.folder;

        rowElement.style.position = rowElement.style.position || 'relative';
        rowElement.appendChild(actionBtn);
      }

      if (currentFolder && currentFolder.id !== 'all' && currentFolder.id !== 'uncategorized') {
        actionBtn.style.color = currentFolder.color || '#0084FF';
      } else {
        actionBtn.style.color = '';
      }

      actionBtn.onclick = (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (onAssign) onAssign(actionBtn, threadId);
      };

      // 3. Menu pod prawym przyciskiem myszy na wierszu rozmowy
      rowElement.oncontextmenu = (event) => {
        if (!event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          if (onAssign) onAssign(actionBtn || rowElement, threadId);
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
      const targetFolderId = currentFolder && currentFolder.id !== 'all' && currentFolder.id !== 'uncategorized'
        ? currentFolder.id
        : 'none';

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
     * @param {Function} options.onDelete - Callback usunięcia: (folderId) => void
     */
    showFolderModal({ folder = null, onSave, onDelete } = {}) {
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
      header.innerHTML = `
        <h2 class="mf-modal-title">${isEdit ? 'Edytuj folder' : 'Nowy folder'}</h2>
        <button type="button" class="mf-modal-close-btn" aria-label="Zamknij okno">
          ${ICONS.close}
        </button>
      `;

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
          emojiContainer.querySelectorAll('.mf-emoji-option').forEach(el => el.classList.remove('mf-selected'));
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
          colorContainer.querySelectorAll('.mf-color-option').forEach(el => el.classList.remove('mf-selected'));
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
        colorContainer.querySelectorAll('.mf-color-option').forEach(el => el.classList.remove('mf-selected'));
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
      cancelBtn.addEventListener('click', () => this.closeModal());

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
      const handleSave = () => {
        const trimmedName = nameInput.value.trim();
        if (!trimmedName) {
          nameInput.focus();
          nameInput.style.borderColor = 'var(--mf-danger)';
          return;
        }

        const folderData = {
          id: isEdit ? folder.id : this.generateId(),
          name: trimmedName,
          icon: selectedIcon,
          color: selectedColor
        };

        if (onSave) {
          onSave(folderData);
        }

        this.closeModal();
        this.showToast(isEdit ? 'Zapisano zmiany w folderze' : 'Utworzono nowy folder');
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
        unassignItem.className = `mf-dropdown-item mf-dropdown-unassign ${(!currentFolderId || currentFolderId === 'uncategorized') ? 'mf-selected' : ''}`;
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
        const selectableFolders = folders.filter(f => f.id !== 'all');
        const filtered = selectableFolders.filter(f => f.name.toLowerCase().includes(searchLower));

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

      const detected = this.detector.scanChatList();
      const folders = this.storage ? this.storage.getFoldersSync() : [];

      detected.forEach((item) => {
        const { threadId, rowElement } = item;
        const threadData = allThreads[threadId];
        const folderId = (threadData && threadData.folderId) ? threadData.folderId : 'uncategorized';
        const currentFolder = folders.find(f => f.id === folderId);

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
            }
          });
        });

        // Widoczność wiersza według aktywnego filtra
        const shouldBeVisible = (activeFolderId === 'all') || (folderId === activeFolderId);
        const targetDisplay = shouldBeVisible ? '' : 'none';
        if (rowElement.style.display !== targetDisplay) {
          rowElement.style.display = targetDisplay;
        }
      });

      // Aktualizacja pigułki w nagłówku otwartego czatu
      const openChat = this.detector.getCurrentOpenChat();
      if (openChat && openChat.threadId) {
        const doc = this.detector.doc || (typeof document !== 'undefined' ? document : null);
        if (doc) {
          const headerEl = doc.querySelector('[role="main"] header') ||
                           doc.querySelector('[role="main"] h2')?.parentElement;
          if (headerEl) {
            const openThreadData = allThreads[openChat.threadId];
            const openFolderId = (openThreadData && openThreadData.folderId) ? openThreadData.folderId : 'uncategorized';
            const openFolder = folders.find(f => f.id === openFolderId && f.id !== 'uncategorized');

            this.renderHeaderPill(headerEl, openFolder, (targetEl) => {
              this.showAssignDropdown(targetEl, openChat.threadId, folders, openFolderId, async (tId, newFolderId) => {
                if (this.storage) {
                  if (newFolderId) {
                    await this.storage.assignThread(tId, newFolderId, {
                      name: openChat.title,
                      avatar: openChat.avatar
                    });
                  } else {
                    await this.storage.removeThreadAssignment(tId);
                  }
                }
              });
            });
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
