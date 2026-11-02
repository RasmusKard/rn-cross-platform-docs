import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKotlin } from '../src/kotlin.ts';
import type { Library } from '../src/library.ts';

const root = new URL('fixtures/existing-dokka', import.meta.url).pathname;

void test('a package that already applies Dokka is rejected before any build', async () => {
  const library: Library = {
    root,
    packageName: 'existing-dokka',
    kind: 'bare',
    usesNitro: false,
    usesCodegen: false,
    exampleDir: `${root}/example`,
    platforms: ['kotlin'],
    gradleProject: ':existing-dokka',
  };
  await assert.rejects(generateKotlin(library, `${root}/out`), /android\/build\.gradle\.kts already applies Dokka/);
});
