import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKotlin } from '../src/kotlin.ts';
import type { Build, Library } from '../src/library.ts';

const noBuild: Build = { gradleDir: '/nonexistent/android', xcodeWorkspace: '/nonexistent/ios' };

void test('a missing Android project is an error naming it', async () => {
  const library: Library = { root: new URL('fixtures/bare-turbo', import.meta.url).pathname, platforms: ['kotlin'] };
  await assert.rejects(generateKotlin(library, '/nonexistent/out', noBuild), /No \/nonexistent\/android\/gradlew/);
});
