import type { Stack } from './stack.ts';

/** Reads the library repo at `root`; throws if it holds no React Native native module. */
export async function detect(root: string): Promise<Stack> {
  throw new Error(`detect(${root}): not implemented`);
}
