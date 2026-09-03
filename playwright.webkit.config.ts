import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import { evidencePath } from './tests/evidence-path';

// Patched Playwright WebKit on the current OS, not a branded Safari/device test.
export default defineConfig({
  ...base,
  reporter: [['list'], ['json', { outputFile: evidencePath('webkit-results.json') }]],
  projects: [
    {
      name: 'webkit-manual',
      testMatch: '**/fallback.spec.ts',
      use: {
        browserName: 'webkit',
        launchOptions: { executablePath: process.env.WEBKIT_EXECUTABLE }
      }
    }
  ]
});
