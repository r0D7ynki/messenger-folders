/**
 * Messenger Folders - Komponent okna ustawień (SettingsModalComponent)
 * Szerokie okno dialogowe (.mf-modal-wide) z 3 zakładkami (foldery, rozmowy, kopia zapasowa)
 * oraz punktem rozszerzenia dla reguł automatycznych (Milestone M4).
 */

(function (global) {
  'use strict';

  const Core =
    (typeof globalThis !== 'undefined' && globalThis.MessengerUICore) ||
    (typeof global !== 'undefined' && global.MessengerUICore) ||
    (typeof require === 'function' ? require('./core.js') : null);

  /**
   * Zwraca adres awatara dopuszczony przez MessengerFoldersStorage.sanitizeAvatarUrl
   * (host CDN Messengera/Facebooka albo data:image). Bez modułu pamięci — pusty tekst.
   * @param {*} url Adres awatara z pamięci lub DOM.
   * @returns {string}
   */
  function safeAvatarUrl(url) {
    const StorageClass = typeof globalThis !== 'undefined' ? globalThis.MessengerFoldersStorage : null;
    return StorageClass && typeof StorageClass.sanitizeAvatarUrl === 'function'
      ? StorageClass.sanitizeAvatarUrl(url)
      : '';
  }

  /**
   * Priorytet reguły w zakresie 0–100 (MessengerRulesEngine.normalizePriority), domyślnie 10.
   * @param {*} rawPriority Wartość z reguły albo pola formularza.
   * @returns {number}
   */
  function rulePriority(rawPriority) {
    return typeof MessengerRulesEngine !== 'undefined' && typeof MessengerRulesEngine.normalizePriority === 'function'
      ? MessengerRulesEngine.normalizePriority(rawPriority, 10)
      : 10;
  }

  class SettingsModalComponent {
    /**
     * @param {Object} [ui] Instancja fasady MessengerUI
     */
    constructor(ui) {
      this.ui = ui || null;
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

    _escapeHtml(str) {
      if (this.ui && typeof this.ui._escapeHtml === 'function') {
        return this.ui._escapeHtml(str);
      }
      if (Core && typeof Core.escapeHtml === 'function') {
        return Core.escapeHtml(str);
      }
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    close() {
      if (this.ui && this.ui.activeModal) {
        this.ui.activeModal.remove();
        this.ui.activeModal = null;
      }
    }

    /**
     * Otwiera okno dialogowe ustawień i zarządzania folderami.
     * @param {Object} [options]
     * @param {string} [options.defaultTab='folders'] Domyślnie aktywna zakładka
     */
    show(options = {}) {
      if (typeof document === 'undefined') return;

      this.close();

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
        <button type="button" class="mf-modal-close-btn" aria-label="Zamknij okno"></button>
      `;
      this._setIcon(header.querySelector('.mf-modal-close-btn'), 'close');

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

      // Punkt rozszerzenia M4: Jeśli silnik reguł jest obecny, dołącz 4. zakładkę
      if (this.ui && !this.ui.rulesEngine && typeof MessengerRulesEngine !== 'undefined') {
        this.ui.rulesEngine = new MessengerRulesEngine({ storage: this.ui.storage });
      }
      if (this.ui && this.ui.rulesEngine) {
        const rulesBtn = document.createElement('button');
        rulesBtn.type = 'button';
        rulesBtn.className = 'mf-settings-nav-btn';
        rulesBtn.dataset.tab = 'rules';
        rulesBtn.innerHTML = '<span>⚡ Reguły</span>';
        nav.appendChild(rulesBtn);
      }

      const body = document.createElement('div');
      body.className = 'mf-modal-body';

      const contentContainer = document.createElement('div');
      contentContainer.className = 'mf-settings-tab-content';

      const renderFoldersTab = () => {
        contentContainer.innerHTML = '';

        const folders = this.ui && this.ui.storage ? this.ui.storage.getFoldersSync() : [];
        const threads = this.ui && this.ui.storage ? this.ui.storage._threads || {} : {};

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
        this._setButtonContent(addBtn, 'plus', 'Nowy folder');
        addBtn.onclick = () => {
          if (this.ui && typeof this.ui.showFolderModal === 'function') {
            this.ui.showFolderModal({
              onSave: async (newFolder) => {
                if (this.ui.storage) await this.ui.storage.saveFolder(newFolder);
                this.show(options);
              },
              onBack: () => {
                this.show(options);
              }
            });
          }
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
            if (this.ui && typeof this.ui.showFolderModal === 'function') {
              this.ui.showFolderModal({
                folder,
                onSave: async (updated) => {
                  if (this.ui.storage) await this.ui.storage.saveFolder(updated);
                  this.show(options);
                },
                onDelete: async (fId) => {
                  if (this.ui.storage) await this.ui.storage.deleteFolder(fId);
                  this.show(options);
                },
                onBack: () => {
                  this.show(options);
                }
              });
            }
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
            this._setIcon(peopleBtn, 'users');
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
            this._setIcon(editBtn, 'edit');
            editBtn.onclick = openEditModal;
            actions.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'mf-settings-action-btn mf-btn-delete';
            deleteBtn.title = 'Usuń';
            this._setIcon(deleteBtn, 'trash');
            deleteBtn.onclick = async () => {
              const confirmMsg =
                typeof confirm !== 'undefined' ? confirm(`Czy na pewno chcesz usunąć folder „${folder.name}”?`) : true;
              if (confirmMsg) {
                if (this.ui && this.ui.storage) await this.ui.storage.deleteFolder(folder.id);
                if (this.ui && typeof this.ui.showToast === 'function') {
                  this.ui.showToast(`Usunięto folder „${folder.name}”.`);
                }
                this.show(options);
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
          if (this.ui && this.ui.storage) {
            const jsonStr = await this.ui.storage.exportData();
            if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
              const blob = new Blob([jsonStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `messenger-folders-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }
            if (this.ui && typeof this.ui.showToast === 'function') {
              this.ui.showToast('Pomyślnie wyeksportowano dane.');
            }
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
                if (this.ui && this.ui.storage) {
                  await this.ui.storage.importData(event.target.result);
                  if (this.ui && typeof this.ui.showToast === 'function') {
                    this.ui.showToast('Pomyślnie zaimportowano dane.');
                  }
                  this.show(options);
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

        const folders = this.ui && this.ui.storage ? this.ui.storage.getFoldersSync() : [];
        const savedThreads = this.ui && this.ui.storage ? this.ui.storage._threads || {} : {};
        const detected = this.ui && this.ui.detector ? this.ui.detector.scanChatList() : [];

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

            const avatarUrl = safeAvatarUrl(thread.avatar);
            if (avatarUrl) {
              const img = document.createElement('img');
              img.className = 'mf-settings-thread-avatar';
              img.src = avatarUrl;
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
              if (this.ui && this.ui.storage) {
                if (newFId) {
                  await this.ui.storage.assignThread(thread.id, newFId, {
                    name: thread.name,
                    avatar: thread.avatar
                  });
                } else {
                  await this.ui.storage.removeThreadAssignment(thread.id);
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
              }
              const targetFolder = folders.find((f) => f.id === select.value);
              if (this.ui && typeof this.ui.showToast === 'function') {
                this.ui.showToast(
                  targetFolder ? `Przypisano do folderu "${targetFolder.name}"` : 'Usunięto przypisanie do folderu'
                );
              }
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

      const openRuleEditor = (ruleToEdit = null) => {
        const editorOverlay = document.createElement('div');
        editorOverlay.className = 'mf-modal-overlay';
        editorOverlay.setAttribute('data-mf-modal-overlay', 'true');
        editorOverlay.setAttribute('role', 'dialog');
        editorOverlay.setAttribute('aria-modal', 'true');

        const editorModal = document.createElement('div');
        editorModal.className = 'mf-modal';
        editorModal.setAttribute('data-mf-modal', 'true');
        editorModal.style.maxWidth = '520px';

        const editorHeader = document.createElement('div');
        editorHeader.className = 'mf-modal-header';
        const editorTitle = document.createElement('h2');
        editorTitle.className = 'mf-modal-title';
        editorTitle.textContent = ruleToEdit ? 'Edytuj regułę' : 'Nowa reguła';
        const editorCloseBtn = document.createElement('button');
        editorCloseBtn.type = 'button';
        editorCloseBtn.className = 'mf-modal-close-btn';
        editorCloseBtn.setAttribute('aria-label', 'Zamknij edytor reguły');
        this._setIcon(editorCloseBtn, 'close');
        editorHeader.appendChild(editorTitle);
        editorHeader.appendChild(editorCloseBtn);

        const editorBody = document.createElement('div');
        editorBody.className = 'mf-modal-body';

        // 1. Nazwa reguły
        const nameGroup = document.createElement('div');
        nameGroup.className = 'mf-form-group';
        nameGroup.style.marginBottom = '12px';
        const nameLabel = document.createElement('label');
        nameLabel.className = 'mf-form-label';
        nameLabel.style.display = 'block';
        nameLabel.style.marginBottom = '4px';
        nameLabel.style.fontWeight = '600';
        nameLabel.style.fontSize = '13px';
        nameLabel.textContent = 'Nazwa reguły';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'mf-rule-name-input';
        nameInput.className = 'mf-modal-input';
        nameInput.placeholder = 'np. Projekty firmowe';
        nameInput.value = ruleToEdit ? ruleToEdit.name : '';
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);
        editorBody.appendChild(nameGroup);

        // 2. Folder docelowy
        const folderGroup = document.createElement('div');
        folderGroup.className = 'mf-form-group';
        folderGroup.style.marginBottom = '12px';
        const folderLabel = document.createElement('label');
        folderLabel.className = 'mf-form-label';
        folderLabel.style.display = 'block';
        folderLabel.style.marginBottom = '4px';
        folderLabel.style.fontWeight = '600';
        folderLabel.style.fontSize = '13px';
        folderLabel.textContent = 'Folder docelowy';
        const folderSelect = document.createElement('select');
        folderSelect.id = 'mf-rule-folder-select';
        folderSelect.className = 'mf-modal-input';

        // „Wszystkie” i „Inne” nie są folderami docelowymi: wątek bez folderu i tak trafia do „Inne”
        const folders = this.ui && this.ui.storage ? this.ui.storage.getFoldersSync() : [];
        const targetFolders = folders.filter((f) => f.id !== 'all' && f.id !== 'uncategorized');
        // Reguła z usuniętym folderem nie dostaje po cichu pierwszej opcji — trzeba wybrać folder
        if (ruleToEdit && !targetFolders.some((f) => f.id === ruleToEdit.folderId)) {
          const optMissing = document.createElement('option');
          optMissing.value = '';
          optMissing.textContent = '— wybierz folder (poprzedni nie istnieje) —';
          optMissing.selected = true;
          folderSelect.appendChild(optMissing);
        }
        targetFolders.forEach((f) => {
          const opt = document.createElement('option');
          opt.value = f.id;
          opt.textContent = `${f.icon || '📁'} ${f.name}`;
          if (ruleToEdit && ruleToEdit.folderId === f.id) {
            opt.selected = true;
          }
          folderSelect.appendChild(opt);
        });
        folderGroup.appendChild(folderLabel);
        folderGroup.appendChild(folderSelect);
        editorBody.appendChild(folderGroup);

        // 3. Priorytet i Tryb dopasowywania
        const rowGroup = document.createElement('div');
        rowGroup.style.display = 'flex';
        rowGroup.style.gap = '12px';
        rowGroup.style.marginBottom = '12px';

        const priorityCol = document.createElement('div');
        priorityCol.style.flex = '1';
        const priorityLabel = document.createElement('label');
        priorityLabel.className = 'mf-form-label';
        priorityLabel.style.display = 'block';
        priorityLabel.style.marginBottom = '4px';
        priorityLabel.style.fontWeight = '600';
        priorityLabel.style.fontSize = '13px';
        priorityLabel.textContent = 'Priorytet';
        const priorityInput = document.createElement('input');
        priorityInput.type = 'number';
        priorityInput.id = 'mf-rule-priority-input';
        priorityInput.className = 'mf-modal-input';
        priorityInput.min = '0';
        priorityInput.max = '100';
        priorityInput.value = String(rulePriority(ruleToEdit ? ruleToEdit.priority : undefined));

        priorityCol.appendChild(priorityLabel);
        priorityCol.appendChild(priorityInput);

        const modeCol = document.createElement('div');
        modeCol.style.flex = '1';
        const modeLabel = document.createElement('label');
        modeLabel.className = 'mf-form-label';
        modeLabel.style.display = 'block';
        modeLabel.style.marginBottom = '4px';
        modeLabel.style.fontWeight = '600';
        modeLabel.style.fontSize = '13px';
        modeLabel.textContent = 'Dopasowanie warunków';
        const modeSelect = document.createElement('select');
        modeSelect.id = 'mf-rule-match-mode';
        modeSelect.className = 'mf-modal-input';
        const optAll = document.createElement('option');
        optAll.value = 'all';
        optAll.textContent = 'Wszystkie (AND)';
        const optAny = document.createElement('option');
        optAny.value = 'any';
        optAny.textContent = 'Dowolny (OR)';
        if (ruleToEdit && ruleToEdit.matchMode === 'any') {
          optAny.selected = true;
        } else {
          optAll.selected = true;
        }
        modeSelect.appendChild(optAll);
        modeSelect.appendChild(optAny);
        modeCol.appendChild(modeLabel);
        modeCol.appendChild(modeSelect);

        rowGroup.appendChild(priorityCol);
        rowGroup.appendChild(modeCol);
        editorBody.appendChild(rowGroup);

        // 4. Kreator warunków
        const condGroup = document.createElement('div');
        condGroup.style.marginBottom = '12px';
        const condHeader = document.createElement('div');
        condHeader.style.display = 'flex';
        condHeader.style.justifyContent = 'space-between';
        condHeader.style.alignItems = 'center';
        condHeader.style.marginBottom = '6px';
        const condLabel = document.createElement('label');
        condLabel.className = 'mf-form-label';
        condLabel.style.fontWeight = '600';
        condLabel.style.fontSize = '13px';
        condLabel.textContent = 'Warunki dopasowania';
        const addCondBtn = document.createElement('button');
        addCondBtn.type = 'button';
        addCondBtn.className = 'mf-btn mf-btn-secondary';
        addCondBtn.style.padding = '2px 8px';
        addCondBtn.style.fontSize = '12px';
        addCondBtn.textContent = '+ Dodaj warunek';
        condHeader.appendChild(condLabel);
        condHeader.appendChild(addCondBtn);
        condGroup.appendChild(condHeader);

        const condContainer = document.createElement('div');
        condContainer.className = 'mf-rule-conditions-container';
        condGroup.appendChild(condContainer);
        editorBody.appendChild(condGroup);

        // 5. Checkbox nadpisywania ręcznego
        const owGroup = document.createElement('div');
        owGroup.style.marginBottom = '12px';
        const owLabel = document.createElement('label');
        owLabel.style.display = 'flex';
        owLabel.style.alignItems = 'center';
        owLabel.style.gap = '8px';
        owLabel.style.cursor = 'pointer';
        owLabel.style.fontSize = '13px';
        owLabel.style.color = 'var(--mf-text-primary)';
        const owCheckbox = document.createElement('input');
        owCheckbox.type = 'checkbox';
        owCheckbox.id = 'mf-rule-overwrite-manual';
        owCheckbox.checked = ruleToEdit ? Boolean(ruleToEdit.overwriteManual) : false;
        const owText = document.createElement('span');
        owText.textContent = 'Nadpisuj wcześniejsze ręczne przypisania';
        owLabel.appendChild(owCheckbox);
        owLabel.appendChild(owText);
        owGroup.appendChild(owLabel);
        editorBody.appendChild(owGroup);

        // 6. Podgląd na żywo (Live dry-run counter)
        const previewBox = document.createElement('div');
        previewBox.className = 'mf-rule-dry-run-preview';
        previewBox.style.padding = '8px 12px';
        previewBox.style.background = 'var(--mf-bg-wash)';
        previewBox.style.borderRadius = '6px';
        previewBox.style.fontSize = '12px';
        previewBox.style.color = 'var(--mf-text-secondary)';
        previewBox.style.marginBottom = '12px';
        previewBox.textContent = 'Liczba pasujących czatów: 0';
        editorBody.appendChild(previewBox);

        // Funkcja aktualizacji podglądu na żywo
        const updateDryRun = () => {
          const currentConditions = [];
          condContainer.querySelectorAll('.mf-rule-condition-row').forEach((r) => {
            const f = r.querySelector('.mf-rule-condition-field')?.value || 'name';
            const o = r.querySelector('.mf-rule-condition-op')?.value || 'contains';
            const v = r.querySelector('.mf-rule-condition-val')?.value || '';
            if (v.trim()) {
              currentConditions.push({ field: f, operator: o, value: v });
            }
          });

          if (currentConditions.length === 0) {
            previewBox.textContent = 'Liczba pasujących czatów: 0';
            return;
          }

          const savedThreads = (this.ui && this.ui.storage && this.ui.storage._threads) || {};
          let threadsToCheck = [];
          if (this.ui && this.ui.detector && typeof this.ui.detector.scanChatList === 'function') {
            threadsToCheck = this.ui.detector.scanChatList() || [];
          }
          if (!threadsToCheck || threadsToCheck.length === 0) {
            threadsToCheck = Object.entries(savedThreads).map(([tId, tData]) => ({
              threadId: tId,
              name: tData.name || '',
              avatar: tData.avatar || ''
            }));
          }

          const engine =
            (this.ui && this.ui.rulesEngine) ||
            (typeof MessengerRulesEngine !== 'undefined' ? new MessengerRulesEngine() : null);
          if (!engine) {
            previewBox.textContent = 'Liczba pasujących czatów: 0';
            return;
          }

          // Podgląd liczy jak silnik (evaluateThread), łącznie z ochroną ręcznych przypisań (overwriteManual)
          const previewRule = {
            enabled: true,
            folderId: folderSelect.value || 'mf_preview',
            matchMode: modeSelect.value || 'all',
            conditions: currentConditions,
            overwriteManual: Boolean(owCheckbox.checked)
          };
          let matchesCount = 0;
          for (const th of threadsToCheck) {
            if (!th || !th.threadId) continue;
            const existing = savedThreads[th.threadId];
            const threadToEval = {
              ...th,
              folderId: existing ? existing.folderId : undefined,
              isManual: Boolean(
                existing && existing.folderId && existing.folderId !== 'uncategorized' && !existing.autoAssigned
              )
            };
            if (engine.evaluateThread(threadToEval, [previewRule])) matchesCount++;
          }

          previewBox.textContent = `Liczba pasujących czatów: ${matchesCount}`;
        };

        /**
         * Sprawdza wzorzec RegEx silnikiem reguł (składnia, ryzyko ReDoS).
         * @param {string} pattern Wzorzec z pola warunku.
         * @returns {string|null} Komunikat błędu albo null.
         */
        const validateRegex = (pattern) => {
          const engine = this.ui && this.ui.rulesEngine;
          if (engine && typeof engine.validateRegexPattern === 'function') {
            return engine.validateRegexPattern(pattern);
          }
          if (typeof MessengerRulesEngine !== 'undefined' && MessengerRulesEngine.validateRegexPattern) {
            return MessengerRulesEngine.validateRegexPattern(pattern);
          }
          return null;
        };

        // Komunikat błędu warunku wyświetlany bezpośrednio pod jego wierszem
        const clearConditionError = (row) => {
          if (row.mfErrorEl) {
            row.mfErrorEl.remove();
            row.mfErrorEl = null;
          }
        };
        const showConditionError = (row, message) => {
          const errorEl = document.createElement('div');
          errorEl.className = 'mf-rule-condition-error';
          errorEl.setAttribute('role', 'alert');
          errorEl.style.color = 'var(--mf-danger)';
          errorEl.style.fontSize = '12px';
          errorEl.style.margin = '-4px 0 8px';
          errorEl.textContent = message;
          if (typeof row.after === 'function') {
            row.after(errorEl);
          } else {
            condContainer.appendChild(errorEl);
          }
          row.mfErrorEl = errorEl;
        };

        // Funkcja dodawania wiersza warunku
        const addConditionRow = (initialData = null) => {
          const row = document.createElement('div');
          row.className = 'mf-rule-condition-row';
          row.style.display = 'flex';
          row.style.gap = '6px';
          row.style.marginBottom = '8px';
          row.style.alignItems = 'center';

          const fieldSel = document.createElement('select');
          fieldSel.className = 'mf-modal-input mf-rule-condition-field';
          fieldSel.style.flex = '1.2';
          const optName = document.createElement('option');
          optName.value = 'name';
          optName.textContent = 'Nazwa czatu';
          const optId = document.createElement('option');
          optId.value = 'threadId';
          optId.textContent = 'ID wątku';
          fieldSel.appendChild(optName);
          fieldSel.appendChild(optId);
          if (initialData && initialData.field === 'threadId') optId.selected = true;

          const opSel = document.createElement('select');
          opSel.className = 'mf-modal-input mf-rule-condition-op';
          opSel.style.flex = '1.4';
          const ops = [
            { val: 'contains', label: 'Zawiera' },
            { val: 'startsWith', label: 'Zaczyna się od' },
            { val: 'endsWith', label: 'Kończy się na' },
            { val: 'exact', label: 'Dokładne' },
            { val: 'regex', label: 'Wyrażenie (RegEx)' }
          ];
          ops.forEach((o) => {
            const opt = document.createElement('option');
            opt.value = o.val;
            opt.textContent = o.label;
            if (
              initialData &&
              (initialData.operator === o.val || (o.val === 'exact' && initialData.operator === 'equals'))
            ) {
              opt.selected = true;
            }
            opSel.appendChild(opt);
          });

          const valInp = document.createElement('input');
          valInp.type = 'text';
          valInp.className = 'mf-modal-input mf-rule-condition-val';
          valInp.style.flex = '2';
          valInp.placeholder = 'Wartość wzorca...';
          valInp.value = initialData ? initialData.value || '' : '';

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'mf-settings-action-btn mf-btn-delete mf-rule-condition-remove-btn';
          removeBtn.title = 'Usuń warunek';
          this._setIcon(removeBtn, 'trash');
          removeBtn.onclick = () => {
            if (condContainer.querySelectorAll('.mf-rule-condition-row').length > 1) {
              clearConditionError(row);
              row.remove();
              updateDryRun();
            }
          };

          fieldSel.onchange = updateDryRun;
          opSel.onchange = () => {
            clearConditionError(row);
            valInp.style.borderColor = '';
            updateDryRun();
          };
          valInp.oninput = () => {
            clearConditionError(row);
            valInp.style.borderColor = '';
            updateDryRun();
          };

          row.appendChild(fieldSel);
          row.appendChild(opSel);
          row.appendChild(valInp);
          row.appendChild(removeBtn);
          condContainer.appendChild(row);
          updateDryRun();
        };

        addCondBtn.onclick = () => addConditionRow();

        if (ruleToEdit && Array.isArray(ruleToEdit.conditions) && ruleToEdit.conditions.length > 0) {
          ruleToEdit.conditions.forEach((c) => addConditionRow(c));
        } else {
          addConditionRow();
        }

        modeSelect.onchange = updateDryRun;
        folderSelect.onchange = updateDryRun;
        owCheckbox.onchange = updateDryRun;

        // Stopka
        const editorFooter = document.createElement('div');
        editorFooter.className = 'mf-modal-footer';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'mf-btn mf-btn-secondary';
        cancelBtn.textContent = 'Anuluj';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'mf-btn mf-btn-primary';
        saveBtn.textContent = 'Zapisz regułę';
        editorFooter.appendChild(cancelBtn);
        editorFooter.appendChild(saveBtn);

        const closeEditor = () => editorOverlay.remove();
        editorCloseBtn.onclick = closeEditor;
        cancelBtn.onclick = closeEditor;
        editorOverlay.onclick = (e) => {
          if (e.target === editorOverlay) closeEditor();
        };

        const saveRule = async () => {
          const ruleName = nameInput.value.trim();
          if (!ruleName) {
            nameInput.style.borderColor = 'var(--mf-danger)';
            nameInput.focus();
            return;
          }

          const targetFolderId = folderSelect.value;
          if (!targetFolderId || targetFolderId === 'all') {
            folderSelect.style.borderColor = 'var(--mf-danger)';
            folderSelect.focus();
            return;
          }

          const conditions = [];
          let invalidRegexInput = null;
          condContainer.querySelectorAll('.mf-rule-condition-row').forEach((r) => {
            const f = r.querySelector('.mf-rule-condition-field')?.value || 'name';
            const o = r.querySelector('.mf-rule-condition-op')?.value || 'contains';
            const valEl = r.querySelector('.mf-rule-condition-val');
            const v = valEl?.value || '';
            clearConditionError(r);
            if (v.trim()) {
              conditions.push({ field: f, operator: o, value: v });
              const regexError = o === 'regex' ? validateRegex(v) : null;
              if (regexError) {
                showConditionError(r, `Wyrażenie RegEx odrzucone: ${regexError}`);
                if (valEl) valEl.style.borderColor = 'var(--mf-danger)';
                invalidRegexInput = invalidRegexInput || valEl;
              }
            }
          });

          // Wzorce grożące zawieszeniem karty (ReDoS) lub błędne składniowo — nie zapisujemy reguły
          if (invalidRegexInput) {
            invalidRegexInput.focus();
            return;
          }

          if (conditions.length === 0) {
            const firstVal = condContainer.querySelector('.mf-rule-condition-val');
            if (firstVal) {
              firstVal.style.borderColor = 'var(--mf-danger)';
              firstVal.focus();
            }
            return;
          }

          const ruleData = {
            id: ruleToEdit ? ruleToEdit.id : undefined,
            name: ruleName,
            folderId: targetFolderId,
            priority: rulePriority(priorityInput.value),
            matchMode: modeSelect.value || 'all',
            conditions,
            overwriteManual: Boolean(owCheckbox.checked),
            enabled: ruleToEdit ? ruleToEdit.enabled !== false : true
          };

          if (this.ui && this.ui.rulesEngine) {
            try {
              await this.ui.rulesEngine.saveRule(ruleData);
            } catch (err) {
              if (typeof this.ui.showToast === 'function') {
                this.ui.showToast(`Nie zapisano reguły: ${err && err.message ? err.message : err}`);
              }
              return;
            }
            if (typeof this.ui.onRulesChanged === 'function') {
              await this.ui.onRulesChanged();
            }
          }

          closeEditor();
          if (this.ui && typeof this.ui.showToast === 'function') {
            this.ui.showToast(ruleToEdit ? 'Zaktualizowano regułę' : 'Utworzono nową regułę');
          }
          renderRulesTab();
        };

        saveBtn.onclick = async () => {
          try {
            await saveRule();
          } catch (err) {
            console.error('Błąd podczas zapisywania reguły:', err);
            if (this.ui && typeof this.ui.showToast === 'function') {
              this.ui.showToast(`Błąd podczas zapisywania reguły: ${err && err.message ? err.message : err}`);
            }
          }
        };

        editorModal.appendChild(editorHeader);
        editorModal.appendChild(editorBody);
        editorModal.appendChild(editorFooter);
        editorOverlay.appendChild(editorModal);
        document.body.appendChild(editorOverlay);
        setTimeout(() => {
          if (
            typeof document !== 'undefined' &&
            (document.activeElement === editorOverlay ||
              document.activeElement === editorModal ||
              !editorModal.contains(document.activeElement))
          ) {
            nameInput.focus();
          }
        }, 50);
      };

      const renderRulesTab = async () => {
        contentContainer.innerHTML = '';

        if (!this.ui.rulesEngine && typeof MessengerRulesEngine !== 'undefined') {
          this.ui.rulesEngine = new MessengerRulesEngine({ storage: this.ui.storage });
        }

        const topActions = document.createElement('div');
        topActions.style.marginBottom = '12px';
        topActions.style.display = 'flex';
        topActions.style.justifyContent = 'space-between';
        topActions.style.alignItems = 'center';

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.id = 'mf-rules-add-btn';
        addBtn.className = 'mf-btn mf-btn-primary';
        this._setButtonContent(addBtn, 'plus', 'Nowa reguła');
        addBtn.onclick = () => openRuleEditor(null);
        topActions.appendChild(addBtn);
        contentContainer.appendChild(topActions);

        const list = document.createElement('div');
        list.className = 'mf-settings-rules-list';
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '8px';
        contentContainer.appendChild(list);

        let rules = [];
        if (this.ui && this.ui.rulesEngine) {
          rules = await this.ui.rulesEngine.getRules();
        }

        const folders = this.ui && this.ui.storage ? this.ui.storage.getFoldersSync() : [];
        const foldersMap = new Map(folders.map((f) => [f.id, f]));

        if (!rules || rules.length === 0) {
          const emptyEl = document.createElement('div');
          emptyEl.className = 'mf-settings-empty';
          emptyEl.textContent =
            'Brak skonfigurowanych reguł. Kliknij „Nowa reguła”, aby utworzyć pierwszą regułę automatycznego przypisywania czatów do folderów.';
          list.appendChild(emptyEl);
          return;
        }

        rules.forEach((rule) => {
          const item = document.createElement('div');
          item.className = 'mf-settings-folder-item mf-settings-rule-item';

          const info = document.createElement('div');
          info.className = 'mf-settings-folder-info';

          const toggleLabel = document.createElement('label');
          toggleLabel.style.display = 'inline-flex';
          toggleLabel.style.alignItems = 'center';
          toggleLabel.style.cursor = 'pointer';
          toggleLabel.style.marginRight = '4px';
          const toggleInput = document.createElement('input');
          toggleInput.type = 'checkbox';
          toggleInput.className = 'mf-rule-toggle-input';
          toggleInput.checked = rule.enabled !== false;
          toggleInput.title = rule.enabled !== false ? 'Włączona' : 'Wyłączona';
          toggleInput.onchange = async () => {
            if (this.ui && this.ui.rulesEngine) {
              await this.ui.rulesEngine.toggleRule(rule.id, toggleInput.checked);
              if (typeof this.ui.onRulesChanged === 'function') {
                await this.ui.onRulesChanged();
              }
              if (typeof this.ui.showToast === 'function') {
                this.ui.showToast(toggleInput.checked ? 'Włączono regułę' : 'Wyłączono regułę');
              }
            }
          };
          toggleLabel.appendChild(toggleInput);
          info.appendChild(toggleLabel);

          const targetFolder = foldersMap.get(rule.folderId);
          const iconSpan = document.createElement('span');
          iconSpan.className = 'mf-settings-folder-icon';
          iconSpan.textContent = targetFolder?.icon || '📁';
          info.appendChild(iconSpan);

          const details = document.createElement('div');
          details.className = 'mf-settings-folder-details';

          const titleSpan = document.createElement('span');
          titleSpan.className = 'mf-settings-folder-name';
          titleSpan.textContent = rule.name;

          const descSpan = document.createElement('span');
          descSpan.className = 'mf-settings-folder-count';
          const condSummary = (rule.conditions || [])
            .map((c) => `${c.field === 'threadId' ? 'ID' : 'Nazwa'} ${c.operator} "${c.value}"`)
            .join(', ');
          descSpan.textContent = `Priorytet ${rule.priority} · Folder: ${targetFolder?.name || rule.folderId} · ${condSummary}`;

          details.appendChild(titleSpan);
          details.appendChild(descSpan);

          // Reguła, której silnik nie wykona (np. RegEx sprzed budżetu nawrotów), dostaje widoczny powód
          const problem =
            typeof MessengerRulesEngine !== 'undefined' &&
            typeof MessengerRulesEngine.describeRuleProblem === 'function'
              ? MessengerRulesEngine.describeRuleProblem(rule, folders)
              : null;
          if (problem) {
            item.classList.add('mf-rule-inactive');
            const problemSpan = document.createElement('span');
            problemSpan.className = 'mf-rule-problem';
            problemSpan.style.color = 'var(--mf-danger)';
            problemSpan.style.fontSize = '12px';
            problemSpan.textContent = `Nieaktywna: ${problem}`;
            details.appendChild(problemSpan);
          }
          info.appendChild(details);
          item.appendChild(info);

          const actions = document.createElement('div');
          actions.className = 'mf-settings-folder-actions';

          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'mf-settings-action-btn';
          editBtn.title = 'Edytuj regułę';
          this._setIcon(editBtn, 'edit');
          editBtn.onclick = () => openRuleEditor(rule);
          actions.appendChild(editBtn);

          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className = 'mf-settings-action-btn mf-btn-delete';
          deleteBtn.title = 'Usuń regułę';
          this._setIcon(deleteBtn, 'trash');
          deleteBtn.onclick = async () => {
            const confirmMsg =
              typeof confirm !== 'undefined' ? confirm(`Czy na pewno chcesz usunąć regułę „${rule.name}”?`) : true;
            if (confirmMsg && this.ui && this.ui.rulesEngine) {
              await this.ui.rulesEngine.deleteRule(rule.id);
              if (typeof this.ui.onRulesChanged === 'function') {
                await this.ui.onRulesChanged();
              }
              if (typeof this.ui.showToast === 'function') {
                this.ui.showToast(`Usunięto regułę „${rule.name}”.`);
              }
              renderRulesTab();
            }
          };
          actions.appendChild(deleteBtn);

          item.appendChild(actions);
          list.appendChild(item);
        });
      };

      nav.querySelectorAll('.mf-settings-nav-btn').forEach((btn) => {
        btn.onclick = () => {
          nav.querySelectorAll('.mf-settings-nav-btn').forEach((b) => b.classList.remove('mf-active'));
          btn.classList.add('mf-active');
          if (btn.dataset.tab === 'folders') {
            renderFoldersTab();
          } else if (btn.dataset.tab === 'threads') {
            renderThreadsTab();
          } else if (btn.dataset.tab === 'rules') {
            renderRulesTab();
          } else {
            renderBackupTab();
          }
        };
      });

      const activeTab = options && options.defaultTab ? options.defaultTab : 'folders';
      if (activeTab === 'threads') {
        nav.querySelectorAll('.mf-settings-nav-btn').forEach((b) => {
          b.classList.toggle('mf-active', b.dataset.tab === 'threads');
        });
        renderThreadsTab();
      } else if (activeTab === 'backup') {
        nav.querySelectorAll('.mf-settings-nav-btn').forEach((b) => {
          b.classList.toggle('mf-active', b.dataset.tab === 'backup');
        });
        renderBackupTab();
      } else if (activeTab === 'rules' && this.ui && this.ui.rulesEngine) {
        nav.querySelectorAll('.mf-settings-nav-btn').forEach((b) => {
          b.classList.toggle('mf-active', b.dataset.tab === 'rules');
        });
        renderRulesTab();
      } else {
        renderFoldersTab();
      }

      body.appendChild(contentContainer);

      const footer = document.createElement('div');
      footer.className = 'mf-modal-footer';
      footer.innerHTML = `
        <button type="button" class="mf-btn mf-btn-secondary" id="mf-btn-close-settings">Zamknij</button>
      `;

      const closeAction = () => this.close();
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
      if (this.ui) {
        this.ui.activeModal = overlay;
      }
    }
  }

  // Eksport globalny i modułowy
  if (typeof globalThis !== 'undefined') {
    globalThis.SettingsModalComponent = SettingsModalComponent;
    globalThis.MessengerUISettingsModal = SettingsModalComponent;
  }
  if (typeof global !== 'undefined') {
    global.SettingsModalComponent = SettingsModalComponent;
    global.MessengerUISettingsModal = SettingsModalComponent;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsModalComponent;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
