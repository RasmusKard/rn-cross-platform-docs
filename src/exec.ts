import { spawn } from 'node:child_process';

/** Runs a command with inherited stdio; rejects with the command line and exit status if it fails. */
export function run(cmd: string, args: string[], cwd: string, env?: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) return resolve();
      const command = [cmd, ...args].join(' ');
      reject(new Error(`\`${command}\` in ${cwd} failed with ${signal ?? `exit code ${code}`}`));
    });
  });
}
