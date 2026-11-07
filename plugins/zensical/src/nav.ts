import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

/** An awesome-nav entry: a path, or a titled section of entries (or a titled path). */
export type NavItem = string | { [title: string]: string | NavItem[] };

/**
 * Returns the `.nav.yml` contents for the Kotlin or Swift tree at `dir`: an explicit nav that titles each type's
 * section by its page's H1. Swift's `documentation/<module>` level is dropped. Kotlin lists the packages after the root
 * page, or, with one package, shows that package's section in place of the root page, which only lists it. A Kotlin
 * enum lists its entries in declaration order, without Dokka's `entries`, `valueOf` and `values` pages.
 */
export async function platformNav(dir: string): Promise<{ nav: NavItem[] }> {
  const nav = await sectionNav(dir, '');
  if (nav.length === 1 && typeof nav[0] !== 'string') return { nav: Object.values(nav[0])[0] as NavItem[] };
  if (nav.length !== 2 || nav[0] !== 'index.md' || typeof nav[1] === 'string') return { nav };
  // Dokka's <module>/ folder: one package's section, or a page-less section of packages
  const inner = Object.values(nav[1])[0] as NavItem[];
  const module = (await readdir(dir, { withFileTypes: true })).find((e) => e.isDirectory())!.name;
  const packages = (await readdir(join(dir, module), { withFileTypes: true })).filter((e) => e.isDirectory());
  return { nav: packages.length === 1 ? inner : ['index.md', ...inner] };
}

/** An entry of typedoc-plugin-markdown's navigation JSON (its `navigationJson` option). */
export interface TypeDocNavItem {
  title: string;
  kind?: number;
  path?: string | null;
  children?: TypeDocNavItem[];
}

const documentKind = 8388608; // TypeDoc's ReflectionKind.Document

/**
 * Returns the `.nav.yml` contents for the TypeDoc tree at `dir` from its navigation JSON, so the nav has TypeDoc's
 * sections, titles and order: a reflection with children becomes a section, its page first. The root pages the JSON
 * leaves out (the project page, and the readme when it has a page of its own) come first, README.md or index.md leading.
 * Documents (`documents/`) are left out: they are copies of the guides.
 */
export async function typescriptNav(dir: string, json: TypeDocNavItem[]): Promise<{ nav: NavItem[] }> {
  const listed = new Set<string>();
  const nav = fromTypeDoc(json, listed);
  const isIndex = (f: string) => f === 'README.md' || f === 'index.md';
  const roots = (await readdir(dir))
    .filter((f) => f.endsWith('.md') && !listed.has(f))
    .sort((a, b) => Number(isIndex(b)) - Number(isIndex(a)) || a.localeCompare(b, 'en'));
  return { nav: [...roots, ...nav] };
}

function fromTypeDoc(items: TypeDocNavItem[], listed: Set<string>): NavItem[] {
  return items.flatMap(({ title, kind, path, children = [] }): NavItem[] => {
    if (kind === documentKind) return [];
    if (path) listed.add(path);
    const inner = fromTypeDoc(children, listed);
    if (!inner.length) return path ? [{ [title]: path }] : [];
    return [{ [title]: path ? [path, ...inner] : inner }];
  });
}

async function sectionNav(root: string, rel: string): Promise<NavItem[]> {
  const entries = (await readdir(join(root, rel), { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name, 'en'),
  );
  const path = (name: string) => (rel ? `${rel}/${name}` : name);
  const items: NavItem[] = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      const folder = await folderNav(root, path(e.name));
      if (folder) items.push(folder);
    } else if (e.name.endsWith('.md')) {
      // Dokka's constructors page is named, and titled, like its class: -greeting-options/-greeting-options.md
      const constructors = basename(rel).startsWith('-') && e.name === `${basename(rel)}.md`;
      items.push(constructors ? { constructor: path(e.name) } : path(e.name));
    }
  }
  // index.md first, so it becomes the section's page (navigation.indexes)
  const indexAt = items.indexOf(path('index.md'));
  if (indexAt > 0) items.unshift(...items.splice(indexAt, 1));
  return items;
}

/**
 * The section for folder `rel`, titled by the H1 of its page, `index.md`, which comes first. A folder without a page is
 * titled by name. A folder holding only its page, or only one section, is replaced by it. A folder without pages (DocC's
 * images/) is left out.
 */
async function folderNav(root: string, rel: string): Promise<NavItem | undefined> {
  let children = await sectionNav(root, rel);
  if (!children.length) return undefined;
  const page = children[0] === `${rel}/index.md` ? children[0] : undefined;
  const md = page ? await readFile(join(root, page), 'utf8') : '';
  const entries = md.indexOf('\n## Entries\n');
  if (entries >= 0 && children.includes(`${rel}/value-of.md`)) children = enumNav(children, rel, md.slice(entries));
  if (children.length === 1 && (page || typeof children[0] !== 'string')) return children[0];
  return { [(page && readH1(md)) || basename(rel)]: children };
}

/**
 * A Dokka enum's section: its entries in declaration order (as its Entries table lists them), then its other members as
 * its page lists them. Dokka's synthetic `entries`, `valueOf` and `values` pages are left out; the enum's page links them.
 */
function enumNav([page, ...members]: NavItem[], rel: string, fromEntries: string): NavItem[] {
  const synthetic = ['entries.md', 'value-of.md', 'values.md'].map((f) => `${rel}/${f}`);
  // each table row starts with a link to its member; a member no row lists goes last
  const rows = [...fromEntries.matchAll(/^\| \[[^\]]*\]\(([^)]+)\)/gm)].map((m) => `${rel}/${m[1]}`);
  const at = (item: NavItem) => {
    const i = rows.indexOf(pagePath(item));
    return i < 0 ? rows.length : i;
  };
  return [page, ...members.filter((m) => !synthetic.includes(pagePath(m))).sort((a, b) => at(a) - at(b))];
}

// an entry's page: a path, a titled path, or a section's first entry
function pagePath(item: NavItem): string {
  if (typeof item === 'string') return item;
  const value = Object.values(item)[0];
  return typeof value === 'string' ? value : pagePath(value[0]);
}

// unescaped: rn-cross-platform-docs escapes `_` in DocC titles
function readH1(md: string): string | undefined {
  return /^# (.+)$/m.exec(md)?.[1].trim().replace(/\\(.)/g, '$1');
}
