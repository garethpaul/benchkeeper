import { defineConfig } from '@playwright/test';
import { join } from 'node:path';
import { evidencePath, testEvidenceDirectory } from './tests/evidence-path';
// Defaults to Playwright's pinned browser. Native tests fail, rather than mock
// the API, if that executable does not support the required WebMCP methods.
const executablePath = process.env.CHROME_EXECUTABLE;
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: process.env.BENCHKEEPER_TEST_EVIDENCE_DIR
    ? join(testEvidenceDirectory, 'artifacts')
    : 'test-results',
  timeout: 30000,
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['json', { outputFile: evidencePath('playwright-results.json') }]],
  use: {
    baseURL: process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1050 },
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'native-chrome',
      testIgnore: '**/fallback.spec.ts',
      use: {
        launchOptions: {
          executablePath,
          // Exercise normal browser history restoration, including the native
          // BFCache journey. Playwright disables this feature by default.
          ignoreDefaultArgs: ['--disable-back-forward-cache', '--hide-scrollbars'],
          args: ['--enable-blink-features=WebMCP', '--enable-features=WebMCPTesting']
        }
      }
    },
    {
      name: 'unsupported-chrome',
      testMatch: '**/fallback.spec.ts',
      use: {
        launchOptions: {
          executablePath,
          // Keep native scrollbar gutters in layout and keyboard checks.
          ignoreDefaultArgs: ['--hide-scrollbars', '--disable-back-forward-cache'],
          args: ['--disable-blink-features=WebMCP']
        }
      }
    }
  ],
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true }
});
