// Build, freeze, and verify one local production snapshot. Never deploys.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, readdir, lstat, writeFile, open, unlink } from 'node:fs/promises';
import { createServer, connect } from 'node:net';
import { resolve, join, relative } from 'node:path';
import { once } from 'node:events';

assert(process.platform !== 'win32', 'This verification runner currently requires a POSIX host.');
assert(
  process.argv.slice(2).every((arg) => ['--firefox', '--webkit'].includes(arg)),
  'Supported options: --firefox, --webkit'
);
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const run = resolve('work/verification', stamp);
const snapshot = join(run, 'snapshot');
const lockPath = resolve('work/verification.lock');
await mkdir(run, { recursive: true, mode: 0o700 });
let lock;
try {
  lock = await open(lockPath, 'wx', 0o600);
} catch {
  throw new Error(
    'Another verification run holds work/verification.lock. Check it before removing a stale lock.'
  );
}
await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
const summary = {
  startedAt: new Date().toISOString(),
  status: 'running',
  deploymentPerformed: false,
  steps: [],
  servedAssetsMatch: null,
  sourceUnchangedDuringVerification: null,
  runtimeStarted: false,
  runtimeStopped: false,
  evidenceDirectories: {
    unit: join(run, 'unit-evidence'),
    chrome: join(run, 'browser-chrome-evidence'),
    firefox: join(run, 'browser-firefox-evidence'),
    webkit: join(run, 'browser-webkit-evidence')
  }
};
const env = {
  ...process.env,
  XDG_CONFIG_HOME: join(run, 'wrangler-home'),
  WRANGLER_SEND_METRICS: 'false',
  WRANGLER_LOG_PATH: join(run, 'wrangler-internal.log')
};
let runtime;
let activeStep;
let ports = [];
const hash = (data) => createHash('sha256').update(data).digest('hex');
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
async function manifest(directory) {
  const entries = [];
  async function walk(path) {
    for (const name of (await readdir(path)).sort()) {
      const file = join(path, name),
        stat = await lstat(file);
      assert(!stat.isSymbolicLink(), 'Verification refuses symlinks in the source snapshot.');
      if (stat.isDirectory()) await walk(file);
      else if (stat.isFile())
        entries.push({ file: relative(directory, file), sha256: hash(await readFile(file)) });
      else assert.fail('Only regular source files are supported.');
    }
  }
  await walk(directory);
  return entries;
}
async function sourceFingerprint() {
  const entries = [];
  // Explicit allowlist: never scan work, private inspiration, Git history or credentials.
  for (const directory of ['src', 'worker', 'public', 'tests', 'scripts']) {
    for (const entry of await manifest(directory))
      entries.push({ ...entry, file: `${directory}/${entry.file}` });
  }
  for (const file of [
    'package.json',
    'package-lock.json',
    'index.html',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
    'playwright.config.ts',
    'playwright.manual.config.ts',
    'playwright.webkit.config.ts',
    'wrangler.jsonc'
  ])
    entries.push({ file, sha256: hash(await readFile(file)) });
  return hash(JSON.stringify(entries));
}
function start(command, args, label, extraEnv = {}) {
  const log = createWriteStream(join(run, `${label}.log`), { flags: 'wx', mode: 0o600 });
  const child = spawn(command, args, {
    cwd: root,
    env: { ...env, ...extraEnv },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.closed = new Promise((done) => {
    child.once('error', (error) => done({ code: null, error: error.message }));
    child.once('close', (code, signal) => {
      log.end();
      done({ code, signal });
    });
  });
  return child;
}
async function step(label, command, args, extraEnv = {}) {
  assert(!interrupted, 'Verification was interrupted.');
  console.log(`Verifying: ${label}`);
  const result = { name: label, status: 'running', startedAt: new Date().toISOString() };
  summary.steps.push(result);
  activeStep = start(command, args, label, extraEnv);
  const exit = await activeStep.closed;
  activeStep = undefined;
  result.finishedAt = new Date().toISOString();
  result.exitCode = exit.code;
  result.status = exit.code === 0 ? 'passed' : 'failed';
  assert.equal(
    exit.code,
    0,
    `${label} failed. Inspect ${relative(root, join(run, `${label}.log`))}.`
  );
}
async function browserStep(label, command, args, base, evidenceDirectory, reportName) {
  try {
    await step(label, command, args, {
      TEST_BASE_URL: base,
      BENCHKEEPER_TEST_EVIDENCE_DIR: evidenceDirectory
    });
  } finally {
    // The reporter writes into this fresh run even when tests fail. Preserve
    // the convenient report alias before propagating failure; never pick up a
    // stale report from a previous invocation. Screenshots/PDFs/traces already
    // live beside it and retain the report's original attachment paths.
    try {
      await cp(join(evidenceDirectory, reportName), join(run, `${label}-results.json`));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
async function reservePorts() {
  const servers = [createServer(), createServer()];
  try {
    for (const server of servers) {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
    }
    return servers.map((server) => server.address().port);
  } finally {
    await Promise.all(servers.map((server) => new Promise((done) => server.close(done))));
  }
}
async function stop(child) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  let timeout;
  const ended = await Promise.race([
    child.closed.then(() => true),
    new Promise((done) => {
      timeout = setTimeout(() => done(false), 2500);
    })
  ]);
  clearTimeout(timeout);
  if (!ended) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
    await child.closed;
  }
}
async function portClosed(port) {
  return new Promise((done) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      done(false);
    });
    socket.once('error', (error) => done(error.code === 'ECONNREFUSED'));
    socket.setTimeout(1000, () => {
      socket.destroy();
      done(false);
    });
  });
}
let interrupted = false;
function interrupt() {
  interrupted = true;
  void stop(activeStep);
  void stop(runtime);
}
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
try {
  const initialSource = await sourceFingerprint();
  await step('build', 'npm', ['run', 'build']);
  await step('unit', 'npm', ['test'], {
    BENCHKEEPER_TEST_EVIDENCE_DIR: summary.evidenceDirectories.unit
  });
  await mkdir(snapshot, { recursive: true });
  await cp('dist', join(snapshot, 'assets'), { recursive: true });
  await cp('worker/index.ts', join(snapshot, 'worker.ts'));
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  assert.equal(config.main, 'worker/index.ts');
  assert.equal(config.assets.directory, './dist');
  delete config.$schema;
  config.main = './worker.ts';
  config.assets.directory = './assets';
  config.workers_dev = false;
  const configPath = join(snapshot, 'wrangler.json');
  await writeFile(configPath, JSON.stringify(config, null, 2));
  const assets = await manifest(join(snapshot, 'assets'));
  await writeFile(join(run, 'asset-manifest.json'), JSON.stringify(assets, null, 2));
  ports = await reservePorts();
  const base = `http://127.0.0.1:${ports[0]}`;
  summary.origin = base;
  const wrangler = resolve('node_modules/wrangler/bin/wrangler.js');
  console.log('Starting isolated loopback workerd snapshot');
  runtime = start(
    process.execPath,
    [
      wrangler,
      'dev',
      '--local',
      '--config',
      configPath,
      '--ip',
      '127.0.0.1',
      '--inspector-ip',
      '127.0.0.1',
      '--port',
      String(ports[0]),
      '--inspector-port',
      String(ports[1]),
      '--show-interactive-dev-session=false',
      '--persist-to',
      join(run, 'runtime-state')
    ],
    'runtime'
  );
  summary.runtimeStarted = true;
  const deadline = Date.now() + 30000;
  let ready = false;
  while (!ready && Date.now() < deadline && !interrupted && runtime.exitCode === null) {
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      ready = response.ok && (await response.json()).storage === 'browser-session';
    } catch {
      /* Wait only for actual runtime readiness, never to fill work time. */
    }
    if (!ready) await pause(200);
  }
  assert(ready && !interrupted, 'Isolated runtime did not become ready.');
  for (const asset of assets) {
    const response = await fetch(new URL(asset.file, base + '/'), {
      signal: AbortSignal.timeout(5000)
    });
    assert.equal(response.status, 200, `Asset status: ${asset.file}`);
    assert.equal(
      hash(Buffer.from(await response.arrayBuffer())),
      asset.sha256,
      `Served asset differs: ${asset.file}`
    );
  }
  summary.servedAssetsMatch = true;
  summary.assetCount = assets.length;
  await browserStep(
    'browser-chrome',
    'npm',
    ['run', 'test:e2e'],
    base,
    summary.evidenceDirectories.chrome,
    'playwright-results.json'
  );
  if (process.argv.includes('--firefox')) {
    await browserStep(
      'browser-firefox',
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.manual.config.ts'],
      base,
      summary.evidenceDirectories.firefox,
      'firefox-results.json'
    );
  }
  if (process.argv.includes('--webkit')) {
    await browserStep(
      'browser-webkit',
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.webkit.config.ts'],
      base,
      summary.evidenceDirectories.webkit,
      'webkit-results.json'
    );
  }
  await step('runtime-smoke', process.execPath, ['scripts/smoke-runtime.mjs'], { SMOKE_URL: base });
  await cp('work/evidence/runtime-smoke.json', join(run, 'runtime-smoke.json'));
  await step('bundle-dry-run', process.execPath, [
    wrangler,
    'deploy',
    '--dry-run',
    '--autoconfig=false',
    '--config',
    configPath,
    '--outdir',
    join(run, 'worker-bundle')
  ]);
  assert.equal(
    await sourceFingerprint(),
    initialSource,
    'Source changed during verification. Re-run on one stable version.'
  );
  summary.sourceUnchangedDuringVerification = true;
  summary.sourceFingerprint = initialSource;
  assert(!interrupted, 'Verification was interrupted.');
  summary.status = 'passed';
} catch (error) {
  summary.status = 'failed';
  summary.error = error.message;
  process.exitCode = 1;
} finally {
  await stop(activeStep);
  await stop(runtime);
  summary.runtimeStopped = (await Promise.all(ports.map(portClosed))).every(Boolean);
  if (!summary.runtimeStopped) {
    summary.status = 'failed';
    process.exitCode = 1;
  }
  summary.finishedAt = new Date().toISOString();
  await writeFile(join(run, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  await lock.close();
  await unlink(lockPath);
  console.log(`Local verification ${summary.status}: ${relative(root, join(run, 'summary.json'))}`);
}
