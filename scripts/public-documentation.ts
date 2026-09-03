// Pure source-export text transformation; never reads workspace files.
export function publicDocumentation(path: string, input: string, root: string) {
  let text = input;
  if (path === 'README.md') {
    text = text.replace(/## Private inspiration material[\s\S]*?(?=\n## )/, '');
    text = text.replace(', and [continuation checkpoint](docs/CHECKPOINT.md)', '');
    text = text.replace("the user's existing SSH alias", 'an existing SSH connection');
    text = text.replaceAll(
      "the user's configured `dev` alias",
      'your own configured `SSH_HOST` alias'
    );
  }
  if (path === 'docs/research.md')
    text = text.replace(/## Inspiration — not evidence[\s\S]*?(?=\n## )/, '');
  if (path === 'docs/demo.md') {
    text = text.replace(
      /## View privately[\s\S]*?(?=\n## Reproduce)/,
      '## Local artifact\n\nThe development recording is not bundled in this source export. Reproduce it locally using the scripts below. The entire work directory remains denied by the dev server; do not weaken that denial to serve media.\n'
    );
  }
  // Redact a destination only inside an SSH command. "dev" is also a real
  // npm/ Wrangler command, so a global word-at-line-end replacement breaks
  // the exported setup instructions.
  text = text.replace(/(\bssh[ \t]+[^`\n]*?) dev(?=`|\r?\n|$)/g, '$1 SSH_HOST');
  text = text.replaceAll(root, '/path/to/project');
  // Explicit env command is portable in Unix shells and makes examples distinct
  // from standalone credential assignments during publication text review.
  text = text.replace(/^(?=(?:PLAYWRIGHT_BROWSERS_PATH|TEST_BASE_URL|XDG_CONFIG_HOME)=)/gm, 'env ');
  return text;
}
