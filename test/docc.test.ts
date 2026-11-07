import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { exportArchive, findArchive, pageFiles, rewriteLinks } from '../src/docc.ts';
import { brokenLinks } from './links.ts';

const archive = new URL('fixtures/Fixture.doccarchive', import.meta.url).pathname;

void test('exportArchive copies pages and images with every link resolving in the tree', async (t) => {
  const out = await mkdtemp(join(tmpdir(), 'docc-test-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  await exportArchive(archive, 'Fixture', out);

  assert.deepEqual(await brokenLinks(out), []);
  assert.ok(!existsSync(join(out, 'Fixture-markdown-manifest.json')));
  assert.ok(existsSync(join(out, 'images/org.cocoapods.Fixture/probe.png')));
  assert.ok(!existsSync(join(out, 'documentation/fixture/thing.json')));
  assert.equal(
    await readFile(join(out, 'documentation/fixture/index.md'), 'utf8'),
    `# Fixture

A [\`Thing\`](<./thing/index.md>) whose [\`run(_:)\`](<./thing/run(_:)-8uxly.md>) compares with [\`!=(_:_:)\`](<./thing/!=(_:_:).md>), see the [Guide](<./guide.md#section>).
It is a \`BaseModule\`.

![A probe](<../../images/org.cocoapods.Fixture/probe.png>)`,
  );
  assert.equal(
    await readFile(join(out, 'documentation/fixture/thing/index.md'), 'utf8'),
    `# Thing

In [\`Fixture\`](<../index.md>), [\`run(_:)\`](<./run(_:)-8upfu.md>), [\`??(_:_:)\`](<./''(_:_:).md>) and [\`...(_:_:)\`](<./'...(_:_:).md>).`,
  );
  assert.match(
    await readFile(join(out, "documentation/fixture/thing/'...(_:_:).md"), 'utf8'),
    /^# \.\.\.\(\\_:\\_:\)$/m,
  );
  assert.match(await readFile(join(out, 'documentation/fixture/thing/run(_:)-8uxly.md'), 'utf8'), /^# run\(\\_:\)$/m);
});

void test('exportArchive keeps a page without metadata that DocC wrote under another name at its path, unlinked', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'docc-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const copy = join(dir, 'Fixture.doccarchive');
  await cp(archive, copy, { recursive: true });
  // as DocC shortens a very long name with a hash
  await rename(
    join(copy, 'data/documentation/fixture/guide.md'),
    join(copy, 'data/documentation/fixture/guide-1a2b3.md'),
  );
  await exportArchive(copy, 'Fixture', join(dir, 'out'));

  assert.deepEqual(await brokenLinks(join(dir, 'out')), []);
  assert.match(await readFile(join(dir, 'out/documentation/fixture/guide-1a2b3.md'), 'utf8'), /^# Guide$/m);
  assert.match(await readFile(join(dir, 'out/documentation/fixture/index.md'), 'utf8'), /, see the Guide\.$/m);
  assert.ok(existsSync(join(dir, 'out/documentation/fixture/thing/index.md')));
});

void test('exportArchive keeps the name DocC shortened a page to, and links to it by the identifier in its metadata', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'docc-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const copy = join(dir, 'Fixture.doccarchive');
  await cp(archive, copy, { recursive: true });
  const name = `configure(${'withAVeryLongArgumentLabel:'.repeat(10)})`;
  const id = `/documentation/Fixture/Thing/${name}`;
  // DocC shortens a name of 240 characters or more to its first 240 and a hash of it all
  const short = `${name.toLowerCase().slice(0, 240)}-1a2b3`;
  const metadata = JSON.stringify({ documentType: 'symbol', identifier: id, title: name }, null, 2);
  await writeFile(
    join(copy, `data/documentation/fixture/thing/${short}.md`),
    `<!--\n${metadata}\n-->\n\n# ${name}\n\nBack to [\`Thing\`](/documentation/Fixture/Thing).`,
  );
  const manifest = join(copy, 'Fixture-markdown-manifest.json');
  const { documents, ...rest } = JSON.parse(await readFile(manifest, 'utf8')) as { documents: object[] };
  await writeFile(manifest, JSON.stringify({ documents: [...documents, { identifier: id, title: name }], ...rest }));
  const thing = join(copy, 'data/documentation/fixture/thing.md');
  await writeFile(thing, `${await readFile(thing, 'utf8')}\nSee [\`${name}\`](${id}).`);
  await exportArchive(copy, 'Fixture', join(dir, 'out'));

  assert.deepEqual(await brokenLinks(join(dir, 'out')), []);
  const index = await readFile(join(dir, 'out/documentation/fixture/thing/index.md'), 'utf8');
  assert.ok(index.endsWith(`\nSee [\`${name}\`](<./${short}.md>).`));
  assert.match(
    await readFile(join(dir, `out/documentation/fixture/thing/${short}.md`), 'utf8'),
    /^Back to \[`Thing`\]\(<\.\/index\.md>\)\.$/m,
  );
});

void test('the link check catches DocC links left as written', async () => {
  assert.equal((await brokenLinks(join(archive, 'data'))).length, 14);
});

void test('findArchive returns the one .doccarchive in a directory and rejects any other count', async (t) => {
  const fixtures = new URL('fixtures', import.meta.url).pathname;
  assert.equal(await findArchive(fixtures), archive);
  await assert.rejects(findArchive(join(fixtures, 'none')), /Expected one \.doccarchive in .*, found 0/);
  const two = await mkdtemp(join(tmpdir(), 'docc-test-'));
  t.after(() => rm(two, { recursive: true, force: true }));
  await Promise.all(['a.doccarchive', 'b.doccarchive'].map((d) => mkdir(join(two, d))));
  await assert.rejects(findArchive(two), /found 2/);
});

void test('rewriteLinks encodes operator characters, points fragments at heading ids, allows brackets in the link text and resolves doc:// spans', () => {
  const pages = pageFiles([
    '/documentation/M/T',
    '/documentation/M/T/<(_:_:)',
    '/documentation/M/T/%(_:_:)',
    '/documentation/M/T/subscript(_:)',
  ]);
  const md = [
    '[`<(_:_:)`](/documentation/M/T/<(_:_:))',
    '[`%(_:_:)`](/documentation/M/T/%(_:_:))',
    '[T](/documentation/M/T#Overview)',
    '[T](/documentation/M/T#Getting-Started)',
    '[T](/documentation/M/T#🚀-C++-and-Café)',
    '[gone](/documentation/M/T/gone#Overview)',
    '[`subscript(_:) -> [Int]`](/documentation/M/T/subscript(_:))',
    '> Note: Calls ``doc://org.cocoapods.M/documentation/M/T/<(_:_:)``, not ``doc://org.cocoapods.M/documentation/M/T/run(_:)-8uxly``.',
  ].join('\n');
  assert.equal(
    rewriteLinks(md, 'documentation/m.md', pages),
    [
      '[`<(_:_:)`](<./m/t/%3C(_:_:).md>)',
      '[`%(_:_:)`](<./m/t/%25(_:_:).md>)',
      '[T](<./m/t/index.md#overview>)',
      '[T](<./m/t/index.md#getting-started>)',
      '[T](<./m/t/index.md#c-and-cafe>)',
      'gone',
      '[`subscript(_:) -> [Int]`](<./m/t/subscript(_:).md>)',
      '> Note: Calls [`<(_:_:)`](<./m/t/%3C(_:_:).md>), not `run(_:)`.',
    ].join('\n'),
  );
});

void test('pageFiles puts a page with child pages at <id>/index.md, and any other page named index at --index--.md', () => {
  assert.deepEqual(
    pageFiles([
      '/documentation/M',
      '/documentation/M/T',
      '/documentation/M/T/f()',
      '/documentation/M/U',
      '/documentation/M/U/Index',
      '/documentation/M/U/index-1abcd',
      '/documentation/M/V',
      '/documentation/M/V/Index',
      '/documentation/M/V/Index/f()',
    ]),
    new Map([
      ['/documentation/m', 'documentation/m/index.md'],
      ['/documentation/m/t', 'documentation/m/t/index.md'],
      ['/documentation/m/t/f()', 'documentation/m/t/f().md'],
      ['/documentation/m/u', 'documentation/m/u/index.md'],
      ['/documentation/m/u/index', 'documentation/m/u/--index--.md'],
      ['/documentation/m/u/index-1abcd', 'documentation/m/u/index-1abcd.md'],
      ['/documentation/m/v', 'documentation/m/v/index.md'],
      ['/documentation/m/v/index', 'documentation/m/v/index/index.md'],
      ['/documentation/m/v/index/f()', 'documentation/m/v/index/f().md'],
    ]),
  );
});

void test("pageFiles puts a ' before a name starting with . and in place of ?, so the site serves the page", () => {
  assert.deepEqual(
    pageFiles([
      '/documentation/M/T/...(_:_:)',
      '/documentation/M/T/..<(_:)',
      '/documentation/M/T/??(_:_:)',
      '/documentation/M/T/__(_:_:)',
      '/documentation/M/T/-(_:_:)',
      '/documentation/M/T/--(_:)',
      '/documentation/M/T/Mode-swift.enum',
    ]),
    new Map([
      ['/documentation/m/t/...(_:_:)', "documentation/m/t/'...(_:_:).md"],
      ['/documentation/m/t/..<(_:)', "documentation/m/t/'..<(_:).md"],
      ['/documentation/m/t/??(_:_:)', "documentation/m/t/''(_:_:).md"],
      ['/documentation/m/t/__(_:_:)', 'documentation/m/t/__(_:_:).md'],
      ['/documentation/m/t/-(_:_:)', 'documentation/m/t/-(_:_:).md'],
      ['/documentation/m/t/--(_:)', 'documentation/m/t/--(_:).md'],
      ['/documentation/m/t/mode-swift.enum', 'documentation/m/t/mode-swift.enum.md'],
    ]),
  );
});
