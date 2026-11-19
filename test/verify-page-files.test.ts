// Bounded-exhaustive check of pageFiles (src/docc.ts) over the page paths DocC writes; the verify-swift-page-files skill
// in .claude/skills/ says what it covers and how to read a failure.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageFiles } from '../src/docc.ts';

// The characters DocC keeps in an operator's name: Xcode 27.2's writes `_` for `<>|/^%?` and non-ASCII ones; `?` is
// here as an older DocC kept it, and `.` starts a dot operator.
const opChars = ['!', '&', '*', '+', '=', '~', '-', '_', '?'];
const words = (chars: string[], max: number): string[] => {
  let layer = [''];
  const all: string[] = [];
  for (let n = 1; n <= max; n++) all.push(...(layer = layer.flatMap((w) => chars.map((c) => w + c))));
  return all;
};
const operators = [...words(opChars, 3), '.', ...words([...opChars, '.'], 2).map((w) => `.${w}`)];
const names = ['T', 'a', 'a_b', 'a1', 'index', 'init', 'subscript', '_'];
// no parentheses (a type's or a property's), or up to two argument labels
const labels = ['_', 'a', '__', '_a', 'index'];
const signatures = [
  '',
  ...['', ...labels, ...labels.flatMap((l) => labels.map((m) => `${l}:${m}`))].map((ls) => `(${ls && `${ls}:`})`),
];
// DocC's suffixes for overloads and for names shared by symbols of different kinds
const suffixes = ['', '-1abcd', '-swift.struct', '-swift.property'];
const leaves = [
  ...operators.flatMap((op) => ['(_:)', '(_:_:)'].flatMap((sig) => ['', '-1abcd'].map((s) => op + sig + s))),
  ...names.flatMap((n) => signatures.flatMap((sig) => suffixes.map((s) => n + sig + s))),
  'getting-started', // an article
];
// the names a page with child pages has: a type's, an extended module's or an article's
const parents = ['T', 'index', 'T-swift.struct', 'T-1abcd', 'getting-started'];
const module = '/documentation/M';
const pages = [
  ...new Set([
    module,
    ...leaves.map((l) => `${module}/${l}`),
    ...parents.flatMap((p) => leaves.map((l) => `${module}/${p}/${l}`)),
  ]),
];

// `page`'s file when it has no child pages, or when it has one (named `x`); its file depends on nothing else
const fileOf = (page: string, parent: boolean) =>
  pageFiles(parent ? [page, `${page}/x`] : [page]).get(page.toLowerCase())!;

void test('pageFiles gives each DocC page its own file, which Windows can check out and which is not hidden', () => {
  const owners = new Map<string, [string, boolean]>(); // file, lowercased, to its page and whether it has child pages
  const problems: string[] = [];
  for (const page of pages) {
    for (const parent of [false, true]) {
      const file = fileOf(page, parent);
      const folders = file.split('/');
      const name = folders.pop()!;
      const bad = [...folders, name].find(
        (part) => /[<>:"\\|?*]/.test(part) || /[. ]$/.test(part) || part.startsWith('.'),
      );
      if (bad !== undefined || !name.endsWith('.md') || folders.some((f) => f.endsWith('.md'))) {
        problems.push(`${page}${parent ? ' (with child pages)' : ''} gets ${file}`);
      }
      const owner = owners.get(file.toLowerCase());
      if (!owner) {
        owners.set(file.toLowerCase(), [page, parent]);
        continue;
      }
      // the same file for two pages, if one set of pages can hold both as they are
      const set = [owner[0], page, ...(owner[1] ? [`${owner[0]}/x`] : []), ...(parent ? [`${page}/x`] : [])];
      const files = pageFiles(set);
      const [a, b] = [files.get(owner[0].toLowerCase()), files.get(page.toLowerCase())];
      if (a?.toLowerCase() === b?.toLowerCase()) {
        problems.push(`pageFiles(${JSON.stringify(set)}) writes ${owner[0]} and ${page} to the same file, ${a}`);
      }
    }
  }
  assert.deepEqual(problems.slice(0, 10), [], `${problems.length} problems over ${pages.length} pages`);
});
