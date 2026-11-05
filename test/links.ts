import { existsSync, readFileSync } from 'node:fs';
import { glob, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import markdownIt, { type Token } from 'markdown-it';

const md = markdownIt({ html: true });

/**
 * Every link and image in the tree's pages, HTML ones included, that a CommonMark parser reads as pointing at a missing
 * local file, or at a heading the file doesn't have, as `page -> href`.
 */
export async function brokenLinks(tree: string): Promise<string[]> {
  const broken: string[] = [];
  for await (const page of glob('**/*.md', { cwd: tree })) {
    const visit = (tokens: Token[]): void => {
      for (const t of tokens) {
        const html = t.type.startsWith('html_') ? [...t.content.matchAll(/ href="([^"]*)"/g)] : [];
        for (const href of [t.attrGet('href') ?? t.attrGet('src'), ...html.map((m) => m[1].replace(/&amp;/g, '&'))]) {
          if (typeof href !== 'string' || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
          const [path, fragment] = href.split('#');
          const file = resolve(dirname(join(tree, page)), decodeURIComponent(path));
          const found = existsSync(file) && (fragment === undefined || headingIds(file).includes(fragment));
          if (!found) broken.push(`${page} -> ${href}`);
        }
        if (t.children) visit(t.children);
      }
    };
    visit(md.parse(await readFile(join(tree, page), 'utf8'), {}));
  }
  return broken;
}

// the ids the site gives the file's headings: Python-Markdown's slugify
function headingIds(file: string): string[] {
  const tokens = md.parse(readFileSync(file, 'utf8'), {});
  return tokens.flatMap((t, i) => {
    if (t.type !== 'heading_open') return [];
    const text = tokens[i + 1].children!.map((c) => c.content).join('');
    return [
      text
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[-\s]+/g, '-'),
    ];
  });
}
