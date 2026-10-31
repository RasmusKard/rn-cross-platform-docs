export const allPlatforms = ['typescript', 'kotlin', 'swift'] as const;
export type Platform = (typeof allPlatforms)[number];

/** What `detect` finds in a library repo; every path is absolute. */
export interface Stack {
  root: string;
  name: string;
  /** `expo`: the example app's native projects come from `expo prebuild`; `bare`: they are committed. */
  kind: 'expo' | 'bare';
  /** `nitro.json` is present: nitrogen must run before Gradle and CocoaPods. */
  nitro: boolean;
  /** `package.json` has `codegenConfig`: React Native codegen makes the library's spec types. */
  codegen: boolean;
  example: string;
  /** Platforms with sources, in `allPlatforms` order. */
  platforms: Platform[];
  /** Gradle path of the library in the example app, e.g. `:react-native-minimal-webview`; set when `kotlin` is detected. */
  gradleProject?: string;
  /** Podspec `s.name`, which is also the Xcode scheme; set when `swift` is detected. */
  podName?: string;
}

/** Writes one platform's Markdown tree to `out`, replacing what is there. */
export type Generator = (stack: Stack, out: string) => Promise<void>;
