import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import { evidencePath } from './tests/evidence-path';

export default defineConfig({
  ...base,
  reporter: [['list'], ['json', { outputFile: evidencePath('firefox-results.json') }]],
  projects: [
    { name: 'firefox-manual', testMatch: '**/fallback.spec.ts', use: { browserName: 'firefox' } }
  ]
});
