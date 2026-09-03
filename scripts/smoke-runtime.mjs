import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const base = new URL(process.env.SMOKE_URL ?? 'http://127.0.0.1:8787');
assert(
  ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname),
  'Runtime smoke tests must target loopback.'
);
const results = [];
for (const [path, status, method] of [
  ['/', 200, 'GET'],
  ['/api/health', 200, 'GET'],
  ['/api/not-real', 404, 'GET'],
  ['/api/health', 405, 'POST'],
  ['/work/private/http-canary.txt', 404, 'GET']
]) {
  const response = await fetch(new URL(path, base), { method });
  assert.equal(response.status, status, `${method} ${path}`);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('origin-agent-cluster'), '?1');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(response.headers.get('permissions-policy'), /tools=\(self\)/);
  results.push({ path, method, status: response.status, securityHeaders: 'verified' });
}
await mkdir('work/evidence', { recursive: true });
await writeFile(
  'work/evidence/runtime-smoke.json',
  JSON.stringify({ at: new Date().toISOString(), base: base.origin, results }, null, 2)
);
console.log('Local workerd smoke: 5 endpoints/status cases passed; security headers verified.');
