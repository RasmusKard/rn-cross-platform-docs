import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { exportArchive, findArchive, pageFiles, rewriteLinks } from '../src/swift.ts';
import { brokenLinks } from './links.ts';

const archive = new URL('fixtures/Fixture.doccarchive', import.meta.url).pathname;

void test('exportArchive copies pages and images with every link resolving in the tree', async (t) => {
  const out = await mkdtemp(join(tmpdir(), 'swift-test-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  await exportArchive(archive, 'Fixture', out);

  assert.deepEqual(await brokenLinks(out), []);
  assert.ok(!existsSync(join(out, 'Fixture-markdown-manifest.json')));
  assert.ok(existsSync(join(out, 'images/org.cocoapods.Fixture/probe.png')));
  assert.ok(!existsSync(join(out, 'documentation/fixture/thing.json')));
  assert.equal(
    await readFile(join(out, 'documentation/fixture/index.md'), 'utf8'),
    `# Fixture

A [\`Thing\`](<./thing/index.md>) whose [\`run(_:)\`](<./thing/run(_:)-8uxly.md>) compares with [\`!=(_:_:)\`](<./thing/!=(_:_:).md>), see the [Guide](<./guide.md#Section>).
It is a \`BaseModule\`.

![A probe](<../../images/org.cocoapods.Fixture/probe.png>)`,
  );
  assert.match(await readFile(join(out, 'documentation/fixture/thing/index.md'), 'utf8'), /\(<\.\/%3F%3F\(_:_:\)\.md>\)/);
  assert.match(await readFile(join(out, 'documentation/fixture/thing/run(_:)-8uxly.md'), 'utf8'), /^# run\(\\_:\)$/m);
  assert.match(
    await readFile(join(out, 'documentation/fixture/guide.md'), 'utf8'),
    /\n```swift\nlet x = 1\n```\n\n```js\nx\(\)\n```\n\n```swift\ny\(\)\n```\n$/,
  );
});

void test('the link check catches DocC links left as written', async () => {
  assert.equal((await brokenLinks(join(archive, 'data'))).length, 13);
});

void test('findArchive returns the one .doccarchive in a directory and rejects any other count', async (t) => {
  const fixtures = new URL('fixtures', import.meta.url).pathname;
  assert.equal(await findArchive(fixtures), archive);
  await assert.rejects(findArchive(join(fixtures, 'none')), /Expected one \.doccarchive in .*, found 0/);
  const two = await mkdtemp(join(tmpdir(), 'swift-test-'));
  t.after(() => rm(two, { recursive: true, force: true }));
  await Promise.all(['a.doccarchive', 'b.doccarchive'].map((d) => mkdir(join(two, d))));
  await assert.rejects(findArchive(two), /found 2/);
});

void test('rewriteLinks encodes operator characters, keeps fragments, allows brackets in the link text and resolves doc:// spans', () => {
  const pages = pageFiles(['/documentation/M/T', '/documentation/M/T/<(_:_:)', '/documentation/M/T/%(_:_:)', '/documentation/M/T/subscript(_:)']);
  const md = [
    '[`<(_:_:)`](/documentation/M/T/<(_:_:))',
    '[`%(_:_:)`](/documentation/M/T/%(_:_:))',
    '[T](/documentation/M/T#Overview)',
    '[gone](/documentation/M/T/gone#Overview)',
    '[`subscript(_:) -> [Int]`](/documentation/M/T/subscript(_:))',
    '> Note: Calls ``doc://org.cocoapods.M/documentation/M/T/<(_:_:)``, not ``doc://org.cocoapods.M/documentation/M/T/run(_:)-8uxly``.',
  ].join('\n');
  assert.equal(
    rewriteLinks(md, 'documentation/m.md', pages),
    [
      '[`<(_:_:)`](<./m/t/%3C(_:_:).md>)',
      '[`%(_:_:)`](<./m/t/%25(_:_:).md>)',
      '[T](<./m/t/index.md#Overview>)',
      'gone',
      '[`subscript(_:) -> [Int]`](<./m/t/subscript(_:).md>)',
      '> Note: Calls [`<(_:_:)`](<./m/t/%3C(_:_:).md>), not `run(_:)`.',
    ].join('\n'),
  );
});

void test('pageFiles puts a page with child pages at <id>/index.md, unless it has a member named index', () => {
  assert.deepEqual(
    pageFiles(['/documentation/M', '/documentation/M/T', '/documentation/M/T/f()', '/documentation/M/U', '/documentation/M/U/index']),
    new Map([
      ['/documentation/m', 'documentation/m/index.md'],
      ['/documentation/m/t', 'documentation/m/t/index.md'],
      ['/documentation/m/t/f()', 'documentation/m/t/f().md'],
      ['/documentation/m/u', 'documentation/m/u.md'],
      ['/documentation/m/u/index', 'documentation/m/u/index.md'],
    ]),
  );
});
