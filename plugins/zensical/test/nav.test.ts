import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';
import { platformNav, typescriptNav } from '../src/nav.ts';

const dirs: string[] = [];
// a file-level after() can run before later top-level awaited tests, so clean up after each
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'nav-'));
  dirs.push(dir);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

await test('Kotlin: sections titled by index.md H1, lone pages unwrapped', async () => {
  const dir = tree({
    'index.md': '# lib',
    'package-list': '',
    'lib/com.example/index.md': '# com.example',
    'lib/com.example/-web-view/index.md': '# WebView',
    'lib/com.example/-web-view/-web-view.md': '# WebView',
    'lib/com.example/-web-view/load.md': '# load',
    'lib/com.example/-mode/index.md': '# Mode',
    'lib/com.example/-mode/-o-n/index.md': '# ON',
    'lib/com.example.views/index.md': '# com.example.views',
    'lib/com.example.views/-pane/index.md': '# Pane',
  });
  assert.deepEqual(await platformNav(dir), {
    nav: [
      'index.md',
      {
        'com.example': [
          'lib/com.example/index.md',
          { Mode: ['lib/com.example/-mode/index.md', 'lib/com.example/-mode/-o-n/index.md'] },
          {
            WebView: [
              'lib/com.example/-web-view/index.md',
              { constructor: 'lib/com.example/-web-view/-web-view.md' },
              'lib/com.example/-web-view/load.md',
            ],
          },
        ],
      },
      { 'com.example.views': ['lib/com.example.views/index.md', 'lib/com.example.views/-pane/index.md'] },
    ],
  });
});

await test("Kotlin: an enum's entries in declaration order, without Dokka's entries, valueOf and values", async () => {
  const dir = tree({
    'lib/p/-mode/index.md':
      '# Mode\n\nSee [OFF](-o-f-f/index.md).\n\n## Entries\n\n| | |\n|---|---|\n' +
      '| [ON](-o-n/index.md) | Unlike [OFF](-o-f-f/index.md) |\n| [AUTO](-a-u-t-o/index.md) | |\n| [OFF](-o-f-f/index.md) | |\n\n' +
      '## Properties\n\n| Name | Summary |\n|---|---|\n| [entries](entries.md) | |\n\n' +
      '## Functions\n\n| Name | Summary |\n|---|---|\n| [describe](describe.md) | |\n| [valueOf](value-of.md) | |\n',
    'lib/p/-mode/-o-n/index.md': '# ON',
    'lib/p/-mode/-a-u-t-o/index.md': '# AUTO',
    'lib/p/-mode/-o-f-f/index.md': '# OFF',
    'lib/p/-mode/-o-f-f/describe.md': '# describe',
    'lib/p/-mode/describe.md': '# describe',
    'lib/p/-mode/entries.md': '# entries',
    'lib/p/-mode/value-of.md': '# valueOf',
    'lib/p/-mode/values.md': '# values',
  });
  assert.deepEqual(await platformNav(dir), {
    nav: [
      'lib/p/-mode/index.md',
      'lib/p/-mode/-o-n/index.md',
      'lib/p/-mode/-a-u-t-o/index.md',
      { OFF: ['lib/p/-mode/-o-f-f/index.md', 'lib/p/-mode/-o-f-f/describe.md'] },
      'lib/p/-mode/describe.md',
    ],
  });
});

await test('Kotlin: a type that only mentions Entries keeps its values member', async () => {
  const dir = tree({
    'lib/p/-box/index.md': '# Box\n\n## Entries\n\n| | |\n|---|---|\n| [b](-b/index.md) | |\n| [a](-a/index.md) | |\n',
    'lib/p/-box/-a/index.md': '# a',
    'lib/p/-box/-b/index.md': '# b',
    'lib/p/-box/values.md': '# values',
  });
  assert.deepEqual(await platformNav(dir), {
    nav: ['lib/p/-box/index.md', 'lib/p/-box/-a/index.md', 'lib/p/-box/-b/index.md', 'lib/p/-box/values.md'],
  });
});

await test('Kotlin: a page-only package among several keeps the root page', async () => {
  const dir = tree({
    'index.md': '# lib',
    'lib/a/index.md': '# a',
    'lib/b/index.md': '# b',
    'lib/b/-t/index.md': '# T',
  });
  assert.deepEqual(await platformNav(dir), {
    nav: ['index.md', 'lib/a/index.md', { b: ['lib/b/index.md', 'lib/b/-t/index.md'] }],
  });
});

