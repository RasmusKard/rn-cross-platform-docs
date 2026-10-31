import { existsSync } from 'node:fs';
import { glob, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import markdownIt, { type Token } from 'markdown-it';

const md = markdownIt();

/** Every link and image in the tree's pages that a CommonMark parser reads as pointing at a missing local file, as `page -> href`. */
export async function brokenLinks(tree: string): Promise<string[]> {
  const broken: string[] = [];
  for await (const page of glob('**/*.md', { cwd: tree })) {
    const visit = (tokens: Token[]): void => {
      for (const t of tokens) {
        const href = t.attrGet('href') ?? t.attrGet('src');
        if (typeof href === 'string' && !/^[a-z][a-z0-9+.-]*:/i.test(href)) {
          const file = resolve(dirname(join(tree, page)), decodeURIComponent(href.split('#')[0]));
          if (!existsSync(file)) broken.push(`${page} -> ${href}`);
        }
        if (t.children) visit(t.children);
      }
    };
    visit(md.parse(await readFile(join(tree, page), 'utf8'), {}));
  }
  return broken;
}
