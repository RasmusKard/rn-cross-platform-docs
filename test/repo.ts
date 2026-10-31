import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';

/** A temporary repo holding `files` (path to content), removed when the test ends. */
export async function repo(t: TestContext, files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'test-repo-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [f, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, f)), { recursive: true });
    await writeFile(join(root, f), content);
  }
  return root;
}
