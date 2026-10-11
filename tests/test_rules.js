/**
 * Testy jednostkowe dla silnika reguł automatycznego przypisywania (MessengerRulesEngine)
 * Pokrywa: CRUD, matching operators, priority, disabled rules, invalid regex handling, batch matching, storage interaction.
 */

const assert = require('assert');

console.log('--- Testowanie modułu MessengerRulesEngine (src/rules.js) ---');

// Mock chrome.storage.local
class MockStorageArea {
  constructor() {
    this.store = {};
  }
  get(keys, callback) {
    const result = {};
    if (typeof keys === 'string') {
      if (this.store[keys] !== undefined) result[keys] = JSON.parse(JSON.stringify(this.store[keys]));
    } else if (Array.isArray(keys)) {
      for (const k of keys) {
        if (this.store[k] !== undefined) result[k] = JSON.parse(JSON.stringify(this.store[k]));
      }
    } else if (keys === null) {
      Object.assign(result, JSON.parse(JSON.stringify(this.store)));
    }
    setTimeout(() => callback(result), 0);
  }
  set(items, callback) {
    for (const [k, v] of Object.entries(items)) {
      this.store[k] = JSON.parse(JSON.stringify(v));
    }
    setTimeout(() => callback && callback(), 0);
  }
  clear(callback) {
    this.store = {};
    setTimeout(() => callback && callback(), 0);
  }
}

const mockStorageArea = new MockStorageArea();
global.chrome = {
  runtime: { lastError: null },
  storage: {
    local: mockStorageArea
  }
};

const { MessengerRulesEngine, STORAGE_KEYS } = require('../src/rules.js');

