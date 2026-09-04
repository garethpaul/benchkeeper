import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { rm } from 'node:fs/promises';

// A separate profile is necessary: the normal native suite injects feature
// flags at launch, which cannot prove the setup instructions a judge follows.
test('Chrome settings enable real native judging, and Default restores honest manual mode', async ({
  playwright,
  baseURL
}, info) => {
  test.setTimeout(60000);
  const profile = info.outputPath('chrome-profile');
  const errors: string[] = [];
  const calls: { name: string; input: object; output: unknown }[] = [];
  const environments: object[] = [];
  let context: BrowserContext | undefined;
  let page: Page;

  async function open() {
    context = await playwright.chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      executablePath: process.env.CHROME_EXECUTABLE,
      headless: info.project.use.headless ?? true,
      viewport: { width: 1440, height: 1050 },
      reducedMotion: 'reduce'
      // Deliberately no WebMCP feature flags, mocks, app imports or init scripts.
    });
    page = context.pages()[0] ?? (await context.newPage());
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(baseURL!);
    expect(response?.status()).toBe(200);
    environments.push({
      version: context.browser()?.version(),
      url: page.url(),
      ...(await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        secureContext: isSecureContext,
        originIsolated: window.originAgentCluster,
        documentAPI: typeof document.modelContext,
        legacyAPI: typeof navigator.modelContext
      })))
    });
    expect(await page.evaluate(() => isSecureContext)).toBe(true);
    return page;
  }
  async function close() {
    if (!context) return;
    await context.close();
    context = undefined;
  }
  async function setting(value: 'Enabled' | 'Default') {
    await page.goto('chrome://flags/#enable-webmcp-testing');
    const control = page.locator('flags-experiment#enable-webmcp-testing select');
    await expect(control).toBeVisible();
    await control.selectOption({ label: value });
    await expect(control).toHaveValue(value);
    await info.attach(`setting-${value}`, {
      body: await page.screenshot(),
      contentType: 'image/png'
    });
    // A controlled full close/reopen applies the setting. This does not claim
    // automation of Chrome's Relaunch button or access to a user's own profile.
    await close();
  }
  async function call(name: string, input: Record<string, unknown> = {}) {
    const output = await page.evaluate(
      async ({ name, input }) => {
        const api = document.modelContext;
        if (!api?.getTools || !api.executeTool) throw new Error('Real native WebMCP is required.');
        const tool = (await api.getTools()).find((tool) => tool.name === name);
        if (!tool) throw new Error(`Native tool not registered: ${name}`);
        // Chrome's documented execution contract, independent of app runTool.
        return JSON.parse(await api.executeTool(tool, JSON.stringify(input)));
      },
      { name, input }
    );
    calls.push({ name, input, output });
    return output;
  }
  async function manual() {
    await expect(page.getByText('Manual mode · WebMCP unavailable')).toBeVisible();
    expect(
      await page.evaluate(
        () => !!(document.modelContext || navigator.modelContext || navigator.modelContextTesting)
      )
    ).toBe(false);
  }

  try {
    page = await open();
    await manual();
    await setting('Enabled');
    page = await open();
    await expect(page.getByText('10 agent tools ready', { exact: true })).toBeVisible();
    const catalog = await page.evaluate(async () =>
      (await document.modelContext!.getTools!()).map((tool) => ({
        name: tool.name,
        schema: tool.inputSchema,
        origin: tool.origin
      }))
    );
    expect(catalog).toHaveLength(10);
    expect(new Set(catalog.map((tool) => tool.name)).size).toBe(10);
    expect(catalog.some((tool) => /apply|approve|unlock|contact|payment/.test(tool.name))).toBe(
      false
    );
    for (const tool of catalog) {
      // Chrome 152 returns a serialized schema; newer API drafts use objects.
      const schema = typeof tool.schema === 'string' ? JSON.parse(tool.schema) : tool.schema;
      expect(schema).toMatchObject({ type: 'object' });
      expect(tool.origin).toBe(new URL(baseURL!).origin);
    }
    await info.attach('native-catalog', {
      body: JSON.stringify(catalog, null, 2),
      contentType: 'application/json'
    });

    const before = await call('get_repair_event', { limit: 8 });
    expect(before.ok).toBe(true);
    expect(before.result).toMatchObject({ revision: 0, appointments: 9, requests: 12 });
    const saved = await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'));
    expect((await call('preview_repair_plan', { absentVolunteerId: 'v-unknown' })).ok).toBe(false);
    const plan = await call('preview_repair_plan', { absentVolunteerId: 'v-sam' });
    expect(plan.ok).toBe(true);
    expect(plan.result.status).toBe('ready_for_review');
    let offset: number | null = 0;
    let totalChanges = 0;
    do {
      const changes = await call('inspect_plan_changes', {
        proposalId: plan.result.proposalId,
        view: 'changes',
        offset,
        limit: 1
      });
      expect(changes.ok).toBe(true);
      if (changes.result.nextOffset !== null)
        expect(changes.result.nextOffset).toBeGreaterThan(offset!);
      totalChanges++;
      offset = changes.result.nextOffset;
    } while (offset !== null);
    expect(totalChanges).toBeGreaterThan(1);
    expect((await call('request_plan_review', { proposalId: plan.result.proposalId })).ok).toBe(
      true
    );
    await expect(page.getByRole('heading', { name: 'Review the difference' })).toBeInViewport();
    expect((await call('get_repair_event')).result.revision).toBe(0);
    expect(await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'))).toBe(saved);
    await info.attach('native-unapplied-review', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png'
    });

    await page.getByRole('button', { name: 'Review & apply', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Apply reviewed plan' })).toBeDisabled();
    await page.getByLabel('I have reviewed the changes and scenario assumptions.').check();
    await page.getByRole('button', { name: 'Apply reviewed plan' }).click();
    const applied = await call('get_repair_event', { limit: 8 });
    expect(applied.ok).toBe(true);
    expect(applied.result.revision).toBe(1);
    expect(applied.result.protected).toEqual(before.result.protected);
    expect(applied.result.volunteers.find((v: { id: string }) => v.id === 'v-sam').available).toBe(
      false
    );
    const committed = await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'));
    await page.reload();
    await expect(page.getByText('10 agent tools ready', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'))).toBe(committed);
    expect((await call('get_repair_event', { limit: 8 })).result.protected).toEqual(
      before.result.protected
    );
    await expect(
      page.getByLabel('Current appointment timeline').locator('.absence-label')
    ).toHaveText('Not available for this session');

    await setting('Default');
    page = await open();
    await manual();
    await page.getByRole('button', { name: 'Agent tools', exact: true }).click();
    await page.getByRole('button', { name: 'Run scripted rehearsal' }).click();
    await expect(page.getByRole('heading', { name: 'Review the difference' })).toBeInViewport();
    await page.getByRole('button', { name: 'Agent tools', exact: true }).click();
    await expect(
      page.getByText('Direct-handler rehearsal — NOT native WebMCP or an AI agent', {
        exact: true
      })
    ).toHaveCount(3);
    await expect(page.getByText('Native document.modelContext call', { exact: true })).toHaveCount(
      0
    );
    expect(errors).toEqual([]);
  } finally {
    try {
      await info.attach('judge-journey', {
        body: JSON.stringify(
          {
            environments,
            calls,
            errors,
            mockedAPI: false,
            restart: 'controlled full close/reopen',
            automatedOrganizer: true
          },
          null,
          2
        ),
        contentType: 'application/json'
      });
    } finally {
      await close();
      await rm(profile, { recursive: true, force: true });
    }
  }
});
