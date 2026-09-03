// Interactive, local-only bridge to actual browser-registered WebMCP tools.
// It does not select tools, run a model, or contain a scripted task solution.
import { chromium } from '@playwright/test';
import { createInterface } from 'node:readline';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { resolve, sep } from 'node:path';

const base = new URL(process.env.TEST_BASE_URL ?? 'http://127.0.0.1:8787');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))
  throw new Error('Trials are loopback-only.');
const trial = process.argv[2] ?? 'cancellation-parts';
if (!/^[a-z][a-z0-9-]{0,40}$/.test(trial)) throw new Error('Invalid trial name.');
const runSuffix = process.env.TRIAL_RUN_SUFFIX ?? '';
if (runSuffix && !/^[a-z][a-z0-9-]{0,30}$/.test(runSuffix))
  throw new Error('Invalid trial run suffix.');
const runName = trial + (runSuffix ? `-${runSuffix}` : '');
let fixturePath = new URL('../tests/fixtures/native-trials.json', import.meta.url);
if (process.env.TRIAL_FIXTURE) {
  const candidate = realpathSync(resolve(process.env.TRIAL_FIXTURE));
  if (!candidate.startsWith(resolve('work/evidence/generated-trials') + sep))
    throw new Error('Custom fixtures must stay under work/evidence/generated-trials.');
  if (statSync(candidate).size > 200000) throw new Error('Trial fixture exceeds its size limit.');
  fixturePath = candidate;
}
let fixture;
try {
  fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
} catch {
  throw new Error('Trial fixture is not valid JSON. Its contents were not logged.');
}
if (!fixture.tasks[trial]) throw new Error('Unknown trial.');
const fixtureEvent = fixture.events?.[trial] ?? fixture.event;
const event = {
  ...fixtureEvent,
  volunteers: [...fixtureEvent.volunteers, ...(fixture.extraVolunteers?.[trial] ?? [])]
};
mkdirSync('work/evidence', { recursive: true });
const log = resolve(`work/evidence/native-trial-${runName}.jsonl`);
// Refuse both overwriting and appending a second run to an existing trace.
// A suffix provides a separate evidence file without changing the task fixture.
try {
  writeFileSync(log, '', { flag: 'wx', mode: 0o600 });
} catch {
  throw new Error(
    'A trace already exists or cannot be created. Preserve it and choose a new TRIAL_RUN_SUFFIX.'
  );
}
const record = (entry, echo = true) => {
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
  appendFileSync(log, line + '\n', { mode: 0o600 });
  if (echo) console.log(line);
};
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE,
  args: ['--enable-blink-features=WebMCP', '--enable-features=WebMCPTesting']
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  reducedMotion: 'reduce',
  ...(process.env.TRIAL_RECORD === '1'
    ? {
        recordVideo: {
          dir: `work/evidence/generated-trials/video/${runName}`,
          size: { width: 1440, height: 1050 }
        }
      }
    : {})
});
const blockedNetwork = [];
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.origin === base.origin) await route.continue();
  else {
    blockedNetwork.push(url.origin);
    await route.abort();
  }
});
const page = await context.newPage();
await page.goto(base.href);
await page.getByText('10 agent tools ready', { exact: true }).waitFor();
await page.getByRole('button', { name: 'Import event backup' }).click();
await page.getByLabel('Event JSON').fill(JSON.stringify(event));
await page.getByRole('button', { name: 'Validate & replace event' }).click();
await page.getByRole('dialog').waitFor({ state: 'hidden' });
if (process.env.TRIAL_RECORD === '1')
  await page.evaluate(() => {
    const label = document.createElement('div');
    label.id = 'trial-disclosure';
    label.textContent =
      'DEVELOPER-AGENT TRIAL · SYNTHETIC DATA · REAL NATIVE CALLS · NOT INDEPENDENT';
    Object.assign(label.style, {
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      zIndex: '100000',
      background: '#173d30',
      color: 'white',
      padding: '12px',
      font: '600 12px sans-serif',
      textAlign: 'center',
      pointerEvents: 'none'
    });
    document.body.append(label);
  });
record({
  type: 'start',
  trial,
  runName,
  prompt: fixture.tasks[trial],
  browser: browser.version(),
  origin: base.origin,
  mode: 'Interactive native calls supplied over stdin; the bridge does not choose tools or run a model. Not an independent benchmark.',
  callerProvenance: process.env.TRIAL_CALLER ?? 'Not recorded by the bridge',
  loadedScripts: await page
    .locator('script[src]')
    .evaluateAll((scripts) => scripts.map((script) => script.getAttribute('src')))
});
const input = createInterface({ input: process.stdin, terminal: false });
try {
  for await (const line of input) {
    if (!line.trim()) continue;
    try {
      const command = JSON.parse(line);
      if (command.command === 'catalog') {
        const output = await page.evaluate(
          async (selectedName) =>
            (await document.modelContext.getTools())
              .filter((tool) => !selectedName || tool.name === selectedName)
              .map(({ name, description, inputSchema, annotations }) => ({
                name,
                description,
                inputSchema,
                annotations
              })),
          command.name
        );
        record({ type: 'catalog', output });
      } else if (command.command === 'call') {
        if (process.env.TRIAL_RECORD === '1')
          await page.evaluate((name) => {
            document.getElementById('trial-disclosure').textContent =
              `DEVELOPER-AGENT TRIAL · SYNTHETIC DATA · Native call: ${name} · NOT INDEPENDENT`;
          }, command.name);
        const output = await page.evaluate(
          async ({ name, args }) => {
            const api = document.modelContext;
            const tool = (await api.getTools()).find((t) => t.name === name);
            if (!tool) throw new Error('No registered tool with that name.');
            return JSON.parse(await api.executeTool(tool, JSON.stringify(args)));
          },
          { name: command.name, args: command.args ?? {} }
        );
        record({ type: 'call', name: command.name, args: command.args ?? {}, output });
      } else if (command.command === 'observe') {
        const output = await page
          .locator('h1:visible, h2:visible, [role="alert"]:visible')
          .allTextContents();
        await page.screenshot({
          path: `work/evidence/native-trial-${runName}.png`,
          fullPage: true
        });
        record({ type: 'observe', headingsAndAlerts: output, blockedNetwork });
      } else if (command.command === 'finish') {
        const saved = await page.evaluate(() => {
          const raw = sessionStorage.getItem('repair-desk-v1');
          if (!raw) throw new Error('No persisted event is available for the final-state check.');
          const value = JSON.parse(raw);
          return { event: value.event ?? value, revision: value.revision ?? 0 };
        });
        record({ type: 'final-state', ...saved }, false);
        record({
          type: 'finish',
          outcome: command.outcome,
          limitations: command.limitations,
          blockedNetwork
        });
        break;
      } else throw new Error('Supported commands: catalog, call, observe, finish.');
    } catch (error) {
      record({ type: 'bridge-error', error: error.message });
    }
  }
} finally {
  input.close();
  const video = page.video();
  await context.close();
  if (video)
    record({
      type: 'recording',
      path: await video.path(),
      choiceSource: 'External caller over stdin; inspect caller provenance and transcript.',
      independentBenchmark: false
    });
  await browser.close();
}
