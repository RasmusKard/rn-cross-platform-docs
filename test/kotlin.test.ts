import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKotlin } from '../src/kotlin.ts';
import type { Build, Library } from '../src/library.ts';
import { repo } from './repo.ts';

const noBuild: Build = { gradleDir: '/nonexistent/android', xcodeWorkspace: '/nonexistent/ios' };

void test('a missing Android project is an error naming it', async () => {
  const library: Library = { root: new URL('fixtures/bare-turbo', import.meta.url).pathname, platforms: ['kotlin'] };
  await assert.rejects(generateKotlin(library, '/nonexistent/out', noBuild), /No \/nonexistent\/android\/gradlew/);
});

void test('a gradlew without its executable bit is an error naming it and chmod +x', async (t) => {
  const root = await repo(t, { 'example/android/gradlew': '#!/bin/sh\n' });
  const library: Library = { root, platforms: ['typescript', 'kotlin'] };
  const build = { gradleDir: `${root}/example/android`, xcodeWorkspace: '' };
  const gradlew = `${root}/example/android/gradlew`;
  await assert.rejects(
    generateKotlin(library, `${root}/out`, build),
    new Error(`\`${gradlew}\` is not executable; run \`chmod +x ${gradlew}\``),
  );
});
