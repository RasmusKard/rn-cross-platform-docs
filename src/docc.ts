// The only module that rewrites a doc generator's Markdown; TypeDoc's and Dokka's Markdown is kept as written.
import { existsSync } from 'node:fs';
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
 * made relative and the types in each declaration linked to their pages. A page with child pages moves to
 * `<page>/index.md`, which site generators use as the section's page.
 */
export async function exportArchive(archive: string, module: string, out: string): Promise<void> {
  const manifest = `${module}-markdown-manifest.json`;
  const json = await readFile(join(archive, manifest), 'utf8');
  const { documents } = JSON.parse(json) as { documents: { identifier: string }[] };
  // files only: DocC makes an empty `images/<bundle-id>/` when the repo has no catalog
  for await (const f of glob('images/**', { cwd: archive, withFileTypes: true })) {
    if (!f.isFile()) continue;
    const image = posix.relative(archive, join(f.parentPath, f.name));
    await cp(join(archive, image), join(out, image));
  }
  const data = join(archive, 'data');
  // DocC names a page's file after its identifier, unless it shortens a long name with a hash
  const named = new Map(documents.map(({ identifier: id }) => [`${fileSafe(id.toLowerCase()).slice(1)}.md`, id]));
  const pages = new Map<string, { page: string; md: string }>(); // by identifier, lowercased
  for await (const page of glob('**/*.md', { cwd: data })) {
    const md = await readFile(join(data, page), 'utf8');
    // without metadata, a page DocC shortened keeps its file's name, and a link to it only its text
    const id = metadataIdentifier(md) ?? named.get(page) ?? `/${page.slice(0, -'.md'.length)}`;
    pages.set(id.toLowerCase(), { page, md });
  }
  const files = pageFiles([...pages.keys()], (id) => `/${pages.get(id)!.page.slice(0, -'.md'.length)}`);
  for (const [id, { page, md: source }] of pages) {
    const file = files.get(id)!;
    let md = rewriteLinks(source, file, files);
    // DocC writes each page's render JSON next to its Markdown
    const json = join(data, `${page.slice(0, -'.md'.length)}.json`);
    if (existsSync(json))
      md = linkDeclarations(md, file, JSON.parse(await readFile(json, 'utf8')) as RenderNode, files);
    // DocC leaves `_` unescaped in titles, so ask(_:_:) would render as ask(<em>:</em>:)
    md = md.replace(/^# .*/m, (h) => h.replace(/_/g, '\\_'));
    await mkdir(dirname(join(out, file)), { recursive: true });
    await writeFile(join(out, file), md);
  }
}

/**
 * Maps each page identifier, lowercased, to its file in the tree, named after `path(id)`, the page's file in DocC's
 * `data/` without `.md`: `<path>/index.md` for a page with child pages, else `<path>.md`, or `<parent>/--index--.md` if
 * it is named `index`, as Dokka names it. `?` becomes `'`, so that no page has a URL with a query. By default, `path`
 * puts a `'` before a name starting with `.`, as DocC names a file, so that no page is a hidden file.
 */
export function pageFiles(identifiers: string[], path: (id: string) => string = fileSafe): Map<string, string> {
  const paths = new Map(identifiers.map((i) => [i.toLowerCase(), path(i.toLowerCase())]));
  const parents = new Set([...paths.values()].map((p) => p.slice(0, p.lastIndexOf('/'))));
  // `index.md` is its parent's page; a Swift name can't hold `-`, so no other page is named `--index--`
  const file = (p: string) => (parents.has(p) ? `${p}/index` : p.replace(/\/index$/, '/--index--'));
  // a Swift name can't hold `'` either, and only one starting with `.` can hold a `.`, so the names stay unique
  return new Map([...paths].map(([id, p]) => [id, `${file(p).replace(/\?/g, "'").slice(1)}.md`]));
}

// DocC's path for a page's file: a name starting with `.` would be a hidden file
function fileSafe(path: string): string {
  return path.replace(/\/\./g, "/'.");
}

// the identifier in the metadata DocC writes as JSON in a comment at the top of each page
function metadataIdentifier(md: string): string | undefined {
  const json = /^<!--\n(\{[\s\S]*?\})\n-->\n/.exec(md)?.[1];
  try {
    const { identifier } = JSON.parse(json ?? '{}') as { identifier?: unknown };
    return typeof identifier === 'string' ? identifier : undefined;
  } catch (error) {
    // a page without valid metadata falls back to its file name
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

// DocC writes `[text](/documentation/Module/Type/member(_:))` (balanced parentheses, unescaped) and
// `![alt](images/<bundle-id>/x.png)`; text may hold one level of brackets.
const docLink = /(!?)\[((?:[^[\]]|\[[^\]]*\])*)\]\(((?:\/documentation\/|images\/)(?:[^()\s]|\([^()\s]*\))*)\)/g;

// DocC leaves symbol links in callouts unresolved, as ``doc://<bundle>/documentation/...``
const unresolvedDocLink = /``doc:\/\/[^/`]+(\/documentation\/[^`]+)``/g;
const overloadHash = /-[0-9a-z]{4,6}$/;

/**
 * Makes DocC's links in the page at tree path `page` relative to the tree: a `/documentation/...` link to an identifier
 * in `files` (from {@link pageFiles}) points at its file, and at the heading's lowercase id for a link to a section; one
 * to anything else is replaced by its text, and `images/...` points at the tree root's `images/`. So does an unresolved
 * ``doc://<bundle>/documentation/...`` code span.
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

/** The part of a DocC render node (a page's render JSON) that {@link linkDeclarations} reads. */
export interface RenderNode {
  primaryContentSections?: {
    kind?: string;
    // a token that names a symbol DocC knows has its `doc://<bundle-id>/documentation/...` URL as `identifier`
    declarations?: { tokens?: { text: string; identifier?: string }[] }[];
  }[];
}

/**
 * Links the types in the declarations of the page at tree path `page`. DocC writes each declaration as a code block,
 * which can't hold links, and its tokens, with the symbol each names, in the page's render JSON `node`. A code block
 * spelling a declaration that names a page in `files` (from {@link pageFiles}), other than `page`, becomes an HTML code
 * block linking those tokens, which GitHub and the site still show as code; any other code block stays as written.
 */
export function linkDeclarations(md: string, page: string, node: RenderNode, files: Map<string, string>): string {
  const linked = new Map<string, string>();
  for (const section of node.primaryContentSections ?? []) {
    if (section.kind !== 'declarations') continue;
    for (const { tokens = [] } of section.declarations ?? []) {
      let links = 0;
      const html = tokens.map(({ text, identifier }) => {
        const file = files.get(docPath(identifier)?.toLowerCase() ?? '');
        if (!file || file === page) return escapeHtml(text);
        links++;
        return `<a href="${escapeHtml(href(page, file))}">${escapeHtml(text)}</a>`;
      });
      if (links) linked.set(tokens.map((t) => t.text).join(''), `<pre><code>${html.join('')}</code></pre>`);
    }
  }
  if (!linked.size) return md;
  // DocC's declaration has no language; matching every fence keeps a labeled block's closing fence from opening one
  return md.replace(/^```(.*)\n([\s\S]*?)\n```$/gm, (block, lang: string, code: string) =>
    lang ? block : (linked.get(code) ?? block),
  );
}

// the page path of a `doc://<bundle-id>/documentation/...` URL, which DocC percent-encodes
function docPath(url: string | undefined): string | undefined {
  const path = url && /^doc:\/\/[^/]+(\/documentation\/[^#]*)/.exec(url)?.[1];
  try {
    return path && decodeURIComponent(path);
  } catch {
    return undefined;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// angle brackets allow unbalanced parentheses
function relative(page: string, target: string, fragment?: string): string {
  return `<${href(page, target, fragment)}>`;
}

function href(page: string, target: string, fragment?: string): string {
  const path = posix.relative(posix.dirname(page), target);
  const prefix = path.startsWith('../') ? '' : './'; // keeps a colon from reading as a URL scheme
  // escapes `%`, `<`, `>`, `"`, spaces and, which encodeURI leaves alone, `?` and `#`, which would end the path
  const escaped = encodeURI(path).replace(/[?#]/g, encodeURIComponent);
  const hash = fragment === undefined ? '' : `#${headingId(fragment)}`;
  return `${prefix}${escaped}${hash}`;
}

// the id the site gives the heading (Python-Markdown's slugify) from DocC's fragment for it, which joins words with `-`
// but keeps case, accents, emoji and symbols such as `+`
function headingId(fragment: string): string {
  return fragment
    .normalize('NFKD')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
