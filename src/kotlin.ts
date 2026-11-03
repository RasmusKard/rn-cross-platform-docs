import { existsSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './exec.ts';
import type { Generator } from './library.ts';

const dokkaInitScript = fileURLToPath(new URL('../assets/dokka-gfm.init.gradle', import.meta.url));

/** Dokka GFM for the library's `android/` project via a Gradle init script on `gradleDir`; build files stay untouched. */
export const generateKotlin: Generator = async (library, out, { gradleDir }) => {
  const libraryAndroidDir = join(library.root, 'android');
  const gradlew = join(gradleDir, 'gradlew');
  if (!existsSync(gradlew)) throw new Error(`No ${gradlew}: --gradle-project must be a buildable Gradle build`);
  // oxfmt-ignore
  await run(gradlew, [
    '--init-script', dokkaInitScript,
    `-PdokkaProjectDir=${libraryAndroidDir}`,
    'dokkaGenerateMarkdown',
  ], gradleDir);
  const dokkaOut = join(libraryAndroidDir, 'build/dokka/markdown');
  // package-list is Dokka's link metadata, not a page
  await cp(dokkaOut, out, { recursive: true, filter: (f) => basename(f) !== 'package-list' });
};
