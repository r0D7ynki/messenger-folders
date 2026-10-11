/**
 * Messenger Folders - Moduł silnika automatycznych reguł przypisywania wątków (Rules Engine)
 *
 * Odpowiada za dopasowywanie wątków do folderów na podstawie słów kluczowych,
 * identyfikatorów i wyrażeń regularnych.
 *
 * Zgodny z zasadami Prostej Polszczyzny oraz normą PN-ISO 24495-1.
 */

(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    RULES: 'mf_rules'
  };

  const VALID_OPERATORS = ['contains', 'startsWith', 'endsWith', 'exact', 'regex'];
  const VALID_FIELDS = ['name', 'threadId', 'threadName'];

  // Zabezpieczenie przed ReDoS (catastrophic backtracking) i zbyt złożonymi wzorcami
  const MAX_REGEX_PATTERN_LENGTH = 250;
  // Budżet szacowanej liczby kroków nawrotu dla jednego dopasowania (pomiar w V8: 6–23 ns na krok,
  // czyli najwyżej ok. 50 ms w najgorszym przypadku)
  const MAX_REGEX_COST_LOG2 = Math.log2(2e6);
  // Długość tekstu, dla której wzorzec musi zmieścić się w budżecie, by dało się go zapisać
  const REGEX_REFERENCE_TEXT_LENGTH = 100;
  // Pamięć podręczna analiz wzorców (matchCondition wołane jest dla każdego wątku przy każdym skanie)
  const MAX_REGEX_ANALYSIS_CACHE = 200;
  const regexAnalysisCache = new Map();

  /**
   * Odczytuje kwantyfikator zaczynający się na pozycji `index` (`*`, `+`, `?`, `{n}`, `{n,}`, `{n,m}`).
   * @param {string} pattern Wzorzec wyrażenia regularnego.
   * @param {number} index Pozycja w wzorcu.
   * @returns {{length: number, min: number, max: number, repeats: boolean, varies: boolean}|null}
   *   Opis kwantyfikatora albo null: `repeats` — atom może wystąpić więcej niż raz,
   *   `varies` — liczba powtórzeń nie jest stała.
   */
  function readQuantifier(pattern, index) {
    const ch = pattern[index];
    let min;
    let max;
    let length = 1;
    if (ch === '*') [min, max] = [0, Infinity];
    else if (ch === '+') [min, max] = [1, Infinity];
    else if (ch === '?') [min, max] = [0, 1];
    else if (ch === '{') {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(index));
      if (!m) return null;
      min = Number(m[1]);
      max = m[2] ? (m[3] === '' ? Infinity : Number(m[3])) : min;
      length = m[0].length;
    } else {
      return null;
    }
    return { length, min, max, repeats: max > 1, varies: max !== min };
  }

  /**
   * Analizuje strukturę wzorca pod kątem nawrotów (ReDoS).
   *
   * Zwraca `hazard` dla konstrukcji wykładniczych niezależnie od długości tekstu: kwantyfikatora tuż
   * po kwantyfikatorze (`a++`) i grupy powtarzanej zmienną liczbę razy, która zawiera alternatywę albo
   * zmienny kwantyfikator (`(a|a)*`, `(a|ab)*c`, `(a+)+`, `((a*)b)*`).
   *
   * Pozostałe wzorce opisuje „punktami wyboru”, z których liczy się koszt dopasowania
   * (estimateRegexCostLog2): `bits` — log2 liczby wariantów z `?`, `|` i skończonych `{n,m}`
   * (każdy `?` i każdy `|` podwaja liczbę ścieżek), `unbounded` — liczba powtórzeń `*`, `+`, `{n,}`
   * (każde mnoży koszt przez długość tekstu). Grupa powtórzona stałą liczbę razy (`(\d{1,3}\.){3}`)
   * mnoży swoje punkty wyboru. Klasy znaków `[...]` i sekwencje ucieczki są pojedynczym atomem.
   * `anchored` — wzorzec zaczyna się od `^` i nie ma `|` na najwyższym poziomie (jedna pozycja startu).
   *
   * @param {string} pattern Wzorzec wyrażenia regularnego.
   * @returns {{hazard: string|null, bits: number, unbounded: number, anchored: boolean}} Wynik analizy.
   */
  function analyzeRegexPattern(pattern) {
    const newFrame = () => ({ hasAlt: false, hasQuant: false, bits: 0, unbounded: 0 });
    // Ramka na każdy poziom grupy: alternatywa, zmienny kwantyfikator i punkty wyboru wewnątrz
    const stack = [newFrame()];
    // Ostatni element: null (brak atomu), 'atom', 'quant' albo ramka zamkniętej grupy
    let last = null;
    let topLevelAlt = false;
    let i = 0;
    const result = (hazard) => ({
      hazard,
      bits: stack[0].bits,
      unbounded: stack[0].unbounded,
      anchored: pattern.startsWith('^') && !topLevelAlt
    });

    while (i < pattern.length) {
      const ch = pattern[i];
      const top = stack[stack.length - 1];

      if (ch === '\\') {
        last = 'atom';
        i += 2;
        continue;
      }

      if (ch === '[') {
        i++;
        if (pattern[i] === '^') i++;
        if (pattern[i] === ']') i++;
        while (i < pattern.length && pattern[i] !== ']') {
          if (pattern[i] === '\\') i++;
          i++;
        }
        i++;
        last = 'atom';
        continue;
      }

      if (ch === '(') {
        stack.push(newFrame());
        i++;
        if (pattern[i] === '?') {
          // Grupy specjalne: (?: (?= (?! (?<= (?<! (?<nazwa>
          i++;
          if (pattern[i] === '<' && pattern[i + 1] !== '=' && pattern[i + 1] !== '!') {
            const end = pattern.indexOf('>', i);
            i = end === -1 ? pattern.length : end + 1;
          } else {
            i += pattern[i] === '<' ? 2 : 1;
          }
        }
        last = null;
        continue;
      }

      if (ch === ')') {
        const frame = stack.length > 1 ? stack.pop() : newFrame();
        const parent = stack[stack.length - 1];
        parent.hasAlt = parent.hasAlt || frame.hasAlt;
        parent.hasQuant = parent.hasQuant || frame.hasQuant;
        parent.bits += frame.bits;
        parent.unbounded += frame.unbounded;
        last = frame;
        i++;
        continue;
      }

      if (ch === '|') {
        if (stack.length === 1) topLevelAlt = true;
        top.hasAlt = true;
        top.bits += 1;
        last = null;
        i++;
        continue;
      }

      const quant = readQuantifier(pattern, i);
      if (quant) {
        if (last === 'quant') {
          return result('Kwantyfikator tuż po kwantyfikatorze (np. a++).');
        }
        if (last && typeof last === 'object' && quant.repeats) {
          if (quant.varies && (last.hasAlt || last.hasQuant)) {
            return result(
              last.hasAlt
                ? 'Powtarzana grupa z alternatywą „|” (np. (a|b)*) może zawiesić stronę.'
                : 'Zagnieżdżone kwantyfikatory (np. (a+)+) mogą zawiesić stronę.'
            );
          }
          // Grupa powtórzona stałą liczbę razy: jej punkty wyboru występują `min` razy
          const extra = Math.min(quant.min, MAX_REGEX_PATTERN_LENGTH) - 1;
          top.bits += last.bits * extra;
          top.unbounded += last.unbounded * extra;
        }
        if (quant.varies) {
          top.hasQuant = true;
          if (quant.max === Infinity) top.unbounded += 1;
          else top.bits += Math.log2(quant.max - quant.min + 1);
        }
        i += quant.length;
        // Modyfikator leniwy (*?, +?, ??, {n,m}?) nie jest osobnym kwantyfikatorem
        if (pattern[i] === '?') i++;
        last = 'quant';
        continue;
      }

      last = 'atom';
      i++;
    }

    return result(null);
  }

  /**
   * Zwraca (z pamięci podręcznej) wynik analyzeRegexPattern dla wzorca.
   * @param {string} pattern Wzorzec wyrażenia regularnego.
   * @returns {{hazard: string|null, bits: number, unbounded: number, anchored: boolean}} Wynik analizy.
   */
  function getRegexAnalysis(pattern) {
    let analysis = regexAnalysisCache.get(pattern);
    if (!analysis) {
      analysis = analyzeRegexPattern(pattern);
      if (regexAnalysisCache.size >= MAX_REGEX_ANALYSIS_CACHE) {
        regexAnalysisCache.delete(regexAnalysisCache.keys().next().value);
      }
      regexAnalysisCache.set(pattern, analysis);
    }
    return analysis;
  }

  /**
   * Szacuje log2 liczby kroków nawrotu dla tekstu długości `textLength`: każde z `unbounded`
   * powtórzeń (i pozycja startu, chyba że wzorzec jest zakotwiczony `^`) wybiera punkt podziału
   * tekstu — C(n + u, u + 1) ≈ n^(u+1) / (u+1)! — a każdy bit punktów wyboru podwaja liczbę ścieżek.
   * @param {{bits: number, unbounded: number, anchored: boolean}} analysis Wynik analyzeRegexPattern.
   * @param {number} textLength Długość dopasowywanego tekstu.
   * @returns {number} log2 szacowanego kosztu.
   */
  function estimateRegexCostLog2(analysis, textLength) {
    const n = textLength + 1;
    let log2Cost = analysis.bits;
    const splitPoints = analysis.unbounded + (analysis.anchored ? 0 : 1);
    for (let k = 1; k <= splitPoints; k++) {
      log2Cost += Math.log2((n + k - 1) / k);
    }
    return log2Cost;
  }

  /**
   * Rzuca błąd, gdy któraś reguła ma niebezpieczny lub błędny wzorzec RegEx (validateRegexPattern).
   * Wzorce zapisane już wcześniej (ta sama reguła i wartość w `storedRules`) są pomijane, by starsza
   * reguła nie blokowała usuwania ani przełączania innych — matchCondition i tak ich nie wykona.
   * @param {Array<Object>} rules Znormalizowane reguły do zapisu.
   * @param {Array<Object>} [storedRules] Reguły obecnie zapisane w magazynie.
   */
  function assertSafeRegexConditions(rules, storedRules = []) {
    const storedPatterns = new Set();
    for (const r of storedRules || []) {
      for (const c of r.conditions || []) {
        if (c.operator === 'regex') storedPatterns.add(`${r.id}\u0000${c.value}`);
      }
    }
    for (const rule of rules) {
      for (const cond of rule.conditions || []) {
        if (cond.operator !== 'regex' || storedPatterns.has(`${rule.id}\u0000${cond.value}`)) continue;
        const regexError = validateRegexPattern(cond.value);
        if (regexError) throw new Error(regexError);
      }
    }
  }

  /**
   * Sprawdza, czy wzorzec RegEx nadaje się do reguły: długość, składnia i ryzyko ReDoS.
   * @param {string} pattern Wzorzec wyrażenia regularnego.
   * @returns {string|null} Komunikat błędu po polsku albo null, gdy wzorzec jest poprawny.
   */
  function validateRegexPattern(pattern) {
    const valStr = String(pattern ?? '');
    if (valStr.length > MAX_REGEX_PATTERN_LENGTH) {
      return `Wyrażenie jest za długie (maks. ${MAX_REGEX_PATTERN_LENGTH} znaków).`;
    }
    const analysis = getRegexAnalysis(valStr);
    if (analysis.hazard) {
      return analysis.hazard;
    }
    if (estimateRegexCostLog2(analysis, REGEX_REFERENCE_TEXT_LENGTH) > MAX_REGEX_COST_LOG2) {
      return 'Wyrażenie ma zbyt wiele możliwości dopasowania (?, *, +, |, {n,m}) — uprość je.';
    }
    try {
      new RegExp(valStr, 'i');
    } catch (_) {
      return 'Nieprawidłowa składnia wyrażenia regularnego.';
    }
    return null;
  }

  /**
   * Normalizuje pojedynczy warunek reguły.
   * @param {Object} cond
   * @returns {Object|null}
   */
  function normalizeCondition(cond) {
    if (!cond || typeof cond !== 'object') return null;
    const rawField = cond.field === 'threadName' ? 'name' : cond.field;
    const field = VALID_FIELDS.includes(rawField) ? rawField : 'name';

    let operator = typeof cond.operator === 'string' ? cond.operator : 'contains';
    if (operator === 'equals') operator = 'exact';
    if (!VALID_OPERATORS.includes(operator)) operator = 'contains';

    const value = cond.value !== undefined && cond.value !== null ? String(cond.value) : '';

    return { field, operator, value };
  }

  /**
   * Bezpiecznie parsuje priorytet reguły (akceptuje liczby i niepuste ciągi numeryczne,
   * odrzuca booleany, tablice, obiekty i białe znaki, zwracając domyślnie defaultPriority).
   * @param {*} rawPriority
   * @param {number} [defaultPriority=10]
   * @returns {number}
   */
  function parsePriority(rawPriority, defaultPriority = 10) {
    if (typeof rawPriority === 'number' && Number.isFinite(rawPriority)) {
      return rawPriority;
    }
    if (typeof rawPriority === 'string' && rawPriority.trim() !== '') {
      const parsed = Number(rawPriority);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return defaultPriority;
  }

  /**
   * Normalizuje i waliduje pojedynczy obiekt reguły.
   * @param {Object} rule
   * @param {number} [index=0]
   * @returns {Object|null}
   */
  function normalizeRule(rule, index = 0) {
    if (!rule || typeof rule !== 'object') return null;

    const id =
      typeof rule.id === 'string' && rule.id.trim()
        ? rule.id.trim()
        : `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const name =
      typeof rule.name === 'string' && rule.name.trim() ? rule.name.trim().slice(0, 50) : `Reguła ${index + 1}`;

    const enabled = rule.enabled !== false;
    const priority = parsePriority(rule ? rule.priority : undefined, 10);
    const folderId = typeof rule.folderId === 'string' ? rule.folderId.trim() : '';
    const matchMode = rule.matchMode === 'any' ? 'any' : 'all';

    const conditions = Array.isArray(rule.conditions) ? rule.conditions.map(normalizeCondition).filter(Boolean) : [];

    const overwriteManual = Boolean(rule.overwriteManual);
    const createdAt = Number.isFinite(Number(rule.createdAt)) ? Number(rule.createdAt) : Date.now();
    const updatedAt = Number.isFinite(Number(rule.updatedAt)) ? Number(rule.updatedAt) : Date.now();

    return {
      id,
      name,
      enabled,
      priority,
      folderId,
      matchMode,
      conditions,
      overwriteManual,
      createdAt,
      updatedAt
    };
  }

  class MessengerRulesEngine {
    /**
     * Tworzy instancję silnika reguł.
     * @param {Object} [options]
     * @param {Object} [options.storage] Opcjonalna instancja MessengerFoldersStorage.
     * @param {Object} [options.storageArea] Opcjonalny adapter chrome.storage.local.
     */
    constructor(options = {}) {
      this.storage = options.storage || null;
      this._storageArea =
        options.storageArea ||
        (this.storage && this.storage._storage) ||
        (typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null);
      this._cachedRules = [];
    }

    /**
     * Pobiera reguły z pamięci rozszerzenia (chrome.storage.local).
     * @returns {Promise<Array<Object>>}
     */
    async getRules() {
      if (this._storageArea && typeof this._storageArea.get === 'function') {
        return new Promise((resolve) => {
          try {
            this._storageArea.get(STORAGE_KEYS.RULES, (items) => {
              if (chrome?.runtime?.lastError) {
                resolve(this._cachedRules.map((r) => ({ ...r })));
              } else {
                const raw = items && items[STORAGE_KEYS.RULES];
                const rules = Array.isArray(raw) ? raw.map((r, i) => normalizeRule(r, i)).filter(Boolean) : [];
                this._cachedRules = rules;
                resolve(rules.map((r) => ({ ...r })));
              }
            });
          } catch (_) {
            resolve(this._cachedRules.map((r) => ({ ...r })));
          }
        });
      }

      return this._cachedRules.map((r) => ({ ...r }));
    }

    /**
     * Zapisuje reguły w pamięci rozszerzenia.
     * @param {Array<Object>} rules
     * @returns {Promise<Array<Object>>}
     */
    async saveRules(rules) {
      if (!Array.isArray(rules)) {
        throw new Error('Parametr rules musi być tablicą.');
      }

      const normalized = rules.map((r, i) => normalizeRule(r, i)).filter(Boolean);
      assertSafeRegexConditions(normalized, this._cachedRules);

      if (this._storageArea && typeof this._storageArea.set === 'function') {
        await new Promise((resolve, reject) => {
          try {
            this._storageArea.set({ [STORAGE_KEYS.RULES]: normalized }, () => {
              if (chrome?.runtime?.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          } catch (err) {
            reject(err);
          }
        });
      }

      this._cachedRules = normalized;
      return normalized.map((r) => ({ ...r }));
    }

    /**
     * Dodaje lub aktualizuje pojedynczą regułę.
     * @param {Object} rule
     * @returns {Promise<Object>}
     */
    async saveRule(rule) {
      const current = await this.getRules();
      const normalized = normalizeRule(rule);
      if (!normalized) throw new Error('Nieprawidłowy obiekt reguły.');
      assertSafeRegexConditions([normalized]);

      const existingIndex = current.findIndex((r) => r.id === normalized.id);
      if (existingIndex >= 0) {
        current[existingIndex] = { ...normalized, updatedAt: Date.now() };
      } else {
        current.push(normalized);
      }

      await this.saveRules(current);
      return normalized;
    }

    /**
     * Usuwa regułę o podanym ID.
     * @param {string} ruleId
     * @returns {Promise<boolean>}
     */
    async deleteRule(ruleId) {
      const current = await this.getRules();
      const filtered = current.filter((r) => r.id !== ruleId);
      if (filtered.length !== current.length) {
        await this.saveRules(filtered);
        return true;
      }
      return false;
    }

    /**
     * Przełącza aktywność reguły (włączona / wyłączona).
     * @param {string} ruleId
     * @param {boolean} [enabled]
     * @returns {Promise<Object|null>}
     */
    async toggleRule(ruleId, enabled) {
      const current = await this.getRules();
      const target = current.find((r) => r.id === ruleId);
      if (!target) return null;

      target.enabled = enabled !== undefined ? Boolean(enabled) : !target.enabled;
      target.updatedAt = Date.now();
      await this.saveRules(current);
      return { ...target };
    }

    /**
     * Sprawdza wzorzec RegEx warunku (długość, składnia, ryzyko ReDoS).
     * @param {string} pattern Wzorzec wyrażenia regularnego.
     * @returns {string|null} Komunikat błędu albo null, gdy wzorzec jest poprawny.
     */
    validateRegexPattern(pattern) {
      return validateRegexPattern(pattern);
    }

    /**
     * Sprawdza, czy dany tekst spełnia warunek reguły.
     * @param {string} text Tekst wejściowy (np. nazwa wątku lub threadId).
     * @param {Object} condition Obiekt warunku.
     * @returns {boolean}
     */
    matchCondition(text, condition) {
      if (!condition || typeof condition !== 'object') return false;
      if (condition.value === undefined || condition.value === null) return false;

      const valStr = String(condition.value);
      if (!valStr.trim() && condition.operator !== 'exact') return false;

      const textStr = String(text || '');
      let op = condition.operator || 'contains';
      if (op === 'equals') op = 'exact';

      switch (op) {
        case 'contains': {
          if (valStr.includes(',')) {
            const parts = valStr
              .split(',')
              .map((p) => p.trim().toLowerCase())
              .filter(Boolean);
            if (parts.length === 0) return false;
            const lowerText = textStr.toLowerCase();
            return parts.some((part) => lowerText.includes(part));
          }
          return textStr.toLowerCase().includes(valStr.trim().toLowerCase());
        }

        case 'startsWith': {
          return textStr.toLowerCase().startsWith(valStr.trim().toLowerCase());
        }

        case 'endsWith': {
          return textStr.toLowerCase().endsWith(valStr.trim().toLowerCase());
        }

        case 'exact': {
          return textStr.toLowerCase() === valStr.trim().toLowerCase();
        }

        case 'regex': {
          if (validateRegexPattern(valStr) !== null) {
            return false;
          }
          // Tekst dłuższy niż budżet przewiduje dla tego wzorca nie jest dopasowywany (bez obcinania)
          if (estimateRegexCostLog2(getRegexAnalysis(valStr), textStr.length) > MAX_REGEX_COST_LOG2) {
            return false;
          }
          try {
            const re = new RegExp(valStr, 'i');
            return re.test(textStr);
          } catch (_) {
            // Bezpieczne wyłapanie błędu składniowego wyrażenia regularnego
            return false;
          }
        }

        default:
          return false;
      }
    }

    /**
     * Ewaluuje pojedynczy wątek względem listy reguł i dostępnych folderów.
     * Zwraca identyfikator pasującego folderu lub null.
     * @param {Object} thread Obiekt wątku ({ threadId, name, folderId?, currentFolderId?, isManual? }).
     * @param {Array<Object>} rules Lista reguł.
     * @param {Array<Object>} [folders] Opcjonalna lista istniejących folderów do weryfikacji.
     * @returns {string|null}
     */
    evaluateThread(thread, rules, folders = null) {
      if (!thread || typeof thread !== 'object') return null;
      if (!Array.isArray(rules) || rules.length === 0) return null;

      let validFolderIds = null;
      if (Array.isArray(folders) && folders.length > 0) {
        validFolderIds = new Set(
          folders.map((f) => (typeof f === 'string' ? f : f?.id)).filter((id) => id && id !== 'all')
        );
      }

      // Filtrowanie aktywnych reguł i sortowanie po priorytecie rosnąco (z zachowaniem priorytetu 0)
      const activeRules = rules
        .filter(
          (r) =>
            r &&
            r.enabled !== false &&
            Array.isArray(r.conditions) &&
            r.conditions.some((c) => c && typeof c === 'object')
        )
        .sort((a, b) => {
          const prioA = parsePriority(a ? a.priority : undefined, 10);
          const prioB = parsePriority(b ? b.priority : undefined, 10);
          return prioA - prioB;
        });

      for (const rule of activeRules) {
        if (!rule.folderId || rule.folderId === 'all') {
          continue;
        }

        if (validFolderIds && !validFolderIds.has(rule.folderId)) {
          continue;
        }

        // Pomijamy reguły, które po odfiltrowaniu nie mają żadnych prawidłowych warunków obiektowych
        const validConditions = rule.conditions.filter((c) => c && typeof c === 'object');
        if (validConditions.length === 0) {
          continue;
        }

        // Ochrona przypisania ręcznego
        if (!rule.overwriteManual) {
          if (thread.isManual === true) {
            continue;
          }
          const existingFolder = thread.folderId || thread.currentFolderId;
          if (existingFolder && existingFolder !== 'uncategorized' && existingFolder !== 'all') {
            continue;
          }
        }

        const mode = rule.matchMode === 'any' ? 'any' : 'all';
        const evaluateCondition = (cond) => {
          if (!cond || typeof cond !== 'object') {
            return false;
          }
          const field = cond.field === 'threadId' ? 'threadId' : 'name';
          const textToMatch = field === 'threadId' ? thread.threadId : thread.name;
          return this.matchCondition(textToMatch, cond);
        };

        const isMatch =
          mode === 'any' ? validConditions.some(evaluateCondition) : validConditions.every(evaluateCondition);

        if (isMatch) {
          return rule.folderId;
        }
      }

      return null;
    }

    /**
     * Ewaluuje wsadowo kolekcję wątków względem reguł.
     * Zwraca Mapę par threadId => folderId dla pasujących wątków.
     * @param {Array|Map|Object} threads
     * @param {Array<Object>} rules
     * @param {Array<Object>} [folders]
     * @returns {Map<string, string>}
     */
    evaluateThreadsBatch(threads, rules, folders = null) {
      const result = new Map();
      if (!threads) return result;

      const threadList = Array.isArray(threads)
        ? threads
        : threads instanceof Map
          ? Array.from(threads.values())
          : typeof threads === 'object'
            ? Object.entries(threads).map(([k, v]) => ({
                threadId: k,
                ...(typeof v === 'object' && v !== null ? v : {})
              }))
            : [];

      for (const thread of threadList) {
        if (!thread || !thread.threadId) continue;
        const matchedFolderId = this.evaluateThread(thread, rules, folders);
        if (matchedFolderId) {
          result.set(String(thread.threadId).trim(), matchedFolderId);
        }
      }

      return result;
    }
  }

  MessengerRulesEngine.parsePriority = parsePriority;
  MessengerRulesEngine.validateRegexPattern = validateRegexPattern;
  MessengerRulesEngine.normalizePriority = parsePriority;

  // Udostępnienie w zasięgu globalnym oraz jako moduł CommonJS
  if (typeof global !== 'undefined') {
    global.MessengerRulesEngine = MessengerRulesEngine;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.MessengerRulesEngine = MessengerRulesEngine;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      MessengerRulesEngine,
      STORAGE_KEYS,
      parsePriority,
      validateRegexPattern
    };
    module.exports.default = MessengerRulesEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
