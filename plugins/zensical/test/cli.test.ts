import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

const cli = new URL('../src/cli.ts', import.meta.url).pathname;

const dirs: string[] = [];
// a file-level after() can run before later top-level awaited tests, so clean up after each
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// runs `build` in a minimal library with only `bin` on PATH
function buildWith(bin: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'lib-'));
  dirs.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"my-lib"}');
  writeFileSync(join(root, 'README.md'), '# my-lib');
  mkdirSync(join(root, 'docs/reference/kotlin'), { recursive: true });
  writeFileSync(join(root, 'docs/reference/kotlin/index.md'), '# my-lib');
  mkdirSync(join(root, 'bin'));
  for (const [name, body] of Object.entries(bin)) {
    writeFileSync(join(root, 'bin', name), body);
    chmodSync(join(root, 'bin', name), 0o755);
  }
  return spawnSync(process.execPath, [cli, 'build'], { cwd: root, encoding: 'utf8', env: { PATH: join(root, 'bin') } });
}

await test('--help prints usage', () => {
  assert.match(
    execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }),
    /^Usage: rn-cross-platform-docs-zensical build/,
  );
});

await test('an unknown command exits 2', () => {
  const r = spawnSync(process.execPath, [cli, 'serve'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown command: serve/);
});

await test('an unknown option exits 2 with usage', () => {
  const r = spawnSync(process.execPath, [cli, 'build', '--nope'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^Unknown option '--nope'/);
  assert.match(r.stderr, /Usage: rn-cross-platform-docs-zensical build/);
});

await test('a missing uvx exits 1 and points to the uv install', () => {
  const r = buildWith({});
  assert.equal(r.status, 1);
  assert.match(
    r.stderr,
    /`uvx` not found: uv is not on PATH; see https:\/\/docs\.astral\.sh\/uv\/getting-started\/installation\//,
  );
});

await test('a failing uvx run exits 1 with the command and its status', () => {
  const r = buildWith({ uvx: '#!/bin/sh\nexit 3\n' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /`uvx --exclude-newer \S+ zensical@\S+ build` in \S+docs-site failed with exit code 3/);
});
