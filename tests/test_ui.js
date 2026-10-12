/**
 * Testy jednostkowe dla modułu MessengerUI (src/ui.js) oraz plików wizualnych
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testowanie modułu MessengerUI oraz komponentów wizualnych ---');

// Mock środowiska DOM (JSDOM-like mini mock dla środowiska Node.js)
class MockClassList {
  constructor() {
    this._classes = new Set();
  }
  add(...cls) {
    cls.forEach((c) => this._classes.add(c));
  }
  remove(...cls) {
    cls.forEach((c) => this._classes.delete(c));
  }
  toggle(cls, force) {
    if (force === undefined) {
      if (this._classes.has(cls)) this._classes.delete(cls);
      else this._classes.add(cls);
    } else if (force) {
      this._classes.add(cls);
    } else {
      this._classes.delete(cls);
    }
  }
  contains(cls) {
    return this._classes.has(cls);
  }
  get value() {
    return Array.from(this._classes).join(' ');
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this._className = '';
    this.classList = new MockClassList();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = {};
    this.style = {
      _props: {},
      setProperty(k, v) {
        this._props[k] = v;
      },
      removeProperty(k) {
        delete this._props[k];
      },
      getPropertyValue(k) {
        return this._props[k] || '';
      }
    };
    this.textContent = '';
    this._innerHTML = '';
    this._listeners = {};
  }

  get className() {
    return this.classList.value || this._className;
  }
  set className(val) {
    this._className = val;
    this.classList._classes = new Set((val || '').split(/\s+/).filter(Boolean));
  }

  get innerHTML() {
    return this._innerHTML;
  }
  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    const tagRegex = /<([a-z0-9]+)([^>]*)>(.*?)<\/\1>|<([a-z0-9]+)([^>]*)\/>/gis;
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      const tag = match[1] || match[4];
      const attrsStr = match[2] || match[5] || '';
      const content = match[3] || '';
      const child = new MockElement(tag);
      const classMatch = attrsStr.match(/class=["']([^"']+)["']/i);
      if (classMatch) child.className = classMatch[1];
      const idMatch = attrsStr.match(/id=["']([^"']+)["']/i);
      if (idMatch) child.id = idMatch[1];
      const attrMatches = attrsStr.matchAll(/([a-z0-9_-]+)=["']([^"']*)["']/gi);
      for (const m of attrMatches) {
        const attrName = m[1].toLowerCase();
        const attrVal = m[2];
        child.setAttribute(attrName, attrVal);
        if (attrName.startsWith('data-')) {
          const camel = attrName.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
          child.dataset[camel] = attrVal;
        }
      }
      child.textContent = content.replace(/<[^>]*>/g, '').trim();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }
  getAttribute(k) {
    return this.attributes[k] || null;
  }
  hasAttribute(k) {
    return k in this.attributes;
  }
  removeAttribute(k) {
    delete this.attributes[k];
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      child.parentElement = null;
      this.children.splice(idx, 1);
    }
    return child;
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (this._matchesSelector(child, selector)) {
          matches.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return matches;
  }

  _matchesSelector(node, selector) {
    if (selector.startsWith('#')) return node.id === selector.slice(1);
    if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
    if (selector.startsWith('[')) {
      const attr = selector.replace(/[\]["]/g, '').split('=')[0];
      return node.hasAttribute(attr);
    }
    return node.tagName.toLowerCase() === selector.toLowerCase();
  }

  addEventListener(type, handler) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(handler);
  }

  dispatchEvent(event) {
    const fnName = 'on' + event.type;
    if (typeof this[fnName] === 'function') {
      this[fnName](event);
    }
    const handlers = this._listeners[event.type] || [];
    handlers.forEach((h) => h(event));
  }

  getBoundingClientRect() {
    return { top: 100, bottom: 130, left: 50, right: 150, width: 100, height: 30 };
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node._matchesSelector && node._matchesSelector(node, selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  click() {
    this.dispatchEvent({ type: 'click' });
  }

  contains(node) {
    for (let current = node; current; current = current.parentElement) {
      if (current === this) return true;
    }
    return false;
  }

  focus() {
    global.document.activeElement = this;
    this.dispatchEvent({ type: 'focus' });
  }

  scrollIntoView(options) {
    this.lastScrollIntoView = options || null;
  }
}

// Konfiguracja globalnego mocka document i window
const mockBody = new MockElement('body');
global.document = {
  body: mockBody,
  activeElement: null,
  createElement(tag) {
    return new MockElement(tag);
  },
  getElementById(id) {
    const find = (el) => {
      if (el.id === id) return el;
      for (const ch of el.children) {
        const found = find(ch);
        if (found) return found;
      }
      return null;
    };
    return find(mockBody);
  },
  querySelector(sel) {
    return mockBody.querySelector(sel);
  },
  querySelectorAll(sel) {
    return mockBody.querySelectorAll(sel);
  },
  addEventListener() {},
  removeEventListener() {}
};

global.window = {
  innerWidth: 1200,
  innerHeight: 800,
  addEventListener() {}
};
global.requestAnimationFrame = (fn) => fn();
global.DOMParser = class MockDOMParser {
  parseFromString(markup) {
    const root = new MockElement('div');
    root.innerHTML = markup;
    return { documentElement: root.children[0] || root };
  }
};

const MessengerUI = require('../src/ui.js');

// 1. Inicjalizacja klasy
console.log('Test 1: Inicjalizacja klasy MessengerUI...');
const ui = new MessengerUI();
assert.ok(ui instanceof MessengerUI, 'ui powinno być instancją MessengerUI');
console.log('✓ MessengerUI utworzony pomyślnie.');

// 2. renderFolderBar
console.log('Test 2: renderFolderBar()...');
const sampleFolders = [
  { id: 'all', name: 'Wszystkie', icon: '💬', color: '#0084FF', isDefault: true },
  { id: 'work', name: 'Praca', icon: '💼', color: '#10B981' },
  { id: 'friends', name: 'Znajomi', icon: '👥', color: '#8B5CF6' }
];

let selectedId = null;
let addClicked = false;
let editedFolder = null;

const bar = ui.renderFolderBar(
  sampleFolders,
  'work',
  { work: 4, friends: 0 },
  (id) => {
    selectedId = id;
  },
  () => {
    addClicked = true;
  },
  (folder) => {
    editedFolder = folder;
  }
);

assert.strictEqual(bar.id, 'mf-folder-bar', 'Element paska powinien mieć ID #mf-folder-bar');
assert.strictEqual(editedFolder, null, 'editedFolder jest domyślnie null');
const pills = bar.querySelectorAll('.mf-folder-pill');
assert.strictEqual(pills.length, 3, 'Powinny powstać 3 pigułki folderów');

// Sprawdzenie aktywnej pigułki
const activePill = bar.querySelector('.mf-active');
assert.ok(activePill, 'Jedna pigułka musi być aktywna');
assert.strictEqual(activePill.dataset.folderId, 'work', 'Aktywny folder to "work"');

// Sprawdzenie stałej szerokości oraz braku ikony edycji na pigułce
assert.strictEqual(pills[0].style.width, '110px', 'Pigułka powinna mieć stałą szerokość 110px');
const pillEditBtn = bar.querySelector('.mf-pill-edit-icon');
assert.strictEqual(pillEditBtn, null, 'Pigułki nie powinny zawierać ikony edycji');

// Sprawdzenie przycisku dodawania
const addBtn = bar.querySelector('.mf-folder-add-btn');
assert.ok(addBtn, 'Przycisk dodawania paska powinien istnieć');
addBtn.dispatchEvent({ type: 'click' });
assert.strictEqual(addClicked, true, 'Kliknięcie w dodawanie powinno wywołać callback');

// Sprawdzenie wyszukiwarki folderów
const searchInput = bar.querySelector('.mf-folder-search-input');
assert.ok(searchInput, 'Pole wyszukiwarki folderów powinno istnieć');

// Sprawdzenie przycisku ustawień obok wyszukiwarki folderów
const settingsBtn = bar.querySelector('.mf-folder-settings-btn');
assert.ok(settingsBtn, 'Przycisk ustawień powinien istnieć w górnym wierszu paska');

// Sprawdzenie wyboru pigułki
pills[2].dispatchEvent({ type: 'click' });
assert.strictEqual(selectedId, 'friends', 'Kliknięcie pigułki powinno wywołać onSelectFolder');

console.log('✓ renderFolderBar() działa poprawnie.');

// 3. injectFolderBadge (usunięcie plakietek i nazw folderów z wiersza czatu)
console.log('Test 3: injectFolderBadge()...');
const mockRow = new MockElement('div');
mockRow.setAttribute('role', 'row');

// Dodanie starej plakietki, aby sprawdzić czy injectFolderBadge ją usuwa
const oldBadge = new MockElement('span');
oldBadge.className = 'mf-thread-badge';
mockRow.appendChild(oldBadge);

let assignCalled = false;
ui.injectFolderBadge(mockRow, 'thread_123', sampleFolders[1], (el, tid) => {
  assignCalled = true;
});

const badge = mockRow.querySelector('.mf-thread-badge');
assert.strictEqual(badge, null, 'Plakietka folderu powinna zostać usunięta z czatu');

// Przycisk folderu na czacie również nie powinien istnieć
const folderBtn = mockRow.querySelector('.mf-folder-btn');
assert.strictEqual(folderBtn, null, 'Przycisk folderu przy czacie nie powinien być tworzony');

mockRow.dispatchEvent({ type: 'contextmenu', shiftKey: false, stopPropagation() {}, preventDefault() {} });
assert.strictEqual(assignCalled, true, 'Prawy przycisk myszy na wierszu powinien wywołać onAssign');
console.log('✓ injectFolderBadge() działa poprawnie (plakietki usunięte z czatu).');

// 4. renderHeaderPill
console.log('Test 4: renderHeaderPill()...');
const mockHeader = new MockElement('header');
let headerAssign = false;
const headerPill = ui.renderHeaderPill(mockHeader, sampleFolders[1], () => {
  headerAssign = true;
});

assert.ok(headerPill, 'Pigułka nagłówka powinna zostać utworzona');
assert.ok(
  headerPill.classList.contains('mf-header-pill-assigned'),
  'Pigułka powinna mieć klasę mf-header-pill-assigned'
);
assert.strictEqual(headerPill.querySelector('.mf-header-pill-title').textContent, 'Praca');

headerPill.dispatchEvent({ type: 'click', stopPropagation() {} });
assert.strictEqual(headerAssign, true, 'Kliknięcie pigułki nagłówka powinno wywołać callback');
console.log('✓ renderHeaderPill() działa poprawnie.');

// 4b. renderHeaderPill escapuje nazwę i ikonę folderu (dane z importu JSON są niezaufane)
console.log('Test 4b: renderHeaderPill() escapuje HTML w nazwie i ikonie...');
const maliciousFolder = {
  id: 'evil',
  name: '<img src=x onerror=alert(1)>',
  icon: '<svg onload=alert(2)>',
  color: '#FF0000'
};
const evilPill = ui.renderHeaderPill(new MockElement('header'), maliciousFolder, () => {});
assert.ok(!evilPill.innerHTML.includes('<img'), 'Nazwa folderu nie może trafić do innerHTML jako znacznik');
assert.ok(!evilPill.innerHTML.includes('<svg onload'), 'Ikona folderu nie może trafić do innerHTML jako znacznik');
assert.ok(
  evilPill.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'),
  'Nazwa powinna być wyświetlona jako tekst'
);
console.log('✓ renderHeaderPill() escapuje HTML w nazwie i ikonie.');

// 5. showFolderModal
console.log('Test 5: showFolderModal()...');
let savedFolder = null;
ui.showFolderModal({
  folder: null,
  onSave: (data) => {
    savedFolder = data;
  }
});

assert.ok(ui.activeModal, 'Aktywne okno modalne powinno istnieć w DOM');
const modalNameInput = ui.activeModal.querySelector('#mf-input-folder-name');
assert.ok(modalNameInput, 'Pole wprowadzania nazwy musi istnieć');
modalNameInput.value = 'Ważne kontakty';

const threadsSearch = ui.activeModal.querySelector('.mf-modal-threads-search');
assert.ok(threadsSearch, 'Okno modalne folderu musi zawierać pole wyszukiwania osób');
const threadsPicker = ui.activeModal.querySelector('.mf-modal-threads-picker');
assert.ok(threadsPicker, 'Okno modalne folderu musi zawierać listę wyboru osób');

const saveModalBtn = ui.activeModal.querySelector('.mf-btn-primary');
saveModalBtn.dispatchEvent({ type: 'click' });

assert.ok(savedFolder, 'Folder powinien zostać zapisany');
assert.strictEqual(savedFolder.name, 'Ważne kontakty');
assert.strictEqual(ui.activeModal, null, 'Okno modalne powinno zostać zamknięte po zapisie');

// Weryfikacja przycisku powrotu w oknie folderu
let backCalled = false;
ui.showFolderModal({
  folder: sampleFolders[1],
  onBack: () => {
    backCalled = true;
  }
});
const backBtn = ui.activeModal.querySelector('.mf-modal-back-btn');
assert.ok(backBtn, 'Okno modalne folderu musi zawierać przycisk powrotu, gdy przekazano onBack');
backBtn.dispatchEvent({ type: 'click', stopPropagation() {} });
assert.strictEqual(backCalled, true, 'Kliknięcie przycisku powrotu powinno wywołać onBack');
assert.strictEqual(ui.activeModal, null, 'Okno modalne powinno zostać zamknięte po kliknięciu powrotu');
console.log('✓ showFolderModal() działa poprawnie.');

// 6. showAssignDropdown
console.log('Test 6: showAssignDropdown()...');
let dropdownAssignedFolder = null;
ui.showAssignDropdown(mockRow, 'thread_123', sampleFolders, 'work', (thId, fId) => {
  dropdownAssignedFolder = fId;
});

assert.ok(ui.activeDropdown, 'Menu rozwijane powinno zostać otwarte');
const dropdownItems = ui.activeDropdown.querySelectorAll('.mf-dropdown-item');
assert.ok(dropdownItems.length >= 3, 'Menu powinno zawierać opcje folderów');

// Kliknięcie w folder friends
const friendsItem =
  dropdownItems.find((item) => item.textContent && item.textContent.includes('Znajomi')) || dropdownItems[2];
friendsItem.dispatchEvent({ type: 'click' });
assert.strictEqual(dropdownAssignedFolder, 'friends');
assert.strictEqual(ui.activeDropdown, null, 'Menu powinno zamknąć się po wyborze');
console.log('✓ showAssignDropdown() działa poprawnie.');

// 7. Weryfikacja ikon
console.log('Test 7: Weryfikacja plików graficznych ikon...');
const iconSizes = [16, 32, 48, 128];
iconSizes.forEach((size) => {
  const p = path.join(__dirname, '..', 'icons', `icon${size}.png`);
  assert.ok(fs.existsSync(p), `Ikona icons/icon${size}.png musi istnieć`);
  const stat = fs.statSync(p);
  assert.ok(stat.size > 200, `Ikona icons/icon${size}.png musi mieć poprawny rozmiar pliku`);
});
console.log('✓ Wszystkie wymagane ikony PNG istnieją i są poprawne.');

// 8. Weryfikacja stylów content.css
console.log('Test 8: Weryfikacja stylów CSS...');
const cssPath = path.join(__dirname, '..', 'src', 'content.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');
assert.ok(cssContent.includes('#mf-folder-bar'), 'content.css musi stylizować #mf-folder-bar');
assert.ok(cssContent.includes('.mf-thread-badge'), 'content.css musi stylizować .mf-thread-badge');
assert.ok(cssContent.includes('.mf-folder-btn'), 'content.css musi stylizować .mf-folder-btn');
assert.ok(cssContent.includes('.mf-scroll-btn'), 'content.css musi stylizować .mf-scroll-btn');
assert.ok(cssContent.includes('.mf-modal-threads-picker'), 'content.css musi stylizować .mf-modal-threads-picker');
assert.ok(cssContent.includes('.mf-dropdown-menu'), 'content.css musi stylizować .mf-dropdown-menu');
assert.ok(cssContent.includes('.mf-modal-overlay'), 'content.css musi stylizować .mf-modal-overlay');
assert.ok(cssContent.includes('.mf-header-pill'), 'content.css musi stylizować .mf-header-pill');
assert.ok(cssContent.includes('--surface-background'), 'content.css musi korzystać ze zmiennej --surface-background');
assert.ok(cssContent.includes('--web-wash'), 'content.css musi korzystać ze zmiennej --web-wash');
assert.ok(cssContent.includes('--primary-text'), 'content.css musi korzystać ze zmiennej --primary-text');
assert.ok(cssContent.includes('--secondary-text'), 'content.css musi korzystać ze zmiennej --secondary-text');
assert.ok(cssContent.includes('.mf-folder-settings-btn'), 'content.css musi stylizować .mf-folder-settings-btn');
assert.ok(cssContent.includes('.mf-modal-back-btn'), 'content.css musi stylizować .mf-modal-back-btn');
assert.ok(cssContent.includes('.mf-thread-hidden'), 'content.css musi zawierać regułę .mf-thread-hidden');
console.log('✓ content.css zawiera wszystkie wymagane selektory i zmienne motywu.');

// 9. showSettingsModal
console.log('Test 9: showSettingsModal()...');
ui.showSettingsModal();
assert.ok(ui.activeModal, 'Okno ustawień powinno zostać otwarte');
const wideModal = ui.activeModal.querySelector('.mf-modal-wide');
assert.ok(wideModal, 'Okno dialogowe powinno mieć klasę .mf-modal-wide');
const settingsNav = ui.activeModal.querySelector('.mf-settings-nav');
assert.ok(settingsNav, 'Okno powinno zawierać pasek nawigacji');
const navButtons = ui.activeModal.querySelectorAll('.mf-settings-nav-btn');
assert.strictEqual(navButtons.length, 3, 'Pasek nawigacji powinien mieć 3 zakładki');

// Sprawdzenie przejścia do zakładki Rozmowy
const threadsTabBtn = navButtons.find((b) => b.dataset.tab === 'threads');
assert.ok(threadsTabBtn, 'Zakładka Rozmowy powinna istnieć');
threadsTabBtn.dispatchEvent({ type: 'click' });
const searchBox = ui.activeModal.querySelector('.mf-settings-threads-search-box');
assert.ok(searchBox, 'Zakładka Rozmowy powinna zawierać pole wyszukiwania');

ui.closeModal();
assert.strictEqual(ui.activeModal, null, 'Okno powinno się zamknąć');
// 10. Wyszukiwanie folderów na pasku
console.log('Test 10: Weryfikacja wyszukiwarki folderów na pasku...');
const testBar = ui.renderFolderBar(sampleFolders, 'all');
const testSearchInput = testBar.querySelector('.mf-folder-search-input');
const testPills = testBar.querySelectorAll('.mf-folder-pill');
assert.strictEqual(testPills.length, 3, 'Powinny być 3 pigułki folderów');

// Wpisanie frazy 'Praca'
testSearchInput.value = 'Praca';
testSearchInput.dispatchEvent({ type: 'input' });

const hiddenPills = Array.from(testPills).filter((p) => p.classList.contains('mf-pill-hidden'));
const visiblePills = Array.from(testPills).filter((p) => !p.classList.contains('mf-pill-hidden'));
assert.strictEqual(visiblePills.length, 1, 'Tylko folder "Praca" powinien być widoczny');
assert.strictEqual(hiddenPills.length, 2, 'Pozostałe foldery muszą mieć klasę mf-pill-hidden');

// Wciśnięcie klawisza Enter powinno kliknąć pierwszy widoczny folder
let clickedPillId = null;
visiblePills[0].addEventListener('click', () => {
  clickedPillId = 'work';
});
testSearchInput.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} });
assert.strictEqual(clickedPillId, 'work', 'Enter w polu wyszukiwarki powinien wybrać pasujący folder');

// Wyszukiwanie po emoji (np. '👥')
testSearchInput.value = '👥';
testSearchInput.dispatchEvent({ type: 'input' });
const emojiVisible = Array.from(testPills).filter((p) => !p.classList.contains('mf-pill-hidden'));
assert.strictEqual(emojiVisible.length, 1, 'Folder "Znajomi" z ikoną 👥 powinien być widoczny');
assert.strictEqual(emojiVisible[0].dataset.folderId, 'friends');

// Wyczyszczenie wyszukiwarki
testSearchInput.value = '';
testSearchInput.dispatchEvent({ type: 'input' });
const allVisibleAgain = Array.from(testPills).filter((p) => !p.classList.contains('mf-pill-hidden'));
assert.strictEqual(allVisibleAgain.length, 3, 'Wszystkie foldery powinny znów być widoczne po wyczyszczeniu');
console.log('✓ Wyszukiwarka folderów filtruje pigułki i obsługuje klawisz Enter.');

// 11. filterChatRows oraz obsługa natywnego wyszukiwania Messengera
console.log('Test 11: filterChatRows() i natywne wyszukiwanie Messengera...');
let mockNativeSearchActive = false;
const mockDetector = {
  scanChatList() {
    return [
      { threadId: '101', name: 'Jan', rowElement: new MockElement('div') },
      { threadId: '102', name: 'Anna', rowElement: new MockElement('div') }
    ];
  },
  isMessengerSearchActive() {
    return mockNativeSearchActive;
  },
  getCurrentOpenChat() {
    return { threadId: '101', title: 'Jan' };
  }
};

const uiWithDetector = new MessengerUI({ detector: mockDetector });
const threadItems = mockDetector.scanChatList();
// Mockowanie scanChatList w samej instancji
uiWithDetector.detector.scanChatList = () => threadItems;

// Test a: Aktywny filtr 'work', Jan nie należy do 'work' -> Jan ukryty
uiWithDetector.filterChatRows('work', { 102: { folderId: 'work' } });
assert.ok(threadItems[0].rowElement.classList.contains('mf-thread-hidden'), 'Jan powinien być ukryty');
assert.ok(!threadItems[1].rowElement.classList.contains('mf-thread-hidden'), 'Anna powinna być widoczna');

// Test b: Użytkownik korzysta z natywnego wyszukiwania Messengera -> żaden wiersz nie jest ukrywany
mockNativeSearchActive = true;
uiWithDetector.filterChatRows('work', { 102: { folderId: 'work' } });
assert.ok(
  !threadItems[0].rowElement.classList.contains('mf-thread-hidden'),
  'Jan NIE może być ukryty podczas wyszukiwania na Messengerze'
);
assert.ok(
  !threadItems[1].rowElement.classList.contains('mf-thread-hidden'),
  'Anna NIE może być ukryta podczas wyszukiwania na Messengerze'
);
console.log('✓ filterChatRows() nie ukrywa wątków podczas natywnego wyszukiwania Messengera.');

// 12. Weryfikacja architektury modułowej (src/ui/*.js)
console.log('Test 12: Weryfikacja architektury modułowej (src/ui/*.js)...');

// a) MessengerUICore
const Core = require('../src/ui/core.js');
assert.strictEqual(typeof Core, 'object', 'MessengerUICore powinien być obiektem');
assert.strictEqual(Object.keys(Core.ICONS).length, 15, 'ICONS powinno zawierać 15 ikon');
assert.ok(Object.isFrozen(Core.ICONS), 'ICONS powinno być zamrożone');
assert.strictEqual(Core.DEFAULT_EMOJIS.length, 24, 'DEFAULT_EMOJIS powinno zawierać 24 emotikony');
assert.ok(Object.isFrozen(Core.DEFAULT_EMOJIS), 'DEFAULT_EMOJIS powinno być zamrożone');
assert.strictEqual(Core.DEFAULT_COLORS.length, 10, 'DEFAULT_COLORS powinno zawierać 10 kolorów');
assert.ok(Object.isFrozen(Core.DEFAULT_COLORS), 'DEFAULT_COLORS powinno być zamrożone');

// Test generateId
const id1 = Core.generateId();
const id2 = Core.generateId();
assert.ok(id1.startsWith('f_'), 'ID powinno zaczynać się od f_');
assert.notStrictEqual(id1, id2, 'generateId musi generować unikalne ID');

// Test escapeHtml
assert.strictEqual(Core.escapeHtml(null), '');
assert.strictEqual(Core.escapeHtml(undefined), '');
assert.strictEqual(Core.escapeHtml(42), '42');
assert.strictEqual(
  Core.escapeHtml('<script>alert("xss") & \'test\'</script>'),
  '&lt;script&gt;alert(&quot;xss&quot;) &amp; &#039;test&#039;&lt;/script&gt;'
);

// Test createIcon & setIcon
const iconDiv = new MockElement('div');
Core.setIcon(iconDiv, 'folder');
assert.strictEqual(iconDiv.children.length, 1, 'setIcon powinno dodać element ikony');

// Test setButtonContent
const btnEl = new MockElement('button');
Core.setButtonContent(btnEl, 'plus', 'Dodaj');
assert.strictEqual(btnEl.children.length, 2, 'setButtonContent powinno dodać ikonę oraz tekst');
assert.strictEqual(btnEl.children[1].textContent, 'Dodaj');

// Test createElement
const createdEl = Core.createElement('div', {
  className: 'custom-class',
  id: 'custom-id',
  textContent: 'Tekst',
  dataset: { folder: '123' },
  attributes: { 'aria-label': 'Etykieta' }
});
assert.strictEqual(createdEl.className, 'custom-class');
assert.strictEqual(createdEl.id, 'custom-id');
assert.strictEqual(createdEl.textContent, 'Tekst');
assert.strictEqual(createdEl.dataset.folder, '123');
assert.strictEqual(createdEl.getAttribute('aria-label'), 'Etykieta');

// Test showToast
Core.showToast('Test wiadomości');
const toastNode = mockBody.querySelector('.mf-toast');
assert.ok(toastNode, 'Element .mf-toast powinien istnieć');
assert.strictEqual(toastNode.textContent, 'Test wiadomości');

// b) FolderBarComponent
const FolderBarComp = require('../src/ui/folder-bar.js');
assert.strictEqual(typeof FolderBarComp, 'function', 'FolderBarComponent powinna być klasą');
const barInstance = new FolderBarComp(ui);
assert.strictEqual(typeof barInstance.render, 'function', 'FolderBarComponent powinien posiadać metodę render');

// c) FolderModalComponent
const FolderModalComp = require('../src/ui/folder-modal.js');
assert.strictEqual(typeof FolderModalComp, 'function', 'FolderModalComponent powinna być klasą');
const folderModalInstance = new FolderModalComp(ui);
assert.strictEqual(typeof folderModalInstance.show, 'function', 'FolderModalComponent powinien posiadać metodę show');
assert.strictEqual(typeof folderModalInstance.close, 'function', 'FolderModalComponent powinien posiadać metodę close');

// d) ThreadMenuComponent
const ThreadMenuComp = require('../src/ui/thread-menu.js');
assert.strictEqual(typeof ThreadMenuComp, 'function', 'ThreadMenuComponent powinna być klasą');
const threadMenuInstance = new ThreadMenuComp(ui);
assert.strictEqual(typeof threadMenuInstance.injectFolderBadge, 'function');
assert.strictEqual(typeof threadMenuInstance.renderHeaderPill, 'function');
assert.strictEqual(typeof threadMenuInstance.showAssignDropdown, 'function');

// e) SettingsModalComponent
const SettingsModalComp = require('../src/ui/settings-modal.js');
assert.strictEqual(typeof SettingsModalComp, 'function', 'SettingsModalComponent powinna być klasą');
const settingsModalInstance = new SettingsModalComp(ui);
assert.strictEqual(typeof settingsModalInstance.show, 'function');
assert.strictEqual(typeof settingsModalInstance.close, 'function');

// f) MessengerUI Facade integracja
assert.ok(ui.core, 'ui.core powinno być zdefiniowane');
assert.ok(ui.folderBar, 'ui.folderBar powinno być instancją FolderBarComponent');
assert.ok(ui.folderModal, 'ui.folderModal powinno być instancją FolderModalComponent');
assert.ok(ui.threadMenu, 'ui.threadMenu powinno być instancją ThreadMenuComponent');
assert.ok(ui.settingsModal, 'ui.settingsModal powinno być instancją SettingsModalComponent');

console.log('✓ Architektura modułowa zweryfikowana pomyślnie.');

// 4. Odznaki nieprzeczytanych w pigułkach folderów (MF-014)
console.log('Test 4: odznaki nieprzeczytanych (_updatePillBadges / updateFolderCounts)...');
const unreadBarComp = new FolderBarComp(ui);
const unreadBar = unreadBarComp.render(sampleFolders, 'all', { work: 2 }, { work: 0 });
if (!global.document.getElementById('mf-folder-bar')) {
  mockBody.appendChild(unreadBar);
}
const workPill = () => global.document.getElementById('mf-folder-bar').querySelectorAll('.mf-folder-pill')[1];
const unreadBadgeOf = (pill) => pill.querySelector('.mf-folder-unread-badge');

// MF-029 pkt 1-2: regresja może wstawić licznik przez innerHTML do zagnieżdżonego elementu,
// więc sprawdzamy całe poddrzewo pigułki (rekurencyjnie po children), a nie tylko źródło
// zapisane setterem mocka na samej pigułce.
const assertPillSubtreeHasNoPayload = (pill, context) => {
  const walk = (node) => {
    assert.notStrictEqual(node.tagName, 'IMG', `${context}: potomek <img> w pigułce`);
    assert.strictEqual(node.hasAttribute('onerror'), false, `${context}: atrybut onerror w pigułce`);
    assert.strictEqual(
      String(node.innerHTML || '').includes('onerror'),
      false,
      `${context}: źródło potomka zawiera „onerror”`
    );
    assert.strictEqual(
      String(node.textContent || '').includes('onerror'),
      false,
      `${context}: tekst potomka zawiera „onerror”`
    );
    node.children.forEach(walk);
  };
  walk(pill);
};
assert.strictEqual(workPill().dataset.folderId, 'work', 'Druga pigułka to folder "work"');
assert.strictEqual(unreadBadgeOf(workPill()), null, 'Brak odznaki przy 0 nieprzeczytanych');

for (const n of [1, 42, 99]) {
  unreadBarComp.updateFolderCounts({ work: 2 }, { work: n });
  const unreadBadge = unreadBadgeOf(workPill());
  assert.ok(unreadBadge, `Odznaka powinna istnieć przy ${n} nieprzeczytanych`);
  assert.strictEqual(unreadBadge.textContent, String(n), `Odznaka pokazuje liczbę ${n}`);
  assert.strictEqual(unreadBadge.innerHTML, '', 'Treść odznaki ustawiana przez textContent, nie innerHTML');
  assert.strictEqual(
    workPill().querySelectorAll('.mf-folder-unread-badge').length,
    1,
    'Kolejna aktualizacja nie dubluje odznaki'
  );
}

unreadBarComp.updateFolderCounts({ work: 2 }, { work: 100 });
assert.strictEqual(unreadBadgeOf(workPill()).textContent, '99+', 'Przy 100 nieprzeczytanych odznaka pokazuje 99+');

unreadBarComp.updateFolderCounts({ work: 2 }, { work: 0 });
assert.strictEqual(unreadBadgeOf(workPill()), null, 'Odznaka znika po spadku licznika do 0');

unreadBarComp.updateFolderCounts({ work: 2 }, { work: '<img src=x onerror=alert(1)>' });

// MF-027 pkt 4 / MF-029 pkt 1-2: mock nie parsuje niedomkniętego <img …>, więc samo „brak <img>”
// nie wykryłoby regresji. Sprawdzamy całe poddrzewo pigułki — asercje padają także wtedy, gdy
// licznik trafia przez innerHTML do zagnieżdżonego elementu, a nie do samej pigułki.
assertPillSubtreeHasNoPayload(workPill(), 'Licznik <img onerror>');
assert.strictEqual(unreadBadgeOf(workPill()), null, 'Nieliczbowa wartość licznika nie tworzy odznaki');

// Zachowanie, nie tekst źródła: złośliwy licznik nie tworzy żadnych elementów w pigułce
assert.strictEqual(workPill().querySelectorAll('img').length, 0, 'Licznik z <img onerror> nie tworzy elementu <img>');
assert.strictEqual(unreadBadgeOf(workPill()), null, 'Licznik z <img onerror> nie tworzy odznaki');
unreadBarComp.updateFolderCounts({ work: 2 }, { work: 7 });
assert.strictEqual(workPill().querySelectorAll('img').length, 0, 'Poprawna odznaka nie dodaje elementów <img>');
assert.strictEqual(unreadBadgeOf(workPill()).children.length, 0, 'Odznaka zawiera wyłącznie tekst, bez elementów');
unreadBarComp.updateFolderCounts({ work: 2 }, { work: 0 });
console.log('✓ Odznaka: brak przy 0, liczba 1–99, 99+ przy 100, usunięcie po spadku do 0, treść przez textContent.');

// MF-022 pkt 9: typ argumentu rozpoznawany per wpis, nie po pierwszej wartości
unreadBarComp.updateFolderCounts({ t1: { name: 'Bez folderu' }, t2: { folderId: 'work' }, t3: { folderId: 'work' } });
assert.strictEqual(
  workPill().querySelector('.mf-folder-count').textContent,
  '2',
  'Mapa wątków liczona poprawnie, choć pierwszy rekord nie ma folderId'
);
unreadBarComp.updateFolderCounts({ work: 5 });
assert.strictEqual(
  workPill().querySelector('.mf-folder-count').textContent,
  '5',
  'Mapa liczników { folderId: liczba }'
);
console.log('✓ updateFolderCounts() rozpoznaje rekordy wątków i liczniki per wpis.');

// 14. Dostępność klawiaturowa paska folderów: tablist, roving tabindex, strzałki (MF-013)
console.log('Test 14: pasek folderów jako tablist (roving tabindex, strzałki, Home/End)...');

// Czysty pasek w mockowanym dokumencie (poprzednie testy zostawiły własny)
const a11yPreviousBar = global.document.getElementById('mf-folder-bar');
if (a11yPreviousBar) a11yPreviousBar.remove();

const a11yComp = new FolderBarComp(ui);
const a11yBar = a11yComp.render(sampleFolders, 'work', { work: 4 });
mockBody.appendChild(a11yBar);

// Kontener pigułek = tablist (WAI-ARIA Tabs)
const tablistOf = () => a11yBar.querySelector('.mf-folder-scroll-container');
const pillsOf = () => tablistOf().querySelectorAll('.mf-folder-pill');
const idsOf = (list) => Array.from(list).map((p) => p.dataset.folderId);
const tabbablePills = () => Array.from(pillsOf()).filter((p) => p.getAttribute('tabindex') === '0');
const visibleIdsOf = () => idsOf(Array.from(pillsOf()).filter((p) => !p.classList.contains('mf-pill-hidden')));
const focusedId = () => (global.document.activeElement ? global.document.activeElement.dataset.folderId : null);

assert.strictEqual(tablistOf().getAttribute('role'), 'tablist', 'Kontener pigułek musi mieć role="tablist"');
assert.strictEqual(
  tablistOf().getAttribute('aria-label'),
  'Foldery rozmów',
  'Tablist musi mieć aria-label="Foldery rozmów"'
);
assert.strictEqual(
  tablistOf().getAttribute('aria-orientation'),
  'horizontal',
  'Tablist musi mieć aria-orientation="horizontal"'
);
assert.deepStrictEqual(idsOf(pillsOf()), ['all', 'work', 'friends'], 'Pigułki w kolejności folderów');
Array.from(pillsOf()).forEach((pill) => {
  assert.strictEqual(pill.getAttribute('role'), 'tab', 'Każda pigułka musi mieć role="tab"');
});

// Tablist zawiera wyłącznie karty — przycisk „Dodaj nowy folder” jest rodzeństwem kontenera
const pillsRowOf = () => a11yBar.querySelector('.mf-folder-pills-row');
const a11yAddBtn = pillsRowOf().querySelector('.mf-folder-add-btn');
assert.ok(a11yAddBtn, 'Przycisk „Dodaj nowy folder” powinien istnieć w rzędzie pigułek');
assert.strictEqual(
  tablistOf().querySelector('.mf-folder-add-btn'),
  null,
  'Przycisk „Dodaj nowy folder” nie może znajdować się wewnątrz role="tablist"'
);
assert.strictEqual(
  tablistOf().children.filter((child) => child.getAttribute('role') !== 'tab').length,
  0,
  'Tablist nie może zawierać elementów innych niż role="tab"'
);
assert.strictEqual(tabbablePills().length, 1, 'Dokładnie jedna pigułka jest przystankiem Tab');
assert.strictEqual(tabbablePills()[0].dataset.folderId, 'work', 'Przystankiem Tab jest pigułka aktywna');
assert.deepStrictEqual(
  idsOf(Array.from(pillsOf()).filter((p) => p.getAttribute('tabindex') === '-1')),
  ['all', 'friends'],
  'Pozostałe pigułki mają tabindex="-1"'
);

// Symulacja klawisza na tabliście (w przeglądarce zdarzenie bąbelkuje z pigułki z fokusem)
const pressKey = (key, target, modifiers = {}) => {
  let prevented = false;
  tablistOf().dispatchEvent({
    type: 'keydown',
    key,
    target: target || null,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {}
  });
  return prevented;
};

// W przeglądarce `event.target` to pigułka z fokusem
const pressFromFocus = (key, modifiers) => pressKey(key, global.document.activeElement, modifiers);

// ArrowRight: następna pigułka, bez zmiany aktywnego folderu
assert.strictEqual(pressKey('ArrowRight', pillsOf()[1]), true, 'ArrowRight jest przechwytywana przez tablist');
assert.strictEqual(focusedId(), 'friends', 'ArrowRight przenosi fokus na następną pigułkę');
assert.strictEqual(tabbablePills()[0].dataset.folderId, 'friends', 'Roving tabindex podąża za fokusem');
assert.ok(!pillsOf()[2].classList.contains('mf-active'), 'Sam ruch fokusu nie aktywuje folderu');
assert.ok(pillsOf()[1].classList.contains('mf-active'), 'Aktywny folder pozostaje bez zmian');

// Zawijanie w obie strony
assert.strictEqual(pressFromFocus('ArrowRight'), true, 'ArrowRight jest obsługiwana');
assert.strictEqual(focusedId(), 'all', 'ArrowRight z ostatniej pigułki zawija do pierwszej');
assert.strictEqual(pressFromFocus('ArrowLeft'), true, 'ArrowLeft jest obsługiwana');
assert.strictEqual(focusedId(), 'friends', 'ArrowLeft z pierwszej pigułki zawija do ostatniej');

// Home i End
assert.strictEqual(pressFromFocus('End'), true, 'End jest obsługiwana');
assert.strictEqual(focusedId(), 'friends', 'End przenosi fokus na ostatnią pigułkę');
assert.strictEqual(pressFromFocus('Home'), true, 'Home jest obsługiwana');
assert.strictEqual(focusedId(), 'all', 'Home przenosi fokus na pierwszą pigułkę');

// Pigułka z fokusem jest przewijana do widoku
pillsOf()[2].lastScrollIntoView = null;
pressFromFocus('Home');
assert.deepStrictEqual(
  pillsOf()[0].lastScrollIntoView,
  { inline: 'nearest', block: 'nearest' },
  'Pigułka z fokusem jest przewijana do widoku'
);

// Klawisze spoza wzorca nie zmieniają fokusu
global.document.activeElement = null;
assert.strictEqual(pressKey('a', pillsOf()[0]), false, 'Zwykły klawisz nie jest przechwytywany');
assert.strictEqual(focusedId(), null, 'Zwykły klawisz nie przenosi fokusu');

// Zdarzenia z elementów innych niż pigułka nie kradną fokusu paskowi folderów
assert.strictEqual(
  pressKey('ArrowRight', tablistOf()),
  false,
  'Strzałka na samym kontenerze tablisty nie jest przechwytywana'
);
assert.strictEqual(focusedId(), null, 'Strzałka na kontenerze tablisty nie przenosi fokusu');
const nestedInPill = pillsOf()[0].querySelector('.mf-folder-icon');
assert.strictEqual(
  pressKey('ArrowLeft', nestedInPill),
  false,
  'Zdarzenie z elementu zagnieżdżonego w pigułce nie jest przechwytywane'
);
assert.strictEqual(pressKey('End', a11yAddBtn), false, 'End na przycisku „Dodaj nowy folder” nie jest przechwytywany');
assert.strictEqual(
  pressKey('Home', a11yAddBtn),
  false,
  'Home na przycisku „Dodaj nowy folder” nie jest przechwytywany'
);
assert.strictEqual(focusedId(), null, 'Klawisze na obcych elementach nie przenoszą fokusu');
assert.strictEqual(tabbablePills().length, 1, 'Klawisze na obcych elementach nie psują przystanku Tab');
assert.strictEqual(tabbablePills()[0].dataset.folderId, 'all', 'Przystanek Tab zostaje na dotychczasowej pigułce');

// Kombinacje z modyfikatorem (Alt/Ctrl/Meta/Shift) są pomijane
assert.strictEqual(
  pressKey('ArrowRight', pillsOf()[0], { shiftKey: true }),
  false,
  'Shift+ArrowRight nie jest przechwytywany'
);
assert.strictEqual(
  pressKey('ArrowLeft', pillsOf()[0], { altKey: true }),
  false,
  'Alt+ArrowLeft nie jest przechwytywany'
);
assert.strictEqual(pressKey('End', pillsOf()[0], { ctrlKey: true }), false, 'Ctrl+End nie jest przechwytywany');
assert.strictEqual(pressKey('Home', pillsOf()[0], { metaKey: true }), false, 'Meta+Home nie jest przechwytywany');
assert.strictEqual(focusedId(), null, 'Klawisze z modyfikatorem nie przenoszą fokusu');
assert.strictEqual(tabbablePills()[0].dataset.folderId, 'all', 'Klawisze z modyfikatorem nie zmieniają przystanku Tab');

// Pigułki ukryte filtrem wyszukiwania są pomijane
const a11ySearch = a11yBar.querySelector('.mf-folder-search-input');
a11ySearch.value = 'a';
a11ySearch.dispatchEvent({ type: 'input' });
assert.deepStrictEqual(visibleIdsOf(), ['work', 'friends'], 'Filtr "a" ukrywa folder "Wszystkie"');
assert.strictEqual(tabbablePills().length, 1, 'Nadal dokładnie jedna pigułka na przystanku Tab');
assert.strictEqual(tabbablePills()[0].dataset.folderId, 'work', 'Ukryta pigułka nie zostaje przystankiem Tab');

global.document.activeElement = null;
assert.strictEqual(pressKey('ArrowRight', pillsOf()[1]), true, 'ArrowRight działa przy aktywnym filtrze');
assert.strictEqual(focusedId(), 'friends', 'Fokus przechodzi na następną widoczną pigułkę');
assert.strictEqual(pressFromFocus('ArrowRight'), true, 'ArrowRight działa przy aktywnym filtrze');
assert.strictEqual(focusedId(), 'work', 'Zawijanie pomija pigułki ukryte filtrem');
assert.strictEqual(pressFromFocus('End'), true, 'End działa przy aktywnym filtrze');
assert.strictEqual(focusedId(), 'friends', 'End trafia na ostatnią widoczną pigułkę');
assert.strictEqual(pressFromFocus('Home'), true, 'Home działa przy aktywnym filtrze');
assert.strictEqual(focusedId(), 'work', 'Home trafia na pierwszą widoczną pigułkę');

a11ySearch.value = '';
a11ySearch.dispatchEvent({ type: 'input' });
assert.deepStrictEqual(visibleIdsOf(), ['all', 'work', 'friends'], 'Wyczyszczenie filtra pokazuje wszystkie pigułki');

// Fokus nadany z zewnątrz (np. kliknięcie myszą) też przenosi przystanek Tab
pillsOf()[0].focus();
assert.strictEqual(tabbablePills().length, 1, 'Nadal dokładnie jedna pigułka na przystanku Tab');
assert.strictEqual(tabbablePills()[0].dataset.folderId, 'all', 'Fokus z zewnątrz przenosi przystanek Tab');

// Niezmiennik po updateFolderCounts(): przystanek Tab zostaje tam, gdzie jest w DOM —
// aktualizacja liczników nie może cofać go na pigułkę aktywną
a11yComp.updateFolderCounts({ work: 4 }, { work: 5 });
assert.strictEqual(tabbablePills().length, 1, 'Po updateFolderCounts() nadal dokładnie jeden przystanek Tab');
assert.strictEqual(
  tabbablePills()[0].dataset.folderId,
  'all',
  'updateFolderCounts() nie cofa przystanku Tab na pigułkę aktywną'
);

// Jedno źródło prawdy (tabindex w DOM): strzałka → updateFolderCounts() → filtr wyszukiwania
// nie rozjeżdżają przystanku Tab z pigułką wskazaną strzałkami
global.document.activeElement = null;
assert.strictEqual(pressKey('ArrowRight', pillsOf()[0]), true, 'ArrowRight przenosi fokus na kolejną pigułkę');
assert.strictEqual(focusedId(), 'work', 'Fokus na pigułce "work"');
assert.strictEqual(tabbablePills().length, 1, 'Dokładnie jedna pigułka z tabindex="0" po strzałce');
assert.strictEqual(tabbablePills()[0].dataset.folderId, 'work', 'Przystanek Tab na pigułce wskazanej strzałką');

assert.strictEqual(pressKey('ArrowRight', pillsOf()[1]), true, 'ArrowRight działa na pigułce nieaktywnej');
assert.strictEqual(focusedId(), 'friends', 'Fokus na nieaktywnej pigułce "friends"');
a11yComp.updateFolderCounts({ work: 4 }, { work: 2 });
assert.strictEqual(tabbablePills().length, 1, 'Dokładnie jedna pigułka z tabindex="0" po updateFolderCounts()');
assert.strictEqual(
  tabbablePills()[0].dataset.folderId,
  'friends',
  'updateFolderCounts() zachowuje przystanek Tab na pigułce wskazanej strzałkami'
);

a11ySearch.value = 'a';
a11ySearch.dispatchEvent({ type: 'input' });
assert.deepStrictEqual(visibleIdsOf(), ['work', 'friends'], 'Filtr "a" ukrywa folder "Wszystkie"');
assert.strictEqual(tabbablePills().length, 1, 'Dokładnie jedna pigułka z tabindex="0" po filtrze');
assert.strictEqual(
  tabbablePills()[0].dataset.folderId,
  'friends',
  'Filtr zachowuje przystanek Tab na widocznej pigułce wskazanej strzałkami'
);

// Gdy pigułka z przystankiem Tab wypada z puli widocznych, przystanek przechodzi na aktywną
a11ySearch.value = 'Praca';
a11ySearch.dispatchEvent({ type: 'input' });
assert.deepStrictEqual(visibleIdsOf(), ['work'], 'Filtr "Praca" zostawia wyłącznie folder "work"');
assert.strictEqual(tabbablePills().length, 1, 'Dokładnie jedna pigułka z tabindex="0" po filtrze ukrywającym');
assert.strictEqual(
  tabbablePills()[0].dataset.folderId,
  'work',
  'Ukrycie pigułki z przystankiem Tab przenosi go na pigułkę aktywną'
);

a11ySearch.value = '';
a11ySearch.dispatchEvent({ type: 'input' });
assert.deepStrictEqual(visibleIdsOf(), ['all', 'work', 'friends'], 'Wyczyszczenie filtra pokazuje wszystkie pigułki');

// Niezmiennik po ponownym renderze bez zmiany struktury (aktualizacja w miejscu)
a11yComp.render(sampleFolders, 'friends', { work: 4 });
assert.strictEqual(pillsOf().length, 3, 'Ponowny render nie duplikuje pigułek');
assert.strictEqual(tabbablePills().length, 1, 'Po ponownym renderze nadal dokładnie jeden przystanek Tab');
assert.strictEqual(tabbablePills()[0].dataset.folderId, 'friends', 'Przystanek Tab podąża za nową aktywną pigułką');

// Niezmiennik po pełnym renderze (zmiana struktury folderów)
a11yComp.render([...sampleFolders, { id: 'family', name: 'Rodzina', icon: '🏠' }], 'work', { work: 4 });
assert.strictEqual(pillsOf().length, 4, 'Pełny render buduje pigułkę nowego folderu');
assert.strictEqual(tablistOf().getAttribute('role'), 'tablist', 'Pełny render zachowuje role="tablist" na kontenerze');
assert.strictEqual(tabbablePills().length, 1, 'Po pełnym renderze dokładnie jedna pigułka na przystanku Tab');
assert.strictEqual(
  tabbablePills()[0].dataset.folderId,
  'work',
  'Po pełnym renderze przystanek Tab na aktywnej pigułce'
);

console.log('✓ Pasek folderów: tablist, roving tabindex, strzałki/Home/End z zawijaniem, pomijanie ukrytych.');

// 15. Skróty klawiszowe Alt+1…9 i Alt+0 (MF-012)
console.log('Test 15: skróty Alt+1…9 / Alt+0 przełączające foldery...');
const UICore = require('../src/ui/core.js');
const keyEvent = (code, extra = {}) => {
  const event = {
    type: 'keydown',
    code,
    key: code.replace('Digit', ''),
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false,
    getModifierState: () => false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...extra
  };
  return event;
};
const shortcutIds = ['all', 'work', 'friends'];

// resolveFolderShortcut
assert.strictEqual(UICore.resolveFolderShortcut(keyEvent('Digit0'), shortcutIds), 'all', 'Alt+0 → "all"');
assert.strictEqual(
  UICore.resolveFolderShortcut(keyEvent('Digit1'), shortcutIds),
  'work',
  'Alt+1 → 1. folder użytkownika'
);
assert.strictEqual(UICore.resolveFolderShortcut(keyEvent('Digit2'), shortcutIds), 'friends', 'Alt+2 → 2. folder');
assert.strictEqual(UICore.resolveFolderShortcut(keyEvent('Digit3'), shortcutIds), null, 'Brak 3. folderu → null');
assert.strictEqual(
  UICore.resolveFolderShortcut(keyEvent('Digit1', { key: '¡' }), shortcutIds),
  'work',
  'macOS: Option+1 (key "¡") rozpoznany po code "Digit1"'
);
assert.strictEqual(
  UICore.resolveFolderShortcut(keyEvent('Digit1', { altKey: false }), shortcutIds),
  null,
  'Bez Alt → null'
);
assert.strictEqual(
  UICore.resolveFolderShortcut(keyEvent('Digit1', { ctrlKey: true }), shortcutIds),
  null,
  'Ctrl → null'
);
assert.strictEqual(
  UICore.resolveFolderShortcut(keyEvent('Digit1', { metaKey: true }), shortcutIds),
  null,
  'Meta → null'
);
assert.strictEqual(
  UICore.resolveFolderShortcut(keyEvent('Digit1', { shiftKey: true }), shortcutIds),
  null,
  'Shift → null'
);
assert.strictEqual(
  UICore.resolveFolderShortcut(keyEvent('Digit1', { getModifierState: (m) => m === 'AltGraph' }), shortcutIds),
  null,
  'AltGraph → null'
);
assert.strictEqual(UICore.resolveFolderShortcut(keyEvent('KeyA', { key: 'a' }), shortcutIds), null, 'Alt+A → null');

// isTypingTarget
for (const tag of ['input', 'textarea', 'select']) {
  assert.strictEqual(UICore.isTypingTarget(new MockElement(tag)), true, `<${tag}> to pole do pisania`);
}
const editableBox = new MockElement('div');
editableBox.setAttribute('contenteditable', 'true');
const editableChild = editableBox.appendChild(new MockElement('span'));
assert.strictEqual(UICore.isTypingTarget(editableBox), true, 'contenteditable to pole do pisania');
assert.strictEqual(UICore.isTypingTarget(editableChild), true, 'Potomek contenteditable to pole do pisania');
const textboxRole = new MockElement('div');
textboxRole.setAttribute('role', 'textbox');
const textboxChild = textboxRole.appendChild(new MockElement('p'));
assert.strictEqual(UICore.isTypingTarget(textboxRole), true, 'role="textbox" to pole do pisania');
assert.strictEqual(UICore.isTypingTarget(textboxChild), true, 'Potomek role="textbox" to pole do pisania');
const notEditable = new MockElement('div');
notEditable.setAttribute('contenteditable', 'false');
assert.strictEqual(UICore.isTypingTarget(notEditable), false, 'contenteditable="false" nie jest polem do pisania');
assert.strictEqual(UICore.isTypingTarget(new MockElement('button')), false, 'Przycisk nie jest polem do pisania');
assert.strictEqual(UICore.isTypingTarget(null), false, 'null nie jest polem do pisania');

// Listener _handleFolderShortcut() na pasku z dokumentu
const shortcutClicks = [];
pillsOf().forEach((pill) => pill.addEventListener('click', () => shortcutClicks.push(pill.dataset.folderId)));
global.document.activeElement = null;

const hitEvent = keyEvent('Digit1', { target: global.document.body });
assert.strictEqual(ui._handleFolderShortcut(hitEvent), true, 'Alt+1 przełącza folder');
assert.deepStrictEqual(shortcutClicks, ['work'], 'Alt+1 klika pigułkę 1. folderu użytkownika');
assert.strictEqual(hitEvent.defaultPrevented, true, 'Trafienie wywołuje preventDefault()');

const allEvent = keyEvent('Digit0', { target: global.document.body });
assert.strictEqual(ui._handleFolderShortcut(allEvent), true, 'Alt+0 przełącza folder');
assert.deepStrictEqual(shortcutClicks, ['work', 'all'], 'Alt+0 klika pigułkę "Wszystkie"');

const missEvent = keyEvent('Digit9', { target: global.document.body });
assert.strictEqual(ui._handleFolderShortcut(missEvent), false, 'Alt+9 bez 9. folderu nic nie robi');
assert.strictEqual(missEvent.defaultPrevented, false, 'Brak trafienia — bez preventDefault()');

const typingEvent = keyEvent('Digit1', { target: editableChild });
assert.strictEqual(ui._handleFolderShortcut(typingEvent), false, 'Alt+1 w polu wiadomości nic nie robi');
assert.strictEqual(typingEvent.defaultPrevented, false, 'Pisanie — bez preventDefault()');

global.document.activeElement = new MockElement('textarea');
const focusedTypingEvent = keyEvent('Digit1', { target: global.document.body });
assert.strictEqual(ui._handleFolderShortcut(focusedTypingEvent), false, 'Fokus w polu tekstowym blokuje skrót');
global.document.activeElement = null;

ui.activeModal = new MockElement('div');
const modalEvent = keyEvent('Digit1', { target: global.document.body });
assert.strictEqual(ui._handleFolderShortcut(modalEvent), false, 'Otwarty modal blokuje skrót');
assert.strictEqual(modalEvent.defaultPrevented, false, 'Otwarty modal — bez preventDefault()');
ui.activeModal = null;
assert.deepStrictEqual(shortcutClicks, ['work', 'all'], 'Zablokowane skróty nie klikają pigułek');

console.log('✓ Skróty: Alt+0/Alt+N, code zamiast key, odrzucanie modyfikatorów i AltGraph, strażnik pisania i modalu.');

// 16. Znaleziska LOW przeglądu MF-017 (MF-022): awatary, ID wątków, edytor reguł
async function runLowFindingsTests() {
  console.log('Test 16: awatary spoza dozwolonych hostów, ID __proto__, edytor reguł (MF-022)...');
  // Ten plik nie deklaruje `chrome` — storage.js i rules.js nie mogą rzucać ReferenceError (pkt 3)
  assert.strictEqual(typeof chrome, 'undefined', 'Testy UI działają bez globalnego chrome');
  const { MessengerFoldersStorage, sanitizeAvatarUrl } = require('../src/storage.js');
  const { MessengerRulesEngine } = require('../src/rules.js');

  // Pamięć w RAM z synchronicznymi wywołaniami zwrotnymi (jak chrome.storage.local, bez chrome)
  const memoryArea = (initial = {}) => ({
    store: JSON.parse(JSON.stringify(initial)),
    get(keys, cb) {
      const out = {};
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        if (this.store[k] !== undefined) out[k] = JSON.parse(JSON.stringify(this.store[k]));
      }
      cb(out);
    },
    set(items, cb) {
      Object.assign(this.store, JSON.parse(JSON.stringify(items)));
      if (cb) cb();
    }
  });

  // a) sanitizeAvatarUrl — pkt 10
  const goodAvatar = 'https://scontent.xx.fbcdn.net/v/t1.0/p100x100/a.jpg?oh=1';
  assert.strictEqual(sanitizeAvatarUrl(goodAvatar), goodAvatar, 'CDN Facebooka (fbcdn.net) dozwolony');
  assert.strictEqual(sanitizeAvatarUrl('https://lookaside.fbsbx.com/x.png'), 'https://lookaside.fbsbx.com/x.png');
  assert.strictEqual(sanitizeAvatarUrl('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
  for (const bad of [
    'https://evil.example/track.png',
    'https://fbcdn.net.evil.example/a.jpg',
    'https://evilfbcdn.net/a.jpg',
    'http://scontent.xx.fbcdn.net/a.jpg',
    'https://user:pw@scontent.xx.fbcdn.net/a.jpg',
    'https://scontent.xx.fbcdn.net:8443/a.jpg',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=',
    '//scontent.xx.fbcdn.net/a.jpg',
    { href: goodAvatar },
    null
  ]) {
    assert.strictEqual(sanitizeAvatarUrl(bad), '', `Odrzucony awatar: ${JSON.stringify(bad)}`);
  }

  // b) Import JSON: złe awatary czyszczone, wątek "__proto__" pominięty — pkt 10 i 12
  const importStorage = new MessengerFoldersStorage(memoryArea());
  await importStorage.init();
  await importStorage.importData(
    '{"folders":[{"id":"work","name":"Praca"}],"threads":{' +
      '"111":{"folderId":"work","avatar":"https://evil.example/a.png"},' +
      '"222":{"folderId":"work","avatar":"' +
      goodAvatar +
      '"},' +
      '"__proto__":{"folderId":"work","polluted":true}}}'
  );
  const importedThreads = importStorage.getAllThreadsSync();
  assert.strictEqual(importedThreads['111'].avatar, '', 'Awatar z obcego hosta wyczyszczony przy imporcie');
  assert.strictEqual(importedThreads['222'].avatar, goodAvatar, 'Awatar z CDN zachowany przy imporcie');
  assert.strictEqual(
    Object.getPrototypeOf(importStorage._threads),
    Object.prototype,
    'Prototyp mapy wątków nietknięty'
  );
  assert.strictEqual(importStorage._threads.polluted, undefined, 'Brak właściwości z wątku "__proto__"');
  assert.deepStrictEqual(Object.keys(importedThreads).sort(), ['111', '222'], 'Wątek "__proto__" pominięty');

  // c) Zapis i wczytanie: assignThread / applyAutoAssignments / init — pkt 10 i 12
  await assert.rejects(importStorage.assignThread('__proto__', 'work'), /Identyfikator wątku/, '__proto__ odrzucony');
  const autoApplied = await importStorage.applyAutoAssignments([
    { threadId: '__proto__', folderId: 'work', expectedFolderId: null },
    { threadId: '333', folderId: 'work', expectedFolderId: null, metadata: { avatar: 'https://evil.example/b.png' } }
  ]);
  assert.deepStrictEqual(autoApplied, ['333'], 'Automatyczne przypisanie pomija __proto__');
  assert.strictEqual(importStorage.getAllThreadsSync()['333'].avatar, '', 'Awatar z reguł też walidowany');
  const assigned = await importStorage.assignThread('444', 'work', { avatar: 'https://evil.example/c.png' });
  assert.strictEqual(assigned.avatar, '', 'assignThread() nie zapisuje awatara z obcego hosta');
  const legacyStorage = new MessengerFoldersStorage(
    memoryArea({ mf_threads: { 555: { folderId: 'work', avatar: 'https://evil.example/d.png' } } })
  );
  await legacyStorage.init();
  assert.strictEqual(legacyStorage.getAllThreadsSync()['555'].avatar, '', 'Stare dane czyszczone przy init()');

  // d) Zakładka Rozmowy: img.src tylko z dozwolonych hostów — pkt 10 (kryterium akceptacji)
  const folders = [
    { id: 'all', name: 'Wszystkie', icon: '💬' },
    { id: 'work', name: 'Praca', icon: '💼' },
    { id: 'friends', name: 'Znajomi', icon: '👥' },
    { id: 'uncategorized', name: 'Inne', icon: '📁' }
  ];
  const toasts = [];
  const rulesArea = memoryArea({
    mf_rules: [
      {
        id: 'r_old',
        name: 'Stary RegEx',
        folderId: 'work',
        priority: '7',
        conditions: [{ field: 'name', operator: 'regex', value: '(foo|bar)+' }]
      },
      { id: 'r_gone', name: 'Usunięty folder', folderId: 'deleted', conditions: [{ value: 'x' }] }
    ]
  });
  const fakeUi = {
    activeModal: null,
    storage: {
      getFoldersSync: () => folders.map((f) => ({ ...f })),
      _threads: {
        t1: { name: 'Projekt Alfa', folderId: 'friends', avatar: 'https://evil.example/track.png' },
        t2: { name: 'Projekt Beta', folderId: 'uncategorized', avatar: goodAvatar },
        t3: { name: 'Inna', avatar: 'javascript:alert(1)' }
      }
    },
    detector: { scanChatList: () => [] },
    rulesEngine: new MessengerRulesEngine({ storageArea: rulesArea }),
    showToast: (msg) => toasts.push(msg),
    onRulesChanged: async () => {}
  };
  const modalComp = new SettingsModalComp(fakeUi);
  modalComp.show({ defaultTab: 'threads' });
  const avatarSrcs = fakeUi.activeModal.querySelectorAll('img').map((img) => img.src);
  assert.deepStrictEqual(avatarSrcs, [goodAvatar], 'Do img.src trafia tylko awatar z CDN Messengera');
  assert.strictEqual(
    fakeUi.activeModal.querySelectorAll('.mf-settings-thread-avatar-placeholder').length,
    2,
    'Odrzucone awatary zastąpione zaślepką'
  );
  modalComp.close();

  // e) Zakładka Reguły: powód nieaktywności — pkt 13 (RegEx sprzed budżetu) i pkt 5 (brak folderu)
  modalComp.show({ defaultTab: 'rules' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const ruleItems = fakeUi.activeModal.querySelectorAll('.mf-settings-rule-item');
  assert.strictEqual(ruleItems.length, 2, 'Lista pokazuje obie reguły');
  const problemOf = (item) => item.querySelector('.mf-rule-problem');
  assert.ok(problemOf(ruleItems[0]).textContent.startsWith('Nieaktywna: Wyrażenie „(foo|bar)+”'), 'RegEx ma powód');
  assert.ok(ruleItems[0].classList.contains('mf-rule-inactive'), 'Reguła oznaczona jako nieaktywna');
  assert.ok(problemOf(ruleItems[1]).textContent.includes('Folder docelowy nie istnieje'), 'Brak folderu ma powód');

  // f) Edytor: priorytet przez normalizePriority, bez „Inne”, zaślepka usuniętego folderu — pkt 4 i 5
  const editBtnOf = (item) => item.querySelectorAll('button').find((b) => b.title === 'Edytuj regułę');
  editBtnOf(ruleItems[0]).onclick();
  assert.strictEqual(global.document.getElementById('mf-rule-priority-input').value, '7', 'Priorytet "7" → 7');
  let optionValues = global.document.getElementById('mf-rule-folder-select').children.map((o) => o.value);
  assert.deepStrictEqual(optionValues, ['work', 'friends'], 'Bez "Wszystkie" i "Inne" na liście folderów');
  global.document
    .getElementById('mf-rule-folder-select')
    .parentElement.parentElement.parentElement.parentElement.remove();

  editBtnOf(ruleItems[1]).onclick();
  const missingSelect = global.document.getElementById('mf-rule-folder-select');
  optionValues = missingSelect.children.map((o) => o.value);
  assert.deepStrictEqual(optionValues, ['', 'work', 'friends'], 'Usunięty folder: pusta opcja na początku');
  assert.strictEqual(missingSelect.children[0].selected, true, 'Pusta opcja wybrana — brak cichej podmiany');
  missingSelect.parentElement.parentElement.parentElement.parentElement.remove();

  // g) Podgląd liczby dopasowań uwzględnia overwriteManual — pkt 7
  fakeUi.activeModal.querySelector('#mf-rules-add-btn').onclick();
  const editor = global.document.getElementById('mf-rule-folder-select').parentElement.parentElement.parentElement;
  const valInput = editor.querySelector('.mf-rule-condition-val');
  valInput.value = 'Projekt';
  valInput.oninput();
  const preview = editor.querySelector('.mf-rule-dry-run-preview');
  assert.strictEqual(preview.textContent, 'Liczba pasujących czatów: 1', 'Ręczne przypisanie (t1) chronione');
  const owCheckbox = global.document.getElementById('mf-rule-overwrite-manual');
  owCheckbox.checked = true;
  owCheckbox.onchange();
  assert.strictEqual(preview.textContent, 'Liczba pasujących czatów: 2', 'Z overwriteManual liczy też t1');

  // h) Zapis: priorytet przycięty do 0–100, wyjątek po zapisie nie ucieka z onclick — pkt 4 i 6
  global.document.getElementById('mf-rule-name-input').value = 'Projekty';
  global.document.getElementById('mf-rule-folder-select').value = 'work';
  global.document.getElementById('mf-rule-priority-input').value = '250';
  fakeUi.onRulesChanged = async () => {
    throw new Error('awaria odświeżania');
  };
  const saveBtn = editor.querySelectorAll('button').find((b) => b.textContent === 'Zapisz regułę');
  await saveBtn.onclick();
  assert.ok(
    toasts.some((t) => t === 'Błąd podczas zapisywania reguły: awaria odświeżania'),
    'Błąd zapisu pokazany w komunikacie zamiast nieobsłużonego odrzucenia'
  );
  const savedRule = (await fakeUi.rulesEngine.getRules()).find((r) => r.name === 'Projekty');
  assert.strictEqual(savedRule.priority, 100, 'Priorytet 250 zapisany jako 100');
  modalComp.close();

  console.log(
    '✓ Awatary tylko z CDN/data:image, __proto__ odrzucony, edytor reguł: priorytet, foldery, podgląd, błędy.'
  );
}

runLowFindingsTests()
  .then(() => {
    console.log('\n=============================================');
    console.log('WSZYSTKIE TESTY INTERFEJSU ZAKOŃCZONE SUKCESEM! ✓');
    console.log('=============================================');
  })
  .catch((err) => {
    console.error('BŁĄD PODCZAS WYKONYWANIA TESTÓW INTERFEJSU:', err);
    process.exit(1);
  });
