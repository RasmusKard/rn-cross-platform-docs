import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { exportArchive } from '../src/swift.ts';
import { brokenLinks } from './links.ts';

const archive = new URL('fixtures/Fixture.doccarchive', import.meta.url).pathname;

void test('exportArchive copies pages, manifest and images with every link resolving in the tree', async (t) => {
  const out = await mkdtemp(join(tmpdir(), 'swift-test-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  await exportArchive(archive, 'Fixture', out);

  assert.deepEqual(await brokenLinks(out), []);
  assert.ok(existsSync(join(out, 'Fixture-markdown-manifest.json')));
  assert.ok(existsSync(join(out, 'images/org.cocoapods.Fixture/probe.png')));
  assert.ok(!existsSync(join(out, 'documentation/fixture/thing.json')));
  assert.equal(
    await readFile(join(out, 'documentation/fixture.md'), 'utf8'),
    `# Fixture

A [\`Thing\`](<./fixture/thing.md>) whose [\`run(_:)\`](<./fixture/thing/run(_:)-8uxly.md>) compares with [\`!=(_:_:)\`](<./fixture/thing/!=(_:_:).md>), see the [Guide](<./fixture/guide.md>#Section).
It is a \`BaseModule\`.

![A probe](<../images/org.cocoapods.Fixture/probe.png>)`,
  );
  assert.match(await readFile(join(out, 'documentation/fixture/thing.md'), 'utf8'), /\(<\.\/thing\/%3F%3F\(_:_:\)\.md>\)/);
});

void test('the link check catches DocC links left as written', async () => {
  assert.equal((await brokenLinks(join(archive, 'data'))).length, 13);
});
