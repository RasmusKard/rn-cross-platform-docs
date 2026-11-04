import { rmSync } from 'node:fs';

const signals = ['SIGINT', 'SIGTERM'] as const;
const paths = new Set<string>();

/**
 * Until the returned function is called, SIGINT or SIGTERM removes `path`, along with every other path registered
 * here, and then ends the process by that signal.
 */
export function removeOnInterrupt(path: string): () => void {
  if (paths.size === 0) signals.forEach((s) => process.on(s, onSignal));
  paths.add(path);
  return () => {
    paths.delete(path);
    if (paths.size === 0) signals.forEach((s) => process.off(s, onSignal));
  };
}

function onSignal(signal: NodeJS.Signals): void {
  signals.forEach((s) => process.off(s, onSignal));
  for (const path of paths) rmSync(path, { recursive: true, force: true });
  paths.clear();
  // with no listener left the signal kills, so the shell sees an interrupted run (status 130 for SIGINT)
  process.kill(process.pid, signal);
}
