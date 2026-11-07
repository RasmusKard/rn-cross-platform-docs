import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { repoUrl, writeProject } from '../src/build.ts';

const dirs: string[] = [];
// a file-level after() can run before later top-level awaited tests, so clean up after each
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function library(): string {
  const root = mkdtempSync(join(tmpdir(), 'lib-'));
  dirs.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"my-lib"}');
  writeFileSync(join(root, 'README.md'), '# my-lib\n\n[Guide](guides/a.md)');
  mkdirSync(join(root, 'guides'));
  writeFileSync(join(root, 'guides/a.md'), '# A\n\n[Home](../README.md)');
  mkdirSync(join(root, 'docs/reference/kotlin'), { recursive: true });
  writeFileSync(join(root, 'docs/reference/kotlin/index.md'), '# my-lib');
  return root;
}

const markdown = (...blocks: string[]) => `${blocks.join('\n\n')}\n`;

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

await test('labels Swift code blocks fenced with tildes, and leaves code in a longer fence as written', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/swift/documentation/m'), { recursive: true });
  // a catalog article showing a fence inside a longer one
  const page = (swift: string) =>
    markdown(
      '# M',
      'Write a fence like this:',
      '````markdown\n```\nlet x = 1\n```\n````',
      `\`\`\`${swift}\nlet y = 2\n\`\`\``,
      'Text between.',
      `~~~${swift}\nfunc z()\n~~~`,
    );
  writeFileSync(join(root, 'docs/reference/swift/documentation/m/index.md'), page(''));
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(readFileSync(join(out, 'docs/swift/documentation/m/index.md'), 'utf8'), page('swift'));
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
    '# constructor\n\n<p class="kotlin-signature" markdown="span">constructor()</p>\n',
  );
  assert.equal(
    readFileSync(join(out, 'docs/kotlin/lib/com.example/-t/index.md'), 'utf8'),
    '# T\n\n<p class="kotlin-signature" markdown="span">class T</p>\n',
  );
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/kotlin/.nav.yml'), 'utf8')), {
    nav: ['lib/com.example/-t/index.md', 'lib/com.example/-t/-t.md'],
  });
});

await test("moves a Kotlin function named like a type off the type page's URL, and links to it follow", async () => {
  const root = library();
  const pkg = join(root, 'docs/reference/kotlin/lib/p');
  mkdirSync(join(pkg, '-widget'), { recursive: true });
  writeFileSync(
    join(pkg, 'index.md'),
    '# Package-level declarations\n\n[Widget](-widget/index.md), [Widget](-widget.md)\n',
  );
  writeFileSync(
    join(pkg, '-widget.md'),
    '# Widget\n\n[androidJvm]\\\nfun [Widget](-widget.md)(): [Widget](-widget/index.md)\n\nMakes a [Widget](-widget.md#x).\n',
  );
  // the class's constructors page is named like the function too
  writeFileSync(
    join(pkg, '-widget/index.md'),
    '# Widget\n\n[androidJvm]\\\nclass Widget\n\nSee [the function](../-widget.md), not [the constructor](-widget.md).\n',
  );
  writeFileSync(join(pkg, '-widget/-widget.md'), '# Widget\n\n[androidJvm]\\\nconstructor()\n');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  const p = join(out, 'docs/kotlin/lib/p');
  const code = '<p class="kotlin-signature" markdown="span">';
  assert.ok(!existsSync(join(p, '-widget.md')));
  assert.equal(
    readFileSync(join(p, '-widget.fun.md'), 'utf8'),
    `# Widget\n\n${code}fun Widget(): [Widget](-widget/index.md)</p>\n\nMakes a [Widget](-widget.fun.md#x).\n`,
  );
  assert.equal(
    readFileSync(join(p, 'index.md'), 'utf8'),
    '# p\n\n[Widget](-widget/index.md), [Widget](-widget.fun.md)\n',
  );
  assert.equal(
    readFileSync(join(p, '-widget/index.md'), 'utf8'),
    `# Widget\n\n${code}class Widget</p>\n\nSee [the function](../-widget.fun.md), not [the constructor](-widget.md).\n`,
  );
  assert.equal(readFileSync(join(p, '-widget/-widget.md'), 'utf8'), `# constructor\n\n${code}constructor()</p>\n`);
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/kotlin/.nav.yml'), 'utf8')), {
    nav: ['lib/p/index.md', { Widget: ['lib/p/-widget/index.md', 'lib/p/-widget/-widget.md'] }, 'lib/p/-widget.fun.md'],
  });
});

await test('keeps the title of a Kotlin function named like its package', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/kotlin/lib/greet'), { recursive: true });
  writeFileSync(join(root, 'docs/reference/kotlin/lib/greet/greet.md'), '# greet\n\n[androidJvm]\\\nfun greet()\n');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.match(readFileSync(join(out, 'docs/kotlin/lib/greet/greet.md'), 'utf8'), /^# greet\n/);
});

