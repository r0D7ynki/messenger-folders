/**
 * Messenger Folders - Moduł bazowy interfejsu (MessengerUICore)
 * Stałe, ikony SVG, narzędzia bezpieczeństwa DOM, system powiadomień Toast.
 * Zgodność ze standardem Manifest V3 oraz PN-ISO 24495-1 (Prosta Polszczyzna).
 */

(function (global) {
  'use strict';

  // 1. Ikony wektorowe SVG używane w interfejsie
  const ICONS = Object.freeze({
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
  });

  // 2. Domyślny zestaw emotikonów do wyboru
  const DEFAULT_EMOJIS = Object.freeze([
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
  ]);

  // 3. Domyślna paleta kolorów
  const DEFAULT_COLORS = Object.freeze([
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
  ]);

  /**
   * Bezpieczne generowanie unikalnego identyfikatora folderu.
   * @returns {string}
   */
  function generateId() {
    return 'f_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  }

  /**
   * Zabezpieczenie przed atakami XSS przy wstrzykiwaniu tekstu.
   * @param {string|any} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Bezpiecznie tworzy element SVG dla wskazanej ikony z ICONS.
   * @param {string} iconName
   * @returns {Element}
   */
  function createIcon(iconName) {
    const svgString = ICONS[iconName];
    if (!svgString) {
      return document.createElement('span');
    }
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
      if (doc && doc.documentElement) {
        return doc.documentElement;
      }
    }
    return document.createElement('span');
  }

  /**
   * Bezpiecznie wstawia ikonę SVG do elementu bez użycia innerHTML ze zmienną.
   * @param {Element} el
   * @param {string} iconName
   */
  function setIcon(el, iconName) {
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(createIcon(iconName));
  }

  /**
   * Ustawia treść przycisku składającą się z opcjonalnej ikony i etykiety tekstowej.
   * @param {Element} btn
   * @param {string} [iconName]
   * @param {string} [labelText]
   */
  function setButtonContent(btn, iconName, labelText) {
    if (!btn) return;
    btn.innerHTML = '';
    if (iconName) {
      btn.appendChild(createIcon(iconName));
    }
    if (labelText) {
      const span = document.createElement('span');
      span.textContent = labelText;
      btn.appendChild(span);
    }
  }

  /**
   * Bezpieczny konstruktor elementów DOM redukujący powtarzalny kod.
   * @param {string} tag Nazwa znacznika HTML
   * @param {Object} [options] Konfiguracja elementu
   * @param {string} [options.className] Klasy CSS
   * @param {string} [options.id] Identyfikator elementu
   * @param {string} [options.textContent] Treść tekstowa
   * @param {string} [options.type] Typ przycisku lub pola formularza
   * @param {Object} [options.attributes] Atrybuty HTML
   * @param {Object} [options.dataset] Właściwości data-*
   * @param {Array<Element>} [options.children] Elementy potomne
   * @returns {Element}
   */
  function createElement(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.className) el.className = options.className;
    if (options.id) el.id = options.id;
    if (options.textContent !== undefined && options.textContent !== null) {
      el.textContent = options.textContent;
    }
    if (options.type && (tag.toLowerCase() === 'button' || tag.toLowerCase() === 'input')) {
      el.type = options.type;
    }
    if (options.attributes) {
      for (const [key, val] of Object.entries(options.attributes)) {
        if (val !== null && val !== undefined) {
          el.setAttribute(key, String(val));
        }
      }
    }
    if (options.dataset) {
      for (const [key, val] of Object.entries(options.dataset)) {
        if (val !== null && val !== undefined) {
          el.dataset[key] = String(val);
        }
      }
    }
    if (options.children && Array.isArray(options.children)) {
      for (const child of options.children) {
        if (child) el.appendChild(child);
      }
    }
    return el;
  }

  /**
   * Menedżer powiadomień Toast u dołu ekranu (.mf-toast).
   */
  class ToastManager {
    constructor() {
      this.timeoutId = null;
    }

    /**
     * Wyświetla powiadomienie toast.
     * @param {string} message Treść komunikatu
     * @param {number} [duration=2600] Czas wyświetlania w ms
     */
    show(message, duration = 2600) {
      if (typeof document === 'undefined') return;

      let toast = document.querySelector('.mf-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'mf-toast';
        document.body.appendChild(toast);
      }

      toast.textContent = message;
      toast.classList.add('mf-show');

      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }

      this.timeoutId = setTimeout(() => {
        toast.classList.remove('mf-show');
        this.timeoutId = null;
      }, duration);
    }

    /**
     * Ukrywa aktywne powiadomienie i czyści timer.
     */
    clear() {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      if (typeof document !== 'undefined') {
        const toast = document.querySelector('.mf-toast');
        if (toast) {
          toast.classList.remove('mf-show');
        }
      }
    }
  }

  const defaultToastManager = new ToastManager();

  /**
   * Funkcja pomocnicza wyświetlająca toast przez domyślnego menedżera.
   * @param {string} message
   * @param {number} [duration=2600]
   */
  function showToast(message, duration = 2600) {
    defaultToastManager.show(message, duration);
  }

  // Złożenie publicznego interfejsu modułu MessengerUICore
  const MessengerUICore = {
    ICONS,
    DEFAULT_EMOJIS,
    DEFAULT_COLORS,
    generateId,
    escapeHtml,
    _escapeHtml: escapeHtml,
    createIcon,
    _createIcon: createIcon,
    setIcon,
    _setIcon: setIcon,
    setButtonContent,
    _setButtonContent: setButtonContent,
    createElement,
    ToastManager,
    showToast
  };

  // Rejestracja globalna w przeglądarce
  if (typeof globalThis !== 'undefined') {
    globalThis.MessengerUICore = MessengerUICore;
  }
  if (typeof global !== 'undefined') {
    global.MessengerUICore = MessengerUICore;
  }

  // Rejestracja CommonJS w Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessengerUICore;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
