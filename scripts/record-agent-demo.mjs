// Recording bridge only. Tool names/arguments arrive from the external agent.
// No app state injection, model implementation, automatic tool choice or public URL.
import { chromium, expect } from '@playwright/test';
import { createInterface } from 'node:readline';
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
const tag = process.argv[2];
if (!/^[a-z][a-z0-9-]{0,35}$/.test(tag ?? '')) throw new Error('Supply a unique safe run tag.');
const output = resolve(`work/demo/agent-candidates/${tag}`);
mkdirSync('work/demo/agent-candidates', { recursive: true, mode: 0o700 });
mkdirSync(output, { mode: 0o700 });
const log = resolve(output, 'trace.jsonl');
const url = new URL(process.env.TEST_BASE_URL ?? 'http://127.0.0.1:8787');
if (
  !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
  !['http:', 'https:'].includes(url.protocol) ||
  url.username ||
  url.password
)
  throw new Error('Unauthenticated loopback HTTP(S) only.');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE,
  args: ['--enable-blink-features=WebMCP', '--enable-features=WebMCPTesting']
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  reducedMotion: 'reduce',
  recordVideo: { dir: 'work/demo/raw', size: { width: 1440, height: 960 } }
});
// A missing camera target must fail the take rather than hang until the watchdog.
context.setDefaultTimeout(5000);
const blockedNetwork = [];
await context.route('**/*', async (route) => {
  if (new URL(route.request().url()).origin === url.origin) await route.continue();
  else {
    blockedNetwork.push(route.request().url());
    await route.abort();
  }
});
const page = await context.newPage();
const trace = [],
  errors = [];
let started = null,
  initial = null,
  finalEvent = null,
  complete = false;
const seconds = () => (started === null ? null : (performance.now() - started) / 1000);
const record = (entry) => {
  const row = { at: new Date().toISOString(), seconds: seconds(), ...entry };
  trace.push(row);
  appendFileSync(log, JSON.stringify(row) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(row));
};
page.on('pageerror', (error) => {
  errors.push(error.message);
  record({ type: 'page-error', message: error.message });
});
const disclosure =
  'DEVELOPER-GUIDED AGENT · SYNTHETIC DATA & NARRATION · ORGANIZER CLICKS AUTOMATED';
