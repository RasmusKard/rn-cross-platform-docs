import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { repoUrl, writeProject } from '../src/build.ts';

function library(): string {
  const root = mkdtempSync(join(tmpdir(), 'lib-'));
  writeFileSync(join(root, 'package.json'), '{"name":"my-lib"}');
  writeFileSync(join(root, 'README.md'), '# my-lib\n\n[Guide](guides/a.md)');
  mkdirSync(join(root, 'guides'));
  writeFileSync(join(root, 'guides/a.md'), '# A\n\n[Home](../README.md)');
  mkdirSync(join(root, 'docs/reference/kotlin'), { recursive: true });
  writeFileSync(join(root, 'docs/reference/kotlin/index.md'), '# my-lib');
  return root;
}

await test('writes the config, inputs and nav for the platforms present', async () => {
  const root = library();
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'my-lib',
      description: 'Does things',
      repository: { url: 'git+https://github.com/me/my-lib.git' },
    }),
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site', siteUrl: 'https://x.dev/' });
  const toml = readFileSync(join(out, 'zensical.toml'), 'utf8');
  assert.match(toml, /^site_name = "my-lib"$/m);
  assert.match(toml, /^site_url = "https:\/\/x.dev\/"$/m);
  assert.match(toml, /^site_description = "Does things"$/m);
  assert.match(toml, /^repo_url = "https:\/\/github.com\/me\/my-lib"$/m);
  assert.match(toml, /^scheme = "slate"$/m);
  assert.match(toml, /^pymdownx\.escapeall\.hardbreak = true$/m);
  assert.doesNotMatch(toml, /^pymdownx\.emoji/m);
  assert.ok(existsSync(join(out, 'docs/README.md')));
  assert.ok(existsSync(join(out, 'docs/guides/a.md')));
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/.nav.yml'), 'utf8')), {
    nav: [{ Home: 'README.md' }, { Guides: 'guides' }, { Kotlin: 'kotlin' }],
  });
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/kotlin/.nav.yml'), 'utf8')), { nav: ['index.md'] });
});

await test('repoUrl turns package.json repository forms into web URLs', () => {
  const web = 'https://github.com/me/my-lib';
  assert.equal(repoUrl('git+https://github.com/me/my-lib.git'), web);
  assert.equal(repoUrl({ url: 'git+ssh://git@github.com/me/my-lib.git' }), web);
  assert.equal(repoUrl('git@github.com:me/my-lib.git'), undefined);
  assert.equal(repoUrl('me/my-lib'), web);
  assert.equal(repoUrl('github:me/my-lib'), web);
  assert.equal(repoUrl('gitlab:me/my-lib'), 'https://gitlab.com/me/my-lib');
  assert.equal(repoUrl('https://gitlab.com/group/sub/my-lib/'), 'https://gitlab.com/group/sub/my-lib');
  assert.equal(repoUrl(undefined), undefined);
});

await test('drops what precedes each reference page H1 and labels Swift code blocks', async () => {
  const root = library();
  writeFileSync(
    join(root, 'docs/reference/kotlin/index.md'),
    '//[my-lib](index.md)\n\n# my-lib\n\n// not a breadcrumb',
  );
  mkdirSync(join(root, 'docs/reference/swift/documentation/m'), { recursive: true });
  writeFileSync(
    join(root, 'docs/reference/swift/documentation/m/index.md'),
    '<!--\n{\n  "title" : "M"\n}\n-->\n\n# M\n\n<!-- kept -->\n\n```\nlet x = 1\n```\n\n```js\nx()\n```\n\n```\ny()\n```\n',
  );
  mkdirSync(join(root, 'docs/reference/typescript'));
  writeFileSync(join(root, 'docs/reference/typescript/README.md'), '[**my-lib**](README.md)\n\n***\n\n# my-lib\n\n***');
  writeFileSync(join(root, 'docs/reference/typescript/front.md'), '---\ntitle: T\n---\n[x](README.md)\n\n# T');
  writeFileSync(join(root, 'docs/reference/typescript/no-h1.md'), 'Text\n\n```sh\n# install\n```\n');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(readFileSync(join(out, 'docs/kotlin/index.md'), 'utf8'), '# my-lib\n\n// not a breadcrumb');
  assert.equal(
    readFileSync(join(out, 'docs/swift/documentation/m/index.md'), 'utf8'),
    '# M\n\n<!-- kept -->\n\n```swift\nlet x = 1\n```\n\n```js\nx()\n```\n\n```swift\ny()\n```\n',
  );
  assert.equal(readFileSync(join(out, 'docs/typescript/README.md'), 'utf8'), '# my-lib\n\n***');
  assert.equal(readFileSync(join(out, 'docs/typescript/front.md'), 'utf8'), '---\ntitle: T\n---\n# T');
  assert.equal(readFileSync(join(out, 'docs/typescript/no-h1.md'), 'utf8'), 'Text\n\n```sh\n# install\n```\n');
  assert.match(readFileSync(join(out, 'zensical.toml'), 'utf8'), /^toc\.toc_depth = 3$/m);
});

