import { join } from 'node:path';
import { run } from './exec.ts';
import type { Stack } from './stack.ts';

/** Makes the example app's native project for `os` buildable: library codegen, `expo prebuild`, `pod install`. */
export async function prepareExample(stack: Stack, os: 'android' | 'ios'): Promise<void> {
  // Gradle and CocoaPods load nitrogen's generated files but never run it; templates name its script differently
  if (stack.nitro) await run('npx', ['--no-install', 'nitrogen'], stack.root);
  if (stack.kind === 'expo') {
    await run('npx', ['expo', 'prebuild', '--platform', os, '--no-install'], stack.example, { CI: '1' });
  }
  if (os === 'ios') await run('pod', ['install'], join(stack.example, 'ios'));
}
