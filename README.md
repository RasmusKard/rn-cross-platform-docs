# rn-cross-platform-docs

**A thin wrapper of ~450 lines around TypeDoc, Dokka and DocC**: write a React Native native module's API reference in
each platform's doc comments, and publish it as one doc site.

```
docs/reference/
  typescript/   TypeDoc with typedoc-plugin-markdown
  kotlin/       Dokka 2, GitHub-flavored Markdown
  swift/        DocC Markdown output
```

- Supports: Expo modules; bare Turbo or Nitro modules with an example app in `example/`
- Site plugins: [Zensical](plugins/zensical/)
- Example: [examples/expo-greeter](examples/expo-greeter/), a minimal Expo module

## Install

```sh
npm install --save-dev @rn-cross-platform-docs/cli typedoc@0.28.20 typedoc-plugin-markdown@4.14.1
```

TypeDoc and its Markdown plugin are peer dependencies: the tool runs your repo's own.

Requirements:

- Node 22 or later
- Kotlin: JDK 17, Android SDK
- Swift: macOS, Xcode 27.2, CocoaPods

## Generate

From the repo root, with the repo's and the example app's dependencies installed:

```sh
npx rn-cross-platform-docs generate
```

| Option | Default | |
|---|---|---|
| `--out <dir>` | `docs/reference` | Output root; each platform replaces `<out>/<platform>/` |
| `--platforms <list>` | all detected | Comma-separated subset of `typescript,kotlin,swift` |

- `npx rn-cross-platform-docs detect`: prints the detected platforms
- Platforms run in order; the first failure stops the run and keeps that platform's previous tree
- Exit codes: 1 on failure, 2 on a usage error

### Detection

No config file. Platforms come from `package.json`, `expo-module.config.json` (including its `platforms` list),
`nitro.json`, the podspec and `android/`.

A bare library needs a committed example app: `example/android/settings.gradle(.kts)` or `example/ios/Podfile`.

### What it runs in your repo

Builds the library inside the example app, in place, since Dokka and DocC need it compiled:

| Step | Runs |
|---|---|
| Nitro codegen | `npx nitrogen` |
| Expo prebuild | `npx expo prebuild --platform <android\|ios> --no-install` in `example/` |
| Kotlin | React Native codegen (with `codegenConfig`), then Dokka through an init script, in `example/android` |
| Swift | `pod install`, then `xcodebuild docbuild`, in `example/ios` |
| TypeScript | TypeDoc on the repo's config, or on `src/index.ts(x)` when it sets no `entryPoints` |

- The library's build files stay untouched; a library that already applies Dokka is rejected
- Bare libraries: `pod install` rewrites the example app's committed Xcode project
- TypeDoc plugins given as local files are dropped (usually HTML theme tweaks)

## GitHub Actions

Reusable workflow: one runner per platform, one artifact per platform (`api-reference-<platform>`, holding
`<platform>.tar`).

```yaml
name: API reference
on: push
jobs:
  reference:
    uses: RasmusKard/rn-cross-platform-docs/.github/workflows/generate.yml@main
```

- Pin a commit or release tag instead of `main`
- Needs the CLI as a dev dependency ([Install](#install))
- Inputs: see [generate.yml](.github/workflows/generate.yml)
- Download: `actions/download-artifact` with `pattern: api-reference-*` and `merge-multiple: true`, then untar each

## Output

- TypeDoc and Dokka: Markdown kept as written
- DocC, adjusted:
  - symbol links and image paths become relative `.md` links
  - a page with child pages moves to `<page>/index.md`
  - unlabeled code blocks are labeled `swift`
  - members that protocol conformances add to each type are left out
- Swift file names contain `:`, `!` and similar: Windows can't check out the Swift tree
