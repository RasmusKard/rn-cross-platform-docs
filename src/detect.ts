import { existsSync } from 'node:fs';
import { glob, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { Platform, Stack } from './stack.ts';

const packageManagers = ['npm', 'yarn', 'pnpm', 'bun'] as const;
const lockfiles: Record<string, Stack['packageManager']> = {
  'package-lock.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'bun.lock': 'bun',
  'bun.lockb': 'bun',
};
const skippedDirs = new Set(['build', '.gradle', '.cxx', 'node_modules', 'Pods']);

/** Reads the library repo at `root`; throws if it holds no React Native native module. */
export async function detect(root: string): Promise<Stack> {
  root = resolve(root);
  const at = (...p: string[]) => join(root, ...p);
  if (!existsSync(at('package.json'))) throw new Error(`No package.json in ${root}`);
  const pkg = JSON.parse(await readFile(at('package.json'), 'utf8')) as { name?: string; packageManager?: string };
  if (typeof pkg.name !== 'string') throw new Error(`No name in ${at('package.json')}`);
  const name = pkg.name;
  const example = at('example');

  let kind: Stack['kind'];
  let expoPlatforms: string[] | undefined;
  if (existsSync(at('expo-module.config.json'))) {
    kind = 'expo';
    expoPlatforms = (JSON.parse(await readFile(at('expo-module.config.json'), 'utf8')) as { platforms?: string[] }).platforms;
  } else if (['android/settings.gradle', 'android/settings.gradle.kts', 'ios/Podfile'].some((f) => existsSync(join(example, f)))) {
    kind = 'bare';
  } else {
    throw new Error(
      `No React Native native module in ${root}: found neither expo-module.config.json nor a committed example app ` +
        '(example/android/settings.gradle, example/android/settings.gradle.kts or example/ios/Podfile)',
    );
  }

  const podspec = await first(root, ['ios/*.podspec', '*.podspec']);
  const platforms: Platform[] = ['typescript'];
  if ((!expoPlatforms || expoPlatforms.includes('android')) && (await first(root, ['android/**/*.kt']))) {
    platforms.push('kotlin');
  }
  if (
    (!expoPlatforms || expoPlatforms.some((p) => p === 'apple' || p === 'ios')) &&
    podspec &&
    (await first(root, ['ios/**/*.swift']))
  ) {
    platforms.push('swift');
  }

  const stack: Stack = {
    root,
    name,
    kind,
    packageManager: packageManager(root, pkg.packageManager),
    nitro: existsSync(at('nitro.json')),
    example,
    platforms,
  };
  if (platforms.includes('kotlin')) stack.gradleProject = `:${name.replace(/^@/, '').replace('/', '_')}`;
  if (platforms.includes('swift') && podspec) {
    const literal = /^\s*\w+\.name\s*=\s*(['"])([^'"]+)\1/m.exec(await readFile(at(podspec), 'utf8'))?.[2];
    stack.podName = literal ?? basename(podspec, '.podspec');
  }
  return stack;
}

function packageManager(root: string, field: string | undefined): Stack['packageManager'] {
  const known = packageManagers.find((pm) => pm === field?.split('@')[0]);
  if (known) return known;
  return Object.entries(lockfiles).find(([f]) => existsSync(join(root, f)))?.[1] ?? 'npm';
}

/** First file under `root` matching one of `patterns`, relative to `root`. */
async function first(root: string, patterns: string[]): Promise<string | undefined> {
  for (const pattern of patterns) {
    for await (const f of glob(pattern, { cwd: root, exclude: (p) => skippedDirs.has(basename(p)) })) return f;
  }
}
