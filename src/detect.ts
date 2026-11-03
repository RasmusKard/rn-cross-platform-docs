import { glob } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { Library, Platform } from './library.ts';

const skippedDirs = new Set(['build', '.gradle', '.cxx', 'node_modules', 'Pods']);
const exclude = (path: string) => skippedDirs.has(basename(path));

/** Reads the library repo at `root`; throws if it holds no Kotlin or Swift sources, or Swift with several podspecs. */
export async function detectLibrary(root: string): Promise<Library> {
  root = resolve(root);
  const platforms: Platform[] = ['typescript'];
  if (await findFirstFile(root, ['android/**/*.kt'])) platforms.push('kotlin');
  const podspecs: string[] = [];
  for await (const f of glob(['ios/*.podspec', '*.podspec'], { cwd: root, exclude })) podspecs.push(f);
  podspecs.sort(); // glob order is the file system's
  const hasSwift = podspecs.length > 0 && (await findFirstFile(root, ['ios/**/*.swift'])) !== undefined;
  if (hasSwift && podspecs.length > 1) {
    throw new Error(`Expected one podspec in ${root}, found ${podspecs.length}: ${podspecs.join(', ')}`);
  }
  if (hasSwift) platforms.push('swift');
  if (platforms.length === 1) {
    throw new Error(
      `No React Native native module in ${root}: found neither android/**/*.kt nor a podspec with ios/**/*.swift`,
    );
  }
  return hasSwift ? { root, platforms, podName: basename(podspecs[0], '.podspec') } : { root, platforms };
}

/** First file under `root` matching one of `patterns`, relative to `root`. */
async function findFirstFile(root: string, patterns: string[]): Promise<string | undefined> {
  for (const pattern of patterns) {
    for await (const f of glob(pattern, { cwd: root, exclude })) return f;
  }
}
