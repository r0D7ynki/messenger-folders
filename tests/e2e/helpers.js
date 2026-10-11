/* global chrome */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const EXTENSION_PATH = path.resolve(__dirname, '../../');
const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/messenger.html');

/**
 * Uruchamia trwały kontekst Chromium z załadowanym rozszerzeniem MV3 w trybie headless.
 * Konfiguruje przechwytywanie routingu z serwowaniem lokalnego fixture DOM Messengera
 * i blokowaniem żądań zewnętrznych.
 */
async function createExtensionContext() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-e2e-'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-gpu'
    ]
  });

  const fixtureHtml = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  const externalRequests = [];

  // Przechwycenie routingu - 100% offline
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('https://www.messenger.com')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: fixtureHtml
      });
    } else if (url.startsWith('chrome-extension://') || url.startsWith('data:') || url.startsWith('about:')) {
      await route.continue();
    } else {
      externalRequests.push(url);
      await route.abort('blockedbyclient');
    }
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  const cleanup = async () => {
    try {
      await context.close();
    } catch (_) {
      // ignore
    }
    try {
      if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
    } catch (_) {
      // ignore
    }
  };

  return {
    context,
    page,
    userDataDir,
    externalRequests,
    cleanup
  };
}

/**
 * Odczytuje dane z chrome.storage.local za pośrednictwem background service workera rozszerzenia.
 * Akceptuje obiekt page lub context.
 */
async function getStorageData(target, key) {
  const context = target.context ? target.context() : target;
  let worker = context.serviceWorkers()[0];
  if (!worker) {
    try {
      worker = await context.waitForEvent('serviceworker', { timeout: 3000 });
    } catch (_) {
      // ignore
    }
  }
  if (!worker) {
    worker = context.serviceWorkers()[0];
  }

  if (worker) {
    return await worker.evaluate(async (storageKey) => {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(storageKey, (res) => resolve(res[storageKey]));
        } else {
          resolve(null);
        }
      });
    }, key);
  }

  return null;
}

module.exports = {
  createExtensionContext,
  getStorageData,
  EXTENSION_PATH,
  FIXTURE_PATH
};
