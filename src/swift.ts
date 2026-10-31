import { cp, glob, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { run } from './exec.ts';
import { prepareExample } from './host.ts';
import type { Generator } from './stack.ts';

export const generateSwift: Generator = async (stack, out) => {
  const pod = stack.podName;
  if (!pod) throw new Error('swift generator: no podspec name in the stack');
  await prepareExample(stack, 'ios');
  const ios = join(stack.example, 'ios');
  const workspaces = (await readdir(ios)).filter((f) => f.endsWith('.xcworkspace'));
  if (workspaces.length !== 1) throw new Error(`Expected one .xcworkspace in ${ios}, found ${workspaces.length}`);
  const dd = await mkdtemp(join(tmpdir(), 'rn-cross-platform-docs-dd-'));
  try {
    await run(
      'xcodebuild',
      [
        'docbuild',
        '-workspace',
        workspaces[0],
        '-scheme',
        pod,
        '-destination',
        'generic/platform=iOS Simulator',
        '-derivedDataPath',
        dd,
        'OTHER_DOCC_FLAGS=--enable-experimental-markdown-output --enable-experimental-markdown-output-manifest --no-transform-for-static-hosting',
      ],
      ios,
    );
    await exportArchive(join(dd, 'Build/Products/Debug-iphonesimulator', pod, `${pod}.doccarchive`), pod, out);
  } finally {
    await rm(dd, { recursive: true, force: true });
  }
};

/** Writes the archive's Markdown pages, manifest and images to `out`, with symbol links and image paths made relative. */
export async function exportArchive(archive: string, pod: string, out: string): Promise<void> {
  const manifest = `${pod}-markdown-manifest.json`;
  const json = await readFile(join(archive, manifest), 'utf8');
  const { documents } = JSON.parse(json) as { documents: { identifier: string }[] };
  const pages = new Set(documents.map((d) => d.identifier.toLowerCase()));
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(join(out, manifest), json);
  // files only: DocC makes an empty `images/<bundle-id>/` when the repo has no catalog
  for await (const f of glob('images/**', { cwd: archive, withFileTypes: true })) {
    if (f.isFile()) await cp(join(f.parentPath, f.name), join(out, posix.relative(archive, join(f.parentPath, f.name))));
  }
  for await (const page of glob('**/*.md', { cwd: join(archive, 'data') })) {
    const md = await readFile(join(archive, 'data', page), 'utf8');
    await mkdir(dirname(join(out, page)), { recursive: true });
    await writeFile(join(out, page), rewriteLinks(md, page.split('\\').join('/'), pages));
  }
}

// DocC writes `[text](/documentation/Module/Type/member(_:))` (balanced parentheses, unescaped) and
// `![alt](images/<bundle-id>/x.png)`; text may hold one level of brackets.
const docLink = /(!?)\[((?:[^[\]]|\[[^\]]*\])*)\]\(((?:\/documentation\/|images\/)(?:[^()\s]|\([^()\s]*\))*)\)/g;

/**
 * Makes DocC's links in the page at tree path `page` relative to the tree: a `/documentation/...` link to an identifier
 * in `pages` (lowercase) points at its `.md` file, one to anything else is replaced by its text, and `images/...` points
 * at the tree root's `images/`.
 */
export function rewriteLinks(md: string, page: string, pages: Set<string>): string {
  return md.replace(docLink, (_link, bang: string, text: string, dest: string) => {
    if (bang) return `![${text}](${relative(page, dest)})`;
    const [id, fragment] = dest.split('#');
    const path = id.toLowerCase();
    if (!pages.has(path)) return text;
    return `[${text}](${relative(page, `${path.slice(1)}.md`)}${fragment === undefined ? '' : `#${fragment}`})`;
  });
}

// `./` keeps a colon from reading as a URL scheme; encodeURI plus `?`/`#` escapes `%`, `<`, `>`, `?` (Swift operators)
// and spaces; the angle brackets allow unbalanced parentheses.
function relative(page: string, target: string): string {
  const path = posix.relative(posix.dirname(page), target);
  return `<${path.startsWith('../') ? '' : './'}${encodeURI(path).replace(/[?#]/g, encodeURIComponent)}>`;
}
