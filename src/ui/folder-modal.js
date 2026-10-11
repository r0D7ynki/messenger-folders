/**
 * Messenger Folders - Komponent okna tworzenia i edycji folderu (FolderModalComponent)
 * Modal overlay (.mf-modal), nazwa z podglądem na żywo, emoji picker, paleta kolorów, selektor osób.
 */

(function (global) {
  'use strict';

  const Core =
    (typeof globalThis !== 'undefined' && globalThis.MessengerUICore) ||
    (typeof global !== 'undefined' && global.MessengerUICore) ||
    (typeof require === 'function' ? require('./core.js') : null);

  const DEFAULT_EMOJIS = Core
    ? Core.DEFAULT_EMOJIS
    : [
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

  const DEFAULT_COLORS = Core
    ? Core.DEFAULT_COLORS
    : ['#0084FF', '#00C6FF', '#00C853', '#FFAB00', '#FF3B30', '#AF52DE', '#5856D6', '#FF2D55', '#FF9500', '#64748B'];

  class FolderModalComponent {
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

    close() {
      if (this.ui && this.ui.activeModal) {
        this.ui.activeModal.remove();
        this.ui.activeModal = null;
      }
    }

    /**
     * Otwiera okno dialogowe tworzenia lub edycji folderu.
     *
     * @param {Object} options
     * @param {Object|null} options.folder - Obiekt folderu do edycji lub null dla nowego
     * @param {Function} options.onSave - Callback zapisu: ({ id, name, icon, color }) => void
     * @param {Function} [options.onDelete] - Callback usunięcia: (folderId) => void
     * @param {Function} [options.onBack] - Callback powrotu do poprzedniego widoku
     */
    show({ folder = null, onSave, onDelete, onBack = null } = {}) {
      this.close();

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
        this._setIcon(backBtn, 'arrowBack');
        backBtn.onclick = (e) => {
          e.stopPropagation();
          this.close();
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
      this._setIcon(closeBtn, 'close');
      closeBtn.onclick = () => this.close();

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
        <span class="mf-color-custom-icon"></span>
        <input type="color" class="mf-color-custom-input" value="${this._escapeHtml(selectedColor)}" />
      `;
      this._setIcon(customColorWrapper.querySelector('.mf-color-custom-icon'), 'palette');
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
      const savedThreads = this.ui && this.ui.storage ? this.ui.storage._threads || {} : {};
      const detected = this.ui && this.ui.detector ? this.ui.detector.scanChatList() : [];

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
          this._setButtonContent(toggleBtn, isAssigned ? 'check' : 'plus', isAssigned ? 'W folderze' : 'Dodaj');

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
        this._setButtonContent(deleteBtn, 'trash', 'Usuń');
        deleteBtn.title = 'Usuń ten folder';
        deleteBtn.addEventListener('click', () => {
          if (confirm(`Czy na pewno chcesz usunąć folder "${folder.name}"? Przypisane czaty nie zostaną usunięte.`)) {
            onDelete(folder.id);
            this.close();
            if (this.ui && typeof this.ui.showToast === 'function') {
              this.ui.showToast(`Usunięto folder "${folder.name}"`);
            }
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
        this.close();
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

      if (this.ui) {
        this.ui.activeModal = overlay;
      }

      // Obsługa podglądu na żywo
      const updatePreview = () => {
        liveIcon.textContent = selectedIcon;
        const text = nameInput.value.trim() || 'Nazwa folderu';
        liveName.textContent = text;
        livePill.style.setProperty('--mf-folder-color', selectedColor);
      };

      nameInput.addEventListener('input', updatePreview);
      updatePreview();

      setTimeout(() => nameInput.focus(), 50);

      // Zapis formularza
      const handleSave = async () => {
        const trimmedName = nameInput.value.trim();
        if (!trimmedName) {
          nameInput.focus();
          nameInput.style.borderColor = 'var(--mf-danger)';
          return;
        }

        const targetFolderId = isEdit
          ? folder.id
          : this.ui && typeof this.ui.generateId === 'function'
            ? this.ui.generateId()
            : Core
              ? Core.generateId()
              : 'f_' + Date.now().toString(36);

        const folderData = {
          id: targetFolderId,
          name: trimmedName,
          icon: selectedIcon,
          color: selectedColor
        };

        if (onSave) {
          onSave(folderData);
        }

        this.close();
        if (this.ui && typeof this.ui.showToast === 'function') {
          this.ui.showToast(isEdit ? 'Zapisano zmiany w folderze' : 'Utworzono nowy folder');
        }

        if (this.ui && this.ui.storage) {
          (async () => {
            for (const tId of assignedThreadIds) {
              const tInfo = threadsMap.get(tId);
              await this.ui.storage.assignThread(tId, targetFolderId, {
                name: tInfo ? tInfo.name : '',
                avatar: tInfo ? tInfo.avatar : ''
              });
            }

            if (isEdit) {
              for (const [tId, tData] of Object.entries(savedThreads)) {
                if (tData.folderId === targetFolderId && !assignedThreadIds.has(tId)) {
                  await this.ui.storage.removeThreadAssignment(tId);
                }
              }
            }

            const currentActive = await this.ui.storage.getActiveFolder();
            const currentThreads = await this.ui.storage.getAllThreads();
            if (typeof this.ui.filterChatRows === 'function') {
              this.ui.filterChatRows(currentActive, currentThreads);
            }
            const currentFolders = await this.ui.storage.getFolders();
            if (typeof this.ui.renderFolderBar === 'function') {
              this.ui.renderFolderBar(currentFolders, currentActive, currentThreads);
            }
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

      header.querySelector('.mf-modal-close-btn').addEventListener('click', () => this.close());
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          this.close();
        }
      });
    }
  }

  // Eksport globalny i modułowy
  if (typeof globalThis !== 'undefined') {
    globalThis.FolderModalComponent = FolderModalComponent;
    globalThis.MessengerUIFolderModal = FolderModalComponent;
  }
  if (typeof global !== 'undefined') {
    global.FolderModalComponent = FolderModalComponent;
    global.MessengerUIFolderModal = FolderModalComponent;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FolderModalComponent;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
