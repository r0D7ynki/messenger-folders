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
  add(...cls) { cls.forEach(c => this._classes.add(c)); }
  remove(...cls) { cls.forEach(c => this._classes.delete(c)); }
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
  contains(cls) { return this._classes.has(cls); }
  get value() { return Array.from(this._classes).join(' '); }
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
      setProperty(k, v) { this._props[k] = v; },
      removeProperty(k) { delete this._props[k]; },
      getPropertyValue(k) { return this._props[k] || ''; }
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

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
  hasAttribute(k) { return k in this.attributes; }
  removeAttribute(k) { delete this.attributes[k]; }

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
      const attr = selector.replace(/[\[\]"]/g, '').split('=')[0];
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
    handlers.forEach(h => h(event));
  }

  getBoundingClientRect() {
    return { top: 100, bottom: 130, left: 50, right: 150, width: 100, height: 30 };
  }

  focus() {}
}

// Konfiguracja globalnego mocka document i window
const mockBody = new MockElement('body');
global.document = {
  body: mockBody,
  createElement(tag) { return new MockElement(tag); },
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
  querySelector(sel) { return mockBody.querySelector(sel); },
  querySelectorAll(sel) { return mockBody.querySelectorAll(sel); },
  addEventListener() {},
  removeEventListener() {}
};

global.window = {
  innerWidth: 1200,
  innerHeight: 800,
  addEventListener() {}
};
global.requestAnimationFrame = (fn) => fn();

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
  (id) => { selectedId = id; },
  () => { addClicked = true; },
  (folder) => { editedFolder = folder; }
);

assert.strictEqual(bar.id, 'mf-folder-bar', 'Element paska powinien mieć ID #mf-folder-bar');
const pills = bar.querySelectorAll('.mf-folder-pill');
assert.strictEqual(pills.length, 3, 'Powinny powstać 3 pigułki folderów');

// Sprawdzenie aktywnej pigułki
const activePill = bar.querySelector('.mf-active');
assert.ok(activePill, 'Jedna pigułka musi być aktywna');
assert.strictEqual(activePill.dataset.folderId, 'work', 'Aktywny folder to "work"');

// Sprawdzenie przycisku dodawania
const addBtn = bar.querySelector('.mf-folder-add-btn');
assert.ok(addBtn, 'Przycisk dodawania paska powinien istnieć');
addBtn.dispatchEvent({ type: 'click' });
assert.strictEqual(addClicked, true, 'Kliknięcie w dodawanie powinno wywołać callback');

// Sprawdzenie przycisku ustawień
const settingsBtn = bar.querySelector('.mf-folder-settings-btn');
assert.ok(settingsBtn, 'Przycisk ustawień powinien istnieć na pasku');

// Sprawdzenie wyboru pigułki
pills[2].dispatchEvent({ type: 'click' });
assert.strictEqual(selectedId, 'friends', 'Kliknięcie pigułki powinno wywołać onSelectFolder');

console.log('✓ renderFolderBar() działa poprawnie.');

// 3. injectFolderBadge
console.log('Test 3: injectFolderBadge()...');
const mockRow = new MockElement('div');
mockRow.setAttribute('role', 'row');

let assignCalled = false;
ui.injectFolderBadge(mockRow, 'thread_123', sampleFolders[1], () => {
  assignCalled = true;
});

const badge = mockRow.querySelector('.mf-thread-badge');
assert.ok(badge, 'Plakietka folderu powinna zostać wstrzyknięta');
assert.strictEqual(badge.querySelector('.mf-thread-badge-text').textContent, 'Praca');

// Przycisk folderu na czacie został usunięty zgodnie z życzeniem użytkownika
const folderBtn = mockRow.querySelector('.mf-folder-btn');
assert.strictEqual(folderBtn, null, 'Przycisk folderu przy czacie nie powinien być tworzony');

badge.dispatchEvent({ type: 'click', stopPropagation() {}, preventDefault() {} });
assert.strictEqual(assignCalled, true, 'Kliknięcie plakietki powinno wywołać onAssign');
console.log('✓ injectFolderBadge() działa poprawnie.');

// 4. renderHeaderPill
console.log('Test 4: renderHeaderPill()...');
const mockHeader = new MockElement('header');
let headerAssign = false;
const headerPill = ui.renderHeaderPill(mockHeader, sampleFolders[1], () => {
  headerAssign = true;
});

assert.ok(headerPill, 'Pigułka nagłówka powinna zostać utworzona');
assert.ok(headerPill.classList.contains('mf-header-pill-assigned'), 'Pigułka powinna mieć klasę mf-header-pill-assigned');
assert.strictEqual(headerPill.querySelector('.mf-header-pill-title').textContent, 'Praca');

headerPill.dispatchEvent({ type: 'click', stopPropagation() {} });
assert.strictEqual(headerAssign, true, 'Kliknięcie pigułki nagłówka powinno wywołać callback');
console.log('✓ renderHeaderPill() działa poprawnie.');

// 5. showFolderModal
console.log('Test 5: showFolderModal()...');
let savedFolder = null;
ui.showFolderModal({
  folder: null,
  onSave: (data) => { savedFolder = data; }
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
  onBack: () => { backCalled = true; }
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
const friendsItem = dropdownItems.find(item => item.textContent && item.textContent.includes('Znajomi')) || dropdownItems[2];
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
const threadsTabBtn = navButtons.find(b => b.dataset.tab === 'threads');
assert.ok(threadsTabBtn, 'Zakładka Rozmowy powinna istnieć');
threadsTabBtn.dispatchEvent({ type: 'click' });
const searchBox = ui.activeModal.querySelector('.mf-settings-threads-search-box');
assert.ok(searchBox, 'Zakładka Rozmowy powinna zawierać pole wyszukiwania');

ui.closeModal();
assert.strictEqual(ui.activeModal, null, 'Okno powinno się zamknąć');
console.log('✓ showSettingsModal() działa poprawnie.');

console.log('\n=============================================');
console.log('WSZYSTKIE TESTY INTERFEJSU ZAKOŃCZONE SUKCESEM! ✓');
console.log('=============================================');
