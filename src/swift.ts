import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { exportArchive, findArchive } from './docc.ts';
import { prepareExampleApp } from './example-app.ts';
import { run } from './exec.ts';
import type { Generator } from './library.ts';

const doccFlags = [
  '--enable-experimental-markdown-output',
  '--enable-experimental-markdown-output-manifest',
  '--no-transform-for-static-hosting',
].join(' ');

/** DocC through `xcodebuild docbuild` on the example app's workspace; docc.ts turns the archive into Markdown. */
export const generateSwift: Generator = async (library, out) => {
  const podName = library.podName!;
  await prepareExampleApp(library, 'ios');
  const exampleIosDir = join(library.exampleDir, 'ios');
  const workspaces = (await readdir(exampleIosDir)).filter((f) => f.endsWith('.xcworkspace'));
  if (workspaces.length !== 1) {
    throw new Error(`Expected one .xcworkspace in ${exampleIosDir}, found ${workspaces.length}`);
  }
  const derivedDataDir = await mkdtemp(join(tmpdir(), 'rn-cross-platform-docs-dd-'));
  try {
    // oxfmt-ignore
    await run('xcodebuild', [
      'docbuild',
      '-workspace', workspaces[0],
      '-scheme', podName,
      '-destination', 'generic/platform=iOS Simulator',
      '-derivedDataPath', derivedDataDir,
      `OTHER_DOCC_FLAGS=${doccFlags}`,
      // drops members that protocol conformances copy onto each type (Equatable's !=, Record's decode(_:in:))
      'OTHER_SWIFT_FLAGS=$(inherited) -symbol-graph-skip-synthesized-members',
    ], exampleIosDir);
    const archive = await findArchive(join(derivedDataDir, 'Build/Products/Debug-iphonesimulator', podName));
    await exportArchive(archive, basename(archive, '.doccarchive'), out);
  } finally {
    await rm(derivedDataDir, { recursive: true, force: true });
  }
};