await test('Kotlin: one package replaces the root page that lists it', async () => {
  const dir = tree({
    'index.md': '# lib',
    'lib/com.example/index.md': '# com.example',
    'lib/com.example/-web-view/index.md': '# WebView',
    'lib/com.example/-web-view/load.md': '# load',
  });
  assert.deepEqual(await platformNav(dir), {
    nav: [
      'lib/com.example/index.md',
      { WebView: ['lib/com.example/-web-view/index.md', 'lib/com.example/-web-view/load.md'] },
    ],
  });
});

await test('Swift: sections titled by index.md H1, documentation/<module> level dropped', async () => {
  const dir = tree({
    'documentation/m/index.md': '# M',
    'documentation/m/f(_:).md': '# f(_:)',
    'documentation/m/scope/index.md': '# Scope',
    'documentation/m/scope/end/index.md': '# Scope.End',
    'documentation/m/scope/end/!=(_:_:).md': '# !=(_:_:)',
    'documentation/m/my_type/index.md': '# My\\_Type',
    'documentation/m/my_type/f().md': '# f()',
    'images/com.example.m/x.png': '',
  });
  assert.deepEqual(await platformNav(dir), {
    nav: [
      'documentation/m/index.md',
      'documentation/m/f(_:).md',
      { My_Type: ['documentation/m/my_type/index.md', 'documentation/m/my_type/f().md'] },
      {
        Scope: [
          'documentation/m/scope/index.md',
          { 'Scope.End': ['documentation/m/scope/end/index.md', 'documentation/m/scope/end/!=(_:_:).md'] },
        ],
      },
    ],
  });
});

await test('Swift: a type with a member named index keeps its page as the sibling <type>.md', async () => {
  const dir = tree({
    'documentation/m/index.md': '# M',
    'documentation/m/t.md': '# T',
    'documentation/m/t/index.md': '# index',
    'documentation/m/t/f().md': '# f()',
  });
  assert.deepEqual(await platformNav(dir), {
    nav: [
      'documentation/m/index.md',
      { T: ['documentation/m/t.md', 'documentation/m/t/index.md', 'documentation/m/t/f().md'] },
    ],
  });
});

await test('a page is kept next to a file of its name without .md', async () => {
  assert.deepEqual(await platformNav(tree({ foo: '', 'foo.md': '# Foo' })), { nav: ['foo.md'] });
});

await test('a section whose page has no heading is titled by its folder name', async () => {
  const dir = tree({
    'lib/-web-view/index.md': 'No heading',
    'lib/-web-view/load.md': '# load',
    'other.md': '# Other',
  });
  assert.deepEqual(await platformNav(dir), {
    nav: [{ '-web-view': ['lib/-web-view/index.md', 'lib/-web-view/load.md'] }, 'other.md'],
  });
});

await test('TypeScript: sections and titles from TypeDoc navigation JSON, root pages first, documents left out', async () => {
  const dir = tree({ 'globals.md': '', 'hierarchy.md': '', 'README.md': '', 'lib/README.md': '' });
  const json = [
    { title: 'Hierarchy', path: 'hierarchy.md' },
    { title: 'Documents', children: [{ title: 'Guide', kind: 8388608, path: 'documents/Guide.md' }] },
    {
      title: '@scope/lib',
      kind: 2,
      path: 'lib/README.md',
      children: [
        {
          title: 'Core',
          children: [
            {
              title: 'NS',
              kind: 4,
              path: 'lib/namespaces/NS/README.md',
              children: [{ title: 'Functions', children: [{ title: 'f', kind: 64, path: 'lib/namespaces/NS/f.md' }] }],
            },
            { title: 'Props', kind: 256, path: 'lib/interfaces/Props.md', isDeprecated: false },
          ],
        },
        { title: 'Empty', children: [] },
      ],
    },
  ];
  assert.deepEqual(await typescriptNav(dir, json), {
    nav: [
      'README.md',
      'globals.md',
      { Hierarchy: 'hierarchy.md' },
      {
        '@scope/lib': [
          'lib/README.md',
          {
            Core: [
              { NS: ['lib/namespaces/NS/README.md', { Functions: [{ f: 'lib/namespaces/NS/f.md' }] }] },
              { Props: 'lib/interfaces/Props.md' },
            ],
          },
        ],
      },
    ],
  });
});
