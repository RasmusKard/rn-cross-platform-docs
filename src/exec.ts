import { spawn } from 'node:child_process';

/** Runs a command with inherited stdio; rejects with the command line and exit status if it fails. */
export function run(cmd: string, args: string[], cwd: string, env?: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('error', reject);
    child.on('close', (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`\`${[cmd, ...args].join(' ')}\` in ${cwd} failed with ${signal ?? `exit code ${code}`}`)),
    );
  });
}
