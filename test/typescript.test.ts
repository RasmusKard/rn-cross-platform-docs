import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { test } from 'node:test';
import type { Library } from '../src/library.ts';
import { generateTypeScript } from '../src/typescript.ts';

const root = new URL('fixtures/typescript', import.meta.url).pathname;

void test('writes Markdown from the repo config, without local plugins or assets', async (t) => {
  const info = t.mock.method(console, 'info', () => {});
  const out = join(mkdtempSync(join(tmpdir(), 'ts-gen-')), 'typescript');
  const library: Library = {
    root,
    packageName: 'fixture',
    kind: 'bare',
    usesNitro: false,
    usesCodegen: false,
    exampleDir: join(root, 'example'),
    platforms: ['typescript'],
  };

  await generateTypeScript(library, out);

  assert.deepEqual(readdirSync(out).sort(), ['README.md', 'functions']);
  assert.deepEqual(readdirSync(join(out, 'functions')), ['greet.md']);
  assert.ok(!existsSync(join(root, 'docs')), 'the config `out` is overridden');
  assert.ok(!existsSync(join(root, 'api.json')), 'the config `json` output is dropped');
  const dropped = info.mock.calls.map((c) => stripVTControlCharacters(String(c.arguments[0]))).filter((l) => l.includes('Dropping'));
  assert.deepEqual(dropped, [`[info] Dropping local TypeDoc plugin ${join(root, '.config/local-plugin.mjs')}`]);
});

void test('falls back to src/index.tsx when the repo sets no entry points', async (t) => {
  t.mock.method(console, 'info', () => {});
  const root = new URL('fixtures/typescript-no-config', import.meta.url).pathname;
  const out = join(mkdtempSync(join(tmpdir(), 'ts-gen-')), 'typescript');

  await generateTypeScript({ root, packageName: 'no-config', kind: 'bare', usesNitro: false, usesCodegen: false, exampleDir: join(root, 'example'), platforms: ['typescript'] }, out);

  assert.deepEqual(readdirSync(join(out, 'functions')), ['hello.md']);
});