await test('keeps words apart in Kotlin table cells, not in code, and leaves tables of members out of search', async () => {
  const root = library();
  // a trimMargin string's lines start with `|`, like a table row's
  const sample = '```kotlin\nHtml.fromHtml("Hello<br>world")\n"""\n|Hello<br>world\n""".trimMargin()\n```\n\n';
  writeFileSync(
    join(root, 'docs/reference/kotlin/index.md'),
    '# T\n\n## Properties\n\n| Name | Summary |\n|---|---|\n' +
      '| [x](x.md) | [androidJvm]<br>val x<br>The x, as in `"a<br>b"`. |\n\n## Functions\n\nNot a table.\n\n' +
      `${sample}#### Parameters\n\nandroidJvm\n\n| | |\n|---|---|\n| a | One.<br>Two. |\n`,
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/kotlin/index.md'), 'utf8'),
    '# T\n\n## Properties { data-search-exclude }\n\n| Name | Summary |\n|---|---|\n' +
      '| [x](x.md) | val x<br> The x, as in `"a<br>b"`. |\n\n## Functions\n\nNot a table.\n\n' +
      `${sample}#### Parameters\n\n| | |\n|---|---|\n| a | One.<br> Two. |\n`,
  );
});

await test('shows Kotlin signatures as code, without a link to their own page', async () => {
  const root = library();
  const pkg = join(root, 'docs/reference/kotlin/lib/p');
  mkdirSync(join(pkg, '-t/-a'), { recursive: true });
  writeFileSync(join(pkg, 'index.md'), '# Package-level declarations\n\n[androidJvm]\\\nThe package.\n');
  // a type with inheritors gets no source set mark; its type parameter links to its page
  writeFileSync(
    join(pkg, '-t/index.md'),
    '# T\n\n@[A](../-a/index.md)\n\nopen class [T](index.md)&lt;[R](index.md)&gt;@[A](../-a/index.md)constructor(r: [R](index.md)) \n\n' +
      'A type.\n\n# Not the H1\n\nText.\n',
  );
  writeFileSync(
    join(pkg, '-t/f.md'),
    '# f\n\n[androidJvm]\\\n\n@[A](../-a/index.md)(x = 1)\n\n@[B](../-b/index.md)\n\n' +
      'fun [~~f~~](f.md)(@[A](../-a/index.md)x: [T](index.md))\n\nOne.\n\n[androidJvm]\\\nfun [f](f.md)()\n\nTwo.\n',
  );
  writeFileSync(
    join(pkg, '-t/-a/index.md'),
    '# A\n\n[androidJvm]\\\n@[B](../../-b/index.md)\n\n[A](index.md)\n\nAn entry.\n',
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  const p = join(out, 'docs/kotlin/lib/p');
  const code = '<p class="kotlin-signature" markdown="span">';
  assert.equal(readFileSync(join(p, 'index.md'), 'utf8'), '# p\n\nThe package.\n');
  assert.equal(
    readFileSync(join(p, '-t/index.md'), 'utf8'),
    `# T\n\n${code}@[A](../-a/index.md)<br> open class T&lt;R&gt; @[A](../-a/index.md) constructor(r: R)</p>\n\n` +
      'A type.\n\n# Not the H1\n\nText.\n',
  );
  assert.equal(
    readFileSync(join(p, '-t/f.md'), 'utf8'),
    `# f\n\n${code}@[A](../-a/index.md)(x = 1)<br> @[B](../-b/index.md)<br> fun ~~f~~(@[A](../-a/index.md) x: [T](index.md))</p>` +
      `\n\nOne.\n\n${code}fun f()</p>\n\nTwo.\n`,
  );
  assert.equal(
    readFileSync(join(p, '-t/-a/index.md'), 'utf8'),
    `# A\n\n${code}@[B](../../-b/index.md)<br> A</p>\n\nAn entry.\n`,
  );
  assert.match(
    readFileSync(join(out, 'docs/extra.css'), 'utf8'),
    /^\.md-typeset \.kotlin-signature \{ .*font-family: var\(--md-code-font-family\);.* \}$/m,
  );
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

await test('orders guides by reference, angle-bracket, percent-encoded and HTML links too, not by links in code', async () => {
  const root = library();
  for (const f of ['setup.md', 'Usage Guide.md', 'advanced.md', '100%.md']) {
    writeFileSync(join(root, 'guides', f), '# x');
  }
  writeFileSync(
    join(root, 'README.md'),
    '# my-lib\n\n`[A](guides/a.md)`\n\n```md\n[A](guides/a.md)\n```\n\n    [A](guides/a.md)\n    [setup]: guides/a.md\n\n' +
      '[Setup][setup], [usage guide](<guides/Usage Guide.md>), [advanced](guides/advanced.md), [A][], [All][100]\n\n' +
      '[setup]: guides/setup.md\n[a]: ./guides/a.md#top\n[100]: guides/100%.md\n[setup]: guides/advanced.md\n',
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  const nav = () => JSON.parse(readFileSync(join(out, 'docs/guides/.nav.yml'), 'utf8'));
  assert.deepEqual(nav(), { nav: ['setup.md', 'Usage Guide.md', 'advanced.md', 'a.md', '100%.md'] });

  writeFileSync(
    join(root, 'README.md'),
    '# my-lib\n\n[Usage](guides/Usage%20Guide.md), <a href="guides/advanced.md">Advanced</a>, [setup], [A](guides/a.md)' +
      '\n\n[setup]: <guides/setup.md>\n',
  );
  await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.deepEqual(nav(), { nav: ['Usage Guide.md', 'advanced.md', 'setup.md', 'a.md', '*'] });
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

await test('keeps the headings in TypeScript code fenced with tildes or a longer fence', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript/functions'), { recursive: true });
  // typedoc-plugin-markdown 4.14.1's page, less its Defined in line, for a doc comment showing Markdown
  const page = (parameters: string, text: string, returns: string, example: string) =>
    markdown(
      '# Function: parse()',
      '> **parse**(`text`): `number`',
      'Document it like this:',
      "````md\n```ts\nparse('1');\n```\n\n## Parameters\n````",
      '~~~md\n## Returns\n~~~',
      parameters,
      text,
      '`string`',
      returns,
      '`number`',
      example,
      "```ts\nparse('2'); // 2\n```",
    );
  writeFileSync(
    join(root, 'docs/reference/typescript/functions/parse.md'),
    page('## Parameters', '### text', '## Returns', '## Example'),
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/typescript/functions/parse.md'), 'utf8'),
    page('**Parameters**', '**`text`**', '**Returns**', '**Example**'),
  );
});

await test('turns the headings inside each TypeScript member into labels, so search lists the member once', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript/interfaces'), { recursive: true });
  mkdirSync(join(root, 'docs/reference/typescript/type-aliases'));
  // typedoc-plugin-markdown 4.14.1's pages for examples/expo-greeter, less their Defined in lines
  writeFileSync(
    join(root, 'docs/reference/typescript/interfaces/ExpoGreeterModule.md'),
    markdown(
      '# ExpoGreeterModule',
      "The native module's API, available as the package's default export.",
      '## Extends',
      '- `NativeModule`\\<[`ExpoGreeterModuleEvents`](../type-aliases/ExpoGreeterModuleEvents.md)\\>',
      '## Properties',
      '### defaultName',
      '> **defaultName**: `string`',
      'The name `hello` greets when `options.name` is not given: `"world"`.',
      '## Methods',
      '### hello()',
      '> **hello**(`options?`): `string`',
      'Builds a greeting.',
      '#### Parameters',
      '##### options?',
      '[`GreetingOptions`](../type-aliases/GreetingOptions.md)',
      'Who to greet and how; omitted fields take their defaults.',
      '#### Returns',
      '`string`',
      'The greeting, e.g. `"Hello, world."`.',
      '#### Example',
      '```ts\nExpoGreeter.hello({ name: \'Ada\', excited: true }); // "Hello, Ada!"\n```',
      '***',
      '### setValueAsync()',
      '> **setValueAsync**(`value`): `Promise`\\<`void`\\>',
      'Emits `onChange` with `value`.',
      '#### Parameters',
      '##### value',
      '`string`',
      '#### Returns',
      '`Promise`\\<`void`\\>',
    ),
  );
  writeFileSync(
    join(root, 'docs/reference/typescript/type-aliases/ExpoGreeterModuleEvents.md'),
    markdown(
      '# ExpoGreeterModuleEvents',
      '> **ExpoGreeterModuleEvents** = `object`',
      '## Properties',
      '### onChange',
      '> **onChange**: (`params`) => `void`',
      '#### Parameters',
      '##### params',
      '[`ChangeEventPayload`](ChangeEventPayload.md)',
      '#### Returns',
      '`void`',
    ),
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/typescript/interfaces/ExpoGreeterModule.md'), 'utf8'),
    markdown(
      '# ExpoGreeterModule',
      "The native module's API, available as the package's default export.",
      '**Extends**',
      '- `NativeModule`\\<[`ExpoGreeterModuleEvents`](../type-aliases/ExpoGreeterModuleEvents.md)\\>',
      '## Properties',
      '### defaultName { #defaultname }',
      '> **defaultName**: `string`',
      'The name `hello` greets when `options.name` is not given: `"world"`.',
      '## Methods',
      '### hello() { #hello }',
      '> **hello**(`options?`): `string`',
      'Builds a greeting.',
      '**Parameters**',
      '**`options?`**',
      '[`GreetingOptions`](../type-aliases/GreetingOptions.md)',
      'Who to greet and how; omitted fields take their defaults.',
      '**Returns**',
      '`string`',
      'The greeting, e.g. `"Hello, world."`.',
      '**Example**',
      '```ts\nExpoGreeter.hello({ name: \'Ada\', excited: true }); // "Hello, Ada!"\n```',
      '***',
      '### setValueAsync() { #setvalueasync }',
      '> **setValueAsync**(`value`): `Promise`\\<`void`\\>',
      'Emits `onChange` with `value`.',
      '**Parameters**',
      '**`value`**',
      '`string`',
      '**Returns**',
      '`Promise`\\<`void`\\>',
    ),
  );
  assert.equal(
    readFileSync(join(out, 'docs/typescript/type-aliases/ExpoGreeterModuleEvents.md'), 'utf8'),
    markdown(
      '# ExpoGreeterModuleEvents',
      '> **ExpoGreeterModuleEvents** = `object`',
      '## Properties',
      '### onChange { #onchange }',
      '> **onChange**: (`params`) => `void`',
      '**Parameters**',
      '**`params`**',
      '[`ChangeEventPayload`](ChangeEventPayload.md)',
      '**Returns**',
      '`void`',
    ),
  );
});

await test("labels a TypeScript function or variable page's own headings, keeping the ids TypeDoc links to", async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript/functions'), { recursive: true });
  mkdirSync(join(root, 'docs/reference/typescript/variables'));
  writeFileSync(
    join(root, 'docs/reference/typescript/functions/greet.md'),
    markdown(
      '# Function: greet()',
      '> **greet**\\<`T`\\>(`name`, `options?`): `object`',
      '## Type Parameters',
      '### T',
      '`T` *extends* `string`',
      '## Parameters',
      '### name',
      '`T`',
      '### options?',
      '#### loud?',
      '`boolean`',
      '## Returns',
      '`object`',
      '### text',
      '> **text**: `string`',
      '## Throws',
      'When `name` is empty.',
      '## Example',
      '```md\n## Usage\n```',
    ),
  );
  writeFileSync(
    join(root, 'docs/reference/typescript/variables/config.md'),
    markdown(
      '# Variable: config',
      '> `const` **config**: `object`',
      '## Type Declaration',
      '### a',
      '> **a**: `string`',
      '### nested',
      '> **nested**: `object`',
      '#### nested.deep',
      '> **deep**: `boolean`',
    ),
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/typescript/functions/greet.md'), 'utf8'),
    markdown(
      '# Function: greet()',
      '> **greet**\\<`T`\\>(`name`, `options?`): `object`',
      '**Type Parameters**',
      '**`T`**{ #t }',
      '`T` *extends* `string`',
      '**Parameters**',
      '**`name`**',
      '`T`',
      '**`options?`**',
      '**`loud?`**',
      '`boolean`',
      '**Returns**',
      '`object`',
      '**`text`**',
      '> **text**: `string`',
      '**Throws**',
      'When `name` is empty.',
      '**Example**',
      '```md\n## Usage\n```',
    ),
  );
  assert.equal(
    readFileSync(join(out, 'docs/typescript/variables/config.md'), 'utf8'),
    markdown(
      '# Variable: config',
      '> `const` **config**: `object`',
      '**Type Declaration**',
      '**`a`**{ #a }',
      '> **a**: `string`',
      '**`nested`**{ #nested }',
      '> **nested**: `object`',
      '**`nested.deep`**',
      '> **deep**: `boolean`',
    ),
  );
});

await test('keeps the headings of TypeScript constructors, accessors and enum members named like a section', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript/classes'), { recursive: true });
  mkdirSync(join(root, 'docs/reference/typescript/enumerations'));
  writeFileSync(
    join(root, 'docs/reference/typescript/classes/Greeter.md'),
    markdown(
      '# Class: Greeter',
      '## Constructors',
      '### Constructor',
      '> **new Greeter**(`x`): `Greeter`',
      '#### Parameters',
      '##### x',
      '`string`',
      '#### Returns',
      '`Greeter`',
      '## Accessors',
      '### size',
      '#### Get Signature',
      '> **get** **size**(): `number`',
      '##### Returns',
      '`number`',
    ),
  );
  const enumPage = (example: string, returns: string) =>
    markdown(
      '# Enumeration: Section',
      '## Enumeration Members',
      example,
      '> **Example**: `"example"`',
      '***',
      returns,
      '> **Returns**: `"returns"`',
    );
  writeFileSync(
    join(root, 'docs/reference/typescript/enumerations/Section.md'),
    enumPage('### Example', '### Returns'),
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/typescript/classes/Greeter.md'), 'utf8'),
    markdown(
      '# Class: Greeter',
      '## Constructors',
      '### Constructor { #constructor }',
      '> **new Greeter**(`x`): `Greeter`',
      '**Parameters**',
      '**`x`**',
      '`string`',
      '**Returns**',
      '`Greeter`',
      '## Accessors',
      '### size { #size }',
      '**Get Signature**',
      '> **get** **size**(): `number`',
      '**Returns**',
      '`number`',
    ),
  );
  assert.equal(
    readFileSync(join(out, 'docs/typescript/enumerations/Section.md'), 'utf8'),
    enumPage('### Example { #example }', '### Returns { #returns }'),
  );
});

await test('gives a repeated TypeScript heading the id TypeDoc links to, `a-1`', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript/classes'), { recursive: true });
  mkdirSync(join(root, 'docs/reference/typescript/type-aliases'));
  // typedoc-plugin-markdown 4.14.1's pages, less their Defined in lines, for a class with a static and an instance
  // create(), and a type alias with a type parameter T and a property t
  const store = (...ids: string[]) =>
    markdown(
      '# Class: Store',
      'See [the static create](#create-2) and [step-1](#step-1).',
      '## Properties',
      `### step-1${ids[0]}`,
      '> **step-1**: `number` = `1`',
      '## Methods',
      `### create()${ids[1]}`,
      '> **create**(): `Store`',
      '***',
      `### create-1()${ids[2]}`,
      '> **create-1**(): `void`',
      '***',
      `### create()${ids[3]}`,
      '> `static` **create**(): `Store`',
    );
  writeFileSync(join(root, 'docs/reference/typescript/classes/Store.md'), store('', '', '', ''));
  writeFileSync(
    join(root, 'docs/reference/typescript/type-aliases/Pair.md'),
    markdown(
      '# Type Alias: Pair\\<T\\>',
      '> **Pair**\\<`T`\\> = `object`',
      'See [Pair.t](#t-1).',
      '## Type Parameters',
      '### T',
      '`T`',
      '## Properties',
      '### t',
      '> **t**: `T`',
    ),
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/typescript/classes/Store.md'), 'utf8'),
    store(' { #step-1 }', ' { #create }', ' { #create-1 }', ' { #create-2 }'),
  );
  assert.equal(
    readFileSync(join(out, 'docs/typescript/type-aliases/Pair.md'), 'utf8'),
    markdown(
      '# Type Alias: Pair\\<T\\>',
      '> **Pair**\\<`T`\\> = `object`',
      'See [Pair.t](#t-1).',
      '**Type Parameters**',
      '**`T`**{ #t }',
      '`T`',
      '## Properties',
      '### t { #t-1 }',
      '> **t**: `T`',
    ),
  );
});

await test("numbers TypeScript ids as TypeDoc does, counting a method's type parameters but no group heading", async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript/classes'), { recursive: true });
  mkdirSync(join(root, 'docs/reference/typescript/interfaces'));
  // typedoc-plugin-markdown 4.14.1's pages, less their Parameters and Returns, for a class with methods map<T>(),
  // get<Value>(), t() and value(), and an interface with a property named properties
  writeFileSync(
    join(root, 'docs/reference/typescript/classes/Store.md'),
    markdown(
      '# Class: Store',
      'See [Store.t](#t-1) and [Store.value](#value-1).',
      '## Methods',
      '### get()',
      '> **get**\\<`Value`\\>(`key`): `Value` \\| `undefined`',
      '#### Type Parameters',
      '##### Value',
      '`Value`',
      '***',
      '### map()',
      '> **map**\\<`T`\\>(`f`): `T`',
      '#### Type Parameters',
      '##### T',
      '`T`',
      '***',
      '### t()',
      '> **t**(`key`): `string`',
      '***',
      '### value()',
      '> **value**(): `number`',
    ),
  );
  const props = (heading: string) =>
    markdown(
      '# Interface: Props',
      'See [Props.properties](#properties).',
      '## Properties',
      heading,
      '> **properties**: `string`',
    );
  writeFileSync(join(root, 'docs/reference/typescript/interfaces/Props.md'), props('### properties'));
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/typescript/classes/Store.md'), 'utf8'),
    markdown(
      '# Class: Store',
      'See [Store.t](#t-1) and [Store.value](#value-1).',
      '## Methods',
      '### get() { #get }',
      '> **get**\\<`Value`\\>(`key`): `Value` \\| `undefined`',
      '**Type Parameters**',
      '**`Value`**{ #value }',
      '`Value`',
      '***',
      '### map() { #map }',
      '> **map**\\<`T`\\>(`f`): `T`',
      '**Type Parameters**',
      '**`T`**{ #t }',
      '`T`',
      '***',
      '### t() { #t-1 }',
      '> **t**(`key`): `string`',
      '***',
      '### value() { #value-1 }',
      '> **value**(): `number`',
    ),
  );
  // Python-Markdown gives the group heading another id, `properties_1`
  assert.equal(
    readFileSync(join(out, 'docs/typescript/interfaces/Props.md'), 'utf8'),
    props('### properties { #properties }'),
  );
});

