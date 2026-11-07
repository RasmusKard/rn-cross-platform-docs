import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { repo } from './repo.ts';

const cli = new URL('../src/cli.ts', import.meta.url).pathname;

await test('--help prints usage', () => {
  assert.match(
    execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }),
    /^Usage: rn-cross-platform-docs generate/,
  );
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

await test('detect prints the detected platforms, one per line', () => {
  const cwd = new URL('fixtures/bare-turbo', import.meta.url).pathname;
  assert.equal(execFileSync(process.execPath, [cli, 'detect'], { cwd, encoding: 'utf8' }), 'typescript\nkotlin\n');
});

await test('detect runs without loading TypeDoc', () => {
  const cwd = new URL('fixtures/bare-turbo', import.meta.url).pathname;
  const blockTypedoc = `data:text/javascript,import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === 'typedoc') throw new Error('typedoc was loaded');
      return next(specifier, context);
    } });`;
  const r = spawnSync(process.execPath, ['--import', blockTypedoc, cli, 'detect'], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'typescript\nkotlin\n');
});

await test('detect exits 1 without a native module', () => {
  const r = spawnSync(process.execPath, [cli, 'detect'], {
    cwd: new URL('fixtures/none', import.meta.url).pathname,
    encoding: 'utf8',
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /No React Native native module/);
});

await test('detect lists swift when it has several podspecs, leaving the error to generating it', async (t) => {
  const cwd = await repo(t, {
    'TwoPods.podspec': '',
    'ios/TwoPods.podspec': '',
    'ios/A.swift': '',
    'android/src/A.kt': '',
  });
  assert.equal(
    execFileSync(process.execPath, [cli, 'detect'], { cwd, encoding: 'utf8' }),
    'typescript\nkotlin\nswift\n',
  );
  const r = spawnSync(process.execPath, [cli, 'generate', '--platforms', 'swift'], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Expected one podspec in .*, found 2: TwoPods\.podspec, ios\/TwoPods\.podspec/);
});

await test('an empty --platforms exits 2 naming the platforms', () => {
  for (const list of ['', ' , ']) {
    const r = spawnSync(process.execPath, [cli, 'generate', '--platforms', list], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^No platform in --platforms: give one or more of typescript,kotlin,swift\n\nUsage: /);
  }
});

await test('an empty --platforms entry is ignored', () => {
  const r = spawnSync(process.execPath, [cli, 'generate', '--platforms', ',kotlin,,swift,'], {
    cwd: new URL('fixtures/bare-turbo', import.meta.url).pathname,
    encoding: 'utf8',
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /No swift sources detected/);
});
