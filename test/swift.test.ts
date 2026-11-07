import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Library } from '../src/library.ts';
import { generateSwift } from '../src/swift.ts';
import { repo } from './repo.ts';

const noXcode = new Error(
  '`xcodebuild` not found: Swift docs need Xcode on macOS; leave swift out with --platforms typescript,kotlin',
);

void test('a directory without exactly one .xcworkspace is an error naming it', async (t) => {
  t.mock.property(process, 'platform', 'darwin');
  const root = await repo(t, { 'ios/A.xcworkspace/contents.xcworkspacedata': '', 'ios/B.xcworkspace/x': '' });
  const library: Library = { root, platforms: ['swift'], podName: 'P' };
  const build = { gradleDir: '', xcodeWorkspace: `${root}/ios` };
  await assert.rejects(generateSwift(library, `${root}/out`, build), /Expected one \.xcworkspace in .*\/ios, found 2/);
});

void test('off macOS, Swift is an error that names Xcode and the platforms to generate instead', async (t) => {
  t.mock.property(process, 'platform', 'linux');
  const root = await repo(t, {});
  const library: Library = { root, platforms: ['typescript', 'kotlin', 'swift'], podName: 'P' };
  const build = { gradleDir: '', xcodeWorkspace: `${root}/example/ios` };
  await assert.rejects(generateSwift(library, `${root}/out`, build), noXcode);
});

void test('on macOS, a missing xcodebuild is the same error', async (t) => {
  t.mock.property(process, 'platform', 'darwin');
  const root = await repo(t, { 'example/ios/P.xcworkspace/contents.xcworkspacedata': '' });
  const path = process.env.PATH;
  t.after(() => {
    process.env.PATH = path;
  });
  process.env.PATH = '/nonexistent';
  const library: Library = { root, platforms: ['typescript', 'kotlin', 'swift'], podName: 'P' };
  const build = { gradleDir: '', xcodeWorkspace: `${root}/example/ios` };
  await assert.rejects(generateSwift(library, `${root}/out`, build), noXcode);
});
