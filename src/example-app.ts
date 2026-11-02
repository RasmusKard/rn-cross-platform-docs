import { join } from 'node:path';
import { run } from './exec.ts';
import type { Library } from './library.ts';

/** Makes the example app's native project for `os` buildable: library codegen, `expo prebuild`, `pod install`. */
export async function prepareExampleApp(library: Library, os: 'android' | 'ios'): Promise<void> {
  // Gradle and CocoaPods load nitrogen's generated files but never run it; templates name its script differently
  if (library.usesNitro) await run('npx', ['--no-install', 'nitrogen'], library.root);
  if (library.kind === 'expo') {
    await run('npx', ['expo', 'prebuild', '--platform', os, '--no-install'], library.exampleDir, { CI: '1' });
  }
  if (os === 'ios') await run('pod', ['install'], join(library.exampleDir, 'ios'));
}
