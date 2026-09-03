import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { build } from 'vite';

let bundle: string;
test.beforeAll(async () => {
  // Bundle the real hook with development React so StrictMode exercises its
  // extra effect cycle. No WebMCP API is mocked or polyfilled.
  const built = await build({
    configFile: false,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"' },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve('tests/fixtures/binding-lifecycle.tsx'),
        formats: ['es'],
        fileName: () => 'binding.mjs'
      }
    }
  });
  const result = Array.isArray(built) ? built[0] : built;
  if (!('output' in result)) throw new Error('Expected a fixture bundle, not a build watcher.');
  const chunks = result.output.filter((item) => item.type === 'chunk');
  expect(chunks).toHaveLength(1);
  bundle = chunks[0].code;
});

test.beforeEach(async ({ page, browser }, info) => {
  await page.route('**/__binding-lifecycle.mjs', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: bundle })
  );
  await page.route('**/__binding-lifecycle.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'Permissions-Policy': 'tools=(self)' },
      body: '<!doctype html><title>Native binding lifecycle fixture</title><div id="root"></div><script type="module" src="/__binding-lifecycle.mjs"></script>'
    })
  );
  await page.goto('/__binding-lifecycle.html');
  await page.waitForFunction(() => !!window.bindingFixture);
  const surface = await page.evaluate(() => {
    if (document.modelContext) return 'Document';
    if (navigator.modelContext) return 'Navigator';
    throw new Error('This lifecycle test requires real native WebMCP.');
  });
  await info.attach('native-lifecycle-environment', {
    body: JSON.stringify({
      browser: browser.version(),
      surface,
      interceptedFixture: true,
      mockedAPI: false
    }),
    contentType: 'application/json'
  });
});

async function registerOwner(page: Page, name: string) {
  await page.evaluate(async (name) => {
    await (document.modelContext ?? navigator.modelContext)!.registerTool({
      name,
      description: 'Harmless native test-owned tool; no event access.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => 'owner remains callable'
    });
  }, name);
}
async function names(page: Page) {
  return page.evaluate(async () => {
    const tools = document.modelContext?.getTools
      ? await document.modelContext.getTools()
      : navigator.modelContextTesting!.listTools();
    return tools.map((tool) => tool.name).sort();
  });
}
async function callOwner(page: Page, name: string) {
  return page.evaluate(async (name) => {
    const api = document.modelContext;
    if (api?.getTools && api.executeTool)
      return api.executeTool(
        (await api.getTools()).find((tool) => tool.name === name)!,
        '{}'
      );
    return navigator.modelContextTesting!.executeTool(name, '{}');
  }, name);
}

for (const strict of [false, true]) {
  test(`native binding unmount preserves unrelated tools (StrictMode ${strict})`, async ({
    page
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await registerOwner(page, 'lifecycle_owner_marker');
    await page.evaluate((strict) => window.bindingFixture.mount(strict), strict);
    await expect(page.locator('#binding-status')).toHaveText(/^(native|legacy):10$/);
    await expect.poll(async () => (await names(page)).length).toBe(11);
    const removedEarly = await page.evaluate(() => {
      if (document.modelContext || !navigator.modelContext?.unregisterTool) return false;
      // A real legacy API call, not fault injection into the API implementation.
      navigator.modelContext.unregisterTool('get_repair_event');
      return true;
    });
    await info.attach('already-removed-legacy-tool', {
      body: String(removedEarly),
      contentType: 'text/plain'
    });
    await page.evaluate(() => window.bindingFixture.unmount());
    await expect(page.locator('#binding-status')).toHaveCount(0);
    await expect.poll(() => names(page)).toEqual(['lifecycle_owner_marker']);
    expect(await callOwner(page, 'lifecycle_owner_marker')).toBe('owner remains callable');
    expect(errors).toEqual([]);
  });

  test(`native collision owner survives failed binding and unmount (StrictMode ${strict})`, async ({
    page
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await registerOwner(page, 'preview_repair_plan');
    await page.evaluate((strict) => window.bindingFixture.mount(strict), strict);
    await expect(page.locator('#binding-status')).toHaveText('error:0');
    await expect.poll(() => names(page)).toEqual(['preview_repair_plan']);
    await page.evaluate(() => window.bindingFixture.unmount());
    await expect(page.locator('#binding-status')).toHaveCount(0);
    await expect.poll(() => names(page)).toEqual(['preview_repair_plan']);
    expect(await callOwner(page, 'preview_repair_plan')).toBe('owner remains callable');
    expect(errors).toEqual([]);
  });
}
