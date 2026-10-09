/**
 * Messenger Folders - Logika panelu popup rozszerzenia
 * Zgodność ze standardem PN-ISO 24495-1 (Prosta Polszczyzna)
 * Zarządzanie folderami, ustawieniami, kopiami zapasowymi oraz integracja ze storage.
 */

(function () {
  'use strict';

  // Domyślny zestaw danych startowych
  const INITIAL_FOLDERS = [
    { id: 'f_work', name: 'Praca', icon: '💼', color: '#0084FF' },
    { id: 'f_friends', name: 'Znajomi', icon: '👥', color: '#00C853' },
    { id: 'f_important', name: 'Ważne', icon: '⭐', color: '#FFAB00' },
    { id: 'f_projects', name: 'Projekty', icon: '🚀', color: '#AF52DE' }
  ];

  const INITIAL_SETTINGS = {
    hideEmptyFolders: false,
    enableAnimations: true,
    showBadges: true,
    headerPill: true
  };

  const EMOJI_LIST = [
    '📁', '💼', '👥', '⭐', '💡', '🏷️', '🛒', '📌',
    '🎯', '🔒', '💬', '🚀', '❤️', '🔔', '🎮', '🏠',
    '📚', '🎨', '🛠️', '✈️', '🎵', '🔥', '💻', '🤝'
  ];

  const COLOR_LIST = [
    '#0084FF', '#00C6FF', '#00C853', '#FFAB00',
    '#FF3B30', '#AF52DE', '#5856D6', '#FF2D55',
    '#FF9500', '#64748B'
  ];

  // Moduł przechowywania danych (Chrome Storage z fallbackiem do localStorage)
  const Storage = {
    async get(keys) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
      }
      const result = {};
      Object.keys(keys).forEach((key) => {
        const item = localStorage.getItem('mf_' + key);
        result[key] = item !== null ? JSON.parse(item) : keys[key];
      });
      return result;
    },

    async set(items) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        return new Promise((resolve) => chrome.storage.sync.set(items, resolve));
      }
      Object.entries(items).forEach(([k, v]) => {
        localStorage.setItem('mf_' + k, JSON.stringify(v));
      });
    }
  };

  // Stan aplikacji panelu
  const state = {
    folders: [],
    assignments: {},
    settings: { ...INITIAL_SETTINGS },
    currentEditId: null,
    selectedEmoji: '📁',
    selectedColor: COLOR_LIST[0]
  };

  // Elementy interfejsu
  const dom = {
    tabs: document.querySelectorAll('.mf-nav-tab'),
    panels: document.querySelectorAll('.mf-tab-panel'),
    folderList: document.getElementById('mf-folder-list'),
    folderTotal: document.getElementById('mf-folders-total'),
    foldersEmpty: document.getElementById('mf-folders-empty'),
    btnOpenCreate: document.getElementById('mf-btn-open-create'),

    // Ustawienia
    optHideEmpty: document.getElementById('mf-opt-hide-empty'),
    optAnimations: document.getElementById('mf-opt-enable-animations'),
    optBadges: document.getElementById('mf-opt-show-badges'),
    optHeaderPill: document.getElementById('mf-opt-header-pill'),

    // Kopia zapasowa
    btnExport: document.getElementById('mf-btn-export'),
    btnImportTrigger: document.getElementById('mf-btn-import-trigger'),
    fileImport: document.getElementById('mf-file-import'),

    // Toast
    toast: document.getElementById('mf-popup-toast'),

    // Dialog edycji / tworzenia
    dialogOverlay: document.getElementById('mf-dialog-overlay'),
    dialogTitle: document.getElementById('mf-dialog-title'),
    dialogInputName: document.getElementById('mf-dialog-input-name'),
    dialogEmojis: document.getElementById('mf-dialog-emojis'),
    dialogColors: document.getElementById('mf-dialog-colors'),
    dialogPreviewPill: document.getElementById('mf-dialog-preview-pill'),
    dialogPreviewIcon: document.querySelector('.mf-dialog-preview-icon'),
    dialogPreviewName: document.querySelector('.mf-dialog-preview-name'),
    dialogBtnCancel: document.getElementById('mf-dialog-btn-cancel'),
    dialogBtnSave: document.getElementById('mf-dialog-btn-save'),
    dialogClose: document.getElementById('mf-dialog-close')
  };

  /**
   * Formatowanie odmiany słowa "rozmowa" w języku polskim
   */
  function formatChatCount(count) {
    if (count === 1) return '1 rozmowa';
    const lastDigit = count % 10;
    const lastTwo = count % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
      return `${count} rozmowy`;
    }
    return `${count} rozmów`;
  }

  /**
   * Wyświetlenie dymku powiadomienia
   */
  let toastTimer = null;
  function showToast(message) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add('mf-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.classList.remove('mf-show');
    }, 2400);
  }

  /**
   * Inicjalizacja danych z pamięci
   */
  async function init() {
    const data = await Storage.get({
      folders: INITIAL_FOLDERS,
      assignments: {},
      settings: INITIAL_SETTINGS
    });

    state.folders = data.folders || INITIAL_FOLDERS;
    state.assignments = data.assignments || {};
    state.settings = { ...INITIAL_SETTINGS, ...(data.settings || {}) };

    setupTabs();
    setupSettings();
    setupBackup();
    setupDialog();
    renderFolderList();
  }

  /**
   * Obsługa przełączania zakładek
   */
  function setupTabs() {
    dom.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;

        dom.tabs.forEach((t) => {
          t.classList.remove('mf-tab-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('mf-tab-active');
        tab.setAttribute('aria-selected', 'true');

        dom.panels.forEach((panel) => {
          if (panel.id === `tab-${targetTab}`) {
            panel.style.display = 'block';
            panel.classList.add('mf-panel-active');
          } else {
            panel.style.display = 'none';
            panel.classList.remove('mf-panel-active');
          }
        });
      });
    });
  }

  /**
   * Renderowanie listy folderów w zakładce 1
   */
  function renderFolderList() {
    dom.folderList.innerHTML = '';
    const total = state.folders.length;
    dom.folderTotal.textContent = total;

    if (total === 0) {
      dom.foldersEmpty.style.display = 'flex';
      return;
    }

    dom.foldersEmpty.style.display = 'none';

    // Oblicz liczbę przypisań dla każdego folderu
    const counts = {};
    Object.values(state.assignments).forEach((folderId) => {
      counts[folderId] = (counts[folderId] || 0) + 1;
    });

    state.folders.forEach((folder) => {
      const count = counts[folder.id] || 0;
      const card = document.createElement('div');
      card.className = 'mf-folder-card';

      const color = folder.color || '#0084FF';

      card.innerHTML = `
        <div class="mf-card-info">
          <div class="mf-card-icon-badge" style="background-color: ${color}20; color: ${color};">
            ${folder.icon || '📁'}
          </div>
          <div class="mf-card-meta">
            <span class="mf-card-name" title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</span>
            <span class="mf-card-count">${formatChatCount(count)}</span>
          </div>
        </div>
        <div class="mf-card-actions">
          <button type="button" class="mf-card-btn mf-btn-edit" title="Edytuj folder" data-id="${folder.id}">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button type="button" class="mf-card-btn mf-btn-del" title="Usuń folder" data-id="${folder.id}">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      `;

      // Obsługa edycji
      card.querySelector('.mf-btn-edit').addEventListener('click', () => {
        openDialog(folder);
      });

      // Obsługa usuwania
      card.querySelector('.mf-btn-del').addEventListener('click', async () => {
        if (confirm(`Czy na pewno chcesz usunąć folder "${folder.name}"?`)) {
          state.folders = state.folders.filter((f) => f.id !== folder.id);

          // Usuń przypisania do usuniętego folderu
          Object.keys(state.assignments).forEach((thId) => {
            if (state.assignments[thId] === folder.id) {
              delete state.assignments[thId];
            }
          });

          await saveState();
          renderFolderList();
          showToast(`Usunięto folder "${folder.name}"`);
        }
      });

      dom.folderList.appendChild(card);
    });
  }

  /**
   * Zapis stanu do pamięci podręcznej rozszerzenia
   */
  async function saveState() {
    await Storage.set({
      folders: state.folders,
      assignments: state.assignments,
      settings: state.settings
    });
  }

  /**
   * Obsługa opcji konfiguracyjnych w zakładce 2
   */
  function setupSettings() {
    dom.optHideEmpty.checked = Boolean(state.settings.hideEmptyFolders);
    dom.optAnimations.checked = Boolean(state.settings.enableAnimations);
    dom.optBadges.checked = Boolean(state.settings.showBadges);
    dom.optHeaderPill.checked = Boolean(state.settings.headerPill);

    const updateOpt = async (key, val) => {
      state.settings[key] = val;
      await saveState();
      showToast('Zapisano ustawienie');
    };

    dom.optHideEmpty.addEventListener('change', (e) => updateOpt('hideEmptyFolders', e.target.checked));
    dom.optAnimations.addEventListener('change', (e) => updateOpt('enableAnimations', e.target.checked));
    dom.optBadges.addEventListener('change', (e) => updateOpt('showBadges', e.target.checked));
    dom.optHeaderPill.addEventListener('change', (e) => updateOpt('headerPill', e.target.checked));
  }

  /**
   * Obsługa tworzenia i przywracania kopii zapasowej w zakładce 3
   */
  function setupBackup() {
    // Eksport do pliku JSON
    dom.btnExport.addEventListener('click', () => {
      const backupData = {
        app: 'Messenger Folders',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        folders: state.folders,
        assignments: state.assignments,
        settings: state.settings
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `messenger-folders-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Wyeksportowano kopię do pliku JSON');
    });

    // Import z pliku JSON
    dom.btnImportTrigger.addEventListener('click', () => {
      dom.fileImport.value = '';
      dom.fileImport.click();
    });

    dom.fileImport.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (!imported || !Array.isArray(imported.folders)) {
            alert('Wybrany plik nie zawiera prawidłowej konfiguracji Messenger Folders.');
            return;
          }

          state.folders = imported.folders;
          if (imported.assignments) state.assignments = imported.assignments;
          if (imported.settings) state.settings = { ...state.settings, ...imported.settings };

          await saveState();
          renderFolderList();
          setupSettings();
          showToast('Pomyślnie przywrócono dane z kopii');
        } catch (err) {
          alert('Błąd podczas odczytu pliku: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  /**
   * Obsługa okna dialogowego edycji / tworzenia folderu
   */
  function setupDialog() {
    // Wypełnij siatkę emotikonów
    dom.dialogEmojis.innerHTML = '';
    EMOJI_LIST.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mf-dialog-emoji-btn';
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        state.selectedEmoji = emoji;
        updateDialogSelection();
        updateDialogPreview();
      });
      dom.dialogEmojis.appendChild(btn);
    });

    // Wypełnij paletę kolorów
    dom.dialogColors.innerHTML = '';
    COLOR_LIST.forEach((hex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mf-dialog-color-btn';
      btn.style.backgroundColor = hex;
      btn.addEventListener('click', () => {
        state.selectedColor = hex;
        updateDialogSelection();
        updateDialogPreview();
      });
      dom.dialogColors.appendChild(btn);
    });

    dom.btnOpenCreate.addEventListener('click', () => openDialog(null));
    dom.dialogBtnCancel.addEventListener('click', closeDialog);
    dom.dialogClose.addEventListener('click', closeDialog);

    dom.dialogInputName.addEventListener('input', updateDialogPreview);

    dom.dialogBtnSave.addEventListener('click', async () => {
      const name = dom.dialogInputName.value.trim();
      if (!name) {
        dom.dialogInputName.focus();
        dom.dialogInputName.style.borderColor = 'var(--mf-danger)';
        return;
      }

      if (state.currentEditId) {
        // Aktualizacja istniejącego folderu
        const idx = state.folders.findIndex((f) => f.id === state.currentEditId);
        if (idx !== -1) {
          state.folders[idx] = {
            ...state.folders[idx],
            name,
            icon: state.selectedEmoji,
            color: state.selectedColor
          };
        }
        showToast('Zaktualizowano folder');
      } else {
        // Nowy folder
        const newFolder = {
          id: 'f_' + Date.now().toString(36),
          name,
          icon: state.selectedEmoji,
          color: state.selectedColor
        };
        state.folders.push(newFolder);
        showToast('Utworzono nowy folder');
      }

      await saveState();
      renderFolderList();
      closeDialog();
    });
  }

  function openDialog(folder) {
    if (folder) {
      state.currentEditId = folder.id;
      dom.dialogTitle.textContent = 'Edytuj folder';
      dom.dialogInputName.value = folder.name;
      state.selectedEmoji = folder.icon || '📁';
      state.selectedColor = folder.color || COLOR_LIST[0];
    } else {
      state.currentEditId = null;
      dom.dialogTitle.textContent = 'Nowy folder';
      dom.dialogInputName.value = '';
      state.selectedEmoji = '📁';
      state.selectedColor = COLOR_LIST[0];
    }

    updateDialogSelection();
    updateDialogPreview();
    dom.dialogOverlay.style.display = 'flex';
    setTimeout(() => dom.dialogInputName.focus(), 60);
  }

  function closeDialog() {
    dom.dialogOverlay.style.display = 'none';
  }

  function updateDialogSelection() {
    // Zaznaczenie emotikona
    dom.dialogEmojis.querySelectorAll('.mf-dialog-emoji-btn').forEach((btn) => {
      btn.classList.toggle('mf-selected', btn.textContent === state.selectedEmoji);
    });

    // Zaznaczenie koloru
    dom.dialogColors.querySelectorAll('.mf-dialog-color-btn').forEach((btn) => {
      btn.classList.toggle('mf-selected', btn.style.backgroundColor === hexToRgb(state.selectedColor));
    });
  }

  function updateDialogPreview() {
    const text = dom.dialogInputName.value.trim() || 'Nazwa folderu';
    dom.dialogPreviewName.textContent = text;
    dom.dialogPreviewIcon.textContent = state.selectedEmoji;
    dom.dialogPreviewPill.style.setProperty('--mf-folder-color', state.selectedColor);
  }

  function hexToRgb(hex) {
    const bigint = parseInt(hex.replace('#', ''), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgb(${r}, ${g}, ${b})`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Uruchomienie po załadowaniu drzewa DOM
  document.addEventListener('DOMContentLoaded', init);
})();
