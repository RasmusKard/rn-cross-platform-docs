# rn-cross-platform-docs

**A thin wrapper of ~450 lines around TypeDoc, Dokka and DocC**: write a React Native native module's API reference in
each platform's doc comments, and publish it as one doc site.

```
docs/reference/
  typescript/   TypeDoc with typedoc-plugin-markdown
  kotlin/       Dokka 2, GitHub-flavored Markdown
  swift/        DocC Markdown output
```

It works on Expo modules and on bare React Native libraries (Turbo or Nitro modules) with an example app in
`example/`. Site plugins: [Zensical](plugins/zensical/). [examples/expo-greeter](examples/expo-greeter/) is a minimal
Expo module to try it on.

## Install

```sh
npm install --save-dev @rn-cross-platform-docs/cli typedoc@0.28.20 typedoc-plugin-markdown@4.14.1
```

TypeDoc and its Markdown plugin are peer dependencies, so the tool runs your repo's own. It needs Node 22 or later,
plus the toolchain that builds the example app: JDK 17 and the Android SDK for Kotlin, macOS with Xcode 27.2 and
CocoaPods for Swift.

## Generate

From the repo root, after installing the repo's and the example app's dependencies:

```sh
npx rn-cross-platform-docs generate
```

| Option | Default | |
|---|---|---|
| `--out <dir>` | `docs/reference` | Output root; each platform replaces `<out>/<platform>/` |
| `--platforms <list>` | all detected | Comma-separated subset of `typescript,kotlin,swift` |

`npx rn-cross-platform-docs detect` prints the detected platforms. Platforms run in order and the first failure stops
the run, leaving the failed platform's previous tree in place. Failures exit 1, usage errors exit 2.

There is no config file. The tool detects platforms from `package.json`, `expo-module.config.json` (including its
`platforms` list), `nitro.json`, the podspec and `android/`. A bare library needs a committed example app
(`example/android/settings.gradle(.kts)` or `example/ios/Podfile`).

### What it runs in your repo

Dokka and DocC need the library compiled, so the tool builds it inside the example app, in place, with the commands the
repo's developers already run:

- Nitro modules: `npx nitrogen`.
- Expo modules: `npx expo prebuild --platform <android|ios> --no-install` in `example/`.
- Kotlin: React Native codegen (with `codegenConfig` in `package.json`), then Dokka in `example/android` through an
  init script. The library's build files stay untouched; a library that already applies Dokka is rejected.
- Swift: `pod install`, then `xcodebuild docbuild` in `example/ios`. On a bare library, `pod install` rewrites the
  example app's committed Xcode project.
- TypeScript: TypeDoc on the repo's own config, or on `src/index.ts(x)` when it sets no `entryPoints`. Plugins given
  as local files are dropped, since they usually customize the HTML theme.

## GitHub Actions

A reusable workflow runs each platform on its own runner and uploads one artifact per platform,
`api-reference-<platform>`, holding `<platform>.tar`. Its inputs are described in
[generate.yml](.github/workflows/generate.yml). It runs the repo's installed CLI, so add it as in [Install](#install).

```yaml
name: API reference
on: push
jobs:
  reference:
    uses: RasmusKard/rn-cross-platform-docs/.github/workflows/generate.yml@main
```

Pin a commit or release tag instead of `main`. Fetch the artifacts with `actions/download-artifact`
(`pattern: api-reference-*`, `merge-multiple: true`) and untar each.

## Output

TypeDoc's and Dokka's Markdown is kept as written. DocC's is adjusted: symbol links and image paths become relative
`.md` links, a page with child pages moves to `<page>/index.md`, unlabeled code blocks are labeled `swift`, and members
that protocol conformances add to each type are left out. Swift file names contain characters such as `:` and `!`, so
Windows can't check out the Swift tree.
