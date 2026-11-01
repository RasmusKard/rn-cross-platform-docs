import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { generate } from '../src/generate.ts';
import { repo } from './repo.ts';

/** A bare library with only TypeScript sources and an old `docs/reference/typescript/` tree. */
const library = (t: TestContext, source: string) =>
  repo(t, {
    'package.json': '{ "name": "generate-probe" }',
    'example/android/settings.gradle': '',
    'tsconfig.json': '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["src"] }',
    'src/index.ts': source,
    'docs/reference/typescript/old.md': '',
  });

void test('each platform replaces <out>/<platform>/', async (t) => {
  t.mock.method(console, 'info', () => {});
  const root = await library(t, '/** Says hi. */\nexport function hi(): string {\n  return "hi";\n}\n');

  await generate(root, { out: 'docs/reference' });

  assert.deepEqual((await readdir(join(root, 'docs/reference'))).sort(), ['typescript']);
  assert.ok(existsSync(join(root, 'docs/reference/typescript/functions/hi.md')));
  assert.ok(!existsSync(join(root, 'docs/reference/typescript/old.md')));
});

void test('a failing generator leaves the previous tree in place', async (t) => {
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'error', () => {});
  const root = await library(t, 'export const n: number = "not a number";\n');

  await assert.rejects(generate(root, { out: 'docs/reference' }), /TypeDoc failed/);

  assert.deepEqual(await readdir(join(root, 'docs/reference')), ['typescript']);
  assert.deepEqual(await readdir(join(root, 'docs/reference/typescript')), ['old.md']);
});

void test('a requested platform without sources is an error', async () => {
  const root = new URL('fixtures/bare-turbo', import.meta.url).pathname;
  await assert.rejects(generate(root, { out: 'docs/reference', platforms: ['typescript', 'swift'] }), /^Error: No swift sources detected in /);
  assert.ok(!existsSync(join(root, 'docs')), 'nothing is generated');
});
