import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Library } from '../src/library.ts';
import { generateSwift } from '../src/swift.ts';
import { repo } from './repo.ts';

void test('a directory without exactly one .xcworkspace is an error naming it', async (t) => {
  const root = await repo(t, { 'ios/A.xcworkspace/contents.xcworkspacedata': '', 'ios/B.xcworkspace/x': '' });
  const library: Library = { root, platforms: ['swift'], podName: 'P' };
  const build = { gradleDir: '', xcodeWorkspace: `${root}/ios` };
  await assert.rejects(generateSwift(library, `${root}/out`, build), /Expected one \.xcworkspace in .*\/ios, found 2/);
});
