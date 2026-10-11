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
  const DANGEROUS_REGEX_PATTERN =
    /(?:[+*]|\{\d+,?\d*\})\s*(?:[+*]|\{\d+,?\d*\})|\([^(]*(?:[+*]|\{\d+,?\d*\})[^)]*\)+\s*(?:[+*]|\{\d+,?\d*\})/;
  const MAX_REGEX_PATTERN_LENGTH = 250;

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
    const priority =
      rule &&
      rule.priority !== null &&
      rule.priority !== undefined &&
      rule.priority !== '' &&
      Number.isFinite(Number(rule.priority))
        ? Number(rule.priority)
        : 10;
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
          if (valStr.length > MAX_REGEX_PATTERN_LENGTH) {
            return false;
          }
          if (DANGEROUS_REGEX_PATTERN.test(valStr)) {
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
          const prioA =
            a &&
            a.priority !== null &&
            a.priority !== undefined &&
            a.priority !== '' &&
            Number.isFinite(Number(a.priority))
              ? Number(a.priority)
              : 10;
          const prioB =
            b &&
            b.priority !== null &&
            b.priority !== undefined &&
            b.priority !== '' &&
            Number.isFinite(Number(b.priority))
              ? Number(b.priority)
              : 10;
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
      STORAGE_KEYS
    };
    module.exports.default = MessengerRulesEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
