import { resolve } from 'node:path';
import { detect } from './detect.ts';
import { generateKotlin } from './kotlin.ts';
import type { Generator, Platform } from './stack.ts';
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
}

export async function generate(root: string, { out, platforms }: GenerateOptions): Promise<void> {
  const stack = await detect(root);
  const missing = platforms?.filter((p) => !stack.platforms.includes(p)) ?? [];
  if (missing.length) throw new Error(`No ${missing.join(', ')} sources detected in ${stack.root}`);
  for (const p of platforms ?? stack.platforms) await generators[p](stack, resolve(stack.root, out, p));
}
