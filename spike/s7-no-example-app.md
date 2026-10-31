# S7: Kotlin and Swift docs without an example app

Purpose: record how the tool could document a library that has no example app, a possible future path. Today the
Kotlin and Swift generators build inside `example/` (see the README), because the library's `android/` and podspec
can't build on their own. Not implemented; nothing here is wired into the tool.

Researched on 2026-10-31 with RN 0.88, Expo SDK 58, AGP 9.2.1, Gradle 9.4.1, Dokka 2.2.0, Xcode 27.2 (Swift 6.4.2),
CocoaPods 1.16.2. Test subjects, each a copy with `example/` deleted: S6's bare Nitro library, a
`create-react-native-library@0.64.0` Turbo scaffold, and minimal-rn-webview (Expo).

## Kotlin: a generated host build

Three static files in a temp dir stand in for the app's root project, with no app module:
[android-host-bare/](s7-no-example-app/android-host-bare) and, for Expo modules,
[android-host-expo/](s7-no-example-app/android-host-expo). Gradle comes from the wrapper that ships in
`@react-native/gradle-plugin`; the init script is the existing `assets/dokka-gfm.init.gradle`.

```sh
H=$(mktemp -d) && cp android-host-bare/* "$H"   # android-host-expo/* for Expo modules
NODE_PATH="$LIB/node_modules" "$LIB/node_modules/@react-native/gradle-plugin/gradlew" -p "$H" \
  --init-script assets/dokka-gfm.init.gradle -PrnLibRoot="$(cd "$LIB" && pwd -P)" \
  -PdokkaProject=:<npm-name> [:<npm-name>:generateCodegenArtifactsFromSchema] :<npm-name>:dokkaGenerateMarkdown
```

Output lands in `$LIB/android/build/dokka/markdown`, as today. Verified identical to the example-app output on all
three subjects; 10–60 s on warm Gradle caches.

What the host files do:
- Bare `settings.gradle`: includes the RN Gradle plugin (`includeBuild`), the library's `android/` as `:<npm-name>`,
  and every `dependencies`/`peerDependencies` package with an `android/build.gradle(.kts)` (autolinking's naming).
- Bare `build.gradle`: AGP, RN plugin and KGP on the buildscript classpath, versions from the included build; SDK
  levels from `node_modules/react-native/gradle/libs.versions.toml`; then what the RN plugin otherwise does only for an
  `:app` project: react-android version and substitution, repositories, JDK toolchains, and `privateReact.root` so
  codegen finds `node_modules`.
- Expo: Expo's settings plugin (`expoAutolinking.projectRoot`, `useExpoModules()`, `useExpoVersionCatalog()`) and
  `expo-root-project` replace the dependency discovery and SDK levels. Expo's plugins run `node` from the Gradle root,
  hence `NODE_PATH`; paths must be canonical (`/var` vs `/private/var` makes two included builds clash).

Risks:
- Calls RN Gradle plugin internals: `DependencyUtils`, `JdkConfiguratorUtils`, the `privateReact` extension. A
  hand-written fallback (force react-android to `ReactAndroid/gradle.properties`' `VERSION_NAME`, substitute
  `react-native:+`, `kotlin.jvmToolchain(17)`) is about 10 lines.
- Hard-codes `android.builtInKotlin=false` and `android.newDsl=false`, which AGP 10 removes.
- Dependency discovery approximates autolinking: it misses native deps listed only in `devDependencies` and custom
  `react-native.config.js` source dirs.

Rejected: the Dokka CLI on sources without compiling. Unresolved supertypes render as `ERROR CLASS`, inherited members
disappear, and an override of a protected member gets its own page.

## Swift: a symbol graph straight from `swiftc`

`swiftc` writes a symbol graph even when imports don't resolve, with the experimental frontend flag
`-experimental-allow-module-with-compiler-errors`; unresolved types keep their spelling. DocC then converts it with the
same Markdown flags Xcode passes, and `exportArchive` in `src/swift.ts` takes the archive unchanged.

```sh
SDK=$(xcrun --sdk iphonesimulator --show-sdk-path)
C="-target arm64-apple-ios17.0-simulator -sdk $SDK -module-cache-path $W/mc \
   -Xfrontend -experimental-allow-module-with-compiler-errors -Xfrontend -experimental-skip-all-function-bodies"
# a partial module per Swift dependency (NitroModules, ExpoModulesCore) restores inheritance and conformances
xcrun --sdk iphonesimulator swiftc -emit-module -module-name NitroModules $C -o $W/dep/NitroModules.swiftmodule \
  $(find node_modules/react-native-nitro-modules/ios -name '*.swift')
xcrun --sdk iphonesimulator swiftc -emit-module -module-name <Pod> $C -I $W/dep [-import-objc-header $W/bridge.h] \
  -emit-symbol-graph -emit-symbol-graph-dir $W/sg -o $W/<Pod>.swiftmodule <the pod's Swift sources>
xcrun docc convert --fallback-display-name <Pod> --fallback-bundle-identifier org.cocoapods.<Pod> \
  --output-dir $W/<Pod>.doccarchive --additional-symbol-graph-dir $W/sg --enable-experimental-markdown-output \
  --enable-experimental-markdown-output-manifest --no-transform-for-static-hosting
```

Results:
- Expo (minimal-rn-webview): identical to the tool's current output, including the ObjC helper pages from a bridging
  header that imports each `ios/*.h`. 2.7 s, plus 47 s once for the ExpoModulesCore partial module.
- Bare Nitro: every Swift page; misses the 4 C++-interop pages S6 lists as noise (`bareprobe`, `facebook`, `margelo`,
  `nitro_version`), and 3 C++-typed members get different `preciseIdentifier`s. About 5 s.
- Without the partial dependency modules, inheritance and conformances to those modules disappear.

Risks:
- Both frontend flags are experimental and undocumented; a new Xcode can break them. Needs a smoke test per Xcode.
- `swiftc` exits 0 despite errors: check that `<Pod>.symbols.json` was written.
- An `#import` the bridging header can't resolve is fatal (`failed to emit precompiled header`); include only
  headers that pass `xcrun clang -fsyntax-only`.
- Without CocoaPods the tool must derive the source files (podspec globs, nitrogen's generated Swift), the module name
  (`s.name`), and which `node_modules` package provides each `import`. `#if canImport(...)` may take other branches
  than in a real build. The npm-shipped ExpoModulesCore binary can't be used (built by another Swift version).
- Turbo modules with Swift were tested only on a synthetic `@objc public class`.

Alternative, verified: a Podfile in a temp dir (`integrate_targets: false`, an empty generated `.xcodeproj` target,
`use_react_native!` from the library's `node_modules`, the pod via `:path`, `NODE_PATH` for Nitro), then
`xcodebuild docbuild -project Pods/Pods.xcodeproj -scheme <Pod>`. Byte-identical output, but about 2 min 40 s and
about 300 MB of RN prebuilts on a cold cache, and it depends on RN's Podfile API. `pod lib lint` doesn't work: the
podspec needs RN's Podfile helpers (`undefined local variable or method 'min_ios_version_supported'`).
