import { cp, glob, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, posix } from 'node:path';
import { prepareExampleApp } from './example-app.ts';
import { run } from './exec.ts';
import type { Generator } from './library.ts';

export const generateSwift: Generator = async (library, out) => {
  const podName = library.podName;
  if (!podName) throw new Error('swift generator: no podspec name detected');
  await prepareExampleApp(library, 'ios');
  const exampleIosDir = join(library.exampleDir, 'ios');
  const workspaces = (await readdir(exampleIosDir)).filter((f) => f.endsWith('.xcworkspace'));
  if (workspaces.length !== 1) throw new Error(`Expected one .xcworkspace in ${exampleIosDir}, found ${workspaces.length}`);
  const derivedDataDir = await mkdtemp(join(tmpdir(), 'rn-cross-platform-docs-dd-'));
  try {
    await run(
      'xcodebuild',
      [
        'docbuild',
        '-workspace',
        workspaces[0],
        '-scheme',
        podName,
        '-destination',
        'generic/platform=iOS Simulator',
        '-derivedDataPath',
        derivedDataDir,
        'OTHER_DOCC_FLAGS=--enable-experimental-markdown-output --enable-experimental-markdown-output-manifest --no-transform-for-static-hosting',
        // drops members that protocol conformances copy onto each type (Equatable's !=, Record's decode(_:in:))
        'OTHER_SWIFT_FLAGS=$(inherited) -symbol-graph-skip-synthesized-members',
      ],
      exampleIosDir,
    );
    const archive = await findArchive(join(derivedDataDir, 'Build/Products/Debug-iphonesimulator', podName));
    await exportArchive(archive, basename(archive, '.doccarchive'), out);
  } finally {
    await rm(derivedDataDir, { recursive: true, force: true });
  }
};

/** The one `.doccarchive` in `dir`; DocC names it after the Swift module, which can differ from the pod name. */
export async function findArchive(dir: string): Promise<string> {
  const archives = (await readdir(dir)).filter((f) => f.endsWith('.doccarchive'));
  if (archives.length !== 1) throw new Error(`Expected one .doccarchive in ${dir}, found ${archives.length}`);
  return join(dir, archives[0]);
}

/**
 * Writes the archive of Swift module `module` (its Markdown pages and images) to `out`, with symbol links and image paths
 * made relative. A page with child pages moves to `<page>/index.md`, which site generators use as the section's page.
 * Unlabeled code blocks are labeled `swift`.
 */
export async function exportArchive(archive: string, module: string, out: string): Promise<void> {
  const manifest = `${module}-markdown-manifest.json`;
  const json = await readFile(join(archive, manifest), 'utf8');
  const { documents } = JSON.parse(json) as { documents: { identifier: string }[] };
  const files = pageFiles(documents.map((d) => d.identifier));
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  // files only: DocC makes an empty `images/<bundle-id>/` when the repo has no catalog
  for await (const f of glob('images/**', { cwd: archive, withFileTypes: true })) {
    if (f.isFile()) await cp(join(f.parentPath, f.name), join(out, posix.relative(archive, join(f.parentPath, f.name))));
  }
  for await (const page of glob('**/*.md', { cwd: join(archive, 'data') })) {
    const md = await readFile(join(archive, 'data', page), 'utf8');
    const file = files.get(`/${page.slice(0, -3)}`) ?? page;
    await mkdir(dirname(join(out, file)), { recursive: true });
    const fixed = rewriteLinks(md, file, files)
      // DocC leaves `_` unescaped in titles, so ask(_:_:) would render as ask(<em>:</em>:)
      .replace(/^# .*/m, (h) => h.replace(/_/g, '\\_'))
      // DocC writes declarations in unlabeled code blocks; label them for syntax highlighting
      .replace(/^```(.*)\n([\s\S]*?^```)$/gm, (block, lang: string, rest: string) => (lang ? block : `\`\`\`swift\n${rest}`));
    await writeFile(join(out, file), fixed);
  }
}

/** Maps each page identifier, lowercased, to its file in the tree: `<id>/index.md` for a page with child pages, else `<id>.md`. */
export function pageFiles(identifiers: string[]): Map<string, string> {
  const ids = new Set(identifiers.map((i) => i.toLowerCase()));
  const parents = new Set([...ids].map((i) => i.slice(0, i.lastIndexOf('/'))));
  // a member named `index` keeps its parent at `<id>.md`
  const hasIndexPage = (id: string) => parents.has(id) && !ids.has(`${id}/index`);
  return new Map([...ids].map((id) => [id, `${id.slice(1)}${hasIndexPage(id) ? '/index' : ''}.md`]));
}

// DocC writes `[text](/documentation/Module/Type/member(_:))` (balanced parentheses, unescaped) and
// `![alt](images/<bundle-id>/x.png)`; text may hold one level of brackets.
const docLink = /(!?)\[((?:[^[\]]|\[[^\]]*\])*)\]\(((?:\/documentation\/|images\/)(?:[^()\s]|\([^()\s]*\))*)\)/g;

/**
 * Makes DocC's links in the page at tree path `page` relative to the tree: a `/documentation/...` link to an identifier
 * in `files` (from {@link pageFiles}) points at its file, one to anything else is replaced by its text, and `images/...`
 * points at the tree root's `images/`. So does an unresolved ``doc://<bundle>/documentation/...`` code span.
 */
export function rewriteLinks(md: string, page: string, files: Map<string, string>): string {
  // DocC leaves symbol links in callouts unresolved, as ``doc://<bundle>/documentation/...``; shown by their last path
  // segment without the overload hash (shortcut: an operator whose name holds `/` shows only its tail)
  md = md.replace(/``doc:\/\/[^/`]+(\/documentation\/[^`]+)``/g, (_uri, id: string) => {
    const text = `\`${id.slice(id.lastIndexOf('/') + 1).replace(/-[0-9a-z]{4,6}$/, '')}\``;
    const file = files.get(id.toLowerCase());
    return file ? `[${text}](${relative(page, file)})` : text;
  });
  return md.replace(docLink, (_link, bang: string, text: string, dest: string) => {
    if (bang) return `![${text}](${relative(page, dest)})`;
    const [id, fragment] = dest.split('#');
    const file = files.get(id.toLowerCase());
    if (!file) return text;
    return `[${text}](${relative(page, file, fragment)})`;
  });
}

// `./` keeps a colon from reading as a URL scheme; encodeURI plus `?`/`#` escapes `%`, `<`, `>`, `?` (Swift operators)
// and spaces; the angle brackets allow unbalanced parentheses, and must hold the fragment too.
function relative(page: string, target: string, fragment?: string): string {
  const path = posix.relative(posix.dirname(page), target);
  const hash = fragment === undefined ? '' : `#${fragment.replace(/[<>]/g, encodeURIComponent)}`;
  return `<${path.startsWith('../') ? '' : './'}${encodeURI(path).replace(/[?#]/g, encodeURIComponent)}${hash}>`;
}
