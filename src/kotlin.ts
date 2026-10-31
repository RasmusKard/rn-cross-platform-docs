import { existsSync } from 'node:fs';
import { cp, readFile, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './exec.ts';
import { prepareExample } from './host.ts';
import type { Generator } from './stack.ts';

const initScript = fileURLToPath(new URL('../assets/dokka-gfm.init.gradle', import.meta.url));

/** Dokka GFM through a Gradle init script on the example app; the package's build files stay untouched. */
export const generateKotlin: Generator = async (stack, out) => {
  const project = stack.gradleProject;
  if (!project) throw new Error(`No Gradle project detected for ${stack.name}`);
  const android = join(stack.root, 'android');
  for (const file of ['build.gradle', 'build.gradle.kts'].map((f) => join(android, f)).filter((f) => existsSync(f))) {
    // a second Dokka from the init script would clash with the package's own
    if ((await readFile(file, 'utf8')).includes('org.jetbrains.dokka')) {
      throw new Error(`${file} already applies Dokka (org.jetbrains.dokka); generate the Kotlin docs with it instead`);
    }
  }
  await prepareExample(stack, 'android');
  const exampleAndroid = join(stack.example, 'android');
  await run(join(exampleAndroid, 'gradlew'), ['--init-script', initScript, `-PdokkaProject=${project}`, `${project}:dokkaGenerateMarkdown`], exampleAndroid);
  await rm(out, { recursive: true, force: true });
  // Dokka's link metadata, not a page
  await cp(join(android, 'build/dokka/markdown'), out, { recursive: true, filter: (f) => basename(f) !== 'package-list' });
};
