import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `uv run --frozen` doesn't check that the lock matches pyproject.toml, so a pin changed without `uv lock` goes unseen
await test('uv.lock locks the Zensical version pyproject.toml pins', () => {
  const pin = /^dependencies = \["zensical==([^"]+)"\]$/m.exec(read('pyproject.toml'))?.[1];
  assert.ok(pin, 'pyproject.toml: found no `dependencies = ["zensical==<version>"]`');
  const lock = read('uv.lock');
  const stale = `uv.lock doesn't lock zensical ${pin}, which pyproject.toml pins; run \`uv lock\` in plugins/zensical`;
  assert.match(
    lock,
    new RegExp(`^requires-dist = \\[\\{ name = "zensical", specifier = "==${escape(pin)}" \\}\\]$`, 'm'),
    stale,
  );
  assert.match(lock, new RegExp(`^name = "zensical"\\nversion = "${escape(pin)}"$`, 'm'), stale);
});
