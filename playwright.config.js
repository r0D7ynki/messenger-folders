const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  outputDir: './node_modules/.cache/playwright-results',
  reporter: [['list']],
  use: {
    trace: 'off',
    video: 'off',
    screenshot: 'off'
  }
});
