import { existsSync } from 'node:fs';
import { glob, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { Library, Platform } from './library.ts';

const skippedDirs = new Set(['build', '.gradle', '.cxx', 'node_modules', 'Pods']);

interface PackageJson {
  name?: string;
  codegenConfig?: unknown;
}

interface ExpoModuleConfig {
  platforms?: string[];
  android?: { name?: string };
}

/** Reads the library repo at `root`; throws if it holds no React Native native module. */
export async function detectLibrary(root: string): Promise<Library> {
  root = resolve(root);
  const pkg = await readPackageJson(root);
  if (typeof pkg.name !== 'string') throw new Error(`No name in ${join(root, 'package.json')}`);
  const exampleDir = join(root, 'example');

  let kind: Library['kind'];
  if (isExpoModule(root)) kind = 'expo';
  else if (hasCommittedExampleApp(exampleDir)) kind = 'bare';
  else {
    throw new Error(
      `No React Native native module in ${root}: found neither expo-module.config.json nor a committed example app ` +
        '(example/android/settings.gradle, example/android/settings.gradle.kts or example/ios/Podfile)',
    );
  }
  const expoConfig = kind === 'expo' ? await readExpoModuleConfig(root) : undefined;
  const podspec = await findFirstFile(root, ['ios/*.podspec', '*.podspec']);
  const platforms = await detectPlatforms(root, expoConfig, podspec);

  const library: Library = {
    root,
    packageName: pkg.name,
    kind,
    usesNitro: usesNitro(root),
    usesCodegen: usesCodegen(pkg),
    exampleDir,
    platforms,
  };
  if (platforms.includes('kotlin')) library.gradleProject = gradleProjectPath(pkg.name, expoConfig);
  if (platforms.includes('swift') && podspec) library.podName = await readPodName(root, podspec);
  return library;
}

const isExpoModule = (root: string) => existsSync(join(root, 'expo-module.config.json'));

const hasCommittedExampleApp = (exampleDir: string) =>
  ['android/settings.gradle', 'android/settings.gradle.kts', 'ios/Podfile'].some((f) => existsSync(join(exampleDir, f)));

const usesNitro = (root: string) => existsSync(join(root, 'nitro.json'));

const usesCodegen = (pkg: PackageJson) => pkg.codegenConfig !== undefined;

async function readPackageJson(root: string): Promise<PackageJson> {
  const file = join(root, 'package.json');
  if (!existsSync(file)) throw new Error(`No package.json in ${root}`);
  return JSON.parse(await readFile(file, 'utf8')) as PackageJson;
}

async function readExpoModuleConfig(root: string): Promise<ExpoModuleConfig> {
  return JSON.parse(await readFile(join(root, 'expo-module.config.json'), 'utf8')) as ExpoModuleConfig;
}

/** A platform is detected when it has sources and, for an Expo module listing `platforms`, is listed there. */
async function detectPlatforms(root: string, expoConfig: ExpoModuleConfig | undefined, podspec: string | undefined) {
  const platforms: Platform[] = ['typescript'];
  const expoAllows = (...names: string[]) => !expoConfig?.platforms || expoConfig.platforms.some((p) => names.includes(p));
  if (expoAllows('android') && (await findFirstFile(root, ['android/**/*.kt']))) platforms.push('kotlin');
  if (expoAllows('apple', 'ios') && podspec && (await findFirstFile(root, ['ios/**/*.swift']))) platforms.push('swift');
  return platforms;
}

/** The name expo-modules-autolinking or React Native's Gradle autolinking gives the library's project. */
function gradleProjectPath(packageName: string, expoConfig: ExpoModuleConfig | undefined): string {
  const unscoped = packageName.replace(/^@/, '');
  if (expoConfig) return `:${expoConfig.android?.name ?? unscoped.replace(/\W+/g, '-')}`;
  return `:${unscoped.replace('/', '_')}`;
}

/** The podspec's literal `s.name`, else its file name. */
async function readPodName(root: string, podspec: string): Promise<string> {
  const literal = /^\s*\w+\.name\s*=\s*(['"])([^'"]+)\1/m.exec(await readFile(join(root, podspec), 'utf8'))?.[2];
  return literal ?? basename(podspec, '.podspec');
}

/** First file under `root` matching one of `patterns`, relative to `root`. */
async function findFirstFile(root: string, patterns: string[]): Promise<string | undefined> {
  for (const pattern of patterns) {
    for await (const f of glob(pattern, { cwd: root, exclude: (p) => skippedDirs.has(basename(p)) })) return f;
  }
}
