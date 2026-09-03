import { copyFileSync, existsSync, lstatSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Keep the previous video and its sidecars together when a local replacement
// fails. This is not a cross-process transaction or a filesystem-failure guarantee.
export function promoteDemoArtifacts(
  stagedDirectory: string,
  outputDirectory: string,
  files: readonly string[],
  move: typeof renameSync = renameSync
): void {
  if (
    resolve(stagedDirectory) === resolve(outputDirectory) ||
    !files.length ||
    new Set(files).size !== files.length ||
    files.some((name) => !/^[a-z0-9][a-z0-9.-]*$/.test(name))
  )
    throw new Error('Invalid demo artifact promotion.');
  // Check the entire set before changing any selected artifact.
  for (const name of files) {
    if (!lstatSync(join(stagedDirectory, name)).isFile())
      throw new Error('A staged demo artifact is not a regular file.');
    const destination = join(outputDirectory, name);
    if (existsSync(destination) && !lstatSync(destination).isFile())
      throw new Error('A selected demo artifact is not a regular file.');
  }
  const backupDirectory = join(stagedDirectory, 'previous-artifacts');
  mkdirSync(backupDirectory);
  for (const name of files) {
    const destination = join(outputDirectory, name);
    if (existsSync(destination)) copyFileSync(destination, join(backupDirectory, name));
  }
  const replaced: string[] = [];
  try {
    for (const name of files) {
      move(join(stagedDirectory, name), join(outputDirectory, name));
      replaced.push(name);
    }
  } catch (error) {
    const recoveryErrors: unknown[] = [];
    for (const name of replaced.reverse()) {
      try {
        const previous = join(backupDirectory, name);
        const destination = join(outputDirectory, name);
        if (existsSync(previous)) copyFileSync(previous, destination);
        else rmSync(destination);
      } catch (recoveryError) {
        recoveryErrors.push(recoveryError);
      }
    }
    if (recoveryErrors.length)
      throw new AggregateError(
        [error, ...recoveryErrors],
        `Demo artifact recovery failed; preserved backups: ${backupDirectory}`
      );
    throw error;
  }
}
