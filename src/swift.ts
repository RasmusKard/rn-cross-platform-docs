import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { exportArchive, findArchive } from './docc.ts';
import { run } from './exec.ts';
import { removeOnInterrupt } from './interrupt.ts';
import type { Generator } from './library.ts';

const doccFlags = [
  '--enable-experimental-markdown-output',
  '--enable-experimental-markdown-output-manifest',
  '--no-transform-for-static-hosting',
].join(' ');

/** DocC through `xcodebuild docbuild` on `xcodeWorkspace`; docc.ts turns the archive into Markdown. */
export const generateSwift: Generator = async (library, out, { xcodeWorkspace }) => {
  const podName = library.podName!;
  const workspace = await findWorkspace(xcodeWorkspace);
  const derivedDataDir = await mkdtemp(join(tmpdir(), 'rn-cross-platform-docs-dd-'));
  const stopWatching = removeOnInterrupt(derivedDataDir);
  try {
    // oxfmt-ignore
    await run('xcodebuild', [
      'docbuild',
      '-workspace', workspace,
      '-scheme', podName,
      '-destination', 'generic/platform=iOS Simulator',
      '-derivedDataPath', derivedDataDir,
      // $(inherited) keeps a pod's own flags, such as its documentation catalog
      `OTHER_DOCC_FLAGS=$(inherited) ${doccFlags}`,
      // drops members that protocol conformances copy onto each type (Equatable's !=, Record's decode(_:in:))
      'OTHER_SWIFT_FLAGS=$(inherited) -symbol-graph-skip-synthesized-members',
    ], dirname(workspace));
    const archive = await findArchive(join(derivedDataDir, 'Build/Products/Debug-iphonesimulator', podName));
    await exportArchive(archive, basename(archive, '.doccarchive'), out);
  } finally {
    await rm(derivedDataDir, { recursive: true, force: true });
    stopWatching();
  }
};

/** `path` if it is a `.xcworkspace`, else the only one directly inside it. */
async function findWorkspace(path: string): Promise<string> {
  if (path.endsWith('.xcworkspace')) return path;
  const found = existsSync(path) ? (await readdir(path)).filter((f) => f.endsWith('.xcworkspace')) : [];
  if (found.length !== 1) {
    throw new Error(`Expected one .xcworkspace in ${path}, found ${found.length}: --xcode-workspace must be buildable`);
  }
  return join(path, found[0]);
}
