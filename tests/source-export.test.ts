import { describe, expect, it } from 'vitest';
import { publicDocumentation } from '../scripts/public-documentation';

describe('public source documentation', () => {
  it('redacts SSH destinations without changing npm or Wrangler dev commands', () => {
    const draft = [
      'npm run dev',
      'ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:5173:127.0.0.1:5173 dev',
      'npx wrangler dev',
      'Use `ssh -N -L 127.0.0.1:8787:127.0.0.1:8787 dev` from another machine.',
      'Run `npm run dev` first.',
      ''
    ].join('\n');
    expect(publicDocumentation('README.md', draft, '/example/project')).toBe(
      [
        'npm run dev',
        'ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:5173:127.0.0.1:5173 SSH_HOST',
        'npx wrangler dev',
        'Use `ssh -N -L 127.0.0.1:8787:127.0.0.1:8787 SSH_HOST` from another machine.',
        'Run `npm run dev` first.',
        ''
      ].join('\n')
    );
  });

  it('removes internal documentation sections and workspace paths while retaining useful text', () => {
    const readme = publicDocumentation(
      'README.md',
      [
        '# Example',
        'See instructions, and [continuation checkpoint](docs/CHECKPOINT.md).',
        '## Private inspiration material',
        'Synthetic internal-section fixture; no private material is read by this test.',
        '## Verify',
        'Run from /example/project.',
        'PLAYWRIGHT_BROWSERS_PATH="$PWD/work/browsers" npm test',
        ''
      ].join('\n'),
      '/example/project'
    );
    expect(readme).not.toContain('internal-section fixture');
    expect(readme).not.toContain('CHECKPOINT');
    expect(readme).not.toContain('/example/project');
    expect(readme).toContain('## Verify\nRun from /path/to/project.');
    expect(readme).toContain('env PLAYWRIGHT_BROWSERS_PATH="$PWD/work/browsers" npm test');
    const research = publicDocumentation(
      'docs/research.md',
      '## Inspiration — not evidence\nInternal fixture.\n## Candidates\nPublic comparison.\n',
      '/example/project'
    );
    expect(research).not.toContain('Internal fixture');
    expect(research).toContain('## Candidates\nPublic comparison.');
  });

  it('replaces private media-transfer instructions without removing local reproduction', () => {
    const draft =
      '# Demo\n## View privately\nscp dev:/example/project/work/demo/movie.mp4 .\n## Reproduce\nnode scripts/record-demo.mjs\n';
    const output = publicDocumentation('docs/demo.md', draft, '/example/project');
    expect(output).not.toContain('scp dev:');
    expect(output).toContain('The development recording is not bundled');
    expect(output).toContain('## Reproduce\nnode scripts/record-demo.mjs');
  });
});
