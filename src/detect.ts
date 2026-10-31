import { existsSync } from 'node:fs';
import { glob, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { Platform, Stack } from './stack.ts';

const skippedDirs = new Set(['build', '.gradle', '.cxx', 'node_modules', 'Pods']);

/** Reads the library repo at `root`; throws if it holds no React Native native module. */
export async function detect(root: string): Promise<Stack> {
  root = resolve(root);
  const at = (...p: string[]) => join(root, ...p);
  if (!existsSync(at('package.json'))) throw new Error(`No package.json in ${root}`);
  const pkg = JSON.parse(await readFile(at('package.json'), 'utf8')) as { name?: string; codegenConfig?: unknown };
  if (typeof pkg.name !== 'string') throw new Error(`No name in ${at('package.json')}`);
  const name = pkg.name;
  const example = at('example');

  let kind: Stack['kind'];
  let expo: { platforms?: string[]; android?: { name?: string } } | undefined;
  if (existsSync(at('expo-module.config.json'))) {
    kind = 'expo';
    expo = JSON.parse(await readFile(at('expo-module.config.json'), 'utf8')) as typeof expo;
  } else if (['android/settings.gradle', 'android/settings.gradle.kts', 'ios/Podfile'].some((f) => existsSync(join(example, f)))) {
    kind = 'bare';
  } else {
    throw new Error(
      `No React Native native module in ${root}: found neither expo-module.config.json nor a committed example app ` +
        '(example/android/settings.gradle, example/android/settings.gradle.kts or example/ios/Podfile)',
    );
  }

  const podspec = await first(root, ['ios/*.podspec', '*.podspec']);
  const platforms = await detectPlatforms(root, expo?.platforms, podspec);

  const stack: Stack = {
    root,
    name,
    kind,
    nitro: existsSync(at('nitro.json')),
    codegen: pkg.codegenConfig !== undefined,
    example,
    platforms,
  };
  if (platforms.includes('kotlin')) {
    // the names expo-modules-autolinking and React Native's Gradle autolinking give the library's project
    const unscoped = name.replace(/^@/, '');
    stack.gradleProject = `:${kind === 'expo' ? (expo?.android?.name ?? unscoped.replace(/\W+/g, '-')) : unscoped.replace('/', '_')}`;
  }
  if (platforms.includes('swift') && podspec) {
    const literal = /^\s*\w+\.name\s*=\s*(['"])([^'"]+)\1/m.exec(await readFile(at(podspec), 'utf8'))?.[2];
    stack.podName = literal ?? basename(podspec, '.podspec');
  }
  return stack;
}

/** `expoPlatforms`, when the Expo config lists them, gate the native platforms. */
async function detectPlatforms(root: string, expoPlatforms: string[] | undefined, podspec: string | undefined) {
  const platforms: Platform[] = ['typescript'];
  const allows = (...names: string[]) => !expoPlatforms || expoPlatforms.some((p) => names.includes(p));
  if (allows('android') && (await first(root, ['android/**/*.kt']))) platforms.push('kotlin');
  if (allows('apple', 'ios') && podspec && (await first(root, ['ios/**/*.swift']))) platforms.push('swift');
  return platforms;
}

/** First file under `root` matching one of `patterns`, relative to `root`. */
async function first(root: string, patterns: string[]): Promise<string | undefined> {
  for (const pattern of patterns) {
    for await (const f of glob(pattern, { cwd: root, exclude: (p) => skippedDirs.has(basename(p)) })) return f;
  }
}
