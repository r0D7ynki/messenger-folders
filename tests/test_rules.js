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

  // MF-020: ochrona przed ReDoS — pomiar czasu matchCondition w milisekundach
  const timeMatch = (text, pattern) => {
    const t0 = process.hrtime.bigint();
    const result = engine.matchCondition(text, { operator: 'regex', value: pattern });
    return { result, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  };

  // Kwantyfikowane alternatywy (wykładniczy nawrót) — odrzucone szybko, bez zawieszenia
  const redosText = 'a'.repeat(27) + '!';
  assert.strictEqual(redosText.length, 28);
  for (const pattern of ['(a|a)*$', '(a|aa)*$', '(a|ab)*c']) {
    const { result, ms } = timeMatch(redosText, pattern);
    assert.strictEqual(result, false, `Wzorzec ReDoS ${pattern} powinien zostać odrzucony`);
    assert.ok(ms < 50, `matchCondition dla ${pattern} trwał ${ms.toFixed(1)} ms (limit 50 ms)`);
  }

  // Poprawka 1: łańcuchy punktów wyboru bez kwantyfikowanej grupy — odrzucone przy zapisie i szybkie
  const longA = 'a'.repeat(100);
  for (const pattern of ['a?'.repeat(40) + 'b', '(a|aa)'.repeat(41) + 'b']) {
    assert.match(
      MessengerRulesEngine.validateRegexPattern(pattern),
      /zbyt wiele możliwości/,
      `Wzorzec ${pattern.slice(0, 12)}… powinien zostać odrzucony przy zapisie`
    );
    const { result, ms } = timeMatch(longA, pattern);
    assert.strictEqual(result, false);
    assert.ok(ms < 50, `matchCondition dla ${pattern.slice(0, 12)}… trwał ${ms.toFixed(1)} ms (limit 50 ms)`);
  }

  // Ochrona nie jest listą znanych wzorców: każda długość łańcucha jest odrzucona albo szybka
  for (let k = 1; k <= 45; k++) {
    for (const pattern of ['a?'.repeat(k) + 'b', '(a|aa)'.repeat(k) + 'b', 'a?'.repeat(k) + '\\w*!']) {
      if (MessengerRulesEngine.validateRegexPattern(pattern) !== null) continue;
      const { ms } = timeMatch(longA, pattern);
      assert.ok(ms < 200, `Przyjęty wzorzec ${pattern.slice(0, 16)}… (k=${k}) trwał ${ms.toFixed(1)} ms`);
    }
  }

  // validateRegexPattern: komunikat błędu dla niebezpiecznych i błędnych wzorców, null dla poprawnych
  const rejectedPatterns = [
    '(a|a)*$',
    '(a|aa)*$',
    '(a|ab)*c',
    '(?:a|b)+',
    '(a|a){30}',
    '((a*)b)*',
    '^(a+)+$',
    'a++',
    'a???',
    '\\w*\\w*\\w*\\w*!',
    '.*foo.*bar.*', // 3 nieograniczone powtórzenia; równoważne „foo.*bar” jest przyjmowane
    '\\w{0,99}\\w{0,99}\\w{0,99}!',
    '[a-z(',
    'a'.repeat(251)
  ];
  for (const pattern of rejectedPatterns) {
    const error = MessengerRulesEngine.validateRegexPattern(pattern);
    assert.ok(
      typeof error === 'string' && error.length > 0,
      `Wzorzec ${pattern.slice(0, 30)} powinien zostać odrzucony`
    );
    assert.strictEqual(engine.validateRegexPattern(pattern), error, 'Metoda instancji zwraca ten sam komunikat');
  }
  const acceptedPatterns = [
    '^ticket-\\d+$',
    'ticket-\\d+$',
    '^Jan.*',
    'foo.*bar',
    '(Praca|Dom)',
    '^(Praca|Dom|Szkoła|Rodzina)',
    '(\\d{3}-)+',
    '(\\d{1,3}\\.){3}\\d{1,3}',
    '[(|)*]+',
    '\\(a|b\\)*',
    'a*?b',
    'a??',
    'a??b',
    '^\\d+-\\d+-\\d+$'
  ];
  for (const pattern of acceptedPatterns) {
    assert.strictEqual(MessengerRulesEngine.validateRegexPattern(pattern), null, `Wzorzec ${pattern} jest bezpieczny`);
  }
  assert.strictEqual(engine.matchCondition('Praca zdalna', { operator: 'regex', value: '^(Praca|Dom)' }), true);
  assert.strictEqual(engine.matchCondition('PRJ-123-456', { operator: 'regex', value: '^prj-\\d+-\\d+$' }), true);
  assert.strictEqual(engine.matchCondition('ab', { operator: 'regex', value: '^a??b$' }), true);
  assert.strictEqual(
    engine.matchCondition('Serwer 192.168.1.10', { operator: 'regex', value: '(\\d{1,3}\\.){3}\\d{1,3}' }),
    true
  );

  // Poprawka 1: tekst nie jest obcinany — dopasowanie za 100. znakiem nadal działa
  const longName = 'x'.repeat(95) + ' ticket-42';
  assert.strictEqual(longName.length, 105);
  assert.strictEqual(
    engine.matchCondition(longName, { operator: 'regex', value: 'ticket-\\d+$' }),
    true,
    'ticket-\\d+$ powinien pasować do nazwy 105-znakowej'
  );

  // Bardzo długi tekst przy wzorcu wielomianowym: koszt ponad budżet → brak dopasowania, bez zawieszenia
  for (const pattern of ['\\w*\\w*!', '\\w*!', 'a?a?a?a?a?a?a?a?\\w*!']) {
    const { result, ms } = timeMatch('a'.repeat(5000), pattern);
    assert.strictEqual(result, false);
    assert.ok(ms < 50, `Wzorzec ${pattern} na 5000 znakach trwał ${ms.toFixed(1)} ms`);
  }

  // Zapis reguły z niebezpiecznym wzorcem jest odrzucany, a reguła nie trafia do magazynu
  const rulesBeforeRedos = (await engine.getRules()).length;
  await assert.rejects(
    engine.saveRule({
      name: 'ReDoS',
      folderId: 'work',
      conditions: [{ field: 'name', operator: 'regex', value: '(a|a)*$' }]
    }),
    /alternatyw/,
    'saveRule powinien odrzucić wzorzec (a|a)*$'
  );
  assert.strictEqual((await engine.getRules()).length, rulesBeforeRedos, 'Odrzucona reguła nie została zapisana');

  // Poprawka 1: saveRules() waliduje wzorce tak jak saveRule()
  const redosRule = { id: 'r_redos', name: 'ReDoS', folderId: 'work', conditions: [] };
  for (const value of ['a?'.repeat(40) + 'b', '(a|aa)*$']) {
    await assert.rejects(
      engine.saveRules([{ ...redosRule, conditions: [{ field: 'name', operator: 'regex', value }] }]),
      /zbyt wiele możliwości|alternatyw/,
      `saveRules powinien odrzucić wzorzec ${value.slice(0, 12)}…`
    );
  }
  assert.strictEqual((await engine.getRules()).length, rulesBeforeRedos, 'saveRules nie zapisał odrzuconej reguły');

  // Wzorzec zapisany przed MF-020 nie blokuje przełączania ani usuwania innych reguł
  const legacyStorage = new MockStorageArea();
  legacyStorage.store[STORAGE_KEYS.RULES] = [
    {
      id: 'r_legacy',
      name: 'Stara',
      folderId: 'work',
      conditions: [{ field: 'name', operator: 'regex', value: '(foo|bar)+' }]
    },
    { id: 'r_ok', name: 'Dobra', folderId: 'work', conditions: [{ field: 'name', operator: 'contains', value: 'x' }] }
  ];
  const legacyEngine = new MessengerRulesEngine({ storageArea: legacyStorage });
  await legacyEngine.getRules();
  await legacyEngine.toggleRule('r_ok', false);
  await legacyEngine.deleteRule('r_ok');
  assert.deepStrictEqual(
    (await legacyEngine.getRules()).map((r) => r.id),
    ['r_legacy'],
    'Stara reguła zostaje, operacje na innych regułach działają'
  );
  assert.strictEqual(
    legacyEngine.matchCondition('foobar', { operator: 'regex', value: '(foo|bar)+' }),
    false,
    'Stary niebezpieczny wzorzec nie jest wykonywany'
  );
  await assert.rejects(
    legacyEngine.saveRule({
      id: 'r_legacy',
      name: 'Stara',
      folderId: 'work',
      conditions: [{ field: 'name', operator: 'regex', value: '(foo|bar)+' }]
    }),
    /alternatyw/,
    'Edycja starej reguły w edytorze wymaga poprawienia wzorca'
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

  // 11. Znaleziska LOW przeglądu MF-017 (MF-022)
  console.log('\nTest 11: lastError bez chrome, priorytet 0–100, znaczniki czasu, powód nieaktywności...');

  // pkt 3: bez zadeklarowanego `chrome` odczyt nie wpada w ReferenceError (i nie zwraca pustej pamięci)
  const savedChrome = global.chrome;
  delete global.chrome;
  try {
    const noChromeArea = new MockStorageArea();
    await new MessengerRulesEngine({ storageArea: noChromeArea }).saveRules([
      { id: 'r_nc', name: 'Bez chrome', folderId: 'work', conditions: [{ value: 'x' }] }
    ]);
    const freshEngine = new MessengerRulesEngine({ storageArea: noChromeArea });
    const rulesNoChrome = await freshEngine.getRules();
    assert.deepStrictEqual(
      rulesNoChrome.map((r) => r.id),
      ['r_nc'],
      'getRules() czyta pamięć także bez globalnego chrome'
    );
  } finally {
    global.chrome = savedChrome;
  }

  // pkt 4: jedna logika priorytetu z zakresem 0–100
  assert.strictEqual(MessengerRulesEngine.normalizePriority(150), 100, '150 → 100');
  assert.strictEqual(MessengerRulesEngine.normalizePriority('-5'), 0, '"-5" → 0');
  assert.strictEqual(MessengerRulesEngine.normalizePriority('abc'), 10, '"abc" → domyślne 10');
  assert.strictEqual(MessengerRulesEngine.normalizePriority(' 42 '), 42, '" 42 " → 42');
  assert.strictEqual(MessengerRulesEngine.parsePriority(150), 150, 'parsePriority() nie przycina (sortowanie)');

  // pkt 8: createdAt null nie staje się 0, edycja zachowuje createdAt i odświeża updatedAt
  const tsEngine = new MessengerRulesEngine({ storageArea: new MockStorageArea() });
  const realNow = Date.now;
  try {
    Date.now = () => 1000;
    const created = await tsEngine.saveRule({
      id: 'r_ts',
      name: 'Czas',
      folderId: 'work',
      priority: 500,
      createdAt: null,
      updatedAt: '',
      conditions: [{ value: 'a' }]
    });
    assert.strictEqual(created.createdAt, 1000, 'createdAt: null → bieżący czas, nie 0');
    assert.strictEqual(created.updatedAt, 1000, 'Nowa reguła: updatedAt = czas zapisu');
    assert.strictEqual(created.priority, 100, 'saveRule() przycina priorytet do 100');

    Date.now = () => 5000;
    const edited = await tsEngine.saveRule({
      id: 'r_ts',
      name: 'Czas 2',
      folderId: 'work',
      conditions: [{ value: 'b' }]
    });
    assert.strictEqual(edited.createdAt, 1000, 'Edycja zachowuje createdAt zapisanej reguły');
    assert.strictEqual(edited.updatedAt, 5000, 'Edycja zwraca nowy updatedAt');
    const stored = (await tsEngine.getRules()).find((r) => r.id === 'r_ts');
    assert.strictEqual(stored.updatedAt, 5000, 'Zapisany updatedAt jest nowy');
    assert.strictEqual(stored.createdAt, 1000, 'Zapisany createdAt bez zmian');
  } finally {
    Date.now = realNow;
  }

  // pkt 13: reguła poza budżetem RegEx i reguła bez folderu mają powód nieaktywności
  const legacyRule = { folderId: 'work', conditions: [{ field: 'name', operator: 'regex', value: '(foo|bar)+' }] };
  assert.ok(
    MessengerRulesEngine.describeRuleProblem(legacyRule, ['work']).startsWith(
      'Wyrażenie „(foo|bar)+” nie jest wykonywane'
    ),
    'RegEx sprzed MF-020 opisany'
  );
  assert.strictEqual(engine.matchCondition('foo', legacyRule.conditions[0]), false, 'Silnik i tak go nie wykonuje');
  assert.strictEqual(
    MessengerRulesEngine.describeRuleProblem({ folderId: 'gone', conditions: [{ value: 'x' }] }, [{ id: 'work' }]),
    'Folder docelowy nie istnieje — wybierz inny folder.',
    'Brak folderu opisany'
  );
  assert.strictEqual(
    MessengerRulesEngine.describeRuleProblem({ folderId: 'work', conditions: [{ operator: 'regex', value: '^a+$' }] }, [
      'work'
    ]),
    null,
    'Poprawna reguła bez powodu'
  );
  console.log('✓ lastError bez chrome, normalizePriority(), createdAt/updatedAt, describeRuleProblem().');

  console.log('\n=============================================');
  console.log('WSZYSTKIE TESTY REGUŁ ZAKOŃCZONE SUKCESEM! ✓');
  console.log('=============================================');
}

runRulesTests().catch((err) => {
  console.error('BŁĄD PODCZAS WYKONYWANIA TESTÓW REGUŁ:', err);
  process.exit(1);
});
