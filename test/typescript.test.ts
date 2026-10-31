import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { test } from 'node:test';
import type { Stack } from '../src/stack.ts';
import { generateTypeScript } from '../src/typescript.ts';

const root = new URL('fixtures/typescript', import.meta.url).pathname;

void test('writes Markdown from the repo config, without local plugins or assets', async (t) => {
  const info = t.mock.method(console, 'info', () => {});
  const out = join(mkdtempSync(join(tmpdir(), 'ts-gen-')), 'typescript');
  const stack: Stack = {
    root,
    name: 'fixture',
    kind: 'bare',
    packageManager: 'npm',
    nitro: false,
    example: join(root, 'example'),
    platforms: ['typescript'],
  };

  await generateTypeScript(stack, out);

  assert.deepEqual(readdirSync(out).sort(), ['README.md', 'functions']);
  assert.deepEqual(readdirSync(join(out, 'functions')), ['greet.md']);
  assert.ok(!existsSync(join(root, 'docs')), 'the config `out` is overridden');
  const dropped = info.mock.calls.map((c) => stripVTControlCharacters(String(c.arguments[0]))).filter((l) => l.includes('Dropping'));
  assert.deepEqual(dropped, [`[info] Dropping local TypeDoc plugin ${join(root, '.config/local-plugin.mjs')}`]);
});
