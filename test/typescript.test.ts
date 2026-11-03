import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { test } from 'node:test';
import type { Library } from '../src/library.ts';
import { generateTypeScript } from '../src/typescript.ts';

const root = new URL('fixtures/typescript', import.meta.url).pathname;

void test('writes Markdown from the repo config, keeping its plugins and options', async (t) => {
  const info = t.mock.method(console, 'info', () => {});
  const out = join(mkdtempSync(join(tmpdir(), 'ts-gen-')), 'typescript');
  const library: Library = {
    root,
    platforms: ['typescript'],
  };

  await generateTypeScript(library, out);

  assert.deepEqual(readdirSync(join(out, 'functions')), ['greet.md']);
  assert.match(readFileSync(join(out, 'README.md'), 'utf8'), /Fixture readme/, 'the config `readme` wins');
  assert.ok(!existsSync(join(root, 'docs')), 'the config `out` is overridden');
  const logged = info.mock.calls.map((c) => stripVTControlCharacters(String(c.arguments[0])));
  assert.ok(logged.includes('[info] local plugin loaded'));
});

void test('falls back to src/index.tsx and no readme when the repo sets neither', async (t) => {
  t.mock.method(console, 'info', () => {});
  const root = new URL('fixtures/typescript-no-config', import.meta.url).pathname;
  const out = join(mkdtempSync(join(tmpdir(), 'ts-gen-')), 'typescript');

  await generateTypeScript(
    {
      root,
      platforms: ['typescript'],
    },
    out,
  );

  assert.deepEqual(readdirSync(join(out, 'functions')), ['hello.md']);
  assert.doesNotMatch(readFileSync(join(out, 'README.md'), 'utf8'), /No-config readme/);
});
