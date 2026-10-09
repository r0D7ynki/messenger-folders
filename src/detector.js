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

      // 2. Dopasowanie parametrów w adresie URL
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
      const semanticRow = linkElement.closest('[role="row"], [role="listitem"], li');
      if (semanticRow) {
        return semanticRow;
      }

      // Wędrówka w górę drzewa DOM do kontenera wiersza
      let current = linkElement;
      for (let depth = 0; depth < 6; depth++) {
        if (!current.parentElement) break;
        current = current.parentElement;

        // Jeśli rodzic zawiera rodzeństwo z podobnymi linkami, bieżący element jest wierszem
        const parent = current.parentElement;
        if (parent && parent.children.length > 1) {
          const hasSiblingLinks = Array.from(parent.children).some((sibling) => {
            return sibling !== current && sibling.querySelector('a[href*="/t/"]');
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
        const text = span.textContent?.trim() || '';
        // Pomijamy krótkie oznaczenia czasu, liczby i puste ciągi
        if (text && text.length > 1 && !this._isTimeOrBadge(text)) {
          return text;
        }
      }

      // 3. Sprawdzenie nagłówków lub elementów pogrubionych
      const heading = rowElement.querySelector('h2, h3, strong, [role="heading"]');
      if (heading && heading.textContent?.trim()) {
        const text = heading.textContent.trim();
        if (!this._isTimeOrBadge(text)) {
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
    scanChatList(rootNode = null) {
      const doc = rootNode || this.doc;
      if (!doc) return [];

      // Wyszukanie wszystkich linków do wątków w interfejsie
      const linkElements = doc.querySelectorAll('a[href*="/t/"]');
      const detectedThreads = [];
      const seenThreadIds = new Set();

      for (const link of linkElements) {
        const href = link.getAttribute('href') || link.href || '';
        const threadId = this.extractThreadIdFromUrl(href);

        if (!threadId || seenThreadIds.has(threadId)) {
          continue;
        }

        seenThreadIds.add(threadId);

        const rowElement = this.findChatRow(link);
        if (rowElement) {
          // Oznaczenie wiersza trwałym atrybutem
          rowElement.setAttribute('data-mf-thread-id', threadId);
          link.setAttribute('data-mf-thread-link', threadId);

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
     * Wyszukuje optymalne miejsce do wstrzyknięcia paska folderów.
     * Typowe położenie to obszar pod polem wyszukiwania lub pod nagłówkiem listy czatów.
     * @returns {{ target: Element, position: string, container: Element }|null} Punkt wstrzyknięcia.
     */
    findFolderBarInjectionPoint() {
      if (!this.doc) return null;

      // 1. Sprawdzenie obszaru pod polem wyszukiwania kontaktów
      const searchInput = this.doc.querySelector(
        'input[placeholder*="Szukaj" i], input[placeholder*="Search" i], ' +
        'input[aria-label*="Szukaj" i], input[aria-label*="Search" i], ' +
        'div[role="search"] input'
      );

      if (searchInput) {
        // Znalezienie kontenera zewnętrznego pola wyszukiwania
        const searchBox = searchInput.closest('label')?.parentElement ||
          searchInput.closest('div[role="search"]') ||
          searchInput.closest('form') ||
          searchInput.parentElement;

        if (searchBox && searchBox.parentElement) {
          return {
            target: searchBox,
            position: 'afterend',
            container: searchBox.parentElement,
          };
        }
      }

      // 2. Sprawdzenie nagłówka listy czatów ("Czaty" / "Chats")
      const headerCandidate = this.doc.querySelector(
        'h1, [role="heading"][aria-level="1"], ' +
        'div[aria-label="Czaty"], div[aria-label="Chats"]'
      );

      if (headerCandidate && headerCandidate.parentElement) {
        return {
          target: headerCandidate.parentElement,
          position: 'afterend',
          container: headerCandidate.parentElement.parentElement || headerCandidate.parentElement,
        };
      }

      // 3. Sprawdzenie pierwszego wiersza czatu na liście
      const firstRow = this.doc.querySelector('[data-mf-thread-id], a[href*="/t/"]');
      if (firstRow) {
        const row = this.findChatRow(firstRow) || firstRow;
        if (row && row.parentElement) {
          return {
            target: row.parentElement,
            position: 'beforebegin',
            container: row.parentElement.parentElement || row.parentElement,
          };
        }
      }

      // 4. Domyślny kontener nawigacji po lewej stronie
      const navContainer = this.doc.querySelector('[role="navigation"], [role="grid"]');
      if (navContainer && navContainer.parentElement) {
        return {
          target: navContainer,
          position: 'beforebegin',
          container: navContainer.parentElement,
        };
      }

      return null;
    }

    /**
     * Bezpiecznie wstrzykuje element paska folderów do drzewa DOM.
     * @param {Element} folderBarElement Przygotowany element paska folderów.
     * @returns {boolean} Czy operacja wstrzyknięcia powiodła się.
     */
    injectFolderBar(folderBarElement) {
      if (!folderBarElement || !(folderBarElement instanceof Element)) {
        return false;
      }

      // Jeśli element już istnieje w DOM w tym samym miejscu, nie duplikujemy go
      if (this.doc?.contains(folderBarElement)) {
        return true;
      }

      const point = this.findFolderBarInjectionPoint();
      if (!point || !point.target) {
        return false;
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

      const throttledHandler = () => {
        if (isDisconnected) return;

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

      // Utworzenie i podpięcie MutationObserver
      let observer = null;
      if (typeof MutationObserver !== 'undefined' && this.doc?.body) {
        observer = new MutationObserver(throttledHandler);
        observer.observe(this.doc.body, {
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