async function runRulesTests() {
  const engine = new MessengerRulesEngine({ storageArea: mockStorageArea });

  // 1. Test Inicjalizacji
  console.log('Test 1: Inicjalizacja i eksporty...');
  assert.strictEqual(typeof MessengerRulesEngine, 'function', 'MessengerRulesEngine powinien być klasą');
  assert.strictEqual(STORAGE_KEYS.RULES, 'mf_rules', 'Klucz pamięci reguł powinien wynosić mf_rules');
  console.log('✓ MessengerRulesEngine zainicjalizowany pomyślnie.');

  // 2. Test matchCondition — operatory i przypadki brzegowe
  console.log('\nTest 2: matchCondition() — operatory i przypadki brzegowe...');

  // contains
  assert.strictEqual(engine.matchCondition('Projekt Alfa', { operator: 'contains', value: 'alfa' }), true);
  assert.strictEqual(engine.matchCondition('Projekt Beta', { operator: 'contains', value: 'gama' }), false);
  // contains z listą słów po przecinku
  assert.strictEqual(
    engine.matchCondition('Faktura za marzec', { operator: 'contains', value: 'oferta, faktura, zlecenie' }),
    true
  );
  assert.strictEqual(
    engine.matchCondition('Prywatna rozmowa', { operator: 'contains', value: 'oferta, faktura, zlecenie' }),
    false
  );

  // startsWith
  assert.strictEqual(engine.matchCondition('[FIRMA] Jan Kowalski', { operator: 'startsWith', value: '[firma]' }), true);
  assert.strictEqual(
    engine.matchCondition('Jan [FIRMA] Kowalski', { operator: 'startsWith', value: '[firma]' }),
    false
  );

  // endsWith
  assert.strictEqual(engine.matchCondition('Jan Kowalski (Praca)', { operator: 'endsWith', value: '(praca)' }), true);
  assert.strictEqual(engine.matchCondition('(Praca) Jan Kowalski', { operator: 'endsWith', value: '(praca)' }), false);

  // exact oraz alias equals
  assert.strictEqual(engine.matchCondition('Zespół IT', { operator: 'exact', value: 'zespół it' }), true);
  assert.strictEqual(engine.matchCondition('Nasz Zespół IT', { operator: 'exact', value: 'zespół it' }), false);
  assert.strictEqual(engine.matchCondition('Zespół IT', { operator: 'equals', value: 'zespół it' }), true);

  // regex — poprawne i niepoprawne
  assert.strictEqual(engine.matchCondition('ticket-12345', { operator: 'regex', value: '^ticket-\\d+$' }), true);
  assert.strictEqual(engine.matchCondition('ticket-abc', { operator: 'regex', value: '^ticket-\\d+$' }), false);

  // Bezpieczne wyłapanie błędnego regex (brak SyntaxError)
  assert.strictEqual(engine.matchCondition('tekst testowy', { operator: 'regex', value: '[a-z(' }), false);
  assert.strictEqual(engine.matchCondition('tekst testowy', { operator: 'regex', value: '(?+' }), false);

  // Zabezpieczenie przed ReDoS (catastrophic backtracking) i zbyt złożonymi wzorcami
  assert.strictEqual(
    engine.matchCondition('a'.repeat(27) + '!', { operator: 'regex', value: '^(a+)+$' }),
    false,
    'Wzorzec ReDoS z zagnieżdżonym kwantyfikatorem ^(a+)+$ powinien być natychmiast odrzucony'
  );
  assert.strictEqual(
    engine.matchCondition('tekst testowy', { operator: 'regex', value: '(a*)*' }),
    false,
    'Wzorzec ReDoS (a*)* powinien zostać zablokowany'
  );
  assert.strictEqual(
    engine.matchCondition('tekst testowy', { operator: 'regex', value: '(\\d+)+' }),
    false,
    'Wzorzec ReDoS (\\d+)+ powinien zostać zablokowany'
  );
  assert.strictEqual(
    engine.matchCondition('tekst testowy', { operator: 'regex', value: 'a++' }),
    false,
    'Podwójne sąsiadujące kwantyfikatory a++ powinny zostać odrzucone'
  );
  assert.strictEqual(
    engine.matchCondition('tekst testowy', { operator: 'regex', value: 'a'.repeat(251) }),
    false,
    'Wzorzec przekraczający limit 250 znaków powinien zostać odrzucony'
  );

  // Puste i nieprawidłowe wartości
  assert.strictEqual(engine.matchCondition(null, { operator: 'contains', value: 'test' }), false);
  assert.strictEqual(engine.matchCondition('test', null), false);
  assert.strictEqual(engine.matchCondition('test', { operator: 'contains', value: '' }), false);
  assert.strictEqual(engine.matchCondition('test', { operator: 'unknown_op', value: 'test' }), false);
  console.log('✓ matchCondition() poprawnie obsługuje wszystkie operatory i błędy RegEx.');

  // 3. Test evaluateThread — dopasowanie pojedynczego wątku
  console.log('\nTest 3: evaluateThread() — dopasowanie po nazwie i identyfikatorze...');
  const rulesBasic = [
    {
      id: 'r1',
      name: 'Reguła Praca',
      enabled: true,
      priority: 10,
      folderId: 'work',
      matchMode: 'all',
      conditions: [{ field: 'name', operator: 'contains', value: 'Projekt' }]
    },
    {
      id: 'r2',
      name: 'Reguła ID',
      enabled: true,
      priority: 20,
      folderId: 'clients',
      matchMode: 'all',
      conditions: [{ field: 'threadId', operator: 'startsWith', value: '1000' }]
    }
  ];

  assert.strictEqual(engine.evaluateThread({ threadId: '999', name: 'Nowy Projekt X' }, rulesBasic), 'work');
  assert.strictEqual(engine.evaluateThread({ threadId: '1000555', name: 'Jan Kowalski' }, rulesBasic), 'clients');
  assert.strictEqual(engine.evaluateThread({ threadId: '222', name: 'Zwykła rozmowa' }, rulesBasic), null);
  console.log('✓ evaluateThread() poprawnie dopasowuje pola name oraz threadId.');

  // 4. Test evaluateThread — tryby matchMode ('all' vs 'any')
  console.log('\nTest 4: evaluateThread() — tryby matchMode all i any...');
  const ruleAll = [
    {
      id: 'r_all',
      name: 'Reguła ALL',
      enabled: true,
      priority: 10,
      folderId: 'finance',
      matchMode: 'all',
      conditions: [
        { field: 'name', operator: 'contains', value: 'Faktura' },
        { field: 'name', operator: 'contains', value: '2026' }
      ]
    }
  ];
  assert.strictEqual(engine.evaluateThread({ threadId: '1', name: 'Faktura 2026/04' }, ruleAll), 'finance');
  assert.strictEqual(engine.evaluateThread({ threadId: '2', name: 'Faktura 2025/12' }, ruleAll), null);

  const ruleAny = [
    {
      id: 'r_any',
      name: 'Reguła ANY',
      enabled: true,
      priority: 10,
      folderId: 'urgent',
      matchMode: 'any',
      conditions: [
        { field: 'name', operator: 'contains', value: 'Pilne' },
        { field: 'name', operator: 'contains', value: 'ASAP' }
      ]
    }
  ];
  assert.strictEqual(engine.evaluateThread({ threadId: '1', name: 'Bardzo Pilne zadanie' }, ruleAny), 'urgent');
  assert.strictEqual(engine.evaluateThread({ threadId: '2', name: 'Proszę o to ASAP' }, ruleAny), 'urgent');
  assert.strictEqual(engine.evaluateThread({ threadId: '3', name: 'Spokojna rozmowa' }, ruleAny), null);
  console.log('✓ matchMode all oraz any działają zgodnie ze specyfikacją.');

  // 5. Test evaluateThread — priorytety i reguły wyłączone
  console.log('\nTest 5: evaluateThread() — priorytety i reguły wyłączone...');
  const rulesPriority = [
    {
      id: 'r_low',
      name: 'Niski priorytet',
      enabled: true,
      priority: 20,
      folderId: 'general',
      conditions: [{ field: 'name', operator: 'contains', value: 'Klient' }]
    },
    {
      id: 'r_high',
      name: 'Wysoki priorytet',
      enabled: true,
      priority: 5,
      folderId: 'vip',
      conditions: [{ field: 'name', operator: 'contains', value: 'Klient' }]
    },
    {
      id: 'r_disabled',
      name: 'Wyłączona najwyższy priorytet',
      enabled: false,
      priority: 1,
      folderId: 'disabled_folder',
      conditions: [{ field: 'name', operator: 'contains', value: 'Klient' }]
    }
  ];
  // Reguła o priorytecie 5 powinna wygrać z regułą o priorytecie 20, a wyłączona o priorytecie 1 powinna być pominięta
  assert.strictEqual(engine.evaluateThread({ threadId: '10', name: 'Ważny Klient VIP' }, rulesPriority), 'vip');

  // Test priorytetu 0 (BUG_PRIORITY_ZERO): priorytet 0 musi wygrywać z priorytetami 1-9
  const rulesWithPriorityZero = [
    {
      id: 'r_prio_5',
      name: 'Reguła Priorytet 5',
      enabled: true,
      priority: 5,
      folderId: 'folder_prio_5',
      conditions: [{ field: 'name', operator: 'contains', value: 'Wspólny' }]
    },
    {
      id: 'r_prio_0',
      name: 'Reguła Priorytet 0',
      enabled: true,
      priority: 0,
      folderId: 'folder_prio_0',
      conditions: [{ field: 'name', operator: 'contains', value: 'Wspólny' }]
    },
    {
      id: 'r_prio_1',
      name: 'Reguła Priorytet 1',
      enabled: true,
      priority: 1,
      folderId: 'folder_prio_1',
      conditions: [{ field: 'name', operator: 'contains', value: 'Wspólny' }]
    }
  ];
  assert.strictEqual(
    engine.evaluateThread({ threadId: '100', name: 'Wspólny projekt testowy' }, rulesWithPriorityZero),
    'folder_prio_0',
    'Reguła o priorytecie 0 powinna wygrać z regułami o priorytetach 1 oraz 5'
  );

  // Test odporności normalizacji priorytetów na typy niebędące liczbami (false, [], whitespace)
  const malformedPriorityRules = [
    {
      id: 'r_bool',
      name: 'Reguła z priority false',
      enabled: true,
      priority: false,
      folderId: 'f_bool',
      conditions: [{ field: 'name', operator: 'contains', value: 'Wspólny' }]
    },
    {
      id: 'r_spaces',
      name: 'Reguła z priority whitespace',
      enabled: true,
      priority: '   ',
      folderId: 'f_spaces',
      conditions: [{ field: 'name', operator: 'contains', value: 'Wspólny' }]
    },
    {
      id: 'r_arr',
      name: 'Reguła z priority array',
      enabled: true,
      priority: [],
      folderId: 'f_arr',
      conditions: [{ field: 'name', operator: 'contains', value: 'Wspólny' }]
    },
    {
      id: 'r_valid_5',
      name: 'Reguła z priority 5',
      enabled: true,
      priority: 5,
      folderId: 'f_valid_5',
      conditions: [{ field: 'name', operator: 'contains', value: 'Wspólny' }]
    },
    {
      id: 'r_valid_1',
      name: 'Reguła z priority 1',
      enabled: true,
      priority: 1,
      folderId: 'f_valid_1',
      conditions: [{ field: 'name', operator: 'contains', value: 'Wspólny' }]
    }
  ];

  assert.strictEqual(
    engine.evaluateThread({ threadId: '100', name: 'Wspólny temat' }, malformedPriorityRules),
    'f_valid_1',
    'Priorytet 1 musi wygrać z regułami o wadliwych priorytetach i priorytecie 5'
  );

  assert.strictEqual(
    engine.evaluateThread({ threadId: '100', name: 'Wspólny temat' }, malformedPriorityRules.slice(0, 4)),
    'f_valid_5',
    'Priorytet 5 musi wygrać z regułami o wadliwych priorytetach (false, [], "   " domyślnie otrzymują 10)'
  );

  // Bezpośrednia weryfikacja parsePriority
  assert.strictEqual(MessengerRulesEngine.parsePriority(false), 10, 'false -> 10');
  assert.strictEqual(MessengerRulesEngine.parsePriority([]), 10, '[] -> 10');
  assert.strictEqual(MessengerRulesEngine.parsePriority('   '), 10, '"   " -> 10');
  assert.strictEqual(MessengerRulesEngine.parsePriority(null), 10, 'null -> 10');
  assert.strictEqual(MessengerRulesEngine.parsePriority(undefined), 10, 'undefined -> 10');
  assert.strictEqual(MessengerRulesEngine.parsePriority(''), 10, '"" -> 10');
  assert.strictEqual(MessengerRulesEngine.parsePriority(0), 0, '0 -> 0');
  assert.strictEqual(MessengerRulesEngine.parsePriority('0'), 0, '"0" -> 0');
  assert.strictEqual(MessengerRulesEngine.parsePriority(1), 1, '1 -> 1');
  assert.strictEqual(MessengerRulesEngine.parsePriority(5), 5, '5 -> 5');
  assert.strictEqual(MessengerRulesEngine.parsePriority(' 5 '), 5, '" 5 " -> 5');

  console.log('✓ Priorytety oraz reguły wyłączone są poprawnie respektowane.');

  // 5b. Test odporności na zniekształcone warunki (BUG_MALFORMED_CONDITIONS_THROW)
  console.log('\nTest 5b: evaluateThread() — odporność na zniekształcone warunki...');
  const malformedConditionsRules = [
    {
      id: 'r_null_only',
      name: 'Tylko null w warunkach',
      enabled: true,
      priority: 1,
      folderId: 'f_null',
      conditions: [null]
    },
    {
      id: 'r_undefined_only',
      name: 'Tylko undefined w warunkach',
      enabled: true,
      priority: 2,
      folderId: 'f_undef',
      conditions: [undefined]
    },
    {
      id: 'r_primitive_only',
      name: 'Prymityw zamiast obiektu',
      enabled: true,
      priority: 3,
      folderId: 'f_prim',
      conditions: ['nieprawidłowy-warunek']
    },
    {
      id: 'r_mixed_valid',
      name: 'Mieszana tablica z poprawnym warunkiem',
      enabled: true,
      priority: 4,
      folderId: 'f_mixed',
      matchMode: 'all',
      conditions: [null, undefined, { field: 'name', operator: 'contains', value: 'Działający' }]
    }
  ];

  assert.strictEqual(
    engine.evaluateThread({ threadId: '1', name: 'Działający wątek' }, [malformedConditionsRules[0]]),
    null,
    'Reguła z [null] w conditions nie powinna rzucać wyjątku ani dopasowywać wątku'
  );
  assert.strictEqual(
    engine.evaluateThread({ threadId: '1', name: 'Działający wątek' }, [malformedConditionsRules[1]]),
    null,
    'Reguła z [undefined] w conditions nie powinna rzucać wyjątku'
  );
  assert.strictEqual(
    engine.evaluateThread({ threadId: '1', name: 'Działający wątek' }, [malformedConditionsRules[2]]),
    null,
    'Reguła z prymitywem w conditions nie powinna rzucać wyjątku'
  );
  assert.strictEqual(
    engine.evaluateThread({ threadId: '2', name: 'Działający wątek' }, malformedConditionsRules),
    'f_mixed',
    'Mieszana tablica powinna poprawnie przefiltrować uszkodzone warunki i dopasować poprawny'
  );
  console.log('✓ evaluateThread() bezpiecznie obsługuje zniekształcone tablice conditions bez rzucania błędów.');

  // 6. Test evaluateThread — ochrona przypisań ręcznych (overwriteManual)
  console.log('\nTest 6: evaluateThread() — ochrona przypisań ręcznych...');
  const ruleNoOverwrite = [
    {
      id: 'r_no_ow',
      name: 'Brak nadpisywania',
      enabled: true,
      priority: 10,
      folderId: 'work',
      overwriteManual: false,
      conditions: [{ field: 'name', operator: 'contains', value: 'Projekt' }]
    }
  ];
  const ruleOverwrite = [
    {
      id: 'r_ow',
      name: 'Wymuszone nadpisywanie',
      enabled: true,
      priority: 10,
      folderId: 'work',
      overwriteManual: true,
      conditions: [{ field: 'name', operator: 'contains', value: 'Projekt' }]
    }
  ];

  // Wątek z ręcznym przypisaniem do innego folderu
  const manualThread = { threadId: '50', name: 'Projekt A', folderId: 'private', isManual: true };
  assert.strictEqual(engine.evaluateThread(manualThread, ruleNoOverwrite), null);
  assert.strictEqual(engine.evaluateThread(manualThread, ruleOverwrite), 'work');

  // Wątek bez folderu (lub uncategorized)
  const uncategorizedThread = { threadId: '51', name: 'Projekt B', folderId: 'uncategorized' };
  assert.strictEqual(engine.evaluateThread(uncategorizedThread, ruleNoOverwrite), 'work');
  console.log('✓ overwriteManual poprawnie chroni wcześniejsze ręczne przypisania.');

  // 7. Test evaluateThread — walidacja docelowych folderów
  console.log('\nTest 7: evaluateThread() — walidacja docelowych folderów...');
  const existingFolders = [
    { id: 'all', name: 'Wszystkie', isSystem: true },
    { id: 'work', name: 'Praca', isSystem: false }
  ];
  const ruleInvalidFolder = [
    {
      id: 'r_inv',
      name: 'Usunięty folder',
      enabled: true,
      priority: 1,
      folderId: 'deleted_folder',
      conditions: [{ field: 'name', operator: 'contains', value: 'Test' }]
    },
    {
      id: 'r_all_dest',
      name: 'Cel all',
      enabled: true,
      priority: 2,
      folderId: 'all',
      conditions: [{ field: 'name', operator: 'contains', value: 'Test' }]
    },
    {
      id: 'r_valid',
      name: 'Prawidłowy folder',
      enabled: true,
      priority: 10,
      folderId: 'work',
      conditions: [{ field: 'name', operator: 'contains', value: 'Test' }]
    }
  ];
  assert.strictEqual(
    engine.evaluateThread({ threadId: '1', name: 'Test' }, ruleInvalidFolder, existingFolders),
    'work'
  );
  console.log('✓ evaluateThread() ignoruje reguły kierujące do folderu "all" lub nieistniejących folderów.');

  // 8. Test evaluateThreadsBatch — wsadowa ewaluacja
  console.log('\nTest 8: evaluateThreadsBatch() — wsadowa ewaluacja kolekcji wątków...');
  const sampleThreads = [
    { threadId: 't1', name: 'Projekt Alfa' },
    { threadId: 't2', name: 'Niepasujący czat' },
    { threadId: 't3', name: 'Projekt Beta' }
  ];
  const batchResult = engine.evaluateThreadsBatch(sampleThreads, rulesBasic);
  assert.ok(batchResult instanceof Map, 'Wynik powinien być instancją Map');
  assert.strictEqual(batchResult.size, 2, 'Dopasowane powinny być dokładnie 2 wątki');
  assert.strictEqual(batchResult.get('t1'), 'work');
  assert.strictEqual(batchResult.get('t3'), 'work');
  assert.strictEqual(batchResult.has('t2'), false);

  // Sprawdzenie obsługi wejścia w postaci Map i Obiektu
  const mapInput = new Map([['t1', { threadId: 't1', name: 'Projekt Alfa' }]]);
  assert.strictEqual(engine.evaluateThreadsBatch(mapInput, rulesBasic).get('t1'), 'work');

  const objInput = {
    t1: { threadId: 't1', name: 'Projekt Alfa' }
  };
  assert.strictEqual(engine.evaluateThreadsBatch(objInput, rulesBasic).get('t1'), 'work');
  console.log('✓ evaluateThreadsBatch() zwraca poprawną mapę przypisań.');

  // 9. Test CRUD i normalizacja w chrome.storage.local
  console.log('\nTest 9: CRUD i normalizacja reguł w storage...');
  mockStorageArea.clear();

  const initialRules = await engine.getRules();
  assert.deepStrictEqual(initialRules, [], 'Początkowo getRules() powinno zwrócić pustą tablicę');

  const rulesToSave = [
    {
      name: '  Nowa reguła testowa  ',
      folderId: 'work',
      conditions: [{ field: 'name', operator: 'contains', value: 'test' }]
    }
  ];
  const saved = await engine.saveRules(rulesToSave);
  assert.strictEqual(saved.length, 1);
  assert.ok(saved[0].id.startsWith('rule_'), 'ID powinno zostać automatycznie wygenerowane');
  assert.strictEqual(saved[0].name, 'Nowa reguła testowa', 'Nazwa powinna zostać przycięta');
  assert.strictEqual(saved[0].priority, 10, 'Domyślny priorytet powinien wynosić 10');
  assert.strictEqual(saved[0].matchMode, 'all', 'Domyślny matchMode powinien wynosić all');
  assert.strictEqual(saved[0].enabled, true, 'Domyślnie reguła powinna być włączona');

  // Weryfikacja bezpośrednio w mockStorageArea pod kluczem mf_rules
  assert.ok(Array.isArray(mockStorageArea.store.mf_rules), 'mf_rules w storage powinno być tablicą');
  assert.strictEqual(mockStorageArea.store.mf_rules[0].id, saved[0].id);

  // Ponowny odczyt przez engine.getRules()
  const fetched = await engine.getRules();
  assert.strictEqual(fetched.length, 1);
  assert.strictEqual(fetched[0].id, saved[0].id);

  // Test metody saveRule (pojedyncza reguła) i toggleRule, deleteRule
  const updatedSingle = await engine.saveRule({
    id: saved[0].id,
    name: 'Zaktualizowana reguła',
    folderId: 'work',
    conditions: [{ field: 'name', operator: 'contains', value: 'test' }]
  });
  assert.strictEqual(updatedSingle.name, 'Zaktualizowana reguła');

  const toggled = await engine.toggleRule(saved[0].id, false);
  assert.strictEqual(toggled.enabled, false);

  const deleted = await engine.deleteRule(saved[0].id);
  assert.strictEqual(deleted, true);
  const afterDelete = await engine.getRules();
  assert.strictEqual(afterDelete.length, 0);

  // Weryfikacja normalizacji priorytetów przy zapisie przez engine.saveRules()
  const malformedRulesToSave = [
    { name: 'R_False', priority: false, folderId: 'work', conditions: [{ field: 'name', value: 'a' }] },
    { name: 'R_Space', priority: '   ', folderId: 'work', conditions: [{ field: 'name', value: 'b' }] },
    { name: 'R_Array', priority: [], folderId: 'work', conditions: [{ field: 'name', value: 'c' }] },
    { name: 'R_Zero', priority: 0, folderId: 'work', conditions: [{ field: 'name', value: 'd' }] },
    { name: 'R_StrFive', priority: ' 5 ', folderId: 'work', conditions: [{ field: 'name', value: 'e' }] }
  ];
  const savedMalformed = await engine.saveRules(malformedRulesToSave);
  assert.strictEqual(savedMalformed[0].priority, 10, 'priority: false normalizuje do 10');
  assert.strictEqual(savedMalformed[1].priority, 10, 'priority: "   " normalizuje do 10');
  assert.strictEqual(savedMalformed[2].priority, 10, 'priority: [] normalizuje do 10');
  assert.strictEqual(savedMalformed[3].priority, 0, 'priority: 0 zostaje zachowane jako 0');
  assert.strictEqual(savedMalformed[4].priority, 5, 'priority: " 5 " konwertuje na liczbę 5');
  await engine.saveRules([]); // reset do pustej listy

  console.log('✓ saveRules(), saveRule(), toggleRule(), deleteRule() i getRules() działają poprawnie.');

  // 10. Test Integracja z MessengerFoldersStorage
  console.log('\nTest 10: Integracja z instancją MessengerFoldersStorage...');
  const { MessengerFoldersStorage } = require('../src/storage.js');
  const storageInstance = new MessengerFoldersStorage(mockStorageArea);
  const engineWithStorage = new MessengerRulesEngine({ storage: storageInstance });
  await engineWithStorage.saveRules([
    {
      name: 'Reguła integracyjna',
      folderId: 'work',
      conditions: [{ field: 'name', operator: 'contains', value: 'test' }]
    }
  ]);
  const rulesFromStorageInstance = await engineWithStorage.getRules();
  assert.strictEqual(rulesFromStorageInstance.length, 1);
  assert.strictEqual(rulesFromStorageInstance[0].name, 'Reguła integracyjna');
  console.log('✓ MessengerRulesEngine bezproblemowo integruje się z MessengerFoldersStorage.');

  console.log('\n=============================================');
  console.log('WSZYSTKIE TESTY REGUŁ ZAKOŃCZONE SUKCESEM! ✓');
  console.log('=============================================');
}

runRulesTests().catch((err) => {
  console.error('BŁĄD PODCZAS WYKONYWANIA TESTÓW REGUŁ:', err);
  process.exit(1);
});
