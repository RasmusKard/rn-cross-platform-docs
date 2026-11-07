import { glob } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { Library, Platform } from './library.ts';

const skippedDirs = new Set(['build', '.gradle', '.cxx', 'node_modules', 'Pods']);
const exclude = (path: string) => skippedDirs.has(basename(path));

/**
 * Reads the library repo at `root`; throws if it holds no Kotlin or Swift sources, or Swift with several podspecs while
 * `generating`, the platforms to generate (default: all detected), includes Swift.
 */
export async function detectLibrary(root: string, generating?: readonly Platform[]): Promise<Library> {
  root = resolve(root);
  const platforms: Platform[] = ['typescript'];
  if (await findFirstFile(root, ['android/**/*.kt'])) platforms.push('kotlin');
  const podspecs: string[] = [];
  for await (const f of glob(['ios/*.podspec', '*.podspec'], { cwd: root, exclude })) podspecs.push(f);
  podspecs.sort(); // glob order is the file system's
  const hasSwift = podspecs.length > 0 && (await findFirstFile(root, ['ios/**/*.swift'])) !== undefined;
  if (hasSwift) platforms.push('swift');
  if (hasSwift && podspecs.length > 1 && (generating ?? platforms).includes('swift')) {
    const others = platforms.filter((p) => p !== 'swift').join(',');
    const found = `found ${podspecs.length}: ${podspecs.join(', ')}`;
    throw new Error(`Expected one podspec in ${root}, ${found}; leave swift out with --platforms ${others}`);
  }
  if (platforms.length === 1) {
    throw new Error(
      `No React Native native module in ${root}: found neither android/**/*.kt nor a podspec with ios/**/*.swift`,
    );
  }
  const podName = hasSwift && podspecs.length === 1 ? basename(podspecs[0], '.podspec') : undefined;
  return podName ? { root, platforms, podName } : { root, platforms };
}

/** First file under `root` matching one of `patterns`, relative to `root`. */
async function findFirstFile(root: string, patterns: string[]): Promise<string | undefined> {
  for (const pattern of patterns) {
    for await (const f of glob(pattern, { cwd: root, exclude })) return f;
  }
}
