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
    JSON.stringify({ name: 'my-lib', description: 'Does things', repository: { url: 'git+https://github.com/me/my-lib.git' } }),
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

await test('TypeScript hides _media/', async () => {
  const root = library();
  mkdirSync(join(root, 'docs/reference/typescript'));
  const out = await writeProject(root, { reference: 'docs/reference', out: 'docs-site' });
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'docs/typescript/.nav.yml'), 'utf8')), { ignore: '_*' });
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
  await assert.rejects(writeProject(root, { reference: 'docs/reference', out: 'guides' }), /wasn't written by this tool/);
  assert.ok(existsSync(join(root, 'guides/a.md')));
});

await test('refuses a reference dir with no platform trees', async () => {
  await assert.rejects(writeProject(library(), { reference: 'guides', out: 'docs-site' }), /run `rn-cross-platform-docs generate` first/);
});

await test('refuses a library without README.md', async () => {
  const root = library();
  rmSync(join(root, 'README.md'));
  await assert.rejects(writeProject(root, { reference: 'docs/reference', out: 'docs-site' }), /no README\.md in .*; it is the site's home page/);
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
  await assert.rejects(writeProject(root, { reference: 'docs-site/ref', out: 'docs-site' }), /--reference must be outside --out/);
});
