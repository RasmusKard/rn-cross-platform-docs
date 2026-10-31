import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { test } from 'node:test';

const cli = new URL('../src/cli.ts', import.meta.url).pathname;

await test('--help prints usage', () => {
  assert.match(execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }), /^Usage: rn-cross-platform-docs generate/);
});

await test('an unknown platform exits 2', () => {
  const r = spawnSync(process.execPath, [cli, 'generate', '--platforms', 'java'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown platform: java/);
});

await test('an unknown option exits 2 with the message and usage, without a stack trace', () => {
  const r = spawnSync(process.execPath, [cli, 'generate', '--foo'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^Unknown option '--foo'.*\n\nUsage: /);
  assert.doesNotMatch(r.stderr, /ERR_PARSE_ARGS|\n\s+at /);
});

await test('detect exits 1 without a native module', () => {
  const r = spawnSync(process.execPath, [cli, 'detect'], { cwd: new URL('fixtures/none', import.meta.url).pathname, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /No React Native native module/);
});
