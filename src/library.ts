export const allPlatforms = ['typescript', 'kotlin', 'swift'] as const;
export type Platform = (typeof allPlatforms)[number];

/** What `detectLibrary` finds in a React Native library repo; every path is absolute. */
export interface Library {
  root: string;
  /** `name` in `package.json`. */
  packageName: string;
  /** `expo`: the example app's native projects come from `expo prebuild`; `bare`: they are committed. */
  kind: 'expo' | 'bare';
  /** `nitro.json` is present: nitrogen must run before Gradle and CocoaPods. */
  usesNitro: boolean;
  /** `package.json` has `codegenConfig`: React Native codegen makes the library's spec types. */
  usesCodegen: boolean;
  exampleDir: string;
  /** Platforms with sources, in `allPlatforms` order. */
  platforms: Platform[];
  /** Gradle path of the library in the example app, e.g. `:react-native-minimal-webview`; set when `kotlin` is detected. */
  gradleProject?: string;
  /** Podspec `s.name`, which is also the Xcode scheme; set when `swift` is detected. */
  podName?: string;
}

/** Writes one platform's Markdown tree to `out`, replacing what is there. */
export type Generator = (library: Library, out: string) => Promise<void>;
