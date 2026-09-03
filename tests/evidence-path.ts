// Test artifacts only. A verification run supplies its own ignored directory;
// individual commands retain the documented work/evidence default.
import { existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const work = resolve('work');
const directory = resolve(process.env.BENCHKEEPER_TEST_EVIDENCE_DIR ?? 'work/evidence');
const pathInside = (parent: string, child: string) => {
  const path = relative(parent, child);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};
if (!pathInside(work, directory) || relative(work, directory).split(sep)[0] === 'private')
  throw new Error('Test evidence must stay inside a non-private project work directory.');
if (existsSync(work) && lstatSync(work).isSymbolicLink())
  throw new Error('Project work directory must not be a symlink.');
mkdirSync(work, { recursive: true, mode: 0o700 });
let ancestor = directory;
while (!existsSync(ancestor)) ancestor = dirname(ancestor);
const actualWork = realpathSync(work),
  actualAncestor = realpathSync(ancestor);
if (actualAncestor !== actualWork && !pathInside(actualWork, actualAncestor))
  throw new Error('Test evidence directory cannot escape work through a symlink.');
if (relative(actualWork, actualAncestor).split(sep)[0] === 'private')
  throw new Error('Test evidence cannot use private material through a symlink.');
mkdirSync(directory, { recursive: true, mode: 0o700 });

export const testEvidenceDirectory = directory;
export function evidencePath(name: string) {
  if (!/^[a-z0-9][a-z0-9.-]*$/i.test(name))
    throw new Error('Test artifact names must be plain filenames.');
  const path = join(directory, name);
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat && !stat.isFile())
    throw new Error('Test artifacts must be regular files, not symlinks or directories.');
  return path;
}
