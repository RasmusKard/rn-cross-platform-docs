import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

/** An awesome-nav entry: a path, or a titled section of entries (or a titled path). */
export type NavItem = string | { [title: string]: string | NavItem[] };

/**
 * Returns the `.nav.yml` contents for the Kotlin or Swift tree at `dir`: an explicit nav that titles each type's
 * section by its page's H1.
 */
export async function platformNav(dir: string): Promise<{ nav: NavItem[] }> {
  const nav = await section(dir, '');
  // a tree holding one section (Swift's documentation/<module>) shows its contents directly
  return { nav: nav.length === 1 && typeof nav[0] !== 'string' ? (Object.values(nav[0])[0] as NavItem[]) : nav };
}

async function section(root: string, rel: string): Promise<NavItem[]> {
  const entries = (await readdir(join(root, rel), { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name, 'en'),
  );
  const names = new Set(entries.map((e) => e.name));
  const dirs = new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));
  const path = (name: string) => (rel ? `${rel}/${name}` : name);
  const items: NavItem[] = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      const f = await folder(root, path(e.name), names.has(`${e.name}.md`));
      if (f) items.push(f);
    } else if (e.name.endsWith('.md') && !dirs.has(e.name.slice(0, -3))) items.push(path(e.name));
  }
  // index.md first, so it becomes the section's page (navigation.indexes)
  const i = items.indexOf(path('index.md'));
  if (i > 0) items.unshift(...items.splice(i, 1));
  return items;
}

/**
 * The section for folder `rel`, titled by the H1 of its page: its own `index.md` (Dokka) or the sibling `<rel>.md`
 * (DocC), which comes first. A folder without a page is titled by name. A folder holding only its page, or only one
 * section, is replaced by it. A folder without pages (DocC's images/) is left out.
 */
async function folder(root: string, rel: string, hasSibling: boolean): Promise<NavItem | undefined> {
  const children = await section(root, rel);
  if (hasSibling) children.unshift(`${rel}.md`);
  if (!children.length) return undefined;
  const page = children[0] === `${rel}.md` || children[0] === `${rel}/index.md` ? children[0] : undefined;
  if (children.length === 1 && (page || typeof children[0] !== 'string')) return children[0];
  return { [(page && (await h1(join(root, page)))) || basename(rel)]: children };
}

// Dokka titles every package page "Package-level declarations"; the folder name is the package name
async function h1(file: string): Promise<string | undefined> {
  const title = /^# (.+)$/m.exec(await readFile(file, 'utf8'))?.[1].trim();
  return title === 'Package-level declarations' ? undefined : title;
}
