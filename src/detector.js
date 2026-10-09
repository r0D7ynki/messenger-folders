/**
 * Messenger Folders - Moduł detektora DOM (Detector)
 *
 * Odpowiada za wykrywanie wątków, linków, nazw kontaktów, awatarów
 * oraz miejsc wstrzyknięcia interfejsu w serwisach messenger.com i facebook.com.
 *
 * Kod jest odporny na dynamiczne zmiany klas CSS stosowane przez Meta.
 * Zgodny z zasadami Prostej Polszczyzny oraz normą PN-ISO 24495-1.
 */

(function (global) {
  'use strict';

  class MessengerDOMDetector {
    /**
     * Tworzy instancję detektora DOM.
     * @param {Object} [options] Opcje konfiguracyjne.
     * @param {Document} [options.doc] Obiekt dokumentu (ułatwia testowanie).
     */
    constructor(options = {}) {
      this.doc = options.doc || (typeof document !== 'undefined' ? document : null);
      this.win = options.win || (typeof window !== 'undefined' ? window : null);
    }

    /**
     * Wyodrębnia identyfikator wątku z adresu URL.
     * Obsługuje adresy standardowe, szyfrowane (E2EE) oraz parametry zapytania.
     * Przykłady:
     * - /t/1000123456789
     * - /messages/t/1000123456789
     * - /e2ee/t/1000123456789
     * - /messages/e2ee/t/1000123456789
     * - ?selected_item_id=1000123456789
     * @param {string} url Adres URL względny lub bezwzględny.
     * @returns {string|null} Identyfikator wątku lub null, jeśli nie znaleziono.
     */
    extractThreadIdFromUrl(url) {
      if (!url || typeof url !== 'string') {
        return null;
      }

      // 1. Dopasowanie ścieżki /t/:id z opcjonalnymi przedrostkami /messages lub /e2ee
      const pathMatch = url.match(/(?:\/messages)?(?:\/e2ee)?\/t\/([^/?#]+)/i);
      if (pathMatch && pathMatch[1]) {
        try {
          return decodeURIComponent(pathMatch[1]);
        } catch (_) {
          return pathMatch[1];
        }
      }

      // 2. Dopasowanie ścieżek /messages/:id lub /messages/group/:id (gdzie id to identyfikator)
      const msgMatch = url.match(/\/messages\/(?:group\/)?([a-zA-Z0-9._-]+)(?:[/?#]|$)/i);
      if (msgMatch && msgMatch[1]) {
        const id = msgMatch[1].toLowerCase();
        const nonThreadKeywords = ['new', 'requests', 'marketplace', 'settings', 'archive', 'unread', 'active', 'group'];
        if (!nonThreadKeywords.includes(id)) {
          return msgMatch[1];
        }
      }

      // 3. Dopasowanie parametrów w adresie URL
      try {
        const base = this.win?.location?.origin || 'https://www.messenger.com';
        const parsedUrl = new URL(url, base);
        const selectedId = parsedUrl.searchParams.get('selected_item_id') ||
          parsedUrl.searchParams.get('thread_id');
        if (selectedId) {
          return selectedId;
        }
      } catch (_) {
        // Zignorowanie błędów parsowania niestandardowych ciągów
      }

      return null;
    }

    /**
     * Wyszukuje element wiersza czatu odpowiadający danemu linkowi wątku.
     * Wykorzystuje role ARIA lub analizuje strukturę drzewa DOM.
     * @param {Element} linkElement Element <a> prowadzący do wątku.
     * @returns {Element|null} Nadrzędny wiersz czatu lub null.
     */
    findChatRow(linkElement) {
      if (!linkElement || !(linkElement instanceof Element)) {
        return null;
      }

      // Sprawdzenie semantycznych ról wiersza listy
      const semanticRow = linkElement.closest('[role="row"], [role="gridcell"], [role="listitem"], li');
      if (semanticRow && !semanticRow.closest('[role="main"]')) {
        return semanticRow;
      }

      // Wędrówka w górę drzewa DOM do kontenera wiersza
      let current = linkElement;
      for (let depth = 0; depth < 8; depth++) {
        if (!current.parentElement) break;
        current = current.parentElement;
        if (current.closest('[role="main"]')) break;

        // Jeśli rodzic zawiera rodzeństwo z podobnymi linkami, bieżący element jest wierszem
        const parent = current.parentElement;
        if (parent && parent.children.length > 1) {
          const hasSiblingLinks = Array.from(parent.children).some((sibling) => {
            return sibling !== current && sibling.querySelector('a[href*="/t/"], a[href*="/messages/"]');
          });
          if (hasSiblingLinks) {
            return current;
          }
        }
      }

      // Jeśli nie znaleziono nadrzędnego kontenera, zwracamy sam link
      return linkElement;
    }

    /**
     * Odczytuje nazwę kontaktu lub grupy z wiersza czatu.
     * @param {Element} rowElement Element wiersza czatu.
     * @param {Element} [linkElement] Opcjonalny element linku.
     * @returns {string} Wykryta nazwa lub pusty ciąg.
     */
    extractThreadName(rowElement, linkElement = null) {
      if (!rowElement) return '';

      // 1. Sprawdzenie atrybutu aria-label na linku lub wierszu
      const labelCandidate = (linkElement?.getAttribute('aria-label') ||
        rowElement.getAttribute('aria-label') || '').trim();

      if (labelCandidate) {
        // Meta często formatuje aria-label jako: "Imię Nazwisko, Ostatnia wiadomość:..."
        const parts = labelCandidate.split(/,|\n|•/);
        const firstPart = parts[0]?.trim();
        if (firstPart && firstPart.length > 0 && !firstPart.includes(':')) {
          return firstPart;
        }
      }

      // 2. Wyszukanie elementów span[dir="auto"] z tekstem (najczęstszy wzorzec w Meta)
      const textSpans = rowElement.querySelectorAll('span[dir="auto"]');
      for (const span of textSpans) {
        if (span.closest && (span.closest('.mf-thread-badge') || span.closest('.mf-folder-btn'))) {
          continue;
        }
        const text = span.textContent?.trim() || '';
        // Pomijamy krótkie oznaczenia czasu, liczby i puste ciągi
        if (text && text.length > 1 && !this._isTimeOrBadge(text)) {
          return text;
        }
      }

      // 3. Sprawdzenie nagłówków lub elementów pogrubionych
      const heading = rowElement.querySelector('h2, h3, strong, [role="heading"]');
      if (heading && (!heading.closest || (!heading.closest('.mf-thread-badge') && !heading.closest('.mf-folder-btn')))) {
        const text = heading.textContent?.trim() || '';
        if (text && !this._isTimeOrBadge(text)) {
          return text;
        }
      }

      // 4. Pobranie pierwszej linii tekstu z wiersza
      const rawText = rowElement.textContent?.trim() || '';
      if (rawText) {
        const firstLine = rawText.split('\n')[0]?.trim();
        if (firstLine && !this._isTimeOrBadge(firstLine)) {
          return firstLine;
        }
      }

      return '';
    }

    /**
     * Sprawdza, czy dany tekst jest oznaczeniem czasu lub licznikiem.
     * @private
     * @param {string} text Badany tekst.
     * @returns {boolean}
     */
    _isTimeOrBadge(text) {
      if (!text) return true;
      // Wzorce czasu: np. "12 min", "1 godz.", "Wczoraj", "14:30", "pn.", "wt."
      const timePatterns = /^(?:\d{1,2}:\d{2}|\d+\s*(?:min|sek|godz|dni|h|m|s|d)|wczoraj|dzisiaj|pon|wt|śr|czw|pt|sob|niedz|mon|tue|wed|thu|fri|sat|sun)\.?$/i;
      if (timePatterns.test(text.trim())) {
        return true;
      }
      // Samotna liczba (np. liczba nieprzeczytanych wiadomości)
      if (/^\d{1,3}$/.test(text.trim())) {
        return true;
      }
      return false;
    }

    /**
     * Odczytuje adres URL awatara z wiersza czatu.
     * @param {Element} rowElement Element wiersza czatu.
     * @returns {string} Adres URL awatara lub pusty ciąg.
     */
    extractThreadAvatar(rowElement) {
      if (!rowElement) return '';

      // 1. Sprawdzenie elementów <img>
      const images = rowElement.querySelectorAll('img');
      for (const img of images) {
        const src = img.getAttribute('src') || '';
        if (!src) continue;

        // Pomijamy emotikony i małe ikony systemowe
        if (src.includes('emoji') || src.includes('rsrc.php')) {
          continue;
        }

        // Pomijamy bardzo małe elementy
        const width = img.naturalWidth || parseInt(img.getAttribute('width') || '0', 10);
        const height = img.naturalHeight || parseInt(img.getAttribute('height') || '0', 10);
        if ((width > 0 && width < 20) || (height > 0 && height < 20)) {
          continue;
        }

        return src;
      }

      // 2. Sprawdzenie elementów SVG <image>
      const svgImages = rowElement.querySelectorAll('svg image');
      for (const svgImg of svgImages) {
        const href = svgImg.getAttribute('xlink:href') || svgImg.getAttribute('href') || '';
        if (href && !href.includes('emoji')) {
          return href;
        }
      }

      // 3. Sprawdzenie stylów tła (background-image)
      const elementsWithStyle = rowElement.querySelectorAll('[style*="background-image"]');
      for (const el of elementsWithStyle) {
        const bg = el.style.backgroundImage || '';
        const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (match && match[1] && !match[1].includes('emoji')) {
          return match[1];
        }
      }

      return '';
    }

    /**
     * Skanuje listę czatów w dokumencie lub wskazanym kontenerze.
     * Oznacza każdy znaleziony wiersz atrybutem data-mf-thread-id.
     * @param {Element|Document} [rootNode] Węzeł początkowy przeszukiwania.
     * @returns {Array<Object>} Lista wykrytych wątków.
     */
    /**
     * Zwraca kontener paska bocznego (listy czatów).
     * Gwarantuje, że skanowanie NIGDY nie wejdzie do role="main" (obszaru wiadomości).
     * @returns {Element|null}
     */
    getSidebarContainer() {
      if (!this.doc) return null;

      // 1. Główna siatka listy czatów poza role="main"
      const grid = this.doc.querySelector('[role="grid"]');
      if (grid && !grid.closest('[role="main"]') && grid.querySelector('a[href*="/t/"], a[href*="/messages/"]')) {
        return grid;
      }

      // 2. Dedykowana rola navigation zawierająca linki do wątków
      const navs = this.doc.querySelectorAll('[role="navigation"], [role="region"]');
      for (const nav of navs) {
        if (!nav.closest('[role="main"]') && nav.querySelector('a[href*="/t/"], a[href*="/messages/"]')) {
          return nav;
        }
      }

      // 3. Kontener z nagłówkiem "Czaty" lub "Chats"
      const chatsHeader = this.doc.querySelector(
        'div[aria-label="Czaty"], div[aria-label="Chats"], ' +
        'h1, [role="heading"][aria-level="1"]'
      );
      if (chatsHeader) {
        let parent = chatsHeader.parentElement;
        while (parent && parent !== this.doc.body) {
          if (parent.getAttribute('role') === 'main') break;
          if (parent.querySelector('a[href*="/t/"], a[href*="/messages/"]')) {
            return parent;
          }
          parent = parent.parentElement;
        }
      }

      // 4. Przodek pierwszego linku czatu poza role="main"
      const links = this.doc.querySelectorAll('a[href*="/t/"], a[href*="/messages/"]');
      for (const link of links) {
        if (!link.closest('[role="main"]')) {
          const listContainer = link.closest('[role="grid"], [role="navigation"], [role="region"]') ||
                                link.parentElement?.parentElement?.parentElement;
          if (listContainer && !listContainer.closest('[role="main"]')) {
            return listContainer;
          }
        }
      }

      return null;
    }

    /**
     * Skanuje listę czatów w dokumencie lub wskazanym kontenerze.
     * Oznacza każdy znaleziony wiersz atrybutem data-mf-thread-id.
     * @param {Element|Document} [rootNode] Węzeł początkowy przeszukiwania.
     * @returns {Array<Object>} Lista wykrytych wątków.
     */
    scanChatList(rootNode = null) {
      if (!this.doc) return [];

      // Skanujemy dedykowany kontener lub cały dokument poza role="main"
      const sidebar = rootNode || this.getSidebarContainer() || this.doc;
      const selector = 'a[href*="/t/"], a[href*="/messages/t/"], a[href*="/e2ee/t/"], a[href*="/messages/"]';
      let linkElements = sidebar.querySelectorAll(selector);

      // Niezawodny fallback: jeśli kontener nie zawierał linków, skanujemy cały dokument
      if (linkElements.length === 0 && sidebar !== this.doc) {
        linkElements = this.doc.querySelectorAll(selector);
      }

      const detectedThreads = [];
      const seenThreadIds = new Set();

      for (const link of linkElements) {
        // Rygorystyczna blokada: pomijamy wszystko co jest wewnątrz role="main"
        if (link.closest && link.closest('[role="main"]')) {
          continue;
        }

        const href = (link.getAttribute && link.getAttribute('href')) || link.href || '';
        const threadId = this.extractThreadIdFromUrl(href);

        if (!threadId || seenThreadIds.has(threadId)) {
          continue;
        }

        seenThreadIds.add(threadId);

        const rowElement = this.findChatRow(link);
        if (rowElement && (!rowElement.closest || !rowElement.closest('[role="main"]'))) {
          // Oznaczenie wiersza trwałym atrybutem bez powielania mutacji
          if (rowElement.getAttribute && rowElement.getAttribute('data-mf-thread-id') !== threadId) {
            rowElement.setAttribute('data-mf-thread-id', threadId);
          }
          if (link.getAttribute && link.getAttribute('data-mf-thread-link') !== threadId) {
            link.setAttribute('data-mf-thread-link', threadId);
          }

          const name = this.extractThreadName(rowElement, link);
          const avatar = this.extractThreadAvatar(rowElement);

          detectedThreads.push({
            threadId,
            rowElement,
            linkElement: link,
            name,
            avatar,
          });
        }
      }

      return detectedThreads;
    }

    /**
     * Wyszukuje kontener pola wyszukiwarki w panelu bocznym.
     * @param {Element} scope Kontener panelu bocznego do przeszukania.
     * @returns {Element|null} Kontener sekcji wyszukiwania.
     */
    findSearchContainer(scope) {
      if (!scope) return null;

      // Szukamy pola wyszukiwarki (wielojęzyczne selektory Messenger / Facebook)
      const searchInput = scope.querySelector(
        'input[aria-label*="Szukaj" i], input[aria-label*="Search" i], ' +
        'input[placeholder*="Szukaj" i], input[placeholder*="Search" i], ' +
        '[role="search"] input, input[type="search"], ' +
        'label input, input'
      );

      if (!searchInput || searchInput.closest('[role="main"]')) {
        return null;
      }

      // Wędrówka w górę drzewa DOM w poszukiwaniu zewnętrznego bloku wyszukiwarki
      let current = searchInput;
      while (current.parentElement &&
             current.parentElement !== scope &&
             current.parentElement !== this.doc?.body) {
        const parent = current.parentElement;

        // Jeśli rodzic zawiera już listę czatów, a sam current jej nie zawiera
        const parentHasChats = parent.querySelector('a[href*="/t/"], [role="grid"]');
        const currentHasChats = current.querySelector('a[href*="/t/"], [role="grid"]');
        if (parentHasChats && !currentHasChats) {
          return current;
        }

        // Jeśli rodzic ma rodzeństwo będące listą czatów
        if (parent.nextElementSibling &&
            (parent.nextElementSibling.querySelector('a[href*="/t/"]') ||
             parent.nextElementSibling.getAttribute('role') === 'grid')) {
          return parent;
        }

        current = parent;
      }

      return searchInput.closest('label') || searchInput.parentElement || searchInput;
    }

    /**
     * Wyszukuje optymalne, stabilne miejsce do wstrzyknięcia paska folderów.
     * Wyłącznie w obrębie paska bocznego - pod wyszukiwarką, nad listą czatów.
     * @returns {{ target: Element, position: string, container: Element }|null} Punkt wstrzyknięcia.
     */
    findFolderBarInjectionPoint() {
      if (!this.doc) return null;
      const sidebar = this.getSidebarContainer();
      const scope = sidebar || this.doc;

      // 1. Priorytet: Bezpośrednio nad główną listą czatów (idealnie pod wyszukiwarką, bez rozpychania jej wnętrza)
      const grid = scope.querySelector('[role="grid"]');
      if (grid && grid.parentElement && !grid.closest('[role="main"]')) {
        return {
          target: grid,
          position: 'beforebegin',
          container: grid.parentElement,
        };
      }

      // 2. Priorytet: Bezpośrednio pod zewnętrznym kontenerem wyszukiwarki
      const searchContainer = this.findSearchContainer(scope);
      if (searchContainer && searchContainer.parentElement && !searchContainer.closest('[role="main"]')) {
        return {
          target: searchContainer,
          position: 'afterend',
          container: searchContainer.parentElement,
        };
      }

      // 3. Priorytet: Przed pierwszym linkiem wątku wewnątrz paska bocznego
      const firstRowLink = scope.querySelector('a[href*="/t/"], a[href*="/messages/"]');
      if (firstRowLink && !firstRowLink.closest('[role="main"]')) {
        const row = this.findChatRow(firstRowLink) || firstRowLink;
        if (row.parentElement && !row.parentElement.closest('[role="main"]')) {
          return {
            target: row.parentElement,
            position: 'beforebegin',
            container: row.parentElement.parentElement || row.parentElement,
          };
        }
      }

      // 4. Priorytet: Bezpośrednio na początku paska bocznego
      if (sidebar && sidebar.firstElementChild) {
        return {
          target: sidebar.firstElementChild,
          position: 'afterend',
          container: sidebar,
        };
      }

      return null;
    }

    /**
     * Bezpiecznie wstrzykuje element paska folderów do drzewa DOM.
     * Przenosi pasek, jeśli znajdował się w niewłaściwym kontenerze.
     * @param {Element} folderBarElement Przygotowany element paska folderów.
     * @returns {boolean} Czy operacja wstrzyknięcia powiodła się.
     */
    injectFolderBar(folderBarElement) {
      if (!folderBarElement || !(folderBarElement instanceof Element)) {
        return false;
      }

      const point = this.findFolderBarInjectionPoint();
      if (!point || !point.target) {
        return false;
      }

      // Sprawdź, czy element jest już poprawnie umieszczony w DOM
      if (point.position === 'beforebegin' && point.target.previousElementSibling === folderBarElement) {
        return true;
      }
      if (point.position === 'afterend' && point.target.nextElementSibling === folderBarElement) {
        return true;
      }
      if (point.position === 'prepend' && point.container?.firstElementChild === folderBarElement) {
        return true;
      }

      // Jeśli element znajdował się wcześniej w innym, złym miejscu, usuwamy go stamtąd
      if (folderBarElement.parentElement) {
        folderBarElement.remove();
      }

      try {
        if (point.position === 'afterend') {
          point.target.insertAdjacentElement('afterend', folderBarElement);
          return true;
        } else if (point.position === 'beforebegin') {
          point.target.insertAdjacentElement('beforebegin', folderBarElement);
          return true;
        } else if (point.container) {
          point.container.prepend(folderBarElement);
          return true;
        }
      } catch (err) {
        console.error('Błąd podczas wstrzykiwania paska folderów:', err);
      }

      return false;
    }

    /**
     * Wykrywa aktualnie otwarty czat na podstawie adresu URL oraz nagłówka konwersacji.
     * @returns {{ threadId: string|null, title: string, avatar: string, url: string }}
     */
    getCurrentOpenChat() {
      const currentUrl = this.win?.location?.href || '';
      const threadId = this.extractThreadIdFromUrl(currentUrl);

      let title = '';
      let avatar = '';

      if (this.doc) {
        // Wyszukanie nagłówka aktywnej konwersacji w głównym panelu
        const mainPane = this.doc.querySelector('[role="main"]');
        if (mainPane) {
          // Szukamy nagłówka czatu
          const titleElement = mainPane.querySelector('h2, [role="heading"], span[dir="auto"]');
          if (titleElement) {
            title = titleElement.textContent?.trim() || '';
          }

          const avatarImg = mainPane.querySelector('header img, div[role="main"] img');
          if (avatarImg) {
            const src = avatarImg.getAttribute('src') || '';
            if (src && !src.includes('emoji') && !src.includes('rsrc.php')) {
              avatar = src;
            }
          }
        }

        // Jeśli w głównym panelu nie znaleziono tytułu, sprawdzamy tytuł strony
        if (!title && this.doc.title) {
          // Messenger często ustawia tytuł: "Jan Kowalski | Messenger" lub "Jan Kowalski"
          const cleanTitle = this.doc.title.replace(/\|.*$/i, '').trim();
          if (cleanTitle && cleanTitle.toLowerCase() !== 'messenger') {
            title = cleanTitle;
          }
        }
      }

      return {
        threadId,
        title,
        avatar,
        url: currentUrl,
      };
    }

    /**
     * Konfiguruje obserwatora MutationObserver z throttlingiem.
     * Reaguje na doładowywanie kolejnych wierszy czatów podczas przewijania (virtual scrolling).
     * @param {Function} callback Funkcja wywoływana przy wykryciu zmian na liście wątków.
     * @param {Object} [options] Opcje obserwatora.
     * @param {number} [options.throttleMs=150] Czas dławienia wywołań w milisekundach.
     * @returns {{ observer: MutationObserver|null, disconnect: Function }} Obiekt kontrolera.
     */
    setupObserver(callback, options = {}) {
      if (typeof callback !== 'function') {
        throw new Error('Parametr callback musi być funkcją.');
      }

      const throttleMs = typeof options.throttleMs === 'number' ? options.throttleMs : 150;
      let timeoutId = null;
      let lastRunTime = 0;
      let isDisconnected = false;

      const runScan = () => {
        if (isDisconnected) return;
        lastRunTime = Date.now();
        timeoutId = null;

        try {
          const threads = this.scanChatList();
          callback(threads);
        } catch (scanError) {
          console.error('Błąd w funkcji zwrotnej obserwatora listy czatów:', scanError);
        }
      };

      const throttledHandler = (mutationsList) => {
        if (isDisconnected) return;

        // Filtrowanie mutacji: ignorujemy zmiany pochodzące z naszych własnych elementów
        if (mutationsList && mutationsList.length > 0) {
          const onlyOurElements = mutationsList.every((mutation) => {
            const target = mutation.target;
            if (target && target.nodeType === 1) {
              if (target.id === 'mf-folder-bar' ||
                  target.closest?.('#mf-folder-bar, .mf-dropdown-menu, .mf-modal-overlay') ||
                  target.classList?.contains('mf-thread-badge') ||
                  target.classList?.contains('mf-folder-btn') ||
                  target.hasAttribute?.('data-mf-thread-id') ||
                  target.hasAttribute?.('data-mf-folder-bar')) {
                return true;
              }
            }
            return false;
          });
          if (onlyOurElements) {
            return; // Zero reakcji na własne zmiany
          }
        }

        const now = Date.now();
        const elapsed = now - lastRunTime;

        if (elapsed >= throttleMs) {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          runScan();
        } else if (!timeoutId) {
          timeoutId = setTimeout(runScan, throttleMs - elapsed);
        }
      };

      // Pierwsze natychmiastowe uruchomienie
      runScan();

      // Utworzenie i podpięcie MutationObserver na pasku bocznym (nigdy na całym document.body!)
      let observer = null;
      if (typeof MutationObserver !== 'undefined' && this.doc?.body) {
        observer = new MutationObserver(throttledHandler);
        const sidebar = this.getSidebarContainer();
        const targetElement = sidebar || this.doc.body;
        observer.observe(targetElement, {
          childList: true,
          subtree: true,
        });
      }

      return {
        observer,
        disconnect: () => {
          isDisconnected = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          if (observer) {
            observer.disconnect();
            observer = null;
          }
        },
      };
    }
  }

  // Eksport globalny i CommonJS
  if (typeof global !== 'undefined') {
    global.MessengerDOMDetector = MessengerDOMDetector;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessengerDOMDetector;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
