import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { generate } from '../src/generate.ts';
import { repo } from './repo.ts';

/** A bare library, plus `files`, with an old `docs/reference/typescript/` tree; only its TypeScript is generated. */
const library = (t: TestContext, source: string, files: Record<string, string> = {}) =>
  repo(t, {
    'package.json': '{ "name": "generate-probe" }',
    'android/src/Probe.kt': '',
    'tsconfig.json': '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["src"] }',
    'src/index.ts': source,
    'docs/reference/typescript/old.md': '',
    ...files,
  });

void test('each platform replaces <out>/<platform>/', async (t) => {
  t.mock.method(console, 'info', () => {});
  const root = await library(t, '/** Says hi. */\nexport function hi(): string {\n  return "hi";\n}\n');

  await generate(root, { out: 'docs/reference', platforms: ['typescript'] });

  assert.deepEqual((await readdir(join(root, 'docs/reference'))).sort(), ['typescript']);
  assert.ok(existsSync(join(root, 'docs/reference/typescript/functions/hi.md')));
  assert.ok(!existsSync(join(root, 'docs/reference/typescript/old.md')));
});

void test('a failing generator leaves the previous tree in place', async (t) => {
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'error', () => {});
  const root = await library(t, 'export const n: number = "not a number";\n');

  await assert.rejects(generate(root, { out: 'docs/reference', platforms: ['typescript'] }), /TypeDoc failed/);

  assert.deepEqual(await readdir(join(root, 'docs/reference')), ['typescript']);
  assert.deepEqual(await readdir(join(root, 'docs/reference/typescript')), ['old.md']);
});

void test('a requested platform without sources is an error', async () => {
  const root = new URL('fixtures/bare-turbo', import.meta.url).pathname;
  await assert.rejects(
    generate(root, { out: 'docs/reference', platforms: ['typescript', 'swift'] }),
    /^Error: No swift sources detected in /,
  );
  assert.ok(!existsSync(join(root, 'docs')), 'nothing is generated');
});

void test('Swift with several podspecs is an error only when Swift is generated', async (t) => {
  t.mock.method(console, 'info', () => {});
  const root = await library(t, '/** Says hi. */\nexport function hi(): string {\n  return "hi";\n}\n', {
    'Probe.podspec': '',
    'ios/Probe.podspec': '',
    'ios/Probe.swift': '',
  });

  const ambiguous =
    /^Error: Expected one podspec in .*, found 2: Probe\.podspec, ios\/Probe\.podspec; leave swift out with --platforms typescript,kotlin$/;
  await assert.rejects(generate(root, { out: 'docs/reference' }), ambiguous);
  await assert.rejects(generate(root, { out: 'docs/reference', platforms: ['typescript', 'swift'] }), ambiguous);
  assert.deepEqual(await readdir(join(root, 'docs/reference/typescript')), ['old.md'], 'nothing is generated');

  await generate(root, { out: 'docs/reference', platforms: ['typescript'] });
  assert.ok(existsSync(join(root, 'docs/reference/typescript/functions/hi.md')));
});

/** The CLI running `generate` with `args` in `root`, once its build has printed; `stderr` collects what it writes there. */
async function generating(root: string, args: string[], env?: NodeJS.ProcessEnv, execArgv: string[] = []) {
  const cli = new URL('../src/cli.ts', import.meta.url).pathname;
  // its own process group, so a signal to it reaches the build too, as a terminal's Ctrl-C does
  const child = spawn(process.execPath, [...execArgv, cli, 'generate', ...args], { cwd: root, detached: true, env });
  const stderr: string[] = [];
  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
  await once(child.stdout, 'data');
  return { child, stderr };
}

void test('an interrupted run removes its staging directory and ends by the signal', async (t) => {
  const root = await repo(t, {
    'android/src/Probe.kt': '',
    'example/android/gradlew': '#!/bin/sh\necho started\nexec sleep 10\n',
  });
  await chmod(join(root, 'example/android/gradlew'), 0o755);
  const { child, stderr } = await generating(root, ['--platforms', 'kotlin']);
  assert.match((await readdir(join(root, 'docs/reference'))).join(), /^\.kotlin-\w+$/);

  process.kill(-child.pid!, 'SIGINT');

  assert.deepEqual(await once(child, 'exit'), [null, 'SIGINT']);
  assert.deepEqual(stderr, []);
  assert.deepEqual(await readdir(join(root, 'docs/reference')), []);
});

void test("an interrupted Swift run also removes Xcode's DerivedData directory", async (t) => {
  const root = await repo(t, {
    'ios/Probe.podspec': '',
    'ios/Probe.swift': '',
    'example/ios/Probe.xcworkspace/contents.xcworkspacedata': '',
    'bin/xcodebuild': '#!/bin/sh\necho started\nexec sleep 10\n',
  });
  await chmod(join(root, 'bin/xcodebuild'), 0o755);
  const tmp = join(root, 'tmp');
  await mkdir(tmp);
  const env = { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, TMPDIR: tmp };
  const darwin = 'data:text/javascript,Object.defineProperty(process, "platform", { value: "darwin" })';
  const { child, stderr } = await generating(root, ['--platforms', 'swift'], env, ['--import', darwin]);
  assert.match((await readdir(tmp)).join(), /^rn-cross-platform-docs-dd-\w+$/);

  process.kill(-child.pid!, 'SIGINT');

  assert.deepEqual(await once(child, 'exit'), [null, 'SIGINT']);
  assert.deepEqual(stderr, []);
  assert.deepEqual(await readdir(join(root, 'docs/reference')), []);
  assert.deepEqual(await readdir(tmp), []);
});
