import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../src/exec.ts';
import { repo } from './repo.ts';

void test('a command not on PATH is an error naming it, with the advice given', async (t) => {
  const root = await repo(t, {});
  await assert.rejects(run('no-such-tool', [], root), new Error('`no-such-tool` not found: it is not on PATH'));
  await assert.rejects(run('no-such-tool', [], root, 'install it'), new Error('`no-such-tool` not found: install it'));
});

void test('a script without its executable bit is an error naming it and chmod +x', async (t) => {
  const root = await repo(t, { 'tool.sh': '#!/bin/sh\n' });
  await assert.rejects(
    run(`${root}/tool.sh`, [], root),
    new Error(`\`${root}/tool.sh\` is not executable; run \`chmod +x ${root}/tool.sh\``),
  );
});

void test('a missing working directory is an error naming it, not the command', async () => {
  await assert.rejects(run('sh', [], '/nonexistent/dir'), new Error('No /nonexistent/dir to run `sh` in'));
});

void test('a failing command is an error with the command line and exit status', async (t) => {
  const root = await repo(t, {});
  await assert.rejects(
    run('sh', ['-c', 'exit 3'], root),
    new Error(`\`sh -c exit 3\` in ${root} failed with exit code 3`),
  );
});
