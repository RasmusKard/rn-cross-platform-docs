import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Runs a command with inherited stdio; rejects with the command line and exit status if it fails, or with what to do
 * if it can't start. `notFound` is that advice when `cmd` isn't on PATH.
 */
export function run(cmd: string, args: string[], cwd: string, notFound = 'it is not on PATH'): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('error', (e) => reject(startError(e, cmd, cwd, notFound)));
    child.on('close', (code, signal) => {
      if (code === 0) return resolve();
      const command = [cmd, ...args].join(' ');
      reject(new Error(`\`${command}\` in ${cwd} failed with ${signal ?? `exit code ${code}`}`));
    });
  });
}

function startError(e: NodeJS.ErrnoException, cmd: string, cwd: string, notFound: string): Error {
  // spawn reports a missing cwd as ENOENT on cmd
  if (!existsSync(cwd)) return new Error(`No ${cwd} to run \`${cmd}\` in`);
  // a path isn't looked up on PATH, and its ENOENT can be a missing #! interpreter
  const isPath = cmd.includes('/');
  if (e.code === 'ENOENT' && !isPath) return new Error(`\`${cmd}\` not found: ${notFound}`);
  if (e.code === 'EACCES' && isPath) return new Error(`\`${cmd}\` is not executable; run \`chmod +x ${cmd}\``);
  return e;
}
