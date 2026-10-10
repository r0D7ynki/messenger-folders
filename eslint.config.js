/**
 * Messenger Folders - Konfiguracja ESLint (flat config)
 *
 * Kod rozszerzenia to klasyczne skrypty (bez modułów ES) ładowane
 * przez manifest.json, a testy działają w Node (CommonJS).
 * Plugin no-unsanitized (Mozilla) oznacza każde przypisanie
 * do innerHTML/outerHTML i wywołanie insertAdjacentHTML z dynamiczną treścią.
 */

const js = require('@eslint/js');
const globals = require('globals');
const noUnsanitized = require('eslint-plugin-no-unsanitized');

module.exports = [
  {
    ignores: ['node_modules/**', 'web-ext-artifacts/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'popup/**/*.js', 'background/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.serviceworker,
        // Moduły współdzielone przez kolejność skryptów w manifest.json
        MessengerFoldersStorage: 'readonly',
        MessengerDOMDetector: 'readonly',
        MessengerFoldersUI: 'readonly',
        MessengerUI: 'readonly',
        // Eksport warunkowy dla testów w Node
        module: 'readonly',
        global: 'readonly'
      }
    },
    plugins: { 'no-unsanitized': noUnsanitized },
    rules: {
      // Wywołania funkcji escapujących uznajemy za bezpieczne; stałe ICONS nie są
      // rozpoznawane przez plugin, więc istniejące użycia są w eslint-suppressions.json
      'no-unsanitized/property': ['error', { escape: { methods: ['this._escapeHtml', 'escapeHtml'] } }],
      'no-unsanitized/method': ['error', { escape: { methods: ['this._escapeHtml', 'escapeHtml'] } }],
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
    }
  },
  {
    files: ['tests/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
    }
  }
];
