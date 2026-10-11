/* global chrome */
const { test, expect } = require('@playwright/test');
const { createExtensionContext, getStorageData } = require('./helpers');

test.describe('Messenger Folders E2E Test Suite (MF-006)', () => {
  let ctx;
  let page;

  test.beforeEach(async () => {
    ctx = await createExtensionContext();
    page = ctx.page;
    await page.goto('https://www.messenger.com/');
    await page.waitForSelector('#mf-folder-bar', { state: 'visible', timeout: 10000 });
  });

  test.afterEach(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  test('E2E-01: Auto-injection of folder bar (#mf-folder-bar)', async () => {
    const folderBar = page.locator('#mf-folder-bar');
    await expect(folderBar).toBeVisible();
    await expect(folderBar).toHaveAttribute('data-mf-folder-bar', 'true');

    // Górny rząd z wyszukiwarką folderów i przyciskiem ustawień
    const topBar = folderBar.locator('.mf-folder-top-bar');
    await expect(topBar).toBeVisible();
    const searchInput = topBar.locator('.mf-folder-search-input');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Szukaj folderu...');

    const settingsBtn = topBar.locator('.mf-folder-settings-btn');
    await expect(settingsBtn).toBeVisible();
    await expect(settingsBtn).toHaveAttribute('aria-label', 'Ustawienia folderów');

    // Rząd pigułek z kontenerem przewijania
    const pillsRow = folderBar.locator('.mf-folder-pills-row');
    await expect(pillsRow).toBeVisible();
    const scrollContainer = pillsRow.locator('.mf-folder-scroll-container');
    await expect(scrollContainer).toBeVisible();

    // Domyślne pigułki
    const defaultFolderIds = ['all', 'important', 'work', 'friends', 'groups', 'uncategorized'];
    for (const folderId of defaultFolderIds) {
      const pill = scrollContainer.locator(`.mf-folder-pill[data-folder-id="${folderId}"]`);
      await expect(pill).toBeVisible();
    }

    // Przycisk dodawania nowego folderu
    const addBtn = scrollContainer.locator('.mf-folder-add-btn');
    await expect(addBtn).toBeVisible();

    // Domyślnie aktywny jest folder 'all'
    const allPill = scrollContainer.locator('.mf-folder-pill[data-folder-id="all"]');
    await expect(allPill).toHaveClass(/mf-active/);
    await expect(allPill).toHaveAttribute('aria-selected', 'true');
  });

  test('E2E-02: Folder creation modal flow', async () => {
    // 1. Kliknięcie przycisku dodawania folderu
    await page.locator('.mf-folder-add-btn').click();

    // 2. Widoczność modalu
    const modal = page.locator('.mf-modal[data-mf-modal="true"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.mf-modal-title')).toHaveText('Nowy folder');

    // 3. Wypełnienie formularza
    const nameInput = modal.locator('#mf-input-folder-name');
    await nameInput.fill('Projekty AI');

    // 4. Wybór emoji
    const emojiOption = modal.locator('#mf-emoji-picker .mf-emoji-option', { hasText: '🚀' });
    await emojiOption.click();
    await expect(emojiOption).toHaveClass(/mf-selected/);

    // 5. Wybór koloru
    const colorOption = modal.locator('#mf-color-picker .mf-color-option').first();
    await colorOption.click();
    await expect(colorOption).toHaveClass(/mf-selected/);

    // 6. Weryfikacja podglądu na żywo
    const livePill = modal.locator('#mf-modal-live-pill');
    await expect(livePill.locator('.mf-folder-name')).toHaveText('Projekty AI');
    await expect(livePill.locator('.mf-folder-icon')).toHaveText('🚀');

    // 7. Zapisanie folderu
    await modal.locator('.mf-modal-footer .mf-btn-primary').click();

    // 8. Weryfikacja po zapisie
    await expect(page.locator('.mf-modal-overlay')).toBeHidden();
    await expect(page.locator('.mf-toast')).toContainText('Utworzono nowy folder');

    // Nowa pigułka na pasku i jej stan aktywny
    const newPill = page.locator('.mf-folder-pill', { hasText: 'Projekty AI' });
    await expect(newPill).toBeVisible();
    await expect(newPill).toHaveClass(/mf-active/);
    await expect(newPill).toHaveAttribute('aria-selected', 'true');

    // Weryfikacja w chrome.storage.local
    const folders = await getStorageData(page, 'mf_folders');
    expect(folders).toBeInstanceOf(Array);
    const created = folders.find((f) => f.name === 'Projekty AI');
    expect(created).toBeDefined();
    expect(created.icon).toBe('🚀');
  });

  test('E2E-03: Switching active folder pills', async () => {
    const workPill = page.locator('.mf-folder-pill[data-folder-id="work"]');
    const allPill = page.locator('.mf-folder-pill[data-folder-id="all"]');

    // Kliknięcie w folder Praca
    await workPill.click();
    await expect(workPill).toHaveClass(/mf-active/);
    await expect(workPill).toHaveAttribute('aria-selected', 'true');
    await expect(allPill).not.toHaveClass(/mf-active/);
    await expect(allPill).toHaveAttribute('aria-selected', 'false');

    let activeFolder = await getStorageData(page, 'mf_active_folder');
    expect(activeFolder).toBe('work');

    // Powrót do folderu Wszystkie
    await allPill.click();
    await expect(allPill).toHaveClass(/mf-active/);
    await expect(allPill).toHaveAttribute('aria-selected', 'true');
    await expect(workPill).not.toHaveClass(/mf-active/);
    await expect(workPill).toHaveAttribute('aria-selected', 'false');

    activeFolder = await getStorageData(page, 'mf_active_folder');
    expect(activeFolder).toBe('all');
  });

  test('E2E-04: Chat assignment via context menu', async () => {
    // Zlokalizuj wiersz czatu Jan Testowy (100000000001)
    const chatRow = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000001"]') });
    await expect(chatRow).toBeVisible();

    // Prawy przycisk myszy
    await chatRow.click({ button: 'right' });

    // Menu kontekstowe przypisania
    const dropdown = page.locator('.mf-dropdown-menu[data-mf-dropdown="true"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('.mf-dropdown-title')).toHaveText('Przypisz do folderu');

    // Wybór folderu "Praca"
    const workOption = dropdown.locator('.mf-dropdown-item', { hasText: 'Praca' });
    await workOption.click();

    // Zamknięcie menu i komunikat
    await expect(dropdown).toBeHidden();
    await expect(page.locator('.mf-toast')).toContainText('Przypisano do folderu "Praca"');

    // Sprawdzenie storage
    const threads = await getStorageData(page, 'mf_threads');
    expect(threads).toBeDefined();
    expect(threads['100000000001']).toBeDefined();
    expect(threads['100000000001'].folderId).toBe('work');

    // Licznik na pigułce
    const workPill = page.locator('.mf-folder-pill[data-folder-id="work"]');
    await expect(workPill.locator('.mf-folder-count')).toHaveText('1');
  });

  test('E2E-05: Chat list filtering by active folder', async () => {
    // 1. Przypisz wątek 1 (Jan Testowy) do "Praca"
    const chatRow1 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000001"]') });
    const chatRow2 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000002"]') });

    await chatRow1.click({ button: 'right' });
    const dropdown = page.locator('.mf-dropdown-menu[data-mf-dropdown="true"]');
    await dropdown.locator('.mf-dropdown-item', { hasText: 'Praca' }).click();
    await expect(dropdown).toBeHidden();

    // 2. Przełącz na folder "Praca"
    await page.locator('.mf-folder-pill[data-folder-id="work"]').click();

    // 3. Wątek 1 jest widoczny, wątek 2 jest ukryty
    await expect(chatRow1).toBeVisible();
    await expect(chatRow1).not.toHaveClass(/mf-thread-hidden/);

    await expect(chatRow2).toBeHidden();
    await expect(chatRow2).toHaveClass(/mf-thread-hidden/);

    // 4. Przełącz z powrotem na "Wszystkie"
    await page.locator('.mf-folder-pill[data-folder-id="all"]').click();

    // 5. Oba wątki są widoczne
    await expect(chatRow1).toBeVisible();
    await expect(chatRow2).toBeVisible();
    await expect(chatRow2).not.toHaveClass(/mf-thread-hidden/);
  });

  test('E2E-06: State persistence across page reload', async () => {
    // Przypisz wątek 1 do folderu "Praca" i aktywuj "Praca"
    const chatRow1 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000001"]') });
    const chatRow2 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000002"]') });

    await chatRow1.click({ button: 'right' });
    const dropdown = page.locator('.mf-dropdown-menu[data-mf-dropdown="true"]');
    await dropdown.locator('.mf-dropdown-item', { hasText: 'Praca' }).click();
    await expect(dropdown).toBeHidden();

    await page.locator('.mf-folder-pill[data-folder-id="work"]').click();
    await expect(chatRow2).toBeHidden();

    // Odświeżenie strony
    await page.reload();
    await page.waitForSelector('#mf-folder-bar', { state: 'visible', timeout: 10000 });

    // Pigułka "Praca" pozostaje aktywna
    const workPill = page.locator('.mf-folder-pill[data-folder-id="work"]');
    await expect(workPill).toHaveClass(/mf-active/);
    await expect(workPill).toHaveAttribute('aria-selected', 'true');

    // Stan filtrowania jest zachowany
    const reloadedRow1 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000001"]') });
    const reloadedRow2 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000002"]') });

    await expect(reloadedRow1).toBeVisible();
    await expect(reloadedRow2).toBeHidden();
    await expect(reloadedRow2).toHaveClass(/mf-thread-hidden/);
  });

  test('E2E-07: Coexistence with Messenger native search', async () => {
    // Przypisz wątek 1 do "Praca" i aktywuj "Praca" (wątek 2 staje się ukryty)
    const chatRow1 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000001"]') });
    const chatRow2 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000002"]') });

    await chatRow1.click({ button: 'right' });
    const dropdown = page.locator('.mf-dropdown-menu[data-mf-dropdown="true"]');
    await dropdown.locator('.mf-dropdown-item', { hasText: 'Praca' }).click();
    await expect(dropdown).toBeHidden();

    await page.locator('.mf-folder-pill[data-folder-id="work"]').click();
    await expect(chatRow2).toBeHidden();

    // Wpisz zapytanie w natywną wyszukiwarkę Messengera
    const searchInput = page.locator('.search-section input[type="search"]');
    await searchInput.fill('Anna');

    // Wszystkie wiersze powinny być widoczne w trakcie natywnego wyszukiwania
    await expect(chatRow2).toBeVisible();
    await expect(chatRow2).not.toHaveClass(/mf-thread-hidden/);

    // Po wyczyszczeniu wyszukiwarki i zdjęciu fokusu filtrowanie zostaje przywrócone
    await searchInput.fill('');
    await searchInput.blur();
    await expect(chatRow2).toBeHidden();
    await expect(chatRow2).toHaveClass(/mf-thread-hidden/);
  });

  test('E2E-08: Folder deletion and cleanup (handle dialog accept)', async () => {
    // 1. Utwórz folder użytkownika "Tymczasowy"
    await page.locator('.mf-folder-add-btn').click();
    const modal = page.locator('.mf-modal[data-mf-modal="true"]');
    await modal.locator('#mf-input-folder-name').fill('Tymczasowy');
    await modal.locator('.mf-modal-footer .mf-btn-primary').click();
    await expect(page.locator('.mf-modal-overlay')).toBeHidden();

    const tempPill = page.locator('.mf-folder-pill', { hasText: 'Tymczasowy' });
    await expect(tempPill).toBeVisible();
    await expect(tempPill).toHaveClass(/mf-active/);

    // 2. Przełącz na "Wszystkie", aby zobaczyć czaty i przypisać wątek 1 do "Tymczasowy"
    await page.locator('.mf-folder-pill[data-folder-id="all"]').click();

    const chatRow1 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000001"]') });
    await chatRow1.click({ button: 'right' });
    const dropdown = page.locator('.mf-dropdown-menu[data-mf-dropdown="true"]');
    await dropdown.locator('.mf-dropdown-item', { hasText: 'Tymczasowy' }).click();
    await expect(dropdown).toBeHidden();

    // Aktywuj folder "Tymczasowy"
    await tempPill.click();
    await expect(tempPill).toHaveClass(/mf-active/);

    // 3. Obsługa dialogu potwierdzenia
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // 4. Otwórz ustawienia (domyślnie otwiera zakładkę foldery)
    await page.locator('.mf-folder-settings-btn').click();
    const settingsModal = page.locator('.mf-modal[data-mf-modal="true"]');
    await expect(settingsModal).toBeVisible();

    // 5. Znajdź pozycję "Tymczasowy" i kliknij przycisk usuwania
    const folderItem = settingsModal.locator('.mf-settings-folder-item', {
      hasText: 'Tymczasowy'
    });
    await expect(folderItem).toBeVisible();
    await folderItem.locator('.mf-btn-delete').click();

    // 6. Zamknij modal ustawień
    await settingsModal.locator('.mf-modal-close-btn').click();
    await expect(page.locator('.mf-modal-overlay')).toBeHidden();

    // 7. Weryfikacja: pigułka zniknęła, aktywny folder to 'all', wątki widoczne
    await expect(tempPill).toBeHidden();
    const allPill = page.locator('.mf-folder-pill[data-folder-id="all"]');
    await expect(allPill).toHaveClass(/mf-active/);

    const activeFolder = await getStorageData(page, 'mf_active_folder');
    expect(activeFolder).toBe('all');

    const threads = await getStorageData(page, 'mf_threads');
    expect(threads['100000000001'].folderId).toBe('uncategorized');
  });

  test('E2E-09: Zero network requests verification', async () => {
    // Wykonaj podstawowe operacje weryfikujące pełny cykl życia
    const folderBar = page.locator('#mf-folder-bar');
    await expect(folderBar).toBeVisible();

    await page.locator('.mf-folder-pill[data-folder-id="work"]').click();
    await page.locator('.mf-folder-pill[data-folder-id="all"]').click();

    // Weryfikacja, że ctx.externalRequests jest bezwzględnie pusta
    expect(ctx.externalRequests).toHaveLength(0);
  });

  test('E2E-10: Auto-assignment rules creation, execution and filtering', async () => {
    // 1. Zlokalizuj wiersze czatów w fixture DOM
    const chatRow1 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000001"]') });
    const chatRow2 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000002"]') });

    await expect(chatRow1).toBeVisible();
    await expect(chatRow2).toBeVisible();

    // 2. Otwórz modal ustawień
    await page.locator('.mf-folder-settings-btn').click();
    const settingsModal = page.locator('.mf-modal[data-mf-modal="true"]');
    await expect(settingsModal).toBeVisible();

    // 3. Przełącz na 4. zakładkę "⚡ Reguły"
    const rulesTabBtn = settingsModal.locator('.mf-settings-nav-btn[data-tab="rules"]');
    await expect(rulesTabBtn).toBeVisible();
    await rulesTabBtn.click();
    await expect(rulesTabBtn).toHaveClass(/mf-active/);

    // 4. Kliknij przycisk dodawania reguły
    const addRuleBtn = settingsModal.locator('#mf-rules-add-btn, .mf-btn-primary', { hasText: /Nowa reguła/i });
    await expect(addRuleBtn).toBeVisible();
    await addRuleBtn.click();

    // 5. Otwiera się modal edytora reguły
    const ruleEditor = page.locator('.mf-modal').filter({ has: page.locator('#mf-rule-name-input') });
    await expect(ruleEditor).toBeVisible();

    // Wypełnij formularz reguły
    const nameInput = ruleEditor.locator('#mf-rule-name-input');
    await expect(nameInput).toBeFocused();
    await nameInput.fill('Projekty firmowe');

    const folderSelect = ruleEditor.locator('#mf-rule-folder-select');
    await folderSelect.selectOption('work');

    const fieldSelect = ruleEditor.locator('.mf-rule-condition-field').first();
    await fieldSelect.selectOption('name');

    const opSelect = ruleEditor.locator('.mf-rule-condition-op').first();
    await opSelect.selectOption('contains');

    const valInput = ruleEditor.locator('.mf-rule-condition-val').first();
    await valInput.click();
    await valInput.fill('Projekt');

    // Weryfikacja podglądu na żywo
    const dryRunPreview = ruleEditor.locator('.mf-rule-dry-run-preview');
    await expect(dryRunPreview).toBeVisible();
    await expect(dryRunPreview).toHaveText('Liczba pasujących czatów: 1');

    // 6. Zapisz regułę
    const saveRuleBtn = ruleEditor.locator('.mf-modal-footer .mf-btn-primary');
    await saveRuleBtn.click();
    await expect(ruleEditor).toBeHidden();
    await expect(page.locator('.mf-toast')).toContainText('Utworzono nową regułę');

    // 7. Zamknij modal ustawień
    await settingsModal.locator('.mf-modal-close-btn').click();
    await expect(page.locator('.mf-modal-overlay')).toBeHidden();

    // 8. Weryfikacja w chrome.storage.local
    const rules = await getStorageData(page, 'mf_rules');
    expect(rules).toBeInstanceOf(Array);
    const createdRule = rules.find((r) => r.name === 'Projekty firmowe');
    expect(createdRule).toBeDefined();
    expect(createdRule.folderId).toBe('work');

    const threads = await getStorageData(page, 'mf_threads');
    expect(threads).toBeDefined();
    expect(threads['100000000001']).toBeUndefined();
    expect(threads['100000000002']).toBeDefined();
    expect(threads['100000000002'].folderId).toBe('work');
    expect(threads['100000000002'].autoAssigned).toBe(true);
    expect(threads['100000000002'].name).toBe('Anna Projektowa');

    // 9. Licznik folderu "Praca" na pasku folderów
    const workPill = page.locator('.mf-folder-pill[data-folder-id="work"]');
    await expect(workPill.locator('.mf-folder-count')).toHaveText('1');

    // 10. Weryfikacja filtrowania widoku
    await workPill.click();
    await expect(workPill).toHaveClass(/mf-active/);

    await expect(chatRow2).toBeVisible();
    await expect(chatRow2).not.toHaveClass(/mf-thread-hidden/);

    await expect(chatRow1).toBeHidden();
    await expect(chatRow1).toHaveClass(/mf-thread-hidden/);

    // Powrót do folderu Wszystkie
    await page.locator('.mf-folder-pill[data-folder-id="all"]').click();
    await expect(chatRow1).toBeVisible();
    await expect(chatRow1).not.toHaveClass(/mf-thread-hidden/);
    await expect(chatRow2).toBeVisible();
    await expect(chatRow2).not.toHaveClass(/mf-thread-hidden/);
  });

  test('E2E-11: Auto-assignment evaluation on initial page load with pre-seeded rules', async () => {
    // 1. Zapisz pre-definiowaną regułę w storage
    const preSeededRule = {
      id: 'rule_seed_dev',
      name: 'Programiści',
      enabled: true,
      priority: 1,
      folderId: 'important',
      matchMode: 'all',
      conditions: [{ field: 'name', operator: 'contains', value: 'Programista' }],
      overwriteManual: false,
      createdAt: Date.now()
    };

    let worker = ctx.context.serviceWorkers()[0];
    if (!worker) {
      worker = await ctx.context.waitForEvent('serviceworker', { timeout: 5000 });
    }
    expect(worker).toBeDefined();

    await worker.evaluate(async (rule) => {
      await chrome.storage.local.set({ mf_rules: [rule] });
    }, preSeededRule);

    // 2. Przeładuj stronę, aby przetestować cykl startowy (cold start)
    await page.reload();
    await page.waitForSelector('#mf-folder-bar', { state: 'visible', timeout: 10000 });

    // 3. Zweryfikuj, że wątek Michał Programista (100000000003) został automatycznie przypisany do 'important'
    const threads = await getStorageData(page, 'mf_threads');
    expect(threads).toBeDefined();
    expect(threads['100000000003']).toBeDefined();
    expect(threads['100000000003'].folderId).toBe('important');
    expect(threads['100000000003'].autoAssigned).toBe(true);
    expect(threads['100000000003'].name).toBe('Michał Programista');

    // Weryfikacja wątków niepasujących do reguły — nie mogą być przypisane
    expect(threads['100000000001']).toBeUndefined();
    expect(threads['100000000002']).toBeUndefined();
    expect(threads['100000000004']).toBeUndefined();
    expect(threads['100000000005']).toBeUndefined();

    // 4. Zweryfikuj licznik folderu "Ważne"
    const importantPill = page.locator('.mf-folder-pill[data-folder-id="important"]');
    await expect(importantPill.locator('.mf-folder-count')).toHaveText('1');

    // 5. Aktywuj folder "Ważne" i zweryfikuj widoczność
    await importantPill.click();
    const chatRow3 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000003"]') });
    const chatRow1 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000001"]') });
    const chatRow2 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000002"]') });

    await expect(chatRow3).toBeVisible();
    await expect(chatRow3).not.toHaveClass(/mf-thread-hidden/);
    await expect(chatRow1).toBeHidden();
    await expect(chatRow1).toHaveClass(/mf-thread-hidden/);
    await expect(chatRow2).toBeHidden();
    await expect(chatRow2).toHaveClass(/mf-thread-hidden/);

    // Przywrócenie widoku do 'all'
    await page.locator('.mf-folder-pill[data-folder-id="all"]').click();
    await expect(chatRow1).toBeVisible();
    await expect(chatRow1).not.toHaveClass(/mf-thread-hidden/);
    await expect(chatRow2).toBeVisible();
    await expect(chatRow2).not.toHaveClass(/mf-thread-hidden/);
    await expect(chatRow3).toBeVisible();
    await expect(chatRow3).not.toHaveClass(/mf-thread-hidden/);
  });

  test('E2E-12: Priority 0 rule takes precedence over priority 5 rule', async () => {
    const p0Rule = {
      id: 'rule_prio_0',
      name: 'Reguła Prio 0 (Praca)',
      enabled: true,
      priority: 0,
      folderId: 'work',
      matchMode: 'all',
      conditions: [{ field: 'name', operator: 'contains', value: 'Jan' }],
      overwriteManual: false,
      createdAt: Date.now()
    };

    const p5Rule = {
      id: 'rule_prio_5',
      name: 'Reguła Prio 5 (Ważne)',
      enabled: true,
      priority: 5,
      folderId: 'important',
      matchMode: 'all',
      conditions: [{ field: 'name', operator: 'contains', value: 'Jan' }],
      overwriteManual: false,
      createdAt: Date.now() + 1
    };

    let worker = ctx.context.serviceWorkers()[0];
    if (!worker) {
      worker = await ctx.context.waitForEvent('serviceworker', { timeout: 5000 });
    }
    expect(worker).toBeDefined();

    await worker.evaluate(
      async ({ r0, r5 }) => {
        await chrome.storage.local.set({ mf_rules: [r5, r0] }); // Seed in reverse order to ensure sort logic is exercised
      },
      { r0: p0Rule, r5: p5Rule }
    );

    await page.reload();
    await page.waitForSelector('#mf-folder-bar', { state: 'visible', timeout: 10000 });

    const threads = await getStorageData(page, 'mf_threads');
    expect(threads).toBeDefined();
    expect(threads['100000000001']).toBeDefined();
    expect(threads['100000000001'].folderId).toBe('work');
    expect(threads['100000000001'].autoAssigned).toBe(true);

    const workPill = page.locator('.mf-folder-pill[data-folder-id="work"]');
    await expect(workPill.locator('.mf-folder-count')).toHaveText('1');

    const importantPill = page.locator('.mf-folder-pill[data-folder-id="important"]');
    const importantCount = importantPill.locator('.mf-folder-count');
    if ((await importantCount.count()) > 0) {
      await expect(importantCount).not.toHaveText('1');
    }

    const chatRow1 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000001"]') });

    await workPill.click();
    await expect(chatRow1).toBeVisible();
    await expect(chatRow1).not.toHaveClass(/mf-thread-hidden/);

    await importantPill.click();
    await expect(chatRow1).toBeHidden();
    await expect(chatRow1).toHaveClass(/mf-thread-hidden/);
  });

  test('E2E-13: Manual assignment preservation when mixed overwriteManual: false and overwriteManual: true rules exist', async () => {
    const chatRow1 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000001"]') });
    const chatRow2 = page.locator('[role="row"]').filter({ has: page.locator('a[href*="/t/100000000002"]') });

    // 1. Ręczne przypisanie wątku 1 do "Znajomi" (friends)
    await chatRow1.click({ button: 'right' });
    const dropdown = page.locator('.mf-dropdown-menu[data-mf-dropdown="true"]');
    await expect(dropdown).toBeVisible();
    await dropdown.locator('.mf-dropdown-item', { hasText: 'Znajomi' }).click();
    await expect(dropdown).toBeHidden();

    let threads = await getStorageData(page, 'mf_threads');
    expect(threads['100000000001'].folderId).toBe('friends');
    expect(Boolean(threads['100000000001'].autoAssigned)).toBe(false);

    // 2. Pre-seed dwóch reguł o mieszanym overwriteManual
    const mixedRules = [
      {
        id: 'rule_no_overwrite',
        name: 'Reguła bez nadpisywania (Jan -> Praca)',
        enabled: true,
        priority: 1,
        folderId: 'work',
        matchMode: 'all',
        conditions: [{ field: 'name', operator: 'contains', value: 'Jan' }],
        overwriteManual: false,
        createdAt: Date.now()
      },
      {
        id: 'rule_with_overwrite',
        name: 'Reguła z nadpisywaniem (Projekt -> Ważne)',
        enabled: true,
        priority: 2,
        folderId: 'important',
        matchMode: 'all',
        conditions: [{ field: 'name', operator: 'contains', value: 'Projekt' }],
        overwriteManual: true,
        createdAt: Date.now() + 1
      }
    ];

    let worker = ctx.context.serviceWorkers()[0];
    if (!worker) {
      worker = await ctx.context.waitForEvent('serviceworker', { timeout: 5000 });
    }
    await worker.evaluate(async (rules) => {
      await chrome.storage.local.set({ mf_rules: rules });
    }, mixedRules);

    // 3. Odświeżenie strony i ponowna detekcja
    await page.reload();
    await page.waitForSelector('#mf-folder-bar', { state: 'visible', timeout: 10000 });

    // 4. Weryfikacja: Wątek 1 pozostaje w friends, wątek 2 przypisany do important
    threads = await getStorageData(page, 'mf_threads');
    expect(threads['100000000001'].folderId).toBe('friends');
    expect(Boolean(threads['100000000001'].autoAssigned)).toBe(false);

    expect(threads['100000000002']).toBeDefined();
    expect(threads['100000000002'].folderId).toBe('important');
    expect(threads['100000000002'].autoAssigned).toBe(true);

    // 5. Weryfikacja liczników pigułek
    const friendsPill = page.locator('.mf-folder-pill[data-folder-id="friends"]');
    await expect(friendsPill.locator('.mf-folder-count')).toHaveText('1');

    const importantPill = page.locator('.mf-folder-pill[data-folder-id="important"]');
    await expect(importantPill.locator('.mf-folder-count')).toHaveText('1');

    const workPill = page.locator('.mf-folder-pill[data-folder-id="work"]');
    const workCount = workPill.locator('.mf-folder-count');
    if ((await workCount.count()) > 0) {
      await expect(workCount).not.toHaveText('1');
    }

    // 6. Weryfikacja filtrowania
    await friendsPill.click();
    await expect(chatRow1).toBeVisible();
    await expect(chatRow2).toBeHidden();

    await workPill.click();
    await expect(chatRow1).toBeHidden();
    await expect(chatRow2).toBeHidden();

    await importantPill.click();
    await expect(chatRow2).toBeVisible();
    await expect(chatRow1).toBeHidden();
  });

  test('E2E-14: Invalid and ReDoS regex in settings dry-run counter does not crash the page', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Otwórz modal ustawień i przejdź do zakładki Reguły
    await page.locator('.mf-folder-settings-btn').click();
    const settingsModal = page.locator('.mf-modal[data-mf-modal="true"]');
    await expect(settingsModal).toBeVisible();

    const rulesTabBtn = settingsModal.locator('.mf-settings-nav-btn[data-tab="rules"]');
    await rulesTabBtn.click();
    await expect(rulesTabBtn).toHaveClass(/mf-active/);

    // 2. Otwórz edytor nowej reguły
    const addRuleBtn = settingsModal.locator('#mf-rules-add-btn, .mf-btn-primary', { hasText: /Nowa reguła/i });
    await addRuleBtn.click();

    const ruleEditor = page.locator('.mf-modal').filter({ has: page.locator('#mf-rule-name-input') });
    await expect(ruleEditor).toBeVisible();

    // 3. Ustaw operator na RegEx
    const opSelect = ruleEditor.locator('.mf-rule-condition-op').first();
    await opSelect.selectOption('regex');

    const valInput = ruleEditor.locator('.mf-rule-condition-val').first();
    const dryRunPreview = ruleEditor.locator('.mf-rule-dry-run-preview');
    await expect(dryRunPreview).toBeVisible();

    // 4. Test niepoprawnej składni regex (unclosed bracket)
    await valInput.fill('[a-z(');
    await expect(dryRunPreview).toBeVisible();
    await expect(dryRunPreview).toHaveText('Liczba pasujących czatów: 0');
    expect(pageErrors).toHaveLength(0);

    // 5. Test niepoprawnej składni regex (invalid quantifier)
    await valInput.fill('(?+');
    await expect(dryRunPreview).toHaveText('Liczba pasujących czatów: 0');
    expect(pageErrors).toHaveLength(0);

    // 6. Test podatności ReDoS / zagnieżdżonego kwantyfikatora
    const t0 = Date.now();
    await valInput.fill('^(a+)+$');
    await expect(dryRunPreview).toBeVisible();
    await expect(dryRunPreview).toHaveText('Liczba pasujących czatów: 0');
    expect(Date.now() - t0).toBeLessThan(1500); // UI nie może zawiesić wątku
    expect(pageErrors).toHaveLength(0);

    // 7. Test przywrócenia poprawnego wzorca i responsywności UI
    await valInput.fill('^Jan.*');
    await expect(dryRunPreview).toHaveText('Liczba pasujących czatów: 1');

    // 8. Zamknięcie modalu przyciskiem Anuluj
    const cancelBtn = ruleEditor.locator('.mf-modal-footer .mf-btn-secondary', { hasText: 'Anuluj' });
    await cancelBtn.click();
    await expect(ruleEditor).toBeHidden();

    await settingsModal.locator('.mf-modal-close-btn').click();
    await expect(page.locator('.mf-modal-overlay')).toBeHidden();
    expect(pageErrors).toHaveLength(0);
  });
});
