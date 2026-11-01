import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { platformNav } from '../src/nav.ts';

function tree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'nav-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

await test('Kotlin: sections titled by index.md H1, package by folder name, lone pages unwrapped', async () => {
  const dir = tree({
    'index.md': '# lib',
    'package-list': '',
    'lib/com.example/index.md': '# Package-level declarations',
    'lib/com.example/-web-view/index.md': '# WebView',
    'lib/com.example/-web-view/load.md': '# load',
    'lib/com.example/-mode/index.md': '# Mode',
    'lib/com.example/-mode/-o-n/index.md': '# ON',
  });
  assert.deepEqual(await platformNav(dir), {
    nav: [
      'index.md',
      {
        'com.example': [
          'lib/com.example/index.md',
          { Mode: ['lib/com.example/-mode/index.md', 'lib/com.example/-mode/-o-n/index.md'] },
          { WebView: ['lib/com.example/-web-view/index.md', 'lib/com.example/-web-view/load.md'] },
        ],
      },
    ],
  });
});

await test('Swift: <type>.md grouped with <type>/, documentation/<module> level dropped', async () => {
  const dir = tree({
    'documentation/m.md': '<!--\n{}\n-->\n\n# M',
    'documentation/m/f(_:).md': '# f(_:)',
    'documentation/m/scope.md': '# Scope',
    'documentation/m/scope/end.md': '# Scope.End',
    'documentation/m/scope/end/!=(_:_:).md': '# !=(_:_:)',
  });
  assert.deepEqual(await platformNav(dir), {
    nav: [
      'documentation/m.md',
      'documentation/m/f(_:).md',
      {
        Scope: [
          'documentation/m/scope.md',
          { 'Scope.End': ['documentation/m/scope/end.md', 'documentation/m/scope/end/!=(_:_:).md'] },
        ],
      },
    ],
  });
});

await test('Swift: a folder without pages is left out, so documentation/<module> still collapses', async () => {
  const dir = tree({
    'documentation/m.md': '# M',
    'documentation/m/f(_:).md': '# f(_:)',
    'images/com.example.m/x.png': '',
  });
  assert.deepEqual(await platformNav(dir), { nav: ['documentation/m.md', 'documentation/m/f(_:).md'] });
});

await test('a page is kept next to a file of its name without .md', async () => {
  assert.deepEqual(await platformNav(tree({ 'foo': '', 'foo.md': '# Foo' })), { nav: ['foo.md'] });
});

await test('a section whose page has no heading is titled by its folder name', async () => {
  const dir = tree({ 'index.md': '# lib', 'lib/-web-view/index.md': 'No heading', 'lib/-web-view/load.md': '# load' });
  assert.deepEqual(await platformNav(dir), {
    nav: ['index.md', { '-web-view': ['lib/-web-view/index.md', 'lib/-web-view/load.md'] }],
  });
});
