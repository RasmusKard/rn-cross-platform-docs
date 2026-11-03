import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectLibrary } from '../src/detect.ts';
import { repo } from './repo.ts';

const fixture = (name: string) => new URL(`fixtures/${name}`, import.meta.url).pathname;

await test('an Expo module with all three platforms and its podspec in ios/', async () => {
  const root = fixture('expo-all');
  assert.deepEqual(await detectLibrary(root), {
    root,
    platforms: ['typescript', 'kotlin', 'swift'],
    podName: 'ExpoProbe',
  });
});

await test('a bare library with Kotlin and Swift', async () => {
  const root = fixture('bare-all');
  assert.deepEqual(await detectLibrary(root), {
    root,
    platforms: ['typescript', 'kotlin', 'swift'],
    podName: 'BareProbe',
  });
});

await test('a repo with no native module throws, naming what was looked for', async () => {
  await assert.rejects(
    detectLibrary(fixture('none')),
    /No React Native native module .*android\/\*\*\/\*\.kt.*podspec/,
  );
});

await test('a library with Kotlin and no Swift', async () => {
  const root = fixture('bare-turbo');
  assert.deepEqual(await detectLibrary(root), { root, platforms: ['typescript', 'kotlin'] });
});

await test('the pod name is the podspec file name, whatever its s.name', async (t) => {
  const root = await repo(t, {
    'ios/BunProbe.podspec': 'Pod::Spec.new do |s|\n  s.name = "Other"\nend\n',
    'ios/BunProbe.swift': '',
  });
  assert.deepEqual(await detectLibrary(root), { root, platforms: ['typescript', 'swift'], podName: 'BunProbe' });
});

await test('several podspecs with Swift sources are an error naming them', async (t) => {
  const root = await repo(t, { 'ios/Zeta.podspec': '', 'ios/Alpha.podspec': '', 'ios/A.swift': '' });
  await assert.rejects(
    detectLibrary(root),
    /Expected one podspec in .*, found 2: ios\/Alpha\.podspec, ios\/Zeta\.podspec/,
  );
});

await test('sources under build/ are not detected', async (t) => {
  const root = await repo(t, {
    'android/src/Real.kt': '',
    'android/build/generated/Generated.kt': '',
    'ios/BuildProbe.podspec': '',
    'ios/build/Generated.swift': '',
  });
  assert.deepEqual((await detectLibrary(root)).platforms, ['typescript', 'kotlin']);
});
