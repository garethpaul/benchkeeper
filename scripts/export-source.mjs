// Create a local, allowlisted source export. No network, git push or deployment.
import { readdirSync, lstatSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { publicDocumentation } from './public-documentation.ts';

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = resolve('work/source-export', stamp);
const source = join(target, 'source');
mkdirSync(source, { recursive: true, mode: 0o700 });
const files = [
  '.gitignore',
  '.prettierrc.json',
  'LICENSE',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'package.json',
  'package-lock.json',
  'index.html',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
  'playwright.manual.config.ts',
  'playwright.webkit.config.ts',
  'wrangler.jsonc',
  'scripts/native-trial.mjs',
  'scripts/generate-native-trials.mjs',
  'scripts/verify-generated-trials.mjs',
  'scripts/verify-native-trials.mjs',
  'scripts/smoke-runtime.mjs',
  'scripts/verify-local.mjs',
  'scripts/verify-packet-pdf.py',
  'scripts/record-demo.mjs',
  'scripts/record-agent-demo.mjs',
  'scripts/demo-provenance.ts',
  'scripts/demo-artifacts.ts',
  'scripts/assemble-demo.mjs',
  'scripts/synthesize-narration.py',
  'scripts/export-source.mjs',
  'scripts/public-documentation.ts',
  'docs/research.md',
  'docs/submission.md',
  'docs/agent-trials.md',
  'docs/fresh-trials.md',
  'docs/demo.md',
  'docs/images/planning-desk.webp',
  'docs/images/proposal-review.webp',
  'docs/demo-storyboard.json',
  'docs/demo-agent-storyboard.json',
  'docs/rubric-review.md',
  'docs/intake-import.md',
  'docs/deployment-readiness.md'
];
function collect(directory) {
  for (const entry of readdirSync(resolve(directory)).sort()) {
    const path = join(directory, entry),
      stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error('Source export refuses symlinks.');
    if (stat.isDirectory()) collect(path);
    else if (stat.isFile()) files.push(path);
    else throw new Error('Source export accepts regular files only.');
  }
}
for (const directory of ['src', 'worker', 'tests', 'public']) collect(directory);

const entries = [];
const digest = (data) => createHash('sha256').update(data).digest('hex');
function copy(from, to = from) {
  const absolute = resolve(from);
  if (relative(root, absolute).startsWith('..') || lstatSync(absolute).isSymbolicLink())
    throw new Error('Source path escaped the project or is a symlink.');
  const original = readFileSync(absolute);
  const output = to.endsWith('.md')
    ? Buffer.from(publicDocumentation(to, original.toString('utf8'), root))
    : original;
  mkdirSync(dirname(join(source, to)), { recursive: true });
  writeFileSync(join(source, to), output);
  entries.push({
    file: to,
    bytes: output.length,
    sha256: digest(output),
    changedForExport: !output.equals(original)
  });
}
for (const path of files.sort()) copy(path);
copy('docs/verification-public.md', 'docs/verification.md');
// This summary is also kept under its source name so an exported checkout can
// produce another local export without depending on a private checkpoint.
copy('docs/verification-public.md');
writeFileSync(
  join(source, 'EXPORT-MANIFEST.json'),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      published: false,
      exclusions: [
        'Git history',
        'internal checkpoint and agent guidance',
        'private inspiration material and generator',
        'work files, recordings and caches',
        'installed dependencies and build output'
      ],
      entries
    },
    null,
    2
  ) + '\n'
);
const archive = join(target, 'benchkeeper-source-local.tar.gz');
execFileSync('tar', ['-czf', archive, '-C', source, '.']);
const result = {
  source,
  archive,
  files: entries.length + 1,
  archiveSha256: digest(readFileSync(archive)),
  published: false,
  publicationStillRequiresUserAuthorization: true
};
mkdirSync('work/evidence', { recursive: true });
writeFileSync('work/evidence/source-export-latest.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