await test('drops the Kotlin root page when the nav leaves it out', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/kotlin/lib/com.example/-t'), { recursive: true });
  writeFileSync(join(root, 'docs/reference/kotlin/lib/com.example/index.md'), '# Package-level declarations');
  writeFileSync(join(root, 'docs/reference/kotlin/lib/com.example/-t/index.md'), '# T');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/kotlin/.nav.yml'), 'utf8')), {
    nav: ['lib/com.example/index.md', 'lib/com.example/-t/index.md'],
  });
  assert.ok(!existsSync(join(out, 'docs/kotlin/index.md')));

  mkdirSync(join(root, 'docs/reference/kotlin/lib/com.other'));
  writeFileSync(join(root, 'docs/reference/kotlin/lib/com.other/index.md'), '# Package-level declarations');
  await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.ok(existsSync(join(out, 'docs/kotlin/index.md')), 'kept when it lists several packages');
});

await test("drops Dokka's androidJvm marks and hides empty table header rows", async () => {
  const root = library();
  writeFileSync(
    join(root, 'docs/reference/kotlin/index.md'),
    '# f\n\n[androidJvm]\\\nfun f(x: Int)\n\n#### Parameters\n\nandroidJvm\n\n| | |\n|---|---|\n' +
      '| x | [androidJvm]<br>val x |\n\nandroidJvm\n\nandroidJvm text',
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/kotlin/index.md'), 'utf8'),
    '# f\n\nfun f(x: Int)\n\n#### Parameters\n\n| | |\n|---|---|\n| x | val x |\n\nandroidJvm\n\nandroidJvm text',
  );
  assert.match(
    readFileSync(join(out, 'docs/extra.css'), 'utf8'),
    /^\.md-typeset thead:not\(:has\(th:not\(:empty\)\)\) \{ display: none; \}$/m,
  );
});

await test('keeps code in table cells from breaking mid-identifier', async () => {
  const out = await writeProject(library(), { reference: 'docs/reference', out: 'docs-site' });
  assert.match(
    readFileSync(join(out, 'docs/extra.css'), 'utf8'),
    /^\.md-typeset table code \{ word-break: normal; \}$/m,
  );
});

await test('titles Kotlin package pages by package name', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/kotlin/lib/com.example'), { recursive: true });
  writeFileSync(
    join(root, 'docs/reference/kotlin/lib/com.example/index.md'),
    '//[lib](../../index.md)/[com.example](index.md)\n\n# Package-level declarations\n',
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(readFileSync(join(out, 'docs/kotlin/lib/com.example/index.md'), 'utf8'), '# com.example\n');
});

await test("titles a Kotlin class's constructors page constructor, not after the class", async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/kotlin/lib/com.example/-t'), { recursive: true });
  writeFileSync(join(root, 'docs/reference/kotlin/lib/com.example/-t/index.md'), '# T\n\n[androidJvm]\\\nclass T\n');
  writeFileSync(join(root, 'docs/reference/kotlin/lib/com.example/-t/-t.md'), '# T\n\n[androidJvm]\\\nconstructor()\n');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/kotlin/lib/com.example/-t/-t.md'), 'utf8'),
    '# constructor\n\nconstructor()\n',
  );
  assert.equal(readFileSync(join(out, 'docs/kotlin/lib/com.example/-t/index.md'), 'utf8'), '# T\n\nclass T\n');
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/kotlin/.nav.yml'), 'utf8')), {
    nav: ['lib/com.example/-t/index.md', 'lib/com.example/-t/-t.md'],
  });
});

