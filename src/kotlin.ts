import { existsSync } from 'node:fs';
import { cp, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareExampleApp } from './example-app.ts';
import { run } from './exec.ts';
import type { Generator } from './library.ts';

const dokkaInitScript = fileURLToPath(new URL('../assets/dokka-gfm.init.gradle', import.meta.url));

/** Dokka GFM through a Gradle init script on the example app; the package's build files stay untouched. */
export const generateKotlin: Generator = async (library, out) => {
  const gradleProject = library.gradleProject!;
  const libraryAndroidDir = join(library.root, 'android');
  const buildFiles = ['build.gradle', 'build.gradle.kts'].map((f) => join(libraryAndroidDir, f)).filter(existsSync);
  for (const file of buildFiles) {
    // a second Dokka from the init script would clash with the package's own
    if ((await readFile(file, 'utf8')).includes('org.jetbrains.dokka')) {
      throw new Error(`${file} already applies Dokka (org.jetbrains.dokka); generate the Kotlin docs with it instead`);
    }
  }
  await prepareExampleApp(library, 'android');
  const exampleAndroidDir = join(library.exampleDir, 'android');
  // Dokka doesn't depend on codegen, so without this the generated spec supertype is an unresolved ERROR CLASS
  const codegenTasks = library.usesCodegen ? [`${gradleProject}:generateCodegenArtifactsFromSchema`] : [];
  await run(join(exampleAndroidDir, 'gradlew'), [
    '--init-script', dokkaInitScript,
    `-PdokkaProject=${gradleProject}`,
    ...codegenTasks,
    `${gradleProject}:dokkaGenerateMarkdown`,
  ], exampleAndroidDir);
  const dokkaOut = join(libraryAndroidDir, 'build/dokka/markdown');
  // package-list is Dokka's link metadata, not a page
  await cp(dokkaOut, out, { recursive: true, filter: (f) => basename(f) !== 'package-list' });
};