await test('gives TypeScript names with an accent the ids TypeDoc links to, `café` apart from `cafe`', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript/classes'), { recursive: true });
  const page = (property: string, method: string) =>
    markdown(
      '# Class: Menu',
      'See [Menu.café](#café) and [Menu.cafe](#cafe).',
      '## Properties',
      property,
      '> **café**: `number`',
      '## Methods',
      method,
      '> **cafe**(): `void`',
    );
  writeFileSync(join(root, 'docs/reference/typescript/classes/Menu.md'), page('### café', '### cafe()'));
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/typescript/classes/Menu.md'), 'utf8'),
    page('### café { #café }', '### cafe() { #cafe }'),
  );
});

await test('counts the TypeScript signatures TypeDoc anchors without a heading of their own', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript/classes'), { recursive: true });
  mkdirSync(join(root, 'docs/reference/typescript/interfaces'));
  mkdirSync(join(root, 'docs/reference/typescript/functions'));
  // typedoc-plugin-markdown 4.14.1's pages, less their comments, Parameters and Returns: a function t<T>(), an
  // interface Calls with two call signatures and a property calls, and classes whose members are named like what
  // TypeDoc names the signatures of a constructor, an accessor and an index signature
  writeFileSync(
    join(root, 'docs/reference/typescript/functions/t.md'),
    markdown('# Function: t()', '> **t**\\<`T`\\>(`x`): `T`', '## Type Parameters', '### T', '`T`'),
  );
  writeFileSync(
    join(root, 'docs/reference/typescript/interfaces/Calls.md'),
    markdown(
      '# Interface: Calls()',
      '## Call Signature',
      '> **Calls**(`x`): `string`',
      '## Call Signature',
      '> **Calls**\\<`T`\\>(`x`): `T`',
      '### Type Parameters',
      '#### T',
      '`T`',
      '## Properties',
      '### calls',
      '> **calls**: `number`',
    ),
  );
  writeFileSync(
    join(root, 'docs/reference/typescript/classes/Foo.md'),
    markdown(
      '# Class: Foo\\<T\\>',
      '## Type Parameters',
      '### T',
      '`T`',
      '## Constructors',
      '### Constructor',
      '> **new Foo**\\<`T`\\>(): `Foo`\\<`T`\\>',
      '## Properties',
      '### constructorfoot',
      '> **constructorfoot**: `number` = `2`',
      '## Accessors',
      '### size',
      '#### Get Signature',
      '> **get** **size**(): `T` \\| `undefined`',
      '#### Set Signature',
      '> **set** **size**(`v`): `void`',
      '## Methods',
      '### sizesize()',
      '> **sizesize**(): `void`',
    ),
  );
  writeFileSync(
    join(root, 'docs/reference/typescript/classes/Idx.md'),
    markdown(
      '# Class: Idx',
      'See [Idx.\\_\\_index](#__index-1).',
      '## Indexable',
      '> \\[`key`: `string`\\]: `unknown`',
      '## Properties',
      '### \\_\\_index',
      '> **\\_\\_index**: `number` = `1`',
    ),
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  const read = (page: string) => readFileSync(join(out, 'docs/typescript', page), 'utf8');
  assert.match(read('functions/t.md'), /^\*\*`T`\*\*\{ #t-1 \}$/m);
  assert.match(read('interfaces/Calls.md'), /^\*\*`T`\*\*\{ #t \}\n[\s\S]*^### calls \{ #calls-2 \}$/m);
  assert.match(
    read('classes/Foo.md'),
    /^### constructorfoot \{ #constructorfoot-1 \}\n[\s\S]*^### sizesize\(\) \{ #sizesize-2 \}$/m,
  );
  assert.match(read('classes/Idx.md'), /^### \\_\\_index \{ #__index-1 \}$/m);
});

await test('gives TypeScript type parameters and type declaration members ids only where TypeDoc anchors them', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript/variables'), { recursive: true });
  mkdirSync(join(root, 'docs/reference/typescript/interfaces'));
  mkdirSync(join(root, 'docs/reference/typescript/type-aliases'));
  // typedoc-plugin-markdown 4.14.1's pages, less their comments, Parameters and Returns: a variable of a function
  // type, one of an object type, an interface with a property of a function type, and an intersection type alias
  writeFileSync(
    join(root, 'docs/reference/typescript/variables/handler.md'),
    markdown(
      '# Variable: handler',
      '> `const` **handler**: \\<`H`\\>(`h`) => `void`',
      '## Type Parameters',
      '### H',
      '`H`',
    ),
  );
  writeFileSync(
    join(root, 'docs/reference/typescript/variables/obj.md'),
    markdown(
      '# Variable: obj',
      '> `const` **obj**: `object`',
      '## Type Declaration',
      '### g',
      '#### Get Signature',
      '> **get** **g**(): `number`',
      '### m()',
      '> **m**\\<`N`\\>(`n`): `N`',
      '#### Type Parameters',
      '##### N',
      '`N`',
    ),
  );
  writeFileSync(
    join(root, 'docs/reference/typescript/interfaces/Fns.md'),
    markdown(
      '# Interface: Fns',
      '## Properties',
      '### on',
      '> **on**: \\<`E`\\>(`e`) => `void`',
      '#### Type Parameters',
      '##### E',
      '`E`',
    ),
  );
  writeFileSync(
    join(root, 'docs/reference/typescript/type-aliases/I.md'),
    markdown(
      '# Type Alias: I',
      '> **I** = [`Ext`](../interfaces/Ext.md) & `object`',
      '## Type Declaration',
      '### b',
      '> **b**: `string`',
    ),
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  const read = (page: string) => readFileSync(join(out, 'docs/typescript', page), 'utf8');
  assert.match(read('variables/handler.md'), /^\*\*`H`\*\*\{ #__typeh \}$/m);
  assert.match(
    read('variables/obj.md'),
    /^\*\*`g`\*\*\{ #g \}\n[\s\S]*^\*\*`m\(\)`\*\*\{ #m \}\n[\s\S]*^\*\*`N`\*\*\{ #mn \}$/m,
  );
  assert.match(read('interfaces/Fns.md'), /^### on \{ #on \}\n[\s\S]*^\*\*`E`\*\*$/m);
  assert.match(read('type-aliases/I.md'), /^\*\*`b`\*\*$/m);
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
    '# E\n\n## Entries { data-search-exclude }\n\n| Name | Summary |\n|---|---|\n| [A](-a/index.md) | The first. |\n' +
      '| [B](-b/index.md) | |\n| [C](-c/index.md) | [C](-c/index.md)(0xFF0000)<br> With an argument. |\n\n## Properties\n',
  );
});

await test("keeps the README's and guides' images and links to other repo files working", async () => {
  const root = library();
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-lib', repository: 'github:me/my-lib' }));
  mkdirSync(join(root, '.git'));
  mkdirSync(join(root, 'assets'));
  mkdirSync(join(root, 'example'));
  mkdirSync(join(root, 'guides/images'));
  for (const f of ['LICENSE', 'CONTRIBUTING.md', 'assets/logo.png', 'assets/shot one.png', 'assets/in-code.png']) {
    writeFileSync(join(root, f), '');
  }
  writeFileSync(join(root, 'guides/images/x.png'), '');
  const readme = (blob: string, tree: string) =>
    '# my-lib\n\n<p align="center">\n  <img alt="logo" src="assets/logo.png" width="200">\n</p>\n\n' +
    '![shot](<assets/shot one.png> "A shot") ![again](assets/shot%20one.png)\n\n' +
    `[![logo](assets/logo.png)](${blob}LICENSE), [\`CONTRIBUTING\`](${blob}CONTRIBUTING.md#setup "How to help"), ` +
    `the <a class="x" href='${tree}'>example</a>, [lic], ![ref][logo]\n\n` +
    '[Guide](guides/a.md), [web](https://x.dev/LICENSE), [mail](mailto:me@x.dev), [anchor](#usage), ' +
    '[root](/LICENSE), [gone](MISSING.md), `[code](LICENSE)`, `` ![code](assets/in-code.png) ``\n\n' +
    '1. Install\n\n    ```md\n    [x](LICENSE) ![x](assets/in-code.png)\n    ```\n\n' +
    `[lic]: <${blob}LICENSE> "The license"\n[logo]: ./assets/logo.png\n`;
  writeFileSync(join(root, 'README.md'), readme('', './example'));
  writeFileSync(
    join(root, 'guides/a.md'),
    '# A\n\n[Home](../README.md), [license](../LICENSE#mit), ![logo](../assets/logo.png), ![x](images/x.png)\n',
  );
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  const web = 'https://github.com/me/my-lib';
  assert.equal(
    readFileSync(join(out, 'docs/README.md'), 'utf8'),
    readme(`${web}/blob/HEAD/`, `${web}/tree/HEAD/example`),
  );
  assert.equal(
    readFileSync(join(out, 'docs/guides/a.md'), 'utf8'),
    `# A\n\n[Home](../README.md), [license](${web}/blob/HEAD/LICENSE#mit), ![logo](../assets/logo.png), ![x](images/x.png)\n`,
  );
  assert.ok(existsSync(join(out, 'docs/assets/logo.png')));
  assert.ok(existsSync(join(out, 'docs/assets/shot one.png')));
  assert.ok(!existsSync(join(out, 'docs/assets/in-code.png')), 'images in code stay out');
});

await test("points a monorepo library's links to its folder in the repository, and images outside it to the repo", async () => {
  const repo = join(mkdtempSync(join(tmpdir(), 'mono-')), 'repo');
  const root = join(repo, 'packages/lib');
  mkdirSync(join(root, 'docs/reference/kotlin'), { recursive: true });
  mkdirSync(join(repo, 'assets'));
  for (const f of ['../outside.md', 'LICENSE', 'assets/logo.png', 'packages/lib/LICENSE']) {
    writeFileSync(join(repo, f), '');
  }
  writeFileSync(join(root, 'docs/reference/kotlin/index.md'), '# lib');
  writeFileSync(
    join(root, 'README.md'),
    '# lib\n\n[License](LICENSE), [repo license](../../LICENSE), ![logo](../../assets/logo.png), [out](../../../outside.md)',
  );
  const web = 'https://github.com/me/mono';
  const expected =
    `# lib\n\n[License](${web}/blob/HEAD/packages/lib/LICENSE), [repo license](${web}/blob/HEAD/LICENSE), ` +
    `![logo](${web}/raw/HEAD/assets/logo.png), [out](../../../outside.md)`;
  const pkg = { name: 'lib', repository: { url: `git+${web}.git`, directory: 'packages/lib' } };
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg));
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(readFileSync(join(out, 'docs/README.md'), 'utf8'), expected);

  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'lib', repository: web }));
  mkdirSync(join(repo, '.git'));
  await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(readFileSync(join(out, 'docs/README.md'), 'utf8'), expected, 'the repo root from .git');
});

await test('copies images without a repository URL, and leaves other links as they are', async () => {
  const root = library();
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'assets/logo.png'), '');
  writeFileSync(join(root, 'LICENSE'), '');
  writeFileSync(join(root, 'README.md'), '# my-lib\n\n![logo](assets/logo.png) [License](LICENSE)');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(
    readFileSync(join(out, 'docs/README.md'), 'utf8'),
    '# my-lib\n\n![logo](assets/logo.png) [License](LICENSE)',
  );
  assert.ok(existsSync(join(out, 'docs/assets/logo.png')));
});

await test("doesn't copy an image over the site's own files, and links to Bitbucket's src/ pages", async () => {
  const root = library();
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-lib', repository: 'bitbucket:me/my-lib' }));
  mkdirSync(join(root, '.git'));
  mkdirSync(join(root, 'kotlin'));
  writeFileSync(join(root, 'kotlin/shot.png'), '');
  writeFileSync(join(root, 'LICENSE'), '');
  writeFileSync(join(root, 'README.md'), '# my-lib\n\n![shot](kotlin/shot.png) [License](LICENSE)');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  const web = 'https://bitbucket.org/me/my-lib';
  assert.equal(
    readFileSync(join(out, 'docs/README.md'), 'utf8'),
    `# my-lib\n\n![shot](${web}/raw/HEAD/kotlin/shot.png) [License](${web}/src/HEAD/LICENSE)`,
  );
  assert.ok(!existsSync(join(out, 'docs/kotlin/shot.png')));
  assert.equal(readFileSync(join(out, 'docs/kotlin/index.md'), 'utf8'), '# my-lib');
});

await test("points links into the reference to the site's pages, and to the repo for a page the site leaves out", async () => {
  const root = library();
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-lib', repository: 'github:me/my-lib' }));
  mkdirSync(join(root, '.git'));
  mkdirSync(join(root, 'docs/reference/kotlin/lib/com.example'), { recursive: true });
  writeFileSync(join(root, 'docs/reference/kotlin/lib/com.example/index.md'), '# Package-level declarations');
  mkdirSync(join(root, 'docs/reference/typescript/functions'), { recursive: true });
  mkdirSync(join(root, 'docs/reference/typescript/_media'));
  writeFileSync(join(root, 'docs/reference/typescript/README.md'), '# API');
  writeFileSync(join(root, 'docs/reference/typescript/functions/greet it.md'), '# greet');
  writeFileSync(join(root, 'docs/reference/typescript/_media/shot.png'), '');
  writeFileSync(join(root, 'docs/reference/notes.md'), '');
  writeFileSync(
    join(root, 'README.md'),
    '# my-lib\n\n[API](docs/reference/typescript/README.md), ' +
      '[greet](./docs/reference/typescript/functions/greet%20it.md#returns "Greet"), ' +
      '![shot](docs/reference/typescript/_media/shot.png), [package](docs/reference/kotlin/lib/com.example/index.md), ' +
      '[Kotlin](docs/reference/kotlin/index.md), [TypeScript](docs/reference/typescript), [notes](docs/reference/notes.md)\n',
  );
  writeFileSync(join(root, 'guides/a.md'), '# A\n\n[API](../docs/reference/typescript/README.md#usage)\n');
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  const web = 'https://github.com/me/my-lib';
  assert.equal(
    readFileSync(join(out, 'docs/README.md'), 'utf8'),
    '# my-lib\n\n[API](typescript/README.md), [greet](typescript/functions/greet%20it.md#returns "Greet"), ' +
      '![shot](typescript/_media/shot.png), [package](kotlin/lib/com.example/index.md), ' +
      `[Kotlin](${web}/blob/HEAD/docs/reference/kotlin/index.md), [TypeScript](${web}/tree/HEAD/docs/reference/typescript), ` +
      `[notes](${web}/blob/HEAD/docs/reference/notes.md)\n`,
  );
  assert.equal(readFileSync(join(out, 'docs/guides/a.md'), 'utf8'), '# A\n\n[API](../typescript/README.md#usage)\n');
  assert.ok(!existsSync(join(out, 'docs/docs')), 'no copy of the reference image');
});

await test("copies the srcset images of an <img> and a <picture>'s <source>, such as a dark-mode logo", async () => {
  const root = library();
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-lib', repository: 'github:me/my-lib' }));
  mkdirSync(join(root, '.git'));
  mkdirSync(join(root, 'kotlin'));
  for (const f of ['docs/light.png', 'docs/dark.png', 'docs/a,b.png', 'docs/wide.png', 'kotlin/dark.png']) {
    writeFileSync(join(root, f), '');
  }
  const readme = (raw: string) =>
    '# my-lib\n\n<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="docs/dark.png">\n' +
    '  <img alt="logo" src="docs/light.png">\n</picture>\n\n' +
    `<IMG SrcSet='docs/a,b.png, ${raw}kotlin/dark.png 2x,docs/wide.png 640w,https://x.dev/c.png 1x' src=docs/light.png>\n`;
  writeFileSync(join(root, 'README.md'), readme(''));
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(readFileSync(join(out, 'docs/README.md'), 'utf8'), readme('https://github.com/me/my-lib/raw/HEAD/'));
  for (const f of ['light.png', 'dark.png', 'a,b.png', 'wide.png']) assert.ok(existsSync(join(out, 'docs/docs', f)), f);
});

await test('leaves links in indented code as they are, but not in text indented under a list item', async () => {
  const root = library();
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-lib', repository: 'github:me/my-lib' }));
  mkdirSync(join(root, '.git'));
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'LICENSE'), '');
  writeFileSync(join(root, 'assets/in-code.png'), '');
  const readme = (blob: string) =>
    [
      '# my-lib',
      '',
      '    [License](LICENSE) ![x](assets/in-code.png)',
      '',
      '\t[License](LICENSE)',
      '',
      'Text',
      `    [License](${blob}LICENSE), the paragraph's`,
      '',
      '## Install',
      '    [License](LICENSE)',
      '',
      '1. Step',
      '',
      `    [License](${blob}LICENSE), the item's`,
      '',
      '    - Nested',
      '',
      '          [License](LICENSE)',
      '',
      `        [License](${blob}LICENSE), the nested item's`,
      '',
      '-   Wide',
      '',
      '        [License](LICENSE)',
      '',
      `    [License](${blob}LICENSE), the wide item's`,
      '',
      'Back at the top.',
      '',
      '    ```',
      '    [License](LICENSE), after a fence that code leaves open',
      '',
      `[License](${blob}LICENSE)`,
      '',
      '```js',
      'x',
      '',
      '    [License](LICENSE)',
      '```',
      '',
      `[License](${blob}LICENSE)`,
      '',
    ].join('\n');
  writeFileSync(join(root, 'README.md'), readme(''));
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.equal(readFileSync(join(out, 'docs/README.md'), 'utf8'), readme('https://github.com/me/my-lib/blob/HEAD/'));
  assert.ok(!existsSync(join(out, 'docs/assets/in-code.png')), 'images in code stay out');
});
