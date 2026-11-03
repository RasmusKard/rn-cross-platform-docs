// The only module that rewrites a doc generator's Markdown; TypeDoc's and Dokka's Markdown is kept as written.
import { cp, glob, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';

/** The one `.doccarchive` in `dir`; DocC names it after the Swift module, which can differ from the pod name. */
export async function findArchive(dir: string): Promise<string> {
  const archives = (await readdir(dir)).filter((f) => f.endsWith('.doccarchive'));
  if (archives.length !== 1) throw new Error(`Expected one .doccarchive in ${dir}, found ${archives.length}`);
  return join(dir, archives[0]);
}

/**
 * Writes the archive of Swift module `module` (its Markdown pages and images) to `out`, with symbol links and image paths
 * made relative. A page with child pages moves to `<page>/index.md`, which site generators use as the section's page.
 */
export async function exportArchive(archive: string, module: string, out: string): Promise<void> {
  const manifest = `${module}-markdown-manifest.json`;
  const json = await readFile(join(archive, manifest), 'utf8');
  const { documents } = JSON.parse(json) as { documents: { identifier: string }[] };
  const files = pageFiles(documents.map((d) => d.identifier));
  // files only: DocC makes an empty `images/<bundle-id>/` when the repo has no catalog
  for await (const f of glob('images/**', { cwd: archive, withFileTypes: true })) {
    if (!f.isFile()) continue;
    const image = posix.relative(archive, join(f.parentPath, f.name));
    await cp(join(archive, image), join(out, image));
  }
  for await (const page of glob('**/*.md', { cwd: join(archive, 'data') })) {
    const id = `/${page.slice(0, -3)}`; // the page's path without .md, as a DocC identifier
    const file = files.get(id) ?? page;
    let md = rewriteLinks(await readFile(join(archive, 'data', page), 'utf8'), file, files);
    // DocC leaves `_` unescaped in titles, so ask(_:_:) would render as ask(<em>:</em>:)
    md = md.replace(/^# .*/m, (h) => h.replace(/_/g, '\\_'));
    await mkdir(dirname(join(out, file)), { recursive: true });
    await writeFile(join(out, file), md);
  }
}

/**
 * Maps each page identifier, lowercased, to its file in the tree: `<id>/index.md` for a page with child pages, else
 * `<id>.md`.
 */
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

// DocC leaves symbol links in callouts unresolved, as ``doc://<bundle>/documentation/...``
const unresolvedDocLink = /``doc:\/\/[^/`]+(\/documentation\/[^`]+)``/g;
const overloadHash = /-[0-9a-z]{4,6}$/;

/**
 * Makes DocC's links in the page at tree path `page` relative to the tree: a `/documentation/...` link to an identifier
 * in `files` (from {@link pageFiles}) points at its file, one to anything else is replaced by its text, and `images/...`
 * points at the tree root's `images/`. So does an unresolved ``doc://<bundle>/documentation/...`` code span.
 */
export function rewriteLinks(md: string, page: string, files: Map<string, string>): string {
  md = md.replace(unresolvedDocLink, (_uri, id: string) => {
    // shortcut: an operator whose name holds `/` shows only its tail
    const name = id.slice(id.lastIndexOf('/') + 1).replace(overloadHash, '');
    const file = files.get(id.toLowerCase());
    return file ? `[\`${name}\`](${relative(page, file)})` : `\`${name}\``;
  });
  return md.replace(docLink, (_link, bang: string, text: string, dest: string) => {
    if (bang) return `![${text}](${relative(page, dest)})`;
    const [id, fragment] = dest.split('#');
    const file = files.get(id.toLowerCase());
    if (!file) return text;
    return `[${text}](${relative(page, file, fragment)})`;
  });
}

function relative(page: string, target: string, fragment?: string): string {
  const path = posix.relative(posix.dirname(page), target);
  const prefix = path.startsWith('../') ? '' : './'; // keeps a colon from reading as a URL scheme
  // escapes `%`, `<`, `>`, spaces and, which encodeURI leaves alone, `?` and `#` (Swift operators)
  const escaped = encodeURI(path).replace(/[?#]/g, encodeURIComponent);
  const hash = fragment === undefined ? '' : `#${fragment.replace(/[<>]/g, encodeURIComponent)}`;
  // angle brackets allow unbalanced parentheses, and must hold the fragment too
  return `<${prefix}${escaped}${hash}>`;
}
