# rn-cross-platform-docs

Generates Markdown API reference for a React Native native module, one tree per platform:

```
docs/reference/
  typescript/   TypeDoc with typedoc-plugin-markdown
  kotlin/       Dokka 2, GitHub-flavored Markdown
  swift/        DocC Markdown output
```

It works on Expo modules and bare React Native libraries (Turbo or Nitro modules) that have an example app in
`example/`. It only writes Markdown; site plugins in `plugins/` turn the trees into a site, e.g.
[Zensical](plugins/zensical/).

## Install

The package isn't on npm yet (it will be published as `rn-cross-platform-docs`), so install it from GitHub, which
builds it on install. The tool runs your repo's own TypeDoc, so TypeDoc and the Markdown plugin are peer dependencies:

```sh
npm install --save-dev github:RasmusKard/rn-cross-platform-docs typedoc@0.28.20 typedoc-plugin-markdown@4.14.1
```

Each platform needs its own toolchain:

| Platform | Needs |
|---|---|
| TypeScript | Node 22 or later |
| Kotlin | JDK 17 and the Android SDK, as for building the example app |
| Swift | macOS with Xcode 27.2 and CocoaPods |

## Generate

From the repo root, after installing the repo's and the example app's dependencies:

```sh
npx rn-cross-platform-docs generate
```

| Option | Default | |
|---|---|---|
| `--out <dir>` | `docs/reference` | Output root; each platform replaces `<out>/<platform>/` |
| `--platforms <list>` | all detected | Comma-separated subset of `typescript,kotlin,swift`, e.g. one per CI runner |

Platforms run in order and the first failure stops the run: the failing platform keeps its previous tree, the ones
before it are already replaced and the ones after it keep theirs. A killed run can leave a `.<platform>-*` directory in
`<out>`.

`npx rn-cross-platform-docs detect` prints the detected platforms, one per line: what `generate` runs without
`--platforms`. Either command exits 1 with `rn-cross-platform-docs: <message>` when it fails, for example on a repo
with no native module. A usage error (an unknown command, option or platform, or a missing option value) prints the
message and the usage to stderr and exits 2.

There is no config file. The tool reads `package.json`, `expo-module.config.json`, `nitro.json`, the podspec and
`android/` to decide which platforms exist and how to build them. A repo without `expo-module.config.json` or a
committed example app (`example/android/settings.gradle`, `example/android/settings.gradle.kts` or
`example/ios/Podfile`) is rejected. For an Expo module, a `platforms` list in `expo-module.config.json` also gates
Kotlin and Swift.

### What it runs in your repo

Dokka and DocC run the compiler, so the tool builds the library inside the example app, in place. It runs what the
repo's developers already run there:

| Step | Command | When |
|---|---|---|
| Library codegen | `npx nitrogen` (the library's own install) | Nitro modules (`nitro.json`), before Kotlin and Swift |
| Native projects | `npx expo prebuild --platform <android\|ios> --no-install` in `example/` | Expo modules |
| CocoaPods | `pod install` in `example/ios` | Swift |
| TypeScript | TypeDoc on the repo's TypeDoc config (`typedoc.json`, `.config/typedoc.json`, ...), or `src/index.ts(x)` when it sets no `entryPoints` | always |
| Kotlin | React Native codegen (with `codegenConfig` in `package.json`), then Dokka through the tool's init script, in `example/android` | Kotlin sources in `android/` |
| Swift | `xcodebuild docbuild` in `example/ios`, with DocC's Markdown output | Swift sources in `ios/` and a podspec (`ios/*.podspec` or `*.podspec`) |

The init script adds Dokka to the example app's build only; the library's build files stay untouched. A library that
already applies Dokka (`org.jetbrains.dokka`) in `android/build.gradle` or `android/build.gradle.kts` is rejected. On a
bare library, `pod install` rewrites the example app's committed Xcode project, as it does for any developer.

TypeDoc plugins given as local files in the repo's config are dropped, since they usually customize the HTML theme;
plugins from packages stay.

## GitHub Actions

A reusable workflow runs each platform on its own runner (Swift on macOS, the rest on Ubuntu) and uploads one artifact
per platform, `api-reference-<platform>`, holding `<platform>.tar`. Download them with `actions/download-artifact`'s
`pattern: api-reference-*` and `merge-multiple: true`, then untar each. The jobs run the repo's own installed CLI, so
add it as a dev dependency as in [Install](#install); the workflow asks only for `permissions: contents: read`.

```yaml
name: API reference
on: push
jobs:
  reference:
    uses: RasmusKard/rn-cross-platform-docs/.github/workflows/generate.yml@main
```

Pin a commit or release tag instead of `main`. Inputs, all optional:

| Input | Default |
|---|---|
| `platforms` | `'["typescript", "kotlin", "swift"]'` (a JSON array); a platform the repo has no sources for is skipped with a notice, after its runner has been set up and the dependencies installed |
| `install` | picks yarn, pnpm or npm from the lockfile (npm also runs `npm ci` in `example/` when it has a `package-lock.json`); a bun repo, or any other setup, sets this |
| `node-version` | `24` |
| `xcode-version` / `macos-runner` | `27.2` / `xcode-27`; an empty `xcode-version` keeps the runner's default Xcode |
| `artifact-name` | `api-reference`; the prefix of the per-platform artifact names |

## Hide what is public only for the framework

The reference holds the public API as each language defines it. Expo and React Native need some types to be public
that aren't meant for users, such as the Expo `Module` subclass. Hide them where they're declared:

```kotlin
/**
 * Public only for Expo's autolinking.
 *
 * @suppress
 */
class MyModule : Module() { ... }
```

```swift
@_documentation(visibility: internal)
public class MyModule: Module { ... }
```

ObjC headers are public unless the podspec scopes them, for example
`s.private_header_files = "ios/**/*.h"`.

Generated code is documented too. Nitro's generated Kotlin and Swift specs, and C++ declared in its public headers,
show up in the reference, and since nitrogen regenerates them they can't be annotated.

## Known gaps in DocC's Markdown

The Swift tree is DocC's experimental Markdown output as is, with one fix: symbol links and image paths are rewritten
into relative `.md` links (a link to a symbol outside the module becomes plain text). As of Xcode 27.2:

- Type and module pages don't list their members unless the docs catalog curates them with `## Topics`. Fixed in
  swift-docc's `main` ([#1625](https://github.com/swiftlang/swift-docc/pull/1625)), not yet in an Xcode release.
- Overloads share a title; their file names differ by a hash, e.g. `run(_:)-8uxly.md`.
- Deprecation appears only in the metadata comment at the top of the page.
- Declaration code blocks have no `swift` language tag.
- Callouts (`- Note:`, `- Important:`) stay plain blockquotes, `> Note: ...`.
- File names contain `(`, `)`, `:`, `!` and `=`, e.g. `!=(_:_:).md`; Windows can't check them out.
- Inherited and synthesized members (`Equatable`'s `!=`) get their own pages.