await test('keeps the title of a Kotlin function named like its package', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/kotlin/lib/greet'), { recursive: true });
  writeFileSync(join(root, 'docs/reference/kotlin/lib/greet/greet.md'), '# greet\n\n[androidJvm]\\\nfun greet()\n');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.match(readFileSync(join(out, 'docs/kotlin/lib/greet/greet.md'), 'utf8'), /^# greet\n/);
});

await test('orders guides as the README links them, then any rest, and keeps a guides/.nav.yml of its own', async () => {
  const root = library();
  writeFileSync(
    join(root, 'README.md'),
    '# my-lib\n\n[B](guides/b.md#x), [gone](guides/gone.md), [A](./guides/a.md), [B again](guides/b.md)',
  );
  writeFileSync(join(root, 'guides/b.md'), '# B');
  writeFileSync(join(root, 'guides/c.md'), '# C');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/guides/.nav.yml'), 'utf8')), { nav: ['b.md', 'a.md', '*'] });
  assert.match(readFileSync(join(out, 'docs/extra.css'), 'utf8'), /^\.md-typeset h5 \{ text-transform: none; \}$/m);
  assert.match(readFileSync(join(out, 'zensical.toml'), 'utf8'), /^extra_css = \["extra\.css"\]$/m);

  rmSync(join(root, 'guides/c.md'));
  await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.deepEqual(
    JSON.parse(readFileSync(join(out, 'docs/guides/.nav.yml'), 'utf8')),
    { nav: ['b.md', 'a.md'] },
    'no `*` when the README links every guide',
  );
  mkdirSync(join(root, 'guides/more'));
  writeFileSync(join(root, 'guides/more/d.md'), '# D');
  await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/guides/.nav.yml'), 'utf8')), { nav: ['b.md', 'a.md', '*'] });

  writeFileSync(join(root, 'guides/.nav.yml'), 'nav: [c.md]');
  await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(readFileSync(join(out, 'docs/guides/.nav.yml'), 'utf8'), 'nav: [c.md]');
});

await test('adds no `*` for a guides/ subfolder without Markdown, such as images/', async () => {
  const root = library();
  mkdirSync(join(root, 'guides/images'));
  writeFileSync(join(root, 'guides/images/shot.png'), '');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/guides/.nav.yml'), 'utf8')), { nav: ['a.md'] });
});

await test('TypeScript follows the navigation JSON, which stays out of the site', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript/functions'), { recursive: true });
  writeFileSync(join(root, 'docs/reference/typescript/README.md'), '# my-lib');
  writeFileSync(join(root, 'docs/reference/typescript/functions/f.md'), '# f');
  writeFileSync(
    join(root, 'docs/reference/typescript/navigation.json'),
    '[{"title":"Functions","children":[{"title":"f","kind":64,"path":"functions/f.md"}]}]',
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/typescript/.nav.yml'), 'utf8')), {
    nav: ['README.md', { Functions: [{ f: 'functions/f.md' }] }],
  });
  assert.ok(!existsSync(join(out, 'docs/typescript/navigation.json')));
  assert.ok(existsSync(join(root, 'docs/reference/typescript/navigation.json')), 'the reference stays as it was');
});

await test('TypeScript without navigation JSON hides _media/ and documents/', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript'));
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/typescript/.nav.yml'), 'utf8')), {
    ignore: ['_*', 'documents'],
  });
  // Zensical only reads exclude_docs as a multiline string
  assert.match(
    readFileSync(join(out, 'zensical.toml'), 'utf8'),
    /^exclude_docs = """\ntypescript\/_media\/\*\.md\n"""$/m,
  );
});

await test('replaces its own project on a rebuild, and drops removed pages', async () => {
  const root = library();
  await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  writeFileSync(join(root, 'docs-site/docs/stale.md'), '');
  await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.ok(!existsSync(join(root, 'docs-site/docs/stale.md')));
});

