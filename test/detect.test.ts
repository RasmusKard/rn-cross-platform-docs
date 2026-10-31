import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { detect } from '../src/detect.ts';

const fixture = (name: string) => new URL(`fixtures/${name}`, import.meta.url).pathname;

await test('an Expo module with all three platforms', async () => {
  const root = fixture('expo-all');
  assert.deepEqual(await detect(root), {
    root,
    name: '@acme/expo-probe',
    kind: 'expo',
    packageManager: 'npm',
    nitro: false,
    codegen: false,
    example: join(root, 'example'),
    platforms: ['typescript', 'kotlin', 'swift'],
    gradleProject: ':acme_expo-probe',
    podName: 'ExpoProbe',
  });
});

await test('an Expo module whose config lists only android has no swift', async () => {
  const root = fixture('expo-android');
  assert.deepEqual(await detect(root), {
    root,
    name: 'expo-android-probe',
    kind: 'expo',
    packageManager: 'pnpm',
    nitro: false,
    codegen: false,
    example: join(root, 'example'),
    platforms: ['typescript', 'kotlin'],
    gradleProject: ':expo-android-probe',
  });
});

await test('a bare Nitro library with committed example projects', async () => {
  const root = fixture('bare-nitro');
  assert.deepEqual(await detect(root), {
    root,
    name: 'react-native-bare-probe',
    kind: 'bare',
    packageManager: 'yarn',
    nitro: true,
    codegen: false,
    example: join(root, 'example'),
    platforms: ['typescript', 'kotlin', 'swift'],
    gradleProject: ':react-native-bare-probe',
    podName: 'BareProbe',
  });
});

await test('a repo with no native module throws, naming what was looked for', async () => {
  await assert.rejects(detect(fixture('none')), /No React Native native module .*expo-module\.config\.json.*example\/ios\/Podfile/);
});

await test('a bare Turbo module with codegenConfig and no Swift', async () => {
  const root = fixture('bare-turbo');
  assert.deepEqual(await detect(root), {
    root,
    name: 'react-native-turbo-probe',
    kind: 'bare',
    packageManager: 'npm',
    nitro: false,
    codegen: true,
    example: join(root, 'example'),
    platforms: ['typescript', 'kotlin'],
    gradleProject: ':react-native-turbo-probe',
  });
});