const chapterStarts = JSON.parse(readFileSync('docs/demo-agent-storyboard.json', 'utf8')).map(
  (chapter) => chapter.start
);
async function pace(at) {
  if (at === undefined) return;
  if (started === null || !Number.isFinite(at) || at < 0 || at > 121)
    throw new Error('Invalid paced time.');
  const delay = at * 1000 - (performance.now() - started);
  if (delay < -6000)
    throw new Error(`Missed recording beat ${at}s; actual ${seconds().toFixed(2)}s.`);
  // This holds the real recording for readable chapter timing, not the work window.
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}
async function ui(action) {
  const button = (name) => page.getByRole('button', { name, exact: true });
  switch (action) {
    case 'tools':
      await button('Agent tools').click();
      await page
        .locator('.tool-catalog details')
        .filter({
          has: page.locator('summary code').getByText('preview_repair_plan', { exact: true })
        })
        .locator('summary')
        .click();
      await page
        .locator('.tool-catalog')
        .evaluate((element) => element.scrollIntoView({ block: 'start' }));
      break;
    case 'promise':
      await page
        .locator('.appointment-summary')
        .evaluate((element) => element.scrollIntoView({ block: 'center' }));
      break;
    case 'current':
      await button('Current').click();
      await page.getByLabel('Current appointment timeline').scrollIntoViewIfNeeded();
      break;
    case 'proposed':
      await button('Proposed').click();
      await page.getByLabel('Proposed appointment timeline').scrollIntoViewIfNeeded();
      break;
    case 'review':
      await page.locator('.proposal-panel').evaluate((el) => el.scrollIntoView({ block: 'start' }));
      break;
    case 'capacity':
      await page.getByRole('region', { name: 'Capacity explanation' }).scrollIntoViewIfNeeded();
      break;
    case 'close-request':
      await button('Close dialog').click();
      break;
    case 'open-approval':
      await button('Review & apply').click();
      await expect(button('Apply reviewed plan')).toBeDisabled();
      break;
    case 'check-approval':
      await page.getByLabel('I have reviewed the changes and scenario assumptions.').check();
      break;
    case 'apply':
      await button('Apply reviewed plan').click();
      break;
    case 'print':
      await button('Print current desk packet').click();
      break;
    case 'packet-repairer':
      await page
        .getByRole('dialog')
        .getByRole('heading', { name: 'Ada', exact: true })
        .scrollIntoViewIfNeeded();
      break;
    case 'close-print':
      await button('Close preview').click();
      break;
    case 'timeline':
      await page.getByLabel('Current appointment timeline').scrollIntoViewIfNeeded();
      break;
    default:
      throw new Error('Unknown organizer-interface action.');
  }
  record({
    type: 'organizer-ui',
    action,
    actor: 'Automated organizer-interface demonstration; not a native tool or real human operator.'
  });
}
let navBounds;
let input, watchdog;
try {
  await page.goto(url.href);
  await expect(page.getByText('10 agent tools ready', { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  navBounds = await page.getByRole('button', { name: 'Agent tools', exact: true }).boundingBox();
  await page.evaluate((text) => {
    const banner = document.createElement('div');
    banner.id = 'recording-disclosure';
    banner.textContent = text;
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
  }, disclosure);
  record({
    type: 'ready',
    browser: browser.version(),
    origin: url.origin,
    choiceSource: 'external-developer-agent',
    independentBenchmark: false,
    disclosure,
    scripts: await page
      .locator('script[src]')
      .evaluateAll((es) => es.map((e) => e.getAttribute('src')))
  });
  // Start consuming stdin only when its async iterator can receive every line.
  // Creating readline before asynchronous page setup loses piped commands.
  input = createInterface({ input: process.stdin, terminal: false });
  watchdog = setTimeout(() => {
    errors.push('Recording time limit reached.');
    record({ type: 'recording-error', message: 'Recording time limit reached.' });
    input.close();
    void page.close().catch(() => {});
  }, 360000);
  for await (const line of input) {
    if (!line.trim()) continue;
    try {
      const command = JSON.parse(line);
      if (command.command === 'begin') {
        if (started !== null) throw new Error('Recording already started.');
        if (typeof command.task !== 'string' || !command.task.trim() || command.task.length > 600)
          throw new Error('A bounded demo task is required.');
        started = performance.now();
        record({
          type: 'task',
          text: command.task,
          callerProvenance: process.env.DEMO_CALLER ?? 'Not recorded'
        });
        record({ type: 'chapter', index: 0 });
        continue;
      }
      if (command.command === 'catalog') {
        const result = await page.evaluate(
          async (names) =>
            (await document.modelContext.getTools())
              .filter((t) => !names || names.includes(t.name))
              .map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
          command.names
        );
        record({ type: 'catalog', result });
        continue;
      }
      if (started === null) throw new Error('Begin the recording before actions.');
      if (command.command === 'chapter') {
        if (!Number.isInteger(command.index) || command.index < 1 || command.index > 6)
          throw new Error('Invalid chapter.');
        await pace(chapterStarts[command.index]);
        record({ type: 'chapter', index: command.index });
        continue;
      }
      await pace(command.at);
      if (command.command === 'call') {
        const result = await page.evaluate(
          async ({ name, args }) => {
            const api = document.modelContext;
            const tool = (await api.getTools()).find((t) => t.name === name);
            if (!tool) throw new Error('Native tool not registered.');
            return JSON.parse(await api.executeTool(tool, JSON.stringify(args ?? {})));
          },
          { name: command.name, args: command.args }
        );
        record({
          type: 'native-call',
          name: command.name,
          input: command.args ?? {},
          output: result,
          choiceSource: 'external-developer-agent'
        });
        if (!result.ok) throw new Error(`Native call refused: ${result.error}`);
        if (command.name === 'get_repair_event') {
          if (!initial) initial = result.result;
          else finalEvent = result.result;
        }
      } else if (command.command === 'ui') await ui(command.action);
      else if (command.command === 'finish') {
        if (
          seconds() < 120 ||
          !initial ||
          !finalEvent ||
          finalEvent.revision <= initial.revision ||
          errors.length ||
          blockedNetwork.length
        )
          throw new Error('Incomplete or failed recording cannot be promoted.');
        const saved = await page.evaluate(() =>
          JSON.parse(sessionStorage.getItem('repair-desk-v1'))
        );
        record({ type: 'final-state', ...saved });
        complete = true;
        record({
          type: 'complete',
          elapsedSeconds: seconds(),
          initial,
          finalEvent,
          browser: browser.version(),
          choiceSource: 'external-developer-agent',
          organizerActions: 'automated',
          independentBenchmark: false
        });
        break;
      } else if (command.command === 'stop') {
        record({ type: 'abandoned' });
        break;
      } else throw new Error('Unknown recording command.');
    } catch (error) {
      errors.push(error.message);
      record({ type: 'recording-error', message: error.message });
      break;
    }
  }
} finally {
  clearTimeout(watchdog);
  input?.close();
  await context.close();
  const path = await page.video().path();
  await browser.close();
  writeFileSync(
    resolve(output, 'recording.json'),
    JSON.stringify(
      {
        status: complete ? 'complete' : 'failed',
        path,
        navBounds,
        trace,
        errors,
        blockedNetwork,
        choiceSource: 'external-developer-agent',
        organizerActions: 'automated',
        independentBenchmark: false,
        disclosure
      },
      null,
      2
    ) + '\n',
    { flag: 'wx', mode: 0o600 }
  );
  if (!complete) process.exitCode = 1;
  console.log(
    JSON.stringify({
      type: 'closed',
      status: complete ? 'complete' : 'failed',
      metadata: resolve(output, 'recording.json'),
      path
    })
  );
}
