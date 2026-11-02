import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { detectLibrary } from '../src/detect.ts';
import { repo } from './repo.ts';

const fixture = (name: string) => new URL(`fixtures/${name}`, import.meta.url).pathname;

await test('an Expo module with all three platforms', async () => {
  const root = fixture('expo-all');
  assert.deepEqual(await detectLibrary(root), {
    root,
    packageName: '@acme/expo-probe',
    kind: 'expo',
    usesNitro: false,
    usesCodegen: false,
    exampleDir: join(root, 'example'),
    platforms: ['typescript', 'kotlin', 'swift'],
    gradleProject: ':acme-expo-probe',
    podName: 'ExpoProbe',
  });
});

await test('an Expo module whose config lists only android and names its Gradle project has no swift', async () => {
  const root = fixture('expo-android');
  assert.deepEqual(await detectLibrary(root), {
    root,
    packageName: 'expo-android-probe',
    kind: 'expo',
    usesNitro: false,
    usesCodegen: false,
    exampleDir: join(root, 'example'),
    platforms: ['typescript', 'kotlin'],
    gradleProject: ':android-probe',
  });
});

await test('a bare Nitro library with committed example projects', async () => {
  const root = fixture('bare-nitro');
  assert.deepEqual(await detectLibrary(root), {
    root,
    packageName: 'react-native-bare-probe',
    kind: 'bare',
    usesNitro: true,
    usesCodegen: false,
    exampleDir: join(root, 'example'),
    platforms: ['typescript', 'kotlin', 'swift'],
    gradleProject: ':react-native-bare-probe',
    podName: 'BareProbe',
  });
});

await test('a repo with no native module throws, naming what was looked for', async () => {
  await assert.rejects(
    detectLibrary(fixture('none')),
    /No React Native native module .*expo-module\.config\.json.*example\/ios\/Podfile/,
  );
});

await test('a bare Turbo module with codegenConfig and no Swift', async () => {
  const root = fixture('bare-turbo');
  assert.deepEqual(await detectLibrary(root), {
    root,
    packageName: 'react-native-turbo-probe',
    kind: 'bare',
    usesNitro: false,
    usesCodegen: true,
    exampleDir: join(root, 'example'),
    platforms: ['typescript', 'kotlin'],
    gradleProject: ':react-native-turbo-probe',
  });
});

await test('a bare library with a Kotlin settings script and a computed podspec name', async (t) => {
  const root = await repo(t, {
    'package.json': '{ "name": "react-native-bun-probe" }',
    'example/android/settings.gradle.kts': '',
    'android/src/main/java/BunProbe.kt': '',
    'ios/BunProbe.podspec': 'Pod::Spec.new do |s|\n  s.name = package["name"].delete_prefix("react-native-")\nend\n',
    'ios/BunProbe.swift': '',
  });
  const library = await detectLibrary(root);
  assert.equal(library.kind, 'bare');
  assert.deepEqual(library.platforms, ['typescript', 'kotlin', 'swift']);
  assert.equal(library.podName, 'BunProbe', 'the podspec file name stands in for a computed s.name');
});

await test('sources under build/ are not detected', async (t) => {
  const root = await repo(t, {
    'package.json': '{ "name": "react-native-build-probe" }',
    'example/ios/Podfile': '',
    'android/build/generated/Generated.kt': '',
    'ios/BuildProbe.podspec': '',
    'ios/build/Generated.swift': '',
  });
  assert.deepEqual((await detectLibrary(root)).platforms, ['typescript']);
});
