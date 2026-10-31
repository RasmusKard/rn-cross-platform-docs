# rn-cross-platform-docs

Generates Markdown API reference for a React Native native module, one tree per platform:

```
docs/reference/
  typescript/   TypeDoc with typedoc-plugin-markdown
  kotlin/       Dokka 2, GitHub-flavored Markdown
  swift/        DocC Markdown output, plus its manifest
```

It works on Expo modules and bare React Native libraries (Turbo or Nitro modules) that have an example app in
`example/`. It only writes Markdown; turning the trees into a site is a separate tool's job.

## Install

The tool runs your repo's own TypeDoc, so TypeDoc and the Markdown plugin are peer dependencies:

```sh
npm install --save-dev rn-cross-platform-docs typedoc@0.28.20 typedoc-plugin-markdown@4.14.1
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

There is no config file. The tool reads `package.json`, `expo-module.config.json`, `nitro.json`, the podspec and
`android/` to decide which platforms exist and how to build them. A repo without `expo-module.config.json` or a
committed example app (`example/android/settings.gradle` or `example/ios/Podfile`) is rejected.

### What it runs in your repo

Dokka and DocC run the compiler, so the tool builds the library inside the example app, in place. It runs what the
repo's developers already run there:

| Step | Command | When |
|---|---|---|
| Library codegen | `<package manager> run nitrogen` | Nitro modules (`nitro.json`), before Kotlin and Swift |
| Native projects | `npx expo prebuild --platform <android\|ios> --no-install` in `example/` | Expo modules |
| CocoaPods | `pod install` in `example/ios` | Swift |
| TypeScript | TypeDoc on the repo's TypeDoc config (`typedoc.json`, `.config/typedoc.json`, ...), or `src/index.ts(x)` without one | always |
| Kotlin | `./gradlew --init-script <tool>/assets/dokka-gfm.init.gradle -PdokkaProject=:<package> :<package>:dokkaGenerateMarkdown` in `example/android` | Kotlin sources in `android/` |
| Swift | `xcodebuild docbuild -scheme <pod> ...` in `example/ios`, with DocC's experimental Markdown output | Swift sources in `ios/` |

The init script adds Dokka to the example app's build only; the library's build files stay untouched. A library that
already applies Dokka (`org.jetbrains.dokka`) in `android/build.gradle` is rejected. On a bare library, `pod install`
rewrites the example app's committed Xcode project, as it does for any developer.

TypeDoc plugins given as local files in the repo's config are dropped, since they usually customize the HTML theme;
plugins from packages stay.

## GitHub Actions

A reusable workflow runs each platform on its own runner (Swift on macOS, the rest on Ubuntu) and uploads one
artifact, `api-reference`, holding `reference.tar`. The tree is tarred because Swift file names contain `:`, which
`actions/upload-artifact` rejects.

```yaml
name: API reference
on: push
jobs:
  reference:
    uses: RasmusKard/rn-cross-platform-docs/.github/workflows/generate.yml@main
```

Pin a release tag instead of `main`. Inputs, all optional:

| Input | Default |
|---|---|
| `platforms` | `'["typescript", "kotlin", "swift"]'` (a JSON array) |
| `install` | from the lockfile: `yarn install --immutable`, `pnpm install --frozen-lockfile`, or `npm ci` plus `npm ci` in `example/` |
| `node-version` | `24` |
| `xcode-version` / `macos-runner` | `27.2` / `xcode-27`; an empty `xcode-version` keeps the runner's default Xcode |
| `artifact-name` | `api-reference` |

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

- Type pages don't list their members unless the docs catalog curates them with `## Topics`.
- Overloads share a title; their file names differ by a hash, e.g. `run(_:)-8uxly.md`.
- Deprecation appears only in the metadata comment at the top of the page.
- Declaration code blocks have no `swift` language tag.
- Callouts (`- Note:`, `- Important:`) stay plain blockquotes, `> Note: ...`.
- File names contain `(`, `)`, `:`, `!` and `=`, e.g. `!=(_:_:).md`; Windows can't check them out.
- Inherited and synthesized members (`Equatable`'s `!=`) get their own pages.