await test('refuses a non-empty directory it did not write', async () => {
  const root = library();
  await assert.rejects(
    writeProject(root, { reference: 'docs/reference', out: 'guides' }),
    /wasn't written by this tool/,
  );
  assert.ok(existsSync(join(root, 'guides/a.md')));
});

await test('refuses a reference dir with no platform trees', async () => {
  await assert.rejects(
    writeProject(library(), { reference: 'guides', out: 'docs-site' }),
    /run `rn-cross-platform-docs generate` first/,
  );
});

await test('refuses a library without README.md', async () => {
  const root = library();
  rmSync(join(root, 'README.md'));
  await assert.rejects(
    writeProject(root, { reference: 'docs/reference', out: 'docs-site' }),
    /no README\.md in .*; it is the site's home page/,
  );
});

await test('an empty platform tree gets an empty nav', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/swift'));
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/swift/.nav.yml'), 'utf8')), { nav: [] });
});

await test('builds without guides/, --site-url, description or repository', async () => {
  const root = library();
  rmSync(join(root, 'guides'), { recursive: true });
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/.nav.yml'), 'utf8')), {
    nav: [{ Home: 'README.md' }, { Kotlin: 'kotlin' }],
  });
  assert.doesNotMatch(readFileSync(join(out, 'zensical.toml'), 'utf8'), /site_url|site_description|repo_url/);
});

await test('refuses a reference dir inside the output dir', async () => {
  const root = library();
  await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  mkdirSync(join(root, 'docs-site/ref/kotlin'), { recursive: true });
  await assert.rejects(
    writeProject(root, { reference: 'docs-site/ref', out: 'docs-site' }),
    /--reference must be outside --out/,
  );
});

await test('wraps a sidebar label that is one long identifier', async () => {
  const out = await writeProject(library(), { reference: 'docs/reference', out: 'docs-site' });
  assert.match(
    readFileSync(join(out, 'docs/extra.css'), 'utf8'),
    /^\.md-nav--primary \.md-ellipsis \{ overflow-wrap: anywhere; \}$/m,
  );
});

await test("turns TypeDoc's Parameters and Returns headings into bold labels, outside code blocks", async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript'));
  const page = '# f()\n\n## Parameters\n\n| a | b |\n\n#### Returns\n\n`x`\n\n```md\n## Returns\n```\n';
  writeFileSync(join(root, 'docs/reference/typescript/f.md'), page);
  writeFileSync(join(root, 'docs/reference/kotlin/index.md'), '# f\n\n#### Parameters\n');
  writeFileSync(join(root, 'guides/a.md'), '# A\n\n## Returns\n');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/typescript/f.md'), 'utf8'),
    '# f()\n\n**Parameters**\n\n| a | b |\n\n**Returns**\n\n`x`\n\n```md\n## Returns\n```\n',
  );
  assert.equal(readFileSync(join(out, 'docs/kotlin/index.md'), 'utf8'), '# f\n\n#### Parameters\n');
  assert.equal(readFileSync(join(out, 'docs/guides/a.md'), 'utf8'), '# A\n\n## Returns\n');
});

await test('gives Kotlin enum Entries tables a header, without the repeated entry name', async () => {
  const root = library();
  writeFileSync(
    join(root, 'docs/reference/kotlin/index.md'),
    '# E\n\n## Entries\n\n| | |\n|---|---|\n' +
      '| [A](-a/index.md) | [androidJvm]<br>[A](-a/index.md)<br>The first. |\n' +
      '| [B](-b/index.md) | [androidJvm]<br>[B](-b/index.md) |\n' +
      '| [C](-c/index.md) | [androidJvm]<br>[C](-c/index.md)(0xFF0000)<br>With an argument. |\n\n## Properties\n',
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/kotlin/index.md'), 'utf8'),
    '# E\n\n## Entries\n\n| Name | Summary |\n|---|---|\n| [A](-a/index.md) | The first. |\n| [B](-b/index.md) | |\n' +
      '| [C](-c/index.md) | [C](-c/index.md)(0xFF0000)<br>With an argument. |\n\n## Properties\n',
  );
});
