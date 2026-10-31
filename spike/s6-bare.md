# S6: Kotlin and Swift recipes on a bare React Native library

Purpose: prove that the S2 (Dokka GFM init script) and S3 (`xcodebuild docbuild`) recipes work unchanged on a bare
library scaffolded with `create-react-native-library`, and record what differs from the Expo module case.

Result: **pass**, with one finding that changes the scaffold choice. Both recipes ran unchanged: the init script is
S2's file as is, and docbuild uses S3's flags as is. The only extra host-side step is the library's own codegen
(`yarn nitrogen`), which must run before Gradle or CocoaPods can even configure the project. Outputs:
`out-bare/kotlin/`, `out-bare/swift/`.

## Versions

| Tool | Version |
|---|---|
| create-react-native-library | 0.64.0 (latest on 2026-10-31) |
| React Native / react-native-nitro-modules / nitrogen | 0.88.0 / 0.37.1 / 0.37.1 |
| Yarn (scaffold's `packageManager`) | 4.18.1 |
| Gradle wrapper / AGP / Kotlin | 9.4.1 / 9.2.1 / 2.2.0 (`android.builtInKotlin=false`, `android.newDsl=false`, as in S2) |
| Dokka | 2.2.0 (S2's `dokka-gfm.init.gradle`, unmodified) |
| JDK | Zulu 17.0.20.1 |
| Xcode / CocoaPods / Node | 27.2 (27B52) / 1.17.0 / v26.11.1 |

## Scaffold choice: no Swift for Turbo modules

In 0.64.0, `--languages kotlin-swift` is offered only for `--type nitro-module` and `nitro-view`. A Turbo module gets
only `kotlin-objc` (or `cpp`):

```
$ npx create-react-native-library@0.64.0 ... --type turbo-module --languages kotlin-swift ...
Error: Invalid value for option '--languages'. Expected one of 'kotlin-objc', 'cpp', got 'kotlin-swift'
```

(`lib/src/prompt.js`: `kotlin-swift` → `['nitro-module', 'nitro-view']`, `kotlin-objc` → `['turbo-module',
'fabric-view']`.) So the run below uses the closest option, a **Nitro module** (New Architecture, JSI, with Kotlin and
Swift implementations of a `HybridObject` spec). A Turbo module `kotlin-objc` scaffold was also generated, without a
build, only to read its detection files: its iOS side is `ios/TurboProbe.h` + `ios/TurboProbe.mm` with no Swift, so
DocC would have nothing Swift to document there unless the author adds Swift by hand.

`--tools` is required in non-interactive mode (`Error: Missing required option '--tools'`), so `--tools jest` is
passed.

## Commands from a clean state

`SPIKE` = this folder, `OUT` = output root, `DD` = any DerivedData path.

```sh
npx --yes create-react-native-library@0.64.0 react-native-bare-probe --no-interactive \
  --directory react-native-bare-probe --slug react-native-bare-probe --description "Spike S6 bare probe" \
  --author-name Spike --author-email spike@example.com --author-url https://example.com \
  --repo-url https://example.com/repo \
  --type nitro-module --languages kotlin-swift --example vanilla --tools jest
cd react-native-bare-probe
# (spike only) add android/src/main/java/com/margelo/nitro/bareprobe/ProbeInfo.kt and ios/ProbeInfo.swift, see below
yarn install                       # Yarn 4 does NOT run the root `prepare` (bob build → nitrogen) here
yarn nitrogen                      # library codegen; nitrogen/ is gitignored. CI and CONTRIBUTING.md run this too

# Kotlin: S2 minus `expo prebuild`
(cd example/android && ./gradlew --init-script "$SPIKE/dokka-gfm.init.gradle" \
  -PdokkaProject=:react-native-bare-probe :react-native-bare-probe:dokkaGenerateMarkdown)
rm -rf "$OUT/kotlin" && cp -R android/build/dokka/markdown "$OUT/kotlin"

# Swift: S3 minus `expo prebuild`
(cd example/ios && pod install)
cd example/ios
xcodebuild docbuild \
  -workspace "$(ls -d *.xcworkspace)" \
  -scheme BareProbe \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DD" \
  'OTHER_DOCC_FLAGS=--enable-experimental-markdown-output --enable-experimental-markdown-output-manifest --no-transform-for-static-hosting'
A="$DD/Build/Products/Debug-iphonesimulator/BareProbe/BareProbe.doccarchive"
rsync -a --include='*/' --include='*.md' --exclude='*' --prune-empty-dirs "$A/data/" "$OUT/swift/"
cp "$A/BareProbe-markdown-manifest.json" "$OUT/swift/"
```

Probe sources added to the scaffold (scratch only):
- `ProbeInfo.kt`: documented `data class ProbeInfo(label, value, unit)` with `format()`, plus
  `class HiddenProbeHelper` whose KDoc has `@suppress`.
- `ProbeInfo.swift`: documented `public struct ProbeInfo` with `init(label:value:unit:)` and `format()`, plus
  `@_documentation(visibility: internal) public struct HiddenProbeHelper`.

## Differences vs S2 / S3

| Topic | Expo module (S2/S3) | Bare Nitro library (S6) |
|---|---|---|
| Host-app step | `npx expo prebuild` (native dirs gitignored) | none; `example/android`, `example/ios` are committed |
| Library codegen | none | `yarn nitrogen` is **required before Gradle and `pod install`**, because `android/build.gradle` does `apply from: '../nitrogen/generated/android/bareprobe+autolinking.gradle'` and the podspec does `load 'nitrogen/generated/ios/BareProbe+autolinking.rb'`. Neither Gradle nor CocoaPods runs nitrogen |
| RN codegen | – | runs on its own: Gradle runs `generateCodegen*` for `react-native-nitro-modules`, and `pod install` runs `[Codegen]` into `example/ios/build/generated`. The library itself has no `codegenConfig`, so nothing is generated for it. Dokka/DocC don't need anything extra |
| Init script | `dokka-gfm.init.gradle` | same file, unmodified (no `dokka-gfm-bare.init.gradle` needed); a run without the `release` suppression was not tried |
| Gradle project | `:<npm name>` | `:<npm name>` (`:react-native-bare-probe`), same rule |
| Kotlin package | `expo.modules.*` | `com.margelo.nitro.bareprobe` |
| Gradle work | compiles module + `expo-modules-core` | compiles only `react-native-nitro-modules` (Kotlin, release+debug) for the classpath; the library's own compile and CMake don't run |
| Pod / scheme | `MinimalWebView` (podspec in `ios/`) | `BareProbe` (podspec at repo root, `s.name`); workspace `BareProbeExample.xcworkspace` |
| DocC archives | one (ExpoModulesCore is precompiled) | **two**: `BareProbe.doccarchive` and `NitroModules.doccarchive` (a source pod with Swift). Copy only the scheme's archive |
| Swift visibility | module's own types public | scaffold `class BareProbe: HybridBareProbeSpec` is internal and absent; nitrogen's generated Swift is `public`/`open` and paged |
| Header leaks | ObjC helpers from un-scoped `.h` | C++ from nitrogen's `public_header_files` (`shared/**/*.hpp`, `BareProbe-Swift-Cxx-Bridge.hpp`) leaks through Swift–C++ interop: namespaces `BareProbe` (`c:@N@BareProbe`, page `bareprobe/bareprobe.md`), `facebook`, `margelo`, macro `NITRO_VERSION`. No ObjC/ObjC++ headers involved (the scaffold has no `.h`/`.mm` of its own) |
| Working tree after run | clean (generated dirs gitignored) | `pod install` **modifies committed files**: `example/ios/BareProbeExample.xcodeproj/project.pbxproj` (+23/-2) and `PrivacyInfo.xcprivacy` (entries reordered), and adds untracked `BareProbeExample.xcworkspace/` and `Podfile.lock` |

Failures without `yarn nitrogen` (observed after moving `nitrogen/` aside):

```
* What went wrong:
A problem occurred evaluating project ':react-native-bare-probe'.
> Could not read script '.../react-native-bare-probe/nitrogen/generated/android/bareprobe+autolinking.gradle' as it does not exist.
```
```
[!] Invalid `BareProbe.podspec` file: cannot load such file -- nitrogen/generated/ios/BareProbe+autolinking.rb.
 >    load 'nitrogen/generated/ios/BareProbe+autolinking.rb'
```

## Detection inputs (bare vs Expo)

| File | Expo module | Bare Nitro (S6) | Bare Turbo (`kotlin-objc` scaffold) |
|---|---|---|---|
| `expo-module.config.json` | present (definitive Expo marker) | absent | absent |
| `package.json` | `expo` in deps/peerDeps | `react-native-nitro-modules` peerDep, `nitrogen` devDep, `create-react-native-library.type: "nitro-module"`; no `codegenConfig` | `codegenConfig` (`name`, `type: "modules"`, `jsSrcsDir`, `android.javaPackageName`); `create-react-native-library.type: "turbo-module"` |
| `nitro.json` | – | present (`ios.iosModuleName`, autolinking language per platform) | – |
| Podspec | `ios/<Name>.podspec`, `s.dependency 'ExpoModulesCore'` | `<Name>.podspec` at repo root, `install_modules_dependencies(s)`, `load 'nitrogen/...'` | root `<Name>.podspec`, `install_modules_dependencies(s)`, `private_header_files = "ios/**/*.h"` |
| `android/build.gradle` | `id 'expo-module-gradle-plugin'`, `group = 'expo.modules.*'` | `apply plugin: "com.facebook.react"` + `apply from: '../nitrogen/...autolinking.gradle'` | `apply plugin: "com.facebook.react"` |
| Root `react-native.config.js` | absent | absent (listed in `files` but not created) | absent |
| `example/react-native.config.js` | absent | present; links the library from `..` | present |
| Example native dirs | `example/{android,ios}` gitignored, made by prebuild | committed (`example/android/settings.gradle`, `example/ios/*.xcodeproj`, `Podfile`) | committed |
| Example app | `example/app.json` with Expo config, `expo` dep | `example/app.json` (just `name`/`displayName`), `@react-native-community/cli` dep | same as Nitro |

Suggested rule: `expo-module.config.json` → Expo (prebuild). Else committed `example/android/settings.gradle` /
`example/ios/Podfile` → bare (no prebuild). Plus `nitro.json` → run `nitrogen` first (the repo's `nitrogen` script).
Scheme = podspec `s.name` wherever the podspec lives (root or `ios/`).

## Acceptance

| Check | Result |
|---|---|
| `out-bare/kotlin/` has the library's public types | yes, 22 files: `ProbeInfo` (index, constructor, `label`, `value`, `unit`, `format`), plus `BareProbe`, `BareProbePackage` (scaffold, public by Kotlin default, undocumented), `HybridBareProbeSpec` (nitrogen-generated, from `nitrogen/generated/android/kotlin`) |
| KDoc `@suppress` hides | yes: no file in `out-bare/kotlin` mentions `HiddenProbeHelper` or `secret` |
| `out-bare/swift/` has the library's public types | yes, 34 pages + manifest: `probeinfo.md` and 5 member pages, plus nitrogen glue (`hybridbareprobespec_protocol`, `_base`, `_cxx` with 11 members, typealias `hybridbareprobespec`, `bareprobeautolinking`) and the C++ leaks above |
| `@_documentation(visibility: internal)` hides | yes: no file in the whole `.doccarchive` (JSON included) mentions `HiddenProbeHelper` or `secret` |
| Commands differ only in the host-app step | almost: no `expo prebuild`, but `yarn nitrogen` is added (library codegen, Nitro only). Init script, Gradle invocation, docbuild flags and copy steps are unchanged; the scheme and archive name follow the podspec as before |

Page format (breadcrumbs, `[androidJvm]` prefixes, DocC metadata comment, bare code fences, lowercase file names) is
the same as in S2/S3.

## Build times (this Mac, warm Gradle/Dokka/Hermes caches from earlier spikes)

- Scaffold: 17 s. `yarn install`: 46 s. `yarn nitrogen`: 4 s.
- Dokka task: 1 min 10 s (`BUILD SUCCESSFUL in 1m 9s`, 40 tasks).
- `pod install`: 1 min 54 s (Hermes tarball from the shared cache, React-Core prebuilt).
- `docbuild`, empty DerivedData: 1 min 15 s wall (compiles NitroModules from source, which is why it is slower than
  S3's 53 s).

## Problems and workarounds

1. Turbo module can't be scaffolded with Swift (see above). Worked around by using a Nitro module. A real Turbo
   library with Swift (Swift class + ObjC++ shim, hand-written) is untested; expect its Swift to be `@objc` internal
   classes, so DocC would show little unless the author makes types `public`.
2. `yarn install` didn't generate `nitrogen/` (Yarn 4 skips the root `prepare`); the first `ls nitrogen/generated`
   failed. Fix: `yarn nitrogen`.
3. No problem with either recipe itself.

## For the phase-2 generator

- Detect Nitro (`nitro.json`) and run the repo's `nitrogen` script before the Kotlin/Swift steps. For Turbo
  (`codegenConfig`), no extra step was needed for docs here (RN codegen runs inside Gradle/`pod install`), but that
  is untested on a Turbo build.
- Run `pod install` on a throwaway copy, or restore `example/ios` afterwards: on bare repos it rewrites committed
  files.
- Take only `<scheme>.doccarchive`; ignore dependency archives such as `NitroModules.doccarchive`.
- Expect generated public API in both languages (nitrogen specs/glue, the C++ namespace/macro leaks, the scaffold's
  `*Package`). Hiding it is the library author's job (`@suppress`, `internal`, podspec header scoping), or a
  generator filter; nitrogen regenerates its files, so authors can't annotate them.
