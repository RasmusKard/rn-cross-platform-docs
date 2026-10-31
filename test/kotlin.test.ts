import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKotlin } from '../src/kotlin.ts';
import type { Stack } from '../src/stack.ts';

const root = new URL('fixtures/existing-dokka', import.meta.url).pathname;

void test('a package that already applies Dokka is rejected before any build', async () => {
  const stack: Stack = {
    root,
    name: 'existing-dokka',
    kind: 'bare',
    packageManager: 'npm',
    nitro: false,
    example: `${root}/example`,
    platforms: ['kotlin'],
    gradleProject: ':existing-dokka',
  };
  await assert.rejects(generateKotlin(stack, `${root}/out`), /android\/build\.gradle\.kts already applies Dokka/);
});
