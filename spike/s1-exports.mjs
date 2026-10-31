// Usage: node s1-exports.mjs <repo> <outDir>. Lists src/index.ts exports and the Markdown page(s) whose breadcrumb is `<project> / <export>`, i.e. a page for that top-level export.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const [repo, out] = process.argv.slice(2);
const ts = createRequire(join(repo, 'package.json'))('typescript');
const program = ts.createProgram([join(repo, 'src/index.ts')], { jsx: ts.JsxEmit.ReactJSX, skipLibCheck: true });
const checker = program.getTypeChecker();
const names = checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(join(repo, 'src/index.ts')))).map((s) => s.name).sort();
const pages = [];
const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.md') && pages.push(join(d, e.name)));
walk(out);
const titles = pages.map((p) => [relative(out, p), readFileSync(p, 'utf8').match(/^\[[^\]]+\]\([^)]*\) \/ ([\w$]+)$/m)?.[1]]);
let missing = 0;
for (const n of names) {
  const hit = titles.filter(([, t]) => t === n).map(([p]) => p);
  if (!hit.length) missing++;
  console.log(`${hit.length ? 'ok  ' : 'MISS'} ${n}  ${hit.join(', ')}`);
}
console.log(`${names.length} exports, ${missing} missing`);
process.exitCode = missing ? 1 : 0;
