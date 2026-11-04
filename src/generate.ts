import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { detectLibrary } from './detect.ts';
import { generateKotlin } from './kotlin.ts';
import type { Build, Generator, Platform } from './library.ts';
import { generateSwift } from './swift.ts';
import { generateTypeScript } from './typescript.ts';

const generators: Record<Platform, Generator> = {
  typescript: generateTypeScript,
  kotlin: generateKotlin,
  swift: generateSwift,
};

export interface GenerateOptions {
  /** Output root; each platform writes `<out>/<platform>/`. Relative to `root`. */
  out: string;
  /** Platforms to generate; default: all detected. */
  platforms?: Platform[];
  /** Gradle build that includes the library, relative to `root`; default: `example/android`. */
  gradleProject?: string;
  /** `.xcworkspace` that builds the library's pod, or a directory holding one, relative to `root`; default: `example/ios`. */
  xcodeWorkspace?: string;
}

export async function generate(root: string, options: GenerateOptions): Promise<void> {
  const { out, platforms } = options;
  const library = await detectLibrary(root, platforms);
  const build: Build = {
    gradleDir: resolve(library.root, options.gradleProject ?? 'example/android'),
    xcodeWorkspace: resolve(library.root, options.xcodeWorkspace ?? 'example/ios'),
  };
  const missing = platforms?.filter((p) => !library.platforms.includes(p)) ?? [];
  if (missing.length) throw new Error(`No ${missing.join(', ')} sources detected in ${library.root}`);
  for (const platform of platforms ?? library.platforms) {
    const dest = resolve(library.root, out, platform);
    await mkdir(dirname(dest), { recursive: true });
    // a failing generator leaves the previous tree in place
    const staging = await mkdtemp(join(dirname(dest), `.${platform}-`));
    try {
      await generators[platform](library, staging, build);
      await rm(dest, { recursive: true, force: true });
      await rename(staging, dest);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }
}
