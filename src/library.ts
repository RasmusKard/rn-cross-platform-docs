export const allPlatforms = ['typescript', 'kotlin', 'swift'] as const;
export type Platform = (typeof allPlatforms)[number];

/** What `detectLibrary` finds in a React Native library repo; every path is absolute. */
export interface Library {
  root: string;
  /** Platforms with sources, in `allPlatforms` order. */
  platforms: Platform[];
  /** Podspec file name without `.podspec`, used as the Xcode scheme; set when `swift` is detected. */
  podName?: string;
}

/** Where the library compiles; both must be buildable before generating. Paths are absolute. */
export interface Build {
  /** Gradle build that includes the library's `android/` directory as a project. */
  gradleDir: string;
  /** `.xcworkspace` with a scheme named `podName`, or a directory holding exactly one. */
  xcodeWorkspace: string;
}

/** Writes one platform's Markdown tree to `out`, a new empty directory. */
export type Generator = (library: Library, out: string, build: Build) => Promise<void>;
