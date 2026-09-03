// Records the real local app. No model, fake tools, substituted UI, or public URL.
import { chromium, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const url = new URL(process.env.TEST_BASE_URL ?? 'http://127.0.0.1:8787');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  throw new Error('Recording is loopback-only.');
const storyboard = JSON.parse(readFileSync('docs/demo-storyboard.json', 'utf8'));
mkdirSync('work/demo/raw', { recursive: true });
rmSync('work/demo/recording.json', { force: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE,
  args: ['--enable-blink-features=WebMCP', '--enable-features=WebMCPTesting']
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  reducedMotion: 'reduce',
  recordVideo: { dir: 'work/demo/raw', size: { width: 1440, height: 960 } }
});
const page = await context.newPage();
const trace = [];
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
async function native(name, input) {
  const output = await page.evaluate(
    async ({ name, input }) => {
      const api = document.modelContext;
      const tool = (await api.getTools()).find((t) => t.name === name);
      if (!tool) throw new Error(`Native tool missing: ${name}`);
      return JSON.parse(await api.executeTool(tool, JSON.stringify(input)));
    },
    { name, input }
  );
  if (!output.ok) throw new Error(output.error);
  trace.push({ type: 'native-call', name, input, output });
  return output.result;
}
try {
  await page.goto(url.href);
  await expect(page.getByText('10 agent tools ready', { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const navBounds = await page
    .getByRole('button', { name: 'Agent tools', exact: true })
    .boundingBox();
  await page.evaluate(() => {
    const banner = document.createElement('div');
    banner.id = 'recording-disclosure';
    banner.textContent = 'SCRIPTED DEMO · SYNTHETIC DATA & NARRATION · NO LLM IN THIS REHEARSAL';
    Object.assign(banner.style, {
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      zIndex: '100000',
      background: '#173d30',
      color: '#ffffff',
      padding: '11px 24px',
      font: '600 12px sans-serif',
      letterSpacing: '1px',
      textAlign: 'center',
      pointerEvents: 'none'
    });
    document.body.append(banner);
  });
  const initial = await native('get_repair_event', {});
  trace.push({
    type: 'loaded-assets',
    scripts: await page
      .locator('script[src]')
      .evaluateAll((scripts) => scripts.map((script) => script.getAttribute('src')))
  });
  if (initial.appointments !== 9) throw new Error('A fresh synthetic demo is required.');
  const started = performance.now();
  // These waits pace an actual recorded artifact; they are not work-window padding.
  async function at(seconds) {
    const remaining = seconds * 1000 - (performance.now() - started);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  async function chapter(index) {
    await at(storyboard[index].start);
    trace.push({ type: 'chapter', index, seconds: (performance.now() - started) / 1000 });
    console.log(`Recording chapter ${index + 1}: ${storyboard[index].title}`);
  }
  async function showReview() {
    await page
      .locator('.proposal-panel')
      .evaluate((panel) => panel.scrollIntoView({ block: 'start' }));
  }
  await chapter(0);
  await page.getByLabel('Current appointment timeline').scrollIntoViewIfNeeded();
  await chapter(1);
  await page.getByRole('button', { name: 'Agent tools', exact: true }).click();
  await page.getByRole('heading', { name: 'Rehearse the cancellation' }).scrollIntoViewIfNeeded();
  await at(25);
  await page.getByRole('button', { name: 'Run scripted rehearsal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review the difference' })).toBeInViewport();
  await expect(page.getByText('Native document.modelContext call', { exact: true })).toHaveCount(3);
  const rehearsal = await page.locator('.tool-results details').nth(1).locator('pre').textContent();
  const proposalId = JSON.parse(rehearsal).result.proposalId;
  trace.push({
    type: 'native-rehearsal',
    results: await page.locator('.tool-results pre').allTextContents()
  });
  await chapter(2);
  await page.getByRole('button', { name: 'Current', exact: true }).click();
  await page.getByLabel('Current appointment timeline').scrollIntoViewIfNeeded();
  await at(39);
  await page.getByRole('button', { name: 'Proposed', exact: true }).click();
  await at(43);
  await showReview();
  await chapter(3);
  const capacity = await native('explain_repair_capacity', { requestId: 'r-fan', proposalId });
  await native('show_repair_request', { requestId: 'r-fan' });
  await page.getByRole('region', { name: 'Capacity explanation' }).scrollIntoViewIfNeeded();
  await expect(page.getByText(capacity.explanation, { exact: true })).toBeVisible();
  await chapter(4);
  await page
    .getByRole('button', { name: 'Preview making room for this item', exact: true })
    .click();
  await showReview();
  await at(78);
  await page.getByLabel('Proposed appointment timeline').scrollIntoViewIfNeeded();
  await chapter(5);
  await page.getByRole('button', { name: 'Review & apply', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Apply reviewed plan', exact: true })
  ).toBeDisabled();
  await at(97);
  await page.getByLabel('I have reviewed the changes and scenario assumptions.').check();
  await at(100);
  await page.getByRole('button', { name: 'Apply reviewed plan', exact: true }).click();
  const finalEvent = await native('get_repair_event', {});
  if (finalEvent.revision <= initial.revision) throw new Error('Plan was not applied.');
  await chapter(6);
  await page.getByRole('button', { name: 'Print current desk packet', exact: true }).click();
  await at(111);
  await page
    .getByRole('dialog')
    .getByRole('heading', { name: 'Ada', exact: true })
    .scrollIntoViewIfNeeded();
  await at(116);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await page.getByLabel('Current appointment timeline').scrollIntoViewIfNeeded();
  await at(121);
  if (pageErrors.length)
    throw new Error(`Browser errors during recording: ${pageErrors.join('; ')}`);
  trace.push({
    type: 'complete',
    elapsedSeconds: (performance.now() - started) / 1000,
    initial,
    finalEvent,
    browser: browser.version()
  });
  await context.close();
  const path = await page.video().path();
  writeFileSync(
    'work/demo/recording.json',
    JSON.stringify({ path, navBounds, trace }, null, 2) + '\n'
  );
  console.log(`Recorded local demo: ${path}`);
} finally {
  await browser.close();
}
